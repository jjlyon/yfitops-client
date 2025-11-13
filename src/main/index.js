import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const spotifyModule = require('../lib/spotifyService.js');
const { SpotifyService } = spotifyModule || {};

if (typeof SpotifyService !== 'function') {
  throw new Error('SpotifyService module failed to load.');
}

const enableSearch = process.env.ENABLE_SEARCH ? process.env.ENABLE_SEARCH !== 'false' : true;

const spotifyService = new SpotifyService({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:4350/callback'
});

export const spotifyIpcHandlers = {
  'spotify:isConfigured': () => spotifyService.isConfigured(),
  'spotify:isAuthenticated': () => spotifyService.isAuthenticated(),
  'spotify:login': () => spotifyService.login(),
  'spotify:getCurrentUser': () => spotifyService.getCurrentUserProfile(),
  'spotify:search': (_event, query) => {
    if (!enableSearch) {
      throw new Error('Global search is currently disabled.');
    }

    return spotifyService.searchCatalog(query);
  },
  'spotify:getAlbum': (_event, albumId) => {
    if (!enableSearch) {
      throw new Error('Global search is currently disabled.');
    }

    return spotifyService.getAlbum(albumId);
  },
  'spotify:queueEnsure': async () => {
    console.info('[ipc] queueEnsure invoked');
    const playlistId = await spotifyService.ensureQueuePlaylist();
    console.info('[ipc] queueEnsure completed', { playlistId });
    return {
      playlistId,
      playlistUri: playlistId ? `spotify:playlist:${playlistId}` : null
    };
  },
  'spotify:queueAppend': async (_event, trackUris) => {
    console.info('[ipc] queueAppend invoked', {
      trackCount: Array.isArray(trackUris) ? trackUris.length : 0
    });
    const result = await spotifyService.appendQueueTracks(trackUris);
    console.info('[ipc] queueAppend completed', {
      playlistId: result.playlistId,
      appendedCount: result.appendedCount
    });
    return result;
  },
  'spotify:queuePlayNext': async (_event, payload) => {
    console.info('[ipc] queuePlayNext invoked', payload || {});
    const result = await spotifyService.moveQueueBlockAfterCurrent(payload || {});
    console.info('[ipc] queuePlayNext completed', {
      playlistId: result.playlistId,
      rangeStart: result.rangeStart,
      rangeLength: result.rangeLength
    });
    return result;
  },
  'spotify:getPlaybackContext': async () => {
    console.info('[ipc] getPlaybackContext invoked');
    const context = await spotifyService.getPlaybackContext();
    console.info('[ipc] getPlaybackContext completed', {
      hasContext: Boolean(context)
    });
    return context;
  }
};

export const registerSpotifyIpcHandlers = () => {
  for (const [channel, handler] of Object.entries(spotifyIpcHandlers)) {
    ipcMain.handle(channel, handler);
  }
};

const MAIN_WINDOW_VITE_DEV_SERVER_URL = process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL;
const MAIN_WINDOW_VITE_NAME = process.env.MAIN_WINDOW_VITE_NAME || 'index';
const MAIN_WINDOW_VITE_PRELOAD = process.env.MAIN_WINDOW_VITE_PRELOAD;

const resolvePreloadPath = () => {
  if (MAIN_WINDOW_VITE_PRELOAD) {
    return MAIN_WINDOW_VITE_PRELOAD;
  }

  return path.join(__dirname, '../preload/index.js');
};

const resolveRendererHtmlPath = () => {
  const configuredName = (MAIN_WINDOW_VITE_NAME || 'index').trim();

  if (!configuredName) {
    return path.join(__dirname, '../renderer/index.html');
  }

  if (path.isAbsolute(configuredName)) {
    return configuredName;
  }

  const htmlName = path.extname(configuredName)
    ? configuredName
    : `${configuredName}.html`;

  if (htmlName.includes('/') || htmlName.includes(path.sep)) {
    return path.join(__dirname, '../', htmlName);
  }

  return path.join(__dirname, '../renderer', htmlName);
};

const loadMainWindowContent = async (mainWindow) => {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    return;
  }

  const htmlPath = resolveRendererHtmlPath();
  try {
    await mainWindow.loadFile(htmlPath);
  } catch (error) {
    throw new Error(
      `Failed to load renderer at ${htmlPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

export const createMainWindow = () => {
  const isDev = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);

  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 640,
    backgroundColor: '#191414',
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void loadMainWindowContent(mainWindow).catch(handleFatalStartupError);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  return mainWindow;
};

const handleFatalStartupError = (error) => {
  console.error('[main] Fatal startup error', error);

  const message = error instanceof Error ? error.message : String(error);

  if (app.isReady()) {
    dialog.showErrorBox('Yfitops failed to start', message);
  }

  app.exit(1);
};

const safelyCreateMainWindow = () => {
  try {
    return createMainWindow();
  } catch (error) {
    handleFatalStartupError(error);
    return undefined;
  }
};

registerSpotifyIpcHandlers();

app
  .whenReady()
  .then(() => {
    safelyCreateMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        safelyCreateMainWindow();
      }
    });
  })
  .catch(handleFatalStartupError);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
