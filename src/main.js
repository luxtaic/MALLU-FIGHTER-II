/**
 * Main UI controller, input manager, canvas loop, and arcade flow.
 */

import { CHARACTERS, POWERUP_TYPES, STAGES, getCharacterById, getStageById, getMalayalamLine } from './characters.js';
import { ARENA, createMatchState, stepMatch, setSpeech, spawnParticles } from './engine.js';
import { createAiController } from './ai.js';
import { createAudioEngine } from './audio.js';
import { drawStageBackground } from './stages.js';
import { drawFighter, drawProjectile, drawPowerup } from './sprites.js';
import { drawHud } from './hud.js';
import { drawImpactStarburst } from './pixel.js';
import { ASSETS_DATA } from './assets_data.js';
import {
  getPortraitDataUrl,
  getStageImage,
  getCrowdStripImage,
  getSpritePose,
  getPortraitImage,
} from './assets.js';

const audio = createAudioEngine();

const appState = {
  screen: 'select', // 'select' | 'fight'
  mode: 'arcade', // 'arcade' | 'vs-cpu' | 'vs-p2' | 'online' | 'training'
  p1CharId: 'maveli',
  p2CharId: 'george',
  stageId: 'alappuzha',
  difficulty: 'chettan',
  powerupsEnabled: true,
  crtEnabled: false,
  hiScore: 18500,
  arcadeIndex: 0,
  arcadeLadder: [],
  match: null,
  ai: null,
  tick: 0,
  paused: false,
  rafId: null,
  lastTime: 0,
  accumulator: 0,
};

const onlineState = {
  ws: null,
  connected: false,
  role: null, // 'host' | 'guest' | null
  roomCode: '',
  hasGuest: false,
  guestReady: false,
  lanOrigin: '',
  statusMessage: '',
  remoteInput: {},
  lastSentInputJson: '',
  pendingEvents: [],
  inputSeq: 0,
};

const pressedKeys = new Set();

// Key mappings for 1P (WASD + JILK + Space Block, MK-style) and 2P (Arrows + Numpad / , . / ' ;)
const P1_KEYS = {
  left: ['KeyA'],
  right: ['KeyD'],
  up: ['KeyW'],
  down: ['KeyS'],
  light: ['KeyJ'],
  heavy: ['KeyK'],
  special: ['KeyL'],
  super: ['KeyI'],
  block: ['Space', 'KeyU'],
};

const P2_KEYS = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  light: ['Numpad1', 'Comma'],
  heavy: ['Numpad2', 'Period'],
  special: ['Numpad3', 'Slash'],
  super: ['Numpad5', 'Quote'],
  block: ['Numpad0', 'Semicolon'],
};

function readKeyboardInput(map, allowArrowsFallback = false) {
  const out = {};
  for (const [action, codes] of Object.entries(map)) {
    out[action] = codes.some((c) => pressedKeys.has(c));
  }
  if (allowArrowsFallback) {
    out.left = out.left || pressedKeys.has('ArrowLeft');
    out.right = out.right || pressedKeys.has('ArrowRight');
    out.up = out.up || pressedKeys.has('ArrowUp');
    out.down = out.down || pressedKeys.has('ArrowDown');
  }
  return out;
}

const touchState = {
  dpadPointers: new Map(), // pointerId -> { left, right, up, down }
  actionPointers: new Map(), // pointerId -> { action, btn }
};

function clearTouchInputs() {
  touchState.dpadPointers.clear();
  for (const { btn } of touchState.actionPointers.values()) {
    btn?.classList?.remove('active');
  }
  touchState.actionPointers.clear();
  document.querySelectorAll('#touchDpad .dpad-dir').forEach((el) => el.classList.remove('active'));
}

function readTouchInput() {
  const out = { left: false, right: false, up: false, down: false, light: false, heavy: false, special: false, super: false, block: false };
  for (const dir of touchState.dpadPointers.values()) {
    out.left = out.left || dir.left;
    out.right = out.right || dir.right;
    out.up = out.up || dir.up;
    out.down = out.down || dir.down;
  }
  for (const { action } of touchState.actionPointers.values()) {
    if (action === 'upSpecial') {
      out.up = true;
      out.special = true;
    } else if (action in out) {
      out[action] = true;
    }
  }
  return out;
}

function buildArcadeLadder(p1Id) {
  const others = CHARACTERS.filter((c) => c.id !== p1Id).map((c) => c.id);
  const boss = p1Id === 'digambaran' ? 'theyyam' : p1Id === 'theyyam' ? 'digambaran' : 'digambaran';
  const subBoss = p1Id === 'theyyam' ? 'maveli' : 'theyyam';
  const mid = others.filter((id) => id !== boss && id !== subBoss);
  return [...mid.slice(0, 2), subBoss, boss];
}

function preloadAllGraphics() {
  for (const st of STAGES) getStageImage(st.id);
  for (const stripId of [
    'alappuzha_crowd',
    'fortkochi_crowd_l',
    'fortkochi_crowd_r',
    'thrissur_crowd_l',
    'thrissur_crowd_r',
  ]) {
    getCrowdStripImage(stripId);
  }
  for (const ch of CHARACTERS) {
    getPortraitImage(ch.id);
    for (let i = 0; i < 4; i++) getSpritePose(ch.id, i);
  }
}

function statPips(val) {
  return `<span class="stat-pips">${'■'.repeat(val)}${'□'.repeat(5 - val)}</span>`;
}

let selectingTarget = 'p1';
const rosterCardMap = new Map();
const rosterDotMap = new Map();

function selectFighterForSlot(slot, charId, speak = true) {
  let effectiveSlot = slot;
  if (appState.mode === 'online' && onlineState.role === 'host') {
    if (onlineState.hasGuest && effectiveSlot === 'p2') return;
    effectiveSlot = onlineState.hasGuest ? 'p1' : slot;
  } else if (appState.mode === 'online' && onlineState.role === 'guest') {
    effectiveSlot = 'p2';
  }

  if (effectiveSlot === 'p2') {
    appState.p2CharId = charId;
  } else {
    appState.p1CharId = charId;
    if (appState.p2CharId === charId && !(appState.mode === 'online' && onlineState.hasGuest)) {
      const next = CHARACTERS.find((o) => o.id !== charId);
      if (next) appState.p2CharId = next.id;
    }
  }
  if (speak) {
    const ch = getCharacterById(charId);
    audio.speakLine(ch.id, ch.dialogues.intro[0], true);
  }
  syncOnlineLobbyFromLocal();
  updateSelectDetails();
  renderRosterCards();
}

function rotateSelectionWheel(delta) {
  const slotIdx = selectingTarget === 'p2' ? 1 : 0;
  cycleCharacter(slotIdx, delta);
}

function ensureRosterWheelBuilt() {
  const grid = document.getElementById('rosterGrid');
  const dotsHost = document.getElementById('rosterDots');
  if (!grid || rosterCardMap.size === CHARACTERS.length) return;

  grid.innerHTML = '';
  if (dotsHost) dotsHost.innerHTML = '';
  rosterCardMap.clear();
  rosterDotMap.clear();

  for (const ch of CHARACTERS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'char-card';
    card.dataset.charId = ch.id;

    const portraitImg = document.createElement('img');
    portraitImg.src = getPortraitDataUrl(ch.id);
    portraitImg.alt = ch.fullName;
    portraitImg.width = 128;
    portraitImg.height = 128;
    portraitImg.className = 'char-portrait';

    const badges = document.createElement('div');
    badges.className = 'card-badges';

    const meta = document.createElement('div');
    meta.className = 'char-meta';
    meta.innerHTML = `
      <span class="char-ml">${ch.mlName || ''}</span>
      <strong>${ch.name}</strong>
      <span class="char-title">${ch.mlTitle ? `${ch.mlTitle} · ` : ''}${ch.title}</span>
      <span class="char-entry">${ch.superEntry.title}</span>
    `;

    card.appendChild(badges);
    card.appendChild(portraitImg);
    card.appendChild(meta);

    card.addEventListener('click', (e) => {
      audio.unlock();
      audio.playUiClick();
      const targetSlot = e.shiftKey || e.altKey || selectingTarget === 'p2' ? 'p2' : 'p1';
      selectFighterForSlot(targetSlot, ch.id, true);
    });

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      audio.unlock();
      audio.playUiClick();
      selectingTarget = 'p2';
      selectFighterForSlot('p2', ch.id, true);
    });

    grid.appendChild(card);
    rosterCardMap.set(ch.id, { card, badges });

    if (dotsHost) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'dial-dot';
      dot.innerHTML = `<img src="${getPortraitDataUrl(ch.id)}" alt="" width="20" height="20" class="dial-dot-thumb"><span>${ch.name}</span>`;
      dot.addEventListener('click', () => {
        audio.unlock();
        audio.playUiClick();
        selectFighterForSlot(selectingTarget, ch.id, true);
      });
      dotsHost.appendChild(dot);
      rosterDotMap.set(ch.id, dot);
    }
  }
}

function renderRosterCards() {
  ensureRosterWheelBuilt();
  const N = CHARACTERS.length;
  const focusCharId = selectingTarget === 'p2' ? appState.p2CharId : appState.p1CharId;
  const focusIdx = Math.max(0, CHARACTERS.findIndex((c) => c.id === focusCharId));

  CHARACTERS.forEach((ch, idx) => {
    const entry = rosterCardMap.get(ch.id);
    if (!entry) return;
    const { card, badges } = entry;
    const isP1 = appState.p1CharId === ch.id;
    const isP2 = appState.p2CharId === ch.id;
    const isFocused = idx === focusIdx;

    card.classList.toggle('p1-selected', isP1);
    card.classList.toggle('p2-selected', isP2);
    card.classList.toggle('wheel-focused', isFocused);

    badges.innerHTML = '';
    if (isP1) {
      const b1 = document.createElement('span');
      b1.className = 'badge badge-p1';
      b1.textContent = '1P';
      badges.appendChild(b1);
    }
    if (isP2) {
      const b2 = document.createElement('span');
      b2.className = 'badge badge-p2';
      b2.textContent = appState.mode === 'vs-p2' ? '2P' : 'CPU';
      badges.appendChild(b2);
    }

    // Shortest signed orbital ring offset around active slot (-N/2 .. +N/2)
    let delta = idx - focusIdx;
    if (delta > N / 2) delta -= N;
    if (delta < -N / 2) delta += N;

    const angleRad = delta * ((Math.PI * 2) / N);
    const sx = Math.sin(angleRad);
    const cz = Math.cos(angleRad);
    const scale = 0.56 + 0.50 * ((cz + 1) / 2);
    const arcY = 1 - Math.max(0, cz);
    const rotY = Math.max(-68, Math.min(68, -delta * 24));
    const zIndex = Math.round((cz + 1) * 50) + (isFocused ? 15 : 0);
    const opacity = Math.abs(delta) > 3.2 ? 0.14 : Math.max(0.28, 0.35 + 0.65 * Math.max(0, (cz + 0.35) / 1.35));

    card.style?.setProperty?.('--wheel-sx', sx.toFixed(4));
    card.style?.setProperty?.('--wheel-scale', scale.toFixed(3));
    card.style?.setProperty?.('--wheel-arc-y', arcY.toFixed(3));
    card.style?.setProperty?.('--wheel-roty', `${rotY.toFixed(1)}deg`);
    if (card.style) {
      card.style.zIndex = String(zIndex);
      card.style.opacity = opacity.toFixed(2);
    }

    const dot = rosterDotMap.get(ch.id);
    if (dot) {
      dot.classList.toggle('p1-selected', isP1);
      dot.classList.toggle('p2-selected', isP2);
      dot.classList.toggle('wheel-focused', isFocused);
    }
  });
}

function buildPreviewHtml(tagClass, tagLabel, ch) {
  const mlIntro = getMalayalamLine(ch.dialogues.intro[0]);
  return `
    <div class="preview-layout">
      <img src="${getPortraitDataUrl(ch.id)}" alt="${ch.fullName}" width="104" height="104" class="preview-portrait">
      <div class="preview-body">
        <div class="preview-header">
          <span class="${tagClass}">${tagLabel}</span>
          <h3>${ch.mlName ? `${ch.mlName} · ` : ''}${ch.fullName}</h3>
        </div>
        <p class="preview-ml-title">${ch.mlTitle || ch.title}</p>
        <p class="preview-quote">
          ${mlIntro ? `<span class="ml-quote">"${mlIntro}"</span><br>` : ''}
          <span>"${ch.dialogues.intro[0]}"</span>
        </p>
        <div class="stat-row">
          <span>PWR ${statPips(ch.stats.power)}</span>
          <span>SPD ${statPips(ch.stats.speed)}</span>
          <span>RNG ${statPips(ch.stats.range)}</span>
        </div>
        <ul class="move-summary">
          <li><strong>Entry:</strong> ${ch.superEntry.title}</li>
          <li><strong>Moves:</strong> ${ch.moves.projectile.name} · ${ch.moves.special.name}</li>
          <li><strong>Mass Super:</strong> ${ch.moves.superMove.name}</li>
        </ul>
      </div>
    </div>
  `;
}

const MODE_LABELS = {
  arcade: '🏆 Arcade Ladder',
  'vs-cpu': '🤖 1P vs CPU',
  'vs-p2': '👥 2P Local VS',
  online: '🌐 Online Room',
  training: '🥋 Training',
};

function getInviteUrlForCode(code) {
  if (!code || typeof window === 'undefined') return '';
  const isLocalHost = /^(127\.0\.0\.1|localhost)$/i.test(window.location?.hostname || '');
  const base = isLocalHost && onlineState.lanOrigin ? onlineState.lanOrigin : window.location.origin;
  if (!base || base === 'null') return '';
  return `${base}/index.html?join=${encodeURIComponent(code)}`;
}

async function refreshLanOrigin() {
  if (typeof fetch !== 'function' || typeof window === 'undefined' || window.location?.protocol === 'file:') return;
  try {
    const res = await fetch('/api/network-info');
    if (!res.ok) return;
    const data = await res.json();
    const firstLan = data.lanUrls?.[0]?.url;
    if (firstLan) {
      onlineState.lanOrigin = new URL(firstLan).origin;
      updateOnlineLobbyUi();
    }
  } catch {}
}

function sendWs(obj) {
  if (!onlineState.ws || onlineState.ws.readyState !== 1) return false;
  try {
    onlineState.ws.send(JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}

function syncOnlineLobbyFromLocal() {
  if (appState.mode !== 'online' || !onlineState.roomCode) return;
  if (onlineState.role === 'host') {
    sendWs({
      t: 'lobbyUpdate',
      p1CharId: appState.p1CharId,
      p2CharId: appState.p2CharId,
      stageId: appState.stageId,
      powerupsEnabled: appState.powerupsEnabled,
    });
  } else if (onlineState.role === 'guest') {
    sendWs({
      t: 'lobbyUpdate',
      p2CharId: appState.p2CharId,
      guestReady: true,
    });
  }
}

function applyLobbyState(lobby) {
  if (!lobby) return;
  onlineState.roomCode = lobby.code || '';
  onlineState.hasGuest = Boolean(lobby.hasGuest);
  onlineState.guestReady = Boolean(lobby.guestReady);
  if (lobby.p1CharId) appState.p1CharId = lobby.p1CharId;
  if (lobby.p2CharId) appState.p2CharId = lobby.p2CharId;
  if (lobby.stageId) appState.stageId = lobby.stageId;
  if (typeof lobby.powerupsEnabled === 'boolean') {
    appState.powerupsEnabled = lobby.powerupsEnabled;
    const pu = document.getElementById('powerupsToggle');
    if (pu) pu.checked = appState.powerupsEnabled;
  }
  if (onlineState.role === 'guest') selectingTarget = 'p2';
  else if (onlineState.role === 'host' && onlineState.hasGuest) selectingTarget = 'p1';

  renderStages();
  renderArenaPlaceBar();
  renderRosterCards();
  updateSelectDetails();
  updateOnlineLobbyUi();
}

function resetOnlineRoomState(message = '') {
  onlineState.role = null;
  onlineState.roomCode = '';
  onlineState.hasGuest = false;
  onlineState.guestReady = false;
  onlineState.remoteInput = {};
  onlineState.lastSentInputJson = '';
  onlineState.pendingEvents = [];
  if (message) onlineState.statusMessage = message;
  updateOnlineLobbyUi();
  updateSelectDetails();
}

function connectOnlineSocket() {
  if (onlineState.ws && (onlineState.ws.readyState === 0 || onlineState.ws.readyState === 1)) {
    return Promise.resolve(onlineState.ws);
  }
  if (typeof window === 'undefined' || window.location?.protocol === 'file:' || typeof WebSocket === 'undefined') {
    onlineState.statusMessage = 'Run play.bat / npm start and open http://... to play Online / Wi-Fi Multiplayer!';
    updateOnlineLobbyUi();
    return Promise.reject(new Error('WebSocket unavailable on file://'));
  }

  return new Promise((resolve, reject) => {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    onlineState.ws = ws;

    ws.addEventListener('open', () => {
      onlineState.connected = true;
      resolve(ws);
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (msg.t === 'roomCreated') {
        onlineState.role = 'host';
        onlineState.statusMessage = `Room #${msg.lobby.code} created! Share code or link with Player 2.`;
        applyLobbyState(msg.lobby);
        refreshLanOrigin();
      } else if (msg.t === 'roomJoined') {
        onlineState.role = 'guest';
        appState.mode = 'online';
        document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === 'online'));
        onlineState.statusMessage = `Joined Room #${msg.lobby.code} as 2P! Spin wheel to pick your fighter.`;
        applyLobbyState(msg.lobby);
      } else if (msg.t === 'peerJoined') {
        onlineState.statusMessage = `Player 2 connected to Room #${msg.lobby.code}! Ready to fight!`;
        applyLobbyState(msg.lobby);
      } else if (msg.t === 'peerLeft') {
        onlineState.statusMessage = 'Player 2 disconnected. Waiting for new challenger...';
        applyLobbyState(msg.lobby);
        if (appState.screen === 'fight') returnToSelect(false);
      } else if (msg.t === 'roomClosed') {
        resetOnlineRoomState(msg.reason || 'Host closed the room.');
        if (appState.screen === 'fight') returnToSelect(false);
      } else if (msg.t === 'leftRoom') {
        resetOnlineRoomState('Left room.');
      } else if (msg.t === 'lobbySync') {
        applyLobbyState(msg.lobby);
      } else if (msg.t === 'matchStart') {
        appState.mode = 'online';
        applyLobbyState(msg.lobby);
        startMatch(msg.lobby.p1CharId, msg.lobby.p2CharId, msg.lobby.stageId);
      } else if (msg.t === 'returnLobby') {
        if (appState.screen === 'fight') returnToSelect(false);
        applyLobbyState(msg.lobby);
      } else if (msg.t === 'remoteInput') {
        onlineState.remoteInput = msg.inp || {};
      } else if (msg.t === 'stateSync') {
        if (appState.screen === 'fight' && appState.match && onlineState.role === 'guest') {
          applyMatchSnapshot(appState.match, msg.snap);
          if (Array.isArray(msg.events) && msg.events.length > 0) {
            audio.handleEngineEvents(msg.events);
          }
        }
      } else if (msg.t === 'error') {
        onlineState.statusMessage = msg.error || 'Connection error.';
        updateOnlineLobbyUi();
      }
    });

    ws.addEventListener('close', () => {
      onlineState.connected = false;
      onlineState.ws = null;
      if (onlineState.roomCode) {
        resetOnlineRoomState('Disconnected from multiplayer server.');
        if (appState.screen === 'fight') returnToSelect(false);
      }
    });

    ws.addEventListener('error', () => {
      onlineState.statusMessage = 'Could not reach server. Start play.bat / npm start first.';
      updateOnlineLobbyUi();
      reject(new Error('WebSocket error'));
    });
  });
}

async function createOnlineRoom() {
  try {
    await connectOnlineSocket();
    sendWs({
      t: 'createRoom',
      p1CharId: appState.p1CharId,
      p2CharId: appState.p2CharId,
      stageId: appState.stageId,
      powerupsEnabled: appState.powerupsEnabled,
    });
  } catch {}
}

async function joinOnlineRoom(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) {
    onlineState.statusMessage = 'Enter the 4-digit Room Code first.';
    updateOnlineLobbyUi();
    return;
  }
  try {
    await connectOnlineSocket();
    sendWs({ t: 'joinRoom', code: clean });
  } catch {}
}

function leaveOnlineRoom() {
  sendWs({ t: 'leaveRoom' });
  resetOnlineRoomState('Left multiplayer room.');
}

function updateOnlineLobbyUi() {
  const codeBadge = document.getElementById('roomCodeBadge');
  const inviteRow = document.getElementById('roomInviteRow');
  const inviteLink = document.getElementById('roomInviteLink');
  const leaveBtn = document.getElementById('leaveRoomBtn');
  const createBtn = document.getElementById('createRoomBtn');
  const joinBtn = document.getElementById('joinRoomBtn');
  const joinInput = document.getElementById('joinCodeInput');
  const statusEl = document.getElementById('onlineStatusText');
  const p1Pill = document.getElementById('p1LobbyStatus');
  const p2Pill = document.getElementById('p2LobbyStatus');

  if (codeBadge) {
    codeBadge.hidden = !onlineState.roomCode;
    codeBadge.textContent = `CODE: ${onlineState.roomCode || '----'}`;
  }

  const invUrl = getInviteUrlForCode(onlineState.roomCode);
  if (inviteRow && inviteLink) {
    const showInv = Boolean(onlineState.role === 'host' && onlineState.roomCode && invUrl);
    inviteRow.hidden = !showInv;
    if (showInv) {
      inviteLink.href = invUrl;
      inviteLink.textContent = invUrl;
    }
  }

  if (leaveBtn) leaveBtn.hidden = !onlineState.roomCode;
  if (createBtn) createBtn.disabled = Boolean(onlineState.roomCode);
  if (joinBtn) joinBtn.disabled = Boolean(onlineState.roomCode);
  if (joinInput) joinInput.disabled = Boolean(onlineState.roomCode);

  if (statusEl) {
    statusEl.textContent =
      onlineState.statusMessage ||
      'Create a room or enter a 4-digit Room Code to fight across Mobile & PC!';
  }
  if (p1Pill) {
    const p1Name = getCharacterById(appState.p1CharId).name;
    p1Pill.textContent = onlineState.roomCode
      ? `1P: ${p1Name} (${onlineState.role === 'host' ? 'You' : 'Host'}) ✓`
      : '1P: Not in Room';
    p1Pill.className = onlineState.roomCode ? 'voice-pill ml-native' : 'voice-pill';
  }
  if (p2Pill) {
    const p2Name = getCharacterById(appState.p2CharId).name;
    p2Pill.textContent = !onlineState.roomCode
      ? '2P: Waiting'
      : onlineState.hasGuest
        ? `2P: ${p2Name} (${onlineState.role === 'guest' ? 'You' : 'Joined'}) ✓`
        : '2P: Waiting to Join...';
    p2Pill.className = onlineState.hasGuest ? 'voice-pill ml-native' : 'voice-pill ml-fallback';
  }
}

function serializeFighter(f) {
  return {
    charId: f.charId,
    x: f.x,
    y: f.y,
    vx: f.vx,
    vy: f.vy,
    facing: f.facing,
    hp: f.hp,
    trailHp: f.trailHp,
    maxHp: f.maxHp,
    meter: f.meter,
    roundsWon: f.roundsWon,
    score: f.score,
    state: f.state,
    stateTimer: f.stateTimer,
    animTick: f.animTick,
    moveKey: f.moveKey,
    buffs: f.buffs,
    speech: f.speech,
    lowHpWarned: f.lowHpWarned,
    munduFolded: f.munduFolded,
    trail: f.trail,
    prevInput: f.prevInput,
  };
}

function serializeMatchSnapshot(m) {
  return {
    stageId: m.stageId,
    round: m.round,
    timer: m.timer,
    phase: m.phase,
    phaseTimer: m.phaseTimer,
    superFreezeTimer: m.superFreezeTimer,
    superFreezeActor: m.superFreezeActor,
    roundWinnerSlot: m.roundWinnerSlot,
    matchWinnerSlot: m.matchWinnerSlot,
    shake: m.shake,
    crowdExcitement: m.crowdExcitement,
    audienceBubble: m.audienceBubble,
    banner: m.banner,
    powerupBanner: m.powerupBanner,
    fighters: m.fighters.map(serializeFighter),
    projectiles: m.projectiles,
    powerups: m.powerups.map((pu) => ({ id: pu.spec.id, x: pu.x, y: pu.y, bob: pu.bob })),
    particles: m.particles,
    hitSparks: m.hitSparks,
    popups: m.popups,
  };
}

function applyMatchSnapshot(m, snap) {
  if (!m || !snap) return;
  if (snap.stageId && snap.stageId !== m.stageId) {
    m.stageId = snap.stageId;
    m.stage = getStageById(snap.stageId);
  }
  m.round = snap.round;
  m.timer = snap.timer;
  m.phase = snap.phase;
  m.phaseTimer = snap.phaseTimer;
  m.superFreezeTimer = snap.superFreezeTimer;
  m.superFreezeActor = snap.superFreezeActor;
  m.roundWinnerSlot = snap.roundWinnerSlot;
  m.matchWinnerSlot = snap.matchWinnerSlot;
  m.shake = snap.shake;
  m.crowdExcitement = snap.crowdExcitement;
  m.audienceBubble = snap.audienceBubble;
  m.banner = snap.banner;
  m.powerupBanner = snap.powerupBanner;
  m.projectiles = snap.projectiles || [];
  m.powerups = (snap.powerups || []).map((pu) => ({
    spec: POWERUP_TYPES.find((s) => s.id === pu.id) || POWERUP_TYPES[0],
    x: pu.x,
    y: pu.y,
    bob: pu.bob,
  }));
  m.particles = snap.particles || [];
  m.hitSparks = snap.hitSparks || [];
  m.popups = snap.popups || [];
  if (Array.isArray(snap.fighters)) {
    snap.fighters.forEach((sf, i) => {
      const target = m.fighters[i];
      if (!target) return;
      Object.assign(target, sf);
      target.def = getCharacterById(sf.charId);
    });
  }
}

function updateSelectDetails() {
  const p1 = getCharacterById(appState.p1CharId);
  const p2 = getCharacterById(appState.p2CharId);
  const st = getStageById(appState.stageId);

  const p1Prev = document.getElementById('p1Preview');
  const p2Prev = document.getElementById('p2Preview');
  const p1Label = appState.mode === 'online' ? (onlineState.role === 'host' ? '1P (YOU · HOST)' : '1P HOST') : '1P FIGHTER';
  const p2Label =
    appState.mode === 'online'
      ? (onlineState.role === 'guest' ? '2P (YOU · GUEST)' : '2P REMOTE')
      : appState.mode === 'vs-p2'
        ? '2P RIVAL'
        : appState.mode === 'arcade'
          ? 'STAGE 1 RIVAL'
          : 'CPU RIVAL';

  if (p1Prev) p1Prev.innerHTML = buildPreviewHtml('tag-p1', p1Label, p1);
  if (p2Prev) p2Prev.innerHTML = buildPreviewHtml('tag-p2', p2Label, p2);

  const diffGroup = document.getElementById('cpuDiffGroup');
  if (diffGroup) diffGroup.hidden = !(appState.mode === 'arcade' || appState.mode === 'vs-cpu');

  const onlineLobby = document.getElementById('onlineLobbyPanel');
  if (onlineLobby) onlineLobby.hidden = appState.mode !== 'online';

  const pickBtn = document.getElementById('pickTargetBtn');
  if (pickBtn) {
    if (appState.mode === 'online' && onlineState.role === 'guest') {
      selectingTarget = 'p2';
      pickBtn.disabled = true;
      pickBtn.textContent = 'Online Slot: 2P (You)';
    } else if (appState.mode === 'online' && onlineState.role === 'host' && onlineState.hasGuest) {
      selectingTarget = 'p1';
      pickBtn.disabled = true;
      pickBtn.textContent = 'Online Slot: 1P (You)';
    } else {
      pickBtn.disabled = false;
      pickBtn.textContent =
        selectingTarget === 'p1' ? 'Picking: 1P (Switch to Rival)' : 'Picking: Rival (Switch to 1P)';
    }
  }

  const summary = document.getElementById('matchSummaryText');
  if (summary) {
    const modeName = MODE_LABELS[appState.mode] || appState.mode;
    const roomPart = appState.mode === 'online' && onlineState.roomCode ? ` #${onlineState.roomCode}` : '';
    summary.textContent = `${modeName}${roomPart} · ${p1.name} VS ${p2.name} · ${st.mlName || st.name}`;
  }

  const startBtn = document.getElementById('startFightBtn');
  if (startBtn) {
    if (appState.mode === 'online') {
      if (!onlineState.roomCode) {
        startBtn.disabled = true;
        startBtn.textContent = 'CREATE OR JOIN ROOM FIRST';
      } else if (onlineState.role === 'guest') {
        startBtn.disabled = true;
        startBtn.textContent = 'WAITING FOR HOST TO START...';
      } else if (!onlineState.hasGuest) {
        startBtn.disabled = true;
        startBtn.textContent = 'WAITING FOR PLAYER 2 TO JOIN...';
      } else {
        startBtn.disabled = false;
        startBtn.textContent = '🌐 START ONLINE FIGHT!';
      }
    } else {
      startBtn.disabled = false;
      startBtn.textContent = 'അടിച്ചു പൊളിക്കാം! — ADICHU POLIKKAAM (START FIGHT)';
    }
  }
}

function renderStages() {
  const list = document.getElementById('stageList');
  list.innerHTML = '';
  for (const st of STAGES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stage-btn' + (appState.stageId === st.id ? ' active' : '');

    const thumb = document.createElement('img');
    thumb.src = ASSETS_DATA.stages[st.id];
    thumb.alt = st.name;
    thumb.className = 'stage-thumb';

    const info = document.createElement('div');
    info.className = 'stage-btn-info';
    info.innerHTML = `<strong>${st.mlName ? `${st.mlName} · ` : ''}${st.name}</strong><span>${st.subtitle}</span>`;

    btn.appendChild(thumb);
    btn.appendChild(info);
    btn.addEventListener('click', () => {
      if (appState.mode === 'online' && onlineState.role === 'guest') return;
      audio.unlock();
      audio.playUiClick();
      appState.stageId = st.id;
      syncOnlineLobbyFromLocal();
      renderStages();
      renderArenaPlaceBar();
      updateSelectDetails();
    });
    list.appendChild(btn);
  }
}

function renderArenaPlaceBar() {
  const bar = document.getElementById('arenaPlaceBar');
  if (!bar) return;
  bar.innerHTML = '';
  const labels = {
    alappuzha: { ml: 'ആലപ്പുഴ', en: 'Alappuzha' },
    fortkochi: { ml: 'ഫോർട്ട് കൊച്ചി', en: 'Kochi' },
    thrissur: { ml: 'തൃശ്ശൂർ പൂരം', en: 'Thrissur' },
    munnar: { ml: 'മൂന്നാർ', en: 'Munnar' },
    kovalam: { ml: 'കോവളം', en: 'Kovalam' },
    kalari: { ml: 'കളരി', en: 'Kalari' },
  };
  STAGES.forEach((st, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'place-chip' + (appState.stageId === st.id ? ' active' : '');
    const lbl = labels[st.id] || { ml: st.mlName || '', en: st.name };
    b.innerHTML = `<span class="place-num">${idx + 1}</span><span class="place-ml">. ${lbl.ml} · ${lbl.en}</span>`;
    b.title = `${idx + 1}. ${lbl.ml} · ${lbl.en}`;
    b.addEventListener('click', () => {
      audio.unlock();
      switchArenaStage(st.id);
      b.blur();
    });
    bar.appendChild(b);
  });
}

function switchArenaStage(stageId) {
  if (appState.mode === 'online' && onlineState.role === 'guest') return;
  const st = getStageById(stageId);
  appState.stageId = st.id;
  audio.playUiClick();
  if (appState.match) {
    appState.match.stageId = st.id;
    appState.match.stage = st;
    appState.match.banner = {
      text: st.mlName ? `${st.mlName} · ${st.name}` : st.name,
      subtext: st.subtitle,
      timer: 55,
      color: '#fde047',
    };
  }
  renderStages();
  renderArenaPlaceBar();
}

function startMatch(p1Id, p2Id, stageId) {
  audio.unlock();
  audio.playSelect();

  onlineState.remoteInput = {};
  onlineState.lastSentInputJson = '';
  onlineState.pendingEvents = [];

  appState.screen = 'fight';
  document.getElementById('selectScreen').hidden = true;
  document.getElementById('arenaScreen').hidden = false;
  document.getElementById('victoryOverlay').hidden = true;

  const isTraining = appState.mode === 'training';
  document.getElementById('trainingBar').hidden = !isTraining;

  appState.match = createMatchState({
    p1CharId: p1Id,
    p2CharId: p2Id,
    stageId,
    mode: appState.mode,
    powerupsEnabled: appState.powerupsEnabled,
    skipIntro: false,
  });

  if (isTraining) {
    appState.match.fighters[0].meter = 100;
    appState.match.timer = 99;
  }

  appState.ai =
    appState.mode === 'vs-p2' || appState.mode === 'training' || appState.mode === 'online'
      ? null
      : createAiController(appState.difficulty);

  audio.startMusic(appState.difficulty === 'mass' ? 135 : 155);
  const f1Def = getCharacterById(p1Id);
  const f2Def = getCharacterById(p2Id);
  audio.prefetchVoiceLines([
    { charId: p1Id, text: f1Def.superEntry.shout },
    { charId: p2Id, text: f2Def.superEntry.shout },
    { charId: p1Id, text: f1Def.moves.superMove.shout },
    { charId: p2Id, text: f2Def.moves.superMove.shout },
  ]);
  renderArenaPlaceBar();
  enterMatchFullscreen();
  syncPauseVisibility(isMobilePortraitBlocked());
  if (!appState.paused) startLoop();
}

function launchConfiguredMode() {
  if (appState.mode === 'online') {
    if (onlineState.role === 'host' && onlineState.hasGuest) {
      sendWs({
        t: 'startMatch',
        p1CharId: appState.p1CharId,
        p2CharId: appState.p2CharId,
        stageId: appState.stageId,
        powerupsEnabled: appState.powerupsEnabled,
      });
    }
    return;
  }
  if (appState.mode === 'arcade') {
    appState.arcadeLadder = buildArcadeLadder(appState.p1CharId);
    appState.arcadeIndex = 0;
    const firstOpp = appState.arcadeLadder[0];
    startMatch(appState.p1CharId, firstOpp, appState.stageId);
  } else {
    startMatch(appState.p1CharId, appState.p2CharId, appState.stageId);
  }
}

function showVictoryOverlay() {
  const ov = document.getElementById('victoryOverlay');
  if (!ov.hidden) return;

  const m = appState.match;
  const winner = m.fighters[m.matchWinnerSlot ?? 0];
  const isArcadeWin = appState.mode === 'arcade' && m.matchWinnerSlot === 0;
  const hasMoreLadder = isArcadeWin && appState.arcadeIndex + 1 < appState.arcadeLadder.length;

  appState.hiScore = Math.max(appState.hiScore, m.fighters[0].score, m.fighters[1].score);

  const portImg = document.getElementById('winnerPortrait');
  portImg.src = getPortraitDataUrl(winner.charId);

  const winTitleEn =
    isArcadeWin && !hasMoreLadder
      ? `ONAM CHAMPION: ${winner.def.fullName}!`
      : `${winner.def.name} WINS THE BOUT!`;
  const winTitleMl =
    isArcadeWin && !hasMoreLadder
      ? `ഓണം ചാമ്പ്യൻ: ${winner.def.mlName || winner.def.name}!`
      : `${winner.def.mlName || winner.def.name} വിജയിച്ചു!`;
  document.getElementById('victoryTitle').textContent = `${winTitleMl} — ${winTitleEn}`;

  const quote = winner.speech?.text || winner.def.dialogues.win[0];
  const mlQuote = getMalayalamLine(quote);
  document.getElementById('victoryQuote').textContent = mlQuote
    ? `"${mlQuote}" ("${quote}")`
    : `"${quote}"`;
  document.getElementById('victoryScore').textContent = `1P SCORE: ${m.fighters[0].score}  ·  2P SCORE: ${m.fighters[1].score}`;

  const nextBtn = document.getElementById('nextStageBtn');
  if (hasMoreLadder) {
    nextBtn.hidden = false;
    const nextChar = getCharacterById(appState.arcadeLadder[appState.arcadeIndex + 1]);
    nextBtn.textContent = `NEXT CHALLENGER: ${nextChar.name} →`;
  } else {
    nextBtn.hidden = true;
  }

  const rematchBtn = document.getElementById('rematchBtn');
  if (rematchBtn) {
    const isGuest = appState.mode === 'online' && onlineState.role === 'guest';
    rematchBtn.disabled = isGuest;
    rematchBtn.textContent = isGuest ? 'WAITING FOR HOST...' : 'REMATCH';
  }

  ov.hidden = false;
}

function renderMatchFrame() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const SCALE = canvas.width / ARENA.WIDTH;

  const m = appState.match;
  if (!m) return;

  ctx.save();
  if (m.shake > 0) {
    const sx = Math.round((Math.random() - 0.5) * m.shake * SCALE);
    const sy = Math.round((Math.random() - 0.5) * m.shake * SCALE);
    ctx.translate(sx, sy);
  }

  // 1. High-Clarity 16-bit Pixel Kerala Stage
  drawStageBackground(ctx, m, appState.tick);

  // 2. Collectible Kerala Snack Power-Ups
  for (const pu of m.powerups) {
    drawPowerup(ctx, pu, appState.tick, SCALE);
  }

  // 3. Fighters (draw active attacker on top)
  const [f1, f2] = m.fighters;
  const order = f1.state === 'attack' || f1.state === 'special' || f1.state === 'super' ? [f2, f1] : [f1, f2];
  for (const f of order) {
    drawFighter(ctx, f, m, appState.tick);
  }

  // 4. Projectiles
  for (const proj of m.projectiles) {
    drawProjectile(ctx, proj, appState.tick, SCALE);
  }

  // 5. CPS-2 Hit Starbursts & Pixel Particles
  for (const sp of m.hitSparks || []) {
    const progress = 1 - sp.life / sp.maxLife;
    const rad = sp.radius * SCALE * (0.7 + progress * 0.5);
    drawImpactStarburst(ctx, sp.x * SCALE, sp.y * SCALE, rad, sp.color, sp.core);
    ctx.strokeStyle = sp.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(Math.round(sp.x * SCALE), Math.round(sp.y * SCALE), Math.round(rad * (0.8 + progress)), 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const pt of m.particles) {
    ctx.fillStyle = pt.color;
    const psz = Math.round(pt.size * SCALE);
    ctx.fillRect(Math.round(pt.x * SCALE), Math.round(pt.y * SCALE), psz, psz);
  }

  ctx.restore();

  // 6. Native 640x360 Arcade HUD, Speech Bubbles & Super Cut-In
  drawHud(ctx, m, appState.hiScore, appState.tick, canvas.width);

  if (m.phase === 'matchOver') {
    showVictoryOverlay();
  }
}

function readCombinedPrimaryInput() {
  const kbInput = readKeyboardInput(P1_KEYS, appState.mode !== 'vs-p2');
  const tcInput = readTouchInput();
  return {
    left: kbInput.left || tcInput.left,
    right: kbInput.right || tcInput.right,
    up: kbInput.up || tcInput.up,
    down: kbInput.down || tcInput.down,
    light: kbInput.light || tcInput.light,
    heavy: kbInput.heavy || tcInput.heavy,
    special: kbInput.special || tcInput.special,
    super: kbInput.super || tcInput.super,
    block: kbInput.block || tcInput.block,
  };
}

function gameLoop(now) {
  if (appState.paused || appState.screen !== 'fight') {
    appState.rafId = null;
    return;
  }

  if (!appState.lastTime) appState.lastTime = now;
  const delta = Math.min(80, now - appState.lastTime);
  appState.lastTime = now;
  appState.accumulator += delta;

  const STEP = 1000 / 60;
  const isOnlineGuest = appState.mode === 'online' && onlineState.role === 'guest';
  const isOnlineHost = appState.mode === 'online' && onlineState.role === 'host';

  while (appState.accumulator >= STEP) {
    appState.tick += 1;

    if (isOnlineGuest) {
      const p2Local = readCombinedPrimaryInput();
      const serialized = JSON.stringify(p2Local);
      if (serialized !== onlineState.lastSentInputJson || appState.tick % 6 === 0) {
        onlineState.lastSentInputJson = serialized;
        onlineState.inputSeq += 1;
        sendWs({ t: 'input', seq: onlineState.inputSeq, inp: p2Local });
      }
      appState.accumulator -= STEP;
      continue;
    }

    const p1Input = readCombinedPrimaryInput();
    let p2Input = {};
    if (isOnlineHost) {
      p2Input = onlineState.remoteInput || {};
    } else if (appState.mode === 'vs-p2') {
      p2Input = readKeyboardInput(P2_KEYS, false);
    } else if (appState.ai) {
      p2Input = appState.ai.computeInput(appState.match, 1);
    }

    stepMatch(appState.match, [p1Input, p2Input]);
    if (appState.mode === 'training') {
      appState.match.timer = 99;
      if (appState.match.fighters[1].hp < 15) {
        appState.match.fighters[1].hp = appState.match.fighters[1].maxHp;
      }
    }
    audio.handleEngineEvents(appState.match.events);

    if (isOnlineHost) {
      if (appState.match.events.length > 0) {
        onlineState.pendingEvents.push(...appState.match.events);
      }
      if (appState.tick % 2 === 0 || onlineState.pendingEvents.length > 0) {
        sendWs({
          t: 'state',
          snap: serializeMatchSnapshot(appState.match),
          events: onlineState.pendingEvents.splice(0),
        });
      }
    }
    appState.accumulator -= STEP;
  }

  renderMatchFrame();
  const mySlot = isOnlineGuest ? 1 : 0;
  const superBtn = document.getElementById('touchSuperBtn');
  if (superBtn && appState.match?.fighters?.[mySlot]) {
    superBtn.classList.toggle('super-ready', appState.match.fighters[mySlot].meter >= 100);
  }
  appState.rafId = requestAnimationFrame(gameLoop);
}

function startLoop() {
  if (appState.rafId !== null) cancelAnimationFrame(appState.rafId);
  appState.lastTime = 0;
  appState.accumulator = 0;
  appState.rafId = requestAnimationFrame(gameLoop);
}

function stopLoop() {
  if (appState.rafId !== null) {
    cancelAnimationFrame(appState.rafId);
    appState.rafId = null;
  }
}

const MODAL_DIALOG_IDS = ['moveListDialog', 'settingsDialog', 'dubStudioDialog', 'multiDeviceDialog'];

function hasOpenDialog() {
  return MODAL_DIALOG_IDS.some((id) => document.getElementById(id)?.open);
}

function closeOtherDialogs(exceptId) {
  for (const id of MODAL_DIALOG_IDS) {
    if (id === exceptId) continue;
    const dlg = document.getElementById(id);
    if (dlg?.open) dlg.close();
  }
}

function isMobilePortraitBlocked() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  const isTouchPrimary =
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches;
  return isPortrait && isTouchPrimary;
}

function syncOrientationState() {
  if (typeof document === 'undefined') return;
  const blocked = isMobilePortraitBlocked();
  document.body?.classList?.toggle('portrait-blocked', blocked);
  const overlay = document.getElementById('rotateOverlay');
  overlay?.setAttribute('aria-hidden', blocked ? 'false' : 'true');
  if (blocked) {
    clearTouchInputs();
    pressedKeys.clear();
    if (appState.screen === 'fight') syncPauseVisibility(true);
  } else if (appState.screen === 'fight' && !hasOpenDialog() && !document.hidden) {
    syncPauseVisibility(false);
  }
}

let fullscreenUserOptOut = false;

function enterMatchFullscreen() {
  if (typeof document === 'undefined') return;
  fullscreenUserOptOut = false;
  document.documentElement?.classList?.add('is-fighting');
  document.body?.classList?.add('is-fighting');
  if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
  const target = document.documentElement || document.getElementById('arenaScreen');
  const rfs =
    target?.requestFullscreen ||
    target?.webkitRequestFullscreen ||
    target?.msRequestFullscreen;
  if (rfs) {
    try {
      Promise.resolve(rfs.call(target, { navigationUI: 'hide' }))
        .then(() => {
          screen.orientation?.lock?.('landscape').catch(() => {});
        })
        .catch(() => {});
    } catch {
      // Fullscreen unavailable or blocked without user gesture
    }
  } else {
    try {
      screen.orientation?.lock?.('landscape').catch(() => {});
    } catch {}
  }
}

function exitMatchFullscreen() {
  if (typeof document === 'undefined') return;
  fullscreenUserOptOut = false;
  document.documentElement?.classList?.remove('is-fighting');
  document.body?.classList?.remove('is-fighting');
  try {
    screen.orientation?.unlock?.();
  } catch {}
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  if (fsEl) {
    const efs = document.exitFullscreen || document.webkitExitFullscreen;
    if (efs) {
      try {
        Promise.resolve(efs.call(document)).catch(() => {});
      } catch {}
    }
  }
}

function toggleMatchFullscreen() {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  if (fsEl) {
    fullscreenUserOptOut = true;
    const efs = document.exitFullscreen || document.webkitExitFullscreen;
    if (efs) Promise.resolve(efs.call(document)).catch(() => {});
  } else {
    enterMatchFullscreen();
  }
}

function wireModalDialog(dialog, { openBtn, closeBtn, onBeforeOpen, onAfterClose } = {}) {
  if (!dialog) return;
  openBtn?.addEventListener('click', () => {
    audio.unlock();
    closeOtherDialogs(dialog.id);
    if (appState.screen === 'fight') syncPauseVisibility(true);
    if (onBeforeOpen) onBeforeOpen();
    dialog.showModal();
  });
  closeBtn?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (onAfterClose) onAfterClose();
    if (appState.screen === 'fight' && !hasOpenDialog() && !isMobilePortraitBlocked()) {
      syncPauseVisibility(false);
    }
  });

  if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!inside) dialog.close();
    });
  }
}

function syncPauseVisibility(paused) {
  appState.paused = paused;
  if (paused) {
    stopLoop();
  } else if (appState.screen === 'fight' && !isMobilePortraitBlocked()) {
    startLoop();
  }
}

function setupMoveListDialog() {
  const dialog = document.getElementById('moveListDialog');
  const openBtn = document.getElementById('moveListBtn');
  const closeBtn = document.getElementById('closeMoveListBtn');
  const body = document.getElementById('moveListContent');
  if (!dialog || !body) return;

  body.innerHTML = CHARACTERS.map(
    (c) => {
      const mlShout = getMalayalamLine(c.superEntry.shout);
      return `
      <div class="move-card">
        <h4>${c.mlName ? `${c.mlName} · ` : ''}${c.name} <small>(${c.mlTitle ? `${c.mlTitle} · ` : ''}${c.title})</small></h4>
        <p><strong>Super Entry:</strong> ${c.superEntry.title} — <em>"${mlShout ? `${mlShout} / ` : ''}${c.superEntry.shout}"</em></p>
        <p><strong>Punch / Kick (J / K):</strong> ${c.moves.lightPunch.name} / ${c.moves.heavyKick.name}</p>
        <p><strong>Projectile (L):</strong> ${c.moves.projectile.name}</p>
        <p><strong>Special (W+L / S+L):</strong> ${c.moves.special.name}</p>
        <p><strong>Mass Super (100% Meter, I):</strong> ${c.moves.superMove.name}</p>
      </div>
    `;
    }
  ).join('');

  wireModalDialog(dialog, { openBtn, closeBtn });
}

function setupSettingsDialog() {
  const dialog = document.getElementById('settingsDialog');
  const openBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('closeSettingsBtn');
  wireModalDialog(dialog, { openBtn, closeBtn });
}

function cycleCharacter(slot, delta) {
  let effectiveSlot = slot;
  if (appState.mode === 'online' && onlineState.role === 'guest') effectiveSlot = 1;
  else if (appState.mode === 'online' && onlineState.role === 'host' && onlineState.hasGuest) effectiveSlot = 0;

  selectingTarget = effectiveSlot === 1 ? 'p2' : 'p1';
  const key = effectiveSlot === 0 ? 'p1CharId' : 'p2CharId';
  const idx = CHARACTERS.findIndex((c) => c.id === appState[key]);
  const nextIdx = (idx + delta + CHARACTERS.length) % CHARACTERS.length;
  appState[key] = CHARACTERS[nextIdx].id;
  if (effectiveSlot === 0 && appState.p2CharId === appState.p1CharId && !(appState.mode === 'online' && onlineState.hasGuest)) {
    appState.p2CharId = CHARACTERS[(nextIdx + 1) % CHARACTERS.length].id;
  }
  audio.playUiClick();
  syncOnlineLobbyFromLocal();
  updateSelectDetails();
  renderRosterCards();
}

function cycleStage(delta) {
  if (appState.mode === 'online' && onlineState.role === 'guest') return;
  const idx = STAGES.findIndex((s) => s.id === appState.stageId);
  appState.stageId = STAGES[(idx + delta + STAGES.length) % STAGES.length].id;
  audio.playUiClick();
  syncOnlineLobbyFromLocal();
  renderStages();
  updateSelectDetails();
}

function selectModeByIndex(idx) {
  const btns = [...document.querySelectorAll('.mode-btn')];
  const btn = btns[idx];
  if (!btn) return;
  btns.forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  appState.mode = btn.dataset.mode;
  audio.playUiClick();
  updateSelectDetails();
  updateOnlineLobbyUi();
  renderRosterCards();
}

function returnToSelect(notifyRemote = true) {
  clearTouchInputs();
  audio.stopMusic();
  stopLoop();
  appState.screen = 'select';
  document.getElementById('arenaScreen').hidden = true;
  document.getElementById('selectScreen').hidden = false;
  exitMatchFullscreen();
  if (notifyRemote && appState.mode === 'online' && onlineState.roomCode) {
    sendWs({ t: 'returnLobby' });
  }
}

function handleGlobalKeyDown(e) {
  if (isMobilePortraitBlocked()) return;

  const activeTag = document.activeElement?.tagName;
  if (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA') {
    if (e.code === 'Enter' && document.activeElement?.id === 'joinCodeInput') {
      e.preventDefault();
      document.getElementById('joinRoomBtn')?.click();
    }
    return;
  }

  const dialog = document.getElementById('moveListDialog');
  const settingsDialog = document.getElementById('settingsDialog');
  const dubDialog = document.getElementById('dubStudioDialog');
  const multiDialog = document.getElementById('multiDeviceDialog');
  const dialogOpen = hasOpenDialog();

  if (e.code === 'Tab') {
    e.preventDefault();
    audio.unlock();
    if (multiDialog?.open) multiDialog.close();
    else if (dubDialog?.open) dubDialog.close();
    else if (settingsDialog?.open) settingsDialog.close();
    else if (dialog?.open) dialog.close();
    else if (dialog) {
      if (appState.screen === 'fight') syncPauseVisibility(true);
      dialog.showModal();
    }
    return;
  }

  if (dialogOpen) return;

  if (e.code === 'KeyM') {
    document.getElementById('musicBtn')?.click();
    return;
  }

  if (appState.screen === 'select') {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === 'KeyA' || (e.code === 'ArrowLeft' && appState.mode !== 'vs-p2')) {
      cycleCharacter(0, -1);
    } else if (e.code === 'KeyD' || (e.code === 'ArrowRight' && appState.mode !== 'vs-p2')) {
      cycleCharacter(0, 1);
    } else if (e.code === 'KeyJ' || (e.code === 'ArrowLeft' && appState.mode === 'vs-p2')) {
      cycleCharacter(1, -1);
    } else if (e.code === 'KeyL' || (e.code === 'ArrowRight' && appState.mode === 'vs-p2')) {
      cycleCharacter(1, 1);
    } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      cycleStage(-1);
    } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
      cycleStage(1);
    } else if (e.code === 'Digit1') {
      selectModeByIndex(0);
    } else if (e.code === 'Digit2') {
      selectModeByIndex(1);
    } else if (e.code === 'Digit3') {
      selectModeByIndex(2);
    } else if (e.code === 'Digit4') {
      selectModeByIndex(3);
    } else if (e.code === 'Digit5') {
      selectModeByIndex(4);
    } else if (e.code === 'KeyQ') {
      const diffs = [...document.querySelectorAll('.diff-btn')];
      const cur = diffs.findIndex((b) => b.classList.contains('active'));
      diffs[(cur + 1) % diffs.length]?.click();
    } else if (e.code === 'KeyP') {
      document.getElementById('powerupsToggle')?.click();
    } else if (e.code === 'KeyC') {
      document.getElementById('crtToggle')?.click();
    } else if (e.code === 'KeyH' || e.code === 'Slash') {
      document.getElementById('moveListBtn')?.click();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      const activeId = document.activeElement?.id;
      if (['moveListBtn', 'settingsBtn', 'musicBtn', 'sfxBtn'].includes(activeId)) return;
      e.preventDefault();
      launchConfiguredMode();
    }
    return;
  }

  // Fight Screen Shortcuts
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }

  if (appState.match?.phase === 'matchOver') {
    if (e.code === 'Enter' || e.code === 'KeyJ') {
      const nextBtn = document.getElementById('nextStageBtn');
      if (!nextBtn.hidden) nextBtn.click();
      else document.getElementById('rematchBtn').click();
      return;
    }
    if (e.code === 'KeyR') {
      document.getElementById('rematchBtn').click();
      return;
    }
  }

  if (e.code === 'Escape' || e.code === 'Backspace') {
    e.preventDefault();
    returnToSelect();
    return;
  }

  if (appState.mode === 'training') {
    if (e.code === 'Digit9') document.getElementById('spawnPowerupBtn').click();
    if (e.code === 'Digit0') document.getElementById('fillMeterBtn').click();
  }

  // Instant Place / Stage Switching during fight!
  const placeMatch = /^Digit([1-6])$/.exec(e.code);
  if (placeMatch) {
    const targetStage = STAGES[Number(placeMatch[1]) - 1];
    if (targetStage) switchArenaStage(targetStage.id);
  }
  if (e.code === 'BracketLeft') {
    const idx = STAGES.findIndex((s) => s.id === appState.stageId);
    switchArenaStage(STAGES[(idx - 1 + STAGES.length) % STAGES.length].id);
  }
  if (e.code === 'BracketRight') {
    const idx = STAGES.findIndex((s) => s.id === appState.stageId);
    switchArenaStage(STAGES[(idx + 1) % STAGES.length].id);
  }
}

function setupControls() {
  window.addEventListener('keydown', (e) => {
    pressedKeys.add(e.code);
    audio.unlock();
    if (!e.repeat || ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      if (!e.repeat || appState.screen === 'select') handleGlobalKeyDown(e);
    }
  });

  window.addEventListener('keyup', (e) => {
    pressedKeys.delete(e.code);
  });

  window.addEventListener('blur', () => pressedKeys.clear());

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.unlock();
      audio.playUiClick();
      document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      appState.mode = btn.dataset.mode;
      updateSelectDetails();
      updateOnlineLobbyUi();
      renderRosterCards();
    });
  });

  // Online / Wi-Fi Multiplayer Lobby buttons
  document.getElementById('createRoomBtn')?.addEventListener('click', () => {
    audio.unlock();
    audio.playUiClick();
    createOnlineRoom();
  });
  document.getElementById('joinRoomBtn')?.addEventListener('click', () => {
    audio.unlock();
    audio.playUiClick();
    const code = document.getElementById('joinCodeInput')?.value || '';
    joinOnlineRoom(code);
  });
  document.getElementById('leaveRoomBtn')?.addEventListener('click', () => {
    audio.unlock();
    audio.playUiClick();
    leaveOnlineRoom();
  });
  document.getElementById('copyInviteBtn')?.addEventListener('click', async () => {
    const linkEl = document.getElementById('roomInviteLink');
    const copyBtn = document.getElementById('copyInviteBtn');
    const url = linkEl?.href || getInviteUrlForCode(onlineState.roomCode);
    if (!url || !copyBtn) return;
    try {
      await navigator.clipboard?.writeText(url);
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => (copyBtn.textContent = '📋 Copy Link'), 1800);
    } catch {
      copyBtn.textContent = 'Copy URL Above';
    }
  });

  // Difficulty pills
  document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.unlock();
      audio.playUiClick();
      document.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      appState.difficulty = btn.dataset.diff;
    });
  });

  document.getElementById('pickTargetBtn').addEventListener('click', () => {
    selectingTarget = selectingTarget === 'p1' ? 'p2' : 'p1';
    updateSelectDetails();
    renderRosterCards();
  });

  document.getElementById('rotateLeftBtn')?.addEventListener('click', () => {
    audio.unlock();
    rotateSelectionWheel(-1);
  });
  document.getElementById('rotateRightBtn')?.addEventListener('click', () => {
    audio.unlock();
    rotateSelectionWheel(1);
  });

  const carouselEl = document.getElementById('rosterCarousel');
  if (carouselEl) {
    let dragStartX = null;
    carouselEl.addEventListener('pointerdown', (e) => {
      if (e.target?.closest?.('.wheel-arrow')) return;
      dragStartX = e.clientX;
    });
    carouselEl.addEventListener('pointerup', (e) => {
      if (dragStartX === null) return;
      const dx = e.clientX - dragStartX;
      dragStartX = null;
      if (Math.abs(dx) >= 34) {
        audio.unlock();
        rotateSelectionWheel(dx < 0 ? 1 : -1);
      }
    });
    carouselEl.addEventListener('pointercancel', () => { dragStartX = null; });

    let lastWheelAt = 0;
    carouselEl.addEventListener('wheel', (e) => {
      const mag = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(mag) < 6) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelAt < 95) return;
      lastWheelAt = now;
      audio.unlock();
      rotateSelectionWheel(mag > 0 ? 1 : -1);
    }, { passive: false });
  }

  document.getElementById('powerupsToggle').addEventListener('change', (e) => {
    if (appState.mode === 'online' && onlineState.role === 'guest') {
      e.target.checked = appState.powerupsEnabled;
      return;
    }
    appState.powerupsEnabled = e.target.checked;
    syncOnlineLobbyFromLocal();
  });

  document.getElementById('crtToggle').addEventListener('change', (e) => {
    appState.crtEnabled = e.target.checked;
    document.getElementById('cabinetFrame').classList.toggle('crt-on', appState.crtEnabled);
  });

  document.getElementById('voiceBtn').addEventListener('click', (e) => {
    audio.unlock();
    const next = !audio.isVoiceEnabled();
    audio.setVoiceEnabled(next);
    e.target.textContent = next ? 'Voices: ON' : 'Voices: OFF';
    updateVoiceStatusBadge();
  });

  document.getElementById('musicBtn').addEventListener('click', (e) => {
    audio.unlock();
    const next = !audio.isMusicEnabled();
    audio.setMusicEnabled(next);
    if (next && appState.screen === 'fight') audio.startMusic();
    e.target.textContent = next ? 'Chenda BGM: ON' : 'Chenda BGM: OFF';
  });

  document.getElementById('sfxBtn').addEventListener('click', (e) => {
    audio.unlock();
    const next = !audio.isSfxEnabled();
    audio.setSfxEnabled(next);
    e.target.textContent = next ? 'SFX: ON' : 'SFX: OFF';
  });

  document.getElementById('startFightBtn').addEventListener('click', launchConfiguredMode);

  document.getElementById('backToSelectBtn').addEventListener('click', () => returnToSelect(true));
  document.getElementById('fullscreenBtn')?.addEventListener('click', toggleMatchFullscreen);

  const syncFullscreenBtn = () => {
    const fsBtn = document.getElementById('fullscreenBtn');
    if (!fsBtn) return;
    const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    fsBtn.textContent = active ? '⤢' : '⛶';
    fsBtn.title = active ? 'Exit Fullscreen' : 'Enter Fullscreen';
  };
  document.addEventListener('fullscreenchange', syncFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', syncFullscreenBtn);

  document.getElementById('rematchBtn').addEventListener('click', () => {
    if (appState.mode === 'online') {
      if (onlineState.role === 'host') sendWs({ t: 'rematch' });
      return;
    }
    const m = appState.match;
    startMatch(m.fighters[0].charId, m.fighters[1].charId, m.stageId);
  });

  document.getElementById('nextStageBtn').addEventListener('click', () => {
    appState.arcadeIndex += 1;
    const nextOpp = appState.arcadeLadder[appState.arcadeIndex];
    const startIdx = Math.max(0, STAGES.findIndex((s) => s.id === appState.stageId));
    const nextStage = STAGES[(startIdx + appState.arcadeIndex) % STAGES.length].id;
    startMatch(appState.p1CharId, nextOpp, nextStage);
  });

  document.getElementById('victorySelectBtn').addEventListener('click', () => returnToSelect(true));

  // Training showcase buttons
  document.getElementById('spawnPowerupBtn').addEventListener('click', () => {
    if (appState.match) {
      appState.match.powerupSpawnTimer = 1;
    }
  });

  document.getElementById('fillMeterBtn').addEventListener('click', () => {
    if (appState.match) {
      appState.match.fighters[0].meter = 100;
      setSpeech(appState.match.fighters[0], 'MASS METER 100% — PRESS I FOR SUPER!', 100, 'super');
      spawnParticles(appState.match, appState.match.fighters[0].x, appState.match.fighters[0].y - 25, '#fde047', 12, 2.5);
    }
  });

  // Pause rendering when canvas container is offscreen or tab hidden
  const arenaScreen = document.getElementById('arenaScreen');
  arenaScreen.addEventListener('contentvisibilityautostatechange', (event) => {
    syncPauseVisibility(event.skipped);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) syncPauseVisibility(true);
    else if (appState.screen === 'fight' && !hasOpenDialog() && !isMobilePortraitBlocked()) {
      syncPauseVisibility(false);
    }
  });
}

function updateVoiceStatusBadge() {
  const badge = document.getElementById('voiceStatusBadge');
  if (!badge) return;
  if (!audio.isVoiceEnabled()) {
    badge.textContent = 'ശബ്ദം: OFF · Muted';
    badge.className = 'voice-pill';
    return;
  }
  const dubCount = audio.getCustomClipCount();
  const mode = audio.getVoiceMode();
  const cs = audio.getCloudState();
  const cloudReady = cs.serverReachable && audio.isCloudProviderConfigured();

  if (mode === 'humanOnly') {
    badge.textContent =
      dubCount > 0
        ? `🎙️ Human Dubs Active (${dubCount} keys · Zero AI)`
        : 'Human Dubs Only · Record via 🎙️ Dub Studio';
    badge.className = dubCount > 0 ? 'voice-pill ml-native' : 'voice-pill ml-fallback';
    return;
  }

  if (cloudReady) {
    badge.textContent = `ശബ്ദം: ${cs.provider.toUpperCase()} ml-IN (${cs.voiceId === 'auto' ? 'Male/Female Auto' : cs.voiceId})`;
    badge.className = 'voice-pill ml-native';
  } else if (dubCount > 0) {
    badge.textContent = `🎙️ Pre-cached / Human Clips Active (${dubCount} keys)`;
    badge.className = 'voice-pill ml-native';
  } else if (audio.hasNativeMalayalamVoice()) {
    badge.textContent = 'ശബ്ദം: Browser ml-IN Native · Start node server.mjs for Cloud TTS';
    badge.className = 'voice-pill ml-native';
  } else if (mode === 'allowFallback') {
    badge.textContent = 'Voice: English TTS Fallback · Configure .env for Cloud ml-IN';
    badge.className = 'voice-pill ml-fallback';
  } else {
    badge.textContent = cs.serverReachable
      ? `Add ${cs.provider.toUpperCase()} API key to .env · (Kombu SFX ON)`
      : 'Offline Mode · Run play.bat + .env for Cloud ml-IN TTS (or Dub Studio)';
    badge.className = 'voice-pill ml-fallback';
  }
}

const OFFLINE_TTS_VOICES = {
  azure: [
    { id: 'ml-IN-MidhunNeural', label: 'Midhun (Kerala Male · Neural)' },
    { id: 'ml-IN-SobhanaNeural', label: 'Sobhana (Kerala Female · Neural)' },
  ],
  google: [
    { id: 'ml-IN-Chirp3-HD-Achird', label: 'Chirp 3 HD Achird (Male)' },
    { id: 'ml-IN-Chirp3-HD-Achernar', label: 'Chirp 3 HD Achernar (Female)' },
    { id: 'ml-IN-Wavenet-B', label: 'WaveNet B (Male · SSML)' },
    { id: 'ml-IN-Wavenet-A', label: 'WaveNet A (Female · SSML)' },
  ],
  gnani: [
    { id: 'male', label: 'Vachana Male (ml-IN)' },
    { id: 'female', label: 'Vachana Female (ml-IN)' },
  ],
};

function setupCloudTtsControls() {
  const provSel = document.getElementById('cloudProviderSelect');
  const voiceSel = document.getElementById('cloudVoiceSelect');
  if (!provSel || !voiceSel) return;

  function populateVoices(providerId) {
    const cs = audio.getCloudState();
    const srvProv = cs.providers.find((p) => p.id === providerId);
    const list = srvProv?.voices || OFFLINE_TTS_VOICES[providerId] || OFFLINE_TTS_VOICES.azure;
    voiceSel.innerHTML = '';
    const autoOpt = document.createElement('option');
    autoOpt.value = 'auto';
    autoOpt.textContent = 'Voice: Auto (Male/Female per Fighter)';
    voiceSel.appendChild(autoOpt);
    for (const v of list) {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.label;
      voiceSel.appendChild(opt);
    }
    voiceSel.value = cs.voiceId || 'auto';
  }

  provSel.addEventListener('change', (e) => {
    audio.setCloudProvider(e.target.value);
    audio.setCloudVoice('auto');
    populateVoices(e.target.value);
    updateVoiceStatusBadge();
  });

  voiceSel.addEventListener('change', (e) => {
    audio.setCloudVoice(e.target.value);
    updateVoiceStatusBadge();
  });

  populateVoices(provSel.value);
  audio.initCloudTts().then((cs) => {
    if (cs.serverReachable && cs.providers.length > 0) {
      provSel.innerHTML = '';
      for (const p of cs.providers) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.label}${p.configured ? ' ✓' : ' (no key)'}`;
        provSel.appendChild(opt);
      }
      provSel.value = cs.provider;
      populateVoices(cs.provider);
      updateVoiceStatusBadge();
    }
  });
}

const DUB_DB_NAME = 'mallu_fighter_dubs_v1';
const DUB_STORE_NAME = 'clips';
const dubObjectUrls = new Map();

function openDubDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DUB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DUB_STORE_NAME)) {
        req.result.createObjectStore(DUB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDubBlob(key, blob) {
  const db = await openDubDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DUB_STORE_NAME, 'readwrite');
    tx.objectStore(DUB_STORE_NAME).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteDubBlob(key) {
  const db = await openDubDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DUB_STORE_NAME, 'readwrite');
    tx.objectStore(DUB_STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadSavedHumanDubs() {
  if (typeof indexedDB !== 'undefined' && typeof URL !== 'undefined') {
    try {
      const db = await openDubDb();
      const tx = db.transaction(DUB_STORE_NAME, 'readonly');
      const store = tx.objectStore(DUB_STORE_NAME);
      const req = store.openCursor();
      await new Promise((resolve) => {
        req.onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (!cursor) {
            resolve();
            return;
          }
          const key = cursor.key;
          const blob = cursor.value;
          if (blob) {
            const url = URL.createObjectURL(blob);
            dubObjectUrls.set(key, url);
            audio.registerVoiceClip(key, url);
          }
          cursor.continue();
        };
        req.onerror = () => resolve();
      });
    } catch {
      // IndexedDB disabled/unavailable in restricted browsers
    }
  }

  // Optional static non-AI voice pack placed in assets/voices/manifest.json when served over HTTP
  if (typeof fetch !== 'undefined' && typeof window !== 'undefined' && window.location?.protocol !== 'file:') {
    try {
      const res = await fetch('assets/voices/manifest.json');
      if (res.ok) {
        const map = await res.json();
        for (const [key, relPath] of Object.entries(map || {})) {
          audio.registerVoiceClip(key, relPath.startsWith('http') || relPath.startsWith('assets/') ? relPath : `assets/voices/${relPath}`);
        }
      }
    } catch {
      // No external manifest provided yet
    }
  }
  updateVoiceStatusBadge();
}

function getCuratedDubPrompts() {
  const items = [];
  for (const ch of CHARACTERS) {
    items.push({ tag: `${ch.name} Entry`, charId: ch.id, key: ch.superEntry.shout });
    items.push({ tag: `${ch.name} Super`, charId: ch.id, key: ch.moves.superMove.shout });
    items.push({ tag: `${ch.name} Win`, charId: ch.id, key: ch.dialogues.win[0] });
  }
  items.push({ tag: 'Snack: Chaya', charId: 'maveli', key: 'Oru Strong Meter Chaya! Energy full aayi mwone!' });
  items.push({ tag: 'Snack: Kanthari', charId: 'theyyam', key: 'Kanthari Mulaku kadichu! THEE PAARUM — MASS UP!' });
  items.push({ tag: 'Crowd: Alappuzha', charId: 'audience', key: 'CROWD: Poli machane! Kettuvallam kulungunnundu!' });
  items.push({ tag: 'Crowd: Kochi', charId: 'audience', key: 'CHAYAKKARAN: Adichu thakarkku, chaya free!' });
  items.push({ tag: 'Crowd: Thrissur', charId: 'audience', key: 'POORAM CROWD: Chenda melam kettu — ADICHU POLIKKU!' });
  items.push({ tag: 'Crowd: Munnar', charId: 'audience', key: 'MUNNAR CROWD: Manjum thennalum — MUNNAR COOL MASS!' });
  items.push({ tag: 'Crowd: Kovalam', charId: 'audience', key: 'KOVALAM CROWD: Thiramala pole punch — KOVALAM SUPER MATCH!' });
  items.push({ tag: 'Crowd: Kalari', charId: 'audience', key: 'GURUKKAL: Chuvadu thettaruthu — KALARI POWER!' });
  return items;
}

function setupDubStudioDialog() {
  const dialog = document.getElementById('dubStudioDialog');
  const openBtn = document.getElementById('dubStudioBtn');
  const closeBtn = document.getElementById('closeDubStudioBtn');
  const rowsHost = document.getElementById('dubStudioRows');
  const statusEl = document.getElementById('dubStudioStatus');
  const modeSelect = document.getElementById('voiceModeSelect');
  if (!dialog || !openBtn || !rowsHost) return;

  let activeRecorder = null;
  let activeStream = null;
  let activeKey = null;

  function stopActiveRecorder() {
    if (activeRecorder && activeRecorder.state === 'recording') {
      try { activeRecorder.stop(); } catch {}
    }
    if (activeStream) {
      activeStream.getTracks().forEach((t) => t.stop());
    }
    activeRecorder = null;
    activeStream = null;
    activeKey = null;
  }

  function renderDubRows() {
    const prompts = getCuratedDubPrompts();
    rowsHost.innerHTML = '';
    for (const item of prompts) {
      const hasClip = audio.hasVoiceClip(item.key);
      const isRec = activeKey === item.key;
      const row = document.createElement('div');
      row.className = 'dub-row';

      const textBox = document.createElement('div');
      textBox.className = 'dub-text';
      textBox.innerHTML = `
        <span class="dub-tag">${item.tag} ${hasClip ? '· ✓ Real Dub Saved' : ''}</span>
        <span class="dub-ml">${getMalayalamLine(item.key) || item.key}</span>
        <span class="dub-en">"${item.key}"</span>
      `;

      const controls = document.createElement('div');
      controls.className = 'dub-controls';

      const recBtn = document.createElement('button');
      recBtn.type = 'button';
      recBtn.className = isRec ? 'btn-rec-active' : 'btn-secondary';
      recBtn.textContent = isRec ? '⏹ Stop' : '🎙️ Record';
      recBtn.addEventListener('click', async () => {
        audio.unlock();
        if (isRec) {
          stopActiveRecorder();
          renderDubRows();
          return;
        }
        stopActiveRecorder();
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          statusEl.textContent = 'Microphone recording unavailable in this browser — use "Upload Audio" (.mp3/.wav)!';
          return;
        }
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const chunks = [];
          activeRecorder = new MediaRecorder(activeStream);
          activeKey = item.key;
          activeRecorder.ondataavailable = (ev) => {
            if (ev.data?.size > 0) chunks.push(ev.data);
          };
          activeRecorder.onstop = async () => {
            const blob = new Blob(chunks, { type: activeRecorder?.mimeType || 'audio/webm' });
            if (blob.size > 0) {
              const oldUrl = dubObjectUrls.get(item.key);
              if (oldUrl) URL.revokeObjectURL(oldUrl);
              const url = URL.createObjectURL(blob);
              dubObjectUrls.set(item.key, url);
              audio.registerVoiceClip(item.key, url);
              await saveDubBlob(item.key, blob).catch(() => {});
              statusEl.textContent = `Saved real human Malayalam dub for "${getMalayalamLine(item.key) || item.key}"!`;
              updateVoiceStatusBadge();
            }
            if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
            activeStream = null;
            activeRecorder = null;
            activeKey = null;
            renderDubRows();
          };
          activeRecorder.start();
          statusEl.textContent = `Recording "${getMalayalamLine(item.key) || item.key}" — speak into your mic, then press Stop!`;
          renderDubRows();
        } catch (err) {
          statusEl.textContent = `Mic access blocked (${err?.message || 'permission denied'}). Use "Upload Audio" instead!`;
          stopActiveRecorder();
          renderDubRows();
        }
      });

      const uploadLabel = document.createElement('label');
      uploadLabel.className = 'dub-upload-btn';
      uploadLabel.textContent = '📁 Upload Audio';
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'audio/*';
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const oldUrl = dubObjectUrls.get(item.key);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        const url = URL.createObjectURL(file);
        dubObjectUrls.set(item.key, url);
        audio.registerVoiceClip(item.key, url);
        await saveDubBlob(item.key, file).catch(() => {});
        statusEl.textContent = `Loaded real file "${file.name}" for ${item.tag}!`;
        updateVoiceStatusBadge();
        renderDubRows();
      });
      uploadLabel.appendChild(fileInput);

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'btn-secondary';
      playBtn.textContent = '▶ Play';
      playBtn.disabled = !hasClip;
      playBtn.addEventListener('click', () => {
        audio.unlock();
        audio.speakLine(item.charId, item.key, true);
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-secondary';
      delBtn.textContent = '🗑 Clear';
      delBtn.disabled = !hasClip;
      delBtn.addEventListener('click', async () => {
        const oldUrl = dubObjectUrls.get(item.key);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        dubObjectUrls.delete(item.key);
        audio.unregisterVoiceClip(item.key);
        await deleteDubBlob(item.key).catch(() => {});
        statusEl.textContent = `Cleared custom clip for ${item.tag}.`;
        updateVoiceStatusBadge();
        renderDubRows();
      });

      controls.append(recBtn, uploadLabel, playBtn, delBtn);
      row.append(textBox, controls);
      rowsHost.appendChild(row);
    }
  }

  wireModalDialog(dialog, {
    openBtn,
    closeBtn,
    onBeforeOpen: () => {
      statusEl.textContent = '';
      renderDubRows();
    },
    onAfterClose: stopActiveRecorder,
  });

  modeSelect?.addEventListener('change', (e) => {
    audio.setVoiceMode(e.target.value);
    updateVoiceStatusBadge();
  });
}

function setupTouchControls() {
  const pad = document.getElementById('touchPad');
  const dpad = document.getElementById('touchDpad');
  const toggleBtn = document.getElementById('touchToggleBtn');
  const canvas = document.getElementById('gameCanvas');
  if (!pad || !dpad) return;

  const isCoarseTouch =
    (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches) ||
    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0);

  let touchVisible = Boolean(isCoarseTouch);
  function syncTouchPadVisibility() {
    pad.hidden = !touchVisible;
    if (toggleBtn) toggleBtn.textContent = touchVisible ? '🎮 Touch Pad: ON' : '🎮 Touch Pad: OFF';
  }
  syncTouchPadVisibility();

  toggleBtn?.addEventListener('click', () => {
    audio.unlock();
    touchVisible = !touchVisible;
    if (!touchVisible) clearTouchInputs();
    syncTouchPadVisibility();
  });

  function updateDpadVisuals() {
    const agg = { left: false, right: false, up: false, down: false };
    for (const d of touchState.dpadPointers.values()) {
      agg.left = agg.left || d.left;
      agg.right = agg.right || d.right;
      agg.up = agg.up || d.up;
      agg.down = agg.down || d.down;
    }
    dpad.querySelectorAll('.dpad-dir').forEach((el) => {
      const dir = el.dataset.dir;
      el.classList.toggle('active', Boolean(agg[dir]));
    });
  }

  function computeDpadVector(ev) {
    const rect = dpad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    const thresholdX = rect.width * 0.14;
    const thresholdY = rect.height * 0.16;
    return {
      left: dx < -thresholdX,
      right: dx > thresholdX,
      up: dy < -thresholdY,
      down: dy > thresholdY,
    };
  }

  dpad.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    audio.unlock();
    dpad.setPointerCapture?.(ev.pointerId);
    touchState.dpadPointers.set(ev.pointerId, computeDpadVector(ev));
    updateDpadVisuals();
  });
  dpad.addEventListener('pointermove', (ev) => {
    if (!touchState.dpadPointers.has(ev.pointerId)) return;
    touchState.dpadPointers.set(ev.pointerId, computeDpadVector(ev));
    updateDpadVisuals();
  });
  const releaseDpad = (ev) => {
    if (touchState.dpadPointers.delete(ev.pointerId)) updateDpadVisuals();
  };
  dpad.addEventListener('pointerup', releaseDpad);
  dpad.addEventListener('pointercancel', releaseDpad);

  document.querySelectorAll('#touchActions .touch-btn').forEach((btn) => {
    const action = btn.dataset.action;
    btn.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      audio.unlock();
      btn.setPointerCapture?.(ev.pointerId);
      touchState.actionPointers.set(ev.pointerId, { action, btn });
      btn.classList.add('active');
    });
    const releaseAct = (ev) => {
      const held = touchState.actionPointers.get(ev.pointerId);
      if (held) {
        held.btn?.classList?.remove('active');
        touchState.actionPointers.delete(ev.pointerId);
      }
    };
    btn.addEventListener('pointerup', releaseAct);
    btn.addEventListener('pointercancel', releaseAct);
  });

  function ensureTouchFullscreen() {
    if (!isCoarseTouch || appState.screen !== 'fight' || fullscreenUserOptOut) return;
    if (typeof document !== 'undefined' && !(document.fullscreenElement || document.webkitFullscreenElement)) {
      enterMatchFullscreen();
    }
  }

  document.getElementById('arenaScreen')?.addEventListener('touchend', ensureTouchFullscreen, { passive: true });

  // Tap arena canvas during Super Entry intro to skip straight into fight
  canvas?.addEventListener('pointerdown', () => {
    audio.unlock();
    if (appState.match?.phase === 'intro') {
      touchState.actionPointers.set('tap-skip', { action: 'light', btn: null });
      setTimeout(() => touchState.actionPointers.delete('tap-skip'), 90);
    }
  });

  window.addEventListener('blur', clearTouchInputs);
}

function setupMultiDeviceDialog() {
  const dialog = document.getElementById('multiDeviceDialog');
  const openBtn = document.getElementById('multiDeviceBtn');
  const closeBtn = document.getElementById('closeMultiDeviceBtn');
  const linksBox = document.getElementById('lanLinksList');
  if (!dialog || !openBtn || !linksBox) return;

  function renderLanLinks(lanItems = []) {
    linksBox.innerHTML = '';
    const items = [...lanItems];
    if (items.length === 0 && typeof window !== 'undefined' && window.location?.href?.startsWith('http')) {
      items.push({ name: 'Current Host', url: window.location.href });
    }
    if (items.length === 0) {
      linksBox.innerHTML = '<div class="lan-link-row"><span>Run <code>play.bat</code> (or <code>npm start</code>) via Node/Python to serve your Wi-Fi IP link cleanly.</span></div>';
      return;
    }
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'lan-link-row';

      const info = document.createElement('div');
      info.innerHTML = `<a href="${item.url}" class="lan-url-link" target="_blank" rel="noopener">${item.url}</a><div class="lan-iface">${item.name || 'Wi-Fi / LAN'}</div>`;

      const actions = document.createElement('div');
      actions.className = 'dub-controls';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-secondary';
      copyBtn.textContent = '📋 Copy';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard?.writeText(item.url);
          copyBtn.textContent = '✓ Copied!';
          setTimeout(() => (copyBtn.textContent = '📋 Copy'), 1800);
        } catch {
          copyBtn.textContent = 'Select Link';
        }
      });

      actions.appendChild(copyBtn);
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const shareBtn = document.createElement('button');
        shareBtn.type = 'button';
        shareBtn.className = 'btn-accent';
        shareBtn.textContent = '📤 Share';
        shareBtn.addEventListener('click', () => {
          navigator.share({ title: 'MALLU FIGHTER II', url: item.url }).catch(() => {});
        });
        actions.appendChild(shareBtn);
      }

      row.append(info, actions);
      linksBox.appendChild(row);
    }
  }

  async function loadLanLinks() {
    linksBox.innerHTML = '<div class="lan-link-row">Detecting local Wi-Fi URLs...</div>';
    if (typeof fetch !== 'undefined' && typeof window !== 'undefined' && window.location?.protocol !== 'file:') {
      try {
        const res = await fetch('/api/network-info');
        if (res.ok) {
          const data = await res.json();
          renderLanLinks(data.lanUrls || []);
          return;
        }
      } catch {}
    }
    renderLanLinks([]);
  }

  wireModalDialog(dialog, {
    openBtn,
    closeBtn,
    onBeforeOpen: () => {
      loadLanLinks();
    },
  });
}

function init() {
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  const params = new URLSearchParams(window.location.search);
  const p1Param = params.get('p1');
  const p2Param = params.get('p2');
  const stageParam = params.get('stage');
  const modeParam = params.get('mode');
  const joinParam = params.get('join');
  if (p1Param && CHARACTERS.some((c) => c.id === p1Param)) appState.p1CharId = p1Param;
  if (p2Param && CHARACTERS.some((c) => c.id === p2Param)) appState.p2CharId = p2Param;
  if (stageParam && STAGES.some((s) => s.id === stageParam)) appState.stageId = stageParam;
  if (modeParam) appState.mode = modeParam;
  if (joinParam) appState.mode = 'online';

  document.querySelectorAll('.mode-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === appState.mode);
  });

  preloadAllGraphics();
  renderRosterCards();
  renderStages();
  renderArenaPlaceBar();
  updateSelectDetails();
  updateOnlineLobbyUi();
  setupMoveListDialog();
  setupSettingsDialog();
  setupDubStudioDialog();
  setupMultiDeviceDialog();
  setupTouchControls();
  setupCloudTtsControls();
  setupControls();
  loadSavedHumanDubs();
  updateVoiceStatusBadge();

  syncOrientationState();
  if (typeof window !== 'undefined') {
    window.addEventListener('orientationchange', syncOrientationState);
    window.addEventListener('resize', syncOrientationState);
    const portraitMql = window.matchMedia?.('(orientation: portrait)');
    portraitMql?.addEventListener?.('change', syncOrientationState);
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis?.addEventListener) {
    window.speechSynthesis.addEventListener('voiceschanged', updateVoiceStatusBadge);
  }

  if (joinParam) {
    const input = document.getElementById('joinCodeInput');
    if (input) input.value = joinParam.trim();
    joinOnlineRoom(joinParam);
  } else if (params.get('autostart') === '1') {
    startMatch(appState.p1CharId, appState.p2CharId, appState.stageId);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
