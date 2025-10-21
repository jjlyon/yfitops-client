import { state } from '../state.js';
import { createImage, summariseArtists, formatReleaseMeta, formatDuration } from '../utils.js';

let releaseView = null;
let resultsContainer = null;
let searchInput = null;
let getSpotify = null;
let onResultsRequested = () => {};

export const initReleaseView = ({
  releaseView: releaseViewElement,
  resultsContainer: resultsContainerElement,
  searchInput: searchInputElement,
  getSpotify: getSpotifyFn,
  onResultsRequested: onResultsRequestedFn
} = {}) => {
  releaseView = releaseViewElement;
  resultsContainer = resultsContainerElement;
  searchInput = searchInputElement;
  getSpotify = getSpotifyFn || null;
  onResultsRequested = onResultsRequestedFn || (() => {});
};

const renderStatusRow = (message) => {
  const statusRow = document.createElement('div');
  statusRow.className = 'release-status';
  statusRow.textContent = message;
  return statusRow;
};

export const closeReleaseView = ({ restoreFocus = false } = {}) => {
  const wasActive = state.release.active;
  state.release.active = false;
  state.release.status = 'idle';
  state.release.album = null;
  state.release.albumId = null;
  state.release.highlightTrackId = null;
  state.release.error = null;

  if (releaseView) {
    releaseView.hidden = true;
    releaseView.textContent = '';
  }
  if (resultsContainer) {
    resultsContainer.hidden = false;
  }
  if (restoreFocus && wasActive) {
    const focusable = resultsContainer?.querySelector('[data-focus-index="0"]');
    if (focusable) {
      focusable.focus();
    } else if (searchInput) {
      searchInput.focus();
    }
  }
};

export const renderReleaseView = () => {
  if (!releaseView) {
    return;
  }

  releaseView.textContent = '';
  if (!state.release.active) {
    releaseView.hidden = true;
    if (resultsContainer) {
      resultsContainer.hidden = false;
    }
    return;
  }

  releaseView.hidden = false;
  if (resultsContainer) {
    resultsContainer.hidden = true;
  }

  const header = document.createElement('div');
  header.className = 'release-header';

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'release-back';
  backButton.textContent = 'Back to results';
  backButton.addEventListener('click', () => {
    closeReleaseView({ restoreFocus: true });
    onResultsRequested();
  });
  header.appendChild(backButton);

  const heading = document.createElement('h2');
  if (state.release.album?.name) {
    heading.textContent = state.release.album.name;
  } else if (state.release.status === 'loading') {
    heading.textContent = 'Loading release…';
  } else if (state.release.status === 'error') {
    heading.textContent = 'Release unavailable';
  } else {
    heading.textContent = 'Release';
  }
  header.appendChild(heading);

  releaseView.appendChild(header);

  if (state.release.status === 'loading' && !state.release.album) {
    releaseView.appendChild(renderStatusRow('Loading release details…'));
    return;
  }

  if (state.release.status === 'error') {
    const message = state.release.error
      ? `Couldn't load release details. ${state.release.error}`.trim()
      : 'Couldn\'t load release details.';
    releaseView.appendChild(renderStatusRow(message));

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'release-retry';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => {
      if (state.release.albumId) {
        openReleaseView({
          albumId: state.release.albumId,
          initialAlbum: state.release.album,
          highlightTrackId: state.release.highlightTrackId
        });
      }
    });
    releaseView.appendChild(retry);
    return;
  }

  const album = state.release.album;
  if (!album) {
    releaseView.appendChild(renderStatusRow('Release details unavailable.'));
    return;
  }

  const content = document.createElement('div');
  content.className = 'release-content';

  const artworkWrapper = document.createElement('div');
  artworkWrapper.className = 'release-artwork';
  artworkWrapper.appendChild(createImage(album.images?.[0]?.url, `${album.name} cover art`));
  content.appendChild(artworkWrapper);

  const details = document.createElement('div');
  details.className = 'release-details';

  const title = document.createElement('h3');
  title.textContent = album.name;
  details.appendChild(title);

  const artistsLine = document.createElement('p');
  artistsLine.textContent = summariseArtists(album.artists);
  details.appendChild(artistsLine);

  const metaLine = document.createElement('p');
  metaLine.textContent = formatReleaseMeta(album);
  details.appendChild(metaLine);

  content.appendChild(details);
  releaseView.appendChild(content);

  const tracklist = document.createElement('div');
  tracklist.className = 'release-tracklist';
  const tracks = album.tracks?.items || [];
  if (!tracks.length) {
    const emptyTrack = document.createElement('div');
    emptyTrack.textContent = state.release.status === 'loading'
      ? 'Loading tracks…'
      : 'Track listing unavailable for this release.';
    tracklist.appendChild(emptyTrack);
  } else {
    tracks.forEach((track, index) => {
      const item = document.createElement('div');
      item.className = 'tracklist-item';
      if (state.release.highlightTrackId && track.id === state.release.highlightTrackId) {
        item.classList.add('highlight');
      }

      const titleEl = document.createElement('div');
      titleEl.textContent = `${index + 1}. ${track.name}`;

      const duration = document.createElement('span');
      duration.textContent = formatDuration(track.duration_ms);

      item.appendChild(titleEl);
      item.appendChild(duration);
      tracklist.appendChild(item);
    });
  }

  releaseView.appendChild(tracklist);

  if (state.release.status === 'loading') {
    releaseView.appendChild(renderStatusRow('Fetching updated tracklist…'));
  }
};

export const openReleaseView = async ({ albumId, initialAlbum, highlightTrackId }) => {
  if (!albumId) {
    return;
  }

  const requestId = state.release.requestId + 1;
  state.release.requestId = requestId;
  state.release.active = true;
  state.release.status = 'loading';
  state.release.album = initialAlbum || null;
  state.release.albumId = albumId;
  state.release.highlightTrackId = highlightTrackId || null;
  state.release.error = null;

  renderReleaseView();

  try {
    const spotify = typeof getSpotify === 'function' ? getSpotify() : null;
    if (!spotify?.getAlbum) {
      throw new Error('Spotify integration is unavailable in this build.');
    }

    const album = await spotify.getAlbum(albumId);
    if (state.release.requestId !== requestId) {
      return;
    }

    state.release.album = album;
    state.release.status = 'ready';
    renderReleaseView();
  } catch (error) {
    if (state.release.requestId !== requestId) {
      return;
    }

    state.release.status = 'error';
    state.release.error = error?.message || 'Please try again.';
    renderReleaseView();
    // eslint-disable-next-line no-console
    console.error('release_view_error', error);
  }
};
