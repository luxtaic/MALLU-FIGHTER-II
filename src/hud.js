/**
 * High-Clarity 16-bit CPS-2 / SF2 Arcade HUD:
 * Native 640x360 crisp typography, beveled health gauges, glowing KO crest,
 * Nilavilakku win lamps, Fighter & Audience Speech Bubbles, and Super Cut-In.
 */

import { ARENA } from './engine.js';
import { getMalayalamLine } from './characters.js';
import { drawPortrait } from './sprites.js';
import { drawPixelHalo } from './pixel.js';

function fontFor(text, size) {
  const pxSize = Math.max(6, Math.round(size));
  return /[\u0D00-\u0D7F]/.test(text)
    ? `bold ${pxSize}px "Nirmala UI", "Noto Sans Malayalam", "Kartika", sans-serif`
    : `bold ${pxSize}px monospace`;
}

function shadowText(ctx, text, x, y, color = '#ffffff', size = 11, align = 'left') {
  ctx.font = fontFor(text, size);
  ctx.textAlign = align;
  ctx.fillStyle = '#09090b';
  ctx.fillText(text, Math.round(x) + 1, Math.round(y) + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y));
  ctx.textAlign = 'left';
}

function drawNilavilakkuWinIcon(ctx, x, y, lit, S) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (lit) drawPixelHalo(ctx, rx, ry - 4 * S, 8 * S, '#f97316', 0.38);
  ctx.fillStyle = '#09090b';
  ctx.fillRect(rx - 4 * S, ry + 2 * S, 8 * S, 4 * S);
  ctx.fillStyle = lit ? '#eab308' : '#475569';
  ctx.fillRect(rx - 3 * S, ry + 3 * S, 6 * S, 2 * S);
  ctx.fillRect(rx - 1 * S, ry - 1 * S, 2 * S, 4 * S);
  ctx.fillRect(rx - 3 * S, ry - 2 * S, 6 * S, 2 * S);
  if (lit) {
    ctx.fillStyle = '#f97316';
    ctx.fillRect(rx - 1 * S, ry - 5 * S, 2 * S, 3 * S);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(rx, ry - 4 * S, 1 * S, 2 * S);
  }
}

function wrapParagraph(ctx, text, maxW, fontSize) {
  ctx.font = fontFor(text, fontSize);
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxW && current) {
      lines.push({ text: current, font: ctx.font });
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push({ text: current, font: ctx.font });
  return lines;
}

function drawWrappedBubble(ctx, anchorX, anchorY, text, bg, border, S, maxW, canvasW, labelTag = null) {
  const mlText = getMalayalamLine(text);
  const mlSize = Math.max(6, Math.round(6.8 * S));
  const enSize = Math.max(5.5, Math.round(5.4 * S));

  const lines = [];
  if (mlText) {
    for (const l of wrapParagraph(ctx, mlText, maxW, mlSize)) {
      lines.push({ ...l, color: '#09090b' });
    }
  }
  const cleanEn = text.replace(/^[A-Z0-9 ]+:\s*/, '');
  for (const l of wrapParagraph(ctx, cleanEn, maxW, enSize)) {
    lines.push({ ...l, color: mlText ? '#334155' : '#09090b' });
  }

  const lineH = Math.round(9.2 * S);
  const padX = Math.round(6 * S);
  let measuredMax = 40;
  for (const l of lines) {
    ctx.font = l.font;
    measuredMax = Math.max(measuredMax, ctx.measureText(l.text).width);
  }
  const boxW = Math.min(maxW + padX * 2, measuredMax + padX * 2);
  const tagH = labelTag ? Math.round(8.5 * S) : 0;
  const boxH = lines.length * lineH + Math.round(6 * S) + tagH;

  const bx = Math.max(8, Math.min(canvasW - boxW - 8, Math.round(anchorX - boxW / 2)));
  const by = Math.max(Math.round(38 * S), Math.round(anchorY - boxH));

  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.fillRect(bx + 2, by + 2, boxW + 2, boxH + 2);
  ctx.fillStyle = border;
  ctx.fillRect(bx - 1, by - 1, boxW + 2, boxH + 2);
  ctx.fillStyle = bg;
  ctx.fillRect(bx, by, boxW, boxH);

  const tipX = Math.max(bx + 8, Math.min(bx + boxW - 8, Math.round(anchorX)));
  ctx.fillStyle = border;
  ctx.fillRect(tipX - 3, by + boxH + 1, 7, 4);
  ctx.fillStyle = bg;
  ctx.fillRect(tipX - 2, by + boxH, 5, 4);

  if (labelTag) {
    ctx.fillStyle = border;
    ctx.fillRect(bx, by, boxW, tagH);
    ctx.fillStyle = '#ffffff';
    ctx.font = fontFor(labelTag, Math.max(5, Math.round(5.2 * S)));
    ctx.fillText(labelTag, bx + padX, by + Math.round(6.4 * S));
  }

  lines.forEach((line, idx) => {
    ctx.fillStyle = line.color;
    ctx.font = line.font;
    ctx.fillText(line.text, bx + padX, by + tagH + Math.round(9.5 * S) + idx * lineH);
  });
}

function drawBeveledHealthBar(ctx, x, y, w, h, hpRatio, trailRatio, drainFromLeft, tick, isDanger) {
  ctx.fillStyle = '#09090b';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x - 1, y + h, w + 2, 1);

  ctx.fillStyle = '#991b1b';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(x, y + 1, w, h - 2);

  const trailW = Math.round(Math.max(0, trailRatio) * w);
  const fillW = Math.round(Math.max(0, hpRatio) * w);
  const fillCol = isDanger && tick % 10 < 5 ? '#fef08a' : '#facc15';

  if (drainFromLeft) {
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(x + (w - trailW), y, trailW, h);
    ctx.fillStyle = fillCol;
    ctx.fillRect(x + (w - fillW), y, fillW, h);
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(x + (w - fillW), y + 1, fillW, Math.max(2, Math.round(h * 0.22)));
  } else {
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(x, y, trailW, h);
    ctx.fillStyle = fillCol;
    ctx.fillRect(x, y, fillW, h);
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(x, y + 1, fillW, Math.max(2, Math.round(h * 0.22)));
  }

  ctx.fillStyle = 'rgba(9, 9, 11, 0.22)';
  const step = Math.max(16, Math.round(w / 8));
  for (let gx = step; gx < w; gx += step) {
    ctx.fillRect(x + gx, y, 1, h);
  }
}

export function drawHud(ctx, state, hiScore = 15000, tick = 0, canvasW = ARENA.WIDTH) {
  const S = canvasW / ARENA.WIDTH;
  const W = ARENA.WIDTH * S;
  const H = ARENA.HEIGHT * S;
  const [f1, f2] = state.fighters;

  // Top Score Strip (1P / HI / 2P)
  shadowText(ctx, '1P', 12 * S, 10 * S, '#facc15', 7 * S);
  shadowText(ctx, String(f1.score).padStart(6, '0'), 28 * S, 10 * S, '#ffffff', 7 * S);
  shadowText(ctx, 'HI', 152 * S, 10 * S, '#f97316', 7 * S);
  shadowText(ctx, String(Math.max(hiScore, f1.score, f2.score)).padStart(6, '0'), 166 * S, 10 * S, '#fde047', 7 * S);
  shadowText(ctx, '2P', 310 * S, 10 * S, '#38bdf8', 7 * S);
  shadowText(ctx, String(f2.score).padStart(6, '0'), 326 * S, 10 * S, '#ffffff', 7 * S);

  // Beveled Health Bars converging on center KO crest
  const barY = Math.round(14 * S);
  const barH = Math.round(9 * S);
  const barW = Math.round(156 * S);
  const p1BarX = Math.round(18 * S);
  const p2BarX = Math.round(W - 18 * S - barW);

  drawBeveledHealthBar(ctx, p1BarX, barY, barW, barH, f1.hp / f1.maxHp, f1.trailHp / f1.maxHp, true, tick, f1.hp <= f1.maxHp * 0.25);
  drawBeveledHealthBar(ctx, p2BarX, barY, barW, barH, f2.hp / f2.maxHp, f2.trailHp / f2.maxHp, false, tick, f2.hp <= f2.maxHp * 0.25);

  // Ornate Center KO Crest Badge
  const koX = Math.round(177 * S);
  const koY = Math.round(11 * S);
  const koW = Math.round(30 * S);
  const koH = Math.round(15 * S);
  ctx.fillStyle = '#09090b';
  ctx.fillRect(koX, koY, koW, koH);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(koX + 1, koY + 1, koW - 2, koH - 2);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(koX + 2, koY + 2, koW - 4, koH - 4);
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(koX + 2, koY + 2, koW - 4, 3);
  shadowText(ctx, 'KO', 192 * S, 21.5 * S, '#fde047', 8 * S, 'center');

  // Round Countdown Timer
  const timerColor = state.timer <= 15 ? '#ef4444' : '#fb923c';
  shadowText(ctx, String(state.timer).padStart(2, '0'), 192 * S, 35 * S, timerColor, 10 * S, 'center');

  // Fighter Names (Malayalam + English) + Nilavilakku Round Win Lamps
  shadowText(ctx, `${f1.def.mlName} · ${f1.def.name}`, 18 * S, 33 * S, '#fde047', 6.8 * S);
  drawNilavilakkuWinIcon(ctx, 166 * S, 29 * S, f1.roundsWon >= 1, S);
  drawNilavilakkuWinIcon(ctx, 156 * S, 29 * S, f1.roundsWon >= 2, S);

  shadowText(ctx, `${f2.def.name} · ${f2.def.mlName}`, W - 18 * S, 33 * S, '#fde047', 6.8 * S, 'right');
  drawNilavilakkuWinIcon(ctx, W - 166 * S, 29 * S, f2.roundsWon >= 1, S);
  drawNilavilakkuWinIcon(ctx, W - 156 * S, 29 * S, f2.roundsWon >= 2, S);

  drawActiveBuffBadges(ctx, f1, 18 * S, 41 * S, false, S);
  drawActiveBuffBadges(ctx, f2, W - 18 * S, 41 * S, true, S);

  // Bottom MASS METER Bars
  drawMassMeter(ctx, f1, 14 * S, H - 12 * S, false, tick, S);
  drawMassMeter(ctx, f2, W - (14 + 116) * S, H - 12 * S, true, tick, S);

  // Audience Reaction Speech Bubble over the cheering spectators!
  if (state.audienceBubble) {
    const ab = state.audienceBubble;
    drawWrappedBubble(
      ctx,
      ab.x * S,
      ab.y * S,
      ab.text,
      '#e0f2fe',
      '#0284c7',
      S,
      165 * S,
      W,
      'ജനക്കൂട്ടം · AUDIENCE'
    );
  }

  // Fighter Dialogue & Power-Up Bubbles
  for (const f of [f1, f2]) {
    const sp = f.speech;
    if (!sp || !sp.text) continue;
    const bg = sp.type === 'powerup' ? '#fef08a' : sp.type === 'super' ? '#fde047' : '#ffffff';
    const border = sp.type === 'powerup' ? '#15803d' : sp.type === 'super' ? '#b91c1c' : '#0f172a';
    drawWrappedBubble(
      ctx,
      f.x * S,
      (f.y - 84) * S,
      sp.text,
      bg,
      border,
      S,
      142 * S,
      W
    );
  }

  // Floating Popups
  for (const pp of state.popups) {
    shadowText(ctx, pp.text, pp.x * S, pp.y * S, pp.color, 7 * S, 'center');
  }

  // Power-Up Dialogue Toast (Malayalam + Manglish)
  if (state.powerupBanner) {
    const pb = state.powerupBanner;
    const mlLine = getMalayalamLine(pb.dialogue);
    const bx = Math.round(46 * S);
    const by = Math.round(H - 42 * S);
    const bw = Math.round(W - 92 * S);
    const bh = Math.round(28 * S);
    ctx.fillStyle = 'rgba(9, 13, 26, 0.92)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = pb.color;
    ctx.lineWidth = Math.max(1, Math.round(S));
    ctx.strokeRect(bx, by, bw, bh);
    shadowText(ctx, pb.title, W / 2, H - 32 * S, pb.color, 6 * S, 'center');
    shadowText(ctx, mlLine || pb.dialogue, W / 2, H - 23 * S, '#fde047', 6.4 * S, 'center');
    if (mlLine) {
      shadowText(ctx, `"${pb.dialogue}"`, W / 2, H - 15 * S, '#cbd5e1', 5.2 * S, 'center');
    }
  }

  // Super Freeze Cut-In Overlay with High-Clarity Portrait!
  if (state.phase === 'superFreeze' && state.superFreezeActor !== null) {
    const actor = state.fighters[state.superFreezeActor];
    ctx.fillStyle = 'rgba(6, 5, 22, 0.78)';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 8; i++) {
      const ly = (68 + i * 9) * S;
      const lx = ((tick * 22 + i * 43) % ARENA.WIDTH) * S;
      ctx.fillStyle = i % 2 === 0 ? actor.def.palette.accentBright : '#ffffff';
      ctx.fillRect(lx, ly, 48 * S, 2 * S);
    }

    ctx.fillStyle = '#090d1a';
    ctx.fillRect(0, 66 * S, W, 70 * S);
    ctx.fillStyle = actor.def.palette.accent;
    ctx.fillRect(0, 66 * S, W, 3 * S);
    ctx.fillRect(0, 133 * S, W, 3 * S);

    const pSize = Math.round(64 * S);
    ctx.save();
    ctx.translate(actor.slot === 0 ? 16 * S : W - 16 * S - pSize, 69 * S);
    drawPortrait(ctx, actor.charId, pSize, pSize);
    ctx.restore();

    const mlShout = getMalayalamLine(actor.def.moves.superMove.shout) || actor.def.moves.superMove.shout;
    shadowText(ctx, actor.def.moves.superMove.name, W / 2 + (actor.slot === 0 ? 28 * S : -28 * S), 93 * S, '#fde047', 9.5 * S, 'center');
    shadowText(ctx, mlShout, W / 2 + (actor.slot === 0 ? 28 * S : -28 * S), 110 * S, '#ffffff', 7 * S, 'center');
    shadowText(ctx, actor.def.moves.superMove.shout, W / 2 + (actor.slot === 0 ? 28 * S : -28 * S), 123 * S, '#cbd5e1', 5.2 * S, 'center');
  }

  // Center Phase Banner (Bilingual Malayalam + English)
  if (state.banner && state.phase !== 'superFreeze') {
    const b = state.banner;
    let displayBanner = b.text;
    if (b.text === 'FIGHT!') displayBanner = 'അടി തുടങ്ങൂ! · FIGHT!';
    else if (b.text === 'K.O.!') displayBanner = 'നോക്കൗട്ട്! · K.O.!';
    else if (b.text.startsWith('ROUND ')) displayBanner = `റൗണ്ട് ${b.text.slice(6)} · ${b.text}`;

    ctx.save();
    ctx.fillStyle = 'rgba(9, 13, 26, 0.84)';
    ctx.fillRect(52 * S, 70 * S, W - 104 * S, 42 * S);
    ctx.strokeStyle = b.color || '#fde047';
    ctx.lineWidth = Math.max(1, Math.round(1.5 * S));
    ctx.strokeRect(52 * S, 70 * S, W - 104 * S, 42 * S);
    shadowText(ctx, displayBanner, W / 2, 91 * S, b.color || '#fde047', 10.5 * S, 'center');
    if (b.subtext) {
      shadowText(ctx, b.subtext, W / 2, 105 * S, '#ffffff', 6.5 * S, 'center');
    }
    ctx.restore();
  }
}

function drawActiveBuffBadges(ctx, f, x, y, alignRight, S) {
  const tags = [];
  if (f.buffs.damageTimer > 0) tags.push({ label: 'ATK x1.5', color: '#fde047' });
  if (f.buffs.speedTimer > 0) tags.push({ label: 'SPEED+', color: '#fbcfe8' });
  if (f.buffs.shieldTimer > 0) tags.push({ label: 'ARMOR', color: '#86efac' });

  tags.forEach((t, idx) => {
    const tx = alignRight ? x - idx * 40 * S : x + idx * 40 * S;
    shadowText(ctx, t.label, tx, y, t.color, 5.5 * S, alignRight ? 'right' : 'left');
  });
}

function drawMassMeter(ctx, f, x, y, alignRight, tick, S) {
  const w = Math.round(116 * S);
  const h = Math.round(7 * S);
  const ready = f.meter >= 100;
  ctx.fillStyle = '#09090b';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);

  const fillW = Math.round((f.meter / 100) * w);
  const barCol = ready ? (tick % 8 < 4 ? '#fde047' : '#f97316') : '#0284c7';
  const hiCol = ready ? '#ffffff' : '#7dd3fc';
  ctx.fillStyle = barCol;
  if (alignRight) {
    ctx.fillRect(x + (w - fillW), y, fillW, h);
    ctx.fillStyle = hiCol;
    ctx.fillRect(x + (w - fillW), y + 1, fillW, Math.max(2, Math.round(h * 0.28)));
  } else {
    ctx.fillRect(x, y, fillW, h);
    ctx.fillStyle = hiCol;
    ctx.fillRect(x, y + 1, fillW, Math.max(2, Math.round(h * 0.28)));
  }

  const label = ready ? 'MASS MAX! [I / SUPER]' : `MASS ${Math.floor(f.meter)}%`;
  shadowText(ctx, label, alignRight ? x + w : x, y - 3 * S, ready ? '#fde047' : '#bae6fd', 5.5 * S, alignRight ? 'right' : 'left');
}
