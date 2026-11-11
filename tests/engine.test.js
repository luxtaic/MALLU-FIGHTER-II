import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, POWERUP_TYPES, STAGES } from '../src/characters.js';
import { ARENA, createMatchState, stepMatch } from '../src/engine.js';
import { createAiController } from '../src/ai.js';

function deterministicRng() {
  return 0.1;
}

test('Roster and Kerala stages contain complete character data and dialogues', () => {
  assert.equal(CHARACTERS.length, 10);
  assert.equal(STAGES.length, 6);
  assert.equal(POWERUP_TYPES.length, 5);

  for (const ch of CHARACTERS) {
    assert.ok(ch.superEntry.id, `${ch.id} has superEntry`);
    assert.ok(ch.superEntry.shout.length > 0, `${ch.id} has entry shout`);
    assert.ok(ch.dialogues.intro.length > 0);
    assert.ok(ch.dialogues.win.length > 0);
    assert.ok(ch.moves.projectile);
    assert.ok(ch.moves.special);
    assert.ok(ch.moves.superMove);
  }
});

test('Super Entry intro sequence emits entry events and transitions to fight', () => {
  const state = createMatchState({
    p1CharId: 'maveli',
    p2CharId: 'george',
    stageId: 'alappuzha',
    skipIntro: false,
    rng: deterministicRng,
  });

  assert.equal(state.phase, 'intro');
  assert.equal(state.fighters[0].state, 'entry');
  assert.equal(state.fighters[1].state, 'entry');

  let entryEvents = 0;
  for (let i = 0; i < 230; i++) {
    stepMatch(state, [{}, {}]);
    entryEvents += state.events.filter((e) => e.type === 'superEntry').length;
    if (state.phase === 'fight') break;
  }

  assert.equal(entryEvents, 2);
  assert.equal(state.phase, 'fight');
  assert.equal(state.fighters[0].state, 'idle');
  assert.equal(state.fighters[1].state, 'idle');
});

test('Melee attack deals damage, triggers hitstop, and respects blocking', () => {
  const state = createMatchState({
    p1CharId: 'george',
    p2CharId: 'kuttan',
    skipIntro: true,
    rng: deterministicRng,
  });

  // Bring fighters into punching range
  state.fighters[0].x = 180;
  state.fighters[1].x = 200;

  const initialHp = state.fighters[1].hp;

  // P1 throws light punch
  stepMatch(state, [{ light: true }, {}]);
  for (let i = 0; i < 12; i++) {
    stepMatch(state, [{}, {}]);
  }
  assert.ok(state.fighters[1].hp < initialHp, 'Unblocked punch reduces HP');
  assert.ok(state.fighters[0].score > 0, 'Attacker gains score');

  // Now P2 holds back (right) to block P1's next punch
  const hpBeforeBlock = state.fighters[1].hp;
  stepMatch(state, [{ light: true }, { right: true }]);
  for (let i = 0; i < 12; i++) {
    stepMatch(state, [{}, { right: true }]);
  }
  assert.equal(state.fighters[1].hp, hpBeforeBlock, 'Holding back blocks normal punch with 0 chip');

  // Dedicated Mortal Kombat-style block key blocks low sweep too
  stepMatch(state, [{ down: true, heavy: true }, { block: true }]);
  for (let i = 0; i < 14; i++) {
    stepMatch(state, [{}, { block: true }]);
  }
  assert.equal(state.fighters[1].hp, hpBeforeBlock, 'Dedicated block button guards low crouch sweep');
});

test('Projectiles spawn, travel, and hit opponent', () => {
  const state = createMatchState({
    p1CharId: 'maveli',
    p2CharId: 'unniyarcha',
    skipIntro: true,
    rng: deterministicRng,
  });

  const startHp = state.fighters[1].hp;
  stepMatch(state, [{ special: true }, {}]);

  for (let i = 0; i < 80; i++) {
    stepMatch(state, [{}, {}]);
  }

  assert.ok(state.fighters[1].hp < startHp, 'Pookkalam Chakra hits distant opponent');
});

test('Kerala snack power-up pickup triggers buff and powerup dialogue', () => {
  const state = createMatchState({
    p1CharId: 'george',
    p2CharId: 'theyyam',
    skipIntro: true,
    powerupsEnabled: true,
    rng: deterministicRng,
  });

  // Force immediate powerup drop right above P1
  state.powerups.push({
    spec: POWERUP_TYPES[1], // Pazhampori (damage x1.5)
    x: state.fighters[0].x,
    y: ARENA.FLOOR_Y - 12,
    vy: 0,
    bob: 0,
    life: 200,
  });

  stepMatch(state, [{}, {}]);

  assert.equal(state.powerups.length, 0);
  assert.equal(state.fighters[0].buffs.damageMult, 1.5);
  assert.ok(state.powerupBanner, 'Power-up banner displays');
  assert.ok(state.fighters[0].speech?.type === 'powerup', 'Fighter shouts power-up dialogue');
});

test('Mass Super Move requires 100% meter, freezes screen, and deals heavy damage', () => {
  const state = createMatchState({
    p1CharId: 'theyyam',
    p2CharId: 'kuttan',
    skipIntro: true,
    rng: deterministicRng,
  });

  state.fighters[0].x = 175;
  state.fighters[1].x = 210;
  state.fighters[0].meter = 100;
  const startHp = state.fighters[1].hp;

  stepMatch(state, [{ super: true }, {}]);
  assert.equal(state.phase, 'superFreeze');
  assert.equal(state.fighters[0].meter, 0);

  for (let i = 0; i < 80; i++) {
    stepMatch(state, [{}, {}]);
  }

  assert.ok(state.fighters[1].hp <= startHp - 30, 'Super move deals massive damage');
});

test('KO ends round and 2 round wins ends match', () => {
  const state = createMatchState({
    p1CharId: 'maveli',
    p2CharId: 'kuttan',
    skipIntro: true,
    rng: deterministicRng,
  });

  // Win Round 1 via KO
  state.fighters[0].x = 180;
  state.fighters[1].x = 202;
  state.fighters[1].hp = 4;
  stepMatch(state, [{ heavy: true }, {}]);
  for (let i = 0; i < 185; i++) {
    stepMatch(state, [{}, {}]);
  }
  assert.equal(state.fighters[0].roundsWon, 1);
  assert.equal(state.round, 2);

  // Fast-forward ready banner into Round 2 fight
  for (let i = 0; i < 100; i++) {
    stepMatch(state, [{}, {}]);
  }
  assert.equal(state.phase, 'fight');

  // Win Round 2 via KO -> Match Over
  state.fighters[0].x = 180;
  state.fighters[1].x = 202;
  state.fighters[1].hp = 4;
  stepMatch(state, [{ heavy: true }, {}]);
  for (let i = 0; i < 185; i++) {
    stepMatch(state, [{}, {}]);
  }

  assert.equal(state.fighters[0].roundsWon, 2);
  assert.equal(state.phase, 'matchOver');
  assert.equal(state.matchWinnerSlot, 0);
});

test('AI controller returns valid input object during active fight', () => {
  const state = createMatchState({
    p1CharId: 'maveli',
    p2CharId: 'theyyam',
    skipIntro: true,
    rng: deterministicRng,
  });
  const ai = createAiController('mass');
  const inp = ai.computeInput(state, 1);
  assert.equal(typeof inp.left, 'boolean');
  assert.equal(typeof inp.light, 'boolean');
  assert.equal(typeof inp.super, 'boolean');
});

test('Voice dialogue and audience cheer events emit on Super Entries and combos', () => {
  const state = createMatchState({
    p1CharId: 'maveli',
    p2CharId: 'george',
    stageId: 'fortkochi',
    skipIntro: false,
    rng: deterministicRng,
  });

  const voices = [];
  for (let i = 0; i < 120; i++) {
    stepMatch(state, [{}, {}]);
    voices.push(...state.events.filter((e) => e.type === 'voiceLine'));
  }
  assert.ok(voices.length >= 2, 'Intro Super Entries emit character voiceLine events');

  // Skip to fight and trigger 2-hit combo -> Audience Cheer!
  state.phase = 'fight';
  state.fighters[0].state = 'idle';
  state.fighters[1].state = 'idle';
  state.fighters[0].x = 180;
  state.fighters[1].x = 200;
  state.audienceCooldown = 0;

  let cheers = 0;
  for (let round = 0; round < 2; round++) {
    stepMatch(state, [{ light: true }, {}]);
    for (let t = 0; t < 20; t++) {
      stepMatch(state, [{}, {}]);
      cheers += state.events.filter((e) => e.type === 'audienceCheer').length;
    }
  }
  assert.ok(cheers >= 1, 'Combo triggers audienceCheer event');
  assert.ok(state.audienceBubble && state.audienceBubble.text.length > 0, 'Audience bubble populated');
});
