import { getRecipe } from '../data/recipes.js';
import { BALANCE } from '../data/balance.js';

/**
 * Manages the cookie machine: recipe pool, probabilities, lever pulls.
 */
export class MachineSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Calculate probability breakdown for the current pool.
   * @param {Array<{recipeId: string, weight: number}>} pool
   * @returns {Array<{recipeId: string, weight: number, probability: number, recipe: object}>}
   */
  getProbabilities(pool) {
    const total = pool.reduce((s, e) => s + e.weight, 0);
    if (total === 0) return [];

    return pool.map(entry => ({
      recipeId: entry.recipeId,
      weight: entry.weight,
      probability: entry.weight / total,
      recipe: getRecipe(entry.recipeId),
    }));
  }

  /**
   * Get the paste cost for one lever pull.
   * @param {object} run
   * @returns {number}
   */
  getPullCost(run) {
    const pool = run.machine.pool;
    const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
    if (totalWeight === 0) return run.boxSize;

    const weightedCost = pool.reduce((s, e) => {
      return s + getRecipe(e.recipeId).pasteCost * e.weight;
    }, 0);

    const baseCost = Math.ceil((weightedCost / totalWeight) * run.boxSize);
    const reductions = run.cookingUpgrades.filter(u => u === 'pull_cost').length;
    return Math.max(BALANCE.PULL_COST_MIN, baseCost - reductions);
  }

  /**
   * Pull the lever: generate an array of random cookies based on pool weights.
   * Does NOT deduct paste (GameLoop handles that).
   * @param {object} run
   * @param {import('../core/RNG.js').RNG} rng
   * @returns {Array<{recipeId: string}>}
   */
  pull(run, rng) {
    const pool = run.machine.pool;
    if (pool.length === 0) {
      this.#events.emit('machine:empty_pool');
      return [];
    }

    const ids = pool.map(e => e.recipeId);
    const weights = pool.map(e => e.weight);
    const boxSize = run.boxSize;
    const cookies = [];

    for (let i = 0; i < boxSize; i++) {
      const recipeId = rng.pickWeighted(ids, weights);
      cookies.push({ recipeId });
    }

    return cookies;
  }

  /**
   * Add a new recipe to the pool (weight 1).
   * @param {object} run
   * @param {string} recipeId
   * @returns {boolean}
   */
  addRecipe(run, recipeId) {
    getRecipe(recipeId); // validate

    const existing = run.machine.pool.find(e => e.recipeId === recipeId);
    if (existing) {
      if (existing.weight >= BALANCE.MAX_COPIES_PER_RECIPE) {
        this.#events.emit('machine:max_copies', { recipeId, max: BALANCE.MAX_COPIES_PER_RECIPE });
        return false;
      }
      existing.weight++;
    } else {
      if (run.machine.pool.length >= BALANCE.MAX_POOL_TYPES) {
        this.#events.emit('machine:pool_full');
        return false;
      }
      run.machine.pool.push({ recipeId, weight: 1 });
    }

    this.#events.emit('machine:recipe_added', { recipeId, pool: run.machine.pool });
    return true;
  }

  /**
   * Remove one weight from a recipe. Removes entry if weight reaches 0.
   * @param {object} run
   * @param {string} recipeId
   * @returns {boolean}
   */
  removeRecipe(run, recipeId) {
    const idx = run.machine.pool.findIndex(e => e.recipeId === recipeId);
    if (idx === -1) {
      this.#events.emit('machine:recipe_not_found', { recipeId });
      return false;
    }

    // Can't remove if pool would be empty
    const totalEntries = run.machine.pool.reduce((s, e) => s + e.weight, 0);
    if (totalEntries <= 1) {
      this.#events.emit('machine:cannot_remove_last');
      return false;
    }

    run.machine.pool[idx].weight--;
    if (run.machine.pool[idx].weight <= 0) {
      run.machine.pool.splice(idx, 1);
    }

    this.#events.emit('machine:recipe_removed', { recipeId, pool: run.machine.pool });
    return true;
  }

  /**
   * Duplicate: increase weight of an existing recipe by 1.
   * @param {object} run
   * @param {string} recipeId
   * @returns {boolean}
   */
  duplicateRecipe(run, recipeId) {
    const entry = run.machine.pool.find(e => e.recipeId === recipeId);
    if (!entry) {
      this.#events.emit('machine:recipe_not_found', { recipeId });
      return false;
    }

    if (entry.weight >= BALANCE.MAX_COPIES_PER_RECIPE) {
      this.#events.emit('machine:max_copies', { recipeId, max: BALANCE.MAX_COPIES_PER_RECIPE });
      return false;
    }

    entry.weight++;
    this.#events.emit('machine:recipe_duplicated', { recipeId, newWeight: entry.weight, pool: run.machine.pool });
    return true;
  }
}
