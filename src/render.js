import { EXPRESSIONS } from './blendshapes.js';

const ASSET_EXTENSIONS = ['png', 'svg', 'webp'];

/** @type {Record<string, HTMLImageElement | null>} */
const images = Object.fromEntries(EXPRESSIONS.map((name) => [name, null]));

/** @type {Record<string, boolean>} */
const loadAttempted = Object.fromEntries(EXPRESSIONS.map((name) => [name, false]));

/**
 * @param {string} name
 * @returns {Promise<HTMLImageElement | null>}
 */
function loadImage(name) {
  if (images[name]) return Promise.resolve(images[name]);
  if (loadAttempted[name]) return Promise.resolve(null);
  loadAttempted[name] = true;

  return new Promise((resolve) => {
    let index = 0;

    const tryNext = () => {
      if (index >= ASSET_EXTENSIONS.length) {
        resolve(null);
        return;
      }

      const ext = ASSET_EXTENSIONS[index++];
      const img = new Image();
      img.onload = () => {
        images[name] = img;
        resolve(img);
      };
      img.onerror = tryNext;
      // import.meta.env.BASE_URL is '/' in dev (Vite dev server) and './'
      // in the production build, so this resolves correctly both from
      // http://localhost:5173 and from a packaged file:// dist/index.html.
      img.src = `${import.meta.env.BASE_URL}expressions/${name}.${ext}`;
    };

    tryNext();
  });
}

/** Preload all expression assets (PNG/SVG/WebP). Missing files use canvas fallbacks. */
export async function preloadAssets() {
  await Promise.all(EXPRESSIONS.map((name) => loadImage(name)));
}

/**
 * Override (or clear) the art used for one expression at runtime — used by
 * the settings panel's per-expression image picker.
 * @param {string} name
 * @param {string | null} dataUrl Pass a data: URL to set a custom image, or
 *   null to clear it and fall back to the asset file / placeholder.
 */
export function setExpressionImage(name, dataUrl) {
  if (!EXPRESSIONS.includes(name)) return;

  if (dataUrl) {
    loadAttempted[name] = true;
    const img = new Image();
    img.onload = () => {
      images[name] = img;
    };
    img.onerror = () => {
      console.error(`Failed to load custom image for "${name}"`);
    };
    img.src = dataUrl;
  } else {
    images[name] = null;
    loadAttempted[name] = false;
    loadImage(name);
  }
}

/**
 * Apply a previously-persisted set of custom images (from settings) at
 * startup, before the render loop starts.
 * @param {Record<string, string>} customImages
 */
export function applyCustomImages(customImages = {}) {
  for (const [name, dataUrl] of Object.entries(customImages)) {
    setExpressionImage(name, dataUrl);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} expression
 * @param {{ x: number, y: number, width: number, height: number, centerX: number, centerY: number }} bounds
 * @param {number} yaw
 * @param {number} [scale=1] Size multiplier applied around the same center point.
 */
export function drawOverlay(ctx, expression, bounds, yaw = 0, scale = 1) {
  const scaledBounds = scale === 1 ? bounds : {
    ...bounds,
    width: bounds.width * scale,
    height: bounds.height * scale,
  };
  const img = images[expression];
  if (img) {
    drawImageOverlay(ctx, img, scaledBounds, yaw);
  } else {
    drawFallbackOverlay(ctx, expression, scaledBounds, yaw);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {{ x: number, y: number, width: number, height: number, centerX: number, centerY: number }} bounds
 * @param {number} yaw
 */
function drawImageOverlay(ctx, img, bounds, yaw) {
  ctx.save();
  ctx.translate(bounds.centerX, bounds.centerY);
  ctx.rotate(yaw);
  ctx.drawImage(img, -bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height);
  ctx.restore();
}

/**
 * Simple colored placeholder until custom art is added to /assets/expressions/.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} expression
 * @param {{ x: number, y: number, width: number, height: number, centerX: number, centerY: number }} bounds
 * @param {number} yaw
 */
function drawFallbackOverlay(ctx, expression, bounds, yaw) {
  const styles = {
    neutral: { fill: '#ffd966', mouth: '—', eye: 'dot' },
    happy: { fill: '#ffb347', mouth: '◡', eye: 'dot' },
    'mouth-open': { fill: '#ff9f43', mouth: 'O', eye: 'dot' },
    shocked: { fill: '#ff6b6b', mouth: 'O', eye: 'wide' },
    blink: { fill: '#c8d6e5', mouth: '—', eye: 'line' },
    'brows-up': { fill: '#54a0ff', mouth: '—', eye: 'dot' },
  };

  const style = styles[expression] ?? styles.neutral;
  const { centerX, centerY, width, height } = bounds;
  const radius = Math.min(width, height) * 0.48;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(yaw);

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(2, radius * 0.04);
  ctx.stroke();

  const eyeY = -radius * 0.15;
  const eyeX = radius * 0.28;
  const eyeR = radius * 0.08;
  ctx.fillStyle = '#222';

  if (style.eye === 'line') {
    ctx.lineWidth = Math.max(2, radius * 0.05);
    ctx.strokeStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(-eyeX - eyeR, eyeY);
    ctx.lineTo(-eyeX + eyeR, eyeY);
    ctx.moveTo(eyeX - eyeR, eyeY);
    ctx.lineTo(eyeX + eyeR, eyeY);
    ctx.stroke();
  } else if (style.eye === 'wide') {
    for (const x of [-eyeX, eyeX]) {
      ctx.beginPath();
      ctx.ellipse(x, eyeY, eyeR * 1.2, eyeR * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (const x of [-eyeX, eyeX]) {
      ctx.beginPath();
      ctx.arc(x, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.font = `${radius * 0.55}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#222';
  ctx.fillText(style.mouth, 0, radius * 0.35);

  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} height */
export function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Set the page background for the current overlay mode.
 * - 'composited': the canvas fully covers the window with the real video
 *   frame drawn underneath the art, so the page background never shows —
 *   any color works here.
 * - 'transparent': only the expression art is drawn. In the Electron app
 *   the window itself is created with `transparent: true`, so a CSS
 *   background of `transparent` lets the desktop (or whatever's behind the
 *   window) show through with no chroma-keying needed. If this page is
 *   opened in a plain browser tab instead (no real window transparency),
 *   fall back to a solid chroma-key color so OBS chroma-key still works.
 * @param {'composited' | 'transparent'} mode
 * @param {string} chromaColor
 */
export function applyBackgroundMode(mode, chromaColor) {
  const isElectron = typeof window !== 'undefined' && Boolean(window.faceOverlay?.isElectron);
  if (mode === 'transparent') {
    document.documentElement.style.background = isElectron ? 'transparent' : chromaColor;
    document.body.style.background = isElectron ? 'transparent' : chromaColor;
  } else {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }
}

/**
 * Draw the raw webcam frame onto the canvas. Lets a single Browser Source
 * in OBS provide both the real video and the face-art overlay, so only one
 * consumer ever needs the camera (avoids exclusive-access conflicts with a
 * separate native Video Capture Device source).
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLVideoElement} video
 * @param {number} width
 * @param {number} height
 */
export function drawVideoFrame(ctx, video, width, height) {
  ctx.drawImage(video, 0, 0, width, height);
}

/** @param {CanvasRenderingContext2D} ctx @param {string} message */
export function drawStatus(ctx, message) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(12, 12, ctx.canvas.width - 24, 36);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, 24, 30);
  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx @param {string} expression @param {{ x: number, y: number, width: number, height: number, centerX: number, centerY: number }} bounds */
export function drawDebugBounds(ctx, expression, bounds) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 255, 128, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.fillStyle = 'rgba(0, 255, 128, 0.9)';
  ctx.font = '12px monospace';
  ctx.fillText(expression, bounds.x, bounds.y - 6);
  ctx.restore();
}
