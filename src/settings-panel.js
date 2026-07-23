import { EXPRESSIONS } from './blendshapes.js';
import { getExpressionImageSrc, setExpressionImage } from './render.js';

const STORAGE_KEY = 'face-overlay:settings';

/** @typedef {{ cameraDeviceId: string | null, overlayMode: 'composited' | 'transparent', chromaColor: string, alwaysOnTop: boolean, clickThrough: boolean, sensitivity: number, scale: number, customImages: Record<string, string> }} Settings */

/** @type {Settings} */
const DEFAULTS = {
  cameraDeviceId: null,
  overlayMode: 'composited',
  chromaColor: '#00ff00',
  alwaysOnTop: true,
  clickThrough: false,
  sensitivity: 50,
  scale: 1,
  customImages: {},
};

/** @type {Settings} */
let settings = { ...DEFAULTS };

/** @type {Array<(settings: Settings) => void>} */
const listeners = [];

const isElectron = typeof window !== 'undefined' && Boolean(window.faceOverlay?.isElectron);

// Small line-icon set (Feather-style: 24x24, currentColor, 1.8 stroke) used
// next to each settings section header — generic UI iconography, not
// branded/copyrighted art.
const ICONS = {
  camera: '<circle cx="12" cy="13" r="4"/><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
};

function icon(name, extraClass = '') {
  return `<svg class="fo-icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

function notify() {
  saveToStorage();
  for (const listener of listeners) listener({ ...settings });
}

/** @param {Partial<Settings>} partial */
function update(partial) {
  settings = { ...settings, ...partial };
  notify();
}

/** Load persisted settings (and Electron window state, if present). Call once before first render. */
export async function initSettings() {
  settings = { ...DEFAULTS, ...loadFromStorage() };

  if (isElectron) {
    try {
      const windowState = await window.faceOverlay.getWindowState();
      settings = { ...settings, ...windowState };
    } catch (err) {
      console.error('Failed to read Electron window state:', err);
    }
  }

  return { ...settings };
}

/** @returns {Settings} */
export function getSettings() {
  return { ...settings };
}

/** @param {(settings: Settings) => void} callback */
export function onSettingsUpdate(callback) {
  listeners.push(callback);
}

function injectStyles() {
  if (document.getElementById('face-overlay-settings-style')) return;
  const style = document.createElement('style');
  style.id = 'face-overlay-settings-style';
  style.textContent = `
    :root {
      --fo-ink: #16141c;
      --fo-glass: rgba(21, 19, 27, 0.78);
      --fo-glass-soft: rgba(255, 255, 255, 0.05);
      --fo-line: rgba(255, 255, 255, 0.09);
      --fo-text: #f4f0e6;
      --fo-text-dim: #a79fb3;
      --fo-accent: #ffd24d;
      --fo-accent-strong: #e0ad1f;
      --fo-danger: #ff6b6b;
      --fo-radius: 16px;
    }

    .fo-drag-strip {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 26px;
      -webkit-app-region: drag;
      z-index: 1000;
    }

    .fo-header {
      position: fixed;
      top: 10px; right: 10px;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 5px 12px 5px 5px;
      background: var(--fo-glass);
      backdrop-filter: blur(22px) saturate(160%);
      -webkit-backdrop-filter: blur(22px) saturate(160%);
      border: 1px solid var(--fo-line);
      border-radius: 999px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      -webkit-app-region: no-drag;
      z-index: 1002;
      cursor: pointer;
      font: 500 12px/1 -apple-system, 'Segoe UI', system-ui, sans-serif;
      transition: box-shadow 0.15s ease, transform 0.15s ease;
    }
    .fo-header:hover { transform: translateY(1px); box-shadow: 0 4px 14px rgba(0,0,0,0.4); }
    .fo-header:active { transform: translateY(2px) scale(0.98); }

    .fo-mascot {
      width: 30px; height: 30px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #2a2733, #16141c);
      border: 1.5px solid var(--fo-accent);
      box-shadow: 0 0 0 3px rgba(255, 210, 77, 0.12);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .fo-mascot img { width: 100%; height: 100%; object-fit: cover; }
    .fo-mascot.fo-pulse { animation: fo-pulse-ring 0.5s ease-out; }
    @keyframes fo-pulse-ring {
      0% { box-shadow: 0 0 0 3px rgba(255, 210, 77, 0.55); }
      100% { box-shadow: 0 0 0 3px rgba(255, 210, 77, 0.12); }
    }

    .fo-header-text {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }
    .fo-header-title {
      color: var(--fo-text);
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .fo-header-live {
      color: var(--fo-accent);
      font-size: 10.5px;
      text-transform: capitalize;
      letter-spacing: 0.02em;
    }

    .fo-panel {
      position: fixed;
      top: 54px; right: 10px;
      width: 292px;
      max-height: calc(100vh - 70px);
      overflow-y: auto;
      background: var(--fo-glass);
      backdrop-filter: blur(26px) saturate(160%);
      -webkit-backdrop-filter: blur(26px) saturate(160%);
      color: var(--fo-text);
      border: 1px solid var(--fo-line);
      border-radius: var(--fo-radius);
      padding: 8px;
      font: 13px/1.4 -apple-system, 'Segoe UI', system-ui, sans-serif;
      box-shadow: 0 20px 60px rgba(0,0,0,0.45);
      -webkit-app-region: no-drag;
      z-index: 1001;
      transform-origin: top right;
      opacity: 0;
      transform: scale(0.95) translateY(-4px);
      pointer-events: none;
      transition: opacity 0.14s ease, transform 0.14s ease;
    }
    .fo-panel.open {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }
    .fo-panel::-webkit-scrollbar { width: 8px; }
    .fo-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }

    .fo-section {
      padding: 10px 10px 12px;
      border-bottom: 1px solid var(--fo-line);
    }
    .fo-section:last-child { border-bottom: none; }

    .fo-section-title {
      display: flex;
      align-items: center;
      gap: 7px;
      margin: 0 0 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--fo-text-dim);
    }
    .fo-icon { width: 14px; height: 14px; color: var(--fo-accent); flex-shrink: 0; }

    .fo-field { margin-bottom: 10px; }
    .fo-field:last-child { margin-bottom: 0; }
    .fo-field-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
      color: var(--fo-text);
    }
    .fo-field-value {
      color: var(--fo-text-dim);
      font-variant-numeric: tabular-nums;
      font-size: 11.5px;
    }

    select {
      width: 100%;
      background: var(--fo-glass-soft);
      color: var(--fo-text);
      border: 1px solid var(--fo-line);
      border-radius: 8px;
      padding: 7px 8px;
      font: inherit;
    }
    select:focus-visible { outline: 2px solid var(--fo-accent); outline-offset: 1px; }

    input[type="range"] {
      -webkit-appearance: none;
      width: 100%;
      height: 5px;
      border-radius: 3px;
      background: var(--fo-glass-soft);
      outline: none;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 15px; height: 15px;
      border-radius: 50%;
      background: var(--fo-accent);
      border: 2px solid var(--fo-ink);
      box-shadow: 0 0 0 3px rgba(255, 210, 77, 0.2);
      cursor: pointer;
    }
    input[type="range"]:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--fo-text); }

    input[type="color"] {
      width: 100%;
      height: 30px;
      border-radius: 8px;
      border: 1px solid var(--fo-line);
      background: var(--fo-glass-soft);
      padding: 2px;
      cursor: pointer;
    }

    .fo-switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      padding: 2px 0;
    }
    .fo-switch-row .fo-field-label-text { color: var(--fo-text); }
    input.fo-switch {
      -webkit-appearance: none;
      width: 34px; height: 19px;
      border-radius: 999px;
      background: rgba(255,255,255,0.14);
      position: relative;
      flex-shrink: 0;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    input.fo-switch::after {
      content: '';
      position: absolute;
      top: 2px; left: 2px;
      width: 15px; height: 15px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.15s ease;
    }
    input.fo-switch:checked { background: var(--fo-accent-strong); }
    input.fo-switch:checked::after { transform: translateX(15px); }

    .fo-image-strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .fo-image-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 6px 4px 8px;
      border-radius: 10px;
      border: 1px solid transparent;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .fo-image-cell.fo-live {
      border-color: var(--fo-accent);
      background: rgba(255, 210, 77, 0.07);
    }
    .fo-image-cell .fo-thumb-btn {
      width: 48px; height: 48px;
      border-radius: 10px;
      border: 1px solid var(--fo-line);
      background: var(--fo-glass-soft);
      padding: 0;
      cursor: pointer;
      overflow: hidden;
    }
    .fo-image-cell .fo-thumb-btn img {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    }
    .fo-image-cell .fo-name {
      font-size: 10.5px;
      color: var(--fo-text-dim);
      text-transform: capitalize;
      text-align: center;
    }
    .fo-image-cell .fo-reset {
      display: none;
      border: none;
      background: none;
      color: var(--fo-danger);
      font-size: 10px;
      cursor: pointer;
      padding: 0;
    }
    .fo-image-cell.fo-has-custom .fo-reset { display: inline-block; }

    .fo-hotkeys {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 10px;
      font-size: 11.5px;
      color: var(--fo-text-dim);
    }
    .fo-hotkeys div { display: flex; justify-content: space-between; align-items: center; }
    kbd {
      background: rgba(255,255,255,0.08);
      border: 1px solid var(--fo-line);
      border-radius: 5px;
      padding: 2px 6px;
      font: 10.5px ui-monospace, 'SF Mono', Consolas, monospace;
      color: var(--fo-text);
    }

    .fo-actions {
      display: flex;
      gap: 6px;
      margin-top: 10px;
    }
    .fo-actions button {
      flex: 1;
      background: var(--fo-glass-soft);
      color: var(--fo-text);
      border: 1px solid var(--fo-line);
      border-radius: 8px;
      padding: 7px 6px;
      cursor: pointer;
      font: 500 11.5px inherit;
      transition: background 0.15s ease;
    }
    .fo-actions button:hover { background: rgba(255,255,255,0.1); }
    .fo-actions button.fo-danger { color: var(--fo-danger); }

    .fo-note {
      font-size: 11px;
      color: var(--fo-text-dim);
      line-height: 1.5;
    }
  `;
  document.head.appendChild(style);
}

function formatExpressionName(name) {
  return name.replace(/-/g, ' ');
}

function setSliderFill(slider) {
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  const pct = ((Number(slider.value) - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, var(--fo-accent) ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
}

/** Opens the Electron native file dialog, or a hidden <input type="file"> in a plain browser tab. Returns a data: URL or null. */
async function pickImageFile() {
  if (isElectron) {
    const result = await window.faceOverlay.chooseImage();
    return result?.dataUrl ?? null;
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(/** @type {string} */ (reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    input.click();
  });
}

/** Downscales a data: URL image so it stays well within localStorage limits. @param {string} dataUrl @param {number} [maxDim=768] */
function downscaleDataUrl(dataUrl, maxDim = 768) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const factor = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * factor));
      const h = Math.max(1, Math.round(img.height * factor));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function populateCameraOptions(select) {
  select.innerHTML = '<option value="">Default camera</option>';
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((d) => d.kind === 'videoinput');
    for (const camera of cameras) {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.textContent = camera.label || `Camera ${select.length}`;
      if (camera.deviceId === settings.cameraDeviceId) option.selected = true;
      select.appendChild(option);
    }
  } catch (err) {
    console.error('Failed to list cameras:', err);
  }
}

let mascotImg = null;
let mascotBtn = null;
let liveLabel = null;
let liveExpressionCells = new Map();

/** Called from the render loop whenever the detected expression changes — updates the live mascot button and highlights the matching row in Expression Art. @param {string} name */
export function updateLiveExpression(name) {
  if (mascotImg) {
    const src = getExpressionImageSrc(name);
    if (src) mascotImg.src = src;
  }
  if (liveLabel) liveLabel.textContent = formatExpressionName(name);
  if (mascotBtn) {
    mascotBtn.classList.remove('fo-pulse');
    void mascotBtn.offsetWidth;
    mascotBtn.classList.add('fo-pulse');
  }
  for (const [exprName, cell] of liveExpressionCells) {
    cell.classList.toggle('fo-live', exprName === name);
  }
}

/** Build and wire up the header + settings panel. Call once, after webcam permission has been granted. */
export async function setupSettingsPanel() {
  injectStyles();

  const dragStrip = document.createElement('div');
  dragStrip.className = 'fo-drag-strip';
  document.body.appendChild(dragStrip);

  const header = document.createElement('button');
  header.className = 'fo-header';
  header.title = 'Face Overlay settings';
  header.innerHTML = `
    <span class="fo-mascot" id="fo-mascot">
      <img id="fo-mascot-img" alt="" />
    </span>
    <span class="fo-header-text">
      <span class="fo-header-title">Face Overlay</span>
      <span class="fo-header-live" id="fo-live-label">neutral</span>
    </span>
  `;
  document.body.appendChild(header);

  mascotBtn = header.querySelector('#fo-mascot');
  mascotImg = header.querySelector('#fo-mascot-img');
  liveLabel = header.querySelector('#fo-live-label');
  const initialSrc = getExpressionImageSrc('neutral');
  if (initialSrc) mascotImg.src = initialSrc;

  const panel = document.createElement('div');
  panel.className = 'fo-panel';
  panel.innerHTML = `
    <div class="fo-section">
      <div class="fo-section-title">${icon('camera')}Camera</div>
      <div class="fo-field">
        <select id="fo-camera"></select>
      </div>
    </div>

    <div class="fo-section">
      <div class="fo-section-title">${icon('layers')}Overlay</div>
      <div class="fo-field">
        <select id="fo-mode">
          <option value="composited">Video + art (composited)</option>
          <option value="transparent">Art only (transparent window)</option>
        </select>
      </div>
      <div class="fo-field" id="fo-chroma-field" style="display:none">
        <div class="fo-field-label"><span>Fallback background</span></div>
        <input type="color" id="fo-chroma" />
      </div>
    </div>

    <div class="fo-section">
      <div class="fo-section-title">${icon('sliders')}Expression tuning</div>
      <div class="fo-field">
        <div class="fo-field-label"><span>Sensitivity</span><span class="fo-field-value" id="fo-sensitivity-value"></span></div>
        <input type="range" id="fo-sensitivity" min="0" max="100" step="1" />
      </div>
      <div class="fo-field">
        <div class="fo-field-label"><span>Overlay size</span><span class="fo-field-value" id="fo-scale-value"></span></div>
        <input type="range" id="fo-scale" min="50" max="200" step="5" />
      </div>
    </div>

    <div class="fo-section">
      <div class="fo-section-title">${icon('image')}Expression art</div>
      <div class="fo-image-strip" id="fo-custom-art-list"></div>
    </div>

    ${isElectron ? `
    <div class="fo-section">
      <div class="fo-section-title">${icon('monitor')}Window</div>
      <div class="fo-field">
        <label class="fo-switch-row">
          <span class="fo-field-label-text">Always on top</span>
          <input type="checkbox" class="fo-switch" id="fo-always-on-top" />
        </label>
      </div>
      <div class="fo-field">
        <label class="fo-switch-row">
          <span class="fo-field-label-text">Click-through</span>
          <input type="checkbox" class="fo-switch" id="fo-click-through" />
        </label>
      </div>
      <div class="fo-actions">
        <button id="fo-reset">Reset position</button>
        <button id="fo-hide">Hide</button>
        <button id="fo-quit" class="fo-danger">Quit</button>
      </div>
      <div class="fo-hotkeys">
        <div><span>Show / hide</span><kbd>Ctrl+Alt+F9</kbd></div>
        <div><span>Click-through</span><kbd>Ctrl+Alt+F10</kbd></div>
      </div>
    </div>` : `
    <div class="fo-section">
      <p class="fo-note">Running in a browser tab. Camera and window controls are limited — for the full app, run via Electron.</p>
    </div>`}
  `;
  document.body.appendChild(panel);

  header.addEventListener('click', () => panel.classList.toggle('open'));

  const cameraSelect = panel.querySelector('#fo-camera');
  await populateCameraOptions(cameraSelect);
  cameraSelect.addEventListener('change', () => {
    update({ cameraDeviceId: cameraSelect.value || null });
  });
  navigator.mediaDevices.addEventListener?.('devicechange', () => populateCameraOptions(cameraSelect));

  const modeSelect = panel.querySelector('#fo-mode');
  modeSelect.value = settings.overlayMode;
  const chromaField = panel.querySelector('#fo-chroma-field');
  const chromaInput = panel.querySelector('#fo-chroma');
  chromaInput.value = settings.chromaColor;
  chromaField.style.display = !isElectron && settings.overlayMode === 'transparent' ? 'block' : 'none';

  modeSelect.addEventListener('change', () => {
    chromaField.style.display = !isElectron && modeSelect.value === 'transparent' ? 'block' : 'none';
    update({ overlayMode: modeSelect.value });
  });
  chromaInput.addEventListener('input', () => {
    update({ chromaColor: chromaInput.value });
  });

  const sensitivitySlider = panel.querySelector('#fo-sensitivity');
  const sensitivityValue = panel.querySelector('#fo-sensitivity-value');
  sensitivitySlider.value = String(settings.sensitivity);
  sensitivityValue.textContent = String(settings.sensitivity);
  setSliderFill(sensitivitySlider);
  sensitivitySlider.addEventListener('input', () => {
    const value = Number(sensitivitySlider.value);
    sensitivityValue.textContent = String(value);
    setSliderFill(sensitivitySlider);
    update({ sensitivity: value });
  });

  const scaleSlider = panel.querySelector('#fo-scale');
  const scaleValue = panel.querySelector('#fo-scale-value');
  scaleSlider.value = String(Math.round(settings.scale * 100));
  scaleValue.textContent = `${scaleSlider.value}%`;
  setSliderFill(scaleSlider);
  scaleSlider.addEventListener('input', () => {
    scaleValue.textContent = `${scaleSlider.value}%`;
    setSliderFill(scaleSlider);
    update({ scale: Number(scaleSlider.value) / 100 });
  });

  const customArtList = panel.querySelector('#fo-custom-art-list');
  liveExpressionCells = new Map();
  for (const name of EXPRESSIONS) {
    const cell = document.createElement('div');
    cell.className = 'fo-image-cell';
    if (settings.customImages[name]) cell.classList.add('fo-has-custom');
    liveExpressionCells.set(name, cell);

    const thumbBtn = document.createElement('button');
    thumbBtn.className = 'fo-thumb-btn';
    thumbBtn.title = `Choose art for ${formatExpressionName(name)}`;
    const thumb = document.createElement('img');
    thumb.alt = name;
    const existingSrc = settings.customImages[name] || getExpressionImageSrc(name);
    if (existingSrc) thumb.src = existingSrc;
    thumbBtn.appendChild(thumb);

    thumbBtn.addEventListener('click', async () => {
      const raw = await pickImageFile();
      if (!raw) return;
      const dataUrl = await downscaleDataUrl(raw);
      update({ customImages: { ...settings.customImages, [name]: dataUrl } });
      setExpressionImage(name, dataUrl);
      thumb.src = dataUrl;
      cell.classList.add('fo-has-custom');
    });

    const label = document.createElement('span');
    label.className = 'fo-name';
    label.textContent = formatExpressionName(name);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'fo-reset';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const customImages = { ...settings.customImages };
      delete customImages[name];
      update({ customImages });
      setExpressionImage(name, null);
      const fallbackSrc = getExpressionImageSrc(name);
      if (fallbackSrc) thumb.src = fallbackSrc;
      else thumb.removeAttribute('src');
      cell.classList.remove('fo-has-custom');
    });

    cell.append(thumbBtn, label, resetBtn);
    customArtList.appendChild(cell);
  }

  if (isElectron) {
    const alwaysOnTopCheckbox = panel.querySelector('#fo-always-on-top');
    const clickThroughCheckbox = panel.querySelector('#fo-click-through');
    alwaysOnTopCheckbox.checked = settings.alwaysOnTop;
    clickThroughCheckbox.checked = settings.clickThrough;

    alwaysOnTopCheckbox.addEventListener('change', () => {
      window.faceOverlay.setAlwaysOnTop(alwaysOnTopCheckbox.checked);
    });
    clickThroughCheckbox.addEventListener('change', () => {
      window.faceOverlay.setClickThrough(clickThroughCheckbox.checked);
    });

    panel.querySelector('#fo-reset').addEventListener('click', () => window.faceOverlay.resetWindow());
    panel.querySelector('#fo-hide').addEventListener('click', () => window.faceOverlay.hideWindow());
    panel.querySelector('#fo-quit').addEventListener('click', () => window.faceOverlay.quit());

    window.faceOverlay.onWindowState(({ alwaysOnTop, clickThrough }) => {
      alwaysOnTopCheckbox.checked = alwaysOnTop;
      clickThroughCheckbox.checked = clickThrough;
      update({ alwaysOnTop, clickThrough });
    });
  }
}
