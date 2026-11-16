/* שומרת הכוורת – משחק דפדפן. אין צורך בהתקנות: פותחים את index.html */
'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const TAU = Math.PI * 2;
  const MAX_LEVEL = 10;
  const BASE = 720; // גודל העולם הלוגי בממד הקצר של המסך

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

  // רמות קושי: חיי אויבים, נזק, קצב הופעה ומכפיל ניקוד
  const DIFFS = {
    easy:   { name: 'Easy',  hp: 0.75, dmg: 0.6, spawn: 1.3,  score: 0.75 },
    normal: { name: 'Normal', hp: 1,    dmg: 1,   spawn: 1,    score: 1 },
    hard:   { name: 'Hard', hp: 1.25, dmg: 1.3, spawn: 0.82, score: 1.5 },
  };
  let diffKey = store.get(DIFF_KEY, 'normal');
  if (!DIFFS[diffKey]) diffKey = 'normal';
  const D = () => DIFFS[diffKey];

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

  // ---------------- צלילים (מסונתזים, בלי קבצים) ----------------
  const Sound = {
    ctx: null, master: null, noiseBuf: null,
    muted: !!store.get(MUTE_KEY, false),
    last: {}, nextNote: 0, step: 0,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { this.ctx = null; }
    },
    setMuted(m) {
      this.muted = m;
      store.set(MUTE_KEY, m);
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
      updateMuteButtons();
    },
    tone(f, dur, type = 'square', vol = 0.1, slide = null, delay = 0) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, freq = 1200, delay = 0) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay;
      const src = c.createBufferSource(); src.buffer = this.noiseBuf;
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(fl); fl.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + dur + 0.03);
    },
    play(name) {
      if (!this.ctx || this.muted) return;
      const now = performance.now();
      const gap = { shoot: 75, hit: 45, hive: 300, pickup: 45, spit: 120 }[name] || 0;
      if (gap && this.last[name] && now - this.last[name] < gap) return;
      this.last[name] = now;
      const seq = (notes, step, type, vol, len) => notes.forEach((f, i) => this.tone(f, len, type, vol, null, i * step));
      switch (name) {
        case 'shoot': this.tone(900, 0.05, 'square', 0.025, 1500); break;
        case 'hit': this.tone(320, 0.07, 'triangle', 0.08, 160); break;
        case 'kill': this.noise(0.16, 0.14, 2000); this.tone(520, 0.14, 'sawtooth', 0.05, 130); break;
        case 'pickup': this.tone(1046, 0.07, 'sine', 0.08); this.tone(1568, 0.09, 'sine', 0.06, null, 0.04); break;
        case 'heart': seq([660, 880, 1320], 0.06, 'sine', 0.1, 0.12); break;
        case 'hurt': this.tone(240, 0.25, 'sawtooth', 0.13, 80); break;
        case 'hive': this.tone(150, 0.2, 'square', 0.07, 90); break;
        case 'spit': this.tone(420, 0.1, 'sine', 0.05, 200); break;
        case 'pulse': this.tone(160, 0.5, 'sawtooth', 0.13, 640); this.noise(0.4, 0.12, 700); break;
        case 'boss': this.tone(90, 1.3, 'sawtooth', 0.18, 55); this.tone(96, 1.3, 'square', 0.08, 50); break;
        case 'charge': this.tone(200, 0.5, 'sawtooth', 0.1, 600); break;
        case 'bossDie': this.noise(1.2, 0.3, 900); seq([523, 659, 784, 1046], 0.12, 'square', 0.07, 0.25); break;
        case 'level': seq([523, 659, 784, 1046], 0.1, 'triangle', 0.13, 0.18); break;
        case 'upgrade': this.tone(660, 0.12, 'sine', 0.12); this.tone(990, 0.2, 'sine', 0.12, null, 0.08); break;
        case 'buy': this.tone(880, 0.08, 'triangle', 0.1); this.tone(1320, 0.12, 'triangle', 0.1, null, 0.06); break;
        case 'thunder': this.noise(1.6, 0.22, 240); this.noise(0.25, 0.14, 1800); break;
        case 'power': seq([523, 784, 1046, 1568], 0.05, 'square', 0.07, 0.12); break;
        case 'dash': this.noise(0.15, 0.1, 3000); this.tone(700, 0.12, 'sine', 0.06, 1400); break;
        case 'boom': this.noise(0.45, 0.28, 500); this.tone(110, 0.4, 'sawtooth', 0.14, 40); break;
        case 'crit': this.tone(1300, 0.06, 'square', 0.05, 1900); break;
        case 'combo': this.tone(880, 0.07, 'triangle', 0.08); this.tone(1175, 0.1, 'triangle', 0.08, null, 0.06); break;
        case 'denied': this.tone(180, 0.15, 'square', 0.07); break;
        case 'click': this.tone(620, 0.04, 'square', 0.04); break;
        case 'over': seq([392, 330, 262, 196], 0.22, 'triangle', 0.15, 0.35); break;
        case 'win': seq([523, 523, 659, 784, 659, 784, 1046], 0.13, 'triangle', 0.14, 0.22); break;
      }
    },
    // מוזיקת רקע קלילה – מתוזמנת מראש כמה עשיריות שנייה
    music(intensity) {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      const c = this.ctx;
      const stepLen = 0.19;
      if (this.nextNote < c.currentTime) this.nextNote = c.currentTime + 0.05;
      const bass = [110, 110, 87.3, 87.3, 130.8, 130.8, 98, 98];
      const mel = [440, 523, 587, 659, 784, 659, 587, 523];
      while (this.nextNote < c.currentTime + 0.25) {
        const d = this.nextNote - c.currentTime;
        const s = this.step;
        if (s % 4 === 0) this.tone(bass[(s >> 3) % 8], 0.32, 'triangle', 0.07, null, d);
        if (s % 2 === 1 && (s * 7) % 5 < 3) this.tone(mel[(s * 3 + (s >> 4)) % 8], 0.12, 'sine', 0.025 + intensity * 0.015, null, d);
        if (intensity > 0.5 && s % 4 === 2) this.noise(0.05, 0.03, 4000, d);
        this.nextNote += stepLen;
        this.step++;
      }
    },
  };

  // ---------------- קנבס וגודל מסך ----------------
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  let W = 1280, H = 720, scale = 1, dpr = 1;
  let bg = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = window.innerWidth, ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const oldW = W, oldH = H;
    scale = Math.min(cw, ch) / BASE;
    W = cw / scale; H = ch / scale;
    if (G) {
      const dx = (W - oldW) / 2, dy = (H - oldH) / 2;
      const all = [G.enemies, G.stingers, G.shots, G.pickups, G.particles, G.floaters, G.rings, G.decals, G.corpses];
      all.forEach((arr) => arr.forEach((o) => { o.x += dx; o.y += dy; }));
      G.player.x = clamp(G.player.x + dx, 20, W - 20);
      G.player.y = clamp(G.player.y + dy, 20, H - 20);
      G.hive.x = W / 2; G.hive.y = H / 2;
    }
    buildBackground();
  }

  let flora = [];
  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = canvas.width; bg.height = canvas.height;
    const b = bg.getContext('2d');
    const k = scale * dpr;
    const gr = b.createRadialGradient(bg.width / 2, bg.height / 2, 50, bg.width / 2, bg.height / 2, Math.max(bg.width, bg.height) * 0.72);
    gr.addColorStop(0, '#86c552'); gr.addColorStop(0.6, '#5a9e3a'); gr.addColorStop(1, '#3a7229');
    b.fillStyle = gr; b.fillRect(0, 0, bg.width, bg.height);
    b.setTransform(k, 0, 0, k, 0, 0);
    const area = W * H;
    // כתמי אור וצל רכים בדשא
    for (let i = 0; i < Math.floor(area / 14000); i++) {
      const x = Math.random() * W, y = Math.random() * H, r = rand(50, 150);
      const light = Math.random() < 0.5;
      const pg = b.createRadialGradient(x, y, 0, x, y, r);
      pg.addColorStop(0, light ? 'rgba(175,225,95,0.16)' : 'rgba(18,70,28,0.16)');
      pg.addColorStop(1, light ? 'rgba(175,225,95,0)' : 'rgba(18,70,28,0)');
      b.fillStyle = pg; b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill();
    }
    // קרחת אדמה סביב הכוורת
    const dg = b.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, 125);
    dg.addColorStop(0, 'rgba(160,125,75,0.7)'); dg.addColorStop(0.6, 'rgba(150,125,70,0.35)'); dg.addColorStop(1, 'rgba(150,125,70,0)');
    b.fillStyle = dg; b.beginPath(); b.arc(W / 2, H / 2, 125, 0, TAU); b.fill();
    // גבעולי דשא בשני גוונים
    b.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      b.strokeStyle = pass ? 'rgba(170,225,100,0.4)' : 'rgba(30,85,25,0.45)';
      b.lineWidth = pass ? 1.4 : 2;
      b.beginPath();
      for (let i = 0; i < Math.floor(area / 1700); i++) {
        const x = Math.random() * W, y = Math.random() * H, lean = rand(-5, 5);
        b.moveTo(x, y); b.quadraticCurveTo(x + lean * 0.3, y - 6, x + lean, y - rand(7, 14));
      }
      b.stroke();
    }
    // תלתנים
    for (let i = 0; i < Math.floor(area / 16000); i++) {
      const x = Math.random() * W, y = Math.random() * H, s = rand(3, 5);
      if (Math.hypot(x - W / 2, y - H / 2) < 100) continue;
      b.fillStyle = 'rgba(35,110,40,0.75)';
      for (let p = 0; p < 3; p++) { const a = (p / 3) * TAU + i; b.beginPath(); b.arc(x + Math.cos(a) * s * 0.8, y + Math.sin(a) * s * 0.8, s, 0, TAU); b.fill(); }
    }
    // אבנים
    for (let i = 0; i < Math.floor(area / 70000); i++) {
      const x = Math.random() * W, y = Math.random() * H, s = rand(7, 15);
      if (Math.hypot(x - W / 2, y - H / 2) < 140) continue;
      b.fillStyle = 'rgba(0,0,0,0.22)'; b.beginPath(); b.ellipse(x + 3, y + 4, s, s * 0.6, 0, 0, TAU); b.fill();
      const sg = b.createRadialGradient(x - s * 0.3, y - s * 0.3, 1, x, y, s);
      sg.addColorStop(0, '#c9c9c0'); sg.addColorStop(1, '#77786f');
      b.fillStyle = sg; b.beginPath(); b.ellipse(x, y, s, s * 0.7, rand(-0.4, 0.4), 0, TAU); b.fill();
    }
    // פרחים קטנים
    const colors = ['#ffffff', '#ffd6e8', '#fff07a', '#c9b6ff', '#ff9eb5', '#9be7ff'];
    for (let i = 0; i < Math.floor(area / 6500); i++) {
      const x = Math.random() * W, y = Math.random() * H;
      if (Math.hypot(x - W / 2, y - H / 2) < 95) continue;
      const r = rand(2.5, 5.5);
      b.fillStyle = 'rgba(0,0,0,0.14)'; b.beginPath(); b.arc(x + 1.5, y + 2.5, r * 1.4, 0, TAU); b.fill();
      b.fillStyle = colors[i % colors.length];
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU + i;
        b.beginPath(); b.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.72, 0, TAU); b.fill();
      }
      b.fillStyle = '#f5a800';
      b.beginPath(); b.arc(x, y, r * 0.6, 0, TAU); b.fill();
    }
    // שיחים בשולי השדה
    const bush = (x, y, s) => {
      b.fillStyle = 'rgba(0,0,0,0.2)'; b.beginPath(); b.arc(x + 4, y + 6, s, 0, TAU); b.fill();
      b.fillStyle = '#245f27'; b.beginPath(); b.arc(x, y, s, 0, TAU); b.fill();
      b.fillStyle = '#2f7a2f';
      for (let p = 0; p < 5; p++) { const a = p * 1.3 + x; b.beginPath(); b.arc(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45, s * 0.55, 0, TAU); b.fill(); }
      b.fillStyle = 'rgba(150,215,95,0.5)';
      for (let p = 0; p < 4; p++) { const a = p * 1.7 + y; b.beginPath(); b.arc(x + Math.cos(a) * s * 0.4 - s * 0.15, y + Math.sin(a) * s * 0.4 - s * 0.2, s * 0.22, 0, TAU); b.fill(); }
    };
    const step = 46;
    for (let x = 0; x <= W; x += step) { bush(x + rand(-10, 10), rand(-14, 4), rand(22, 34)); bush(x + rand(-10, 10), H + rand(-4, 14), rand(22, 34)); }
    for (let y = step; y < H; y += step) { bush(rand(-14, 4), y + rand(-10, 10), rand(22, 34)); bush(W + rand(-4, 14), y + rand(-10, 10), rand(22, 34)); }
    // צל מתחת לכוורת
    b.fillStyle = 'rgba(0,0,0,0.22)';
    b.beginPath(); b.ellipse(W / 2 + 7, H / 2 + 12, 66, 58, 0, 0, TAU); b.fill();
    // הצללה עדינה בשוליים, לעומק
    b.setTransform(1, 0, 0, 1, 0, 0);
    const vg = b.createRadialGradient(bg.width / 2, bg.height / 2, Math.min(bg.width, bg.height) * 0.35, bg.width / 2, bg.height / 2, Math.max(bg.width, bg.height) * 0.75);
    vg.addColorStop(0, 'rgba(0,20,0,0)'); vg.addColorStop(1, 'rgba(0,20,0,0.38)');
    b.fillStyle = vg; b.fillRect(0, 0, bg.width, bg.height);

    // פרחים גדולים שמתנדנדים ברוח (מצוירים בכל פריים)
    flora = [];
    const fc = [['#ff6f91', '#ffd166'], ['#ffffff', '#ffb300'], ['#b388ff', '#fff59d'], ['#ffd54f', '#8d5a00'], ['#ff8a65', '#fff3b0'], ['#81d4fa', '#fff59d']];
    let tries = 0;
    while (flora.length < Math.floor(area / 55000) && tries++ < 400) {
      const x = rand(40, W - 40), y = rand(90, H - 40);
      if (Math.hypot(x - W / 2, y - H / 2) < 150) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.y - y) < 70)) continue;
      const c = fc[Math.floor(Math.random() * fc.length)];
      flora.push({ x, y, s: rand(8, 13), c: c[0], cc: c[1], n: 5 + Math.floor(Math.random() * 4), ph: rand(0, TAU) });
    }
    menuHive.x = W / 2; menuHive.y = H / 2;
    spriteCache.clear();
  }

  // ---------------- הגדרות אויבים ----------------
  const ETYPES = {
    wasp:    { hp: 22,  speed: 72,  r: 14, dmg: 9,  score: 10, honey: 1, target: 'hive', body: '#f2b705', stripe: '#1d1d1d', head: '#3a2a00', wing: 'rgba(220,235,255,0.55)', eye: '#c62828' },
    hornet:  { hp: 15,  speed: 138, r: 12, dmg: 12, score: 15, honey: 1, target: 'bee',  body: '#e0452b', stripe: '#2a0e05', head: '#5a1608', wing: 'rgba(255,220,220,0.55)', eye: '#ffeb3b' },
    brute:   { hp: 115, speed: 42,  r: 22, dmg: 18, score: 40, honey: 4, target: 'hive', body: '#7a4a12', stripe: '#1a1a1a', head: '#2b1800', wing: 'rgba(200,200,200,0.5)', eye: '#ff7043' },
    spitter: { hp: 34,  speed: 62,  r: 15, dmg: 8,  score: 25, honey: 2, target: 'hive', body: '#7cb342', stripe: '#1b3a0b', head: '#2e4d12', wing: 'rgba(220,255,220,0.55)', eye: '#ff1744', ranged: true },
    // צרעת נפץ: מתפוצצת על הכוורת. אם מחסלים אותה בזמן – הפיצוץ פוגע בצרעות שלידה
    bomber:  { hp: 30,  speed: 86,  r: 15, dmg: 24, score: 30, honey: 2, target: 'hive', body: '#b71c1c', stripe: '#ffb300', head: '#2a0000', wing: 'rgba(255,200,180,0.55)', eye: '#ffffff', bomb: true },
    // צרעת-אם: מתפצלת לשלוש צרעונות כשהיא מובסת
    splitter:{ hp: 62,  speed: 54,  r: 19, dmg: 12, score: 35, honey: 2, target: 'hive', body: '#8e24aa', stripe: '#1a0d24', head: '#2c0a3a', wing: 'rgba(235,210,255,0.55)', eye: '#ffeb3b', split: 3 },
    mini:    { hp: 8,   speed: 125, r: 9,  dmg: 5,  score: 5,  honey: 0, target: 'hive', body: '#ba68c8', stripe: '#1a0d24', head: '#2c0a3a', wing: 'rgba(235,210,255,0.55)', eye: '#ffeb3b' },
  };
  const BOSSES = {
    queen:   { name: 'Wasp Queen', hp: 1500, r: 46, speed: 70, dmg: 18, score: 1000, honey: 25, body: '#d81b60', stripe: '#1a1a1a', head: '#4a0020', wing: 'rgba(255,200,230,0.55)', eye: '#ffeb3b',
               orbitR: 250, atks: ['windup'], atkCd: 5, chargeSpeed: 470, spawn: { kinds: ['wasp'], n: 3, cd: 4.5 }, shot: '#f48fb1' },
    general: { name: 'Wasp General', hp: 2300, r: 50, speed: 75, dmg: 25, score: 2000, honey: 30, body: '#546e7a', stripe: '#c62828', head: '#1c262b', wing: 'rgba(200,230,255,0.55)', eye: '#ffca28',
               orbitR: 260, atks: ['aimed', 'windup', 'burst', 'windup'], atkCd: 3.3, chargeSpeed: 500, spawn: { kinds: ['brute', 'bomber'], n: 1, cd: 6.5 }, shot: '#90a4ae' },
    emperor: { name: 'Wasp Emperor', hp: 3600, r: 56, speed: 80, dmg: 28, score: 3000, honey: 0,  body: '#4a148c', stripe: '#ffb300', head: '#1a0033', wing: 'rgba(210,190,255,0.55)', eye: '#ff1744',
               orbitR: 270, atks: ['burst', 'aimed', 'spiral', 'windup', 'burst', 'aimed'], atkCd: 2.6, chargeSpeed: 520, spawn: { kinds: ['hornet', 'spitter'], n: 2, cd: 6 }, shot: '#ce93d8' },
  };

  const LEVEL_SUBTITLES = [
    'The first wasps arrive',
    'Careful – fast wasps are chasing you!',
    'Armored wasps incoming',
    'Spitter wasps attack from afar',
    'Boss: the Wasp Queen!',
    'Bomb wasps! Do not let them reach the hive',
    'Mother wasps split when they fall',
    'Boss: the Wasp General!',
    'The battle before the end',
    'Final boss: the Wasp Emperor!',
  ];

  function levelPlan(n) {
    // אחרי שלב 10 (מצב אינסופי): בוס כל 5 שלבים, בסבב
    const boss = n <= 10 ? ({ 5: 'queen', 8: 'general', 10: 'emperor' }[n] || null)
      : (n % 5 === 0 ? ['queen', 'general', 'emperor'][(n / 5) % 3] : null);
    let total = Math.min(90, 10 + n * 5);
    const realN = n;
    n = Math.min(n, 12); // תמהיל הסוגים מתייצב
    if (boss) total = Math.round(total * 0.5);
    const w = {
      wasp: 1,
      hornet: n >= 2 ? 0.2 + 0.05 * n : 0,
      brute: n >= 3 ? 0.08 + 0.03 * n : 0,
      spitter: n >= 4 ? 0.12 + 0.03 * n : 0,
      bomber: n >= 6 ? 0.08 + 0.02 * n : 0,
      splitter: n >= 7 ? 0.06 + 0.02 * n : 0,
    };
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    const queue = [];
    for (let i = 0; i < total; i++) {
      if (i < 3) { queue.push('wasp'); continue; }
      let r = Math.random() * sum;
      for (const k in w) { r -= w[k]; if (r <= 0) { queue.push(k); break; } }
      if (queue.length <= i) queue.push('wasp');
    }
    // הסוג החדש של השלב מופיע בוודאות
    const intro = { 2: 'hornet', 3: 'brute', 4: 'spitter', 6: 'bomber', 7: 'splitter' }[n];
    if (intro) { queue[3] = intro; queue[6] = intro; }
    return {
      queue,
      interval: Math.max(realN > 10 ? 0.34 : 0.42, 1.6 - n * 0.12) * D().spawn,
      hpMul: (1 + 0.11 * (realN - 1)) * D().hp,
      speedMul: 1 + 0.035 * (Math.min(realN, 14) - 1),
      boss,
      bossMul: realN > 10 ? 1 + (realN - 10) * 0.12 : 1,
    };
  }

  // ---------------- שדרוגים ----------------
  const UPGRADES = [
    { id: 'dmg',    icon: '🗡️', name: 'Sharp Stinger',  desc: 'Sting damage +25%', max: 6, apply: (s) => { s.damage *= 1.25; } },
    { id: 'rate',   icon: '⚡', name: 'Quick Buzz',     desc: 'Sting rate +20%', max: 6, apply: (s) => { s.fireRate *= 1.2; } },
    { id: 'multi',  icon: '🔱', name: 'Extra Stinger',  desc: 'One more stinger per shot', max: 4, apply: (s) => { s.multishot++; } },
    { id: 'pierce', icon: '🎯', name: 'Piercing Sting', desc: 'Stingers pass through one more wasp', max: 3, apply: (s) => { s.pierce++; } },
    { id: 'speed',  icon: '🪽', name: 'Strong Wings',   desc: 'Flight speed +15%', max: 4, apply: (s) => { s.speed *= 1.15; } },
    { id: 'armor',  icon: '🛡️', name: 'Wax Armor',      desc: 'Bee health +25 and a full heal', max: 5, apply: (s, g) => { s.maxHp += 25; g.player.hp = s.maxHp; } },
    { id: 'walls',  icon: '🏰', name: 'Wax Walls',      desc: 'Hive health +60 and a full repair', max: 5, apply: (s, g) => { g.hive.maxHp += 60; g.hive.hp = g.hive.maxHp; } },
    { id: 'regen',  icon: '🌼', name: 'Healing Nectar', desc: 'The bee heals 1.5 health per second', max: 3, apply: (s) => { s.regen += 1.5; } },
    { id: 'magnet', icon: '🧲', name: 'Keen Nose',      desc: 'Collect honey from farther away', max: 3, apply: (s) => { s.magnet *= 1.6; } },
    { id: 'pulse',  icon: '💥', name: 'Mighty Buzz',    desc: 'Buzz wave is stronger, wider and recharges faster', max: 4, apply: (s) => { s.pulseDmg *= 1.35; s.pulseRadius *= 1.12; s.pulseCd *= 0.85; } },
    { id: 'helper', icon: '🐝', name: 'Helper Bee',     desc: 'A worker bee that circles the hive and stings', max: 3, apply: (s) => { s.helpers++; } },
    { id: 'crit',   icon: '☠️', name: 'Deadly Sting',   desc: '+12% chance of a critical hit (double damage)', max: 4, apply: (s) => { s.crit += 0.12; } },
    { id: 'dash',   icon: '💨', name: 'Swift Dash',     desc: 'Dash recharges 25% faster', max: 3, apply: (s) => { s.dashCd *= 0.75; } },
    { id: 'range',  icon: '🔭', name: 'Sharp Eye',      desc: 'Range +20% and faster stingers', max: 3, apply: (s) => { s.range *= 1.2; s.shotSpeed *= 1.15; } },
  ];

  // ---------------- מצב המשחק ----------------
  let G = null;
  let state = 'menu'; // menu | playing | paused | upgrade | clear | dying | over
  let stateTimer = 0;
  let lastTime = 0;
  let shake = 0;
  let animT = 0;
  let timeScale = 1; // לבדיקות אוטומטיות בלבד

  function newGame() {
    return {
      level: 1, score: 0, honey: 0, honeyTotal: 0, kills: 0, time: 0,
      combo: 0, comboT: 0, maxCombo: 0, buffs: { rapid: 0, shield: 0, freeze: 0 }, hurtFlash: 0, tint: [255, 255, 255, 0], diff: diffKey, endless: false, beat: false, savedId: null,
      decals: [], corpses: [], dark: 0, rain: 0, flash: 0, boltT: 6,
      hive: { x: W / 2, y: H / 2, r: 46, hp: 260, maxHp: 260, hitT: 0 },
      player: { x: W / 2, y: H / 2 + 110, r: 14, hp: 100, inv: 0, fireCd: 0, pulseCd: 0, ang: -Math.PI / 2, vx: 0, vy: 0, dashT: 0, dashCd: 0, dvx: 0, dvy: 0 },
      stats: {
        speed: 270, maxHp: 100, damage: 11, fireRate: 3.2, multishot: 1, pierce: 0,
        shotSpeed: 620, range: 380, magnet: 70, regen: 0,
        pulseDmg: 45, pulseRadius: 170, pulseCd: 11, helpers: 0, crit: 0.08, dashCd: 2.6,
      },
      taken: {},
      enemies: [], stingers: [], shots: [], pickups: [], particles: [], floaters: [], rings: [], helpers: [],
      plan: null, spawnT: 0, introT: 0, bossSpawned: false, boss: null, deathReason: '',
    };
  }

  function startGame() {
    Sound.init();
    G = newGame();
    hideScreens();
    startLevel(1);
  }

  function startLevel(n) {
    G.level = n;
    G.plan = levelPlan(n);
    G.spawnT = 0;
    G.introT = 2.2;
    G.bossSpawned = false;
    G.boss = null;
    G.enemies = []; G.stingers = []; G.shots = []; G.rings = []; G.corpses = [];
    G.boltT = rand(4, 8);
    const fade = $('fade'); fade.classList.remove('go'); void fade.offsetWidth; fade.classList.add('go');
    G.hive.x = W / 2; G.hive.y = H / 2;
    G.player.x = W / 2; G.player.y = H / 2 + 110;
    G.player.inv = 1;
    G.player.pulseCd = Math.min(G.player.pulseCd, 2);
    G.player.dashT = 0; G.player.dashCd = 0;
    G.buffs.rapid = G.buffs.shield = G.buffs.freeze = 0;
    G.combo = 0; G.comboT = 0;
    syncHelpers();
    let sub = LEVEL_SUBTITLES[n - 1] || (G.plan.boss ? 'Boss: the ' + BOSSES[G.plan.boss].name + ' returns, stronger!' : 'Endless mode – how long can you last?');
    if (n === 1) sub = matchMedia('(pointer: coarse)').matches ? 'Drag a finger to fly · stinging is automatic' : 'Arrow keys or WASD to fly · stinging is automatic';
    showBanner('Level ' + n, sub, n === 1 ? 3.2 : 2.2);
    saveRun();
    setState('playing');
    Sound.play('level');
  }

  // ---------------- שמירה והמשך ----------------
  // נשמרת נקודת פתיחת השלב, כדי שאפשר יהיה לסגור את הדפדפן ולהמשיך אחר כך
  function saveRun() {
    store.set(SAVE_KEY, {
      v: 1, level: G.level, score: G.score, honey: G.honey, honeyTotal: G.honeyTotal, kills: G.kills, time: G.time,
      maxCombo: G.maxCombo, diff: G.diff, endless: G.endless, beat: G.beat, savedId: G.savedId,
      hive: { hp: G.hive.hp, maxHp: G.hive.maxHp }, php: G.player.hp, stats: G.stats, taken: G.taken,
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
    for (const k of ['score', 'honey', 'honeyTotal', 'kills', 'time', 'maxCombo']) G[k] = Number(sv[k]) || 0;
    G.endless = !!sv.endless; G.beat = !!sv.beat; G.savedId = sv.savedId || null;
    Object.assign(G.stats, sv.stats);
    G.taken = sv.taken || {};
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
      G.helpers.push({ x: G.hive.x, y: G.hive.y, ang: (G.helpers.length / 3) * TAU, cd: 0, aim: 0 });
    }
    G.helpers.forEach((h, i) => { h.ang = (i / G.helpers.length) * TAU; });
  }

  function setState(s) {
    state = s;
    stateTimer = 0;
    const inGame = s === 'playing' || s === 'paused' || s === 'clear' || s === 'dying';
    $('hud').classList.toggle('hidden', !inGame);
    const showBtns = s === 'playing' || s === 'paused' || s === 'clear';
    $('btnPulse').classList.toggle('hidden', !showBtns);
    $('btnDash').classList.toggle('hidden', !showBtns);
    if (s !== 'playing') joy.active = false;
  }

  // ---------------- קלט ----------------
  const keys = new Set();
  const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, mouse: false };

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') {
      if (e.key === 'Enter') saveScoreFromInput();
      return;
    }
    keys.add(e.code);
    if (state === 'playing' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'Space' && state === 'playing' && !e.repeat) firePulse();
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && state === 'playing' && !e.repeat) doDash();
    if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
      if (state === 'playing') pauseGame();
      else if (state === 'paused') resumeGame();
    }
    if (e.code === 'KeyM' && !e.repeat) Sound.setMuted(!Sound.muted);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); joy.active = false; if (state === 'playing') pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pauseGame(); });

  canvas.addEventListener('pointerdown', (e) => {
    Sound.init();
    if (state !== 'playing') return;
    e.preventDefault();
    joy.active = true; joy.id = e.pointerId;
    joy.mouse = e.pointerType === 'mouse';
    joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (joy.active && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; }
  });
  const endPointer = (e) => { if (e.pointerId === joy.id) joy.active = false; };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

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
      if (d < 4) return { x: 0, y: 0 };
      const m = Math.min(1, d / 55);
      return { x: (dx / d) * m, y: (dy / d) * m };
    }
    return { x: 0, y: 0 };
  }

  // ---------------- יצירת אויבים ----------------
  function edgePoint(m = 40) {
    switch (Math.floor(Math.random() * 4)) {
      case 0: return { x: rand(0, W), y: -m };
      case 1: return { x: W + m, y: rand(0, H) };
      case 2: return { x: rand(0, W), y: H + m };
      default: return { x: -m, y: rand(0, H) };
    }
  }

  function spawnEnemy(type, x, y) {
    const d = ETYPES[type];
    const p = G.plan;
    const hp = d.hp * p.hpMul;
    const e = {
      type, x, y, r: d.r, hp, maxHp: hp, speed: d.speed * p.speedMul * rand(0.9, 1.1),
      dmg: d.dmg * D().dmg, def: d, t: rand(0, 10), flash: 0, kx: 0, ky: 0, ang: 0,
      shootCd: rand(1.5, 2.5), seed: Math.random() * TAU, stinging: false,
    };
    G.enemies.push(e);
    return e;
  }

  function spawnBoss(kind) {
    const d = BOSSES[kind];
    const e = {
      type: 'boss', kind, boss: true, x: W / 2, y: -80, r: d.r, hp: d.hp * D().hp * G.plan.bossMul, maxHp: d.hp * D().hp * G.plan.bossMul,
      speed: d.speed, dmg: d.dmg * D().dmg, def: d, t: 0, flash: 0, kx: 0, ky: 0, ang: Math.PI / 2,
      mode: 'enter', modeT: 0, orbitA: -Math.PI / 2, atkCd: 3, spawnCd: 4, cvx: 0, cvy: 0,
      atkIdx: 0, spiralA: 0, spiralCd: 0, phase2: false,
    };
    G.enemies.push(e);
    G.boss = e;
    G.bossSpawned = true;
    $('bossName').textContent = d.name;
    $('bossBar').classList.remove('hidden');
    shake = 12;
    Sound.play('boss');
    showBanner(d.name, 'Defend the hive!', 1.8);
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
    P.inv = Math.max(P.inv, 0.3);
    Sound.play('dash');
  }

  function addDecal(x, y, r, kind, color) {
    if (G.decals.length > 45) G.decals.shift();
    G.decals.push({ x, y, r, kind, color: color || '#000000', life: 10, rot: Math.random() * TAU });
  }

  const comboMult = () => 1 + Math.min(4, Math.floor(G.combo / 5)) * 0.5;

  function explode(x, y, radius, dmg) {
    G.rings.push({ x, y, r: 10, max: radius, life: 0.3, t: 0, color: '255,120,40' });
    burst(x, y, 26, '#ff7a1a', 240);
    burst(x, y, 12, '#ffe082', 160);
    for (let i = 0; i < 9; i++) {
      G.particles.push({ x: x + rand(-18, 18), y: y + rand(-18, 18), vx: rand(-40, 40), vy: rand(-70, -20), life: rand(0.7, 1.3), max: 1.3, r: rand(7, 12), grow: 26, a: 0.5, color: '#4a4a4a' });
    }
    addDecal(x, y, radius * 0.55, 'scorch');
    shake = Math.max(shake, 9);
    Sound.play('boom');
    if (!dmg) return;
    for (const o of G.enemies) {
      if (o.hp <= 0) continue;
      const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < radius + o.r) damageEnemy(o, dmg, dx / d, dy / d, o.boss ? 0 : 300);
    }
  }

  function firePulse() {
    const P = G.player, S = G.stats;
    if (P.pulseCd > 0) { Sound.play('denied'); return; }
    P.pulseCd = S.pulseCd;
    G.rings.push({ x: P.x, y: P.y, r: 10, max: S.pulseRadius, life: 0.45, t: 0 });
    Sound.play('pulse');
    shake = Math.max(shake, 5);
    for (const e of G.enemies) {
      const dx = e.x - P.x, dy = e.y - P.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < S.pulseRadius + e.r) {
        damageEnemy(e, S.pulseDmg, dx / d, dy / d, e.boss ? 0 : 420);
      }
    }
    // גל הזמזום גם מנקה יריקות
    G.shots = G.shots.filter((s) => Math.hypot(s.x - P.x, s.y - P.y) > S.pulseRadius);
  }

  function nearestEnemy(x, y, range) {
    let best = null, bd = range * range;
    for (const e of G.enemies) {
      if (e.y < -e.r || e.y > H + e.r || e.x < -e.r || e.x > W + e.r) continue; // רק אויבים על המסך
      const dx = e.x - x, dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function shoot(x, y, ang, dmg, count, speed, pierce, small) {
    const spread = 0.13;
    for (let i = 0; i < count; i++) {
      const a = ang + (i - (count - 1) / 2) * spread;
      G.stingers.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, ang: a, dmg, pierce, life: 1.1, hit: [], small });
    }
  }

  function damageEnemy(e, dmg, nx, ny, knock, crit) {
    if (e.hp <= 0) return;
    if (crit) { dmg *= 2; addFloater(e.x + rand(-6, 6), e.y - e.r - 6, Math.round(dmg) + '!', '#ffe14d', 20); Sound.play('crit'); }
    e.hp -= dmg;
    e.flash = 0.1;
    if (knock) { e.kx += nx * knock; e.ky += ny * knock; }
    if (e.hp <= 0) killEnemy(e);
    else Sound.play('hit');
  }

  function killEnemy(e) {
    G.kills++;
    G.combo++; G.comboT = 2.6;
    if (G.combo > G.maxCombo) G.maxCombo = G.combo;
    if (G.combo % 5 === 0 && G.combo <= 20) {
      addFloater(G.player.x, G.player.y - 34, 'x' + comboMult() + ' 🔥', '#ffab40', 22);
      Sound.play('combo');
    }
    const pts = Math.round(e.def.score * comboMult() * D().score);
    G.score += pts;
    addFloater(e.x, e.y - e.r, '+' + pts, '#fff6a0');
    burst(e.x, e.y, e.boss ? 80 : 14, e.def.body, e.boss ? 260 : 160);
    burst(e.x, e.y, e.boss ? 30 : 5, '#fff3b0', e.boss ? 320 : 120);
    const cl = e.boss ? 1.1 : 0.45;
    G.corpses.push({ x: e.x, y: e.y, ang: e.ang, r: e.r, def: e.def, boss: !!e.boss, kind: e.kind, type: e.type, spin: rand(-14, 14), vx: e.kx * 0.4, vy: e.ky * 0.4, life: cl, max: cl });
    addDecal(e.x, e.y, e.r * (e.boss ? 1.6 : 1.1), 'goo', e.def.body);
    const hn = e.def.honey;
    for (let i = 0; i < hn; i++) {
      G.pickups.push({ kind: 'honey', x: e.x + rand(-12, 12), y: e.y + rand(-12, 12), vx: rand(-60, 60), vy: rand(-60, 60), life: 14, t: rand(0, 5) });
    }
    if (!e.boss && e.type !== 'mini') {
      const r = Math.random();
      if (r < 0.035) G.pickups.push({ kind: 'heart', x: e.x, y: e.y, vx: 0, vy: 0, life: 12, t: 0 });
      else if (r < 0.08) G.pickups.push({ kind: ['rapid', 'shield', 'freeze'][Math.floor(Math.random() * 3)], x: e.x, y: e.y, vx: 0, vy: 0, life: 12, t: 0 });
    }
    if (e.def.bomb) explode(e.x, e.y, 95, 45);
    if (e.def.split) {
      for (let i = 0; i < e.def.split; i++) {
        const a = (i / e.def.split) * TAU + Math.random();
        const m = spawnEnemy('mini', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14);
        m.kx = Math.cos(a) * 220; m.ky = Math.sin(a) * 220;
      }
    }
    if (e.boss) {
      Sound.play('bossDie');
      shake = 22;
      G.boss = null;
      $('bossBar').classList.add('hidden');
      // הבוס מת – כל הצרעות הקטנות בורחות/נעלמות
      for (const o of G.enemies) if (o !== e && o.hp > 0) { o.hp = 0; burst(o.x, o.y, 8, o.def.body, 120); }
      G.enemies = G.enemies.filter((o) => o === e);
      G.shots = [];
    } else {
      Sound.play('kill');
    }
  }

  function hurtPlayer(dmg) {
    const P = G.player;
    if (P.inv > 0 || state !== 'playing') return;
    if (G.buffs.shield > 0) { P.inv = 0.25; burst(P.x, P.y, 6, '#80deea', 120); return; }
    P.hp -= dmg;
    P.inv = 0.8;
    G.combo = 0;
    G.hurtFlash = 0.4;
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) { /* לא נתמך */ }
    shake = Math.max(shake, 7);
    Sound.play('hurt');
    burst(P.x, P.y, 10, '#ffd23f', 140);
    if (P.hp <= 0) { P.hp = 0; gameOver('The bee took too many hits'); }
  }

  function hurtHive(dmg) {
    const Hv = G.hive;
    if (state !== 'playing') return;
    Hv.hp -= dmg;
    Hv.hitT = 0.15;
    Sound.play('hive');
    if (Hv.hp <= 0) { Hv.hp = 0; gameOver('The hive was destroyed'); }
  }

  // ---------------- אפקטים ----------------
  function burst(x, y, n, color, spd) {
    for (let i = 0; i < n; i++) {
      if (G.particles.length > 500) G.particles.shift();
      const a = Math.random() * TAU, s = rand(spd * 0.3, spd);
      G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.8), max: 0.8, r: rand(2, 4.5), color });
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

    // --- שחקן ---
    for (const k in G.buffs) if (G.buffs[k] > 0) G.buffs[k] = Math.max(0, G.buffs[k] - dt);
    if (G.combo > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
    if (G.hurtFlash > 0) G.hurtFlash -= dt;
    const slow = G.buffs.freeze > 0 ? 0.35 : 1;

    const v = inputVector();
    if (v.x || v.y) { P.mx = v.x; P.my = v.y; }
    P.vx = v.x * S.speed; P.vy = v.y * S.speed;
    if ((v.x || v.y) && Math.random() < dt * 22) {
      G.particles.push({ x: P.x - v.x * 14 + rand(-4, 4), y: P.y - v.y * 14 + rand(-4, 4), vx: -v.x * 30, vy: -v.y * 30, life: 0.45, max: 0.45, r: rand(1.5, 2.6), color: '#fff6c4' });
    }
    if (P.dashCd > 0) P.dashCd = Math.max(0, P.dashCd - dt);
    if (P.dashT > 0) {
      P.dashT -= dt;
      P.vx = P.dvx; P.vy = P.dvy;
      G.particles.push({ x: P.x, y: P.y, vx: 0, vy: 0, life: 0.3, max: 0.3, r: 9, color: 'rgba(255,230,120,0.7)' });
    }
    P.x = clamp(P.x + P.vx * dt, P.r, W - P.r);
    P.y = clamp(P.y + P.vy * dt, P.r + 50, H - P.r);
    if (P.inv > 0) P.inv -= dt;
    if (P.pulseCd > 0) P.pulseCd = Math.max(0, P.pulseCd - dt);
    if (S.regen) P.hp = Math.min(S.maxHp, P.hp + S.regen * dt);
    // לא נכנסים לתוך הכוורת
    {
      const dx = P.x - Hv.x, dy = P.y - Hv.y, d = Math.hypot(dx, dy) || 1, min = Hv.r + P.r;
      if (d < min) { P.x = Hv.x + (dx / d) * min; P.y = Hv.y + (dy / d) * min; }
    }

    P.fireCd -= dt;
    const target = nearestEnemy(P.x, P.y, S.range);
    if (target) {
      P.ang = Math.atan2(target.y - P.y, target.x - P.x);
      if (P.fireCd <= 0) {
        P.fireCd = 1 / (S.fireRate * (G.buffs.rapid > 0 ? 2 : 1));
        shoot(P.x, P.y, P.ang, S.damage, S.multishot, S.shotSpeed, S.pierce, false);
        Sound.play('shoot');
      }
    } else if (v.x || v.y) {
      P.ang = Math.atan2(v.y, v.x);
    }

    // --- דבורות עזר ---
    G.helpers.forEach((h) => {
      h.ang += dt * 1.3;
      h.x = Hv.x + Math.cos(h.ang) * 78;
      h.y = Hv.y + Math.sin(h.ang) * 78;
      h.cd -= dt;
      const t = nearestEnemy(h.x, h.y, 300);
      if (t) {
        h.aim = Math.atan2(t.y - h.y, t.x - h.x);
        if (h.cd <= 0) { h.cd = 0.75; shoot(h.x, h.y, h.aim, S.damage * 0.7, 1, 520, 0, true); }
      } else h.aim = h.ang + Math.PI / 2;
    });

    // --- יצירת אויבים ---
    if (G.introT > 0) G.introT -= dt;
    else {
      if (plan.boss && !G.bossSpawned) spawnBoss(plan.boss);
      if (plan.queue.length) {
        G.spawnT -= dt;
        if (G.spawnT <= 0) {
          G.spawnT = plan.interval * rand(0.7, 1.3);
          const type = plan.queue.shift();
          const pt = edgePoint();
          spawnEnemy(type, pt.x, pt.y);
          // מהשלב הרביעי – לפעמים נחיל קטן מאותו כיוון
          if (G.level >= 4 && type === 'wasp' && Math.random() < 0.3) {
            for (let i = 0; i < 2 && plan.queue.length; i++) {
              spawnEnemy(plan.queue.shift(), pt.x + rand(-40, 40), pt.y + rand(-40, 40));
            }
          }
        }
      }
    }

    // --- אויבים ---
    for (const e of G.enemies) {
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.boss) { updateBoss(e, dt * (slow < 1 ? 0.5 : 1)); continue; }
      const d = e.def;
      let tx = Hv.x, ty = Hv.y;
      if (d.target === 'bee') { tx = P.x; ty = P.y; }
      let dx = tx - e.x, dy = ty - e.y;
      let dist = Math.hypot(dx, dy) || 1;
      let mvx = dx / dist, mvy = dy / dist;
      let spd = e.speed * slow;
      // התנודדות קלה
      const wob = Math.sin(e.t * 3 + e.seed) * 0.45;
      let wx = mvx - mvy * wob, wy = mvy + mvx * wob;

      if (d.ranged) {
        const stop = 250;
        if (dist < stop) {
          // מקיפה את הכוורת ויורקת
          wx = -mvy * 0.8 + (dist < stop - 30 ? -mvx * 0.6 : 0);
          wy = mvx * 0.8 + (dist < stop - 30 ? -mvy * 0.6 : 0);
          spd *= 0.6;
        }
        e.shootCd -= dt;
        if (e.shootCd <= 0 && dist < stop + 60 && e.x > 0 && e.x < W && e.y > 0 && e.y < H) {
          e.shootCd = rand(2, 2.8);
          const toBee = Math.hypot(P.x - e.x, P.y - e.y) < 260;
          const ax = toBee ? P.x : Hv.x, ay = toBee ? P.y : Hv.y;
          const a = Math.atan2(ay - e.y, ax - e.x);
          G.shots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 6, dmg: 9 * D().dmg, life: 4, color: '#9ccc65' });
          Sound.play('spit');
        }
      }

      // נגיעה בכוורת – עוקצת
      const hd = Math.hypot(e.x - Hv.x, e.y - Hv.y);
      e.stinging = hd < Hv.r + e.r - 2;
      if (e.stinging && d.bomb) {
        // צרעת נפץ הגיעה לכוורת
        explode(e.x, e.y, 80, 0);
        hurtHive(e.dmg);
        e.hp = 0;
        continue;
      }
      if (e.stinging) {
        spd = 0;
        hurtHive(e.dmg * dt);
        if (Math.random() < dt * 4) burst(e.x + (Hv.x - e.x) * 0.3, e.y + (Hv.y - e.y) * 0.3, 2, '#ffcf33', 60);
      }

      // הפרדה בין צרעות
      let sx = 0, sy = 0;
      for (const o of G.enemies) {
        if (o === e || o.boss) continue;
        const ox = e.x - o.x, oy = e.y - o.y, od = ox * ox + oy * oy, rr = (e.r + o.r) * 0.9;
        if (od < rr * rr && od > 0.01) { const l = Math.sqrt(od); sx += (ox / l) * (rr - l); sy += (oy / l) * (rr - l); }
      }

      e.x += (wx * spd + e.kx) * dt + sx * 0.5;
      e.y += (wy * spd + e.ky) * dt + sy * 0.5;
      const decay = Math.pow(0.02, dt);
      e.kx *= decay; e.ky *= decay;
      e.ang = e.stinging ? Math.atan2(Hv.y - e.y, Hv.x - e.x) : Math.atan2(wy, wx);
      // לא חודרות לתוך הכוורת
      const hd2 = Math.hypot(e.x - Hv.x, e.y - Hv.y) || 1;
      if (hd2 < Hv.r + e.r - 4) { e.x = Hv.x + ((e.x - Hv.x) / hd2) * (Hv.r + e.r - 4); e.y = Hv.y + ((e.y - Hv.y) / hd2) * (Hv.r + e.r - 4); }

      // מגע בדבורה
      const pd = Math.hypot(e.x - P.x, e.y - P.y);
      if (pd < e.r + P.r - 2 && P.inv <= 0) {
        hurtPlayer(e.dmg);
        const nx = (e.x - P.x) / (pd || 1), ny = (e.y - P.y) / (pd || 1);
        e.kx += nx * 320; e.ky += ny * 320;
      }
    }

    // --- עוקצים של השחקן ---
    for (const s of G.stingers) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.x < -30 || s.x > W + 30 || s.y < -30 || s.y > H + 30) s.life = 0;
      if (s.life <= 0) continue;
      for (const e of G.enemies) {
        if (e.hp <= 0 || s.hit.includes(e)) continue;
        const rr = e.r + 4;
        if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < rr * rr) {
          s.hit.push(e);
          const l = Math.hypot(s.vx, s.vy) || 1;
          damageEnemy(e, s.dmg, s.vx / l, s.vy / l, e.boss ? 0 : 70, !s.small && Math.random() < S.crit);
          burst(s.x, s.y, 3, '#fff3b0', 90);
          if (s.pierce-- <= 0) { s.life = 0; break; }
        }
      }
    }
    G.stingers = G.stingers.filter((s) => s.life > 0);
    G.enemies = G.enemies.filter((e) => e.hp > 0);

    // --- יריות אויב ---
    for (const s of G.shots) {
      s.x += s.vx * dt * slow; s.y += s.vy * dt * slow; s.life -= dt * slow;
      if (Math.hypot(s.x - P.x, s.y - P.y) < s.r + P.r - 2 && P.inv <= 0) { hurtPlayer(s.dmg); s.life = 0; }
      else if (Math.hypot(s.x - Hv.x, s.y - Hv.y) < s.r + Hv.r) {
        hurtHive(s.dmg * 0.8); burst(s.x, s.y, 5, s.color, 80); s.life = 0;
      }
      if (s.x < -60 || s.x > W + 60 || s.y < -60 || s.y > H + 60) s.life = 0;
    }
    G.shots = G.shots.filter((s) => s.life > 0);

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
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (d < P.r + 10) {
        p.life = 0;
        if (p.kind === 'honey') {
          G.honey++; G.honeyTotal++; G.score += 5;
          Sound.play('pickup');
        } else if (p.kind !== 'heart') {
          G.buffs[p.kind] = 7.5;
          const label = { rapid: '⚡ x2', shield: '🛡️', freeze: '❄️' }[p.kind];
          addFloater(P.x, P.y - 24, label, '#ffffff', 22);
          Sound.play('power');
        } else {
          P.hp = Math.min(S.maxHp, P.hp + 25);
          addFloater(P.x, P.y - 20, '+25 ❤', '#ff9eb5');
          Sound.play('heart');
        }
      }
    }
    G.pickups = G.pickups.filter((p) => p.life > 0);

    if (Hv.hitT > 0) Hv.hitT -= dt;

    // --- סוף שלב? ---
    if (state === 'playing' && G.introT <= 0 && !plan.queue.length && !G.enemies.length && (!plan.boss || G.bossSpawned)) {
      levelClear();
    }
  }

  function updateBoss(e, dt) {
    const P = G.player, Hv = G.hive, def = e.def;
    e.phase2 = e.hp < e.maxHp * 0.5;
    const rate = e.phase2 ? 1.45 : 1;
    const orbitR = Math.min(def.orbitR, Math.min(W, H) / 2 - e.r - 10);
    e.modeT += dt;

    const moveTo = (tx, ty, spd) => {
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
      if (d > 1) { const s = Math.min(d, spd * dt); e.x += (dx / d) * s; e.y += (dy / d) * s; }
      return d;
    };

    if (e.mode === 'enter') {
      const tx = Hv.x + Math.cos(e.orbitA) * orbitR, ty = Hv.y + Math.sin(e.orbitA) * orbitR;
      e.ang = Math.atan2(ty - e.y, tx - e.x);
      if (moveTo(tx, ty, 120) < 4) { e.mode = 'orbit'; e.modeT = 0; }
    } else if (e.mode === 'orbit') {
      e.orbitA += dt * 0.32 * rate;
      const tx = Hv.x + Math.cos(e.orbitA) * orbitR, ty = Hv.y + Math.sin(e.orbitA) * orbitR;
      moveTo(tx, ty, e.speed * 2);
      e.ang = Math.atan2(P.y - e.y, P.x - e.x);
      e.spawnCd -= dt * rate;
      if (e.spawnCd <= 0 && G.enemies.length < 40) {
        e.spawnCd = def.spawn.cd;
        const kinds = def.spawn.kinds;
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        for (let i = 0; i < def.spawn.n; i++) spawnEnemy(kind, e.x + rand(-30, 30), e.y + rand(-30, 30));
        burst(e.x, e.y, 12, def.body, 120);
      }
      e.atkCd -= dt * rate;
      if (e.atkCd <= 0) {
        const a = def.atks[e.atkIdx++ % def.atks.length];
        if (a === 'windup' || a === 'spiral') { e.mode = a; e.modeT = 0; }
        else if (a === 'burst') {
          const n = e.phase2 ? 22 : 16, off = Math.random() * TAU;
          for (let i = 0; i < n; i++) bossShot(e, off + (i / n) * TAU, 190);
          Sound.play('spit');
        } else {
          const base = Math.atan2(P.y - e.y, P.x - e.x);
          for (let i = -2; i <= 2; i++) bossShot(e, base + i * 0.18, 280);
          Sound.play('spit');
        }
        e.atkCd = def.atkCd;
      }
    } else if (e.mode === 'windup') {
      e.ang = Math.atan2(P.y - e.y, P.x - e.x);
      e.x += Math.sin(e.modeT * 60) * 1.5;
      if (e.modeT > 0.75) {
        e.cvx = Math.cos(e.ang) * def.chargeSpeed; e.cvy = Math.sin(e.ang) * def.chargeSpeed;
        e.mode = 'charge'; e.modeT = 0;
        Sound.play('charge');
      }
    } else if (e.mode === 'charge') {
      e.x += e.cvx * dt; e.y += e.cvy * dt;
      if (Math.random() < 0.6) burst(e.x, e.y, 1, def.wing, 40);
      const out = e.x < e.r || e.x > W - e.r || e.y < e.r + 40 || e.y > H - e.r;
      if (e.modeT > 0.9 || out) {
        e.x = clamp(e.x, e.r, W - e.r); e.y = clamp(e.y, e.r + 40, H - e.r);
        e.mode = 'return'; e.modeT = 0;
        e.orbitA = Math.atan2(e.y - Hv.y, e.x - Hv.x);
      }
    } else if (e.mode === 'return') {
      const tx = Hv.x + Math.cos(e.orbitA) * orbitR, ty = Hv.y + Math.sin(e.orbitA) * orbitR;
      e.ang = Math.atan2(ty - e.y, tx - e.x);
      if (moveTo(tx, ty, 200) < 4 || e.modeT > 3) { e.mode = 'orbit'; e.modeT = 0; }
    } else if (e.mode === 'spiral') {
      e.spiralCd -= dt;
      e.ang += dt * 4;
      if (e.spiralCd <= 0) {
        e.spiralCd = e.phase2 ? 0.06 : 0.09;
        e.spiralA += 0.38;
        bossShot(e, e.spiralA, 170);
        if (e.phase2) bossShot(e, e.spiralA + Math.PI, 170);
      }
      if (e.modeT > 2.6) { e.mode = 'orbit'; e.modeT = 0; }
    }

    // מגע עם הכוורת / הדבורה
    const hd = Math.hypot(e.x - Hv.x, e.y - Hv.y) || 1;
    if (hd < Hv.r + e.r) {
      hurtHive(e.dmg * (e.mode === 'charge' ? 0.8 : 0.05));
      e.x = Hv.x + ((e.x - Hv.x) / hd) * (Hv.r + e.r);
      e.y = Hv.y + ((e.y - Hv.y) / hd) * (Hv.r + e.r);
      if (e.mode === 'charge') { e.mode = 'return'; e.modeT = 0; shake = 14; e.orbitA = Math.atan2(e.y - Hv.y, e.x - Hv.x); }
    }
    if (Math.hypot(e.x - P.x, e.y - P.y) < e.r + P.r - 4) hurtPlayer(e.dmg);
  }

  function bossShot(e, a, sp) {
    G.shots.push({ x: e.x + Math.cos(a) * e.r * 0.6, y: e.y + Math.sin(a) * e.r * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7, dmg: 10 * D().dmg, life: 6, color: e.def.shot });
  }

  // שעת היום: בוקר → שקיעה → דמדומים → לילה
  function tintFor(level) {
    if (level > 10) level = ((level - 1) % 10) + 1;
    if (level <= 3) return [255, 255, 255, 0];
    if (level <= 5) return [255, 150, 40, 0.13];
    if (level <= 7) return [255, 80, 60, 0.2];
    if (level <= 9) return [50, 40, 130, 0.2];
    return [8, 10, 60, 0.26];
  }
  function darkFor(level) {
    const l = themeLevel(level);
    return l >= 10 ? 0.52 : l >= 8 ? 0.34 : l >= 6 ? 0.1 : 0;
  }
  function rainFor(level) {
    const l = themeLevel(level);
    return l === 9 ? 1 : l === 8 ? 0.6 : 0;
  }

  function updateEffects(dt) {
    for (const p of G.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; if (p.grow) p.r += p.grow * dt; }
    for (const c of G.corpses) { c.x += c.vx * dt; c.y += c.vy * dt; c.ang += c.spin * dt; c.life -= dt; }
    G.corpses = G.corpses.filter((c) => c.life > 0);
    for (const d of G.decals) d.life -= dt;
    G.decals = G.decals.filter((d) => d.life > 0);
    // עשן כשהכוורת במצב קשה
    if (G.hive.hp / G.hive.maxHp < 0.35 && Math.random() < dt * 7) {
      G.particles.push({ x: G.hive.x + rand(-25, 25), y: G.hive.y + rand(-25, 10), vx: rand(-15, 15), vy: rand(-60, -30), life: 1.2, max: 1.2, r: rand(5, 9), grow: 14, a: 0.45, color: '#3a3a3a' });
    }
    // מזג אוויר: חושך, גשם וברקים
    const ke = Math.min(1, dt * 0.8);
    G.dark += (darkFor(G.level) - G.dark) * ke;
    G.rain += (rainFor(G.level) - G.rain) * ke;
    if (G.flash > 0) G.flash -= dt * 2.2;
    if (themeLevel(G.level) === 9 && state === 'playing') {
      G.boltT -= dt;
      if (G.boltT <= 0) { G.boltT = rand(6, 13); G.flash = 1; Sound.play('thunder'); }
    }
    G.particles = G.particles.filter((p) => p.life > 0);
    for (const f of G.floaters) { f.y -= 40 * dt; f.life -= dt; }
    G.floaters = G.floaters.filter((f) => f.life > 0);
    for (const r of G.rings) { r.t += dt; r.r = 10 + (r.max - 10) * Math.min(1, r.t / r.life); }
    G.rings = G.rings.filter((r) => r.t < r.life + 0.15);
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
    // מעבר הדרגתי של שעת היום לפי השלב
    const tgt = tintFor(G.level), k = Math.min(1, dt * 0.8);
    for (let i = 0; i < 4; i++) G.tint[i] += (tgt[i] - G.tint[i]) * k;
    if (G.particles.length > 600) G.particles.splice(0, G.particles.length - 600);
  }

  // ---------------- מעברי מצב ----------------
  function levelClear() {
    setState('clear');
    G.shots = [];
    const hivePct = G.hive.hp / G.hive.maxHp;
    const bonus = Math.round((G.level * 100 + Math.round(hivePct * 100) * G.level * 2) * D().score);
    G.lastBonus = bonus;
    G.score += bonus;
    Sound.play('level');
    showBanner('Level complete! 🎉', 'Bonus: ' + bonus, 1.7);
  }

  function afterClear() {
    // לוקחים את כל הדבש שנשאר על הרצפה
    G.pickups.forEach((p) => { if (p.kind === 'honey') { G.honey++; G.honeyTotal++; G.score += 5; } });
    G.pickups = [];
    if (G.level === MAX_LEVEL && !G.endless) { G.beat = true; endGame(true); return; }
    // תיקון קטן אוטומטי לכוורת בין שלבים
    G.hive.hp = Math.min(G.hive.maxHp, G.hive.hp + G.hive.maxHp * 0.1);
    G.player.hp = Math.min(G.stats.maxHp, G.player.hp + G.stats.maxHp * 0.2);
    openUpgrade();
  }

  function gameOver(reason) {
    if (state !== 'playing') return;
    G.deathReason = reason;
    setState('dying');
    shake = 18;
    const t = reason.includes('hive') ? G.hive : G.player;
    burst(t.x, t.y, 60, '#ffb703', 260);
    $('bossBar').classList.add('hidden');
  }

  function endGame(won) {
    setState('over');
    $('bossBar').classList.add('hidden');
    Sound.play(won ? 'win' : 'over');
    clearRun();
    const title = won ? '🏆 Victory! The hive is saved!' : G.endless ? '♾️ End of the endless journey' : '💔 Game over';
    $('goTitle').textContent = title;
    const mm = Math.floor(G.time / 60), ss = String(Math.floor(G.time % 60)).padStart(2, '0');
    const stats = `Score: <b>${G.score.toLocaleString('en-US')}</b> · Difficulty: ${DIFFS[G.diff].name}<br>Wasps defeated: ${G.kills} · Honey: ${G.honeyTotal} · Best combo: ${G.maxCombo} · Time: ${mm}:${ss}`;
    const info = won
      ? `You defeated the Wasp Emperor and all 10 levels!<br>${stats}<br><i>The moral: those who build with patience guard with courage, and those who only take are left with nothing.</i>`
      : G.endless ? `${G.deathReason}, but you reached level ${G.level} in endless mode!<br>${stats}`
      : `${G.deathReason} on level ${G.level}.<br>${stats}`;
    $('goInfo').innerHTML = info;
    G.won = won || G.beat;
    G.saved = false;
    $('btnEndless').classList.toggle('hidden', !(won && !G.endless));
    const q = qualifies(G.score);
    $('goNameBox').classList.toggle('hidden', !q);
    $('goName').value = store.get(NAME_KEY, '') || '';
    renderScores($('goScores'), null);
    showScreen('gameover');
    if (q && !matchMedia('(pointer: coarse)').matches) setTimeout(() => $('goName').focus(), 50);
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
    setState('menu');
    $('bossBar').classList.add('hidden');
    $('banner').classList.add('hidden');
    showScreen('menu');
  }

  // ---------------- מסך שדרוגים ----------------
  const HIVE_COST = 10, BEE_COST = 8;
  function openUpgrade() {
    setState('upgrade');
    $('upTitle').textContent = `Level ${G.level} complete! 🎉`;
    $('upInfo').innerHTML = `Level bonus: <b>${G.lastBonus}</b> · Score: <b>${G.score.toLocaleString('en-US')}</b><br>The hive was repaired by 10% and the bee rested (+20% health).`;
    const pool = UPGRADES.filter((u) => (G.taken[u.id] || 0) < u.max);
    const pick = [];
    while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    if (pick.length < 3) pick.push({ id: 'jar', icon: '🍯', name: 'Honey Jar', desc: '+15 honey for the shop', max: Infinity, apply: (st, g) => { g.honey += 15; } });
    const cards = $('cards');
    cards.innerHTML = '';
    pick.forEach((u) => {
      const b = document.createElement('button');
      b.className = 'card';
      const lv = G.taken[u.id] || 0;
      b.innerHTML = `<div class="ic">${u.icon}</div><div class="nm">${u.name}</div><div class="ds">${u.desc}</div>${u.max === Infinity ? '' : `<div class="lv">Level ${lv} → ${lv + 1} (of ${u.max})</div>`}`;
      b.addEventListener('click', () => chooseUpgrade(u));
      cards.appendChild(b);
    });
    refreshShop();
    showScreen('upgrade');
  }
  function refreshShop() {
    $('upHoney').textContent = G.honey;
    const bh = $('buyHive'), bb = $('buyBee');
    bh.textContent = `🍯 Repair hive +50 (${HIVE_COST} honey) · ${Math.ceil(G.hive.hp)}/${G.hive.maxHp}`;
    bb.textContent = `🐝 Heal bee +40 (${BEE_COST} honey) · ${Math.ceil(G.player.hp)}/${G.stats.maxHp}`;
    bh.disabled = G.honey < HIVE_COST || G.hive.hp >= G.hive.maxHp;
    bb.disabled = G.honey < BEE_COST || G.player.hp >= G.stats.maxHp;
  }
  function chooseUpgrade(u) {
    if (state !== 'upgrade') return;
    u.apply(G.stats, G);
    G.taken[u.id] = (G.taken[u.id] || 0) + 1;
    G.player.hp = Math.min(G.player.hp, G.stats.maxHp);
    Sound.play('upgrade');
    hideScreens();
    startLevel(G.level + 1);
  }

  // ---------------- מסכים ----------------
  const SCREENS = ['menu', 'howto', 'scores', 'upgrade', 'pause', 'gameover', 'story'];
  function showScreen(id) {
    SCREENS.forEach((s) => $(s).classList.toggle('hidden', s !== id));
    if (id === 'menu') {
      const s = getScores();
      const sv = loadRun();
      $('btnContinue').classList.toggle('hidden', !sv);
      if (sv) $('btnContinue').textContent = `▶ Continue (level ${sv.level}, ${DIFFS[sv.diff].name})`;
      $('menuBest').textContent = s.length ? `🏆 Best: ${s[0].score.toLocaleString('en-US')} (${s[0].name})` : '';
    }
  }
  function hideScreens() {
    SCREENS.forEach((s) => $(s).classList.add('hidden'));
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function renderScores(el, highlightId) {
    const s = getScores();
    if (!s.length) { el.innerHTML = '<div class="empty">No high scores yet. Be the first!</div>'; return; }
    const medals = ['🥇', '🥈', '🥉'];
    el.innerHTML = '<table class="scores"><thead><tr><th>#</th><th>Name</th><th>Score</th><th>Level</th><th>Difficulty</th></tr></thead><tbody>' +
      s.map((r, i) => `<tr class="${r.id === highlightId ? 'me' : ''}" title="${esc((r.date || '').split('-').reverse().join('/'))}"><td>${medals[i] || i + 1}</td><td>${esc(r.name)}</td><td class="num">${Number(r.score).toLocaleString('en-US')}</td><td>${r.won ? '🏆' + (r.level > 10 ? ' ' + esc(r.level) : '') : esc(r.level)}</td><td>${(DIFFS[r.diff] || DIFFS.normal).name}</td></tr>`).join('') +
      '</tbody></table>';
  }

  let bannerTimer = 0;
  function showBanner(title, sub, secs) {
    $('bannerTitle').textContent = title;
    $('bannerSub').textContent = sub || '';
    const b = $('banner');
    b.classList.remove('hidden');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    bannerTimer = secs;
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
  function setBar(id, frac) {
    const w = Math.round(clamp(frac, 0, 1) * 1000) / 10 + '%';
    if (hudCache[id] !== w) {
      hudCache[id] = w;
      const el = $(id);
      el.style.width = w;
      if (id !== 'barBoss') el.classList.toggle('low', frac < 0.3);
    }
  }
  function updateHud() {
    if (!G) return;
    setText('hudLevel', String(G.level));
    setText('hudLevelMax', G.endless ? ' ♾️' : '/10');
    setText('hudScore', G.score.toLocaleString('en-US'));
    setText('hudHoney', String(G.honey));
    setBar('barBee', G.player.hp / G.stats.maxHp);
    setBar('barHive', G.hive.hp / G.hive.maxHp);
    if (G.boss) setBar('barBoss', G.boss.hp / G.boss.maxHp);
    const combo = G.combo >= 3 ? `🔥 ${G.combo} · x${comboMult()}` : '';
    if (hudCache.combo !== combo) { hudCache.combo = combo; const el = $('hudCombo'); el.textContent = combo; el.classList.toggle('hidden', !combo); }
    const icons = { rapid: '⚡', shield: '🛡️', freeze: '❄️' };
    const bf = Object.keys(icons).filter((k) => G.buffs[k] > 0).map((k) => icons[k] + ' ' + Math.ceil(G.buffs[k])).join('  ');
    if (hudCache.buffs !== bf) { hudCache.buffs = bf; const el = $('hudBuffs'); el.textContent = bf; el.classList.toggle('hidden', !bf); }
    const dc = Math.round((G.player.dashCd / G.stats.dashCd) * 100) + '%';
    if (hudCache.dash !== dc) { hudCache.dash = dc; $('dashFill').style.height = dc; $('btnDash').classList.toggle('cooling', G.player.dashCd > 0); }
    const cd = G.player.pulseCd / G.stats.pulseCd;
    const pf = Math.round(cd * 100) + '%';
    if (hudCache.pulse !== pf) {
      hudCache.pulse = pf;
      $('pulseFill').style.height = pf;
      $('btnPulse').classList.toggle('cooling', cd > 0);
      $('btnPulse').classList.toggle('ready', cd <= 0);
    }
  }

  // ---------------- ציור ----------------
  const hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
  const themeLevel = (lv) => (lv > 10 ? ((lv - 1) % 10) + 1 : lv);

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

  // --- חרקים: הגוף מצויר פעם אחת לתמונה שמורה, והכנפיים מונפשות מעליו ---
  const spriteCache = new Map();
  function paintInsectBody(g, r, c, opts) {
    const ab = opts.wasp ? 0.5 : 0.62;
    g.lineCap = 'round';
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
    // עוקץ
    g.fillStyle = '#1b1b1b';
    g.beginPath(); g.moveTo(-r * 1.22, -r * 0.15); g.lineTo(-r * 1.7, 0); g.lineTo(-r * 1.22, r * 0.15); g.closePath(); g.fill();
    // בטן עם הצללה
    const grad = g.createRadialGradient(-r * 0.7, -r * ab * 0.45, r * 0.05, -r * 0.5, 0, r * 0.95);
    grad.addColorStop(0, shade(c.body, 0.45)); grad.addColorStop(0.55, c.body); grad.addColorStop(1, shade(c.body, -0.4));
    g.save();
    g.beginPath(); g.ellipse(-r * 0.5, 0, r * 0.85, r * ab, 0, 0, TAU);
    g.fillStyle = grad; g.fill();
    g.clip();
    g.fillStyle = c.stripe;
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
    }
    // ברק
    g.fillStyle = 'rgba(255,255,255,0.33)';
    g.beginPath(); g.ellipse(-r * 0.62, -r * ab * 0.5, r * 0.42, r * 0.1, -0.12, 0, TAU); g.fill();
    g.restore();
    g.lineWidth = Math.max(1, r * 0.06); g.strokeStyle = 'rgba(0,0,0,0.55)';
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
    // ראש
    const hg = g.createRadialGradient(r * 0.72, -r * 0.1, r * 0.03, r * 0.78, 0, r * 0.38);
    hg.addColorStop(0, shade(c.head, 0.4)); hg.addColorStop(1, c.head);
    g.fillStyle = hg; g.beginPath(); g.arc(r * 0.78, 0, r * 0.36, 0, TAU); g.fill();
    // לסתות לצרעות
    if (opts.wasp) {
      g.fillStyle = '#2a1500';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(r * 1.05, s * r * 0.06); g.lineTo(r * 1.3, s * r * 0.16); g.lineTo(r * 1.08, s * r * 0.22); g.closePath(); g.fill(); }
    }
    // עיניים
    for (const s of [-1, 1]) {
      g.fillStyle = c.eye;
      g.beginPath(); g.ellipse(r * 0.9, s * r * 0.21, r * 0.14, r * 0.18, s * 0.3, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(r * 0.94, s * r * 0.17, r * 0.05, 0, TAU); g.fill();
    }
    // מחושים
    g.strokeStyle = c.head; g.lineWidth = Math.max(1, r * 0.07);
    g.beginPath();
    g.moveTo(r * 1.0, -r * 0.12); g.quadraticCurveTo(r * 1.4, -r * 0.2, r * 1.5, -r * 0.55);
    g.moveTo(r * 1.0, r * 0.12); g.quadraticCurveTo(r * 1.4, r * 0.2, r * 1.5, r * 0.55);
    g.stroke();
    // כתר לבוסים
    if (opts.crown) {
      g.fillStyle = '#ffd700'; g.strokeStyle = '#8a6500'; g.lineWidth = Math.max(1, r * 0.03);
      g.beginPath();
      g.moveTo(r * 0.5, -r * 0.3); g.lineTo(r * 0.5, r * 0.3); g.lineTo(r * 0.68, r * 0.2); g.lineTo(r * 0.6, r * 0.1);
      g.lineTo(r * 0.76, 0); g.lineTo(r * 0.6, -r * 0.1); g.lineTo(r * 0.68, -r * 0.2); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = '#e53935';
      g.beginPath(); g.arc(r * 0.57, 0, r * 0.05, 0, TAU); g.fill();
    }
  }

  function insectSprite(key, r, c, opts) {
    const id = key + '|' + r;
    let sp = spriteCache.get(id);
    if (sp) return sp;
    const k = scale * dpr;
    const half = r * 2.1;
    const size = Math.max(8, Math.ceil(half * 2 * k));
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    g.setTransform(k, 0, 0, k, size / 2, size / 2);
    paintInsectBody(g, r, c, opts);
    sp = { cv, half };
    spriteCache.set(id, sp);
    return sp;
  }

  function drawInsect(x, y, ang, r, c, t, opts = {}) {
    const sp = insectSprite(opts.key || c.body, r, c, opts);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (opts.scale) ctx.scale(opts.scale, opts.scale);
    const baseA = opts.alpha == null ? 1 : opts.alpha;
    ctx.globalAlpha = baseA;
    ctx.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2);
    // כנפיים עם טשטוש תנועה
    const flap = Math.sin(t * 55) * 0.38;
    for (let j = 0; j < 2; j++) {
      ctx.globalAlpha = baseA * (j ? 0.4 : 1);
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(r * 0.15, s * r * 0.2);
        ctx.rotate(s * (2.1 + (j ? -flap : flap)));
        ctx.fillStyle = c.wing;
        ctx.beginPath(); ctx.ellipse(r * 0.62, 0, r * 0.78, r * 0.3, 0, 0, TAU); ctx.fill();
        if (!j) {
          ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
          ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r * 0.05, 0); ctx.lineTo(r * 1.25, 0); ctx.moveTo(r * 0.4, 0); ctx.lineTo(r * 1.0, -r * 0.18); ctx.stroke();
        }
        ctx.restore();
      }
    }
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
  const enemyOpts = (e, extra) => Object.assign({ wasp: true, crown: !!e.boss, armor: e.type === 'brute', key: e.boss ? e.kind : e.type }, extra);

  // --- כוורת ---
  const HIVE_CELL = 15.5;
  const HIVE_CENTERS = [[0, 0]];
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; HIVE_CENTERS.push([Math.cos(a) * HIVE_CELL * Math.sqrt(3), Math.sin(a) * HIVE_CELL * Math.sqrt(3)]); }

  function drawHive(Hv) {
    const frac = Hv.hp / Hv.maxHp;
    const hs = HIVE_CELL;
    ctx.save();
    ctx.translate(Hv.x + (Hv.hitT > 0 ? rand(-2, 2) : 0), Hv.y);
    // הילה חמה
    const pulse = 78 + Math.sin(animT * 2) * 4;
    const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, pulse);
    glow.addColorStop(0, 'rgba(255,225,110,0.4)'); glow.addColorStop(1, 'rgba(255,225,110,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, pulse, 0, TAU); ctx.fill();
    // בסיס עץ
    const wood = ctx.createRadialGradient(-10, -12, 6, 0, 0, 56);
    wood.addColorStop(0, '#b98a52'); wood.addColorStop(1, '#5d3d1e');
    ctx.fillStyle = wood; ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3d2610'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(60,35,10,0.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, 49, 0.3, 2.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 51.5, 3.4, 5.6); ctx.stroke();
    // תאי דבש
    HIVE_CENTERS.forEach(([cx, cy], i) => {
      const broken = i > 0 && frac < 1 - i / 7;
      hexPath(cx, cy, hs);
      const cg = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, hs);
      if (broken) { cg.addColorStop(0, '#7a5520'); cg.addColorStop(1, '#33200a'); }
      else { cg.addColorStop(0, '#fff6c2'); cg.addColorStop(0.45, i === 0 ? '#ffb000' : '#ffc640'); cg.addColorStop(1, '#d98200'); }
      ctx.fillStyle = cg; ctx.fill();
      ctx.lineWidth = 2.6; ctx.strokeStyle = '#8a5200'; ctx.stroke();
      if (broken) {
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - hs * 0.6, cy - hs * 0.2); ctx.lineTo(cx - hs * 0.1, cy + hs * 0.1); ctx.lineTo(cx + hs * 0.1, cy - hs * 0.4);
        ctx.moveTo(cx - hs * 0.1, cy + hs * 0.1); ctx.lineTo(cx + hs * 0.5, cy + hs * 0.5);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.ellipse(cx - hs * 0.28, cy - hs * 0.38, hs * 0.3, hs * 0.13, -0.5, 0, TAU); ctx.fill();
      }
    });
    // פתח הכוורת
    ctx.fillStyle = '#2a1600';
    ctx.beginPath(); ctx.ellipse(0, hs * 0.15, hs * 0.42, hs * 0.3, 0, 0, TAU); ctx.fill();
    // טיפות דבש
    if (frac > 0.25) {
      ctx.fillStyle = '#ffb300';
      for (let i = 0; i < 3; i++) {
        const dx = -22 + i * 22, len = 4 + 3 * Math.sin(animT * 1.3 + i * 2);
        ctx.beginPath(); ctx.ellipse(dx, 41 + len * 0.5, 2.6, 3 + len * 0.6, 0, 0, TAU); ctx.fill();
      }
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

  // --- נוף: כתמים על הקרקע, פרחים מתנדנדים, צללי עננים, אבקנים ---
  function drawDecals() {
    for (const d of G.decals) {
      const f = Math.min(1, d.life / 2.5);
      if (d.kind === 'scorch') {
        const sg = ctx.createRadialGradient(d.x, d.y, d.r * 0.1, d.x, d.y, d.r);
        sg.addColorStop(0, `rgba(20,14,8,${0.6 * f})`); sg.addColorStop(1, 'rgba(20,14,8,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
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

  function drawFlora() {
    for (const f of flora) {
      const sway = Math.sin(animT * 1.4 + f.ph) * 0.18;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath(); ctx.ellipse(4, 6, f.s * 1.1, f.s * 0.5, 0, 0, TAU); ctx.fill();
      // עלים
      ctx.fillStyle = '#2f7d32';
      ctx.beginPath(); ctx.ellipse(-f.s * 0.9, f.s * 0.5, f.s * 0.8, f.s * 0.3, 0.6, 0, TAU); ctx.ellipse(f.s * 0.9, f.s * 0.6, f.s * 0.8, f.s * 0.3, -0.6, 0, TAU); ctx.fill();
      ctx.rotate(sway);
      ctx.translate(sway * f.s * 1.5, 0);
      ctx.fillStyle = f.c;
      for (let p = 0; p < f.n; p++) {
        const a = (p / f.n) * TAU;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * f.s * 0.72, Math.sin(a) * f.s * 0.72, f.s * 0.62, f.s * 0.36, a, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let p = 0; p < f.n; p += 2) {
        const a = (p / f.n) * TAU;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * f.s * 0.6, Math.sin(a) * f.s * 0.6, f.s * 0.3, f.s * 0.12, a, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = f.cc; ctx.beginPath(); ctx.arc(0, 0, f.s * 0.42, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(f.s * 0.08, f.s * 0.1, f.s * 0.25, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawClouds(strength) {
    if (strength <= 0.02) return;
    for (let i = 0; i < 3; i++) {
      const span = W + 700;
      const cx = ((animT * (14 + i * 5) + hash(i, 1) * span) % span) - 350;
      const cy = H * (0.2 + 0.3 * i) + Math.sin(animT * 0.1 + i) * 30;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1.7, 1);
      const cg = ctx.createRadialGradient(0, 0, 20, 0, 0, 190);
      cg.addColorStop(0, `rgba(0,25,10,${0.16 * strength})`); cg.addColorStop(1, 'rgba(0,25,10,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 190, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawMotes(dark) {
    // אבקנים ביום, גחליליות בלילה
    const night = Math.min(1, dark * 4);
    for (let i = 0; i < 26; i++) {
      const fx = W * (0.5 + 0.5 * Math.sin(animT * (0.07 + hash(i, 2) * 0.08) + i * 7.3));
      const fy = H * (0.5 + 0.5 * Math.cos(animT * (0.06 + hash(i, 3) * 0.08) + i * 3.1));
      const tw = 0.5 + 0.5 * Math.sin(animT * 3 + i * 1.3);
      if (night > 0.3) {
        ctx.fillStyle = `rgba(215,255,120,${(0.25 * tw * night).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(fx, fy, 8, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(240,255,170,${((0.4 + 0.6 * tw) * night).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(fx, fy, 2.3, 0, TAU); ctx.fill();
      } else if (i % 2 === 0) {
        ctx.fillStyle = `rgba(255,250,200,${(0.25 + 0.3 * tw).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, TAU); ctx.fill();
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
    L.clearRect(0, 0, lw, lh);
    L.fillStyle = `rgba(5,8,40,${dark.toFixed(3)})`;
    L.fillRect(0, 0, lw, lh);
    L.globalCompositeOperation = 'destination-out';
    L.setTransform(k2, 0, 0, k2, 0, 0);
    const hole = (x, y, r, a) => {
      const g = L.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = g; L.beginPath(); L.arc(x, y, r, 0, TAU); L.fill();
    };
    const Hv = G.hive, P = G.player;
    hole(Hv.x, Hv.y, 255 + Math.sin(animT * 2) * 8, 0.95);
    hole(P.x, P.y, 175, 0.9);
    for (const h of G.helpers) hole(h.x, h.y, 70, 0.6);
    for (let i = 0; i < G.stingers.length && i < 40; i++) hole(G.stingers[i].x, G.stingers[i].y, 38, 0.55);
    for (let i = 0; i < G.shots.length && i < 60; i++) hole(G.shots[i].x, G.shots[i].y, 46, 0.6);
    for (const p of G.pickups) hole(p.x, p.y, p.kind === 'honey' ? 30 : 55, 0.5);
    for (const r of G.rings) hole(r.x, r.y, r.r + 50, 0.8);
    for (const e of G.enemies) {
      if (e.boss) hole(e.x, e.y, e.r * 2.6, 0.55);
      else if (e.def.bomb) hole(e.x, e.y, 48, 0.35 + 0.3 * Math.sin(e.t * 14));
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(lightCv, 0, 0, canvas.width, canvas.height);
  }

  function drawRain(amount) {
    const n = Math.floor(110 * amount);
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
    for (let i = 0; i < Math.floor(14 * amount); i++) {
      const tt = animT * 1.3 + hash(i, 5) * 9;
      const ph = tt % 1, cell = Math.floor(tt);
      ctx.strokeStyle = `rgba(210,230,255,${(0.32 * (1 - ph)).toFixed(2)})`;
      ctx.beginPath(); ctx.ellipse(hash(i + cell * 13, 7) * W, hash(i + cell * 17, 9) * H, 3 + ph * 11, 1.5 + ph * 5, 0, 0, TAU); ctx.stroke();
    }
  }

  function drawSparkle(x, y, s, a) {
    ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (bg) ctx.drawImage(bg, 0, 0);
    else { ctx.fillStyle = '#4c8a34'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (G && G.tint[3] > 0.005) {
      const t = G.tint;
      ctx.fillStyle = `rgba(${t[0] | 0},${t[1] | 0},${t[2] | 0},${t[3].toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const k = scale * dpr;
    const sx = shake ? rand(-shake, shake) * k * 0.5 : 0, sy = shake ? rand(-shake, shake) * k * 0.5 : 0;
    const world = () => ctx.setTransform(k, 0, 0, k, sx, sy);
    world();
    const dark = G ? G.dark : 0;

    if (G) drawDecals();
    drawFlora();
    drawClouds(1 - Math.min(1, dark * 2.5));

    if (!G) {
      // סצנת רקע לתפריט
      drawHive(menuHive);
      drawMenuBees();
      drawMotes(0);
      return;
    }
    const P = G.player;

    drawHive(G.hive);

    // דבש וחפצים
    for (const p of G.pickups) {
      const bob = Math.sin(p.t * 5) * 2;
      if (p.life < 3 && Math.floor(p.life * 8) % 2 === 0) continue;
      const py = p.y + bob;
      if (p.kind === 'honey') {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 8, 6, 2.5, 0, 0, TAU); ctx.fill();
        const hg = ctx.createRadialGradient(p.x - 2, py - 3, 0.5, p.x, py, 8);
        hg.addColorStop(0, '#fff3b0'); hg.addColorStop(0.5, '#ffb300'); hg.addColorStop(1, '#c97700');
        hexPath(p.x, py, 7.5);
        ctx.fillStyle = hg; ctx.fill();
        ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 1.3; ctx.stroke();
        const tw = Math.sin(p.t * 4);
        if (tw > 0.3) drawSparkle(p.x + 4, py - 5, 3 + tw * 2, tw);
      } else if (p.kind === 'heart') {
        ctx.fillStyle = 'rgba(255,120,150,0.3)';
        ctx.beginPath(); ctx.arc(p.x, py, 15 + Math.sin(p.t * 6) * 2, 0, TAU); ctx.fill();
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
        const pg = ctx.createRadialGradient(p.x - 4, py - 5, 1, p.x, py, 15);
        pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.5, pc); pg.addColorStop(1, shade(pc, -0.35));
        ctx.fillStyle = pg; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, py, 14, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(pi, p.x, py + 1);
      }
    }

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
      drawInsect(c.x, c.y, c.ang, c.r, c.def, 0, enemyOpts(c, { alpha: f, scale: 0.55 + 0.45 * f }));
    }

    // אויבים
    for (const e of G.enemies) {
      const c = e.def;
      if (e.boss) {
        // הילת בוס
        const col = e.phase2 ? '#ff2a2a' : c.body;
        const ar = e.r * (2 + 0.15 * Math.sin(animT * 4));
        const ag = ctx.createRadialGradient(e.x, e.y, e.r * 0.4, e.x, e.y, ar);
        ag.addColorStop(0, hexA(col, 0.45)); ag.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(e.x, e.y, ar, 0, TAU); ctx.fill();
        if (e.mode === 'windup') {
          ctx.strokeStyle = 'rgba(255,40,40,0.65)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
          ctx.lineDashOffset = -animT * 60;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.ang) * 500, e.y + Math.sin(e.ang) * 500); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // צל (החרק מרחף מעל הקרקע)
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(e.x + 5, e.y + e.r * 0.9, e.r * 0.9, e.r * 0.36, 0, 0, TAU); ctx.fill();
      drawInsect(e.x, e.y, e.ang, e.r, c, e.t, enemyOpts(e, { flash: e.flash > 0 }));
      if (c.bomb) {
        const ba = 0.35 + 0.35 * Math.sin(e.t * 14);
        ctx.strokeStyle = `rgba(255,60,30,${ba.toFixed(2)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, TAU); ctx.stroke();
      }
      if (G.buffs.freeze > 0) {
        ctx.fillStyle = 'rgba(150,210,255,0.4)';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.15, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(230,245,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
      }
      if (!e.boss && e.hp < e.maxHp) {
        const w = e.r * 1.8;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(e.x - w / 2 - 1, e.y - e.r - 11, w + 2, 6);
        ctx.fillStyle = '#ff5252'; ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }

    // חצים שמסמנים צרעות שעוד מחוץ למסך
    const topM = 84 / scale;
    for (const e of G.enemies) {
      if (e.x >= 0 && e.x <= W && e.y >= 0 && e.y <= H) continue;
      const ax = clamp(e.x, 16, W - 16), ay = clamp(e.y, topM, H - 16);
      const aa = Math.atan2(e.y - ay, e.x - ax);
      const danger = e.boss || e.def.bomb;
      const sz = e.boss ? 16 : danger ? 11 : 8;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(aa);
      ctx.fillStyle = danger ? 'rgba(255,60,40,0.92)' : 'rgba(255,205,70,0.88)';
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.6, sz * 0.7); ctx.lineTo(-sz * 0.6, -sz * 0.7); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // יריות אויב – עם זוהר
    for (const s of G.shots) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexA(s.color, 0.28);
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.3, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(s.x - 2, s.y - 2, s.r * 0.35, 0, TAU); ctx.fill();
    }

    // עוקצים – שובל זוהר
    ctx.lineCap = 'round';
    for (const s of G.stingers) {
      const len = s.small ? 16 : 26;
      const tx = s.x - Math.cos(s.ang) * len, ty = s.y - Math.sin(s.ang) * len;
      const lg = ctx.createLinearGradient(tx, ty, s.x, s.y);
      lg.addColorStop(0, 'rgba(255,235,130,0)'); lg.addColorStop(1, 'rgba(255,255,225,0.95)');
      ctx.strokeStyle = lg; ctx.lineWidth = s.small ? 2.5 : 3.8;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,240,150,0.3)';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.small ? 5 : 8, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#3b2400';
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.8, 0, TAU); ctx.fill();
    }

    // דבורות עזר
    for (const h of G.helpers) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(h.x + 3, h.y + 9, 7, 3, 0, 0, TAU); ctx.fill();
      drawInsect(h.x, h.y, h.aim, 9, HELPER_COLORS, animT + h.ang, { fuzzy: true, key: 'helper' });
    }

    // השחקנית
    if (state !== 'dying' || G.deathReason.includes('hive')) {
      if (!(P.inv > 0 && Math.floor(P.inv * 14) % 2 === 0)) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(P.x + 5, P.y + 15, 12, 5, 0, 0, TAU); ctx.fill();
        drawInsect(P.x, P.y, P.ang, 16, BEE_COLORS, animT, { fuzzy: true, key: 'bee' });
      }
      if (G.buffs.rapid > 0) {
        ctx.strokeStyle = `rgba(255,220,80,${0.5 + 0.3 * Math.sin(animT * 20)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(P.x, P.y, 23, animT * 6, animT * 6 + 1.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(P.x, P.y, 23, animT * 6 + Math.PI, animT * 6 + Math.PI + 1.6); ctx.stroke();
      }
      if (G.buffs.shield > 0) {
        const blink = G.buffs.shield < 1.5 && Math.floor(G.buffs.shield * 8) % 2 === 0;
        if (!blink) {
          const sg = ctx.createRadialGradient(P.x - 6, P.y - 8, 2, P.x, P.y, 28);
          sg.addColorStop(0, 'rgba(255,255,255,0.3)'); sg.addColorStop(0.7, 'rgba(77,208,225,0.12)'); sg.addColorStop(1, 'rgba(77,208,225,0.4)');
          ctx.fillStyle = sg; ctx.strokeStyle = 'rgba(160,235,245,0.95)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(P.x, P.y, 27, 0, TAU); ctx.fill(); ctx.stroke();
        }
      }
      // טבעת קטנה כשגל הזמזום מוכן
      if (G.player.pulseCd <= 0 && state === 'playing') {
        ctx.strokeStyle = 'rgba(255,240,150,0.28)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(P.x, P.y, 22 + Math.sin(animT * 6) * 2, 0, TAU); ctx.stroke();
      }
    }

    // חלקיקים
    for (const p of G.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max) * (p.a || 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawMotes(dark);

    // חושך ותאורה בשלבי הלילה
    const flash = Math.max(0, G.flash);
    if (dark > 0.02) {
      drawLighting(dark * (1 - Math.min(1, flash)));
      world();
      // אור חם מהכוורת
      ctx.globalCompositeOperation = 'lighter';
      const wg = ctx.createRadialGradient(G.hive.x, G.hive.y, 30, G.hive.x, G.hive.y, 210);
      wg.addColorStop(0, `rgba(255,180,70,${(0.38 * dark).toFixed(3)})`); wg.addColorStop(1, 'rgba(255,180,70,0)');
      ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(G.hive.x, G.hive.y, 210, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    if (G.rain > 0.02) drawRain(G.rain);

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
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const ox = joy.ox / scale, oy = joy.oy / scale;
      let dx = (joy.x - joy.ox) / scale, dy = (joy.y - joy.oy) / scale;
      const max = 55 / scale, d = Math.hypot(dx, dy);
      if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ox, oy, max, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,100,0.7)';
      ctx.beginPath(); ctx.arc(ox + dx, oy + dy, 22 / scale, 0, TAU); ctx.fill();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const cw = canvas.width, ch = canvas.height;
    // הבזק ברק
    if (flash > 0.01) { ctx.fillStyle = `rgba(225,235,255,${Math.min(0.45, flash * 0.4).toFixed(2)})`; ctx.fillRect(0, 0, cw, ch); }
    // מסגרת אדומה: כשהדבורה נפגעת או כשהכוורת בסכנה
    const hiveLow = G.hive.hp / G.hive.maxHp < 0.3 && state === 'playing' ? 0.22 + 0.12 * Math.sin(animT * 6) : 0;
    const va = Math.max(Math.max(0, G.hurtFlash) * 1.4, hiveLow);
    if (va > 0.01) {
      const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
      vg.addColorStop(0, 'rgba(255,0,0,0)');
      vg.addColorStop(1, `rgba(255,20,20,${Math.min(0.6, va).toFixed(2)})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);
    }
  }

  // סצנת התפריט: כוורת במרכז ודבורים וצרעות שחגות סביבה
  const menuHive = { x: 0, y: 0, r: 46, hp: 1, maxHp: 1, hitT: 0 };
  const menuBees = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * TAU, r: rand(150, 320), s: rand(0.3, 0.7) * (i % 2 ? 1 : -1), wasp: i % 3 === 0 }));
  function drawMenuBees() {
    menuBees.forEach((b) => {
      b.a += b.s * 0.016;
      const x = W / 2 + Math.cos(b.a) * b.r * (W / H > 1 ? 1.6 : 0.9);
      const y = H / 2 + Math.sin(b.a) * b.r;
      const ang = b.a + (b.s > 0 ? Math.PI / 2 : -Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(x + 5, y + 14, 11, 4.5, 0, 0, TAU); ctx.fill();
      if (b.wasp) drawInsect(x, y, ang, 15, ETYPES.wasp, animT + b.a, { wasp: true, key: 'wasp' });
      else drawInsect(x, y, ang, 13, BEE_COLORS, animT + b.a, { fuzzy: true, key: 'bee' });
    });
  }

  // ---------------- לולאה ראשית ----------------
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000 || 0));
    lastTime = now;
    animT += dt;
    stateTimer += dt;

    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0 || state === 'menu') $('banner').classList.add('hidden');
    }

    try {
      if (G) {
        if (state === 'playing') {
          for (let i = 0; i < timeScale && state === 'playing'; i++) update(dt);
          Sound.music(G.boss ? 1 : Math.min(1, G.level / 10));
        }
        if (state === 'clear') {
          update(dt);
          if (stateTimer > 1.8) afterClear();
        }
        if (state === 'dying') {
          if (stateTimer > 1.6) endGame(false);
        }
        if (state !== 'paused' && state !== 'upgrade' && state !== 'over') updateEffects(dt);
        updateHud();
      }
      draw();
    } catch (err) {
      console.error(err);
    }
  }

  // ---------------- חיבור כפתורים ----------------
  function on(id, fn) {
    $(id).addEventListener('click', (e) => { Sound.init(); Sound.play('click'); fn(e); });
  }
  on('btnStart', () => {
    if (!store.get(STORY_KEY, false)) showScreen('story'); // בפעם הראשונה מספרים את האגדה
    else startGame();
  });
  on('btnStory', () => showScreen('story'));
  on('btnStoryGo', () => { store.set(STORY_KEY, true); startGame(); });
  document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => {
    Sound.init(); Sound.play('click');
    diffKey = b.dataset.diff; store.set(DIFF_KEY, diffKey); updateDiffButtons();
  }));
  on('btnHowto', () => showScreen('howto'));
  on('btnScores', () => { renderScores($('scoresTable'), null); showScreen('scores'); });
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { Sound.play('click'); showScreen('menu'); }));
  on('btnClearScores', () => {
    if (confirm('Delete all high scores?')) { store.set(SCORES_KEY, []); renderScores($('scoresTable'), null); }
  });
  ['btnMuteMenu', 'btnMutePause', 'btnMuteHud'].forEach((id) => $(id).addEventListener('click', () => { Sound.init(); Sound.setMuted(!Sound.muted); Sound.play('click'); $(id).blur(); }));
  on('btnPause', () => { pauseGame(); $('btnPause').blur(); });
  on('btnResume', resumeGame);
  on('btnQuit', toMenu);
  on('btnAgain', startGame);
  on('btnEndless', continueEndless);
  on('btnContinue', continueRun);
  on('btnMenu', toMenu);
  on('btnSaveScore', saveScoreFromInput);
  $('buyHive').addEventListener('click', () => {
    if (G.honey < HIVE_COST) { Sound.play('denied'); return; }
    G.honey -= HIVE_COST; G.hive.hp = Math.min(G.hive.maxHp, G.hive.hp + 50); Sound.play('buy'); refreshShop();
  });
  $('buyBee').addEventListener('click', () => {
    if (G.honey < BEE_COST) { Sound.play('denied'); return; }
    G.honey -= BEE_COST; G.player.hp = Math.min(G.stats.maxHp, G.player.hp + 40); Sound.play('buy'); refreshShop();
  });
  const pulseBtn = $('btnPulse');
  pulseBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sound.init(); if (state === 'playing') firePulse(); });
  pulseBtn.addEventListener('click', (e) => e.preventDefault());
  const dashBtn = $('btnDash');
  dashBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sound.init(); if (state === 'playing') doDash(); });
  dashBtn.addEventListener('click', (e) => e.preventDefault());

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  resize();
  updateMuteButtons();
  updateDiffButtons();
  showScreen('menu');
  requestAnimationFrame((t) => { lastTime = t; frame(t); });

  // גישה לבדיקות אוטומטיות בלבד
  window.__hive = {
    get G() { return G; }, get state() { return state; },
    set timeScale(v) { timeScale = Math.max(1, Math.min(20, v | 0)); },
    startGame, startLevel, spawnBoss, spawnEnemy, continueRun, firePulse, doDash, levelPlan, UPGRADES,
  };
})();
