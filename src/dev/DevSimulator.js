import { createGame } from '../index.js';
import { META_UNLOCKS } from '../systems/MetaSystem.js';

/**
 * Meta-progression simulator.
 * Simulates full campaigns: multiple runs where stars/unlocks carry over.
 *
 * Usage:
 *   node src/dev/DevSimulator.js [campaigns] [runsPerCampaign] [seed]
 *
 * Examples:
 *   node src/dev/DevSimulator.js                  → 20 campaigns × 30 runs
 *   node src/dev/DevSimulator.js 50 50            → 50 campaigns × 50 runs
 *   node src/dev/DevSimulator.js 100 40 42        → 100 campaigns × 40 runs, seed 42
 */

// ─── Single Run ───

function simulateRun(seed, meta) {
  const metaCopy = JSON.parse(JSON.stringify(meta));
  const game = createGame({ seed, meta: metaCopy });

  let roundResult = null;
  let won = false;

  game.on('round:ended', (d) => { roundResult = d; });
  game.on('game:won', () => { won = true; });

  game.startRun();

  for (let round = 1; round <= 15; round++) {
    game.startRound();
    const run = game.getState().run;

    let simTime = 0;
    const TICK = 50;
    const MAX_TIME = (run.timer.duration + 1) * 1000;

    while (simTime < MAX_TIME && game.getPhase() === 'PRODUCTION') {
      // Try pulling lever when no oven is busy (or has free oven)
      game.pullLever();

      game.update(TICK);
      simTime += TICK;

      // Extract cookies from all ovens that have progress in perfect zone
      for (let i = 0; i < run.ovens.length; i++) {
        const oven = run.ovens[i];
        if (oven.box && oven.progress >= 0.72 && oven.progress < 0.84) {
          game.extractFromOven(i);
        }
      }
    }

    if (game.getPhase() !== 'RESULTS') break;
    if (!roundResult?.passed) break;

    game.continueFromResults();
    if (game.getPhase() !== 'CHOICE') break;

    // Pick a choice — simple heuristic
    const choices = game.getState().run.currentChoices;
    if (choices.length > 0) {
      const idx = pickChoice(choices, game.getState().run);
      const ch = choices[idx];
      if (ch.needsTarget) {
        const pool = game.getState().run.machine.pool;
        let target;
        if (ch.type === 'recipe_remove') {
          target = [...pool].sort((a, b) => a.weight - b.weight)[0]?.recipeId;
        } else {
          target = pool[0]?.recipeId;
        }
        game.makeChoice(idx, target);
      } else {
        game.makeChoice(idx);
      }
    }

    if (game.getPhase() !== 'SHOP') break;

    // Buy cheapest artifact if affordable
    const offerings = game.getState().run.shopOfferings;
    if (offerings.length > 0) {
      const cheapest = offerings.reduce((best, o, i) => 
        o.finalCost < (best.cost ?? Infinity) ? { idx: i, cost: o.finalCost } : best, {});
      if (cheapest.cost <= game.getState().run.shopCurrency) {
        game.shopBuyArtifact(cheapest.idx);
      }
    }

    game.endShop();

    if (won) break;
  }

  const finalMeta = JSON.parse(JSON.stringify(game.getMeta()));
  const score = game.getState().run?.score || 0;
  const rounds = roundResult?.round || game.getState().run?.round || 1;

  return { seed, rounds, won, score, meta: finalMeta };
}

function pickChoice(choices, run) {
  const scores = choices.map((c, i) => {
    let s = 0;
    if (c.type === 'upgrade') s = 20;
    else if (c.type === 'oven') s = 18;
    else if (c.type === 'recipe') s = 10;
    else if (c.type === 'topping') s = 8;
    else if (c.type === 'recipe_copy') s = 5;
    else if (c.type === 'recipe_remove') s = 5;
    if (c.needsTarget) s -= 2;
    return { i, s };
  });
  scores.sort((a, b) => b.s - a.s);
  return scores[0].i;
}

// ─── Auto-Unlock ───

function autoUnlock(meta) {
  const sorted = [...META_UNLOCKS]
    .filter(u => !meta.unlocks.includes(u.id) && meta.stars >= u.cost)
    .sort((a, b) => a.cost - b.cost);

  let unlocked = 0;
  for (const u of sorted) {
    if (meta.stars >= u.cost) {
      meta.stars -= u.cost;
      meta.unlocks.push(u.id);
      unlocked++;
    }
  }
  return unlocked;
}

// ─── Campaign ───

function simulateCampaign(runsPerCampaign, baseSeed) {
  let meta = { stars: 0, totalStars: 0, runsCompleted: 0, bestRound: 0, unlocks: [] };
  const results = [];

  for (let i = 0; i < runsPerCampaign; i++) {
    autoUnlock(meta);
    const unlocksBefore = meta.unlocks.length;
    const result = simulateRun(baseSeed + i, meta);
    results.push({ ...result, unlockCount: unlocksBefore });
    meta = result.meta;
  }

  return { results, finalMeta: meta };
}

// ─── Main ───

function main() {
  const args = process.argv.slice(2);
  const campaigns = parseInt(args[0]) || 20;
  const runsPerCampaign = parseInt(args[1]) || 30;
  const baseSeed = parseInt(args[2]) || 42;
  const totalRuns = campaigns * runsPerCampaign;

  console.log(`\n🍪 COOKIELIKE SIMULATOR — Meta Progression`);
  console.log(`${campaigns} campaigns × ${runsPerCampaign} runs = ${totalRuns} total (seed: ${baseSeed})\n`);

  const start = performance.now();
  const allResults = [];

  for (let c = 0; c < campaigns; c++) {
    const { results } = simulateCampaign(runsPerCampaign, baseSeed + c * 10000);
    allResults.push(...results);
    if ((c + 1) % 5 === 0 || c === campaigns - 1) {
      process.stdout.write(`  ${c + 1}/${campaigns} campaigns\r`);
    }
  }

  const elapsed = ((performance.now() - start) / 1000).toFixed(2);

  // ── Overall ──
  const wins = allResults.filter(r => r.won).length;
  const avgRounds = allResults.reduce((s, r) => s + r.rounds, 0) / totalRuns;
  const avgScore = allResults.reduce((s, r) => s + r.score, 0) / totalRuns;

  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  RESULTS — ${totalRuns} runs across ${campaigns} campaigns (${elapsed}s)`);
  console.log(`${'─'.repeat(56)}`);
  console.log(`  Overall win rate:  ${wins}/${totalRuns} (${(wins / totalRuns * 100).toFixed(1)}%)`);
  console.log(`  Avg rounds:        ${avgRounds.toFixed(1)}`);
  console.log(`  Avg score:         ${Math.floor(avgScore)}`);

  // ── By unlock tier ──
  const tiers = [
    { label: '0 unlocks',    filter: r => r.unlockCount === 0 },
    { label: '1-3 unlocks',  filter: r => r.unlockCount >= 1 && r.unlockCount <= 3 },
    { label: '4-6 unlocks',  filter: r => r.unlockCount >= 4 && r.unlockCount <= 6 },
    { label: '7-9 unlocks',  filter: r => r.unlockCount >= 7 && r.unlockCount <= 9 },
    { label: '10+ unlocks',  filter: r => r.unlockCount >= 10 },
  ];

  console.log(`\n  Win rate by meta-progression:`);
  for (const tier of tiers) {
    const m = allResults.filter(tier.filter);
    if (m.length === 0) continue;
    const w = m.filter(r => r.won).length;
    const pct = (w / m.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.ceil(w / m.length * 30));
    console.log(`    ${tier.label.padEnd(14)} ${String(w).padStart(4)}/${String(m.length).padStart(4)} (${pct.padStart(5)}%)  ${bar}`);
  }

  // ── Campaign progression (early vs late runs) ──
  console.log(`\n  Campaign progression (within each campaign):`);
  const buckets = 5;
  const bucketSize = Math.floor(runsPerCampaign / buckets);
  for (let b = 0; b < buckets; b++) {
    let bWins = 0, bTotal = 0;
    for (let c = 0; c < campaigns; c++) {
      const offset = c * runsPerCampaign;
      for (let i = b * bucketSize; i < (b + 1) * bucketSize && i < runsPerCampaign; i++) {
        const r = allResults[offset + i];
        if (r) { bTotal++; if (r.won) bWins++; }
      }
    }
    const pct = bTotal > 0 ? (bWins / bTotal * 100).toFixed(1) : '0.0';
    const label = `Runs ${b * bucketSize + 1}-${(b + 1) * bucketSize}`;
    const bar = '█'.repeat(Math.ceil(bWins / Math.max(1, bTotal) * 30));
    console.log(`    ${label.padEnd(14)} ${pct.padStart(5)}% win  ${bar}`);
  }

  // ── Round distribution ──
  console.log(`\n  Round distribution:`);
  const roundDist = {};
  for (const r of allResults) roundDist[r.rounds] = (roundDist[r.rounds] || 0) + 1;
  for (let r = 1; r <= 15; r++) {
    const count = roundDist[r] || 0;
    const bar = '█'.repeat(Math.ceil(count / totalRuns * 50));
    console.log(`    R${String(r).padStart(2)}: ${String(count).padStart(4)} ${bar}`);
  }

  console.log(`${'─'.repeat(56)}\n`);
}

main();
