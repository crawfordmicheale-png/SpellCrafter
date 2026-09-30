// All sound is synthesized with the Web Audio API, so there are no files to load.
// Browsers only allow audio after the player interacts, so call unlock() from a click.

let ctx = null, master = null, sfxBus = null, ambBus = null;
let enabled = true;
let ambient = null;

export function setEnabled(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05);
}
export const isEnabled = () => enabled;

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { ctx = new AC(); } catch { ctx = null; return; }
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  master = ctx.createGain();
  master.gain.value = enabled ? 0.9 : 0;
  master.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = 0.5; ambBus.connect(master);
}

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

// A short enveloped tone.
function tone({ freq = 440, to = null, type = 'sine', dur = 0.15, vol = 0.2, at = 0, bus = sfxBus, attack = 0.005 }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// A burst of filtered noise.
function hiss({ dur = 0.1, vol = 0.2, type = 'bandpass', freq = 1000, to = null, q = 1, at = 0 }) {
  const t = ctx.currentTime + at;
  const src = noise();
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

let stepAlt = false;
const SFX = {
  step() {
    stepAlt = !stepAlt;
    hiss({ dur: 0.05, vol: 0.05, freq: stepAlt ? 700 : 560, q: 2 });
  },
  pickup() {
    tone({ freq: 880, type: 'triangle', dur: 0.09, vol: 0.12 });
    tone({ freq: 1320, type: 'triangle', dur: 0.14, vol: 0.1, at: 0.07 });
  },
  chest() {
    hiss({ dur: 0.18, vol: 0.12, type: 'lowpass', freq: 600 });
    [660, 880, 1100].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.2, vol: 0.08, at: 0.1 + i * 0.06 }));
  },
  cast() {
    hiss({ dur: 0.2, vol: 0.14, freq: 500, to: 2600, q: 3 });
  },
  hit() {
    tone({ freq: 140, to: 50, type: 'sine', dur: 0.18, vol: 0.35 });
    hiss({ dur: 0.06, vol: 0.18, type: 'highpass', freq: 1800 });
  },
  kill() {
    tone({ freq: 220, to: 40, type: 'sawtooth', dur: 0.4, vol: 0.12 });
    hiss({ dur: 0.35, vol: 0.1, type: 'lowpass', freq: 1200, to: 200 });
  },
  block() {
    tone({ freq: 1250, type: 'square', dur: 0.08, vol: 0.05 });
    tone({ freq: 1870, type: 'sine', dur: 0.25, vol: 0.06, at: 0.01 });
  },
  hurt() {
    tone({ freq: 90, to: 45, type: 'sine', dur: 0.25, vol: 0.4 });
    hiss({ dur: 0.2, vol: 0.15, type: 'lowpass', freq: 900 });
  },
  heal() {
    [523, 659, 784].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.25, vol: 0.07, at: i * 0.07 }));
  },
  craft() {
    for (let i = 0; i < 5; i++) hiss({ dur: 0.04, vol: 0.06, type: 'highpass', freq: 3000 + i * 300, at: i * 0.045 });
    tone({ freq: 660, type: 'sine', dur: 0.5, vol: 0.08, at: 0.25 });
    tone({ freq: 990, type: 'sine', dur: 0.6, vol: 0.05, at: 0.25 });
  },
  discover() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.6, vol: 0.09, at: i * 0.09 }));
  },
  burn() {
    for (let i = 0; i < 8; i++) hiss({ dur: 0.03, vol: 0.1, type: 'highpass', freq: 2000 + Math.random() * 3000, at: i * 0.05 + Math.random() * 0.03 });
    hiss({ dur: 0.5, vol: 0.08, type: 'lowpass', freq: 500, to: 1500 });
  },
  descend() {
    hiss({ dur: 1.2, vol: 0.14, type: 'lowpass', freq: 800, to: 120 });
    tone({ freq: 65, to: 40, type: 'sine', dur: 1.3, vol: 0.25 });
  },
  encounter() {
    tone({ freq: 196, type: 'sawtooth', dur: 0.5, vol: 0.06 });
    tone({ freq: 207.7, type: 'sawtooth', dur: 0.5, vol: 0.06 });
    tone({ freq: 98, to: 70, type: 'sine', dur: 0.6, vol: 0.2 });
  },
  event() {
    [392, 466, 587].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.7, vol: 0.06, at: i * 0.12 }));
  },
  win() {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.8, vol: 0.1, at: i * 0.12 }));
  },
  lose() {
    [392, 349, 311, 262].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.8, vol: 0.1, at: i * 0.2 }));
  },
  click() {
    tone({ freq: 1400, type: 'sine', dur: 0.03, vol: 0.04 });
  },
};

export function sfx(name) {
  if (!ctx || !enabled) return;
  try { SFX[name]?.(); } catch { /* ignore audio errors */ }
}

// Ambient drone for each floor: two detuned low tones, filtered rumble, and water drips.
const DRONES = [55, 49, 43.65, 41.2];

export function startAmbient(regionIdx) {
  if (!ctx) return;
  stopAmbient();
  const base = DRONES[regionIdx] ?? 50;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2);
  out.connect(ambBus);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 260;
  lp.connect(out);
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.07; lfoGain.gain.value = 120;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();

  const oscs = [base, base * 1.498, base * 1.006].map((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = i === 1 ? 'triangle' : 'sawtooth';
    o.frequency.value = f;
    g.gain.value = i === 1 ? 0.03 : 0.05;
    o.connect(g).connect(lp);
    o.start();
    return o;
  });
  const rumble = noise();
  const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 180;
  const rg = ctx.createGain(); rg.gain.value = 0.05;
  rumble.connect(rf).connect(rg).connect(out);
  rumble.start();

  // Echoing drips.
  const delay = ctx.createDelay(); delay.delayTime.value = 0.31;
  const fb = ctx.createGain(); fb.gain.value = 0.35;
  const dripOut = ctx.createGain(); dripOut.gain.value = 0.5;
  delay.connect(fb).connect(delay);
  delay.connect(dripOut); dripOut.connect(out);
  let timer = 0;
  const drip = () => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const f = 1100 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(delay); g.connect(out);
    o.start(t); o.stop(t + 0.2);
    timer = setTimeout(drip, 2500 + Math.random() * 6000);
  };
  timer = setTimeout(drip, 1500);

  ambient = {
    stop() {
      clearTimeout(timer);
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 1);
      setTimeout(() => { [...oscs, lfo, rumble].forEach(n => { try { n.stop(); } catch { /* already stopped */ } }); out.disconnect(); }, 1200);
    },
  };
}

export function stopAmbient() {
  ambient?.stop();
  ambient = null;
}
