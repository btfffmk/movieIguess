import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  publicDir: 'public',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5502, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true }
});
