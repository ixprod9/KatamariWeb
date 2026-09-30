// Spawner / Squish tab switching.

import { $ } from '../dom.js';
import { HINTS, TAB_HASH } from '../config.js';
import { state } from '../state.js';
import { initAudio, sfx } from '../audio.js';
import { placeDock } from './dock.js';
import { resizeSquish } from '../squish/squish.js';

export function updateHint() {
  $('hint').textContent = state.tab === 'spawn' && state.player ? HINTS.roll : HINTS[state.tab];
}

export function setTab(t) {
  state.tab = t;
  $('tSpawn').setAttribute('aria-selected', t === 'spawn');
  $('tSquish').setAttribute('aria-selected', t === 'squish');
  $('pSpawn').hidden = t !== 'spawn';
  $('pSquish').hidden = t !== 'squish';
  $('gSpawn').hidden = t !== 'spawn';
  $('gSquish').hidden = t !== 'squish';
  $('hud').hidden = !(t === 'spawn' && state.player);
  updateHint();
  if (t === 'squish') resizeSquish();
  requestAnimationFrame(placeDock);
  try { history.replaceState(null, '', '#' + TAB_HASH[t]); } catch (e) {}
}

export function initTabs() {
  $('tSpawn').onclick = () => { setTab('spawn'); initAudio(); sfx.blip(); };
  $('tSquish').onclick = () => { setTab('squish'); initAudio(); sfx.blip(); };
}

export function tabFromHash() {
  return location.hash === '#' + TAB_HASH.squish ? 'squish' : 'spawn';
}
