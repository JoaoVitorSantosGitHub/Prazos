import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import * as path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // base relativo: o app carrega dist/index.html por file://
  base: './',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { outDir: 'dist', emptyOutDir: true },
  test: { globals: true, include: ['electron/**/*.spec.ts', 'src/**/*.test.ts'] },
});
