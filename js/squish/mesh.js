// Pure mesh helpers: OBJ parsing, vertex welding and subdivision. Positions are flat [x,y,z,...] arrays.

// Minimal OBJ reader: vertex positions and (fan-triangulated) faces only.
export function parseOBJ(text) {
  const vp = [], ix = [];
  for (let l of text.split(/\r?\n/)) {
    l = l.trim();
    if (!l || l[0] === '#') continue;
    const c = l[0], d = l[1];
    if (c === 'v' && (d === ' ' || d === '\t')) {
      const p = l.split(/\s+/);
      vp.push(+p[1], +p[2], +p[3]);
    } else if (c === 'f' && (d === ' ' || d === '\t')) {
      const nv = vp.length / 3;
      const f = l.split(/\s+/).slice(1).map(s => {
        const i = parseInt(s, 10);
        return i < 0 ? nv + i : i - 1;
      });
      for (let k = 1; k < f.length - 1; k++) ix.push(f[0], f[k], f[k + 1]);
    }
  }
  // Drop faces with out-of-range indices and sanitize non-finite coordinates.
  const nv = vp.length / 3, ok = [];
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i], b = ix[i + 1], c = ix[i + 2];
    if (a >= 0 && b >= 0 && c >= 0 && a < nv && b < nv && c < nv) ok.push(a, b, c);
  }
  for (let i = 0; i < vp.length; i++) if (!isFinite(vp[i])) vp[i] = 0;
  return { pos: vp, idx: ok };
}

// Weld vertices that share a (quantized) position so the mesh deforms as one surface.
export function merge(pos, idx) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      mn[j] = Math.min(mn[j], pos[i + j]);
      mx[j] = Math.max(mx[j], pos[i + j]);
    }
  }
  const s = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1, Q = 2e5 / s;
  const keyMap = new Map(), remap = new Int32Array(pos.length / 3).fill(-1), P = [], I = [];
  const get = v => {
    if (remap[v] >= 0) return remap[v];
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const k = Math.round((x - mn[0]) * Q) + ',' + Math.round((y - mn[1]) * Q) + ',' + Math.round((z - mn[2]) * Q);
    let m = keyMap.get(k);
    if (m === undefined) {
      m = P.length / 3;
      P.push(x, y, z);
      keyMap.set(k, m);
    }
    return remap[v] = m;
  };
  for (let i = 0; i < idx.length; i += 3) {
    const a = get(idx[i]), b = get(idx[i + 1]), c = get(idx[i + 2]);
    if (a !== b && b !== c && a !== c) I.push(a, b, c);
  }
  return { pos: P, idx: I };
}

// One step of midpoint subdivision (each triangle -> 4). Appends new vertices to P; returns new indices.
export function subdiv(P, I) {
  const edges = new Map(), O = [];
  const mid = (a, b) => {
    const k = a < b ? a * 4194304 + b : b * 4194304 + a;
    let m = edges.get(k);
    if (m === undefined) {
      m = P.length / 3;
      P.push((P[a * 3] + P[b * 3]) / 2, (P[a * 3 + 1] + P[b * 3 + 1]) / 2, (P[a * 3 + 2] + P[b * 3 + 2]) / 2);
      edges.set(k, m);
    }
    return m;
  };
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i], b = I[i + 1], c = I[i + 2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    O.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  return O;
}
