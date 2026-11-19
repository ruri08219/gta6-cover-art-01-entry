// Wires the Vice Cover Studio page: photo uploads, panel picking, drag to pan
// and wheel to zoom per panel, layout/grade/lettering controls, undo/redo,
// PNG exports, and the fixed `?shot=` scenes used for screenshots.
import { drawCover, renderCover } from './cover.js';
import { LAYOUTS, GRADES, EXPORT_SIZES, defaultState, layoutPanels, fitPanels, createHistory } from './state.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const state = defaultState();
const history = createHistory(state);
let photoSeq = 0;

const $ = (id) => document.getElementById(id);

/** Load an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function setStatus(text) { statusEl.textContent = text; }

function redraw() {
  const size = EXPORT_SIZES[state.exportSize];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  drawCover(canvas, state);
  syncPanelBar();
  $('undo').disabled = !history.canUndo();
  $('redo').disabled = !history.canRedo();
}

function commit() {
  history.commit();
  redraw();
}

// ---- photo tray -----------------------------------------------------------

function renderTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  if (!state.photos.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No photos yet — add some, or load the samples.';
    tray.appendChild(p);
    return;
  }
  state.photos.forEach((photo, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `thumb${i === state.selectedPhoto ? ' active' : ''}`;
    b.title = photo.name;
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.name;
    const label = document.createElement('span');
    label.textContent = photo.name;
    b.append(img, label);
    b.addEventListener('click', () => {
      state.selectedPhoto = i;
      state.assign[state.selectedPanel] = i;
      commit();
      setStatus(`Panel ${state.selectedPanel + 1} now uses ${photo.name}.`);
    });
    tray.appendChild(b);
  });
}

async function addPhotoFile(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  state.photos.push({ id: ++photoSeq, name: file.name.replace(/\.[^.]+$/, ''), img, url });
  state.selectedPhoto = state.photos.length - 1;
  state.assign[state.selectedPanel] = state.selectedPhoto;
  commit();
  setStatus(`Added ${file.name}.`);
  renderTray();
}

async function loadSamples() {
  for (const name of ['pier', 'boulevard']) {
    if (state.photos.some((p) => p.name === name)) continue;
    try {
      const img = await loadImage(`samples/${name}.jpg`);
      state.photos.push({ id: ++photoSeq, name, img, url: `samples/${name}.jpg` });
    } catch { /* sample missing — keep going */ }
  }
  if (state.photos.length) {
    state.selectedPhoto = 0;
    state.assign = state.assign.map((_, i) => i % state.photos.length);
    commit();
    renderTray();
    setStatus('Sample photos loaded.');
  }
}

$('photos').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try { await addPhotoFile(file); } catch { setStatus(`Could not read ${file.name}.`); }
  }
  e.target.value = '';
});
$('load-samples').addEventListener('click', loadSamples);
$('fill-all').addEventListener('click', () => {
  if (!state.photos.length) { setStatus('Add a photo first.'); return; }
  state.assign = state.assign.map(() => state.selectedPhoto);
  commit();
  setStatus(`All panels filled from ${state.photos[state.selectedPhoto].name}.`);
});

// ---- layout + grade chips -------------------------------------------------

function buildChips(container, items, current, onPick) {
  const el = $(container);
  el.innerHTML = '';
  for (const [key, item] of Object.entries(items)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = key === current ? 'active' : '';
    b.dataset.key = key;
    const name = document.createElement('span');
    name.textContent = item.name;
    const desc = document.createElement('small');
    desc.textContent = item.desc;
    b.append(name, desc);
    b.addEventListener('click', () => onPick(key));
    el.appendChild(b);
  }
}

function refreshChips() {
  buildChips('layouts', LAYOUTS, state.layout, (key) => {
    state.layout = key;
    fitPanels(state);
    $('layout-desc').textContent = LAYOUTS[key].desc;
    commit();
  });
  buildChips('grades', GRADES, state.grade, (key) => {
    state.grade = key;
    commit();
  });
  $('layout-desc').textContent = LAYOUTS[state.layout].desc;
}

// ---- lettering + finish controls ------------------------------------------

function bindText(id, key) {
  $(id).addEventListener('input', (e) => {
    state[key] = e.target.value;
    redraw();
  });
  $(id).addEventListener('change', () => commit());
}
bindText('title', 'title');
bindText('subtitle', 'subtitle');
bindText('badge', 'badge');

$('title-fill').addEventListener('change', (e) => { state.titleFill = e.target.value; commit(); });
$('title-size').addEventListener('change', (e) => { state.titleSize = e.target.value; commit(); });
$('grain').addEventListener('change', (e) => { state.grain = e.target.checked; commit(); });
$('vignette').addEventListener('change', (e) => { state.vignette = e.target.checked; commit(); });
$('export-size').addEventListener('change', (e) => { state.exportSize = e.target.value; commit(); });

// ---- undo / redo ----------------------------------------------------------

$('undo').addEventListener('click', () => { if (history.undo()) { fitPanels(state); syncControls(); redraw(); renderTray(); } });
$('redo').addEventListener('click', () => { if (history.redo()) { fitPanels(state); syncControls(); redraw(); renderTray(); } });

function syncControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('badge').value = state.badge;
  $('title-fill').value = state.titleFill;
  $('title-size').value = state.titleSize;
  $('grain').checked = state.grain;
  $('vignette').checked = state.vignette;
  $('export-size').value = state.exportSize;
  refreshChips();
}

// ---- panel bar + canvas interaction ---------------------------------------

function syncPanelBar() {
  const bar = $('panel-bar');
  bar.innerHTML = '';
  const panels = layoutPanels(state);
  const i = state.selectedPanel;
  const photo = state.photos[state.assign[i]];
  const info = document.createElement('span');
  info.className = 'pill';
  info.innerHTML = `Panel <b>${i + 1} / ${panels.length}</b> · photo <b>${photo ? photo.name : 'none'}</b> · zoom <b>${(state.crops[i]?.zoom ?? 1).toFixed(2)}×</b>`;
  const prev = document.createElement('button');
  prev.type = 'button'; prev.textContent = '◀ Prev panel';
  prev.addEventListener('click', () => { state.selectedPanel = (i - 1 + panels.length) % panels.length; redraw(); });
  const next = document.createElement('button');
  next.type = 'button'; next.textContent = 'Next panel ▶';
  next.addEventListener('click', () => { state.selectedPanel = (i + 1) % panels.length; redraw(); });
  const reset = document.createElement('button');
  reset.type = 'button'; reset.textContent = 'Reset crop';
  reset.addEventListener('click', () => { state.crops[i] = { zoom: 1, ox: 0, oy: 0 }; commit(); });
  bar.append(prev, info, next, reset);
}

/** Which panel (if any) sits under a point on the displayed canvas. */
function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) / rect.width;
  const py = (clientY - rect.top) / rect.height;
  const panels = layoutPanels(state);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  state.selectedPanel = i;
  const crop = state.crops[i];
  drag = { x: e.clientX, y: e.clientY, ox: crop.ox, oy: crop.oy, moved: false };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const crop = state.crops[state.selectedPanel];
  const panel = layoutPanels(state)[state.selectedPanel];
  crop.ox = drag.ox + (e.clientX - drag.x) / rect.width / panel.w;
  crop.oy = drag.oy + (e.clientY - drag.y) / rect.height / panel.h;
  crop.ox = Math.max(-0.6, Math.min(0.6, crop.ox));
  crop.oy = Math.max(-0.6, Math.min(0.6, crop.oy));
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
  redraw();
});
canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  canvas.classList.remove('dragging');
  const moved = drag.moved;
  drag = null;
  if (moved) commit();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  state.selectedPanel = i;
  const crop = state.crops[i];
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  crop.zoom = Math.max(1, Math.min(4, crop.zoom * factor));
  commit();
}, { passive: false });

// ---- exports ---------------------------------------------------------------

function download(canvasEl, filename) {
  canvasEl.toBlob((blob) => {
    if (!blob) { setStatus('Export failed.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved ${filename}.`);
  }, 'image/png');
}

function exportSize(sizeKey) {
  const size = EXPORT_SIZES[sizeKey];
  const out = renderCover(sizeKey, state);
  download(out, `vice-cover-${size.w}x${size.h}.png`);
}

$('export-png').addEventListener('click', () => exportSize(state.exportSize));
$('export-1080').addEventListener('click', () => exportSize('1080x1080'));
$('export-1350').addEventListener('click', () => exportSize('1080x1350'));
$('export-1920').addEventListener('click', () => exportSize('1920x1080'));
$('export-story').addEventListener('click', () => exportSize('1080x1920'));

// ---- boot ------------------------------------------------------------------

const query = new URLSearchParams(location.search);
fitPanels(state);
refreshChips();
renderTray();
if (query.get('shot')) {
  runShot(query, state, { loadImage, loadSamples, redraw, setStatus, fitPanels, syncControls });
} else {
  loadSamples().then(() => { renderTray(); redraw(); });
  redraw();
}

// Exposed for the screenshot scenes.
window.__vice = { state, redraw, loadImage, loadSamples, renderCover };
