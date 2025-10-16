const electronOauth2 = require('electron-oauth2');
const SpotifyWebApi = require('spotify-web-api-node');

class SpotifyService {
  constructor(config = {}) {
    const { clientId, clientSecret, redirectUri } = config;
    this.config = { clientId, clientSecret, redirectUri };
    if (this.isConfigured()) {
      this.oauth = electronOauth2({
        clientId,
        clientSecret,
        authorizationUrl: 'https://accounts.spotify.com/authorize',
        tokenUrl: 'https://accounts.spotify.com/api/token',
        useBasicAuthorizationHeader: true,
        redirectUri
      }, {
        alwaysOnTop: true,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false
        }
      });
    } else {
      this.oauth = null;
    }

    this.spotifyApi = new SpotifyWebApi({
      clientId,
      clientSecret,
      redirectUri
    });

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

  async login() {
    if (!this.isConfigured()) {
      throw new Error('Spotify credentials are not configured.');
    }

    if (!this.oauth) {
      throw new Error('Spotify OAuth provider is unavailable.');
    }

    const token = await this.oauth.getAccessToken({
      scope: 'user-read-email user-read-private'
    });

    this.storeToken(token);

    return this.getCurrentUserProfile();
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
}

module.exports = { SpotifyService };
