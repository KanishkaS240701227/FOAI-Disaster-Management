import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Unusual ports on purpose: 5173 / 4173 / 8000 are usually taken by other projects on the same machine.
const api = { '/api': { target: 'http://127.0.0.1:8765', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5273, strictPort: true, host: true, proxy: api },
  preview: { port: 5273, strictPort: true, host: true, proxy: api },
});
