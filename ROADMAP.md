# Face Overlay — Project Overview & Roadmap

## What this is

A real-time facial expression overlay for streaming. Your webcam feed goes
through MediaPipe's Face Landmarker, which detects your expression
(neutral / happy / mouth-open / shocked / blink / brows-up), and matching
art is drawn over your face on a canvas — PNGTuber-style, but driven by
actual face tracking instead of push-to-talk.

It ships as a standalone Electron desktop app: a frameless floating window
with a system tray icon, global hotkeys, and an in-app settings panel. No
dev server, no browser tab, no OBS Browser Source workaround — you capture
the app window directly in OBS via Window Capture.

## Current features

- **Face tracking** — MediaPipe Face Landmarker (GPU-accelerated),
  6-expression detection with priority ordering and temporal smoothing so
  expressions don't flicker.
- **Overlay modes** — composited (video + art, opaque) or art-only with
  real OS-level window transparency (no chroma-key hack needed).
- **Settings panel** (⚙ gear icon):
  - Camera picker
  - Overlay mode
  - Sensitivity slider (adjusts detection thresholds)
  - Overlay size slider
  - Auto-blink — randomized idle blink so the avatar doesn't freeze
  - Audio-reactive mouth — drives the open-mouth art off mic volume as an
    alternative/supplement to jaw-tracking, with its own sensitivity slider
  - Per-expression custom art — pick your own image per expression via a
    native file picker; stored in the app, no manual file management
  - Window controls: always-on-top, click-through, reset position, hide, quit
- **System integration** — tray icon, global hotkeys (show/hide,
  click-through) that work even when the window isn't focused, window
  position/size persisted between launches.
- **Default art included** — a simple flat-style character with matching
  eyebrows/eyes/mouth per expression, plus editable SVG sources.
- **Distributable build** — `npm run dist` produces a portable `.exe` via
  electron-builder; no Node/npm needed to *run* the built app.

## Stack

MediaPipe Tasks Vision · Vite · Electron · Canvas API. Renderer code in
`src/`, Electron main/preload in `electron/`, default + editable art in
`assets/`.

## Known issues / fragile spots

- **No settings backup.** Camera choice, sensitivity, custom art — all of
  it lives only in the Electron app's local storage. No export/import, so
  reinstalling or clearing app data loses everything (this already bit us
  once with custom art getting overwritten by a file unzip — see below).
- **Expression thresholds are hand-tuned, not tested against a real face
  yet in most lighting/camera setups.** Sensitivity slider helps, but the
  underlying per-expression threshold *ratios* to each other haven't been
  validated broadly.
- **Overlay size/positioning** has only been build-verified (compiles,
  runs), not yet checked against a real camera for whether the art sits
  correctly on a real face at various distances/angles.
- **No app icon** — packaged builds currently use the generic Electron icon.
- **Custom art files aren't versioned separately from the project folder.**
  If you `git add` your own art without checking `git status` first, or
  unzip a fresh copy of the project over an existing one, personal art in
  `assets/expressions/` can get silently overwritten (this happened once
  already — recovered from an unstaged/uncommitted local copy, but there
  was no real backup).

## Roadmap — possible next steps

Roughly ordered easiest → most involved. None of this is scheduled/promised,
just a menu to pick from.

### Small, focused additions
- [ ] **Export/import settings** — a "Download my settings" / "Restore from
  file" pair in the settings panel, so custom art + preferences have an
  actual backup. Probably the single highest value-per-effort item given
  we've already had a couple of scares with lost/overwritten custom art.
- [ ] **"Away" state** — if no face is detected for N seconds, fade out or
  swap to a dedicated "away" image instead of freezing on the last
  expression.
- [ ] **Proper app icon** (`icon.ico`/`icon.png`) for window, tray, and the
  packaged build.
- [ ] **Auto-launch on Windows startup** (optional toggle).
- [ ] **Skip inference while hidden** — small CPU/GPU saving; no need to
  run full MediaPipe inference while the window is hidden via hotkey/tray.

### Bigger features
- [ ] **Presets/outfits** — named sets of custom art (e.g. "Casual",
  "Collab", "Special stream") with hotkey switching between them.
- [ ] **OBS WebSocket integration** — e.g. auto-switch OBS scenes when no
  face is detected for a while (auto-BRB).
- [ ] **Chat-triggered reactions** — Twitch/YouTube chat commands or
  events (subs, bits, `!wave`) trigger a temporary expression/animation.
  Most "streaming-native" idea here, also the most work (needs OAuth + a
  chat client integration).
- [ ] **Body/shoulders silhouette** — a simple static (non-tracked) body
  layer under the face art, so it reads as a full avatar rather than a
  floating head.

## Contributing notes for future sessions (human or AI)

- This file exists so a new session (human or AI) can get oriented quickly
  without re-deriving context from scratch. Keep it in sync — when
  something in "Roadmap" gets built, move it into "Current features" and
  drop it from the checklist.
- See git history / commit messages for the specific sequence of fixes
  already applied (e.g. the `app://` custom protocol fix for a black
  window on the packaged build — do not revert to raw `file://` loading).
- Custom art in `assets/expressions/` may be personal, not project
  defaults — check `git status` before overwriting or committing over it
  wholesale, and don't blindly replace it during future unzip/copy
  operations.
