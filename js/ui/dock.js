// Draggable control dock. Its position is stored relative to the viewport so it survives resizes.

import { app, dock, clamp } from '../dom.js';

let relX = .5, relY = 1;

export function placeDock() {
  const W = app.clientWidth, H = app.clientHeight, w = dock.offsetWidth, h = dock.offsetHeight;
  dock.style.left = clamp(relX * W - w / 2, 10, Math.max(10, W - w - 10)) + 'px';
  dock.style.top = clamp(relY * H - h - 30, 10, Math.max(10, H - h - 10)) + 'px';
  dock.style.bottom = 'auto';
  dock.style.transform = 'none';
}

export function initDock() {
  let dragging = false, ox = 0, oy = 0;

  dock.addEventListener('pointerdown', e => {
    if (e.target.closest('button,input,label')) return;
    dragging = true;
    ox = e.clientX - dock.offsetLeft;
    oy = e.clientY - dock.offsetTop;
    dock.setPointerCapture(e.pointerId);
  });

  dock.addEventListener('pointermove', e => {
    if (!dragging) return;
    const W = app.clientWidth, H = app.clientHeight, w = dock.offsetWidth, h = dock.offsetHeight;
    const x = clamp(e.clientX - ox, 10, W - w - 10), y = clamp(e.clientY - oy, 10, H - h - 10);
    dock.style.left = x + 'px';
    dock.style.top = y + 'px';
    relX = (x + w / 2) / W;
    relY = (y + h + 30) / H;
  });

  dock.addEventListener('pointerup', e => {
    dragging = false;
    try { dock.releasePointerCapture(e.pointerId); } catch (_) {}
  });
}
