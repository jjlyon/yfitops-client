# Agent Guidelines

## Scope
These instructions apply to the entire repository unless overridden by an `AGENTS.md` in a subdirectory.

## Project Context
- This Electron app explores alternative Spotify client behavior, especially around queuing, podcast episode management, play counts, home customization, and visibility of recommended releases.
- When implementing or adjusting these areas, document assumptions and edge cases so future changes remain aligned with the product vision outlined above.

## Architecture Notes
- The main process entry lives in `src/main.js`; keep window creation, lifecycle handling, and devtools toggles confined there.
- Use `src/preload.js` to expose controlled APIs to the renderer via the `contextBridge`. Avoid enabling Node integration in the renderer.
- Renderer content currently loads from static assets under `src/index.html` and related files; prefer incremental enhancements over introducing new frameworks without discussion.

## Development Workflow
- Install dependencies with `npm install` before running scripts.
- Use `npm start` for local development and ensure the Electron window opens without console errors before submitting changes.
- Whenever queuing behavior, playlist management, play-count displays, or recommendation surfaces are touched, add or update manual test notes in the PR to cover those user flows.

## Code Style
- Follow two-space indentation in JavaScript, HTML, and CSS files.
- Use single quotes for JavaScript strings to match the existing codebase.
- Favor descriptive function and variable names; avoid unnecessary abbreviations.

## Documentation & Communication
- Update `README.md` whenever setup steps or user-facing functionality change.
- Record manual verification steps (and include screenshots for UI updates) in pull requests, especially when queuing logic or recommendation displays change.
