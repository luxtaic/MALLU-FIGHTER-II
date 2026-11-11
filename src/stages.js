/**
 * High-Clarity 16-bit CPS-2 / SF2-Style Kerala Stages.
 * Large, richly shaded midground structures, ~42px expressive spectators,
 * beveled perspective stone floors, and multi-plane animated scenery.
 */

import { ARENA } from './engine.js';
import { px, ditherBand, drawPixelHalo, drawPixelCapsule } from './pixel.js';
import { getStageImage, getCrowdStripImage } from './assets.js';

function drawCumulusCloud(ctx, x, y, w) {
  px(ctx, x + 8, y - 8, w - 16, 6, '#ffffff');
  px(ctx, x + 4, y - 4, w - 8, 7, '#f8fafc');
  px(ctx, x, y + 2, w, 6, '#e0f2fe');
  px(ctx, x + 3, y + 7, w - 6, 3, '#93c5fd');
  px(ctx, x + 8, y + 9, w - 16, 2, '#60a5fa');
}

function drawPalmTree(ctx, baseX, baseY, height, sway, scale = 1) {
  const segs = 10;
  let cx = baseX;
  let cy = baseY;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const nx = baseX + sway * t * t + Math.sin(t * 2.2) * 3.5 * scale;
    const ny = baseY - (height * (i + 1)) / segs;
    const w = Math.max(2, Math.round((5 - t * 2.5) * scale));
    const segH = Math.ceil(height / segs) + 1;
    px(ctx, nx - w / 2 - 1, ny, w + 2, segH, '#1e0d04');
    px(ctx, nx - w / 2, ny, w, segH, i % 2 === 0 ? '#78350f' : '#92400e');
    px(ctx, nx - w / 2, ny, Math.max(1, Math.floor(w / 2)), segH, '#b45309');
    cx = nx;
    cy = ny;
  }

  px(ctx, cx - 3, cy, 3, 3, '#3f6212');
  px(ctx, cx, cy + 1, 3, 3, '#65a30d');
  px(ctx, cx - 1, cy - 1, 3, 3, '#ca8a04');

  const angles = [-2.7, -2.0, -1.3, -0.6, 0.0, 0.6, 1.2];
  for (const a of angles) {
    const len = 18 * scale;
    for (let s = 1; s <= 6; s++) {
      const fProg = s / 6;
      const fx = cx + Math.cos(a) * (len * fProg) + sway * 0.25;
      const fy = cy + Math.sin(a) * (len * 0.45 * fProg) + s * s * 0.34 * scale;
      const leafCol = s < 3 ? '#22c55e' : s < 5 ? '#16a34a' : '#15803d';
      px(ctx, fx, fy, 3 * scale, 2 * scale, leafCol);
      px(ctx, fx, fy + 2 * scale, 2 * scale, 1 * scale, '#14532d');
    }
  }
}

/**
 * Large (~42px) SF2-scale waist-up shaded spectator standing behind a rail or counter!
 */
function drawLargeSpectator(ctx, x, y, opts, tick, excitement) {
  const {
    shirt, shirtHi, shirtSh,
    pants = '#78350f',
    skin = '#c68642', skinSh = '#8d5524',
    hair = '#1c1917',
    hat = null,
    isWoman = false,
    prop = null,
  } = opts;

  const spd = excitement > 25 ? 0.3 : 0.11;
  const bounce = excitement > 25 ? Math.round(Math.abs(Math.sin(tick * spd + x * 0.14))) : 0;
  const sy = y - bounce;

  // Outline silhouette + waist/pants
  px(ctx, x - 9, sy - 12, 18, 13, '#100c14');
  px(ctx, x - 8, sy - 11, 16, 11, pants);
  px(ctx, x - 1, sy - 11, 2, 11, '#100c14');

  // Broad shaded torso / shirt / saree
  px(ctx, x - 11, sy - 29, 22, 18, '#100c14');
  px(ctx, x - 10, sy - 28, 20, 16, shirt);
  px(ctx, x - 10, sy - 28, 7, 15, shirtHi);
  px(ctx, x + 4, sy - 28, 6, 16, shirtSh);
  // Center shirt placket / folds
  px(ctx, x - 1, sy - 27, 2, 14, shirtSh);

  if (isWoman) {
    // Diagonal Kasavu saree gold drape
    for (let k = 0; k < 5; k++) {
      px(ctx, x - 8 + k * 3, sy - 27 + k * 3, 4, 3, '#facc15');
    }
  }

  // Neck + Detailed Expressive Head
  px(ctx, x - 3, sy - 33, 6, 5, skinSh);
  px(ctx, x - 6, sy - 43, 12, 12, '#100c14');
  px(ctx, x - 5, sy - 42, 10, 10, skin);
  px(ctx, x + 1, sy - 42, 4, 10, skinSh);
  // Eyes, brows & Mallu moustache
  px(ctx, x - 3, sy - 39, 2, 2, '#09090b');
  px(ctx, x + 1, sy - 39, 2, 2, '#09090b');
  if (!isWoman) {
    px(ctx, x - 3, sy - 35, 6, 2, '#1c1917');
  } else {
    px(ctx, x - 1, sy - 40, 2, 1, '#dc2626'); // Pottu
  }

  // Hair or Cap/Headgear
  if (hat === 'cap') {
    px(ctx, x - 7, sy - 46, 14, 5, '#100c14');
    px(ctx, x - 6, sy - 45, 12, 4, '#334155');
    px(ctx, x - 7, sy - 42, 10, 2, '#1e293b');
  } else {
    px(ctx, x - 6, sy - 45, 12, 4, hair);
    if (isWoman) {
      px(ctx, x - 7, sy - 42, 3, 9, hair);
      px(ctx, x - 7, sy - 41, 3, 3, '#ffffff'); // Jasmine mullappoo!
    }
  }

  // Animated Cheering Arms!
  const armWave = Math.sin(tick * spd * 1.3 + x * 0.25) > 0;
  if (armWave) {
    drawPixelCapsule(ctx, x - 10, sy - 25, x - 13, sy - 37, 3, 2, shirt, shirtHi, '#100c14');
    px(ctx, x - 15, sy - 41, 5, 5, '#100c14');
    px(ctx, x - 14, sy - 40, 3, 3, skin);
    drawPixelCapsule(ctx, x + 10, sy - 25, x + 12, sy - 36, 3, 2, shirt, shirtHi, '#100c14');
    px(ctx, x + 10, sy - 40, 5, 5, '#100c14');
    px(ctx, x + 11, sy - 39, 3, 3, skin);

    if (prop === 'thorthu') {
      px(ctx, x + 12, sy - 48, 10, 7, '#100c14');
      px(ctx, x + 13, sy - 47, 8, 5, '#ffffff');
      px(ctx, x + 13, sy - 44, 8, 2, '#dc2626');
    }
  } else {
    drawPixelCapsule(ctx, x - 10, sy - 25, x - 12, sy - 16, 3, 2, shirt, shirtHi, '#100c14');
    drawPixelCapsule(ctx, x + 10, sy - 25, x + 12, sy - 16, 3, 2, shirt, shirtHi, '#100c14');
  }

  if (prop === 'camera') {
    px(ctx, x + 6, sy - 35, 6, 4, '#1e293b');
    px(ctx, x + 8, sy - 34, 2, 2, '#bae6fd');
    if (Math.floor(tick / 30) % 4 === 0 && excitement > 20) {
      drawPixelHalo(ctx, x + 9, sy - 33, 12, '#fef08a', 0.5);
      px(ctx, x + 7, sy - 35, 4, 4, '#ffffff');
    }
  }
}

function drawLifeRing(ctx, x, y) {
  px(ctx, x - 9, y - 9, 18, 18, '#100c14');
  px(ctx, x - 8, y - 8, 16, 16, '#f8fafc');
  px(ctx, x - 8, y - 2, 16, 4, '#dc2626');
  px(ctx, x - 2, y - 8, 4, 16, '#dc2626');
  px(ctx, x - 4, y - 4, 8, 8, '#100c14');
  px(ctx, x - 3, y - 3, 6, 6, '#38bdf8');
}

function drawPorthole(ctx, x, y) {
  px(ctx, x - 8, y - 8, 16, 16, '#100c14');
  px(ctx, x - 7, y - 7, 14, 14, '#cbd5e1');
  px(ctx, x - 5, y - 5, 10, 10, '#475569');
  px(ctx, x - 4, y - 4, 8, 8, '#1e293b');
  px(ctx, x - 3, y - 3, 3, 3, '#7dd3fc');
}

function drawSf2PerspectiveFloor(ctx, opts) {
  const {
    base, tileAlt, dark, grout, bevelHi, trim, trimHi,
    showBollards = false, warmLampXs = [],
  } = opts;
  const floorTop = ARENA.FLOOR_Y - 24; // y = 170
  const floorH = ARENA.HEIGHT - floorTop;

  px(ctx, 0, floorTop, ARENA.WIDTH, floorH, base);
  ditherBand(ctx, 0, floorTop + 4, ARENA.WIDTH, 9, dark, base, 0.5);

  // Heavy 3D front dock curb / stone lip
  px(ctx, 0, floorTop - 1, ARENA.WIDTH, 1, '#09090b');
  px(ctx, 0, floorTop, ARENA.WIDTH, 2, trimHi);
  px(ctx, 0, floorTop + 2, ARENA.WIDTH, 3, trim);
  px(ctx, 0, floorTop + 5, ARENA.WIDTH, 2, '#1c1917');

  // Horizontal beveled stone/timber rows (SF2 perspective look!)
  const rows = [floorTop + 12, floorTop + 21, floorTop + 32];
  for (let r = 0; r < rows.length; r++) {
    const ry = rows[r];
    px(ctx, 0, ry, ARENA.WIDTH, 2, grout);
    px(ctx, 0, ry + 2, ARENA.WIDTH, 1, bevelHi);
    if (r % 2 === 0) {
      ditherBand(ctx, 0, ry + 3, ARENA.WIDTH, 6, base, tileAlt, 0.35);
    }
  }
  // Bottom edge shadow trim
  px(ctx, 0, ARENA.HEIGHT - 5, ARENA.WIDTH, 2, '#1c1917');
  px(ctx, 0, ARENA.HEIGHT - 3, ARENA.WIDTH, 3, dark);

  // Radiating perspective tile seams
  const centerX = ARENA.WIDTH / 2;
  for (let i = -8; i <= 8; i++) {
    const topX = Math.round(centerX + i * 24);
    const botX = Math.round(centerX + i * 38);
    ctx.strokeStyle = grout;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(topX, floorTop + 6);
    ctx.lineTo(botX, ARENA.HEIGHT);
    ctx.stroke();

    ctx.strokeStyle = bevelHi;
    ctx.beginPath();
    ctx.moveTo(topX + 1, floorTop + 6);
    ctx.lineTo(botX + 1, ARENA.HEIGHT);
    ctx.stroke();
  }

  for (const lx of warmLampXs) {
    drawPixelHalo(ctx, lx, floorTop + 4, 24, '#f97316', 0.18);
  }

  if (showBollards) {
    for (const bx of [28, 224, 344]) {
      const by = bx === 224 ? floorTop + 18 : floorTop + 2;
      px(ctx, bx - 6, by - 9, 12, 11, '#09090b');
      px(ctx, bx - 5, by - 8, 10, 9, '#64748b');
      px(ctx, bx - 5, by - 8, 4, 9, '#cbd5e1');
      px(ctx, bx - 7, by - 11, 14, 4, '#09090b');
      px(ctx, bx - 6, by - 10, 12, 3, '#e2e8f0');
      px(ctx, bx - 6, by - 10, 12, 1, '#ffffff');
    }
  }
}

/**
 * Clips strictly inside open water so scanline ripples NEVER smear boats, hulls, or shorelines.
 */
function drawWaterClippedRipples(ctx, img, yStart, yEnd, getBounds, tick, speed, amp = 1.1) {
  for (let ry = yStart; ry < yEnd; ry += 2) {
    const { minX, maxX } = getBounds(ry);
    const clipW = maxX - minX - 6;
    if (clipW <= 8) continue;
    const dx = Math.sin(tick * speed + ry * 0.24) * amp + Math.sin(tick * speed * 0.6 - ry * 0.11) * (amp * 0.35);
    const sx = minX;
    const sw = maxX - minX;
    ctx.save();
    ctx.beginPath();
    ctx.rect(minX + 3, ry, clipW, 2);
    ctx.clip();
    ctx.drawImage(img, sx, ry, sw, 2, sx + dx, ry, sw, 2);
    ctx.restore();
  }
}

function drawDriftingCloudWisp(ctx, x, y, w, h, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x + w * 0.18), Math.round(y), Math.round(w * 0.64), Math.max(2, Math.round(h * 0.45)));
  ctx.fillRect(Math.round(x), Math.round(y + h * 0.35), Math.round(w), Math.max(2, Math.round(h * 0.45)));
  ctx.fillRect(Math.round(x + w * 0.1), Math.round(y + h * 0.72), Math.round(w * 0.8), Math.max(1, Math.round(h * 0.28)));
  ctx.restore();
}

function drawFlyingBird(ctx, x, y, tick, phase, color) {
  const flap = Math.sin(tick * 0.19 + phase);
  const bx = Math.round(x);
  const by = Math.round(y);
  const wingDy = flap > 0.35 ? -2 : flap < -0.35 ? 2 : 0;
  px(ctx, bx - 1, by, 3, 1, color);
  px(ctx, bx - 4, by + wingDy, 3, 1, color);
  px(ctx, bx + 2, by + wingDy, 3, 1, color);
  if (Math.abs(wingDy) >= 2) {
    px(ctx, bx - 6, by + wingDy * 1.5, 2, 1, color);
    px(ctx, bx + 5, by + wingDy * 1.5, 2, 1, color);
  }
}

function drawOilLampFlame(ctx, cx, cy, tick, seed, scale = 1) {
  const sway = Math.sin(tick * 0.22 + seed) * 1.2 * scale;
  const tall = (5 + Math.sin(tick * 0.31 + seed * 1.7) * 1.6) * scale;
  drawPixelHalo(ctx, cx, cy - 2 * scale, (18 + Math.sin(tick * 0.18 + seed) * 3) * scale, '#f97316', 0.26);
  ctx.save();
  ctx.fillStyle = '#f97316';
  ctx.fillRect(Math.round(cx - 2 * scale + sway * 0.3), Math.round(cy - tall * 0.7), Math.round(4 * scale), Math.round(tall * 0.75));
  ctx.fillStyle = '#fde047';
  ctx.fillRect(Math.round(cx - 1 * scale + sway * 0.6), Math.round(cy - tall * 0.9), Math.round(2 * scale), Math.round(tall * 0.65));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(cx - 0.5 * scale + sway * 0.2), Math.round(cy - tall * 0.45), Math.max(1, Math.round(1.2 * scale)), Math.round(tall * 0.35));
  ctx.restore();

  // Rising golden wick embers
  const emberProg = ((tick * 0.45 + seed * 17) % 24) / 24;
  const ex = cx + Math.sin(tick * 0.12 + seed + emberProg * 5) * 3 * scale;
  const ey = cy - 4 * scale - emberProg * 16 * scale;
  ctx.save();
  ctx.globalAlpha = Math.max(0, (1 - emberProg) * 0.65);
  px(ctx, ex, ey, Math.max(1, Math.round(1.5 * scale)), Math.max(1, Math.round(1.5 * scale)), '#fde047');
  ctx.restore();
}

function drawCrowdStripFrame(ctx, stripId, dx, dy, w, h, frameIdx) {
  const strip = getCrowdStripImage(stripId);
  if (!strip) return false;
  const fi = ((frameIdx % 4) + 4) % 4;
  ctx.drawImage(strip, 0, fi * h, w, h, dx, dy, w, h);
  return true;
}

function drawLiveAlappuzhaStage(ctx, img, tick, excitement) {
  ctx.drawImage(img, 0, 0, 640, 360);

  // 1. Gently drifting sunlit cumulus cloud wisps across open sky + flapping waterbirds
  const skyBands = [
    { base: 240, y: 18, w: 64, h: 12, spd: 0.08, a: 0.26 },
    { base: 430, y: 34, w: 86, h: 14, spd: 0.12, a: 0.22 },
    { base: 560, y: 14, w: 54, h: 10, spd: 0.06, a: 0.24 },
  ];
  for (const cb of skyBands) {
    const cx = 210 + ((cb.base + tick * cb.spd) % 490) - 55;
    drawDriftingCloudWisp(ctx, cx, cb.y, cb.w, cb.h, '#f8fafc', cb.a);
  }
  for (let b = 0; b < 3; b++) {
    const bx = 250 + ((tick * 0.26 + b * 18) % 410);
    const by = 46 + b * 9 + Math.sin(tick * 0.04 + b) * 3;
    drawFlyingBird(ctx, bx, by, tick, b * 1.4, '#f8fafc');
  }

  // 2. Smoothly clipped Vembanad Backwater ripple shader (never distorts boat hull!)
  drawWaterClippedRipples(
    ctx,
    img,
    213,
    269,
    (y) => ({ minX: Math.round(502 - (y - 213) * 0.58), maxX: 640 }),
    tick,
    0.055,
    1.1
  );

  // Moving surface wave glints & water-reflection caustics along lake and dock
  for (let i = 0; i < 9; i++) {
    const ry = 216 + (i % 5) * 10;
    const minX = Math.round(505 - (ry - 213) * 0.58);
    const span = 635 - minX;
    const gx = minX + ((span - ((tick * (0.35 + (i % 3) * 0.14) + i * 31) % span)));
    const gw = 7 + (i % 4) * 3;
    ctx.save();
    ctx.globalAlpha = 0.28 + Math.sin(tick * 0.08 + i) * 0.14;
    px(ctx, gx, ry, gw, 1, i % 2 === 0 ? '#e0f2fe' : '#67e8f9');
    ctx.restore();
  }

  // 3. Synchronized Chundan Vallam oar strokes, splashes & water reflection (hull stays rock-solid!)
  for (let i = 0; i < 6; i++) {
    const oarPhase = tick * 0.16 + i * 0.45;
    const dip = Math.sin(oarPhase);
    const ox = 556 + i * 13 + Math.round(Math.cos(oarPhase) * 2);
    const oy = 204 + Math.round(dip * 2.5);
    px(ctx, ox, oy, 2, 4, '#451a03');
    if (dip > 0.25) {
      const rSpan = Math.round((dip - 0.2) * 7);
      ctx.save();
      ctx.globalAlpha = Math.max(0.1, (1 - dip * 0.55) * 0.7);
      px(ctx, ox - rSpan, 207, rSpan * 2 + 2, 1, '#f0f9ff');
      px(ctx, ox - Math.max(1, rSpan - 2), 209, Math.max(2, rSpan * 2 - 2), 1, '#bae6fd');
      ctx.restore();
    }
  }
  // Shimmering reflection under Chundan Vallam
  for (let r = 0; r < 5; r++) {
    const rx = 552 + r * 16 + Math.sin(tick * 0.09 + r) * 2;
    ctx.save();
    ctx.globalAlpha = 0.24;
    px(ctx, rx, 211 + (r % 2) * 2, 9, 1, '#78350f');
    ctx.restore();
  }

  // 4. Seamlessly articulated 4-frame Kettuvallam Deck Spectators (grounded behind railing!)
  const crowdPeriod = excitement > 25 ? 6 : 11;
  const crowdFrame = Math.floor(tick / crowdPeriod) % 4;
  drawCrowdStripFrame(ctx, 'alappuzha_crowd', 286, 126, 156, 74, crowdFrame);

  if (excitement > 20) {
    for (let p = 0; p < 6; p++) {
      const py = 140 + ((tick * 0.95 + p * 23) % 130);
      const pxPos = 290 + p * 24 + Math.sin(tick * 0.09 + p * 1.7) * 8;
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, 1 - (py - 140) / 135);
      px(ctx, pxPos, py, 2, 2, p % 2 === 0 ? '#fde047' : '#fb923c');
      ctx.restore();
    }
  }
}

function drawLiveFortKochiStage(ctx, img, tick, excitement) {
  ctx.drawImage(img, 0, 0, 640, 360);

  // Seamless 4-frame articulated Chayakkada tea sipping, pouring & customer sway
  const crowdPeriod = excitement > 25 ? 8 : 13;
  const crowdFrame = Math.floor(tick / crowdPeriod) % 4;
  drawCrowdStripFrame(ctx, 'fortkochi_crowd_l', 0, 144, 98, 80, crowdFrame);
  drawCrowdStripFrame(ctx, 'fortkochi_crowd_r', 214, 112, 204, 93, crowdFrame);

  // 1. Drifting warm sunset clouds & silhouetted evening sea gulls over Arabian Sea
  const sunsetClouds = [
    { base: 440, y: 24, w: 72, h: 10, spd: 0.06, col: '#fb923c', a: 0.16 },
    { base: 520, y: 48, w: 94, h: 12, spd: 0.09, col: '#fde047', a: 0.14 },
  ];
  for (const sc of sunsetClouds) {
    const cx = 395 + ((sc.base + tick * sc.spd) % 270) - 40;
    drawDriftingCloudWisp(ctx, cx, sc.y, sc.w, sc.h, sc.col, sc.a);
  }
  for (let b = 0; b < 2; b++) {
    const bx = 425 + ((tick * 0.22 + b * 45) % 210);
    const by = 58 + b * 16 + Math.sin(tick * 0.045 + b) * 3;
    drawFlyingBird(ctx, bx, by, tick, b * 1.9, '#451a03');
  }

  // 2. Clipped Arabian Sea horizontal ripple shader (safely between customer x=415 and auto x=518!)
  drawWaterClippedRipples(
    ctx,
    img,
    173,
    225,
    () => ({ minX: 419, maxX: 517 }),
    tick,
    0.05,
    1.15
  );

  // Distant sunset horizon fishing boat gliding slowly across sea
  const fishBoatX = 512 - ((tick * 0.08) % 92);
  ctx.save();
  ctx.beginPath();
  ctx.rect(420, 166, 94, 16);
  ctx.clip();
  px(ctx, fishBoatX - 8, 174, 16, 2, '#451a03');
  px(ctx, fishBoatX - 5, 172, 9, 2, '#7c2d12');
  px(ctx, fishBoatX, 170, 2, 2, tick % 20 < 14 ? '#fef08a' : '#f59e0b'); // Boat lantern flicker
  ctx.restore();

  // Golden sunset path sparkles & continuous rolling beach surf waves
  for (let i = 0; i < 6; i++) {
    const sy = 179 + i * 6;
    const sx = 468 + Math.sin(tick * 0.07 + i * 1.4) * 16;
    ctx.save();
    ctx.globalAlpha = 0.28 + Math.sin(tick * 0.14 + i) * 0.16;
    px(ctx, sx, sy, 8 + (i % 3) * 3, 1, '#fef08a');
    ctx.restore();
  }
  for (let w = 0; w < 3; w++) {
    const prog = ((tick * 0.0085 + w / 3) % 1);
    const wy = 207 + prog * 28; // Rolls smoothly downward from sea onto wet beach sand
    const foamAlpha = Math.sin(prog * Math.PI) * 0.4;
    const waveOffset = Math.sin(prog * 4 + w) * 3;
    ctx.save();
    ctx.globalAlpha = Math.max(0, foamAlpha);
    px(ctx, 424 + waveOffset, wy, 38 + prog * 8, 1, '#fef3c7');
    px(ctx, 456 - waveOffset, wy + 1, 52 + prog * 6, 1, '#fef3c7');
    px(ctx, 434, wy + 2, 68, 1, '#fed7aa');
    ctx.restore();
  }

  // 3. Soft pulsing tungsten Edison halos at the EXACT 11 awning bulbs
  const exactBulbs = [
    [14, 86], [52, 89], [86, 87], [116, 87], [172, 89], [208, 87],
    [244, 84], [280, 86], [312, 87], [362, 90], [384, 93], [416, 84],
  ];
  for (let i = 0; i < exactBulbs.length; i++) {
    const [lx, ly] = exactBulbs[i];
    const pulse = 10 + Math.sin(tick * 0.09 + i * 0.9) * 2.2;
    drawPixelHalo(ctx, lx, ly, pulse, '#fde047', 0.19);
  }

  // 4. Wispy rising aromatic steam plumes from Samovar kettle (144, 138) & hot chaya glasses
  const steamEmitters = [
    { x: 145, y: 136, h: 34, spd: 0.48 },
    { x: 284, y: 175, h: 20, spd: 0.36 },
    { x: 294, y: 189, h: 16, spd: 0.32 },
  ];
  for (const em of steamEmitters) {
    for (let i = 0; i < 4; i++) {
      const prog = ((tick * em.spd + i * (em.h / 4)) % em.h) / em.h;
      const sy = em.y - prog * em.h;
      const sx = em.x + Math.sin(prog * 5 + tick * 0.06 + i) * 3.5;
      ctx.save();
      ctx.globalAlpha = Math.sin(prog * Math.PI) * 0.36;
      px(ctx, sx, sy, 3 + prog * 3, 2, '#f8fafc');
      ctx.restore();
    }
  }

  // 5. Continuous flowing Meter Chaya stream along exact probed parabola (264,128 -> 284,178)
  for (let d = 0; d < 5; d++) {
    const t = ((tick * 0.032 + d * 0.2) % 1);
    const dy = 128 + t * 50;
    const dx = 264 + 26 * t - 6 * t * t;
    px(ctx, dx, dy, 2, 3, d % 2 === 0 ? '#fef3c7' : '#fde68a');
  }
  // Micro tea splash foam at cup rim (284, 178)
  if (excitement > 15 || tick % 6 < 3) {
    const spY = 176 - Math.abs(Math.sin(tick * 0.25)) * 2;
    px(ctx, 282, spY, 2, 1, '#ffffff');
    px(ctx, 286, spY - 1, 2, 1, '#fef3c7');
  }

  // 6. Auto-Rickshaw idling warm headlight cone & faint exhaust puffs (body stays firmly parked!)
  const hlAlpha = 0.16 + Math.sin(tick * 0.12) * 0.04;
  drawPixelHalo(ctx, 518, 211, 14, '#fef08a', hlAlpha);
  for (let e = 0; e < 3; e++) {
    const ep = ((tick * 0.025 + e * 0.33) % 1);
    ctx.save();
    ctx.globalAlpha = (1 - ep) * 0.25;
    px(ctx, 628 + ep * 10, 248 - ep * 8, 3 + ep * 3, 2, '#cbd5e1');
    ctx.restore();
  }
}

function drawLiveThrissurStage(ctx, img, tick, excitement) {
  ctx.drawImage(img, 0, 0, 640, 360);

  // Seamless 4-frame Chenda Melam drumming, brass cymbal clash, cheering fan & elephant trunk sway
  const pooramPeriod = excitement > 25 ? 5 : 9;
  const pooramFrame = Math.floor(tick / pooramPeriod) % 4;
  drawCrowdStripFrame(ctx, 'thrissur_crowd_l', 50, 176, 218, 92, pooramFrame);
  drawCrowdStripFrame(ctx, 'thrissur_crowd_r', 390, 176, 190, 92, pooramFrame);
  if (pooramFrame === 2) {
    drawPixelHalo(ctx, 116, 217, 10, '#fef08a', 0.42);
    drawPixelHalo(ctx, 548, 217, 10, '#fef08a', 0.42);
  }

  // 1. Soft twinkling festival night sky stars across upper canopy (y = 6..60)
  const starCoords = [
    [42, 18], [98, 12], [176, 22], [234, 10], [298, 26], [344, 14],
    [418, 20], [492, 11], [566, 24], [612, 16],
  ];
  for (let i = 0; i < starCoords.length; i++) {
    const [sx, sy] = starCoords[i];
    const tw = Math.sin(tick * 0.09 + i * 1.7);
    if (tw > 0.25) {
      ctx.save();
      ctx.globalAlpha = tw * 0.75;
      px(ctx, sx, sy, 2, 2, '#fef9c3');
      ctx.restore();
    }
  }

  // 2. Realistic multi-stage Thrissur Pooram fireworks (ascending comet -> blooming ring -> gravity embers)
  const fireworks = [
    { x: 255, peakY: 36, col: '#fde047', core: '#ffffff', offset: 0 },
    { x: 372, peakY: 30, col: '#fb7185', core: '#fef08a', offset: 28 },
    { x: 438, peakY: 54, col: '#38bdf8', core: '#e0f2fe', offset: 56 },
    { x: 192, peakY: 44, col: '#4ade80', core: '#fef9c3', offset: 84 },
  ];
  for (let idx = 0; idx < fireworks.length; idx++) {
    const fw = fireworks[idx];
    const cyc = (tick + fw.offset) % 112;
    if (cyc < 22) {
      // Ascending glowing rocket trail from behind temple gopuram
      const riseProg = cyc / 22;
      const ry = 104 - riseProg * (104 - fw.peakY);
      ctx.save();
      ctx.globalAlpha = 0.85;
      px(ctx, fw.x, ry, 2, 3, fw.core);
      ctx.globalAlpha = 0.45;
      px(ctx, fw.x, ry + 4, 2, 6, fw.col);
      ctx.restore();
    } else if (cyc < 76) {
      const burstAge = cyc - 22;
      const norm = burstAge / 54;
      const radius = 6 + burstAge * 0.65;
      const gravDrop = norm * norm * 16;
      const alpha = Math.max(0, 1 - norm);
      drawPixelHalo(ctx, fw.x, fw.peakY + gravDrop * 0.2, radius * 0.9, fw.col, alpha * 0.25);
      ctx.save();
      for (let a = 0; a < 12; a++) {
        const ang = (a * Math.PI) / 6 + idx * 0.4;
        const pxX = fw.x + Math.cos(ang) * radius;
        const pxY = fw.peakY + Math.sin(ang) * radius * 0.88 + gravDrop;
        ctx.globalAlpha = alpha;
        px(ctx, pxX, pxY, 2, 2, burstAge < 14 ? fw.core : fw.col);
        ctx.globalAlpha = alpha * 0.45;
        px(ctx, fw.x + Math.cos(ang) * (radius * 0.68), fw.peakY + Math.sin(ang) * (radius * 0.68) * 0.88 + gravDrop * 0.6, 2, 2, fw.col);
      }
      ctx.restore();
    }
  }

  // 3. Living dancing oil-lamp flames on exact probed Nilavilakku wicks & center temple lamp
  drawOilLampFlame(ctx, 33, 174, tick, 0.4, 1.0);
  drawOilLampFlame(ctx, 604, 174, tick, 2.3, 1.0);
  drawOilLampFlame(ctx, 316, 206, tick, 4.1, 0.8);
  // Ambient lamp sheen reflected cleanly across foreground stone floor & Nettipattam gold armor
  const sheenA = 0.14 + Math.sin(tick * 0.18) * 0.04;
  drawPixelHalo(ctx, 33, 304, 28, '#f59e0b', sheenA);
  drawPixelHalo(ctx, 604, 304, 28, '#f59e0b', sheenA);
  drawPixelHalo(ctx, 140, 138, 22, '#fde047', 0.1 + Math.sin(tick * 0.14) * 0.04);
  drawPixelHalo(ctx, 504, 140, 22, '#fde047', 0.1 + Math.cos(tick * 0.14) * 0.04);

  // 4. Beat-synced Chenda Melam drumhead pulse & brass cymbal gleam (zero cutout slabs!)
  const beatRate = excitement > 25 ? 0.36 : 0.18;
  const drums = [
    [203, 224], [236, 240], [413, 228], [446, 224],
  ];
  for (let i = 0; i < drums.length; i++) {
    const pulse = Math.sin(tick * beatRate + i * 1.1);
    if (pulse > 0.65) {
      const [dx, dy] = drums[i];
      drawPixelHalo(ctx, dx, dy, 10 + (pulse - 0.65) * 20, '#fef08a', (pulse - 0.65) * 0.55);
    }
  }
}

function drawLiveMunnarStage(ctx, img, tick, excitement) {
  ctx.drawImage(img, 0, 0, 640, 360);

  // 1. Drifting morning mist ribbons across the emerald tea valley
  const mistBands = [
    { base: 240, y: 146, w: 96, h: 12, spd: 0.14, col: '#ecfeff', a: 0.24 },
    { base: 360, y: 170, w: 118, h: 14, spd: 0.1, col: '#f0fdfa', a: 0.22 },
    { base: 495, y: 188, w: 88, h: 10, spd: 0.17, col: '#e0f2fe', a: 0.26 },
  ];
  for (const mb of mistBands) {
    const mx = 215 + ((mb.base + tick * mb.spd) % 415) - 60;
    drawDriftingCloudWisp(ctx, mx, mb.y, mb.w, mb.h, mb.col, mb.a);
  }

  // 2. Cascading misty valley waterfall droplets & splash mist (x ~ 530..548, y ~ 112..182)
  for (let d = 0; d < 10; d++) {
    const prog = ((tick * 0.042 + d * 0.11) % 1);
    const wy = 114 + prog * 68;
    const wx = 532 + (d % 4) * 3 + Math.round(Math.sin(prog * 8 + d) * 1.5);
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(prog * Math.PI) * 0.35;
    px(ctx, wx, wy, 2, 4, d % 2 === 0 ? '#ffffff' : '#bae6fd');
    ctx.restore();
  }
  drawPixelHalo(ctx, 538, 182, 20 + Math.sin(tick * 0.11) * 3, '#e0f2fe', 0.22);

  // 3. Warm hanging brass pavilion lantern halo & floating Neelakurinji petals
  drawPixelHalo(ctx, 168, 118, 22 + Math.sin(tick * 0.14) * 2.5, '#fde047', 0.25);
  for (let b = 0; b < 3; b++) {
    const bx = 260 + ((tick * 0.24 + b * 48) % 340);
    const by = 46 + b * 12 + Math.sin(tick * 0.05 + b) * 4;
    drawFlyingBird(ctx, bx, by, tick, b * 1.3, '#0f172a');
  }
  const petalCount = excitement > 25 ? 10 : 6;
  for (let p = 0; p < petalCount; p++) {
    const pxPos = (40 + p * 68 + tick * (0.28 + (p % 3) * 0.08)) % 620;
    const pyPos = 152 + ((tick * 0.36 + p * 19) % 126);
    ctx.save();
    ctx.globalAlpha = 0.65;
    px(ctx, pxPos, pyPos, 2, 2, p % 2 === 0 ? '#c084fc' : '#a855f7');
    ctx.restore();
  }
}

function drawLiveKovalamStage(ctx, img, tick, excitement) {
  ctx.drawImage(img, 0, 0, 640, 360);

  // 1. Rotating Kovalam Lighthouse golden beam sweeping across twilight sky
  const sweepPhase = Math.sin(tick * 0.032);
  const beamEndX = Math.round(91 + 260 + sweepPhase * 155);
  const beamEndY = Math.round(62 + Math.cos(tick * 0.032) * 24);
  ctx.save();
  ctx.globalAlpha = 0.18 + Math.max(0, sweepPhase) * 0.08;
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.moveTo(91, 31);
  ctx.lineTo(beamEndX, beamEndY - 22);
  ctx.lineTo(beamEndX, beamEndY + 22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  drawPixelHalo(ctx, 91, 31, 20 + Math.sin(tick * 0.12) * 3, '#fef08a', 0.42);

  // 2. Clipped Arabian Sea horizontal ripple shimmer (midground sea bay)
  drawWaterClippedRipples(
    ctx,
    img,
    174,
    224,
    () => ({ minX: 250, maxX: 520 }),
    tick,
    0.055,
    1.15
  );

  // Sunset ocean glints & rolling shoreline foam near promenade wall
  for (let i = 0; i < 7; i++) {
    const ry = 178 + i * 7;
    const sx = 285 + Math.sin(tick * 0.08 + i * 1.4) * 26;
    ctx.save();
    ctx.globalAlpha = 0.34 + Math.sin(tick * 0.14 + i) * 0.14;
    px(ctx, sx, ry, 9 + (i % 3) * 3, 1, i % 2 === 0 ? '#fef08a' : '#fdba74');
    ctx.restore();
  }

  // 3. Promenade stone lantern halos & twilight gulls
  for (const [lx, ly] of [[28, 224], [250, 218], [472, 266], [572, 266]]) {
    drawPixelHalo(ctx, lx, ly, 16 + Math.sin(tick * 0.11 + lx) * 2, '#fbbf24', excitement > 25 ? 0.3 : 0.22);
  }
  for (let b = 0; b < 3; b++) {
    const bx = 240 + ((tick * 0.28 + b * 62) % 380);
    const by = 48 + b * 14 + Math.sin(tick * 0.05 + b) * 3;
    drawFlyingBird(ctx, bx, by, tick, b * 1.7, '#3b0764');
  }
}

function drawLiveKalariStage(ctx, img, tick, excitement) {
  ctx.drawImage(img, 0, 0, 640, 360);

  // 1. Twinkling stars in open central courtyard night sky (x ~ 185..455, y ~ 6..72)
  const stars = [
    [214, 16], [248, 28], [286, 12], [322, 34], [358, 18], [396, 26], [428, 14],
  ];
  for (let i = 0; i < stars.length; i++) {
    const [sx, sy] = stars[i];
    const tw = Math.sin(tick * 0.08 + i * 1.5);
    if (tw > 0.2) {
      ctx.save();
      ctx.globalAlpha = tw * 0.8;
      px(ctx, sx, sy, 2, 2, '#fef9c3');
      ctx.restore();
    }
  }

  // 2. Dancing flames on wall torches & brass Nilavilakku beside Poothara altar
  drawOilLampFlame(ctx, 14, 150, tick, 0.5, 0.9);
  drawOilLampFlame(ctx, 626, 150, tick, 2.2, 0.9);
  drawOilLampFlame(ctx, 247, 206, tick, 1.3, 0.95);
  drawOilLampFlame(ctx, 391, 206, tick, 3.6, 0.95);

  // Warm terracotta floor lamp sheen & floating golden embers across pit
  const floorAlpha = (excitement > 25 ? 0.22 : 0.14) + Math.sin(tick * 0.16) * 0.04;
  drawPixelHalo(ctx, 247, 276, 30, '#f59e0b', floorAlpha);
  drawPixelHalo(ctx, 391, 276, 30, '#f59e0b', floorAlpha);

  const emberCount = excitement > 25 ? 10 : 6;
  for (let e = 0; e < emberCount; e++) {
    const ex = 80 + ((e * 73 + Math.sin(tick * 0.05 + e) * 18) % 480);
    const ey = 290 - ((tick * 0.42 + e * 21) % 108);
    ctx.save();
    ctx.globalAlpha = 0.45 * (1 - (290 - ey) / 115);
    px(ctx, ex, ey, 2, 2, e % 2 === 0 ? '#fde047' : '#fb923c');
    ctx.restore();
  }
}

const LIVE_STAGE_RENDERERS = {
  alappuzha: drawLiveAlappuzhaStage,
  fortkochi: drawLiveFortKochiStage,
  thrissur: drawLiveThrissurStage,
  munnar: drawLiveMunnarStage,
  kovalam: drawLiveKovalamStage,
  kalari: drawLiveKalariStage,
};

const FALLBACK_STAGE_RENDERERS = {
  alappuzha: drawAlappuzhaStage,
  fortkochi: drawFortKochiStage,
  thrissur: drawThrissurStage,
  munnar: drawMunnarStage,
  kovalam: drawKovalamStage,
  kalari: drawKalariStage,
};

export function drawStageBackground(ctx, state, tick) {
  const stageId = state.stageId;
  const excitement = state.crowdExcitement || 0;

  const img = getStageImage(stageId);
  if (img) {
    const liveDrawer = LIVE_STAGE_RENDERERS[stageId] || drawLiveAlappuzhaStage;
    liveDrawer(ctx, img, tick, excitement);
    return;
  }

  // Fallback for Node unit tests
  const fallbackDrawer = FALLBACK_STAGE_RENDERERS[stageId] || drawAlappuzhaStage;
  fallbackDrawer(ctx, tick, excitement);
}

function drawAlappuzhaStage(ctx, tick, excitement) {
  // Crisp Tropical Sky & Cumulus Clouds (right half open like SF2 Harbor!)
  px(ctx, 0, 0, ARENA.WIDTH, 32, '#0284c7');
  ditherBand(ctx, 0, 28, ARENA.WIDTH, 14, '#0284c7', '#38bdf8', 0.5);
  px(ctx, 0, 42, ARENA.WIDTH, 34, '#38bdf8');
  ditherBand(ctx, 0, 72, ARENA.WIDTH, 14, '#38bdf8', '#bae6fd', 0.5);
  px(ctx, 0, 86, ARENA.WIDTH, 28, '#bae6fd');

  drawCumulusCloud(ctx, 294, 46, 52);
  drawCumulusCloud(ctx, 336, 74, 44);

  // Vembanad Backwaters on right side + Coconut Palm Island + Racing Snake Boat
  px(ctx, 270, 108, 114, 62, '#0c4a6e');
  ditherBand(ctx, 270, 108, 114, 10, '#0369a1', '#0c4a6e', 0.5);
  for (let i = 0; i < 16; i++) {
    const rx = 276 + ((i * 23 + Math.floor(tick * 0.5)) % 102);
    const ry = 112 + (i * 5) % 44;
    px(ctx, rx, ry, 10 + (i % 6), 1, i % 2 === 0 ? '#e0f2fe' : '#38bdf8');
  }
  drawPalmTree(ctx, 366, 118, 42, Math.sin(tick * 0.03) * 2.5, 0.85);
  const snakeX = 272 + ((tick * 0.38) % 120);
  px(ctx, snakeX, 114, 44, 3, '#451a03');
  px(ctx, snakeX + 39, 107, 4, 8, '#78350f');

  // HERO KETTUVALLAM HOUSEBOAT (Massive SF2-clarity boat wall x=0..288!)
  const bob = Math.round(Math.sin(tick * 0.045) * 1);
  const bx = 0;
  const by = 40 + bob;

  // Upper Bamboo Arch Cabin & Funnel
  px(ctx, 184, 14 + bob, 28, 42, '#475569'); // Mast/Funnel
  px(ctx, 186, 14 + bob, 8, 42, '#94a3b8');
  px(ctx, 0, 18 + bob, 166, 36, '#9a3412');
  px(ctx, 0, 20 + bob, 164, 32, '#c2410c');
  for (let wx = 8; wx < 160; wx += 14) {
    px(ctx, wx, 20 + bob, 2, 32, '#7c2d12');
  }

  // Upper Deck Spectators
  drawLargeSpectator(ctx, 64, 58 + bob, { shirt: '#65a30d', shirtHi: '#84cc16', shirtSh: '#3f6212', pants: '#44403c', skin: '#c68642', hat: 'cap' }, tick, excitement);
  drawLargeSpectator(ctx, 128, 58 + bob, { shirt: '#78716c', shirtHi: '#a8a29e', shirtSh: '#44403c', pants: '#292524', skin: '#b8763e' }, tick, excitement);

  // Upper Safety Rail + SF2 Red/White Life Rings!
  px(ctx, 0, 44 + bob, 252, 2, '#f8fafc');
  px(ctx, 0, 51 + bob, 252, 2, '#cbd5e1');
  for (let rx = 8; rx < 250; rx += 14) {
    px(ctx, rx, 45 + bob, 2, 16, '#e2e8f0');
  }
  drawLifeRing(ctx, 20, 55 + bob);
  drawLifeRing(ctx, 162, 55 + bob);

  // Main Boat Wall (Rich Maroon-Teak + Woven Bamboo Trim + Beveled Portholes)
  px(ctx, bx, 60 + bob, 286, 94, '#100c14');
  px(ctx, bx, 61 + bob, 284, 92, '#881337'); // Rich Kerala lacquer red-maroon
  px(ctx, bx, 61 + bob, 284, 6, '#e11d48');
  px(ctx, bx, 67 + bob, 284, 3, '#facc15'); // Gold Kasavu trim line!

  // Riveted Teak Cabin Door on Left (SF2 boat homage!)
  px(ctx, 44, 84 + bob, 32, 66, '#100c14');
  px(ctx, 46, 86 + bob, 28, 62, '#9f1239');
  px(ctx, 48, 88 + bob, 24, 58, '#be123c');
  px(ctx, 51, 92 + bob, 18, 22, '#881337');
  px(ctx, 51, 118 + bob, 18, 22, '#881337');
  px(ctx, 68, 114 + bob, 3, 5, '#fde047'); // Brass handle

  // Portholes with steel rims & glass glare
  for (const pxX of [22, 92, 134, 178, 222, 260]) {
    drawPorthole(ctx, pxX, 79 + bob);
  }

  // 5 LARGE EXPRESSIVE MALLU SPECTATORS standing behind main deck rail!
  drawLargeSpectator(ctx, 108, 138 + bob, { shirt: '#4d7c0f', shirtHi: '#84cc16', shirtSh: '#365314', pants: '#1e293b', skin: '#b8763e', prop: 'thorthu' }, tick, excitement);
  drawLargeSpectator(ctx, 140, 138 + bob, { shirt: '#f8fafc', shirtHi: '#ffffff', shirtSh: '#cbd5e1', pants: '#334155', skin: '#c68642', hat: 'cap' }, tick, excitement);
  drawLargeSpectator(ctx, 178, 138 + bob, { shirt: '#db2777', shirtHi: '#f472b6', shirtSh: '#9d174d', pants: '#fef3c7', skin: '#c98a4b', isWoman: true }, tick, excitement);
  drawLargeSpectator(ctx, 214, 138 + bob, { shirt: '#0284c7', shirtHi: '#38bdf8', shirtSh: '#0369a1', pants: '#78350f', skin: '#a1622b', prop: 'camera' }, tick, excitement);
  drawLargeSpectator(ctx, 256, 138 + bob, { shirt: '#ea580c', shirtHi: '#fb923c', shirtSh: '#9a3412', pants: '#f8fafc', skin: '#b8763e', prop: 'thorthu' }, tick, excitement);

  // Crisp White & Gold Boat Gunwale & Waterline Trim
  px(ctx, 0, 148 + bob, 294, 4, '#f8fafc');
  px(ctx, 0, 152 + bob, 292, 10, '#cbd5e1');
  px(ctx, 0, 162 + bob, 290, 8, '#64748b');

  // Foreground Beveled Stone Dock (matches SF2 dock tiles!)
  drawSf2PerspectiveFloor(ctx, {
    base: '#a88b6d',
    tileAlt: '#94785b',
    dark: '#5c4632',
    grout: '#3b2c1e',
    bevelHi: '#e7d8c5',
    trim: '#d6c3ac',
    trimHi: '#fffbeb',
    showBollards: true,
  });
}

function drawFortKochiStage(ctx, tick, excitement) {
  // Sunset Sky
  px(ctx, 0, 0, ARENA.WIDTH, 28, '#9a3412');
  ditherBand(ctx, 0, 24, ARENA.WIDTH, 14, '#9a3412', '#ea580c', 0.5);
  px(ctx, 0, 38, ARENA.WIDTH, 32, '#ea580c');
  ditherBand(ctx, 0, 66, ARENA.WIDTH, 14, '#f97316', '#fbbf24', 0.5);
  px(ctx, 0, 80, ARENA.WIDTH, 34, '#fbbf24');

  // Glowing Sun over Arabian Sea on right
  drawPixelHalo(ctx, 316, 86, 38, '#fef08a', 0.28);
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(316, 86, 22, 0, Math.PI * 2);
  ctx.fill();

  // Sea waves + golden sun column
  px(ctx, 236, 110, 148, 60, '#1e3a8a');
  for (let y = 112; y < 166; y += 3) {
    const w = Math.max(8, 36 - (y - 112) * 0.5 + Math.sin(tick * 0.14 + y) * 5);
    px(ctx, 316 - w / 2, y, w, 2, y % 6 === 0 ? '#fef08a' : '#f97316');
  }

  // Large Cheena Vala (Chinese Fishing Nets) silhouettes
  const netDip = Math.sin(tick * 0.025) * 6;
  ctx.strokeStyle = '#110c14';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(270, 166);
  ctx.lineTo(292, 74 + netDip);
  ctx.lineTo(342, 128 + netDip * 1.4);
  ctx.moveTo(292, 74 + netDip);
  ctx.lineTo(256, 118 + netDip);
  ctx.stroke();

  // LARGE A1 NAADAN CHAYAKKADA (x=12..246, y=42..170)
  const tx = 14;
  const ty = 52;
  px(ctx, tx - 2, ty - 2, 234, 120, '#100c14');
  px(ctx, tx, ty, 230, 118, '#78350f');
  px(ctx, tx + 6, ty + 18, 218, 100, '#451a03');
  // Corrugated red roof + yellow awning
  px(ctx, tx - 8, ty - 10, 246, 16, '#100c14');
  px(ctx, tx - 6, ty - 8, 242, 11, '#dc2626');
  px(ctx, tx - 6, ty + 3, 242, 4, '#facc15');
  for (let rx = tx; rx < tx + 232; rx += 10) {
    px(ctx, rx, ty - 8, 2, 11, '#991b1b');
  }

  // Hanging glowing tungsten bulbs
  for (const lx of [tx + 34, tx + 115, tx + 196]) {
    drawPixelHalo(ctx, lx, ty + 15, 18, '#fde047', 0.25);
    px(ctx, lx - 2, ty + 10, 4, 5, '#fef08a');
  }

  // Signboard
  px(ctx, tx + 44, ty - 22, 142, 16, '#100c14');
  px(ctx, tx + 45, ty - 21, 140, 14, '#fef08a');
  px(ctx, tx + 47, ty - 19, 136, 10, '#b91c1c');
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 7px monospace';
  ctx.fillText('A1 NAADAN CHAYAKKADA', tx + 56, ty - 11);

  // Hanging Nendran banana bunches
  for (const bx of [tx + 18, tx + 210]) {
    px(ctx, bx, ty + 10, 4, 18, '#15803d');
    for (let k = 0; k < 5; k++) {
      px(ctx, bx - 5, ty + 14 + k * 4, 12, 3, '#100c14');
      px(ctx, bx - 4, ty + 14 + k * 4, 10, 2, '#facc15');
    }
  }

  // Large Samovar Boiler + Glass Snack Jars
  px(ctx, tx + 168, ty + 48, 22, 34, '#100c14');
  px(ctx, tx + 169, ty + 49, 20, 32, '#cbd5e1');
  px(ctx, tx + 172, ty + 49, 6, 32, '#ffffff');
  for (let s = 0; s < 3; s++) {
    const sy = ty + 38 - ((tick * 0.4 + s * 7) % 16);
    px(ctx, tx + 177 + Math.sin(tick * 0.1 + s) * 2, sy, 4, 4, 'rgba(255,255,255,0.65)');
  }
  for (const jx of [tx + 54, tx + 80, tx + 106]) {
    px(ctx, jx, ty + 58, 16, 22, '#bae6fd');
    px(ctx, jx + 2, ty + 55, 12, 3, '#dc2626');
    px(ctx, jx + 3, ty + 65, 10, 10, '#eab308');
    px(ctx, jx + 3, ty + 60, 3, 12, '#ffffff');
  }

  // Large Chettan pouring Meter Chaya + Spectators!
  drawLargeSpectator(ctx, tx + 142, ty + 84, { shirt: '#f8fafc', shirtHi: '#ffffff', shirtSh: '#cbd5e1', pants: '#2563eb', skin: '#b8763e' }, tick, excitement);
  if (Math.floor(tick / 16) % 2 === 0) {
    px(ctx, tx + 128, ty + 54, 3, 22, '#f59e0b');
    px(ctx, tx + 127, ty + 53, 5, 4, '#fef3c7');
  }
  drawLargeSpectator(ctx, tx + 38, ty + 96, { shirt: '#eab308', shirtHi: '#fef08a', shirtSh: '#ca8a04', pants: '#f8fafc', skin: '#a1622b', prop: 'thorthu' }, tick, excitement);

  // Large Yellow-Black Kochi Auto on Right
  const ax = 286;
  const ay = 132;
  px(ctx, ax - 2, ay - 14, 54, 50, '#100c14');
  px(ctx, ax, ay, 50, 34, '#facc15');
  px(ctx, ax + 6, ay - 12, 36, 15, '#18181b');
  px(ctx, ax + 9, ay - 9, 14, 9, '#7dd3fc');
  px(ctx, ax + 3, ay + 16, 44, 16, '#18181b');
  px(ctx, ax + 6, ay + 30, 11, 11, '#09090b');
  px(ctx, ax + 34, ay + 30, 11, 11, '#09090b');
  drawPixelHalo(ctx, ax - 4, ay + 20, 14, '#fef08a', 0.3);

  drawSf2PerspectiveFloor(ctx, {
    base: '#6b645c',
    tileAlt: '#575049',
    dark: '#38332e',
    grout: '#1c1917',
    bevelHi: '#a8a29e',
    trim: '#94a3b8',
    trimHi: '#e2e8f0',
    warmLampXs: [tx + 34, tx + 196, ax - 4],
  });
}

function drawThrissurStage(ctx, tick, excitement) {
  px(ctx, 0, 0, ARENA.WIDTH, 34, '#020617');
  ditherBand(ctx, 0, 30, ARENA.WIDTH, 16, '#020617', '#0f172a', 0.5);
  px(ctx, 0, 46, ARENA.WIDTH, 36, '#0f172a');
  ditherBand(ctx, 0, 78, ARENA.WIDTH, 16, '#0f172a', '#1e1b4b', 0.5);
  px(ctx, 0, 94, ARENA.WIDTH, 76, '#1e1b4b');

  // Stars & Pooram Fireworks
  for (let i = 0; i < 30; i++) {
    const sx = (i * 53 + 17) % ARENA.WIDTH;
    const sy = (i * 29 + 8) % 92;
    if ((Math.floor(tick / 14) + i) % 3 !== 0) px(ctx, sx, sy, 1, 1, '#fef9c3');
  }
  const fwColors = ['#fde047', '#f472b6', '#38bdf8', '#fb923c'];
  for (let f = 0; f < 3; f++) {
    const cycle = (tick + f * 35) % 90;
    const fx = 76 + f * 116;
    const fy = 36 + (f % 2) * 16;
    const col = fwColors[(f + Math.floor(tick / 90)) % fwColors.length];
    if (cycle < 45) {
      drawPixelHalo(ctx, fx, fy, 28, col, Math.max(0.05, 0.28 - cycle * 0.005));
      const rad = cycle * 0.7;
      for (let a = 0; a < 10; a++) {
        const ang = (a * Math.PI) / 5;
        px(ctx, fx + Math.cos(ang) * rad, fy + Math.sin(ang) * rad, 2, 2, col);
      }
    }
  }

  // Illuminated Temple Gopuram
  px(ctx, 144, 66, 96, 104, '#09090b');
  px(ctx, 146, 68, 92, 102, '#1e1b4b');
  px(ctx, 158, 50, 68, 20, '#312e81');
  px(ctx, 172, 36, 40, 16, '#4338ca');
  for (const kx of [183, 191, 199]) px(ctx, kx, 24, 3, 12, '#fde047');

  // 2 LARGE CAPARISONED TEMPLE ELEPHANTS!
  for (const [ex, umbColor, umbTrim] of [[18, '#dc2626', '#facc15'], [312, '#7c3aed', '#fde047']]) {
    const sway = Math.round(Math.sin(tick * 0.06 + ex) * 2);
    px(ctx, ex - 2, 102, 56, 68, '#09090b');
    px(ctx, ex, 104, 52, 52, '#334155');
    px(ctx, ex + 4, 104, 14, 48, '#475569');
    px(ctx, ex + 6, 142, 14, 28, '#1e293b');
    px(ctx, ex + 32, 142, 14, 28, '#1e293b');
    // Trunk & Ivory Tusks
    px(ctx, ex + 22 + sway, 134, 8, 28, '#475569');
    px(ctx, ex + 13, 132, 5, 12, '#ffffff');
    px(ctx, ex + 34, 132, 5, 12, '#ffffff');
    // Ornate Nettipattam gold plate
    px(ctx, ex + 12, 96, 28, 34, '#ca8a04');
    px(ctx, ex + 15, 99, 22, 28, '#fde047');
    px(ctx, ex + 20, 106, 12, 12, '#dc2626');
    px(ctx, ex + 23, 109, 6, 6, '#ffffff');
    // Colorful Kudamattam Royal Umbrella
    px(ctx, ex + 25, 62 + sway, 3, 38, '#e2e8f0');
    px(ctx, ex - 4, 52 + sway, 60, 16, '#09090b');
    px(ctx, ex - 2, 54 + sway, 56, 13, umbColor);
    px(ctx, ex + 4, 50 + sway, 44, 5, umbTrim);
    px(ctx, ex - 2, 66 + sway, 56, 3, '#fde047');
  }

  // Large Chenda Melam Drummers in Center!
  for (const dx of [118, 166, 218, 266]) {
    drawLargeSpectator(ctx, dx, 152, { shirt: '#f8fafc', shirtHi: '#ffffff', shirtSh: '#cbd5e1', pants: '#f8fafc', skin: '#b8763e' }, tick, excitement);
    const beat = Math.sin(tick * (excitement > 30 ? 0.5 : 0.22) + dx) > 0;
    px(ctx, dx - 9, 138, 18, 13, '#100c14');
    px(ctx, dx - 8, 139, 16, 11, '#92400e');
    px(ctx, dx - 8, 139, 16, 3, '#fef3c7');
    px(ctx, dx + 8, beat ? 126 : 138, 7, 2, '#fde047');
  }

  const lampXs = [86, 192, 298];
  for (const lx of lampXs) {
    drawPixelHalo(ctx, lx, 146, 18, '#f97316', 0.34);
    px(ctx, lx - 5, 165, 10, 6, '#09090b');
    px(ctx, lx - 4, 166, 8, 4, '#eab308');
    px(ctx, lx - 2, 152, 4, 14, '#ca8a04');
    px(ctx, lx - 5, 149, 10, 4, '#fde047');
    const flicker = (Math.floor(tick / 4) + lx) % 2 === 0;
    px(ctx, lx - 2, 143 - (flicker ? 1 : 0), 4, 6, '#f97316');
    px(ctx, lx - 1, 144, 2, 4, '#ffffff');
  }

  drawSf2PerspectiveFloor(ctx, {
    base: '#475569',
    tileAlt: '#334155',
    dark: '#1e293b',
    grout: '#0f172a',
    bevelHi: '#94a3b8',
    trim: '#eab308',
    trimHi: '#fef08a',
    warmLampXs: lampXs,
  });
}

function drawMunnarStage(ctx, tick, excitement) {
  // Emerald mountain morning sky
  px(ctx, 0, 0, ARENA.WIDTH, 32, '#0284c7');
  ditherBand(ctx, 0, 28, ARENA.WIDTH, 16, '#0284c7', '#38bdf8', 0.5);
  px(ctx, 0, 44, ARENA.WIDTH, 34, '#67e8f9');
  ditherBand(ctx, 0, 74, ARENA.WIDTH, 16, '#67e8f9', '#bbf7d0', 0.5);

  // Rolling Western Ghats tea hills + mist bands
  px(ctx, 180, 62, 204, 108, '#065f46');
  px(ctx, 238, 48, 146, 122, '#047857');
  px(ctx, 110, 96, 274, 74, '#15803d');
  for (let row = 0; row < 5; row++) {
    px(ctx, 125 + row * 12, 112 + row * 11, 250 - row * 12, 5, row % 2 === 0 ? '#22c55e' : '#16a34a');
  }
  // Distant cascading waterfall
  px(ctx, 328, 66, 14, 72, '#bae6fd');
  px(ctx, 331, 66 + (tick % 8), 4, 60, '#ffffff');
  drawCumulusCloud(ctx, 210 + ((tick * 0.2) % 90), 86, 56);

  // Carved Kerala Tea Pavilion on Left + Neelakurinji flowers
  px(ctx, 0, 20, 128, 150, '#451a03');
  px(ctx, 0, 20, 138, 18, '#92400e');
  px(ctx, 92, 46, 8, 124, '#78350f');
  drawPixelHalo(ctx, 112, 58, 16, '#fde047', 0.28);
  px(ctx, 109, 52, 6, 10, '#facc15');
  for (let f = 0; f < 14; f++) {
    px(ctx, 16 + f * 18, 138 + (f % 3) * 6, 6, 5, '#a855f7');
    px(ctx, 18 + f * 18, 139 + (f % 3) * 6, 3, 2, '#e9d5ff');
  }
  drawLargeSpectator(ctx, 64, 150, { shirt: '#10b981', shirtHi: '#34d399', shirtSh: '#047857', isWoman: true }, tick, excitement);

  drawSf2PerspectiveFloor(ctx, {
    base: '#475569',
    tileAlt: '#334155',
    dark: '#1e293b',
    grout: '#0f172a',
    bevelHi: '#cbd5e1',
    trim: '#92400e',
    trimHi: '#d97706',
    warmLampXs: [112],
  });
}

function drawKovalamStage(ctx, tick, excitement) {
  // Twilight purple-amber coastal sky
  px(ctx, 0, 0, ARENA.WIDTH, 30, '#3b0764');
  ditherBand(ctx, 0, 26, ARENA.WIDTH, 14, '#3b0764', '#7e22ce', 0.5);
  px(ctx, 0, 40, ARENA.WIDTH, 32, '#db2777');
  ditherBand(ctx, 0, 68, ARENA.WIDTH, 16, '#db2777', '#fb923c', 0.5);
  px(ctx, 0, 84, ARENA.WIDTH, 32, '#fdba74');

  // Red-and-white striped Kovalam Lighthouse on left rock headland
  px(ctx, 0, 106, 98, 64, '#292524');
  for (let seg = 0; seg < 6; seg++) {
    px(ctx, 44, 24 + seg * 14, 20, 14, seg % 2 === 0 ? '#dc2626' : '#f8fafc');
  }
  drawPixelHalo(ctx, 54, 18, 18, '#fef08a', 0.35);
  px(ctx, 48, 13, 12, 10, '#fde047');

  // Arabian Sea surf & sunset palm silhouettes
  px(ctx, 98, 114, 286, 56, '#1e3a8a');
  for (let w = 0; w < 8; w++) {
    const wy = 120 + w * 6;
    px(ctx, 130 + ((tick + w * 24) % 180), wy, 28, 2, w % 2 === 0 ? '#fef08a' : '#f8fafc');
  }
  drawPalmTree(ctx, 344, 152, 62, Math.sin(tick * 0.04) * 3, 1.0);
  drawLargeSpectator(ctx, 168, 154, { shirt: '#0284c7', shirtHi: '#38bdf8', shirtSh: '#0369a1' }, tick, excitement);

  drawSf2PerspectiveFloor(ctx, {
    base: '#64748b',
    tileAlt: '#475569',
    dark: '#334155',
    grout: '#1e293b',
    bevelHi: '#cbd5e1',
    trim: '#f59e0b',
    trimHi: '#fde047',
    warmLampXs: [32, 192, 336],
  });
}

function drawKalariStage(ctx, tick, excitement) {
  // Open starry sky above Kalari courtyard
  px(ctx, 0, 0, ARENA.WIDTH, 50, '#020617');
  ditherBand(ctx, 0, 36, ARENA.WIDTH, 18, '#020617', '#1e1b4b', 0.5);
  for (let s = 0; s < 14; s++) {
    px(ctx, 90 + ((s * 29) % 200), 8 + (s % 5) * 6, 1, 1, '#fef9c3');
  }

  // Laterite wall, carved teak eaves & columns
  px(ctx, 0, 50, ARENA.WIDTH, 120, '#451a03');
  px(ctx, 88, 56, 208, 114, '#7c2d12');
  for (const colX of [18, 72, 304, 358]) {
    px(ctx, colX, 24, 14, 146, '#291203');
    px(ctx, colX + 2, 24, 5, 146, '#78350f');
  }

  // Sacred 7-stepped Poothara stone altar in center + twin Nilavilakku
  for (let step = 0; step < 6; step++) {
    const sw = 84 - step * 11;
    px(ctx, 192 - sw / 2, 156 - step * 12, sw, 11, step % 2 === 0 ? '#9a3412' : '#b45309');
  }
  for (const lx of [128, 256]) {
    drawPixelHalo(ctx, lx, 134, 18, '#f97316', excitement > 25 ? 0.36 : 0.25);
    px(ctx, lx - 2, 136, 4, 30, '#eab308');
    px(ctx, lx - 5, 162, 10, 6, '#ca8a04');
    px(ctx, lx - 2, 129 - (tick % 3), 4, 7, '#fde047');
  }
  drawLargeSpectator(ctx, 52, 154, { shirt: '#f8fafc', shirtHi: '#ffffff', shirtSh: '#cbd5e1' }, tick, excitement);

  drawSf2PerspectiveFloor(ctx, {
    base: '#9a3412',
    tileAlt: '#7c2d12',
    dark: '#431407',
    grout: '#290d03',
    bevelHi: '#ea580c',
    trim: '#d97706',
    trimHi: '#fde047',
    warmLampXs: [128, 256],
  });
}
