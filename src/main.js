const path = require('path');
require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron');
const { SpotifyService } = require('./lib/spotifyService');

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
