/**
 * Artifact definitions — permanent run items with stackable effects.
 * Effects have meta-levels: 0 = direct, 1 = meta, 2 = meta-meta, 3 = meta³
 *
 * @typedef {object} ArtifactDef
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} description
 * @property {'common'|'uncommon'|'rare'|'legendary'} rarity
 * @property {number} cost
 * @property {number} minRound
 * @property {Array<{type: string, value: number, metaLevel: number, condition?: object}>} effects
 * @property {string|null} requiresUnlock
 */

/** @type {ArtifactDef[]} */
export const ARTIFACTS = [
  // ══════ COMMON — Level 0 (15-30💵) ══════
  { id: 'salt',          name: 'Sel Marin',      emoji: '🧂', description: '+20% valeur boîtes',                rarity: 'common',    cost: 30,  minRound: 1,  requiresUnlock: null, effects: [{ type: 'box_value_percent', value: 20, metaLevel: 0 }] },
  { id: 'golden_touch',  name: 'Main Dorée',     emoji: '✋', description: '+4🪙 par cookie',                   rarity: 'common',    cost: 35,  minRound: 1,  requiresUnlock: null, effects: [{ type: 'per_cookie_flat', value: 4, metaLevel: 0 }] },
  { id: 'conveyor',      name: 'Convoyeur',      emoji: '⚙️', description: '+25% vitesse cuisson',             rarity: 'common',    cost: 30,  minRound: 1,  requiresUnlock: null, effects: [{ type: 'cooking_speed_percent', value: 25, metaLevel: 0 }] },
  { id: 'butterer',      name: 'Beurrier',       emoji: '🧈', description: '+5 pâte au début du round',        rarity: 'common',    cost: 35,  minRound: 1,  requiresUnlock: null, effects: [{ type: 'paste_round_start', value: 5, metaLevel: 0 }] },
  { id: 'piggy_bank',    name: 'Tirelire',       emoji: '🐷', description: '+8💵 à chaque fin de round',       rarity: 'common',    cost: 25,  minRound: 1,  requiresUnlock: null, effects: [{ type: 'money_round_end', value: 8, metaLevel: 0 }] },
  { id: 'trailer',       name: 'Remorque',       emoji: '🚛', description: '+3 capacité benne',                rarity: 'common',    cost: 20,  minRound: 1,  requiresUnlock: null, effects: [{ type: 'benne_capacity', value: 3, metaLevel: 0 }] },
  { id: 'sugar_rush',    name: 'Rush Sucré',     emoji: '🍭', description: '+10% multi combo',                 rarity: 'common',    cost: 35,  minRound: 2,  requiresUnlock: null, effects: [{ type: 'combo_multi_percent', value: 10, metaLevel: 0 }] },
  { id: 'thick_dough',   name: 'Pâte Épaisse',   emoji: '🫓', description: '+3 pâte permanente',               rarity: 'common',    cost: 40,  minRound: 1,  requiresUnlock: null, effects: [{ type: 'paste_permanent', value: 3, metaLevel: 0 }] },

  // ══════ UNCOMMON — Level 0 (35-55💵) ══════
  { id: 'combo_hunter',  name: 'Chasseur Combo', emoji: '🎯', description: '+30% multi combo',                 rarity: 'uncommon',  cost: 45,  minRound: 3,  requiresUnlock: null, effects: [{ type: 'combo_multi_percent', value: 30, metaLevel: 0 }] },
  { id: 'eagle_eye',     name: 'Œil de Lynx',    emoji: '🦅', description: '+20% zone parfaite',               rarity: 'uncommon',  cost: 40,  minRound: 3,  requiresUnlock: null, effects: [{ type: 'perfect_zone_bonus', value: 20, metaLevel: 0 }] },
  { id: 'fire_glove',    name: 'Gant Ignifugé',  emoji: '🧤', description: 'Brûlé → x0.5 au lieu de x0',      rarity: 'uncommon',  cost: 50,  minRound: 4,  requiresUnlock: null, effects: [{ type: 'burned_override', value: 0.5, metaLevel: 0 }] },
  { id: 'sashimi',       name: 'Sashimi',        emoji: '🍣', description: 'Cru → x1.0 au lieu de x0.5',      rarity: 'uncommon',  cost: 45,  minRound: 4,  requiresUnlock: null, effects: [{ type: 'raw_override', value: 1.0, metaLevel: 0 }] },
  { id: 'bargain',       name: 'Négociateur',    emoji: '🤝', description: '-20% prix du shop',                rarity: 'uncommon',  cost: 35,  minRound: 2,  requiresUnlock: null, effects: [{ type: 'shop_discount', value: 20, metaLevel: 0 }] },
  { id: 'choco_addict',  name: 'Choco Addict',   emoji: '🍫', description: '+50% valeur cookies Chocolat',     rarity: 'uncommon',  cost: 40,  minRound: 3,  requiresUnlock: null, effects: [{ type: 'recipe_value_percent', value: 50, metaLevel: 0, condition: { recipeId: 'choco' } }] },
  { id: 'lucky_pull',    name: 'Dé Pipé',        emoji: '🎲', description: '+15% valeur boîtes (aléatoire)',   rarity: 'uncommon',  cost: 35,  minRound: 2,  requiresUnlock: null, effects: [{ type: 'box_value_percent', value: 15, metaLevel: 0 }] },

  // ══════ RARE — Level 1 Meta (60-100💵) ══════
  { id: 'amplifier',     name: 'Amplificateur',  emoji: '🔮', description: 'META: Tous les bonus % ×1.5',    rarity: 'rare',      cost: 100, minRound: 7,  requiresUnlock: null, effects: [{ type: 'percent_multiplier', value: 1.5, metaLevel: 1 }] },
  { id: 'echo',          name: 'Écho',           emoji: '🪞', description: 'META: Toppings appliqués 2×',      rarity: 'rare',      cost: 70,  minRound: 5,  requiresUnlock: null, effects: [{ type: 'topping_repeat', value: 2, metaLevel: 1 }] },
  { id: 'catalyst',      name: 'Catalyseur',     emoji: '⚗️', description: 'META: Bonus 💵 fin de round ×2',  rarity: 'rare',      cost: 60,  minRound: 4,  requiresUnlock: null, effects: [{ type: 'money_multiplier', value: 2, metaLevel: 1 }] },
  { id: 'circus',        name: 'Cirque',         emoji: '🎪', description: 'META: +2% valeur par artefact',    rarity: 'rare',      cost: 90,  minRound: 7,  requiresUnlock: null, effects: [{ type: 'value_per_artifact', value: 2, metaLevel: 1 }] },

  // ══════ LEGENDARY — Level 2 Meta-Meta (120-180💵) ══════
  { id: 'singularity',   name: 'Singularité',    emoji: '🌀', description: 'META²: Effets meta +25%',         rarity: 'legendary', cost: 180, minRound: 10, requiresUnlock: null, effects: [{ type: 'meta_boost', value: 25, metaLevel: 2 }] },
  { id: 'constellation', name: 'Constellation',  emoji: '🌟', description: 'META²: +1% TOUT par artefact',    rarity: 'legendary', cost: 200, minRound: 11, requiresUnlock: null, effects: [{ type: 'everything_per_artifact', value: 1, metaLevel: 2 }] },
  { id: 'crown',         name: 'Couronne',       emoji: '👑', description: 'META²: +50% valeur boîtes',       rarity: 'legendary', cost: 180, minRound: 10, requiresUnlock: null, effects: [{ type: 'box_value_percent', value: 50, metaLevel: 0 }, { type: 'final_multiplier', value: 25, metaLevel: 2 }] },

  // ══════ MYTHIC — Level 3 Meta³ (250+💵) ══════
  { id: 'transcendence', name: 'Transcendance',  emoji: '💎', description: 'META³: +25% sur TOUS les effets', rarity: 'legendary', cost: 280, minRound: 13, requiresUnlock: null, effects: [{ type: 'global_boost', value: 25, metaLevel: 3 }] },
];

/** @type {Map<string, ArtifactDef>} */
export const ARTIFACT_MAP = new Map(ARTIFACTS.map(a => [a.id, a]));

/** @param {string} id @returns {ArtifactDef} */
export function getArtifact(id) {
  const a = ARTIFACT_MAP.get(id);
  if (!a) throw new Error(`Unknown artifact: ${id}`);
  return a;
}

/** Rarity weights for shop generation. */
export const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 12, legendary: 3 };
