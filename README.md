# YFitOps Client

A bare-bones Electron application that lays the groundwork for a future Spotify-powered music player. The app now includes a
simple Spotify authentication flow that prompts users to sign in and greets them by display name once the login completes.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Spotify application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and add
   `http://localhost:4350/callback` to the app's **Redirect URIs** list. Provide the resulting credentials to the app via
   environment variables before starting the development server:

   ```bash
   export SPOTIFY_CLIENT_ID=<your client id>
   export SPOTIFY_CLIENT_SECRET=<your client secret>
   export SPOTIFY_REDIRECT_URI=http://localhost:4350/callback
   ```

3. Run the development build:

   ```bash
   npm start
   ```

This will launch a desktop window that displays a placeholder interface styled with Spotify-inspired colors. If Spotify
credentials are present, the UI will either prompt for login or show "Welcome &lt;username&gt;" after the OAuth flow completes. The
window is configured to open the Chromium devtools automatically while running in development mode to assist with future feature
work.

## Project Structure

- `src/main.js` – Electron main process entry point responsible for creating the application window.
- `src/preload.js` – Exposes a minimal, secure bridge for passing static metadata to the renderer along with Spotify auth helpers.
- `src/index.html` – A simple landing page that checks Spotify auth state, prompts for login, and greets authenticated users.
- `src/lib/spotifyService.js` – Thin wrapper around the Spotify client and OAuth library so the underlying dependencies can be
  swapped without touching the renderer.

Feel free to build on top of this foundation to integrate authentication, playback controls, and other Spotify features.
