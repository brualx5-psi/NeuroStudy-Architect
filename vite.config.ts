import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  // Removed publicDir explicit definition to avoid build errors if folder is missing
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
