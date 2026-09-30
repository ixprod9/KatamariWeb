# Katamari

Static site served at [katamari.xyz](https://katamari.xyz) via GitHub Pages. No build step.

- **Spawner**: bouncing, draggable katamari that explode when flung too fast. Turn on *Roll the Katamari* to steer a 3D ball (WASD / arrows / hold on the floor) that rolls up the smaller ones.
- **Squish**: grab and stretch a soft-body version of the katamari image, or load your own image or `.obj`.

## Structure

```
index.html              markup only; links CSS and loads js/main.js
css/
  base.css              design tokens, reset, checkerboard background
  controls.css          tabs, dock, buttons, inputs, HUD, toast, drop overlay
  spawner.css           katamari, roll overlay, explosion effects
  squish.css            squish canvas
js/
  main.js               entry point: init modules, render loop
  config.js             asset paths and UI copy
  state.js              state shared across modules
  dom.js                element lookups and helpers
  audio.js              Web Audio sound effects
  media.js              generated fallback ball, GIF/MP3 preload
  katImage.js           the image used by every katamari
  input.js              file pickers, paste, drag-and-drop, keyboard shortcuts
  ui/                   tabs, draggable dock, toast
  spawner/              spawner physics (spawner.js), roll mode (roll.js), shared world state
  squish/               soft-body renderer (squish.js), OBJ parsing and subdivision (mesh.js)
assets/
  models/               core_01 OBJ/MTL/PNG (the rolling core)
  audio/                boom.mp3
  images/               explosion.gif
```

three.js r128 is loaded from a CDN as the global `THREE`. The app code is ES modules.

## Running locally

ES modules and the model loaders need HTTP, so opening `index.html` directly won't work. Serve the folder instead:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Shortcuts

| Key | Tab | Action |
| --- | --- | --- |
| K | Spawner | Spawn a katamari |
| WASD / arrows | Spawner (roll mode) | Roll |
| R | Squish | Reset shape |
| F | Squish | Toggle freeze |

You can also paste or drop an image anywhere, or drop a `.obj` to squish it.
