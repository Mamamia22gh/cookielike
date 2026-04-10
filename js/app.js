import { createGame, BALANCE, RECIPES, getRecipe, getQuota, getPasteForRound, TOPPINGS } from '../src/index.js';
import { RECIPE_MAP } from '../src/data/recipes.js';

// ═══════════════════════════════════════
//  Constants
// ═══════════════════════════════════════
const TICK = 100;
const OVEN_EMOJI = { classic: '🔥', turbo: '⚡', magic: '✨', cryo: '🧊', chaos: '🌀' };
const ZONE_CLASS = { RAW: 'raw', COOKED: 'cuit', PERFECT: 'perfect', SWEET_SPOT: 'sweet', BURNED: 'burned' };

// ═══════════════════════════════════════
//  State
// ═══════════════════════════════════════
let game = null;
let interval = null;
const msgs = [];
let deckSelected = new Set();
let targetCallback = null;

const $ = s => document.getElementById(s);
const q = s => document.querySelector(s);
const qa = s => document.querySelectorAll(s);

// ═══════════════════════════════════════
//  Init
// ═══════════════════════════════════════
function init() {
  game = createGame({ seed: Date.now() });
  bindUI();
  bindGame();
  document.addEventListener('keydown', handleKey);
}

function bindUI() {
  $('btn-start').onclick = () => game.startRun();
  $('btn-start-round').onclick = () => startRound();
  $('btn-poll-reroll').onclick = () => { game.pollReroll(); renderPoll(); };
  $('btn-poll-confirm').onclick = () => game.pollConfirm();
  $('btn-pull').onclick = () => game.pullLever();
  $('btn-end').onclick = () => game.endRoundEarly();
  $('btn-continue').onclick = () => { game.continueFromResults(); };
  $('btn-done-shop').onclick = () => game.endShop();
  $('btn-restart').onclick = () => game.startRun();
  $('btn-restart-v').onclick = () => game.startRun();
}

function bindGame() {
  game.on('phase:changed', ({ phase }) => {
    if (phase === 'PRODUCTION') startLoop(); else stopLoop();
    showScreen(phase);
    renderPhase(phase);
  });

  game.on('box:created', d => addMsg(`📦 Boîte créée — pâte -${d.pasteCost}`));
  game.on('box:scored', d => {
    const bg = d.box.comboResult;
    const info = bg ? `${bg.name} x${bg.multiplier}` : '';
    addMsg(`✅ ${d.value}🪙 ${info}`);
  });
  game.on('oven:cookie_burned', () => addMsg('🔥 Cookie brûlé !'));
  game.on('machine:no_paste', d => addMsg(`❌ Pâte insuffisante (${d.required})`));
  game.on('machine:no_oven', () => addMsg('❌ Fours occupés'));
  game.on('benne:full', () => addMsg('❌ Benne pleine'));
  game.on('fever:started', () => addMsg('🔥🔥 FEVER MODE ! 🔥🔥'));
  game.on('fever:ended', () => addMsg('Fever terminé'));
  game.on('shop:artifact_bought', d => addMsg(`🎁 ${d.artifact.emoji} ${d.artifact.name}`));
  game.on('shop:insufficient_funds', () => addMsg('❌ Fonds insuffisants'));
  game.on('error', d => addMsg(`⛔ ${d.message}`));
}

// ═══════════════════════════════════════
//  Screen management
// ═══════════════════════════════════════
function showScreen(phase) {
  qa('.screen').forEach(s => s.classList.remove('active'));
  const id = `screen-${phase.toLowerCase()}`;
  const el = $(id);
  if (el) el.classList.add('active');
}

// ═══════════════════════════════════════
//  Phase renderers
// ═══════════════════════════════════════
function renderPhase(phase) {
  switch (phase) {
    case 'PREVIEW': renderPreview(); break;
    case 'POLL': renderPoll(); break;
    case 'PRODUCTION': renderProductionInit(); break;
    case 'RESULTS': renderResults(); break;
    case 'CHOICE': renderChoice(); break;
    case 'SHOP': renderShop(); break;
    case 'GAME_OVER': renderGameOver(); break;
    case 'VICTORY': renderVictory(); break;
  }
}

// ─── Preview ───
function renderPreview() {
  const run = game.getState().run;
  if (!run) return;
  $('pv-round').textContent = run.round;
  $('pv-quota').textContent = getQuota(run.round) + '🪙';
  $('pv-paste').textContent = getPasteForRound(run.round, run.paste.bonusPerm, 0);
  $('pv-timer').textContent = BALANCE.ROUND_DURATION_SEC + 's';
  $('pv-ovens').textContent = run.ovens.map(o => `${OVEN_EMOJI[o.typeId]} ${o.typeId}`).join('  ');
  renderPoolPills($('pv-pool'), run.machine.pool);

  // Deck editor for round 1
  const ed = $('pv-deck-editor');
  if (run.round === 1) {
    const avail = RECIPES.filter(r => r.startsUnlocked && !r.isWild);
    deckSelected = new Set(run.machine.pool.map(e => e.recipeId));
    ed.innerHTML = '<h3>Deck de départ</h3><div class="deck-grid" id="deck-grid"></div><p class="deck-count">Sélectionnés: <span id="deck-n">0</span>/' + BALANCE.DECK_SIZE + '</p>';
    const grid = $('deck-grid');
    for (const r of avail) {
      const card = document.createElement('div');
      card.className = 'deck-card' + (deckSelected.has(r.id) ? ' selected' : '');
      card.innerHTML = `<span class="emoji">${r.emoji}</span><span class="name">${r.name}</span>`;
      card.onclick = () => {
        if (deckSelected.has(r.id)) { if (deckSelected.size > 2) deckSelected.delete(r.id); }
        else if (deckSelected.size < BALANCE.DECK_SIZE) deckSelected.add(r.id);
        card.classList.toggle('selected', deckSelected.has(r.id));
        $('deck-n').textContent = deckSelected.size;
        $('btn-start-round').disabled = deckSelected.size !== BALANCE.DECK_SIZE;
      };
      grid.appendChild(card);
    }
    $('deck-n').textContent = deckSelected.size;
    $('btn-start-round').disabled = deckSelected.size !== BALANCE.DECK_SIZE;
    ed.classList.remove('hidden');
  } else {
    ed.innerHTML = '';
  }
}

function startRound() {
  const run = game.getState().run;
  if (run && run.round === 1 && deckSelected.size === BALANCE.DECK_SIZE) {
    run.machine.pool = [...deckSelected].map(id => ({ recipeId: id, weight: 1 }));
  }
  msgs.length = 0;
  game.startRound();
}

// ─── Poll ───
function renderPoll() {
  const run = game.getState().run;
  if (!run || !run.poll) return;

  const grid = $('poll-recipes');
  grid.innerHTML = '';
  for (const recipeId of run.poll.recipes) {
    const r = getRecipe(recipeId);
    const card = document.createElement('div');
    card.className = `poll-card rarity-border-${r.rarity}`;
    card.innerHTML = `<span class="poll-emoji">${r.emoji}</span><span class="poll-name">${r.name}</span><span class="rarity rarity-${r.rarity}">${r.rarity}</span>`;
    grid.appendChild(card);
  }

  const rerollEl = $('poll-rerolls');
  const left = run.poll.rerollsLeft;
  rerollEl.innerHTML = '🔄 '.repeat(left) + '<span class="dim">' + '·  '.repeat(BALANCE.POLL_REROLLS_PER_ROUND - left) + '</span>';

  const btn = $('btn-poll-reroll');
  btn.disabled = left <= 0;
  btn.textContent = left > 0 ? `🔄 Reroll (${left})` : '🔄 Épuisé';
}

// ─── Production init (once per round) ───
function renderProductionInit() {
  const run = game.getState().run;
  if (!run) return;
  // Create oven cards
  const container = $('pr-ovens');
  container.innerHTML = '';
  for (let i = 0; i < run.ovens.length; i++) {
    const oven = run.ovens[i];
    const card = document.createElement('div');
    card.className = 'card oven-card';
    card.id = `oven-card-${i}`;
    card.innerHTML = `
      <div class="oven-header">
        <span>${OVEN_EMOJI[oven.typeId] || '?'} ${oven.typeId}</span>
        <span class="oven-status" id="oven-status-${i}">vide</span>
      </div>
      <div id="oven-body-${i}"></div>
    `;
    container.appendChild(card);
  }
  renderProduction();
}

// ─── Production update (every tick) ───
function renderProduction() {
  const run = game.getState().run;
  if (!run) return;

  // Header
  $('pr-round').textContent = `Round ${run.round}/${BALANCE.ROUNDS_PER_RUN}`;
  const t = run.timer.remaining;
  const timerEl = $('pr-timer');
  timerEl.textContent = `⏱ ${t.toFixed(1)}s`;
  timerEl.className = 'timer-display' + (t < 10 ? ' timer-crit' : t < 30 ? ' timer-warn' : '');

  // Fever
  const feverBadge = $('pr-fever');
  feverBadge.classList.toggle('hidden', !run.fever?.active);

  // Pool
  renderPoolPills($('pr-pool'), run.machine.pool);

  // Paste
  const maxPaste = getPasteForRound(run.round, run.paste.bonusPerm, run.paste.bonusTemp);
  $('pr-paste-fill').style.width = (maxPaste > 0 ? run.paste.current / maxPaste * 100 : 0) + '%';
  $('pr-paste-text').textContent = `${run.paste.current}/${maxPaste}`;

  // Ovens
  for (let i = 0; i < run.ovens.length; i++) {
    renderOven(run, i);
  }

  // Benne
  const benneVal = run.benne.boxes.reduce((s, b) => s + (b.value || 0), 0);
  const quota = getQuota(run.round);
  $('pr-benne-n').textContent = run.benne.boxes.length;
  $('pr-benne-cap').textContent = run.benne.capacity;
  $('pr-quota-text').textContent = `${benneVal}/${quota}🪙`;
  $('pr-quota-fill').style.width = Math.min(100, quota > 0 ? benneVal / quota * 100 : 0) + '%';
  $('pr-quota-fill').className = 'bar-fill ' + (benneVal >= quota ? 'green-bg' : 'gold-bg');

  // Streak
  const streak = run.rhythmStreak;
  const toFever = BALANCE.FEVER_THRESHOLD - streak;
  $('pr-streak').textContent = run.fever?.active
    ? `🔥 FEVER ${run.fever.remaining.toFixed(1)}s — x${BALANCE.FEVER_MULTIPLIER}`
    : `🥁 Streak: ${streak}${toFever > 0 && streak > 0 ? ` (fever dans ${toFever})` : ''}`;

  // Messages
  renderMessages();
}

function renderOven(run, i) {
  const oven = run.ovens[i];
  const statusEl = $(`oven-status-${i}`);
  const bodyEl = $(`oven-body-${i}`);

  if (!oven.box) {
    statusEl.textContent = 'vide';
    bodyEl.innerHTML = '<div class="oven-empty">── vide ──</div>';
    return;
  }

  const total = run.boxSize * BALANCE.BOX_WIDTH;
  const ci = oven.cookieIndex;
  const p = Math.min(1, oven.progress);

  statusEl.textContent = `Cookie ${Math.min(ci + 1, total)}/${total}`;

  // Zone for current cookie — drives the glow
  let zoneLabel = '', zoneClass = '';
  if (ci < total) {
    if (p < 0.30) { zoneLabel = 'CRU'; zoneClass = 'zone-raw'; }
    else if (p < 0.70) { zoneLabel = 'CUIT'; zoneClass = 'zone-cuit'; }
    else if (p < 0.85) { zoneLabel = 'PARFAIT'; zoneClass = 'zone-perfect'; }
    else { zoneLabel = 'BRÛLÉ'; zoneClass = 'zone-burned'; }
  }

  let html = '<div class="cookie-grid">';

  // Grid: iterate row-first for display, but data is col-first
  for (let row = 0; row < run.boxSize; row++) {
    for (let col = 0; col < BALANCE.BOX_WIDTH; col++) {
      const idx = col * run.boxSize + row;
      const cookie = oven.box.grid[col][row];
      const recipe = getRecipe(cookie.recipeId);

      let cls = 'cookie-cell';
      let content = '';

      if (idx < ci) {
        // Done — residual glow by zone
        const zc = ZONE_CLASS[cookie.cookingZone] || 'cuit';
        cls += ` cell-${zc}`;
        content = recipe.emoji;
      } else if (idx === ci) {
        // Currently cooking — GLOW changes color
        let cookZone = 'cook-raw';
        if (p >= 0.85) cookZone = 'cook-burned';
        else if (p >= 0.70) cookZone = 'cook-perfect';
        else if (p >= 0.30) cookZone = 'cook-cuit';
        cls += ` cell-cooking ${cookZone}`;
        content = recipe.emoji;
      } else {
        // Pending — dark slot
        cls += ' cell-pending';
        content = recipe.emoji;
      }

      html += `<div class="${cls}">${content}</div>`;
    }
  }

  html += '</div>';

  // Zone indicator light below grid
  if (ci < total) {
    html += `<div class="zone-light ${zoneClass}">${zoneLabel}</div>`;
  }

  html += `
    <div class="extract-btn-row">
      <button class="btn btn-gold" onclick="window._extract(${i})">⬆️ Extract <kbd>${i + 1}</kbd></button>
    </div>`;

  bodyEl.innerHTML = html;
}

// Expose extract for onclick
window._extract = (i) => game.extractFromOven(i);

// ─── Results ───
function renderResults() {
  const run = game.getState().run;
  const res = run?.lastRoundResult;
  if (!res) return;

  $('rs-round').textContent = res.round;
  $('rs-total').textContent = res.totalValue + '🪙';
  $('rs-quota').textContent = res.quota + '🪙';

  const boxesEl = $('rs-boxes');
  boxesEl.innerHTML = '';
  for (const box of res.boxes) {
    const bg = box.gridResult?.bestGroup;
    const info = bg ? `${getRecipe(bg.recipeId).emoji}×${bg.size} ${bg.name} x${bg.multiplier}` : 'N/A';
    const groups = box.gridResult?.groups?.length ?? 0;
    const div = document.createElement('div');
    div.className = 'result-box';
    div.innerHTML = `<span class="info">${info} (${groups} groupes)</span><span class="value">${box.value}🪙</span>`;
    boxesEl.appendChild(div);
  }

  const verdict = $('rs-verdict');
  if (res.passed) {
    verdict.innerHTML = `<p style="color:var(--green);font-weight:700;font-size:1.1rem;text-align:center">✅ QUOTA ATTEINT !</p>
      <p style="color:var(--dim);text-align:center">Surplus: ${res.surplus}🪙 → +${res.shopCoins}💵</p>`;
    $('btn-continue').classList.remove('hidden');
  } else {
    verdict.innerHTML = `<p style="color:var(--red);font-weight:700;font-size:1.1rem;text-align:center">❌ QUOTA RATÉ</p>`;
    $('btn-continue').classList.add('hidden');
  }
}

// ─── Choice ───
function renderChoice() {
  const run = game.getState().run;
  const choices = run?.currentChoices ?? [];
  const el = $('ch-options');
  el.innerHTML = '';
  $('ch-target').classList.add('hidden');

  choices.forEach((ch, i) => {
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <span class="arch arch-${ch.archetype}">${ch.archetype}</span>
      <h4>[${i + 1}] ${ch.name}</h4>
      <p>${ch.description}</p>
      ${ch.needsTarget ? '<p class="needs-target">⚠ Nécessite une cible</p>' : ''}
    `;
    card.onclick = () => selectChoice(i, ch);
    el.appendChild(card);
  });
}

function selectChoice(i, ch) {
  if (ch.needsTarget) {
    showTargetSelect((recipeId) => game.makeChoice(i, recipeId));
  } else {
    game.makeChoice(i);
  }
}

function showTargetSelect(callback) {
  targetCallback = callback;
  const run = game.getState().run;
  const pool = run.machine.pool;
  const el = game.getPhase() === 'CHOICE' ? $('ch-target') : $('sh-target');
  el.classList.remove('hidden');
  el.innerHTML = '<h4>Sélectionner une recette :</h4><div class="target-list"></div>';
  const list = el.querySelector('.target-list');
  for (const entry of pool) {
    const r = getRecipe(entry.recipeId);
    const item = document.createElement('div');
    item.className = 'target-item';
    item.innerHTML = `<span>${r.emoji} ${r.name}</span><span>x${entry.weight}</span>`;
    item.onclick = () => {
      targetCallback?.(entry.recipeId);
      el.classList.add('hidden');
      targetCallback = null;
    };
    list.appendChild(item);
  }
}

// ─── Shop ───
function renderShop() {
  const run = game.getState().run;
  if (!run) return;

  $('sh-budget').textContent = run.shopCurrency;
  $('sh-target').classList.add('hidden');

  // Offerings
  const offEl = $('sh-offerings');
  const offerings = run.shopOfferings || [];
  if (offerings.length === 0) {
    offEl.innerHTML = '<p style="color:var(--dim)">Aucun artefact disponible</p>';
  } else {
    offEl.innerHTML = '';
    offerings.forEach((o, i) => {
      const afford = run.shopCurrency >= o.finalCost;
      const item = document.createElement('div');
      item.className = 'shop-item' + (afford ? '' : ' cant-afford');
      item.innerHTML = `
        <div>
          <span>${o.emoji} <strong>${o.name}</strong></span>
          <span class="rarity rarity-${o.rarity}">${o.rarity}</span>
          <div style="font-size:.8rem;color:var(--dim);margin-top:2px">${o.description}</div>
        </div>
        <span class="shop-cost">${o.finalCost}💵</span>
      `;
      item.onclick = () => {
        game.shopBuyArtifact(i);
        renderShop();
      };
      offEl.appendChild(item);
    });
  }

  // Fixed actions
  const actEl = $('sh-actions');
  const rerollCost = BALANCE.SHOP_REROLL_BASE + (run.rerollCount || 0) * BALANCE.SHOP_REROLL_INCREMENT;
  const acts = [
    { id: 'remove_copy', label: '🗑 Retirer copie', cost: 30, target: true },
    { id: 'duplicate_copy', label: '📋 Dupliquer copie', cost: 50, target: true },
    { id: 'reroll', label: '🔄 Reroll', cost: rerollCost, target: false },
  ];
  actEl.innerHTML = '';
  for (const a of acts) {
    const afford = run.shopCurrency >= a.cost;
    const item = document.createElement('div');
    item.className = 'shop-item' + (afford ? '' : ' cant-afford');
    item.innerHTML = `<span>${a.label}</span><span class="shop-cost">${a.cost}💵</span>`;
    item.onclick = () => {
      if (a.id === 'reroll') { game.shopReroll(); renderShop(); }
      else if (a.target) { showTargetSelect((id) => { game.shopBuy(a.id, id); renderShop(); }); }
      else { game.shopBuy(a.id); renderShop(); }
    };
    actEl.appendChild(item);
  }

  // Owned artifacts
  const artEl = $('sh-artifacts');
  if (run.artifacts.length > 0) {
    artEl.innerHTML = '<h4>Artefacts</h4><div class="artifact-row">' + run.artifacts.map(a => `<span title="${a.name}: ${a.description}">${a.emoji}</span>`).join('') + '</div>';
  } else {
    artEl.innerHTML = '';
  }

  // Pool
  renderPoolPills($('sh-pool'), run.machine.pool);
}

// ─── Game Over ───
function renderGameOver() {
  const run = game.getState().run;
  const meta = game.getMeta();
  const res = run?.lastRoundResult;
  $('go-round').textContent = `${run?.round ?? '?'}/15`;
  $('go-score').textContent = (run?.score ?? 0) + '🪙';
  $('go-stars').textContent = `+${meta.totalStars}⭐`;

  if (res) {
    const pct = res.quota > 0 ? ((res.totalValue / res.quota) * 100).toFixed(0) : 0;
    $('go-missed').innerHTML = `❌ ${res.totalValue}🪙 / ${res.quota}🪙 (${pct}%)`;
  }

  const artEl = $('go-artifacts');
  artEl.innerHTML = (run?.artifacts || []).map(a => `<span title="${a.name}">${a.emoji}</span>`).join('');
}

// ─── Victory ───
function renderVictory() {
  const run = game.getState().run;
  const meta = game.getMeta();
  $('vi-score').textContent = (run?.score ?? 0) + '🪙';
  $('vi-stars').textContent = `+${meta.totalStars}⭐`;
  $('vi-artifacts').innerHTML = (run?.artifacts || []).map(a => `<span title="${a.name}">${a.emoji}</span>`).join('');
}

// ═══════════════════════════════════════
//  Utilities
// ═══════════════════════════════════════
function renderPoolPills(container, pool) {
  const total = pool.reduce((s, e) => s + e.weight, 0);
  container.innerHTML = pool.map(e => {
    const r = getRecipe(e.recipeId);
    const pct = total > 0 ? Math.round(e.weight / total * 100) : 0;
    return `<span class="pool-pill">${r.emoji}x${e.weight} ${pct}%</span>`;
  }).join('');
}

function addMsg(text) {
  msgs.push(text);
  if (msgs.length > 8) msgs.shift();
  renderMessages();
}

function renderMessages() {
  const el = $('pr-messages');
  if (!el) return;
  el.innerHTML = msgs.slice(-5).map(m => `<p>${m}</p>`).join('');
  el.scrollTop = el.scrollHeight;
}

// ═══════════════════════════════════════
//  Game loop
// ═══════════════════════════════════════
function startLoop() {
  if (interval) return;
  interval = setInterval(() => {
    game.update(TICK);
    renderProduction();
  }, TICK);
}

function stopLoop() {
  if (interval) { clearInterval(interval); interval = null; }
}

// ═══════════════════════════════════════
//  Keyboard
// ═══════════════════════════════════════
function handleKey(e) {
  const phase = game.getPhase();
  const key = e.key;

  if (phase === 'IDLE' && key === 'Enter') { game.startRun(); return; }
  if (phase === 'PREVIEW' && key === 'Enter') { startRound(); return; }
  if (phase === 'POLL' && key === 'r') { game.pollReroll(); renderPoll(); return; }
  if (phase === 'POLL' && key === 'Enter') { game.pollConfirm(); return; }

  if (phase === 'PRODUCTION') {
    if (key === 'p' || key === ' ') { e.preventDefault(); game.pullLever(); }
    if (key === '1') game.extractFromOven(0);
    if (key === '2') game.extractFromOven(1);
    if (key === '3') game.extractFromOven(2);
    if (key === 'e') game.endRoundEarly();
    return;
  }

  if (phase === 'RESULTS' && key === 'Enter') { game.continueFromResults(); return; }

  if (phase === 'CHOICE') {
    const choices = game.getState().run?.currentChoices ?? [];
    const n = parseInt(key);
    if (n >= 1 && n <= choices.length) selectChoice(n - 1, choices[n - 1]);
    return;
  }

  if (phase === 'SHOP' && (key === 'd' || key === 'Escape')) { game.endShop(); return; }

  if ((phase === 'GAME_OVER' || phase === 'VICTORY') && key === 'Enter') { game.startRun(); return; }
}

// ═══════════════════════════════════════
//  Bootstrap
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);
