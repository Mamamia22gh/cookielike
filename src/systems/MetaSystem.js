import { BALANCE } from '../data/balance.js';

/**
 * @typedef {object} MetaUnlock
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {number} cost — in ⭐ stars
 * @property {string} category
 */

/** @type {MetaUnlock[]} */
export const META_UNLOCKS = [
  { id: 'unlock_paste_plus',   name: 'Upgrade Pâte+',       description: 'Apparaît dans les choix',       cost: 2,  category: 'upgrade' },
  { id: 'unlock_lever_plus',   name: 'Upgrade Levier+',     description: 'Apparaît dans les choix',       cost: 2,  category: 'upgrade' },
  { id: 'unlock_benne_plus',   name: 'Upgrade Benne+',      description: 'Apparaît dans les choix',       cost: 3,  category: 'upgrade' },
  { id: 'unlock_caramel',       name: 'Recette Caramel',      description: 'Apparaît dans les choix',       cost: 3,  category: 'recipe' },
  { id: 'unlock_matcha',        name: 'Recette Matcha',       description: 'Apparaît dans les choix',       cost: 4,  category: 'recipe' },
  { id: 'unlock_coconut',       name: 'Recette Noix de coco', description: 'Apparaît dans les choix',       cost: 3,  category: 'recipe' },
  { id: 'unlock_macaron',       name: 'Recette Macaron',      description: 'Apparaît dans les choix',       cost: 8,  category: 'recipe' },
  { id: 'unlock_truffle',       name: 'Recette Truffe',       description: 'Apparaît dans les choix',       cost: 12, category: 'recipe' },
  { id: 'unlock_joker',         name: 'Joker 🃏',             description: 'Cookie wildcard dans les choix', cost: 15, category: 'recipe' },
  { id: 'unlock_magic_oven',    name: 'Four Magique',         description: 'Apparaît dans les choix',       cost: 6,  category: 'oven' },
  { id: 'unlock_cryo_oven',     name: 'Four Cryo',            description: 'Apparaît dans les choix',       cost: 5,  category: 'oven' },
  { id: 'unlock_chaos_oven',    name: 'Four Chaos',           description: 'Apparaît dans les choix',       cost: 8,  category: 'oven' },
  { id: 'unlock_choco_drizzle', name: 'Topping Filet Choco',  description: 'Apparaît dans les choix',       cost: 4,  category: 'topping' },
  { id: 'unlock_gold_leaf',     name: "Topping Feuille d'Or", description: 'Apparaît dans les choix',       cost: 7,  category: 'topping' },
  { id: 'unlock_lucky_charm',   name: 'Topping Porte-Bonheur',description: 'Apparaît dans les choix',      cost: 6,  category: 'topping' },
  { id: 'unlock_box_xl',        name: 'Boîte XL',             description: '6 cookies par boîte',           cost: 10, category: 'upgrade' },
];

/** @type {Map<string, MetaUnlock>} */
export const UNLOCK_MAP = new Map(META_UNLOCKS.map(u => [u.id, u]));

/**
 * Meta-progression system: stars, unlocks, cross-run persistence.
 */
export class MetaSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Calculate stars earned from a run.
   * @param {object} run
   * @param {boolean} won
   * @returns {number}
   */
  calculateStars(run, won = false) {
    let stars = run.round * BALANCE.STARS_PER_ROUND;
    if (won) stars += BALANCE.STARS_BONUS_WIN;
    return stars;
  }

  /**
   * Attempt to purchase an unlock.
   * @param {object} meta
   * @param {string} unlockId
   * @returns {boolean}
   */
  unlock(meta, unlockId) {
    const def = UNLOCK_MAP.get(unlockId);
    if (!def) {
      this.#events.emit('meta:unknown_unlock', { unlockId });
      return false;
    }

    if (meta.unlocks.includes(unlockId)) {
      this.#events.emit('meta:already_unlocked', { unlockId });
      return false;
    }

    if (meta.stars < def.cost) {
      this.#events.emit('meta:insufficient_stars', { unlockId, cost: def.cost, available: meta.stars });
      return false;
    }

    meta.stars -= def.cost;
    meta.unlocks.push(unlockId);

    this.#events.emit('meta:unlocked', { unlockId, name: def.name, remainingStars: meta.stars });
    return true;
  }

  /**
   * Check if something is unlocked.
   * @param {object} meta
   * @param {string} unlockId
   * @returns {boolean}
   */
  isUnlocked(meta, unlockId) {
    return meta.unlocks.includes(unlockId);
  }

  /**
   * Get all unlocks with their status and affordability.
   * @param {object} meta
   * @returns {Array<MetaUnlock & { unlocked: boolean, affordable: boolean }>}
   */
  getAvailableUnlocks(meta) {
    return META_UNLOCKS.map(u => ({
      ...u,
      unlocked: meta.unlocks.includes(u.id),
      affordable: meta.stars >= u.cost,
    }));
  }
}
