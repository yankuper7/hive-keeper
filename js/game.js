/* Hive Keeper – game: מצב המשחק, שחקנית, גלים ואויבים */
'use strict';

// ---------------- מצב המשחק ----------------
let G = null;
let state = 'menu'; // menu | playing | paused | upgrade | clear | dying | over
let stateTimer = 0;
let lastTime = 0;
let shake = 0;
let animT = 0;
let timeScale = 1; // לבדיקות אוטומטיות בלבד
let slowMo = 0;    // הילוך איטי קצר כשבוס נופל

function addShake(v) { if (settings.shake) shake = Math.max(shake, v); }

function newGame() {
  return {
    level: 1, score: 0, honey: 0, honeyTotal: 0, kills: 0, time: 0,
    combo: 0, comboT: 0, maxCombo: 0, buffs: { rapid: 0, shield: 0, freeze: 0 }, hurtFlash: 0,
    diff: diffKey, endless: false, beat: false, savedId: null,
    rerolls: 0, reviveUsed: false, bossKills: 0, thiefCaught: 0, eliteSeen: false,
    paid: { jelly: 0, kills: 0, honey: 0, time: 0 },
    hive: { x: W / 2, y: H / 2, r: 46, hp: 300, maxHp: 300, hitT: 0, turretCd: 0, aim: -Math.PI / 2 },
    player: { x: W / 2, y: H / 2 + 110, r: 14, hp: 100, inv: 0, fireCd: 0, pulseCd: 0, ang: -Math.PI / 2, vx: 0, vy: 0,
              dashT: 0, dashCd: 0, dvx: 0, dvy: 0, mx: 0, my: -1, echoT: 0, dashId: 0, target: null, ghostT: 0 },
    stats: {
      speed: 270, maxHp: 100, damage: 11, fireRate: 3.2, multishot: 1, pierce: 0,
      shotSpeed: 620, range: 380, magnet: 70, regen: 0,
      pulseDmg: 45, pulseRadius: 170, pulseCd: 11, helpers: 0, helperRate: 1, crit: 0.08, dashCd: 2.6,
      venom: 0, frost: 0, thorns: 0, turret: 0, dashDmg: 0, sweet: 0, luck: 0,
      chain: 0, burst: 0, ricochet: 0, orbit: 0, homing: 0, echo: 0, stun: 0, rush: 0, lifesteal: 0,
      revive: 0, honeyMul: 1, shopMul: 1, freeRerolls: 0,
    },
    taken: {},
    enemies: [], stingers: [], shots: [], pickups: [], particles: [], floaters: [], rings: [], helpers: [],
    decals: [], corpses: [], marks: [], arcs: [], ghosts: [],
    plan: null, waveT: 0, introT: 0, bossSpawned: false, boss: null, deathReason: '', deathBy: '',
    lvl: { hiveDmg: 0, beeHits: 0, spawned: 0, total: 0 },
  };
}

function startGame() {
  Sound.init();
  G = newGame();
  applyPerks(G);
  profile.stats.runs++;
  saveProfile();
  hideScreens();
  startLevel(1);
}

function startLevel(n) {
  G.level = n;
  G.plan = levelPlan(n);
  G.waveT = 0;
  G.introT = 2.2;
  G.bossSpawned = false;
  G.boss = null;
  G.enemies = []; G.stingers = []; G.shots = []; G.rings = []; G.corpses = []; G.marks = []; G.arcs = []; G.ghosts = [];
  G.lvl = { hiveDmg: 0, beeHits: 0, spawned: 0, total: G.plan.total };
  const theme = setTheme(themeIdFor(n));
  const fade = $('fade'); fade.classList.remove('go'); void fade.offsetWidth; fade.classList.add('go');
  G.hive.x = W / 2; G.hive.y = H / 2;
  G.player.x = W / 2; G.player.y = H / 2 + 110;
  G.player.inv = 1;
  G.player.pulseCd = Math.min(G.player.pulseCd, 2);
  G.player.dashT = 0; G.player.dashCd = 0; G.player.echoT = 0; G.player.target = null;
  G.buffs.rapid = G.buffs.shield = G.buffs.freeze = 0;
  G.combo = 0; G.comboT = 0;
  slowMo = 0;
  syncHelpers();
  hideBossBar();
  let sub = LEVEL_SUBTITLES[n - 1] || (G.plan.boss ? 'Boss: the ' + BOSSES[G.plan.boss].name + ' returns, stronger!' : 'Endless mode – how long can you last?');
  if (n === 1) sub = isTouch() ? 'Drag a finger to fly · stinging is automatic' : 'Arrow keys or WASD to fly · stinging is automatic';
  showBanner('Level ' + n, sub, n === 1 ? 3.2 : 2.4, theme.name);
  saveRun();
  setState('playing');
  Sound.play('level');
  if (G.endless && n >= 15) unlock('endless15');
}

// ---------------- שמירה והמשך ----------------
// נשמרת נקודת פתיחת השלב, כדי שאפשר יהיה לסגור את הדפדפן ולהמשיך אחר כך
function saveRun() {
  store.set(SAVE_KEY, {
    v: 2, level: G.level, score: G.score, honey: G.honey, honeyTotal: G.honeyTotal, kills: G.kills, time: G.time,
    maxCombo: G.maxCombo, diff: G.diff, endless: G.endless, beat: G.beat, savedId: G.savedId,
    hive: { hp: G.hive.hp, maxHp: G.hive.maxHp }, php: G.player.hp, stats: G.stats, taken: G.taken,
    rerolls: G.rerolls, reviveUsed: G.reviveUsed, bossKills: G.bossKills, thiefCaught: G.thiefCaught, paid: G.paid,
  });
}
function loadRun() {
  const sv = store.get(SAVE_KEY, null);
  if (!sv || typeof sv !== 'object' || !(sv.level >= 1) || !sv.stats || !sv.hive || !DIFFS[sv.diff]) return null;
  return sv;
}
function clearRun() { store.set(SAVE_KEY, null); }
function continueRun() {
  const sv = loadRun();
  if (!sv) { startGame(); return; }
  Sound.init();
  diffKey = sv.diff; store.set(DIFF_KEY, diffKey); updateDiffButtons();
  G = newGame();
  for (const k of ['score', 'honey', 'honeyTotal', 'kills', 'time', 'maxCombo', 'rerolls', 'bossKills', 'thiefCaught']) G[k] = Number(sv[k]) || 0;
  G.endless = !!sv.endless; G.beat = !!sv.beat; G.savedId = sv.savedId || null; G.reviveUsed = !!sv.reviveUsed;
  // שמירות ישנות (גרסה 1) חסרות את השדות החדשים – ברירות המחדל נשארות
  for (const k in G.stats) if (typeof sv.stats[k] === 'number' && isFinite(sv.stats[k])) G.stats[k] = sv.stats[k];
  if (sv.paid && typeof sv.paid === 'object') for (const k in G.paid) G.paid[k] = Number(sv.paid[k]) || 0;
  G.taken = (sv.taken && typeof sv.taken === 'object') ? sv.taken : {};
  G.hive.maxHp = Number(sv.hive.maxHp) || G.hive.maxHp;
  G.hive.hp = clamp(Number(sv.hive.hp) || 1, 1, G.hive.maxHp);
  G.player.hp = clamp(Number(sv.php) || 1, 1, G.stats.maxHp);
  hideScreens();
  startLevel(Math.floor(sv.level));
}
function continueEndless() {
  if (!G || state !== 'over' || !G.beat || G.endless) return;
  G.endless = true;
  G.hive.hp = Math.min(G.hive.maxHp, G.hive.hp + G.hive.maxHp * 0.1);
  G.player.hp = Math.min(G.stats.maxHp, G.player.hp + G.stats.maxHp * 0.2);
  G.lastBonus = G.lastBonus || 0;
  openUpgrade();
}

function syncHelpers() {
  while (G.helpers.length < G.stats.helpers) {
    G.helpers.push({ x: G.hive.x, y: G.hive.y, ang: 0, cd: 0, aim: 0 });
  }
  G.helpers.forEach((h, i) => { h.ang = (i / G.helpers.length) * TAU; });
}

function setState(s) {
  state = s;
  stateTimer = 0;
  onStateChange(s);
}

// כשגודל המסך משתנה, מזיזים את כל העולם כך שהכוורת נשארת במרכז
function shiftWorld(dx, dy) {
  if (!G) return;
  const all = [G.enemies, G.stingers, G.shots, G.pickups, G.particles, G.floaters, G.rings, G.decals, G.corpses, G.marks, G.ghosts];
  all.forEach((arr) => arr.forEach((o) => { o.x += dx; o.y += dy; }));
  G.arcs.forEach((a) => { a.x1 += dx; a.y1 += dy; a.x2 += dx; a.y2 += dy; });
  G.player.x = clamp(G.player.x + dx, 20, W - 20);
  G.player.y = clamp(G.player.y + dy, 20, H - 20);
  G.hive.x = W / 2; G.hive.y = H / 2;
}

// ---------------- הישגים ----------------
function unlock(id) {
  if (profile.ach[id]) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  profile.ach[id] = Date.now();
  profile.jelly += ACH_REWARD; profile.jellyTotal += ACH_REWARD;
  saveProfile();
  toast(a.icon, 'Achievement unlocked!', `${a.name} · +${ACH_REWARD} royal jelly`);
  Sound.play('achieve');
}

// ---------------- יצירת אויבים ----------------
const onScreen = (e, m = 0) => e.x >= -m && e.x <= W + m && e.y >= -m && e.y <= H + m;

function edgePoint(m = 40) {
  switch (Math.floor(Math.random() * 4)) {
    case 0: return { x: rand(0, W), y: -m };
    case 1: return { x: W + m, y: rand(0, H) };
    case 2: return { x: rand(0, W), y: H + m };
    default: return { x: -m, y: rand(0, H) };
  }
}
// נקודת כניסה "חכמה": הרחק מהדבורה
function farEdgePoint() {
  let best = edgePoint(), bd = -1;
  for (let i = 0; i < 4; i++) {
    const p = edgePoint();
    const d = Math.hypot(p.x - G.player.x, p.y - G.player.y);
    if (d > bd) { bd = d; best = p; }
  }
  return best;
}

function spawnEnemy(type, x, y, noElite) {
  const d = ETYPES[type];
  const p = G.plan;
  const hp = d.hp * p.hpMul;
  const e = {
    type, x, y, r: d.r, hp, maxHp: hp, speed: d.speed * p.speedMul * rand(0.9, 1.1),
    dmg: d.dmg * D().dmg, def: d, t: rand(0, 10), age: 0, flash: 0, kx: 0, ky: 0, ang: Math.atan2(G.hive.y - y, G.hive.x - x),
    shootCd: rand(1.5, 2.5), seed: Math.random() * TAU, stinging: false,
    st: 'go', stT: 0, cd: rand(0.5, 1.3), stun: 0, chill: 0, poison: 0, poisonDps: 0,
    spawnT: 0.4, loot: 0, tries: 0, orbT: 0, dashHit: -1, hitS: 0, elite: false,
    shield: type === 'guard', shieldDown: 0, shieldArc: 1.0, blockT: 0, lonely: 0,
  };
  if (!noElite && !d.hidden && type !== 'thief' && Math.random() < p.eliteChance) {
    e.elite = true;
    e.hp = e.maxHp = hp * 2.4; e.r = d.r * 1.22; e.speed *= 1.1; e.dmg *= 1.3;
    if (!G.eliteSeen) { G.eliteSeen = true; G.eliteNote = e; }
  }
  G.enemies.push(e);
  if (!d.hidden && !profile.seen[type]) { profile.seen[type] = 1; G.seenDirty = true; }
  return e;
}

// גל: קבוצת צרעות שנכנסת במבנה
function spawnWave(wave) {
  const Hv = G.hive;
  const types = wave.types.slice().sort((a, b) => (b === 'guard') - (a === 'guard')); // מגינות בחזית
  const n = types.length;
  const smart = G.level >= 5 && Math.random() < 0.5;
  const pt = smart ? farEdgePoint() : edgePoint();
  const place = (type, bx, by, i, k) => {
    const ux = Hv.x - bx, uy = Hv.y - by, l = Math.hypot(ux, uy) || 1;
    const dx = ux / l, dy = uy / l, px = -dy, py = dx;
    let side = 0, back = 0;
    if (wave.form === 'vee') { const rk = Math.ceil(i / 2); side = (i % 2 ? 1 : -1) * rk * 30; back = rk * 30; }
    else { side = (i - (k - 1) / 2) * 34; back = (i % 2) * 24; }
    spawnEnemy(type, bx + px * side - dx * back + rand(-5, 5), by + py * side - dy * back + rand(-5, 5));
  };
  if (wave.form === 'ring' && n >= 4) {
    const R = Math.hypot(W, H) / 2 + 40, a0 = Math.random() * TAU;
    types.forEach((t, i) => { const a = a0 + (i / n) * TAU; spawnEnemy(t, Hv.x + Math.cos(a) * R, Hv.y + Math.sin(a) * R); });
  } else if (wave.form === 'pincer' && n >= 2) {
    const h = Math.ceil(n / 2);
    types.forEach((t, i) => {
      if (i < h) place(t, pt.x, pt.y, i, h);
      else place(t, W - pt.x, H - pt.y, i - h, n - h);
    });
  } else {
    types.forEach((t, i) => place(t, pt.x, pt.y, i, n));
  }
  G.lvl.spawned += n;
  if (wave.rush) { showBanner('Final wave!', 'Hold the line', 1.6); Sound.play('warn'); }
}

function spawnBoss(kind) {
  const d = BOSSES[kind];
  const hp = d.hp * D().hp * G.plan.bossMul;
  const e = {
    type: 'boss', kind, boss: true, x: W / 2, y: -90, r: d.r, hp, maxHp: hp,
    speed: d.speed, dmg: d.dmg * D().dmg, def: d, t: 0, age: 0, flash: 0, kx: 0, ky: 0, ang: Math.PI / 2,
    mode: 'enter', modeT: 0, orbitA: -Math.PI / 2, orbDir: Math.random() < 0.5 ? 1 : -1, atkCd: 2.6, cvx: 0, cvy: 0,
    atkIdx: 0, spiralA: 0, spiralCd: 0, phase: 0, phase2: false,
    stun: 0, chill: 0, poison: 0, poisonDps: 0, spawnT: 0, orbT: 0, dashHit: -1, hitS: 0,
    shield: false, shieldDown: 0, shieldArc: 1.25, blockT: 0, exposed: 0, stagger: false, invuln: false,
    windDmg: 0, windT: 0.75, charges: 0, beamA: 0, beamDir: 1, beam: null, fade: 1,
  };
  G.enemies.push(e);
  G.boss = e;
  G.bossSpawned = true;
  if (!profile.seen[kind]) { profile.seen[kind] = 1; G.seenDirty = true; }
  showBossBar(d);
  addShake(12);
  Sound.play('boss');
  showBanner(d.name, d.title, 2.2, '⚠ Boss ⚠');
}

// ---------------- פעולות שחקן ----------------
function doDash() {
  const P = G.player;
  if (P.dashCd > 0 || P.dashT > 0) return;
  const v = inputVector();
  let dx = v.x, dy = v.y;
  if (!dx && !dy) { dx = P.mx || 0; dy = P.my || -1; } // בלי קלט – לכיוון התנועה האחרון
  const l = Math.hypot(dx, dy) || 1;
  P.dvx = (dx / l) * 880; P.dvy = (dy / l) * 880;
  P.dashT = 0.17;
  P.dashCd = G.stats.dashCd;
  P.dashId++;
  P.inv = Math.max(P.inv, 0.3);
  Sound.play('dash', P.x);
  burst(P.x, P.y, 8, '#fff6c4', 160, 'spark');
}

function addDecal(x, y, r, kind, color) {
  if (G.decals.length > 45) G.decals.shift();
  G.decals.push({ x, y, r, kind, color: color || '#000000', life: 10, rot: Math.random() * TAU });
}

const comboMult = () => 1 + Math.min(4, Math.floor(G.combo / 5)) * 0.5;

function explode(x, y, radius, dmg, color) {
  G.rings.push({ x, y, r: 10, max: radius, life: 0.3, t: 0, color: color || '255,120,40' });
  burst(x, y, 22, '#ff7a1a', 260, 'spark');
  burst(x, y, 12, '#ffe082', 170);
  for (let i = 0; i < 8 * FX; i++) {
    addParticle({ x: x + rand(-18, 18), y: y + rand(-18, 18), vx: rand(-40, 40), vy: rand(-70, -20), life: rand(0.7, 1.3), max: 1.3, r: rand(7, 12), grow: 26, a: 0.5, color: '#4a4a4a', kind: 'smoke' });
  }
  addParticle({ x, y, vx: 0, vy: 0, life: 0.16, max: 0.16, r: radius * 0.9, color: '#fff3c0', kind: 'flash' });
  addDecal(x, y, radius * 0.55, 'scorch');
  addShake(9);
  Sound.play('boom', x);
  if (!dmg) return;
  for (const o of G.enemies) {
    if (o.hp <= 0) continue;
    const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy) || 1;
    if (d < radius + o.r) damageEnemy(o, dmg, dx / d, dy / d, 300, false, true);
  }
}

// גל הזמזום
function firePulse() {
  const P = G.player, S = G.stats;
  if (P.pulseCd > 0) { Sound.play('denied'); return; }
  P.pulseCd = S.pulseCd;
  if (S.echo) P.echoT = 0.45;
  doPulse(1);
}
function doPulse(mul) {
  const P = G.player, S = G.stats;
  const R = S.pulseRadius * (mul > 1 ? 1.25 : 1);
  G.rings.push({ x: P.x, y: P.y, r: 10, max: R, life: 0.45, t: 0 });
  G.rings.push({ x: P.x, y: P.y, r: 10, max: R * 0.7, life: 0.55, t: 0 });
  Sound.play('pulse', P.x);
  addShake(5 * Math.min(1.5, mul + 0.2));
  vibrate(18);
  let hits = 0, broke = false;
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - P.x, dy = e.y - P.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < R + e.r) {
      hits++;
      if ((e.type === 'guard' || e.kind === 'general') && e.shieldDown <= 0) { e.shieldDown = 5; broke = true; burst(e.x, e.y, 10, '#b3e5fc', 200, 'shard'); }
      damageEnemy(e, S.pulseDmg * mul, dx / d, dy / d, 420, false, true);
      if (S.stun && e.hp > 0) { if (e.boss) e.chill = Math.max(e.chill, 1.2 * S.stun); else e.stun = Math.max(e.stun, 0.9 * S.stun); }
    }
  }
  if (broke) Sound.play('shieldBreak', P.x);
  if (hits >= 8) unlock('pulse8');
  // גל הזמזום גם מנקה יריקות
  G.shots = G.shots.filter((s) => {
    if (Math.hypot(s.x - P.x, s.y - P.y) > R) return true;
    burst(s.x, s.y, 3, s.color, 80);
    return false;
  });
}

// בחירת מטרה: הקרובה ביותר, אבל מעדיפים מי שלא מוגנת במגן ואת האחיות
function pickTarget(x, y, range, smart) {
  let best = null, bs = Infinity;
  const r2 = range * range;
  for (const e of G.enemies) {
    if (e.hp <= 0 || e.invuln) continue;
    if (e.y < -e.r || e.y > H + e.r || e.x < -e.r || e.x > W + e.r) continue; // רק אויבים על המסך
    const dx = e.x - x, dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    let sc = Math.sqrt(d2);
    if (smart) {
      if (e.shield && e.shieldDown <= 0 && Math.abs(angDiff(Math.atan2(-dy, -dx), e.ang)) < e.shieldArc) sc += 240;
      if (e.type === 'nurse') sc -= 50;
    }
    if (sc < bs) { bs = sc; best = e; }
  }
  return best;
}

function shoot(x, y, ang, dmg, count, speed, pierce, small, fromPlayer) {
  const spread = 0.13;
  const S = G.stats;
  for (let i = 0; i < count; i++) {
    const a = ang + (i - (count - 1) / 2) * spread;
    G.stingers.push({
      x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, ang: a, dmg, pierce, life: 1.1, hit: [], small,
      p: !!fromPlayer, bounce: fromPlayer ? S.ricochet : 0, home: fromPlayer ? S.homing : 0, sp: speed,
    });
  }
}

function damageEnemy(e, dmg, nx, ny, knock, crit, quiet) {
  if (e.hp <= 0 || e.invuln) return;
  if (e.stagger) dmg *= 1.3;
  if (crit) {
    dmg *= 2;
    if (settings.numbers) addFloater(e.x + rand(-6, 6), e.y - e.r - 6, Math.round(dmg) + '!', '#ffe14d', 20);
    Sound.play('crit', e.x);
  }
  e.hp -= dmg;
  e.flash = 0.1;
  e.hitS = 1;
  if (e.boss) e.windDmg += dmg;
  else if (knock) { const k = knock * (e.def.knock == null ? 1 : e.def.knock) * (e.elite ? 0.6 : 1); e.kx += nx * k; e.ky += ny * k; }
  if (e.hp <= 0) killEnemy(e);
  else if (!quiet) Sound.play('hit', e.x);
}

// אפקטים מיוחדים של עקיצת השחקנית: רעל, קור, ברק
function stingFx(e, dmg) {
  const S = G.stats;
  if (S.venom && e.hp > 0) {
    if (e.poison <= 0) Sound.play('poison', e.x);
    e.poison = 3; e.poisonDps = Math.max(e.poisonDps, dmg * 0.3 * S.venom);
  }
  if (S.frost && e.hp > 0 && Math.random() < 0.18 * S.frost) {
    e.chill = Math.max(e.chill, 2.2);
    burst(e.x, e.y, 5, '#cfefff', 90, 'shard');
    Sound.play('chill', e.x);
  }
  if (S.chain) {
    let from = e, any = false;
    const done = [e];
    for (let k = 0; k < S.chain; k++) {
      let best = null, bd = 150 * 150;
      for (const o of G.enemies) {
        if (o.hp <= 0 || o.invuln || done.includes(o)) continue;
        const d2 = (o.x - from.x) ** 2 + (o.y - from.y) ** 2;
        if (d2 < bd) { bd = d2; best = o; }
      }
      if (!best) break;
      G.arcs.push({ x1: from.x, y1: from.y, x2: best.x, y2: best.y, life: 0.16, max: 0.16, seed: Math.random() * 99, kind: 'zap' });
      damageEnemy(best, dmg * 0.5, 0, 0, 0, false, true);
      burst(best.x, best.y, 3, '#bfe9ff', 110, 'spark');
      done.push(best); from = best; any = true;
    }
    if (any) Sound.play('zap', e.x);
  }
}

function dropPickup(kind, x, y, scatter) {
  // תמיד בתוך אזור המשחק, כדי שאפשר יהיה להגיע לאסוף (לא מתחת ל-HUD ולא מחוץ למסך)
  x = clamp(x + (scatter ? rand(-12, 12) : 0), 16, W - 16);
  y = clamp(y + (scatter ? rand(-12, 12) : 0), hudSafe + 18, H - 16);
  G.pickups.push({ kind, x, y, vx: scatter ? rand(-60, 60) : 0, vy: scatter ? rand(-60, 60) : 0, life: kind === 'honey' ? 14 : 12, t: rand(0, 5) });
}

function killEnemy(e) {
  const P = G.player, S = G.stats, d = e.def;
  const isClone = e.type === 'clone';
  if (!isClone) {
    G.kills++;
    G.combo++; G.comboT = 2.6;
    if (G.combo > G.maxCombo) G.maxCombo = G.combo;
    if (G.combo % 5 === 0 && G.combo <= 20) {
      addFloater(P.x, P.y - 34, 'x' + comboMult() + ' 🔥', '#ffab40', 22);
      Sound.play('combo');
    }
    if (G.combo >= 25) unlock('combo25');
    if (G.kills === 1) unlock('first');
  }
  const pts = Math.round(d.score * (e.elite ? 3 : 1) * comboMult() * D().score);
  G.score += pts;
  addFloater(e.x, e.y - e.r, '+' + pts, e.elite ? '#ffd54f' : '#fff6a0', e.elite ? 20 : 16);
  // התפרקות: רסיסים, ניצוצות, כתם
  burst(e.x, e.y, e.boss ? 70 : 10, d.body, e.boss ? 280 : 170);
  burst(e.x, e.y, e.boss ? 30 : 5, '#fff3b0', e.boss ? 340 : 130, 'spark');
  burst(e.x, e.y, e.boss ? 16 : 3, d.wing, 150, 'shard');
  if (e.boss || e.elite) addParticle({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.2, max: 0.2, r: e.r * 2.6, color: '#ffffff', kind: 'flash' });
  const cl = e.boss ? 1.1 : 0.45;
  G.corpses.push({ x: e.x, y: e.y, ang: e.ang, r: e.r, def: d, boss: !!e.boss, kind: e.kind, type: e.type, spin: rand(-14, 14), vx: e.kx * 0.4, vy: e.ky * 0.4, life: cl, max: cl });
  if (!isClone) addDecal(e.x, e.y, e.r * (e.boss ? 1.6 : 1.1), 'goo', d.body);
  // שלל
  const hn = d.honey * (e.elite ? 3 : 1) + (e.loot || 0);
  for (let i = 0; i < hn; i++) dropPickup('honey', e.x, e.y, true);
  if (e.type === 'thief' && e.loot > 0) {
    addFloater(e.x, e.y - 26, 'Honey recovered!', '#ffe082', 16);
    if (++G.thiefCaught >= 5) unlock('thief');
  }
  if (!e.boss && e.type !== 'mini' && !isClone) {
    const luck = 1 + S.luck;
    const r = Math.random();
    const heartCh = (0.035 + (P.hp < S.maxHp * 0.4 ? 0.05 : 0)) * luck;
    const powCh = (e.elite ? 0.5 : 0.045) * luck;
    if (r < heartCh) dropPickup('heart', e.x, e.y);
    else if (r < heartCh + powCh) dropPickup(pick(['rapid', 'shield', 'freeze']), e.x, e.y);
  }
  if (S.lifesteal && !isClone) {
    P.hp = Math.min(S.maxHp, P.hp + 0.6 * S.lifesteal);
    G.hive.hp = Math.min(G.hive.maxHp, G.hive.hp + 0.5 * S.lifesteal);
  }
  if (d.bomb) explode(e.x, e.y, 95, 45);
  if (S.burst && !e.boss && !isClone && Math.random() < 0.22 * S.burst) {
    // פרץ אבקה: פוגע בצרעות שמסביב
    const R = 85;
    G.rings.push({ x: e.x, y: e.y, r: 8, max: R, life: 0.28, t: 0, color: '255,214,60' });
    burst(e.x, e.y, 14, '#ffd740', 220);
    Sound.play('boom', e.x);
    for (const o of G.enemies) {
      if (o.hp <= 0 || o === e) continue;
      const dx = o.x - e.x, dy = o.y - e.y, dd = Math.hypot(dx, dy) || 1;
      if (dd < R + o.r) damageEnemy(o, 14 + S.damage * 1.2, dx / dd, dy / dd, 200, false, true);
    }
  }
  if (d.split) {
    for (let i = 0; i < d.split; i++) {
      const a = (i / d.split) * TAU + Math.random();
      const m = spawnEnemy('mini', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, true);
      m.kx = Math.cos(a) * 220; m.ky = Math.sin(a) * 220; m.spawnT = 0;
    }
  }
  if (e.boss) {
    Sound.play('bossDie');
    addShake(22);
    vibrate(120);
    slowMo = 1.1;
    G.boss = null;
    G.bossKills++;
    profile.stats.bosses++;
    hideBossBar();
    unlock(e.kind);
    if (G.lvl.beeHits === 0) unlock('dancer');
    for (let i = 0; i < 5; i++) G.rings.push({ x: e.x, y: e.y, r: 10, max: 120 + i * 70, life: 0.4 + i * 0.12, t: 0, color: '255,255,255' });
    // הבוס מת – כל הצרעות הקטנות בורחות/נעלמות
    for (const o of G.enemies) if (o !== e && o.hp > 0) { o.hp = 0; burst(o.x, o.y, 8, o.def.body, 120); }
    G.enemies = G.enemies.filter((o) => o === e);
    G.shots = []; G.marks = [];
    G.plan.waves.length = 0;
  } else {
    Sound.play('kill', e.x);
    if (e.elite) addShake(5);
  }
}

function hurtPlayer(dmg) {
  const P = G.player, S = G.stats;
  if (P.inv > 0 || state !== 'playing') return;
  if (G.buffs.shield > 0) { P.inv = 0.25; burst(P.x, P.y, 6, '#80deea', 120, 'shard'); Sound.play('tink', P.x); return; }
  P.hp -= dmg;
  P.inv = 0.8;
  G.combo = 0;
  G.hurtFlash = 0.4;
  G.lvl.beeHits++;
  vibrate(40);
  addShake(7);
  Sound.play('hurt', P.x);
  burst(P.x, P.y, 10, '#ffd23f', 140);
  if (P.hp <= 0) {
    if (S.revive && !G.reviveUsed) {
      // רוח שנייה: חוזרת לחיים עם גל הדף
      G.reviveUsed = true;
      P.hp = S.maxHp * 0.5; P.inv = 2.4;
      doPulse(1.6);
      burst(P.x, P.y, 40, '#ffffff', 260, 'star');
      showBanner('Second Wind!', 'The bee refuses to fall', 1.6);
      Sound.play('revive');
      unlock('revived');
      return;
    }
    P.hp = 0; gameOver('bee');
  }
}

function hurtHive(dmg) {
  const Hv = G.hive;
  if (state !== 'playing') return;
  Hv.hp -= dmg;
  Hv.hitT = 0.15;
  G.lvl.hiveDmg += dmg;
  Sound.play('hive', Hv.x);
  if (Hv.hp <= 0) { Hv.hp = 0; gameOver('hive'); }
}

// ---------------- אפקטים ----------------
function addParticle(p) {
  if (G.particles.length > PARTICLE_CAP) G.particles.shift();
  G.particles.push(p);
}
function burst(x, y, n, color, spd, kind) {
  n = Math.max(1, Math.round(n * FX));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = rand(spd * 0.3, spd);
    addParticle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.8), max: 0.8, r: kind === 'shard' ? rand(3, 6) : rand(2, 4.5), color, kind, rot: a, vr: rand(-10, 10) });
  }
}
function addFloater(x, y, text, color, size) {
  if (G.floaters.length > 40) G.floaters.shift();
  G.floaters.push({ x, y, text, color, life: 0.9, size: size || 16 });
}

// ---------------- עדכון ----------------
function update(dt) {
  G.time += dt;
  const P = G.player, S = G.stats, Hv = G.hive, plan = G.plan;

  // --- שחקנית ---
  for (const k in G.buffs) if (G.buffs[k] > 0) G.buffs[k] = Math.max(0, G.buffs[k] - dt);
  if (G.combo > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  if (G.hurtFlash > 0) G.hurtFlash -= dt;
  const freeze = G.buffs.freeze > 0 ? 0.35 : 1;

  const v = inputVector();
  if (v.x || v.y) { P.mx = v.x; P.my = v.y; }
  P.vx = v.x * S.speed; P.vy = v.y * S.speed;
  if ((v.x || v.y) && Math.random() < dt * 22 * FX) {
    addParticle({ x: P.x - v.x * 14 + rand(-4, 4), y: P.y - v.y * 14 + rand(-4, 4), vx: -v.x * 30, vy: -v.y * 30, life: 0.45, max: 0.45, r: rand(1.5, 2.6), color: '#fff6c4' });
  }
  if (P.dashCd > 0) P.dashCd = Math.max(0, P.dashCd - dt);
  if (P.dashT > 0) {
    P.dashT -= dt;
    P.vx = P.dvx; P.vy = P.dvy;
    P.ghostT -= dt;
    if (P.ghostT <= 0) { P.ghostT = 0.028; G.ghosts.push({ x: P.x, y: P.y, ang: P.ang, life: 0.26, max: 0.26 }); }
  }
  P.x = clamp(P.x + P.vx * dt, P.r, W - P.r);
  P.y = clamp(P.y + P.vy * dt, P.r + hudSafe, H - P.r);
  if (P.inv > 0) P.inv -= dt;
  if (P.pulseCd > 0) P.pulseCd = Math.max(0, P.pulseCd - dt);
  if (P.echoT > 0) { P.echoT -= dt; if (P.echoT <= 0) doPulse(0.6); }
  if (S.regen) P.hp = Math.min(S.maxHp, P.hp + S.regen * dt);
  // לא נכנסים לתוך הכוורת
  {
    const dx = P.x - Hv.x, dy = P.y - Hv.y, d = Math.hypot(dx, dy) || 1, min = Hv.r + P.r;
    if (d < min) { P.x = Hv.x + (dx / d) * min; P.y = Hv.y + (dy / d) * min; }
  }

  P.fireCd -= dt;
  const target = pickTarget(P.x, P.y, S.range, true);
  P.target = target;
  if (target) {
    P.ang = Math.atan2(target.y - P.y, target.x - P.x);
    if (P.fireCd <= 0) {
      let rate = S.fireRate * (G.buffs.rapid > 0 ? 2 : 1);
      if (S.rush) rate *= 1 + Math.min(20, G.combo) * 0.015 * S.rush;
      P.fireCd = 1 / rate;
      shoot(P.x, P.y, P.ang, S.damage, S.multishot, S.shotSpeed, S.pierce, false, true);
      Sound.play('shoot', P.x);
    }
  } else if (v.x || v.y) {
    P.ang = Math.atan2(v.y, v.x);
  }

  // --- דבורות עזר ---
  for (const h of G.helpers) {
    h.ang += dt * 1.3;
    h.x = Hv.x + Math.cos(h.ang) * 78;
    h.y = Hv.y + Math.sin(h.ang) * 78;
    h.cd -= dt;
    const t = pickTarget(h.x, h.y, 300, true);
    if (t) {
      h.aim = Math.atan2(t.y - h.y, t.x - h.x);
      if (h.cd <= 0) { h.cd = 0.75 / S.helperRate; shoot(h.x, h.y, h.aim, S.damage * 0.7, 1, 520, 0, true, false); }
    } else h.aim = h.ang + Math.PI / 2;
  }
  // --- כוורת שומרת: הכוורת עצמה יורה ---
  if (S.turret) {
    Hv.turretCd -= dt;
    const t = pickTarget(Hv.x, Hv.y, 255, true);
    if (t) {
      Hv.aim = Math.atan2(t.y - Hv.y, t.x - Hv.x);
      if (Hv.turretCd <= 0) {
        Hv.turretCd = 1.25 - 0.25 * S.turret;
        shoot(Hv.x + Math.cos(Hv.aim) * 44, Hv.y + Math.sin(Hv.aim) * 44, Hv.aim, S.damage * 0.8, 1, 540, 0, true, false);
      }
    }
  }
  // --- טבעת עוקצים שמסתובבת סביב הדבורה ---
  if (S.orbit) {
    for (let i = 0; i < S.orbit; i++) {
      const a = G.time * 3.4 + (i / S.orbit) * TAU;
      const bx = P.x + Math.cos(a) * 50, by = P.y + Math.sin(a) * 50;
      for (const e of G.enemies) {
        if (e.hp <= 0 || e.orbT > 0 || e.invuln) continue;
        const rr = e.r + 10;
        if ((e.x - bx) ** 2 + (e.y - by) ** 2 < rr * rr) {
          e.orbT = 0.3;
          damageEnemy(e, S.damage * 0.7, -Math.sin(a), Math.cos(a), 60);
          burst(bx, by, 3, '#fff3b0', 100, 'spark');
        }
      }
    }
  }

  // --- גלים ---
  if (G.introT > 0) G.introT -= dt;
  else {
    if (plan.boss && !G.bossSpawned) spawnBoss(plan.boss);
    if (plan.waves.length) {
      G.waveT -= dt;
      if (!G.enemies.length && G.waveT > 0.5) G.waveT = 0.5; // שדה ריק – הגל הבא ממהר
      if (G.waveT <= 0 && G.enemies.length < 34 + G.level * 2) {
        const w = plan.waves.shift();
        spawnWave(w);
        G.waveT = w.gap;
      }
    }
  }

  // --- אויבים ---
  let allies = 0;
  for (const e of G.enemies) if (!e.boss && e.type !== 'nurse' && e.type !== 'clone' && e.hp > 0) allies++;
  if (G.eliteNote && onScreen(G.eliteNote)) {
    addFloater(G.eliteNote.x, G.eliteNote.y - 34, '★ Elite wasp!', '#ffd54f', 20);
    Sound.play('elite', G.eliteNote.x);
    G.eliteNote = null;
  }
  for (let i = 0; i < G.enemies.length; i++) {
    const e = G.enemies[i];
    if (e.hp <= 0) continue;
    e.t += dt; e.age += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.hitS > 0) e.hitS = Math.max(0, e.hitS - dt * 7);
    if (e.spawnT > 0) e.spawnT -= dt;
    if (e.orbT > 0) e.orbT -= dt;
    if (e.blockT > 0) e.blockT -= dt;
    if (e.shieldDown > 0) e.shieldDown -= dt;
    if (e.poison > 0) {
      e.poison -= dt;
      e.hp -= e.poisonDps * dt * (e.boss ? 0.5 : 1);
      if (Math.random() < dt * 7 * FX) addParticle({ x: e.x + rand(-e.r, e.r) * 0.6, y: e.y + rand(-e.r, e.r) * 0.6, vx: rand(-10, 10), vy: rand(-45, -20), life: 0.6, max: 0.6, r: rand(1.5, 3), color: '#8bdc4a' });
      if (e.poison <= 0) e.poisonDps = 0;
      if (e.hp <= 0 && !e.invuln) { killEnemy(e); continue; }
      if (e.hp <= 0) e.hp = 1;
    }
    let slow = freeze;
    if (e.chill > 0) { e.chill -= dt; slow *= e.boss ? 0.8 : 0.55; }
    if (e.boss) { updateBoss(e, dt * (freeze < 1 ? 0.5 : 1) * (e.chill > 0 ? 0.8 : 1)); continue; }
    updateEnemy(e, dt, slow, allies);
  }

  // --- עוקצים ---
  for (const s of G.stingers) {
    if (s.home) {
      // עוקצים מתבייתים
      if (!s.tg || s.tg.hp <= 0 || s.hit.includes(s.tg)) {
        s.tg = null;
        let bd = 280 * 280;
        for (const e of G.enemies) {
          if (e.hp <= 0 || e.invuln || s.hit.includes(e)) continue;
          const d2 = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
          if (d2 < bd) { bd = d2; s.tg = e; }
        }
      }
      if (s.tg) {
        const want = Math.atan2(s.tg.y - s.y, s.tg.x - s.x);
        s.ang += clamp(angDiff(want, s.ang), -5.5 * dt, 5.5 * dt);
        s.vx = Math.cos(s.ang) * s.sp; s.vy = Math.sin(s.ang) * s.sp;
      }
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.x < -30 || s.x > W + 30 || s.y < -30 || s.y > H + 30) s.life = 0;
    if (s.life <= 0) continue;
    for (const e of G.enemies) {
      if (e.hp <= 0 || e.invuln || s.hit.includes(e)) continue;
      const rr = e.r + 4;
      if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < rr * rr) {
        s.hit.push(e);
        // מגן חוסם עקיצות מלפנים
        if (e.shield && e.shieldDown <= 0 && Math.abs(angDiff(Math.atan2(-s.vy, -s.vx), e.ang)) < e.shieldArc) {
          e.blockT = 0.18;
          burst(s.x, s.y, 4, '#d6efff', 150, 'spark');
          Sound.play('tink', s.x);
          s.life = 0;
          break;
        }
        const l = Math.hypot(s.vx, s.vy) || 1;
        damageEnemy(e, s.dmg, s.vx / l, s.vy / l, 70, s.p && Math.random() < S.crit);
        burst(s.x, s.y, 3, '#fff3b0', 90, 'spark');
        if (s.p) stingFx(e, s.dmg);
        if (s.pierce-- <= 0) {
          s.life = 0;
          if (s.bounce > 0) {
            // ריקושט: קופץ לצרעה אחרת
            let nb = null, bd = 250 * 250;
            for (const o of G.enemies) {
              if (o.hp <= 0 || o.invuln || s.hit.includes(o)) continue;
              const d2 = (o.x - s.x) ** 2 + (o.y - s.y) ** 2;
              if (d2 < bd) { bd = d2; nb = o; }
            }
            if (nb) {
              s.bounce--; s.pierce = 0; s.life = 0.6;
              s.ang = Math.atan2(nb.y - s.y, nb.x - s.x);
              s.vx = Math.cos(s.ang) * s.sp; s.vy = Math.sin(s.ang) * s.sp;
              s.tg = nb;
            }
          }
          break;
        }
      }
    }
  }
  G.stingers = G.stingers.filter((s) => s.life > 0);
  G.enemies = G.enemies.filter((e) => e.hp > 0);
  if (P.target && P.target.hp <= 0) P.target = null;

  // --- יריות אויב ---
  for (const s of G.shots) {
    s.x += s.vx * dt * freeze; s.y += s.vy * dt * freeze; s.life -= dt * freeze;
    if (Math.hypot(s.x - P.x, s.y - P.y) < s.r + P.r - 2 && P.inv <= 0) { hurtPlayer(s.dmg); s.life = 0; }
    else if (Math.hypot(s.x - Hv.x, s.y - Hv.y) < s.r + Hv.r) {
      hurtHive(s.dmg * (s.hm || 0.7)); burst(s.x, s.y, 5, s.color, 80); s.life = 0;
    }
    if (s.x < -60 || s.x > W + 60 || s.y < -60 || s.y > H + 60) s.life = 0;
  }
  G.shots = G.shots.filter((s) => s.life > 0);

  // --- סימוני הפצצה על הקרקע ---
  for (const m of G.marks) {
    m.t += dt * freeze;
    if (m.t >= m.delay) {
      m.done = true;
      explode(m.x, m.y, m.r, 0, '255,80,60');
      if (Math.hypot(P.x - m.x, P.y - m.y) < m.r + P.r * 0.4) hurtPlayer(m.dmg);
      if (Math.hypot(Hv.x - m.x, Hv.y - m.y) < m.r + Hv.r * 0.5) hurtHive(m.dmg * 0.5);
    }
  }
  G.marks = G.marks.filter((m) => !m.done);

  // --- איסוף ---
  for (const p of G.pickups) {
    p.t += dt; p.life -= dt;
    const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < S.magnet || state === 'clear') {
      const sp = state === 'clear' ? 700 : 420;
      p.vx = (dx / d) * sp; p.vy = (dy / d) * sp;
    } else {
      p.vx *= Math.pow(0.05, dt); p.vy *= Math.pow(0.05, dt);
    }
    p.x = clamp(p.x + p.vx * dt, 12, W - 12);
    p.y = clamp(p.y + p.vy * dt, hudSafe + 12, H - 12);
    if (d < P.r + 10) {
      p.life = 0;
      if (p.kind === 'honey') {
        collectHoney(1);
        Sound.play('pickup', P.x);
      } else if (p.kind !== 'heart') {
        G.buffs[p.kind] = 7.5;
        const label = { rapid: '⚡ x2', shield: '🛡️', freeze: '❄️' }[p.kind];
        addFloater(P.x, P.y - 24, label, '#ffffff', 22);
        burst(P.x, P.y, 12, { rapid: '#ffd54f', shield: '#4dd0e1', freeze: '#bbdefb' }[p.kind], 180, 'star');
        Sound.play('power', P.x);
      } else {
        P.hp = Math.min(S.maxHp, P.hp + 25);
        addFloater(P.x, P.y - 20, '+25 ❤', '#ff9eb5');
        burst(P.x, P.y, 8, '#ff9eb5', 120, 'star');
        Sound.play('heart', P.x);
      }
    }
  }
  G.pickups = G.pickups.filter((p) => p.life > 0);

  if (Hv.hitT > 0) Hv.hitT -= dt;

  // --- סוף שלב? ---
  if (state === 'playing' && G.introT <= 0 && !plan.waves.length && !G.enemies.length && (!plan.boss || G.bossSpawned)) {
    levelClear();
  }
}

function collectHoney(n) {
  const S = G.stats, P = G.player;
  const v = n * S.honeyMul;
  G.honey += v; G.honeyTotal += v; G.score += 5 * n;
  if (S.sweet) {
    P.hp = Math.min(S.maxHp, P.hp + 1 * S.sweet * n);
    G.hive.hp = Math.min(G.hive.maxHp, G.hive.hp + 0.6 * S.sweet * n);
  }
  if (G.honeyTotal >= 150) unlock('honey150');
}

// ---------------- התנהגות אויבים ----------------
function updateEnemy(e, dt, slow, allies) {
  const P = G.player, Hv = G.hive, S = G.stats, d = e.def;
  const hx = Hv.x - e.x, hy = Hv.y - e.y, hd = Math.hypot(hx, hy) || 1;
  const pdx = P.x - e.x, pdy = P.y - e.y, pd = Math.hypot(pdx, pdy) || 1;
  const vis = onScreen(e);
  let wx = hx / hd, wy = hy / hd;   // כיוון התנועה הרצוי
  let spd = e.speed * slow;
  let face = null;
  const touch = hd < Hv.r + e.r - 2;
  e.stinging = false;
  e.windup = 0;

  // דבש דביק: האטה ונזק ליד הכוורת
  if (S.thorns && hd < Hv.r + e.r + 46) {
    spd *= 1 - 0.14 * S.thorns;
    e.hp -= 5 * S.thorns * dt;
    if (Math.random() < dt * 5 * FX) addParticle({ x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), vx: 0, vy: 20, life: 0.5, max: 0.5, r: 2.2, color: '#ffb300' });
    if (e.hp <= 0) { killEnemy(e); return; }
  }

  if (e.stun > 0) {
    e.stun -= dt;
    spd = 0;
  } else switch (d.ai) {
    case 'hornet': {
      // רודפת אחרי הדבורה: מתקרבת, מכוונת (מהבהבת) ואז מזנקת
      wx = pdx / pd; wy = pdy / pd;
      if (e.st === 'go') {
        const wob = Math.sin(e.t * 4 + e.seed) * 0.6;
        const ox = wx, oy = wy; wx = ox - oy * wob; wy = oy + ox * wob;
        e.cd -= dt * slow;
        if (pd < 180 && e.cd <= 0 && vis) { e.st = 'aim'; e.stT = 0.42; }
      } else if (e.st === 'aim') {
        const ax = P.x + P.vx * 0.2 - e.x, ay = P.y + P.vy * 0.2 - e.y;
        e.la = Math.atan2(ay, ax); face = e.la;
        wx = -wx; wy = -wy; spd *= 0.18;
        e.windup = 1 - e.stT / 0.42;
        e.stT -= dt * (slow > 0 ? Math.max(0.5, slow) : 0);
        if (e.stT <= 0) { e.st = 'lunge'; e.stT = 0.34; Sound.play('lunge', e.x); }
      } else if (e.st === 'lunge') {
        wx = Math.cos(e.la); wy = Math.sin(e.la); face = e.la;
        spd = e.speed * 3.3 * slow;
        if (Math.random() < dt * 40 * FX) addParticle({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.25, max: 0.25, r: e.r * 0.6, color: 'rgba(255,120,80,0.5)' });
        e.stT -= dt;
        if (e.stT <= 0) { e.st = 'rest'; e.stT = 0.55; e.cd = rand(1.3, 2.3); }
      } else {
        spd *= 0.3;
        e.stT -= dt;
        if (e.stT <= 0) e.st = 'go';
      }
      break;
    }
    case 'spitter': {
      const stop = Math.min(250, Math.min(W, H) / 2 - 30);
      const wob = Math.sin(e.t * 3 + e.seed) * 0.45;
      const mx = wx, my = wy;
      wx = mx - my * wob; wy = my + mx * wob;
      if (hd < stop) {
        // מקיפה את הכוורת ויורקת
        wx = -my * 0.8 + (hd < stop - 30 ? -mx * 0.6 : 0);
        wy = mx * 0.8 + (hd < stop - 30 ? -my * 0.6 : 0);
        spd *= 0.6;
      }
      if (pd < 125) { // נסוגה מהדבורה
        wx += (-pdx / pd) * 1.3; wy += (-pdy / pd) * 1.3;
        const l = Math.hypot(wx, wy) || 1; wx /= l; wy /= l;
        spd = e.speed * slow * 0.9;
      }
      e.shootCd -= dt * slow;
      if (e.shootCd <= 0 && hd < stop + 60 && vis) {
        e.shootCd = rand(2, 2.8);
        const toBee = pd < 270;
        // מכוונת לאן שהדבורה תהיה
        const lead = toBee ? (pd / 230) * 0.55 : 0;
        const ax = toBee ? P.x + P.vx * lead : Hv.x, ay = toBee ? P.y + P.vy * lead : Hv.y;
        const a = Math.atan2(ay - e.y, ax - e.x);
        const n = e.elite ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const aa = a + (i - (n - 1) / 2) * 0.22;
          G.shots.push({ x: e.x, y: e.y, vx: Math.cos(aa) * 230, vy: Math.sin(aa) * 230, r: 6, dmg: 9 * D().dmg, life: 4, color: '#9ccc65' });
        }
        Sound.play('spit', e.x);
      }
      if (touch) { e.stinging = true; hurtHive(e.dmg * dt); }
      break;
    }
    case 'nurse': {
      // נשארת מאחור ומרפאת. כשנשארה לבד – תוקפת בעצמה
      e.lonely = allies > 0 ? 0 : e.lonely + dt;
      if (e.lonely > 4) {
        if (touch) { e.stinging = true; spd = 0; hurtHive(e.dmg * dt); }
        break;
      }
      const ringR = Math.min(300, Math.min(W, H) / 2 - 36);
      const rad = clamp((hd - ringR) / 60, -1, 1);
      const mx = wx, my = wy;
      wx = -my * 0.75 + mx * rad; wy = mx * 0.75 + my * rad;
      spd *= 0.75;
      if (pd < 150) { wx += (-pdx / pd) * 1.2; wy += (-pdy / pd) * 1.2; spd = e.speed * slow; }
      { const l = Math.hypot(wx, wy) || 1; wx /= l; wy /= l; }
      e.cd -= dt * slow;
      if (e.cd <= 0 && vis) {
        e.cd = 3.2;
        let healed = 0;
        for (const o of G.enemies) {
          if (o === e || o.hp <= 0 || o.hp >= o.maxHp || o.type === 'clone') continue;
          if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > 165 * 165) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (o.boss ? 0.006 : 0.15));
          G.arcs.push({ x1: e.x, y1: e.y, x2: o.x, y2: o.y, life: 0.4, max: 0.4, seed: 0, kind: 'heal' });
          burst(o.x, o.y, 3, '#7dff9a', 60, 'star');
          if (++healed >= 6) break;
        }
        if (healed) { G.rings.push({ x: e.x, y: e.y, r: 8, max: 165, life: 0.4, t: 0, color: '110,255,150' }); Sound.play('heal', e.x); }
      }
      break;
    }
    case 'thief': {
      const wob = Math.sin(e.t * 6 + e.seed) * 0.7;
      if (e.st === 'go') {
        // הולכת על הדבש שעל הקרקע; אם אין – גונבת מהמלאי בכוורת
        let best = null, bd = 1e12;
        for (const p of G.pickups) {
          if (p.kind !== 'honey' || p.life <= 0) continue;
          const d2 = (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
          if (d2 < bd) { bd = d2; best = p; }
        }
        if (best) {
          const l = Math.sqrt(bd) || 1;
          wx = (best.x - e.x) / l; wy = (best.y - e.y) / l;
          if (l < e.r + 8) {
            best.life = 0; e.loot++;
            burst(e.x, e.y, 3, '#ffb300', 80);
            Sound.play('steal', e.x);
            if (e.loot >= 3) e.st = 'flee';
          }
        } else if (touch) {
          spd = 0;
          e.stT += dt * slow;
          if (e.stT > 0.8) {
            e.stT = 0; e.tries++;
            if (G.honey > 0) { G.honey--; e.loot++; addFloater(Hv.x, Hv.y - 60, '-1 🍯', '#ff8a65', 18); Sound.play('steal', e.x); }
            else hurtHive(e.dmg);
            if (e.loot >= 3 || e.tries >= 3) e.st = 'flee';
          }
        }
        if (e.age > 14 && e.loot > 0) e.st = 'flee';
      }
      if (e.st === 'flee') {
        if (e.ex == null) {
          // בורחת לקצה הקרוב
          const opts = [[e.x, -60], [e.x, H + 60], [-60, e.y], [W + 60, e.y]];
          let b = opts[0], bd = 1e9;
          for (const o of opts) { const dd = Math.hypot(o[0] - e.x, o[1] - e.y); if (dd < bd) { bd = dd; b = o; } }
          e.ex = b[0]; e.ey = b[1];
        }
        const fx = e.ex - e.x, fy = e.ey - e.y, l = Math.hypot(fx, fy) || 1;
        wx = fx / l; wy = fy / l; spd *= 1.1;
        if (!onScreen(e, 34)) {
          if (e.loot > 0) addFloater(clamp(e.x, 60, W - 60), clamp(e.y, hudSafe + 30, H - 30), `Stolen: -${e.loot} 🍯`, '#ff8a65', 18);
          e.hp = 0; // ברחה – בלי ניקוד
          return;
        }
      }
      if (spd > 0) { const ox = wx, oy = wy; wx = ox - oy * wob * 0.5; wy = oy + ox * wob * 0.5; }
      break;
    }
    case 'clone': {
      // אשליה של הקיסר: חגה ויורה
      e.life -= dt;
      if (e.life <= 0 || !G.boss) { burst(e.x, e.y, 14, d.body, 160); e.hp = 0; return; }
      const R = Math.min(230, Math.min(W, H) / 2 - 60);
      e.orbitA += dt * 0.5 * e.orbDir * slow;
      const tx = Hv.x + Math.cos(e.orbitA) * R, ty = Hv.y + Math.sin(e.orbitA) * R;
      const l = Math.hypot(tx - e.x, ty - e.y) || 1;
      wx = (tx - e.x) / l; wy = (ty - e.y) / l; spd = Math.min(170, l * 3) * slow;
      face = Math.atan2(pdy, pdx);
      e.cd -= dt * slow;
      if (e.cd <= 0) {
        e.cd = 2.4;
        for (let i = -1; i <= 1; i++) { const a = face + i * 0.2; G.shots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 6, dmg: 8 * D().dmg, life: 5, color: '#b388ff' }); }
        Sound.play('spit', e.x);
      }
      break;
    }
    default: {
      // צרעה רגילה / משוריינת / נפץ / מגינה: אל הכוורת
      const heavy = d.ai === 'brute' || d.ai === 'guard';
      const wob = Math.sin(e.t * 3 + e.seed) * (heavy ? 0.15 : 0.45);
      const mx = wx, my = wy;
      wx = mx - my * wob; wy = my + mx * wob;
      if (d.ai === 'bomber') spd *= 1 + Math.min(1, e.age / 9) * 0.45; // הפתיל בוער – היא מאיצה
      if (d.ai === 'brute') { e.rage = e.hp < e.maxHp * 0.35; if (e.rage) spd *= 1.5; }
      if (touch) {
        e.stinging = true;
        if (d.bomb) {
          // צרעת נפץ הגיעה לכוורת
          explode(e.x, e.y, 80, 0);
          hurtHive(e.dmg);
          e.hp = 0;
          return;
        }
        spd = 0;
        if (d.ai === 'brute') {
          // מהלומה כבדה כל כמה רגעים
          const period = e.rage ? 1.1 : 1.5;
          e.stT += dt * slow;
          e.windup = clamp((e.stT / period - 0.6) / 0.4, 0, 1);
          if (e.stT >= period) {
            e.stT = 0;
            hurtHive(e.dmg * 1.25);
            addShake(5);
            G.rings.push({ x: e.x + wx * e.r, y: e.y + wy * e.r, r: 6, max: 46, life: 0.22, t: 0, color: '255,200,120' });
            burst(e.x + mx * e.r, e.y + my * e.r, 8, '#ffcf33', 160, 'spark');
            Sound.play('slam', e.x);
          }
        } else {
          hurtHive(e.dmg * dt * (slow > 0 ? 1 : 0));
          if (Math.random() < dt * 4 * FX) burst(e.x + hx * 0.3, e.y + hy * 0.3, 2, '#ffcf33', 60);
        }
      }
    }
  }

  // הפרדה בין צרעות
  let sx = 0, sy = 0;
  for (const o of G.enemies) {
    if (o === e || o.boss || o.hp <= 0) continue;
    const ox = e.x - o.x, oy = e.y - o.y, od = ox * ox + oy * oy, rr = (e.r + o.r) * 0.9;
    if (od < rr * rr && od > 0.01) { const l = Math.sqrt(od); sx += (ox / l) * (rr - l); sy += (oy / l) * (rr - l); }
  }

  e.x += (wx * spd + e.kx) * dt + sx * 0.5;
  e.y += (wy * spd + e.ky) * dt + sy * 0.5;
  const decay = Math.pow(0.02, dt);
  e.kx *= decay; e.ky *= decay;
  if (face != null) e.ang = face;
  else if (e.stinging) e.ang = Math.atan2(hy, hx);
  else if (spd > 1) e.ang += clamp(angDiff(Math.atan2(wy, wx), e.ang), -8 * dt, 8 * dt);
  // לא חודרות לתוך הכוורת
  const hd2 = Math.hypot(e.x - Hv.x, e.y - Hv.y) || 1;
  if (hd2 < Hv.r + e.r - 4) { e.x = Hv.x + ((e.x - Hv.x) / hd2) * (Hv.r + e.r - 4); e.y = Hv.y + ((e.y - Hv.y) / hd2) * (Hv.r + e.r - 4); }

  // מגע בדבורה
  const cd = Math.hypot(e.x - P.x, e.y - P.y);
  if (cd < e.r + P.r - 2) {
    const nx = (e.x - P.x) / (cd || 1), ny = (e.y - P.y) / (cd || 1);
    if (P.dashT > 0 && S.dashDmg) {
      if (e.dashHit !== P.dashId) {
        e.dashHit = P.dashId;
        damageEnemy(e, 30 * S.dashDmg + S.damage, nx, ny, 380);
        burst(e.x, e.y, 6, '#fff6c4', 200, 'spark');
      }
    } else if (P.inv <= 0) {
      hurtPlayer(e.dmg);
      e.kx += nx * 320; e.ky += ny * 320;
    }
  }
}

// ---------------- בוסים ----------------
function bossPhase(e) {
  const f = e.hp / e.maxHp;
  return e.def.phases === 3 ? (f < 0.34 ? 2 : f < 0.67 ? 1 : 0) : (f < 0.5 ? 1 : 0);
}
function bossShot(e, a, sp, dmg) {
  G.shots.push({ x: e.x + Math.cos(a) * e.r * 0.6, y: e.y + Math.sin(a) * e.r * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7, dmg: (dmg || 10) * D().dmg, life: 6, color: e.def.shot, hm: 0.5 });
}
function bossRing(e, n, sp) {
  const off = Math.random() * TAU;
  for (let i = 0; i < n; i++) bossShot(e, off + (i / n) * TAU, sp);
  Sound.play('spit', e.x);
}
function bossFan(e, n, sp) {
  const P = G.player;
  const d = Math.hypot(P.x - e.x, P.y - e.y);
  const lead = Math.min(0.6, d / sp * 0.5); // מכוון לאן שהדבורה תהיה
  const base = Math.atan2(P.y + P.vy * lead - e.y, P.x + P.vx * lead - e.x);
  for (let i = 0; i < n; i++) bossShot(e, base + (i - (n - 1) / 2) * 0.17, sp);
  Sound.play('spit', e.x);
}
function airstrike(n) {
  const P = G.player, Hv = G.hive;
  const pts = [[P.x, P.y, 1.0], [P.x + P.vx * 0.7, P.y + P.vy * 0.7, 1.15]];
  for (let i = 0; i < n; i++) pts.push([P.x + rand(-180, 180), P.y + rand(-180, 180), rand(1.2, 1.7)]);
  for (const p of pts) {
    let x = clamp(p[0], 40, W - 40), y = clamp(p[1], hudSafe + 40, H - 40);
    const dx = x - Hv.x, dy = y - Hv.y, d = Math.hypot(dx, dy) || 1, min = Hv.r + 52;
    if (d < min) { x = Hv.x + (dx / d) * min; y = Hv.y + (dy / d) * min; }
    G.marks.push({ x, y, r: 60, t: 0, delay: p[2], dmg: 16 * D().dmg });
  }
  Sound.play('mark');
}
function bossSummon(e, kinds) {
  if (G.enemies.length >= 40) return;
  for (const k of kinds) { const m = spawnEnemy(k, e.x + rand(-34, 34), e.y + rand(-34, 34), true); m.spawnT = 0.3; }
  burst(e.x, e.y, 12, e.def.body, 130);
}

function bossAttack(e, a, ph) {
  const def = e.def, P = G.player, Hv = G.hive;
  e.atkCd = def.atkCd;
  switch (a) {
    case 'charge': e.mode = 'windup'; e.modeT = 0; e.windT = 0.75; e.charges = e.kind === 'emperor' && ph === 2 ? 2 : 1; Sound.play('warn', e.x); break;
    case 'charge3': e.mode = 'windup'; e.modeT = 0; e.windT = 0.55; e.charges = 3; Sound.play('warn', e.x); break;
    case 'dive': e.mode = 'windupHive'; e.modeT = 0; e.windDmg = 0; Sound.play('warn', e.x); addFloater(e.x, e.y - e.r - 20, 'Diving at the hive!', '#ffab91', 18); break;
    case 'summon':
      if (e.kind === 'queen') bossSummon(e, ph ? ['wasp', 'wasp', 'hornet', 'hornet'] : ['wasp', 'wasp', 'wasp']);
      else bossSummon(e, ph === 2 ? ['hornet', 'hornet', 'nurse', 'spitter'] : ph === 1 ? ['hornet', 'spitter', 'guard'] : ['hornet', 'hornet']);
      e.atkCd = def.atkCd * 0.6;
      break;
    case 'burst': bossRing(e, (e.kind === 'queen' ? 10 : 16) + ph * 5, 190); break;
    case 'aimed': bossFan(e, 5 + ph, 280); break;
    case 'spiral': e.mode = 'spiral'; e.modeT = 0; break;
    case 'strike': airstrike(ph ? 4 : 2); e.atkCd = def.atkCd * 0.8; break;
    case 'squad': {
      if (G.enemies.length < 36) {
        const pt = farEdgePoint();
        const types = ph ? ['guard', 'brute', 'bomber', 'bomber'] : ['guard', 'bomber', 'bomber'];
        types.forEach((t, i) => {
          const ux = Hv.x - pt.x, uy = Hv.y - pt.y, l = Math.hypot(ux, uy) || 1, rk = Math.ceil(i / 2);
          spawnEnemy(t, pt.x + (-uy / l) * (i % 2 ? 1 : -1) * rk * 32 - (ux / l) * rk * 30, pt.y + (ux / l) * (i % 2 ? 1 : -1) * rk * 32 - (uy / l) * rk * 30, true);
        });
        addFloater(clamp(pt.x, 80, W - 80), clamp(pt.y, hudSafe + 30, H - 30), 'Squadron!', '#ffab91', 18);
        Sound.play('warn');
      }
      break;
    }
    case 'teleport': e.mode = 'tpOut'; e.modeT = 0; Sound.play('teleport', e.x); break;
    case 'beam': e.mode = 'beamCharge'; e.modeT = 0; e.beamA = Math.atan2(P.y - e.y, P.x - e.x); e.beam = { on: false, len: 1400 }; Sound.play('beamCharge', e.x); break;
    case 'clones': {
      for (let i = 0; i < 2; i++) {
        const c = spawnEnemy('clone', e.x, e.y, true);
        c.hp = c.maxHp = e.maxHp * 0.035; c.dmg = 8 * D().dmg; c.speed = 170;
        c.orbitA = e.orbitA + (i ? 2.1 : -2.1); c.orbDir = i ? 1 : -1; c.life = 13; c.cd = 1 + i * 0.8; c.spawnT = 0.4;
      }
      burst(e.x, e.y, 20, '#b388ff', 220, 'star');
      Sound.play('teleport', e.x);
      break;
    }
  }
}

function updateBoss(e, dt) {
  const P = G.player, Hv = G.hive, def = e.def;
  const ph = bossPhase(e);
  const orbitR = Math.min(def.orbitR, Math.min(W, H) / 2 - e.r - 10);
  const toBee = Math.atan2(P.y - e.y, P.x - e.x);
  const moveTo = (tx, ty, spd) => {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d > 1) { const s = Math.min(d, spd * dt); e.x += (dx / d) * s; e.y += (dy / d) * s; }
    return d;
  };
  const toOrbit = () => { e.mode = 'return'; e.modeT = 0; e.orbitA = Math.atan2(e.y - Hv.y, e.x - Hv.x); };

  // מעבר שלב: שאגה קצרה, ואז סדרת התקפות חדשה
  if (ph !== e.phase && e.mode !== 'enter') {
    e.phase = ph; e.phase2 = true; e.atkIdx = 0;
    e.mode = 'roar'; e.modeT = 0; e.beam = null; e.stagger = false;
    for (let i = 0; i < 3; i++) G.rings.push({ x: e.x, y: e.y, r: 10, max: 150 + i * 80, life: 0.35 + i * 0.12, t: 0, color: '255,70,70' });
    addShake(12);
    Sound.play('boss');
    const msg = e.kind === 'queen' ? 'The Queen is furious!' : e.kind === 'general' ? 'The General orders an all-out attack!' : ph === 1 ? 'The Emperor bends space itself!' : 'The Emperor unleashes everything!';
    showBanner(msg, '', 1.5);
  }
  const rate = 1 + ph * 0.35;
  e.modeT += dt;
  if (e.exposed > 0) e.exposed -= dt;
  e.shield = false; e.invuln = false; e.fade = 1; e.windup = 0;

  switch (e.mode) {
    case 'enter': {
      const tx = Hv.x + Math.cos(e.orbitA) * orbitR, ty = Hv.y + Math.sin(e.orbitA) * orbitR;
      e.ang = Math.atan2(ty - e.y, tx - e.x);
      if (moveTo(tx, ty, 130) < 4) { e.mode = 'orbit'; e.modeT = 0; }
      break;
    }
    case 'roar':
      e.invuln = true;
      e.ang = toBee;
      e.x += Math.sin(e.modeT * 70) * 1.5;
      if (e.modeT > 0.9) { e.mode = 'orbit'; e.modeT = 0; e.atkCd = 1.1; }
      break;
    case 'orbit': {
      e.orbitA += dt * 0.32 * rate * e.orbDir;
      moveTo(Hv.x + Math.cos(e.orbitA) * orbitR, Hv.y + Math.sin(e.orbitA) * orbitR, e.speed * 2);
      if (e.kind === 'general') {
        // הגנרל מסתובב לאט – אפשר לעקוף את המגן שלו
        const tr = (1.3 + ph * 0.5) * dt;
        e.ang += clamp(angDiff(toBee, e.ang), -tr, tr);
        e.shield = e.shieldDown <= 0 && e.exposed <= 0;
      } else e.ang = toBee;
      e.atkCd -= dt * rate;
      if (e.atkCd <= 0) {
        const script = BOSS_SCRIPTS[e.kind][ph];
        bossAttack(e, script[e.atkIdx++ % script.length], ph);
      }
      break;
    }
    case 'windup':
      e.ang = toBee;
      e.x += Math.sin(e.modeT * 60) * 1.5;
      e.windup = Math.min(1, e.modeT / e.windT);
      if (e.modeT > e.windT) {
        e.cvx = Math.cos(e.ang) * def.chargeSpeed; e.cvy = Math.sin(e.ang) * def.chargeSpeed;
        e.mode = 'charge'; e.modeT = 0;
        Sound.play('charge', e.x);
      }
      break;
    case 'charge': {
      e.x += e.cvx * dt; e.y += e.cvy * dt;
      if (Math.random() < 0.6 * FX) burst(e.x, e.y, 1, def.wing, 40);
      const out = e.x < e.r || e.x > W - e.r || e.y < e.r + hudSafe || e.y > H - e.r;
      if (e.modeT > 0.9 || out) {
        e.x = clamp(e.x, e.r, W - e.r); e.y = clamp(e.y, e.r + hudSafe, H - e.r);
        if (e.kind === 'queen' && ph) bossRing(e, 8, 200);
        if (--e.charges > 0) { e.mode = 'windup'; e.modeT = 0; e.windT = 0.42; }
        else { toOrbit(); if (e.kind === 'general') e.exposed = 2.6; }
      }
      break;
    }
    case 'windupHive':
      // המלכה מכוונת לכוורת – מספיק נזק עכשיו והיא מתנדנדת
      e.ang = Math.atan2(Hv.y - e.y, Hv.x - e.x);
      e.x += Math.sin(e.modeT * 60) * 1.2;
      e.windup = Math.min(1, e.modeT / 1.35);
      if (e.windDmg >= e.maxHp * 0.035) {
        e.mode = 'stagger'; e.modeT = 0; e.stagger = true;
        addFloater(e.x, e.y - e.r - 20, 'Staggered!', '#fff59d', 22);
        burst(e.x, e.y, 16, '#fff59d', 220, 'star');
        Sound.play('shieldBreak', e.x);
      } else if (e.modeT > 1.35) {
        e.cvx = Math.cos(e.ang) * def.chargeSpeed; e.cvy = Math.sin(e.ang) * def.chargeSpeed;
        e.mode = 'chargeHive'; e.modeT = 0;
        Sound.play('charge', e.x);
      }
      break;
    case 'chargeHive':
      e.x += e.cvx * dt; e.y += e.cvy * dt;
      if (e.modeT > 1.2) toOrbit();
      break;
    case 'stagger':
      e.ang += dt * 5;
      if (e.modeT > 1.9) { e.stagger = false; e.mode = 'orbit'; e.modeT = 0; e.atkCd = 1; }
      break;
    case 'return': {
      const tx = Hv.x + Math.cos(e.orbitA) * orbitR, ty = Hv.y + Math.sin(e.orbitA) * orbitR;
      e.ang = Math.atan2(ty - e.y, tx - e.x);
      if (moveTo(tx, ty, 200) < 4 || e.modeT > 3) { e.mode = 'orbit'; e.modeT = 0; }
      break;
    }
    case 'spiral':
      e.spiralCd -= dt;
      e.ang += dt * 4;
      if (e.spiralCd <= 0) {
        e.spiralCd = ph ? 0.07 : 0.09;
        e.spiralA += 0.38;
        const arms = 1 + ph;
        for (let i = 0; i < arms; i++) bossShot(e, e.spiralA + (i / arms) * TAU, 170);
      }
      if (e.modeT > 2.6) { e.mode = 'orbit'; e.modeT = 0; }
      break;
    case 'tpOut':
      e.invuln = true; e.fade = Math.max(0, 1 - e.modeT / 0.45);
      if (e.modeT > 0.45) {
        // מופיע בצד הרחוק מהדבורה
        e.orbitA = Math.atan2(P.y - Hv.y, P.x - Hv.x) + Math.PI + rand(-0.7, 0.7);
        burst(e.x, e.y, 16, '#b388ff', 200, 'star');
        e.x = Hv.x + Math.cos(e.orbitA) * orbitR; e.y = Hv.y + Math.sin(e.orbitA) * orbitR;
        e.mode = 'tpIn'; e.modeT = 0;
      }
      break;
    case 'tpIn':
      e.invuln = true; e.fade = Math.min(1, e.modeT / 0.35); e.ang = toBee;
      if (e.modeT > 0.35) {
        bossRing(e, 12 + ph * 2, 210);
        G.rings.push({ x: e.x, y: e.y, r: 10, max: 120, life: 0.3, t: 0, color: '190,140,255' });
        e.mode = 'orbit'; e.modeT = 0; e.atkCd = 0.9;
      }
      break;
    case 'beamCharge': {
      const tr = 1.5 * dt;
      e.beamA += clamp(angDiff(toBee, e.beamA), -tr, tr);
      e.ang = e.beamA;
      e.windup = Math.min(1, e.modeT / 0.95);
      if (e.modeT > 0.95) {
        e.mode = 'beam'; e.modeT = 0;
        e.beamDir = angDiff(toBee, e.beamA) >= 0 ? 1 : -1;
        e.beam.on = true;
        addShake(6);
        Sound.play('beam', e.x);
      }
      break;
    }
    case 'beam': {
      // קרן שסורקת לכיוון הדבורה; הכוורת עוצרת אותה (וסופגת נזק)
      e.beamA += e.beamDir * (0.5 + ph * 0.1) * dt;
      e.ang = e.beamA;
      const dx = Math.cos(e.beamA), dy = Math.sin(e.beamA);
      let len = 1500;
      const th = (Hv.x - e.x) * dx + (Hv.y - e.y) * dy;
      if (th > 0) {
        const perp = Math.abs((Hv.x - e.x) * dy - (Hv.y - e.y) * dx), R = Hv.r + 4;
        if (perp < R) { len = th - Math.sqrt(R * R - perp * perp); hurtHive(7 * D().dmg * dt); if (Math.random() < 0.5 * FX) burst(e.x + dx * len, e.y + dy * len, 1, '#ff8a80', 140, 'spark'); }
      }
      e.beam.len = len;
      const tb = (P.x - e.x) * dx + (P.y - e.y) * dy;
      if (tb > 0 && tb < len && Math.abs((P.x - e.x) * dy - (P.y - e.y) * dx) < 13 + P.r) hurtPlayer(e.dmg * 0.7);
      if (e.modeT > 1.5) { e.beam = null; e.mode = 'orbit'; e.modeT = 0; e.atkCd = 1.2; }
      break;
    }
  }

  if (e.invuln) return;
  // מגע עם הכוורת / הדבורה
  const hd = Math.hypot(e.x - Hv.x, e.y - Hv.y) || 1;
  if (hd < Hv.r + e.r) {
    const ramming = e.mode === 'charge' || e.mode === 'chargeHive';
    if (ramming) {
      hurtHive(e.dmg * (e.mode === 'chargeHive' ? 1.5 : 0.8));
      addShake(14);
      G.rings.push({ x: e.x + (Hv.x - e.x) * 0.5, y: e.y + (Hv.y - e.y) * 0.5, r: 8, max: 90, life: 0.3, t: 0, color: '255,160,90' });
      Sound.play('slam', Hv.x);
    } else hurtHive(e.dmg * 1.5 * dt);
    e.x = Hv.x + ((e.x - Hv.x) / hd) * (Hv.r + e.r);
    e.y = Hv.y + ((e.y - Hv.y) / hd) * (Hv.r + e.r);
    if (ramming) { e.charges = 0; toOrbit(); if (e.kind === 'general') e.exposed = 2.6; }
  }
  const cd = Math.hypot(e.x - P.x, e.y - P.y);
  if (cd < e.r + P.r - 4) {
    if (P.dashT > 0 && G.stats.dashDmg) {
      if (e.dashHit !== P.dashId) { e.dashHit = P.dashId; damageEnemy(e, 30 * G.stats.dashDmg + G.stats.damage, 0, 0, 0); }
    } else hurtPlayer(e.dmg);
  }
}

// ---------------- אפקטים ----------------
function updateEffects(dt) {
  for (const p of G.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
    if (p.grow) p.r += p.grow * dt;
    if (p.vr) p.rot += p.vr * dt;
  }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const c of G.corpses) { c.x += c.vx * dt; c.y += c.vy * dt; c.ang += c.spin * dt; c.life -= dt; }
  G.corpses = G.corpses.filter((c) => c.life > 0);
  for (const d of G.decals) d.life -= dt;
  G.decals = G.decals.filter((d) => d.life > 0);
  for (const a of G.arcs) a.life -= dt;
  G.arcs = G.arcs.filter((a) => a.life > 0);
  for (const g of G.ghosts) g.life -= dt;
  G.ghosts = G.ghosts.filter((g) => g.life > 0);
  // עשן כשהכוורת במצב קשה
  if (G.hive.hp / G.hive.maxHp < 0.35 && Math.random() < dt * 7 * FX) {
    addParticle({ x: G.hive.x + rand(-25, 25), y: G.hive.y + rand(-25, 10), vx: rand(-15, 15), vy: rand(-60, -30), life: 1.2, max: 1.2, r: rand(5, 9), grow: 14, a: 0.45, color: '#3a3a3a', kind: 'smoke' });
  }
  for (const f of G.floaters) { f.y -= 40 * dt; f.life -= dt; }
  G.floaters = G.floaters.filter((f) => f.life > 0);
  for (const r of G.rings) { r.t += dt; r.r = 10 + (r.max - 10) * Math.min(1, r.t / r.life); }
  G.rings = G.rings.filter((r) => r.t < r.life + 0.15);
  if (shake > 0) shake = Math.max(0, shake - dt * 30);
}

// ---------------- מעברי מצב ----------------
function levelClear() {
  setState('clear');
  G.shots = []; G.marks = [];
  const hivePct = G.hive.hp / G.hive.maxHp;
  const bonus = Math.round((G.level * 100 + Math.round(hivePct * 100) * G.level * 2) * D().score);
  G.lastBonus = bonus;
  G.score += bonus;
  if (G.level >= 3 && G.lvl.hiveDmg <= 0) unlock('clean');
  Sound.play('level');
  showBanner('Level complete! 🎉', 'Bonus: ' + fmt(bonus), 1.7);
}

function afterClear() {
  // לוקחים את כל הדבש שנשאר על הרצפה
  let left = 0;
  G.pickups.forEach((p) => { if (p.kind === 'honey') left++; });
  if (left) collectHoney(left);
  G.pickups = [];
  if (G.seenDirty) { G.seenDirty = false; saveProfile(); }
  if (G.level === MAX_LEVEL && !G.endless) { G.beat = true; endGame(true); return; }
  // תיקון אוטומטי לכוורת בין שלבים – גדול יותר אחרי קרב בוס
  G.lastRepair = G.plan.boss ? 0.25 : 0.1;
  G.hive.hp = Math.min(G.hive.maxHp, G.hive.hp + G.hive.maxHp * G.lastRepair);
  G.player.hp = Math.min(G.stats.maxHp, G.player.hp + G.stats.maxHp * 0.2);
  openUpgrade();
}

function gameOver(by) {
  if (state !== 'playing') return;
  G.deathBy = by;
  G.deathReason = by === 'hive' ? 'The hive was destroyed' : 'The bee took too many hits';
  setState('dying');
  addShake(18);
  vibrate(200);
  slowMo = 0;
  const t = by === 'hive' ? G.hive : G.player;
  burst(t.x, t.y, 60, '#ffb703', 260);
  burst(t.x, t.y, 30, '#fff3b0', 320, 'spark');
  for (let i = 0; i < 3; i++) G.rings.push({ x: t.x, y: t.y, r: 10, max: 100 + i * 60, life: 0.4 + i * 0.15, t: 0, color: '255,190,60' });
  hideBossBar();
}

function endGame(won) {
  setState('over');
  hideBossBar();
  Sound.play(won ? 'win' : 'over');
  clearRun();
  // ג׳לי מלכות וסטטיסטיקה – רק מה שעוד לא שולם בריצה הזאת (מצב אינסופי ממשיך את אותה ריצה)
  const cleared = won ? G.level : G.level - 1;
  const totalJelly = Math.round((cleared * 3 + G.bossKills * 10 + Math.floor(G.kills / 20) + (G.beat ? 25 : 0)) * DIFFS[G.diff].jelly);
  const jelly = Math.max(0, totalJelly - G.paid.jelly);
  G.paid.jelly += jelly;
  profile.jelly += jelly; profile.jellyTotal += jelly;
  const st = profile.stats;
  st.kills += Math.max(0, G.kills - G.paid.kills); G.paid.kills = G.kills;
  st.honey += Math.max(0, G.honeyTotal - G.paid.honey); G.paid.honey = G.honeyTotal;
  st.time += Math.max(0, G.time - G.paid.time); G.paid.time = G.time;
  st.bestLevel = Math.max(st.bestLevel, cleared);
  st.bestCombo = Math.max(st.bestCombo, G.maxCombo);
  st.bestScore = Math.max(st.bestScore, G.score);
  if (won && !G.endless) st.wins++;
  saveProfile();
  if (won && !G.endless && G.diff === 'hard') unlock('hard');
  if (st.kills >= 1000) unlock('kills1000');
  G.won = won || G.beat;
  G.saved = false;
  showGameOver(won, jelly);
}

function pauseGame() {
  if (state !== 'playing') return;
  setState('paused');
  keys.clear();
  showScreen('pause');
}
function resumeGame() {
  if (state !== 'paused') return;
  hideScreens();
  setState('playing');
  lastTime = performance.now();
}
function toMenu() {
  G = null;
  slowMo = 0;
  setState('menu');
  hideBossBar();
  $('banner').classList.add('hidden');
  setTheme('meadow');
  showScreen('menu');
}

// ---------------- חנות ושדרוגים (הלוגיקה; התצוגה ב-ui.js) ----------------
const HIVE_COST = 10, BEE_COST = 8;
const shopCost = (base) => Math.max(1, Math.round(base * G.stats.shopMul));
const rerollCost = () => (G.freeRerollsLeft > 0 ? 0 : shopCost(4 + 2 * G.rerolls));

function buyRepair(which) {
  const cost = shopCost(which === 'hive' ? HIVE_COST : BEE_COST);
  const full = which === 'hive' ? G.hive.hp >= G.hive.maxHp : G.player.hp >= G.stats.maxHp;
  if (G.honey < cost || full) { Sound.play('denied'); return false; }
  G.honey -= cost;
  if (which === 'hive') G.hive.hp = Math.min(G.hive.maxHp, G.hive.hp + 50);
  else G.player.hp = Math.min(G.stats.maxHp, G.player.hp + 40);
  Sound.play('buy');
  return true;
}
function rerollCards() {
  const cost = rerollCost();
  if (G.honey < cost) { Sound.play('denied'); return false; }
  G.honey -= cost;
  if (G.freeRerollsLeft > 0) G.freeRerollsLeft--; else G.rerolls++;
  G.offer = rollUpgrades(G.taken, 3, G.offerBoss);
  Sound.play('reroll');
  return true;
}
function chooseUpgrade(u) {
  if (state !== 'upgrade') return;
  u.apply(G.stats, G);
  G.taken[u.id] = (G.taken[u.id] || 0) + 1;
  G.player.hp = Math.min(G.player.hp, G.stats.maxHp);
  if (u.rarity === 'l') { unlock('legend'); Sound.play('legend'); } else Sound.play('upgrade');
  hideScreens();
  startLevel(G.level + 1);
}
