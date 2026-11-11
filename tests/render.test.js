import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, POWERUP_TYPES, STAGES } from '../src/characters.js';
import { ARENA, createMatchState, stepMatch, setSpeech } from '../src/engine.js';
import { drawStageBackground } from '../src/stages.js';
import { drawFighter, drawProjectile, drawPowerup, drawPortrait } from '../src/sprites.js';
import { drawHud } from '../src/hud.js';
import { drawImpactStarburst } from '../src/pixel.js';

function createMockCanvasContext() {
  let saveDepth = 0;
  let drawCalls = 0;
  return {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '10px monospace',
    textAlign: 'left',
    imageSmoothingEnabled: true,
    save() { saveDepth += 1; },
    restore() {
      saveDepth -= 1;
      assert.ok(saveDepth >= 0, 'Canvas restore() called without matching save()');
    },
    translate() {},
    scale() {},
    rotate() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    arc() {},
    rect() {},
    clip() {},
    fill() { drawCalls += 1; },
    stroke() { drawCalls += 1; },
    fillRect() { drawCalls += 1; },
    strokeRect() { drawCalls += 1; },
    fillText() { drawCalls += 1; },
    measureText(str) { return { width: str.length * 4 }; },
    getStats: () => ({ saveDepth, drawCalls }),
  };
}

test('All 6 Kerala stages render cleanly with balanced save/restore', () => {
  for (const st of STAGES) {
    const ctx = createMockCanvasContext();
    const state = createMatchState({ stageId: st.id, skipIntro: true });
    state.crowdExcitement = 60;
    for (let tick = 0; tick < 120; tick += 15) {
      drawStageBackground(ctx, state, tick);
    }
    const stats = ctx.getStats();
    assert.equal(stats.saveDepth, 0, `Balanced canvas state on stage ${st.id}`);
    assert.ok(stats.drawCalls > 100, `Stage ${st.id} drew rich pixel scene`);
  }
});

test('All 10 fighters render all poses, Super Entries, portraits, and projectiles cleanly', () => {
  const states = [
    'entry', 'idle', 'walk', 'crouch', 'jump', 'attack',
    'projectile', 'special', 'super', 'blockstun', 'hitstun', 'knockdown', 'ko', 'victory',
  ];

  for (const ch of CHARACTERS) {
    const ctx = createMockCanvasContext();
    drawPortrait(ctx, ch.id, 64, 64);
    assert.equal(ctx.getStats().saveDepth, 0, `Portrait save/restore balanced for ${ch.id}`);

    const state = createMatchState({ p1CharId: ch.id, p2CharId: 'george', skipIntro: false });
    const f = state.fighters[0];

    for (const pose of states) {
      f.state = pose;
      f.moveKey = pose === 'attack' ? 'heavyKick' : null;
      f.buffs.auraColor = '#fde047';
      f.trail = pose === 'special' ? [{ x: f.x - 10, y: f.y, facing: 1, state: 'special', moveKey: null, life: 5 }] : [];
      if (pose === 'entry') {
        state.phase = 'intro';
        state.phaseTimer = 180;
      } else {
        state.phase = 'fight';
      }
      drawFighter(ctx, f, state, 25);
      assert.equal(ctx.getStats().saveDepth, 0, `Pose ${pose} balanced for ${ch.id}`);
    }

    drawImpactStarburst(ctx, 180, 140, 18, '#f97316', '#ffffff');
    assert.equal(ctx.getStats().saveDepth, 0, `Starburst balanced for ${ch.id}`);

    drawProjectile(ctx, {
      style: ch.moves.projectile.style,
      x: 150,
      y: 150,
      vx: 3,
      spin: 0.4,
      coreColor: '#fde047',
    }, 10);
    assert.equal(ctx.getStats().saveDepth, 0, `Projectile balanced for ${ch.id}`);
  }
});

test('All 5 Kerala snack power-ups and HUD states render cleanly', () => {
  const ctx = createMockCanvasContext();
  const state = createMatchState({ p1CharId: 'maveli', p2CharId: 'theyyam', skipIntro: true });

  for (const spec of POWERUP_TYPES) {
    drawPowerup(ctx, { spec, x: 180, y: ARENA.FLOOR_Y - 12, bob: 0.5 }, 20);
  }

  setSpeech(state.fighters[0], 'Oru Strong Meter Chaya! Energy full aayi mwone!', 100, 'powerup');
  setSpeech(state.fighters[1], 'Chenda kottu kettille? Kali ini choodakum!', 100, 'normal');
  state.powerupBanner = {
    title: 'MAVELI: CHOODU CHAYA!',
    dialogue: 'Oru Strong Meter Chaya! Energy full aayi mwone!',
    color: '#fde047',
    timer: 100,
  };
  state.phase = 'superFreeze';
  state.superFreezeActor = 0;
  state.audienceBubble = { text: 'CROWD: Poli machane!', x: 180, y: 90, timer: 60 };

  drawHud(ctx, state, 18500, 30, 640);
  assert.equal(ctx.getStats().saveDepth, 0, 'HUD superFreeze and speech bubbles balanced');
});
