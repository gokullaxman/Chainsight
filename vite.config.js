import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ASSUMPTION: Standard Vite config, no custom base path needed for local dev
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
