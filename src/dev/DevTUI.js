#!/usr/bin/env node
import readline from 'readline';
import { createGame } from '../index.js';
import { getRecipe, RECIPES } from '../data/recipes.js';
import { getQuota, getPasteForRound, BALANCE } from '../data/balance.js';
import { getTopping } from '../data/toppings.js';

// ═══════════════════════════════════════════════════════════
//  ANSI Terminal Codes
// ═══════════════════════════════════════════════════════════
const R = '\x1b[0m', B = '\x1b[1m', DIM = '\x1b[2m', INV = '\x1b[7m';
const fg = {
  r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[34m',
  m: '\x1b[35m', c: '\x1b[36m', w: '\x1b[37m', gr: '\x1b[90m',
  R: '\x1b[91m', G: '\x1b[92m', Y: '\x1b[93m', M: '\x1b[95m',
  C: '\x1b[96m', W: '\x1b[97m',
};
const HOME = '\x1b[H', EL = '\x1b[K', ED = '\x1b[J';
const HIDE = '\x1b[?25l', SHOW = '\x1b[?25h';
const write = s => process.stdout.write(s);

// ═══════════════════════════════════════════════════════════
//  Render Helpers
// ═══════════════════════════════════════════════════════════
function pbar(val, max, w, fc = fg.G, ec = fg.gr) {
  const ratio = max > 0 ? Math.min(1, val / max) : 0;
  const f = Math.round(ratio * w);
  return fc + '█'.repeat(f) + ec + '░'.repeat(w - f) + R;
}

function zoneOf(p) {
  if (p < 0.30) return ['CRU', fg.b];
  if (p < 0.70) return ['CUIT', fg.y];
  if (p < 0.85) return ['PARFAIT', fg.G];
  return ['BRÛLÉ', fg.R];
}

function ovenBar(p, w = 28) {
  p = Math.min(1, Math.max(0, p));
  const f = Math.round(p * w);
  let [, zc] = zoneOf(p);
  if (p > 0.78 && p < 0.85 && ui.tick % 4 < 2) zc = `${fg.Y}${B}`;
  if (p >= 0.85) zc = ui.tick % 2 === 0 ? `${fg.R}${B}` : `${fg.Y}`;
  return zc + '█'.repeat(f) + fg.gr + '░'.repeat(w - f) + R;
}

function poolLine(pool) {
  const t = pool.reduce((s, e) => s + e.weight, 0);
  if (t === 0) return '(vide)';
  return pool.map(e => {
    const r = getRecipe(e.recipeId);
    return `${r.emoji}x${e.weight}(${((e.weight / t) * 100).toFixed(0)}%)`;
  }).join(' ');
}

function sep(w = 62) { return fg.gr + '─'.repeat(w) + R; }
function dsep(w = 62) { return fg.C + '═'.repeat(w) + R; }

const OVEN_EMOJI = { classic: '🔥', turbo: '⚡', magic: '✨', cryo: '🧊', chaos: '🌀' };

// ═══════════════════════════════════════════════════════════
//  Game Setup
// ═══════════════════════════════════════════════════════════
const seed = parseInt(process.argv[2]) || Date.now();
const game = createGame({ seed });

// ═══════════════════════════════════════════════════════════
//  UI State
// ═══════════════════════════════════════════════════════════
const ui = {
  tick: 0,
  cursor: 0,
  selecting: false,
  targetCursor: 0,
  pending: null,
  msgs: [],
  // Deck editor (round 1 only)
  deckEditing: false,
  deckCursor: 0,
  deckAvailable: [],
  deckSelected: new Set(),
};

function msg(s) {
  ui.msgs.push(s);
  if (ui.msgs.length > 5) ui.msgs.shift();
}

// ═══════════════════════════════════════════════════════════
//  Event Handlers
// ═══════════════════════════════════════════════════════════
game.on('box:created', d => {
  const ck = d.box.cookies.map(c => getRecipe(c.recipeId).emoji).join('');
  msg(` 📦 ${ck}  ${fg.gr}pâte -${d.pasteCost} (${d.pasteRemaining})${R}`);
});

game.on('box:scored', d => {
  msg(` ${fg.G}✅ ${d.value}🪙${R}  ${fg.W}${d.box.comboResult?.name || '-'}${R}`);
});

game.on('oven:burned', () => msg(` ${fg.R}${B}🔥 BRÛLÉ ! Boîte perdue !${R}`));
game.on('machine:no_paste', d => msg(` ${fg.r}❌ Pâte insuffisante (${d.required} requis, ${d.available} dispo)${R}`));
game.on('machine:no_oven', () => msg(` ${fg.r}❌ Tous les fours occupés !${R}`));
game.on('benne:full', () => msg(` ${fg.r}❌ Benne pleine !${R}`));
game.on('fever:started', d => msg(` ${fg.R}${B}🔥🔥🔥 FEVER MODE ! ${d.duration}s x${BALANCE.FEVER_MULTIPLIER} 🔥🔥🔥${R}`));
game.on('fever:ended', () => msg(` ${fg.gr}Fever terminé${R}`));
game.on('shop:artifact_bought', d => msg(` ${fg.G}🎁 ${d.artifact.emoji} ${d.artifact.name} (${d.cost}💵)${R}`));
game.on('shop:artifact_money', d => msg(` ${fg.Y}🐷 +${d.amount}💵 artefacts${R}`));
game.on('shop:rerolled', d => msg(` ${fg.c}🔄 Reroll (${d.cost}💵)${R}`));
game.on('shop:insufficient_funds', d => msg(` ${fg.r}❌ Pas assez de 💵 (${d.cost} requis)${R}`));
game.on('shop:cannot_remove_last', () => msg(` ${fg.r}❌ Impossible : dernière recette${R}`));
game.on('topping:armed', d => msg(` ${fg.c}🎯 Topping armé : ${d.toppingId}${R}`));
game.on('topping:applied', d => msg(` ${fg.G}✨ Topping appliqué : ${d.toppingId}${R}`));
game.on('topping:no_charges', d => msg(` ${fg.r}❌ Pas de charges : ${d.toppingId}${R}`));
game.on('error', d => msg(` ${fg.r}⛔ ${d.message}${R}`));
game.on('shop:interest', d => msg(` ${fg.Y}📈 Intérêts : +${d.interest}💵 (total: ${d.total}💵)${R}`));
game.on('machine:max_copies', d => msg(` ${fg.y}⚠ Max ${d.max} copies par recette${R}`));

// ═══════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════
function computePullCost(run) {
  const pool = run.machine.pool;
  const tw = pool.reduce((s, e) => s + e.weight, 0);
  if (tw === 0) return run.boxSize;
  const wc = pool.reduce((s, e) => s + getRecipe(e.recipeId).pasteCost * e.weight, 0);
  const base = Math.ceil((wc / tw) * run.boxSize);
  const red = run.cookingUpgrades.filter(u => u === 'pull_cost').length;
  return Math.max(1, base - red);
}

// ═══════════════════════════════════════════════════════════
//  Screen Renderers
// ═══════════════════════════════════════════════════════════
function render() {
  const L = [];
  switch (game.getPhase()) {
    case 'IDLE': rIdle(L); break;
    case 'PREVIEW': rPreview(L); break;
    case 'PRODUCTION': rProd(L); break;
    case 'RESULTS': rResults(L); break;
    case 'CHOICE': rChoice(L); break;
    case 'SHOP': rShop(L); break;
    case 'GAME_OVER': rEnd(L, false); break;
    case 'VICTORY': rEnd(L, true); break;
  }
  // Clear screen + cursor home + content — works on all terminals
  write('\x1b[2J\x1b[H' + L.map(l => l + EL).join('\n') + '\n' + ED);
}

// ─── IDLE ───
function rIdle(L) {
  L.push('');
  L.push('');
  L.push(`${fg.Y}${B}          🍪  C O O K I E L I K E${R}`);
  L.push('');
  L.push(`${fg.gr}         Cookie Roguelike — Production${R}`);
  L.push(`${fg.gr}               Seed: ${seed}${R}`);
  L.push('');
  L.push('');
  L.push(`${fg.W}           [ ENTRÉE pour commencer ]${R}`);
  L.push('');
  L.push(`${fg.gr}                 [Q] Quitter${R}`);
}

// ─── PREVIEW ───
function rPreview(L) {
  const run = game.getState().run;
  if (!run) return;

  // Round 1: deck editor
  if (run.round === 1 && ui.deckEditing) {
    rDeckEditor(L, run);
    return;
  }

  const quota = getQuota(run.round);
  const paste = getPasteForRound(run.round, run.paste.bonusPerm, 0);
  const cost = computePullCost(run);
  const pulls = Math.floor(paste / cost);

  L.push(dsep());
  L.push(`${fg.C}${B}  ROUND ${run.round}/${BALANCE.ROUNDS_PER_RUN} — APERÇU${R}`);
  L.push(dsep());
  L.push('');
  L.push(`  ${B}🎯 Quota :${R}  ${fg.Y}${quota}🪙${R}`);
  L.push(`  ${B}🧈 Pâte :${R}   ${paste}  ${fg.gr}(pull: ${cost}🧈 → ~${pulls} boîtes)${R}`);
  L.push(`  ${B}⏱  Timer :${R}  ${BALANCE.ROUND_DURATION_SEC}s`);
  L.push('');
  L.push(`  ${B}Pool :${R}  ${poolLine(run.machine.pool)}`);
  L.push(`  ${B}Fours :${R} ${run.ovens.map(o => `${OVEN_EMOJI[o.typeId] || '?'} ${o.typeId}`).join('  ')}`);

  if (run.cookingUpgrades.length > 0)
    L.push(`  ${B}Upgrades :${R} ${run.cookingUpgrades.join(', ')}`);
  if (run.toppings.length > 0) {
    const tStr = run.toppings.map(t => {
      const def = getTopping(t.toppingId);
      return `${def.emoji} ${def.name} x${t.charges}`;
    }).join(', ');
    L.push(`  ${B}Toppings :${R} ${tStr}`);
  }

  L.push('');
  L.push(sep());
  L.push(`  ${fg.W}[ ENTRÉE pour lancer le round ]${R}`);
}

// ─── DECK EDITOR (Round 1) ───
function rDeckEditor(L, run) {
  L.push(dsep());
  L.push(`${fg.Y}${B}  CHOISIS TON DECK DE DÉPART${R}`);
  L.push(dsep());
  L.push('');

  for (let i = 0; i < ui.deckAvailable.length; i++) {
    const r = ui.deckAvailable[i];
    const sel = ui.deckSelected.has(r.id);
    const cur = i === ui.deckCursor ? `${fg.Y}${B}▸${R}` : ' ';
    const chk = sel ? `${fg.G}${B}✓${R}` : `${fg.gr}○${R}`;
    const hl = i === ui.deckCursor ? B : '';
    L.push(`  ${cur} ${chk} ${hl}${r.emoji} ${r.name.padEnd(14)}${R}  val: ${fg.W}${r.baseValue}${R}  coût: ${fg.Y}${r.pasteCost}🧈${R}`);
  }

  const cost = ui.deckSelected.size > 0
    ? Math.ceil([...ui.deckSelected].reduce((s, id) => s + getRecipe(id).pasteCost, 0) / ui.deckSelected.size * BALANCE.BOX_SIZE)
    : 0;

  L.push('');
  L.push(`  Sélectionnés: ${fg.W}${B}${ui.deckSelected.size}${R}  ${fg.gr}(exactement ${BALANCE.DECK_SIZE})${R}    Pull estimé: ${fg.Y}${cost}🧈${R}`);
  L.push('');
  L.push(sep());
  L.push(`  ${fg.W}[↑↓]${R} Naviguer  ${fg.W}[ESPACE]${R} Toggle  ${fg.W}[ENTRÉE]${R} Confirmer`);
}

// ─── PRODUCTION ───
function rProd(L) {
  const run = game.getState().run;
  if (!run) return;
  const timer = run.timer.remaining;
  const timerC = timer < 10 ? (ui.tick % 2 === 0 ? fg.R + B : fg.Y + B) : timer < 20 ? fg.Y : fg.W;
  const feverActive = run.fever?.active;

  // Header
  if (feverActive) {
    const fc = ui.tick % 2 === 0 ? fg.R : fg.Y;
    L.push(`${fc}${B} 🔥 FEVER  Round ${run.round}/${BALANCE.ROUNDS_PER_RUN}${R}                         ${timerC}⏱  ${timer.toFixed(1)}s${R}`);
  } else {
    L.push(`${fg.C}${B} Round ${run.round}/${BALANCE.ROUNDS_PER_RUN}${R}                                  ${timerC}⏱  ${timer.toFixed(1)}s${R}`);
  }
  L.push(sep());

  // Pool
  L.push(` ${DIM}Pool${R}  ${poolLine(run.machine.pool)}`);

  // Paste
  const maxPaste = getPasteForRound(run.round, run.paste.bonusPerm, run.paste.bonusTemp);
  const cost = computePullCost(run);
  L.push(` ${DIM}Pâte${R}  ${pbar(run.paste.current, maxPaste, 22, fg.Y)}  ${fg.W}${run.paste.current}${R}/${maxPaste}  ${fg.gr}pull: ${cost}🧈${R}`);
  L.push(sep());

  // Ovens with chain cooking display
  for (let i = 0; i < run.ovens.length; i++) {
    const oven = run.ovens[i];
    const emoji = OVEN_EMOJI[oven.typeId] || '?';
    const name = oven.typeId.padEnd(9);

    if (!oven.box) {
      L.push(` ${fg.W}[${i + 1}]${R} ${emoji} ${fg.gr}${name}${R}  ${fg.gr}── vide ──${R}`);
    } else {
      const total = run.boxSize * BALANCE.BOX_WIDTH;

      if (oven.cookieIndex >= total) {
        L.push(` ${fg.G}[${i + 1}]${R} ${emoji} ${name}  ${fg.G}${B}✅ Boîte complète${R}`);
      } else {
        // Current cookie info
        const col = Math.floor(oven.cookieIndex / run.boxSize);
        const row = oven.cookieIndex % run.boxSize;
        const curCookie = oven.box.grid[col]?.[row];
        const curEmoji = curCookie ? getRecipe(curCookie.recipeId).emoji : '?';
        const p = Math.min(1, oven.progress);
        const [zn, zc] = zoneOf(p);
        const pct = String(Math.round(p * 100)).padStart(3);

        L.push(` ${fg.W}${B}[${i + 1}]${R} ${emoji} ${name}  Cookie ${oven.cookieIndex + 1}/${total}  ${curEmoji}`);
        L.push(`     ${ovenBar(p)}  ${pct}%  ${zc}${B}${zn}${R}`);

        // 4×5 grid display — rows top to bottom, cols left to right
        for (let r = 0; r < run.boxSize; r++) {
          let rowStr = '     ';
          for (let c = 0; c < BALANCE.BOX_WIDTH; c++) {
            const idx = c * run.boxSize + r;
            const cookie = oven.box.grid[c][r];
            const recipe = getRecipe(cookie.recipeId);

            if (idx < oven.cookieIndex) {
              // Already cooked — show emoji colored by zone
              const zkC = cookie.cookingZone === 'PERFECT' || cookie.cookingZone === 'SWEET_SPOT' ? fg.G :
                          cookie.cookingZone === 'BURNED' ? fg.R :
                          cookie.cookingZone === 'RAW' ? fg.b : fg.y;
              rowStr += `${zkC}${recipe.emoji}${R} `;
            } else if (idx === oven.cookieIndex) {
              // Currently cooking — blink
              const blink = ui.tick % 3 === 0 ? fg.Y + B : fg.W;
              rowStr += `${blink}${recipe.emoji}${R} `;
            } else {
              // Pending
              rowStr += `${fg.gr}${DIM}${recipe.emoji}${R} `;
            }
          }
          L.push(rowStr);
        }
      }
    }
  }
  L.push(sep());

  // Benne + Quota
  const benneVal = run.benne.boxes.reduce((s, b) => s + (b.value || 0), 0);
  const quota = getQuota(run.round);
  const qRatio = quota > 0 ? benneVal / quota : 0;
  const qc = qRatio >= 1 ? fg.G : qRatio >= 0.6 ? fg.Y : fg.W;
  L.push(` 🚛 Benne ${run.benne.boxes.length}/${run.benne.capacity}    ${qc}${B}${benneVal}${R}/${quota}🪙  ${pbar(benneVal, quota, 20, qRatio >= 1 ? fg.G : fg.Y)}`);

  // Fever / Streak
  if (feverActive) {
    L.push(` ${fg.R}${B}🔥 FEVER${R}  ${pbar(run.fever.remaining, BALANCE.FEVER_DURATION_SEC, 18, fg.R)}  ${fg.R}${run.fever.remaining.toFixed(1)}s${R}  ${fg.Y}x${BALANCE.FEVER_MULTIPLIER}${R}`);
  } else if (run.rhythmStreak > 0) {
    const toFever = BALANCE.FEVER_THRESHOLD - run.rhythmStreak;
    const feverInfo = toFever > 0 ? `  ${fg.gr}(fever dans ${toFever})${R}` : '';
    L.push(` 🥁 Streak: ${fg.M}${B}${run.rhythmStreak}${R}${feverInfo}`);
  } else {
    L.push(` 🥁 Streak: 0`);
  }

  // Toppings
  const availToppings = run.toppings.filter(t => t.charges > 0);
  if (availToppings.length > 0) {
    const armed = run.armedTopping;
    for (const t of availToppings) {
      const def = getTopping(t.toppingId);
      const isArmed = t.toppingId === armed;
      const marker = isArmed ? `${fg.G}${B}▸${R}` : ' ';
      const armedTag = isArmed ? `  ${fg.G}${B}[ARMÉ]${R}` : '';
      L.push(` ${marker} ${def.emoji} ${def.name} (${t.charges})  ${fg.gr}${def.description}${R}${armedTag}`);
    }
  }

  L.push(sep());

  // Messages
  const msgs = ui.msgs.slice(-4);
  for (const m of msgs) L.push(m);
  for (let i = msgs.length; i < 4; i++) L.push('');

  L.push(sep());
  L.push(` ${fg.W}[P]${R} Pull  ${fg.W}[1-3]${R} Extraire  ${fg.W}[T]${R} Topping  ${fg.W}[E]${R} Fin round  ${fg.W}[Q]${R} Quit`);
}

// ─── RESULTS ───
function rResults(L) {
  const run = game.getState().run;
  if (!run?.lastRoundResult) return;
  const res = run.lastRoundResult;

  L.push(dsep());
  L.push(`${fg.C}${B}  ROUND ${res.round} — RÉSULTATS${R}`);
  L.push(dsep());
  L.push('');

  for (const box of res.boxes) {
    const bg = box.gridResult?.bestGroup;
    const groupInfo = bg ? `${getRecipe(bg.recipeId).emoji}×${bg.size} ${bg.name} x${bg.multiplier}` : '-';
    const nGroups = box.gridResult?.groups?.length ?? 0;
    const val = box.value || 0;
    L.push(`  📦 ${fg.W}${groupInfo}${R}  ${fg.gr}(${nGroups} groupes)${R}  ${fg.Y}${B}${val}🪙${R}`);
  }

  L.push('');
  L.push(`  ${B}💰 Total :${R}  ${fg.Y}${B}${res.totalValue}🪙${R}`);
  L.push(`  ${B}🎯 Quota :${R}  ${res.quota}🪙`);
  L.push('');

  if (res.passed) {
    L.push(`  ${fg.G}${B}✅ QUOTA ATTEINT !${R}`);
    L.push(`  ${fg.gr}Surplus: ${res.surplus}🪙 → +${res.shopCoins}💵${R}`);
    L.push('');
    L.push(sep());
    L.push(`  ${fg.W}[ ENTRÉE pour continuer ]${R}`);
  } else {
    L.push(`  ${fg.R}${B}❌ QUOTA RATÉ${R}`);
  }
}

// ─── CHOICE ───
function rChoice(L) {
  const run = game.getState().run;
  if (!run) return;

  if (ui.selecting) {
    rTargetSelect(L, run);
    return;
  }

  const choices = run.currentChoices;
  L.push(dsep());
  L.push(`${fg.C}${B}  CHOIX — 1 parmi ${choices.length}${R}`);
  L.push(dsep());
  L.push('');

  const archColors = { SKILLED: fg.G, STRAT: fg.C, GAMBLER: fg.M, NEUTRAL: fg.gr };

  for (let i = 0; i < choices.length; i++) {
    const ch = choices[i];
    const cur = i === ui.cursor ? `${fg.Y}${B}▸${R}` : ' ';
    const ac = archColors[ch.archetype] || fg.W;
    const hl = i === ui.cursor ? B : '';
    L.push(`  ${cur} ${fg.W}[${i + 1}]${R} ${hl}${ch.name}${R}  ${ac}${ch.archetype}${R}`);
    L.push(`        ${fg.gr}${ch.description}${R}`);
    if (ch.needsTarget) L.push(`        ${fg.y}⚠ Nécessite une cible${R}`);
    L.push('');
  }

  L.push(sep());
  L.push(`  ${fg.W}[1-3]${R} ou ${fg.W}[↑↓]+ENTRÉE${R} pour choisir`);
}

// ─── SHOP ───
function rShop(L) {
  const run = game.getState().run;
  if (!run) return;

  if (ui.selecting) {
    rTargetSelect(L, run);
    return;
  }

  const offerings = run.shopOfferings || [];
  const rerollCost = BALANCE.SHOP_REROLL_BASE + run.rerollCount * BALANCE.SHOP_REROLL_INCREMENT;

  L.push(dsep());
  L.push(`${fg.C}${B}  ATELIER — Round ${run.round} — ${run.shopCurrency}💵${R}`);
  L.push(dsep());
  L.push('');

  // Artifact offerings
  if (offerings.length > 0) {
    L.push(`  ${B}EN VENTE :${R}`);
    for (let i = 0; i < offerings.length; i++) {
      const o = offerings[i];
      const cur = i === ui.cursor ? `${fg.Y}${B}▸${R}` : ' ';
      const afford = run.shopCurrency >= o.finalCost;
      const st = afford ? `${fg.G}✓${R}` : `${fg.r}✗${R}`;
      const rc = { common: fg.gr, uncommon: fg.c, rare: fg.Y, legendary: fg.M }[o.rarity] || fg.W;
      L.push(`  ${cur} ${o.emoji} ${B}${o.name}${R}  ${rc}★${o.rarity}${R}  ${o.finalCost}💵 ${st}`);
      L.push(`       ${fg.gr}${o.description}${R}`);
    }
  } else {
    L.push(`  ${fg.gr}Aucun artefact disponible${R}`);
  }

  // Fixed actions + reroll
  const actIdx = offerings.length;
  L.push('');
  L.push(`  ${B}ACTIONS :${R}`);
  const acts = [
    { id: 'remove_copy', name: '🗑  Retirer copie', cost: 30, target: true },
    { id: 'duplicate_copy', name: '📋 Dupliquer copie', cost: 50, target: true },
    { id: 'reroll', name: '🔄 Reroll shop', cost: rerollCost, target: false },
  ];
  for (let i = 0; i < acts.length; i++) {
    const a = acts[i];
    const cur = (actIdx + i) === ui.cursor ? `${fg.Y}${B}▸${R}` : ' ';
    const afford = run.shopCurrency >= a.cost;
    const st = afford ? `${fg.G}✓${R}` : `${fg.r}✗${R}`;
    L.push(`  ${cur} ${a.name}  ${a.cost}💵 ${st}`);
  }

  // Owned artifacts
  if (run.artifacts.length > 0) {
    L.push('');
    L.push(`  ${B}ARTEFACTS (${run.artifacts.length}) :${R}`);
    const artLine = run.artifacts.map(a => `${a.emoji}`).join(' ');
    L.push(`  ${artLine}`);
  }

  L.push('');
  L.push(`  ${DIM}Pool: ${poolLine(run.machine.pool)}${R}`);

  for (const m of ui.msgs.slice(-2)) L.push(m);

  L.push('');
  L.push(sep());
  L.push(`  ${fg.W}[↑↓]${R} Nav  ${fg.W}[ENTRÉE]${R} Acheter  ${fg.W}[D/ESC]${R} Terminé`);
}

// ─── TARGET SELECT (sub-menu) ───
function rTargetSelect(L, run) {
  const pool = run.machine.pool;

  L.push(dsep());
  L.push(`${fg.Y}${B}  Sélectionner une recette${R}`);
  L.push(dsep());
  L.push('');

  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    const r = getRecipe(e.recipeId);
    const cur = i === ui.targetCursor ? `${fg.Y}${B}▸${R}` : ' ';
    const hl = i === ui.targetCursor ? B : '';
    L.push(`  ${cur} ${hl}${r.emoji} ${r.name.padEnd(14)}${R}  x${e.weight}  ${fg.gr}val: ${r.baseValue}${R}`);
  }

  L.push('');
  L.push(sep());
  L.push(`  ${fg.W}[↑↓]${R} Naviguer  ${fg.W}[ENTRÉE]${R} Confirmer  ${fg.W}[ESC]${R} Retour`);
}

// ─── GAME OVER / VICTORY ───
function rEnd(L, won) {
  const run = game.getState().run;
  const meta = game.getMeta();
  const res = run?.lastRoundResult;

  L.push('');
  L.push(dsep());
  L.push(won
    ? `${fg.Y}${B}  🏆  V I C T O I R E  🏆${R}`
    : `${fg.R}${B}  💀  G A M E   O V E R  💀${R}`);
  L.push(dsep());
  L.push('');
  L.push(`  Round atteint :  ${run?.round ?? '?'} / ${BALANCE.ROUNDS_PER_RUN}`);
  L.push(`  Score total :    ${fg.Y}${B}${run?.score ?? 0}🪙${R}`);

  if (!won && res) {
    L.push('');
    L.push(`  ${fg.R}${B}❌ Quota manqué :${R}  ${res.totalValue}🪙 / ${res.quota}🪙`);
    const pct = res.quota > 0 ? ((res.totalValue / res.quota) * 100).toFixed(0) : 0;
    L.push(`  ${fg.R}  Atteint ${pct}% du quota${R}`);
  }

  L.push('');
  L.push(`  Étoiles :        ${fg.Y}+${meta.totalStars}⭐${R}`);
  L.push(`  Meilleur round : ${meta.bestRound}`);
  L.push(`  Runs complétés : ${meta.runsCompleted}`);

  if (run?.artifacts?.length > 0) {
    L.push('');
    L.push(`  Artefacts : ${run.artifacts.map(a => a.emoji).join(' ')}`);
  }

  L.push('');
  L.push(sep());
  L.push(`  ${fg.W}[ENTRÉE]${R} Nouveau run    ${fg.W}[Q]${R} Quitter`);
}

// ═══════════════════════════════════════════════════════════
//  Input Handler
// ═══════════════════════════════════════════════════════════
function handleInput(str, key) {
  if (!key) return;
  if (key.ctrl && key.name === 'c') { cleanup(); process.exit(); }

  const phase = game.getPhase();

  // Q quits (except during target selection where it might conflict)
  if (key.name === 'q' && !ui.selecting) { cleanup(); process.exit(); }

  switch (phase) {
    case 'IDLE': inputIdle(key); break;
    case 'PREVIEW': inputPreview(key); break;
    case 'PRODUCTION': inputProd(str, key); break;
    case 'RESULTS': inputResults(key); break;
    case 'CHOICE': inputChoice(str, key); break;
    case 'SHOP': inputShop(str, key); break;
    case 'GAME_OVER':
    case 'VICTORY': inputEnd(key); break;
  }
}

function inputIdle(key) {
  if (key.name === 'return') game.startRun();
}

function inputPreview(key) {
  const run = game.getState().run;

  // Deck editor for round 1
  if (run && run.round === 1 && ui.deckEditing) {
    if (key.name === 'up') ui.deckCursor = Math.max(0, ui.deckCursor - 1);
    else if (key.name === 'down') ui.deckCursor = Math.min(ui.deckAvailable.length - 1, ui.deckCursor + 1);
    else if (key.name === 'space') {
      const recipe = ui.deckAvailable[ui.deckCursor];
      if (ui.deckSelected.has(recipe.id)) {
        if (ui.deckSelected.size > 2) ui.deckSelected.delete(recipe.id);
      } else {
        if (ui.deckSelected.size < BALANCE.DECK_SIZE) ui.deckSelected.add(recipe.id);
      }
    }
    else if (key.name === 'return' && ui.deckSelected.size === BALANCE.DECK_SIZE) {
      run.machine.pool = [...ui.deckSelected].map(id => ({ recipeId: id, weight: 1 }));
      ui.deckEditing = false;
    }
    render();
    return;
  }

  if (key.name === 'return') {
    ui.msgs = [];
    game.startRound();
  }
}

function inputProd(str, key) {
  if (str === 'p' || key.name === 'space') { game.pullLever(); render(); }
  else if (str === '1') { game.extractFromOven(0); render(); }
  else if (str === '2') { game.extractFromOven(1); render(); }
  else if (str === '3') { game.extractFromOven(2); render(); }
  else if (str === 't') {
    const run = game.getState().run;
    const avail = run.toppings.find(t => t.charges > 0);
    if (avail) game.armTopping(avail.toppingId);
    else msg(` ${fg.r}❌ Aucun topping disponible${R}`);
    render();
  }
  else if (str === 'e') { game.endRoundEarly(); }
}

function inputResults(key) {
  if (key.name === 'return') {
    ui.msgs = [];
    game.continueFromResults();
  }
}

function inputChoice(str, key) {
  const run = game.getState().run;
  const choices = run.currentChoices;

  if (ui.selecting) {
    const pool = run.machine.pool;
    if (key.name === 'up') ui.targetCursor = Math.max(0, ui.targetCursor - 1);
    else if (key.name === 'down') ui.targetCursor = Math.min(pool.length - 1, ui.targetCursor + 1);
    else if (key.name === 'return' && pool.length > 0) {
      const target = pool[ui.targetCursor]?.recipeId;
      game.makeChoice(ui.pending, target);
      ui.selecting = false;
    }
    else if (key.name === 'escape') ui.selecting = false;
    render();
    return;
  }

  // Direct number
  const num = parseInt(str);
  if (num >= 1 && num <= choices.length) {
    tryChoice(num - 1, choices);
    return;
  }

  if (key.name === 'up') ui.cursor = Math.max(0, ui.cursor - 1);
  else if (key.name === 'down') ui.cursor = Math.min(choices.length - 1, ui.cursor + 1);
  else if (key.name === 'return') { tryChoice(ui.cursor, choices); return; }
  render();
}

function tryChoice(idx, choices) {
  const ch = choices[idx];
  if (!ch) return;
  if (ch.needsTarget) {
    ui.selecting = true;
    ui.targetCursor = 0;
    ui.pending = idx;
    render();
  } else {
    game.makeChoice(idx);
  }
}

function inputShop(str, key) {
  const run = game.getState().run;
  const offerings = run.shopOfferings || [];
  const totalItems = offerings.length + 3; // 3 fixed actions

  if (ui.selecting) {
    const pool = run.machine.pool;
    if (key.name === 'up') ui.targetCursor = Math.max(0, ui.targetCursor - 1);
    else if (key.name === 'down') ui.targetCursor = Math.min(pool.length - 1, ui.targetCursor + 1);
    else if (key.name === 'return' && pool.length > 0) {
      const target = pool[ui.targetCursor]?.recipeId;
      game.shopBuy(ui.pending, target);
      ui.selecting = false;
    }
    else if (key.name === 'escape') ui.selecting = false;
    render();
    return;
  }

  if (str === 'd' || key.name === 'escape') {
    ui.msgs = [];
    game.endShop();
    return;
  }

  if (key.name === 'up') ui.cursor = Math.max(0, ui.cursor - 1);
  else if (key.name === 'down') ui.cursor = Math.min(totalItems - 1, ui.cursor + 1);
  else if (key.name === 'return') {
    if (ui.cursor < offerings.length) {
      // Buy artifact
      game.shopBuyArtifact(ui.cursor);
      if (ui.cursor >= (run.shopOfferings?.length || 0)) ui.cursor = Math.max(0, ui.cursor - 1);
    } else {
      const actIdx = ui.cursor - offerings.length;
      if (actIdx === 0) { // remove_copy
        ui.selecting = true; ui.targetCursor = 0; ui.pending = 'remove_copy';
      } else if (actIdx === 1) { // duplicate_copy
        ui.selecting = true; ui.targetCursor = 0; ui.pending = 'duplicate_copy';
      } else if (actIdx === 2) { // reroll
        game.shopReroll();
      }
    }
  }
  render();
}

function inputEnd(key) {
  if (key.name === 'return') game.startRun();
}

// ═══════════════════════════════════════════════════════════
//  Game Loop
// ═══════════════════════════════════════════════════════════
let interval = null;
const TICK = 100;

function startLoop() {
  if (interval) return;
  interval = setInterval(() => {
    game.update(TICK);
    ui.tick++;
    render();
  }, TICK);
}

function stopLoop() {
  if (interval) { clearInterval(interval); interval = null; }
}

game.on('phase:changed', ({ phase }) => {
  ui.cursor = 0;
  ui.selecting = false;
  ui.targetCursor = 0;

  // Init deck editor for round 1
  if (phase === 'PREVIEW') {
    const run = game.getState().run;
    if (run && run.round === 1) {
      const meta = game.getMeta();
      ui.deckAvailable = RECIPES.filter(r => r.startsUnlocked && !r.isWild);
      // Add meta-unlocked recipes
      for (const r of RECIPES) {
        if (!r.startsUnlocked && !r.isWild && meta.unlocks.includes(`unlock_${r.id}`)) {
          if (!ui.deckAvailable.find(a => a.id === r.id)) ui.deckAvailable.push(r);
        }
      }
      ui.deckSelected = new Set(run.machine.pool.map(e => e.recipeId));
      ui.deckEditing = true;
      ui.deckCursor = 0;
    } else {
      ui.deckEditing = false;
    }
  }

  if (phase === 'PRODUCTION') {
    startLoop();
  } else {
    stopLoop();
    render();
  }
});

// ═══════════════════════════════════════════════════════════
//  Cleanup & Start
// ═══════════════════════════════════════════════════════════
function cleanup() {
  stopLoop();
  write(SHOW + R + '\x1b[2J\x1b[H\x1b[?1049l');
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(); });
process.on('SIGTERM', () => { cleanup(); process.exit(); });
process.on('uncaughtException', (err) => {
  cleanup();
  console.error(err);
  process.exit(1);
});

// Terminal setup
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('keypress', (str, key) => handleInput(str || '', key || {}));

// Go
write('\x1b[?1049h' + HIDE + '\x1b[2J');
render();
