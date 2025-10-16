const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  name: 'YFitOps Player',
  description: 'Placeholder shell for a future Spotify integration.'
});

contextBridge.exposeInMainWorld('spotify', {
  isConfigured: () => ipcRenderer.invoke('spotify:isConfigured'),
  isAuthenticated: () => ipcRenderer.invoke('spotify:isAuthenticated'),
  login: () => ipcRenderer.invoke('spotify:login'),
  getCurrentUser: () => ipcRenderer.invoke('spotify:getCurrentUser')
});
