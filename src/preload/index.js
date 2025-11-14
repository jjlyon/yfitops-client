import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('appInfo', {
  name: 'YFitOps Player',
  description: 'Placeholder shell for a future Spotify integration.'
});

contextBridge.exposeInMainWorld('spotify', {
  isConfigured: () => ipcRenderer.invoke('spotify:isConfigured'),
  isAuthenticated: () => ipcRenderer.invoke('spotify:isAuthenticated'),
  login: () => ipcRenderer.invoke('spotify:login'),
  getCurrentUser: () => ipcRenderer.invoke('spotify:getCurrentUser'),
  search: (query) => ipcRenderer.invoke('spotify:search', query),
  getAlbum: (albumId) => ipcRenderer.invoke('spotify:getAlbum', albumId),
  ensureQueue: () => ipcRenderer.invoke('spotify:queueEnsure'),
  queueAppend: (trackUris) => ipcRenderer.invoke('spotify:queueAppend', trackUris),
  queuePlayNext: (options) => ipcRenderer.invoke('spotify:queuePlayNext', options),
  getPlaybackContext: () => ipcRenderer.invoke('spotify:getPlaybackContext')
});
