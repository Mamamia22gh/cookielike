import { getRecipe } from '../data/recipes.js';

/**
 * Evaluates artifact effects with meta-level pipeline.
 *
 * Pipeline:
 *   1. Accumulate level-0 (direct) effects → base modifiers
 *   2. Compute level-1 multiplier (meta: doubles %, per-artifact bonuses)
 *   3. Compute level-2 multiplier (meta²: boosts meta effects)
 *   4. Compute level-3 multiplier (meta³: boosts everything)
 *   5. Apply: finalMod = baseMod × l1Multi × l2Multi × l3Multi
 */
export class EffectSystem {
  /**
   * Compute all modifiers from artifacts.
   * @param {object[]} artifacts — array of artifact definitions
   * @returns {object} computed modifiers
   */
  compute(artifacts) {
    if (!artifacts || artifacts.length === 0) return { ...DEFAULT_MODS };

    // ── Step 1: Accumulate level-0 base values ──
    const base = { ...DEFAULT_MODS };

    for (const art of artifacts) {
      for (const eff of art.effects) {
        if (eff.metaLevel !== 0) continue;
        this.#accumulateBase(base, eff);
      }
    }

    // ── Step 2: Level-1 multipliers (meta) ──
    let percentMulti = 1;
    let flatMulti = 1;
    let moneyMulti = 1;
    let toppingRepeat = 1;

    for (const art of artifacts) {
      for (const eff of art.effects) {
        if (eff.metaLevel !== 1) continue;
        switch (eff.type) {
          case 'percent_multiplier': percentMulti *= eff.value; break;
          case 'money_multiplier':   moneyMulti *= eff.value; break;
          case 'topping_repeat':     toppingRepeat = Math.max(toppingRepeat, eff.value); break;
          case 'value_per_artifact': base.boxValuePercent += eff.value * artifacts.length; break;
        }
      }
    }

    // ── Step 3: Level-2 multipliers (meta²) ──
    let metaBoost = 1;

    for (const art of artifacts) {
      for (const eff of art.effects) {
        if (eff.metaLevel !== 2) continue;
        switch (eff.type) {
          case 'meta_boost':
            metaBoost *= (1 + eff.value / 100);
            break;
          case 'everything_per_artifact':
            metaBoost *= (1 + (eff.value * artifacts.length) / 100);
            break;
          case 'final_multiplier':
            percentMulti *= (1 + eff.value / 100);
            break;
        }
      }
    }

    // Apply meta boost to level-1 multipliers
    percentMulti = 1 + (percentMulti - 1) * metaBoost;
    flatMulti = 1 + (flatMulti - 1) * metaBoost;
    moneyMulti = 1 + (moneyMulti - 1) * metaBoost;

    // ── Step 4: Level-3 multipliers (meta³) ──
    let globalBoost = 1;

    for (const art of artifacts) {
      for (const eff of art.effects) {
        if (eff.metaLevel !== 3) continue;
        if (eff.type === 'global_boost') {
          globalBoost *= (1 + eff.value / 100);
        }
      }
    }

    percentMulti *= globalBoost;
    flatMulti *= globalBoost;
    moneyMulti *= globalBoost;

    // ── Step 5: Apply multipliers to base ──
    return {
      boxValuePercent:      base.boxValuePercent * percentMulti,
      boxValueFlat:         base.boxValueFlat * flatMulti,
      comboMultiPercent:    base.comboMultiPercent * percentMulti,
      perCookieFlat:        base.perCookieFlat * flatMulti,
      recipeBonus:          base.recipeBonus, // per-recipe bonuses (already percent, will be multiplied in scoring)
      cookingSpeedPercent:  base.cookingSpeedPercent * percentMulti,
      perfectZoneBonus:     base.perfectZoneBonus * percentMulti,
      rawMulti:             base.rawMulti,
      burnedMulti:          base.burnedMulti,
      pasteBonus:           Math.floor(base.pasteBonus * flatMulti),
      moneyBonus:           Math.floor(base.moneyBonus * moneyMulti),
      benneBonus:           base.benneBonus,
      shopDiscount:         Math.min(80, base.shopDiscount), // cap at 80%
      pastePermanent:       base.pastePermanent,
      toppingRepeat,
    };
  }

  #accumulateBase(base, eff) {
    switch (eff.type) {
      case 'box_value_percent':     base.boxValuePercent += eff.value; break;
      case 'box_value_flat':        base.boxValueFlat += eff.value; break;
      case 'combo_multi_percent':   base.comboMultiPercent += eff.value; break;
      case 'per_cookie_flat':       base.perCookieFlat += eff.value; break;
      case 'cooking_speed_percent': base.cookingSpeedPercent += eff.value; break;
      case 'perfect_zone_bonus':    base.perfectZoneBonus += eff.value; break;
      case 'burned_override':       base.burnedMulti = Math.max(base.burnedMulti ?? 0, eff.value); break;
      case 'raw_override':          base.rawMulti = Math.max(base.rawMulti ?? 0, eff.value); break;
      case 'paste_round_start':     base.pasteBonus += eff.value; break;
      case 'paste_permanent':       base.pastePermanent += eff.value; break;
      case 'money_round_end':       base.moneyBonus += eff.value; break;
      case 'benne_capacity':        base.benneBonus += eff.value; break;
      case 'shop_discount':         base.shopDiscount += eff.value; break;
      case 'recipe_value_percent':
        if (eff.condition?.recipeId) {
          base.recipeBonus[eff.condition.recipeId] = (base.recipeBonus[eff.condition.recipeId] || 0) + eff.value;
        }
        break;
    }
  }
}

const DEFAULT_MODS = Object.freeze({
  boxValuePercent: 0,
  boxValueFlat: 0,
  comboMultiPercent: 0,
  perCookieFlat: 0,
  recipeBonus: {},
  cookingSpeedPercent: 0,
  perfectZoneBonus: 0,
  rawMulti: null,
  burnedMulti: null,
  pasteBonus: 0,
  pastePermanent: 0,
  moneyBonus: 0,
  benneBonus: 0,
  shopDiscount: 0,
  toppingRepeat: 1,
});
