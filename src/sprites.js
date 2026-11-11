/**
 * SF2-Clarity 16-bit Fighter, Auto-Outline, Pixel-Capsule Anatomy,
 * Hand-Pixeled Head Matrices, Afterimage Trails, Super Entries & Projectiles.
 */

import { ARENA } from './engine.js';
import { getCharacterById } from './characters.js';
import { px, drawPixelMatrix, drawPixelHalo, drawPixelCapsule, drawEllipseShadow } from './pixel.js';
import { getSpritePose, getPortraitImage } from './assets.js';

let spriteBuf = null;
let spriteCtx = null;
let outlineBuf = null;
let outlineCtx = null;

const BUF_W = 140;
const BUF_H = 114;
const ANCHOR_X = 70;
const ANCHOR_Y = 102;

function ensureBuffers() {
  if (typeof document === 'undefined') return false;
  if (!spriteBuf) {
    spriteBuf = document.createElement('canvas');
    spriteBuf.width = BUF_W;
    spriteBuf.height = BUF_H;
    spriteCtx = spriteBuf.getContext('2d');
    spriteCtx.imageSmoothingEnabled = false;

    outlineBuf = document.createElement('canvas');
    outlineBuf.width = BUF_W;
    outlineBuf.height = BUF_H;
    outlineCtx = outlineBuf.getContext('2d');
    outlineCtx.imageSmoothingEnabled = false;
  }
  return true;
}

const HEAD_MATRICES = {
  maveli: {
    ox: -10,
    oy: -24,
    rows: [
      '.......GGGG.......',
      '......GYYYYG......',
      '.....GYYRRYYG.....',
      '....GGGGGGGGGG....',
      '...GYYBGGGGYYYG...',
      '..GGGGGYYYYGGGGG..',
      '...SSSSSSSSSSSS...',
      '..DSSSHSSSSSSSSD..',
      '..DSSSHSSSSBBBSD..',
      '..DSSSSSSSBWWWSD..',
      '..DSSSSSSSDSSSSD..',
      '..DSSSSMMSSMMMMD..',
      '...SSMMMMMMMMMM...',
      '...DSSSMMMMMSSD...',
      '....DSSSSSSSS.....',
    ],
  },
  george: {
    ox: -8,
    oy: -17,
    rows: [
      '..HHHHHHHHHHH...',
      '.HHHHHHHHHHHHH..',
      '.HHSHSSSSSSSSS..',
      '.HHSSGGGGGGGGGG.',
      '.HSSSGWWGGGGGGG.',
      '..SSSHSSSSSSSS..',
      '..DSSSMMMMMMM...',
      '..DSSMMMMMMMMM..',
      '...SSSMMSSSM....',
      '....SSSSSSSS....',
    ],
  },
  unniyarcha: {
    ox: -11,
    oy: -18,
    rows: [
      '....HHHHHHHHH...',
      '..WWWHHHHHHHHH..',
      '.WWWWWHHHHHHHH..',
      '.WWYYHHHHHHHHH..',
      '.HHHHSSSRSSSSS..',
      '.HHHSSSHSSBBBS..',
      '.HHHSSSSSSSWWS..',
      '.HHHSSSSSSSSSS..',
      '.HHHSSSSSSSS....',
      '..HH.SSSSSSS....',
      '..HH............',
    ],
  },
  theyyam: {
    ox: -13,
    oy: -31,
    rows: [
      '.........GGGG.........',
      '........GYYYYG........',
      '......GGRRRRRRGG......',
      '.....GRRYYYYYYRRG.....',
      '....GRRYBBYYBBYRRG....',
      '...GRRRYYYYYYYYRRRG...',
      '..GRRRRRRRRRRRRRRRRG..',
      '..GGGGGGGGGGGGGGGGGG..',
      '....RRRRYYYYYYRRRR....',
      '....RRRYRYYYYRYRRR....',
      '....RRRRYWWWWYRRRR....',
      '....RRRRRRRRRRRRRR....',
      '.....RRRMMMMMMRRR.....',
      '......RRMMMMMMRR......',
      '.......RRRRRRRR.......',
    ],
  },
  kuttan: {
    ox: -8,
    oy: -17,
    rows: [
      '..HHHHHHHHHHH...',
      '.HHHHHHHHHHHHH..',
      '.HHSHSSSSSSSSS..',
      '.HHSSGGGGGGGG...',
      '.HSSSGWGGGGGGG..',
      '..SSSHSSSSSSSS..',
      '..DSSSMMMMMMM...',
      '..DSSSMMMMMMM...',
      '...SSSSSSSSSS...',
      '....SSSSSSSS....',
    ],
  },
  digambaran: {
    ox: -9,
    oy: -18,
    rows: [
      '..HHHHHHHHHHH...',
      '.HHHHHHHHHHHHH..',
      '.HHHWWWWWRWSSSH.',
      '.HHHSSSSSSSSSSH.',
      '.HHSSSSWBSSWBSH.',
      '..HSSSSSSSSSSSH.',
      '..HSSMMMMMMMMM..',
      '..HHMMMMMMMMMM..',
      '...HHMMMMMMM....',
    ],
  },
  minnal: {
    ox: -8,
    oy: -17,
    rows: [
      '...RRRRRRRRR....',
      '..RRRRYYRRRRR...',
      '..RRRRRRRRRRR...',
      '..RRSSWWRRWWR...',
      '..RRSSSSSSSSS...',
      '..RRSSMMMMMMM...',
      '...RSSSSSSSS....',
      '....SSSSSSSS....',
    ],
  },
  kathakali: {
    ox: -12,
    oy: -28,
    rows: [
      '.......GGGGGG.......',
      '......GYYYYYYG......',
      '....GGGYYRRYYGGG....',
      '...GYYYYGGGGYYYYG...',
      '..GGGGGGYYYYGGGGGG..',
      '....SSSSRRRSSSS.....',
      '...SSSSWBSSWBSSS....',
      '...WSSSSSSSSSSSW....',
      '...WWSSRRRRRSSWW....',
      '....WWWWWWWWWWW.....',
    ],
  },
  nagavalli: {
    ox: -10,
    oy: -19,
    rows: [
      '....GGGGGG......',
      '...WWWHHHHHH....',
      '..WWWHHHHHHHH...',
      '..WHHSSSSRSSSS..',
      '..HHHSSWBSSWBS..',
      '..HHHSSSSSSSSS..',
      '..HHHSSSRRRSS...',
      '...HH.SSSSSSS...',
    ],
  },
  murugan: {
    ox: -8,
    oy: -17,
    rows: [
      '..HHHHHHHHHHH...',
      '.HHHHHHHHHHHHH..',
      '.HHSHSSSSSSSSS..',
      '.HHSSMMSSMMSSS..',
      '.HSSSWBSSWBSSS..',
      '..SSSHSSSSSSSS..',
      '..DSSMMMMMMMM...',
      '..DSSMMMMMMMMM..',
      '...SSMMMMMMMM...',
      '....SSSSSSSS....',
    ],
  },
};

function drawHeadMatrix(ctx, charId, headX, headY, p, tintOverride, tick) {
  const spec = HEAD_MATRICES[charId] || HEAD_MATRICES.george;
  const pal = {
    S: tintOverride || p.skin,
    D: tintOverride || p.skinShade,
    H: tintOverride || '#f0b87d',
    H2: tintOverride || p.hair,
    G: tintOverride || p.accent,
    Y: tintOverride || '#fde047',
    R: tintOverride || '#dc2626',
    B: tintOverride || '#1d4ed8',
    W: '#ffffff',
    M: tintOverride || '#14110f',
  };
  const hairHeadIds = new Set(['george', 'unniyarcha', 'kuttan', 'digambaran', 'nagavalli', 'murugan']);
  const matrixPal = {
    ...pal,
    H: tintOverride || (hairHeadIds.has(charId) ? p.hair : '#f0b87d'),
    G: tintOverride || (charId === 'george' || charId === 'kuttan' ? '#09090b' : p.accent),
  };
  drawPixelMatrix(ctx, headX + spec.ox, headY + spec.oy, spec.rows, matrixPal, 1, false);

  // Aviator shade glint animation for George
  if ((charId === 'george' || charId === 'kuttan') && !tintOverride && tick % 44 < 6) {
    px(ctx, headX + 1, headY - 12, 3, 1, '#ffffff');
  }
}

function drawAura(ctx, x, y, color, tick) {
  if (!color) return;
  drawPixelHalo(ctx, x, y - 34, 24, color, 0.22);
  ctx.save();
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 6; i++) {
    const py = y - ((tick * 1.5 + i * 11) % 68);
    const pxOff = Math.sin(tick * 0.22 + i * 1.8) * 16;
    px(ctx, x + pxOff, py, 2, 4, color);
  }
  ctx.restore();
}

function drawSuperEntryProps(ctx, f, phaseTimer, tick) {
  const elapsed = 220 - phaseTimer;
  const localT = f.slot === 0 ? elapsed : elapsed - 92;
  if (localT < 0 || localT > 95) return;

  const entryId = f.def.superEntry.id;

  if (entryId === 'pathalam') {
    const pulse = Math.sin(tick * 0.35) * 3;
    const w = Math.min(64, localT * 2.2) + pulse;
    drawPixelHalo(ctx, f.x, ARENA.FLOOR_Y - 2, w * 0.65, '#a855f7', 0.32);
    px(ctx, f.x - w / 2 - 2, ARENA.FLOOR_Y - 7, w + 4, 12, '#100c14');
    px(ctx, f.x - w / 2, ARENA.FLOOR_Y - 5, w, 9, '#581c87');
    px(ctx, f.x - w / 2 + 5, ARENA.FLOOR_Y - 3, Math.max(4, w - 10), 5, '#c084fc');
    px(ctx, f.x - w / 3, ARENA.FLOOR_Y - 2, Math.max(2, (w * 2) / 3), 2, '#fde047');
    for (let i = 0; i < 10; i++) {
      const pY = ARENA.FLOOR_Y - ((localT * 1.3 + i * 8) % 72);
      const pX = f.x + Math.sin(localT * 0.22 + i) * 24;
      px(ctx, pX, pY, 2, 2, i % 2 === 0 ? '#f59e0b' : '#ec4899');
    }
  } else if (entryId === 'ksrtc') {
    const busX = f.slot === 0 ? -82 + localT * 5.2 : ARENA.WIDTH + 20 - localT * 5.2;
    const busY = ARENA.FLOOR_Y - 46;
    if (busX > -90 && busX < ARENA.WIDTH + 90) {
      px(ctx, busX - 1, busY - 5, 84, 44, '#100c14');
      px(ctx, busX, busY, 82, 34, '#dc2626');
      px(ctx, busX, busY + 19, 82, 7, '#facc15');
      px(ctx, busX + 2, busY - 4, 78, 5, '#f8fafc');
      for (let w = 0; w < 4; w++) {
        px(ctx, busX + 5 + w * 19, busY + 4, 15, 11, '#1e293b');
        px(ctx, busX + 6 + w * 19, busY + 5, 13, 9, '#7dd3fc');
        px(ctx, busX + 7 + w * 19, busY + 6, 4, 5, '#ffffff');
      }
      px(ctx, busX + 10, busY + 30, 12, 12, '#09090b');
      px(ctx, busX + 13, busY + 33, 6, 6, '#94a3b8');
      px(ctx, busX + 58, busY + 30, 12, 12, '#09090b');
      px(ctx, busX + 61, busY + 33, 6, 6, '#94a3b8');
      const lightX = f.slot === 0 ? busX + 80 : busX - 2;
      drawPixelHalo(ctx, lightX, busY + 25, 13, '#fef08a', 0.4);
      px(ctx, lightX, busY + 23, 4, 4, '#ffffff');
    }
  } else if (entryId === 'kalari') {
    for (const lx of [f.x - 28, f.x + 28]) {
      drawPixelHalo(ctx, lx, ARENA.FLOOR_Y - 21, 16, '#f97316', 0.36);
      px(ctx, lx - 4, ARENA.FLOOR_Y - 4, 8, 4, '#100c14');
      px(ctx, lx - 3, ARENA.FLOOR_Y - 3, 6, 3, '#eab308');
      px(ctx, lx - 1, ARENA.FLOOR_Y - 16, 2, 13, '#ca8a04');
      px(ctx, lx - 4, ARENA.FLOOR_Y - 18, 8, 3, '#fde047');
      px(ctx, lx - 1, ARENA.FLOOR_Y - 24 - (tick % 3), 3, 6, '#f97316');
      px(ctx, lx, ARENA.FLOOR_Y - 23, 1, 3, '#ffffff');
    }
  } else if (entryId === 'theechamundi') {
    drawPixelHalo(ctx, f.x, ARENA.FLOOR_Y - 30, 34, '#ef4444', 0.38);
    for (let i = 0; i < 16; i++) {
      const fx = f.x - 22 + ((i * 7 + tick * 2) % 44);
      const fh = 22 + ((i * 11 + localT * 2) % 62);
      px(ctx, fx, ARENA.FLOOR_Y - fh, 4, fh, i % 2 === 0 ? '#dc2626' : '#f97316');
      px(ctx, fx + 1, ARENA.FLOOR_Y - fh * 0.55, 2, fh * 0.45, '#fef08a');
    }
  } else if (entryId === 'auto') {
    const stopX = f.x - 20;
    let autoX = stopX;
    if (localT < 35) {
      autoX = (f.slot === 0 ? -60 : ARENA.WIDTH + 20) + (stopX - (f.slot === 0 ? -60 : ARENA.WIDTH + 20)) * (localT / 35);
    } else if (localT > 62) {
      autoX = stopX + (f.slot === 0 ? 1 : -1) * (localT - 62) * 5;
    }
    if (autoX > -70 && autoX < ARENA.WIDTH + 70) {
      const ay = ARENA.FLOOR_Y - 36;
      px(ctx, autoX - 1, ay - 1, 46, 38, '#100c14');
      px(ctx, autoX, ay + 10, 44, 22, '#facc15');
      px(ctx, autoX + 5, ay, 32, 12, '#18181b');
      px(ctx, autoX + 8, ay + 3, 11, 7, '#7dd3fc');
      px(ctx, autoX + 5, ay + 30, 9, 9, '#09090b');
      px(ctx, autoX + 30, ay + 30, 9, 9, '#09090b');
    }
  } else if (entryId === 'mantravadam') {
    const r = Math.min(34, localT * 1.4);
    drawPixelHalo(ctx, f.x, ARENA.FLOOR_Y - 2, r * 0.9, '#dc2626', 0.36);
    px(ctx, f.x - r, ARENA.FLOOR_Y - 4, r * 2, 6, '#18181b');
    px(ctx, f.x - r + 4, ARENA.FLOOR_Y - 3, Math.max(4, r * 2 - 8), 3, '#dc2626');
    for (let i = 0; i < 8; i++) {
      const a = tick * 0.14 + (i * Math.PI) / 4;
      px(ctx, f.x + Math.cos(a) * r * 0.85, ARENA.FLOOR_Y - 12 - (i % 3) * 14, 3, 3, i % 2 === 0 ? '#ef4444' : '#fde047');
    }
  } else if (entryId === 'lightning') {
    if (localT < 42) {
      drawPixelHalo(ctx, f.x, ARENA.FLOOR_Y - 35, 36, '#38bdf8', 0.45);
      let bx = f.x + ((tick % 5) - 2) * 3;
      for (let seg = 0; seg < 7; seg++) {
        const y0 = seg * 27;
        const nx = f.x + (seg % 2 === 0 ? -9 : 9);
        px(ctx, Math.min(bx, nx) - 2, y0, Math.abs(nx - bx) + 6, 28, '#38bdf8');
        px(ctx, Math.min(bx, nx), y0 + 2, Math.abs(nx - bx) + 2, 24, '#fef08a');
        bx = nx;
      }
    }
  } else if (entryId === 'kalivilakku') {
    const lx = f.x + (f.slot === 0 ? 32 : -32);
    drawPixelHalo(ctx, lx, ARENA.FLOOR_Y - 36, 22, '#facc15', 0.36);
    px(ctx, lx - 6, ARENA.FLOOR_Y - 4, 12, 4, '#92400e');
    px(ctx, lx - 2, ARENA.FLOOR_Y - 34, 4, 30, '#eab308');
    px(ctx, lx - 7, ARENA.FLOOR_Y - 36, 14, 4, '#fde047');
    px(ctx, lx - 2, ARENA.FLOOR_Y - 42 - (tick % 3), 4, 6, '#f97316');
    px(ctx, lx - 1, ARENA.FLOOR_Y - 41, 2, 4, '#ffffff');
  } else if (entryId === 'chilanka') {
    drawPixelHalo(ctx, f.x, ARENA.FLOOR_Y - 26, 28, '#f43f5e', 0.35);
    for (let i = 0; i < 6; i++) {
      const ang = localT * 0.25 + (i * Math.PI) / 3;
      px(ctx, f.x + Math.cos(ang) * 26, ARENA.FLOOR_Y - 24 + Math.sin(ang) * 14, 3, 3, i % 2 === 0 ? '#facc15' : '#f43f5e');
    }
  } else if (entryId === 'tiger') {
    drawPixelHalo(ctx, f.x, ARENA.FLOOR_Y - 28, 30, '#f59e0b', 0.34);
    for (let s = 0; s < 3; s++) {
      const sx = f.x - 16 + s * 10;
      px(ctx, sx, ARENA.FLOOR_Y - 52, 3, 38, '#fde047');
      px(ctx, sx + 1, ARENA.FLOOR_Y - 48, 1, 30, '#ffffff');
    }
  }
}

/**
 * Draws a ~72px tall SF2-proportion fighter with organic 3-tone pixel capsules!
 */
function drawFighterBody(ctx, f, poseState, moveKey, tick, tintOverride = null) {
  const p = f.def.palette;
  const isHurt = poseState === 'hitstun';
  const flashWhite = isHurt && f.stateTimer % 4 < 2;

  const skin = tintOverride || (flashWhite ? '#ffffff' : p.skin);
  const skinSh = tintOverride || (flashWhite ? '#e2e8f0' : p.skinShade);
  const skinHi = tintOverride || (flashWhite ? '#ffffff' : '#ebb57a');
  const cloth = tintOverride || (flashWhite ? '#ffffff' : p.cloth);
  const clothSh = tintOverride || (flashWhite ? '#e2e8f0' : p.clothShade);
  const clothHi = tintOverride || '#ffffff';
  const accent = tintOverride || (flashWhite ? '#fef08a' : p.accent);
  const sec = tintOverride || (flashWhite ? '#fca5a5' : p.secondary);

  if (poseState === 'ko' || poseState === 'knockdown') {
    ctx.translate(0, -10);
    ctx.rotate(-Math.PI / 2);
  }

  const crouch = poseState === 'crouch' || (poseState === 'attack' && moveKey === 'crouchAttack');
  const bob = poseState === 'idle' ? Math.round(Math.sin(tick * 0.14 + f.slot) * 1.5) : 0;
  const stride = poseState === 'walk' ? Math.sin(tick * 0.35) * 8 : 0;
  const hipY = (crouch ? -18 : -27) + bob;
  const shoulderY = (crouch ? -38 : -50) + bob;
  const leanX = poseState === 'attack' || poseState === 'projectile' || poseState === 'special' || poseState === 'super' ? 4 : 1;

  const foldedMundu = f.munduFolded || poseState === 'special' || poseState === 'super' || crouch;
  const kickActive =
    (poseState === 'attack' && (moveKey === 'heavyKick' || moveKey === 'airAttack' || moveKey === 'crouchAttack')) ||
    (poseState === 'special' && f.charId === 'george');

  // --- 1. ORGANIC STANCE LEGS (Wide Ryu/Ken martial-arts silhouette!) ---
  // Back Leg (bent knee behind)
  const backKneeX = -12 - stride * 0.5;
  const backKneeY = hipY + 12;
  const backFootX = -18 - stride * 0.7;
  const backFootY = -2;
  drawPixelCapsule(ctx, -4, hipY, backKneeX, backKneeY, 5, 4, skin, skinHi, skinSh);
  drawPixelCapsule(ctx, backKneeX, backKneeY, backFootX, backFootY, 4, 3, skin, skinHi, skinSh);
  px(ctx, backFootX - 3, backFootY - 2, 8, 4, skinSh); // Heel & bare toes

  // Front Leg or Extended High Roundhouse Kick!
  if (kickActive) {
    const kickY = moveKey === 'crouchAttack' ? -8 : -34;
    drawPixelCapsule(ctx, 4, hipY, 18, kickY, 5, 4, skin, skinHi, skinSh);
    drawPixelCapsule(ctx, 18, kickY, 31, kickY - 2, 4, 3, skin, skinHi, skinSh);
    px(ctx, 29, kickY - 5, 6, 6, skinHi); // Striking foot
    if (!tintOverride) {
      px(ctx, 33, kickY - 7, 5, 11, 'rgba(255,255,255,0.75)'); // Kick arc smear!
    }
  } else {
    const frontKneeX = 11 + stride * 0.5;
    const frontKneeY = hipY + 11;
    const frontFootX = 13 + stride * 0.7;
    const frontFootY = -2;
    drawPixelCapsule(ctx, 4, hipY, frontKneeX, frontKneeY, 5, 4, skin, skinHi, skinSh);
    drawPixelCapsule(ctx, frontKneeX, frontKneeY, frontFootX, frontFootY, 4, 3, skin, skinHi, skinSh);
    px(ctx, frontFootX - 2, frontFootY - 2, 9, 4, skin);
  }

  // --- 2. FLOWING MUNDU / LUNGI / ADAYALAM DRAPE ---
  if (f.charId === 'theyyam') {
    drawPixelCapsule(ctx, -6, hipY + 2, 6, hipY + 2, 10, 10, cloth, '#ef4444', '#7f1d1d');
    px(ctx, -15, hipY + 5, 30, 8, cloth);
    px(ctx, -16, hipY + 11, 32, 4, sec);
    px(ctx, -15, hipY + 13, 30, 2, accent);
  } else if (f.charId === 'kuttan') {
    const len = foldedMundu ? 13 : 23;
    drawPixelCapsule(ctx, -5, hipY + 2, 5, hipY + 2, 8, 8, sec, '#3b82f6', '#1e3a8a');
    px(ctx, -13, hipY + 2, 26, len, sec);
    for (let cx = -11; cx < 11; cx += 5) {
      px(ctx, cx, hipY + 3, 2, len - 2, '#1d4ed8');
      px(ctx, cx + 2, hipY + 6, 2, 3, '#93c5fd');
    }
  } else {
    const len = foldedMundu ? 13 : 24;
    // Pleated White & Gold Kasavu Mundu covering thighs
    drawPixelCapsule(ctx, -5, hipY + 2, 5, hipY + 2, 8, 8, cloth, clothHi, clothSh);
    px(ctx, -13, hipY + 2, 26, len, cloth);
    px(ctx, -13, hipY + 2, 6, len, clothSh); // Back thigh shadow
    px(ctx, -1, hipY + 3, 2, len - 2, clothSh); // Center pleat
    px(ctx, 5, hipY + 3, 2, len - 2, clothSh);
    px(ctx, -13, hipY + len - 1, 26, 3, accent); // Kasavu gold border!
    px(ctx, -13, hipY + len + 2, 26, 1, '#b45309');
  }

  // --- 3. SHADED MUSCULAR TORSO & TRADITIONAL TOPS ---
  if (f.charId === 'maveli') {
    drawPixelCapsule(ctx, 0, hipY - 2, leanX, shoulderY + 3, 9, 12, skin, skinHi, skinSh);
    // Pecs & royal chest definition
    px(ctx, leanX - 2, shoulderY + 4, 11, 6, skinHi);
    px(ctx, leanX - 4, shoulderY + 13, 9, 7, skinSh);
    // Golden necklace & diagonal Poonool
    px(ctx, leanX - 7, shoulderY + 2, 15, 3, accent);
    for (let i = 0; i < 16; i += 2) {
      px(ctx, leanX - 7 + i, shoulderY + 2 + i, 2, 2, '#fde047');
    }
    px(ctx, -10, hipY - 1, 22, 4, sec); // Waist sash
  } else if (f.charId === 'george') {
    drawPixelCapsule(ctx, 0, hipY - 2, leanX, shoulderY + 3, 9, 11, cloth, clothHi, clothSh);
    px(ctx, leanX - 6, shoulderY + 2, 3, 18, sec); // Signature vertical stripe
    px(ctx, leanX + 4, shoulderY + 2, 2, 18, '#94a3b8');
    px(ctx, leanX - 3, shoulderY + 2, 7, 7, skin); // Open V-neck
    px(ctx, leanX, shoulderY + 5, 2, 3, accent); // Gold chain
    px(ctx, leanX - 5, shoulderY - 1, 4, 4, clothHi); // Popped collar
  } else if (f.charId === 'unniyarcha') {
    drawPixelCapsule(ctx, 0, hipY - 2, leanX, shoulderY + 3, 7, 9, sec, '#f43f5e', '#881337');
    px(ctx, leanX - 7, shoulderY + 2, 14, 3, accent);
    px(ctx, -9, hipY - 1, 18, 4, accent);
  } else if (f.charId === 'theyyam') {
    drawPixelCapsule(ctx, 0, hipY - 2, leanX, shoulderY + 3, 9, 11, '#7f1d1d', '#dc2626', '#450a0a');
    px(ctx, leanX - 8, shoulderY + 3, 16, 4, accent);
    px(ctx, leanX - 6, shoulderY + 10, 12, 6, '#f97316');
  } else {
    drawPixelCapsule(ctx, 0, hipY - 2, leanX, shoulderY + 3, 9, 11, cloth, '#bfa872', clothSh);
    px(ctx, leanX - 3, shoulderY + 2, 6, 8, '#f8fafc'); // White banian
    px(ctx, leanX - 9, shoulderY + 1, 4, 17, '#dc2626'); // Red thorthu draped
    px(ctx, leanX + 5, shoulderY + 1, 4, 15, '#dc2626');
  }

  // --- 4. EXPRESSIVE HAND-PIXELED HEAD & CROWN MATRIX ---
  const neckX = leanX + 1;
  const neckY = shoulderY - 1;
  px(ctx, neckX - 3, neckY - 3, 6, 6, skinSh);
  drawHeadMatrix(ctx, f.charId, neckX, neckY, p, tintOverride, tick);

  // --- 5. MUSCULAR ARMS, FISTS & DOUBLE-PALM HADOUKEN / WEAPONS ---
  const armTop = f.charId === 'maveli' || f.charId === 'theyyam' ? skin : cloth;
  const armHi = f.charId === 'maveli' || f.charId === 'theyyam' ? skinHi : clothHi;

  if (poseState === 'projectile' || poseState === 'super') {
    // Classic Ryu-style Double-Palm Thrust forward!
    drawPixelCapsule(ctx, leanX + 2, shoulderY + 4, leanX + 21, shoulderY + 8, 4, 3, skin, skinHi, skinSh);
    drawPixelCapsule(ctx, leanX - 2, shoulderY + 9, leanX + 20, shoulderY + 12, 4, 3, skin, skinHi, skinSh);
    px(ctx, leanX + 19, shoulderY + 5, 5, 9, skinHi);
  } else if (poseState === 'attack' && moveKey === 'lightPunch') {
    // Snappy Lead Jab with impact smear
    drawPixelCapsule(ctx, leanX + 3, shoulderY + 3, leanX + 25, shoulderY + 4, 4, 3, skin, skinHi, skinSh);
    px(ctx, leanX + 23, shoulderY + 1, 6, 6, f.charId === 'theyyam' ? '#f97316' : skinHi);
    if (!tintOverride) px(ctx, leanX + 29, shoulderY + 1, 5, 6, 'rgba(255,255,255,0.7)');
    // Back arm chambered at hip
    drawPixelCapsule(ctx, leanX - 6, shoulderY + 4, leanX - 9, shoulderY + 14, 4, 3, armTop, armHi, skinSh);
  } else {
    // Guarding Martial-Arts Arms (back shoulder + raised forward fists)
    drawPixelCapsule(ctx, leanX - 7, shoulderY + 3, leanX - 11, shoulderY + 13, 4, 3, armTop, armHi, skinSh);
    drawPixelCapsule(ctx, leanX - 11, shoulderY + 13, leanX - 2, shoulderY + 12, 3, 3, skin, skinHi, skinSh);
    drawPixelCapsule(ctx, leanX + 5, shoulderY + 4, leanX + 13, shoulderY + 12, 4, 3, armTop, armHi, skinSh);
    drawPixelCapsule(ctx, leanX + 13, shoulderY + 12, leanX + 15, shoulderY + 4, 3, 3, skin, skinHi, skinSh);
    px(ctx, leanX + 12, shoulderY + 1, 5, 5, skinHi); // Forward fist
  }

  // Maveli's Detailed Ribbed Olakkuda Umbrella
  if (f.charId === 'maveli') {
    const spinning = poseState === 'special' || poseState === 'super' || poseState === 'victory';
    const umbY = spinning ? shoulderY - 36 : shoulderY - 20;
    const umbX = spinning ? -18 : -16;
    const umbW = spinning ? 38 : 26;
    px(ctx, umbX + umbW / 2 - 1, umbY + 6, 2, 32, '#78350f');
    px(ctx, umbX, umbY, umbW, 7, '#d97706');
    px(ctx, umbX + 3, umbY - 3, umbW - 6, 3, '#b45309');
    px(ctx, umbX + 7, umbY - 5, umbW - 14, 2, '#f59e0b');
    px(ctx, umbX, umbY + 6, umbW, 2, '#fde047');
  }

  // Unniyarcha's Gleaming Flexible Urumi Whip Sword
  if (f.charId === 'unniyarcha') {
    const whipping = poseState === 'special' || poseState === 'super' || (poseState === 'attack' && moveKey === 'heavyKick');
    if (whipping) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(leanX + 12, shoulderY + 6);
      ctx.bezierCurveTo(leanX + 26, shoulderY - 22, leanX + 44, shoulderY + 24, leanX + 52, shoulderY - 4);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leanX + 12, shoulderY + 7);
      ctx.bezierCurveTo(leanX + 24, shoulderY + 24, leanX + 42, shoulderY - 18, leanX + 50, shoulderY + 10);
      ctx.stroke();
    } else {
      px(ctx, leanX + 12, shoulderY + 4, 13, 2, '#f8fafc');
      px(ctx, leanX + 21, shoulderY + 6, 5, 5, '#cbd5e1');
    }
  }
}

function renderOutlinedPose(ctx, f, x, y, facing, poseState, moveKey, tick, alpha = 1, tint = null) {
  if (ensureBuffers() && !tint) {
    spriteCtx.clearRect(0, 0, BUF_W, BUF_H);
    spriteCtx.save();
    spriteCtx.translate(ANCHOR_X, ANCHOR_Y);
    spriteCtx.scale(facing, 1);
    drawFighterBody(spriteCtx, f, poseState, moveKey, tick, null);
    spriteCtx.restore();

    outlineCtx.clearRect(0, 0, BUF_W, BUF_H);
    outlineCtx.globalCompositeOperation = 'source-over';
    outlineCtx.drawImage(spriteBuf, 0, 0);
    outlineCtx.globalCompositeOperation = 'source-in';
    outlineCtx.fillStyle = '#100c14';
    outlineCtx.fillRect(0, 0, BUF_W, BUF_H);
    outlineCtx.globalCompositeOperation = 'source-over';

    const dx = Math.round(x) - ANCHOR_X;
    const dy = Math.round(y) - ANCHOR_Y;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(outlineBuf, dx - 1, dy);
    ctx.drawImage(outlineBuf, dx + 1, dy);
    ctx.drawImage(outlineBuf, dx, dy - 1);
    ctx.drawImage(outlineBuf, dx, dy + 1);
    ctx.drawImage(spriteBuf, dx, dy);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing, 1);
  drawFighterBody(ctx, f, poseState, moveKey, tick, tint);
  ctx.restore();
}

function selectPoseIndex(poseState, moveKey) {
  if (poseState === 'projectile' || poseState === 'super') return 3;
  if (poseState === 'special' || poseState === 'jump' || poseState === 'victory') return 2;
  if (poseState === 'attack') {
    return moveKey === 'lightPunch' ? 1 : 2;
  }
  if (poseState === 'hitstun') return 1;
  return 0;
}

function drawHdSpriteFrame(ctx, f, x, y, facing, poseState, moveKey, tick, alpha = 1) {
  const idx = selectPoseIndex(poseState, moveKey);
  const frame = getSpritePose(f.charId, idx);
  if (!frame) return false;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing, 1);

  if (poseState === 'ko' || poseState === 'knockdown') {
    ctx.translate(0, -16);
    ctx.rotate(-Math.PI / 2);
  } else if (poseState === 'crouch') {
    ctx.scale(1.06, 0.74);
  } else if (poseState === 'idle') {
    const breath = 1 + Math.sin(tick * 0.14 + f.slot) * 0.018;
    ctx.scale(1 / breath, breath);
  } else if (poseState === 'walk') {
    const bob = Math.abs(Math.sin(tick * 0.34)) * 3;
    ctx.translate(0, -Math.round(bob));
    ctx.rotate(Math.sin(tick * 0.34) * 0.035);
  } else if (poseState === 'hitstun') {
    ctx.rotate(-0.14);
    if (f.stateTimer % 4 < 2) ctx.filter = 'brightness(2.2)';
  }

  ctx.drawImage(frame.img, Math.round(-frame.w / 2), Math.round(-frame.h), frame.w, frame.h);
  ctx.restore();
  return true;
}

export function drawFighter(ctx, f, state, tick) {
  const hdActive = Boolean(getSpritePose(f.charId, 0));
  const S = hdActive ? 5 / 3 : 1;

  if (state.phase === 'intro') {
    ctx.save();
    if (S !== 1) ctx.scale(S, S);
    drawSuperEntryProps(ctx, f, state.phaseTimer, tick);
    ctx.restore();
  }

  const elapsed = state.phase === 'intro' ? 220 - state.phaseTimer : 999;
  const localEntryT = f.slot === 0 ? elapsed : elapsed - 92;

  let entryYOffset = 0;
  let clipBelowFloor = false;
  if (f.state === 'entry') {
    if (localEntryT < 0) return;
    const eid = f.def.superEntry.id;
    if (eid === 'pathalam' || eid === 'mantravadam') {
      clipBelowFloor = true;
      const prog = Math.min(1, localEntryT / 55);
      entryYOffset = Math.round((1 - prog) * 84);
    } else if (eid === 'ksrtc' || eid === 'lightning') {
      const prog = Math.min(1, localEntryT / 44);
      entryYOffset = prog < 0.5 ? -68 + prog * 136 : 0;
    } else if (eid === 'kalari' || eid === 'tiger') {
      const prog = Math.min(1, localEntryT / 45);
      entryYOffset = Math.round(-Math.sin((1 - prog) * Math.PI * 0.5) * 56);
    } else if (eid === 'auto') {
      if (localEntryT < 34) return;
      const hop = Math.min(1, (localEntryT - 34) / 18);
      entryYOffset = Math.round(-Math.sin(hop * Math.PI) * 18);
    }
  }

  const drawX = f.x * S;
  const drawY = f.y * S;
  const floorY = ARENA.FLOOR_Y * S;

  // Elliptical SF2 Dock Shadow
  if (f.y <= ARENA.FLOOR_Y + 2) {
    const shadowScale = Math.max(0.4, 1 - (ARENA.FLOOR_Y - f.y) / 130);
    drawEllipseShadow(ctx, drawX, floorY, 22 * S * shadowScale, 4.5 * S * shadowScale, '#09090b', 0.54);
  }

  if (f.buffs.auraColor) {
    drawAura(ctx, drawX, drawY, f.buffs.auraColor, tick);
  }

  if (f.trail && f.trail.length > 0) {
    for (const ghost of f.trail) {
      const alpha = (ghost.life / 10) * 0.35;
      if (hdActive) {
        drawHdSpriteFrame(ctx, f, ghost.x * S, ghost.y * S, ghost.facing, ghost.state, ghost.moveKey, tick, alpha);
      } else {
        renderOutlinedPose(ctx, f, ghost.x, ghost.y, ghost.facing, ghost.state, ghost.moveKey, tick, alpha, f.def.palette.accentBright);
      }
    }
  }

  if (f.meter >= 100 && tick % 4 === 0) {
    px(ctx, drawX + (Math.random() - 0.5) * 40 * S, drawY - Math.random() * 72 * S, 3, 3, '#fde047');
  }

  ctx.save();
  if (clipBelowFloor) {
    ctx.beginPath();
    ctx.rect(0, 0, ARENA.WIDTH * S, floorY + 3);
    ctx.clip();
  }

  if (hdActive) {
    drawHdSpriteFrame(ctx, f, drawX, drawY + entryYOffset * S, f.facing, f.state, f.moveKey, tick, 1);
  } else {
    renderOutlinedPose(ctx, f, f.x, f.y + entryYOffset, f.facing, f.state, f.moveKey, tick, 1, null);
  }

  if (f.state === 'blockstun' || f.prevInput?.block) {
    const gx = Math.round(drawX) + f.facing * Math.round(20 * S);
    const gy = Math.round(drawY + entryYOffset * S) - Math.round(64 * S);
    ctx.strokeStyle = f.state === 'blockstun' ? '#93c5fd' : 'rgba(96, 165, 250, 0.78)';
    ctx.lineWidth = f.state === 'blockstun' ? 3 : 2;
    ctx.strokeRect(gx - 4, gy, 9, Math.round(58 * S));
  }
  if (f.state === 'victory' && tick % 6 < 3) {
    px(ctx, drawX - 24, drawY - 110, 4, 4, '#fde047');
    px(ctx, drawX + 20, drawY - 96, 4, 4, '#ffffff');
  }

  ctx.restore();
}

/**
 * Multi-layered CPS-2 radial energy projectile matching SF2 Hadouken clarity!
 */
export function drawProjectile(ctx, p, tick, scale = 1) {
  const pxX = p.x * scale;
  const pxY = p.y * scale;
  const dir = Math.sign(p.vx) || 1;
  drawPixelHalo(ctx, pxX, pxY, 17 * scale, p.color, 0.34);

  for (let i = 0; i < 4; i++) {
    const tx = pxX - dir * (10 + i * 4) * scale;
    const ty = pxY - 5 * scale + ((i * 3 + tick) % 9) * scale;
    px(ctx, tx, ty, (6 - i) * scale, 2 * scale, i % 2 === 0 ? p.color : p.coreColor);
  }

  ctx.save();
  ctx.translate(Math.round(pxX), Math.round(pxY));
  ctx.scale(scale, scale);
  ctx.rotate(p.spin * 0.6);

  // Outer energy ring + glowing core (like Hadouken in SF2 screenshot)
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.coreColor;
  ctx.beginPath();
  ctx.arc(dir * 2, 0, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(dir * 3, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // Signature Kerala motif detail on top
  if (p.style === 'pookkalam') {
    for (let a = 0; a < 6; a++) {
      const ang = (a * Math.PI) / 3;
      px(ctx, Math.cos(ang) * 8 - 1, Math.sin(ang) * 8 - 1, 3, 3, a % 2 === 0 ? '#ec4899' : '#fde047');
    }
  } else if (p.style === 'parotta') {
    px(ctx, -5, -2, 10, 1, '#92400e');
    px(ctx, -3, 2, 7, 1, '#92400e');
  } else if (p.style === 'chakka') {
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      px(ctx, Math.cos(ang) * 9 - 1, Math.sin(ang) * 9 - 1, 2, 2, '#15803d');
    }
  } else if (p.style === 'mantra') {
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2;
      px(ctx, Math.cos(ang) * 9 - 1, Math.sin(ang) * 9 - 1, 3, 3, '#fde047');
    }
  } else if (p.style === 'lightning') {
    px(ctx, -6, -4, 5, 2, '#38bdf8');
    px(ctx, -2, -2, 6, 2, '#fef08a');
    px(ctx, 2, 0, 6, 2, '#ffffff');
  } else if (p.style === 'mudra') {
    for (let a = 0; a < 6; a++) {
      const ang = (a * Math.PI) / 3;
      px(ctx, Math.cos(ang) * 8 - 1, Math.sin(ang) * 8 - 1, 3, 3, a % 2 === 0 ? '#22c55e' : '#facc15');
    }
  } else if (p.style === 'chilanka') {
    for (let a = 0; a < 5; a++) {
      const ang = (a * Math.PI * 2) / 5;
      px(ctx, Math.cos(ang) * 9 - 1, Math.sin(ang) * 9 - 1, 2, 2, '#fde047');
    }
  } else if (p.style === 'claw') {
    px(ctx, -4, -4, 9, 2, '#ffffff');
    px(ctx, -3, 0, 9, 2, '#fef08a');
    px(ctx, -4, 4, 9, 2, '#ffffff');
  }

  ctx.restore();
}

const SNACK_SPRITES = {
  chaya: {
    rows: [
      '..O..O..',
      '.O....O.',
      '.KKKKKK.',
      'KWWWWWWK',
      'KMMMMMMK',
      'KBBBBBBK',
      'KBBBBBBK',
      '.KKKKKK.',
    ],
    pal: { O: '#ffffff', K: '#100c14', W: '#fef3c7', M: '#d97706', B: '#92400e' },
  },
  pazhampori: {
    rows: [
      '..KKKKKK..',
      '.KYYYYYYK.',
      'KYYGGGGYYK',
      'KGGGGGGGGK',
      '.KBBBBBBK.',
      '..KKKKKK..',
    ],
    pal: { K: '#100c14', Y: '#fef08a', G: '#eab308', B: '#b45309' },
  },
  payasam: {
    rows: [
      '..K..K..',
      '.KKKKKK.',
      'KPPPPPPK',
      'KGGGGGGK',
      'KGGGGGGK',
      '.KKKKKK.',
    ],
    pal: { K: '#100c14', P: '#fbcfe8', G: '#eab308' },
  },
  karikku: {
    rows: [
      '.....KSSK',
      '..KKKKK..',
      '.KLLLLLK.',
      'KLLGGGGGk',
      'KGGGGGGGK',
      'KDDDDDDDK',
      '.KKKKKKK.',
    ],
    pal: { K: '#100c14', S: '#ffffff', L: '#4ade80', G: '#16a34a', k: '#100c14', D: '#15803d' },
  },
  kanthari: {
    rows: [
      '...KK...',
      '..KGGK..',
      '..KRRK..',
      '.KRYRRK.',
      '.KRRRRK.',
      '..KRRK..',
      '...KK...',
    ],
    pal: { K: '#100c14', G: '#22c55e', R: '#dc2626', Y: '#fde047' },
  },
};

export function drawPowerup(ctx, pu, tick, scale = 1) {
  const bx = Math.round(pu.x * scale);
  const by = Math.round((pu.y + Math.sin(pu.bob) * 3) * scale);
  const id = pu.spec.id;

  drawPixelHalo(ctx, bx, by, 14 * scale, pu.spec.glow, 0.34);

  const sprite = SNACK_SPRITES[id] || SNACK_SPRITES.chaya;
  const pxScale = Math.round(2 * scale);
  const w = sprite.rows[0].length * pxScale;
  const h = sprite.rows.length * pxScale;
  drawPixelMatrix(ctx, bx - w / 2, by - h / 2, sprite.rows, sprite.pal, pxScale);

  const mlLabel = pu.spec.mlName || '';
  const enLabel = pu.spec.name || '';
  const labelText = mlLabel ? `${mlLabel} · ${enLabel}` : enLabel;
  ctx.font = `bold ${Math.round(6 * scale)}px "Nirmala UI", "Noto Sans Malayalam", "Kartika", sans-serif`;
  ctx.textAlign = 'center';
  const tw = ctx.measureText(labelText).width;
  const labelY = by + Math.round(17 * scale);
  ctx.fillStyle = 'rgba(9, 9, 11, 0.82)';
  ctx.fillRect(
    Math.round(bx - tw / 2 - 4 * scale),
    Math.round(labelY - 7 * scale),
    Math.round(tw + 8 * scale),
    Math.round(10 * scale)
  );
  ctx.fillStyle = '#09090b';
  ctx.fillText(labelText, bx + 1, labelY + 1);
  ctx.fillStyle = '#fef08a';
  ctx.fillText(labelText, bx, labelY);
  ctx.textAlign = 'left';
}

export function drawPortrait(ctx, charId, width = 64, height = 64) {
  const img = getPortraitImage(charId);
  if (img) {
    ctx.drawImage(img, 0, 0, width, height);
    return;
  }
  const def = getCharacterById(charId);
  const p = def.palette;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#090d1a';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = p.secondary;
  ctx.fillRect(0, height * 0.55, width, height * 0.45);
  ctx.fillStyle = p.accent;
  ctx.fillRect(0, height * 0.52, width, 3);

  ctx.save();
  ctx.translate(width / 2, height - 4);
  const scale = width / 38;
  ctx.scale(scale, scale);

  px(ctx, -12, -16, 24, 16, '#100c14');
  px(ctx, -11, -15, 22, 15, charId === 'maveli' ? p.skin : p.cloth);
  px(ctx, -11, -15, 5, 15, charId === 'maveli' ? p.skinShade : p.clothShade);
  if (charId === 'maveli') {
    px(ctx, -7, -14, 14, 3, p.accent);
    px(ctx, -7, -14, 2, 14, '#fde047');
  } else if (charId === 'george') {
    px(ctx, -6, -15, 3, 15, p.secondary);
    px(ctx, -3, -15, 6, 4, p.skin);
  } else if (charId === 'unniyarcha') {
    px(ctx, -11, -15, 22, 15, p.secondary);
    px(ctx, -7, -14, 14, 3, p.accent);
  } else if (charId === 'kuttan') {
    px(ctx, -10, -15, 4, 14, '#dc2626');
    px(ctx, 6, -15, 4, 14, '#dc2626');
  }

  drawHeadMatrix(ctx, charId, 0, -13, p, null, 0);
  ctx.restore();
}
