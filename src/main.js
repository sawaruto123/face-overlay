import {
  FaceLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import {
  AutoBlinker,
  detectExpression,
  ExpressionSmoother,
  parseBlendshapes,
} from './blendshapes.js';
import { micThresholdFromSensitivity } from './audio.js';
import { getFaceBounds, getHeadYaw } from './landmarks.js';
import {
  applyBackgroundMode,
  applyCustomImages,
  clearCanvas,
  drawDebugBounds,
  drawOverlay,
  drawStatus,
  drawVideoFrame,
  preloadAssets,
} from './render.js';
import { getMicLevel, getSettings, initSettings, onSettingsUpdate, setupSettingsPanel, updateLiveExpression } from './settings-panel.js';

// Local bundled assets (see scripts/prepare-assets.mjs) — no CDN dependency.
const WASM_PATH = './wasm';
const MODEL_PATH = './models/face_landmarker.task';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('overlay'));
const ctx = canvas.getContext('2d');
const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.muted = true;

const params = new URLSearchParams(window.location.search);
const debug = params.get('debug') === '1';

/** @type {FaceLandmarker | null} */
let faceLandmarker = null;
let lastVideoTime = -1;
let currentCameraDeviceId = null;
let lastLiveExpression = null;
const smoother = new ExpressionSmoother(120);
const autoBlinker = new AutoBlinker();

async function initMediaPipe() {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
  });
}

/** @param {string | null} deviceId */
async function startWebcam(deviceId) {
  // Stop any previous stream before requesting a new device.
  const previous = /** @type {MediaStream | null} */ (video.srcObject);
  previous?.getTracks().forEach((track) => track.stop());

  const stream = await navigator.mediaDevices.getUserMedia({
    video: deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });

  video.srcObject = stream;
  await video.play();
  currentCameraDeviceId = deviceId;
  resizeCanvas();
}

function resizeCanvas() {
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
}

function renderLoop() {
  if (!faceLandmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    requestAnimationFrame(renderLoop);
    return;
  }

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const result = faceLandmarker.detectForVideo(
      video,
      performance.now(),
    );

    const { overlayMode, sensitivity, scale, autoBlink, audioReactiveMouth, micSensitivity } = getSettings();

    clearCanvas(ctx, canvas.width, canvas.height);
    if (overlayMode === 'composited') {
      drawVideoFrame(ctx, video, canvas.width, canvas.height);
    }

    const landmarks = result.faceLandmarks?.[0];
    if (landmarks) {
      const bounds = getFaceBounds(landmarks, canvas.width, canvas.height);
      if (bounds) {
        const scores = parseBlendshapes(result.faceBlendshapes?.[0]);
        let rawExpression = detectExpression(scores, sensitivity);

        // Audio-reactive mouth only steps in when face-tracking itself isn't
        // showing anything more specific (happy/shocked/blink/brows-up keep
        // priority) — it just decides between neutral/mouth-open using mic
        // volume instead of (or alongside) jaw-tracking.
        if (audioReactiveMouth && (rawExpression === 'neutral' || rawExpression === 'mouth-open')) {
          const threshold = micThresholdFromSensitivity(micSensitivity);
          rawExpression = getMicLevel() > threshold ? 'mouth-open' : 'neutral';
        }

        const now = performance.now();
        let expression = smoother.update(rawExpression, now);
        if (autoBlink) {
          expression = autoBlinker.apply(expression, now);
        }
        const yaw = getHeadYaw(landmarks);

        if (expression !== lastLiveExpression) {
          lastLiveExpression = expression;
          updateLiveExpression(expression);
        }

        drawOverlay(ctx, expression, bounds, yaw, scale);

        if (debug) {
          drawDebugBounds(ctx, expression, bounds);
        }
      }
    } else if (debug) {
      drawStatus(ctx, 'No face detected');
    }
  }

  requestAnimationFrame(renderLoop);
}

async function main() {
  try {
    drawStatus(ctx, 'Loading MediaPipe…');
    canvas.width = 1280;
    canvas.height = 720;

    const settings = await initSettings();
    applyBackgroundMode(settings.overlayMode, settings.chromaColor);
    applyCustomImages(settings.customImages);

    await Promise.all([preloadAssets(), initMediaPipe()]);
    drawStatus(ctx, 'Starting webcam…');

    // getUserMedia has to be called at least once before device labels are
    // exposed to enumerateDevices(), so start the webcam before the panel
    // (which lists cameras) is wired up.
    await startWebcam(settings.cameraDeviceId);
    await setupSettingsPanel();

    onSettingsUpdate((updated) => {
      applyBackgroundMode(updated.overlayMode, updated.chromaColor);
      if (updated.cameraDeviceId !== currentCameraDeviceId) {
        startWebcam(updated.cameraDeviceId).catch((err) => {
          console.error('Failed to switch camera:', err);
          drawStatus(ctx, 'Failed to switch camera — check Settings');
        });
      }
    });

    clearCanvas(ctx, canvas.width, canvas.height);
    renderLoop();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to start face overlay';
    clearCanvas(ctx, canvas.width, canvas.height);
    drawStatus(ctx, message);
    console.error(error);
  }
}

main();

