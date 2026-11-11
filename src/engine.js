/**
 * Core deterministic 60-FPS 2D fighting game engine.
 * Pure simulation logic (zero DOM dependency) so it runs in browser and Node tests.
 */

import { POWERUP_TYPES, getCharacterById, getStageById } from './characters.js';

export const ARENA = {
  WIDTH: 384,
  HEIGHT: 216,
  FLOOR_Y: 194,
  LEFT_WALL: 26,
  RIGHT_WALL: 358,
  ROUND_SECONDS: 99,
  ROUNDS_TO_WIN: 2,
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function pickRandom(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

export function createFighter(slot, charId, x, facing) {
  const def = getCharacterById(charId);
  return {
    slot, // 0 or 1
    charId: def.id,
    def,
    x,
    y: ARENA.FLOOR_Y,
    vx: 0,
    vy: 0,
    facing, // 1 = right, -1 = left
    hp: def.maxHp,
    trailHp: def.maxHp,
    maxHp: def.maxHp,
    meter: 35, // Start with a bit of Mass energy
    roundsWon: 0,
    score: 0,
    state: 'idle', // idle, walk, crouch, jump, attack, projectile, special, super, blockstun, hitstun, knockdown, ko, victory, entry
    stateTimer: 0,
    animTick: 0,
    currentMove: null,
    moveKey: null,
    moveHitConnected: false,
    projectileCooldown: 0,
    specialCooldown: 0,
    invulnFrames: 0,
    comboCount: 0, // hits currently suffered by this fighter
    comboBannerTimer: 0,
    // Power-up active buffs
    buffs: {
      damageMult: 1,
      damageTimer: 0,
      speedMult: 1,
      speedTimer: 0,
      shieldMult: 1,
      shieldTimer: 0,
      auraColor: null,
    },
    // Speech bubble
    speech: null, // { text, timer, type: 'normal' | 'powerup' | 'super' }
    lowHpWarned: false,
    munduFolded: false, // Visual flair for George / mundu fighters
    trail: [], // Afterimage ghost snapshots during specials/supers
    prevInput: {},
    motionHistory: [], // stores recent direction taps
  };
}

export function createMatchState({
  p1CharId = 'maveli',
  p2CharId = 'george',
  stageId = 'alappuzha',
  mode = 'vs-cpu',
  powerupsEnabled = true,
  skipIntro = false,
  rng = Math.random,
} = {}) {
  const stage = getStageById(stageId);
  const f1 = createFighter(0, p1CharId, 108, 1);
  const f2 = createFighter(1, p2CharId, 276, -1);

  if (!skipIntro) {
    f1.state = 'entry';
    f2.state = 'entry';
  }

  return {
    mode,
    stageId: stage.id,
    stage,
    powerupsEnabled,
    rng,
    round: 1,
    timer: ARENA.ROUND_SECONDS,
    timerFrames: 0,
    phase: skipIntro ? 'fight' : 'intro', // intro, ready, fight, superFreeze, roundOver, matchOver
    phaseTimer: skipIntro ? 0 : 220,
    superFreezeTimer: 0,
    superFreezeActor: null,
    roundWinnerSlot: null,
    matchWinnerSlot: null,
    hitstop: 0,
    shake: 0,
    crowdExcitement: 0, // 0..100 excites background spectators
    audienceBubble: null,
    audienceCooldown: 60,
    banner: skipIntro ? { text: 'FIGHT!', subtext: 'ADI THUDANGU!', timer: 55, color: '#fde047' } : null,
    powerupBanner: null, // { title, dialogue, color, timer, slot }
    fighters: [f1, f2],
    projectiles: [],
    powerups: [],
    powerupSpawnTimer: 420, // First powerup arrives after ~7 seconds!
    particles: [],
    hitSparks: [], // CPS-2 impact starbursts & shockwave rings
    popups: [], // Floating hit / dialogue popups
    events: [], // Audio & visual hook events emitted this tick, cleared every step
  };
}

function emitEvent(state, type, payload = {}) {
  state.events.push({ type, ...payload });
}

const AUDIENCE_LINES = {
  alappuzha: [
    'CROWD: Poli machane! Kettuvallam kulungunnundu!',
    'BOAT UNCLE: Thorthu veeshi adi polikku!',
    'CROWD: Adi sake! Alappuzha super match!',
    'TOURIST: Oh my God, classic Mallu punch!',
  ],
  fortkochi: [
    'CHAYAKKARAN: Adichu thakarkku, chaya free!',
    'AUTO STAND: Meter ittittilla, full power adi!',
    'CROWD: Pazhampori pole hot adi mwone!',
    'FORT KOCHI: Cheena vala vare kulungi!',
  ],
  thrissur: [
    'POORAM CROWD: Chenda melam kettu — ADICHU POLIKKU!',
    'CHENDA TEAM: Thakida thakida — MASS COMBO!',
    'CROWD: Elephants vare cheer cheyyunnu!',
    'POORAM: Thrissur Pooram pole fire adi!',
  ],
  munnar: [
    'MUNNAR CROWD: Manjum thennalum — MUNNAR COOL MASS!',
    'TEA PICKER: Kunnukal vare kulungi — TOP FIGHT!',
    'CROWD: Neelakurinji pole rare combo mwone!',
    'TOURIST: Fogil koodi flying kick — SUPERB!',
  ],
  kovalam: [
    'KOVALAM CROWD: Thiramala pole punch — KOVALAM SUPER MATCH!',
    'LIFEGUARD: Lighthouse vare thilangi — POWER ADI!',
    'FISHERMAN: Kadalil ninnu vannathalle? Poli adi!',
    'CROWD: Sunset beachil ninnoru MASS KNOCKOUT!',
  ],
  kalari: [
    'GURUKKAL: Chuvadu thettaruthu — KALARI POWER!',
    'SHISHYANMAR: Nilavilakku sakhshi — VEERA PORATTAM!',
    'KALARI CROWD: Enna thecha meyyum chuvadum — ADICHU POLIKKU!',
    'GURUKKAL: Urumi pole veezhaatha vegam!',
  ],
};

function triggerAudienceCheer(state, forcedText = null) {
  if (state.audienceCooldown > 0 && !forcedText) return;
  const pool = AUDIENCE_LINES[state.stageId] || AUDIENCE_LINES.alappuzha;
  const text = forcedText || pickRandom(pool, state.rng);
  state.audienceBubble = {
    text,
    x: 110 + Math.floor(state.rng() * 164),
    y: 86,
    timer: 115,
  };
  state.audienceCooldown = 190;
  emitEvent(state, 'audienceCheer', { text });
}

export function setSpeech(fighter, text, timer = 150, type = 'normal') {
  fighter.speech = { text, timer, type };
}

export function spawnParticles(state, x, y, color, count = 8, speed = 2.4, gravity = 0.08, size = 2) {
  for (let i = 0; i < count; i++) {
    const angle = state.rng() * Math.PI * 2;
    const spd = (0.4 + state.rng() * 0.9) * speed;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 0.8,
      color,
      size: size + (state.rng() > 0.6 ? 1 : 0),
      life: 16 + Math.floor(state.rng() * 18),
      maxLife: 34,
      gravity,
    });
  }
}

function addPopup(state, x, y, text, color = '#fde047') {
  state.popups.push({
    x,
    y,
    vy: -0.55,
    text,
    color,
    life: 45,
    maxLife: 45,
  });
}

function resetForNextRound(state) {
  const [f1, f2] = state.fighters;
  const p1Score = f1.score;
  const p2Score = f2.score;
  const p1Rounds = f1.roundsWon;
  const p2Rounds = f2.roundsWon;

  const nf1 = createFighter(0, f1.charId, 108, 1);
  const nf2 = createFighter(1, f2.charId, 276, -1);
  nf1.score = p1Score;
  nf2.score = p2Score;
  nf1.roundsWon = p1Rounds;
  nf2.roundsWon = p2Rounds;
  nf1.meter = Math.max(35, Math.floor(f1.meter * 0.6));
  nf2.meter = Math.max(35, Math.floor(f2.meter * 0.6));

  state.fighters = [nf1, nf2];
  state.projectiles = [];
  state.powerups = [];
  state.particles = [];
  state.hitSparks = [];
  state.popups = [];
  state.timer = ARENA.ROUND_SECONDS;
  state.timerFrames = 0;
  state.phase = 'ready';
  state.phaseTimer = 90;
  state.roundWinnerSlot = null;
  state.powerupSpawnTimer = 380;
  state.banner = {
    text: `ROUND ${state.round}`,
    subtext: 'THAYYAAR AANO?',
    timer: 90,
    color: '#fde047',
  };
  emitEvent(state, 'roundStart', { round: state.round });
}

function justPressed(input, prev, key) {
  return Boolean(input[key]) && !Boolean(prev[key]);
}

function getFighterHitbox(f) {
  const height = f.state === 'crouch' || f.state === 'knockdown' ? 34 : 58;
  return {
    x: f.x - 13,
    y: f.y - height,
    w: 26,
    h: height,
  };
}

function getAttackBox(f) {
  if (!f.currentMove) return null;
  const m = f.currentMove;
  const range = m.range || 28;
  const yOff = m.yOff ?? -32;
  const height = m.height || 16;
  const xStart = f.facing === 1 ? f.x + 2 : f.x - 2 - range;
  return {
    x: xStart,
    y: f.y + yOff,
    w: range,
    h: height,
  };
}

function boxesOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function isBlockingAgainst(defender, attackerX, isLow = false) {
  const grounded = defender.y >= ARENA.FLOOR_Y - 1;
  if (!grounded) return false;
  if (
    defender.state !== 'idle' &&
    defender.state !== 'walk' &&
    defender.state !== 'crouch' &&
    defender.state !== 'blockstun'
  ) {
    return false;
  }
  const input = defender.prevInput || {};
  if (input.block) return true;
  const holdingBack =
    (defender.facing === 1 && input.left) ||
    (defender.facing === -1 && input.right);
  if (!holdingBack) return false;
  if (isLow && !input.down) return false;
  return true;
}

function updateMotionHistory(f, input) {
  const dir =
    (input.down ? 'D' : input.up ? 'U' : '') +
    (f.facing === 1
      ? input.right ? 'F' : input.left ? 'B' : ''
      : input.left ? 'F' : input.right ? 'B' : '');
  const last = f.motionHistory[f.motionHistory.length - 1];
  if (!last || last.dir !== dir) {
    f.motionHistory.push({ dir, age: 0 });
    if (f.motionHistory.length > 6) f.motionHistory.shift();
  }
  for (const item of f.motionHistory) item.age += 1;
  f.motionHistory = f.motionHistory.filter((m) => m.age < 18);
}

function hasQuarterCircleForward(f) {
  const dirs = f.motionHistory.map((m) => m.dir);
  const dIdx = dirs.lastIndexOf('D');
  const dfIdx = dirs.lastIndexOf('DF');
  const fIdx = dirs.lastIndexOf('F');
  return dIdx !== -1 && fIdx > dIdx && (dfIdx === -1 || dfIdx >= dIdx);
}

function triggerMove(state, f, moveKey, moveSpec, newState) {
  f.state = newState;
  f.stateTimer = 0;
  f.moveKey = moveKey;
  f.currentMove = moveSpec;
  f.moveHitConnected = false;

  if (moveKey === 'special') {
    f.specialCooldown = 48;
    f.vx = f.facing * (moveSpec.vx || 2.5);
    if (moveSpec.vy) f.vy = moveSpec.vy;
    f.munduFolded = true;
    const shout = moveSpec.shout || pickRandom(f.def.dialogues.specialShout, state.rng);
    setSpeech(f, shout, 95, 'super');
    emitEvent(state, 'voiceLine', { charId: f.charId, text: shout, priority: 'normal' });
    emitEvent(state, 'special', { charId: f.charId, slot: f.slot });
  } else if (moveKey === 'projectile') {
    f.projectileCooldown = 42;
    f.vx = 0;
    const shout = moveSpec.shout || pickRandom(f.def.dialogues.specialShout, state.rng);
    setSpeech(f, shout, 85, 'normal');
    emitEvent(state, 'voiceLine', { charId: f.charId, text: shout, priority: 'normal' });
    emitEvent(state, 'projectile', { charId: f.charId, slot: f.slot });
  } else if (moveKey === 'superMove') {
    f.meter = 0;
    f.invulnFrames = 42;
    f.munduFolded = true;
    state.phase = 'superFreeze';
    state.superFreezeTimer = 34;
    state.superFreezeActor = f.slot;
    state.shake = 6;
    state.crowdExcitement = 100;
    setSpeech(f, moveSpec.shout, 145, 'super');
    emitEvent(state, 'voiceLine', { charId: f.charId, text: moveSpec.shout, priority: 'high' });
    state.banner = {
      text: moveSpec.name,
      subtext: f.def.name + ' MASS OVERDRIVE!',
      timer: 75,
      color: f.def.palette.accentBright,
    };
    emitEvent(state, 'superActivate', { charId: f.charId, slot: f.slot });
  } else {
    emitEvent(state, 'swing', { heavy: moveKey === 'heavyKick', slot: f.slot });
  }
}

function applyDamage(state, attacker, defender, {
  damage,
  knockback = 2.6,
  knockdown = false,
  isLow = false,
  isSpecial = false,
  hitstop = 4,
  hitX,
  hitY,
}) {
  if (defender.invulnFrames > 0 || defender.state === 'ko') return;

  const blocked = isBlockingAgainst(defender, attacker.x, isLow);
  const dmgMult = attacker.buffs.damageMult || 1;
  const shieldMult = defender.buffs.shieldMult || 1;

  if (blocked) {
    const chip = isSpecial ? Math.max(1, Math.round(damage * 0.22 * dmgMult)) : 0;
    defender.hp = Math.max(1, defender.hp - chip);
    defender.state = 'blockstun';
    defender.stateTimer = isSpecial ? 14 : 9;
    defender.vx = attacker.facing * (knockback * 0.55);
    defender.meter = clamp(defender.meter + 6, 0, 100);
    attacker.meter = clamp(attacker.meter + 4, 0, 100);
    state.hitstop = Math.max(2, Math.floor(hitstop * 0.6));
    state.hitSparks.push({ x: hitX, y: hitY, radius: 13, color: '#60a5fa', core: '#ffffff', life: 10, maxLife: 10 });
    spawnParticles(state, hitX, hitY, '#60a5fa', 6, 2.0, 0.04, 2);
    addPopup(state, hitX, hitY - 8, 'BLOCK!', '#93c5fd');
    emitEvent(state, 'block', { slot: defender.slot });
    return;
  }

  const finalDmg = Math.max(1, Math.round(damage * dmgMult * shieldMult));
  defender.hp = Math.max(0, defender.hp - finalDmg);
  defender.comboCount += 1;
  defender.comboBannerTimer = 75;
  attacker.score += finalDmg * 100 * Math.max(1, defender.comboCount);
  attacker.meter = clamp(attacker.meter + (isSpecial ? 10 : 9), 0, 100);
  defender.meter = clamp(defender.meter + 7, 0, 100);

  state.hitstop = hitstop;
  state.shake = Math.min(9, Math.max(state.shake, Math.ceil(finalDmg / 4)));
  state.crowdExcitement = Math.min(100, state.crowdExcitement + finalDmg * 2);

  state.hitSparks.push({
    x: hitX,
    y: hitY,
    radius: finalDmg >= 14 ? 22 : 15,
    color: finalDmg >= 14 ? '#f97316' : '#fde047',
    core: '#ffffff',
    life: 12,
    maxLife: 12,
  });
  spawnParticles(state, hitX, hitY, '#fde047', 8 + Math.floor(finalDmg / 3), 3.0, 0.09, 2);
  spawnParticles(state, hitX, hitY, '#ef4444', 5, 2.2, 0.08, 2);

  if (defender.comboCount >= 2) {
    addPopup(state, defender.x, defender.y - 54, `${defender.comboCount} HIT COMBO!`, '#fb923c');
    triggerAudienceCheer(state);
  } else if (finalDmg >= 14) {
    addPopup(state, hitX, hitY - 12, 'ADI SAKE!', '#fde047');
    triggerAudienceCheer(state);
  }

  // Low HP desperation Mallu line!
  if (!defender.lowHpWarned && defender.hp > 0 && defender.hp <= defender.maxHp * 0.3) {
    defender.lowHpWarned = true;
    const lowLine = pickRandom(defender.def.dialogues.lowHp, state.rng);
    setSpeech(defender, lowLine, 120, 'normal');
    emitEvent(state, 'voiceLine', { charId: defender.charId, text: lowLine, priority: 'normal' });
  }

  if (defender.hp <= 0) {
    defender.state = 'ko';
    defender.stateTimer = 0;
    defender.vx = attacker.facing * 4.2;
    defender.vy = -4.2;
    state.hitstop = 14;
    state.shake = 10;
    emitEvent(state, 'ko', { winner: attacker.slot, loser: defender.slot });
  } else if (knockdown) {
    defender.state = 'knockdown';
    defender.stateTimer = 0;
    defender.vx = attacker.facing * knockback;
    defender.vy = -2.8;
    defender.invulnFrames = 26;
    emitEvent(state, 'hitHeavy', { damage: finalDmg });
  } else {
    defender.state = 'hitstun';
    defender.stateTimer = Math.min(20, 10 + Math.floor(finalDmg * 0.5));
    defender.vx = attacker.facing * knockback;
    emitEvent(state, finalDmg >= 11 ? 'hitHeavy' : 'hitLight', { damage: finalDmg });
  }
}

function handleFighterInput(state, f, opp, input) {
  updateMotionHistory(f, input);

  const canAct = f.state === 'idle' || f.state === 'walk' || f.state === 'crouch';
  const isAir = f.y < ARENA.FLOOR_Y - 1 || f.state === 'jump';

  // Super Move (100% Mass Meter!)
  if (
    canAct &&
    f.meter >= 100 &&
    (justPressed(input, f.prevInput, 'super') ||
      (justPressed(input, f.prevInput, 'special') && input.heavy))
  ) {
    triggerMove(state, f, 'superMove', f.def.moves.superMove, 'super');
    return;
  }

  // Air Attack
  if (isAir && f.state === 'jump' && (justPressed(input, f.prevInput, 'light') || justPressed(input, f.prevInput, 'heavy'))) {
    triggerMove(state, f, 'airAttack', f.def.moves.airAttack, 'attack');
    return;
  }

  if (!canAct) return;

  // Dedicated Mortal Kombat-style Block key holds stance & guards high/low
  if (input.block) {
    f.state = input.down ? 'crouch' : 'idle';
    f.vx = 0;
    if (opp.x !== f.x) f.facing = opp.x > f.x ? 1 : -1;
    return;
  }

  // Classic quarter-circle forward motion or Special button!
  const qcfAttack = hasQuarterCircleForward(f) && (justPressed(input, f.prevInput, 'light') || justPressed(input, f.prevInput, 'heavy'));

  if (justPressed(input, f.prevInput, 'special') || qcfAttack) {
    if ((input.up || input.down) && f.specialCooldown <= 0 && !qcfAttack) {
      triggerMove(state, f, 'special', f.def.moves.special, 'special');
      return;
    }
    if (f.projectileCooldown <= 0) {
      triggerMove(state, f, 'projectile', f.def.moves.projectile, 'projectile');
      return;
    }
    if (f.specialCooldown <= 0) {
      triggerMove(state, f, 'special', f.def.moves.special, 'special');
      return;
    }
  }

  // Crouch + Attack = Sweep
  if (input.down && (justPressed(input, f.prevInput, 'light') || justPressed(input, f.prevInput, 'heavy'))) {
    triggerMove(state, f, 'crouchAttack', f.def.moves.crouchAttack, 'attack');
    return;
  }

  // Standing Attacks
  if (justPressed(input, f.prevInput, 'light')) {
    triggerMove(state, f, 'lightPunch', f.def.moves.lightPunch, 'attack');
    return;
  }
  if (justPressed(input, f.prevInput, 'heavy')) {
    triggerMove(state, f, 'heavyKick', f.def.moves.heavyKick, 'attack');
    return;
  }

  // Jump
  if (input.up) {
    f.state = 'jump';
    f.stateTimer = 0;
    f.vy = f.def.jumpVel * (f.buffs.speedMult > 1 ? 1.07 : 1);
    const spd = f.def.walkSpeed * f.buffs.speedMult;
    f.vx = input.left ? -spd : input.right ? spd : 0;
    spawnParticles(state, f.x, ARENA.FLOOR_Y, '#d6d3d1', 4, 1.3, 0.04, 2);
    return;
  }

  // Crouch
  if (input.down) {
    f.state = 'crouch';
    f.vx = 0;
    return;
  }

  // Walk
  const speed = f.def.walkSpeed * f.buffs.speedMult;
  if (input.left && !input.right) {
    f.state = 'walk';
    f.vx = -speed;
  } else if (input.right && !input.left) {
    f.state = 'walk';
    f.vx = speed;
  } else {
    f.state = 'idle';
    f.vx = 0;
  }

  // Auto face opponent when idle/walking/crouching
  if (opp.x !== f.x) {
    f.facing = opp.x > f.x ? 1 : -1;
  }
}

function updateFighterState(state, f, opp) {
  f.animTick += 1;
  f.stateTimer += 1;
  if (f.projectileCooldown > 0) f.projectileCooldown -= 1;
  if (f.specialCooldown > 0) f.specialCooldown -= 1;
  if (f.invulnFrames > 0) f.invulnFrames -= 1;
  if (f.comboBannerTimer > 0) {
    f.comboBannerTimer -= 1;
    if (f.comboBannerTimer === 0) f.comboCount = 0;
  }

  // Trail HP catchup
  if (f.trailHp > f.hp) {
    f.trailHp = Math.max(f.hp, f.trailHp - 0.5);
  } else {
    f.trailHp = f.hp;
  }

  // Afterimage trail for specials & supers
  if ((f.state === 'special' || f.state === 'super') && f.animTick % 2 === 0) {
    f.trail.push({ x: f.x, y: f.y, facing: f.facing, state: f.state, moveKey: f.moveKey, life: 10 });
    if (f.trail.length > 4) f.trail.shift();
  }
  for (let i = f.trail.length - 1; i >= 0; i--) {
    f.trail[i].life -= 1;
    if (f.trail[i].life <= 0) f.trail.splice(i, 1);
  }

  // Buff timers
  if (f.buffs.damageTimer > 0) {
    f.buffs.damageTimer -= 1;
    if (f.buffs.damageTimer === 0) f.buffs.damageMult = 1;
  }
  if (f.buffs.speedTimer > 0) {
    f.buffs.speedTimer -= 1;
    if (f.buffs.speedTimer === 0) f.buffs.speedMult = 1;
  }
  if (f.buffs.shieldTimer > 0) {
    f.buffs.shieldTimer -= 1;
    if (f.buffs.shieldTimer === 0) f.buffs.shieldMult = 1;
  }
  if (f.buffs.damageTimer === 0 && f.buffs.speedTimer === 0 && f.buffs.shieldTimer === 0) {
    f.buffs.auraColor = null;
  }

  // Speech bubble timer
  if (f.speech) {
    f.speech.timer -= 1;
    if (f.speech.timer <= 0) f.speech = null;
  }

  // State machine transitions
  if (f.state === 'attack') {
    const m = f.currentMove;
    const total = m.startup + m.active + m.recovery;
    if (f.y >= ARENA.FLOOR_Y && f.moveKey !== 'airAttack') {
      f.vx *= 0.72;
    }
    if (!f.moveHitConnected && f.stateTimer >= m.startup && f.stateTimer < m.startup + m.active) {
      const atkBox = getAttackBox(f);
      const defBox = getFighterHitbox(opp);
      if (atkBox && boxesOverlap(atkBox, defBox)) {
        f.moveHitConnected = true;
        applyDamage(state, f, opp, {
          damage: m.damage,
          knockback: m.knockback || 2.2,
          knockdown: Boolean(m.knockdown),
          isLow: f.moveKey === 'crouchAttack',
          isSpecial: false,
          hitstop: m.hitstop || 4,
          hitX: (atkBox.x + atkBox.w / 2 + opp.x) / 2,
          hitY: atkBox.y + atkBox.h / 2,
        });
      }
    }
    if (f.stateTimer >= total) {
      f.currentMove = null;
      f.moveKey = null;
      f.state = f.y < ARENA.FLOOR_Y ? 'jump' : 'idle';
      f.stateTimer = 0;
    }
  } else if (f.state === 'projectile') {
    const m = f.currentMove;
    if (f.stateTimer === m.startup) {
      state.projectiles.push({
        ownerSlot: f.slot,
        charId: f.charId,
        style: m.style,
        x: f.x + f.facing * 24,
        y: f.y - 40,
        vx: f.facing * m.speed,
        radius: m.radius,
        damage: m.damage * (f.buffs.damageMult || 1),
        color: m.color,
        coreColor: m.coreColor,
        spin: 0,
        life: 140,
      });
      spawnParticles(state, f.x + f.facing * 20, f.y - 30, m.coreColor, 6, 2.0, 0.02, 2);
    }
    if (f.stateTimer >= m.startup + m.recovery) {
      f.currentMove = null;
      f.moveKey = null;
      f.state = 'idle';
      f.stateTimer = 0;
    }
  } else if (f.state === 'special') {
    const m = f.currentMove;
    const total = m.startup + m.active + m.recovery;
    if (f.stateTimer === m.startup) {
      spawnParticles(state, f.x, f.y - 24, f.def.palette.accentBright, 10, 2.8, 0.05, 2);
    }
    if (!f.moveHitConnected && f.stateTimer >= m.startup && f.stateTimer < m.startup + m.active) {
      const atkBox = getAttackBox(f);
      const defBox = getFighterHitbox(opp);
      if (atkBox && boxesOverlap(atkBox, defBox)) {
        f.moveHitConnected = true;
        applyDamage(state, f, opp, {
          damage: m.damage,
          knockback: m.knockback || 4.2,
          knockdown: true,
          isSpecial: true,
          hitstop: m.hitstop || 7,
          hitX: (f.x + opp.x) / 2,
          hitY: opp.y - 28,
        });
      }
    }
    if (f.stateTimer >= total) {
      f.currentMove = null;
      f.moveKey = null;
      f.munduFolded = false;
      f.state = f.y < ARENA.FLOOR_Y ? 'jump' : 'idle';
      f.stateTimer = 0;
    }
  } else if (f.state === 'super') {
    const m = f.currentMove;
    // Dash aggressively & unleash signature Kerala finisher!
    if (f.stateTimer < 16) {
      f.vx = f.facing * 4.4;
      if (f.stateTimer % 3 === 0) {
        spawnParticles(state, f.x, f.y - 24, f.def.palette.accentBright, 4, 2.0, 0.02, 2);
      }
    } else {
      f.vx *= 0.8;
    }
    if (!f.moveHitConnected && f.stateTimer >= 6 && f.stateTimer <= 24) {
      const dist = Math.abs(f.x - opp.x);
      if (dist <= m.range && Math.abs(f.y - opp.y) < 48) {
        f.moveHitConnected = true;
        spawnParticles(state, opp.x, opp.y - 26, f.def.palette.accentBright, 20, 4.2, 0.08, 3);
        spawnParticles(state, opp.x, opp.y - 26, f.def.palette.secondary, 14, 3.5, 0.06, 2);
        applyDamage(state, f, opp, {
          damage: m.damage,
          knockback: 5.5,
          knockdown: true,
          isSpecial: true,
          hitstop: m.hitstop || 12,
          hitX: opp.x,
          hitY: opp.y - 28,
        });
      }
    }
    if (f.stateTimer >= 36) {
      f.currentMove = null;
      f.moveKey = null;
      f.munduFolded = false;
      f.state = 'idle';
      f.stateTimer = 0;
    }
  } else if (f.state === 'hitstun' || f.state === 'blockstun') {
    f.vx *= 0.82;
    if (f.stateTimer >= 16) {
      f.state = 'idle';
      f.stateTimer = 0;
    }
  } else if (f.state === 'knockdown') {
    f.vx *= 0.88;
    if (f.y >= ARENA.FLOOR_Y && f.stateTimer >= 36) {
      f.state = 'idle';
      f.stateTimer = 0;
      f.comboCount = 0;
      f.invulnFrames = 18;
    }
  } else if (f.state === 'ko') {
    f.vx *= 0.9;
  }

  // Physics integration
  f.x += f.vx;
  f.y += f.vy;
  if (f.y < ARENA.FLOOR_Y) {
    f.vy += f.def.gravity;
  }
  if (f.y >= ARENA.FLOOR_Y) {
    if (f.vy > 1.5 && f.state === 'jump') {
      spawnParticles(state, f.x, ARENA.FLOOR_Y, '#d6d3d1', 4, 1.4, 0.05, 2);
    }
    f.y = ARENA.FLOOR_Y;
    f.vy = 0;
    if (f.state === 'jump') {
      f.state = 'idle';
      f.stateTimer = 0;
    }
  }

  f.x = clamp(f.x, ARENA.LEFT_WALL, ARENA.RIGHT_WALL);
}

function pushApartFighters(f1, f2) {
  if (f1.state === 'ko' || f2.state === 'ko') return;
  const minSep = 20;
  const dx = f2.x - f1.x;
  const dy = Math.abs(f2.y - f1.y);
  if (dy < 34 && Math.abs(dx) < minSep) {
    const overlap = (minSep - Math.abs(dx)) / 2;
    const sign = dx >= 0 ? 1 : -1;
    f1.x = clamp(f1.x - sign * overlap, ARENA.LEFT_WALL, ARENA.RIGHT_WALL);
    f2.x = clamp(f2.x + sign * overlap, ARENA.LEFT_WALL, ARENA.RIGHT_WALL);
  }
}

function updateProjectiles(state) {
  const [f1, f2] = state.fighters;
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.x += p.vx;
    p.spin += 0.3;
    p.life -= 1;

    if (p.life % 3 === 0) {
      spawnParticles(state, p.x, p.y, p.color, 1, 0.7, 0.01, 2);
    }

    // Projectile clash check
    let destroyed = false;
    for (let j = i - 1; j >= 0; j--) {
      const other = state.projectiles[j];
      if (other.ownerSlot !== p.ownerSlot && Math.hypot(p.x - other.x, p.y - other.y) < p.radius + other.radius) {
        spawnParticles(state, (p.x + other.x) / 2, p.y, '#fde047', 10, 2.5, 0.04, 2);
        addPopup(state, p.x, p.y - 10, 'CLASH!', '#fde047');
        state.projectiles.splice(i, 1);
        state.projectiles.splice(j, 1);
        i--;
        destroyed = true;
        break;
      }
    }
    if (destroyed) continue;

    // Hit check against opponent
    const target = p.ownerSlot === 0 ? f2 : f1;
    const attacker = p.ownerSlot === 0 ? f1 : f2;
    const targetBox = getFighterHitbox(target);
    const pBox = { x: p.x - p.radius, y: p.y - p.radius, w: p.radius * 2, h: p.radius * 2 };

    if (boxesOverlap(pBox, targetBox)) {
      applyDamage(state, attacker, target, {
        damage: p.damage,
        knockback: 2.9,
        isSpecial: true,
        hitstop: 5,
        hitX: p.x,
        hitY: p.y,
      });
      state.projectiles.splice(i, 1);
      continue;
    }

    if (p.x < -20 || p.x > ARENA.WIDTH + 20 || p.life <= 0) {
      state.projectiles.splice(i, 1);
    }
  }
}

function updatePowerups(state) {
  if (!state.powerupsEnabled) return;

  state.powerupSpawnTimer -= 1;
  if (state.powerupSpawnTimer <= 0 && state.powerups.length < 2) {
    const spec = pickRandom(POWERUP_TYPES, state.rng);
    const spawnX = 95 + state.rng() * 194;
    state.powerups.push({
      spec,
      x: spawnX,
      y: 26,
      vy: 0.9,
      bob: 0,
      life: 520,
    });
    state.powerupSpawnTimer = 600 + Math.floor(state.rng() * 260);
    emitEvent(state, 'powerupSpawn', { id: spec.id });
  }

  for (let i = state.powerups.length - 1; i >= 0; i--) {
    const pu = state.powerups[i];
    pu.bob += 0.14;
    pu.life -= 1;
    if (pu.y < ARENA.FLOOR_Y - 12) {
      pu.y = Math.min(ARENA.FLOOR_Y - 12, pu.y + pu.vy);
      pu.vy = Math.min(2.4, pu.vy + 0.06);
    }

    let pickedBy = null;
    for (const f of state.fighters) {
      if (f.state === 'ko') continue;
      if (Math.abs(f.x - pu.x) < 20 && Math.abs(f.y - 16 - pu.y) < 26) {
        pickedBy = f;
        break;
      }
    }

    if (pickedBy) {
      const s = pu.spec;
      if (s.healAmount) {
        pickedBy.hp = Math.min(pickedBy.maxHp, pickedBy.hp + s.healAmount);
      }
      if (s.meterGain) {
        pickedBy.meter = clamp(pickedBy.meter + s.meterGain, 0, 100);
      }
      if (s.damageMult) {
        pickedBy.buffs.damageMult = s.damageMult;
        pickedBy.buffs.damageTimer = s.durationFrames;
        pickedBy.buffs.auraColor = s.glow;
      }
      if (s.speedMult) {
        pickedBy.buffs.speedMult = s.speedMult;
        pickedBy.buffs.speedTimer = s.durationFrames;
        pickedBy.buffs.auraColor = s.glow;
      }
      if (s.damageTakenMult) {
        pickedBy.buffs.shieldMult = s.damageTakenMult;
        pickedBy.buffs.shieldTimer = s.durationFrames;
        pickedBy.buffs.auraColor = s.glow;
      }
      if (s.effect === 'mass') {
        pickedBy.buffs.auraColor = s.glow;
      }

      pickedBy.score += 500;
      const line = pickRandom(s.dialogues, state.rng);
      setSpeech(pickedBy, line, 155, 'powerup');
      emitEvent(state, 'voiceLine', { charId: pickedBy.charId, text: line, priority: 'high' });
      state.powerupBanner = {
        title: `${pickedBy.def.name}: ${s.name}!`,
        dialogue: line,
        color: s.glow,
        timer: 150,
        slot: pickedBy.slot,
      };
      spawnParticles(state, pu.x, pu.y, s.glow, 16, 2.8, 0.04, 2);
      addPopup(state, pu.x, pu.y - 14, `${s.name}!`, s.glow);
      state.crowdExcitement = Math.min(100, state.crowdExcitement + 30);
      triggerAudienceCheer(state);
      emitEvent(state, 'powerupPickup', { id: s.id, slot: pickedBy.slot });
      state.powerups.splice(i, 1);
      continue;
    }

    if (pu.life <= 0) {
      state.powerups.splice(i, 1);
    }
  }
}

function updateParticlesAndPopups(state) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += pt.gravity;
    pt.life -= 1;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.hitSparks.length - 1; i >= 0; i--) {
    state.hitSparks[i].life -= 1;
    if (state.hitSparks[i].life <= 0) state.hitSparks.splice(i, 1);
  }
  for (let i = state.popups.length - 1; i >= 0; i--) {
    const pp = state.popups[i];
    pp.y += pp.vy;
    pp.life -= 1;
    if (pp.life <= 0) state.popups.splice(i, 1);
  }
  if (state.banner) {
    state.banner.timer -= 1;
    if (state.banner.timer <= 0) state.banner = null;
  }
  if (state.powerupBanner) {
    state.powerupBanner.timer -= 1;
    if (state.powerupBanner.timer <= 0) state.powerupBanner = null;
  }
  if (state.audienceCooldown > 0) state.audienceCooldown -= 1;
  if (state.audienceBubble) {
    state.audienceBubble.timer -= 1;
    if (state.audienceBubble.timer <= 0) state.audienceBubble = null;
  }
}

function concludeRound(state, winnerSlot, reason = 'K.O.!') {
  const [f1, f2] = state.fighters;
  state.phase = 'roundOver';
  state.phaseTimer = 145;
  state.roundWinnerSlot = winnerSlot;

  if (winnerSlot !== null) {
    const winner = state.fighters[winnerSlot];
    const loser = state.fighters[1 - winnerSlot];
    winner.roundsWon += 1;
    winner.state = 'victory';
    winner.vx = 0;
    winner.score += 1500;
    if (loser.hp > 0 && reason === 'TIME OVER') {
      loser.state = 'hitstun';
      loser.vx = 0;
    }
    const winLine = pickRandom(winner.def.dialogues.win, state.rng);
    setSpeech(winner, winLine, 160, 'super');
    emitEvent(state, 'voiceLine', { charId: winner.charId, text: winLine, priority: 'high' });
    state.banner = {
      text: reason,
      subtext: `${winner.def.name} WINS!`,
      timer: 145,
      color: '#fde047',
    };

    if (winner.roundsWon >= ARENA.ROUNDS_TO_WIN) {
      state.matchWinnerSlot = winnerSlot;
    }
  } else {
    state.banner = {
      text: 'DRAW GAME!',
      subtext: 'DOUBLE PUNCH!',
      timer: 130,
      color: '#f8fafc',
    };
  }
  state.crowdExcitement = 100;
}

/**
 * Advances simulation by one 60Hz tick.
 */
export function stepMatch(state, inputs = [{}, {}]) {
  state.events = [];

  if (state.shake > 0) state.shake = Math.max(0, state.shake - 0.5);
  if (state.crowdExcitement > 0) state.crowdExcitement = Math.max(0, state.crowdExcitement - 0.35);

  updateParticlesAndPopups(state);

  // Hitstop freezes fighter movement briefly for crunchy SF2 impact
  if (state.hitstop > 0) {
    state.hitstop -= 1;
    return state;
  }

  const [f1, f2] = state.fighters;

  // Phase: Intro Super Entries!
  if (state.phase === 'intro') {
    state.phaseTimer -= 1;
    const elapsed = 220 - state.phaseTimer;

    // P1 Super Entry (frames 0..95)
    if (elapsed === 4) {
      setSpeech(f1, f1.def.superEntry.shout, 110, 'super');
      emitEvent(state, 'voiceLine', { charId: f1.charId, text: f1.def.superEntry.shout, priority: 'high' });
      emitEvent(state, 'superEntry', { charId: f1.charId, slot: 0 });
    }
    if (elapsed === 96) {
      f1.state = 'idle';
      setSpeech(f2, f2.def.superEntry.shout, 110, 'super');
      emitEvent(state, 'voiceLine', { charId: f2.charId, text: f2.def.superEntry.shout, priority: 'high' });
      emitEvent(state, 'superEntry', { charId: f2.charId, slot: 1 });
    }
    if (elapsed === 170) {
      f2.state = 'idle';
      state.banner = {
        text: 'ROUND 1',
        subtext: 'READY... FIGHT!',
        timer: 50,
        color: '#fde047',
      };
      emitEvent(state, 'roundStart', { round: 1 });
    }

    // Allow skipping intro with attack button
    if (
      elapsed > 25 &&
      (justPressed(inputs[0], f1.prevInput, 'light') ||
        justPressed(inputs[0], f1.prevInput, 'heavy') ||
        justPressed(inputs[1], f2.prevInput, 'light'))
    ) {
      f1.state = 'idle';
      f2.state = 'idle';
      state.phase = 'fight';
      state.phaseTimer = 0;
      state.banner = { text: 'FIGHT!', subtext: 'ADI THUDANGU!', timer: 45, color: '#fde047' };
      emitEvent(state, 'fightStart', {});
    }

    // Tick speech bubbles during intro
    for (const f of state.fighters) {
      f.animTick += 1;
      if (f.speech) {
        f.speech.timer -= 1;
        if (f.speech.timer <= 0) f.speech = null;
      }
    }

    if (state.phaseTimer <= 0) {
      f1.state = 'idle';
      f2.state = 'idle';
      state.phase = 'fight';
      state.banner = { text: 'FIGHT!', subtext: 'ADI THUDANGU!', timer: 50, color: '#fde047' };
      emitEvent(state, 'fightStart', {});
    }
    f1.prevInput = { ...inputs[0] };
    f2.prevInput = { ...inputs[1] };
    return state;
  }

  if (state.phase === 'ready') {
    state.phaseTimer -= 1;
    f1.animTick += 1;
    f2.animTick += 1;
    if (state.phaseTimer <= 0) {
      state.phase = 'fight';
      state.banner = { text: 'FIGHT!', subtext: 'KALI THODANGI!', timer: 45, color: '#fde047' };
      emitEvent(state, 'fightStart', {});
    }
    return state;
  }

  if (state.phase === 'superFreeze') {
    state.superFreezeTimer -= 1;
    if (state.superFreezeTimer <= 0) {
      state.phase = 'fight';
      state.superFreezeActor = null;
    }
    return state;
  }

  if (state.phase === 'roundOver') {
    state.phaseTimer -= 1;
    updateFighterState(state, f1, f2);
    updateFighterState(state, f2, f1);
    if (state.phaseTimer <= 0) {
      if (state.matchWinnerSlot !== null) {
        state.phase = 'matchOver';
        emitEvent(state, 'matchOver', { winner: state.matchWinnerSlot });
      } else {
        state.round += 1;
        resetForNextRound(state);
      }
    }
    return state;
  }

  if (state.phase === 'matchOver') {
    f1.animTick += 1;
    f2.animTick += 1;
    return state;
  }

  // Active Fight Phase
  handleFighterInput(state, f1, f2, inputs[0] || {});
  handleFighterInput(state, f2, f1, inputs[1] || {});

  updateFighterState(state, f1, f2);
  updateFighterState(state, f2, f1);
  pushApartFighters(f1, f2);

  updateProjectiles(state);
  updatePowerups(state);

  f1.prevInput = { ...(inputs[0] || {}) };
  f2.prevInput = { ...(inputs[1] || {}) };

  // Timer countdown
  state.timerFrames += 1;
  if (state.timerFrames >= 60) {
    state.timerFrames = 0;
    if (state.timer > 0) state.timer -= 1;
  }

  // Check KO or Timeout
  if (f1.hp <= 0 && f2.hp <= 0) {
    concludeRound(state, null, 'DOUBLE K.O.!');
  } else if (f2.hp <= 0) {
    concludeRound(state, 0, 'K.O.!');
  } else if (f1.hp <= 0) {
    concludeRound(state, 1, 'K.O.!');
  } else if (state.timer <= 0) {
    const p1Pct = f1.hp / f1.maxHp;
    const p2Pct = f2.hp / f2.maxHp;
    const winner = p1Pct === p2Pct ? null : p1Pct > p2Pct ? 0 : 1;
    concludeRound(state, winner, 'TIME OVER!');
  }

  return state;
}
