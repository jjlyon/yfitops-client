const { BrowserWindow } = require('electron');
const { randomBytes } = require('crypto');
const SpotifyWebApi = require('spotify-web-api-node');

const DEFAULT_SCOPES = ['user-read-email', 'user-read-private'];
const SEARCH_TYPES = ['track', 'album'];
const SEARCH_LIMIT = 15;

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
            expires_in: body.expires_in
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
      return;
    }

    const refreshToken = token.refresh_token || this.tokenInfo?.refreshToken || null;
    const expiresInMs = typeof token.expires_in === 'number' ? token.expires_in * 1000 : 3600 * 1000;

    this.tokenInfo = {
      accessToken: token.access_token,
      refreshToken,
      expiresAt: Date.now() + expiresInMs
    };

    this.spotifyApi.setAccessToken(this.tokenInfo.accessToken);
    if (this.tokenInfo.refreshToken) {
      this.spotifyApi.setRefreshToken(this.tokenInfo.refreshToken);
    }
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
      expires_in: body.expires_in
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

    const { body } = await this.spotifyApi.getMe();
    return body;
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
