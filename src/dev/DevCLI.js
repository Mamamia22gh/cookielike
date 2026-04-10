import readline from 'readline';
import { createGame } from '../index.js';
import { DevLogger } from './DevLogger.js';
import { getRecipe, RECIPES } from '../data/recipes.js';
import { getQuota } from '../data/balance.js';
import { META_UNLOCKS } from '../systems/MetaSystem.js';

/**
 * Interactive CLI for playing/testing the game in a terminal.
 * Usage: node src/dev/DevCLI.js [seed]
 */

const seed = parseInt(process.argv[2]) || Date.now();
const game = createGame({ seed });
const logger = new DevLogger(game, false); // silent logging, we print our own UI

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '🍪 > ',
});

// ─── Event handlers (UI output) ───

game.on('run:started', (d) => print(`\n🏁 Run started! Seed: ${d.seed}`));

game.on('round:started', (d) => {
  print(`\n${'═'.repeat(50)}`);
  print(`  ⏱ ROUND ${d.round} — Quota: ${d.quota}🪙 — Pâte: ${d.paste} — Timer: ${d.timer}s`);
  print(`${'═'.repeat(50)}`);
  printPool();
  print('\nCommands: pull, extract [n], arm [topping], end, info, help');
});

game.on('box:created', (d) => {
  const cookieStr = d.box.cookies.map(c => getRecipe(c.recipeId).emoji).join(' ');
  print(`\n  📦 Boîte: [${cookieStr}]`);
  print(`     Combo: ${d.combo.name} (x${d.combo.multiplier}) — Pâte: -${d.pasteCost} (reste: ${d.pasteRemaining})`);
  print(`     → Chargée dans four ${d.ovenIndex}`);
});

game.on('box:scored', (d) => {
  print(`  ✅ Boîte scorée: ${d.value}🪙 [${d.combo.name} x${d.combo.multiplier}] [${d.cooking.zone} x${d.cooking.multiplier.toFixed(2)}]`);
  if (d.rhythmStreak > 1) print(`     🥁 Streak: ${d.rhythmStreak} (+${(d.rhythmBonus * 100).toFixed(0)}% cooking)`);
});

game.on('oven:burned', (d) => print(`  🔥 Boîte brûlée ! Perdue.`));
game.on('machine:no_paste', (d) => print(`  ❌ Pas assez de pâte (besoin: ${d.required}, dispo: ${d.available})`));
game.on('machine:no_oven', () => print(`  ❌ Aucun four disponible`));
game.on('benne:full', () => print(`  ❌ Benne pleine !`));
game.on('topping:armed', (d) => print(`  🎯 Topping armé: ${d.toppingId}`));
game.on('topping:applied', (d) => print(`  ✨ Topping appliqué: ${d.toppingId}`));
game.on('topping:no_charges', (d) => print(`  ❌ Pas de charges pour ${d.toppingId}`));

game.on('round:ended', (d) => {
  print(`\n${'─'.repeat(50)}`);
  print(`  📊 ROUND ${d.round} — RÉSULTATS`);
  print(`${'─'.repeat(50)}`);
  for (const box of d.boxes) {
    const cookies = box.cookies.map(c => getRecipe(c.recipeId).emoji).join(' ');
    const combo = box.comboResult?.name || 'N/A';
    const zone = box.cookingResult?.zone || 'N/A';
    print(`  📦 [${cookies}] ${combo} | ${zone} → ${box.value}🪙`);
  }
  print(`\n  💰 Total: ${d.totalValue}🪙`);
  print(`  🎯 Quota: ${d.quota}🪙`);
  print(`  ${d.passed ? '✅ ATTEINT' : '❌ RATÉ'} (surplus: ${d.surplus}🪙 → +${d.shopCoins}💵)`);
});

game.on('game:over', (d) => {
  print(`\n💀 GAME OVER au round ${d.round}. Score: ${d.score}. Étoiles: +${d.stars}⭐`);
  print('Tapez "run" pour recommencer ou "quit" pour quitter.');
});

game.on('game:won', (d) => {
  print(`\n🏆 VICTOIRE ! Score: ${d.score}. Étoiles: +${d.stars}⭐`);
  print('Tapez "run" pour recommencer ou "quit" pour quitter.');
});

game.on('choice:presented', (d) => {
  print(`\n🎁 CHOIX (1 parmi ${d.choices.length}) :`);
  d.choices.forEach((c, i) => {
    print(`  [${i}] ${c.name} — ${c.description} (${c.archetype})`);
  });
  print('\nCommands: choose [n] [target?]');
});

game.on('choice:needs_target', (d) => {
  print(`  ⚠️ Ce choix nécessite une cible. Pool actuel :`);
  d.pool.forEach(e => {
    const r = getRecipe(e.recipeId);
    print(`    ${r.emoji} ${e.recipeId} (x${e.weight})`);
  });
  print('  → choose [n] [recipeId]');
});

game.on('shop:opened', (d) => {
  print(`\n🏪 ATELIER — Budget: ${d.currency}💵`);
  print('Commands: buy [action] [target?], shop, done');
  printShopActions();
});

game.on('shop:bought', (d) => print(`  💵 Acheté: ${d.action} (coût: ${d.cost}💵)`));
game.on('shop:insufficient_funds', (d) => print(`  ❌ Pas assez de 💵 (besoin: ${d.cost}, dispo: ${d.available})`));

game.on('preview', (d) => {
  print(`\n📋 APERÇU — Round ${d.round}`);
  print(`  Quota: ${d.quota}🪙 — Pâte: ${d.paste}`);
  print('  Tapez "start" pour lancer le round.');
});

game.on('error', (d) => print(`  ⛔ ${d.message}`));

// ─── Simulation loop (for production phase) ───

let simInterval = null;
const SIM_TICK = 200; // ms per tick

function startSimLoop() {
  if (simInterval) return;
  simInterval = setInterval(() => {
    if (game.getPhase() !== 'PRODUCTION') {
      stopSimLoop();
      return;
    }
    game.update(SIM_TICK);
    printOvenStatus();
  }, SIM_TICK);
}

function stopSimLoop() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
}

// ─── Command handling ───

rl.on('line', (input) => {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const arg1 = parts[1];
  const arg2 = parts[2];

  switch (cmd) {
    case 'run':
      stopSimLoop();
      game.startRun();
      break;

    case 'start':
      game.startRound();
      startSimLoop();
      break;

    case 'pull':
    case 'p':
      game.pullLever();
      break;

    case 'extract':
    case 'e': {
      const idx = parseInt(arg1) || 0;
      game.extractFromOven(idx);
      break;
    }

    case 'arm': {
      if (!arg1) { print('Usage: arm <toppingId>'); break; }
      game.armTopping(arg1);
      break;
    }

    case 'end':
      stopSimLoop();
      game.endRoundEarly();
      break;

    case 'continue':
    case 'c':
      game.continueFromResults();
      break;

    case 'choose': {
      const idx = parseInt(arg1);
      if (isNaN(idx)) { print('Usage: choose <index> [targetRecipeId]'); break; }
      game.makeChoice(idx, arg2 || null);
      break;
    }

    case 'buy': {
      if (!arg1) { printShopActions(); break; }
      game.shopBuy(arg1, arg2 || null);
      break;
    }

    case 'shop':
      printShopActions();
      break;

    case 'done':
      game.endShop();
      break;

    case 'info':
    case 'i':
      printInfo();
      break;

    case 'ovens':
    case 'o':
      printOvenStatus();
      break;

    case 'pool':
      printPool();
      break;

    case 'meta':
      printMeta();
      break;

    case 'unlock': {
      if (!arg1) { printUnlocks(); break; }
      game.metaUnlock(arg1);
      printMeta();
      break;
    }

    case 'export':
      print(game.exportDebug());
      break;

    case 'log':
      print(logger.export());
      break;

    case 'help':
    case 'h':
      printHelp();
      break;

    case 'quit':
    case 'q':
      stopSimLoop();
      print('Bye! 🍪');
      process.exit(0);

    default:
      if (cmd) print(`Commande inconnue: ${cmd}. Tapez "help".`);
  }

  rl.prompt();
});

// ─── Display helpers ───

function print(msg) {
  console.log(msg);
}

function printHelp() {
  print(`
🍪 COOKIELIKE — Commandes
─────────────────────────
  run               Démarrer un run
  start             Lancer le round (depuis PREVIEW)
  pull / p          Tirer le levier
  extract / e [n]   Extraire du four n (défaut: 0)
  arm <topping>     Armer un topping
  end               Finir le round en avance
  continue / c      Continuer après les résultats
  choose <n> [id]   Faire un choix (avec cible optionnelle)
  buy <action> [id] Acheter au shop
  shop              Voir les actions du shop
  done              Quitter le shop
  info / i          Afficher l'état du jeu
  ovens / o         Afficher l'état des fours
  pool              Afficher le pool de recettes
  meta              Afficher la méta-progression
  unlock [id]       Débloquer un unlock
  export            Exporter l'état (JSON)
  log               Exporter le log d'events
  help / h          Cette aide
  quit / q          Quitter
`);
}

function printInfo() {
  const state = game.getState();
  print(`\n  Phase: ${state.phase}`);
  if (!state.run) { print('  Pas de run en cours.'); return; }
  const run = state.run;
  print(`  Round: ${run.round} — Score: ${run.score}`);
  print(`  Pâte: ${run.paste.current} (perm bonus: +${run.paste.bonusPerm})`);
  print(`  Pull cost: ${run.pullCost} — Box size: ${run.boxSize}`);
  print(`  Benne: ${run.benne.boxes.length}/${run.benne.capacity}`);
  print(`  Shop 💵: ${run.shopCurrency}`);
  print(`  Timer: ${run.timer.remaining.toFixed(1)}s`);
  print(`  Upgrades: ${run.cookingUpgrades.join(', ') || 'aucun'}`);
  printPool();
}

function printPool() {
  const state = game.getState();
  if (!state.run) return;
  const pool = state.run.machine.pool;
  const total = pool.reduce((s, e) => s + e.weight, 0);
  print('  Pool:');
  for (const e of pool) {
    const r = getRecipe(e.recipeId);
    const pct = ((e.weight / total) * 100).toFixed(1);
    print(`    ${r.emoji} ${r.name} x${e.weight} (${pct}%) — val: ${r.baseValue}`);
  }
}

function printOvenStatus() {
  const state = game.getState();
  if (!state.run) return;
  const ovens = state.run.ovens;
  const lines = ovens.map((o, i) => {
    if (!o.box) return `    Four ${i} [${o.typeId}]: vide`;
    const pct = (o.progress * 100).toFixed(0);
    const bar = progressBar(o.progress, 20);
    return `    Four ${i} [${o.typeId}]: ${bar} ${pct}%`;
  });
  if (lines.some(l => l.includes('%'))) {
    print('  Fours: ' + lines.join('\n'));
  }
}

function printShopActions() {
  const state = game.getState();
  if (!state.run) return;
  print(`  💵 Budget: ${state.run.shopCurrency}`);
  print('  Actions:');
  print('    buy remove_copy <recipeId>    — 30💵');
  print('    buy duplicate_copy <recipeId> — 50💵');
  print('    buy paste_temp                — 15💵');
  print('    buy paste_perm                — 60💵');
  print('    buy reroll_token              — 40💵');
}

function printMeta() {
  const meta = game.getMeta();
  print(`\n  ⭐ Étoiles: ${meta.stars} (total gagné: ${meta.totalStars})`);
  print(`  Runs: ${meta.runsCompleted} — Best round: ${meta.bestRound}`);
  print(`  Unlocks: ${meta.unlocks.length > 0 ? meta.unlocks.join(', ') : 'aucun'}`);
  printUnlocks();
}

function printUnlocks() {
  const unlocks = game.getUnlocks();
  print('  Unlocks disponibles:');
  for (const u of unlocks) {
    const status = u.unlocked ? '✅' : (u.affordable ? '🔓' : '🔒');
    print(`    ${status} ${u.id} — ${u.name} (${u.cost}⭐) : ${u.description}`);
  }
}

function progressBar(value, width) {
  const filled = Math.round(value * width);
  return '[' + '▓'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

// ─── Start ───

print(`\n🍪 COOKIELIKE — Dev CLI (seed: ${seed})`);
print('Tapez "run" pour démarrer ou "help" pour l\'aide.\n');
rl.prompt();
