import { getTopping } from '../data/toppings.js';

/**
 * Manages topping charges and application.
 * A topping is "armed" before extraction — auto-applied to the next extracted box.
 */
export class ToppingSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Arm a topping for the next extraction.
   * @param {object} run
   * @param {string} toppingId
   * @returns {boolean}
   */
  arm(run, toppingId) {
    const entry = run.toppings.find(t => t.toppingId === toppingId);
    if (!entry || entry.charges <= 0) {
      this.#events.emit('topping:no_charges', { toppingId });
      return false;
    }

    run.armedTopping = toppingId;
    this.#events.emit('topping:armed', { toppingId });
    return true;
  }

  /**
   * Apply the armed topping to a box. Consumes 1 charge.
   * @param {object} run
   * @param {object} box
   * @returns {{ toppingId: string, effect: string, value: number }|null}
   */
  apply(run, box) {
    const toppingId = run.armedTopping;
    if (!toppingId) return null;

    const entry = run.toppings.find(t => t.toppingId === toppingId);
    if (!entry || entry.charges <= 0) {
      run.armedTopping = null;
      return null;
    }

    const def = getTopping(toppingId);

    // Consume charge
    entry.charges--;
    run.armedTopping = null;

    const result = {
      toppingId,
      effect: def.effect,
      value: def.value,
    };

    box.toppingResult = result;
    this.#events.emit('topping:applied', { toppingId, box: box.id, result });

    return result;
  }

  /**
   * Add charges for a topping (from choice or shop).
   * Creates the entry if it doesn't exist.
   * @param {object} run
   * @param {string} toppingId
   * @param {number} charges
   */
  addCharges(run, toppingId, charges) {
    getTopping(toppingId); // validate

    let entry = run.toppings.find(t => t.toppingId === toppingId);
    if (!entry) {
      entry = { toppingId, charges: 0 };
      run.toppings.push(entry);
    }
    entry.charges += charges;

    this.#events.emit('topping:charges_added', { toppingId, charges, total: entry.charges });
  }

  /**
   * Get current charges for a topping.
   * @param {object} run
   * @param {string} toppingId
   * @returns {number}
   */
  getCharges(run, toppingId) {
    const entry = run.toppings.find(t => t.toppingId === toppingId);
    return entry?.charges ?? 0;
  }
}
