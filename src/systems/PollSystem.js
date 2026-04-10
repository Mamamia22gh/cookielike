import { BALANCE } from '../data/balance.js';

/**
 * Poll system: before each round, the machine proposes POLL_SIZE recipes
 * drawn from the pool. The player can reroll up to POLL_REROLLS_PER_ROUND times.
 * Only the selected recipes are active during production.
 */
export class PollSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Generate a poll: pick POLL_SIZE recipes weighted-randomly from the pool.
   * Allows duplicates proportional to weight.
   */
  generate(run, rng) {
    const pool = run.machine.pool;
    if (pool.length === 0) return [];

    const count = Math.min(BALANCE.POLL_SIZE, pool.reduce((s, e) => s + e.weight, 0));
    const ids = pool.map(e => e.recipeId);
    const weights = pool.map(e => e.weight);
    const totalWeight = weights.reduce((s, w) => s + w, 0);

    const selected = [];
    for (let i = 0; i < count; i++) {
      const roll = rng.next() * totalWeight;
      let cumulative = 0;
      for (let j = 0; j < ids.length; j++) {
        cumulative += weights[j];
        if (roll < cumulative) {
          selected.push(ids[j]);
          break;
        }
      }
    }

    run.poll = {
      recipes: selected,
      rerollsLeft: BALANCE.POLL_REROLLS_PER_ROUND,
    };

    this.#events.emit('poll:generated', {
      recipes: selected,
      rerollsLeft: run.poll.rerollsLeft,
    });

    return selected;
  }

  /**
   * Reroll the poll — re-draw all POLL_SIZE recipes.
   * Returns false if no rerolls left.
   */
  reroll(run, rng) {
    if (!run.poll || run.poll.rerollsLeft <= 0) {
      this.#events.emit('poll:no_rerolls');
      return false;
    }

    const remaining = run.poll.rerollsLeft - 1;
    this.generate(run, rng);
    run.poll.rerollsLeft = remaining;

    this.#events.emit('poll:rerolled', {
      recipes: run.poll.recipes,
      rerollsLeft: run.poll.rerollsLeft,
    });
    return true;
  }

  /**
   * Build a temporary pool from the poll selection for use during production.
   * Counts occurrences → weights.
   */
  getActivePool(run) {
    if (!run.poll) return run.machine.pool;

    const counts = {};
    for (const id of run.poll.recipes) {
      counts[id] = (counts[id] || 0) + 1;
    }
    return Object.entries(counts).map(([recipeId, weight]) => ({ recipeId, weight }));
  }
}
