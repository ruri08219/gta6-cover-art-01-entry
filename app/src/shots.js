// Fixed scenes for screenshots: ?shot=cover renders one exported cover full
// screen; ?shot=editor shows the editor with a sample photo loaded. Query
// params pick layout, grade, lettering and export size. window.__shotReady
// is set once the scene is painted and the fonts are loaded.
import { EXPORT_SIZES, fitPanels } from './state.js';

/** Apply the scene described by `query` to `state`, then paint it. */
export async function runShot(query, state, api) {
  const shot = query.get('shot');
  if (shot === 'cover') document.body.classList.add('shot-cover');

  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('title')) state.title = query.get('title');
  if (query.get('subtitle')) state.subtitle = query.get('subtitle');
  if (query.get('badge')) state.badge = query.get('badge');
  if (query.get('titleFill')) state.titleFill = query.get('titleFill');
  if (query.get('grain') === '0') state.grain = false;
  if (query.get('vignette') === '0') state.vignette = false;
  if (query.get('size') && EXPORT_SIZES[query.get('size')]) {
    state.exportSize = query.get('size');
  }
  fitPanels(state);
  api.syncControls();

  // Load the bundled samples, then spread them across the panels so every
  // panel shows a different crop of a photo.
  await api.loadSamples();
  const n = state.photos.length || 1;
  state.assign = state.assign.map((_, i) => i % n);
  state.crops = state.crops.map((_, i) => ({
    zoom: 1 + (i % 3) * 0.15,
    ox: ((i * 37) % 20 - 10) / 100,
    oy: ((i * 53) % 20 - 10) / 100,
  }));
  state.selectedPanel = 0;
  api.redraw();

  try { await document.fonts.ready; } catch { /* fonts still usable */ }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  // One more paint after the fonts settle, so Anton/Pacifico are really in.
  api.redraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
