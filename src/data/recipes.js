/**
 * @typedef {object} Recipe
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {number} baseValue — base 🪙 value per cookie
 * @property {number} pasteCost — paste consumed per cookie when pulled
 * @property {'common'|'uncommon'|'rare'|'legendary'} rarity
 * @property {boolean} startsUnlocked
 * @property {boolean} isWild — true for joker/wildcard cookies
 */

/** @type {Recipe[]} */
export const RECIPES = [
  // Starters (8 common — mandatory deck)
  { id: 'choco',      name: 'Chocolat',      emoji: '🍫', baseValue: 8,  pasteCost: 1, rarity: 'common',    startsUnlocked: true,  isWild: false },
  { id: 'vanilla',    name: 'Vanille',       emoji: '🍦', baseValue: 8,  pasteCost: 1, rarity: 'common',    startsUnlocked: true,  isWild: false },
  { id: 'strawberry', name: 'Fraise',        emoji: '🍓', baseValue: 8,  pasteCost: 1, rarity: 'common',    startsUnlocked: true,  isWild: false },
  { id: 'lemon',      name: 'Citron',        emoji: '🍋', baseValue: 8,  pasteCost: 1, rarity: 'common',    startsUnlocked: true,  isWild: false },
  { id: 'peanut',     name: 'Cacahuète',     emoji: '🥜', baseValue: 8,  pasteCost: 1, rarity: 'common',    startsUnlocked: true,  isWild: false },
  { id: 'butter',     name: 'Beurre',        emoji: '🧈', baseValue: 8,  pasteCost: 1, rarity: 'common',    startsUnlocked: true,  isWild: false },
  { id: 'cinnamon',   name: 'Cannelle',      emoji: '🫚', baseValue: 8,  pasteCost: 1, rarity: 'common',    startsUnlocked: true,  isWild: false },
  { id: 'hazelnut',   name: 'Noisette',      emoji: '🌰', baseValue: 8,  pasteCost: 1, rarity: 'common',    startsUnlocked: true,  isWild: false },

  // Uncommon
  { id: 'caramel',    name: 'Caramel',       emoji: '🍯', baseValue: 18, pasteCost: 2, rarity: 'uncommon',  startsUnlocked: false, isWild: false },
  { id: 'matcha',     name: 'Matcha',        emoji: '🍵', baseValue: 22, pasteCost: 2, rarity: 'uncommon',  startsUnlocked: false, isWild: false },
  { id: 'coconut',    name: 'Noix de coco',  emoji: '🥥', baseValue: 16, pasteCost: 2, rarity: 'uncommon',  startsUnlocked: false, isWild: false },

  // Rare
  { id: 'macaron',    name: 'Macaron',       emoji: '🧁', baseValue: 35, pasteCost: 3, rarity: 'rare',      startsUnlocked: false, isWild: false },
  { id: 'truffle',    name: 'Truffe',        emoji: '🍬', baseValue: 48, pasteCost: 3, rarity: 'rare',      startsUnlocked: false, isWild: false },

  // Legendary
  { id: 'golden',     name: 'Cookie Doré',   emoji: '✨', baseValue: 80, pasteCost: 5, rarity: 'legendary', startsUnlocked: false, isWild: false },

  // Wildcard
  { id: 'joker',      name: 'Joker',         emoji: '🃏', baseValue: 5,  pasteCost: 1, rarity: 'rare',      startsUnlocked: false, isWild: true },
];

/** @type {Map<string, Recipe>} */
export const RECIPE_MAP = new Map(RECIPES.map(r => [r.id, r]));

/**
 * @param {string} id
 * @returns {Recipe}
 */
export function getRecipe(id) {
  const r = RECIPE_MAP.get(id);
  if (!r) throw new Error(`Unknown recipe: ${id}`);
  return r;
}
