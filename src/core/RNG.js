/**
 * Seedable PRNG — mulberry32 algorithm.
 * Deterministic: same seed = same sequence. Enables replay & seed sharing.
 */
export class RNG {
  #state;
  #initialSeed;

  /** @param {number} seed */
  constructor(seed) {
    this.#initialSeed = seed >>> 0;
    this.#state = this.#initialSeed;
  }

  get seed() {
    return this.#initialSeed;
  }

  /** @returns {number} Float in [0, 1) */
  next() {
    let t = (this.#state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Integer in [min, max] (inclusive both ends).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Float in [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  /**
   * Returns true with given probability (0–1).
   * @param {number} p
   * @returns {boolean}
   */
  chance(p) {
    return this.next() < p;
  }

  /**
   * Pick a uniformly random element from an array.
   * @template T
   * @param {T[]} arr
   * @returns {T}
   */
  pick(arr) {
    if (arr.length === 0) throw new RangeError('Cannot pick from empty array');
    return arr[this.nextInt(0, arr.length - 1)];
  }

  /**
   * Pick an element using weighted probabilities.
   * @template T
   * @param {T[]} items
   * @param {number[]} weights — must be same length as items, all >= 0
   * @returns {T}
   */
  pickWeighted(items, weights) {
    if (items.length === 0) throw new RangeError('Cannot pick from empty array');
    if (items.length !== weights.length) throw new RangeError('Items and weights length mismatch');

    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) throw new RangeError('Total weight must be positive');

    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /**
   * Fisher-Yates shuffle (in-place). Returns the same array.
   * @template T
   * @param {T[]} arr
   * @returns {T[]}
   */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Pick n unique elements from array (no repeats).
   * @template T
   * @param {T[]} arr
   * @param {number} n
   * @returns {T[]}
   */
  pickN(arr, n) {
    if (n > arr.length) throw new RangeError(`Cannot pick ${n} from array of ${arr.length}`);
    const copy = [...arr];
    this.shuffle(copy);
    return copy.slice(0, n);
  }

  /**
   * Create a deterministic child RNG (forked from current state).
   * @returns {RNG}
   */
  fork() {
    return new RNG((this.next() * 4294967296) >>> 0);
  }
}
