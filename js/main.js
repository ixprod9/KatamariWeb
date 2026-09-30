// Entry point: wires up every module and runs the render loop.

import { state } from './state.js';
import { preloadMedia } from './media.js';
import { initSoundToggle } from './audio.js';
import { checkDefaultImage } from './katImage.js';
import { initTabs, setTab, tabFromHash } from './ui/tabs.js';
import { initDock, placeDock } from './ui/dock.js';
import { initSpawner, spawn, stepSpawner } from './spawner/spawner.js';
import { initRoll } from './spawner/roll.js';
import { initSquish, loadKatIntoSquish, resizeSquish, stepSquish } from './squish/squish.js';
import { initInput } from './input.js';

checkDefaultImage();
preloadMedia();

initSoundToggle();
initTabs();
initDock();
initSpawner();
initRoll();
initSquish();
initInput();

addEventListener('resize', () => {
  resizeSquish();
  placeDock();
});

const clock = new THREE.Clock();
let elapsed = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  elapsed += dt;
  if (state.tab === 'spawn') stepSpawner(dt);
  else stepSquish(dt, elapsed);
}

setTab(tabFromHash());
loadKatIntoSquish();
spawn();
frame();
