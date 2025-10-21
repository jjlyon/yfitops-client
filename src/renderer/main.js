import { state } from './state.js';
import {
  initSearchResults,
  renderEmptyMessage,
  toggleLoading,
  renderResults,
  updateSearchStatus,
  resetSearchState,
  focusFirstResult,
  closeAllTrackMenus
} from './views/searchResults.js';
import { initReleaseView, closeReleaseView } from './views/releaseView.js';
import { initAuth, updateForProfile, showLoginPrompt, showError } from './auth.js';

const getSpotify = () => window.spotify;

const setupSearch = ({ searchInput, resultsContainer }) => {
  let debounceTimer = null;

  const performSearch = async (query) => {
    const trimmed = query.trim();
    state.search.query = trimmed;

    if (!trimmed) {
      resetSearchState();
      toggleLoading(false);
      return;
    }

    closeReleaseView();

    const requestId = state.search.lastIssuedRequest + 1;
    state.search.lastIssuedRequest = requestId;
    updateSearchStatus('loading');
    toggleLoading(true);

    const timer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.info('search_latency_warning', {
        queryLength: trimmed.length,
        requestId
      });
    }, 1000);

    try {
      const spotify = getSpotify();
      if (!spotify?.search) {
        throw new Error('Spotify integration is unavailable in this build.');
      }

      const results = await spotify.search(trimmed);
      clearTimeout(timer);

      if (state.search.lastIssuedRequest !== requestId) {
        return;
      }

      state.search.lastCompletedRequest = requestId;
      state.search.results = {
        tracks: results?.tracks || [],
        albums: results?.albums || []
      };
      state.search.activeTab = 'tracks';
      toggleLoading(false);
      updateSearchStatus('success');
      renderResults();
    } catch (error) {
      clearTimeout(timer);
      if (state.search.lastIssuedRequest !== requestId) {
        return;
      }

      toggleLoading(false);
      const message = error?.message || 'Please try again.';
      updateSearchStatus('error', message, {
        onRetry: () => {
          if (state.search.query) {
            performSearch(state.search.query);
          }
        }
      });
      // eslint-disable-next-line no-console
      console.error('search_error', error);
    }
  };

  const debounceSearch = (event) => {
    const { value } = event.target;
    state.search.query = value;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (!value.trim()) {
      debounceTimer = setTimeout(() => {
        resetSearchState();
        toggleLoading(false);
      }, 50);
      return;
    }

    debounceTimer = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  if (searchInput) {
    searchInput.addEventListener('input', debounceSearch);
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        performSearch(event.target.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        searchInput.value = '';
        state.search.query = '';
        resetSearchState();
        toggleLoading(false);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusFirstResult();
      }
    });
  }

  if (resultsContainer) {
    resultsContainer.addEventListener('keydown', (event) => {
      const current = event.target.closest('[data-focus-index]');
      if (!current) {
        return;
      }

      const currentIndex = Number(current.dataset.focusIndex);

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = resultsContainer.querySelector(`[data-focus-index="${currentIndex + 1}"]`);
        if (next) {
          next.focus();
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (currentIndex === 0) {
          searchInput?.focus();
          return;
        }
        const prev = resultsContainer.querySelector(`[data-focus-index="${currentIndex - 1}"]`);
        if (prev) {
          prev.focus();
        }
      } else if (event.key === 'Escape') {
        closeAllTrackMenus();
        searchInput?.focus();
      }
    });

    resultsContainer.addEventListener('click', (event) => {
      if (!resultsContainer.contains(event.target)) {
        return;
      }
      if (!event.target.closest('.track-card')) {
        closeAllTrackMenus();
      }
    });
  }
};

const refreshState = async ({ loginButton, status }) => {
  const spotify = getSpotify();
  if (!spotify) {
    showError('Spotify integration is unavailable in this build.');
    if (loginButton) {
      loginButton.hidden = true;
    }
    return;
  }

  const configured = await spotify.isConfigured();
  if (!configured) {
    showError('Set Spotify credentials (client ID, secret, redirect URI) before logging in.');
    if (loginButton) {
      loginButton.hidden = true;
    }
    return;
  }

  const authenticated = await spotify.isAuthenticated();
  if (authenticated) {
    try {
      const profile = await spotify.getCurrentUser();
      updateForProfile(profile);
    } catch (error) {
      const message = error?.message || String(error);
      showError(`Unable to load Spotify profile: ${message}`);
    }
  } else {
    showLoginPrompt('Connect your Spotify account to get started.');
  }

};

const setupAuth = ({ loginButton, status }) => {
  if (!loginButton) {
    return;
  }

  loginButton.addEventListener('click', async () => {
    loginButton.disabled = true;
    if (status) {
      status.textContent = 'Opening Spotify login…';
    }

    try {
      const spotify = getSpotify();
      if (!spotify?.login) {
        throw new Error('Spotify integration is unavailable in this build.');
      }

      const profile = await spotify.login();
      updateForProfile(profile);
    } catch (error) {
      const message = error?.message || String(error);
      showError(`Spotify login failed: ${message}`);
    }
  });
};

const bootstrap = () => {
  const info = window.appInfo;
  if (info) {
    document.title = info.name;
  }

  const status = document.getElementById('status');
  const loginButton = document.getElementById('spotifyLogin');
  const searchInput = document.getElementById('globalSearchInput');
  const searchSpinner = document.getElementById('searchSpinner');
  const searchWrapper = document.getElementById('searchWrapper');
  const searchTooltip = document.getElementById('searchTooltip');
  const resultsContainer = document.getElementById('resultsContainer');
  const searchView = document.getElementById('searchView');
  const authView = document.getElementById('authView');
  const releaseView = document.getElementById('releaseView');

  initSearchResults({
    resultsContainer,
    searchInput,
    searchSpinner
  });

  initReleaseView({
    releaseView,
    resultsContainer,
    searchInput,
    searchShell: searchView,
    getSpotify,
    onResultsRequested: renderResults
  });

  initAuth({
    loginButton,
    status,
    searchInput,
    searchTooltip,
    searchWrapper,
    searchView,
    authView,
    resetSearchState,
    closeReleaseView
  });

  renderEmptyMessage('Checking Spotify login status…');

  setupSearch({ searchInput, resultsContainer });
  setupAuth({ loginButton, status });
  refreshState({ loginButton, status }).catch((error) => {
    const message = error?.message || String(error);
    showError(`Unable to verify Spotify status: ${message}`);
  });
};

document.addEventListener('DOMContentLoaded', bootstrap);
