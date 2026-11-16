/* Hive Keeper – render: ציור החרקים, הכוורת, האפקטים ומזג האוויר */
'use strict';

function shade(hex, f) { // f חיובי = מבהיר, שלילי = מכהה
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function hexPath(x, y, r, c = ctx) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}

// ---------------- תמונות שמורות (מצוירות פעם אחת, ואז רק מועתקות) ----------------
const spriteCache = new Map();
function getSprite(key, half, paint) {
  let sp = spriteCache.get(key);
  if (sp) return sp;
  const k = scale * dpr;
  const size = Math.max(8, Math.ceil(half * 2 * k));
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, size / 2, size / 2);
  paint(g);
  sp = { cv, half };
  spriteCache.set(key, sp);
  return sp;
}
function onBackgroundBuilt() { spriteCache.clear(); }
// כתם אור רך בצבע נתון; מצויר בכל גודל
function glowSprite(color) {
  return getSprite('glow|' + color, 32, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 32);
    gr.addColorStop(0, hexA(color, 1)); gr.addColorStop(0.35, hexA(color, 0.5)); gr.addColorStop(1, hexA(color, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 32, 0, TAU); g.fill();
  });
}
function drawGlow(color, x, y, r, a) {
  const sp = glowSprite(color);
  if (a != null) ctx.globalAlpha = a;
  ctx.drawImage(sp.cv, x - r, y - r, r * 2, r * 2);
  if (a != null) ctx.globalAlpha = 1;
}

// ---------------- חרקים ----------------
// הגוף מצויר פעם אחת לתמונה שמורה, והכנפיים מונפשות מעליו
function paintInsectBody(g, r, c, opts) {
  const kind = opts.kind || '';
  const ab = kind === 'hornet' ? 0.42 : kind === 'bomber' ? 0.68 : opts.wasp ? 0.5 : 0.62;
  g.lineCap = 'round';
  // גלימת הקיסר
  if (kind === 'emperor') {
    g.fillStyle = '#2a0a52'; g.strokeStyle = '#ffb300'; g.lineWidth = r * 0.05;
    g.beginPath(); g.moveTo(r * 0.25, -r * 0.45); g.lineTo(-r * 1.55, -r * 0.95); g.lineTo(-r * 1.15, 0); g.lineTo(-r * 1.55, r * 0.95); g.lineTo(r * 0.25, r * 0.45); g.closePath();
    g.fill(); g.stroke();
  }
  // רגליים
  g.strokeStyle = '#1a1205'; g.lineWidth = Math.max(0.8, r * 0.07);
  g.beginPath();
  for (let i = -1; i <= 1; i++) {
    for (const s of [-1, 1]) {
      g.moveTo(r * (0.25 + i * 0.16), s * r * 0.22);
      g.quadraticCurveTo(r * (0.3 + i * 0.3), s * r * 0.7, r * (0.22 + i * 0.5), s * r * 0.98);
    }
  }
  g.stroke();
  if (opts.fuzzy) { // סלסילות אבקה על הרגליים האחוריות
    g.fillStyle = '#ffd54f';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(-r * 0.24, s * r * 0.9, r * 0.12, 0, TAU); g.fill(); }
  }
  // עוקץ
  const sl = kind === 'hornet' ? 1.95 : 1.7;
  g.fillStyle = '#1b1b1b';
  g.beginPath(); g.moveTo(-r * 1.22, -r * 0.15); g.lineTo(-r * sl, 0); g.lineTo(-r * 1.22, r * 0.15); g.closePath(); g.fill();
  if (kind === 'bomber') { // פתיל
    g.strokeStyle = '#6d4c41'; g.lineWidth = r * 0.09;
    g.beginPath(); g.moveTo(-r * 1.25, 0); g.quadraticCurveTo(-r * 1.55, -r * 0.05, -r * 1.6, -r * 0.35); g.stroke();
  }
  // בטן עם הצללה
  const grad = g.createRadialGradient(-r * 0.7, -r * ab * 0.45, r * 0.05, -r * 0.5, 0, r * 0.95);
  grad.addColorStop(0, shade(c.body, 0.45)); grad.addColorStop(0.55, c.body); grad.addColorStop(1, shade(c.body, -0.4));
  g.save();
  g.beginPath(); g.ellipse(-r * 0.5, 0, r * 0.85, r * ab, 0, 0, TAU);
  g.fillStyle = grad; g.fill();
  g.clip();
  g.strokeStyle = c.stripe; g.lineWidth = r * 0.2; g.lineCap = 'butt';
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(-r * (0.2 + i * 0.42) + r * 0.5, 0, r * 0.55, r * 1.0, 0, Math.PI * 0.72, Math.PI * 1.28);
    g.stroke();
  }
  g.lineCap = 'round';
  if (opts.armor) { // לוחות שריון
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = r * 0.06;
    g.beginPath(); g.ellipse(-r * 0.5, 0, r * 0.6, r * ab * 0.7, 0, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(230,230,230,0.6)';
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-r * (0.15 + i * 0.35), s * r * ab * 0.55, r * 0.045, 0, TAU); g.fill(); }
  }
  if (kind === 'spitter') { // שק ארס זוהר
    const sg = g.createRadialGradient(-r * 0.6, 0, 0, -r * 0.6, 0, r * 0.42);
    sg.addColorStop(0, 'rgba(225,255,120,0.95)'); sg.addColorStop(1, 'rgba(160,230,60,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(-r * 0.6, 0, r * 0.42, 0, TAU); g.fill();
  }
  if (kind === 'splitter') { // ביצים
    g.fillStyle = 'rgba(255,225,255,0.6)'; g.strokeStyle = 'rgba(60,0,80,0.45)'; g.lineWidth = r * 0.04;
    for (const p of [[-0.8, 0], [-0.42, -0.24], [-0.42, 0.24]]) { g.beginPath(); g.arc(r * p[0], r * p[1], r * 0.17, 0, TAU); g.fill(); g.stroke(); }
  }
  if (kind === 'nurse') { // צלב ירוק
    g.fillStyle = '#2e9d4f';
    g.fillRect(-r * 0.78, -r * 0.08, r * 0.56, r * 0.16);
    g.fillRect(-r * 0.58, -r * 0.28, r * 0.16, r * 0.56);
  }
  // ברק
  g.fillStyle = 'rgba(255,255,255,0.33)';
  g.beginPath(); g.ellipse(-r * 0.62, -r * ab * 0.5, r * 0.42, r * 0.1, -0.12, 0, TAU); g.fill();
  g.restore();
  g.lineWidth = Math.max(1, r * 0.06); g.strokeStyle = kind === 'emperor' ? '#c79a00' : 'rgba(0,0,0,0.55)';
  g.beginPath(); g.ellipse(-r * 0.5, 0, r * 0.85, r * ab, 0, 0, TAU); g.stroke();
  // חזה
  const tr = r * (opts.wasp ? 0.34 : 0.44);
  if (opts.fuzzy) {
    const tg = g.createRadialGradient(r * 0.24, -r * 0.1, r * 0.05, r * 0.3, 0, tr);
    tg.addColorStop(0, '#ffe58a'); tg.addColorStop(1, '#a8770f');
    g.fillStyle = tg; g.beginPath(); g.arc(r * 0.3, 0, tr, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,236,150,0.9)'; g.lineWidth = Math.max(0.7, r * 0.05);
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; g.moveTo(r * 0.3 + Math.cos(a) * tr * 0.85, Math.sin(a) * tr * 0.85); g.lineTo(r * 0.3 + Math.cos(a) * tr * 1.18, Math.sin(a) * tr * 1.18); }
    g.stroke();
  } else {
    const tg = g.createRadialGradient(r * 0.24, -r * 0.1, r * 0.03, r * 0.3, 0, tr);
    tg.addColorStop(0, shade(c.head, 0.35)); tg.addColorStop(1, c.head);
    g.fillStyle = tg; g.beginPath(); g.arc(r * 0.3, 0, tr, 0, TAU); g.fill();
  }
  if (kind === 'queen') { // צווארון מלכותי
    g.fillStyle = '#ffb6d5';
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; g.beginPath(); g.arc(r * 0.3 + Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, r * 0.085, 0, TAU); g.fill(); }
  }
  if (kind === 'brute' || kind === 'general') { // כותפות
    for (const s of [-1, 1]) {
      const pg = g.createLinearGradient(0, s * r * 0.2, 0, s * r * 0.5);
      pg.addColorStop(0, kind === 'general' ? '#ffe082' : '#cfd3d6'); pg.addColorStop(1, kind === 'general' ? '#b8860b' : '#6d7478');
      g.fillStyle = pg; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = r * 0.04;
      g.beginPath(); g.ellipse(r * 0.3, s * r * 0.36, r * 0.26, r * 0.14, 0, 0, TAU); g.fill(); g.stroke();
    }
  }
  if (kind === 'general') { // מדליות
    g.fillStyle = '#ffd54f'; g.beginPath(); g.arc(r * 0.24, -r * 0.08, r * 0.06, 0, TAU); g.arc(r * 0.24, r * 0.1, r * 0.06, 0, TAU); g.fill();
  }
  // ראש
  const hg = g.createRadialGradient(r * 0.72, -r * 0.1, r * 0.03, r * 0.78, 0, r * 0.38);
  hg.addColorStop(0, shade(c.head, 0.4)); hg.addColorStop(1, c.head);
  g.fillStyle = hg; g.beginPath(); g.arc(r * 0.78, 0, r * 0.36, 0, TAU); g.fill();
  // לסתות לצרעות
  if (opts.wasp) {
    const ml = kind === 'brute' ? 1.42 : 1.3;
    g.fillStyle = '#2a1500';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(r * 1.05, s * r * 0.06); g.lineTo(r * ml, s * r * 0.16); g.lineTo(r * 1.08, s * r * 0.22); g.closePath(); g.fill(); }
  }
  if (kind === 'spitter') { g.fillStyle = '#1b3a0b'; g.beginPath(); g.ellipse(r * 1.14, 0, r * 0.15, r * 0.09, 0, 0, TAU); g.fill(); }
  if (kind === 'thief') { // מסכת שודד
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(r * 0.9, 0, r * 0.13, r * 0.37, 0, 0, TAU); g.fill();
  }
  if (kind === 'guard' || kind === 'general') { // קסדה
    const mg = g.createLinearGradient(r * 0.45, -r * 0.3, r * 0.9, r * 0.3);
    mg.addColorStop(0, '#dfe7ee'); mg.addColorStop(1, '#75869a');
    g.fillStyle = mg; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = r * 0.04;
    g.beginPath(); g.arc(r * 0.74, 0, r * 0.34, Math.PI * 0.5, Math.PI * 1.5); g.closePath(); g.fill(); g.stroke();
    if (kind === 'general') { g.fillStyle = '#d32f2f'; g.beginPath(); g.ellipse(r * 0.62, 0, r * 0.3, r * 0.075, 0, 0, TAU); g.fill(); }
  }
  // עיניים
  for (const s of [-1, 1]) {
    g.fillStyle = c.eye;
    g.beginPath(); g.ellipse(r * 0.9, s * r * 0.21, r * (opts.fuzzy ? 0.16 : 0.14), r * (opts.fuzzy ? 0.2 : 0.18), s * 0.3, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(r * 0.94, s * r * 0.17, r * (opts.fuzzy ? 0.07 : 0.05), 0, TAU); g.fill();
  }
  if (kind === 'hornet') { // גבות זועפות
    g.strokeStyle = '#1a0500'; g.lineWidth = r * 0.08;
    g.beginPath(); for (const s of [-1, 1]) { g.moveTo(r * 0.8, s * r * 0.36); g.lineTo(r * 1.04, s * r * 0.12); } g.stroke();
  }
  // מחושים
  g.strokeStyle = c.head; g.lineWidth = Math.max(1, r * 0.07);
  g.beginPath();
  g.moveTo(r * 1.0, -r * 0.12); g.quadraticCurveTo(r * 1.4, -r * 0.2, r * 1.5, -r * 0.55);
  g.moveTo(r * 1.0, r * 0.12); g.quadraticCurveTo(r * 1.4, r * 0.2, r * 1.5, r * 0.55);
  g.stroke();
  if (opts.fuzzy) { g.fillStyle = c.head; for (const s of [-1, 1]) { g.beginPath(); g.arc(r * 1.5, s * r * 0.55, r * 0.07, 0, TAU); g.fill(); } }
  // כתר לבוסים
  if (opts.crown) {
    const k = kind === 'emperor' ? 1.25 : 1;
    g.fillStyle = '#ffd700'; g.strokeStyle = '#8a6500'; g.lineWidth = Math.max(1, r * 0.03);
    g.beginPath();
    g.moveTo(r * 0.5, -r * 0.3 * k); g.lineTo(r * 0.5, r * 0.3 * k); g.lineTo(r * (0.5 + 0.18 * k), r * 0.2 * k); g.lineTo(r * (0.5 + 0.1 * k), r * 0.1 * k);
    g.lineTo(r * (0.5 + 0.26 * k), 0); g.lineTo(r * (0.5 + 0.1 * k), -r * 0.1 * k); g.lineTo(r * (0.5 + 0.18 * k), -r * 0.2 * k); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = kind === 'emperor' ? '#7c4dff' : '#e53935';
    g.beginPath(); g.arc(r * 0.57, 0, r * 0.05 * k, 0, TAU); g.fill();
  }
}

function paintWings(g, r, c, flap, alpha, second) {
  for (const s of [-1, 1]) {
    g.save();
    g.translate(r * 0.15, s * r * 0.2);
    g.rotate(s * (2.1 + flap));
    g.fillStyle = c.wing;
    g.beginPath(); g.ellipse(r * 0.62, 0, r * 0.78, r * 0.3, 0, 0, TAU); g.fill();
    if (alpha) {
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1;
      g.stroke();
      g.beginPath(); g.moveTo(r * 0.05, 0); g.lineTo(r * 1.25, 0); g.moveTo(r * 0.4, 0); g.lineTo(r * 1.0, -r * 0.18); g.stroke();
    }
    g.restore();
    if (second) { // זוג כנפיים אחורי
      g.save();
      g.translate(-r * 0.05, s * r * 0.2);
      g.rotate(s * (2.55 + flap * 0.7));
      g.fillStyle = c.wing;
      g.beginPath(); g.ellipse(r * 0.5, 0, r * 0.6, r * 0.22, 0, 0, TAU); g.fill();
      g.restore();
    }
  }
}

function insectSprite(key, r, c, opts) {
  return getSprite('bug|' + key + '|' + r, r * 2.1, (g) => paintInsectBody(g, r, c, opts));
}

function drawInsect(x, y, ang, r, c, t, opts = {}) {
  const sp = insectSprite(opts.key || c.body, r, c, opts);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (opts.sx) ctx.scale(opts.sx, opts.sy || opts.sx);
  const baseA = opts.alpha == null ? 1 : opts.alpha;
  ctx.globalAlpha = baseA;
  ctx.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2);
  // כנפיים עם טשטוש תנועה
  const flap = Math.sin(t * 55) * 0.38;
  ctx.globalAlpha = baseA * 0.4;
  paintWings(ctx, r, c, -flap, false, opts.wings2);
  ctx.globalAlpha = baseA;
  paintWings(ctx, r, c, flap, true, opts.wings2);
  ctx.globalAlpha = 1;
  if (opts.flash) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(-r * 0.2, 0, r * 1.2, r * 0.7, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

const BEE_COLORS = { body: '#ffc61a', stripe: '#1d1d1d', head: '#2b1d00', wing: 'rgba(230,245,255,0.6)', eye: '#111' };
const HELPER_COLORS = { body: '#ffe066', stripe: '#3a2a00', head: '#3a2a00', wing: 'rgba(230,245,255,0.55)', eye: '#111' };
function enemyOpts(e, extra) {
  const kind = e.boss ? e.kind : e.type === 'clone' ? 'emperor' : e.type;
  const o = { wasp: true, kind, key: kind, crown: kind === 'queen' || kind === 'emperor', armor: kind === 'brute' || kind === 'general', wings2: kind === 'emperor' };
  return extra ? Object.assign(o, extra) : o;
}

// דיוקן למדריך הצרעות ולתפריט
function drawPortrait(cv, key, def, isBoss, big) {
  const g = cv.getContext('2d');
  const s = cv.width, half = s / 2;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, s, cv.height);
  const r = big || (isBoss ? s * 0.2 : s * 0.19);
  g.translate(half, cv.height / 2 + r * 0.15);
  g.rotate(-Math.PI / 2 + (big ? 0.35 : 0));
  const kind = key;
  const bee = key === 'bee';
  const opts = bee ? { fuzzy: true } : { wasp: true, kind, crown: kind === 'queen' || kind === 'emperor', armor: kind === 'brute' || kind === 'general' };
  g.globalAlpha = 0.9;
  paintWings(g, r, def, 0.25, true, kind === 'emperor');
  g.globalAlpha = 1;
  paintInsectBody(g, r, def, opts);
  if (kind === 'guard') { // המגן
    g.strokeStyle = 'rgba(190,230,255,0.95)'; g.lineWidth = r * 0.16; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, r * 1.75, -1.0, 1.0); g.stroke();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}
// הדבורה המנצחת, עם כתר – למסך הניצחון
function drawVictoryBee(cv) {
  const g = cv.getContext('2d');
  const r = cv.height * 0.25;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  g.translate(cv.width / 2, cv.height / 2 + r * 0.35);
  g.rotate(-Math.PI / 2);
  g.globalAlpha = 0.9;
  paintWings(g, r, BEE_COLORS, 0.25, true, false);
  g.globalAlpha = 1;
  paintInsectBody(g, r, BEE_COLORS, { fuzzy: true, crown: true });
  g.setTransform(1, 0, 0, 1, 0, 0);
}
// מחול הניצחון: שתי טבעות של דבורים שחגות סביב הכוורת בכיוונים מנוגדים
function drawVictoryBees() {
  const Hv = G.hive;
  for (let i = 0; i < 14; i++) {
    const inner = i % 2 === 0;
    const dir = inner ? 1 : -1;
    const a = animT * (inner ? 1.1 : 0.8) * dir + (i / 14) * TAU;
    const R = (inner ? 105 : 165) + Math.sin(animT * 2 + i) * 10;
    const x = Hv.x + Math.cos(a) * R, y = Hv.y + Math.sin(a) * R * 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.ellipse(x + 4, y + 11, 8, 3.5, 0, 0, TAU); ctx.fill();
    drawInsect(x, y, a + dir * Math.PI / 2, 10, HELPER_COLORS, animT + i, { fuzzy: true, key: 'helper' });
  }
}
function drawLogo() {
  const cv = $('logoBee');
  if (!cv) return;
  drawPortrait(cv, 'bee', BEE_COLORS, false, cv.height * 0.26);
}

// ---------------- כוורת ----------------
const HIVE_CELL = 15.5;
const HIVE_CENTERS = [[0, 0]];
for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; HIVE_CENTERS.push([Math.cos(a) * HIVE_CELL * Math.sqrt(3), Math.sin(a) * HIVE_CELL * Math.sqrt(3)]); }

function paintHive(g, broken) {
  const hs = HIVE_CELL;
  // בסיס עץ
  const wood = g.createRadialGradient(-10, -12, 6, 0, 0, 56);
  wood.addColorStop(0, '#b98a52'); wood.addColorStop(1, '#5d3d1e');
  g.fillStyle = wood; g.beginPath(); g.arc(0, 0, 54, 0, TAU); g.fill();
  g.strokeStyle = '#3d2610'; g.lineWidth = 3; g.stroke();
  g.strokeStyle = 'rgba(60,35,10,0.35)'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(0, 0, 49, 0.3, 2.4); g.stroke();
  g.beginPath(); g.arc(0, 0, 51.5, 3.4, 5.6); g.stroke();
  // תאי דבש
  HIVE_CENTERS.forEach(([cx, cy], i) => {
    const br = i > 0 && i <= broken;
    hexPath(cx, cy, hs, g);
    const cg = g.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, hs);
    if (br) { cg.addColorStop(0, '#7a5520'); cg.addColorStop(1, '#33200a'); }
    else { cg.addColorStop(0, '#fff6c2'); cg.addColorStop(0.45, i === 0 ? '#ffb000' : '#ffc640'); cg.addColorStop(1, '#d98200'); }
    g.fillStyle = cg; g.fill();
    g.lineWidth = 2.6; g.strokeStyle = '#8a5200'; g.stroke();
    if (br) {
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(cx - hs * 0.6, cy - hs * 0.2); g.lineTo(cx - hs * 0.1, cy + hs * 0.1); g.lineTo(cx + hs * 0.1, cy - hs * 0.4);
      g.moveTo(cx - hs * 0.1, cy + hs * 0.1); g.lineTo(cx + hs * 0.5, cy + hs * 0.5);
      g.stroke();
    } else {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.ellipse(cx - hs * 0.28, cy - hs * 0.38, hs * 0.3, hs * 0.13, -0.5, 0, TAU); g.fill();
    }
  });
  // פתח הכוורת
  g.fillStyle = '#2a1600';
  g.beginPath(); g.ellipse(0, hs * 0.15, hs * 0.42, hs * 0.3, 0, 0, TAU); g.fill();
}

function drawHive(Hv, S) {
  const frac = Hv.hp / Hv.maxHp;
  // כמה תאים שבורים (0..6) – התא האחרון נשבר ראשון
  let broken = 0;
  for (let i = 1; i <= 6; i++) if (frac < 1 - i / 7) broken = i;
  // דבש דביק: טבעת ענבר סביב הכוורת
  if (S && S.thorns) {
    const rr = Hv.r + 46;
    ctx.strokeStyle = `rgba(255,179,0,${0.22 + 0.06 * Math.sin(animT * 3)})`; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(Hv.x, Hv.y, rr - 6, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,200,60,0.08)'; ctx.beginPath(); ctx.arc(Hv.x, Hv.y, rr, 0, TAU); ctx.fill();
  }
  // הילה חמה
  drawGlow('#ffe16e', Hv.x, Hv.y, 82 + Math.sin(animT * 2) * 4, 0.42);
  const sp = getSprite('hive|' + broken, 60, (g) => paintHive(g, broken));
  const jx = Hv.hitT > 0 ? rand(-2, 2) : 0;
  ctx.drawImage(sp.cv, Hv.x + jx - sp.half, Hv.y - sp.half, sp.half * 2, sp.half * 2);
  ctx.save();
  ctx.translate(Hv.x + jx, Hv.y);
  // טיפות דבש
  if (frac > 0.25) {
    ctx.fillStyle = '#ffb300';
    for (let i = 0; i < 3; i++) {
      const dx = -22 + i * 22, len = 4 + 3 * Math.sin(animT * 1.3 + i * 2);
      ctx.beginPath(); ctx.ellipse(dx, 41 + len * 0.5, 2.6, 3 + len * 0.6, 0, 0, TAU); ctx.fill();
    }
  }
  // כוורת שומרת: צריח קטן
  if (S && S.turret) {
    ctx.save(); ctx.rotate(Hv.aim || 0);
    ctx.fillStyle = '#5d3d1e'; ctx.strokeStyle = '#2a1600'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(26, -5, 22, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffc640'; ctx.beginPath(); ctx.arc(48, 0, 4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (Hv.hitT > 0) {
    ctx.fillStyle = 'rgba(255,60,60,0.35)';
    ctx.beginPath(); ctx.arc(0, 0, 56, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // דבורים פועלות קטנות סביב הכוורת
  const n = Math.max(1, Math.ceil(7 * frac));
  for (let i = 0; i < n; i++) {
    const dir = i % 2 ? 1 : -1;
    const a = animT * (1.1 + i * 0.19) * dir + i * 2.1;
    const rad = 66 + 13 * Math.sin(animT * 2.3 + i * 1.7);
    const bx = Hv.x + Math.cos(a) * rad, by = Hv.y + Math.sin(a) * rad * 0.9;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(a + dir * Math.PI / 2);
    ctx.fillStyle = 'rgba(240,250,255,0.6)';
    const wf = Math.sin(animT * 60 + i) * 1.2;
    ctx.beginPath(); ctx.ellipse(0, -3.4 - wf * 0.3, 2.6, 1.5, 0.5, 0, TAU); ctx.ellipse(0, 3.4 + wf * 0.3, 2.6, 1.5, -0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2b1d00'; ctx.fillRect(-1.4, -2.3, 1.3, 4.6); ctx.beginPath(); ctx.arc(3.4, 0, 1.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ---------------- נוף חי: כתמים, צמחייה מתנדנדת, עננים, מזג אוויר ----------------
function drawDecals() {
  for (const d of G.decals) {
    const f = Math.min(1, d.life / 2.5);
    if (d.kind === 'scorch') {
      drawGlow('#140e08', d.x, d.y, d.r, 0.6 * f);
    } else {
      ctx.fillStyle = hexA(d.color, 0.3 * f);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = d.rot + i * 1.9, rr = d.r * (0.25 + hash(i, d.rot) * 0.5);
        ctx.moveTo(d.x + Math.cos(a) * d.r * 0.5 + rr, d.y + Math.sin(a) * d.r * 0.5);
        ctx.arc(d.x + Math.cos(a) * d.r * 0.5, d.y + Math.sin(a) * d.r * 0.5, rr, 0, TAU);
      }
      ctx.fill();
    }
  }
}

function paintFlora(g, f) {
  const s = f.s;
  if (f.kind === 'sunflower') {
    for (let p = 0; p < 14; p++) {
      const a = (p / 14) * TAU;
      g.fillStyle = p % 2 ? '#ffc928' : '#f5a800';
      g.beginPath(); g.ellipse(Math.cos(a) * s * 0.78, Math.sin(a) * s * 0.78, s * 0.46, s * 0.17, a, 0, TAU); g.fill();
    }
    const cg = g.createRadialGradient(-s * 0.1, -s * 0.1, 1, 0, 0, s * 0.5);
    cg.addColorStop(0, '#8a5a1e'); cg.addColorStop(1, '#3d2208');
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,200,90,0.5)';
    for (let i = 0; i < 12; i++) { const a = i * 2.4, d = s * 0.38 * Math.sqrt((i + 1) / 12); g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, s * 0.045, 0, TAU); g.fill(); }
  } else if (f.kind === 'mushroom') {
    g.fillStyle = f.cc; g.beginPath(); g.ellipse(0, s * 0.55, s * 0.32, s * 0.5, 0, 0, TAU); g.fill();
    const cg = g.createRadialGradient(-s * 0.3, -s * 0.3, 1, 0, 0, s);
    cg.addColorStop(0, shade(f.c, 0.35)); cg.addColorStop(1, shade(f.c, -0.3));
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, s * 0.85, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const p of [[-0.35, -0.3, 0.16], [0.3, -0.2, 0.13], [0, 0.3, 0.15], [-0.4, 0.25, 0.1], [0.42, 0.3, 0.09]]) { g.beginPath(); g.arc(s * p[0], s * p[1], s * p[2], 0, TAU); g.fill(); }
  } else if (f.kind === 'reed') {
    for (let i = -1; i <= 1; i++) {
      const tx = i * s * 0.7, ty = -s * (1.9 - Math.abs(i) * 0.3);
      g.strokeStyle = f.c; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(i * s * 0.15, s * 0.3); g.quadraticCurveTo(tx * 0.4, ty * 0.5, tx, ty); g.stroke();
      g.fillStyle = f.cc; g.beginPath(); g.ellipse(tx, ty, s * 0.17, s * 0.45, i * 0.25, 0, TAU); g.fill();
    }
    g.fillStyle = f.c;
    for (const sgn of [-1, 1]) { g.beginPath(); g.ellipse(sgn * s * 0.55, -s * 0.3, s * 0.75, s * 0.14, sgn * -1.0, 0, TAU); g.fill(); }
  } else if (f.kind === 'crystal') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, l = s * (i % 2 ? 0.75 : 1.05);
      g.save(); g.rotate(a);
      const cg = g.createLinearGradient(0, 0, l, 0);
      cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, f.c);
      g.fillStyle = cg; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(l * 0.45, -s * 0.16); g.lineTo(l, 0); g.lineTo(l * 0.45, s * 0.16); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  } else if (f.kind === 'vent') {
    g.fillStyle = f.cc; g.strokeStyle = '#0f0907'; g.lineWidth = 2;
    g.beginPath();
    for (let v = 0; v < 9; v++) { const a = (v / 9) * TAU, r2 = s * (0.8 + 0.25 * hash(v, f.ph)); g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 * 0.8); }
    g.closePath(); g.fill(); g.stroke();
    const cg = g.createRadialGradient(0, 0, 1, 0, 0, s * 0.55);
    cg.addColorStop(0, '#fff2b0'); cg.addColorStop(0.5, f.c); cg.addColorStop(1, 'rgba(120,20,0,0.9)');
    g.fillStyle = cg; g.beginPath(); g.ellipse(0, 0, s * 0.5, s * 0.38, 0, 0, TAU); g.fill();
  } else {
    g.fillStyle = f.c;
    for (let p = 0; p < f.n; p++) {
      const a = (p / f.n) * TAU;
      g.beginPath(); g.ellipse(Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.72, s * 0.62, s * 0.36, a, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let p = 0; p < f.n; p += 2) {
      const a = (p / f.n) * TAU;
      g.beginPath(); g.ellipse(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6, s * 0.3, s * 0.12, a, 0, TAU); g.fill();
    }
    g.fillStyle = f.cc; g.beginPath(); g.arc(0, 0, s * 0.42, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.arc(s * 0.08, s * 0.1, s * 0.25, 0, TAU); g.fill();
  }
}
function drawFlora(alpha) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  for (const f of flora) {
    const key = 'flora|' + f.kind + '|' + f.ci + '|' + f.n + '|' + Math.round(f.s);
    const fs = { s: Math.round(f.s), kind: f.kind, c: f.c, cc: f.cc, n: f.n, ph: f.ci };
    const sp = getSprite(key, fs.s * 2.6, (g) => paintFlora(g, fs));
    const still = f.kind === 'mushroom' || f.kind === 'vent' || f.kind === 'crystal';
    const sway = still ? 0 : Math.sin(animT * 1.4 + f.ph) * 0.18;
    ctx.save();
    ctx.translate(f.x + sway * f.s * 1.5, f.y);
    ctx.rotate(sway);
    ctx.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2);
    ctx.restore();
    if (f.kind === 'vent') {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('#ff7a1a', f.x, f.y, f.s * (2 + 0.5 * Math.sin(animT * 2.2 + f.ph)), alpha * 0.5);
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'source-over';
    } else if (f.kind === 'crystal') {
      const tw = Math.sin(animT * 2.5 + f.ph * 3);
      if (tw > 0.5) drawSparkle(f.x + f.s * 0.4, f.y - f.s * 0.5, 3 + tw * 3, (tw - 0.5) * 2 * alpha);
    }
  }
  ctx.globalAlpha = 1;
}

function drawClouds(strength) {
  if (strength <= 0.02 || quality.tier === 0) return;
  for (let i = 0; i < 3; i++) {
    const span = W + 700;
    const cx = ((animT * (14 + i * 5) + hash(i, 1) * span) % span) - 350;
    const cy = H * (0.2 + 0.3 * i) + Math.sin(animT * 0.1 + i) * 30;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1.7, 1);
    drawGlow('#001a0a', 0, 0, 190, 0.2 * strength);
    ctx.restore();
  }
}

function drawSparkle(x, y, s, a) {
  ctx.strokeStyle = `rgba(255,255,255,${clamp(a, 0, 1).toFixed(2)})`; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
}

// מזג אוויר: הכול מחושב מהזמן, בלי לשמור מצב
function drawWeather(T, dark) {
  const kind = T.weather;
  const dens = Math.min(1.6, (W * H) / 900000) * FX;
  if (kind === 'pollen' || T.fireflies) {
    const night = T.fireflies || 0;
    for (let i = 0; i < 26 * dens; i++) {
      const fx = W * (0.5 + 0.5 * Math.sin(animT * (0.07 + hash(i, 2) * 0.08) + i * 7.3));
      const fy = H * (0.5 + 0.5 * Math.cos(animT * (0.06 + hash(i, 3) * 0.08) + i * 3.1));
      const tw = 0.5 + 0.5 * Math.sin(animT * 3 + i * 1.3);
      if (night && i % 2) {
        ctx.globalCompositeOperation = 'lighter';
        drawGlow('#d7ff78', fx, fy, 9, 0.5 * tw * night);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(240,255,170,${((0.4 + 0.6 * tw) * night).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(fx, fy, 2.1, 0, TAU); ctx.fill();
      } else if (i % 2 === 0) {
        ctx.fillStyle = `rgba(255,250,200,${(0.25 + 0.3 * tw).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, TAU); ctx.fill();
      }
    }
  }
  if (kind === 'petals' || kind === 'leaves') {
    const leaves = kind === 'leaves';
    const cols = leaves ? ['#d9641e', '#e8a33a', '#b5451b', '#f0c14b'] : ['#ffc9da', '#ffe3ec', '#f8a8c4', '#ffffff'];
    const n = (leaves ? 30 : 38) * dens;
    for (let i = 0; i < n; i++) {
      const sp = (leaves ? 55 : 32) + hash(i, 1) * 45;
      const y = ((hash(i, 2) * (H + 40) + animT * sp) % (H + 40)) - 20;
      const x = ((hash(i, 3) * (W + 80) + animT * sp * (leaves ? 0.9 : 0.45) + Math.sin(animT * 1.3 + i) * 22) % (W + 80)) - 40;
      const rot = animT * (1 + hash(i, 4) * 2.5) + i;
      const sz = leaves ? 6.5 : 4.2;
      ctx.fillStyle = cols[i % 4];
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.ellipse(x, y, sz, sz * (0.35 + 0.25 * Math.abs(Math.sin(rot * 0.7))), rot, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (kind === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    for (let i = 0; i < 110 * dens; i++) {
      const sp = 45 + hash(i, 1) * 60;
      const y = ((hash(i, 2) * (H + 20) + animT * sp) % (H + 20)) - 10;
      const x = ((hash(i, 3) * (W + 60) + animT * 14 + Math.sin(animT * 0.9 + i * 1.7) * 26) % (W + 60)) - 30;
      const r = 1.2 + hash(i, 5) * 1.9;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
  }
  if (kind === 'embers') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46 * dens; i++) {
      const sp = 38 + hash(i, 1) * 60;
      const y = H + 15 - ((hash(i, 2) * (H + 30) + animT * sp) % (H + 30));
      const x = ((hash(i, 3) * (W + 60) + Math.sin(animT * 1.1 + i * 2.3) * 30) % (W + 60)) - 30;
      const fl = 0.45 + 0.55 * Math.sin(animT * 7 + i * 1.9);
      drawGlow(i % 3 ? '#ff7a1a' : '#ffd166', x, y, 4 + hash(i, 5) * 5, 0.75 * fl);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (kind === 'rain') {
    const n = Math.floor(110 * dens);
    ctx.strokeStyle = 'rgba(195,220,255,0.38)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sp = 950 + hash(i, 3) * 450;
      const y = ((hash(i, 2) * (H + 60) + animT * sp) % (H + 60)) - 30;
      const x = ((hash(i, 1) * (W + 120) - animT * sp * 0.25) % (W + 120) + (W + 120)) % (W + 120) - 30;
      ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 24);
    }
    ctx.stroke();
    // אדוות על הקרקע
    ctx.lineWidth = 1;
    for (let i = 0; i < Math.floor(14 * dens); i++) {
      const tt = animT * 1.3 + hash(i, 5) * 9;
      const ph = tt % 1, cell = Math.floor(tt);
      ctx.strokeStyle = `rgba(210,230,255,${(0.32 * (1 - ph)).toFixed(2)})`;
      ctx.beginPath(); ctx.ellipse(hash(i + cell * 13, 7) * W, hash(i + cell * 17, 9) * H, 3 + ph * 11, 1.5 + ph * 5, 0, 0, TAU); ctx.stroke();
    }
  }
}

// --- תאורת לילה: שכבת חושך עם "חורים" של אור ---
let lightCv = null, lightCtx = null;
function drawLighting(dark) {
  const lw = Math.ceil(canvas.width / 2), lh = Math.ceil(canvas.height / 2);
  if (!lightCv || lightCv.width !== lw || lightCv.height !== lh) {
    lightCv = document.createElement('canvas'); lightCv.width = lw; lightCv.height = lh;
    lightCtx = lightCv.getContext('2d');
  }
  const L = lightCtx, k2 = (scale * dpr) / 2;
  L.setTransform(1, 0, 0, 1, 0, 0);
  L.globalCompositeOperation = 'source-over';
  L.globalAlpha = 1;
  L.clearRect(0, 0, lw, lh);
  L.fillStyle = `rgba(5,8,40,${dark.toFixed(3)})`;
  L.fillRect(0, 0, lw, lh);
  L.globalCompositeOperation = 'destination-out';
  L.setTransform(k2, 0, 0, k2, 0, 0);
  const hs = glowSprite('#ffffff').cv;
  const hole = (x, y, r, a) => { L.globalAlpha = a; L.drawImage(hs, x - r, y - r, r * 2, r * 2); };
  if (G) {
    const Hv = G.hive, P = G.player;
    hole(Hv.x, Hv.y, 290 + Math.sin(animT * 2) * 8, 1);
    hole(P.x, P.y, 200, 1);
    for (const h of G.helpers) hole(h.x, h.y, 80, 0.7);
    for (let i = 0; i < G.stingers.length && i < 40; i++) hole(G.stingers[i].x, G.stingers[i].y, 44, 0.6);
    for (let i = 0; i < G.shots.length && i < 60; i++) hole(G.shots[i].x, G.shots[i].y, 52, 0.7);
    for (const p of G.pickups) hole(p.x, p.y, p.kind === 'honey' ? 34 : 62, 0.6);
    for (const r of G.rings) hole(r.x, r.y, r.r + 60, 0.9);
    for (const m of G.marks) hole(m.x, m.y, m.r * 1.6, 0.7);
    for (const e of G.enemies) {
      if (e.boss) { hole(e.x, e.y, e.r * 3, 0.7); if (e.beam && e.beam.on) for (let d = 60; d < e.beam.len; d += 70) hole(e.x + Math.cos(e.beamA) * d, e.y + Math.sin(e.beamA) * d, 80, 0.8); }
      else if (e.def.bomb) hole(e.x, e.y, 54, 0.4 + 0.3 * Math.sin(e.t * 14));
      else if (e.elite || e.type === 'nurse' || e.type === 'clone') hole(e.x, e.y, 60, 0.5);
    }
  } else {
    hole(W / 2, H / 2, 320, 1);
  }
  if (env.theme.flora === 'vent' || env.theme.flora === 'crystal') for (const f of flora) hole(f.x, f.y, f.s * 4.5, 0.55);
  L.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lightCv, 0, 0, canvas.width, canvas.height);
}

// ---------------- חלקיקים ----------------
function drawParticles() {
  for (const p of G.particles) {
    const f = Math.max(0, p.life / p.max);
    const k = p.kind;
    if (k === 'spark') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = f;
      ctx.strokeStyle = p.color; ctx.lineWidth = p.r * 0.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    } else if (k === 'shard') {
      ctx.globalAlpha = f;
      ctx.fillStyle = p.color;
      const c = Math.cos(p.rot), s = Math.sin(p.rot), r = p.r;
      ctx.beginPath(); ctx.moveTo(p.x + c * r, p.y + s * r); ctx.lineTo(p.x - s * r * 0.5, p.y + c * r * 0.5); ctx.lineTo(p.x - c * r * 0.6 + s * r * 0.4, p.y - s * r * 0.6 - c * r * 0.4); ctx.closePath(); ctx.fill();
    } else if (k === 'star') {
      ctx.globalAlpha = f;
      ctx.fillStyle = p.color;
      const r = p.r * (0.6 + f), q = r * 0.3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + q, p.y - q); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x + q, p.y + q);
      ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - q, p.y + q); ctx.lineTo(p.x - r, p.y); ctx.lineTo(p.x - q, p.y - q);
      ctx.closePath(); ctx.fill();
    } else if (k === 'flash') {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(p.color, p.x, p.y, p.r * (1.3 - f * 0.3), f * 0.9);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalAlpha = f * (p.a || 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawPickups() {
  for (const p of G.pickups) {
    const bob = Math.sin(p.t * 5) * 2;
    if (p.life < 3 && Math.floor(p.life * 8) % 2 === 0) continue;
    const py = p.y + bob;
    if (p.kind === 'honey') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 8, 6, 2.5, 0, 0, TAU); ctx.fill();
      const sp = getSprite('honey', 10, (g) => {
        const hg = g.createRadialGradient(-2, -3, 0.5, 0, 0, 8);
        hg.addColorStop(0, '#fff3b0'); hg.addColorStop(0.5, '#ffb300'); hg.addColorStop(1, '#c97700');
        hexPath(0, 0, 7.5, g);
        g.fillStyle = hg; g.fill();
        g.strokeStyle = '#7a4a00'; g.lineWidth = 1.3; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-2, -3, 2.4, 1.2, -0.5, 0, TAU); g.fill();
      });
      ctx.drawImage(sp.cv, p.x - sp.half, py - sp.half, sp.half * 2, sp.half * 2);
      const tw = Math.sin(p.t * 4);
      if (tw > 0.3) drawSparkle(p.x + 4, py - 5, 3 + tw * 2, tw);
    } else if (p.kind === 'heart') {
      drawGlow('#ff7896', p.x, py, 22 + Math.sin(p.t * 6) * 3, 0.55);
      ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('❤️', p.x, py);
    } else {
      const pc = { rapid: '#ffd54f', shield: '#4dd0e1', freeze: '#bbdefb' }[p.kind];
      const pi = { rapid: '⚡', shield: '🛡️', freeze: '❄️' }[p.kind];
      // קרניים מסתובבות
      ctx.save(); ctx.translate(p.x, py); ctx.rotate(p.t * 1.5);
      ctx.fillStyle = hexA(pc, 0.3);
      for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, -5); ctx.lineTo(26, 5); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      const sp = getSprite('orb|' + p.kind, 18, (g) => {
        const pg = g.createRadialGradient(-4, -5, 1, 0, 0, 15);
        pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.5, pc); pg.addColorStop(1, shade(pc, -0.35));
        g.fillStyle = pg; g.strokeStyle = '#ffffff'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.fill(); g.stroke();
      });
      ctx.drawImage(sp.cv, p.x - sp.half, py - sp.half, sp.half * 2, sp.half * 2);
      ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pi, p.x, py + 1);
    }
  }
}

function drawStars(x, y, r, t) {
  ctx.fillStyle = '#fff59d';
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + (i / 3) * TAU;
    const sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r * 0.4;
    ctx.beginPath(); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 1.3, sy - 1.3); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx + 1.3, sy + 1.3); ctx.lineTo(sx, sy + 4); ctx.lineTo(sx - 1.3, sy + 1.3); ctx.lineTo(sx - 4, sy); ctx.lineTo(sx - 1.3, sy - 1.3); ctx.closePath(); ctx.fill();
  }
}
function drawShield(e, R, width) {
  const a = e.shieldArc;
  if (e.shieldDown > 0) {
    // מגן שבור: מהבהב עד שיחזור
    if (e.shieldDown < 1 && Math.floor(e.shieldDown * 10) % 2) {
      ctx.strokeStyle = 'rgba(180,225,255,0.5)'; ctx.lineWidth = width * 0.5; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.arc(e.x, e.y, R, e.ang - a, e.ang + a); ctx.stroke(); ctx.setLineDash([]);
    }
    return;
  }
  const hit = e.blockT > 0 ? 1 : 0;
  ctx.lineCap = 'round';
  ctx.fillStyle = `rgba(150,210,255,${0.1 + hit * 0.2})`;
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, R, e.ang - a, e.ang + a); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = hit ? '#ffffff' : 'rgba(185,228,255,0.95)'; ctx.lineWidth = width + hit * 2;
  ctx.beginPath(); ctx.arc(e.x, e.y, R, e.ang - a, e.ang + a); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(e.x, e.y, R - width * 0.9, e.ang - a * 0.8, e.ang + a * 0.8); ctx.stroke();
}

function drawEnemies() {
  const frozen = G.buffs.freeze > 0;
  for (const e of G.enemies) {
    const c = e.def;
    const appear = e.spawnT > 0 ? clamp(1 - e.spawnT / 0.4, 0, 1) : 1;
    let alpha = appear * (e.fade == null ? 1 : e.fade);
    if (e.type === 'clone') alpha *= 0.6;
    if (alpha <= 0.02) continue;
    const bob = e.boss ? 0 : Math.sin(e.t * 5 + e.seed) * 1.6;
    const ex = e.x, ey = e.y + bob;
    if (e.boss) {
      // הילת בוס
      const col = e.stagger ? '#fff59d' : e.phase > 0 ? '#ff2a2a' : c.body;
      drawGlow(col, e.x, e.y, e.r * (2.1 + 0.15 * Math.sin(animT * 4)), 0.55 * alpha);
      if (e.mode === 'windup') {
        ctx.strokeStyle = 'rgba(255,40,40,0.7)'; ctx.lineWidth = 3 + e.windup * 3; ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -animT * 60;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.ang) * 520, e.y + Math.sin(e.ang) * 520); ctx.stroke();
        ctx.setLineDash([]);
      } else if (e.mode === 'windupHive') {
        // אזהרה: צלילה אל הכוורת
        ctx.strokeStyle = 'rgba(255,150,40,0.8)'; ctx.lineWidth = 4 + e.windup * 4; ctx.setLineDash([14, 8]);
        ctx.lineDashOffset = -animT * 80;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(G.hive.x, G.hive.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(255,120,40,${0.4 + 0.4 * Math.sin(animT * 16)})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(G.hive.x, G.hive.y, G.hive.r + 16 + (1 - e.windup) * 30, 0, TAU); ctx.stroke();
      } else if (e.mode === 'beamCharge') {
        ctx.strokeStyle = `rgba(255,80,140,${0.35 + 0.5 * e.windup})`; ctx.lineWidth = 1.5 + e.windup * 2;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.beamA) * 1500, e.y + Math.sin(e.beamA) * 1500); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        drawGlow('#ff5aa0', e.x + Math.cos(e.beamA) * e.r, e.y + Math.sin(e.beamA) * e.r, 14 + e.windup * 26, 0.8);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (e.kind === 'general' && e.exposed > 0) {
        ctx.strokeStyle = `rgba(255,235,90,${0.5 + 0.4 * Math.sin(animT * 14)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 10, 0, TAU); ctx.stroke();
      }
    } else if (e.elite) {
      drawGlow('#ffd54f', ex, ey, e.r * 2.3, 0.5 * alpha);
      ctx.strokeStyle = 'rgba(255,215,80,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.lineDashOffset = animT * 30;
      ctx.beginPath(); ctx.arc(ex, ey, e.r + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if (e.type === 'nurse') drawGlow('#6dff96', ex, ey, e.r * 2.2, 0.35 * alpha);
    // צל (החרק מרחף מעל הקרקע)
    ctx.fillStyle = `rgba(0,0,0,${0.2 * alpha})`;
    ctx.beginPath(); ctx.ellipse(e.x + 5, e.y + e.r * 0.9, e.r * 0.9, e.r * 0.36, 0, 0, TAU); ctx.fill();
    // שק הגנבה
    if (e.type === 'thief' && e.loot > 0) {
      for (let i = 0; i < e.loot; i++) {
        const lx = ex - Math.cos(e.ang) * (e.r + 5 + i * 5), ly = ey - Math.sin(e.ang) * (e.r + 5 + i * 5);
        hexPath(lx, ly, 5); ctx.fillStyle = '#ffb300'; ctx.fill(); ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    // הגוף, עם "מעיכה" קלה בפגיעה ובהכנה להתקפה
    const wind = e.windup || 0;
    const sq = 1 + e.hitS * 0.14;
    const grow = (0.55 + 0.45 * appear) * (e.boss ? 0.75 + 0.25 * (e.fade == null ? 1 : e.fade) : 1);
    const r = e.elite ? e.def.r : e.r; // התמונה השמורה לפי הגודל הבסיסי, והמוגדלות ב-scale
    const es = e.elite ? e.r / e.def.r : e.type === 'clone' ? e.r / BOSSES.emperor.r : 1;
    const baseR = e.type === 'clone' ? BOSSES.emperor.r : r;
    const cc = e.type === 'clone' ? BOSSES.emperor : c;
    drawInsect(ex - (e.st === 'aim' ? Math.cos(e.ang) * wind * 5 : 0), ey - (e.st === 'aim' ? Math.sin(e.ang) * wind * 5 : 0), e.ang, baseR, cc, e.t,
      enemyOpts(e, { flash: e.flash > 0, alpha, sx: grow * es * sq * (1 - wind * 0.08), sy: grow * es * (2 - sq) * (1 + wind * 0.12) }));
    if (c.bomb) {
      const rate = 10 + Math.min(1, e.age / 9) * 14;
      const ba = 0.35 + 0.35 * Math.sin(e.t * rate);
      ctx.strokeStyle = `rgba(255,60,30,${ba.toFixed(2)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ex, ey, e.r + 5, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('#ffb347', ex - Math.cos(e.ang) * e.r * 1.6 + Math.sin(e.ang) * e.r * 0.35, ey - Math.sin(e.ang) * e.r * 1.6 - Math.cos(e.ang) * e.r * 0.35, 5 + 3 * Math.sin(e.t * 30), 0.9);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (e.st === 'aim' || (e.type === 'brute' && wind > 0)) {
      // אזהרה לפני זינוק/מהלומה
      ctx.strokeStyle = `rgba(255,50,30,${0.35 + wind * 0.6})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(ex, ey, e.r + 4 + (1 - wind) * 10, 0, TAU); ctx.stroke();
      if (e.st === 'aim') { ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ff5340'; ctx.fillText('!', ex, ey - e.r - 12); }
    }
    if (e.rage) drawGlow('#ff3d00', ex, ey, e.r * 1.8, 0.35 + 0.15 * Math.sin(e.t * 12));
    if (e.type === 'guard') drawShield(e, e.r * 1.55, 4);
    else if (e.kind === 'general' && (e.shield || e.shieldDown > 0)) drawShield(e, e.r * 1.35, 6);
    if (frozen || e.chill > 0) {
      ctx.fillStyle = 'rgba(150,210,255,0.4)';
      ctx.beginPath(); ctx.arc(ex, ey, e.r * 1.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(230,245,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    if (e.poison > 0) { ctx.strokeStyle = 'rgba(140,220,70,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ex, ey, e.r * 1.05, e.t * 3, e.t * 3 + 4); ctx.stroke(); }
    if (e.stun > 0 || e.stagger) drawStars(ex, ey - e.r - 8, e.r * 0.8, e.t);
    if (!e.boss && e.hp < e.maxHp && e.type !== 'clone') {
      const w = e.r * 1.8;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(ex - w / 2 - 1, ey - e.r - 11, w + 2, 6);
      ctx.fillStyle = e.elite ? '#ffd54f' : '#ff5252'; ctx.fillRect(ex - w / 2, ey - e.r - 10, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }
}

function drawBeams() {
  for (const e of G.enemies) {
    if (!e.boss || !e.beam || !e.beam.on) continue;
    const x2 = e.x + Math.cos(e.beamA) * e.beam.len, y2 = e.y + Math.sin(e.beamA) * e.beam.len;
    const fl = 0.85 + 0.15 * Math.sin(animT * 60);
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,40,120,${0.28 * fl})`; ctx.lineWidth = 46;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,120,200,${0.65 * fl})`; ctx.lineWidth = 22;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7 * fl;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('#ff78c8', x2, y2, 34, 0.9);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawMarks() {
  for (const m of G.marks) {
    const f = clamp(m.t / m.delay, 0, 1);
    ctx.fillStyle = `rgba(255,40,30,${0.1 + 0.18 * f})`;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,70,40,${0.25 + 0.2 * f})`;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r * f, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,60,40,${0.6 + 0.4 * Math.sin(animT * (10 + f * 20))})`; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.lineDashOffset = animT * 40;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(m.x - 12, m.y); ctx.lineTo(m.x + 12, m.y); ctx.moveTo(m.x, m.y - 12); ctx.lineTo(m.x, m.y + 12); ctx.stroke();
  }
}

function drawArcs() {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const a of G.arcs) {
    const f = a.life / a.max;
    if (a.kind === 'heal') {
      ctx.strokeStyle = `rgba(110,255,150,${0.7 * f})`; ctx.lineWidth = 3;
      const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2 - 24;
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.quadraticCurveTo(mx, my, a.x2, a.y2); ctx.stroke();
    } else {
      // ברק מזוגזג
      const dx = a.x2 - a.x1, dy = a.y2 - a.y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      ctx.globalCompositeOperation = 'lighter';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? `rgba(255,255,255,${f})` : `rgba(120,200,255,${0.6 * f})`; ctx.lineWidth = pass ? 1.6 : 5;
        ctx.beginPath(); ctx.moveTo(a.x1, a.y1);
        for (let i = 1; i < 5; i++) { const t = i / 5, j = (hash(i, a.seed) - 0.5) * 22; ctx.lineTo(a.x1 + dx * t + nx * j, a.y1 + dy * t + ny * j); }
        ctx.lineTo(a.x2, a.y2); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

// ---------------- הציור הראשי ----------------
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const cw = canvas.width, ch = canvas.height;
  if (bg) ctx.drawImage(bg, 0, 0);
  else { ctx.fillStyle = '#4c8a34'; ctx.fillRect(0, 0, cw, ch); }
  // מעבר רך בין נופים
  if (bgPrev && env.fade > 0) { ctx.globalAlpha = Math.min(1, env.fade); ctx.drawImage(bgPrev, 0, 0, cw, ch); ctx.globalAlpha = 1; }
  if (bgGlow && env.fade < 0.5) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.55 + 0.25 * Math.sin(animT * 1.7)) * (1 - env.fade * 2);
    ctx.drawImage(bgGlow, 0, 0, cw, ch);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  const tn = env.tint;
  if (tn[3] > 0.005) {
    ctx.fillStyle = `rgba(${tn[0] | 0},${tn[1] | 0},${tn[2] | 0},${tn[3].toFixed(3)})`;
    ctx.fillRect(0, 0, cw, ch);
  }
  const k = scale * dpr;
  const sh = settings.shake ? shake : 0;
  const sx = sh ? rand(-sh, sh) * k * 0.5 : 0, sy = sh ? rand(-sh, sh) * k * 0.5 : 0;
  const world = () => ctx.setTransform(k, 0, 0, k, sx, sy);
  world();
  const dark = env.dark;
  const T = env.theme;

  if (G) drawDecals();
  drawFlora(1 - Math.min(1, env.fade * 1.5));
  drawClouds((T.clouds || 0) * (1 - Math.min(1, dark * 2.5)));

  if (!G) {
    // סצנת רקע לתפריט
    drawHive(menuHive, null);
    drawMenuBees();
    drawWeather(T, dark);
    return;
  }
  const P = G.player, S = G.stats;

  drawMarks();
  drawHive(G.hive, S);
  drawPickups();

  // טבעות (גל זמזום ופיצוצים)
  for (const r of G.rings) {
    const a = Math.max(0, 1 - r.t / (r.life + 0.15));
    const rc = r.color || '255,230,120';
    ctx.fillStyle = `rgba(${rc},${a * 0.16})`;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${rc},${a})`; ctx.lineWidth = 8 * a + 2; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.7})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.82, 0, TAU); ctx.stroke();
  }

  // גופות נופלות
  for (const c of G.corpses) {
    const f = c.life / c.max;
    const isClone = c.type === 'clone';
    drawInsect(c.x, c.y, c.ang, isClone ? BOSSES.emperor.r : c.def.r, isClone ? BOSSES.emperor : c.def, 0,
      enemyOpts(c, { alpha: f * (isClone ? 0.5 : 1), sx: (0.55 + 0.45 * f) * (c.r / (isClone ? BOSSES.emperor.r : c.def.r)) }));
  }

  drawEnemies();

  // חצים שמסמנים צרעות שעוד מחוץ למסך
  const topM = hudSafe + 12;
  for (const e of G.enemies) {
    if (e.x >= 0 && e.x <= W && e.y >= 0 && e.y <= H) continue;
    const ax = clamp(e.x, 16, W - 16), ay = clamp(e.y, topM, H - 16);
    const aa = Math.atan2(e.y - ay, e.x - ax);
    const danger = e.boss || e.def.bomb || e.elite;
    const sz = e.boss ? 16 : danger ? 11 : 8;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(aa);
    ctx.fillStyle = e.type === 'nurse' ? 'rgba(110,255,150,0.92)' : danger ? 'rgba(255,60,40,0.92)' : 'rgba(255,205,70,0.88)';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.6, sz * 0.7); ctx.lineTo(-sz * 0.6, -sz * 0.7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // יריות אויב – עם זוהר
  for (const s of G.shots) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(s.color, s.x, s.y, s.r * 2.6, 0.6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(s.x - 2, s.y - 2, s.r * 0.35, 0, TAU); ctx.fill();
  }

  // עוקצים – שובל זוהר (הצבע לפי השדרוגים)
  ctx.lineCap = 'round';
  const tip = S.venom ? '190,255,120' : S.frost ? '170,225,255' : S.chain ? '200,220,255' : '255,255,225';
  const tail = S.venom ? '150,230,80' : S.frost ? '120,200,255' : '255,235,130';
  for (const s of G.stingers) {
    const len = s.small ? 16 : 26;
    const tx = s.x - Math.cos(s.ang) * len, ty = s.y - Math.sin(s.ang) * len;
    const pl = s.p;
    const lg = ctx.createLinearGradient(tx, ty, s.x, s.y);
    lg.addColorStop(0, `rgba(${pl ? tail : '255,235,130'},0)`); lg.addColorStop(1, `rgba(${pl ? tip : '255,255,225'},0.95)`);
    ctx.strokeStyle = lg; ctx.lineWidth = s.small ? 2.5 : 3.8;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y); ctx.stroke();
    ctx.fillStyle = '#3b2400';
    ctx.beginPath(); ctx.arc(s.x, s.y, 1.8, 0, TAU); ctx.fill();
  }
  if (quality.tier > 0) {
    ctx.globalCompositeOperation = 'lighter';
    for (const s of G.stingers) drawGlow('#fff096', s.x, s.y, s.small ? 7 : 11, 0.45);
    ctx.globalCompositeOperation = 'source-over';
  }

  drawArcs();

  // דבורות עזר
  for (const h of G.helpers) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(h.x + 3, h.y + 9, 7, 3, 0, 0, TAU); ctx.fill();
    drawInsect(h.x, h.y, h.aim, 9, HELPER_COLORS, animT + h.ang, { fuzzy: true, key: 'helper' });
  }

  if (victoryOpen) drawVictoryBees();

  // השחקנית
  if (state !== 'dying' || G.deathBy === 'hive') {
    // סימון המטרה הנוכחית
    const tg = P.target;
    if (tg && tg.hp > 0 && state === 'playing') {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.6;
      const rr = tg.r + 7;
      for (let i = 0; i < 4; i++) { const a = animT * 1.5 + i * Math.PI / 2; ctx.beginPath(); ctx.arc(tg.x, tg.y, rr, a, a + 0.5); ctx.stroke(); }
    }
    // שובל רפאים של הזינוק
    for (const g of G.ghosts) drawInsect(g.x, g.y, g.ang, 16, BEE_COLORS, 0, { fuzzy: true, key: 'bee', alpha: 0.4 * (g.life / g.max) });
    // טבעת עוקצים
    if (S.orbit) {
      for (let i = 0; i < S.orbit; i++) {
        const a = G.time * 3.4 + (i / S.orbit) * TAU;
        const bx = P.x + Math.cos(a) * 50, by = P.y + Math.sin(a) * 50;
        ctx.globalCompositeOperation = 'lighter'; drawGlow('#fff096', bx, by, 14, 0.5); ctx.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.translate(bx, by); ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = '#fff8d0'; ctx.strokeStyle = '#7a5200'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -4.5); ctx.lineTo(-3, 0); ctx.lineTo(-7, 4.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    if (!(P.inv > 0 && P.dashT <= 0 && Math.floor(P.inv * 14) % 2 === 0)) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(P.x + 5, P.y + 15, 12, 5, 0, 0, TAU); ctx.fill();
      const dashing = P.dashT > 0;
      const hov = Math.sin(animT * 6) * 1.2;
      drawInsect(P.x, P.y + hov, dashing ? Math.atan2(P.dvy, P.dvx) : P.ang, 16, BEE_COLORS, animT, { fuzzy: true, key: 'bee', sx: dashing ? 1.25 : 1, sy: dashing ? 0.85 : 1 });
    }
    if (G.buffs.rapid > 0) {
      ctx.strokeStyle = `rgba(255,220,80,${0.5 + 0.3 * Math.sin(animT * 20)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P.x, P.y, 23, animT * 6, animT * 6 + 1.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(P.x, P.y, 23, animT * 6 + Math.PI, animT * 6 + Math.PI + 1.6); ctx.stroke();
    }
    if (G.buffs.shield > 0) {
      const blink = G.buffs.shield < 1.5 && Math.floor(G.buffs.shield * 8) % 2 === 0;
      if (!blink) {
        ctx.fillStyle = 'rgba(77,208,225,0.16)'; ctx.strokeStyle = 'rgba(160,235,245,0.95)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(P.x, P.y, 27, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(P.x, P.y, 23, 3.6, 4.9); ctx.stroke();
      }
    }
    // טבעת קטנה כשגל הזמזום מוכן
    if (P.pulseCd <= 0 && state === 'playing') {
      ctx.strokeStyle = 'rgba(255,240,150,0.28)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P.x, P.y, 22 + Math.sin(animT * 6) * 2, 0, TAU); ctx.stroke();
    }
  }

  drawBeams();
  drawParticles();
  drawWeather(T, dark);

  // הדרכה: טבעת וחץ קופץ מעל היעד של הצעד הנוכחי
  if (G.tut && G.tut.mark && state === 'playing') {
    const m = G.tut.mark;
    if (!(m.hp <= 0) && !(m.life <= 0)) {
      const rr = (m.r || 12) + 12 + Math.sin(animT * 5) * 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
      ctx.setLineDash([9, 7]); ctx.lineDashOffset = -animT * 24;
      ctx.beginPath(); ctx.arc(m.x, m.y, rr, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      const ay = m.y - rr - 14 - Math.abs(Math.sin(animT * 4)) * 10;
      ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = 'rgba(60,35,0,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.x, ay + 12); ctx.lineTo(m.x - 11, ay - 6); ctx.lineTo(m.x + 11, ay - 6); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }

  // חושך ותאורה בנופי הלילה
  const flash = Math.max(0, env.flash);
  if (dark > 0.02) {
    drawLighting(dark * (1 - Math.min(1, flash)));
    world();
    // אור חם מהכוורת
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('#ffb446', G.hive.x, G.hive.y, 230, 0.5 * dark);
    ctx.globalCompositeOperation = 'source-over';
  }

  // טקסט צף
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of G.floaters) {
    ctx.font = `bold ${f.size || 16}px sans-serif`;
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(f.text, f.x + 1, f.y + 1.5);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // ג׳ויסטיק מגע
  if (joy.active && !joy.mouse && state === 'playing') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let dx = joy.x - joy.ox, dy = joy.y - joy.oy;
    const max = 50, d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, max + 8, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,214,90,0.8)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(joy.ox + dx, joy.oy + dy, 22, 0, TAU); ctx.fill(); ctx.stroke();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // הבזק ברק
  if (flash > 0.01) { ctx.fillStyle = `rgba(225,235,255,${Math.min(0.45, flash * 0.4).toFixed(2)})`; ctx.fillRect(0, 0, cw, ch); }
  // מסגרת אדומה: כשהדבורה נפגעת או כשהכוורת בסכנה
  const hiveLow = G.hive.hp / G.hive.maxHp < 0.3 && state === 'playing' ? 0.22 + 0.12 * Math.sin(animT * 6) : 0;
  const beeLow = P.hp / S.maxHp < 0.3 && state === 'playing' ? 0.16 + 0.1 * Math.sin(animT * 8) : 0;
  const va = Math.max(Math.max(0, G.hurtFlash) * 1.4, hiveLow, beeLow);
  if (va > 0.01) {
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
    vg.addColorStop(0, 'rgba(255,0,0,0)');
    vg.addColorStop(1, `rgba(255,20,20,${Math.min(0.6, va).toFixed(2)})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);
  }
  // הילוך איטי כשבוס נופל: הבזק לבן קצר
  if (slowMo > 0.8) { ctx.fillStyle = `rgba(255,255,255,${((slowMo - 0.8) * 2).toFixed(2)})`; ctx.fillRect(0, 0, cw, ch); }
}

// סצנת התפריט: כוורת במרכז ודבורים וצרעות שחגות סביבה
const menuHive = { x: 0, y: 0, r: 46, hp: 1, maxHp: 1, hitT: 0 };
const menuBees = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * TAU, r: rand(150, 320), s: rand(0.3, 0.7) * (i % 2 ? 1 : -1), wasp: i % 3 === 0 }));
function drawMenuBees() {
  menuHive.x = W / 2; menuHive.y = H / 2;
  menuBees.forEach((b) => {
    b.a += b.s * 0.016;
    const x = W / 2 + Math.cos(b.a) * b.r * (W / H > 1 ? 1.6 : 0.9);
    const y = H / 2 + Math.sin(b.a) * b.r;
    const ang = b.a + (b.s > 0 ? Math.PI / 2 : -Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(x + 5, y + 14, 11, 4.5, 0, 0, TAU); ctx.fill();
    if (b.wasp) drawInsect(x, y, ang, 15, ETYPES.wasp, animT + b.a, { wasp: true, kind: 'wasp', key: 'wasp' });
    else drawInsect(x, y, ang, 13, BEE_COLORS, animT + b.a, { fuzzy: true, key: 'bee' });
  });
}
