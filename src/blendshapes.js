const BLENDSHAPE_NAMES = [
  '_neutral',
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookInRight',
  'eyeLookOutLeft',
  'eyeLookOutRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'eyeWideLeft',
  'eyeWideRight',
  'jawForward',
  'jawLeft',
  'jawOpen',
  'jawRight',
  'mouthClose',
  'mouthDimpleLeft',
  'mouthDimpleRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthFunnel',
  'mouthLeft',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthPucker',
  'mouthRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'noseSneerLeft',
  'noseSneerRight',
];

export const EXPRESSIONS = [
  'neutral',
  'happy',
  'mouth-open',
  'shocked',
  'blink',
  'brows-up',
];

const THRESHOLDS = {
  jawOpen: 0.35,
  mouthSmile: 0.45,
  eyeBlink: 0.55,
  browUp: 0.35,
  eyeWide: 0.4,
  shockedJaw: 0.25,
};

/** @typedef {'neutral' | 'happy' | 'mouth-open' | 'shocked' | 'blink' | 'brows-up'} Expression */

/**
 * @param {import('@mediapipe/tasks-vision').Classifications | undefined} classifications
 * @returns {Record<string, number>}
 */
export function parseBlendshapes(classifications) {
  const scores = Object.fromEntries(BLENDSHAPE_NAMES.map((name) => [name, 0]));
  if (!classifications?.categories?.length) return scores;

  for (const category of classifications.categories) {
    if (category.categoryName in scores) {
      scores[category.categoryName] = category.score ?? 0;
    }
  }

  return scores;
}

/**
 * Pick the dominant expression from raw blendshape scores.
 * Priority: shocked > mouth-open > happy > blink > brows-up > neutral
 * @param {Record<string, number>} scores
 * @param {number} [sensitivity=50] 0-100. Higher = triggers more easily (lower thresholds).
 * @returns {Expression}
 */
export function detectExpression(scores, sensitivity = 50) {
  const clamped = Math.max(0, Math.min(100, sensitivity));
  // 0 -> 1.5x thresholds (harder to trigger), 50 -> 1x (original tuning), 100 -> 0.5x (easier).
  const multiplier = 1.5 - clamped / 100;
  const t = {
    jawOpen: THRESHOLDS.jawOpen * multiplier,
    mouthSmile: THRESHOLDS.mouthSmile * multiplier,
    eyeBlink: THRESHOLDS.eyeBlink * multiplier,
    browUp: THRESHOLDS.browUp * multiplier,
    eyeWide: THRESHOLDS.eyeWide * multiplier,
    shockedJaw: THRESHOLDS.shockedJaw * multiplier,
  };

  const smile = (scores.mouthSmileLeft + scores.mouthSmileRight) / 2;
  const blink = (scores.eyeBlinkLeft + scores.eyeBlinkRight) / 2;
  const browsUp =
    Math.max(scores.browInnerUp, scores.browOuterUpLeft, scores.browOuterUpRight);
  const eyeWide = (scores.eyeWideLeft + scores.eyeWideRight) / 2;

  if (
    scores.jawOpen > t.shockedJaw &&
    browsUp > t.browUp &&
    eyeWide > t.eyeWide
  ) {
    return 'shocked';
  }

  if (scores.jawOpen > t.jawOpen) return 'mouth-open';
  if (smile > t.mouthSmile) return 'happy';
  if (blink > t.eyeBlink) return 'blink';
  if (browsUp > t.browUp) return 'brows-up';

  return 'neutral';
}

/**
 * Injects a brief randomized blink every few seconds when nothing else is
 * going on, so the avatar doesn't look frozen during quiet moments — purely
 * cosmetic, never overrides a real detected expression (including a real
 * blink, which just passes through unchanged).
 */
export class AutoBlinker {
  /** @param {{ minIntervalMs?: number, maxIntervalMs?: number, blinkDurationMs?: number }} [options] */
  constructor({ minIntervalMs = 2200, maxIntervalMs = 5500, blinkDurationMs = 160 } = {}) {
    this.minIntervalMs = minIntervalMs;
    this.maxIntervalMs = maxIntervalMs;
    this.blinkDurationMs = blinkDurationMs;
    this.nextBlinkAt = this._scheduleNext(typeof performance !== 'undefined' ? performance.now() : 0);
    this.blinkUntil = 0;
  }

  _scheduleNext(now) {
    return now + this.minIntervalMs + Math.random() * (this.maxIntervalMs - this.minIntervalMs);
  }

  /**
   * @param {Expression} expression The already-smoothed detected expression.
   * @param {number} now
   * @returns {Expression}
   */
  apply(expression, now) {
    if (expression !== 'neutral') return expression;

    if (now < this.blinkUntil) return 'blink';

    if (now >= this.nextBlinkAt) {
      this.blinkUntil = now + this.blinkDurationMs;
      this.nextBlinkAt = this._scheduleNext(now);
      return 'blink';
    }

    return expression;
  }
}

/**
 * Smooth expression changes to reduce flicker between frames.
 */
export class ExpressionSmoother {
  /** @param {number} [holdMs=120] */
  constructor(holdMs = 120) {
    this.holdMs = holdMs;
    this.current = /** @type {Expression} */ ('neutral');
    this.pending = /** @type {Expression | null} */ (null);
    this.pendingSince = 0;
  }

  /** @param {Expression} next @param {number} timestamp */
  update(next, timestamp) {
    if (next === this.current) {
      this.pending = null;
      return this.current;
    }

    if (this.pending !== next) {
      this.pending = next;
      this.pendingSince = timestamp;
      return this.current;
    }

    if (timestamp - this.pendingSince >= this.holdMs) {
      this.current = next;
      this.pending = null;
    }

    return this.current;
  }
}
