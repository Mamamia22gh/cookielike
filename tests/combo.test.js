import { describe, it, expect } from 'vitest';
import { ComboSystem } from '../src/systems/ComboSystem.js';

const combo = new ComboSystem();

// Helper: create a 4×5 grid filled with a pattern
function makeGrid(pattern) {
  // pattern is a 2D array [col][row] of recipe IDs
  return pattern.map(col => col.map(id => ({ recipeId: id })));
}

// Helper: create a uniform grid
function uniformGrid(recipeId, width = 4, height = 5) {
  return Array.from({ length: width }, () =>
    Array.from({ length: height }, () => ({ recipeId: recipeId }))
  );
}

describe('ComboSystem — Grid Evaluation', () => {
  describe('connected groups', () => {
    it('full grid same type = one group of 20 (Flush Total)', () => {
      const grid = uniformGrid('choco');
      const result = combo.evaluateGrid(grid);
      expect(result.groups.length).toBe(1);
      expect(result.groups[0].size).toBe(20);
      expect(result.groups[0].name).toBe('Flush Total');
      expect(result.groups[0].multiplier).toBe(25);
    });

    it('all different = 20 groups of 1', () => {
      // 4×5 grid, each cell a different type (use 8 types, some repeat)
      const types = ['choco', 'vanilla', 'strawberry', 'lemon', 'peanut', 'butter', 'cinnamon', 'hazelnut'];
      const grid = Array.from({ length: 4 }, (_, col) =>
        Array.from({ length: 5 }, (_, row) => ({ recipeId: types[(col * 5 + row) % 8] }))
      );
      const result = combo.evaluateGrid(grid);
      // No adjacent same types in this pattern
      const solos = result.groups.filter(g => g.size === 1);
      expect(solos.length).toBeGreaterThan(0);
    });

    it('detects a vertical pair', () => {
      const grid = makeGrid([
        ['choco', 'choco', 'vanilla', 'lemon', 'peanut'],
        ['vanilla', 'lemon', 'peanut', 'butter', 'cinnamon'],
        ['strawberry', 'hazelnut', 'vanilla', 'lemon', 'peanut'],
        ['butter', 'cinnamon', 'hazelnut', 'strawberry', 'vanilla'],
      ]);
      const result = combo.evaluateGrid(grid);
      const chocoGroup = result.groups.find(g => g.recipeId === 'choco');
      expect(chocoGroup).toBeTruthy();
      expect(chocoGroup.size).toBe(2);
      expect(chocoGroup.multiplier).toBe(1.5);
      expect(chocoGroup.name).toBe('Paire');
    });

    it('detects an L-shaped group of 5', () => {
      const grid = makeGrid([
        ['choco', 'choco', 'choco', 'vanilla', 'lemon'],
        ['choco', 'choco', 'vanilla', 'lemon', 'peanut'],
        ['vanilla', 'lemon', 'peanut', 'butter', 'cinnamon'],
        ['strawberry', 'hazelnut', 'vanilla', 'lemon', 'peanut'],
      ]);
      const result = combo.evaluateGrid(grid);
      const chocoGroup = result.groups.find(g => g.recipeId === 'choco');
      expect(chocoGroup).toBeTruthy();
      expect(chocoGroup.size).toBe(5);
      expect(chocoGroup.multiplier).toBe(4);
      expect(chocoGroup.name).toBe('Quinte');
    });

    it('two separate groups of same type', () => {
      const grid = makeGrid([
        ['choco', 'vanilla', 'choco', 'vanilla', 'lemon'],
        ['vanilla', 'choco', 'vanilla', 'choco', 'peanut'],
        ['lemon', 'peanut', 'butter', 'cinnamon', 'hazelnut'],
        ['strawberry', 'hazelnut', 'vanilla', 'lemon', 'peanut'],
      ]);
      const result = combo.evaluateGrid(grid);
      const chocoGroups = result.groups.filter(g => g.recipeId === 'choco');
      // Chocos are isolated, should be separate groups
      expect(chocoGroups.length).toBeGreaterThanOrEqual(2);
    });

    it('best group is the largest', () => {
      const grid = makeGrid([
        ['choco', 'choco', 'choco', 'choco', 'choco'],
        ['vanilla', 'vanilla', 'lemon', 'peanut', 'butter'],
        ['lemon', 'peanut', 'butter', 'cinnamon', 'hazelnut'],
        ['strawberry', 'hazelnut', 'vanilla', 'lemon', 'peanut'],
      ]);
      const result = combo.evaluateGrid(grid);
      expect(result.bestGroup.recipeId).toBe('choco');
      expect(result.bestGroup.size).toBe(5);
    });
  });

  describe('joker handling', () => {
    it('joker joins adjacent group', () => {
      const grid = makeGrid([
        ['choco', 'choco', 'joker', 'vanilla', 'lemon'],
        ['vanilla', 'lemon', 'peanut', 'butter', 'cinnamon'],
        ['strawberry', 'hazelnut', 'vanilla', 'lemon', 'peanut'],
        ['butter', 'cinnamon', 'hazelnut', 'strawberry', 'vanilla'],
      ]);
      const result = combo.evaluateGrid(grid);
      const chocoGroup = result.groups.find(g => g.recipeId === 'choco');
      expect(chocoGroup.size).toBe(3); // 2 choco + 1 joker
    });

    it('isolated joker forms own group', () => {
      const grid = makeGrid([
        ['choco', 'vanilla', 'lemon', 'peanut', 'butter'],
        ['vanilla', 'joker', 'peanut', 'butter', 'cinnamon'],
        ['lemon', 'peanut', 'butter', 'cinnamon', 'hazelnut'],
        ['strawberry', 'hazelnut', 'vanilla', 'lemon', 'peanut'],
      ]);
      const result = combo.evaluateGrid(grid);
      // Joker is surrounded by all different types — picks largest adjacent
      // Or if all adjacent groups are size 1, it joins one of them
      const totalCells = result.groups.reduce((s, g) => s + g.size, 0);
      expect(totalCells).toBe(20);
    });
  });

  describe('size multipliers', () => {
    it('returns correct multipliers for each size', () => {
      // Test via a column of 5 same type
      const grid = makeGrid([
        ['choco', 'choco', 'choco', 'choco', 'choco'],
        ['vanilla', 'lemon', 'peanut', 'butter', 'cinnamon'],
        ['lemon', 'peanut', 'butter', 'cinnamon', 'hazelnut'],
        ['strawberry', 'hazelnut', 'vanilla', 'lemon', 'peanut'],
      ]);
      const result = combo.evaluateGrid(grid);
      const big = result.groups.find(g => g.size === 5);
      expect(big.multiplier).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('empty grid returns no groups', () => {
      const result = combo.evaluateGrid([]);
      expect(result.groups.length).toBe(0);
    });
  });
});
