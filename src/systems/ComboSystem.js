import { getRecipe } from '../data/recipes.js';

/**
 * Grid-based pattern matching. Evaluates a 4×5 cookie grid for connected
 * groups of same-type cookies (flood fill, 4-directional adjacency).
 * Jokers (wild) attach to the largest adjacent group.
 *
 * Bigger groups = exponentially better multipliers.
 */
export class ComboSystem {
  /**
   * Evaluate a grid for connected groups.
   * @param {Array<Array<{recipeId: string}>>} grid — grid[col][row], 4 cols × 5 rows
   * @returns {{ groups: Array<{recipeId: string, size: number, multiplier: number, cells: Array<{col: number, row: number}>}>, bestGroup: object|null }}
   */
  evaluateGrid(grid) {
    if (!grid || grid.length === 0) return { groups: [], bestGroup: null };

    const width = grid.length;
    const height = grid[0].length;
    const visited = Array.from({ length: width }, () => new Array(height).fill(false));

    // Step 1: Find all non-joker groups via flood fill
    const groups = [];
    const jokerCells = [];

    for (let col = 0; col < width; col++) {
      for (let row = 0; row < height; row++) {
        if (visited[col][row]) continue;

        const recipe = getRecipe(grid[col][row].recipeId);
        if (recipe.isWild) {
          visited[col][row] = true;
          jokerCells.push({ col, row });
          continue;
        }

        const recipeId = grid[col][row].recipeId;
        const cells = [];
        const stack = [[col, row]];

        while (stack.length > 0) {
          const [c, r] = stack.pop();
          if (c < 0 || c >= width || r < 0 || r >= height) continue;
          if (visited[c][r]) continue;
          const cellRecipe = getRecipe(grid[c][r].recipeId);
          if (cellRecipe.isWild || grid[c][r].recipeId !== recipeId) continue;

          visited[c][r] = true;
          cells.push({ col: c, row: r });
          stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
        }

        if (cells.length > 0) {
          groups.push({ recipeId, cells, size: cells.length });
        }
      }
    }

    // Step 2: Assign jokers to the best adjacent group
    for (const joker of jokerCells) {
      const neighbors = [
        [joker.col + 1, joker.row], [joker.col - 1, joker.row],
        [joker.col, joker.row + 1], [joker.col, joker.row - 1],
      ];

      let bestGroup = null;
      let bestSize = 0;

      for (const [c, r] of neighbors) {
        if (c < 0 || c >= width || r < 0 || r >= height) continue;
        const adjGroup = groups.find(g => g.cells.some(cell => cell.col === c && cell.row === r));
        if (adjGroup && adjGroup.size > bestSize) {
          bestGroup = adjGroup;
          bestSize = adjGroup.size;
        }
      }

      if (bestGroup) {
        bestGroup.cells.push(joker);
        bestGroup.size++;
      } else {
        // Isolated joker — own group
        groups.push({ recipeId: 'joker', cells: [joker], size: 1 });
      }
    }

    // Step 3: Compute multipliers
    let bestGroupResult = null;

    for (const group of groups) {
      group.multiplier = this.#sizeMultiplier(group.size);
      group.name = this.#groupName(group.size);
      if (!bestGroupResult || group.size > bestGroupResult.size) {
        bestGroupResult = group;
      }
    }

    return { groups, bestGroup: bestGroupResult };
  }

  /**
   * Legacy compatibility: evaluate a flat array of cookies (for column eval or simple cases).
   * @param {Array<{recipeId: string}>} cookies
   * @returns {{ comboId: string, name: string, multiplier: number }}
   */
  evaluate(cookies) {
    if (!cookies || cookies.length === 0) {
      return { comboId: 'none', name: 'Rien', multiplier: 1, counts: {}, jokers: 0 };
    }
    // Build a 1-column grid and evaluate
    const grid = [cookies.map(c => ({ recipeId: c.recipeId }))];
    const result = this.evaluateGrid(grid);
    const best = result.bestGroup;
    return {
      comboId: best ? `group_${best.size}` : 'none',
      name: best?.name ?? 'Rien',
      multiplier: best?.multiplier ?? 1,
      counts: {},
      jokers: 0,
    };
  }

  #sizeMultiplier(size) {
    if (size <= 1) return 1;
    if (size === 2) return 1.5;
    if (size === 3) return 2;
    if (size === 4) return 3;
    if (size === 5) return 4;
    if (size === 6) return 5;
    if (size === 7) return 6;
    if (size <= 10) return 8;
    if (size <= 15) return 12;
    if (size <= 19) return 18;
    return 25; // full grid flush
  }

  #groupName(size) {
    if (size <= 1) return 'Solo';
    if (size === 2) return 'Paire';
    if (size === 3) return 'Trio';
    if (size === 4) return 'Carré';
    if (size === 5) return 'Quinte';
    if (size <= 7) return 'Chaîne';
    if (size <= 10) return 'Amas';
    if (size <= 15) return 'Domination';
    if (size <= 19) return 'Invasion';
    return 'Flush Total';
  }
}
