# YFitOps Client

A bare-bones Electron application that lays the groundwork for a future Spotify-powered music player. The app now includes a
simple Spotify authentication flow that prompts users to sign in along with a global search workspace for quickly browsing
tracks and releases.

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

This will launch a desktop window that displays a discovery-focused interface styled with Spotify-inspired colors. If Spotify
credentials are present, the UI will prompt for login and, once authenticated, unlock global search. The window is configured to
open the Chromium devtools automatically while running in development mode to assist with future feature work.

### Global Search

Once authenticated, a search input is available in the top navigation. Queries are debounced and sent to Spotify's
[`/v1/search`](https://developer.spotify.com/documentation/web-api/reference/search) endpoint, with results organized under
Tracks and Albums & EPs tabs. Selecting any result opens a dedicated release view with a back button so users can drill into the
release and then return to their search results. Track cards still expose queue management actions (Play, Play Next,
Add to Queue). When no matches are found, the UI communicates the empty state, and API failures surface a retry affordance.

The search experience can be toggled off by setting `ENABLE_SEARCH=false` in the environment before launching the Electron app.

## Project Structure

- `src/main.js` – Electron main process entry point responsible for creating the application window.
- `src/preload.js` – Exposes a minimal, secure bridge for passing static metadata to the renderer along with Spotify auth helpers.
- `src/index.html` – Renderer UI that handles login prompts and renders the global search + results experience.
- `src/lib/spotifyService.js` – Thin wrapper around the Spotify client and OAuth library so the underlying dependencies can be
  swapped without touching the renderer. Includes catalog search helpers with basic retry handling.

Feel free to build on top of this foundation to integrate authentication, playback controls, and other Spotify features.
