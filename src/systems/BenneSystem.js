/**
 * Manages the benne (cookie bin) — accumulates finished boxes for sale.
 */
export class BenneSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Add a scored box to the benne.
   * @param {object} run
   * @param {object} box
   * @returns {boolean} false if benne is full
   */
  addBox(run, box) {
    if (run.benne.boxes.length >= run.benne.capacity) {
      this.#events.emit('benne:full', { capacity: run.benne.capacity });
      return false;
    }

    run.benne.boxes.push(box);
    this.#events.emit('benne:added', {
      boxId: box.id,
      value: box.value,
      count: run.benne.boxes.length,
      capacity: run.benne.capacity,
    });
    return true;
  }

  /**
   * Get total value of all boxes in the benne.
   * @param {object} run
   * @returns {number}
   */
  getTotalValue(run) {
    return run.benne.boxes.reduce((sum, box) => sum + (box.value || 0), 0);
  }

  /**
   * Get number of boxes in benne.
   * @param {object} run
   * @returns {number}
   */
  getCount(run) {
    return run.benne.boxes.length;
  }

  /**
   * Clear the benne for a new round.
   * @param {object} run
   */
  clear(run) {
    run.benne.boxes = [];
  }
}
