/**
 * Combo definitions — evaluated like poker hands on a box of cookies.
 * Higher priority = better hand = checked first.
 *
 * @typedef {object} ComboDefinition
 * @property {string} id
 * @property {string} name
 * @property {number} multiplier
 * @property {number} priority
 * @property {string} description
 */

/** @type {ComboDefinition[]} */
export const COMBOS = [
  { id: 'flush',           name: 'Flush',         multiplier: 10,  priority: 8, description: '5 cookies identiques' },
  { id: 'four_of_a_kind',  name: 'Carré',         multiplier: 5,   priority: 7, description: '4 cookies identiques' },
  { id: 'full_house',      name: 'Full House',    multiplier: 4,   priority: 6, description: 'Brelan + Paire' },
  { id: 'rainbow',         name: 'Rainbow',       multiplier: 3.5, priority: 5, description: '5 types différents' },
  { id: 'three_of_a_kind', name: 'Brelan',        multiplier: 2.5, priority: 4, description: '3 cookies identiques' },
  { id: 'two_pair',        name: 'Double Paire',  multiplier: 2,   priority: 3, description: '2 paires différentes' },
  { id: 'pair',            name: 'Paire',         multiplier: 1.5, priority: 2, description: '2 cookies identiques' },
  { id: 'none',            name: 'Rien',          multiplier: 1,   priority: 0, description: 'Aucun combo' },
];

/** @type {Map<string, ComboDefinition>} */
export const COMBO_MAP = new Map(COMBOS.map(c => [c.id, c]));

/** Pre-sorted by priority descending for evaluation. */
export const COMBOS_BY_PRIORITY = [...COMBOS].sort((a, b) => b.priority - a.priority);
