import { describe, it, expect, beforeEach } from 'vitest';
import { MachineSystem } from '../src/systems/MachineSystem.js';
import { EventBus } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { createRunState } from '../src/core/GameState.js';
import { createMetaState } from '../src/core/GameState.js';

describe('MachineSystem', () => {
  let events, machine, run, rng;

  beforeEach(() => {
    events = new EventBus();
    machine = new MachineSystem(events);
    run = createRunState(createMetaState());
    rng = new RNG(42);
  });

  describe('getProbabilities', () => {
    it('calculates correct probabilities', () => {
      const probs = machine.getProbabilities(run.machine.pool);
      expect(probs.length).toBe(8); // choco + vanilla + strawberry + lemon + peanut + butter + cinnamon + hazelnut
      const chocoProb = probs.find(p => p.recipeId === 'choco');
      const vanillaProb = probs.find(p => p.recipeId === 'vanilla');
      // each weight 1, total 8
      expect(chocoProb.probability).toBeCloseTo(1 / 8);
      expect(vanillaProb.probability).toBeCloseTo(1 / 8);
    });

    it('returns empty for empty pool', () => {
      run.machine.pool = [];
      const probs = machine.getProbabilities(run.machine.pool);
      expect(probs).toEqual([]);
    });
  });

  describe('pull', () => {
    it('generates correct number of cookies', () => {
      const cookies = machine.pull(run, rng);
      expect(cookies.length).toBe(5); // default BOX_SIZE
    });

    it('only generates cookies from pool', () => {
      const cookies = machine.pull(run, rng);
      const validIds = run.machine.pool.map(e => e.recipeId);
      for (const c of cookies) {
        expect(validIds).toContain(c.recipeId);
      }
    });

    it('is deterministic with same seed', () => {
      const rng1 = new RNG(123);
      const rng2 = new RNG(123);
      const cookies1 = machine.pull(run, rng1);
      const cookies2 = machine.pull(run, rng2);
      expect(cookies1).toEqual(cookies2);
    });

    it('returns empty for empty pool', () => {
      run.machine.pool = [];
      const cookies = machine.pull(run, rng);
      expect(cookies).toEqual([]);
    });
  });

  describe('addRecipe', () => {
    it('adds new recipe to pool', () => {
      machine.addRecipe(run, 'strawberry');
      expect(run.machine.pool.find(e => e.recipeId === 'strawberry')).toBeTruthy();
    });

    it('increases weight if recipe already exists', () => {
      const before = run.machine.pool.find(e => e.recipeId === 'choco').weight;
      machine.addRecipe(run, 'choco');
      expect(run.machine.pool.find(e => e.recipeId === 'choco').weight).toBe(before + 1);
    });

    it('rejects invalid recipe', () => {
      expect(() => machine.addRecipe(run, 'nonexistent')).toThrow();
    });
  });

  describe('removeRecipe', () => {
    it('decreases weight', () => {
      machine.addRecipe(run, 'choco'); // weight 1 -> 2
      machine.removeRecipe(run, 'choco');
      expect(run.machine.pool.find(e => e.recipeId === 'choco').weight).toBe(1);
    });

    it('removes entry when weight hits 0', () => {
      machine.removeRecipe(run, 'vanilla'); // weight 1 -> 0
      expect(run.machine.pool.find(e => e.recipeId === 'vanilla')).toBeUndefined();
    });

    it('cannot remove last remaining weight', () => {
      // Remove until only 1 weight left total
      machine.removeRecipe(run, 'vanilla');
      machine.removeRecipe(run, 'strawberry');
      machine.removeRecipe(run, 'lemon');
      machine.removeRecipe(run, 'peanut');
      machine.removeRecipe(run, 'butter');
      machine.removeRecipe(run, 'cinnamon');
      machine.removeRecipe(run, 'hazelnut');
      // choco weight=1 is the last one
      const result = machine.removeRecipe(run, 'choco');
      expect(result).toBe(false);
      expect(run.machine.pool.find(e => e.recipeId === 'choco').weight).toBe(1);
    });
  });

  describe('duplicateRecipe', () => {
    it('increases weight by 1', () => {
      const before = run.machine.pool.find(e => e.recipeId === 'choco').weight;
      machine.duplicateRecipe(run, 'choco');
      expect(run.machine.pool.find(e => e.recipeId === 'choco').weight).toBe(before + 1);
    });

    it('fails for recipe not in pool', () => {
      const result = machine.duplicateRecipe(run, 'macaron');
      expect(result).toBe(false);
    });
  });
});
