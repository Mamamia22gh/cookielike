/**
 * Pub/sub event system. Decouples game logic from UI.
 * Supports on/off/once/emit with re-entrant safety.
 */
export class EventBus {
  /** @type {Map<string, Array<{fn: Function, once: boolean}>>} */
  #listeners = new Map();
  #queue = [];
  #dispatching = false;

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} fn
   * @returns {() => void} Unsubscribe function
   */
  on(event, fn) {
    if (typeof fn !== 'function') throw new TypeError('Listener must be a function');
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push({ fn, once: false });
    return () => this.off(event, fn);
  }

  /**
   * Subscribe once — auto-removed after first call.
   * @param {string} event
   * @param {Function} fn
   * @returns {() => void} Unsubscribe function
   */
  once(event, fn) {
    if (typeof fn !== 'function') throw new TypeError('Listener must be a function');
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push({ fn, once: true });
    return () => this.off(event, fn);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} fn
   */
  off(event, fn) {
    const entries = this.#listeners.get(event);
    if (!entries) return;
    const idx = entries.findIndex(e => e.fn === fn);
    if (idx !== -1) entries.splice(idx, 1);
    if (entries.length === 0) this.#listeners.delete(event);
  }

  /**
   * Emit an event with arguments. Re-entrant safe (queues nested emits).
   * @param {string} event
   * @param {...any} args
   */
  emit(event, ...args) {
    if (this.#dispatching) {
      this.#queue.push({ event, args });
      return;
    }

    this.#dispatching = true;
    try {
      this.#dispatch(event, args);
      while (this.#queue.length > 0) {
        const { event: e, args: a } = this.#queue.shift();
        this.#dispatch(e, a);
      }
    } finally {
      this.#dispatching = false;
    }
  }

  /**
   * Remove all listeners, optionally filtered by event.
   * @param {string} [event]
   */
  removeAll(event) {
    if (event) {
      this.#listeners.delete(event);
    } else {
      this.#listeners.clear();
    }
  }

  /** @param {string} event @returns {number} */
  listenerCount(event) {
    return this.#listeners.get(event)?.length ?? 0;
  }

  #dispatch(event, args) {
    const entries = this.#listeners.get(event);
    if (!entries) return;
    const snapshot = [...entries];
    for (const entry of snapshot) {
      entry.fn(...args);
      if (entry.once) this.off(event, entry.fn);
    }
  }
}
