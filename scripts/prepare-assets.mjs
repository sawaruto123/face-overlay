// Prepares local copies of the MediaPipe WASM runtime and the face landmarker
// model so the app runs fully offline with no CDN dependency.
// Run automatically before `vite build` (see package.json "prebuild").
import {
  mkdirSync,
  copyFileSync,
  readdirSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// 1) Copy MediaPipe WASM files from node_modules -> assets/wasm
//    (Vite's publicDir: 'assets' then copies them into dist/wasm).
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDst = join(root, 'assets', 'wasm');
if (existsSync(wasmSrc)) {
  mkdirSync(wasmDst, { recursive: true });
  for (const f of readdirSync(wasmSrc)) {
    copyFileSync(join(wasmSrc, f), join(wasmDst, f));
  }
  console.log('✓ Copied MediaPipe WASM -> assets/wasm');
} else {
  console.warn('⚠ @mediapipe/tasks-vision/wasm not found — run `npm install` first.');
}

// 2) Download the face landmarker model into assets/models (once; skipped if present).
const modelDir = join(root, 'assets', 'models');
const modelFile = join(modelDir, 'face_landmarker.task');
mkdirSync(modelDir, { recursive: true });
if (!existsSync(modelFile)) {
  const url =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download model: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(modelFile, buf);
  console.log('✓ Downloaded face_landmarker.task -> assets/models');
} else {
  console.log('✓ Model already present, skipping download.');
}
