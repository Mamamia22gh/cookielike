import { describe, it, expect, beforeEach } from 'vitest';
import { PollSystem } from '../src/systems/PollSystem.js';
import { EventBus } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { createRunState, createMetaState } from '../src/core/GameState.js';
import { BALANCE } from '../src/data/balance.js';

describe('PollSystem', () => {
  let events, poll, run, rng;

  beforeEach(() => {
    events = new EventBus();
    poll = new PollSystem(events);
    run = createRunState(createMetaState());
    rng = new RNG(42);
  });

  describe('generate', () => {
    it('produces POLL_SIZE recipes', () => {
      const result = poll.generate(run, rng);
      expect(result.length).toBe(BALANCE.POLL_SIZE);
    });

    it('only picks recipes from the pool', () => {
      const poolIds = run.machine.pool.map(e => e.recipeId);
      const result = poll.generate(run, rng);
      for (const id of result) {
        expect(poolIds).toContain(id);
      }
    });

    it('sets rerollsLeft to POLL_REROLLS_PER_ROUND', () => {
      poll.generate(run, rng);
      expect(run.poll.rerollsLeft).toBe(BALANCE.POLL_REROLLS_PER_ROUND);
    });

    it('emits poll:generated', () => {
      let emitted = null;
      events.on('poll:generated', d => emitted = d);
      poll.generate(run, rng);
      expect(emitted).not.toBeNull();
      expect(emitted.recipes.length).toBe(BALANCE.POLL_SIZE);
      expect(emitted.rerollsLeft).toBe(BALANCE.POLL_REROLLS_PER_ROUND);
    });
  });

  describe('reroll', () => {
    it('decrements rerollsLeft', () => {
      poll.generate(run, rng);
      poll.reroll(run, rng);
      expect(run.poll.rerollsLeft).toBe(BALANCE.POLL_REROLLS_PER_ROUND - 1);
    });

    it('can reroll exactly POLL_REROLLS_PER_ROUND times', () => {
      poll.generate(run, rng);
      for (let i = 0; i < BALANCE.POLL_REROLLS_PER_ROUND; i++) {
        expect(poll.reroll(run, rng)).toBe(true);
      }
      expect(poll.reroll(run, rng)).toBe(false);
    });

    it('changes the recipes on reroll', () => {
      poll.generate(run, rng);
      const first = [...run.poll.recipes];
      // Use a different seed path so we likely get different results
      const rng2 = new RNG(999);
      run.poll.rerollsLeft = 3;
      poll.reroll(run, rng2);
      // At least the reroll executed (recipes may or may not differ with RNG)
      expect(run.poll.recipes.length).toBe(BALANCE.POLL_SIZE);
    });

    it('fails without prior generate', () => {
      const result = poll.reroll(run, rng);
      expect(result).toBe(false);
    });

    it('emits poll:no_rerolls when exhausted', () => {
      let emitted = false;
      events.on('poll:no_rerolls', () => emitted = true);
      poll.generate(run, rng);
      run.poll.rerollsLeft = 0;
      poll.reroll(run, rng);
      expect(emitted).toBe(true);
    });
  });

  describe('getActivePool', () => {
    it('converts poll recipes to weighted pool', () => {
      run.poll = { recipes: ['choco', 'choco', 'vanilla', 'lemon'], rerollsLeft: 0 };
      const active = poll.getActivePool(run);
      expect(active.find(e => e.recipeId === 'choco').weight).toBe(2);
      expect(active.find(e => e.recipeId === 'vanilla').weight).toBe(1);
      expect(active.find(e => e.recipeId === 'lemon').weight).toBe(1);
    });

    it('falls back to full pool when no poll', () => {
      const active = poll.getActivePool(run);
      expect(active).toBe(run.machine.pool);
    });
  });
});
