import { EventBus } from './EventBus.js';
import { RNG } from './RNG.js';
import { createGameState, createRunState, PHASE, uid } from './GameState.js';
import { BALANCE, getQuota, getPasteForRound } from '../data/balance.js';
import { MachineSystem } from '../systems/MachineSystem.js';
import { ComboSystem } from '../systems/ComboSystem.js';
import { BoxSystem } from '../systems/BoxSystem.js';
import { OvenSystem } from '../systems/OvenSystem.js';
import { ToppingSystem } from '../systems/ToppingSystem.js';
import { BenneSystem } from '../systems/BenneSystem.js';
import { QuotaSystem } from '../systems/QuotaSystem.js';
import { ChoiceSystem } from '../systems/ChoiceSystem.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import { MetaSystem } from '../systems/MetaSystem.js';
import { EffectSystem } from '../systems/EffectSystem.js';
import { PollSystem } from '../systems/PollSystem.js';

/**
 * Main game orchestrator.
 * Owns the state, delegates to systems, manages phase transitions.
 */
export class GameLoop {
  constructor(options = {}) {
    this.events = new EventBus();
    this.rng = new RNG(options.seed ?? Date.now());
    this.state = createGameState(this.rng.seed);

    if (options.meta) {
      this.state.meta = { ...this.state.meta, ...options.meta };
    }

    this.machine = new MachineSystem(this.events);
    this.combo = new ComboSystem();
    this.box = new BoxSystem(this.events);
    this.oven = new OvenSystem(this.events);
    this.topping = new ToppingSystem(this.events);
    this.benne = new BenneSystem(this.events);
    this.quota = new QuotaSystem();
    this.choice = new ChoiceSystem(this.events);
    this.shop = new ShopSystem(this.events);
    this.meta = new MetaSystem(this.events);
    this.effects = new EffectSystem();
    this.poll = new PollSystem(this.events);
  }

  /** Get computed effect modifiers for the current run. */
  #getMods() {
    return this.effects.compute(this.state.run?.artifacts ?? []);
  }

  // ─── Lifecycle ───

  startRun() {
    const ok = [PHASE.IDLE, PHASE.GAME_OVER, PHASE.VICTORY];
    if (!ok.includes(this.state.phase)) {
      return this.#error('Cannot start run in phase ' + this.state.phase);
    }

    this.state.run = createRunState(this.state.meta);
    this.#setPhase(PHASE.PREVIEW);
    this.events.emit('run:started', { seed: this.rng.seed });
    this.#emitPreview();
    return true;
  }

  startRound() {
    if (this.state.phase !== PHASE.PREVIEW) {
      return this.#error('Cannot start round outside PREVIEW');
    }

    const run = this.state.run;
    this.poll.generate(run, this.rng);
    this.#setPhase(PHASE.POLL);
    this.events.emit('poll:opened', {
      recipes: run.poll.recipes,
      rerollsLeft: run.poll.rerollsLeft,
    });
    return true;
  }

  pollReroll() {
    if (this.state.phase !== PHASE.POLL) {
      return this.#error('Can only reroll poll during POLL');
    }
    return this.poll.reroll(this.state.run, this.rng);
  }

  pollConfirm() {
    if (this.state.phase !== PHASE.POLL) {
      return this.#error('Can only confirm poll during POLL');
    }

    const run = this.state.run;
    // Build active pool from poll selection
    run.machine.activePool = this.poll.getActivePool(run);

    const mods = this.#getMods();

    // Paste: base + growth + permanent bonuses + artifact bonuses
    run.paste.current = getPasteForRound(run.round, run.paste.bonusPerm, run.paste.bonusTemp)
      + mods.pasteBonus;
    run.paste.bonusTemp = 0;

    run.benne.capacity = BALANCE.BENNE_CAPACITY + mods.benneBonus;
    run.shopDiscount = mods.shopDiscount;

    run.timer.remaining = BALANCE.ROUND_DURATION_SEC;
    run.timer.duration = BALANCE.ROUND_DURATION_SEC;
    run.rhythmStreak = 0;
    run.armedTopping = null;
    this.benne.clear(run);
    run.roundBoxes = [];

    this.#setPhase(PHASE.PRODUCTION);
    this.events.emit('round:started', {
      round: run.round,
      quota: getQuota(run.round),
      paste: run.paste.current,
      timer: run.timer.remaining,
    });
    return true;
  }

  /**
   * Advance game time. Call every frame.
   * @param {number} dtMs — elapsed milliseconds since last call
   */
  update(dtMs) {
    if (this.state.phase !== PHASE.PRODUCTION) return;

    const run = this.state.run;
    const dtSec = dtMs / 1000;
    const mods = this.#getMods();

    // Round timer
    run.timer.remaining = Math.max(0, run.timer.remaining - dtSec);

    // Ovens — parallel cooking with artifact speed bonus
    const speedBonus = 1 + mods.cookingSpeedPercent / 100;
    const ovenEvents = this.oven.update(run, dtSec, speedBonus);
    for (const evt of ovenEvents) {
      if (evt.type === 'burn') {
        run.rhythmStreak = 0;
        this.events.emit('oven:cookie_burned', {
          ovenIndex: evt.ovenIndex,
          cookieIndex: evt.cookieIndex,
          col: evt.col,
          row: evt.row,
        });
      }
      if (evt.type === 'complete') {
        this.#completeBox(run, evt.box, evt.ovenIndex);
      }
    }

    // Fever countdown
    if (run.fever.active) {
      run.fever.remaining = Math.max(0, run.fever.remaining - dtSec);
      if (run.fever.remaining <= 0) {
        run.fever.active = false;
        this.events.emit('fever:ended');
      }
    }

    this.events.emit('tick', {
      dt: dtMs,
      timer: run.timer.remaining,
      paste: run.paste.current,
      fever: run.fever.active,
    });

    // Auto end round when timer runs out
    if (run.timer.remaining <= 0) {
      this.#endRound();
    }
  }

  // ─── Player Actions (Production) ───

  pullLever() {
    if (this.state.phase !== PHASE.PRODUCTION) {
      return this.#error('Can only pull lever during PRODUCTION');
    }

    const run = this.state.run;
    const cost = this.machine.getPullCost(run);

    if (run.paste.current < cost) {
      this.events.emit('machine:no_paste', { required: cost, available: run.paste.current });
      return null;
    }

    const freeIdx = this.oven.firstFreeIndex(run);
    if (freeIdx === -1) {
      this.events.emit('machine:no_oven');
      return null;
    }

    // Deduct paste
    run.paste.current -= cost;

    // Generate cookies for 4×boxSize grid (pull once per column)
    const allCookies = [];
    for (let col = 0; col < BALANCE.BOX_WIDTH; col++) {
      allCookies.push(...this.machine.pull(run, this.rng));
    }

    const boxObj = this.box.create(allCookies, BALANCE.BOX_WIDTH, run.boxSize);

    // Load into oven with RNG for speed randomisation
    this.oven.loadBox(run, freeIdx, boxObj, this.rng);

    this.events.emit('box:created', {
      box: boxObj,
      ovenIndex: freeIdx,
      pasteCost: cost,
      pasteRemaining: run.paste.current,
    });

    return boxObj;
  }

  /**
   * Extract a specific cookie from an oven by grid coordinates.
   * @param {number} ovenIndex
   * @param {number} col
   * @param {number} row
   */
  extractCookie(ovenIndex, col, row) {
    if (this.state.phase !== PHASE.PRODUCTION) {
      return this.#error('Can only extract during PRODUCTION');
    }

    const run = this.state.run;
    const mods = this.#getMods();
    const result = this.oven.extractCookie(run, ovenIndex, col, row, run.cookingUpgrades, mods);

    if (!result) {
      return null;
    }

    const { complete, cookingResult } = result;

    // Rhythm streak (per-cookie)
    const isPerfect = cookingResult.zone === 'PERFECT' || cookingResult.zone === 'SWEET_SPOT';
    if (isPerfect) {
      run.rhythmStreak++;
    } else {
      run.rhythmStreak = 0;
    }

    // Fever activation
    if (isPerfect && run.rhythmStreak >= BALANCE.FEVER_THRESHOLD && !run.fever.active) {
      run.fever.active = true;
      run.fever.remaining = BALANCE.FEVER_DURATION_SEC;
      this.events.emit('fever:started', { duration: BALANCE.FEVER_DURATION_SEC });
    }

    this.events.emit('oven:cookie_done', {
      ovenIndex,
      col,
      row,
      cookingResult,
      rhythmStreak: run.rhythmStreak,
    });

    if (complete) {
      this.#evaluateBox(run, result.box, ovenIndex);
    }

    return null;
  }

  /** @deprecated Use extractCookie(ovenIndex, col, row) instead. */
  extractFromOven(ovenIndex) {
    const run = this.state.run;
    const oven = run?.ovens?.[ovenIndex];
    if (!oven?.box || !oven.cookieStates) return null;

    const rows = oven.box.grid[0]?.length ?? BALANCE.BOX_SIZE;
    for (let ci = 0; ci < oven.cookieStates.length; ci++) {
      if (!oven.cookieStates[ci].done) {
        const col = Math.floor(ci / rows);
        const row = ci % rows;
        return this.extractCookie(ovenIndex, col, row);
      }
    }
    return null;
  }

  /**
   * Collect the completed tray from an oven. Player now holds it.
   */
  collectBox(ovenIndex) {
    if (this.state.phase !== PHASE.PRODUCTION) {
      return this.#error('Can only collect during PRODUCTION');
    }
    const run = this.state.run;
    if (run.heldBox) {
      this.events.emit('error', { message: 'Déjà un plateau en main' });
      return false;
    }

    const box = this.oven.collectBox(run, ovenIndex);
    if (!box) return false;

    run.heldBox = box;
    this.events.emit('box:collected', { box, ovenIndex });
    return true;
  }

  /**
   * Deposit the held tray into a packaging box. Scores and adds to benne.
   */
  depositBox() {
    if (this.state.phase !== PHASE.PRODUCTION) {
      return this.#error('Can only deposit during PRODUCTION');
    }
    const run = this.state.run;
    if (!run.heldBox) {
      this.events.emit('error', { message: 'Rien en main' });
      return false;
    }

    const box = run.heldBox;
    run.heldBox = null;

    // Score with artifact modifiers
    const mods = this.#getMods();
    box.value = this.box.score(box, mods);

    // Fever boost
    if (run.fever.active) {
      box.value = Math.floor(box.value * BALANCE.FEVER_MULTIPLIER);
    }

    // Add to benne
    this.benne.addBox(run, box);
    run.roundBoxes.push(box);

    this.events.emit('box:scored', { box, value: box.value });
    return true;
  }

  armTopping(toppingId) {
    if (this.state.phase !== PHASE.PRODUCTION) {
      return this.#error('Can only arm topping during PRODUCTION');
    }
    return this.topping.arm(this.state.run, toppingId);
  }

  endRoundEarly() {
    if (this.state.phase !== PHASE.PRODUCTION) return false;
    this.#endRound();
    return true;
  }

  startOven(ovenIndex) {
    if (this.state.phase !== PHASE.PRODUCTION) {
      return this.#error('Can only start oven during PRODUCTION');
    }
    const ok = this.oven.startCooking(this.state.run, ovenIndex);
    if (ok) {
      this.events.emit('oven:cooking_started', { ovenIndex });
    }
    return ok;
  }

  // ─── Player Actions (Results → Choice → Shop) ───

  continueFromResults() {
    if (this.state.phase !== PHASE.RESULTS) return false;

    const run = this.state.run;
    if (!run.lastRoundResult.passed) return false;

    if (run.round >= BALANCE.ROUNDS_PER_RUN) {
      this.#victory();
      return true;
    }

    const choices = this.choice.generate(run, this.state.meta, this.rng);
    run.currentChoices = choices;

    this.#setPhase(PHASE.CHOICE);
    this.events.emit('choice:presented', { choices });
    return true;
  }

  makeChoice(index, targetRecipeId = null) {
    if (this.state.phase !== PHASE.CHOICE) {
      return this.#error('Not in CHOICE phase');
    }

    const run = this.state.run;
    if (index < 0 || index >= run.currentChoices.length) {
      return this.#error('Invalid choice index');
    }

    const choiceDef = run.currentChoices[index];
    const ok = this.choice.apply(run, choiceDef, targetRecipeId, this.rng);
    if (!ok) return false;

    this.events.emit('choice:made', { choice: choiceDef, index });

    // Generate shop offerings
    run.shopOfferings = this.shop.generateOfferings(run, this.rng, this.state.meta);
    run.rerollCount = 0;

    this.#setPhase(PHASE.SHOP);
    this.events.emit('shop:opened', { currency: run.shopCurrency, offerings: run.shopOfferings });
    return true;
  }

  shopBuyArtifact(offeringIndex) {
    if (this.state.phase !== PHASE.SHOP) {
      return this.#error('Not in SHOP phase');
    }
    return this.shop.buyArtifact(this.state.run, offeringIndex);
  }

  shopBuy(actionId, target = null) {
    if (this.state.phase !== PHASE.SHOP) {
      return this.#error('Not in SHOP phase');
    }
    return this.shop.buyAction(this.state.run, actionId, target);
  }

  shopReroll() {
    if (this.state.phase !== PHASE.SHOP) {
      return this.#error('Not in SHOP phase');
    }
    return this.shop.reroll(this.state.run, this.rng);
  }

  skipChoice() {
    if (this.state.phase !== PHASE.CHOICE) return false;
    const run = this.state.run;
    run.shopOfferings = this.shop.generateOfferings(run, this.rng, this.state.meta);
    run.rerollCount = 0;
    this.#setPhase(PHASE.SHOP);
    this.events.emit('shop:opened', { currency: run.shopCurrency, offerings: run.shopOfferings });
    return true;
  }

  endShop() {
    if (this.state.phase !== PHASE.SHOP) return false;

    const run = this.state.run;
    const mods = this.#getMods();

    // Round-end money bonus from artifacts
    if (mods.moneyBonus > 0) {
      run.shopCurrency += mods.moneyBonus;
      this.events.emit('shop:artifact_money', { amount: mods.moneyBonus, total: run.shopCurrency });
    }

    // Apply permanent paste from artifacts
    const totalPermPaste = mods.pastePermanent;
    if (totalPermPaste > run.paste.bonusPerm) {
      run.paste.bonusPerm = totalPermPaste;
    }

    run.round++;

    if (run.round > BALANCE.ROUNDS_PER_RUN) {
      this.#victory();
      return true;
    }

    this.#setPhase(PHASE.PREVIEW);
    this.#emitPreview();
    return true;
  }

  // ─── Internal ───

  /**
   * Evaluate a completed box's grid patterns (but don't score or deposit).
   */
  #evaluateBox(run, box, ovenIndex) {
    box.gridResult = this.combo.evaluateGrid(box.grid);
    box.comboResult = box.gridResult.bestGroup;

    // Apply topping
    if (run.armedTopping) {
      this.topping.apply(run, box);
    }

    this.events.emit('box:ready', { box, ovenIndex });
  }

  /**
   * Score a completed box: evaluate column combos, apply topping, add to benne.
   * Used for auto-burned boxes (from oven update).
   */
  #completeBox(run, box, ovenIndex) {
    const mods = this.#getMods();

    // Evaluate grid patterns (connected groups)
    box.gridResult = this.combo.evaluateGrid(box.grid);
    box.comboResult = box.gridResult.bestGroup; // display compat

    // Apply topping
    if (run.armedTopping) {
      this.topping.apply(run, box);
    }

    // Score with artifact modifiers
    box.value = this.box.score(box, mods);

    // Fever boost
    if (run.fever.active) {
      box.value = Math.floor(box.value * BALANCE.FEVER_MULTIPLIER);
    }

    // Add to benne
    this.benne.addBox(run, box);
    run.roundBoxes.push(box);

    this.events.emit('box:scored', {
      box,
      value: box.value,
      columns: box.columnResults,
      ovenIndex,
    });

    return box;
  }

  #endRound() {
    const run = this.state.run;
    this.oven.clearAll(run);

    const totalValue = this.benne.getTotalValue(run);
    const quota = getQuota(run.round);
    const passed = totalValue >= quota;
    const surplus = Math.max(0, totalValue - quota);
    const shopCoins = Math.floor(surplus / BALANCE.SURPLUS_CONVERSION_RATE);

    run.lastRoundResult = {
      round: run.round,
      boxes: [...run.roundBoxes],
      totalValue,
      quota,
      passed,
      surplus,
      shopCoins,
    };

    run.score += totalValue;
    run.shopCurrency += shopCoins;

    this.#setPhase(PHASE.RESULTS);
    this.events.emit('round:ended', run.lastRoundResult);

    if (!passed) {
      this.#gameOver();
    }
  }

  #gameOver() {
    const run = this.state.run;
    const stars = this.meta.calculateStars(run, false);
    this.#applyStars(stars, run);

    this.#setPhase(PHASE.GAME_OVER);
    this.events.emit('game:over', { round: run.round, stars, score: run.score, quota: getQuota(run.round), totalValue: run.lastRoundResult?.totalValue ?? 0 });
  }

  #victory() {
    const run = this.state.run;
    const stars = this.meta.calculateStars(run, true);
    this.#applyStars(stars, run);

    this.#setPhase(PHASE.VICTORY);
    this.events.emit('game:won', { round: run.round, stars, score: run.score });
  }

  #applyStars(stars, run) {
    this.state.meta.stars += stars;
    this.state.meta.totalStars += stars;
    this.state.meta.runsCompleted++;
    this.state.meta.bestRound = Math.max(this.state.meta.bestRound, run.round);
  }

  #setPhase(phase) {
    this.state.phase = phase;
    this.events.emit('phase:changed', { phase });
  }

  #emitPreview() {
    const run = this.state.run;
    this.events.emit('preview', {
      round: run.round,
      quota: getQuota(run.round),
      paste: getPasteForRound(run.round, run.paste.bonusPerm, 0),
      pool: run.machine.pool,
      probabilities: this.machine.getProbabilities(run.machine.pool),
      ovens: run.ovens.map(o => ({ id: o.id, typeId: o.typeId })),
      toppings: run.toppings,
      cookingUpgrades: run.cookingUpgrades,
      artifacts: run.artifacts,
    });
  }

  #error(msg) {
    this.events.emit('error', { message: msg });
    return false;
  }
}
