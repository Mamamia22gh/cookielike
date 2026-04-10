import { getQuota } from '../data/balance.js';
import { BALANCE } from '../data/balance.js';

/**
 * Quota management — checks whether round target was met and calculates surplus.
 */
export class QuotaSystem {
  /**
   * Get the quota for a specific round.
   * @param {number} round
   * @returns {number}
   */
  getQuota(round) {
    return getQuota(round);
  }

  /**
   * Check if totalValue meets the quota for a round.
   * @param {number} totalValue
   * @param {number} round
   * @returns {{ passed: boolean, quota: number, surplus: number, shopCoins: number }}
   */
  check(totalValue, round) {
    const quota = getQuota(round);
    const passed = totalValue >= quota;
    const surplus = Math.max(0, totalValue - quota);
    const shopCoins = Math.floor(surplus / BALANCE.SURPLUS_CONVERSION_RATE);

    return { passed, quota, surplus, shopCoins };
  }

  /**
   * Get all quotas for a full run (for preview/display).
   * @returns {number[]} Array of 15 quotas
   */
  getAllQuotas() {
    const quotas = [];
    for (let r = 1; r <= BALANCE.ROUNDS_PER_RUN; r++) {
      quotas.push(getQuota(r));
    }
    return quotas;
  }
}
