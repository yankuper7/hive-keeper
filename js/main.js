/* Hive Keeper – main: לולאה ראשית ואתחול */
'use strict';

// צעד לוגי אחד (בלי ציור) – משמש גם את הבדיקות האוטומטיות
function tick(dt) {
  if (!G) return;
  stateTimer += dt;
  if (state === 'playing') { update(dt); if (G && G.tut && G.tut.finished) finishTutorial(); }
  else if (state === 'clear') { update(dt); if (stateTimer > 1.8) afterClear(); }
  else if (state === 'dying') { if (stateTimer > 1.6) endGame(false); }
  if (G && state !== 'paused' && state !== 'upgrade' && state !== 'over') updateEffects(dt);
}

function musicTrack() {
  if (victoryOpen) return 'victory';
  if (!G || state === 'over') return 'menu';
  if (G.boss) return BOSS_TRACKS[G.boss.kind] || 'emperor';
  return levelTrack(G.level);
}

function frame(now) {
  requestAnimationFrame(frame);
  const raw = now - lastTime || 0;
  lastTime = now;
  const dt = Math.min(0.05, Math.max(0, raw / 1000));
  animT += dt;

  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0 || state === 'menu') $('banner').classList.add('hidden');
  }

  try {
    let gdt = dt;
    if (slowMo > 0) { slowMo -= dt; gdt *= 0.35; }
    for (let i = 0; i < timeScale; i++) tick(gdt);
    if (victoryOpen) celebrate(dt);
    updateEnv(dt, state === 'playing');
    if (state === 'playing') perfSample(raw);
    updateHud();
    // מוזיקה: רצועה משלה לכל שלב ולכל בוס, ועוצמה לפי כמות הצרעות
    Sound.setTrack(musicTrack());
    Sound.duck(state === 'paused' || state === 'upgrade');
    Sound.update(G ? clamp(0.25 + G.enemies.length / 14 + (G.boss ? 0.5 : 0), 0, 1) : 0.25);
    draw();
  } catch (err) {
    console.error(err);
  }
}

// ---------------- אתחול ----------------
bindUi();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
// סרגל הכתובת בטלפון משנה את גובה החלון – מתאימים את הקנבס רק כשהגודל באמת השתנה
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    if (window.innerWidth !== lastVw || window.innerHeight !== lastVh) resize();
  });
}

resize();
updateMuteButtons();
updateDiffButtons();
showScreen('menu');
drawLogo();
requestAnimationFrame((t) => { lastTime = t; frame(t); });

// גישה לבדיקות אוטומטיות בלבד
window.__hive = {
  get G() { return G; }, get state() { return state; },
  set timeScale(v) { timeScale = Math.max(1, Math.min(20, v | 0)); },
  tick, startGame, startLevel, spawnBoss, spawnEnemy, continueRun, firePulse, doDash, levelPlan, UPGRADES,
};
window.__tick = tick;
