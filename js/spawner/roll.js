// "Roll the Katamari" mode: a 3D core the player steers that picks up smaller katamari.

import { $, app, stage } from '../dom.js';
import { ASSETS } from '../config.js';
import { state } from '../state.js';
import { initAudio, sfx } from '../audio.js';
import { updateHint } from '../ui/tabs.js';
import { kats, pointer, view, toStage, katSize } from './world.js';

const { Vector3: V3 } = THREE;

// Fixed-step physics.
const TICK = .025, ACC = .5, DRAG = .95, MAXV = 40;

const KEYMAP = { w: 'u', arrowup: 'u', s: 'd', arrowdown: 'd', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
const keys = {};
let steer = false;

const ballVol = r => 4 * Math.PI * r * r * r / 3;
const itemVol = k => { const s = k.r * 2; return s * s * s; };

// Three.js overlay that renders the core.
let ren = null, scene, cam, coreHolder, coreRadius = 1, rW = 0, rH = 0;
const qd = new THREE.Quaternion(), qi = new THREE.Quaternion(), axis = new V3(), nv = new V3();
const SX = new V3(1, 0, 0), SD = new V3(0, -1, 0), tu = new V3(), tv = new V3();

function initRoll3D() {
  if (ren) return;
  ren = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  ren.outputEncoding = THREE.sRGBEncoding;
  ren.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  ren.domElement.className = 'player';
  ren.domElement.hidden = true;
  stage.appendChild(ren.domElement);

  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(0, 1, 0, -1, -5000, 5000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4a3a, .85));
  const dl = new THREE.DirectionalLight(0xffffff, .9);
  dl.position.set(-.4, .6, 1);
  scene.add(dl);
  coreHolder = new THREE.Group();
  scene.add(coreHolder);

  // Striped placeholder sphere, shown until the core model loads.
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#26c950';
  for (let i = 0; i < 14; i++) g.fillRect(i * 512 / 14, 0, 512 / 14 * .28, 256);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  coreHolder.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ map: t, roughness: .55 })));

  loadCore();
}

// Center the loaded model and measure its true radius so it can be scaled to the ball.
function setCore(obj) {
  const box = new THREE.Box3().setFromObject(obj), ctr = box.getCenter(new V3()), sph = box.getBoundingSphere(new THREE.Sphere());
  if (!isFinite(sph.radius) || sph.radius <= 0) return;
  obj.position.sub(ctr);
  const wrap = new THREE.Group();
  wrap.add(obj);
  wrap.updateMatrixWorld(true);
  let mr = 0;
  const pv = new V3();
  obj.traverse(m => {
    if (m.isMesh && m.geometry.attributes.position) {
      const pa = m.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        pv.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
        mr = Math.max(mr, pv.length());
      }
    }
  });
  if (mr > 0) sph.radius = mr;
  obj.traverse(m => {
    if (!m.isMesh) return;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => {
      if (x.map) x.map.encoding = THREE.sRGBEncoding;
      x.needsUpdate = true;
    });
  });
  coreHolder.clear();
  coreHolder.add(obj);
  coreRadius = sph.radius;
}

// Load the OBJ with its MTL; fall back to OBJ + PNG texture if the MTL fails.
function loadCore() {
  if (!THREE.OBJLoader) return;
  const { obj, mtl, png } = ASSETS.core;
  const plain = () => new THREE.OBJLoader().load(obj, o => {
    new THREE.TextureLoader().load(png, tx => {
      tx.encoding = THREE.sRGBEncoding;
      o.traverse(m => { if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ map: tx, roughness: .6 }); });
      setCore(o);
    }, undefined, () => setCore(o));
  }, undefined, () => {});
  if (!THREE.MTLLoader) return plain();
  new THREE.MTLLoader().load(mtl, mats => {
    mats.preload();
    new THREE.OBJLoader().setMaterials(mats).load(obj, setCore, undefined, () => {});
  }, undefined, plain);
}

function updateHud() {
  const pl = state.player;
  $('hSize').textContent = Math.round(pl.R / 5) + 'cm';
  $('hCount').textContent = pl.items;
}

export function setRoll(on) {
  $('rollToggle').checked = on;
  if (on && !state.player) {
    initRoll3D();
    const W = stage.clientWidth || app.clientWidth, H = stage.clientHeight || app.clientHeight, S = katSize();
    ren.domElement.hidden = false;
    // Start with the same volume as one katamari.
    const R = Math.ceil(Math.cbrt(3 * S * S * S / (4 * Math.PI))) + 2;
    state.player = { x: W / 2, y: H / 2, vx: 0, vy: 0, R, core: R, q: new THREE.Quaternion(), items: 0, acc: 0, ext: 0 };
    $('hud').hidden = false;
    updateHud();
    sfx.jingle();
  } else if (!on && state.player) {
    const pl = state.player;
    // Scatter everything that was rolled up.
    for (const k of kats) {
      if (!k.stuck) continue;
      k.stuck = false;
      k.el.classList.remove('stuck');
      k.el.style.left = k.el.style.top = '0';
      k.el.style.transformOrigin = '';
      k.el.style.display = '';
      k.el.style.zIndex = '';
      const a = Math.random() * Math.PI * 2;
      k.x = pl.x - k.r + Math.cos(a) * pl.R * .5;
      k.y = pl.y - k.r + Math.sin(a) * pl.R * .5;
      k.vx = Math.cos(a) * 6;
      k.vy = Math.sin(a) * 6;
    }
    ren.domElement.hidden = true;
    state.player = null;
    $('hud').hidden = true;
    sfx.boing(1.2);
  }
  updateHint();
}

function tick(W, H) {
  const pl = state.player, ox = pl.x, oy = pl.y;
  let ax = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), ay = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
  if (steer) {
    const dx = pointer.x - pl.x, dy = pointer.y - pl.y, d = Math.hypot(dx, dy);
    if (d > 1) { ax += dx / d; ay += dy / d; }
  }
  const l = Math.hypot(ax, ay);
  if (l > 0) { pl.vx += ax / l * ACC; pl.vy += ay / l * ACC; }
  else { pl.vx *= DRAG; pl.vy *= DRAG; }
  const sp = Math.hypot(pl.vx, pl.vy);
  if (sp > MAXV) { pl.vx *= MAXV / sp; pl.vy *= MAXV / sp; }
  pl.x += pl.vx;
  pl.y += pl.vy;

  // Bounce off the edges, using the ball's extent including stuck items.
  const R = pl.R, E = Math.min(R + pl.ext, W / 2 - 1, H / 2 - 1);
  let bounce = false;
  if (pl.x - E < 0) { pl.x = E + 1; pl.vx = -pl.vx; bounce = true; }
  else if (pl.x + E > W) { pl.x = W - E - 1; pl.vx = -pl.vx; bounce = true; }
  if (pl.y - E < 0) { pl.y = E + 1; pl.vy = -pl.vy; bounce = true; }
  else if (pl.y + E > H) { pl.y = H - E - 1; pl.vy = -pl.vy; bounce = true; }
  if (bounce && sp > 2) sfx.tok();

  // Rotate the ball by the distance travelled.
  const mdx = pl.x - ox, mdy = pl.y - oy, dist = Math.hypot(mdx, mdy);
  if (dist > 0) {
    axis.set(mdy / dist, mdx / dist, 0);
    qd.setFromAxisAngle(axis, dist / R);
    pl.q.premultiply(qd);
  }

  for (const k of kats) {
    if (k.stuck || k.dead || k.held) continue;
    const cx = k.x + k.r, cy = k.y + k.r, dx = cx - pl.x, dy = cy - pl.y, d = Math.hypot(dx, dy);
    if (d >= pl.R + k.r) continue;
    // Too big to pick up: push it away.
    if (itemVol(k) > ballVol(pl.R)) {
      if (d > 0) { k.vx = dx / d * 6; k.vy = dy / d * 6; }
      continue;
    }
    attach(k, dx, dy, d);
  }
}

// Stick katamari `k` to the ball at the contact point, stored in the ball's local frame.
function attach(k, dx, dy, d) {
  const pl = state.player;
  const nx = d ? dx / d : 1, ny = d ? dy / d : 0;
  const n = new V3(nx, -ny, .6).normalize();
  const u = SX.clone().addScaledVector(n, -n.dot(SX));
  if (u.lengthSq() < 1e-4) u.set(0, 1, 0).addScaledVector(n, -n.y);
  u.normalize();
  const v = new V3().crossVectors(n, u);
  if (v.dot(SD) < 0) v.negate();
  qi.copy(pl.q).invert();
  n.applyQuaternion(qi);

  // Stack on top of items already stuck nearby.
  let h = pl.core * .98;
  for (const j of kats) {
    if (!j.stuck || j === k) continue;
    const b = j.att, ang = Math.acos(Math.max(-1, Math.min(1, n.dot(b.n))));
    if (ang < (j.r + k.r) * .28 / b.r) h = Math.max(h, b.r + j.r * .1);
  }
  h = Math.min(h, Math.max(pl.core, pl.R * 1.02));
  k.att = { n, u: u.applyQuaternion(qi), v: v.applyQuaternion(qi), r: h };

  const S = k.r * 2;
  pl.R = Math.cbrt((ballVol(pl.R) + S * S * k.r * .5) * 3 / (4 * Math.PI));
  pl.ext = Math.max(pl.ext, h + k.r * .9 - pl.R);
  pl.items++;
  updateHud();
  sfx.pickup(pl.items);

  k.stuck = true;
  k.held = false;
  k.el.classList.add('stuck');
  k.el.style.left = k.el.style.top = -k.r + 'px';
  k.el.style.transformOrigin = k.r + 'px ' + k.r + 'px';
}

function draw() {
  const pl = state.player, W = stage.clientWidth, H = stage.clientHeight;
  if (W !== rW || H !== rH) {
    rW = W;
    rH = H;
    ren.setSize(W, H, false);
    cam.right = W;
    cam.bottom = -H;
    cam.updateProjectionMatrix();
  }
  coreHolder.position.set(pl.x, -pl.y, 0);
  coreHolder.quaternion.copy(pl.q);
  coreHolder.scale.setScalar(pl.core / coreRadius);
  ren.render(scene, cam);

  // Position stuck items with CSS transforms, layered in front of or behind the core.
  for (const k of kats) {
    if (!k.stuck) continue;
    const a = k.att;
    nv.copy(a.n).applyQuaternion(pl.q);
    tu.copy(a.u).applyQuaternion(pl.q);
    tv.copy(a.v).applyQuaternion(pl.q);
    const sx = nv.x * a.r, sy = -nv.y * a.r;
    k.x = pl.x + sx - k.r;
    k.y = pl.y + sy - k.r;
    k.el.style.zIndex = Math.round(nv.z * a.r) + (nv.z >= 0 ? 1001 : 999);
    k.el.style.transform = `translate(${pl.x + sx}px,${pl.y + sy}px) matrix(${tu.x},${-tu.y},${tv.x},${-tv.y},0,0)`;
  }
}

export function stepPlayer(dt, W, H) {
  const pl = state.player;
  if (!pl) return;
  pl.acc += Math.min(dt, .1);
  while (pl.acc >= TICK) {
    pl.acc -= TICK;
    tick(W, H);
  }
  draw();
}

// Ease the stage zoom so the growing ball keeps fitting on screen.
export function stepZoom(dt) {
  const pl = state.player, aw = app.clientWidth, ah = app.clientHeight;
  const t = pl ? Math.min(1, Math.min(aw, ah) * .2 / (pl.R + pl.ext * .5)) : 1;
  if (Math.abs(t - view.zoom) < 1e-4 && view.zoom === t) return;
  view.zoom += (t - view.zoom) * Math.min(1, dt * 2.5);
  if (Math.abs(t - view.zoom) < 1e-4) view.zoom = t;
  if (view.zoom === 1) {
    stage.style.transform = stage.style.width = stage.style.height = '';
  } else {
    stage.style.transformOrigin = '0 0';
    stage.style.transform = `scale(${view.zoom})`;
    stage.style.width = aw / view.zoom + 'px';
    stage.style.height = ah / view.zoom + 'px';
  }
}

export function initRoll() {
  $('rollToggle').onchange = e => { initAudio(); setRoll(e.target.checked); e.target.blur(); };

  addEventListener('keydown', e => {
    const m = KEYMAP[e.key.toLowerCase()];
    if (m && state.player && state.tab === 'spawn') {
      keys[m] = true;
      e.preventDefault();
    }
  });
  addEventListener('keyup', e => {
    const m = KEYMAP[e.key.toLowerCase()];
    if (m) keys[m] = false;
  });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    steer = false;
  });

  // Hold on empty floor (or right-click) to roll toward the pointer.
  stage.addEventListener('pointerdown', e => {
    if (state.player && (e.target === stage || e.button === 2)) {
      steer = true;
      [pointer.x, pointer.y] = toStage(e);
    }
  });
  stage.addEventListener('contextmenu', e => { if (state.player) e.preventDefault(); });
  addEventListener('pointerup', () => steer = false);
  addEventListener('pointercancel', () => steer = false);
}
