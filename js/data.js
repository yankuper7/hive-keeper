/* Hive Keeper – data: אויבים, בוסים, שלבים, שדרוגים, שדרוגי קבע והישגים */
'use strict';

// ---------------- אויבים ----------------
// ai: התנהגות · target: מטרה ראשית · knock: כמה הדיפה משפיעה
const ETYPES = {
  wasp:    { name: 'Wasp',         info: 'Flies straight for the hive.', hp: 22,  speed: 72,  r: 14, dmg: 9,  score: 10, honey: 1, target: 'hive', ai: 'basic',
             body: '#f2b705', stripe: '#1d1d1d', head: '#3a2a00', wing: 'rgba(220,235,255,0.55)', eye: '#c62828' },
  hornet:  { name: 'Hornet',       info: 'Hunts the bee. Circles, then lunges – dash away when it flashes!', hp: 16,  speed: 128, r: 12, dmg: 12, score: 15, honey: 1, target: 'bee', ai: 'hornet',
             body: '#e0452b', stripe: '#2a0e05', head: '#5a1608', wing: 'rgba(255,220,220,0.55)', eye: '#ffeb3b' },
  brute:   { name: 'Armored Wasp', info: 'Slow and tough. Slams the hive hard and goes berserk when wounded.', hp: 98,  speed: 42,  r: 22, dmg: 18, score: 40, honey: 4, target: 'hive', ai: 'brute', knock: 0.35,
             body: '#7a4a12', stripe: '#1a1a1a', head: '#2b1800', wing: 'rgba(200,200,200,0.5)', eye: '#ff7043' },
  spitter: { name: 'Spitter',      info: 'Keeps its distance and spits venom. Backs away when you get close.', hp: 34,  speed: 62,  r: 15, dmg: 8,  score: 25, honey: 2, target: 'hive', ai: 'spitter',
             body: '#7cb342', stripe: '#1b3a0b', head: '#2e4d12', wing: 'rgba(220,255,220,0.55)', eye: '#ff1744' },
  bomber:  { name: 'Bomb Wasp',    info: 'Explodes on the hive. Pop it early and the blast hurts other wasps.', hp: 30,  speed: 84,  r: 15, dmg: 22, score: 30, honey: 2, target: 'hive', ai: 'bomber', bomb: true,
             body: '#b71c1c', stripe: '#ffb300', head: '#2a0000', wing: 'rgba(255,200,180,0.55)', eye: '#ffffff' },
  splitter:{ name: 'Mother Wasp',  info: 'Splits into three little wasps when defeated.', hp: 62,  speed: 54,  r: 19, dmg: 12, score: 35, honey: 2, target: 'hive', ai: 'basic', split: 3,
             body: '#8e24aa', stripe: '#1a0d24', head: '#2c0a3a', wing: 'rgba(235,210,255,0.55)', eye: '#ffeb3b' },
  mini:    { name: 'Waspling',     info: 'Tiny and quick.', hp: 8,   speed: 125, r: 9,  dmg: 5,  score: 5,  honey: 0, target: 'hive', ai: 'basic', hidden: true,
             body: '#ba68c8', stripe: '#1a0d24', head: '#2c0a3a', wing: 'rgba(235,210,255,0.55)', eye: '#ffeb3b' },
  guard:   { name: 'Shield Wasp',  info: 'Its shield blocks stings from the front. Flank it, or break the shield with a buzz wave.', hp: 50,  speed: 56,  r: 17, dmg: 11, score: 40, honey: 3, target: 'hive', ai: 'guard', knock: 0.6,
             body: '#5c7fa3', stripe: '#16263a', head: '#22364d', wing: 'rgba(210,230,255,0.55)', eye: '#ffd54f' },
  nurse:   { name: 'Nurse Wasp',   info: 'Hangs back and heals the swarm. Take it out first!', hp: 38,  speed: 66,  r: 14, dmg: 6,  score: 45, honey: 3, target: 'hive', ai: 'nurse',
             body: '#f4f1e4', stripe: '#3aa655', head: '#2f6b3d', wing: 'rgba(225,255,235,0.6)', eye: '#1b5e20' },
  thief:   { name: 'Robber Wasp',  info: 'Steals honey and runs. Catch it before it escapes to get it all back.', hp: 26,  speed: 150, r: 12, dmg: 3,  score: 30, honey: 2, target: 'honey', ai: 'thief',
             body: '#3d3d46', stripe: '#c9a227', head: '#17171c', wing: 'rgba(215,215,235,0.5)', eye: '#ffffff' },
  clone:   { name: 'Illusion',     info: '', hp: 1, speed: 80, r: 44, dmg: 10, score: 50, honey: 0, target: 'bee', ai: 'clone', hidden: true,
             body: '#6a3fb0', stripe: '#ffb300', head: '#1a0033', wing: 'rgba(210,190,255,0.4)', eye: '#ff1744' },
};
const GUIDE_ORDER = ['wasp', 'hornet', 'brute', 'spitter', 'thief', 'bomber', 'guard', 'splitter', 'nurse'];

// ---------------- בוסים ----------------
const BOSSES = {
  queen:   { name: 'Wasp Queen',   title: 'Mother of the swarm', tip: 'Tip: sting her hard while she winds up a dive – she staggers', info: 'Charges at you, calls her guard and dives at the hive. Hit her hard while she winds up a dive to stagger her.',
             hp: 1500, r: 46, speed: 70, dmg: 18, score: 1000, honey: 25, phases: 2,
             body: '#d81b60', stripe: '#1a1a1a', head: '#4a0020', wing: 'rgba(255,200,230,0.55)', eye: '#ffeb3b', shot: '#f48fb1',
             orbitR: 250, atkCd: 3.6, chargeSpeed: 470 },
  general: { name: 'Wasp General', title: 'Commander of the siege', tip: 'Tip: his shield blocks stings – get behind him or break it with a buzz wave', info: 'Hides behind a shield, calls air strikes and squadrons. He is exposed right after a charge – or after a buzz wave.',
             hp: 2300, r: 50, speed: 75, dmg: 25, score: 2000, honey: 30, phases: 2,
             body: '#546e7a', stripe: '#c62828', head: '#1c262b', wing: 'rgba(200,230,255,0.55)', eye: '#ffca28', shot: '#90a4ae',
             orbitR: 260, atkCd: 3.1, chargeSpeed: 500 },
  emperor: { name: 'Wasp Emperor', title: 'Lord of the wasteland', tip: 'Tip: keep moving, and dash through the death ray', info: 'Three phases: bullet storms, teleports, a sweeping death ray and illusions.',
             hp: 3600, r: 56, speed: 80, dmg: 28, score: 3000, honey: 0, phases: 3,
             body: '#4a148c', stripe: '#ffb300', head: '#1a0033', wing: 'rgba(210,190,255,0.55)', eye: '#ff1744', shot: '#ce93d8',
             orbitR: 270, atkCd: 2.7, chargeSpeed: 520 },
};
// סדר ההתקפות בכל שלב של הבוס
const BOSS_SCRIPTS = {
  queen:   [['charge', 'summon', 'dive', 'burst'], ['charge3', 'summon', 'dive', 'burst', 'charge3']],
  general: [['aimed', 'strike', 'squad', 'charge', 'strike', 'aimed'], ['strike', 'aimed', 'charge', 'squad', 'strike', 'burst', 'charge']],
  emperor: [['aimed', 'burst', 'spiral', 'charge', 'summon'],
            ['teleport', 'beam', 'burst', 'aimed', 'spiral', 'summon', 'teleport', 'charge'],
            ['clones', 'beam', 'teleport', 'spiral', 'strike', 'burst', 'teleport', 'beam', 'summon']],
};

// ---------------- נופים: כל כמה שלבים הרקע ומזג האוויר מתחלפים (למוזיקה יש רצועה לכל שלב – ראו audio.js) ----------------
const LEVEL_THEMES = ['meadow', 'meadow', 'golden', 'golden', 'sunset', 'autumn', 'autumn', 'storm', 'frost', 'ember'];
const themeIdFor = (level) => LEVEL_THEMES[(Math.max(1, level) - 1) % 10];

const LEVEL_SUBTITLES = [
  'The first wasps arrive',
  'Hornets hunt the bee – dash when they flash!',
  'Armored wasps incoming',
  'Spitters and honey robbers',
  'Boss: the Wasp Queen!',
  'Bomb wasps and shield wasps',
  'Mother wasps and their nurses',
  'Boss: the Wasp General!',
  'The elite swarm before the end',
  'Final boss: the Wasp Emperor!',
];

function levelPlan(n) {
  // אחרי שלב 10 (מצב אינסופי): בוס כל 5 שלבים, בסבב
  const boss = n <= 10 ? ({ 5: 'queen', 8: 'general', 10: 'emperor' }[n] || null)
    : (n % 5 === 0 ? ['queen', 'general', 'emperor'][(n / 5) % 3] : null);
  const realN = n;
  let total = Math.min(96, 10 + n * 5);
  n = Math.min(n, 12); // תמהיל הסוגים מתייצב
  if (boss) total = Math.round(total * 0.45);
  const w = {
    wasp: 1,
    hornet: n >= 2 ? 0.2 + 0.045 * n : 0,
    brute: n >= 3 ? 0.08 + 0.028 * n : 0,
    spitter: n >= 4 ? 0.12 + 0.028 * n : 0,
    thief: n >= 4 ? 0.07 + 0.008 * n : 0,
    bomber: n >= 6 ? 0.08 + 0.02 * n : 0,
    guard: n >= 6 ? 0.05 + 0.013 * n : 0,
    splitter: n >= 7 ? 0.06 + 0.02 * n : 0,
    nurse: n >= 7 ? 0.05 + 0.01 * n : 0,
  };
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  const list = [];
  for (let i = 0; i < total; i++) {
    if (i < 3) { list.push('wasp'); continue; }
    let r = Math.random() * sum, got = 'wasp';
    for (const k in w) { r -= w[k]; if (r <= 0) { got = k; break; } }
    list.push(got);
  }
  // הסוגים החדשים של השלב מופיעים בוודאות, מוקדם
  const intro = { 2: ['hornet'], 3: ['brute'], 4: ['spitter', 'thief'], 6: ['bomber', 'guard'], 7: ['splitter', 'nurse'] }[n] || [];
  intro.forEach((t, i) => { list[3 + i * 2] = t; if (list.length > 8 + i) list[7 + i * 3] = t; });
  // מחלקים לגלים: קבוצות שמגיעות יחד במבנה
  const maxGroup = n <= 3 ? 2 : n <= 6 ? 4 : 5; // גם בשלב 1 מגיעים לפעמים זוגות – אחרי ההדרכה שלב של צרעה-צרעה היה איטי מדי
  const interval = Math.max(realN > 10 ? 0.6 : 0.75, 1.65 - n * 0.09) * D().spawn;
  const waves = [];
  let i = 0;
  const finalAt = Math.floor(total * 0.82);
  while (i < list.length) {
    const rush = !boss && n >= 2 && i >= finalAt;
    let size = 1;
    if (i >= 3 && maxGroup > 1) size = Math.random() < 0.45 ? 1 : 1 + Math.floor(Math.random() * maxGroup);
    if (rush) size = Math.min(maxGroup + 1, 2 + Math.floor(Math.random() * maxGroup));
    size = Math.min(size, list.length - i, rush || i >= finalAt ? 99 : Math.max(1, finalAt - i));
    const types = list.slice(i, i + size);
    let form = 'line';
    if (size >= 4 && n >= 5 && Math.random() < 0.35) form = 'ring';
    else if (size >= 2 && n >= 3 && Math.random() < 0.4) form = 'pincer';
    else if (size >= 3 && Math.random() < 0.5) form = 'vee';
    waves.push({ types, form, rush: rush && waves.every((x) => !x.rush), gap: interval * (0.5 + 0.5 * size) * rand(0.8, 1.2) * (rush ? 0.7 : 1) });
    i += size;
  }
  return {
    waves, total: list.length,
    interval,
    hpMul: (1 + 0.085 * (realN - 1)) * D().hp,
    speedMul: 1 + 0.035 * (Math.min(realN, 14) - 1),
    eliteChance: realN >= 9 ? Math.min(0.25, 0.07 + 0.012 * (realN - 9)) : 0,
    boss,
    bossMul: realN > 10 ? 1 + (realN - 10) * 0.12 : 1,
  };
}

// ---------------- שדרוגים ----------------
// rarity: c רגיל · r נדיר · e אפי · l אגדי
const RARITY = {
  c: { name: 'Common', weight: 100, bossWeight: 45 },
  r: { name: 'Rare', weight: 46, bossWeight: 60 },
  e: { name: 'Epic', weight: 17, bossWeight: 40 },
  l: { name: 'Legendary', weight: 4, bossWeight: 15 },
};
const UPGRADES = [
  { id: 'dmg',    rarity: 'c', icon: '🗡️', name: 'Sharp Stinger',  desc: 'Sting damage +25%', max: 6, apply: (s) => { s.damage *= 1.25; } },
  { id: 'rate',   rarity: 'c', icon: '⚡', name: 'Quick Buzz',     desc: 'Sting rate +20%', max: 6, apply: (s) => { s.fireRate *= 1.2; } },
  { id: 'speed',  rarity: 'c', icon: '🪽', name: 'Strong Wings',   desc: 'Flight speed +15%', max: 4, apply: (s) => { s.speed *= 1.15; } },
  { id: 'armor',  rarity: 'c', icon: '🛡️', name: 'Wax Armor',      desc: 'Bee health +25 and a full heal', max: 5, apply: (s, g) => { s.maxHp += 25; g.player.hp = s.maxHp; } },
  { id: 'walls',  rarity: 'c', icon: '🏰', name: 'Wax Walls',      desc: 'Hive health +60 and a full repair', max: 5, apply: (s, g) => { g.hive.maxHp += 60; g.hive.hp = g.hive.maxHp; } },
  { id: 'magnet', rarity: 'c', icon: '🧲', name: 'Keen Nose',      desc: 'Collect honey from farther away', max: 3, apply: (s) => { s.magnet *= 1.6; } },
  { id: 'range',  rarity: 'c', icon: '🔭', name: 'Sharp Eye',      desc: 'Range +20% and faster stingers', max: 3, apply: (s) => { s.range *= 1.2; s.shotSpeed *= 1.15; } },
  { id: 'dash',   rarity: 'c', icon: '💨', name: 'Swift Dash',     desc: 'Dash recharges 25% faster', max: 3, apply: (s) => { s.dashCd *= 0.75; } },
  { id: 'regen',  rarity: 'c', icon: '🌼', name: 'Healing Nectar', desc: 'The bee heals 1.5 health per second', max: 3, apply: (s) => { s.regen += 1.5; } },

  { id: 'multi',  rarity: 'r', icon: '🔱', name: 'Extra Stinger',  desc: 'One more stinger per shot', max: 4, apply: (s) => { s.multishot++; } },
  { id: 'pierce', rarity: 'r', icon: '🎯', name: 'Piercing Sting', desc: 'Stingers pass through one more wasp', max: 3, apply: (s) => { s.pierce++; } },
  { id: 'crit',   rarity: 'r', icon: '☠️', name: 'Deadly Sting',   desc: '+12% chance of a critical hit (double damage)', max: 4, apply: (s) => { s.crit += 0.12; } },
  { id: 'pulse',  rarity: 'r', icon: '💥', name: 'Mighty Buzz',    desc: 'Buzz wave is stronger, wider and recharges faster', max: 4, apply: (s) => { s.pulseDmg *= 1.35; s.pulseRadius *= 1.12; s.pulseCd *= 0.85; } },
  { id: 'helper', rarity: 'r', icon: '🐝', name: 'Helper Bee',     desc: 'A worker bee that circles the hive and stings', max: 3, apply: (s) => { s.helpers++; } },
  { id: 'venom',  rarity: 'r', icon: '🧪', name: 'Venom Sting',    desc: 'Stings poison wasps for 3 seconds', max: 3, apply: (s) => { s.venom++; } },
  { id: 'frost',  rarity: 'r', icon: '❄️', name: 'Frost Sting',    desc: '+18% chance to chill a wasp and slow it down', max: 3, apply: (s) => { s.frost++; } },
  { id: 'thorns', rarity: 'r', icon: '🍯', name: 'Sticky Honey',   desc: 'Wasps near the hive are slowed and burned by hot wax', max: 3, apply: (s) => { s.thorns++; } },
  { id: 'turret', rarity: 'r', icon: '🏹', name: 'Guardian Hive',  desc: 'The hive itself shoots stingers at nearby wasps', max: 3, apply: (s) => { s.turret++; } },
  { id: 'dashdmg', rarity: 'r', icon: '🌪️', name: 'Stinger Dash',  desc: 'Dashing through wasps damages and scatters them', max: 3, apply: (s) => { s.dashDmg++; } },
  { id: 'sweet',  rarity: 'r', icon: '🍬', name: 'Sweet Tooth',    desc: 'Every honey drop heals the bee and the hive a little', max: 2, apply: (s) => { s.sweet++; } },
  { id: 'luck',   rarity: 'r', icon: '🍀', name: 'Lucky Clover',   desc: 'Power-ups and hearts drop 50% more often', max: 2, apply: (s) => { s.luck += 0.5; } },

  { id: 'chain',  rarity: 'e', icon: '🌩️', name: 'Chain Lightning', desc: 'Each sting arcs to one more nearby wasp', max: 3, apply: (s) => { s.chain++; } },
  { id: 'burst',  rarity: 'e', icon: '🌻', name: 'Pollen Burst',   desc: 'Defeated wasps may burst and damage wasps around them', max: 3, apply: (s) => { s.burst++; } },
  { id: 'rico',   rarity: 'e', icon: '🪃', name: 'Ricochet',       desc: 'Stingers bounce to another wasp', max: 2, apply: (s) => { s.ricochet++; } },
  { id: 'orbit',  rarity: 'e', icon: '🌀', name: 'Stinger Ring',   desc: 'A spinning blade circles the bee and cuts wasps', max: 3, apply: (s) => { s.orbit++; } },
  { id: 'homing', rarity: 'e', icon: '🧭', name: 'Seeker Stings',  desc: 'Stingers curve toward their target', max: 1, apply: (s) => { s.homing = 1; } },
  { id: 'echo',   rarity: 'e', icon: '🔔', name: 'Echo Buzz',      desc: 'The buzz wave rings a second time', max: 1, apply: (s) => { s.echo = 1; } },
  { id: 'stun',   rarity: 'e', icon: '💫', name: 'Stunning Buzz',  desc: 'The buzz wave stuns wasps for a moment', max: 2, apply: (s) => { s.stun++; } },
  { id: 'rush',   rarity: 'e', icon: '🔥', name: 'Honey Rush',     desc: 'The higher your combo, the faster you sting', max: 2, apply: (s) => { s.rush++; } },
  { id: 'thirst', rarity: 'e', icon: '🌺', name: 'Nectar Thirst',  desc: 'Every defeated wasp heals the bee and the hive a little', max: 2, apply: (s) => { s.lifesteal++; } },
  { id: 'berserk', rarity: 'e', icon: '😤', name: 'Berserker',     desc: 'Sting damage +50%, but bee health -25', max: 1, apply: (s, g) => { s.damage *= 1.5; s.maxHp = Math.max(30, s.maxHp - 25); g.player.hp = Math.min(g.player.hp, s.maxHp); } },

  { id: 'revive', rarity: 'l', icon: '🕊️', name: 'Second Wind',    desc: 'Once per run, the bee comes back to life with a shockwave', max: 1, apply: (s) => { s.revive = 1; } },
  { id: 'bless',  rarity: 'l', icon: '👑', name: "Queen's Blessing", desc: 'Damage +30%, sting rate +15%, speed +10%', max: 1, apply: (s) => { s.damage *= 1.3; s.fireRate *= 1.15; s.speed *= 1.1; } },
  { id: 'swarm',  rarity: 'l', icon: '🐝', name: 'Royal Swarm',    desc: 'Two more helper bees, and all helpers sting faster', max: 1, apply: (s) => { s.helpers += 2; s.helperRate *= 1.5; } },
  { id: 'golden', rarity: 'l', icon: '🏆', name: 'Liquid Gold',    desc: 'Honey is worth double and the shop is 25% cheaper', max: 1, apply: (s) => { s.honeyMul *= 2; s.shopMul *= 0.75; } },
];
const UPGRADE_BY_ID = {};
UPGRADES.forEach((u) => { UPGRADE_BY_ID[u.id] = u; });
const JAR = { id: 'jar', rarity: 'c', icon: '🍯', name: 'Honey Jar', desc: '+15 honey for the shop', max: Infinity, apply: (st, g) => { g.honey += 15; } };

// בוחרים n קלפים שונים, לפי משקל הנדירות
function rollUpgrades(taken, n, afterBoss) {
  const pool = UPGRADES.filter((u) => (taken[u.id] || 0) < u.max);
  const out = [];
  while (out.length < n && pool.length) {
    let sum = 0;
    for (const u of pool) sum += afterBoss ? RARITY[u.rarity].bossWeight : RARITY[u.rarity].weight;
    let r = Math.random() * sum, idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { r -= afterBoss ? RARITY[pool[i].rarity].bossWeight : RARITY[pool[i].rarity].weight; if (r <= 0) { idx = i; break; } }
    out.push(pool.splice(idx, 1)[0]);
  }
  while (out.length < n) out.push(JAR);
  return out;
}

// ---------------- שדרוגי קבע (נקנים בג׳לי מלכות, נשמרים בין משחקים) ----------------
const PERKS = [
  { id: 'hive',   icon: '🏰', name: 'Thick Wax',      desc: 'Hive starts with +20 health', max: 5 },
  { id: 'bee',    icon: '💛', name: 'Hardy Bee',      desc: 'Bee starts with +8 health', max: 5 },
  { id: 'dmg',    icon: '🗡️', name: 'Honed Stinger',  desc: 'Sting damage +4%', max: 5 },
  { id: 'honey',  icon: '🍯', name: 'Pantry',         desc: 'Start each run with +6 honey', max: 3 },
  { id: 'luck',   icon: '🍀', name: 'Clover Patch',   desc: 'Power-ups drop 10% more often', max: 3 },
  { id: 'pulse',  icon: '💥', name: 'Deep Breath',    desc: 'Buzz wave recharges 5% faster', max: 3 },
  { id: 'magnet', icon: '🧲', name: 'Sweet Scent',    desc: 'Honey pickup range +12%', max: 3 },
  { id: 'reroll', icon: '🎲', name: 'Second Opinion', desc: 'One free card reroll in every shop', max: 2 },
];
const PERK_COST = [8, 15, 25, 40, 60];
const perkLv = (id) => Math.max(0, Math.floor(Number(profile.perks[id]) || 0));
function applyPerks(g) {
  const s = g.stats;
  g.hive.maxHp += 20 * perkLv('hive'); g.hive.hp = g.hive.maxHp;
  s.maxHp += 8 * perkLv('bee'); g.player.hp = s.maxHp;
  s.damage *= 1 + 0.04 * perkLv('dmg');
  g.honey += 6 * perkLv('honey');
  s.luck += 0.1 * perkLv('luck');
  s.pulseCd *= 1 - 0.05 * perkLv('pulse');
  s.magnet *= 1 + 0.12 * perkLv('magnet');
  s.freeRerolls = perkLv('reroll');
}

// ---------------- הישגים ----------------
const ACHIEVEMENTS = [
  { id: 'first',    icon: '🐝', name: 'First Sting',      desc: 'Defeat your first wasp' },
  { id: 'queen',    icon: '👑', name: 'Regicide',         desc: 'Defeat the Wasp Queen' },
  { id: 'general',  icon: '🎖️', name: 'Outmaneuvered',    desc: 'Defeat the Wasp General' },
  { id: 'emperor',  icon: '🏆', name: 'Hive Keeper',      desc: 'Defeat the Wasp Emperor and save the hive' },
  { id: 'hard',     icon: '🔥', name: 'Iron Wings',       desc: 'Win the game on Hard' },
  { id: 'combo25',  icon: '⚡', name: 'Unstoppable',      desc: 'Reach a combo of 25' },
  { id: 'clean',    icon: '✨', name: 'Not a Scratch',    desc: 'Finish level 3 or later without the hive taking damage' },
  { id: 'dancer',   icon: '💃', name: 'Royal Dancer',     desc: 'Defeat a boss without the bee getting hit' },
  { id: 'honey150', icon: '🍯', name: 'Honey Baron',      desc: 'Collect 150 honey in one run' },
  { id: 'thief',    icon: '🕵️', name: 'Stop, Thief!',     desc: 'Catch 5 robber wasps carrying honey' },
  { id: 'pulse8',   icon: '💥', name: 'Shockwave',        desc: 'Hit 8 wasps with a single buzz wave' },
  { id: 'legend',   icon: '🌟', name: 'Stuff of Legend',  desc: 'Pick a legendary upgrade' },
  { id: 'revived',  icon: '🕊️', name: 'Not Today',        desc: 'Come back to life with Second Wind' },
  { id: 'endless15', icon: '♾️', name: 'Into the Storm',  desc: 'Reach level 15 in endless mode' },
  { id: 'kills1000', icon: '☠️', name: 'Exterminator',    desc: 'Defeat 1,000 wasps in total' },
];
const ACH_REWARD = 5;
