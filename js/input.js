// Page-wide input: file pickers, paste, drag-and-drop and keyboard shortcuts.

import { $ } from './dom.js';
import { state } from './state.js';
import { initAudio, sfx } from './audio.js';
import { toast } from './ui/toast.js';
import { setTab } from './ui/tabs.js';
import { takeImageForKat } from './katImage.js';
import { spawn } from './spawner/spawner.js';
import { parseOBJ, merge } from './squish/mesh.js';
import { showMesh, showImage, resetSquish } from './squish/squish.js';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;

// Route a file: .obj -> squish mesh; image -> squish plane or the katamari image.
function loadFile(f, forSquish) {
  if (!f) return;
  const nm = f.name || 'pasted image';

  if (/\.obj$/i.test(nm)) {
    if (state.tab !== 'squish') setTab('squish');
    toast('Loading ' + nm + '…');
    const r = new FileReader();
    // Defer parsing a tick so the toast paints first.
    r.onload = () => setTimeout(() => {
      try {
        const o = parseOBJ(r.result);
        if (!o.idx.length) {
          toast('No faces found in that file. Export it as a mesh OBJ and try again.', true);
          sfx.err();
          return;
        }
        const m = merge(o.pos, o.idx);
        if (!m.idx.length) {
          toast('That mesh collapsed to nothing. Check its scale and faces.', true);
          sfx.err();
          return;
        }
        const verts = showMesh(m.pos, m.idx);
        toast(nm + ' loaded · ' + verts.toLocaleString() + ' verts');
        sfx.jingle();
      } catch (e) {
        toast('Could not read that OBJ.', true);
        sfx.err();
      }
    }, 30);
    r.readAsText(f);
  } else if (/^image\//.test(f.type) || IMAGE_EXT.test(nm)) {
    if (!forSquish) return takeImageForKat(f);
    const img = new Image();
    img.onload = () => {
      try {
        showImage(img);
        toast(nm + ' loaded');
        sfx.jingle();
      } catch (e) {
        toast('That image has no size. Try another file.', true);
        sfx.err();
      }
    };
    img.onerror = () => {
      toast('Your browser could not open that image. Try PNG, JPG or WebP.', true);
      sfx.err();
    };
    img.src = URL.createObjectURL(f);
  } else {
    toast('Pick an image (PNG, JPG, WebP, GIF) or a .obj file.', true);
    sfx.err();
  }
}

function initFilePickers() {
  $('kImg').onchange = e => {
    initAudio();
    const f = e.target.files[0];
    e.target.value = '';
    if (f) takeImageForKat(f);
  };
  $('file').onchange = e => {
    initAudio();
    loadFile(e.target.files[0], true);
    e.target.value = '';
  };
}

// K spawns (spawner); R resets and F toggles freeze (squish).
function initShortcuts() {
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    const k = e.key.toLowerCase();
    if (state.tab === 'squish') {
      if (k === 'r') resetSquish();
      else if (k === 'f') $('freeze').click();
    } else if (k === 'k') {
      initAudio();
      spawn();
    }
  });
}

function initPaste() {
  addEventListener('paste', e => {
    const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (it) {
      initAudio();
      loadFile(it.getAsFile(), state.tab === 'squish');
    }
  });
}

function initDragDrop() {
  const drop = $('drop');
  let depth = 0;
  const isFileDrag = e => [...(e.dataTransfer?.types || [])].includes('Files');
  const hideDrop = () => { depth = 0; drop.hidden = true; };

  addEventListener('dragenter', e => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    depth++;
    drop.hidden = false;
    drop.textContent = state.tab === 'squish' ? 'Drop to squish' : 'Drop to set katamari image';
  });
  addEventListener('dragover', e => { if (isFileDrag(e)) e.preventDefault(); });
  addEventListener('dragleave', e => { if (--depth <= 0 || !e.relatedTarget) hideDrop(); });
  addEventListener('dragend', hideDrop);
  addEventListener('pointerdown', hideDrop, true);
  addEventListener('blur', hideDrop);
  addEventListener('drop', e => {
    e.preventDefault();
    hideDrop();
    if (!e.dataTransfer?.files?.length) return;
    initAudio();
    loadFile(e.dataTransfer.files[0], state.tab === 'squish');
  });
}

export function initInput() {
  initFilePickers();
  initShortcuts();
  initPaste();
  initDragDrop();
}
