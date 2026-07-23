import { defineConfig } from 'vite';

export default defineConfig({
  // Serve/copy the top-level `assets/` folder as static files
  // (so assets/expressions/happy.png -> /expressions/happy.png)
  publicDir: 'assets',
  // Relative paths so the built dist/index.html loads correctly regardless
  // of whether it's served from an HTTP origin or Electron's custom
  // app:// protocol (see electron/main.cjs).
  base: './',
});
