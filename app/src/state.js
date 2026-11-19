// Vice Cover Studio state: six layouts, five gradient-map grades, per-panel photo
// assignment with crop/zoom, lettering, and an undo/redo history of snapshots.
// Photos themselves live outside the snapshots (images are not serialisable).

export const LAYOUTS = {
  grid4: {
    name: '4-Panel Grid',
    desc: 'Classic GTA poster grid — four equal panels, two by two.',
    panels: [
      { x: 0.00, y: 0.00, w: 0.49, h: 0.385 },
      { x: 0.51, y: 0.00, w: 0.49, h: 0.385 },
      { x: 0.00, y: 0.405, w: 0.49, h: 0.385 },
      { x: 0.51, y: 0.405, w: 0.49, h: 0.385 },
    ],
  },
  hero3: {
    name: 'Hero + Three',
    desc: 'One tall hero panel left, three stacked moments right.',
    panels: [
      { x: 0.00, y: 0.00, w: 0.60, h: 0.79 },
      { x: 0.62, y: 0.00, w: 0.38, h: 0.25 },
      { x: 0.62, y: 0.27, w: 0.38, h: 0.25 },
      { x: 0.62, y: 0.54, w: 0.38, h: 0.25 },
    ],
  },
  full: {
    name: 'Full Bleed',
    desc: 'One photo edge to edge, lettering over the sunset.',
    panels: [
      { x: 0.00, y: 0.00, w: 1.00, h: 0.79 },
    ],
  },
  grid9: {
    name: '9-Panel Grid',
    desc: 'A contact sheet of nine moments — the busiest poster.',
    panels: [
      { x: 0.000, y: 0.000, w: 0.320, h: 0.253 },
      { x: 0.340, y: 0.000, w: 0.320, h: 0.253 },
      { x: 0.680, y: 0.000, w: 0.320, h: 0.253 },
      { x: 0.000, y: 0.273, w: 0.320, h: 0.253 },
      { x: 0.340, y: 0.273, w: 0.320, h: 0.253 },
      { x: 0.680, y: 0.273, w: 0.320, h: 0.253 },
      { x: 0.000, y: 0.546, w: 0.320, h: 0.244 },
      { x: 0.340, y: 0.546, w: 0.320, h: 0.244 },
      { x: 0.680, y: 0.546, w: 0.320, h: 0.244 },
    ],
  },
  collage: {
    name: 'Tilted Snapshots',
    desc: 'Polaroid-style snapshots, tilted and overlapping like a corkboard.',
    panels: [
      { x: 0.02, y: 0.01, w: 0.46, h: 0.40, rot: -4 },
      { x: 0.52, y: 0.03, w: 0.46, h: 0.38, rot: 3 },
      { x: 0.06, y: 0.42, w: 0.44, h: 0.37, rot: 2 },
      { x: 0.54, y: 0.44, w: 0.42, h: 0.35, rot: -3 },
    ],
  },
  split: {
    name: 'Story / Poster Split',
    desc: 'Tall story panel left, poster stack right — built for portrait.',
    panels: [
      { x: 0.00, y: 0.00, w: 0.54, h: 0.79 },
      { x: 0.56, y: 0.00, w: 0.44, h: 0.385 },
      { x: 0.56, y: 0.405, w: 0.44, h: 0.385 },
    ],
  },
};

// Gradient-map stops: [luminance 0..1, [r, g, b]]. Shadows sit in the deep
// colour, mid-tones carry the sunset or neon, highlights bloom warm or icy.
export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    desc: 'Orange-pink dusk over purple shadows.',
    stops: [
      [0.00, [26, 6, 51]],
      [0.25, [122, 24, 96]],
      [0.55, [255, 94, 58]],
      [0.80, [255, 170, 90]],
      [1.00, [255, 214, 130]],
    ],
  },
  neon: {
    name: 'Neon Coast',
    desc: 'Teal water, magenta neon, hot pink highlights.',
    stops: [
      [0.00, [3, 14, 42]],
      [0.30, [6, 74, 96]],
      [0.55, [0, 229, 199]],
      [0.80, [255, 46, 136]],
      [1.00, [255, 214, 240]],
    ],
  },
  golden: {
    name: 'Golden Hour',
    desc: 'Honey light, amber mids, cream highlights.',
    stops: [
      [0.00, [26, 15, 0]],
      [0.30, [120, 58, 8]],
      [0.60, [255, 154, 60]],
      [0.85, [255, 205, 110]],
      [1.00, [255, 243, 196]],
    ],
  },
  night: {
    name: 'Night Drive',
    desc: 'Deep blue night, electric blue mids, neon pink glints.',
    stops: [
      [0.00, [2, 6, 23]],
      [0.30, [18, 44, 110]],
      [0.55, [46, 110, 220]],
      [0.80, [125, 211, 252]],
      [1.00, [255, 120, 200]],
    ],
  },
  noir: {
    name: 'Mono Noir',
    desc: 'Pure black and white — contrast, no colour.',
    stops: [
      [0.00, [0, 0, 0]],
      [0.35, [48, 48, 48]],
      [0.65, [150, 150, 150]],
      [1.00, [255, 255, 255]],
    ],
  },
};

export const EXPORT_SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square' },
  '1080x1350': { w: 1080, h: 1350, label: 'Poster' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape' },
  '1080x1920': { w: 1080, h: 1920, label: 'Story' },
};

/** A fresh default state. `photos` holds {id, name, img} and is kept apart. */
export function defaultState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    title: 'VICE HEIST',
    subtitle: 'Neon Coast Nights',
    badge: 'VICE CITY · 2026',
    titleFill: 'gradient',
    titleSize: 'auto',
    grain: true,
    vignette: true,
    exportSize: '1080x1350',
    photos: [],
    assign: [],
    crops: [],
    selectedPhoto: 0,
    selectedPanel: 0,
  };
}

/** Panels for the current layout, as fractions of the cover. */
export function layoutPanels(state) {
  return LAYOUTS[state.layout].panels;
}

/** Keep assign/crops the right length after a layout change, reusing old values. */
export function fitPanels(state) {
  const n = layoutPanels(state).length;
  while (state.assign.length < n) state.assign.push(state.selectedPhoto);
  while (state.crops.length < n) state.crops.push({ zoom: 1, ox: 0, oy: 0 });
  state.assign.length = n;
  state.crops.length = n;
  if (state.selectedPanel >= n) state.selectedPanel = 0;
}

/** A JSON snapshot of everything except the photo images (for undo/redo). */
export function snapshot(state) {
  const { photos, ...rest } = state;
  return JSON.stringify(rest);
}

/** Restore a snapshot, keeping the current photo list. */
export function restore(state, snap) {
  const photos = state.photos;
  const data = JSON.parse(snap);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, data, { photos });
}

/** Undo/redo history over snapshots. */
export function createHistory(state) {
  const past = [];
  const future = [];
  return {
    commit() {
      past.push(snapshot(state));
      if (past.length > 60) past.shift();
      future.length = 0;
    },
    undo() {
      if (!past.length) return false;
      future.push(snapshot(state));
      restore(state, past.pop());
      return true;
    },
    redo() {
      if (!future.length) return false;
      past.push(snapshot(state));
      restore(state, future.pop());
      return true;
    },
    canUndo() { return past.length > 0; },
    canRedo() { return future.length > 0; },
  };
}
