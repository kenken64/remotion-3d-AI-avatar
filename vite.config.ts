import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/remotion',
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    // allow the Funnel hostname plus local hosts used during testing
    allowedHosts: ['openclaw-ff54485d.taile65e6a.ts.net', 'entire-dimension-gratuit-prophet.trycloudflare.com', 'relevant-control-part-alerts.trycloudflare.com', 'pill-berry-tahoe-incl.trycloudflare.com', 'episodes-job-lakes-squad.trycloudflare.com', 'butler-specialty-cemetery-travesti.trycloudflare.com', 'localhost', '127.0.0.1'],
  },
  resolve: {
    alias: {
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom', 'three'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
  },
});
