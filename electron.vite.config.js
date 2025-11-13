const { resolve } = require('path');
const { defineConfig } = require('electron-vite');
const vue = require('@vitejs/plugin-vue');

module.exports = defineConfig({
  main: {
    build: {
      outDir: resolve(__dirname, 'dist-electron'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.js'),
          spotifyService: resolve(__dirname, 'src/lib/spotifyService.js')
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'index') {
              return 'main/[name].js';
            }

            return 'lib/[name].js';
          }
        }
      }
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
