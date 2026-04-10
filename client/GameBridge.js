import { BALANCE, getQuota, getPasteForRound } from '../src/index.js';

/**
 * Bridges the headless game engine to the 3D scene + HUD.
 * Listens to engine events and dispatches visual updates.
 */
export class GameBridge {
  constructor(game, factory, hud, audio) {
    this.game = game;
    this.factory = factory;
    this.hud = hud;
    this.audio = audio;

    this._pendingChoiceIndex = -1;
    this._choices = [];

    // ── Wire up sound callbacks on the slot machine ──
    this.factory.slotMachine.onTick = () => this.audio.play('tick');
    this.factory.slotMachine.onLock = () => this.audio.play('lock');
    this.factory.slotMachine.onCraftStart = () => this.audio.play('craft');
    this.factory.slotMachine.onCraftDone = () => this.audio.play('score');

    this._bindEvents();
    this.factory.setPhase('IDLE');
  }

  /* ── Interaction from 3D raycaster ── */
  interact(data) {
    if (!data || !data.action) return;
    const g = this.game;
    const phase = g.getPhase();

    switch (data.action) {
      case 'start_run':
        this.audio.play('click');
        g.startRun();
        break;
      case 'start_round':
        if (phase === 'PREVIEW') { this.audio.play('click'); this.startRound(); }
        break;
      case 'continue_results':
        if (phase === 'RESULTS') { this.audio.play('click'); g.continueFromResults(); }
        break;

      case 'end_round':
        if (phase === 'PRODUCTION') { this.audio.play('click'); g.endRoundEarly(); }
        break;

      case 'pour_dough':
        if (phase === 'PRODUCTION') {
          this.audio.play('click');
          this.factory.doughProvider.pour();
          this.hud.addMessage('🧈 Pâte versée');
        }
        break;
      case 'pull_lever':
        if (phase === 'PRODUCTION') g.pullLever();
        break;

      case 'extract_cookie':
        if (phase === 'PRODUCTION') {
          g.extractCookie(data.ovenIndex, data.col, data.row);
        }
        break;

      case 'poll_reroll':
        if (phase === 'POLL') { this.audio.play('click'); g.pollReroll(); }
        break;
      case 'poll_confirm':
        if (phase === 'POLL') { this.audio.play('click'); g.pollConfirm(); }
        break;

      case 'choice':
        if (phase === 'CHOICE') { this.audio.play('click'); this.selectChoice(data.index); }
        break;

      case 'target_select':
        if (this._pendingChoiceIndex >= 0) {
          this.audio.play('click');
          this.game.makeChoice(this._pendingChoiceIndex, data.recipeId);
          this._pendingChoiceIndex = -1;
          this.factory.clearTargetSelection();
        }
        break;

      case 'shop_buy':
        if (phase === 'SHOP') {
          if (g.shopBuyArtifact(data.index)) this.audio.play('buy');
          this._refreshShop();
        }
        break;
      case 'shop_reroll':
        if (phase === 'SHOP') {
          this.audio.play('click');
          g.shopReroll();
          this._refreshShop();
        }
        break;
      case 'shop_done':
        if (phase === 'SHOP') { this.audio.play('click'); g.endShop(); }
        break;
    }
  }

  startRound() { this.game.startRound(); }

  selectChoice(index) {
    const ch = this._choices[index];
    if (!ch) return;
    if (ch.needsTarget) {
      this._pendingChoiceIndex = index;
      const run = this.game.getState().run;
      this.factory.showTargetSelection(run.machine.pool);
      this.hud.addMessage('🎯 Sélectionnez une recette');
    } else {
      this.game.makeChoice(index);
    }
  }

  _refreshShop() {
    const run = this.game.getState().run;
    if (run) this.factory.showShop(run, run.shopOfferings);
  }

  /* ── Game events ── */
  _bindEvents() {
    const g = this.game;

    g.on('phase:changed', ({ phase }) => {
      this.factory.setPhase(phase);
      this.hud.setPhase(phase);
    });

    g.on('run:started', () => this.factory.reset());

    g.on('preview', (data) => this.factory.showPreview(data));

    g.on('poll:opened', () => {
      const run = g.getState().run;
      this.factory.startPoll(run.poll.recipes, run.poll.rerollsLeft);
    });

    g.on('poll:rerolled', () => {
      const run = g.getState().run;
      this.factory.slotMachine.startRoll(run.poll.recipes, run.poll.rerollsLeft);
    });

    g.on('round:started', (data) => {
      this.factory.startRound(data, g.getState().run);
      this.hud.setRound(data.round);
    });

    g.on('box:created', (data) => {
      this.factory.onBoxCreated(data);
      this.audio.play('pull');
      this.hud.addMessage(`📦 Box — pâte -${data.pasteCost}`);
    });

    g.on('oven:progress', (data) => this.factory.onOvenProgress(data));

    g.on('oven:cookie_done', (data) => {
      this.factory.onCookieExtracted(data);
      const zone = data.cookingResult.zone;
      if (zone === 'PERFECT' || zone === 'SWEET_SPOT') {
        this.audio.play('perfect');
      } else if (zone === 'BURNED') {
        this.audio.play('burn');
      } else {
        this.audio.play('extract');
      }
      if (data.rhythmStreak >= 3) {
        this.hud.addMessage(`🥁 Streak ×${data.rhythmStreak}`);
      }
    });

    g.on('oven:cookie_burned', (data) => {
      this.factory.onCookieBurned(data);
      this.audio.play('burn');
    });

    g.on('box:scored', (data) => {
      this.factory.onBoxScored(data);
      this.audio.play('score');
      const combo = data.box?.gridResult?.bestGroup;
      if (combo && combo.size >= 3) {
        this.audio.play('combo');
        this.hud.addMessage(`🎰 ${combo.name} ×${combo.multiplier} → ${data.value}🪙`);
      } else {
        this.hud.addMessage(`✅ ${data.value}🪙`);
      }
    });

    g.on('benne:added', (data) => this.factory.onBenneAdded(data));

    g.on('fever:started', () => {
      this.factory.onFeverStart();
      this.audio.play('fever');
      this.hud.addMessage('🔥🔥 FEVER MODE 🔥🔥');
    });

    g.on('fever:ended', () => this.factory.onFeverEnd());

    g.on('round:ended', (data) => {
      this.factory.showResults(data);
      this.audio.play(data.passed ? 'success' : 'fail');
    });

    g.on('choice:presented', ({ choices }) => {
      this._choices = choices;
      this.factory.showChoices(choices);
    });

    g.on('shop:opened', () => this._refreshShop());

    g.on('game:over', (data) => this.factory.showGameOver(data, g.getState().run));
    g.on('game:won', (data) => this.factory.showVictory(data, g.getState().run));

    g.on('machine:no_paste', (d) => this.hud.addMessage(`❌ Besoin ${d.required} pâte`));
    g.on('machine:no_oven', () => this.hud.addMessage('❌ Fours pleins'));
    g.on('benne:full', () => this.hud.addMessage('❌ Benne pleine'));
    g.on('error', (d) => this.hud.addMessage(`⛔ ${d.message}`));
  }

  updateHUD() {
    const state = this.game.getState();
    if (!state.run) return;
    const run = state.run;
    this.hud.setTimer(run.timer.remaining);
    this.hud.setPaste(run.paste.current, getPasteForRound(run.round, run.paste.bonusPerm, run.paste.bonusTemp));
    const benneVal = run.benne.boxes.reduce((s, b) => s + (b.value || 0), 0);
    this.hud.setScore(benneVal, getQuota(run.round));
    this.hud.setStreak(run.rhythmStreak, run.fever);
    this.hud.setPhase(state.phase);

    // Update dough provider visual
    this.factory.doughProvider.setPasteLevel(
      run.paste.current,
      getPasteForRound(run.round, run.paste.bonusPerm, run.paste.bonusTemp),
    );
  }
}
