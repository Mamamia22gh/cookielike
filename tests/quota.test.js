import { describe, it, expect } from 'vitest';
import { QuotaSystem } from '../src/systems/QuotaSystem.js';
import { getQuota, getPasteForRound, BALANCE } from '../src/data/balance.js';

describe('QuotaSystem', () => {
  const quota = new QuotaSystem();

  describe('getQuota', () => {
    it('returns 150 for round 1', () => {
      expect(getQuota(1)).toBe(150);
    });

    it('increases each round', () => {
      let prev = getQuota(1);
      for (let r = 2; r <= 15; r++) {
        const q = getQuota(r);
        expect(q).toBeGreaterThan(prev);
        prev = q;
      }
    });

    it('round 15 is achievable but hard', () => {
      const q15 = getQuota(15);
      expect(q15).toBeGreaterThan(3000);
      expect(q15).toBeLessThan(500000);
    });
  });

  describe('check', () => {
    it('passes when value >= quota', () => {
      const result = quota.check(200, 1);
      expect(result.passed).toBe(true);
      expect(result.surplus).toBe(50);
      expect(result.shopCoins).toBe(1); // floor(50/50)
    });

    it('fails when value < quota', () => {
      const result = quota.check(100, 1);
      expect(result.passed).toBe(false);
      expect(result.surplus).toBe(0);
      expect(result.shopCoins).toBe(0);
    });

    it('passes exactly at quota', () => {
      const result = quota.check(150, 1);
      expect(result.passed).toBe(true);
      expect(result.surplus).toBe(0);
    });
  });

  describe('getAllQuotas', () => {
    it('returns 15 quotas', () => {
      const all = quota.getAllQuotas();
      expect(all.length).toBe(15);
      expect(all[0]).toBe(150);
    });
  });
});

describe('getPasteForRound', () => {
  it('returns initial paste for round 1', () => {
    expect(getPasteForRound(1)).toBe(BALANCE.INITIAL_PASTE);
  });

  it('increases each round', () => {
    const r1 = getPasteForRound(1);
    const r5 = getPasteForRound(5);
    expect(r5).toBe(r1 + 4 * BALANCE.PASTE_GROWTH_PER_ROUND);
  });

  it('adds permanent bonus', () => {
    const base = getPasteForRound(1);
    expect(getPasteForRound(1, 5)).toBe(base + 5);
  });

  it('adds temp bonus', () => {
    const base = getPasteForRound(1);
    expect(getPasteForRound(1, 0, 3)).toBe(base + 3);
  });
});
