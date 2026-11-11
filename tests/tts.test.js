import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildCodeSwitchedSsmlInner,
  formatSpeechPayload,
  resolveMalayalamScript,
} from '../tts/ssml.js';
import { AudioDiskCache, parseDotEnv } from '../tts/cache.js';
import { createMalayalamTtsService } from '../tts/service.js';
import { createAudioEngine } from '../src/audio.js';

test('Resolves Malayalam text and preserves Manglish code-switching in SSML', () => {
  const ml = resolveMalayalamScript('Pathalathil ninnum direct delivery!');
  assert.match(ml, /[\u0D00-\u0D7F]/, 'Resolved dialogue uses Malayalam Unicode script');

  const mixed = 'പാതാളത്തിൽ Wi-Fi ഇല്ല... Direct Delivery 100% ready — തുടങ്ങാം!';
  const normalized = resolveMalayalamScript(mixed);
  const ssmlInner = buildCodeSwitchedSsmlInner(normalized);
  assert.match(ssmlInner, /<lang xml:lang="en-IN">Wi-Fi<\/lang>/);
  assert.match(ssmlInner, /<lang xml:lang="en-IN">Direct Delivery<\/lang>/);
  assert.match(ssmlInner, /100 ശതമാനം/);
  assert.match(ssmlInner, /<break time="220ms"\/>/);
  assert.match(ssmlInner, /<break time="160ms"\/>/);
});

test('Selects Kerala male/female ml-IN voices across Azure, Google (Chirp3 & WaveNet), and Gnani', () => {
  const azMale = formatSpeechPayload({ provider: 'azure', charId: 'maveli', text: 'POOKKALAM POWER!' });
  assert.equal(azMale.voiceId, 'ml-IN-MidhunNeural');
  assert.equal(azMale.useSsml, true);
  assert.match(azMale.ssml, /xml:lang="ml-IN"/);

  const azFemale = formatSpeechPayload({ provider: 'azure', charId: 'unniyarcha', text: 'URUMI WHIP!' });
  assert.equal(azFemale.voiceId, 'ml-IN-SobhanaNeural');
  assert.equal(azFemale.gender, 'female');

  const gChirp = formatSpeechPayload({ provider: 'google', charId: 'george', text: 'ADI SAKE!' });
  assert.equal(gChirp.voiceId, 'ml-IN-Chirp3-HD-Achird');
  assert.equal(gChirp.useSsml, false, 'Chirp 3 HD receives plain text rather than SSML');

  const gWave = formatSpeechPayload({
    provider: 'google',
    charId: 'unniyarcha',
    voiceId: 'ml-IN-Wavenet-A',
    text: 'ഉണ്ണിയാർച്ച ready!',
  });
  assert.equal(gWave.voiceId, 'ml-IN-Wavenet-A');
  assert.equal(gWave.useSsml, true);
  assert.match(gWave.ssml, /<lang xml:lang="en-IN">ready<\/lang>/);

  const gnaniMale = formatSpeechPayload({ provider: 'gnani', charId: 'kuttan', text: 'PEEP PEEP!' });
  assert.equal(gnaniMale.voiceId, 'male');
  assert.equal(gnaniMale.languageCode, 'ml-IN');
});

test('Synthesizes via Azure/Google/Gnani adapters, caches to disk, and never leaks secrets', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mallu-tts-'));
  try {
    const fakeMp3 = Buffer.from('ID3-FAKE-MP3-BYTES');
    let fetchCalls = 0;
    const seenRequests = [];

    const mockFetch = async (url, init) => {
      fetchCalls += 1;
      seenRequests.push({ url, headers: init.headers, body: init.body });
      if (url.includes('googleapis.com')) {
        return {
          ok: true,
          json: async () => ({ audioContent: fakeMp3.toString('base64') }),
        };
      }
      return {
        ok: true,
        headers: { get: () => 'audio/mpeg' },
        arrayBuffer: async () => fakeMp3,
      };
    };

    const env = {
      TTS_PROVIDER: 'azure',
      AZURE_SPEECH_KEY: 'super-secret-az-key',
      AZURE_SPEECH_REGION: 'centralindia',
      GOOGLE_CLOUD_TTS_API_KEY: 'super-secret-gcp-key',
      GNANI_API_KEY: 'super-secret-gnani-key',
    };

    const service = createMalayalamTtsService({
      env,
      cacheDir: path.join(tmpDir, 'cache'),
      manifestPath: path.join(tmpDir, 'manifest.json'),
      fetchImpl: mockFetch,
    });

    // Security check: public config contains boolean flags only, zero secrets
    const pubJson = JSON.stringify(service.getPublicConfig());
    assert.ok(!pubJson.includes('super-secret-az-key'));
    assert.ok(!pubJson.includes('super-secret-gcp-key'));
    assert.ok(!pubJson.includes('super-secret-gnani-key'));
    assert.equal(service.getPublicConfig().activeProvider, 'azure');

    // First call hits Azure API
    const r1 = await service.synthesizeSpeech({ charId: 'maveli', text: 'Pathalathil ninnum direct delivery!' });
    assert.equal(r1.cacheHit, false);
    assert.equal(fetchCalls, 1);
    assert.match(seenRequests[0].url, /centralindia\.tts\.speech\.microsoft\.com/);
    assert.equal(seenRequests[0].headers['Ocp-Apim-Subscription-Key'], 'super-secret-az-key');

    // Second call hits disk cache (0 API calls)
    const r2 = await service.synthesizeSpeech({ charId: 'maveli', text: 'Pathalathil ninnum direct delivery!' });
    assert.equal(r2.cacheHit, true);
    assert.equal(fetchCalls, 1);

    // Brand-new service instance still hits persistent disk cache
    const serviceReloaded = createMalayalamTtsService({
      env,
      cacheDir: path.join(tmpDir, 'cache'),
      manifestPath: path.join(tmpDir, 'manifest.json'),
      fetchImpl: mockFetch,
    });
    const r3 = await serviceReloaded.synthesizeSpeech({ charId: 'maveli', text: 'Pathalathil ninnum direct delivery!' });
    assert.equal(r3.cacheHit, true);
    assert.equal(fetchCalls, 1);

    // Switching providers at runtime works cleanly for Google & Gnani
    const rGcp = await service.synthesizeSpeech({
      provider: 'google',
      charId: 'unniyarcha',
      text: 'Kalariyil padichatha... kalikkaan alla!',
    });
    assert.equal(rGcp.cacheHit, false);
    assert.equal(fetchCalls, 2);
    assert.equal(seenRequests[1].headers['X-Goog-Api-Key'], 'super-secret-gcp-key');

    const rGnani = await service.synthesizeSpeech({
      provider: 'gnani',
      charId: 'george',
      text: 'ADI SAKE!',
    });
    assert.equal(rGnani.cacheHit, false);
    assert.equal(fetchCalls, 3);
    assert.equal(seenRequests[2].headers['X-API-Key-ID'], 'super-secret-gnani-key');
    assert.equal(JSON.parse(seenRequests[2].body).language, 'ml-IN');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Env parser parses values cleanly and AudioEngine caches cloud audio URLs', async () => {
  const parsed = parseDotEnv('# comment\nAZURE_SPEECH_KEY="abc-123"\nAZURE_SPEECH_REGION=centralindia\n');
  assert.equal(parsed.AZURE_SPEECH_KEY, 'abc-123');
  assert.equal(parsed.AZURE_SPEECH_REGION, 'centralindia');

  const played = [];
  let speakPosts = 0;
  const origWindow = globalThis.window;
  const origAudio = globalThis.Audio;
  const origUrl = globalThis.URL;

  try {
    globalThis.window = { location: { protocol: 'http:' } };
    globalThis.Audio = class {
      constructor(u) { this.u = u; this.paused = false; this.ended = true; }
      pause() {}
      play() { played.push(this.u); return Promise.resolve(); }
    };
    globalThis.URL = { createObjectURL: () => 'blob:mock-malayalam-mp3' };

    const mockFetch = async (url) => {
      if (url === '/api/tts/config') {
        return {
          ok: true,
          json: async () => ({
            activeProvider: 'azure',
            providers: [{ id: 'azure', label: 'Azure', configured: true, voices: [] }],
          }),
        };
      }
      speakPosts += 1;
      return { ok: true, blob: async () => ({ size: 128 }) };
    };

    const audio = createAudioEngine();
    globalThis.fetch = mockFetch;
    await audio.initCloudTts(mockFetch);
    assert.equal(audio.isCloudProviderConfigured('azure'), true);

    audio.speakLine('unniyarcha', 'URUMI WHIP!', true);
    await new Promise((r) => setTimeout(r, 20));
    audio.speakLine('unniyarcha', 'URUMI WHIP!', true);
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(speakPosts, 1, 'Client audio cache avoided duplicate /api/tts/speak call');
    assert.deepEqual(played, ['blob:mock-malayalam-mp3', 'blob:mock-malayalam-mp3']);
  } finally {
    globalThis.window = origWindow;
    globalThis.Audio = origAudio;
    globalThis.URL = origUrl;
    delete globalThis.fetch;
  }
});
