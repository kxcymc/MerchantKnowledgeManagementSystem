import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import svgrPlugin from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    react(),
    svgrPlugin({
      svgrOptions: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "${path.resolve(__dirname, './src/styles/utils.scss').replace(/\\/g, '/')}" as *;\n`,
        api: 'modern-compiler',
      },
    },
    devSourcemap: true,
  },
  server: {
    port: 5555,
    strictPort: false,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
});