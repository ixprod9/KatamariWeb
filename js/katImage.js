// The image every katamari uses; shared by the spawner and the squish tab.

import { stage } from './dom.js';
import { ASSETS } from './config.js';
import { state } from './state.js';
import { sfx } from './audio.js';
import { ballURL } from './media.js';
import { toast } from './ui/toast.js';
import { loadKatIntoSquish } from './squish/squish.js';

export function setKatImage(url) {
  state.katURL = url;
  stage.querySelectorAll('.kat img').forEach(i => i.src = url);
  if (state.squishIsKat) loadKatIntoSquish();
}

export function takeImageForKat(f) {
  if (!/^image\//.test(f.type)) {
    toast('Pick an image file (PNG, JPG, WebP, GIF).', true);
    sfx.err();
    return;
  }
  const r = new FileReader();
  r.onload = () => {
    const t = new Image();
    t.onload = () => {
      setKatImage(r.result);
      toast('New katamari image set');
      sfx.jingle();
    };
    t.onerror = () => {
      toast('Your browser could not open that image.', true);
      sfx.err();
    };
    t.src = r.result;
  };
  r.readAsDataURL(f);
}

// Swap to the generated ball if the default emoji can't be fetched.
export function checkDefaultImage() {
  const t = new Image();
  t.onerror = () => { if (state.katURL === ASSETS.emoji) setKatImage(ballURL); };
  t.src = ASSETS.emoji;
}
