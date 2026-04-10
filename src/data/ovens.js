/**
 * @typedef {object} OvenType
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {number} speedMultiplier
 * @property {object|null} zoneOverrides — partial overrides on COOKING_ZONES
 * @property {string|null} specialEffect
 * @property {string} description
 * @property {boolean} startsUnlocked
 */

/** @type {OvenType[]} */
export const OVEN_TYPES = [
  {
    id: 'classic',
    name: 'Classique',
    emoji: '🔥',
    speedMultiplier: 1.0,
    zoneOverrides: null,
    specialEffect: null,
    description: 'Four standard.',
    startsUnlocked: true,
  },
  {
    id: 'turbo',
    name: 'Turbo',
    emoji: '⚡',
    speedMultiplier: 2.0,
    zoneOverrides: { PERFECT: { start: 0.72, end: 0.80 } },
    specialEffect: null,
    description: 'Cuisson 2x rapide. Zone parfaite réduite.',
    startsUnlocked: true,
  },
  {
    id: 'magic',
    name: 'Magique',
    emoji: '✨',
    speedMultiplier: 1.0,
    zoneOverrides: null,
    specialEffect: 'golden_chance',
    description: '15% de transformer un cookie en doré (x3 valeur).',
    startsUnlocked: false,
  },
  {
    id: 'cryo',
    name: 'Cryo',
    emoji: '🧊',
    speedMultiplier: 0.5,
    zoneOverrides: { PERFECT: { start: 0.60, end: 0.90, multiplier: 1.5 } },
    specialEffect: null,
    description: 'Lent. Zone parfaite large + bonus 50%.',
    startsUnlocked: false,
  },
  {
    id: 'chaos',
    name: 'Chaos',
    emoji: '🌀',
    speedMultiplier: 1.2,
    zoneOverrides: null,
    specialEffect: 'reshuffle',
    description: 'Réarrange aléatoirement les cookies dans la boîte.',
    startsUnlocked: false,
  },
];

/** @type {Map<string, OvenType>} */
export const OVEN_TYPE_MAP = new Map(OVEN_TYPES.map(o => [o.id, o]));

/**
 * @param {string} id
 * @returns {OvenType}
 */
export function getOvenType(id) {
  const o = OVEN_TYPE_MAP.get(id);
  if (!o) throw new Error(`Unknown oven type: ${id}`);
  return o;
}
