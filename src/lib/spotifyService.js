const { BrowserWindow } = require('electron');
const { randomBytes } = require('crypto');
const SpotifyWebApi = require('spotify-web-api-node');

// Request playlist management and playback state scopes so the client can maintain
// its queue playlist and inspect the active player context.
const DEFAULT_SCOPES = [
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-modify-private',
  'playlist-modify-public',
  'user-read-playback-state'
];
const SEARCH_TYPES = ['track', 'album'];
const SEARCH_LIMIT = 15;
const QUEUE_PLAYLIST_NAME = 'YFitOps Queue';
const QUEUE_PLAYLIST_DESCRIPTION = 'Private queue managed by YFitOps.';
const PLAYLIST_PAGE_LIMIT = 50;

class SpotifyService {
  constructor(config = {}) {
    const { clientId, clientSecret, redirectUri } = config;
    this.config = { clientId, clientSecret, redirectUri };

    this.spotifyApi = new SpotifyWebApi({
      clientId,
      clientSecret,
      redirectUri
    });

    if (redirectUri) {
      this.spotifyApi.setRedirectURI(redirectUri);
    }

    this.tokenInfo = null;
    this.currentUserProfile = null;
    this.queuePlaylistId = null;
  }

  isConfigured() {
    const { clientId, clientSecret, redirectUri } = this.config;
    return Boolean(clientId && clientSecret && redirectUri);
  }

  async isAuthenticated() {
    if (!this.tokenInfo) {
      return false;
    }

    if (Date.now() >= this.tokenInfo.expiresAt - 60000) {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        this.tokenInfo = null;
        return false;
      }
    }

    this.spotifyApi.setAccessToken(this.tokenInfo.accessToken);
    if (this.tokenInfo.refreshToken) {
      this.spotifyApi.setRefreshToken(this.tokenInfo.refreshToken);
    }

    return true;
  }

  async ensureAccessToken() {
    return this.isAuthenticated();
  }

  buildAuthorizeUrl(state) {
    return this.spotifyApi.createAuthorizeURL(DEFAULT_SCOPES, state, true);
  }

  createAuthWindow() {
    return new BrowserWindow({
      width: 500,
      height: 700,
      show: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false
      }
    });
  }

  async login() {
    if (!this.isConfigured()) {
      throw new Error('Spotify credentials are not configured.');
    }

    const alreadyAuthenticated = await this.isAuthenticated();
    if (alreadyAuthenticated) {
      return this.getCurrentUserProfile();
    }

    const state = randomBytes(16).toString('hex');
    const authorizeUrl = this.buildAuthorizeUrl(state);

    const authWindow = this.createAuthWindow();
    const { webContents } = authWindow;

    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        webContents.removeListener('will-redirect', handleRedirect);
        webContents.removeListener('will-navigate', handleRedirect);
        authWindow.removeListener('closed', handleClosed);
        if (!authWindow.isDestroyed()) {
          authWindow.close();
        }
      };

      const finalize = async (resultPromise) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();

        try {
          const profile = await resultPromise;
          resolve(profile);
        } catch (error) {
          reject(error);
        }
      };

      const handleAuthCode = async (callbackUrl) => {
        try {
          const parsedUrl = new URL(callbackUrl);
          const returnedState = parsedUrl.searchParams.get('state');
          const authError = parsedUrl.searchParams.get('error');

          if (authError) {
            throw new Error(`Spotify authorization error: ${authError}`);
          }

          if (returnedState !== state) {
            throw new Error('Spotify login state mismatch.');
          }

          const code = parsedUrl.searchParams.get('code');
          if (!code) {
            throw new Error('Spotify authorization code missing.');
          }

          const tokenResponse = await this.spotifyApi.authorizationCodeGrant(code);
          const body = tokenResponse.body || {};

          this.storeToken({
            access_token: body.access_token,
            refresh_token: body.refresh_token,
            expires_in: body.expires_in,
            scope: body.scope
          });

          const profile = await this.getCurrentUserProfile();
          return profile;
        } catch (error) {
          throw error;
        }
      };

      const handleRedirect = (event, url) => {
        if (!url || !url.startsWith(this.config.redirectUri)) {
          return;
        }

        event.preventDefault();
        finalize(handleAuthCode(url));
      };

      const handleClosed = () => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error('Spotify login was canceled.'));
        }
      };

      webContents.on('will-redirect', handleRedirect);
      webContents.on('will-navigate', handleRedirect);
      authWindow.on('closed', handleClosed);

      authWindow.loadURL(authorizeUrl).catch((error) => {
        finalize(Promise.reject(new Error(`Unable to load Spotify login: ${error.message}`)));
      });
    });
  }

  storeToken(token) {
    if (!token) {
      this.tokenInfo = null;
      this.currentUserProfile = null;
      this.queuePlaylistId = null;
      return;
    }

    const refreshToken = token.refresh_token || this.tokenInfo?.refreshToken || null;
    const expiresInMs = typeof token.expires_in === 'number' ? token.expires_in * 1000 : 3600 * 1000;
    const scopeSource = typeof token.scope === 'string' ? token.scope : this.tokenInfo?.scope?.join(' ');
    const scopeList = scopeSource
      ? Array.from(new Set(scopeSource.split(/\s+/).filter(Boolean)))
      : [...DEFAULT_SCOPES];

    this.tokenInfo = {
      accessToken: token.access_token,
      refreshToken,
      expiresAt: Date.now() + expiresInMs,
      scope: scopeList
    };

    this.spotifyApi.setAccessToken(this.tokenInfo.accessToken);
    if (this.tokenInfo.refreshToken) {
      this.spotifyApi.setRefreshToken(this.tokenInfo.refreshToken);
    }

    this.currentUserProfile = null;
    this.queuePlaylistId = null;
  }

  async refreshAccessToken() {
    if (!this.tokenInfo?.refreshToken) {
      this.tokenInfo = null;
      throw new Error('No refresh token available for Spotify session.');
    }

    const data = await this.spotifyApi.refreshAccessToken();
    const body = data.body || {};

    this.storeToken({
      access_token: body.access_token,
      refresh_token: body.refresh_token || this.tokenInfo.refreshToken,
      expires_in: body.expires_in,
      scope: body.scope
    });
  }

  async getCurrentUserProfile() {
    if (!this.isConfigured()) {
      throw new Error('Spotify credentials are not configured.');
    }

    const hasToken = await this.ensureAccessToken();
    if (!hasToken) {
      throw new Error('Spotify session is not authenticated.');
    }

    if (this.currentUserProfile) {
      return this.currentUserProfile;
    }

    const { body } = await this.spotifyApi.getMe();
    this.currentUserProfile = body;
    return body;
  }

  async ensureQueuePlaylist() {
    if (!this.isConfigured()) {
      throw new Error('Spotify credentials are not configured.');
    }

    const hasToken = await this.ensureAccessToken();
    if (!hasToken) {
      throw new Error('Spotify session is not authenticated.');
    }

    if (this.queuePlaylistId) {
      return this.queuePlaylistId;
    }

    const profile = await this.getCurrentUserProfile();
    const userId = profile?.id;
    if (!userId) {
      throw new Error('Unable to resolve Spotify user profile for queue playlist.');
    }

    let existingPlaylistId = null;
    let offset = 0;
    const startTime = Date.now();

    try {
      while (!existingPlaylistId) {
        const { body } = await this.spotifyApi.getUserPlaylists({
          limit: PLAYLIST_PAGE_LIMIT,
          offset
        });
        const items = body?.items || [];

        const matchingPlaylist = items.find((playlist) => {
          return playlist?.name === QUEUE_PLAYLIST_NAME && playlist?.owner?.id === userId;
        });

        if (matchingPlaylist) {
          existingPlaylistId = matchingPlaylist.id;
          break;
        }

        if (!body || typeof body.total !== 'number') {
          if (items.length < PLAYLIST_PAGE_LIMIT) {
            break;
          }
        } else if (offset + items.length >= body.total) {
          break;
        }

        if (items.length === 0) {
          break;
        }

        offset += items.length;
      }

      if (existingPlaylistId) {
        this.queuePlaylistId = existingPlaylistId;
        console.info('[spotify] queue_playlist_reused', {
          playlistId: existingPlaylistId,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
        return existingPlaylistId;
      }

      const playlistResponse = await this.spotifyApi.createPlaylist(userId, QUEUE_PLAYLIST_NAME, {
        description: QUEUE_PLAYLIST_DESCRIPTION,
        public: false,
        collaborative: false
      });

      const createdId = playlistResponse?.body?.id;
      if (!createdId) {
        throw new Error('Spotify did not return a playlist ID for the created queue.');
      }

      this.queuePlaylistId = createdId;
      console.info('[spotify] queue_playlist_created', {
        playlistId: createdId,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
      return createdId;
    } catch (error) {
      console.error('[spotify] queue_playlist_ensure_failed', {
        message: error?.message,
        status: error?.statusCode
      });
      throw error;
    }
  }

  async getQueuePlaylistSnapshot() {
    const playlistId = await this.ensureQueuePlaylist();
    const playlistData = await this.spotifyApi.getPlaylist(playlistId, {
      fields: 'tracks.total'
    });

    const total = playlistData?.body?.tracks?.total || 0;
    return { playlistId, total };
  }

  chunkArray(items, size) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error('Chunk size must be a positive integer.');
    }

    const result = [];
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size));
    }
    return result;
  }

  async appendQueueTracks(trackUris = []) {
    if (!Array.isArray(trackUris)) {
      throw new Error('Track URIs must be provided as an array.');
    }

    const uris = trackUris
      .map((uri) => (typeof uri === 'string' ? uri.trim() : ''))
      .filter(Boolean);

    const ensuredPlaylistId = await this.ensureQueuePlaylist();

    if (uris.length === 0) {
      return {
        playlistId: ensuredPlaylistId,
        appendedCount: 0,
        rangeStart: null,
        rangeLength: 0,
        snapshotId: null
      };
    }

    const { playlistId, total } = await this.getQueuePlaylistSnapshot();
    const rangeStart = total;
    let latestSnapshotId = null;
    const startTime = Date.now();

    try {
      const batches = this.chunkArray(uris, 100);
      for (const batch of batches) {
        const response = await this.spotifyApi.addTracksToPlaylist(playlistId, batch);
        latestSnapshotId = response?.body?.snapshot_id || latestSnapshotId;
      }

      console.info('[spotify] queue_tracks_appended', {
        playlistId,
        appendedCount: uris.length,
        batches: Math.ceil(uris.length / 100),
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return {
        playlistId,
        appendedCount: uris.length,
        rangeStart,
        rangeLength: uris.length,
        snapshotId: latestSnapshotId
      };
    } catch (error) {
      console.error('[spotify] queue_tracks_append_failed', {
        message: error?.message,
        status: error?.statusCode
      });
      throw error;
    }
  }

  async findTrackIndexInPlaylist(playlistId, targetUri) {
    if (!targetUri) {
      return null;
    }

    let offset = 0;
    const limit = 100;

    while (true) {
      const { body } = await this.spotifyApi.getPlaylistTracks(playlistId, {
        offset,
        limit
      });

      const items = body?.items || [];
      for (let index = 0; index < items.length; index += 1) {
        const trackUri = items[index]?.track?.uri || items[index]?.track?.linked_from?.uri;
        if (trackUri === targetUri) {
          return offset + index;
        }
      }

      if (items.length < limit) {
        break;
      }

      offset += items.length;
    }

    return null;
  }

  async getPlaybackContext() {
    if (!this.isConfigured()) {
      throw new Error('Spotify credentials are not configured.');
    }

    const hasToken = await this.ensureAccessToken();
    if (!hasToken) {
      throw new Error('Spotify session is not authenticated.');
    }

    try {
      const response = await this.spotifyApi.getMyCurrentPlaybackState({
        additional_types: 'track,episode'
      });
      return response?.body || null;
    } catch (error) {
      console.error('[spotify] playback_context_failed', {
        message: error?.message,
        status: error?.statusCode
      });
      throw error;
    }
  }

  async moveQueueBlockAfterCurrent({ rangeStart, rangeLength = 1, snapshotId } = {}) {
    if (!Number.isInteger(rangeStart) || rangeStart < 0) {
      throw new Error('A valid rangeStart index is required to reorder queue tracks.');
    }

    if (!Number.isInteger(rangeLength) || rangeLength <= 0) {
      throw new Error('rangeLength must be a positive integer.');
    }

    const playlistId = await this.ensureQueuePlaylist();
    const startTime = Date.now();

    try {
      const playback = await this.getPlaybackContext();
      const playlistData = await this.spotifyApi.getPlaylist(playlistId, {
        fields: 'tracks.total'
      });
      const totalTracks = playlistData?.body?.tracks?.total || 0;

      if (rangeStart >= totalTracks) {
        throw new Error('rangeStart is outside of the queue playlist bounds.');
      }

      if (rangeStart + rangeLength > totalTracks) {
        throw new Error('rangeLength exceeds queue playlist size.');
      }

      const queueUri = `spotify:playlist:${playlistId}`;
      const contextUri = playback?.context?.uri || '';
      let currentIndex = null;

      if (contextUri === queueUri) {
        currentIndex = await this.findTrackIndexInPlaylist(playlistId, playback?.item?.uri);
      }

      if (currentIndex === null || currentIndex === undefined) {
        console.warn('[spotify] queue_reorder_context_missing', {
          playlistId,
          contextUri
        });
        currentIndex = -1;
      }

      if (rangeStart <= currentIndex && rangeStart + rangeLength > currentIndex) {
        throw new Error('Cannot move queue block containing the currently playing track.');
      }

      let insertBefore = currentIndex + 1;
      if (currentIndex < 0) {
        insertBefore = 0;
      } else if (rangeStart < currentIndex) {
        insertBefore -= rangeLength;
      }

      if (insertBefore < 0) {
        insertBefore = 0;
      }

      if (insertBefore > totalTracks) {
        insertBefore = totalTracks;
      }

      const options = { range_length: rangeLength };
      if (snapshotId) {
        options.snapshot_id = snapshotId;
      }

      const reorderResponse = await this.spotifyApi.reorderTracksInPlaylist(
        playlistId,
        rangeStart,
        insertBefore,
        options
      );

      const resultingSnapshotId = reorderResponse?.body?.snapshot_id || null;

      console.info('[spotify] queue_reordered_after_current', {
        playlistId,
        rangeStart,
        rangeLength,
        insertBefore,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return {
        playlistId,
        snapshotId: resultingSnapshotId,
        rangeStart,
        rangeLength,
        insertBefore
      };
    } catch (error) {
      console.error('[spotify] queue_reorder_failed', {
        message: error?.message,
        status: error?.statusCode
      });
      throw error;
    }
  }

  async searchCatalog(query, { types = SEARCH_TYPES, limit = SEARCH_LIMIT, attempt = 0 } = {}) {
    if (!this.isConfigured()) {
      throw new Error('Spotify credentials are not configured.');
    }

    const trimmedQuery = typeof query === 'string' ? query.trim() : '';
    if (!trimmedQuery) {
      return {
        tracks: [],
        albums: []
      };
    }

    const hasToken = await this.ensureAccessToken();
    if (!hasToken) {
      throw new Error('Spotify session is not authenticated.');
    }

    const uniqueTypes = Array.from(new Set((types || SEARCH_TYPES).filter(Boolean)));
    if (uniqueTypes.length === 0) {
      throw new Error('At least one Spotify entity type is required for search.');
    }

    const options = {
      limit,
      market: 'from_token'
    };

    const searchStart = Date.now();

    try {
      const { body } = await this.spotifyApi.search(trimmedQuery, uniqueTypes, options);
      const elapsed = Date.now() - searchStart;
      console.info('[spotify] search_performed', {
        queryLength: trimmedQuery.length,
        types: uniqueTypes,
        durationMs: elapsed,
        timestamp: new Date().toISOString()
      });

      return {
        tracks: body?.tracks?.items || [],
        albums: body?.albums?.items || []
      };
    } catch (error) {
      if (error?.statusCode === 429 && attempt < 2) {
        const retryAfterSeconds = Number(error.headers?.['retry-after']) || 1;
        console.warn('[spotify] search rate limited, retrying', {
          retryAfterSeconds,
          attempt
        });
        await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
        return this.searchCatalog(trimmedQuery, {
          types: uniqueTypes,
          limit,
          attempt: attempt + 1
        });
      }

      console.error('[spotify] search_failed', {
        message: error?.message,
        status: error?.statusCode
      });
      throw error;
    }
  }

  async getAlbum(albumId) {
    if (!this.isConfigured()) {
      throw new Error('Spotify credentials are not configured.');
    }

    const id = typeof albumId === 'string' ? albumId.trim() : '';
    if (!id) {
      throw new Error('A Spotify album ID is required.');
    }

    const hasToken = await this.ensureAccessToken();
    if (!hasToken) {
      throw new Error('Spotify session is not authenticated.');
    }

    try {
      const { body } = await this.spotifyApi.getAlbum(id, { market: 'from_token' });
      return body;
    } catch (error) {
      console.error('[spotify] get_album_failed', {
        message: error?.message,
        status: error?.statusCode
      });
      throw error;
    }
  }
}

module.exports = { SpotifyService };
