// DOM lookups and small shared helpers.

export const $ = id => document.getElementById(id);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const app = $('app');
export const dock = $('dock');
export const stage = $('stage');
export const canvas = $('c');
