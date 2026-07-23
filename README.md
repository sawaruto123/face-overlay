# Face Overlay

Real-time facial expression overlay for streaming, built on MediaPipe Face
Landmarker. Runs as a **standalone desktop app** (Electron) — no dev server,
no browser tab, no OBS Browser Source workaround. Just a floating window you
open, position, and capture in OBS like any other app window.

Replaces your face with custom art that reacts to your live expressions.

## Quick start (development)

```bash
npm install
npm run dev
```

A small frameless window pops up immediately with your webcam feed and
expression art. No URL to open — this **is** the app window.

Click the header pill (top-right of the window — your character's face in
a small circle, next to the current expression name) to open Settings.
That little circle isn't just a button — it's a live readout of whatever
expression is currently detected, updating in real time.

Inside:

- **Camera** — pick which webcam to use.
- **Overlay mode** — `Video + art` (composited, opaque) or `Art only`
  (real window transparency, for layering over a separate webcam source).
- **Reaction** — `Sensitivity` (how easily an expression triggers — higher
  reacts to smaller changes) and `Overlay size` (scale of the art relative
  to your detected face).
- **Custom Art** — replace any of the six built-in expressions with your
  own image via a file picker (thumbnail preview, `Reset` to go back to the
  default). Images are downscaled automatically and stored in the app so
  there's nothing to keep track of on disk — pick once and it persists
  between launches.
- **Window** — always-on-top, click-through, reset position, hide, quit.

Hotkeys (work even when the window doesn't have focus):

| Action | Hotkey |
|---|---|
| Show/hide the overlay | `Ctrl+Alt+F9` |
| Toggle click-through | `Ctrl+Alt+F10` |

There's also a tray icon with the same controls, for when the window is
hidden or click-through is on.

Add `?debug=1` to the dev URL (or set `ELECTRON_START_URL` accordingly)
to show face bounds and the active expression label.

## Building a standalone app (no npm/node needed to *run* it afterward)

```bash
npm run dist
```

This produces a portable `.exe` (Windows), `.dmg` (macOS), or `AppImage`
(Linux) under `release/`. Hand that file to yourself (or anyone else) and
double-clicking it launches the app directly — no terminal, no `npm run
dev`, nothing to host.

## OBS setup

1. Launch the app (dev or built `.exe`) — it's just a normal floating
   window now.
2. In OBS, add a **Window Capture** source (not Browser Source — Electron
   windows aren't Browser Sources) and select the Face Overlay window.
3. Position/resize the window wherever you want it on your desktop; OBS
   captures whatever the window shows.
4. If you want the overlay layered over a *separate* real webcam source
   (rather than the composited video+art view), switch Overlay mode to
   **Art only** in Settings. The window becomes truly transparent — for
   the transparency to carry through into OBS, set the Window Capture
   source's **Capture Method** to **Windows Graphics Capture** (Windows
   10 1903+). No chroma-key needed.
5. Prefer chroma-keying instead? Leave Overlay mode on **Art only**, run
   the app in a plain browser tab instead of Electron (`npm run dev` and
   open `http://localhost:5173` directly), and use the fallback solid
   background color from Settings with an OBS Chroma Key filter.

## Stack

- MediaPipe Tasks Vision (Face Landmarker)
- Vite (renderer bundling)
- Electron (app shell: frameless transparent window, tray, global hotkeys)
- Canvas API

## Expressions

The overlay switches between these states (priority order):

| Expression   | Trigger                          | Asset file              |
|-------------|-----------------------------------|-------------------------|
| `shocked`   | Jaw open + brows up + wide eyes   | `shocked.png`           |
| `mouth-open`| Jaw open                          | `mouth-open.png`        |
| `happy`     | Smile                             | `happy.png`             |
| `blink`     | Eyes closed                       | `blink.png`             |
| `brows-up`  | Raised brows                      | `brows-up.png`          |
| `neutral`   | Default                           | `neutral.png`           |

Supported formats: `.png`, `.svg`, `.webp`. If a file is missing, a colored
canvas placeholder is drawn instead.

## Custom art

Default art is already included in `assets/expressions/` — a simple flat
character with matching eyebrows/eyes/mouth per expression. Replace any of
them by dropping a same-named file into `assets/expressions/`, or use the
in-app **Custom Art** picker in Settings (no file management needed).

Editable vector sources for the built-in art live in
`assets/expressions-src/*.svg` — open them in any SVG/vector editor (or a
text editor, they're small hand-written SVGs) to recolor or restyle, then
re-export as PNG into `assets/expressions/` if you want to keep using
raster art, or just point the app at the `.svg` files directly (also
supported).

Place your own images in `assets/expressions/` using the filenames above.
Recommended: square or portrait PNGs with transparent backgrounds, sized
around 512×512 or larger.

## App icon (optional)

Drop an `icon.png` (and `icon.ico` for a proper Windows build icon) into
`electron/` — the window/tray/build config will pick it up automatically
if present, and fall back gracefully if not.

## Project layout

```
electron/
  main.cjs      # window, tray, global hotkeys, window-state persistence
  preload.cjs   # safe IPC bridge exposed to the renderer as window.faceOverlay
src/
  main.js             # render loop entry point
  settings-panel.js   # gear-icon settings UI
  render.js            # canvas drawing, background-mode handling
  landmarks.js         # face bounds / head yaw from MediaPipe landmarks
  blendshapes.js       # expression detection from blendshape scores
```
