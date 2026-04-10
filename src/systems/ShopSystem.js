import { BALANCE } from '../data/balance.js';
import { getRecipe } from '../data/recipes.js';
import { getTopping } from '../data/toppings.js';
import { ARTIFACTS, RARITY_WEIGHTS, getArtifact } from '../data/artifacts.js';

/**
 * Random shop with artifact offerings + fixed actions.
 */
export class ShopSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Generate random artifact offerings for the shop.
   * @param {object} run
   * @param {import('../core/RNG.js').RNG} rng
   * @returns {object[]} offerings
   */
  generateOfferings(run, rng) {
    const round = run.round;
    const count = round >= 10 ? 4 : round >= 5 ? 3 : 2;

    const available = ARTIFACTS.filter(a => {
      if (a.minRound > round) return false;
      if (a.requiresUnlock) return false; // TODO: check meta unlocks
      // Don't offer artifacts we already own (unique)
      if (run.artifacts.some(owned => owned.id === a.id)) return false;
      return true;
    });

    // No artifacts at all without at least some meta progression
    if (!run.shopOfferings && available.length === 0) return [];

    if (available.length === 0) return [];

    const offerings = [];
    const usedIds = new Set();

    for (let i = 0; i < count && available.length > usedIds.size; i++) {
      const pool = available.filter(a => !usedIds.has(a.id));
      if (pool.length === 0) break;

      // Weight by rarity
      const weights = pool.map(a => RARITY_WEIGHTS[a.rarity] || 1);
      const pick = rng.pickWeighted(pool, weights);

      // Apply shop discount
      const discount = run.shopDiscount || 0;
      const cost = Math.max(1, Math.ceil(pick.cost * (1 - discount / 100)));

      offerings.push({ ...pick, finalCost: cost });
      usedIds.add(pick.id);
    }

    return offerings;
  }

  /**
   * Buy an artifact from offerings.
   * @param {object} run
   * @param {number} offeringIndex
   * @returns {boolean}
   */
  buyArtifact(run, offeringIndex) {
    const offering = run.shopOfferings[offeringIndex];
    if (!offering) {
      this.#events.emit('shop:invalid_offering', { offeringIndex });
      return false;
    }

    if (run.shopCurrency < offering.finalCost) {
      this.#events.emit('shop:insufficient_funds', { cost: offering.finalCost, available: run.shopCurrency });
      return false;
    }

    run.shopCurrency -= offering.finalCost;
    run.artifacts.push(offering);
    run.shopOfferings.splice(offeringIndex, 1);

    this.#events.emit('shop:artifact_bought', {
      artifact: offering,
      cost: offering.finalCost,
      remaining: run.shopCurrency,
    });
    return true;
  }

  /**
   * Reroll shop offerings.
   * @param {object} run
   * @param {import('../core/RNG.js').RNG} rng
   * @returns {boolean}
   */
  reroll(run, rng) {
    const cost = BALANCE.SHOP_REROLL_BASE + run.rerollCount * BALANCE.SHOP_REROLL_INCREMENT;

    if (run.shopCurrency < cost) {
      this.#events.emit('shop:insufficient_funds', { cost, available: run.shopCurrency });
      return false;
    }

    run.shopCurrency -= cost;
    run.rerollCount++;
    run.shopOfferings = this.generateOfferings(run, rng, null); // reroll doesn't re-check meta gate

    this.#events.emit('shop:rerolled', { cost, offerings: run.shopOfferings });
    return true;
  }

  /**
   * Buy a fixed action (pool manipulation).
   * @param {object} run
   * @param {string} actionId
   * @param {string|null} target
   * @returns {boolean}
   */
  buyAction(run, actionId, target = null) {
    const discount = run.shopDiscount || 0;
    const scale = (base) => {
      const count = run.shopHistory?.[actionId] || 0;
      const scaled = Math.ceil(base * (1 + BALANCE.SHOP_PRICE_SCALING * count));
      return Math.max(1, Math.ceil(scaled * (1 - discount / 100)));
    };

    let result;
    switch (actionId) {
      case 'remove_copy':
        result = this.#buyRemove(run, target, scale(BALANCE.SHOP_PRICES.REMOVE_COPY));
        break;
      case 'duplicate_copy':
        result = this.#buyDuplicate(run, target, scale(BALANCE.SHOP_PRICES.DUPLICATE_COPY));
        break;
      default:
        this.#events.emit('shop:unknown_action', { actionId });
        return false;
    }

    if (result) {
      run.shopHistory[actionId] = (run.shopHistory[actionId] || 0) + 1;
    }
    return result;
  }

  // ── Private ──

  #spend(run, cost) {
    if (run.shopCurrency < cost) {
      this.#events.emit('shop:insufficient_funds', { cost, available: run.shopCurrency });
      return false;
    }
    run.shopCurrency -= cost;
    return true;
  }

  #buyRemove(run, recipeId, cost) {
    if (!recipeId) {
      this.#events.emit('shop:needs_target', { action: 'remove_copy' });
      return false;
    }
    if (!this.#spend(run, cost)) return false;

    const idx = run.machine.pool.findIndex(e => e.recipeId === recipeId);
    if (idx === -1) {
      run.shopCurrency += cost;
      return false;
    }

    const totalWeight = run.machine.pool.reduce((s, e) => s + e.weight, 0);
    if (totalWeight <= 1) {
      run.shopCurrency += cost;
      this.#events.emit('shop:cannot_remove_last');
      return false;
    }

    run.machine.pool[idx].weight--;
    if (run.machine.pool[idx].weight <= 0) run.machine.pool.splice(idx, 1);

    this.#events.emit('shop:bought', { action: 'remove_copy', recipeId, cost });
    return true;
  }

  #buyDuplicate(run, recipeId, cost) {
    if (!recipeId) {
      this.#events.emit('shop:needs_target', { action: 'duplicate_copy' });
      return false;
    }
    if (!this.#spend(run, cost)) return false;

    const entry = run.machine.pool.find(e => e.recipeId === recipeId);
    if (!entry) { run.shopCurrency += cost; return false; }

    if (entry.weight >= BALANCE.MAX_COPIES_PER_RECIPE) {
      run.shopCurrency += cost;
      this.#events.emit('machine:max_copies', { recipeId, max: BALANCE.MAX_COPIES_PER_RECIPE });
      return false;
    }

    entry.weight++;
    this.#events.emit('shop:bought', { action: 'duplicate_copy', recipeId, cost });
    return true;
  }
}
