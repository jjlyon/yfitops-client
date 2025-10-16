const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  name: 'YFitOps Player',
  description: 'Placeholder shell for a future Spotify integration.'
});
