/* Hive Keeper – core: כלים, אחסון, הגדרות, פרופיל שמור, רמות קושי, שיאים */
'use strict';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;
const MAX_LEVEL = 10;
// הפרש זווית מנורמל לטווח ‎-π..π
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const isTouch = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };

// ---------------- אחסון בדפדפן (בטוח גם אם חסום) ----------------
const store = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* מצב פרטי וכו' */ }
  },
};
const SCORES_KEY = 'hiveKeeper.scores';
const MUTE_KEY = 'hiveKeeper.muted';
const NAME_KEY = 'hiveKeeper.name';
const DIFF_KEY = 'hiveKeeper.diff';
const STORY_KEY = 'hiveKeeper.storySeen';
const SAVE_KEY = 'hiveKeeper.run';
const SETTINGS_KEY = 'hiveKeeper.settings';
const PROFILE_KEY = 'hiveKeeper.profile';

// ---------------- הגדרות ----------------
const SETTINGS_DEFAULT = { music: 0.7, sfx: 0.85, shake: true, vibrate: true, numbers: true, lefty: false, quality: 'auto' };
const settings = Object.assign({}, SETTINGS_DEFAULT);
{
  const s = store.get(SETTINGS_KEY, null);
  if (s && typeof s === 'object') {
    for (const k in SETTINGS_DEFAULT) if (typeof s[k] === typeof SETTINGS_DEFAULT[k]) settings[k] = s[k];
  }
  settings.music = clamp(settings.music, 0, 1);
  settings.sfx = clamp(settings.sfx, 0, 1);
  if (!['auto', 'high', 'low'].includes(settings.quality)) settings.quality = 'auto';
}
function saveSettings() { store.set(SETTINGS_KEY, settings); }
function vibrate(ms) {
  if (!settings.vibrate) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* לא נתמך */ }
}

// ---------------- פרופיל קבוע: ג׳לי מלכות, שדרוגי קבע, הישגים, סטטיסטיקה ----------------
function defaultProfile() {
  return {
    v: 1, jelly: 0, jellyTotal: 0, perks: {}, ach: {}, seen: {},
    stats: { runs: 0, wins: 0, kills: 0, bosses: 0, honey: 0, time: 0, bestLevel: 0, bestCombo: 0, bestScore: 0 },
  };
}
function loadProfile() {
  const d = defaultProfile();
  const p = store.get(PROFILE_KEY, null);
  if (!p || typeof p !== 'object') return d;
  d.jelly = Math.max(0, Math.floor(Number(p.jelly) || 0));
  d.jellyTotal = Math.max(d.jelly, Math.floor(Number(p.jellyTotal) || 0));
  for (const k of ['perks', 'ach', 'seen']) if (p[k] && typeof p[k] === 'object') d[k] = p[k];
  if (p.stats && typeof p.stats === 'object') for (const k in d.stats) d.stats[k] = Math.max(0, Number(p.stats[k]) || 0);
  return d;
}
let profile = loadProfile();
function saveProfile() { store.set(PROFILE_KEY, profile); }

// ---------------- רמות קושי: חיי אויבים, נזק, קצב הופעה ומכפיל ניקוד ----------------
const DIFFS = {
  easy:   { name: 'Easy',   hp: 0.7,  dmg: 0.5, spawn: 1.3,  score: 0.75, jelly: 0.7 },
  normal: { name: 'Normal', hp: 1,    dmg: 1,   spawn: 1,    score: 1,    jelly: 1 },
  hard:   { name: 'Hard',   hp: 1.25, dmg: 1.3, spawn: 0.82, score: 1.5,  jelly: 1.5 },
};
let diffKey = store.get(DIFF_KEY, 'normal');
if (!DIFFS[diffKey]) diffKey = 'normal';
const D = () => DIFFS[diffKey];

// ---------------- טבלת שיאים ----------------
function getScores() {
  const s = store.get(SCORES_KEY, []);
  return Array.isArray(s) ? s.filter((r) => r && typeof r.score === 'number') : [];
}
function qualifies(score) {
  if (score <= 0) return false;
  const s = getScores();
  return s.length < 10 || score > s[s.length - 1].score;
}
function addScore(entry) {
  const s = getScores();
  s.push(entry);
  s.sort((a, b) => b.score - a.score);
  const top = s.slice(0, 10);
  store.set(SCORES_KEY, top);
  return top;
}
