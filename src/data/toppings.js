/**
 * @typedef {object} ToppingDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} effect — effect type key
 * @property {number} value — effect magnitude
 * @property {number} shopCost — price in shop coins
 * @property {string} description
 * @property {boolean} startsUnlocked
 */

/** @type {ToppingDefinition[]} */
export const TOPPINGS = [
  {
    id: 'glaze',
    name: 'Glaçage',
    emoji: '🍯',
    effect: 'value_percent',
    value: 15,
    shopCost: 25,
    description: '+15% valeur de la boîte.',
    startsUnlocked: true,
  },
  {
    id: 'sprinkles',
    name: 'Pépites',
    emoji: '🌈',
    effect: 'value_flat',
    value: 30,
    shopCost: 20,
    description: '+30🪙 valeur fixe.',
    startsUnlocked: true,
  },
  {
    id: 'chocolate_drizzle',
    name: 'Filet Chocolat',
    emoji: '🍫',
    effect: 'combo_boost',
    value: 25,
    shopCost: 35,
    description: '+25% multi de combo.',
    startsUnlocked: false,
  },
  {
    id: 'gold_leaf',
    name: "Feuille d'Or",
    emoji: '✨',
    effect: 'value_percent',
    value: 40,
    shopCost: 60,
    description: '+40% valeur de la boîte.',
    startsUnlocked: false,
  },
  {
    id: 'lucky_charm',
    name: 'Porte-Bonheur',
    emoji: '🍀',
    effect: 'lucky_reroll',
    value: 1,
    shopCost: 45,
    description: 'Relance le cookie de plus faible valeur.',
    startsUnlocked: false,
  },
];

/** @type {Map<string, ToppingDefinition>} */
export const TOPPING_MAP = new Map(TOPPINGS.map(t => [t.id, t]));

/**
 * @param {string} id
 * @returns {ToppingDefinition}
 */
export function getTopping(id) {
  const t = TOPPING_MAP.get(id);
  if (!t) throw new Error(`Unknown topping: ${id}`);
  return t;
}
