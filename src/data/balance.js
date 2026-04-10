/**
 * All balance constants in one place.
 * Change values here to tune the game — no code changes needed.
 */
export const BALANCE = Object.freeze({
  // Run structure
  ROUNDS_PER_RUN: 15,
  ROUND_DURATION_SEC: 300,

  // Box grid
  BOX_WIDTH: 4,
  BOX_HEIGHT: 5,
  BOX_SIZE: 5, // kept for combo eval (column length)
  DECK_SIZE: 8,

  // Paste
  INITIAL_PASTE: 5,
  PASTE_GROWTH_PER_ROUND: 3,

  // Lever
  PULL_COST: 5,
  PULL_COST_MIN: 1,

  // Starting loadout
  INITIAL_RECIPES: ['choco', 'vanilla', 'strawberry', 'lemon', 'peanut', 'butter', 'cinnamon', 'hazelnut'],
  INITIAL_RECIPE_WEIGHTS: { choco: 1, vanilla: 1, strawberry: 1, lemon: 1, peanut: 1, butter: 1, cinnamon: 1, hazelnut: 1 },
  INITIAL_OVENS: ['classic'],

  // Limits
  MAX_OVENS: 1,
  MAX_POOL_TYPES: 8,
  BENNE_CAPACITY: 20,
  MAX_COPIES_PER_RECIPE: 4,

  // Shop
  SHOP_REROLL_BASE: 10,
  SHOP_REROLL_INCREMENT: 5,
  SHOP_PRICE_SCALING: 0.5,

  // Poll
  POLL_SIZE: 4,
  POLL_REROLLS_PER_ROUND: 3,

  // Quota scaling — quota(round) = QUOTA_BASE * QUOTA_GROWTH^(round-1)
  QUOTA_BASE: 150,
  QUOTA_GROWTH: 1.35,

  // Economy
  SURPLUS_CONVERSION_RATE: 50,

  // Shop prices (in shop coins 💵)
  SHOP_PRICES: Object.freeze({
    REMOVE_COPY: 30,
    DUPLICATE_COPY: 50,
    TOPPING_CHARGE: 25,
    PASTE_TEMP: 15,
    PASTE_PERM: 60,
    REROLL_TOKEN: 40,
  }),

  PASTE_TEMP_AMOUNT: 3,
  PASTE_PERM_AMOUNT: 1,

  // Stars
  STARS_PER_ROUND: 1,
  STARS_BONUS_WIN: 10,
  STARS_BONUS_PERFECT: 5,

  // Cooking zones (progress 0→1)
  COOKING_ZONES: Object.freeze({
    RAW:     { start: 0.00, end: 0.30, multiplier: 0.5,  label: 'CRU' },
    COOKED:  { start: 0.30, end: 0.70, multiplier: 1.0,  label: 'CUIT' },
    PERFECT: { start: 0.70, end: 0.85, multiplier: 1.25, label: 'PARFAIT' },
    BURNED:  { start: 0.85, end: 1.00, multiplier: 0,    label: 'BRÛLÉ' },
  }),

  COOKING_BASE_DURATION_SEC: 7.2,

  // Fever mode
  FEVER_THRESHOLD: 5,
  FEVER_DURATION_SEC: 10,
  FEVER_MULTIPLIER: 1.5,
});

/**
 * Get the quota for a given round (1-indexed).
 * @param {number} round
 * @returns {number}
 */
export function getQuota(round) {
  return Math.floor(BALANCE.QUOTA_BASE * Math.pow(BALANCE.QUOTA_GROWTH, round - 1));
}

/**
 * Get total paste available for a given round.
 * @param {number} round
 * @param {number} [permBonus=0]
 * @param {number} [tempBonus=0]
 * @returns {number}
 */
export function getPasteForRound(round, permBonus = 0, tempBonus = 0) {
  return BALANCE.INITIAL_PASTE
    + (round - 1) * BALANCE.PASTE_GROWTH_PER_ROUND
    + permBonus
    + tempBonus;
}
