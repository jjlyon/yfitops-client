# YFitOps Client

A Vue-powered Electron application that lays the groundwork for a future Spotify-powered music player. The renderer hydrates a
component tree that manages Spotify authentication, global search, release exploration, and toast feedback without relying on
manual DOM manipulation.

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

3. Run the development build (Electron will open once the renderer Vite server is ready):

   ```bash
   npm run dev
   ```

   The production bundle is generated via electron-vite and can be inspected locally with:

   ```bash
   npm run build
   ```

   After building, electron-vite outputs the compiled entry points to `dist-electron/main`, `dist-electron/preload`, and
   `dist-electron/renderer`. Use `npm run preview` to launch the built renderer against Electron without rebuilding—this starts
   Electron pointed at the assets under `dist-electron/` so you can validate the packaged desktop window locally.

This workflow launches a desktop window that displays a discovery-focused interface styled with Spotify-inspired colors. If
Spotify credentials are present, the UI will prompt for login and, once authenticated, unlock global search. The renderer now
uses Vue single-file components, so state changes propagate reactively while the Chromium devtools remain available during
development for deeper inspection.

### Global Search

Once authenticated, a search input is available in the top navigation. Queries are debounced and sent to Spotify's
[`/v1/search`](https://developer.spotify.com/documentation/web-api/reference/search) endpoint, with results organized under
Tracks and Albums & EPs tabs. Selecting any result opens a dedicated release view with a back button so users can drill into the
release and then return to their search results. Track cards still expose queue management actions (Play, Play Next,
Add to Queue). When no matches are found, the UI communicates the empty state, and API failures surface a retry affordance.

The search experience can be toggled off by setting `ENABLE_SEARCH=false` in the environment before launching the Electron app.

## Manual Verification

Manually verify the renderer after changes to ensure key workflows remain intact:

- Launch the app without credentials to confirm the authentication card displays status messaging and disables search.
- Log in with Spotify and verify the search input enables, the tooltip updates with keyboard guidance, and the profile loads without console errors.
- Enter a query and confirm the debounced search spinner, tabbed results, arrow-key navigation, and Escape-to-clear behaviour.
- Open a release from either tab, ensure the overlay loads track details, the highlighted track is respected, and the back button restores focus to the originating result.
- Queue a track from the search menu and confirm the toast, banner handling for playback context, and queue playlist action links function.

## Project Structure

- `src/main/index.js` – Electron main process entry point responsible for creating the application window.
- `src/preload/index.js` – Exposes a minimal, secure bridge for passing static metadata to the renderer along with Spotify auth helpers.
- `src/renderer/index.html` – Lightweight HTML scaffold with a single `#app` root for Vite hydration.
- `src/renderer/main.js` – Vue bootstrap that mounts `<App />` and provides preload globals (`spotify`, `appInfo`).
- `src/renderer/App.vue` – Shell layout containing the navigation, global search workspace, release overlay, and feedback layer.
- `src/renderer/components/` – Vue single-file components for the authentication gate, search grid, release panel, and toast/banner region.
- `src/renderer/stores/appStore.js` – Reactive store orchestrating authentication checks, debounced search requests, queue operations, and release lookups.
- `src/renderer/stores/feedbackStore.js` – Toast and banner manager consumed by the renderer feedback layer.
- `src/renderer/utils.js` – Presentation helpers for artist summaries, release metadata, and track durations.
- `src/lib/spotifyService.js` – Thin wrapper around the Spotify client and OAuth library so the underlying dependencies can be swapped without touching the renderer. Includes catalog search helpers with basic retry handling.

Feel free to build on top of this foundation to integrate authentication, playback controls, and other Spotify features.

Electron now loads the renderer through electron-vite, so `npm run dev` handles both the Vite dev server and Electron process orchestration. The production build emitted by `npm run build` lands in `dist-electron/main`, `dist-electron/preload`, and `dist-electron/renderer` for packaging or manual inspection.
