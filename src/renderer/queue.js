import { state } from './state.js';

const getSpotify = () => window.spotify || null;

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

const filterUris = (uris = []) => {
  const seen = new Set();
  return uris
    .map((uri) => (typeof uri === 'string' ? uri.trim() : ''))
    .filter((uri) => {
      if (!uri) {
        return false;
      }
      if (seen.has(uri)) {
        return false;
      }
      seen.add(uri);
      return true;
    });
};

const ensureQueuePlaylist = async (spotify) => {
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

const fetchPlaybackContext = async (spotify, queueUri) => {
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

const queueUris = async ({ uris, mode = 'append', source }) => {
  const spotify = getSpotify();
  if (!spotify) {
    throw new Error('Spotify integration is unavailable in this build.');
  }

  const filteredUris = filterUris(uris);
  if (filteredUris.length === 0) {
    throw new Error('No playable Spotify tracks were provided.');
  }

  const queueInfo = await ensureQueuePlaylist(spotify);

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

  const playback = await fetchPlaybackContext(spotify, queueInfo.uri);

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

const fetchAlbumTracks = async (album) => {
  if (!album?.id) {
    throw new Error('A Spotify album ID is required.');
  }
  const spotify = getSpotify();
  if (!spotify) {
    throw new Error('Spotify integration is unavailable in this build.');
  }
  if (!spotify.getAlbum) {
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

  return { album: fullAlbum || album, uris };
};

export const queueTrack = async ({ track, mode, source } = {}) => {
  if (!track?.uri) {
    throw new Error('Track URI is required to queue.');
  }
  const resolvedMode = normaliseMode(mode);
  const result = await queueUris({ uris: [track.uri], mode: resolvedMode, source });
  return {
    ...result,
    entity: {
      type: 'track',
      id: track.id || null,
      name: track.name || 'Track'
    }
  };
};

export const queueAlbum = async ({ album, mode, source } = {}) => {
  const { album: fullAlbum, uris } = await fetchAlbumTracks(album);
  const resolvedMode = normaliseMode(mode);
  const result = await queueUris({ uris, mode: resolvedMode, source });
  return {
    ...result,
    entity: {
      type: 'album',
      id: fullAlbum?.id || album?.id || null,
      name: fullAlbum?.name || album?.name || 'Album',
      trackCount: uris.length
    }
  };
};

export const getQueueSnapshot = () => ({
  queue: { ...state.queue },
  playback: { ...state.playback }
});
