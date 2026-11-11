/**
 * Pluggable Cloud Malayalam (`ml-IN`) TTS provider adapters:
 * 1. Azure AI Speech (`ml-IN-MidhunNeural`, `ml-IN-SobhanaNeural`)
 * 2. Google Cloud Text-to-Speech (`ml-IN-Chirp3-HD-*` & `ml-IN-Wavenet-*`)
 * 3. Gnani.ai Vachana TTS (`timbre-v3.0` / `timbre-v2.5`, `ml-IN`)
 */

export async function synthesizeWithAzure(payload, env, fetchImpl = fetch) {
  const key = env.AZURE_SPEECH_KEY;
  const region = env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new Error('Missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION environment variables.');
  }

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
      'User-Agent': 'MalluFighterII-TTS',
    },
    body: payload.ssml,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Azure Speech error ${res.status}: ${errText.slice(0, 220)}`);
  }

  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mimeType: 'audio/mpeg',
    ext: 'mp3',
  };
}

export async function synthesizeWithGoogle(payload, env, fetchImpl = fetch) {
  const apiKey = env.GOOGLE_CLOUD_TTS_API_KEY;
  const accessToken = env.GOOGLE_CLOUD_TTS_ACCESS_TOKEN;
  if (!apiKey && !accessToken) {
    throw new Error('Missing GOOGLE_CLOUD_TTS_API_KEY or GOOGLE_CLOUD_TTS_ACCESS_TOKEN environment variable.');
  }

  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (apiKey) headers['X-Goog-Api-Key'] = apiKey;
  else headers.Authorization = `Bearer ${accessToken}`;

  const input = payload.useSsml ? { ssml: payload.ssml } : { text: payload.text };
  const audioConfig = { audioEncoding: 'MP3' };
  if (payload.useSsml) {
    audioConfig.speakingRate = payload.profile.rate;
    audioConfig.pitch = payload.profile.pitchPct * 0.4;
  }

  const body = {
    input,
    voice: {
      languageCode: 'ml-IN',
      name: payload.voiceId,
    },
    audioConfig,
  };

  const res = await fetchImpl('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Cloud TTS error ${res.status}: ${errText.slice(0, 220)}`);
  }

  const data = await res.json();
  if (!data?.audioContent) {
    throw new Error('Google Cloud TTS returned empty audioContent.');
  }

  return {
    buffer: Buffer.from(data.audioContent, 'base64'),
    mimeType: 'audio/mpeg',
    ext: 'mp3',
  };
}

export async function synthesizeWithGnani(payload, env, fetchImpl = fetch) {
  const apiKey = env.GNANI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GNANI_API_KEY environment variable.');
  }

  const model = env.GNANI_TTS_MODEL || 'timbre-v3.0';
  const voiceName =
    payload.voiceId === 'female'
      ? (env.GNANI_TTS_VOICE_FEMALE || 'female')
      : payload.voiceId === 'male'
        ? (env.GNANI_TTS_VOICE_MALE || 'male')
        : payload.voiceId;

  const res = await fetchImpl('https://api.vachana.ai/api/v1/tts/inference', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key-ID': apiKey,
    },
    body: JSON.stringify({
      text: payload.text,
      model,
      language: 'ml-IN',
      voice: voiceName,
      speed: payload.profile.rate,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gnani Vachana TTS error ${res.status}: ${errText.slice(0, 220)}`);
  }

  const contentType = res.headers?.get?.('content-type') || 'audio/wav';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    const b64 = data.audio || data.audioContent || data.data;
    if (!b64) throw new Error('Gnani Vachana TTS JSON lacked audio bytes.');
    return { buffer: Buffer.from(b64, 'base64'), mimeType: 'audio/wav', ext: 'wav' };
  }

  const isMp3 = contentType.includes('mpeg') || contentType.includes('mp3');
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mimeType: isMp3 ? 'audio/mpeg' : 'audio/wav',
    ext: isMp3 ? 'mp3' : 'wav',
  };
}

export const PROVIDER_ADAPTERS = {
  azure: synthesizeWithAzure,
  google: synthesizeWithGoogle,
  gnani: synthesizeWithGnani,
};

export function isProviderConfigured(providerId, env) {
  if (providerId === 'azure') return Boolean(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION);
  if (providerId === 'google') return Boolean(env.GOOGLE_CLOUD_TTS_API_KEY || env.GOOGLE_CLOUD_TTS_ACCESS_TOKEN);
  if (providerId === 'gnani') return Boolean(env.GNANI_API_KEY);
  return false;
}
