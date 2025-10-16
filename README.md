# YFitOps Client

A bare-bones Electron application that lays the groundwork for a future Spotify-powered music player.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development build:

   ```bash
   npm start
   ```

This will launch a desktop window that displays a placeholder interface styled with Spotify-inspired colors. The window is configured to open the Chromium devtools automatically while running in development mode to assist with future feature work.

## Project Structure

- `src/main.js` – Electron main process entry point responsible for creating the application window.
- `src/preload.js` – Exposes a minimal, secure bridge for passing static metadata to the renderer.
- `src/index.html` – A simple landing page that will eventually be replaced with the actual Spotify player UI.

Feel free to build on top of this foundation to integrate authentication, playback controls, and other Spotify features.
