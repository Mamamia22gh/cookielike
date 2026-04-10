import { describe, it, expect } from 'vitest';
import { BoxSystem } from '../src/systems/BoxSystem.js';
import { ComboSystem } from '../src/systems/ComboSystem.js';
import { EventBus } from '../src/core/EventBus.js';

describe('BoxSystem', () => {
  const events = new EventBus();
  const box = new BoxSystem(events);
  const combo = new ComboSystem();

  describe('create', () => {
    it('creates a box with correct grid structure', () => {
      const cookies = Array.from({ length: 20 }, (_, i) => ({
        recipeId: ['choco', 'vanilla', 'strawberry', 'lemon'][i % 4],
      }));
      const result = box.create(cookies, 4, 5);
      expect(result.grid.length).toBe(4);
      expect(result.grid[0].length).toBe(5);
      expect(result.value).toBe(0);
    });
  });

  describe('score with grid groups', () => {
    it('scores a uniform grid (all same = Flush Total x25)', () => {
      const cookies = Array.from({ length: 20 }, () => ({ recipeId: 'choco' }));
      const b = box.create(cookies, 4, 5);
      for (const col of b.grid) for (const c of col) c.cookingMulti = 1;
      b.gridResult = combo.evaluateGrid(b.grid);
      const value = box.score(b);
      // 20 cookies × 8 base × 1.0 cooking × 25 multiplier = 4000
      expect(value).toBe(4000);
    });

    it('scores with cooking multipliers', () => {
      const cookies = Array.from({ length: 20 }, () => ({ recipeId: 'choco' }));
      const b = box.create(cookies, 4, 5);
      for (const col of b.grid) for (const c of col) c.cookingMulti = 1.25; // perfect
      b.gridResult = combo.evaluateGrid(b.grid);
      const value = box.score(b);
      // 20 × 8 × 1.25 × 25 = 5000
      expect(value).toBe(5000);
    });

    it('burned cookies contribute 0', () => {
      const cookies = Array.from({ length: 20 }, () => ({ recipeId: 'choco' }));
      const b = box.create(cookies, 4, 5);
      // Burn first 5 cookies (col 0)
      for (const c of b.grid[0]) c.cookingMulti = 0;
      // Rest are cooked
      for (let col = 1; col < 4; col++) for (const c of b.grid[col]) c.cookingMulti = 1;
      b.gridResult = combo.evaluateGrid(b.grid);
      const value = box.score(b);
      // All 20 in one group (x25). 5 burned (0) + 15 cooked (8×1) = 120. × 25 = 3000
      expect(value).toBe(3000);
    });

    it('mixed types score per group', () => {
      // Col 0: all choco, Col 1-3: all different
      const b = box.create(Array.from({ length: 20 }, () => ({ recipeId: 'choco' })), 4, 5);
      // Override cols 1-3 with unique types
      const types = ['vanilla', 'strawberry', 'lemon'];
      for (let col = 1; col < 4; col++) {
        for (let row = 0; row < 5; row++) {
          b.grid[col][row].recipeId = types[col - 1];
        }
      }
      for (const col of b.grid) for (const c of col) c.cookingMulti = 1;
      b.gridResult = combo.evaluateGrid(b.grid);
      const value = box.score(b);
      // 4 groups of 5: each 5×8×1×4(quinte) = 160. Total = 640
      expect(value).toBe(640);
    });

    it('applies value_percent topping', () => {
      const cookies = Array.from({ length: 20 }, () => ({ recipeId: 'choco' }));
      const b = box.create(cookies, 4, 5);
      for (const col of b.grid) for (const c of col) c.cookingMulti = 1;
      b.gridResult = combo.evaluateGrid(b.grid);
      b.toppingResult = { effect: 'value_percent', value: 50 };
      const value = box.score(b);
      // Base: 4000. +50% = 6000
      expect(value).toBe(6000);
    });

    it('applies value_flat topping', () => {
      const cookies = Array.from({ length: 20 }, () => ({ recipeId: 'choco' }));
      const b = box.create(cookies, 4, 5);
      for (const col of b.grid) for (const c of col) c.cookingMulti = 1;
      b.gridResult = combo.evaluateGrid(b.grid);
      b.toppingResult = { effect: 'value_flat', value: 100 };
      const value = box.score(b);
      expect(value).toBe(4000 + 100);
    });
  });
});
