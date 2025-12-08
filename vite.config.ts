import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to avoid "Property 'cwd' does not exist on type 'Process'" error
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    root: '.',
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client/src'),
      },
    },
    publicDir: 'client/public',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    // CRITICAL FIX: This injects the API key into the client-side code
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Ensure process.env is defined to avoid crashes in some libraries
      'process.env': JSON.stringify(env) 
    }
  };
});