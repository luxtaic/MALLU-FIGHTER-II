/**
 * Batch Malayalam TTS Generator & Cache Builder.
 * Pre-generates and caches natural ml-IN audio files for every fighter, snack,
 * and crowd cheer into `assets/voices/cache/` + `assets/voices/manifest.json`.
 *
 * Usage:
 *   node scripts/generate_malayalam_voices.mjs [--provider azure|google|gnani] [--voice ...] [--dry-run]
 */

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, POWERUP_TYPES } from '../src/characters.js';
import { loadEnvFiles } from '../tts/cache.js';
import { createMalayalamTtsService } from '../tts/service.js';
import { formatSpeechPayload } from '../tts/ssml.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnvFiles([path.join(os.homedir(), '.env'), path.join(ROOT_DIR, '.env')]);

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i];
    if (cur === '--dry-run') args.dryRun = true;
    else if (cur === '--provider' && argv[i + 1]) args.provider = argv[++i];
    else if (cur === '--voice' && argv[i + 1]) args.voiceId = argv[++i];
    else if (cur === '--gender' && argv[i + 1]) args.gender = argv[++i];
  }
  return args;
}

function collectDialogueTasks() {
  const seen = new Map();
  const add = (charId, text) => {
    if (!text || seen.has(text)) return;
    seen.set(text, { charId, text });
  };

  for (const ch of CHARACTERS) {
    add(ch.id, ch.superEntry.shout);
    for (const mv of Object.values(ch.moves)) {
      if (mv.shout) add(ch.id, mv.shout);
    }
    for (const list of Object.values(ch.dialogues)) {
      for (const line of list) add(ch.id, line);
    }
  }
  for (const pu of POWERUP_TYPES) {
    for (const line of pu.dialogues) add('announcer', line);
  }
  for (const line of [
    'CROWD: Poli machane! Kettuvallam kulungunnundu!',
    'BOAT UNCLE: Thorthu veeshi adi polikku!',
    'CROWD: Adi sake! Alappuzha super match!',
    'TOURIST: Oh my God, classic Mallu punch!',
    'CHAYAKKARAN: Adichu thakarkku, chaya free!',
    'AUTO STAND: Meter ittittilla, full power adi!',
    'CROWD: Pazhampori pole hot adi mwone!',
    'FORT KOCHI: Cheena vala vare kulungi!',
    'POORAM CROWD: Chenda melam kettu — ADICHU POLIKKU!',
    'CHENDA TEAM: Thakida thakida — MASS COMBO!',
    'CROWD: Elephants vare cheer cheyyunnu!',
    'POORAM: Thrissur Pooram pole fire adi!',
  ]) {
    add('audience', line);
  }
  return [...seen.values()];
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const service = createMalayalamTtsService({
    cacheDir: path.join(ROOT_DIR, 'assets', 'voices', 'cache'),
    manifestPath: path.join(ROOT_DIR, 'assets', 'voices', 'manifest.json'),
  });
  const config = service.getPublicConfig();
  const provider = opts.provider || config.activeProvider;
  const tasks = collectDialogueTasks();

  console.log(`Provider: ${provider} | Total game lines: ${tasks.length} | Dry run: ${opts.dryRun}`);

  if (opts.dryRun) {
    for (const sample of tasks.slice(0, 6)) {
      const formatted = formatSpeechPayload({
        text: sample.text,
        charId: sample.charId,
        provider,
        voiceId: opts.voiceId,
        gender: opts.gender,
      });
      console.log(`- [${sample.charId} -> ${formatted.voiceId} (${formatted.gender})]`);
      console.log(`  Malayalam: ${formatted.text}`);
      if (formatted.ssml) console.log(`  SSML: ${formatted.ssml}`);
    }
    return;
  }

  let hits = 0;
  let misses = 0;
  for (const item of tasks) {
    const result = await service.synthesizeSpeech({
      text: item.text,
      charId: item.charId,
      provider,
      voiceId: opts.voiceId,
      gender: opts.gender,
    });
    service.writeManifestEntry(item.text, result.file);
    if (result.cacheHit) hits += 1;
    else misses += 1;
  }

  console.log(`Done! Cache hits: ${hits}, API synthesized: ${misses}`);
  console.log('Manifest written to assets/voices/manifest.json');
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
