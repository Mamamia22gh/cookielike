import { CHOICES } from '../data/choices.js';
import { BALANCE } from '../data/balance.js';
import { uid } from '../core/GameState.js';

/**
 * Generates and applies between-round choices (the roguelike core).
 */
export class ChoiceSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Generate 3 random choices for the player.
   * Filters by meta unlocks and avoids duplicates / irrelevant options.
   * @param {object} run
   * @param {object} meta
   * @param {import('../core/RNG.js').RNG} rng
   * @returns {object[]}
   */
  generate(run, meta, rng) {
    const available = CHOICES.filter(c => this.#isAvailable(c, run, meta));

    if (available.length === 0) return [];

    const count = Math.min(3, available.length);
    const chosen = [];
    const usedIds = new Set();
    const usedTypes = new Set();

    for (let i = 0; i < count; i++) {
      let remaining = available.filter(c => !usedIds.has(c.id));
      if (remaining.length === 0) break;

      // Prioritize type diversity: prefer types we haven't picked yet
      const diversePool = remaining.filter(c => !usedTypes.has(this.#choiceCategory(c)));
      if (diversePool.length > 0) remaining = diversePool;

      const weights = remaining.map(c => c.weight);
      const pick = rng.pickWeighted(remaining, weights);
      chosen.push({ ...pick, instanceId: uid('choice') });
      usedIds.add(pick.id);
      usedTypes.add(this.#choiceCategory(pick));
    }

    return chosen;
  }

  /**
   * Broad category for diversity: recipe, power (oven/upgrade), consumable (topping).
   * @param {object} choice
   * @returns {string}
   */
  #choiceCategory(choice) {
    switch (choice.type) {
      case 'recipe': case 'recipe_copy': case 'recipe_remove': return 'recipe';
      case 'oven': case 'upgrade': return 'power';
      case 'topping': return 'consumable';
      default: return 'other';
    }
  }

  /**
   * Apply a chosen option to the run state.
   * @param {object} run
   * @param {object} choice
   * @param {string|null} targetRecipeId — for recipe_copy / recipe_remove
   * @param {import('../core/RNG.js').RNG} rng
   * @returns {boolean}
   */
  apply(run, choice, targetRecipeId, rng) {
    switch (choice.type) {
      case 'recipe':
        return this.#applyRecipe(run, choice);

      case 'recipe_copy':
        if (!targetRecipeId) {
          this.#events.emit('choice:needs_target', { choice, pool: run.machine.pool });
          return false;
        }
        return this.#applyCopy(run, targetRecipeId);

      case 'recipe_remove':
        if (!targetRecipeId) {
          this.#events.emit('choice:needs_target', { choice, pool: run.machine.pool });
          return false;
        }
        return this.#applyRemove(run, targetRecipeId);

      case 'oven':
        return this.#applyOven(run, choice);

      case 'upgrade':
        return this.#applyUpgrade(run, choice);

      case 'topping':
        return this.#applyTopping(run, choice);

      default:
        this.#events.emit('error', { message: `Unknown choice type: ${choice.type}` });
        return false;
    }
  }

  // ── Private ──

  #isAvailable(choice, run, meta) {
    // Check meta unlock requirement
    if (choice.requiresUnlock && !meta.unlocks.includes(choice.requiresUnlock)) {
      return false;
    }

    // Check round tier requirement
    if (choice.minRound && run.round < choice.minRound) {
      return false;
    }

    // Type-specific filters
    switch (choice.type) {
      case 'oven':
        // Can't exceed max ovens
        if (run.ovens.length >= BALANCE.MAX_OVENS) return false;
        // Don't offer an oven type we already have
        if (run.ovens.some(o => o.typeId === choice.payload.ovenType)) return false;
        return true;

      case 'upgrade':
        // Don't offer upgrades we already have (except stackable ones)
        if (this.#isUnique(choice.payload.upgradeId)) {
          if (run.cookingUpgrades.includes(choice.payload.upgradeId)) return false;
        }
        return true;

      case 'recipe': {
        // Don't offer if pool is full and this type isn't already in it
        if (run.machine.pool.length >= BALANCE.MAX_POOL_TYPES) {
          if (!run.machine.pool.some(e => e.recipeId === choice.payload.recipeId)) return false;
        }
        // Don't offer if already at max copies
        const recipeEntry = run.machine.pool.find(e => e.recipeId === choice.payload.recipeId);
        if (recipeEntry && recipeEntry.weight >= BALANCE.MAX_COPIES_PER_RECIPE) return false;
        return true;
      }

      case 'recipe_copy':
        return run.machine.pool.some(e => e.weight < BALANCE.MAX_COPIES_PER_RECIPE);

      case 'recipe_remove': {
        const totalWeight = run.machine.pool.reduce((s, e) => s + e.weight, 0);
        return totalWeight > 1;
      }

      default:
        return true;
    }
  }

  #isUnique(upgradeId) {
    const stackable = ['paste_perm', 'pull_cost', 'benne_capacity'];
    return !stackable.includes(upgradeId);
  }

  #applyRecipe(run, choice) {
    const { recipeId } = choice.payload;
    const existing = run.machine.pool.find(e => e.recipeId === recipeId);
    if (existing) {
      if (existing.weight >= BALANCE.MAX_COPIES_PER_RECIPE) {
        this.#events.emit('error', { message: `Max ${BALANCE.MAX_COPIES_PER_RECIPE} copies par recette` });
        return false;
      }
      existing.weight++;
    } else {
      run.machine.pool.push({ recipeId, weight: 1 });
    }
    this.#events.emit('choice:applied_recipe', { recipeId });
    return true;
  }

  #applyCopy(run, recipeId) {
    const entry = run.machine.pool.find(e => e.recipeId === recipeId);
    if (!entry) {
      this.#events.emit('error', { message: `Recipe ${recipeId} not in pool` });
      return false;
    }
    if (entry.weight >= BALANCE.MAX_COPIES_PER_RECIPE) {
      this.#events.emit('error', { message: `Max ${BALANCE.MAX_COPIES_PER_RECIPE} copies atteintes` });
      return false;
    }
    entry.weight++;
    this.#events.emit('choice:applied_copy', { recipeId, newWeight: entry.weight });
    return true;
  }

  #applyRemove(run, recipeId) {
    const idx = run.machine.pool.findIndex(e => e.recipeId === recipeId);
    if (idx === -1) {
      this.#events.emit('error', { message: `Recipe ${recipeId} not in pool` });
      return false;
    }
    const totalWeight = run.machine.pool.reduce((s, e) => s + e.weight, 0);
    if (totalWeight <= 1) {
      this.#events.emit('error', { message: 'Cannot remove last recipe' });
      return false;
    }
    run.machine.pool[idx].weight--;
    if (run.machine.pool[idx].weight <= 0) {
      run.machine.pool.splice(idx, 1);
    }
    this.#events.emit('choice:applied_remove', { recipeId });
    return true;
  }

  #applyOven(run, choice) {
    if (run.ovens.length >= BALANCE.MAX_OVENS) {
      this.#events.emit('error', { message: 'Max ovens reached' });
      return false;
    }
    run.ovens.push({
      id: uid('oven'),
      typeId: choice.payload.ovenType,
      box: null,
      progress: 0,
    });
    this.#events.emit('choice:applied_oven', { ovenType: choice.payload.ovenType });
    return true;
  }

  #applyUpgrade(run, choice) {
    const { upgradeId, effect } = choice.payload;

    run.cookingUpgrades.push(upgradeId);

    // Apply immediate effects
    if (effect) {
      if (effect.pasteBonus) run.paste.bonusPerm += effect.pasteBonus;
      if (effect.pullCostReduction) run.pullCost = Math.max(BALANCE.PULL_COST_MIN, run.pullCost - effect.pullCostReduction);
      if (effect.benneBonus) run.benne.capacity += effect.benneBonus;
      if (effect.boxSizeBonus) run.boxSize += effect.boxSizeBonus;
    }

    this.#events.emit('choice:applied_upgrade', { upgradeId });
    return true;
  }

  #applyTopping(run, choice) {
    const { toppingId, charges } = choice.payload;
    let entry = run.toppings.find(t => t.toppingId === toppingId);
    if (!entry) {
      entry = { toppingId, charges: 0 };
      run.toppings.push(entry);
    }
    entry.charges += charges;
    this.#events.emit('choice:applied_topping', { toppingId, charges, total: entry.charges });
    return true;
  }
}
