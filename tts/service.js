/**
 * Unified Malayalam TTS Service with caching, provider switching, and zero key leakage.
 */

import fs from 'node:fs';
import path from 'node:path';
import { AudioDiskCache, buildCacheKey } from './cache.js';
import { PROVIDER_ADAPTERS, isProviderConfigured } from './providers.js';
import { PROVIDER_CATALOG, formatSpeechPayload, normalizeInputKey } from './ssml.js';

export function createMalayalamTtsService({
  env = process.env,
  cacheDir = path.resolve('assets/voices/cache'),
  manifestPath = path.resolve('assets/voices/manifest.json'),
  fetchImpl = fetch,
} = {}) {
  const cache = new AudioDiskCache(cacheDir);
  const inflight = new Map();

  function getDefaultProvider() {
    const requested = (env.TTS_PROVIDER || '').toLowerCase();
    if (requested && PROVIDER_CATALOG[requested]) return requested;
    if (isProviderConfigured('azure', env)) return 'azure';
    if (isProviderConfigured('google', env)) return 'google';
    if (isProviderConfigured('gnani', env)) return 'gnani';
    return 'azure';
  }

  function getPublicConfig() {
    const activeProvider = getDefaultProvider();
    return {
      activeProvider,
      defaultGender: env.TTS_GENDER_MODE || 'auto',
      defaultVoice: env.TTS_VOICE_OVERRIDE || 'auto',
      cache: cache.stats(),
      providers: Object.values(PROVIDER_CATALOG).map((p) => ({
        id: p.id,
        label: p.label,
        configured: isProviderConfigured(p.id, env),
        voices: p.voices,
      })),
    };
  }

  async function synthesizeSpeech({
    text,
    charId = 'announcer',
    provider = getDefaultProvider(),
    voiceId = env.TTS_VOICE_OVERRIDE || 'auto',
    gender = env.TTS_GENDER_MODE || 'auto',
  }) {
    const safeProvider = PROVIDER_CATALOG[provider] ? provider : getDefaultProvider();
    const payload = formatSpeechPayload({
      text,
      charId,
      provider: safeProvider,
      voiceId,
      gender,
    });

    if (!payload.text) {
      throw new Error('Empty text supplied for Malayalam TTS synthesis.');
    }

    const cacheKey = buildCacheKey({
      provider: payload.provider,
      voiceId: payload.voiceId,
      languageCode: payload.languageCode,
      text: payload.text,
      ssml: payload.ssml,
      rate: payload.profile.rate,
      pitchPct: payload.profile.pitchPct,
    });

    const cached = cache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        cacheHit: true,
        payload,
      };
    }

    if (inflight.has(cacheKey)) {
      return inflight.get(cacheKey);
    }

    const adapter = PROVIDER_ADAPTERS[payload.provider];
    const work = (async () => {
      const { buffer, mimeType, ext } = await adapter(payload, env, fetchImpl);
      const saved = cache.set(cacheKey, buffer, {
        mimeType,
        ext,
        meta: {
          provider: payload.provider,
          voiceId: payload.voiceId,
          charId,
          text: payload.text,
        },
      });
      return {
        ...saved,
        cacheHit: false,
        payload,
      };
    })();

    inflight.set(cacheKey, work);
    try {
      return await work;
    } finally {
      inflight.delete(cacheKey);
    }
  }

  function writeManifestEntry(textKey, cachedFile) {
    let current = {};
    if (fs.existsSync(manifestPath)) {
      try {
        current = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) || {};
      } catch {
        current = {};
      }
    }
    current[textKey] = `cache/${cachedFile}`;
    const stripped = normalizeInputKey(textKey);
    if (stripped) current[stripped] = `cache/${cachedFile}`;
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(current, null, 2), 'utf8');
  }

  return {
    getPublicConfig,
    synthesizeSpeech,
    writeManifestEntry,
    getCacheStats: () => cache.stats(),
  };
}
