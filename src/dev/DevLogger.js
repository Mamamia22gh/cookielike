/**
 * Structured event logger — subscribes to all game events and logs them.
 * Useful for debugging and replay analysis.
 */
export class DevLogger {
  /** @type {Array<{time: number, event: string, data: any}>} */
  log = [];
  #startTime = Date.now();
  #verbose;

  /**
   * @param {object} game — game API from createGame()
   * @param {boolean} [verbose=true] — print to console
   */
  constructor(game, verbose = true) {
    this.#verbose = verbose;

    const events = [
      'phase:changed',
      'run:started',
      'round:started', 'round:ended',
      'tick',
      'box:created', 'box:scored', 'box:burned',
      'oven:loaded', 'oven:progress', 'oven:extracted', 'oven:burned', 'oven:empty',
      'machine:no_paste', 'machine:no_oven', 'machine:empty_pool',
      'machine:recipe_added', 'machine:recipe_removed', 'machine:recipe_duplicated',
      'benne:added', 'benne:full',
      'topping:armed', 'topping:applied', 'topping:no_charges',
      'choice:presented', 'choice:made', 'choice:needs_target',
      'choice:applied_recipe', 'choice:applied_copy', 'choice:applied_remove',
      'choice:applied_oven', 'choice:applied_upgrade', 'choice:applied_topping',
      'shop:opened', 'shop:bought', 'shop:insufficient_funds', 'shop:needs_target',
      'meta:unlocked', 'meta:insufficient_stars',
      'preview',
      'game:over', 'game:won',
      'error',
      'rhythm:streak',
    ];

    for (const event of events) {
      if (event === 'tick' || event === 'oven:progress') continue; // Too noisy
      game.on(event, (data) => this.#onEvent(event, data));
    }
  }

  #onEvent(event, data) {
    const elapsed = Date.now() - this.#startTime;
    const entry = { time: elapsed, event, data };
    this.log.push(entry);

    if (this.#verbose) {
      const ts = `[${(elapsed / 1000).toFixed(2)}s]`;
      const dataStr = data ? ' ' + JSON.stringify(data) : '';
      console.log(`${ts} ${event}${dataStr}`);
    }
  }

  /** Get log entries filtered by event name. */
  filter(event) {
    return this.log.filter(e => e.event === event);
  }

  /** Clear the log. */
  clear() {
    this.log = [];
    this.#startTime = Date.now();
  }

  /** Export log as JSON string. */
  export() {
    return JSON.stringify(this.log, null, 2);
  }
}
