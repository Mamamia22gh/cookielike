import { getOvenType } from '../data/ovens.js';
import { BALANCE } from '../data/balance.js';

/**
 * Chain-cooking oven system.
 * Each oven cooks one cookie at a time from a 4×5 box.
 * Player extracts each cookie individually with timing.
 */
export class OvenSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  firstFreeIndex(run) {
    return run.ovens.findIndex(o => o.box === null);
  }

  loadBox(run, ovenIndex, box) {
    const oven = run.ovens[ovenIndex];
    if (!oven) { this.#events.emit('oven:invalid_index', { ovenIndex }); return false; }
    if (oven.box !== null) { this.#events.emit('oven:occupied', { ovenIndex }); return false; }

    oven.box = box;
    oven.cookieIndex = 0;
    oven.progress = 0;

    this.#events.emit('oven:loaded', { ovenIndex, ovenType: oven.typeId, box });
    return true;
  }

  /**
   * Advance all ovens. Auto-burns cookies that reach 100%.
   * Returns array of events: { type: 'burn'|'complete', ovenIndex, ... }
   */
  update(run, dtSec, speedBonus = 1) {
    const events = [];

    for (let i = 0; i < run.ovens.length; i++) {
      const oven = run.ovens[i];
      if (!oven.box) continue;

      const totalCookies = run.boxSize * BALANCE.BOX_WIDTH;
      if (oven.cookieIndex >= totalCookies) continue;

      const ovenType = getOvenType(oven.typeId);
      let speed = ovenType.speedMultiplier * speedBonus;
      if (run.cookingUpgrades.includes('speed_demon')) speed *= 2;

      const progressPerSec = speed / BALANCE.COOKING_BASE_DURATION_SEC;
      oven.progress += progressPerSec * dtSec;

      this.#events.emit('oven:progress', {
        ovenIndex: i,
        cookieIndex: oven.cookieIndex,
        totalCookies,
        progress: Math.min(1, oven.progress),
      });

      // Auto-burn at 100%
      while (oven.progress >= 1.0 && oven.cookieIndex < totalCookies) {
        const overflow = oven.progress - 1.0;
        this.#setCookieResult(oven, run.boxSize, 'BURNED', 0);
        events.push({ type: 'burn', ovenIndex: i, cookieIndex: oven.cookieIndex - 1 });

        if (oven.cookieIndex >= totalCookies) {
          const box = oven.box;
          oven.box = null;
          oven.cookieIndex = 0;
          oven.progress = 0;
          events.push({ type: 'complete', ovenIndex: i, box });
        } else {
          oven.progress = overflow; // carry over excess time
        }
      }
    }

    return events;
  }

  /**
   * Extract the currently-cooking cookie. Evaluates timing zone.
   * @returns {{ box, complete, cookingResult }|null}
   */
  extractCookie(run, ovenIndex, cookingUpgrades, effectMods = {}) {
    const oven = run.ovens[ovenIndex];
    if (!oven?.box) return null;

    const totalCookies = run.boxSize * BALANCE.BOX_WIDTH;
    if (oven.cookieIndex >= totalCookies) return null;

    const progress = Math.min(1, oven.progress);
    const zones = this.getZones(oven.typeId, cookingUpgrades, effectMods);
    const cookingResult = this.#evaluateTiming(progress, zones);

    // Apply oven special effects
    const ovenType = getOvenType(oven.typeId);
    cookingResult.ovenEffect = null;
    if (ovenType.specialEffect === 'golden_chance' && cookingResult.zone !== 'BURNED') {
      cookingResult.ovenEffect = 'golden_chance';
    }
    if (ovenType.specialEffect === 'reshuffle' && cookingResult.zone !== 'BURNED') {
      cookingResult.ovenEffect = 'reshuffle';
    }

    this.#setCookieResult(oven, run.boxSize, cookingResult.zone, cookingResult.multiplier);

    const complete = oven.cookieIndex >= totalCookies;

    this.#events.emit('oven:extracted', {
      ovenIndex,
      cookieIndex: oven.cookieIndex - 1,
      progress,
      cookingResult,
      complete,
    });

    if (complete) {
      const box = oven.box;
      oven.box = null;
      oven.cookieIndex = 0;
      oven.progress = 0;
      return { box, complete: true, cookingResult };
    }

    return { box: oven.box, complete: false, cookingResult };
  }

  clearAll(run) {
    for (const oven of run.ovens) {
      oven.box = null;
      oven.cookieIndex = 0;
      oven.progress = 0;
    }
  }

  // ── Internal ──

  #setCookieResult(oven, boxHeight, zone, multiplier) {
    const col = Math.floor(oven.cookieIndex / boxHeight);
    const row = oven.cookieIndex % boxHeight;
    if (oven.box.grid[col]?.[row]) {
      oven.box.grid[col][row].cookingZone = zone;
      oven.box.grid[col][row].cookingMulti = multiplier;
    }
    oven.cookieIndex++;
    oven.progress = 0;
  }

  /**
   * Get computed cooking zones for an oven type + upgrades.
   */
  getZones(ovenTypeId, upgrades = [], effectMods = {}) {
    const ovenType = getOvenType(ovenTypeId);
    const base = BALANCE.COOKING_ZONES;

    let raw = { ...base.RAW };
    let cooked = { ...base.COOKED };
    let perfect = { ...base.PERFECT };
    let burned = { ...base.BURNED };

    // Override zone multipliers from artifacts
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

    // Artifact perfect zone bonus
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
