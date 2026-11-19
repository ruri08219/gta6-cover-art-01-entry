// Draws the cover onto any canvas: per-panel photos with crop/zoom, a
// gradient-map grade per panel, Anton + Pacifico lettering, a badge ribbon,
// and optional film grain and vignette. Deterministic — no time or random
// input; the grain pattern comes from a fixed-seed generator.
import { GRADES, EXPORT_SIZES, layoutPanels, fitPanels } from './state.js';

const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d');

// Fixed-seed PRNG (mulberry32) so the grain pattern is identical every run.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const rand = mulberry32(20261119);
  const tile = document.createElement('canvas');
  tile.width = 160; tile.height = 160;
  const c = tile.getContext('2d');
  const img = c.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 28;
  }
  c.putImageData(img, 0, 0);
  grainTile = tile;
  return tile;
}

/** Build a 256-entry RGB lookup table from a grade's gradient stops. */
export function buildLut(gradeKey) {
  const stops = GRADES[gradeKey].stops;
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    for (let ch = 0; ch < 3; ch++) {
      lut[i * 3 + ch] = Math.round(a[1][ch] + (b[1][ch] - a[1][ch]) * f);
    }
  }
  return lut;
}

/** Map every pixel through the gradient-map LUT by its luminance. */
function applyGrade(imageData, lut) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    const o = lum * 3;
    d[i] = lut[o]; d[i + 1] = lut[o + 1]; d[i + 2] = lut[o + 2];
  }
  return imageData;
}

/** Draw one photo into a rect, cover-fit, with zoom and pan offsets.
 *  The pan is clamped so the photo can never slide off and expose the
 *  background behind it. */
function drawPhotoInto(ctx, img, x, y, w, h, crop) {
  const zoom = crop.zoom || 1;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  let dx = x + (w - pw) / 2 + (crop.ox || 0) * w;
  let dy = y + (h - ph) / 2 + (crop.oy || 0) * h;
  dx = Math.max(x + w - pw, Math.min(x, dx));
  dy = Math.max(y + h - ph, Math.min(y, dy));
  ctx.drawImage(img, dx, dy, pw, ph);
}

/** Draw one panel: photo, grade, then its frame. Returns the panel rect in px. */
function drawPanel(ctx, panel, photo, crop, lut, W, H) {
  const x = panel.x * W;
  const y = panel.y * H;
  const w = panel.w * W;
  const h = panel.h * H;
  const rot = (panel.rot || 0) * Math.PI / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Render the graded photo on the offscreen canvas at panel resolution.
  const pw = Math.max(2, Math.round(w));
  const ph = Math.max(2, Math.round(h));
  offscreen.width = pw;
  offscreen.height = ph;
  offCtx.fillStyle = '#1a0b28';
  offCtx.fillRect(0, 0, pw, ph);
  if (photo) drawPhotoInto(offCtx, photo, 0, 0, pw, ph, crop);
  offCtx.putImageData(applyGrade(offCtx.getImageData(0, 0, pw, ph), lut), 0, 0);

  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  // Polaroid-style white frame for the tilted collage, thin dark frame otherwise.
  if (panel.rot) {
    ctx.fillStyle = '#fdf8ef';
    ctx.fillRect(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-w / 2 - 7, h / 2 - 1, w + 14, 8);
  }
  ctx.drawImage(offscreen, -w / 2, -h / 2, w, h);
  ctx.strokeStyle = panel.rot ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, W * 0.002);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  return { x, y, w, h, cx, cy };
}

function fitFont(ctx, text, fontFn, maxWidth, startSize) {
  let size = startSize;
  ctx.font = fontFn(size);
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size -= Math.max(1, Math.round(size * 0.04));
    ctx.font = fontFn(size);
  }
  return size;
}

/** The title block: scrim, Anton title, Pacifico subtitle, badge ribbon. */
function drawLettering(ctx, state, W, H) {
  const bandY = H * 0.79;
  const bandH = H - bandY;
  const scrim = ctx.createLinearGradient(0, bandY - H * 0.04, 0, H);
  scrim.addColorStop(0, 'rgba(12, 3, 24, 0)');
  scrim.addColorStop(0.35, 'rgba(12, 3, 24, 0.72)');
  scrim.addColorStop(1, 'rgba(12, 3, 24, 0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY - H * 0.04, W, bandH + H * 0.04);

  // Thin sunset rule above the title.
  const rule = ctx.createLinearGradient(0, 0, W, 0);
  rule.addColorStop(0, '#ff7a3c'); rule.addColorStop(0.5, '#ff2e88'); rule.addColorStop(1, '#7b2ff7');
  ctx.fillStyle = rule;
  ctx.fillRect(W * 0.08, bandY + bandH * 0.06, W * 0.84, Math.max(2, H * 0.004));

  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const badge = (state.badge || '').trim();
  const cx = W / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (title) {
    const base = state.titleSize === 'big' ? H * 0.115
      : state.titleSize === 'small' ? H * 0.075
      : H * 0.095;
    const size = fitFont(ctx, title, (s) => `${s}px Anton, 'Arial Narrow', sans-serif`, W * 0.9, base);
    const ty = bandY + bandH * 0.42;
    ctx.save();
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.02)}px`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.14);
    ctx.strokeStyle = '#12041f';
    ctx.strokeText(title, cx, ty);
    if (state.titleFill === 'gradient') {
      const g = ctx.createLinearGradient(cx - W * 0.4, ty - size / 2, cx + W * 0.4, ty + size / 2);
      g.addColorStop(0, '#ffd166'); g.addColorStop(0.45, '#ff7a3c');
      g.addColorStop(0.75, '#ff2e88'); g.addColorStop(1, '#c86bff');
      ctx.fillStyle = g;
    } else if (state.titleFill === 'neon') {
      ctx.fillStyle = '#ff2e88';
      ctx.shadowColor = '#ff2e88'; ctx.shadowBlur = size * 0.35;
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillText(title, cx, ty);
    ctx.restore();
  }

  if (subtitle) {
    const size = fitFont(ctx, subtitle, (s) => `${s}px Pacifico, cursive`, W * 0.72, H * 0.042);
    ctx.save();
    ctx.font = `${size}px Pacifico, cursive`;
    ctx.fillStyle = '#ffe9f4';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = size * 0.5;
    ctx.fillText(subtitle, cx, bandY + bandH * 0.76);
    ctx.restore();
  }

  if (badge) {
    const size = Math.max(12, H * 0.018);
    ctx.save();
    ctx.font = `700 ${size}px system-ui, sans-serif`;
    const tw = ctx.measureText(badge).width;
    const bw = tw + size * 2.2;
    const bh = size * 2.1;
    const bx = W - bw - W * 0.03;
    const by = H * 0.025;
    ctx.fillStyle = 'rgba(12, 3, 24, 0.78)';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = Math.max(1, H * 0.0015);
    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.fillText(badge, bx + bw / 2, by + bh / 2 + size * 0.06);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function applyFinish(ctx, state, W, H) {
  if (state.grain) {
    const tile = getGrainTile();
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(8,2,16,0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Draw the whole cover onto `canvas` at its own pixel size. */
export function drawCover(canvas, state) {
  fitPanels(state);
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const lut = buildLut(state.grade);
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#1a0b28');
  grad.addColorStop(1, '#0d0518');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const panels = layoutPanels(state);
  for (let i = 0; i < panels.length; i++) {
    const photo = state.photos[state.assign[i]]?.img ?? null;
    drawPanel(ctx, panels[i], photo, state.crops[i], lut, W, H);
  }
  drawLettering(ctx, state, W, H);
  applyFinish(ctx, state, W, H);
}

/** Render the cover at an export size into a fresh canvas. */
export function renderCover(sizeKey, state) {
  const size = EXPORT_SIZES[sizeKey];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  return canvas;
}
