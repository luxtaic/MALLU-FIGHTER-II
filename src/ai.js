/**
 * CPU fighter AI controller with 3 Mallu difficulty tiers:
 * - 'paavam' (Easy / chill)
 * - 'chettan' (Medium / balanced arcade)
 * - 'mass' (Hard / aggressive combos & anti-airs)
 */

import { ARENA } from './engine.js';

export function createAiController(difficulty = 'chettan') {
  const profiles = {
    paavam: { reactionRate: 0.35, blockRate: 0.25, specialRate: 0.04, superRate: 0.06, aggro: 0.45 },
    chettan: { reactionRate: 0.68, blockRate: 0.55, specialRate: 0.08, superRate: 0.14, aggro: 0.7 },
    mass: { reactionRate: 0.92, blockRate: 0.78, specialRate: 0.14, superRate: 0.28, aggro: 0.9 },
  };
  const cfg = profiles[difficulty] || profiles.chettan;

  return {
    decisionTimer: 0,
    cachedDir: 0, // -1 left, 0 stay, 1 right
    blockTimer: 0,
    computeInput(state, mySlot = 1) {
      const me = state.fighters[mySlot];
      const opp = state.fighters[1 - mySlot];
      const rng = state.rng || Math.random;

      const input = {
        left: false,
        right: false,
        up: false,
        down: false,
        light: false,
        heavy: false,
        special: false,
        super: false,
      };

      if (state.phase !== 'fight') return input;

      const dx = opp.x - me.x;
      const dist = Math.abs(dx);
      const towardLeft = dx < 0;

      // Threat check: incoming projectile or close attack
      const incomingProj = state.projectiles.find(
        (p) =>
          p.ownerSlot !== mySlot &&
          Math.abs(p.x - me.x) < 62 &&
          Math.sign(p.vx) === Math.sign(me.x - p.x)
      );

      if (incomingProj && rng() < cfg.reactionRate) {
        if (rng() < 0.45 && me.y >= ARENA.FLOOR_Y - 2) {
          input.up = true; // Jump over projectile!
        } else {
          // Hold back to block
          if (me.facing === 1) input.left = true;
          else input.right = true;
        }
        return input;
      }

      if (this.blockTimer > 0) {
        this.blockTimer -= 1;
        if (me.facing === 1) input.left = true;
        else input.right = true;
        if (opp.state === 'crouch') input.down = true;
        return input;
      }

      if ((opp.state === 'attack' || opp.state === 'special' || opp.state === 'super') && dist < 52) {
        if (rng() < cfg.blockRate) {
          this.blockTimer = 14;
          if (me.facing === 1) input.left = true;
          else input.right = true;
          return input;
        }
      }

      // Super Move when Mass Meter is 100% and opponent in range!
      if (me.meter >= 100 && dist < 90 && rng() < cfg.superRate) {
        input.super = true;
        return input;
      }

      // Chase nearby Kerala snack power-up!
      if (state.powerups.length > 0 && (me.hp < me.maxHp * 0.78 || rng() < 0.55)) {
        const pu = state.powerups[0];
        if (Math.abs(pu.x - me.x) > 10 && Math.abs(pu.x - me.x) < 110) {
          input.left = pu.x < me.x;
          input.right = pu.x > me.x;
          return input;
        }
      }

      // Periodic movement plan
      this.decisionTimer -= 1;
      if (this.decisionTimer <= 0) {
        this.decisionTimer = 10 + Math.floor(rng() * 14);
        if (dist > 64) {
          this.cachedDir = rng() < cfg.aggro ? (towardLeft ? -1 : 1) : 0;
        } else if (dist < 26) {
          this.cachedDir = rng() < 0.35 ? (towardLeft ? 1 : -1) : 0;
        } else {
          this.cachedDir = rng() < 0.5 ? (towardLeft ? -1 : 1) : 0;
        }
      }

      if (this.cachedDir === -1) input.left = true;
      if (this.cachedDir === 1) input.right = true;

      // Close-range offense
      if (dist <= 38) {
        const roll = rng();
        if (roll < 0.08 * cfg.reactionRate) {
          input.light = true;
        } else if (roll < 0.14 * cfg.reactionRate) {
          input.heavy = true;
        } else if (roll < 0.17 * cfg.reactionRate) {
          input.down = true;
          input.heavy = true; // Sweep!
        } else if (roll < 0.17 + cfg.specialRate && me.specialCooldown <= 0) {
          input.up = true;
          input.special = true;
        }
      } else if (dist > 70 && dist < 210 && me.projectileCooldown <= 0) {
        if (rng() < cfg.specialRate * 0.55) {
          input.special = true;
        }
      }

      // Occasional jump-in
      if (dist > 55 && dist < 110 && rng() < 0.015 * cfg.aggro) {
        input.up = true;
        input.left = towardLeft;
        input.right = !towardLeft;
      }

      return input;
    },
  };
}
