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

   The authentication flow now requests playlist management and playback state scopes so the app can create or reorder the
   queue playlist and inspect the active player. Make sure your Spotify app settings and consent screen account for the
   following permissions:

   - `playlist-read-private`
   - `playlist-modify-private`
   - `playlist-modify-public`
   - `user-read-playback-state`

   If you previously authorized the app, revoke the old session in your [Spotify account apps page](https://www.spotify.com/account/apps/)
   so that Spotify prompts you to grant the expanded scope set during the next login.

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
- `src/index.html` – Static renderer shell that provides markup/styles and loads the ES module entry point at `src/renderer/main.js`.
- `src/renderer/state.js` – Shared renderer state store for the authenticated user, search requests, and release view metadata.
- `src/renderer/auth.js` – Updates the login prompt, tooltip messaging, and toggles between the auth/search sections.
- `src/renderer/utils.js` – Presentation helpers for formatting metadata and constructing artwork images.
- `src/renderer/views/searchResults.js` – Renders search tabs/results, manages loading/empty/error states, and exposes keyboard helpers for the results grid.
- `src/renderer/views/releaseView.js` – Controls the dedicated release details panel and fetches expanded album data via the preload bridge.
- `src/renderer/main.js` – Renderer bootstrap that wires DOM events to the modules above and coordinates calls to the preload-exposed Spotify API.
- `src/lib/spotifyService.js` – Thin wrapper around the Spotify client and OAuth library so the underlying dependencies can be
  swapped without touching the renderer. Includes catalog search helpers with basic retry handling.

Feel free to build on top of this foundation to integrate authentication, playback controls, and other Spotify features.

## Renderer module flow

The renderer now relies on native ES modules so logic is grouped by responsibility under `src/renderer/`:

1. `main.js` waits for `DOMContentLoaded`, captures DOM references, and initialises each module.
2. `auth.js` toggles between the authentication prompt and the search workspace, delegating to `searchResults.resetSearchState` to reset UI state after login/logout.
3. `views/searchResults.js` renders search tabs, handles keyboard interactions, and requests release details by calling into `views/releaseView.js`.
4. `views/releaseView.js` fetches additional album data through the preload bridge (`window.spotify`) and swaps the results grid for the detailed release panel when a result is opened.
5. Shared state (current query, profile, release metadata) lives in `state.js`, while `utils.js` houses formatting helpers reused across the views.

Electron loads `src/index.html`, which now simply references `renderer/main.js`; no extra bundling step is required, so the existing `npm start` workflow continues to work unchanged.
