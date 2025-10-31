import { state, tabs } from '../state.js';
import { createImage, summariseArtists } from '../utils.js';
import { queueTrack } from '../queue.js';
import { showToast, showBanner, dismissBanner } from '../feedback.js';
import { openReleaseView, closeReleaseView } from './releaseView.js';

let resultsContainer = null;
let searchInput = null;
let searchSpinner = null;

const CONTEXT_MISMATCH_BANNER_ID = 'context-mismatch';

const openQueuePlaylist = (url) => {
  if (!url) {
    return;
  }
  window.open(url, '_blank', 'noopener');
};

const buildSuccessMessage = (result) => {
  const { entity, mode, uris } = result || {};
  const count = Array.isArray(uris) ? uris.length : 0;

  if (entity?.type === 'album') {
    const trackLabel = `${count} track${count === 1 ? '' : 's'} from “${entity.name || 'album'}”`;
    if (mode === 'append') {
      return `Added ${trackLabel} to the YFitOps queue.`;
    }
    return `${trackLabel} will play next from the YFitOps queue.`;
  }

  const trackLabel = `“${entity?.name || 'Track'}”`;
  if (mode === 'append') {
    return `Added ${trackLabel} to the YFitOps queue.`;
  }
  if (mode === 'next') {
    return `${trackLabel} will play next from the YFitOps queue.`;
  }
  if (mode === 'now') {
    return `${trackLabel} is queued to start after the current track.`;
  }
  return 'Added selection to the YFitOps queue.';
};

const buildToastDescription = (result) => {
  const parts = [];
  const playback = result?.playback;

  if (playback?.matchesQueue === false) {
    const contextName = playback?.description || 'a different source';
    parts.push(`Spotify is currently playing from ${contextName}.`);
  } else if (playback?.error) {
    parts.push('Unable to confirm the active playback context.');
  }

  if (result?.playlistUrl) {
    parts.push('Open the queue playlist to review upcoming tracks.');
  }

  return parts.length ? parts.join(' ') : undefined;
};

const showQueueSuccessFeedback = (result) => {
  const message = buildSuccessMessage(result);
  const description = buildToastDescription(result);
  const playlistUrl = result?.playlistUrl;

  showToast({
    message,
    description,
    variant: 'success',
    actionLabel: playlistUrl ? 'Open queue' : undefined,
    onAction: playlistUrl ? () => openQueuePlaylist(playlistUrl) : undefined
  });
};

const handleContextMismatchBanner = (result) => {
  const playback = result?.playback;
  if (!playback) {
    dismissBanner(CONTEXT_MISMATCH_BANNER_ID);
    return;
  }

  if (playback.matchesQueue === false) {
    const playlistUrl = result?.playlistUrl;
    const contextName = playback.description || 'another source';
    showBanner({
      id: CONTEXT_MISMATCH_BANNER_ID,
      title: 'Playback is in another context',
      message: `Tracks were added to the YFitOps queue, but Spotify is currently playing from ${contextName}. Switch to the queue playlist so they play next.`,
      variant: 'warning',
      actionLabel: playlistUrl ? 'Open queue playlist' : undefined,
      onAction: playlistUrl ? () => openQueuePlaylist(playlistUrl) : undefined,
      dismissLabel: 'Dismiss'
    });
  } else {
    dismissBanner(CONTEXT_MISMATCH_BANNER_ID);
  }
};

const handleTrackQueueAction = async ({ track, action }) => {
  const analyticsPayload = {
    entityType: 'track',
    action,
    uri: track?.uri,
    queryLength: state.search.query.length
  };

  // eslint-disable-next-line no-console
  console.info('search_result_clicked', analyticsPayload);

  try {
    const result = await queueTrack({ track, mode: action, source: 'search_results' });
    showQueueSuccessFeedback(result);
    handleContextMismatchBanner(result);
    // eslint-disable-next-line no-console
    console.info('queue_action_completed', {
      ...analyticsPayload,
      playlistId: result?.playlistId,
      mode: result?.mode,
      trackCount: Array.isArray(result?.uris) ? result.uris.length : 0
    });
  } catch (error) {
    const message = error?.message || 'Please try again.';
    showToast({
      message: `Couldn't queue “${track?.name || 'track'}”.`,
      description: message,
      variant: 'error'
    });
    // eslint-disable-next-line no-console
    console.error('queue_action_failed', {
      ...analyticsPayload,
      message
    });
  }
};

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
    .querySelectorAll('.track-result')
    .forEach((trackItem) => {
      trackItem.classList.remove('queue-options-open');
      const queueButton = trackItem.querySelector('.queue-button');
      if (queueButton) {
        queueButton.setAttribute('aria-expanded', 'false');
        queueButton.dataset.hoverZone = 'append_queue';
        queueButton.removeAttribute('data-expanded');
        queueButton.removeAttribute('data-pointer');
      }
      const keyboardGroup = trackItem.querySelector('.queue-keyboard-group');
      if (keyboardGroup) {
        keyboardGroup.hidden = true;
      }
    });
};

const buildTrackCard = (track, index) => {
  const trackItem = document.createElement('div');
  trackItem.className = 'track-result';

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

  const queueControl = document.createElement('div');
  queueControl.className = 'queue-control';

  const queueButton = document.createElement('button');
  queueButton.type = 'button';
  queueButton.className = 'queue-button';
  queueButton.setAttribute('aria-label', 'Queue options: play next or add to queue');
  queueButton.setAttribute('aria-haspopup', 'menu');
  queueButton.dataset.hoverZone = 'append_queue';

  const queuePeek = document.createElement('span');
  queuePeek.className = 'queue-peek';
  queuePeek.setAttribute('aria-hidden', 'true');
  const queuePeekIcon = document.createElement('span');
  queuePeekIcon.className = 'queue-peek-icon';
  ['queue-peek-bar--one', 'queue-peek-bar--two', 'queue-peek-bar--three'].forEach((className) => {
    const bar = document.createElement('span');
    bar.className = `queue-peek-bar ${className}`;
    queuePeekIcon.appendChild(bar);
  });
  queuePeek.appendChild(queuePeekIcon);

  const queueStack = document.createElement('span');
  queueStack.className = 'queue-stack';
  queueStack.setAttribute('aria-hidden', 'true');

  ['queue-stack-bar--one', 'queue-stack-bar--two', 'queue-stack-bar--three'].forEach((className) => {
    const bar = document.createElement('span');
    bar.className = `queue-stack-bar ${className}`;
    queueStack.appendChild(bar);
  });

  const queueStackHighlight = document.createElement('span');
  queueStackHighlight.className = 'queue-stack-highlight';
  queueStack.appendChild(queueStackHighlight);

  queueButton.appendChild(queueStack);
  queueButton.appendChild(queuePeek);

  const queueKeyboardGroup = document.createElement('div');
  queueKeyboardGroup.className = 'queue-keyboard-group';
  const keyboardGroupId = `queue-options-${track.id || index}`;
  queueKeyboardGroup.id = keyboardGroupId;
  queueKeyboardGroup.hidden = true;
  queueKeyboardGroup.setAttribute('role', 'group');
  queueKeyboardGroup.setAttribute('aria-label', 'Queue actions');

  queueButton.setAttribute('aria-controls', keyboardGroupId);
  queueButton.setAttribute('aria-expanded', 'false');

  let pointerInteraction = false;

  const closeKeyboardGroup = () => {
    queueKeyboardGroup.hidden = true;
    trackItem.classList.remove('queue-options-open');
    queueButton.setAttribute('aria-expanded', 'false');
    queueButton.removeAttribute('data-expanded');
    queueButton.removeAttribute('data-pointer');
    queueButton.dataset.hoverZone = 'append_queue';
  };

  const openKeyboardGroup = () => {
    closeAllTrackMenus();
    queueKeyboardGroup.hidden = false;
    trackItem.classList.add('queue-options-open');
    queueButton.setAttribute('aria-expanded', 'true');
    queueButton.setAttribute('data-expanded', 'true');
  };

  const triggerQueueAction = async (action) => {
    closeAllTrackMenus();
    queueButton.disabled = true;
    queueButton.setAttribute('aria-busy', 'true');
    try {
      await handleTrackQueueAction({ track, action });
    } finally {
      queueButton.disabled = false;
      queueButton.removeAttribute('aria-busy');
      queueButton.dataset.hoverZone = 'append_queue';
    }
  };

  const determineActionFromEvent = (event) => {
    const rect = queueButton.getBoundingClientRect();
    if (typeof event.clientY !== 'number') {
      return 'append_queue';
    }
    const relativeY = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
    const split = rect.height * 0.4;
    return relativeY <= split ? 'play_next' : 'append_queue';
  };

  const updateHoverZone = (event) => {
    const action = determineActionFromEvent(event);
    queueButton.dataset.hoverZone = action;
  };

  queueButton.addEventListener('pointerenter', (event) => {
    closeAllTrackMenus();
    queueButton.setAttribute('data-pointer', 'true');
    updateHoverZone(event);
  });

  queueButton.addEventListener('pointerdown', (event) => {
    pointerInteraction = true;
    updateHoverZone(event);
  });

  queueButton.addEventListener('pointermove', (event) => {
    updateHoverZone(event);
  });

  queueButton.addEventListener('pointerleave', () => {
    pointerInteraction = false;
    queueButton.dataset.hoverZone = 'append_queue';
    queueButton.removeAttribute('data-pointer');
  });

  queueButton.addEventListener('blur', () => {
    pointerInteraction = false;
    queueButton.removeAttribute('data-pointer');
  });

  queueButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (pointerInteraction || event.pointerType === 'mouse' || event.pointerType === 'pen') {
      const action = queueButton.dataset.hoverZone === 'play_next' ? 'play_next' : 'append_queue';
      await triggerQueueAction(action);
      pointerInteraction = false;
      return;
    }

    if (queueKeyboardGroup.hidden) {
      openKeyboardGroup();
      const firstButton = queueKeyboardGroup.querySelector('button');
      if (firstButton) {
        firstButton.focus();
      }
    } else {
      closeKeyboardGroup();
    }
  });

  queueButton.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (queueKeyboardGroup.hidden) {
        openKeyboardGroup();
      }
      const targetButton = queueKeyboardGroup.querySelector(
        event.key === 'ArrowUp' ? 'button[data-action="play_next"]' : 'button[data-action="append_queue"]'
      );
      if (targetButton) {
        targetButton.focus();
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (queueKeyboardGroup.hidden) {
        openKeyboardGroup();
        const firstButton = queueKeyboardGroup.querySelector('button');
        if (firstButton) {
          firstButton.focus();
        }
      } else {
        closeKeyboardGroup();
      }
    }
  });

  const buildKeyboardButton = ({ label, action }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'queue-keyboard-option';
    button.dataset.action = action;
    button.textContent = label;
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      closeAllTrackMenus();
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');

      try {
        await handleTrackQueueAction({ track, action });
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        closeKeyboardGroup();
      }
    });
    return button;
  };

  queueKeyboardGroup.appendChild(
    buildKeyboardButton({ label: 'Play next', action: 'play_next' })
  );
  queueKeyboardGroup.appendChild(
    buildKeyboardButton({ label: 'Add to queue', action: 'append_queue' })
  );

  queueControl.appendChild(queueButton);
  queueControl.appendChild(queueKeyboardGroup);

  queueKeyboardGroup.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeKeyboardGroup();
      queueButton.focus();
    }
  });

  queueControl.addEventListener('focusout', (event) => {
    if (queueControl.contains(event.relatedTarget)) {
      return;
    }
    closeKeyboardGroup();
  });

  card.appendChild(mainButton);
  trackItem.appendChild(card);
  trackItem.appendChild(queueControl);

  return trackItem;
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

