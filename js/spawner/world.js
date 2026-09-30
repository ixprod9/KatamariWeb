// State shared by the spawner and roll mode.

import { app, stage } from '../dom.js';

// Every katamari on the stage: { el, x, y, vx, vy, r, held, dead, stuck, att }.
export const kats = [];

// Last pointer position in stage coordinates (off-screen when the pointer leaves).
export const pointer = { x: -1e4, y: -1e4 };

// Stage zoom; roll mode zooms out as the ball grows.
export const view = { zoom: 1 };

export const toStage = e => {
  const r = stage.getBoundingClientRect();
  return [(e.clientX - r.left) / view.zoom, (e.clientY - r.top) / view.zoom];
};

// Diameter of a newly spawned katamari.
export const katSize = () => Math.round(Math.min(160, app.clientWidth * .3));
