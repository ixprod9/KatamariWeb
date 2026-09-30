// Web Audio: synthesized sound effects plus the continuous "creak" used while stretching.

import { $ } from './dom.js';

export const audio = {
  ctx: null,
  master: null,
  bus: null,
  // Sawtooth -> bandpass -> gain, driven by the squish loop.
  creak: null, // { osc, filter, gain }
  noiseBuf: null,
  on: true,
};

// Create (or resume) the AudioContext. Must be called from a user gesture.
export function initAudio() {
  const A = audio;
  if (A.ctx) {
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return;
  }
  try {
    A.ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    return;
  }
  const ctx = A.ctx;
  A.master = ctx.createGain();
  A.master.gain.value = A.on ? .8 : 0;
  A.master.connect(ctx.destination);
  A.bus = ctx.createGain();
  A.bus.connect(A.master);

  const osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  osc.type = 'sawtooth';
  filter.type = 'bandpass';
  filter.Q.value = 7;
  gain.gain.value = 0;
  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
  lfo.frequency.value = 23;
  lfoGain.gain.value = 14;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(A.bus);
  osc.start();
  lfo.start();
  A.creak = { osc, filter, gain };

  A.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .8, ctx.sampleRate);
  const d = A.noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function tone(type, f0, f1, dur, vol, t = 0, out = audio.bus) {
  const ctx = audio.ctx;
  if (!ctx) return;
  const s = ctx.currentTime + Math.max(0, t), o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, s);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, s + dur);
  g.gain.setValueAtTime(.0001, s);
  g.gain.exponentialRampToValueAtTime(vol, s + .01);
  g.gain.exponentialRampToValueAtTime(.0001, s + dur);
  o.connect(g);
  g.connect(out);
  o.start(s);
  o.stop(s + dur + .05);
}

export function noise(dur, vol, f0, f1, type = 'highpass', t = 0, out = audio.bus) {
  const ctx = audio.ctx;
  if (!ctx) return;
  const s = ctx.currentTime + Math.max(0, t), b = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  b.buffer = audio.noiseBuf;
  f.type = type;
  f.frequency.setValueAtTime(f0, s);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, s + dur);
  g.gain.setValueAtTime(vol, s);
  g.gain.exponentialRampToValueAtTime(.0001, s + dur);
  b.connect(f);
  f.connect(g);
  g.connect(out);
  b.start(s);
  b.stop(s + dur + .02);
}

export const sfx = {
  grab() {
    tone('sine', 210, 560, .15, .33);
    tone('triangle', 1200, 1700, .06, .08, .02);
  },
  // Wobbly release sound; `a` is how far the mesh was pulled.
  boing(a) {
    const ctx = audio.ctx;
    if (!ctx) return;
    a = Math.min(a, 2.5);
    const s = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 240 + a * 60;
    l.frequency.setValueAtTime(15, s);
    l.frequency.exponentialRampToValueAtTime(6, s + .8);
    lg.gain.setValueAtTime(40 + a * 140, s);
    lg.gain.exponentialRampToValueAtTime(2, s + .8);
    l.connect(lg);
    lg.connect(o.frequency);
    g.gain.setValueAtTime(.0001, s);
    g.gain.exponentialRampToValueAtTime(.2 + Math.min(a, 1.5) * .12, s + .015);
    g.gain.exponentialRampToValueAtTime(.0001, s + .85);
    o.connect(g);
    g.connect(audio.bus);
    o.start(s);
    l.start(s);
    o.stop(s + .9);
    l.stop(s + .9);
  },
  blip() { tone('triangle', 880, 1320, .07, .1); },
  pop() {
    tone('sine', 280, 900, .1, .25);
    tone('triangle', 1400, 0, .05, .06, .06);
  },
  tok() { tone('triangle', 420 + Math.random() * 260, 0, .05, .06); },
  // Rising pitch for each item rolled up.
  pickup(n) {
    const m = Math.min(n, 24), f = 520 * Math.pow(1.0595, m % 12 + Math.floor(m / 12) * 12);
    tone('triangle', f, f * 1.5, .09, .14);
    tone('sine', f * 2, 0, .12, .06, .06);
  },
  boom() {
    noise(.7, .7, 3000, 120, 'lowpass');
    tone('sine', 140, 35, .6, .6);
    noise(.15, .25, 4000, 0, 'highpass');
  },
  jingle() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0, .2, .16, i * .07)); },
  reset() {
    tone('triangle', 900, 140, .45, .2);
    noise(.3, .08, 2500);
  },
  err() {
    tone('square', 220, 150, .2, .07);
    tone('square', 160, 110, .25, .07, .12);
  },
};

export function initSoundToggle() {
  $('sound').onchange = e => {
    audio.on = e.target.checked;
    initAudio();
    if (audio.ctx) audio.master.gain.setTargetAtTime(audio.on ? .8 : 0, audio.ctx.currentTime, .02);
  };
}
