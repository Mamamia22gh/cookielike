import { getOvenType } from '../data/ovens.js';
import { BALANCE } from '../data/balance.js';

/**
 * Parallel-cooking oven system.
 * All cookies in a box cook simultaneously at different speeds.
 * Player must manually start cooking via the oven screen,
 * then aims at individual cookies and extracts them when timing is right.
 *
 * After all cookies are done, the box stays in the oven (completed=true).
 * Player must collectBox() to take it out.
 */
export class OvenSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  firstFreeIndex(run) {
    return run.ovens.findIndex(o => o.box === null);
  }

  loadBox(run, ovenIndex, box, rng) {
    const oven = run.ovens[ovenIndex];
    if (!oven) { this.#events.emit('oven:invalid_index', { ovenIndex }); return false; }
    if (oven.box !== null) { this.#events.emit('oven:occupied', { ovenIndex }); return false; }

    oven.box = box;
    oven.cooking = false;
    oven.completed = false;

    const cols = box.grid.length;
    const rows = box.grid[0]?.length ?? BALANCE.BOX_SIZE;
    const total = cols * rows;

    oven.cookieStates = [];
    for (let i = 0; i < total; i++) {
      const speed = 0.5 + (rng ? rng.next() : Math.random()) * 1.0;
      oven.cookieStates.push({ progress: 0, speed, done: false });
    }

    this.#events.emit('oven:loaded', { ovenIndex, ovenType: oven.typeId, box, totalCookies: total });
    return true;
  }

  startCooking(run, ovenIndex) {
    const oven = run.ovens[ovenIndex];
    if (!oven?.box || !oven.cookieStates) return false;
    if (oven.cooking) return false;

    oven.cooking = true;
    this.#events.emit('oven:cooking_started', { ovenIndex, ovenType: oven.typeId });
    return true;
  }

  update(run, dtSec, speedBonus = 1) {
    const events = [];

    for (let i = 0; i < run.ovens.length; i++) {
      const oven = run.ovens[i];
      if (!oven.box || !oven.cookieStates || !oven.cooking || oven.completed) continue;

      const ovenType = getOvenType(oven.typeId);
      let baseSpeed = ovenType.speedMultiplier * speedBonus;
      if (run.cookingUpgrades.includes('speed_demon')) baseSpeed *= 2;
      const progressPerSec = baseSpeed / BALANCE.COOKING_BASE_DURATION_SEC;

      const rows = oven.box.grid[0]?.length ?? BALANCE.BOX_SIZE;

      for (let ci = 0; ci < oven.cookieStates.length; ci++) {
        const cs = oven.cookieStates[ci];
        if (cs.done) continue;

        cs.progress += progressPerSec * cs.speed * dtSec;

        if (cs.progress >= 1.0) {
          cs.progress = 1.0;
          cs.done = true;

          const col = Math.floor(ci / rows);
          const row = ci % rows;
          if (oven.box.grid[col]?.[row]) {
            oven.box.grid[col][row].cookingZone = 'BURNED';
            oven.box.grid[col][row].cookingMulti = 0;
          }

          events.push({ type: 'burn', ovenIndex: i, cookieIndex: ci, col, row });
        }
      }

      this.#events.emit('oven:progress', {
        ovenIndex: i,
        cookieStates: oven.cookieStates,
        totalCookies: oven.cookieStates.length,
      });

      // Check if all done → mark completed (box stays in oven)
      const allDone = oven.cookieStates.every(cs => cs.done);
      if (allDone) {
        oven.completed = true;
        oven.cooking = false;
        events.push({ type: 'complete', ovenIndex: i, box: oven.box });
      }
    }

    return events;
  }

  extractCookie(run, ovenIndex, col, row, cookingUpgrades, effectMods = {}) {
    const oven = run.ovens[ovenIndex];
    if (!oven?.box || !oven.cookieStates) return null;
    if (!oven.cooking) return null;
    if (oven.completed) return null;

    const rows = oven.box.grid[0]?.length ?? BALANCE.BOX_SIZE;
    const ci = col * rows + row;
    if (ci < 0 || ci >= oven.cookieStates.length) return null;

    const cs = oven.cookieStates[ci];
    if (cs.done) return null;

    const progress = Math.min(1, cs.progress);
    const zones = this.getZones(oven.typeId, cookingUpgrades, effectMods);
    const cookingResult = this.#evaluateTiming(progress, zones);

    const ovenType = getOvenType(oven.typeId);
    cookingResult.ovenEffect = null;
    if (ovenType.specialEffect === 'golden_chance' && cookingResult.zone !== 'BURNED') {
      cookingResult.ovenEffect = 'golden_chance';
    }
    if (ovenType.specialEffect === 'reshuffle' && cookingResult.zone !== 'BURNED') {
      cookingResult.ovenEffect = 'reshuffle';
    }

    cs.done = true;

    if (oven.box.grid[col]?.[row]) {
      oven.box.grid[col][row].cookingZone = cookingResult.zone;
      oven.box.grid[col][row].cookingMulti = cookingResult.multiplier;
    }

    const allDone = oven.cookieStates.every(s => s.done);

    this.#events.emit('oven:extracted', {
      ovenIndex, col, row, cookieIndex: ci,
      progress, cookingResult, complete: allDone,
    });

    if (allDone) {
      oven.completed = true;
      oven.cooking = false;
      return { box: oven.box, complete: true, cookingResult };
    }

    return { box: oven.box, complete: false, cookingResult };
  }

  /**
   * Collect the completed box from the oven. Clears the oven.
   * @returns {object|null} the box
   */
  collectBox(run, ovenIndex) {
    const oven = run.ovens[ovenIndex];
    if (!oven?.box || !oven.completed) return null;

    const box = oven.box;
    oven.box = null;
    oven.cookieStates = null;
    oven.completed = false;
    oven.cooking = false;

    this.#events.emit('oven:collected', { ovenIndex, box });
    return box;
  }

  clearAll(run) {
    for (const oven of run.ovens) {
      oven.box = null;
      oven.cookieStates = null;
      oven.cooking = false;
      oven.completed = false;
    }
  }

  getZones(ovenTypeId, upgrades = [], effectMods = {}) {
    const ovenType = getOvenType(ovenTypeId);
    const base = BALANCE.COOKING_ZONES;

    let raw = { ...base.RAW };
    let cooked = { ...base.COOKED };
    let perfect = { ...base.PERFECT };
    let burned = { ...base.BURNED };

    if (effectMods.rawMulti != null) raw.multiplier = effectMods.rawMulti;
    if (effectMods.burnedMulti != null) burned.multiplier = effectMods.burnedMulti;

    if (ovenType.zoneOverrides?.PERFECT) {
      const ov = ovenType.zoneOverrides.PERFECT;
      if (ov.start !== undefined) perfect.start = ov.start;
      if (ov.end !== undefined) perfect.end = ov.end;
      if (ov.multiplier !== undefined) perfect.multiplier = ov.multiplier;
    }

    if (upgrades.includes('precision')) {
      const width = perfect.end - perfect.start;
      const newWidth = width * 0.7;
      const center = (perfect.start + perfect.end) / 2;
      perfect.start = center - newWidth / 2;
      perfect.end = center + newWidth / 2;
      perfect.multiplier += 0.60;
    }

    if (effectMods.perfectZoneBonus) {
      const width = perfect.end - perfect.start;
      const expansion = width * (effectMods.perfectZoneBonus / 100);
      perfect.start = Math.max(0, perfect.start - expansion / 2);
      perfect.end = Math.min(1, perfect.end + expansion / 2);
    }

    cooked.end = perfect.start;
    burned.start = perfect.end;

    const zones = [
      { zone: 'RAW', start: raw.start, end: raw.end, multiplier: raw.multiplier, label: raw.label },
      { zone: 'COOKED', start: raw.end, end: perfect.start, multiplier: cooked.multiplier, label: cooked.label },
      { zone: 'PERFECT', start: perfect.start, end: perfect.end, multiplier: perfect.multiplier, label: perfect.label },
    ];

    if (upgrades.includes('sweet_spot')) {
      const ssStart = perfect.end;
      const ssEnd = Math.min(ssStart + 0.05, 1.0);
      zones.push({ zone: 'SWEET_SPOT', start: ssStart, end: ssEnd, multiplier: 2.0, label: 'SWEET SPOT' });
      burned.start = ssEnd;
    }

    zones.push({ zone: 'BURNED', start: burned.start, end: 1.0, multiplier: 0, label: burned.label });
    return zones;
  }

  #evaluateTiming(progress, zones) {
    for (const z of zones) {
      if (progress >= z.start && progress < z.end) {
        return { zone: z.zone, multiplier: z.multiplier, progress };
      }
    }
    return { zone: 'BURNED', multiplier: 0, progress };
  }
}
