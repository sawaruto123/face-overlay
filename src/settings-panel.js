import { EXPRESSIONS } from './blendshapes.js';
import { setExpressionImage } from './render.js';

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

/** Merge in a partial settings update, persist, and notify listeners. @param {Partial<Settings>} partial */
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
    .fo-drag-strip {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 28px;
      -webkit-app-region: drag;
      z-index: 1000;
    }
    .fo-gear {
      position: fixed;
      top: 8px; right: 8px;
      width: 32px; height: 32px;
      border-radius: 50%;
      border: none;
      background: rgba(20, 20, 24, 0.55);
      color: #fff;
      font-size: 16px;
      cursor: pointer;
      -webkit-app-region: no-drag;
      z-index: 1001;
      transition: background 0.15s ease, transform 0.15s ease;
    }
    .fo-gear:hover { background: rgba(20, 20, 24, 0.85); transform: rotate(30deg); }
    .fo-panel {
      position: fixed;
      top: 48px; right: 8px;
      width: 280px;
      max-height: calc(100vh - 64px);
      overflow-y: auto;
      background: rgba(18, 18, 22, 0.92);
      color: #f2f2f5;
      border-radius: 10px;
      padding: 14px;
      font: 13px/1.4 system-ui, sans-serif;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      -webkit-app-region: no-drag;
      z-index: 1001;
      display: none;
    }
    .fo-panel.open { display: block; }
    .fo-panel h3 {
      margin: 0 0 10px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9a9aa5;
    }
    .fo-field { margin-bottom: 10px; }
    .fo-field label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      cursor: pointer;
    }
    .fo-field select, .fo-field input[type="color"] {
      width: 100%;
      margin-top: 4px;
      background: #1e1e24;
      color: #fff;
      border: 1px solid #3a3a44;
      border-radius: 6px;
      padding: 4px 6px;
    }
    .fo-field input[type="range"] {
      width: 100%;
      margin-top: 4px;
    }
    .fo-slider-label {
      display: flex;
      justify-content: space-between;
    }
    .fo-slider-value {
      color: #9a9aa5;
      font-variant-numeric: tabular-nums;
    }
    .fo-image-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .fo-image-row .fo-thumb {
      width: 32px; height: 32px;
      border-radius: 6px;
      object-fit: cover;
      background: #1e1e24;
      border: 1px solid #3a3a44;
      flex-shrink: 0;
    }
    .fo-image-row .fo-name {
      flex: 1;
      font-size: 12px;
      text-transform: capitalize;
    }
    .fo-image-row button {
      background: #2a2a32;
      color: #fff;
      border: 1px solid #3a3a44;
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 11px;
      white-space: nowrap;
    }
    .fo-image-row button:hover { background: #35353e; }
    .fo-image-row .fo-reset {
      display: none;
      color: #ff8a8a;
      border-color: #4a3232;
    }
    .fo-image-row.fo-has-custom .fo-reset { display: inline-block; }
    .fo-hint {
      font-size: 11px;
      color: #7c7c86;
      margin-top: 8px;
      border-top: 1px solid #33333c;
      padding-top: 8px;
    }
    .fo-actions {
      display: flex;
      gap: 6px;
      margin-top: 10px;
    }
    .fo-actions button {
      flex: 1;
      background: #2a2a32;
      color: #fff;
      border: 1px solid #3a3a44;
      border-radius: 6px;
      padding: 6px;
      cursor: pointer;
      font-size: 12px;
    }
    .fo-actions button:hover { background: #35353e; }
  `;
  document.head.appendChild(style);
}

function formatExpressionName(name) {
  return name.replace(/-/g, ' ');
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

/** Build and wire up the gear-icon settings panel. Call once, after webcam permission has been granted. */
export async function setupSettingsPanel() {
  injectStyles();

  const dragStrip = document.createElement('div');
  dragStrip.className = 'fo-drag-strip';
  document.body.appendChild(dragStrip);

  const gear = document.createElement('button');
  gear.className = 'fo-gear';
  gear.textContent = '⚙';
  gear.title = 'Settings';
  document.body.appendChild(gear);

  const panel = document.createElement('div');
  panel.className = 'fo-panel';
  panel.innerHTML = `
    <h3>Camera</h3>
    <div class="fo-field">
      <select id="fo-camera"></select>
    </div>

    <h3>Overlay</h3>
    <div class="fo-field">
      <label>
        Mode
        <select id="fo-mode">
          <option value="composited">Video + art (composited)</option>
          <option value="transparent">Art only (transparent window)</option>
        </select>
      </label>
    </div>
    <div class="fo-field" id="fo-chroma-field" style="display:none">
      <label>
        Fallback background (non-Electron)
        <input type="color" id="fo-chroma" />
      </label>
    </div>

    <h3>Reaction</h3>
    <div class="fo-field">
      <div class="fo-slider-label">
        <span>Sensitivity</span>
        <span class="fo-slider-value" id="fo-sensitivity-value"></span>
      </div>
      <input type="range" id="fo-sensitivity" min="0" max="100" step="1" />
    </div>
    <div class="fo-field">
      <div class="fo-slider-label">
        <span>Overlay size</span>
        <span class="fo-slider-value" id="fo-scale-value"></span>
      </div>
      <input type="range" id="fo-scale" min="50" max="200" step="5" />
    </div>

    <h3>Custom Art</h3>
    <div id="fo-custom-art-list"></div>

    ${isElectron ? `
    <h3>Window</h3>
    <div class="fo-field">
      <label><input type="checkbox" id="fo-always-on-top" /> Always on top</label>
    </div>
    <div class="fo-field">
      <label><input type="checkbox" id="fo-click-through" /> Click-through (mouse passes to apps behind)</label>
    </div>
    <div class="fo-actions">
      <button id="fo-reset">Reset position</button>
      <button id="fo-hide">Hide</button>
      <button id="fo-quit">Quit</button>
    </div>
    <div class="fo-hint">
      Hotkeys — Show/hide: Ctrl+Alt+F9 · Click-through: Ctrl+Alt+F10.<br/>
      Turning on click-through hides this panel behind your other windows —
      use the tray icon or hotkey to turn it back off.
    </div>` : `
    <div class="fo-hint">Running in a browser tab. Camera and window settings are limited — for the full app, run via Electron.</div>`}
  `;
  document.body.appendChild(panel);

  gear.addEventListener('click', () => panel.classList.toggle('open'));

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
  sensitivitySlider.addEventListener('input', () => {
    const value = Number(sensitivitySlider.value);
    sensitivityValue.textContent = String(value);
    update({ sensitivity: value });
  });

  const scaleSlider = panel.querySelector('#fo-scale');
  const scaleValue = panel.querySelector('#fo-scale-value');
  scaleSlider.value = String(Math.round(settings.scale * 100));
  scaleValue.textContent = `${scaleSlider.value}%`;
  scaleSlider.addEventListener('input', () => {
    scaleValue.textContent = `${scaleSlider.value}%`;
    update({ scale: Number(scaleSlider.value) / 100 });
  });

  const customArtList = panel.querySelector('#fo-custom-art-list');
  for (const name of EXPRESSIONS) {
    const row = document.createElement('div');
    row.className = 'fo-image-row';
    if (settings.customImages[name]) row.classList.add('fo-has-custom');

    const thumb = document.createElement('img');
    thumb.className = 'fo-thumb';
    thumb.alt = name;
    if (settings.customImages[name]) thumb.src = settings.customImages[name];

    const label = document.createElement('span');
    label.className = 'fo-name';
    label.textContent = formatExpressionName(name);

    const chooseBtn = document.createElement('button');
    chooseBtn.textContent = 'Choose…';
    chooseBtn.addEventListener('click', async () => {
      const raw = await pickImageFile();
      if (!raw) return;
      const dataUrl = await downscaleDataUrl(raw);
      update({ customImages: { ...settings.customImages, [name]: dataUrl } });
      setExpressionImage(name, dataUrl);
      thumb.src = dataUrl;
      row.classList.add('fo-has-custom');
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'fo-reset';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => {
      const customImages = { ...settings.customImages };
      delete customImages[name];
      update({ customImages });
      setExpressionImage(name, null);
      thumb.removeAttribute('src');
      row.classList.remove('fo-has-custom');
    });

    row.append(thumb, label, chooseBtn, resetBtn);
    customArtList.appendChild(row);
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
