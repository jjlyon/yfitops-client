export const tabs = [
  { key: 'tracks', label: 'Tracks' },
  { key: 'albums', label: 'Albums & EPs' }
];

export const state = {
  profile: null,
  search: {
    query: '',
    status: 'idle',
    activeTab: 'tracks',
    results: { tracks: [], albums: [] },
    error: null,
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
  }
};
