import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import svgrPlugin from '@arco-plugins/vite-plugin-svgr';

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
        additionalData: `@import "${path.resolve(__dirname, './src/styles/utils.scss')}";\n`,
      },
    },
    devSourcemap: true,
  },
  server: {
    port: 5555,
    strictPort: false,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
});