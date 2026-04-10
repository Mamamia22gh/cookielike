import { describe, it, expect } from 'vitest';
import { createGame, PHASE } from '../src/index.js';
import { resetUid } from '../src/core/GameState.js';
import { BALANCE } from '../src/data/balance.js';

const TOTAL_COOKIES = BALANCE.BOX_WIDTH * BALANCE.BOX_SIZE;

describe('Integration: full game flow', () => {
  it('can start a run and enter preview', () => {
    resetUid();
    const game = createGame({ seed: 42 });
    expect(game.getPhase()).toBe('IDLE');
    game.startRun();
    expect(game.getPhase()).toBe('PREVIEW');
  });

  it('can start a round and enter production', () => {
    resetUid();
    const game = createGame({ seed: 42 });
    game.startRun();
    game.startRound();
    expect(game.getPhase()).toBe('POLL');
    game.pollConfirm();
    expect(game.getPhase()).toBe('PRODUCTION');
  });

  it('can pull lever and create a box in oven', () => {
    resetUid();
    const game = createGame({ seed: 42 });
    game.startRun();
    game.startRound();
    game.pollConfirm();

    let createdBox = null;
    game.on('box:created', (d) => { createdBox = d; });

    const box = game.pullLever();
    expect(box).not.toBeNull();
    expect(box.grid.length).toBe(BALANCE.BOX_WIDTH);
    expect(box.grid[0].length).toBe(BALANCE.BOX_SIZE);
    expect(createdBox).not.toBeNull();
  });

  it('can extract all cookies and score box', () => {
    resetUid();
    const game = createGame({ seed: 42 });
    game.startRun();
    game.startRound();
    game.pollConfirm();

    game.pullLever();

    const run = game.getState().run;
    let scoredBox = null;
    game.on('box:scored', (d) => { scoredBox = d; });

    // Extract all 20 cookies at perfect timing
    const rows = BALANCE.BOX_SIZE;
    for (let ci = 0; ci < TOTAL_COOKIES; ci++) {
      run.ovens[0].cookieStates[ci].progress = 0.75;
      const col = Math.floor(ci / rows);
      const row = ci % rows;
      const result = game.extractCookie(0, col, row);
      if (ci < TOTAL_COOKIES - 1) {
        expect(result).toBeNull(); // not complete yet
      } else {
        expect(result).not.toBeNull(); // box complete
        expect(result.value).toBeGreaterThan(0);
      }
    }

    expect(scoredBox).not.toBeNull();
  });

  it('full round → results → choice → shop → next round', () => {
    resetUid();
    const game = createGame({ seed: 42 });
    game.startRun();
    game.startRound();
    game.pollConfirm();

    const run = game.getState().run;

    // Produce a box
    game.pullLever();
    const rows = BALANCE.BOX_SIZE;
    for (let ci = 0; ci < TOTAL_COOKIES; ci++) {
      run.ovens[0].cookieStates[ci].progress = 0.75;
      const col = Math.floor(ci / rows);
      const row = ci % rows;
      game.extractCookie(0, col, row);
    }

    // End round — 1 box may not meet quota, that's fine
    game.endRoundEarly();
    expect(['RESULTS', 'GAME_OVER']).toContain(game.getPhase());

    if (run.lastRoundResult.passed) {
      game.continueFromResults();
      expect(game.getPhase()).toBe('CHOICE');

      const choices = run.currentChoices;
      const easyChoice = choices.findIndex(c => !c.needsTarget);
      if (easyChoice !== -1) {
        game.makeChoice(easyChoice);
        expect(game.getPhase()).toBe('SHOP');
        game.endShop();
        expect(game.getPhase()).toBe('PREVIEW');
        expect(run.round).toBe(2);
      }
    }
  });

  it('game over when quota not met', () => {
    resetUid();
    const game = createGame({ seed: 42 });
    game.startRun();
    game.startRound();
    game.pollConfirm();
    game.endRoundEarly();
    expect(game.getPhase()).toBe('GAME_OVER');
  });

  it('deterministic: same seed = same results', () => {
    const play = (seed) => {
      resetUid();
      const game = createGame({ seed });
      game.startRun();
      game.startRound();
      game.pollConfirm();
      game.pullLever();
      const run = game.getState().run;
      // Extract all cookies at perfect
      const rows = BALANCE.BOX_SIZE;
      for (let ci = 0; ci < TOTAL_COOKIES; ci++) {
        run.ovens[0].cookieStates[ci].progress = 0.75;
        const col = Math.floor(ci / rows);
        const row = ci % rows;
        game.extractCookie(0, col, row);
      }
      const box = run.roundBoxes[0];
      return {
        grid0: box.grid[0].map(c => c.recipeId),
        combo: box.gridResult?.bestGroup?.recipeId,
        value: box.value,
      };
    };

    const r1 = play(999);
    const r2 = play(999);
    expect(r1).toEqual(r2);
  });
});
