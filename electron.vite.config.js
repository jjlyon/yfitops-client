const { resolve } = require('path');
const { defineConfig } = require('electron-vite');
const vue = require('@vitejs/plugin-vue');

module.exports = defineConfig({
  main: {
    entry: 'src/main/index.js'
  },
  preload: {
    input: {
      index: resolve(__dirname, 'src/preload/index.js')
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: resolve(__dirname, 'dist/renderer'),
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
