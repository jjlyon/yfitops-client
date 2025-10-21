import { state, tabs } from '../state.js';
import { createImage, summariseArtists } from '../utils.js';
import { openReleaseView, closeReleaseView } from './releaseView.js';

let resultsContainer = null;
let searchInput = null;
let searchSpinner = null;

export const initSearchResults = ({
  resultsContainer: resultsContainerElement,
  searchInput: searchInputElement,
  searchSpinner: searchSpinnerElement
} = {}) => {
  resultsContainer = resultsContainerElement;
  searchInput = searchInputElement;
  searchSpinner = searchSpinnerElement;
};

export const renderEmptyMessage = (message) => {
  if (!resultsContainer) {
    return;
  }

  resultsContainer.hidden = false;
  resultsContainer.textContent = '';
  const stateMessage = document.createElement('div');
  stateMessage.className = 'state-message';
  const strong = document.createElement('strong');
  strong.textContent = message;
  stateMessage.appendChild(strong);
  resultsContainer.appendChild(stateMessage);
};

export const toggleLoading = (loading) => {
  if (!searchSpinner || !searchInput) {
    return;
  }
  searchSpinner.hidden = !loading;
  searchInput.setAttribute('aria-busy', loading ? 'true' : 'false');
};

const ensureActiveTab = () => {
  const currentItems = state.search.results[state.search.activeTab] || [];
  if (currentItems.length > 0) {
    return;
  }

  for (const tab of tabs) {
    if ((state.search.results[tab.key] || []).length > 0) {
      state.search.activeTab = tab.key;
      return;
    }
  }

  state.search.activeTab = 'tracks';
};

export const closeAllTrackMenus = () => {
  if (!resultsContainer) {
    return;
  }
  resultsContainer
    .querySelectorAll('.track-card')
    .forEach((card) => {
      card.classList.remove('track-menu-open');
      const toggle = card.querySelector('.menu-toggle');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
};

const buildTrackCard = (track, index) => {
  const card = document.createElement('article');
  card.className = 'result-card track-card';

  const mainButton = document.createElement('button');
  mainButton.type = 'button';
  mainButton.className = 'result-main search-focusable';
  mainButton.dataset.focusIndex = index;
  mainButton.addEventListener('click', () => {
    closeAllTrackMenus();
    openReleaseView({
      albumId: track.album?.id,
      initialAlbum: track.album,
      highlightTrackId: track.id
    });
    // eslint-disable-next-line no-console
    console.info('search_result_clicked', {
      entityType: 'track',
      action: 'view_release',
      uri: track.uri,
      queryLength: state.search.query.length
    });
  });
  mainButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      mainButton.click();
    }
  });

  const meta = document.createElement('div');
  meta.className = 'result-meta';
  const artwork = createImage(track.album?.images?.[0]?.url, `${track.name} cover art`);
  const textGroup = document.createElement('div');
  textGroup.className = 'text-group';
  const title = document.createElement('strong');
  title.textContent = track.name;
  const subtitle = document.createElement('span');
  subtitle.textContent = summariseArtists(track.artists);

  textGroup.appendChild(title);
  textGroup.appendChild(subtitle);
  meta.appendChild(artwork);
  meta.appendChild(textGroup);
  mainButton.appendChild(meta);

  const menuToggle = document.createElement('button');
  menuToggle.type = 'button';
  menuToggle.className = 'menu-toggle';
  menuToggle.textContent = 'Queue';
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = !card.classList.contains('track-menu-open');
    closeAllTrackMenus();
    if (willOpen) {
      card.classList.add('track-menu-open');
      menuToggle.setAttribute('aria-expanded', 'true');
    }
  });

  const actions = document.createElement('div');
  actions.className = 'result-actions';

  const queueActions = [
    { label: 'Play', action: 'play_now' },
    { label: 'Play Next', action: 'play_next' },
    { label: 'Add to Queue', action: 'append_queue' }
  ];

  queueActions.forEach(({ label, action }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      // eslint-disable-next-line no-console
      console.info('search_result_clicked', {
        entityType: 'track',
        action,
        uri: track.uri,
        queryLength: state.search.query.length
      });
      closeAllTrackMenus();
    });
    actions.appendChild(button);
  });

  card.appendChild(mainButton);
  card.appendChild(menuToggle);
  card.appendChild(actions);

  return card;
};

const buildAlbumCard = (album, index) => {
  const card = document.createElement('article');
  card.className = 'result-card album-card';

  const mainButton = document.createElement('button');
  mainButton.type = 'button';
  mainButton.className = 'result-main search-focusable';
  mainButton.dataset.focusIndex = index;
  mainButton.addEventListener('click', () => {
    closeAllTrackMenus();
    openReleaseView({
      albumId: album.id,
      initialAlbum: album
    });
    // eslint-disable-next-line no-console
    console.info('search_result_clicked', {
      entityType: 'album',
      action: 'view_release',
      uri: album.uri,
      queryLength: state.search.query.length
    });
  });
  mainButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      mainButton.click();
    }
  });

  const meta = document.createElement('div');
  meta.className = 'result-meta';
  const artwork = createImage(album.images?.[0]?.url, `${album.name} cover art`);
  const textGroup = document.createElement('div');
  textGroup.className = 'text-group';
  const title = document.createElement('strong');
  title.textContent = album.name;
  const subtitle = document.createElement('span');
  subtitle.textContent = summariseArtists(album.artists);

  textGroup.appendChild(title);
  textGroup.appendChild(subtitle);
  meta.appendChild(artwork);
  meta.appendChild(textGroup);
  mainButton.appendChild(meta);
  card.appendChild(mainButton);

  return card;
};

export const renderResults = () => {
  if (!resultsContainer) {
    return;
  }

  resultsContainer.hidden = false;
  resultsContainer.textContent = '';
  closeAllTrackMenus();

  if (state.search.status !== 'success') {
    return;
  }

  ensureActiveTab();

  const totalResults =
    (state.search.results.tracks?.length || 0) +
    (state.search.results.albums?.length || 0);

  if (totalResults === 0) {
    renderEmptyMessage('No matches found.');
    return;
  }

  const tablist = document.createElement('div');
  tablist.className = 'results-tablist';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Result types');

  tabs.forEach((tab, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'results-tab';
    button.id = `results-tab-${tab.key}`;
    button.setAttribute('role', 'tab');
    const selected = state.search.activeTab === tab.key;
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.setAttribute('tabindex', selected ? '0' : '-1');
    button.textContent = tab.label;

    button.addEventListener('click', () => {
      if (state.search.activeTab !== tab.key) {
        state.search.activeTab = tab.key;
        renderResults();
        const activeTab = resultsContainer.querySelector(`#results-tab-${tab.key}`);
        if (activeTab) {
          activeTab.focus();
        }
      }
    });

    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
        return;
      }

      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      let nextIndex = index + direction;
      if (nextIndex < 0) {
        nextIndex = tabs.length - 1;
      } else if (nextIndex >= tabs.length) {
        nextIndex = 0;
      }

      state.search.activeTab = tabs[nextIndex].key;
      renderResults();
      const nextTab = resultsContainer.querySelector(`#results-tab-${tabs[nextIndex].key}`);
      if (nextTab) {
        nextTab.focus();
      }
    });

    tablist.appendChild(button);
  });

  const items = state.search.results[state.search.activeTab] || [];
  resultsContainer.appendChild(tablist);

  const panel = document.createElement('div');
  panel.className = 'result-grid';
  panel.id = `results-panel-${state.search.activeTab}`;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `results-tab-${state.search.activeTab}`);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'state-message';
    const selectedTab = tabs.find((tab) => tab.key === state.search.activeTab);
    const strong = document.createElement('strong');
    strong.textContent = `No ${selectedTab.label.toLowerCase()} found.`;
    empty.appendChild(strong);
    panel.appendChild(empty);
  } else {
    items.forEach((item, itemIndex) => {
      const card = state.search.activeTab === 'tracks'
        ? buildTrackCard(item, itemIndex)
        : buildAlbumCard(item, itemIndex);
      panel.appendChild(card);
    });
  }

  resultsContainer.appendChild(panel);

};

export const updateSearchStatus = (status, errorMessage, { onRetry } = {}) => {
  state.search.status = status;
  state.search.error = errorMessage || null;

  if (!resultsContainer) {
    return;
  }

  if (status === 'idle' && !state.search.query) {
    renderEmptyMessage('Start typing to search the Spotify catalog.');
    return;
  }

  if (status === 'loading') {
    resultsContainer.hidden = false;
    resultsContainer.textContent = '';
    const panel = document.createElement('div');
    panel.className = 'result-grid';
    const message = document.createElement('div');
    message.className = 'state-message';
    const strong = document.createElement('strong');
    strong.textContent = 'Searching…';
    message.appendChild(strong);
    panel.appendChild(message);
    resultsContainer.appendChild(panel);
    return;
  }

  if (status === 'error') {
    resultsContainer.hidden = false;
    resultsContainer.textContent = '';
    const message = document.createElement('div');
    message.className = 'state-message';
    const strong = document.createElement('strong');
    strong.textContent = `Couldn't reach Spotify. ${errorMessage || ''}`.trim();
    message.appendChild(strong);
    if (onRetry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Try again';
      button.addEventListener('click', onRetry);
      message.appendChild(button);
    }
    resultsContainer.appendChild(message);
    return;
  }
};

export const resetSearchState = ({ announce = true } = {}) => {
  state.search.status = 'idle';
  state.search.query = searchInput?.value || '';
  state.search.results = { tracks: [], albums: [] };
  state.search.error = null;
  state.search.activeTab = 'tracks';

  if (resultsContainer) {
    resultsContainer.hidden = false;
    resultsContainer.textContent = '';
  }

  closeReleaseView();

  if (announce) {
    renderEmptyMessage('Start typing to search the Spotify catalog.');
  }
};

export const focusFirstResult = () => {
  if (!resultsContainer) {
    return;
  }
  const focusable = resultsContainer.querySelector('[data-focus-index="0"]');
  if (focusable) {
    focusable.focus();
  }
};

