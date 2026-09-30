// Static configuration: asset locations and UI copy.

export const ASSETS = {
  emoji: 'https://cdn.discordapp.com/emojis/1318694929677029587.webp?size=128',
  explosionGif: 'assets/images/explosion.gif',
  boomSound: 'assets/audio/boom.mp3',
  core: {
    obj: 'assets/models/core_01.obj',
    mtl: 'assets/models/core_01.mtl',
    png: 'assets/models/core_01.png',
  },
};

export const HINTS = {
  spawn: 'Drag a katamari around. Fling it too fast and it explodes.',
  roll: 'WASD or arrow keys to roll. Hold on the floor or right-click to roll toward the pointer.',
  squish: 'Grab and pull to stretch. Drag empty space to spin, scroll to zoom.',
};

// URL hash used for each tab.
export const TAB_HASH = { spawn: 'spawner', squish: 'squish' };
