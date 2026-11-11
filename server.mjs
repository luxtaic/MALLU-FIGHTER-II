/**
 * Local Game Server & Secure Malayalam Cloud TTS Proxy (`http://127.0.0.1:8765`).
 * Keeps all API keys inside `.env` / environment variables on the server side only.
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFiles } from './tts/cache.js';
import { createMalayalamTtsService } from './tts/service.js';
import { createRoomManager } from './net/rooms.mjs';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
loadEnvFiles([path.join(os.homedir(), '.env'), path.join(ROOT_DIR, '.env')]);

const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || '0.0.0.0';

function getLanUrls(port = PORT) {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    const isVirtual = /vEthernet|WSL|Loopback|VirtualBox|VMware|Hyper-V|Docker/i.test(name);
    for (const info of addrs) {
      if (info.family === 'IPv4' && !info.internal) {
        candidates.push({
          name,
          address: info.address,
          url: `http://${info.address}:${port}/index.html`,
          priority: isVirtual ? 2 : /^192\.168\.|^10\./.test(info.address) ? 0 : 1,
        });
      }
    }
  }
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

const ttsService = createMalayalamTtsService({
  cacheDir: path.join(ROOT_DIR, 'assets', 'voices', 'cache'),
  manifestPath: path.join(ROOT_DIR, 'assets', 'voices', 'manifest.json'),
});

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 65536) reject(new Error('Request payload too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const PUBLIC_STATIC_ALLOWLIST = /^(index\.html|styles\.css|src\/.+|dist\/.+|assets\/.+)$/;

function serveStaticFile(reqPath, res, headOnly = false) {
  let cleanRel = '';
  try {
    cleanRel = decodeURIComponent(reqPath.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  const normalizedRel = path.posix.normalize(cleanRel.replace(/\\/g, '/'));
  if (!PUBLIC_STATIC_ALLOWLIST.test(normalizedRel)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const resolved = path.resolve(ROOT_DIR, normalizedRel);
  if (!resolved.startsWith(ROOT_DIR + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(resolved).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  if (headOnly) {
    res.end();
    return;
  }
  fs.createReadStream(resolved).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && urlPath === '/health') {
    sendJson(res, 200, { ok: true, rooms: roomManager.getRoomCount() });
    return;
  }

  if (req.method === 'GET' && urlPath === '/api/network-info') {
    sendJson(res, 200, {
      ok: true,
      port: PORT,
      localUrl: `http://127.0.0.1:${PORT}/index.html`,
      lanUrls: getLanUrls(PORT),
    });
    return;
  }

  if (req.method === 'GET' && urlPath === '/api/tts/config') {
    sendJson(res, 200, { ok: true, ...ttsService.getPublicConfig() });
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/tts/speak') {
    try {
      const body = await readJsonBody(req);
      const result = await ttsService.synthesizeSpeech({
        text: body.text || '',
        charId: body.charId || 'announcer',
        provider: body.provider,
        voiceId: body.voiceId,
        gender: body.gender,
      });
      res.writeHead(200, {
        'Content-Type': result.mimeType,
        'Content-Length': String(result.buffer.length),
        'X-TTS-Cache': result.cacheHit ? 'HIT' : 'MISS',
        'X-TTS-Provider': result.payload.provider,
        'X-TTS-Voice': result.payload.voiceId,
        'Cache-Control': 'public, max-age=31536000',
      });
      res.end(result.buffer);
    } catch (err) {
      const status = /Missing .* environment/i.test(err.message) ? 503 : 400;
      sendJson(res, status, { ok: false, error: err.message });
    }
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStaticFile(urlPath, res, req.method === 'HEAD');
    return;
  }

  res.writeHead(405);
  res.end('Method Not Allowed');
});

const roomManager = createRoomManager();

server.on('upgrade', (req, socket) => {
  const urlPath = (req.url || '/').split('?')[0];
  if (urlPath === '/ws') {
    roomManager.handleUpgrade(req, socket);
    return;
  }
  socket.destroy();
});

server.listen(PORT, HOST, () => {
  const cfg = ttsService.getPublicConfig();
  const configuredList = cfg.providers.filter((p) => p.configured).map((p) => p.id);
  const lans = getLanUrls(PORT);
  console.log(`MALLU FIGHTER II local URL: http://127.0.0.1:${PORT}/index.html`);
  if (lans.length > 0) {
    console.log('Play on Mobile / Other PC (Same Wi-Fi):');
    for (const item of lans) {
      console.log(`  -> ${item.url} (${item.name})`);
    }
  }
  console.log(
    `Malayalam TTS active provider: ${cfg.activeProvider} | configured keys: ${
      configuredList.length > 0 ? configuredList.join(', ') : 'none yet (configure .env for live synthesis)'
    }`
  );
  console.log(`Cached voice files on disk: ${cfg.cache.entries}`);
});
