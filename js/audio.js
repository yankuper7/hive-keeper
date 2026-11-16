/* Hive Keeper – audio: צלילים ומוזיקה מסונתזים בקוד (בלי קבצים) */
'use strict';

// סולמות (חצאי טונים מהשורש)
const SCALES = {
  maj: [0, 2, 4, 5, 7, 9, 11],
  min: [0, 2, 3, 5, 7, 8, 10],
  dor: [0, 2, 3, 5, 7, 9, 10],
  phr: [0, 1, 3, 5, 7, 8, 10],
};

// רצועות מוזיקה. כל תיבה = 16 צעדים.
// bass: 1=שורש 3=טרצה 5=קווינטה 8=אוקטבה · arp: 0..3 צליל באקורד · lead: דרגה בסולם (בסיס 36), '-' = המשך
const TRACKS = {
  menu: {
    bpm: 84, root: 41, scale: 'maj', prog: [0, 5, 3, 4], min: 0.2, max: 0.3,
    bass: '1.......5.......', arp: '0.1.2.1.3.2.1.2.', arpWave: 'sine', leadWave: 'triangle',
    kick: '................', snare: '................', hat: '................',
    form: [-1, 0, -1, 1],
    lead: [['4-------2---1---', '2-------0-------', '3---4---5---4---', '4-------2-------'],
           ['7-------5---4---', '5-------4---2---', '3---5---7---5---', '4---------------']],
  },
  meadow: {
    bpm: 112, root: 36, scale: 'maj', prog: [0, 4, 5, 3],
    bass: '1...1.5.1...5.8.', arp: '0.2.1.2.3.2.1.2.', arpWave: 'triangle', leadWave: 'square',
    kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx',
    form: [0, 0, 1, 0],
    lead: [['4---4-5-7---5-4-', '4-----2-1---2---', '5---5-7-9---7-5-', '7-----5-4---3-4-'],
           ['7-8-9---7-8-9---', '8---b---9-8-----', '9-8-7---5-7-9---', '8-----7-7-------']],
  },
  golden: {
    bpm: 118, root: 43, scale: 'maj', prog: [0, 5, 3, 4],
    bass: '1.1.5.1.1.1.5.3.', arp: '0.1.2.3.2.1.0.1.', arpWave: 'triangle', leadWave: 'square',
    kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: '..x...x...x...x.',
    form: [0, 0, 1, 0],
    lead: [['0-2-4---2-4-7---', '9---7---5-4-2---', '3-5-7---5-7-a---', '8---6---4-------'],
           ['7---7-9-7---4---', '5---5-7-9---7---', 'a---9-7-5---7---', '8-----6-8-------']],
  },
  sunset: {
    bpm: 100, root: 45, scale: 'min', prog: [0, 5, 2, 6],
    bass: '1.....5.1...5...', arp: '0..1..2..3..2.1.', arpWave: 'sine', leadWave: 'triangle',
    kick: 'x.........x.....', snare: '........x.......', hat: '....x.......x...',
    form: [0, -1, 1, -1],
    lead: [['4-----2-4---7---', '5-----4-2---0---', '2---4---6---4---', '6-----4-1-------'],
           ['7---9---7---4---', '5---7---9---7---', '9---8---6---4---', '6-----8-6-------']],
  },
  autumn: {
    bpm: 106, root: 38, scale: 'dor', prog: [0, 3, 6, 0],
    bass: '1..1..1.5..5..3.', arp: '0.2.1.3.0.2.1.3.', arpWave: 'triangle', leadWave: 'triangle',
    kick: 'x..x..x...x.....', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.',
    form: [0, 0, 1, -1],
    lead: [['0---2-4---2-0---', '3---5-7---5-3---', '6---4-1---4-6---', '4-----2-0-------'],
           ['7-----4-7---9---', '8-----7-5---3---', '6---8-a---8-6---', '7-----4-0-------']],
  },
  storm: {
    bpm: 126, root: 40, scale: 'min', prog: [0, 0, 5, 6],
    bass: '1.1.1.1.1.1.1.8.', arp: '0.2.3.2.0.2.3.2.', arpWave: 'square', leadWave: 'sawtooth',
    kick: 'x...x...x...x...', snare: '....x.......x.x.', hat: 'x.xxx.xxx.xxx.xx',
    form: [-1, 0, 1, 0],
    lead: [['4---4-6-7---6-4-', '4---2---0-------', '5---5-7-9---7-5-', '8---6---4-------'],
           ['7-9-b---9-7-6---', '7-----6-4-------', '9-7-5---7-9-c---', 'd---b---8-------']],
  },
  frost: {
    bpm: 92, root: 47, scale: 'min', prog: [0, 5, 3, 4],
    bass: '1.......1.....5.', arp: '0.2.3.2.1.2.3.2.', arpWave: 'sine', leadWave: 'sine', arpOct: 3,
    kick: 'x.......x.......', snare: '................', hat: '....x.......x...',
    form: [0, -1, 1, -1],
    lead: [['4-------7---6---', '4-------2-------', '3-------4---6---', '4-------1-------'],
           ['9-------7---6---', '7-------5---4---', '6-------4---3---', '4---------------']],
  },
  ember: {
    bpm: 134, root: 36, scale: 'phr', prog: [0, 0, 1, 6],
    bass: '1.11..1.1.11..5.', arp: '0.3.2.3.0.3.2.3.', arpWave: 'square', leadWave: 'sawtooth',
    kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    form: [0, 1, 0, -1],
    lead: [['7---6-4---2-4---', '7---6-4---2-0---', '8---7-5---3-5---', '6---4-3---1-----'],
           ['4.4.7.4.4.4.7.4.', '2.2.4.2.2.2.4.2.', '5.5.8.5.5.5.8.5.', '6.6.8.6.a---8---']],
  },
  boss: {
    bpm: 146, root: 38, scale: 'min', prog: [0, 5, 6, 4], min: 0.8,
    bass: '1.1.8.1.1.1.8.1.', arp: '0.2.3.2.0.2.3.2.', arpWave: 'square', leadWave: 'square',
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    form: [0, 1, 0, 1],
    lead: [['7-----7-9---7---', '9-----7-5-------', '8-----8-a---8---', '8-----6-4-------'],
           ['4.7.9.7.4.7.9.7.', '5.7.9.7.5.7.9.7.', '6.8.a.8.6.8.a.8.', '4.6.8.6.b-------']],
  },
};

const SFX_GAIN = 2.6, MUSIC_GAIN = 1.3;

const Sound = {
  ctx: null, master: null, sfxBus: null, musicBus: null, musicLP: null, echo: null, ambGain: null, ambFilter: null,
  noiseBuf: null,
  muted: !!store.get(MUTE_KEY, false),
  last: {},
  track: null, pending: null, step: 0, nextT: 0, intensity: 0.3, ducked: false, amb: 'none',

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) { /* ignore */ } }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const c = this.ctx = new AC();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = settings.sfx * SFX_GAIN; this.sfxBus.connect(this.master);
      this.musicLP = c.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 18000; this.musicLP.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.gain.value = settings.music * MUSIC_GAIN; this.musicBus.connect(this.musicLP);
      // הד עדין למנגינה
      const delay = c.createDelay(1); delay.delayTime.value = 0.31;
      const fb = c.createGain(); fb.gain.value = 0.3;
      const wet = c.createGain(); wet.gain.value = 0.35;
      this.echo = c.createGain(); this.echo.gain.value = 1;
      this.echo.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.musicBus);
      // רעש לבן לתופים, פיצוצים ואווירה
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // אווירה: רוח / גשם / אש
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      this.ambFilter = c.createBiquadFilter(); this.ambFilter.type = 'bandpass'; this.ambFilter.frequency.value = 500; this.ambFilter.Q.value = 0.6;
      this.ambGain = c.createGain(); this.ambGain.gain.value = 0;
      src.connect(this.ambFilter); this.ambFilter.connect(this.ambGain); this.ambGain.connect(this.sfxBus);
      src.start();
      this.setAmbience(this.amb, true);
    } catch (e) { this.ctx = null; }
  },

  setMuted(m) {
    this.muted = m;
    store.set(MUTE_KEY, m);
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.03);
    if (typeof updateMuteButtons === 'function') updateMuteButtons();
  },
  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(settings.sfx * SFX_GAIN, t, 0.03);
    this.musicBus.gain.setTargetAtTime(settings.music * MUSIC_GAIN, t, 0.03);
  },
  // כשהמשחק מושהה המוזיקה נשמעת "מאחורי קיר"
  duck(on) {
    if (this.ducked === on) return;
    this.ducked = on;
    if (this.musicLP) this.musicLP.frequency.setTargetAtTime(on ? 520 : 18000, this.ctx.currentTime, 0.12);
  },
  setAmbience(kind, force) {
    if (this.amb === kind && !force) return;
    this.amb = kind;
    if (!this.ctx) return;
    const cfg = { none: [500, 0], wind: [380, 0.05], rain: [2600, 0.075], fire: [220, 0.07], night: [900, 0.012] }[kind] || [500, 0];
    const t = this.ctx.currentTime;
    this.ambFilter.frequency.setTargetAtTime(cfg[0], t, 0.5);
    this.ambGain.gain.setTargetAtTime(cfg[1], t, 0.8);
  },
  suspend() { if (this.ctx && this.ctx.state === 'running') { try { this.ctx.suspend(); } catch (e) { /* ignore */ } } },

  // --- אבני בניין ---
  out(node, dest, pan) {
    const c = this.ctx;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
      node.connect(p); p.connect(dest);
    } else node.connect(dest);
  },
  tone(f, dur, type = 'square', vol = 0.1, slide = null, delay = 0, o = null) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    this.voice((o && o.dest) || this.sfxBus, f, t, dur, type, vol, slide, o);
  },
  voice(dest, f, t, dur, type, vol, slide, o) {
    const c = this.ctx;
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    if (o && o.detune) osc.detune.value = o.detune;
    const att = (o && o.attack) || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + att);
    if (o && o.hold) g.gain.setValueAtTime(vol, t + Math.max(att, dur * o.hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o && o.lp) {
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; fl.Q.value = o.q || 0.7;
      osc.connect(fl); node = fl;
    }
    node.connect(g);
    this.out(g, dest, o && o.pan);
    if (o && o.echo && this.echo) { const s = c.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(this.echo); }
    osc.start(t); osc.stop(t + dur + 0.05);
  },
  noise(dur, vol, freq = 1200, delay = 0, o = null) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    this.nvoice((o && o.dest) || this.sfxBus, t, dur, vol, freq, o);
  },
  nvoice(dest, t, dur, vol, freq, o) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = (o && o.type) || 'lowpass'; fl.frequency.setValueAtTime(freq, t);
    if (o && o.sweep) fl.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    if (o && o.q) fl.Q.value = o.q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g);
    this.out(g, dest, o && o.pan);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },

  // --- אפקטים. x = מיקום אופקי בעולם, לפיזור סטריאו ---
  play(name, x) {
    if (!this.ctx || this.muted || settings.sfx <= 0 || this.ctx.state !== 'running') return;
    const now = performance.now();
    const gap = { shoot: 70, hit: 45, hive: 280, pickup: 45, spit: 110, kill: 40, tink: 70, zap: 80, heal: 300, poison: 200, chill: 150, boom: 60 }[name] || 0;
    if (gap && this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const pan = (typeof x === 'number' && typeof W === 'number' && W > 0) ? clamp((x / W - 0.5) * 1.3, -0.8, 0.8) : 0;
    const P = pan ? { pan } : null;
    const T = (f, dur, type, vol, slide, delay, extra) => this.tone(f, dur, type, vol, slide, delay || 0, extra ? Object.assign({ pan }, extra) : P);
    const N = (dur, vol, freq, delay, extra) => this.noise(dur, vol, freq, delay || 0, extra ? Object.assign({ pan }, extra) : P);
    const seq = (notes, step, type, vol, len) => notes.forEach((f, i) => T(f, len, type, vol, null, i * step));
    const r = 0.96 + Math.random() * 0.08; // גיוון קל בגובה הצליל
    switch (name) {
      case 'shoot': T(880 * r, 0.06, 'square', 0.03, 1500); T(1760 * r, 0.03, 'sine', 0.02, 2400); break;
      case 'hit': T(330 * r, 0.07, 'triangle', 0.08, 150); N(0.04, 0.05, 3000); break;
      case 'kill': N(0.16, 0.2, 2400, 0, { sweep: 500 }); T(540 * r, 0.14, 'sawtooth', 0.045, 120); T(180, 0.1, 'sine', 0.08, 70); break;
      case 'pickup': T(1046, 0.07, 'sine', 0.07); T(1568, 0.1, 'sine', 0.055, null, 0.045); break;
      case 'heart': seq([660, 880, 1320], 0.06, 'sine', 0.1, 0.14); break;
      case 'hurt': T(260, 0.26, 'sawtooth', 0.22, 70); N(0.14, 0.2, 1200); break;
      case 'hive': T(150, 0.2, 'square', 0.06, 85); T(75, 0.22, 'sine', 0.12, 50); break;
      case 'spit': T(430 * r, 0.11, 'sine', 0.05, 190); N(0.05, 0.03, 2500); break;
      case 'pulse': T(150, 0.55, 'sawtooth', 0.12, 700, 0, { lp: 1800 }); N(0.45, 0.13, 500, 0, { sweep: 3000 }); T(60, 0.4, 'sine', 0.2, 35); break;
      case 'boss': T(88, 1.4, 'sawtooth', 0.17, 52); T(93, 1.4, 'square', 0.07, 48); N(1.0, 0.1, 300); seq([196, 185, 196, 233], 0.18, 'square', 0.06, 0.3); break;
      case 'warn': T(740, 0.12, 'square', 0.06); T(740, 0.12, 'square', 0.06, null, 0.18); break;
      case 'charge': T(190, 0.5, 'sawtooth', 0.1, 640); N(0.4, 0.05, 800, 0, { sweep: 4000 }); break;
      case 'lunge': T(520 * r, 0.16, 'sawtooth', 0.045, 1100); break;
      case 'slam': T(120, 0.25, 'square', 0.1, 50); N(0.2, 0.14, 600); break;
      case 'bossDie': N(1.3, 0.3, 1000, 0, { sweep: 120 }); T(70, 1.2, 'sine', 0.25, 30); seq([523, 659, 784, 1046, 1318], 0.11, 'square', 0.07, 0.28); break;
      case 'level': seq([523, 659, 784, 1046], 0.1, 'triangle', 0.12, 0.2); T(1568, 0.3, 'sine', 0.05, null, 0.4); break;
      case 'start': seq([392, 523, 659, 784], 0.08, 'triangle', 0.1, 0.16); break;
      case 'upgrade': T(660, 0.12, 'sine', 0.11); T(990, 0.2, 'sine', 0.11, null, 0.08); T(1320, 0.3, 'triangle', 0.06, null, 0.16); break;
      case 'legend': seq([523, 659, 784, 1046, 1318, 1568], 0.07, 'triangle', 0.1, 0.3); N(0.6, 0.04, 6000, 0, { type: 'highpass' }); break;
      case 'buy': T(880, 0.08, 'triangle', 0.1); T(1320, 0.12, 'triangle', 0.1, null, 0.06); break;
      case 'reroll': seq([500, 630, 500, 750], 0.05, 'square', 0.05, 0.07); break;
      case 'thunder': N(1.8, 0.22, 240); N(0.25, 0.14, 1800); T(50, 1.2, 'sine', 0.2, 30); break;
      case 'power': seq([523, 784, 1046, 1568], 0.05, 'square', 0.065, 0.12); break;
      case 'dash': N(0.16, 0.1, 800, 0, { sweep: 5000, type: 'bandpass', q: 1.5 }); T(700, 0.12, 'sine', 0.05, 1500); break;
      case 'boom': N(0.5, 0.28, 900, 0, { sweep: 120 }); T(110, 0.45, 'sawtooth', 0.13, 38); T(55, 0.5, 'sine', 0.22, 28); break;
      case 'crit': T(1300, 0.06, 'square', 0.05, 2000); T(2600, 0.08, 'sine', 0.03, null, 0.03); break;
      case 'combo': T(880, 0.07, 'triangle', 0.08); T(1175, 0.1, 'triangle', 0.08, null, 0.06); break;
      case 'tink': T(2100 * r, 0.05, 'square', 0.035, 1500); T(3300 * r, 0.04, 'sine', 0.03); break;
      case 'shieldBreak': N(0.25, 0.14, 3500, 0, { type: 'highpass' }); T(900, 0.25, 'triangle', 0.08, 250); break;
      case 'zap': T(1400 * r, 0.09, 'sawtooth', 0.035, 300); N(0.05, 0.05, 6000, 0, { type: 'highpass' }); break;
      case 'chill': T(1900 * r, 0.12, 'sine', 0.04, 2600); break;
      case 'poison': T(240 * r, 0.12, 'sine', 0.04, 150); break;
      case 'heal': T(520, 0.18, 'sine', 0.05, 780); T(780, 0.2, 'sine', 0.04, 1040, 0.08); break;
      case 'steal': seq([700, 560, 440], 0.06, 'square', 0.05, 0.08); break;
      case 'teleport': T(300, 0.35, 'sine', 0.1, 1800); N(0.3, 0.06, 1500, 0, { sweep: 8000, type: 'bandpass', q: 3 }); break;
      case 'beamCharge': T(180, 0.9, 'sawtooth', 0.06, 900, 0, { lp: 2500 }); break;
      case 'beam': T(95, 1.5, 'sawtooth', 0.12, 85); T(190, 1.5, 'square', 0.05, 185); N(1.5, 0.09, 2500, 0, { type: 'bandpass', q: 2 }); break;
      case 'mark': T(980, 0.07, 'square', 0.04); break;
      case 'elite': seq([330, 440, 330], 0.08, 'sawtooth', 0.05, 0.14); break;
      case 'revive': seq([392, 523, 659, 784, 1046], 0.09, 'sine', 0.12, 0.35); break;
      case 'achieve': seq([784, 988, 1175, 1568], 0.08, 'triangle', 0.1, 0.25); break;
      case 'jelly': seq([880, 1108, 1318], 0.07, 'sine', 0.09, 0.18); break;
      case 'denied': T(180, 0.15, 'square', 0.07); T(140, 0.18, 'square', 0.06, null, 0.09); break;
      case 'click': T(640, 0.04, 'square', 0.035); T(960, 0.03, 'sine', 0.03, null, 0.02); break;
      case 'over': seq([392, 330, 262, 196], 0.24, 'triangle', 0.15, 0.4); T(98, 1.2, 'sine', 0.15, null, 0.7); break;
      case 'win': seq([523, 523, 659, 784, 659, 784, 1046], 0.13, 'triangle', 0.14, 0.24); seq([262, 330, 392, 523], 0.26, 'sine', 0.1, 0.5); break;
    }
  },

  // --- מוזיקה ---
  setTrack(name) {
    if (!TRACKS[name]) return;
    this.pending = name;
    if (!this.track) { this.track = name; this.step = 0; }
  },
  midi(T, deg, oct) {
    const sc = SCALES[T.scale];
    const o = Math.floor(deg / 7), i = ((deg % 7) + 7) % 7;
    return 440 * Math.pow(2, (T.root + sc[i] + 12 * (o + (oct || 0)) - 69) / 12);
  },
  // נקראת בכל פריים; מתזמנת תווים מעט קדימה
  update(intensity) {
    const c = this.ctx;
    if (!c || c.state !== 'running' || !this.track) return;
    this.intensity += (clamp(intensity, 0, 1) - this.intensity) * 0.03;
    if (this.nextT < c.currentTime - 0.25) this.nextT = c.currentTime + 0.06;
    let guard = 0;
    while (this.nextT < c.currentTime + 0.2 && guard++ < 8) {
      // מחליפים רצועה בתחילת פעמה
      if (this.pending && this.pending !== this.track && this.step % 4 === 0) { this.track = this.pending; this.step = 0; }
      const T = TRACKS[this.track];
      if (!this.muted && settings.music > 0) this.schedStep(T, this.nextT);
      this.nextT += 60 / T.bpm / 4;
      this.step++;
    }
  },
  schedStep(T, t) {
    const s = this.step % 16, bar = Math.floor(this.step / 16);
    const sl = 60 / T.bpm / 4;
    const deg = T.prog[bar % T.prog.length];
    const I = clamp(this.intensity, T.min || 0, T.max || 1);
    const M = this.musicBus;
    // בס
    const b = T.bass[s];
    if (b !== '.') {
      const f = b === '8' ? this.midi(T, deg, 1) : this.midi(T, deg + (b === '5' ? 4 : b === '3' ? 2 : 0), 0);
      this.voice(M, f, t, sl * 2.4, 'triangle', 0.16, null, { lp: 700 });
      this.voice(M, f, t, sl * 1.6, 'square', 0.03, null, { lp: 500 });
    }
    // פד אקורדים
    if (s === 0) {
      for (let i = 0; i < 3; i++) {
        const f = this.midi(T, deg + i * 2, 1);
        this.voice(M, f, t, sl * 17, 'sawtooth', 0.022, null, { lp: 500 + I * 900, attack: 0.25, hold: 0.7, detune: i % 2 ? 7 : -7 });
      }
    }
    // ארפג׳ו
    const a = T.arp[s];
    if (a !== '.' && I >= 0.12) {
      const n = +a;
      const f = n === 3 ? this.midi(T, deg, (T.arpOct || 2) + 1) : this.midi(T, deg + n * 2, T.arpOct || 2);
      this.voice(M, f, t, sl * 1.8, T.arpWave, T.arpWave === 'square' ? 0.022 : 0.045, null, { lp: 2400, echo: 0.4 });
    }
    // מנגינה
    const sec = T.form[Math.floor(bar / 4) % T.form.length];
    if (sec >= 0) {
      const ph = T.lead[sec][bar % 4], ch = ph[s];
      if (ch !== '.' && ch !== '-') {
        let hold = 1;
        while (s + hold < 16 && ph[s + hold] === '-') hold++;
        const f = this.midi(T, parseInt(ch, 36), T.leadOct || 2);
        const w = T.leadWave;
        const vol = w === 'square' ? 0.032 : w === 'sawtooth' ? 0.03 : 0.07;
        this.voice(M, f, t, sl * (hold + 0.8), w, vol, null, { lp: 3200, attack: 0.012, hold: 0.5, echo: 0.5 });
        if (w !== 'sine') this.voice(M, f * 2, t, sl * hold, 'sine', 0.012, null, null);
      }
    }
    // תופים – נכנסים בהדרגה לפי העוצמה
    if (T.kick[s] === 'x' && I >= 0.25) {
      this.voice(M, 150, t, 0.2, 'sine', 0.3, 42, null);
      this.nvoice(M, t, 0.03, 0.06, 2000, null);
    }
    if (T.snare[s] === 'x' && I >= 0.45) {
      this.nvoice(M, t, 0.13, 0.11, 1800, { type: 'highpass' });
      this.voice(M, 200, t, 0.09, 'triangle', 0.08, 120, null);
    }
    if (T.hat[s] === 'x' && I >= 0.15) this.nvoice(M, t, 0.035, 0.03 + I * 0.025, 7500, { type: 'highpass' });
    // מעבר תופים קטן כל 8 תיבות
    if (I >= 0.6 && bar % 8 === 7 && s >= 12) this.nvoice(M, t, 0.08, 0.07 + (s - 12) * 0.015, 1500, { type: 'highpass' });
  },
};
