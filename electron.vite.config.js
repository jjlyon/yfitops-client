const { resolve } = require('path');
const { defineConfig } = require('electron-vite');
const vue = require('@vitejs/plugin-vue');

module.exports = defineConfig({
  main: {
    build: {
      outDir: resolve(__dirname, 'dist-electron/main'),
      emptyOutDir: true
    }
  },
  preload: {
    build: {
      outDir: resolve(__dirname, 'dist-electron/preload'),
      emptyOutDir: true
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: resolve(__dirname, 'dist-electron/renderer'),
      emptyOutDir: true
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer')
      }
    },
    plugins: [vue()]
  }
});
