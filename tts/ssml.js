/**
 * Malayalam (`ml-IN`) voice catalog, character prosody profiles,
 * and Manglish/English code-switching SSML & text normalizer.
 */

import { MALAYALAM_LINES } from '../src/characters.js';

export const PROVIDER_CATALOG = {
  azure: {
    id: 'azure',
    label: 'Azure AI Speech (ml-IN Neural)',
    supportsSsml: true,
    voices: [
      { id: 'ml-IN-MidhunNeural', gender: 'male', label: 'Midhun (Kerala Male · Neural)' },
      { id: 'ml-IN-SobhanaNeural', gender: 'female', label: 'Sobhana (Kerala Female · Neural)' },
    ],
  },
  google: {
    id: 'google',
    label: 'Google Cloud TTS (ml-IN)',
    supportsSsml: true,
    voices: [
      { id: 'ml-IN-Chirp3-HD-Achird', gender: 'male', label: 'Chirp 3 HD Achird (Male · Conversational)', tier: 'chirp3' },
      { id: 'ml-IN-Chirp3-HD-Achernar', gender: 'female', label: 'Chirp 3 HD Achernar (Female · Conversational)', tier: 'chirp3' },
      { id: 'ml-IN-Chirp3-HD-Aoede', gender: 'female', label: 'Chirp 3 HD Aoede (Female · Warm)', tier: 'chirp3' },
      { id: 'ml-IN-Wavenet-B', gender: 'male', label: 'WaveNet B (Male · SSML + Prosody)', tier: 'wavenet' },
      { id: 'ml-IN-Wavenet-D', gender: 'male', label: 'WaveNet D (Male · Deep SSML)', tier: 'wavenet' },
      { id: 'ml-IN-Wavenet-A', gender: 'female', label: 'WaveNet A (Female · SSML + Prosody)', tier: 'wavenet' },
      { id: 'ml-IN-Wavenet-C', gender: 'female', label: 'WaveNet C (Female · Expressive SSML)', tier: 'wavenet' },
    ],
  },
  gnani: {
    id: 'gnani',
    label: 'Gnani.ai Vachana TTS (ml-IN)',
    supportsSsml: false,
    voices: [
      { id: 'male', gender: 'male', label: 'Vachana Male (ml-IN · Timbre v3.0)' },
      { id: 'female', gender: 'female', label: 'Vachana Female (ml-IN · Timbre v3.0)' },
    ],
  },
};

export const CHAR_SPEECH_PROFILES = {
  maveli: { gender: 'male', rate: 0.94, pitchPct: -6 },
  george: { gender: 'male', rate: 1.0, pitchPct: -2 },
  unniyarcha: { gender: 'female', rate: 1.03, pitchPct: 4 },
  theyyam: { gender: 'male', rate: 0.9, pitchPct: -10 },
  kuttan: { gender: 'male', rate: 1.05, pitchPct: 2 },
  digambaran: { gender: 'male', rate: 0.92, pitchPct: -8 },
  minnal: { gender: 'male', rate: 1.06, pitchPct: 3 },
  kathakali: { gender: 'male', rate: 0.93, pitchPct: -7 },
  nagavalli: { gender: 'female', rate: 1.0, pitchPct: 3 },
  murugan: { gender: 'male', rate: 1.01, pitchPct: -4 },
  audience: { gender: 'male', rate: 1.07, pitchPct: 3 },
  announcer: { gender: 'male', rate: 0.98, pitchPct: -3 },
};

export function normalizeInputKey(raw) {
  return String(raw || '')
    .replace(/^[A-Z0-9 ]+:\s*/, '')
    .trim();
}

export function resolveMalayalamScript(rawText) {
  const input = String(rawText || '').trim();
  if (!input) return '';
  const stripped = normalizeInputKey(input);
  const direct = MALAYALAM_LINES[input]?.ml || MALAYALAM_LINES[stripped]?.ml;
  if (direct) return direct;
  return stripped.replace(/(\d+)%/g, '$1 ശതമാനം');
}

export function isChirp3Voice(voiceId) {
  return /Chirp3-HD/i.test(String(voiceId || ''));
}

export function resolveVoiceForRequest({ provider = 'azure', charId = 'announcer', gender = 'auto', voiceId = '' }) {
  const catalog = PROVIDER_CATALOG[provider] || PROVIDER_CATALOG.azure;
  const profile = CHAR_SPEECH_PROFILES[charId] || CHAR_SPEECH_PROFILES.announcer;
  if (voiceId && voiceId !== 'auto') {
    const found = catalog.voices.find((v) => v.id === voiceId);
    if (found) return { voice: found, profile, catalog };
    return {
      voice: { id: voiceId, gender: gender === 'female' ? 'female' : 'male', tier: isChirp3Voice(voiceId) ? 'chirp3' : 'custom' },
      profile,
      catalog,
    };
  }
  const targetGender = gender === 'male' || gender === 'female' ? gender : profile.gender;
  const matched = catalog.voices.find((v) => v.gender === targetGender) || catalog.voices[0];
  return { voice: matched, profile, catalog };
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts mixed Malayalam + English (Manglish/code-switched) dialogue into SSML fragments:
 * - Natural rhythmic pauses around ellipses/dashes
 * - Inline English spans wrapped cleanly in `<lang xml:lang="en-IN">`
 */
export function buildCodeSwitchedSsmlInner(malayalamText) {
  const cleaned = String(malayalamText || '')
    .replace(/\.{3,}/g, ' __BR220__ ')
    .replace(/\s*[—–]\s*/g, ' __BR160__ ')
    .trim();

  // Split ASCII Latin phrases/acronyms embedded inside Malayalam text for clean Indian-English pronunciation
  const tokenRegex = /(__BR220__|__BR160__|[A-Za-z][A-Za-z0-9'\-.:/+]*(?:\s+[A-Za-z][A-Za-z0-9'\-.:/+]*)*)/g;
  let out = '';
  let lastIdx = 0;

  for (const match of cleaned.matchAll(tokenRegex)) {
    const idx = match.index;
    if (idx > lastIdx) {
      out += escapeXml(cleaned.slice(lastIdx, idx));
    }
    const token = match[0];
    if (token === '__BR220__') {
      out += '<break time="220ms"/>';
    } else if (token === '__BR160__') {
      out += '<break time="160ms"/>';
    } else {
      out += `<lang xml:lang="en-IN">${escapeXml(token)}</lang>`;
    }
    lastIdx = idx + token.length;
  }
  if (lastIdx < cleaned.length) {
    out += escapeXml(cleaned.slice(lastIdx));
  }
  return out;
}

export function formatSpeechPayload({ text, charId = 'announcer', provider = 'azure', voiceId = 'auto', gender = 'auto' }) {
  const mlText = resolveMalayalamScript(text);
  const { voice, profile, catalog } = resolveVoiceForRequest({ provider, charId, gender, voiceId });
  const supportsSsml = catalog.supportsSsml && !isChirp3Voice(voice.id);

  if (!supportsSsml) {
    return {
      provider: catalog.id,
      voiceId: voice.id,
      gender: voice.gender,
      languageCode: 'ml-IN',
      useSsml: false,
      text: mlText,
      ssml: null,
      profile,
    };
  }

  const inner = buildCodeSwitchedSsmlInner(mlText);
  const rateStr = `${Math.round((profile.rate - 1) * 100) >= 0 ? '+' : ''}${Math.round((profile.rate - 1) * 100)}%`;
  const pitchStr = `${profile.pitchPct >= 0 ? '+' : ''}${profile.pitchPct}%`;

  const ssml =
    catalog.id === 'azure'
      ? `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ml-IN"><voice name="${escapeXml(voice.id)}"><prosody rate="${rateStr}" pitch="${pitchStr}">${inner}</prosody></voice></speak>`
      : `<speak>${inner}</speak>`;

  return {
    provider: catalog.id,
    voiceId: voice.id,
    gender: voice.gender,
    languageCode: 'ml-IN',
    useSsml: true,
    text: mlText,
    ssml,
    profile,
  };
}
