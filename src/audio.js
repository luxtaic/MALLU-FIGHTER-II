/**
 * 16-bit Arcade, Kerala Onappattu + Chenda Melam Synthesizer,
 * and Native Malayalam (ml-IN) / Kerala Phonetic Voice Engine.
 */

import { MALAYALAM_LINES } from './characters.js';

export function createAudioEngine() {
  let ctx = null;
  let musicEnabled = true;
  let sfxEnabled = true;
  let voiceEnabled = true;
  let musicInterval = null;
  let stepIndex = 0;

  const FEMALE_FIGHTERS = new Set(['unniyarcha', 'nagavalli']);

  const VOICE_PROFILES = {
    maveli: { pitch: 0.84, rate: 0.96 },
    george: { pitch: 0.94, rate: 1.0 },
    unniyarcha: { pitch: 1.18, rate: 1.02 },
    theyyam: { pitch: 0.74, rate: 0.92 },
    kuttan: { pitch: 1.06, rate: 1.05 },
    digambaran: { pitch: 0.78, rate: 0.93 },
    minnal: { pitch: 1.04, rate: 1.06 },
    kathakali: { pitch: 0.82, rate: 0.94 },
    nagavalli: { pitch: 1.16, rate: 1.0 },
    murugan: { pitch: 0.88, rate: 1.01 },
    audience: { pitch: 1.12, rate: 1.05 },
    announcer: { pitch: 0.88, rate: 1.0 },
  };

  function toSmoothKeralaPhonetic(raw) {
    return raw
      .replace(/^[A-Z0-9 ]+:\s*/, '')
      .replace(/\bmwone\b/gi, 'monay')
      .replace(/\bmachane\b/gi, 'machaanay')
      .replace(/\bpakshe\b/gi, 'pakshay')
      .replace(/\bsake\b/gi, 'sakay')
      .replace(/\bchaya\b/gi, 'chaayaa')
      .replace(/\bpayasam\b/gi, 'paayasam')
      .replace(/\bnjan\b/gi, 'nyaan')
      .replace(/\bente\b/gi, 'entay')
      .replace(/\balle\b/gi, 'allay')
      .replace(/[—!?]+/g, ', ');
  }

  let cachedVoices = [];
  function refreshVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      cachedVoices = window.speechSynthesis.getVoices() || [];
    }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    refreshVoices();
    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
  }

  function pickPreferredVoice(voices, charId) {
    if (!voices || voices.length === 0) return { voice: null, hasMl: false };
    const isFemale = FEMALE_FIGHTERS.has(charId);
    const mlVoices = voices.filter((v) => /ml[-_]?IN|malayalam/i.test(v.lang + ' ' + v.name));
    if (mlVoices.length > 0) {
      if (isFemale) {
        return { voice: mlVoices.find((v) => /sobhana|female/i.test(v.name)) || mlVoices[0], hasMl: true };
      }
      return { voice: mlVoices.find((v) => /midhun|male/i.test(v.name)) || mlVoices[0], hasMl: true };
    }
    const indian = voices.filter((v) => /en[-_]?IN|India/i.test(v.lang + ' ' + v.name));
    const pool = indian.length > 0 ? indian : voices.filter((v) => /^en/i.test(v.lang));
    const list = pool.length > 0 ? pool : voices;
    if (isFemale) {
      return { voice: list.find((v) => /female|heera|neerja|zira|samantha/i.test(v.name)) || list[0], hasMl: false };
    }
    return { voice: list.find((v) => /ravi|prabhat|david|mark|male/i.test(v.name)) || list[0], hasMl: false };
  }

  function hasNativeMalayalamVoice() {
    if (cachedVoices.length === 0) refreshVoices();
    return cachedVoices.some((v) => /ml[-_]?IN|malayalam/i.test(v.lang + ' ' + v.name));
  }

  const customClips = new Map();
  const cloudUrlCache = new Map();
  const cloudInflight = new Map();
  let activeClipAudio = null;
  let voiceMode = 'humanFirst'; // 'humanFirst' | 'humanOnly' | 'allowFallback'
  const cloudState = {
    serverReachable: false,
    provider: 'azure',
    voiceId: 'auto',
    gender: 'auto',
    providers: [],
  };

  function normalizeVoiceKey(raw) {
    return String(raw || '')
      .replace(/^[A-Z0-9 ]+:\s*/, '')
      .trim();
  }

  function registerVoiceClip(key, url) {
    if (!key || !url) return;
    const norm = normalizeVoiceKey(key);
    customClips.set(key, url);
    if (norm) customClips.set(norm, url);
    const ml = MALAYALAM_LINES[key]?.ml || MALAYALAM_LINES[norm]?.ml;
    if (ml) customClips.set(ml.trim(), url);
  }

  function unregisterVoiceClip(key) {
    const norm = normalizeVoiceKey(key);
    customClips.delete(key);
    customClips.delete(norm);
    const ml = MALAYALAM_LINES[key]?.ml || MALAYALAM_LINES[norm]?.ml;
    if (ml) customClips.delete(ml.trim());
  }

  function hasVoiceClip(key) {
    const norm = normalizeVoiceKey(key);
    const ml = MALAYALAM_LINES[key]?.ml || MALAYALAM_LINES[norm]?.ml;
    return customClips.has(key) || customClips.has(norm) || (ml ? customClips.has(ml.trim()) : false);
  }

  function isCloudProviderConfigured(providerId = cloudState.provider) {
    const found = cloudState.providers.find((p) => p.id === providerId);
    return Boolean(found?.configured);
  }

  function buildCloudCacheKey(charId, text) {
    const stripped = normalizeVoiceKey(text);
    const mlText = MALAYALAM_LINES[text]?.ml || MALAYALAM_LINES[stripped]?.ml || stripped;
    return `${cloudState.provider}|${cloudState.voiceId}|${cloudState.gender}|${charId}|${mlText}`;
  }

  async function initCloudTts(fetchImpl = typeof fetch === 'function' ? fetch : null) {
    if (!fetchImpl || typeof window === 'undefined' || window.location?.protocol === 'file:') {
      return cloudState;
    }
    try {
      const res = await fetchImpl('/api/tts/config');
      if (!res.ok) return cloudState;
      const cfg = await res.json();
      cloudState.serverReachable = true;
      cloudState.providers = Array.isArray(cfg.providers) ? cfg.providers : [];
      if (cfg.activeProvider) cloudState.provider = cfg.activeProvider;
      if (cfg.defaultVoice) cloudState.voiceId = cfg.defaultVoice;
      if (cfg.defaultGender) cloudState.gender = cfg.defaultGender;
    } catch {
      // Static server / file:// mode without Node TTS proxy
    }
    return cloudState;
  }

  async function fetchCloudTtsAudio(charId, text, fetchImpl = typeof fetch === 'function' ? fetch : null) {
    const cacheKey = buildCloudCacheKey(charId, text);
    if (cloudUrlCache.has(cacheKey)) return cloudUrlCache.get(cacheKey);
    if (!fetchImpl || !cloudState.serverReachable || !isCloudProviderConfigured()) return null;
    if (cloudInflight.has(cacheKey)) return cloudInflight.get(cacheKey);

    const work = (async () => {
      try {
        const res = await fetchImpl('/api/tts/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            charId,
            provider: cloudState.provider,
            voiceId: cloudState.voiceId,
            gender: cloudState.gender,
          }),
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob || blob.size === 0 || typeof URL === 'undefined') return null;
        const url = URL.createObjectURL(blob);
        cloudUrlCache.set(cacheKey, url);
        return url;
      } catch {
        return null;
      } finally {
        cloudInflight.delete(cacheKey);
      }
    })();

    cloudInflight.set(cacheKey, work);
    return work;
  }

  function playAudioUrl(url, interrupt = false) {
    if (!url || typeof Audio === 'undefined') return false;
    try {
      if (!interrupt && activeClipAudio && !activeClipAudio.paused && !activeClipAudio.ended) {
        return true;
      }
      if (interrupt && activeClipAudio) {
        activeClipAudio.pause();
        activeClipAudio.currentTime = 0;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      const clip = new Audio(url);
      clip.volume = 0.96;
      activeClipAudio = clip;
      clip.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  function playKombuCue(charId) {
    if (!voiceEnabled) return;
    const ac = ensureContext();
    if (!ac) return;
    const base = charId === 'theyyam' || charId === 'digambaran' || charId === 'kathakali'
      ? 196
      : FEMALE_FIGHTERS.has(charId)
        ? 329.6
        : 246.9;
    tone(base, base * 1.25, 0.11, 'sawtooth', 0.075, 0);
    tone(base * 1.5, base * 1.5, 0.14, 'triangle', 0.065, 0.09);
  }

  function speakBrowserOrKombuFallback(charId, text, interrupt) {
    if (voiceMode === 'humanOnly') return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (interrupt) playKombuCue(charId);
      return;
    }
    try {
      const synth = window.speechSynthesis;
      if (cachedVoices.length === 0) refreshVoices();
      const { voice, hasMl } = pickPreferredVoice(cachedVoices, charId);
      if (!hasMl && voiceMode !== 'allowFallback') {
        if (interrupt) playKombuCue(charId);
        return;
      }
      if (interrupt) synth.cancel();
      else if (synth.speaking || synth.pending) return;

      const stripped = normalizeVoiceKey(text);
      const entry = MALAYALAM_LINES[text] || MALAYALAM_LINES[stripped];
      const spokenText = hasMl
        ? (entry?.ml || stripped)
        : (entry?.ph || toSmoothKeralaPhonetic(stripped));

      const utter = new SpeechSynthesisUtterance(spokenText);
      const prof = VOICE_PROFILES[charId] || VOICE_PROFILES.announcer;
      utter.pitch = prof.pitch;
      utter.rate = prof.rate;
      utter.volume = 0.95;
      if (hasMl) utter.lang = 'ml-IN';
      else if (voice?.lang) utter.lang = voice.lang;
      if (voice) utter.voice = voice;
      synth.speak(utter);
    } catch {
      // Ignore speech synthesis errors on restricted platforms
    }
  }

  function speakLine(charId, text, interrupt = false) {
    if (!voiceEnabled || typeof window === 'undefined' || !text) return;
    const stripped = normalizeVoiceKey(text);
    const mlText = MALAYALAM_LINES[text]?.ml || MALAYALAM_LINES[stripped]?.ml || '';

    // 1. Prioritize real pre-recorded / uploaded human dub clips & pre-cached manifest clips
    const clipUrl =
      customClips.get(text) ||
      customClips.get(stripped) ||
      (mlText ? customClips.get(mlText.trim()) : null);
    if (clipUrl && playAudioUrl(clipUrl, interrupt)) return;

    // 2. Check cached Cloud Malayalam TTS audio URL for instant zero-latency playback
    const cloudCacheKey = buildCloudCacheKey(charId, text);
    const cachedCloudUrl = cloudUrlCache.get(cloudCacheKey);
    if (cachedCloudUrl && playAudioUrl(cachedCloudUrl, interrupt)) return;

    // 3. Call dedicated Cloud Malayalam TTS server proxy cleanly (Azure / Google / Gnani) if configured
    if (voiceMode !== 'humanOnly' && cloudState.serverReachable && isCloudProviderConfigured()) {
      fetchCloudTtsAudio(charId, text).then((url) => {
        if (!voiceEnabled) return;
        if (url) playAudioUrl(url, interrupt);
        else speakBrowserOrKombuFallback(charId, text, interrupt);
      });
      return;
    }

    speakBrowserOrKombuFallback(charId, text, interrupt);
  }

  function prefetchVoiceLines(items = []) {
    if (!cloudState.serverReachable || !isCloudProviderConfigured()) return;
    for (const item of items) {
      if (item?.text && !hasVoiceClip(item.text)) {
        fetchCloudTtsAudio(item.charId || 'announcer', item.text).catch(() => {});
      }
    }
  }

  function stopVoices() {
    if (activeClipAudio) {
      try {
        activeClipAudio.pause();
        activeClipAudio.currentTime = 0;
      } catch {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
  }

  function ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone(freqStart, freqEnd, duration, type = 'square', volume = 0.12, delay = 0) {
    if (!sfxEnabled) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  function noiseBurst(duration = 0.08, volume = 0.14, highpass = 400, delay = 0) {
    if (!sfxEnabled) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime + delay;
    const len = Math.floor(ac.sampleRate * duration);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = highpass;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    src.start(now);
  }

  function crowdRoar() {
    if (!sfxEnabled) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const dur = 0.55;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.sin((i / len) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950;
    filter.Q.value = 1.4;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    src.start(now);
  }

  function playChenda(type = 'valam', volume = 0.085) {
    if (!musicEnabled) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    if (type === 'edam') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.14);
      gain.gain.setValueAtTime(volume * 1.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    } else if (type === 'valam') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(175, now + 0.06);
      gain.gain.setValueAtTime(volume * 0.72, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(1520, now);
      osc.frequency.setValueAtTime(2180, now + 0.015);
      gain.gain.setValueAtTime(volume * 0.36, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    }
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  function playMusicNote(freq, dur = 0.14, vol = 0.04) {
    if (!musicEnabled) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1150;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  // Iconic "Maveli Naadu Vaanidum Kaalam" Onappattu folk motif + Shinkari Chenda Melam!
  const MELODY_HZ = [
    329.6, 392.0, 440.0, 440.0, 392.0, 329.6, 293.7, 329.6,
    392.0, 329.6, 293.7, 261.6, 293.7, 329.6, 261.6, 0,
  ];
  const BASS_HZ = [
    130.8, 0, 196.0, 130.8, 146.8, 0, 196.0, 146.8,
    130.8, 0, 164.8, 130.8, 196.0, 146.8, 130.8, 0,
  ];

  function startMusic(tempoMs = 175) {
    stopMusic();
    if (!musicEnabled) return;
    stepIndex = 0;
    musicInterval = setInterval(() => {
      if (!musicEnabled) return;
      const step = stepIndex % 16;
      if (step % 4 === 0) playChenda('edam', 0.08);
      if (step % 2 === 1 || step === 14 || step === 15) playChenda('valam', 0.055);
      if (step % 2 === 0) playChenda('ilathalam', 0.045);

      const mNote = MELODY_HZ[step];
      if (mNote > 0) playMusicNote(mNote, 0.16, 0.038);
      const bNote = BASS_HZ[step];
      if (bNote > 0) playMusicNote(bNote, 0.16, 0.042);

      stepIndex += 1;
    }, tempoMs);
  }

  function stopMusic() {
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
  }

  function handleEngineEvents(events = []) {
    for (const ev of events) {
      switch (ev.type) {
        case 'swing':
          noiseBurst(ev.heavy ? 0.09 : 0.05, 0.08, ev.heavy ? 500 : 900);
          break;
        case 'hitLight':
          tone(210, 75, 0.07, 'square', 0.12);
          noiseBurst(0.06, 0.14, 700);
          break;
        case 'hitHeavy':
          tone(165, 45, 0.14, 'sawtooth', 0.17);
          noiseBurst(0.11, 0.18, 450);
          break;
        case 'block':
          tone(820, 420, 0.06, 'triangle', 0.1);
          break;
        case 'projectile':
          tone(380, 760, 0.12, 'square', 0.1);
          break;
        case 'special':
          tone(260, 880, 0.18, 'sawtooth', 0.13);
          if (ev.charId === 'kuttan') {
            tone(580, 560, 0.07, 'square', 0.11, 0.02);
            tone(740, 720, 0.09, 'square', 0.11, 0.11);
          }
          break;
        case 'superEntry':
          if (ev.charId === 'maveli') {
            tone(85, 290, 0.45, 'sawtooth', 0.14);
            tone(440, 660, 0.25, 'triangle', 0.1, 0.2);
          } else if (ev.charId === 'george') {
            tone(290, 285, 0.14, 'sawtooth', 0.12);
            tone(360, 355, 0.14, 'sawtooth', 0.11, 0.16);
            tone(920, 1480, 0.1, 'triangle', 0.1, 0.34);
          } else if (ev.charId === 'unniyarcha') {
            tone(640, 1520, 0.18, 'sine', 0.1);
            noiseBurst(0.14, 0.1, 1800, 0.05);
          } else if (ev.charId === 'theyyam') {
            noiseBurst(0.32, 0.14, 380);
            tone(130, 520, 0.3, 'sawtooth', 0.11);
          } else {
            tone(540, 540, 0.08, 'square', 0.12);
            tone(680, 680, 0.12, 'square', 0.12, 0.1);
          }
          break;
        case 'superActivate':
          tone(220, 880, 0.28, 'sawtooth', 0.16);
          tone(440, 1100, 0.25, 'square', 0.12, 0.08);
          break;
        case 'powerupSpawn':
          tone(660, 880, 0.09, 'triangle', 0.07);
          break;
        case 'powerupPickup':
          tone(523, 659, 0.08, 'square', 0.1, 0);
          tone(659, 784, 0.08, 'square', 0.1, 0.07);
          tone(784, 1046, 0.14, 'square', 0.11, 0.14);
          break;
        case 'roundStart':
          tone(392, 392, 0.1, 'square', 0.1, 0);
          tone(523, 523, 0.12, 'square', 0.1, 0.12);
          break;
        case 'fightStart':
          tone(523, 784, 0.2, 'sawtooth', 0.14);
          break;
        case 'ko':
          tone(220, 45, 0.45, 'sawtooth', 0.2);
          noiseBurst(0.35, 0.2, 350);
          crowdRoar();
          break;
        case 'voiceLine':
          speakLine(ev.charId, ev.text, ev.priority === 'high');
          break;
        case 'audienceCheer':
          crowdRoar();
          speakLine('audience', ev.text, false);
          break;
        case 'matchOver':
          tone(523, 523, 0.12, 'square', 0.11, 0);
          tone(659, 659, 0.12, 'square', 0.11, 0.12);
          tone(784, 784, 0.12, 'square', 0.11, 0.24);
          tone(1046, 1046, 0.32, 'square', 0.13, 0.36);
          crowdRoar();
          break;
        default:
          break;
      }
    }
  }

  return {
    unlock: ensureContext,
    startMusic,
    stopMusic() {
      stopMusic();
      stopVoices();
    },
    speakLine,
    hasNativeMalayalamVoice,
    initCloudTts,
    prefetchVoiceLines,
    isCloudProviderConfigured,
    getCloudState: () => ({ ...cloudState, providers: cloudState.providers }),
    setCloudProvider(provider) {
      cloudState.provider = provider;
    },
    setCloudVoice(voiceId) {
      cloudState.voiceId = voiceId || 'auto';
    },
    setCloudGender(gender) {
      cloudState.gender = gender || 'auto';
    },
    registerVoiceClip,
    unregisterVoiceClip,
    hasVoiceClip,
    getCustomClipCount: () => customClips.size,
    setVoiceMode(mode) {
      voiceMode = mode;
    },
    getVoiceMode: () => voiceMode,
    handleEngineEvents,
    playUiClick() {
      tone(540, 760, 0.05, 'square', 0.08);
    },
    playSelect() {
      tone(440, 880, 0.09, 'square', 0.1);
    },
    setMusicEnabled(val) {
      musicEnabled = val;
      if (!val) stopMusic();
    },
    setSfxEnabled(val) {
      sfxEnabled = val;
    },
    setVoiceEnabled(val) {
      voiceEnabled = val;
      if (!val) stopVoices();
    },
    isMusicEnabled: () => musicEnabled,
    isSfxEnabled: () => sfxEnabled,
    isVoiceEnabled: () => voiceEnabled,
  };
}
