/**
 * 16-bit Pixel Graphics Utilities:
 * - Integer-snapped pixel rects
 * - Ordered 2x2 pixel dithering
 * - Tapered organic 3-tone pixel capsules (arms, legs, torsos)
 * - ASCII pixel-art bitmap matrix renderer
 * - Elliptical dock shadows, pixel halos & CPS-2 starbursts
 */

export function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/**
 * Draws an ordered 2x2 Bayer dithered pixel band transitioning from colA to colB.
 */
export function ditherBand(ctx, x, y, w, h, colA, colB, ratio = 0.5) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);
  px(ctx, rx, ry, rw, rh, colA);
  ctx.fillStyle = colB;
  const step = ratio >= 0.5 ? 2 : 4;
  for (let py = 0; py < rh; py += 2) {
    const offset = (py / 2) % 2 === 0 ? 0 : 1;
    for (let pxX = offset; pxX < rw; pxX += step) {
      ctx.fillRect(rx + pxX, ry + py, 1, 1);
    }
  }
}

/**
 * Rasterizes a tapered organic 3-tone shaded pixel limb/capsule between two endpoints.
 * Produces smooth 16-bit muscle & garment silhouettes instead of flat boxes.
 */
export function drawPixelCapsule(ctx, x1, y1, x2, y2, r1, r2, colBase, colHi, colSh) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(dist * 1.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x1 + (x2 - x1) * t);
    const cy = Math.round(y1 + (y2 - y1) * t);
    const r = Math.max(1, Math.round(r1 + (r2 - r1) * t));
    // Shaded base span
    for (let dy = -r; dy <= r; dy++) {
      const span = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      if (span <= 0) continue;
      ctx.fillStyle = colBase;
      ctx.fillRect(cx - span, cy + dy, span * 2 + 1, 1);
      // Upper-left specular highlight edge
      if (dy <= -Math.floor(r * 0.4) && colHi) {
        ctx.fillStyle = colHi;
        ctx.fillRect(cx - span, cy + dy, Math.max(1, Math.floor(span * 1.1)), 1);
      }
      // Lower-right shadow edge
      if (dy >= Math.floor(r * 0.35) && colSh) {
        ctx.fillStyle = colSh;
        ctx.fillRect(cx, cy + dy, span + 1, 1);
      }
    }
  }
}

/**
 * Draws a crisp pixel-stepped elliptical cast shadow on the floor.
 */
export function drawEllipseShadow(ctx, cx, cy, rx, ry, color = '#09090b', alpha = 0.45) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const iry = Math.max(1, Math.round(ry));
  for (let dy = -iry; dy <= iry; dy++) {
    const t = dy / iry;
    const halfW = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    if (halfW > 0) {
      ctx.fillRect(Math.round(cx - halfW), Math.round(cy + dy), halfW * 2, 1);
    }
  }
  ctx.restore();
}

/**
 * Renders a crisp pixel-art sprite from an array of string rows and a char->color map.
 */
export function drawPixelMatrix(ctx, originX, originY, rows, palette, scale = 1, flipX = false) {
  const h = rows.length;
  const w = rows[0]?.length || 0;
  const ox = Math.round(originX);
  const oy = Math.round(originY);

  for (let r = 0; r < h; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (!col) continue;
      const drawCol = flipX ? w - 1 - c : c;
      ctx.fillStyle = col;
      ctx.fillRect(ox + drawCol * scale, oy + r * scale, scale, scale);
    }
  }
}

/**
 * Draws a soft stepped pixel halo (no smooth blur, authentic 16-bit translucent circles).
 */
export function drawPixelHalo(ctx, cx, cy, radius, color, alpha = 0.22) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha * 0.55;
  ctx.beginPath();
  ctx.arc(Math.round(cx), Math.round(cy), Math.round(radius), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(Math.round(cx), Math.round(cy), Math.round(radius * 0.6), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draws a crisp Capcom/CPS-2 style multi-point impact starburst.
 */
export function drawImpactStarburst(ctx, cx, cy, outerR, color, coreColor = '#ffffff') {
  const x = Math.round(cx);
  const y = Math.round(cy);
  const spikes = 8;

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : outerR * 0.35;
    const a = (i * Math.PI) / spikes;
    const sx = x + Math.cos(a) * r;
    const sy = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = coreColor;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR * 0.55 : outerR * 0.18;
    const a = (i * Math.PI) / spikes + 0.2;
    const sx = x + Math.cos(a) * r;
    const sy = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
