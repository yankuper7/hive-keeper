/* Hive Keeper – ui: קלט, מסכים, HUD, חנות, הגדרות */
'use strict';

// ---------------- קלט ----------------
const keys = new Set();
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, mouse: false };

window.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') {
    if (e.key === 'Enter' && e.target.id === 'goName') saveScoreFromInput();
    return;
  }
  keys.add(e.code);
  if (state === 'playing' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (state === 'playing') {
    if (e.code === 'Space') firePulse();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') doDash();
  }
  if (state === 'upgrade') {
    const i = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code);
    if (i >= 0) { const c = $('cards').children[i % 3]; if (c) c.click(); }
    if (e.code === 'KeyR') $('btnReroll').click();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused' && !$('pause').classList.contains('hidden')) resumeGame();
    else if (e.code === 'Escape' && !$('settings').classList.contains('hidden')) closeSettings();
    else if (e.code === 'Escape' && state === 'menu') showScreen('menu');
  }
  if (e.code === 'KeyM') Sound.setMuted(!Sound.muted);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); joy.active = false; if (state === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (state === 'playing') pauseGame(); Sound.suspend(); }
  else if (Sound.ctx) Sound.init();
});

canvas.addEventListener('pointerdown', (e) => {
  Sound.init();
  if (state !== 'playing') return;
  e.preventDefault();
  if (joy.active) return; // אצבע אחת שולטת בתנועה; השנייה חופשית לכפתורים
  joy.active = true; joy.id = e.pointerId;
  joy.mouse = e.pointerType === 'mouse';
  joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  joy.x = e.clientX; joy.y = e.clientY;
  if (!joy.mouse) {
    // הג׳ויסטיק "נגרר" אחרי האצבע, כך שתמיד קל לשנות כיוון
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), max = 70;
    if (d > max) { joy.ox += (dx / d) * (d - max); joy.oy += (dy / d) * (d - max); }
  }
});
const endPointer = (e) => { if (e.pointerId === joy.id) joy.active = false; };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('pointerdown', () => Sound.init(), { passive: true });
// בלי גלילה/זום בטעות בזמן משחק
document.addEventListener('touchmove', (e) => { if (state === 'playing') e.preventDefault(); }, { passive: false });

function inputVector() {
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
  if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
  if (joy.active) {
    if (joy.mouse) {
      // עכבר: הדבורה עפה לכיוון הסמן
      const tx = joy.x / scale, ty = joy.y / scale;
      const dx = tx - G.player.x, dy = ty - G.player.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) return { x: 0, y: 0 };
      const m = Math.min(1, d / 40);
      return { x: (dx / d) * m, y: (dy / d) * m };
    }
    // מגע: ג׳ויסטיק וירטואלי
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy;
    const d = Math.hypot(dx, dy);
    if (d < 5) return { x: 0, y: 0 };
    const m = Math.min(1, d / 50);
    return { x: (dx / d) * m, y: (dy / d) * m };
  }
  return { x: 0, y: 0 };
}

// ---------------- מסכים ----------------
const SCREENS = ['menu', 'howto', 'guide', 'lab', 'awards', 'settings', 'scores', 'upgrade', 'pause', 'gameover', 'story'];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function showScreen(id) {
  SCREENS.forEach((s) => $(s).classList.toggle('hidden', s !== id));
  const el = $(id);
  el.scrollTop = 0;
  const panel = el.querySelector('.panel');
  if (panel) panel.scrollTop = 0;
  if (id === 'menu') refreshMenu();
  else if (id === 'guide') renderGuide();
  else if (id === 'lab') renderLab();
  else if (id === 'awards') renderAwards();
  else if (id === 'settings') syncSettings();
  else if (id === 'scores') renderScores($('scoresTable'), null);
}
function hideScreens() {
  SCREENS.forEach((s) => $(s).classList.add('hidden'));
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function refreshMenu() {
  const s = getScores();
  const sv = loadRun();
  $('btnContinue').classList.toggle('hidden', !sv);
  if (sv) $('btnContinue').textContent = `▶ Continue (level ${sv.level}, ${DIFFS[sv.diff].name})`;
  $('btnStart').textContent = sv ? 'New game' : 'Start game';
  $('btnStart').classList.toggle('primary', !sv);
  const best = $('menuBest');
  best.classList.toggle('hidden', !s.length);
  if (s.length) best.textContent = `🏆 Best: ${fmt(s[0].score)} (${s[0].name})`;
  $('menuJelly').textContent = `👑 ${fmt(profile.jelly)} royal jelly`;
}

function renderScores(el, highlightId) {
  const s = getScores();
  if (!s.length) { el.innerHTML = '<div class="empty">No high scores yet. Be the first!</div>'; return; }
  const medals = ['🥇', '🥈', '🥉'];
  el.innerHTML = '<table class="scores"><thead><tr><th>#</th><th>Name</th><th>Score</th><th>Level</th><th>Mode</th></tr></thead><tbody>' +
    s.map((r, i) => `<tr class="${r.id === highlightId ? 'me' : ''}" title="${esc((r.date || '').split('-').reverse().join('/'))}"><td>${medals[i] || i + 1}</td><td>${esc(r.name)}</td><td class="num">${fmt(Number(r.score))}</td><td>${r.won ? '🏆' + (r.level > 10 ? ' ' + esc(r.level) : '') : esc(r.level)}</td><td>${(DIFFS[r.diff] || DIFFS.normal).name}</td></tr>`).join('') +
    '</tbody></table>';
}

let bannerTimer = 0;
function showBanner(title, sub, secs, kicker) {
  $('bannerKicker').textContent = kicker || '';
  $('bannerTitle').textContent = title;
  $('bannerSub').textContent = sub || '';
  const b = $('banner');
  b.classList.remove('hidden');
  b.classList.toggle('boss', !!kicker && kicker.includes('Boss'));
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  bannerTimer = secs;
}

function toast(icon, title, text) {
  const box = $('toasts');
  while (box.children.length >= 3) box.removeChild(box.firstChild);
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="t-ico">${icon}</span><div><b>${esc(title)}</b><span>${esc(text)}</span></div>`;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3400);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
}

function updateDiffButtons() {
  document.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('on', b.dataset.diff === diffKey));
}
function updateMuteButtons() {
  document.querySelectorAll('.mute-btn').forEach((b) => {
    if (b.classList.contains('icon-btn')) b.textContent = Sound.muted ? '🔇' : '🔊';
    else b.textContent = Sound.muted ? '🔇 Sound: off' : '🔊 Sound: on';
  });
}

// ---------------- HUD ----------------
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setBar(id, frac, noLow) {
  const w = Math.round(clamp(frac, 0, 1) * 1000) / 10 + '%';
  if (hudCache[id] !== w) {
    hudCache[id] = w;
    const el = $(id);
    el.style.width = w;
    if (!noLow) el.classList.toggle('low', frac < 0.3);
  }
}
function setCd(key, el, frac) {
  const v = Math.round(clamp(frac, 0, 1) * 50) / 50;
  if (hudCache[key] === v) return;
  hudCache[key] = v;
  el.style.setProperty('--cd', v);
  el.classList.toggle('cooling', v > 0);
  el.classList.toggle('ready', v <= 0);
}
function updateHud() {
  if (!G) return;
  const P = G.player, S = G.stats;
  setText('hudLevel', String(G.level));
  setText('hudLevelMax', G.endless ? ' ♾️' : '/10');
  setText('hudScore', fmt(G.score));
  setText('hudHoney', String(G.honey));
  setBar('barBee', P.hp / S.maxHp);
  setBar('barHive', G.hive.hp / G.hive.maxHp);
  setText('numBee', String(Math.ceil(P.hp)));
  setText('numHive', String(Math.ceil(G.hive.hp)));
  if (G.plan) {
    let left = G.enemies.length;
    for (const w of G.plan.waves) left += w.types.length;
    // בשלב בוס הפס מראה כמה מהבוס כבר ירד
    const prog = G.plan.boss ? (G.boss ? 1 - G.boss.hp / G.boss.maxHp : G.bossSpawned ? 1 : 0) : 1 - Math.min(1, left / Math.max(1, G.plan.total));
    setBar('barWave', prog, true);
  }
  if (G.boss) setBar('barBoss', G.boss.hp / G.boss.maxHp, true);
  const combo = G.combo >= 3 ? `🔥 ${G.combo} · x${comboMult()}` : '';
  if (hudCache.combo !== combo) { hudCache.combo = combo; $('hudComboTxt').textContent = combo; $('hudCombo').classList.toggle('hidden', !combo); }
  if (combo) { const cw = Math.round(clamp(G.comboT / 2.6, 0, 1) * 20) * 5 + '%'; if (hudCache.comboBar !== cw) { hudCache.comboBar = cw; $('hudComboBar').style.width = cw; } }
  const icons = { rapid: '⚡', shield: '🛡️', freeze: '❄️' };
  const bf = Object.keys(icons).filter((k) => G.buffs[k] > 0).map((k) => icons[k] + ' ' + Math.ceil(G.buffs[k])).join('  ');
  if (hudCache.buffs !== bf) { hudCache.buffs = bf; const el = $('hudBuffs'); el.textContent = bf; el.classList.toggle('hidden', !bf); }
  setCd('dash', $('btnDash'), P.dashCd / S.dashCd);
  setCd('pulse', $('btnPulse'), P.pulseCd / S.pulseCd);
}
function measureHud() {
  const hud = $('hud');
  if (hud.classList.contains('hidden')) return;
  const r = $('hudBars').getBoundingClientRect();
  if (r.bottom > 0) { hudPx = Math.min(r.bottom + 6, window.innerHeight * 0.3); hudSafe = hudPx / scale; }
}
function onResize() { measureHud(); }

function onStateChange(s) {
  const inGame = s === 'playing' || s === 'paused' || s === 'clear' || s === 'dying';
  $('hud').classList.toggle('hidden', !inGame);
  const showBtns = s === 'playing' || s === 'paused' || s === 'clear';
  $('btnPulse').classList.toggle('hidden', !showBtns);
  $('btnDash').classList.toggle('hidden', !showBtns);
  document.body.classList.toggle('playing', s === 'playing');
  if (s !== 'playing') joy.active = false;
  if (inGame) measureHud();
}

function showBossBar(def) {
  $('bossName').textContent = def.name;
  $('bossNotch1').style.left = def.phases === 3 ? '34%' : '50%';
  $('bossNotch2').style.display = def.phases === 3 ? '' : 'none';
  $('bossNotch2').style.left = '67%';
  hudCache.barBoss = null;
  $('bossBar').classList.remove('hidden');
}
function hideBossBar() { $('bossBar').classList.add('hidden'); }

// ---------------- מסך שדרוגים וחנות ----------------
function buildHtml() {
  const items = Object.keys(G.taken).filter((id) => UPGRADE_BY_ID[id] && G.taken[id] > 0)
    .sort((a, b) => 'lerc'.indexOf(UPGRADE_BY_ID[a].rarity) - 'lerc'.indexOf(UPGRADE_BY_ID[b].rarity));
  if (!items.length) return '';
  return '<div class="build-title">Your build</div>' + items.map((id) => {
    const u = UPGRADE_BY_ID[id];
    return `<span class="b-item rar-${u.rarity}" title="${esc(u.name + ' – ' + u.desc)}">${u.icon}${G.taken[id] > 1 ? `<b>×${G.taken[id]}</b>` : ''}</span>`;
  }).join('');
}
function openUpgrade() {
  setState('upgrade');
  G.offerBoss = !!(G.plan && G.plan.boss);
  G.offer = rollUpgrades(G.taken, 3, G.offerBoss);
  G.freeRerollsLeft = G.stats.freeRerolls || 0;
  $('upTitle').textContent = `Level ${G.level} complete! 🎉`;
  $('upInfo').innerHTML = `Level bonus: <b>${fmt(G.lastBonus || 0)}</b> · Score: <b>${fmt(G.score)}</b><br>The hive was repaired by ${Math.round((G.lastRepair || 0.1) * 100)}% and the bee rested (+20% health).` +
    (G.offerBoss ? '<br><b class="boss-reward">Boss defeated – the workers rebuild, and rarer cards this round!</b>' : '');
  renderCards();
  refreshShop();
  $('upBuild').innerHTML = buildHtml();
  showScreen('upgrade');
}
function renderCards() {
  const cards = $('cards');
  cards.innerHTML = '';
  G.offer.forEach((u, i) => {
    const b = document.createElement('button');
    b.className = 'card rar-' + u.rarity;
    b.dataset.id = u.id;
    const lv = G.taken[u.id] || 0;
    b.innerHTML = `<div class="rar">${RARITY[u.rarity].name}</div><div class="ic">${u.icon}</div><div class="nm">${u.name}</div><div class="ds">${u.desc}</div>` +
      (u.max === Infinity ? '' : `<div class="lv">${u.max === 1 ? 'Unique' : `Level ${lv} → ${lv + 1} (of ${u.max})`}</div>`) + `<span class="key">${i + 1}</span>`;
    b.style.animationDelay = (i * 0.07) + 's';
    b.addEventListener('click', () => chooseUpgrade(u));
    cards.appendChild(b);
  });
}
function refreshShop() {
  $('upHoney').textContent = G.honey;
  const bh = $('buyHive'), bb = $('buyBee'), br = $('btnReroll');
  const hc = shopCost(HIVE_COST), bc = shopCost(BEE_COST), rc = rerollCost();
  bh.innerHTML = `🏠 Repair hive +50<small>${hc} 🍯 · ${Math.ceil(G.hive.hp)}/${G.hive.maxHp}</small>`;
  bb.innerHTML = `🐝 Heal bee +40<small>${bc} 🍯 · ${Math.ceil(G.player.hp)}/${G.stats.maxHp}</small>`;
  bh.disabled = G.honey < hc || G.hive.hp >= G.hive.maxHp;
  bb.disabled = G.honey < bc || G.player.hp >= G.stats.maxHp;
  br.textContent = rc === 0 ? `🎲 Reroll cards (free ×${G.freeRerollsLeft})` : `🎲 Reroll cards (${rc} 🍯)`;
  br.disabled = G.honey < rc;
}

// ---------------- סוף משחק ----------------
function statCell(label, value) { return `<div class="stat-cell"><b>${value}</b><span>${label}</span></div>`; }
function showGameOver(won, jelly) {
  $('goTitle').textContent = won ? '🏆 Victory! The hive is saved!' : G.endless ? '♾️ End of the endless journey' : '💔 Game over';
  const info = won
    ? 'You defeated the Wasp Emperor and all 10 levels!<i>The moral: those who build with patience guard with courage, and those who only take are left with nothing.</i>'
    : G.endless ? `${esc(G.deathReason)}, but you reached level ${G.level} in endless mode!`
    : `${esc(G.deathReason)} on level ${G.level}.`;
  $('goInfo').innerHTML = info;
  const mm = Math.floor(G.time / 60), ss = String(Math.floor(G.time % 60)).padStart(2, '0');
  $('goStats').innerHTML = statCell('Score', fmt(G.score)) + statCell('Difficulty', DIFFS[G.diff].name) + statCell('Wasps defeated', fmt(G.kills)) +
    statCell('Honey', fmt(G.honeyTotal)) + statCell('Best combo', G.maxCombo) + statCell('Time', `${mm}:${ss}`);
  const gj = $('goJelly');
  gj.classList.toggle('hidden', jelly <= 0);
  gj.innerHTML = `👑 +${jelly} royal jelly <small>(you have ${fmt(profile.jelly)} – spend it in the Hive Lab)</small>`;
  $('btnEndless').classList.toggle('hidden', !(won && !G.endless));
  const q = qualifies(G.score);
  $('goNameBox').classList.toggle('hidden', !q);
  $('goName').value = store.get(NAME_KEY, '') || '';
  renderScores($('goScores'), null);
  showScreen('gameover');
  if (jelly > 0) Sound.play('jelly');
  if (q && !isTouch()) setTimeout(() => $('goName').focus(), 50);
}

function saveScoreFromInput() {
  if (!G || G.saved || state !== 'over') return;
  const name = ($('goName').value || '').trim().slice(0, 14) || 'Anonymous Bee';
  store.set(NAME_KEY, name);
  const entry = { name, score: G.score, level: G.level, won: !!G.won, diff: G.diff, date: new Date().toISOString().slice(0, 10), id: Date.now() };
  if (G.savedId) store.set(SCORES_KEY, getScores().filter((r) => r.id !== G.savedId)); // אותה ריצה – לא כפול
  addScore(entry);
  G.savedId = entry.id;
  G.saved = true;
  $('goNameBox').classList.add('hidden');
  renderScores($('goScores'), entry.id);
  Sound.play('buy');
  $('goName').blur();
}

// ---------------- מעבדת הכוורת (שדרוגי קבע) ----------------
function renderLab() {
  $('labJelly').textContent = fmt(profile.jelly);
  const box = $('labList');
  box.innerHTML = '';
  PERKS.forEach((p) => {
    const lv = perkLv(p.id), maxed = lv >= p.max, cost = PERK_COST[lv];
    const row = document.createElement('div');
    row.className = 'perk' + (maxed ? ' maxed' : '');
    let pips = '';
    for (let i = 0; i < p.max; i++) pips += `<i class="${i < lv ? 'on' : ''}"></i>`;
    row.innerHTML = `<div class="p-ico">${p.icon}</div><div class="p-txt"><b>${p.name}</b><span>${p.desc}</span><div class="pips">${pips}</div></div>`;
    const btn = document.createElement('button');
    btn.className = 'btn small' + (maxed ? '' : ' primary');
    btn.textContent = maxed ? 'Maxed' : `${cost} 👑`;
    btn.disabled = maxed || profile.jelly < cost;
    btn.addEventListener('click', () => {
      if (maxed || profile.jelly < cost) { Sound.play('denied'); return; }
      profile.jelly -= cost;
      profile.perks[p.id] = lv + 1;
      saveProfile();
      Sound.play('jelly');
      renderLab();
    });
    row.appendChild(btn);
    box.appendChild(row);
  });
}

// ---------------- הישגים וסטטיסטיקה ----------------
function renderAwards() {
  const st = profile.stats;
  const hrs = Math.floor(st.time / 3600), mins = Math.floor((st.time % 3600) / 60);
  $('statsGrid').innerHTML = statCell('Runs', fmt(st.runs)) + statCell('Victories', fmt(st.wins)) + statCell('Wasps defeated', fmt(st.kills)) +
    statCell('Bosses defeated', fmt(st.bosses)) + statCell('Honey collected', fmt(st.honey)) + statCell('Best level', fmt(st.bestLevel)) +
    statCell('Best combo', fmt(st.bestCombo)) + statCell('Best score', fmt(st.bestScore)) + statCell('Time played', hrs ? `${hrs}h ${mins}m` : `${mins}m`);
  const got = ACHIEVEMENTS.filter((a) => profile.ach[a.id]).length;
  $('awardsList').innerHTML = `<div class="build-title">Awards ${got}/${ACHIEVEMENTS.length} · each one gives ${ACH_REWARD} 👑</div>` + ACHIEVEMENTS.map((a) => {
    const on = !!profile.ach[a.id];
    return `<div class="award${on ? ' on' : ''}"><span class="a-ico">${on ? a.icon : '🔒'}</span><div><b>${a.name}</b><span>${a.desc}</span></div></div>`;
  }).join('');
}

// ---------------- מדריך הצרעות ----------------
function renderGuide() {
  const box = $('guideList');
  box.innerHTML = '';
  const add = (key, def, isBoss) => {
    const seen = !!profile.seen[key];
    const el = document.createElement('div');
    el.className = 'g-item' + (seen ? '' : ' unseen') + (isBoss ? ' boss' : '');
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    drawPortrait(cv, key, def, isBoss);
    el.appendChild(cv);
    const txt = document.createElement('div');
    txt.innerHTML = seen ? `<b>${def.name}</b><span>${def.info}</span>` : '<b>???</b><span>You have not met this one yet.</span>';
    el.appendChild(txt);
    box.appendChild(el);
  };
  GUIDE_ORDER.forEach((k) => add(k, ETYPES[k], false));
  Object.keys(BOSSES).forEach((k) => add(k, BOSSES[k], true));
}

// ---------------- הגדרות ----------------
let settingsFrom = 'menu';
function openSettings(from) { settingsFrom = from; showScreen('settings'); }
function closeSettings() { showScreen(settingsFrom === 'pause' && state === 'paused' ? 'pause' : 'menu'); }
function setToggle(id, on) { const b = $(id); b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.textContent = on ? 'On' : 'Off'; }
function syncSettings() {
  $('setMusic').value = Math.round(settings.music * 100);
  $('setSfx').value = Math.round(settings.sfx * 100);
  setToggle('setShake', settings.shake);
  setToggle('setVibrate', settings.vibrate);
  setToggle('setNumbers', settings.numbers);
  setToggle('setLefty', settings.lefty);
  document.querySelectorAll('[data-quality]').forEach((b) => b.classList.toggle('on', b.dataset.quality === settings.quality));
  document.body.classList.toggle('lefty', settings.lefty);
  const fsOk = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  $('btnFullscreen').classList.toggle('hidden', !fsOk);
  $('btnResetAll').classList.toggle('hidden', settingsFrom === 'pause');
}
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  } catch (e) { /* לא נתמך */ }
}
function resetAllProgress() {
  if (!confirm('Delete ALL saved progress?\nHigh scores, royal jelly, lab upgrades, awards and the saved run will be erased.')) return;
  [SCORES_KEY, SAVE_KEY, PROFILE_KEY, STORY_KEY, NAME_KEY].forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
  profile = loadProfile();
  toast('🧹', 'Progress reset', 'A fresh hive awaits.');
  showScreen('menu');
}

// ---------------- חיבור כפתורים ----------------
function on(id, fn) {
  $(id).addEventListener('click', (e) => { Sound.init(); Sound.play('click'); fn(e); });
}
function bindUi() {
  on('btnStart', () => {
    if (!store.get(STORY_KEY, false)) showScreen('story'); // בפעם הראשונה מספרים את האגדה
    else if (loadRun() && !confirm('Start a new game? Your saved run will be replaced.')) return;
    else startGame();
  });
  on('btnStory', () => showScreen('story'));
  on('btnStoryGo', () => { store.set(STORY_KEY, true); startGame(); });
  document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => {
    Sound.init(); Sound.play('click');
    diffKey = b.dataset.diff; store.set(DIFF_KEY, diffKey); updateDiffButtons();
  }));
  on('btnHowto', () => showScreen('howto'));
  on('btnGuide', () => showScreen('guide'));
  on('btnLab', () => showScreen('lab'));
  on('btnAwards', () => showScreen('awards'));
  on('btnScores', () => showScreen('scores'));
  on('btnSettings', () => openSettings('menu'));
  on('btnPauseSettings', () => openSettings('pause'));
  on('btnSettingsBack', closeSettings);
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { Sound.play('click'); showScreen('menu'); }));
  on('btnClearScores', () => {
    if (confirm('Delete all high scores?')) { store.set(SCORES_KEY, []); renderScores($('scoresTable'), null); }
  });
  ['btnMutePause', 'btnMuteHud'].forEach((id) => $(id).addEventListener('click', () => { Sound.init(); Sound.setMuted(!Sound.muted); Sound.play('click'); $(id).blur(); }));
  on('btnPause', () => { pauseGame(); $('btnPause').blur(); });
  on('btnResume', resumeGame);
  on('btnQuit', toMenu);
  on('btnAgain', startGame);
  on('btnEndless', continueEndless);
  on('btnContinue', continueRun);
  on('btnMenu', toMenu);
  on('btnSaveScore', saveScoreFromInput);
  $('buyHive').addEventListener('click', () => { if (buyRepair('hive')) refreshShop(); });
  $('buyBee').addEventListener('click', () => { if (buyRepair('bee')) refreshShop(); });
  $('btnReroll').addEventListener('click', () => { if (state === 'upgrade' && rerollCards()) { renderCards(); refreshShop(); } });

  // הגדרות
  $('setMusic').addEventListener('input', (e) => { settings.music = clamp(e.target.value / 100, 0, 1); Sound.init(); Sound.applyVolumes(); saveSettings(); });
  $('setSfx').addEventListener('input', (e) => { settings.sfx = clamp(e.target.value / 100, 0, 1); Sound.init(); Sound.applyVolumes(); saveSettings(); });
  $('setSfx').addEventListener('change', () => Sound.play('pickup'));
  const tog = (id, key, after) => $(id).addEventListener('click', () => { settings[key] = !settings[key]; saveSettings(); syncSettings(); Sound.play('click'); if (after) after(); });
  tog('setShake', 'shake');
  tog('setVibrate', 'vibrate', () => vibrate(30));
  tog('setNumbers', 'numbers');
  tog('setLefty', 'lefty');
  document.querySelectorAll('[data-quality]').forEach((b) => b.addEventListener('click', () => {
    settings.quality = b.dataset.quality; saveSettings(); Sound.play('click');
    if (settings.quality === 'auto') quality.tier = 2;
    resize(); syncSettings();
  }));
  on('btnFullscreen', toggleFullscreen);
  on('btnResetAll', resetAllProgress);

  // כפתורי מגע: גל זמזום וזינוק
  const press = (btn, fn) => {
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sound.init(); if (state === 'playing') { fn(); btn.classList.add('down'); setTimeout(() => btn.classList.remove('down'), 120); } });
    btn.addEventListener('click', (e) => e.preventDefault());
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  press($('btnPulse'), firePulse);
  press($('btnDash'), doDash);

  document.body.classList.toggle('lefty', settings.lefty);
  document.body.classList.toggle('touch', isTouch());
}
