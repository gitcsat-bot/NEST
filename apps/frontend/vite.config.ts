import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Dev-only proxy to the backend so the browser's same-origin cookie
// behavior matches what Caddy provides in staging/prod (ADR-007) —
// avoids a dev-specific CORS configuration diverging from the real one.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@nest/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
    },
  },
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});