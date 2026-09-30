// Generated fallback art and preloading of the optional GIF / MP3 assets.

import { ASSETS } from './config.js';

// Whether the explosion GIF and boom MP3 loaded; otherwise CSS/synth fallbacks are used.
export const media = { gifOK: false, mp3OK: false };

// Procedural katamari ball, used when the emoji image can't be loaded.
export const ballURL = drawBall();

export const boomAudio = new Audio();

export function preloadMedia() {
  const gif = new Image();
  gif.onload = () => media.gifOK = true;
  gif.src = ASSETS.explosionGif;

  boomAudio.preload = 'auto';
  boomAudio.addEventListener('canplaythrough', () => media.mp3OK = true, { once: true });
  boomAudio.src = ASSETS.boomSound;
}

function drawBall() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');

  const body = g.createRadialGradient(100, 92, 10, 128, 128, 104);
  body.addColorStop(0, '#8dffa8');
  body.addColorStop(.5, '#26c950');
  body.addColorStop(1, '#0f6a28');
  g.beginPath();
  g.arc(128, 128, 96, 0, Math.PI * 2);
  g.fillStyle = body;
  g.fill();

  // Junk stuck to the ball: circles, rectangles and triangles on a golden-angle spiral.
  const cols = ['#ff5a5f', '#ffe14d', '#6cc4ff', '#ff9ed2', '#ffffff', '#b18cff', '#ff9a4d', '#8b5a2b'];
  for (let i = 0; i < 30; i++) {
    const a = i * 2.399;
    const r = i < 20 ? 92 : 40 + ((i * 37) % 45);
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r, s = 10 + ((i * 13) % 16);
    g.save();
    g.translate(x, y);
    g.rotate(a * 1.7);
    g.fillStyle = cols[i % cols.length];
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 2;
    if (i % 3 === 0) {
      g.beginPath();
      g.arc(0, 0, s * .6, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else if (i % 3 === 1) {
      g.fillRect(-s / 2, -s / 3, s, s * .66);
      g.strokeRect(-s / 2, -s / 3, s, s * .66);
    } else {
      g.beginPath();
      g.moveTo(0, -s * .6);
      g.lineTo(s * .55, s * .45);
      g.lineTo(-s * .55, s * .45);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  const shine = g.createRadialGradient(92, 80, 2, 92, 80, 40);
  shine.addColorStop(0, 'rgba(255,255,255,.55)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = shine;
  g.beginPath();
  g.arc(92, 80, 40, 0, Math.PI * 2);
  g.fill();

  return c.toDataURL();
}
