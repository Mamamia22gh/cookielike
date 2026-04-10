import { describe, it, expect, beforeEach } from 'vitest';
import { OvenSystem } from '../src/systems/OvenSystem.js';
import { EventBus } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { createRunState, createMetaState } from '../src/core/GameState.js';
import { BALANCE } from '../src/data/balance.js';

describe('OvenSystem', () => {
  let events, oven, run;

  beforeEach(() => {
    events = new EventBus();
    oven = new OvenSystem(events);
    run = createRunState(createMetaState());
  });

  const makeBox = () => ({
    id: 'test_box',
    grid: Array.from({ length: BALANCE.BOX_WIDTH }, () =>
      Array.from({ length: BALANCE.BOX_SIZE }, () => ({
        recipeId: 'choco', cookingZone: null, cookingMulti: 1,
      }))
    ),
    columnResults: new Array(BALANCE.BOX_WIDTH).fill(null),
    cookies: [], comboResult: null, cookingResult: null, toppingResult: null, value: 0,
  });

  describe('loadBox', () => {
    it('loads box into oven with cookieIndex 0', () => {
      const box = makeBox();
      const result = oven.loadBox(run, 0, box);
      expect(result).toBe(true);
      expect(run.ovens[0].box).toBe(box);
      expect(run.ovens[0].cookieIndex).toBe(0);
      expect(run.ovens[0].progress).toBe(0);
    });

    it('rejects if oven occupied', () => {
      oven.loadBox(run, 0, makeBox());
      expect(oven.loadBox(run, 0, makeBox())).toBe(false);
    });
  });

  describe('update', () => {
    it('advances progress on current cookie', () => {
      oven.loadBox(run, 0, makeBox());
      oven.update(run, 0.5);
      expect(run.ovens[0].progress).toBeGreaterThan(0);
      expect(run.ovens[0].cookieIndex).toBe(0); // not yet burned
    });

    it('auto-burns cookie at 100% and advances index', () => {
      oven.loadBox(run, 0, makeBox());
      const evts = oven.update(run, 100); // way past burn
      const burns = evts.filter(e => e.type === 'burn');
      expect(burns.length).toBeGreaterThan(0);
      // After enough time, all cookies burn and box completes
      const completes = evts.filter(e => e.type === 'complete');
      expect(completes.length).toBe(1);
      expect(run.ovens[0].box).toBeNull();
    });
  });

  describe('extractCookie', () => {
    it('returns null for empty oven', () => {
      expect(oven.extractCookie(run, 0, [])).toBeNull();
    });

    it('extracts one cookie and advances index', () => {
      oven.loadBox(run, 0, makeBox());
      run.ovens[0].progress = 0.75; // perfect zone
      const result = oven.extractCookie(run, 0, []);
      expect(result).not.toBeNull();
      expect(result.complete).toBe(false);
      expect(result.cookingResult.zone).toBe('PERFECT');
      expect(run.ovens[0].cookieIndex).toBe(1);
      expect(run.ovens[0].progress).toBe(0); // reset for next cookie
    });

    it('completes box after all cookies extracted', () => {
      oven.loadBox(run, 0, makeBox());
      const total = BALANCE.BOX_WIDTH * BALANCE.BOX_SIZE;
      let lastResult = null;
      for (let i = 0; i < total; i++) {
        run.ovens[0].progress = 0.75;
        lastResult = oven.extractCookie(run, 0, []);
      }
      expect(lastResult.complete).toBe(true);
      expect(run.ovens[0].box).toBeNull();
    });

    it('sets cooking result on the correct grid cell', () => {
      const box = makeBox();
      oven.loadBox(run, 0, box);
      run.ovens[0].progress = 0.75;
      oven.extractCookie(run, 0, []);
      // Cookie 0 = col 0, row 0
      expect(box.grid[0][0].cookingZone).toBe('PERFECT');
      expect(box.grid[0][0].cookingMulti).toBe(1.25);
    });

    it('detects zones correctly', () => {
      const box = makeBox();
      oven.loadBox(run, 0, box);

      // RAW
      run.ovens[0].progress = 0.15;
      oven.extractCookie(run, 0, []);
      expect(box.grid[0][0].cookingZone).toBe('RAW');

      // COOKED
      run.ovens[0].progress = 0.50;
      oven.extractCookie(run, 0, []);
      expect(box.grid[0][1].cookingZone).toBe('COOKED');

      // PERFECT
      run.ovens[0].progress = 0.75;
      oven.extractCookie(run, 0, []);
      expect(box.grid[0][2].cookingZone).toBe('PERFECT');

      // BURNED
      run.ovens[0].progress = 0.95;
      oven.extractCookie(run, 0, []);
      expect(box.grid[0][3].cookingZone).toBe('BURNED');
    });
  });

  describe('getZones', () => {
    it('returns base zones for classic oven', () => {
      const zones = oven.getZones('classic', []);
      expect(zones.length).toBe(4);
      expect(zones.map(z => z.zone)).toEqual(['RAW', 'COOKED', 'PERFECT', 'BURNED']);
    });

    it('sweet_spot upgrade adds a zone', () => {
      const zones = oven.getZones('classic', ['sweet_spot']);
      expect(zones.length).toBe(5);
      expect(zones.map(z => z.zone)).toContain('SWEET_SPOT');
    });
  });

  describe('clearAll', () => {
    it('clears all oven contents', () => {
      oven.loadBox(run, 0, makeBox());
      oven.clearAll(run);
      expect(run.ovens[0].box).toBeNull();
      expect(run.ovens[0].cookieIndex).toBe(0);
    });
  });
});
