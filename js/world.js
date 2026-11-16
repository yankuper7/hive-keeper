/* Hive Keeper – world: קנבס, גודל מסך, איכות גרפיקה, נופים ומזג אוויר */
'use strict';

const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false });
let W = 1280, H = 720, scale = 1, dpr = 1;
let hudPx = 62;     // גובה ה-HUD בפיקסלים של המסך
let hudSafe = 62;   // אותו גובה ביחידות עולם
let FX = 1;         // מכפיל כמות החלקיקים
let PARTICLE_CAP = 650;
let lastVw = 0, lastVh = 0; // גודל החלון בפעם האחרונה שהתאמנו את הקנבס

// ---------------- איכות גרפיקה ----------------
// tier: 2 גבוהה · 1 בינונית · 0 נמוכה. במצב אוטומטי יורדים דרגה כשהמכשיר לא עומד בקצב
const quality = { tier: 2, acc: 0, n: 0, strikes: 0 };
function applyQuality() {
  if (settings.quality === 'high') quality.tier = 2;
  else if (settings.quality === 'low') quality.tier = 0;
  FX = [0.45, 0.75, 1][quality.tier];
  PARTICLE_CAP = [220, 420, 650][quality.tier];
}
function perfSample(ms) {
  if (settings.quality !== 'auto' || quality.tier === 0 || ms > 250) return;
  quality.acc += ms; quality.n++;
  if (quality.n < 150) return;
  const avg = quality.acc / quality.n;
  quality.acc = 0; quality.n = 0;
  quality.strikes = avg > 21.5 ? quality.strikes + 1 : 0;
  if (quality.strikes >= 2) {
    quality.strikes = 0;
    quality.tier--;
    applyQuality();
    resize();
  }
}

// ---------------- נופים ----------------
const THEMES = {
  meadow: {
    name: 'Spring Meadow', track: 'meadow', amb: 'none', seed: 11,
    ground: ['#8fcf58', '#5fa43c', '#3a7429'], light: '185,232,105', shade: '18,70,28',
    blades: ['30,85,25', '170,225,100'], bladeN: 1, dirt: '160,125,75', stone: ['#c9c9c0', '#77786f'],
    tint: [255, 255, 255, 0], dark: 0, weather: 'pollen', vignette: '0,20,0',
    border: 'bush', borderCols: ['#245f27', '#2f7a2f', '150,215,95'],
    flowers: ['#ffffff', '#ffd6e8', '#fff07a', '#c9b6ff', '#ff9eb5', '#9be7ff'], flowerN: 1,
    flora: 'flower', floraCols: [['#ff6f91', '#ffd166'], ['#ffffff', '#ffb300'], ['#b388ff', '#fff59d'], ['#ffd54f', '#8d5a00'], ['#ff8a65', '#fff3b0'], ['#81d4fa', '#fff59d']],
    props: ['clover', 'stone'], clouds: 1,
  },
  golden: {
    name: 'Golden Fields', track: 'golden', amb: 'none', seed: 23,
    ground: ['#e6d268', '#c4a842', '#8f7a2a'], light: '255,242,160', shade: '120,90,20',
    blades: ['130,100,25', '252,232,135'], bladeN: 1, dirt: '170,135,80', stone: ['#d6cfb4', '#8a8166'],
    tint: [255, 170, 60, 0.07], dark: 0, weather: 'pollen', vignette: '50,30,0',
    border: 'wheat', borderCols: ['#a8862a', '#d4b24a', '255,238,160'],
    flowers: ['#ffffff', '#ffb74d', '#ff8a65', '#fff59d'], flowerN: 0.55,
    flora: 'sunflower', floraCols: [['#ffc928', '#5d3a12']],
    props: ['furrow', 'wheat', 'stone'], clouds: 1,
  },
  sunset: {
    name: 'Sunset Orchard', track: 'sunset', amb: 'none', seed: 37,
    ground: ['#a9b85a', '#7d9440', '#4f6a2b'], light: '255,205,125', shade: '60,45,40',
    blades: ['50,80,30', '232,212,125'], bladeN: 1, dirt: '170,120,80', stone: ['#d9c2b4', '#8a7068'],
    tint: [255, 110, 60, 0.17], dark: 0.07, weather: 'petals', vignette: '60,10,30',
    border: 'blossom', borderCols: ['#8a4f63', '#f48fb1', '255,225,238'],
    flowers: ['#ffd6e8', '#ffffff', '#f8bbd0', '#ffe0b2'], flowerN: 0.9,
    flora: 'flower', floraCols: [['#f06292', '#fff59d'], ['#ffffff', '#f48fb1'], ['#ff8a80', '#ffe082'], ['#ce93d8', '#fff59d']],
    props: ['petal', 'clover', 'stone'], clouds: 0.6, fireflies: 0.6,
  },
  autumn: {
    name: 'Autumn Woods', track: 'autumn', amb: 'wind', seed: 41,
    ground: ['#cfa655', '#a8772f', '#6f4b20'], light: '255,216,132', shade: '70,40,10',
    blades: ['110,70,20', '226,182,92'], bladeN: 0.8, dirt: '140,100,60', stone: ['#c2b8a8', '#70675a'],
    tint: [255, 150, 70, 0.05], dark: 0.05, weather: 'leaves', vignette: '40,15,0',
    border: 'tree', borderCols: ['#8a3f12', '#d9641e', '255,205,95'],
    flowers: [], flowerN: 0,
    flora: 'mushroom', floraCols: [['#e53935', '#fff8e1'], ['#c77b30', '#fff8e1'], ['#b23c2e', '#fff8e1']],
    props: ['leaf', 'twig', 'stone'], clouds: 0.8,
  },
  storm: {
    name: 'Storm Marsh', track: 'storm', amb: 'rain', seed: 53,
    ground: ['#5f927a', '#3d6b58', '#22443a'], light: '150,212,190', shade: '5,30,30',
    blades: ['15,55,45', '122,182,152'], bladeN: 0.9, dirt: '90,95,75', stone: ['#9fb0aa', '#4f5f5a'],
    tint: [40, 60, 120, 0.16], dark: 0.3, weather: 'rain', lightning: true, vignette: '0,10,25',
    border: 'reed', borderCols: ['#1d3f33', '#2c5a47', '122,172,142'],
    flowers: ['#e0f2f1', '#b2dfdb'], flowerN: 0.25,
    flora: 'reed', floraCols: [['#86c796', '#7a4a22']],
    props: ['puddle', 'lily', 'stone'], clouds: 0,
  },
  frost: {
    name: 'Frozen Night', track: 'frost', amb: 'wind', seed: 67,
    ground: ['#eef5fc', '#c8daec', '#93abc9'], light: '255,255,255', shade: '70,100,150',
    blades: ['120,150,190', '255,255,255'], bladeN: 0.25, dirt: '150,165,185', stone: ['#b7c4d4', '#66758a'],
    tint: [50, 80, 170, 0.14], dark: 0.36, weather: 'snow', vignette: '10,20,60',
    border: 'pine', borderCols: ['#1f4a3a', '#2e6650', '240,250,255'],
    flowers: [], flowerN: 0,
    flora: 'crystal', floraCols: [['#bfe6ff', '#ffffff']],
    props: ['drift', 'ice', 'stone'], clouds: 0, snowcap: true,
  },
  ember: {
    name: "Emperor's Wasteland", track: 'ember', amb: 'fire', seed: 79,
    ground: ['#6b4435', '#432a22', '#221614'], light: '205,112,72', shade: '10,0,0',
    blades: ['20,12,10', '152,92,62'], bladeN: 0.3, dirt: '70,45,38', stone: ['#5a4a45', '#241b19'],
    tint: [130, 20, 10, 0.1], dark: 0.48, weather: 'embers', vignette: '30,0,0',
    border: 'thorn', borderCols: ['#1d1412', '#3a2620', '255,120,40'],
    flowers: [], flowerN: 0,
    flora: 'vent', floraCols: [['#ff7a1a', '#2a1a16']],
    props: ['crack', 'ash', 'stone'], clouds: 0, glow: true,
  },
};
for (const k in THEMES) THEMES[k].id = k;

// מצב הסביבה: נוף נוכחי, מעבר בין נופים, שעת היום, ברקים
const env = { theme: THEMES.meadow, fade: 0, tint: [255, 255, 255, 0], dark: 0, flash: 0, boltT: 6 };
let bg = null, bgGlow = null, bgPrev = null;
let flora = [];
const floraSprites = new Map();

function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resize() {
  applyQuality();
  const cw = Math.max(1, window.innerWidth), ch = Math.max(1, window.innerHeight);
  lastVw = window.innerWidth; lastVh = window.innerHeight;
  // רזולוציה: עד תקרה לפי דרגת האיכות, כדי שגם מסכים ענקיים וטלפונים ירוצו חלק
  const cap = [1, 1.5, 2][quality.tier], budget = [1.5e6, 2.6e6, 4.2e6][quality.tier];
  dpr = Math.min(window.devicePixelRatio || 1, cap);
  dpr = Math.max(0.75, Math.min(dpr, Math.sqrt(budget / (cw * ch))));
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  const oldW = W, oldH = H;
  // בטלפון "מתקרבים" מעט, כדי שהדבורה והצרעות לא יהיו זעירות
  const short = Math.min(cw, ch);
  scale = short / clamp(420 + short * 0.42, 560, 720);
  W = cw / scale; H = ch / scale;
  hudSafe = hudPx / scale;
  shiftWorld((W - oldW) / 2, (H - oldH) / 2);
  bgPrev = null; env.fade = 0;
  buildBackground();
  if (typeof onResize === 'function') onResize();
}

function setTheme(id) {
  const t = THEMES[id] || THEMES.meadow;
  if (t !== env.theme || !bg) {
    bgPrev = bg;
    env.theme = t;
    buildBackground();
    env.fade = bgPrev ? 1 : 0;
  }
  Sound.setAmbience(t.amb || 'none');
  return t;
}

function updateEnv(dt, active) {
  const t = env.theme, k = Math.min(1, dt * 0.9);
  for (let i = 0; i < 4; i++) env.tint[i] += (t.tint[i] - env.tint[i]) * k;
  env.dark += (t.dark - env.dark) * k;
  if (env.fade > 0) { env.fade -= dt / 1.3; if (env.fade <= 0) { env.fade = 0; bgPrev = null; } }
  if (env.flash > 0) env.flash -= dt * 2.2;
  if (t.lightning && active) {
    env.boltT -= dt;
    if (env.boltT <= 0) { env.boltT = rand(6, 13); env.flash = 1; Sound.play('thunder'); }
  }
}

// ---------------- ציור הרקע (פעם אחת לכל נוף, לתמונה שמורה) ----------------
function buildBackground() {
  const T = env.theme;
  const R = rng32(T.seed * 7919 + 13);
  const rr = (a, b) => a + R() * (b - a);
  bg = document.createElement('canvas');
  bg.width = canvas.width; bg.height = canvas.height;
  const b = bg.getContext('2d', { alpha: false });
  const k = scale * dpr;
  const cx = W / 2, cy = H / 2;
  const area = W * H;
  const far = (x, y, d) => Math.hypot(x - cx, y - cy) >= d;

  // שכבת זוהר (סדקי לבה) – בחצי רזולוציה, מצוירת מעל הרקע עם הבהוב
  let gl = null;
  bgGlow = null;
  if (T.glow && quality.tier > 0) {
    bgGlow = document.createElement('canvas');
    bgGlow.width = Math.ceil(bg.width / 2); bgGlow.height = Math.ceil(bg.height / 2);
    gl = bgGlow.getContext('2d');
    gl.setTransform(k / 2, 0, 0, k / 2, 0, 0);
    gl.lineCap = 'round'; gl.lineJoin = 'round';
  }

  // אדמה
  const gr = b.createRadialGradient(bg.width / 2, bg.height / 2, 50, bg.width / 2, bg.height / 2, Math.max(bg.width, bg.height) * 0.72);
  gr.addColorStop(0, T.ground[0]); gr.addColorStop(0.6, T.ground[1]); gr.addColorStop(1, T.ground[2]);
  b.fillStyle = gr; b.fillRect(0, 0, bg.width, bg.height);
  b.setTransform(k, 0, 0, k, 0, 0);
  b.lineCap = 'round'; b.lineJoin = 'round';

  // כתמי אור וצל רכים
  for (let i = 0; i < Math.floor(area / 14000); i++) {
    const x = R() * W, y = R() * H, r = rr(50, 150);
    const c = R() < 0.5 ? T.light : T.shade;
    const pg = b.createRadialGradient(x, y, 0, x, y, r);
    pg.addColorStop(0, `rgba(${c},0.16)`); pg.addColorStop(1, `rgba(${c},0)`);
    b.fillStyle = pg; b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill();
  }

  // --- פרטי קרקע לפי הנוף ---
  const stone = (x, y, s) => {
    b.fillStyle = 'rgba(0,0,0,0.22)'; b.beginPath(); b.ellipse(x + 3, y + 4, s, s * 0.6, 0, 0, TAU); b.fill();
    const sg = b.createRadialGradient(x - s * 0.3, y - s * 0.3, 1, x, y, s);
    sg.addColorStop(0, T.stone[0]); sg.addColorStop(1, T.stone[1]);
    b.fillStyle = sg; b.beginPath(); b.ellipse(x, y, s, s * 0.7, rr(-0.4, 0.4), 0, TAU); b.fill();
    if (T.snowcap) { b.fillStyle = 'rgba(255,255,255,0.9)'; b.beginPath(); b.ellipse(x - s * 0.1, y - s * 0.25, s * 0.7, s * 0.34, -0.2, 0, TAU); b.fill(); }
    if (T.glow) { b.strokeStyle = 'rgba(255,120,40,0.35)'; b.lineWidth = 1.2; b.beginPath(); b.ellipse(x, y, s, s * 0.7, 0, 0.3, 2.2); b.stroke(); }
  };
  const leaf = (x, y, s, rot, col) => {
    b.save(); b.translate(x, y); b.rotate(rot);
    b.fillStyle = 'rgba(0,0,0,0.15)'; b.beginPath(); b.ellipse(1.5, 2, s, s * 0.45, 0, 0, TAU); b.fill();
    b.fillStyle = col;
    b.beginPath(); b.moveTo(-s, 0); b.quadraticCurveTo(0, -s * 0.75, s, 0); b.quadraticCurveTo(0, s * 0.75, -s, 0); b.fill();
    b.strokeStyle = 'rgba(60,25,5,0.45)'; b.lineWidth = 0.8;
    b.beginPath(); b.moveTo(-s, 0); b.lineTo(s * 1.3, 0); b.stroke();
    b.restore();
  };
  const props = {
    clover(n) {
      for (let i = 0; i < n; i++) {
        const x = R() * W, y = R() * H, s = rr(3, 5);
        if (!far(x, y, 100)) continue;
        b.fillStyle = 'rgba(35,110,40,0.75)';
        for (let p = 0; p < 3; p++) { const a = (p / 3) * TAU + i; b.beginPath(); b.arc(x + Math.cos(a) * s * 0.8, y + Math.sin(a) * s * 0.8, s, 0, TAU); b.fill(); }
      }
    },
    stone(n) {
      for (let i = 0; i < n * 0.25; i++) { const x = R() * W, y = R() * H; if (far(x, y, 140)) stone(x, y, rr(7, 15)); }
    },
    furrow() {
      // תלמים בשדה
      b.strokeStyle = 'rgba(120,90,20,0.11)'; b.lineWidth = 7;
      const L = Math.hypot(W, H);
      for (let d = -L; d < L; d += 46) { b.beginPath(); b.moveTo(d, -20); b.lineTo(d + H * 0.45, H + 20); b.stroke(); }
      b.strokeStyle = 'rgba(255,245,170,0.09)'; b.lineWidth = 3;
      for (let d = -L; d < L; d += 46) { b.beginPath(); b.moveTo(d + 9, -20); b.lineTo(d + 9 + H * 0.45, H + 20); b.stroke(); }
    },
    wheat(n) {
      for (let i = 0; i < n * 1.6; i++) {
        const x = R() * W, y = R() * H;
        if (!far(x, y, 110)) continue;
        for (let j = 0; j < 4; j++) {
          const lean = rr(-7, 7), h = rr(11, 18);
          b.strokeStyle = 'rgba(150,115,30,0.8)'; b.lineWidth = 1.3;
          b.beginPath(); b.moveTo(x + j * 2 - 3, y); b.quadraticCurveTo(x + lean * 0.4, y - h * 0.6, x + lean, y - h); b.stroke();
          b.fillStyle = '#e8c860';
          b.beginPath(); b.ellipse(x + lean, y - h - 2, 1.8, 4, lean * 0.06, 0, TAU); b.fill();
        }
      }
    },
    petal(n) {
      for (let i = 0; i < n * 5; i++) {
        const x = R() * W, y = R() * H;
        b.fillStyle = R() < 0.5 ? 'rgba(255,200,218,0.85)' : 'rgba(255,240,245,0.85)';
        b.beginPath(); b.ellipse(x, y, rr(2.2, 3.6), rr(1.2, 2), R() * 3, 0, TAU); b.fill();
      }
    },
    leaf(n) {
      const cols = ['#d9641e', '#b5451b', '#e8a33a', '#8f3d14', '#f0c14b', '#c2571a'];
      for (let i = 0; i < n * 7; i++) {
        const x = R() * W, y = R() * H;
        if (!far(x, y, 70)) continue;
        leaf(x, y, rr(4, 8), R() * TAU, cols[Math.floor(R() * cols.length)]);
      }
    },
    twig(n) {
      b.strokeStyle = 'rgba(70,40,15,0.75)'; b.lineWidth = 2;
      for (let i = 0; i < n * 0.7; i++) {
        const x = R() * W, y = R() * H, a = R() * TAU, l = rr(12, 22);
        if (!far(x, y, 110)) continue;
        b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        b.moveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5); b.lineTo(x + Math.cos(a + 0.8) * l * 0.8, y + Math.sin(a + 0.8) * l * 0.8);
        b.stroke();
      }
    },
    puddle(n) {
      for (let i = 0; i < n * 0.5; i++) {
        const x = R() * W, y = R() * H, s = rr(22, 55), rot = rr(-0.5, 0.5);
        if (!far(x, y, 150)) continue;
        b.fillStyle = 'rgba(8,35,35,0.35)'; b.beginPath(); b.ellipse(x, y, s + 4, s * 0.55 + 3, rot, 0, TAU); b.fill();
        const pg = b.createLinearGradient(x, y - s * 0.5, x, y + s * 0.5);
        pg.addColorStop(0, 'rgba(150,195,210,0.75)'); pg.addColorStop(1, 'rgba(60,105,125,0.75)');
        b.fillStyle = pg; b.beginPath(); b.ellipse(x, y, s, s * 0.5, rot, 0, TAU); b.fill();
        b.strokeStyle = 'rgba(235,250,255,0.45)'; b.lineWidth = 1.5;
        b.beginPath(); b.ellipse(x - s * 0.15, y - s * 0.1, s * 0.6, s * 0.25, rot, 3.4, 4.9); b.stroke();
      }
    },
    lily(n) {
      for (let i = 0; i < n * 0.6; i++) {
        const x = R() * W, y = R() * H, s = rr(6, 11), a = R() * TAU;
        if (!far(x, y, 120)) continue;
        b.fillStyle = 'rgba(0,0,0,0.18)'; b.beginPath(); b.arc(x + 2, y + 3, s, 0, TAU); b.fill();
        b.fillStyle = '#3f8a4e'; b.beginPath(); b.moveTo(x, y); b.arc(x, y, s, a, a + TAU - 0.7); b.closePath(); b.fill();
        b.strokeStyle = 'rgba(180,230,170,0.5)'; b.lineWidth = 1; b.beginPath(); b.arc(x, y, s * 0.6, a + 0.5, a + 2.5); b.stroke();
        if (R() < 0.4) { b.fillStyle = '#ffd6e8'; for (let p = 0; p < 5; p++) { const pa = (p / 5) * TAU; b.beginPath(); b.arc(x + Math.cos(pa) * 2.4, y + Math.sin(pa) * 2.4, 2, 0, TAU); b.fill(); } b.fillStyle = '#ffeb3b'; b.beginPath(); b.arc(x, y, 1.5, 0, TAU); b.fill(); }
      }
    },
    drift(n) {
      for (let i = 0; i < n * 1.2; i++) {
        const x = R() * W, y = R() * H, s = rr(30, 80);
        b.fillStyle = 'rgba(110,140,190,0.2)'; b.beginPath(); b.ellipse(x + 4, y + s * 0.22, s, s * 0.4, 0, 0, TAU); b.fill();
        const dg = b.createRadialGradient(x, y - s * 0.1, 2, x, y, s);
        dg.addColorStop(0, 'rgba(255,255,255,0.95)'); dg.addColorStop(1, 'rgba(255,255,255,0)');
        b.fillStyle = dg; b.beginPath(); b.ellipse(x, y, s, s * 0.45, 0, 0, TAU); b.fill();
      }
    },
    ice(n) {
      for (let i = 0; i < n * 0.4; i++) {
        const x = R() * W, y = R() * H, s = rr(26, 60);
        if (!far(x, y, 150)) continue;
        b.fillStyle = 'rgba(150,205,240,0.5)'; b.strokeStyle = 'rgba(255,255,255,0.7)'; b.lineWidth = 1.5;
        b.beginPath();
        const nv = 7, a0 = R() * TAU;
        for (let v = 0; v < nv; v++) { const a = a0 + (v / nv) * TAU, r2 = s * rr(0.6, 1); b.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2 * 0.6); }
        b.closePath(); b.fill(); b.stroke();
        b.strokeStyle = 'rgba(255,255,255,0.55)'; b.lineWidth = 1;
        for (let v = 0; v < 3; v++) { const lx = x + rr(-s, s) * 0.5, ly = y + rr(-s, s) * 0.25; b.beginPath(); b.moveTo(lx, ly); b.lineTo(lx + rr(8, 20), ly - rr(4, 10)); b.stroke(); }
      }
    },
    ash(n) {
      for (let i = 0; i < n * 1.2; i++) {
        const x = R() * W, y = R() * H, s = rr(25, 70);
        const ag = b.createRadialGradient(x, y, 2, x, y, s);
        ag.addColorStop(0, 'rgba(140,125,120,0.22)'); ag.addColorStop(1, 'rgba(140,125,120,0)');
        b.fillStyle = ag; b.beginPath(); b.arc(x, y, s, 0, TAU); b.fill();
      }
    },
    crack(n) {
      // סדקי לבה מסתעפים
      const draw = (pts) => {
        b.strokeStyle = '#120a08'; b.lineWidth = 5;
        b.beginPath(); pts.forEach((p, i) => (i ? b.lineTo(p[0], p[1]) : b.moveTo(p[0], p[1]))); b.stroke();
        b.strokeStyle = gl ? '#8a2a0c' : '#e0661f'; b.lineWidth = 2;
        b.beginPath(); pts.forEach((p, i) => (i ? b.lineTo(p[0], p[1]) : b.moveTo(p[0], p[1]))); b.stroke();
        if (gl) {
          gl.strokeStyle = 'rgba(255,80,15,0.3)'; gl.lineWidth = 8;
          gl.beginPath(); pts.forEach((p, i) => (i ? gl.lineTo(p[0], p[1]) : gl.moveTo(p[0], p[1]))); gl.stroke();
          gl.strokeStyle = 'rgba(255,190,90,0.9)'; gl.lineWidth = 2.2;
          gl.beginPath(); pts.forEach((p, i) => (i ? gl.lineTo(p[0], p[1]) : gl.moveTo(p[0], p[1]))); gl.stroke();
        }
      };
      const grow = (x, y, a, segs, depth) => {
        const pts = [[x, y]];
        for (let s = 0; s < segs; s++) {
          a += rr(-0.65, 0.65);
          const l = rr(18, 40);
          x += Math.cos(a) * l; y += Math.sin(a) * l;
          if (!far(x, y, 95)) break;
          pts.push([x, y]);
          if (depth < 1 && R() < 0.25) grow(x, y, a + (R() < 0.5 ? 1 : -1) * rr(0.6, 1.2), Math.ceil(segs * 0.5), depth + 1);
        }
        if (pts.length > 1) draw(pts);
      };
      for (let i = 0; i < n * 0.2; i++) {
        const x = R() * W, y = R() * H;
        if (far(x, y, 150)) grow(x, y, R() * TAU, 4 + Math.floor(R() * 5), 0);
      }
    },
  };
  const unit = Math.floor(area / 16000);
  for (const p of T.props) if (p !== 'stone') props[p](unit);

  // קרחת אדמה סביב הכוורת
  const dg = b.createRadialGradient(cx, cy, 30, cx, cy, 125);
  dg.addColorStop(0, `rgba(${T.dirt},0.7)`); dg.addColorStop(0.6, `rgba(${T.dirt},0.35)`); dg.addColorStop(1, `rgba(${T.dirt},0)`);
  b.fillStyle = dg; b.beginPath(); b.arc(cx, cy, 125, 0, TAU); b.fill();

  // גבעולי דשא בשני גוונים
  for (let pass = 0; pass < 2; pass++) {
    b.strokeStyle = `rgba(${T.blades[pass]},${pass ? 0.4 : 0.45})`;
    b.lineWidth = pass ? 1.4 : 2;
    b.beginPath();
    for (let i = 0; i < Math.floor(area / 1700 * T.bladeN); i++) {
      const x = R() * W, y = R() * H, lean = rr(-5, 5);
      b.moveTo(x, y); b.quadraticCurveTo(x + lean * 0.3, y - 6, x + lean, y - rr(7, 14));
    }
    b.stroke();
  }
  if (T.props.includes('stone')) props.stone(unit);

  // פרחים קטנים
  if (T.flowers.length) {
    for (let i = 0; i < Math.floor(area / 6500 * T.flowerN); i++) {
      const x = R() * W, y = R() * H;
      if (!far(x, y, 95)) continue;
      const r = rr(2.5, 5.5);
      b.fillStyle = 'rgba(0,0,0,0.14)'; b.beginPath(); b.arc(x + 1.5, y + 2.5, r * 1.4, 0, TAU); b.fill();
      b.fillStyle = T.flowers[i % T.flowers.length];
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU + i;
        b.beginPath(); b.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.72, 0, TAU); b.fill();
      }
      b.fillStyle = '#f5a800';
      b.beginPath(); b.arc(x, y, r * 0.6, 0, TAU); b.fill();
    }
  }

  // --- צמחייה גדולה שזזה ברוח (הבסיס מצויר כאן, הראש מצויר בכל פריים) ---
  flora = [];
  const want = Math.floor(area / (T.flora === 'vent' ? 95000 : 55000));
  let tries = 0;
  while (flora.length < want && tries++ < 400) {
    const x = rr(40, W - 40), y = rr(hudSafe + 50, H - 40);
    if (!far(x, y, 150)) continue;
    if (flora.some((f) => Math.hypot(f.x - x, f.y - y) < 70)) continue;
    const ci = Math.floor(R() * T.floraCols.length);
    const big = T.flora === 'sunflower' || T.flora === 'vent';
    const f = { x, y, s: big ? rr(12, 17) : rr(8, 13), kind: T.flora, ci, c: T.floraCols[ci][0], cc: T.floraCols[ci][1], n: 5 + Math.floor(R() * 4), ph: R() * TAU };
    flora.push(f);
    b.fillStyle = 'rgba(0,0,0,0.16)';
    b.beginPath(); b.ellipse(x + 4, y + 6, f.s * 1.1, f.s * 0.5, 0, 0, TAU); b.fill();
    if (f.kind === 'flower' || f.kind === 'sunflower') {
      b.fillStyle = f.kind === 'sunflower' ? '#4f7d2a' : '#2f7d32';
      b.beginPath(); b.ellipse(x - f.s * 0.9, y + f.s * 0.5, f.s * 0.8, f.s * 0.3, 0.6, 0, TAU); b.ellipse(x + f.s * 0.9, y + f.s * 0.6, f.s * 0.8, f.s * 0.3, -0.6, 0, TAU); b.fill();
    }
  }

  // --- שולי השדה ---
  const C = T.borderCols;
  const blob = (x, y, s, c0, c1, hi) => {
    b.fillStyle = 'rgba(0,0,0,0.2)'; b.beginPath(); b.arc(x + 4, y + 6, s, 0, TAU); b.fill();
    b.fillStyle = c0; b.beginPath(); b.arc(x, y, s, 0, TAU); b.fill();
    b.fillStyle = c1;
    for (let p = 0; p < 5; p++) { const a = p * 1.3 + x; b.beginPath(); b.arc(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45, s * 0.55, 0, TAU); b.fill(); }
    b.fillStyle = `rgba(${hi},0.5)`;
    for (let p = 0; p < 4; p++) { const a = p * 1.7 + y; b.beginPath(); b.arc(x + Math.cos(a) * s * 0.4 - s * 0.15, y + Math.sin(a) * s * 0.4 - s * 0.2, s * 0.22, 0, TAU); b.fill(); }
  };
  const star = (x, y, s, n, inner, rot, col) => {
    b.fillStyle = col; b.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, r2 = i % 2 ? s * inner : s; b.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); }
    b.closePath(); b.fill();
  };
  const edge = {
    bush(x, y, s) { blob(x, y, s, C[0], C[1], C[2]); },
    wheat(x, y, s) {
      blob(x, y, s, C[0], C[1], C[2]);
      b.strokeStyle = 'rgba(120,90,20,0.7)'; b.lineWidth = 1.5;
      for (let j = 0; j < 6; j++) { const a = rr(0, TAU), l = s * rr(0.9, 1.3); b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); b.stroke(); b.fillStyle = '#f0d470'; b.beginPath(); b.ellipse(x + Math.cos(a) * l, y + Math.sin(a) * l, 2.4, 5, a + Math.PI / 2, 0, TAU); b.fill(); }
    },
    blossom(x, y, s) {
      blob(x, y, s * 1.15, C[0], C[1], C[2]);
      b.fillStyle = '#ffffff';
      for (let j = 0; j < 7; j++) { const a = rr(0, TAU), d = s * rr(0.1, 0.9); b.beginPath(); b.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr(1.5, 3), 0, TAU); b.fill(); }
    },
    tree(x, y, s) {
      const cols = [['#8a3f12', '#d9641e'], ['#9c2f1a', '#e0492a'], ['#a8741a', '#f0b232'], ['#7a4a16', '#c98a2a']];
      const c = cols[Math.floor(R() * cols.length)];
      blob(x, y, s * 1.3, c[0], c[1], C[2]);
    },
    reed(x, y, s) {
      blob(x, y, s, C[0], C[1], C[2]);
      for (let j = 0; j < 4; j++) {
        const a = Math.atan2(cy - y, cx - x) + rr(-0.9, 0.9), l = s * rr(1.1, 1.7);
        b.strokeStyle = '#2f6b45'; b.lineWidth = 2; b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); b.stroke();
        b.fillStyle = '#5d3a1e'; b.beginPath(); b.ellipse(x + Math.cos(a) * l, y + Math.sin(a) * l, 3, 7, a + Math.PI / 2, 0, TAU); b.fill();
      }
    },
    pine(x, y, s) {
      b.fillStyle = 'rgba(20,40,80,0.25)'; b.beginPath(); b.arc(x + 5, y + 7, s, 0, TAU); b.fill();
      const rot = R() * TAU;
      star(x, y, s * 1.2, 9, 0.55, rot, C[0]);
      star(x, y, s * 0.85, 8, 0.55, rot + 0.3, C[1]);
      star(x, y, s * 0.55, 7, 0.5, rot + 0.6, `rgba(${C[2]},0.95)`);
      star(x, y, s * 0.25, 6, 0.5, rot, C[1]);
    },
    thorn(x, y, s) {
      b.fillStyle = 'rgba(0,0,0,0.3)'; b.beginPath(); b.arc(x + 4, y + 6, s, 0, TAU); b.fill();
      b.strokeStyle = C[0]; b.lineWidth = 3;
      for (let j = 0; j < 6; j++) { const a = R() * TAU, l = s * rr(1.1, 1.6); b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); b.stroke(); }
      const rg = b.createRadialGradient(x - s * 0.3, y - s * 0.3, 2, x, y, s);
      rg.addColorStop(0, C[1]); rg.addColorStop(1, C[0]);
      b.fillStyle = rg; b.beginPath();
      const nv = 7, a0 = R() * TAU;
      for (let v = 0; v < nv; v++) { const a = a0 + (v / nv) * TAU, r2 = s * rr(0.7, 1.05); b.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); }
      b.closePath(); b.fill();
      b.strokeStyle = `rgba(${C[2]},0.3)`; b.lineWidth = 1.5; b.stroke();
    },
  }[T.border];
  const step = 46;
  for (let x = 0; x <= W; x += step) { edge(x + rr(-10, 10), rr(-14, 4), rr(22, 34)); edge(x + rr(-10, 10), H + rr(-4, 14), rr(22, 34)); }
  for (let y = step; y < H; y += step) { edge(rr(-14, 4), y + rr(-10, 10), rr(22, 34)); edge(W + rr(-4, 14), y + rr(-10, 10), rr(22, 34)); }

  // צל מתחת לכוורת
  b.fillStyle = 'rgba(0,0,0,0.22)';
  b.beginPath(); b.ellipse(cx + 7, cy + 12, 66, 58, 0, 0, TAU); b.fill();
  // הצללה עדינה בשוליים, לעומק
  b.setTransform(1, 0, 0, 1, 0, 0);
  const vg = b.createRadialGradient(bg.width / 2, bg.height / 2, Math.min(bg.width, bg.height) * 0.35, bg.width / 2, bg.height / 2, Math.max(bg.width, bg.height) * 0.75);
  vg.addColorStop(0, `rgba(${T.vignette},0)`); vg.addColorStop(1, `rgba(${T.vignette},0.38)`);
  b.fillStyle = vg; b.fillRect(0, 0, bg.width, bg.height);

  floraSprites.clear();
  if (typeof onBackgroundBuilt === 'function') onBackgroundBuilt();
}
