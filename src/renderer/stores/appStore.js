import { inject, reactive, readonly } from 'vue';
import { provideFeedbackStore } from './feedbackStore.js';

const appStoreKey = Symbol('appStore');

export const tabs = [
  { key: 'tracks', label: 'Tracks' },
  { key: 'albums', label: 'Albums & EPs' }
];

const CONTEXT_MISMATCH_BANNER_ID = 'context-mismatch';

const normaliseMode = (mode) => {
  switch (mode) {
    case 'play_now':
    case 'now':
      return 'now';
    case 'play_next':
    case 'next':
      return 'next';
    case 'append_queue':
    case 'append':
    default:
      return 'append';
  }
};

const describeContext = (context) => {
  const metadata = context?.metadata || {};
  if (metadata?.context_description) {
    return metadata.context_description;
  }
  if (context?.type) {
    const type = context.type.replace(/_/g, ' ');
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
  return 'another source';
};

export const useAppStore = () => {
  const store = inject(appStoreKey, null);
  if (!store) {
    throw new Error('App store is not provided.');
  }
  return store;
};

export const provideAppStore = (provide, { spotify }) => {
  const feedback = provideFeedbackStore(provide);

  const state = reactive({
    profile: null,
    auth: {
      status: 'checking',
      message: 'Checking Spotify login status…',
      loggingIn: false
    },
    search: {
      enabled: false,
      query: '',
      status: 'idle',
      activeTab: 'tracks',
      results: { tracks: [], albums: [] },
      error: null,
      loading: false,
      lastIssuedRequest: 0,
      lastCompletedRequest: 0
    },
    release: {
      active: false,
      status: 'idle',
      album: null,
      albumId: null,
      highlightTrackId: null,
      requestId: 0,
      error: null
    },
    queue: {
      playlistId: null,
      uri: null,
      lastSynced: 0
    },
    playback: {
      contextUri: null,
      lastChecked: 0,
      queueUri: null,
      contextMatchesQueue: true,
      description: null,
      error: null
    }
  });

  let searchDebounceTimer = null;

  const resetSearchState = ({ announce = true } = {}) => {
    state.search.status = 'idle';
    state.search.query = '';
    state.search.results = { tracks: [], albums: [] };
    state.search.error = null;
    state.search.activeTab = 'tracks';
    state.search.loading = false;
    if (!announce) {
      return;
    }
  };

  const ensureQueuePlaylist = async () => {
    if (state.queue.playlistId && state.queue.uri) {
      return {
        playlistId: state.queue.playlistId,
        uri: state.queue.uri
      };
    }

    if (!spotify?.ensureQueue) {
      throw new Error('Queue management is unavailable in this build.');
    }

    const result = await spotify.ensureQueue();

    let playlistId = result?.playlistId || null;
    let uri = result?.playlistUri || null;

    if (!playlistId && typeof uri === 'string') {
      const parts = uri.split(':');
      playlistId = parts[parts.length - 1] || null;
    }

    if (!uri && typeof playlistId === 'string') {
      uri = `spotify:playlist:${playlistId}`;
    }

    if (!playlistId || !uri) {
      throw new Error('Spotify did not return a queue playlist identifier.');
    }

    state.queue.playlistId = playlistId;
    state.queue.uri = uri;
    state.queue.lastSynced = Date.now();

    return { playlistId, uri };
  };

  const updatePlaybackState = ({ playback, queueUri, error }) => {
    const contextUri = playback?.context?.uri || null;
    const matches = queueUri && contextUri ? queueUri === contextUri : true;
    const description = playback ? describeContext(playback.context) : null;

    state.playback.contextUri = contextUri;
    state.playback.queueUri = queueUri || state.queue.uri || null;
    state.playback.contextMatchesQueue = matches;
    state.playback.description = description;
    state.playback.lastChecked = Date.now();
    state.playback.error = error ? error.message || String(error) : null;

    return {
      uri: contextUri,
      matchesQueue: matches,
      description,
      raw: playback || null,
      error: error ? error.message || String(error) : null
    };
  };

  const fetchPlaybackContext = async (queueUri) => {
    if (!spotify?.getPlaybackContext) {
      return updatePlaybackState({ playback: null, queueUri });
    }

    try {
      const playback = await spotify.getPlaybackContext();
      return updatePlaybackState({ playback, queueUri });
    } catch (error) {
      return updatePlaybackState({ playback: null, queueUri, error });
    }
  };

  const buildQueueSuccessMessage = (result) => {
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

  const handleContextMismatchBanner = (result) => {
    const playback = result?.playback;
    if (!playback) {
      feedback.dismissBanner(CONTEXT_MISMATCH_BANNER_ID);
      return;
    }

    if (playback.matchesQueue === false) {
      const playlistUrl = result?.playlistUrl;
      const contextName = playback.description || 'another source';
      feedback.showBanner({
        id: CONTEXT_MISMATCH_BANNER_ID,
        title: 'Playback is in another context',
        message: `Tracks were added to the YFitOps queue, but Spotify is currently playing from ${contextName}. Switch to the queue playlist so they play next.`,
        variant: 'warning',
        actionLabel: playlistUrl ? 'Open queue playlist' : undefined,
        onAction: playlistUrl ? () => window.open(playlistUrl, '_blank', 'noopener') : undefined,
        dismissLabel: 'Dismiss'
      });
    } else {
      feedback.dismissBanner(CONTEXT_MISMATCH_BANNER_ID);
    }
  };

  const queueUris = async ({ uris, mode = 'append', source }) => {
    if (!spotify) {
      throw new Error('Spotify integration is unavailable in this build.');
    }

    const filteredUris = Array.from(
      new Set((uris || []).map((uri) => (typeof uri === 'string' ? uri.trim() : '')).filter(Boolean))
    );

    if (filteredUris.length === 0) {
      throw new Error('No playable Spotify tracks were provided.');
    }

    const queueInfo = await ensureQueuePlaylist();

    if (!spotify.queueAppend) {
      throw new Error('Queue append API is unavailable.');
    }

    const appendResult = await spotify.queueAppend(filteredUris);
    const rangeLength = appendResult?.rangeLength ?? appendResult?.appendedCount ?? filteredUris.length;

    let reorderResult = null;
    if ((mode === 'next' || mode === 'now') && rangeLength > 0) {
      if (!spotify.queuePlayNext) {
        throw new Error('Queue reorder API is unavailable.');
      }
      reorderResult = await spotify.queuePlayNext({
        rangeStart: appendResult?.rangeStart,
        rangeLength,
        snapshotId: appendResult?.snapshotId || null
      });
    }

    const playback = await fetchPlaybackContext(queueInfo.uri);

    return {
      source: source || 'unknown',
      mode,
      uris: filteredUris,
      playlistId: queueInfo.playlistId,
      playlistUri: queueInfo.uri,
      playlistUrl: queueInfo.playlistId ? `https://open.spotify.com/playlist/${queueInfo.playlistId}` : null,
      appendResult,
      reorderResult,
      playback
    };
  };

  const queueTrack = async ({ track, mode, source } = {}) => {
    if (!track?.uri) {
      throw new Error('Track URI is required to queue.');
    }
    const resolvedMode = normaliseMode(mode);
    const result = await queueUris({ uris: [track.uri], mode: resolvedMode, source });
    return {
      ...result,
      entity: {
        type: 'track',
        name: track.name,
        uri: track.uri
      }
    };
  };

  const queueAlbum = async ({ album, mode, source } = {}) => {
    if (!album?.id) {
      throw new Error('Album information is required.');
    }

    if (!spotify?.getAlbum) {
      throw new Error('Album lookup is unavailable in this build.');
    }

    const fullAlbum = await spotify.getAlbum(album.id);
    const items = fullAlbum?.tracks?.items || [];
    const uris = items
      .map((track) => track?.uri || track?.linked_from?.uri || '')
      .filter(Boolean);

    if (uris.length === 0) {
      throw new Error('Spotify did not return playable tracks for this album.');
    }

    const result = await queueUris({ uris, mode: normaliseMode(mode), source });
    return {
      ...result,
      entity: {
        type: 'album',
        name: fullAlbum?.name || album.name,
        uri: fullAlbum?.uri || album.uri
      }
    };
  };

  const setProfile = (profile) => {
    state.profile = profile;
    state.auth.status = 'ready';
    state.auth.message = '';
    state.auth.loggingIn = false;
    state.search.enabled = true;
    resetSearchState({ announce: false });
  };

  const showLoginPrompt = (message) => {
    state.profile = null;
    state.auth.status = 'prompt';
    state.auth.message = message;
    state.auth.loggingIn = false;
    state.search.enabled = false;
    resetSearchState({ announce: false });
  };

  const showAuthError = (message) => {
    state.profile = null;
    state.auth.status = 'error';
    state.auth.message = message;
    state.auth.loggingIn = false;
    state.search.enabled = false;
    resetSearchState({ announce: false });
  };

  const performSearch = async (query) => {
    const trimmed = query.trim();
    state.search.query = trimmed;

    if (!trimmed) {
      resetSearchState();
      return;
    }

    state.release.active = false;

    const requestId = state.search.lastIssuedRequest + 1;
    state.search.lastIssuedRequest = requestId;
    state.search.status = 'loading';
    state.search.loading = true;
    state.search.error = null;

    const latencyTimer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.info('search_latency_warning', {
        queryLength: trimmed.length,
        requestId
      });
    }, 1000);

    try {
      if (!spotify?.search) {
        throw new Error('Spotify integration is unavailable in this build.');
      }

      const results = await spotify.search(trimmed);
      clearTimeout(latencyTimer);

      if (state.search.lastIssuedRequest !== requestId) {
        return;
      }

      state.search.lastCompletedRequest = requestId;
      const albumsExcludingSingles = (results?.albums || []).filter((album) => album?.album_type !== 'single');

      state.search.results = {
        tracks: results?.tracks || [],
        albums: albumsExcludingSingles
      };
      state.search.activeTab = 'tracks';
      state.search.status = 'success';
      state.search.loading = false;
    } catch (error) {
      clearTimeout(latencyTimer);
      if (state.search.lastIssuedRequest !== requestId) {
        return;
      }

      state.search.loading = false;
      const message = error?.message || 'Please try again.';
      state.search.status = 'error';
      state.search.error = message;
      // eslint-disable-next-line no-console
      console.error('search_error', error);
    }
  };

  const scheduleSearch = (value) => {
    state.search.query = value;

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    if (!value.trim()) {
      searchDebounceTimer = setTimeout(() => {
        resetSearchState();
      }, 50);
      return;
    }

    searchDebounceTimer = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const focusSearchResults = () => {
    // Placeholder for components to hook into when needed.
  };

  const setActiveTab = (key) => {
    if (!state.search.results[key]) {
      return;
    }
    state.search.activeTab = key;
  };

  const closeRelease = () => {
    state.release.active = false;
    state.release.status = 'idle';
    state.release.album = null;
    state.release.albumId = null;
    state.release.highlightTrackId = null;
    state.release.error = null;
  };

  const openRelease = async ({ albumId, initialAlbum, highlightTrackId }) => {
    if (!albumId) {
      return;
    }

    const requestId = state.release.requestId + 1;
    state.release.requestId = requestId;
    state.release.active = true;
    state.release.status = initialAlbum ? 'ready' : 'loading';
    state.release.album = initialAlbum || null;
    state.release.albumId = albumId;
    state.release.highlightTrackId = highlightTrackId || null;
    state.release.error = null;

    try {
      if (!spotify?.getAlbum) {
        throw new Error('Spotify integration is unavailable in this build.');
      }

      const album = await spotify.getAlbum(albumId);
      if (state.release.requestId !== requestId) {
        return;
      }

      state.release.album = album;
      state.release.status = 'ready';
    } catch (error) {
      if (state.release.requestId !== requestId) {
        return;
      }

      state.release.status = 'error';
      state.release.error = error?.message || 'Please try again.';
      // eslint-disable-next-line no-console
      console.error('release_view_error', error);
    }
  };

  const queueAndNotify = async ({ action, payload, analytics }) => {
    try {
      const result = await action(payload);
      const message = buildQueueSuccessMessage(result);
      const description = buildToastDescription(result);
      feedback.showToast({
        message,
        description,
        variant: 'success',
        actionLabel: result.playlistUrl ? 'Open queue' : undefined,
        onAction: result.playlistUrl
          ? () => window.open(result.playlistUrl, '_blank', 'noopener')
          : undefined
      });
      handleContextMismatchBanner(result);
      // eslint-disable-next-line no-console
      console.info('queue_action_completed', {
        ...analytics,
        playlistId: result?.playlistId,
        mode: result?.mode,
        trackCount: Array.isArray(result?.uris) ? result.uris.length : 0
      });
    } catch (error) {
      const message = error?.message || 'Please try again.';
      feedback.showToast({
        message: analytics.entityType === 'album'
          ? `Couldn't queue “${payload?.album?.name || 'release'}”.`
          : `Couldn't queue “${payload?.track?.name || 'track'}”.`,
        description: message,
        variant: 'error'
      });
      // eslint-disable-next-line no-console
      console.error('queue_action_failed', {
        ...analytics,
        message
      });
      throw error;
    }
  };

  const queueTrackFromSearch = async ({ track, mode }) => {
    await queueAndNotify({
      action: queueTrack,
      payload: { track, mode, source: 'search_results' },
      analytics: {
        entityType: 'track',
        action: mode,
        uri: track?.uri,
        queryLength: state.search.query.length
      }
    });
  };

  const queueAlbumFromSearch = async ({ album, mode }) => {
    await queueAndNotify({
      action: queueAlbum,
      payload: { album, mode, source: 'search_results' },
      analytics: {
        entityType: 'album',
        action: mode,
        uri: album?.uri,
        queryLength: state.search.query.length
      }
    });
  };

  const queueTrackFromRelease = async ({ track, mode }) => {
    await queueAndNotify({
      action: queueTrack,
      payload: { track, mode, source: 'release_view' },
      analytics: {
        entityType: 'track',
        action: mode,
        uri: track?.uri,
        albumId: state.release.albumId
      }
    });
  };

  const queueAlbumFromRelease = async ({ album, mode }) => {
    await queueAndNotify({
      action: queueAlbum,
      payload: { album, mode, source: 'release_view' },
      analytics: {
        entityType: 'album',
        action: mode,
        uri: album?.uri,
        albumId: state.release.albumId
      }
    });
  };

  const checkAuthStatus = async () => {
    if (!spotify) {
      showAuthError('Spotify integration is unavailable in this build.');
      return;
    }

    state.auth.status = 'checking';
    state.auth.message = 'Checking Spotify login status…';
    state.search.enabled = false;

    try {
      const configured = await spotify.isConfigured();
      if (!configured) {
        showAuthError('Set Spotify credentials (client ID, secret, redirect URI) before logging in.');
        return;
      }

      const authenticated = await spotify.isAuthenticated();
      if (authenticated) {
        try {
          const profile = await spotify.getCurrentUser();
          setProfile(profile);
        } catch (error) {
          const message = error?.message || String(error);
          showAuthError(`Unable to load Spotify profile: ${message}`);
        }
      } else {
        showLoginPrompt('Connect your Spotify account to get started.');
      }
    } catch (error) {
      const message = error?.message || String(error);
      showAuthError(`Unable to verify Spotify status: ${message}`);
    }
  };

  const login = async () => {
    if (!spotify?.login) {
      showAuthError('Spotify integration is unavailable in this build.');
      return;
    }

    state.auth.loggingIn = true;
    state.auth.message = 'Opening Spotify login…';

    try {
      const profile = await spotify.login();
      setProfile(profile);
    } catch (error) {
      const message = error?.message || String(error);
      showAuthError(`Spotify login failed: ${message}`);
    }
  };

  provide(appStoreKey, {
    state: readonly(state),
    feedback,
    tabs,
    actions: {
      auth: {
        checkStatus: checkAuthStatus,
        login
      },
      search: {
        scheduleSearch,
        performSearch,
        reset: resetSearchState,
        setActiveTab
      },
      release: {
        open: openRelease,
        close: closeRelease
      },
      queue: {
        fromSearch: queueTrackFromSearch,
        albumFromSearch: queueAlbumFromSearch,
        fromRelease: queueTrackFromRelease,
        albumFromRelease: queueAlbumFromRelease
      }
    }
  });

  return {
    state,
    feedback,
    tabs,
    actions: {
      auth: {
        checkStatus: checkAuthStatus,
        login
      },
      search: {
        scheduleSearch,
        performSearch,
        reset: resetSearchState,
        setActiveTab
      },
      release: {
        open: openRelease,
        close: closeRelease
      },
      queue: {
        fromSearch: queueTrackFromSearch,
        albumFromSearch: queueAlbumFromSearch,
        fromRelease: queueTrackFromRelease,
        albumFromRelease: queueAlbumFromRelease
      }
    }
  };
};
