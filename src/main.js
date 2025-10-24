const path = require('path');
require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron');
const { SpotifyService } = require('./lib/spotifyService');

const enableSearch = process.env.ENABLE_SEARCH ? process.env.ENABLE_SEARCH !== 'false' : true;

const spotifyService = new SpotifyService({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:4350/callback'
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 640,
    backgroundColor: '#191414',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

ipcMain.handle('spotify:isConfigured', () => {
  return spotifyService.isConfigured();
});

ipcMain.handle('spotify:isAuthenticated', () => {
  return spotifyService.isAuthenticated();
});

ipcMain.handle('spotify:login', async () => {
  return spotifyService.login();
});

ipcMain.handle('spotify:getCurrentUser', async () => {
  return spotifyService.getCurrentUserProfile();
});

ipcMain.handle('spotify:search', async (_event, query) => {
  if (!enableSearch) {
    throw new Error('Global search is currently disabled.');
  }

  return spotifyService.searchCatalog(query);
});

ipcMain.handle('spotify:getAlbum', async (_event, albumId) => {
  if (!enableSearch) {
    throw new Error('Global search is currently disabled.');
  }

  return spotifyService.getAlbum(albumId);
});

ipcMain.handle('spotify:queueEnsure', async () => {
  console.info('[ipc] queueEnsure invoked');
  const playlistId = await spotifyService.ensureQueuePlaylist();
  console.info('[ipc] queueEnsure completed', { playlistId });
  return {
    playlistId,
    playlistUri: playlistId ? `spotify:playlist:${playlistId}` : null
  };
});

ipcMain.handle('spotify:queueAppend', async (_event, trackUris) => {
  console.info('[ipc] queueAppend invoked', {
    trackCount: Array.isArray(trackUris) ? trackUris.length : 0
  });
  const result = await spotifyService.appendQueueTracks(trackUris);
  console.info('[ipc] queueAppend completed', {
    playlistId: result.playlistId,
    appendedCount: result.appendedCount
  });
  return result;
});

ipcMain.handle('spotify:queuePlayNext', async (_event, payload) => {
  console.info('[ipc] queuePlayNext invoked', payload || {});
  const result = await spotifyService.moveQueueBlockAfterCurrent(payload || {});
  console.info('[ipc] queuePlayNext completed', {
    playlistId: result.playlistId,
    rangeStart: result.rangeStart,
    rangeLength: result.rangeLength
  });
  return result;
});

ipcMain.handle('spotify:getPlaybackContext', async () => {
  console.info('[ipc] getPlaybackContext invoked');
  const context = await spotifyService.getPlaybackContext();
  console.info('[ipc] getPlaybackContext completed', {
    hasContext: Boolean(context)
  });
  return context;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
