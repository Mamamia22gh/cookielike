import { GameLoop } from './core/GameLoop.js';
import { SaveSystem } from './core/SaveSystem.js';

/**
 * Create a new game instance.
 *
 * @param {object} [options]
 * @param {number} [options.seed] — RNG seed (defaults to Date.now())
 * @param {object} [options.meta] — restored meta-progression state
 * @returns {object} Game API
 */
export function createGame(options = {}) {
  const loop = new GameLoop(options);

  return {
    // ─── Lifecycle ───
    startRun:           ()                          => loop.startRun(),
    startRound:         ()                          => loop.startRound(),
    pollReroll:         ()                          => loop.pollReroll(),
    pollConfirm:        ()                          => loop.pollConfirm(),
    update:             (dtMs)                      => loop.update(dtMs),

    // ─── Production actions ───
    pullLever:          ()                          => loop.pullLever(),
    extractCookie:      (ovenIdx, col, row)         => loop.extractCookie(ovenIdx, col, row),
    extractFromOven:    (ovenIndex)                 => loop.extractFromOven(ovenIndex),
    armTopping:         (toppingId)                 => loop.armTopping(toppingId),
    endRoundEarly:      ()                          => loop.endRoundEarly(),

    // ─── Between-round actions ───
    continueFromResults:()                          => loop.continueFromResults(),
    makeChoice:         (index, target)             => loop.makeChoice(index, target),
    shopBuyArtifact:    (index)                     => loop.shopBuyArtifact(index),
    shopBuy:            (actionId, target)           => loop.shopBuy(actionId, target),
    shopReroll:         ()                          => loop.shopReroll(),
    endShop:            ()                          => loop.endShop(),

    // ─── Events ───
    on:                 (event, fn)                 => loop.events.on(event, fn),
    off:                (event, fn)                 => loop.events.off(event, fn),
    once:               (event, fn)                 => loop.events.once(event, fn),

    // ─── State (read-only) ───
    getState:           ()                          => loop.state,
    getPhase:           ()                          => loop.state.phase,

    // ─── Meta ───
    getMeta:            ()                          => loop.state.meta,
    metaUnlock:         (unlockId)                  => loop.meta.unlock(loop.state.meta, unlockId),
    getUnlocks:         ()                          => loop.meta.getAvailableUnlocks(loop.state.meta),

    // ─── Save/Load ───
    saveMeta:           ()                          => SaveSystem.serialize(loop.state.meta),
    loadMeta:           (json)                      => {
      const meta = SaveSystem.deserialize(json);
      if (meta) loop.state.meta = meta;
      return !!meta;
    },
    exportDebug:        ()                          => SaveSystem.exportFull(loop.state),
  };
}

// Re-export key types/data for external consumers
export { PHASE } from './core/GameState.js';
export { BALANCE, getQuota, getPasteForRound } from './data/balance.js';
export { RECIPES, getRecipe } from './data/recipes.js';
export { COMBOS } from './data/combos.js';
export { OVEN_TYPES } from './data/ovens.js';
export { TOPPINGS } from './data/toppings.js';
export { META_UNLOCKS } from './systems/MetaSystem.js';
