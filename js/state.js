// Mutable state shared between modules.

import { ASSETS } from './config.js';

export const state = {
  // Active tab: 'spawn' | 'squish'.
  tab: 'spawn',
  // Image used for every katamari (emoji, generated ball, or user upload).
  katURL: ASSETS.emoji,
  // True while the squish tab shows the katamari image rather than a user file.
  squishIsKat: true,
  // The rolling ball while "Roll the Katamari" is on, otherwise null.
  player: null,
};
