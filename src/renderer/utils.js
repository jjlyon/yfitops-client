export const summariseArtists = (artists = []) => artists.map((artist) => artist.name).join(', ');

export const truncateText = (value, maxLength = 48) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 1))}…`;
};

export const createImage = (url, alt) => {
  const img = document.createElement('img');
  img.src = url || 'https://via.placeholder.com/200?text=Spotify';
  img.alt = alt;
  return img;
};

const formatReleaseType = (album) => {
  const type = album?.album_type;
  if (!type) {
    return 'Release';
  }
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export const formatReleaseMeta = (album) => {
  const parts = [];
  const releaseType = formatReleaseType(album);
  if (releaseType) {
    parts.push(releaseType);
  }
  if (album?.release_date) {
    parts.push(album.release_date);
  }
  if (typeof album?.total_tracks === 'number') {
    const trackCount = album.total_tracks;
    parts.push(`${trackCount} track${trackCount === 1 ? '' : 's'}`);
  }
  return parts.join(' • ');
};

export const formatDuration = (ms) => {
  if (!Number.isFinite(ms)) {
    return '';
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
