/** Face oval landmark indices (MediaPipe 478-point mesh). */
export const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109,
];

/**
 * Compute a pixel-space bounding box from normalized face landmarks.
 * @param {Array<{x: number, y: number, z?: number}>} landmarks
 * @param {number} width
 * @param {number} height
 * @param {number} [padding=0.12] Fractional padding around the oval
 */
export function getFaceBounds(landmarks, width, height, padding = 0.12) {
  if (!landmarks?.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const index of FACE_OVAL_INDICES) {
    const point = landmarks[index];
    if (!point) continue;

    const x = point.x * width;
    const y = point.y * height;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX)) return null;

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  const padX = boxW * padding;
  const padY = boxH * padding;

  return {
    x: minX - padX,
    y: minY - padY,
    width: boxW + padX * 2,
    height: boxH + padY * 2,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * Estimate in-plane head rotation (radians) from landmark symmetry.
 * Positive = face turned to the viewer's right.
 */
export function getHeadYaw(landmarks) {
  const left = landmarks[234];
  const right = landmarks[454];
  const nose = landmarks[1];

  if (!left || !right || !nose) return 0;

  const midX = (left.x + right.x) / 2;
  const halfWidth = (right.x - left.x) / 2;
  if (Math.abs(halfWidth) < 1e-4) return 0;

  return Math.max(-0.6, Math.min(0.6, (nose.x - midX) / halfWidth)) * 0.5;
}
