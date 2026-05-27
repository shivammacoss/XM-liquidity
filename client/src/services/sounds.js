/**
 * XMLiquidity — Trading Sound Effects
 * Generated via Web Audio API — no external files needed.
 * Clean, professional, bass-rich trading sounds.
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.3, rampDown = true) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    if (rampDown) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch { /* Audio not available */ }
}

function playChord(freqs, duration, type = 'sine', volume = 0.15) {
  freqs.forEach(f => playTone(f, duration, type, volume));
}

// ==========================================
// TRADING SOUNDS
// ==========================================

/** BUY order executed — rising two-tone, confident */
export function soundBuy() {
  const ctx = getCtx();
  // Low bass hit + rising tone
  playTone(120, 0.15, 'sine', 0.4, true);
  setTimeout(() => playTone(440, 0.12, 'sine', 0.25), 50);
  setTimeout(() => playTone(660, 0.15, 'sine', 0.2), 120);
}

/** SELL order executed — descending two-tone */
export function soundSell() {
  playTone(120, 0.15, 'sine', 0.4);
  setTimeout(() => playTone(520, 0.12, 'sine', 0.25), 50);
  setTimeout(() => playTone(380, 0.15, 'sine', 0.2), 120);
}

/** Trade CLOSED — short clean click */
export function soundClose() {
  playTone(800, 0.06, 'sine', 0.2);
  setTimeout(() => playTone(600, 0.08, 'sine', 0.15), 40);
}

/** PROFIT close — satisfying ascending chord */
export function soundProfit() {
  playTone(100, 0.2, 'sine', 0.35); // Bass
  setTimeout(() => {
    playChord([523, 659, 784], 0.3, 'sine', 0.12); // C major chord
  }, 80);
  setTimeout(() => playTone(1047, 0.2, 'sine', 0.1), 200); // High C
}

/** LOSS close — low descending tone */
export function soundLoss() {
  playTone(80, 0.25, 'sine', 0.35); // Deep bass
  setTimeout(() => playTone(220, 0.15, 'sine', 0.2), 50);
  setTimeout(() => playTone(165, 0.2, 'sine', 0.15), 130);
}

/** CANCEL order — quick double tap */
export function soundCancel() {
  playTone(400, 0.05, 'square', 0.1);
  setTimeout(() => playTone(300, 0.05, 'square', 0.1), 80);
}

/** STOP LOSS hit — warning deep bass */
export function soundStopLoss() {
  playTone(60, 0.3, 'sine', 0.4);
  setTimeout(() => playTone(80, 0.2, 'triangle', 0.3), 100);
  setTimeout(() => playTone(60, 0.3, 'sine', 0.25), 250);
}

/** TAKE PROFIT hit — bright ascending */
export function soundTakeProfit() {
  playTone(100, 0.15, 'sine', 0.3);
  setTimeout(() => playChord([523, 659, 784], 0.25, 'sine', 0.15), 60);
  setTimeout(() => playTone(1047, 0.3, 'sine', 0.12), 180);
}

/** Button click — subtle tick */
export function soundClick() {
  playTone(1200, 0.03, 'sine', 0.08);
}

/** Notification — gentle ping */
export function soundNotification() {
  playTone(880, 0.1, 'sine', 0.15);
  setTimeout(() => playTone(1100, 0.15, 'sine', 0.1), 100);
}

/** Error — low buzz */
export function soundError() {
  playTone(150, 0.15, 'square', 0.12);
  setTimeout(() => playTone(120, 0.15, 'square', 0.1), 100);
}

/** Close ALL positions — deep rumble + confirmation */
export function soundCloseAll() {
  playTone(60, 0.4, 'sine', 0.4);
  setTimeout(() => playTone(100, 0.2, 'sine', 0.3), 100);
  setTimeout(() => playTone(440, 0.15, 'sine', 0.15), 250);
  setTimeout(() => playTone(550, 0.2, 'sine', 0.12), 320);
}
