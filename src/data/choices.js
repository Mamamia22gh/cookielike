/**
 * Pool of all possible between-round choices.
 * Tiered by minRound — stronger options appear later in the run.
 *
 * @typedef {object} ChoiceDefinition
 * @property {string} id
 * @property {'recipe'|'recipe_copy'|'recipe_remove'|'topping'|'oven'|'upgrade'} type
 * @property {string} name — display name with emoji
 * @property {string} description
 * @property {'SKILLED'|'STRAT'|'GAMBLER'|'NEUTRAL'} archetype
 * @property {number} weight — spawn weight (higher = more common)
 * @property {number} minRound — earliest round this can appear (tier system)
 * @property {string|null} requiresUnlock — meta unlock ID, null = always available
 * @property {boolean} needsTarget — true if player must choose a target recipe
 * @property {object} payload — type-specific data
 */

/** @type {ChoiceDefinition[]} */
export const CHOICES = [
  // ── Tier 1: New recipes (common) ──
  { id: 'add_strawberry',  type: 'recipe', name: '🍓 Fraise',       description: 'Ajoute Fraise au pool (val: 10)',         archetype: 'NEUTRAL',  weight: 10, minRound: 1, requiresUnlock: null,               needsTarget: false, payload: { recipeId: 'strawberry' } },
  { id: 'add_lemon',       type: 'recipe', name: '🍋 Citron',       description: 'Ajoute Citron au pool (val: 7)',          archetype: 'NEUTRAL',  weight: 10, minRound: 1, requiresUnlock: null,               needsTarget: false, payload: { recipeId: 'lemon' } },
  { id: 'add_peanut',      type: 'recipe', name: '🥜 Cacahuète',    description: 'Ajoute Cacahuète au pool (val: 9)',       archetype: 'NEUTRAL',  weight: 10, minRound: 1, requiresUnlock: null,               needsTarget: false, payload: { recipeId: 'peanut' } },

  // ── Tier 2: New recipes (uncommon) ──
  { id: 'add_caramel',     type: 'recipe', name: '🍯 Caramel',      description: 'Ajoute Caramel au pool (val: 14)',        archetype: 'STRAT',    weight: 6,  minRound: 3, requiresUnlock: 'unlock_caramel',   needsTarget: false, payload: { recipeId: 'caramel' } },
  { id: 'add_matcha',      type: 'recipe', name: '🍵 Matcha',       description: 'Ajoute Matcha au pool (val: 16)',         archetype: 'STRAT',    weight: 6,  minRound: 4, requiresUnlock: 'unlock_matcha',    needsTarget: false, payload: { recipeId: 'matcha' } },
  { id: 'add_coconut',     type: 'recipe', name: '🥥 Noix de coco', description: 'Ajoute Coco au pool (val: 13)',           archetype: 'STRAT',    weight: 6,  minRound: 3, requiresUnlock: 'unlock_coconut',   needsTarget: false, payload: { recipeId: 'coconut' } },

  // ── Tier 3: New recipes (rare) ──
  { id: 'add_macaron',     type: 'recipe', name: '🧁 Macaron',      description: 'Ajoute Macaron au pool (val: 22)',        archetype: 'STRAT',    weight: 3,  minRound: 6, requiresUnlock: 'unlock_macaron',   needsTarget: false, payload: { recipeId: 'macaron' } },
  { id: 'add_truffle',     type: 'recipe', name: '🍬 Truffe',       description: 'Ajoute Truffe au pool (val: 28)',         archetype: 'STRAT',    weight: 2,  minRound: 8, requiresUnlock: 'unlock_truffle',   needsTarget: false, payload: { recipeId: 'truffle' } },
  { id: 'add_joker',       type: 'recipe', name: '🃏 Joker',        description: 'Wildcard — compte comme n\'importe quel type', archetype: 'GAMBLER', weight: 2, minRound: 5, requiresUnlock: 'unlock_joker', needsTarget: false, payload: { recipeId: 'joker' } },

  // ── Recipe manipulation ──
  { id: 'copy_recipe',     type: 'recipe_copy',   name: '📋 Dupliquer',  description: '+1 copie d\'une recette (max 4)',          archetype: 'STRAT',   weight: 12, minRound: 1, requiresUnlock: null, needsTarget: true, payload: {} },
  { id: 'remove_recipe',   type: 'recipe_remove', name: '🗑 Retirer',    description: 'Retire 1 copie d\'une recette du pool',   archetype: 'STRAT',   weight: 8,  minRound: 2, requiresUnlock: null, needsTarget: true, payload: {} },

  // ── Ovens (tier 2-3) ──
  { id: 'add_oven_turbo',  type: 'oven', name: '⚡ Four Turbo',   description: '2x vitesse, zone parfaite réduite',            archetype: 'SKILLED',  weight: 5, minRound: 3, requiresUnlock: null,                needsTarget: false, payload: { ovenType: 'turbo' } },
  { id: 'add_oven_magic',  type: 'oven', name: '✨ Four Magique',  description: '15% chance cookie doré',                       archetype: 'GAMBLER',  weight: 4, minRound: 5, requiresUnlock: 'unlock_magic_oven', needsTarget: false, payload: { ovenType: 'magic' } },
  { id: 'add_oven_cryo',   type: 'oven', name: '🧊 Four Cryo',    description: 'Lent, zone large, +50% bonus',                 archetype: 'NEUTRAL',  weight: 4, minRound: 4, requiresUnlock: 'unlock_cryo_oven',  needsTarget: false, payload: { ovenType: 'cryo' } },
  { id: 'add_oven_chaos',  type: 'oven', name: '🌀 Four Chaos',   description: 'Réarrange les cookies à la cuisson',           archetype: 'GAMBLER',  weight: 3, minRound: 6, requiresUnlock: 'unlock_chaos_oven', needsTarget: false, payload: { ovenType: 'chaos' } },

  // ── Cooking upgrades — Skilled (tier 2-3) ──
  { id: 'upgrade_precision',   type: 'upgrade', name: '🎯 Précision',    description: 'Zone parfaite -30%, bonus → +60%',     archetype: 'SKILLED', weight: 6, minRound: 3, requiresUnlock: null, needsTarget: false, payload: { upgradeId: 'precision' } },
  { id: 'upgrade_sweet_spot',  type: 'upgrade', name: '💎 Sweet Spot',   description: 'Micro-zone +100% juste avant brûlé',   archetype: 'SKILLED', weight: 4, minRound: 5, requiresUnlock: null, needsTarget: false, payload: { upgradeId: 'sweet_spot' } },
  { id: 'upgrade_rhythm',      type: 'upgrade', name: '🥁 Rythme',       description: 'Parfaits consécutifs: +25% cumulatif', archetype: 'SKILLED', weight: 5, minRound: 4, requiresUnlock: null, needsTarget: false, payload: { upgradeId: 'rhythm' } },
  { id: 'upgrade_speed_demon', type: 'upgrade', name: '💨 Speed Demon',  description: 'Cuisson 2x plus rapide',               archetype: 'SKILLED', weight: 4, minRound: 6, requiresUnlock: null, needsTarget: false, payload: { upgradeId: 'speed_demon' } },

  // ── General upgrades (tier 1-3) ──
  { id: 'upgrade_paste_perm',  type: 'upgrade', name: '🧈 Pâte+',        description: '+3 pâte permanente par round',     archetype: 'NEUTRAL', weight: 12, minRound: 1, requiresUnlock: 'unlock_paste_plus',  needsTarget: false, payload: { upgradeId: 'paste_perm', effect: { pasteBonus: 3 } } },
  { id: 'upgrade_pull_cost',   type: 'upgrade', name: '⚙️ Levier+',     description: '-1 coût pâte par pull',             archetype: 'NEUTRAL', weight: 9, minRound: 2, requiresUnlock: 'unlock_lever_plus',  needsTarget: false, payload: { upgradeId: 'pull_cost', effect: { pullCostReduction: 1 } } },
  { id: 'upgrade_benne',       type: 'upgrade', name: '🚛 Benne+',       description: '+5 capacité benne',                archetype: 'NEUTRAL', weight: 8, minRound: 3, requiresUnlock: 'unlock_benne_plus',  needsTarget: false, payload: { upgradeId: 'benne_capacity', effect: { benneBonus: 5 } } },
  { id: 'upgrade_box_xl',      type: 'upgrade', name: '📦 Boîte XL',     description: '6 cookies par boîte au lieu de 5', archetype: 'STRAT',   weight: 2, minRound: 7, requiresUnlock: 'unlock_box_xl',  needsTarget: false, payload: { upgradeId: 'box_xl', effect: { boxSizeBonus: 1 } } },

  // ── Toppings (tier 1-3) ──
  { id: 'topping_glaze',        type: 'topping', name: '🍯 Glaçage x2',       description: '2 charges (+15% valeur)',       archetype: 'NEUTRAL',  weight: 8, minRound: 1, requiresUnlock: null,                    needsTarget: false, payload: { toppingId: 'glaze', charges: 2 } },
  { id: 'topping_sprinkles',    type: 'topping', name: '🌈 Pépites x2',       description: '2 charges (+30🪙 fixe)',        archetype: 'NEUTRAL',  weight: 8, minRound: 1, requiresUnlock: null,                    needsTarget: false, payload: { toppingId: 'sprinkles', charges: 2 } },
  { id: 'topping_choco_drizzle',type: 'topping', name: '🍫 Filet Choco x1',   description: '1 charge (+25% multi combo)',   archetype: 'STRAT',    weight: 5, minRound: 4, requiresUnlock: 'unlock_choco_drizzle',  needsTarget: false, payload: { toppingId: 'chocolate_drizzle', charges: 1 } },
  { id: 'topping_gold_leaf',    type: 'topping', name: '✨ Feuille d\'Or x1', description: '1 charge (+40% valeur)',        archetype: 'STRAT',    weight: 3, minRound: 6, requiresUnlock: 'unlock_gold_leaf',      needsTarget: false, payload: { toppingId: 'gold_leaf', charges: 1 } },
  { id: 'topping_lucky',        type: 'topping', name: '🍀 Porte-Bonheur x1', description: '1 charge (relance le pire cookie)', archetype: 'GAMBLER', weight: 4, minRound: 5, requiresUnlock: 'unlock_lucky_charm', needsTarget: false, payload: { toppingId: 'lucky_charm', charges: 1 } },
];

/** @type {Map<string, ChoiceDefinition>} */
export const CHOICE_MAP = new Map(CHOICES.map(c => [c.id, c]));
