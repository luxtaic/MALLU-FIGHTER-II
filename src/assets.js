/**
 * Preloads and caches embedded 16-bit pixel-art stages, portraits, and 4-pose sprites.
 * Safe in Node headless tests (returns null when Image is unavailable).
 */

import { ASSETS_DATA } from './assets_data.js';

const cache = {
  stages: {},
  crowdStrips: {},
  portraits: {},
  sprites: {},
};

function loadImage(dataUrl) {
  if (typeof Image === 'undefined' || !dataUrl) return null;
  const img = new Image();
  img.src = dataUrl;
  return img;
}

export function getStageImage(stageId) {
  if (cache.stages[stageId] === undefined) {
    cache.stages[stageId] = loadImage(ASSETS_DATA.stages[stageId]);
  }
  const img = cache.stages[stageId];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

export function getCrowdStripImage(stripId) {
  if (cache.crowdStrips[stripId] === undefined) {
    cache.crowdStrips[stripId] = loadImage(ASSETS_DATA.crowdStrips?.[stripId]);
  }
  const img = cache.crowdStrips[stripId];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

export function getPortraitDataUrl(charId) {
  return ASSETS_DATA.portraits[charId] || '';
}

export function getPortraitImage(charId) {
  if (cache.portraits[charId] === undefined) {
    cache.portraits[charId] = loadImage(ASSETS_DATA.portraits[charId]);
  }
  const img = cache.portraits[charId];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

export function getSpritePose(charId, poseIndex) {
  if (!cache.sprites[charId]) {
    const list = ASSETS_DATA.sprites[charId] || [];
    cache.sprites[charId] = list.map((entry) => ({
      w: entry.w,
      h: entry.h,
      img: loadImage(entry.dataUrl),
    }));
  }
  const poses = cache.sprites[charId];
  const entry = poses[poseIndex] || poses[0];
  if (!entry || !entry.img || !entry.img.complete || entry.img.naturalWidth === 0) {
    return null;
  }
  return entry;
}
