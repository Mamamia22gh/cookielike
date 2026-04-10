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
      expect(run.ovens[0].cookieStates).not.toBeNull();
      expect(run.ovens[0].cookieStates.length).toBe(BALANCE.BOX_WIDTH * BALANCE.BOX_SIZE);
    });

    it('rejects if oven occupied', () => {
      oven.loadBox(run, 0, makeBox());
      expect(oven.loadBox(run, 0, makeBox())).toBe(false);
    });

    it('initialises per-cookie states with varied speeds', () => {
      const rng = new RNG(42);
      oven.loadBox(run, 0, makeBox(), rng);
      const states = run.ovens[0].cookieStates;
      const speeds = states.map(s => s.speed);
      // Speeds should be varied
      expect(new Set(speeds).size).toBeGreaterThan(1);
      speeds.forEach(s => {
        expect(s).toBeGreaterThanOrEqual(0.7);
        expect(s).toBeLessThanOrEqual(1.3);
      });
    });
  });

  describe('update', () => {
    it('advances progress on all cookies', () => {
      const rng = new RNG(42);
      oven.loadBox(run, 0, makeBox(), rng);
      oven.update(run, 0.5);
      const states = run.ovens[0].cookieStates;
      for (const cs of states) {
        expect(cs.progress).toBeGreaterThan(0);
      }
    });

    it('auto-burns cookie at 100% and may complete box', () => {
      const rng = new RNG(42);
      oven.loadBox(run, 0, makeBox(), rng);
      const evts = oven.update(run, 100); // way past burn
      const burns = evts.filter(e => e.type === 'burn');
      expect(burns.length).toBeGreaterThan(0);
      const completes = evts.filter(e => e.type === 'complete');
      expect(completes.length).toBe(1);
      expect(run.ovens[0].box).toBeNull();
    });
  });

  describe('extractCookie', () => {
    it('returns null for empty oven', () => {
      expect(oven.extractCookie(run, 0, 0, 0, [])).toBeNull();
    });

    it('extracts one cookie and marks it done', () => {
      const rng = new RNG(42);
      oven.loadBox(run, 0, makeBox(), rng);
      run.ovens[0].cookieStates[0].progress = 0.75; // perfect zone
      const result = oven.extractCookie(run, 0, 0, 0, []);
      expect(result).not.toBeNull();
      expect(result.complete).toBe(false);
      expect(result.cookingResult.zone).toBe('PERFECT');
      expect(run.ovens[0].cookieStates[0].done).toBe(true);
    });

    it('completes box after all cookies extracted', () => {
      const rng = new RNG(42);
      oven.loadBox(run, 0, makeBox(), rng);
      const total = BALANCE.BOX_WIDTH * BALANCE.BOX_SIZE;
      const rows = BALANCE.BOX_SIZE;
      let lastResult = null;
      for (let ci = 0; ci < total; ci++) {
        const col = Math.floor(ci / rows);
        const row = ci % rows;
        run.ovens[0].cookieStates[ci].progress = 0.75;
        lastResult = oven.extractCookie(run, 0, col, row, []);
      }
      expect(lastResult.complete).toBe(true);
      expect(run.ovens[0].box).toBeNull();
    });

    it('sets cooking result on the correct grid cell', () => {
      const rng = new RNG(42);
      const box = makeBox();
      oven.loadBox(run, 0, box, rng);
      run.ovens[0].cookieStates[0].progress = 0.75;
      oven.extractCookie(run, 0, 0, 0, []);
      expect(box.grid[0][0].cookingZone).toBe('PERFECT');
      expect(box.grid[0][0].cookingMulti).toBe(1.25);
    });

    it('detects zones correctly', () => {
      const rng = new RNG(42);
      const box = makeBox();
      oven.loadBox(run, 0, box, rng);

      // RAW
      run.ovens[0].cookieStates[0].progress = 0.15;
      oven.extractCookie(run, 0, 0, 0, []);
      expect(box.grid[0][0].cookingZone).toBe('RAW');

      // COOKED
      run.ovens[0].cookieStates[1].progress = 0.50;
      oven.extractCookie(run, 0, 0, 1, []);
      expect(box.grid[0][1].cookingZone).toBe('COOKED');

      // PERFECT
      run.ovens[0].cookieStates[2].progress = 0.75;
      oven.extractCookie(run, 0, 0, 2, []);
      expect(box.grid[0][2].cookingZone).toBe('PERFECT');

      // BURNED
      run.ovens[0].cookieStates[3].progress = 0.95;
      oven.extractCookie(run, 0, 0, 3, []);
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
      const rng = new RNG(42);
      oven.loadBox(run, 0, makeBox(), rng);
      oven.clearAll(run);
      expect(run.ovens[0].box).toBeNull();
      expect(run.ovens[0].cookieStates).toBeNull();
    });
  });
});
