import { uid } from '../core/GameState.js';
import { getRecipe } from '../data/recipes.js';

/**
 * Creates and scores cookie boxes.
 * Box = 4×5 grid of cookies. Scoring is group-based (connected same-type cookies).
 */
export class BoxSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Create a box from a flat array of cookies arranged into a grid.
   * @param {Array<{recipeId: string}>} cookies — flat array (BOX_WIDTH × boxHeight)
   * @param {number} boxWidth — number of columns (4)
   * @param {number} boxHeight — cookies per column (5)
   * @returns {object} box with grid
   */
  create(cookies, boxWidth, boxHeight) {
    const grid = [];
    for (let col = 0; col < boxWidth; col++) {
      const column = [];
      for (let row = 0; row < boxHeight; row++) {
        const idx = col * boxHeight + row;
        column.push({
          recipeId: cookies[idx]?.recipeId ?? cookies[0]?.recipeId,
          cookingZone: null,
          cookingMulti: 1,
        });
      }
      grid.push(column);
    }

    return {
      id: uid('box'),
      grid,
      cookies: cookies.slice(0, boxWidth * boxHeight),
      gridResult: null,
      comboResult: null,
      toppingResult: null,
      value: 0,
    };
  }

  /**
   * Score a completed box using grid groups from ComboSystem.evaluateGrid.
   *
   * Per group:
   *   groupBase = Σ (cookie.baseValue + perCookieFlat + recipeBonus%) × cookingMulti
   *   groupValue = groupBase × group.multiplier × (1 + comboMultiPercent%)
   *
   * Total: Σ groupValues × (1 + boxValuePercent%) + boxValueFlat + toppings
   *
   * @param {object} box — must have gridResult set
   * @param {object} [mods={}] — effect modifiers from EffectSystem
   * @returns {number}
   */
  score(box, mods = {}) {
    const {
      boxValuePercent = 0,
      boxValueFlat = 0,
      comboMultiPercent = 0,
      perCookieFlat = 0,
      recipeBonus = {},
    } = mods;

    const groups = box.gridResult?.groups ?? [];
    let totalValue = 0;

    for (const group of groups) {
      let groupBase = 0;

      for (const cell of group.cells) {
        const cookie = box.grid[cell.col][cell.row];
        const recipe = getRecipe(cookie.recipeId);
        let cookieVal = recipe.baseValue + perCookieFlat;

        // Per-recipe bonus from artifacts
        const rBonus = recipeBonus[cookie.recipeId];
        if (rBonus) cookieVal = Math.floor(cookieVal * (1 + rBonus / 100));

        groupBase += cookieVal * (cookie.cookingMulti ?? 1);
      }

      let groupMulti = group.multiplier;
      groupMulti *= (1 + comboMultiPercent / 100);

      totalValue += Math.floor(groupBase * groupMulti);
    }

    // Box-level percent bonus
    totalValue = Math.floor(totalValue * (1 + boxValuePercent / 100));
    totalValue += boxValueFlat;

    // Topping effects
    if (box.toppingResult) {
      const { effect, value } = box.toppingResult;
      const repeat = mods.toppingRepeat ?? 1;
      for (let r = 0; r < repeat; r++) {
        switch (effect) {
          case 'value_percent':
            totalValue = Math.floor(totalValue * (1 + value / 100));
            break;
          case 'value_flat':
            totalValue += value;
            break;
          case 'combo_boost':
            totalValue = Math.floor(totalValue * (1 + value / 100));
            break;
        }
      }
    }

    return Math.max(0, totalValue);
  }
}
