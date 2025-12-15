import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false, // Desativa mapas para economizar memória
    chunkSizeWarningLimit: 1600, // Aumenta limite de tamanho
    rollupOptions: {
      onwarn(warning, warn) {
        // Ignora o erro específico "MODULE_LEVEL_DIRECTIVE" que trava builds na Vercel
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        warn(warning);
      },
    }
  }
});
