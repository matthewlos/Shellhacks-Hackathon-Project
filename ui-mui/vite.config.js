import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The model is ../ui/sim.js (shared with the plain-JS page), so the dev server may read one level up.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { fs: { allow: ['..'] } },
});
