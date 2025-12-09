import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  // Removed alias '@' to ensure relative paths are used consistently
  root: '.',
  publicDir: 'client/public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});