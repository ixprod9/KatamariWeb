// Spawner tab: bouncing, draggable katamari that explode when flung too fast.

import { $, app, stage, clamp } from '../dom.js';
import { ASSETS } from '../config.js';
import { state } from '../state.js';
import { initAudio, sfx, audio } from '../audio.js';
import { media, boomAudio } from '../media.js';
import { kats, pointer, toStage, katSize } from './world.js';
import { stepPlayer, stepZoom } from './roll.js';

// Pointer speed (px/ms) above which a held katamari explodes.
const FLING_LIMIT = 7.5;
const MAX_THROW = 14;
const FOLLOW_RANGE = 400;

const opts = { collisions: true, follow: false };
let lastTok = 0;

const randDir = () => (Math.random() < .5 ? -1 : 1) * 4;

export function spawn() {
  const W = stage.clientWidth || app.clientWidth, H = stage.clientHeight || app.clientHeight;
  const S = katSize(), R = S / 2;

  const el = document.createElement('div');
  el.className = 'kat';
  el.style.width = S + 'px';
  const img = document.createElement('img');
  img.src = state.katURL;
  img.alt = '';
  img.draggable = false;
  el.appendChild(img);
  stage.appendChild(el);

  const k = {
    el,
    x: Math.random() * Math.max(1, W - S),
    y: Math.random() * Math.max(1, H - S),
    vx: randDir(),
    vy: randDir(),
    r: R,
    held: false,
    dead: false,
  };
  kats.push(k);

  // Track pointer velocity while held so releasing throws it.
  let lt = 0, lx = 0, ly = 0, tvx = 0, tvy = 0;
  el.addEventListener('pointerdown', e => {
    if (k.dead || k.stuck) return;
    initAudio();
    k.held = true;
    el.setPointerCapture(e.pointerId);
    lt = performance.now();
    lx = e.clientX;
    ly = e.clientY;
    tvx = tvy = 0;
    sfx.tok();
  });
  el.addEventListener('pointermove', e => {
    if (!k.held || k.dead) return;
    const now = performance.now(), dt = now - lt || 1, dx = e.clientX - lx, dy = e.clientY - ly;
    if (Math.hypot(dx, dy) / dt > FLING_LIMIT) return explode(k);
    tvx = dx / dt * 16;
    tvy = dy / dt * 16;
    lt = now;
    lx = e.clientX;
    ly = e.clientY;
    const [sx, sy] = toStage(e);
    k.x = sx - k.r;
    k.y = sy - k.r;
  });
  const release = e => {
    if (!k.held) return;
    k.held = false;
    try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!k.dead) {
      k.vx = clamp(tvx, -MAX_THROW, MAX_THROW);
      k.vy = clamp(tvy, -MAX_THROW, MAX_THROW);
      if (Math.hypot(k.vx, k.vy) < 1) {
        k.vx = randDir();
        k.vy = randDir();
      }
    }
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  sfx.pop();
}

export function explode(k) {
  if (k.dead) return;
  k.dead = true;
  k.held = false;
  k.el.remove();

  if (media.mp3OK) {
    if (audio.on) boomAudio.cloneNode().play().catch(() => sfx.boom());
  } else sfx.boom();

  const cx = k.x + k.r, cy = k.y + k.r;
  if (media.gifOK) {
    const x = document.createElement('img');
    x.className = 'gifboom';
    x.alt = '';
    x.src = ASSETS.explosionGif;
    x.style.left = cx + 'px';
    x.style.top = cy + 'px';
    stage.appendChild(x);
    setTimeout(() => x.style.opacity = '0', 1000);
    setTimeout(() => x.remove(), 2100);
    return;
  }

  // Fallback: CSS flash + particles.
  const b = document.createElement('div');
  b.className = 'boom';
  b.style.left = cx + 'px';
  b.style.top = cy + 'px';
  const cols = ['#ffe14d', '#ff7a1a', '#ff5a5f', '#26c950', '#ffffff'];
  let h = '<i class="flash"></i>';
  for (let i = 0; i < 16; i++) {
    h += `<i class="pt" style="--a:${i * 22.5 + Math.random() * 12}deg;--d:${90 + Math.random() * 90}px;--c:${cols[i % 5]}"></i>`;
  }
  b.innerHTML = h;
  stage.appendChild(b);
  setTimeout(() => b.remove(), 1100);
}

export function stepSpawner(dt) {
  const W = stage.clientWidth, H = stage.clientHeight;
  for (let i = kats.length - 1; i >= 0; i--) if (kats[i].dead) kats.splice(i, 1);
  stepZoom(dt);
  stepPlayer(dt, W, H);

  for (let i = 0; i < kats.length; i++) {
    const a = kats[i];
    if (a.stuck) continue;

    if (!a.held) {
      if (opts.follow) {
        const dx = pointer.x - (a.x + a.r), dy = pointer.y - (a.y + a.r), d = Math.hypot(dx, dy) || 1;
        if (d < FOLLOW_RANGE) {
          const f = 1 - d / FOLLOW_RANGE;
          a.vx = dx / d * f * 5;
          a.vy = dy / d * f * 5;
        }
      }
      a.x += a.vx;
      a.y += a.vy;
      // Bounce off the stage edges.
      if (a.x <= 0) { a.x = 0; a.vx = Math.abs(a.vx); }
      else if (a.x + a.r * 2 >= W) { a.x = W - a.r * 2; a.vx = -Math.abs(a.vx); }
      if (a.y <= 0) { a.y = 0; a.vy = Math.abs(a.vy); }
      else if (a.y + a.r * 2 >= H) { a.y = H - a.r * 2; a.vy = -Math.abs(a.vy); }
    }

    if (opts.collisions) {
      for (let j = i + 1; j < kats.length; j++) {
        const b = kats[j];
        if (b.stuck) continue;
        const dx = b.x + b.r - a.x - a.r, dy = b.y + b.r - a.y - a.r, d = Math.hypot(dx, dy), md = a.r + b.r;
        if (d < md && d > 0) {
          // Separate the overlap, then exchange velocity along the contact normal.
          const nx = dx / d, ny = dy / d, o = (md - d) / 2;
          if (!a.held) { a.x -= nx * o; a.y -= ny * o; }
          if (!b.held) { b.x += nx * o; b.y += ny * o; }
          const p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (p > 0) {
            a.vx -= p * nx;
            a.vy -= p * ny;
            b.vx += p * nx;
            b.vy += p * ny;
            const now = performance.now();
            if (now - lastTok > 70) {
              lastTok = now;
              sfx.tok();
            }
          }
        }
      }
    }
  }

  for (const k of kats) if (!k.stuck) k.el.style.transform = `translate(${k.x}px,${k.y}px)`;
}

export function initSpawner() {
  $('collisionToggle').onchange = e => opts.collisions = e.target.checked;
  $('followToggle').onchange = e => opts.follow = e.target.checked;
  $('spawnBtn').onclick = () => { initAudio(); spawn(); };
  $('clearBtn').onclick = () => { initAudio(); kats.forEach(explode); };

  stage.addEventListener('pointermove', e => { [pointer.x, pointer.y] = toStage(e); });
  stage.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1e4; });
}
