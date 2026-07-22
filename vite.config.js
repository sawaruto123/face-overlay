import { defineConfig } from 'vite';

export default defineConfig({
  // Serve/copy the top-level `assets/` folder as static files
  // (so assets/expressions/happy.png -> /expressions/happy.png)
  publicDir: 'assets',
  // Relative paths so the built dist/index.html loads correctly from a
  // file:// URL inside the packaged Electron app (an absolute '/...' base
  // only works when served from an actual HTTP origin).
  base: './',
});
