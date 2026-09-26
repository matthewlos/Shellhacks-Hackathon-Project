import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The model is ../ui/sim.js (shared with the plain-JS page), so the dev server may read one level up.
// /farmhand is the real box's data (farm-hand/cloud/receiver.py). In production it is same-origin; in dev it is
// proxied to the deployed server so `npm run dev` sees the same data.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    fs: { allow: ['..'] },
    proxy: { '/farmhand': { target: 'https://farmhand.dmchang.xyz', changeOrigin: true } },
  },
});
