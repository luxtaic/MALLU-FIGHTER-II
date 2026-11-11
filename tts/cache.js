/**
 * Safe environment variable loader (.env) and deterministic SHA-256 disk audio cache.
 * Never logs or exposes API key values to client bundles.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function parseDotEnv(content) {
  const out = {};
  for (const rawLine of String(content || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      out[key] = val;
    }
  }
  return out;
}

export function loadEnvFiles(paths, targetEnv = process.env) {
  for (const filePath of paths) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    const parsed = parseDotEnv(fs.readFileSync(filePath, 'utf8'));
    for (const [k, v] of Object.entries(parsed)) {
      if (!targetEnv[k]) targetEnv[k] = v;
    }
  }
  return targetEnv;
}

export function buildCacheKey({ provider, voiceId, languageCode = 'ml-IN', text, ssml, rate, pitchPct }) {
  const canonical = JSON.stringify({
    provider,
    voiceId,
    languageCode,
    text,
    ssml: ssml || '',
    rate,
    pitchPct,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24);
}

export class AudioDiskCache {
  constructor(cacheDir) {
    this.cacheDir = path.resolve(cacheDir);
    this.indexPath = path.join(this.cacheDir, 'cache-index.json');
    this.index = this._readIndex();
  }

  _readIndex() {
    try {
      if (fs.existsSync(this.indexPath)) {
        return JSON.parse(fs.readFileSync(this.indexPath, 'utf8')) || {};
      }
    } catch {
      // Ignore corrupt index and recover dynamically
    }
    return {};
  }

  _writeIndex() {
    fs.mkdirSync(this.cacheDir, { recursive: true });
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf8');
  }

  get(key) {
    const entry = this.index[key];
    if (!entry) return null;
    const filePath = path.join(this.cacheDir, entry.file);
    if (!fs.existsSync(filePath)) return null;
    return {
      key,
      file: entry.file,
      filePath,
      mimeType: entry.mimeType || 'audio/mpeg',
      buffer: fs.readFileSync(filePath),
      meta: entry,
    };
  }

  set(key, buffer, { mimeType = 'audio/mpeg', ext = 'mp3', meta = {} } = {}) {
    fs.mkdirSync(this.cacheDir, { recursive: true });
    const file = `${key}.${ext}`;
    const filePath = path.join(this.cacheDir, file);
    fs.writeFileSync(filePath, buffer);
    this.index[key] = {
      file,
      mimeType,
      bytes: buffer.length,
      createdAt: new Date().toISOString(),
      ...meta,
    };
    this._writeIndex();
    return { key, file, filePath, mimeType, buffer };
  }

  stats() {
    const keys = Object.keys(this.index);
    const totalBytes = keys.reduce((sum, k) => sum + (this.index[k]?.bytes || 0), 0);
    return { entries: keys.length, totalBytes, cacheDir: this.cacheDir };
  }
}
