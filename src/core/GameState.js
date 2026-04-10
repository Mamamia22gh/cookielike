import { BALANCE } from '../data/balance.js';
import { BALANCE as B } from '../data/balance.js';

/** @typedef {'IDLE'|'PREVIEW'|'PRODUCTION'|'RESULTS'|'CHOICE'|'SHOP'|'GAME_OVER'|'VICTORY'} Phase */

export const PHASE = Object.freeze({
  IDLE: 'IDLE',
  PREVIEW: 'PREVIEW',
  PRODUCTION: 'PRODUCTION',
  RESULTS: 'RESULTS',
  CHOICE: 'CHOICE',
  SHOP: 'SHOP',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY',
});

let _nextId = 0;

/** Generate a unique ID with optional prefix. */
export function uid(prefix = 'id') {
  return `${prefix}_${++_nextId}`;
}

/** Reset ID counter (for testing). */
export function resetUid() {
  _nextId = 0;
}

/**
 * Create a fresh top-level game state.
 * @param {number} seed
 * @returns {object}
 */
export function createGameState(seed) {
  return {
    phase: PHASE.IDLE,
    seed,
    run: null,
    meta: createMetaState(),
  };
}

/**
 * Create meta-progression state.
 * @returns {object}
 */
export function createMetaState() {
  return {
    stars: 0,
    totalStars: 0,
    runsCompleted: 0,
    bestRound: 0,
    unlocks: [],
  };
}

/**
 * Create a fresh run state. Called when a new run starts.
 * @param {object} meta — current meta-progression state
 * @returns {object}
 */
export function createRunState(meta) {
  const pool = BALANCE.INITIAL_RECIPES.map(id => ({
    recipeId: id,
    weight: BALANCE.INITIAL_RECIPE_WEIGHTS[id] ?? 1,
  }));

  const ovens = BALANCE.INITIAL_OVENS.map((typeId, i) => ({
    id: uid('oven'),
    typeId,
    box: null,
    cookieIndex: 0,
    progress: 0,
  }));

  return {
    round: 1,
    score: 0,

    machine: { pool },

    paste: {
      current: BALANCE.INITIAL_PASTE,
      bonusPerm: 0,
      bonusTemp: 0,
    },

    pullCost: BALANCE.PULL_COST,
    boxSize: BALANCE.BOX_SIZE,

    ovens,

    cookingUpgrades: [],

    toppings: [],
    armedTopping: null,

    benne: {
      boxes: [],
      capacity: BALANCE.BENNE_CAPACITY,
    },

    shopCurrency: 0,
    shopHistory: {},
    shopOfferings: [],
    shopDiscount: 0,
    rerollCount: 0,
    artifacts: [],

    timer: {
      remaining: BALANCE.ROUND_DURATION_SEC,
      duration: BALANCE.ROUND_DURATION_SEC,
    },

    rhythmStreak: 0,

    fever: {
      active: false,
      remaining: 0,
    },
    rerollTokens: 0,

    currentChoices: [],
    roundBoxes: [],
    lastRoundResult: null,
  };
}
