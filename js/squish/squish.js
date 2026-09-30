// Squish tab: a soft-body mesh (the katamari image, or a user image/OBJ) you can grab and stretch.

import { $, canvas, clamp } from '../dom.js';
import { state } from '../state.js';
import { audio, initAudio, sfx, tone } from '../audio.js';
import { ballURL } from '../media.js';
import { subdiv } from './mesh.js';

// Spring stiffness for the per-vertex simulation; damping comes from the Wobble slider.
const STIFFNESS = 260;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
camera.position.set(0, 0, 4.4);
scene.add(new THREE.HemisphereLight(0xffffff, 0x224422, .9));
const keyLight = new THREE.DirectionalLight(0xffffff, 1);
keyLight.position.set(2.5, 3, 4);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x26c950, .8);
rimLight.position.set(-3, 1.5, -3);
scene.add(rimLight);
const pivot = new THREE.Group();
scene.add(pivot);

const meshMat = new THREE.MeshPhysicalMaterial({ color: 0x26c950, roughness: .42, metalness: 0, clearcoat: .55, clearcoatRoughness: .35 });
const imgMat = new THREE.MeshStandardMaterial({
  roughness: .8, metalness: 0, side: THREE.DoubleSide, transparent: true, alphaTest: .02, emissive: 0xffffff, emissiveIntensity: .35,
});

// Simulation buffers (n vertices): REST = rest pose, D = displacement, V = velocity,
// BASE = frozen offset target, W = grab weight per vertex.
let mesh, geo, n = 0, REST, D, V, BASE, W, posA, sleeping = false, isImg = false, freeze = false;
const gd = new THREE.Vector3(); // current grab displacement (mesh-local)

let grabbing = false, orbiting = false, yaw = 0, pitch = 0;
const look = { x: 0, y: 0 };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane();
const startPt = new THREE.Vector3(), tmp = new THREE.Vector3(), q = new THREE.Quaternion();

// Build the deformable mesh from flat positions + indices. `opt.uv` marks an image plane.
function build(P, I, opt = {}) {
  if (!opt.uv) {
    // Subdivide low-poly meshes so they bend smoothly.
    let p = 0;
    while (P.length / 3 < 16000 && I.length * 4 < 700000 && p < 5) {
      I = subdiv(P, I);
      p++;
    }
  }
  n = P.length / 3;

  // Normalize into a unit sphere around the bounding-box center.
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < n * 3; i += 3) {
    for (let j = 0; j < 3; j++) {
      mn[j] = Math.min(mn[j], P[i + j]);
      mx[j] = Math.max(mx[j], P[i + j]);
    }
  }
  const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2, cz = (mn[2] + mx[2]) / 2;
  let r = 0;
  for (let i = 0; i < n * 3; i += 3) r = Math.max(r, Math.hypot(P[i] - cx, P[i + 1] - cy, P[i + 2] - cz));
  r = (r || 1) / (opt.scale || 1);
  REST = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i += 3) {
    REST[i] = (P[i] - cx) / r;
    REST[i + 1] = (P[i + 1] - cy) / r;
    REST[i + 2] = (P[i + 2] - cz) / r;
  }
  D = new Float32Array(n * 3);
  V = new Float32Array(n * 3);
  BASE = new Float32Array(n * 3);
  W = new Float32Array(n);

  if (mesh) {
    pivot.remove(mesh);
    geo.dispose();
  }
  geo = new THREE.BufferGeometry();
  posA = new THREE.BufferAttribute(REST.slice(), 3);
  posA.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posA);
  if (opt.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(opt.uv, 2));
  geo.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  geo.computeVertexNormals();
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 5);

  isImg = !!opt.uv;
  mesh = new THREE.Mesh(geo, isImg ? imgMat : meshMat);
  mesh.frustumCulled = false;
  pivot.add(mesh);

  // The color picker only applies to OBJ meshes.
  $('col').disabled = isImg;
  $('colLbl').classList.toggle('off', isImg);
  $('colLbl').title = isImg ? 'Load an OBJ to color it' : '';
  sleeping = false;
  grabbing = false;
  yaw = pitch = 0;
}

// Turn an image (or canvas) into a finely tessellated textured plane.
function imagePlane(src) {
  let w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  if (!w || !h) throw new Error('image has no size');
  const M = 2048;
  if (Math.max(w, h) > M) {
    const s = M / Math.max(w, h), c = document.createElement('canvas');
    c.width = Math.round(w * s);
    c.height = Math.round(h * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    src = c;
    w = c.width;
    h = c.height;
  }
  const a = w / h, hw = a >= 1 ? 1 : a, hh = a >= 1 ? 1 / a : 1;
  const nx = Math.max(10, Math.round(150 * hw)), ny = Math.max(10, Math.round(150 * hh)), P = [], U = [], I = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      P.push((i / nx - .5) * 2 * hw, (j / ny - .5) * 2 * hh, 0);
      U.push(i / nx, j / ny);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a0 = j * (nx + 1) + i, b = a0 + 1, c = a0 + nx + 1, d = c + 1;
      I.push(a0, b, d, a0, d, c);
    }
  }
  if (imgMat.map) imgMat.map.dispose();
  const t = new THREE.Texture(src);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.needsUpdate = true;
  imgMat.map = t;
  imgMat.emissiveMap = t;
  imgMat.needsUpdate = true;
  build(P, I, { uv: U, scale: 1.45 });
}

// Show a user-supplied mesh; returns its vertex count after subdivision.
export function showMesh(pos, idx) {
  build(pos, idx);
  state.squishIsKat = false;
  return n;
}

// Show a user-supplied image. Throws if the image has no size.
export function showImage(img) {
  imagePlane(img);
  state.squishIsKat = false;
}

// Show the current katamari image, falling back to the generated ball.
export function loadKatIntoSquish() {
  const url = state.katURL, i = new Image();
  if (!url.startsWith('data:')) i.crossOrigin = 'anonymous';
  const useBall = () => {
    const b = new Image();
    b.onload = () => { imagePlane(b); state.squishIsKat = true; };
    b.src = ballURL;
  };
  i.onload = () => {
    try {
      imagePlane(i);
      state.squishIsKat = true;
    } catch (e) {
      if (url !== ballURL) useBall();
    }
  };
  i.onerror = () => { if (i.src !== ballURL) useBall(); };
  i.src = url;
}

export function resetSquish() {
  if (!BASE) return;
  BASE.fill(0);
  sleeping = false;
  yaw = pitch = 0;
  sfx.reset();
}

export function resizeSquish() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 52 : 38;
  camera.updateProjectionMatrix();
}

// Damped springs pulling each vertex toward BASE (+ grab offset weighted by W).
function sim(dt) {
  if (sleeping && !grabbing) return;
  const k = STIFFNESS, c = 26 - (+$('wob').value) * 2.4, h = dt / 2, gx = gd.x, gy = gd.y, gz = gd.z;
  let e = 0;
  for (let s = 0; s < 2; s++) {
    for (let v = 0; v < n; v++) {
      const w = grabbing ? W[v] : 0, i = v * 3;
      let a = k * (BASE[i] + w * gx - D[i]) - c * V[i];
      V[i] += a * h;
      D[i] += V[i] * h;
      a = k * (BASE[i + 1] + w * gy - D[i + 1]) - c * V[i + 1];
      V[i + 1] += a * h;
      D[i + 1] += V[i + 1] * h;
      a = k * (BASE[i + 2] + w * gz - D[i + 2]) - c * V[i + 2];
      V[i + 2] += a * h;
      D[i + 2] += V[i + 2] * h;
      if (s) e += V[i] * V[i] + V[i + 1] * V[i + 1] + V[i + 2] * V[i + 2];
    }
  }
  const P = posA.array;
  for (let i = 0; i < n * 3; i++) P[i] = REST[i] + D[i];
  posA.needsUpdate = true;
  geo.computeVertexNormals();
  if (!grabbing && e < 1e-7 * n) sleeping = true;
}

// Stretch-sound state.
let speedAcc = 0, speed = 0, prevLen = 0;
let ry = 0, rx = 0;

// Advance one frame; `t` is elapsed seconds (drives the idle bob).
export function stepSquish(dt, t) {
  if (mesh) sim(dt);
  if (!grabbing) {
    const f = Math.min(1, dt * 6), m = isImg ? .6 : 1;
    ry += (yaw + look.x * .5 * m - ry) * f;
    rx += (pitch - look.y * .3 * m - rx) * f;
    pivot.rotation.set(rx, ry, 0);
  }
  pivot.position.y = Math.sin(t * 1.7) * .035;

  const ctx = audio.ctx;
  if (ctx) {
    const { osc, filter, gain } = audio.creak;
    speed += (speedAcc / dt - speed) * .25;
    speedAcc = 0;
    const len = gd.length();
    gain.gain.setTargetAtTime(grabbing ? Math.min(.08, speed * .025) : 0, ctx.currentTime, .04);
    osc.frequency.setTargetAtTime(110 + len * 230, ctx.currentTime, .05);
    filter.frequency.setTargetAtTime((110 + len * 230) * 4, ctx.currentTime, .05);
    if (grabbing && Math.floor(len * 4) > Math.floor(prevLen * 4)) tone('sine', 500 + len * 300, 800 + len * 300, .05, .05);
    prevLen = len;
  }
  renderer.render(scene, camera);
}

function setNDC(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  look.x = ndc.x;
  look.y = ndc.y;
}

function initPointer() {
  let lx = 0, ly = 0, hoverT = 0, pid = null;

  canvas.addEventListener('pointerdown', e => {
    if (pid !== null || !mesh) return;
    initAudio();
    setNDC(e);
    ray.setFromCamera(ndc, camera);
    const hit = e.button === 0 ? ray.intersectObject(mesh)[0] : null;
    pid = e.pointerId;
    canvas.setPointerCapture(pid);
    lx = e.clientX;
    ly = e.clientY;
    if (!hit) {
      orbiting = true;
      return;
    }
    // Weight vertices by a Gaussian around the nearest vertex of the hit face.
    const f = hit.face, lp = mesh.worldToLocal(hit.point.clone());
    let best = f.a, bd = 1e9;
    for (const v of [f.a, f.b, f.c]) {
      const d = tmp.fromBufferAttribute(posA, v).distanceToSquared(lp);
      if (d < bd) { bd = d; best = v; }
    }
    const cx = REST[best * 3], cy = REST[best * 3 + 1], cz = REST[best * 3 + 2], r = +$('rad').value, k = 1 / (2 * r * r);
    for (let v = 0; v < n; v++) {
      const dx = REST[v * 3] - cx, dy = REST[v * 3 + 1] - cy, dz = REST[v * 3 + 2] - cz;
      const w = Math.exp(-(dx * dx + dy * dy + dz * dz) * k);
      W[v] = w < .002 ? 0 : w;
    }
    startPt.copy(hit.point);
    camera.getWorldDirection(tmp);
    plane.setFromNormalAndCoplanarPoint(tmp, startPt);
    gd.set(0, 0, 0);
    prevLen = 0;
    grabbing = true;
    sleeping = false;
    canvas.classList.add('grabbing');
    sfx.grab();
  });

  canvas.addEventListener('pointermove', e => {
    setNDC(e);
    if (e.pointerId === pid && grabbing) {
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, tmp)) {
        tmp.sub(startPt);
        if (tmp.length() > 3) tmp.setLength(3);
        mesh.getWorldQuaternion(q);
        q.invert();
        tmp.applyQuaternion(q);
        speedAcc += tmp.distanceTo(gd);
        gd.copy(tmp);
      }
    } else if (e.pointerId === pid && orbiting) {
      yaw += (e.clientX - lx) * .01;
      pitch = clamp(pitch + (e.clientY - ly) * .01, -1.2, 1.2);
      lx = e.clientX;
      ly = e.clientY;
    } else if (pid === null && mesh && performance.now() - hoverT > 90) {
      hoverT = performance.now();
      ray.setFromCamera(ndc, camera);
      canvas.classList.toggle('can-grab', ray.intersectObject(mesh).length > 0);
    }
  });

  const end = e => {
    if (e.pointerId !== pid) return;
    pid = null;
    if (grabbing) {
      grabbing = false;
      canvas.classList.remove('grabbing');
      // Freeze bakes the current pull into the rest target.
      if (freeze) {
        for (let v = 0; v < n; v++) {
          const w = W[v];
          if (w) {
            BASE[v * 3] += w * gd.x;
            BASE[v * 3 + 1] += w * gd.y;
            BASE[v * 3 + 2] += w * gd.z;
          }
        }
      }
      if (freeze) sfx.blip(); else sfx.boing(gd.length());
      gd.set(0, 0, 0);
    }
    orbiting = false;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => {
    if (pid === null) {
      look.x *= .5;
      look.y *= .5;
    }
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    camera.position.z = clamp(camera.position.z * (1 + Math.sign(e.deltaY) * .08), 2.3, 9);
  }, { passive: false });
}

function initControls() {
  $('bReset').onclick = () => { initAudio(); resetSquish(); };
  $('freeze').onchange = e => { freeze = e.target.checked; initAudio(); sfx.blip(); };
  const setCol = v => meshMat.color.set(v).convertSRGBToLinear();
  setCol($('col').value);
  $('col').addEventListener('input', e => setCol(e.target.value));
  $('col').addEventListener('change', () => { initAudio(); sfx.blip(); });
  ['rad', 'wob'].forEach(id => $(id).addEventListener('change', () => sfx.blip()));
}

export function initSquish() {
  initPointer();
  initControls();
}
