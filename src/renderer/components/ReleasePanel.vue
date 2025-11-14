<template>
  <div
    v-if="release.active"
    ref="panelRef"
    class="release-view"
    aria-live="polite"
    aria-label="Release details"
    tabindex="-1"
    @keydown="handleKeydown"
  >
    <div class="release-header">
      <button type="button" class="release-back" @click="close">
        Back to results
      </button>
      <h2>{{ heading }}</h2>
    </div>

    <div v-if="isInitialLoading" class="release-status">Loading release details…</div>

    <template v-else-if="isError">
      <div class="release-status">{{ errorMessage }}</div>
      <button type="button" class="release-retry" @click="retry">Retry</button>
    </template>

    <template v-else-if="album">
      <div class="release-content">
        <div class="release-artwork">
          <img :src="artworkUrl" :alt="`${album.name} cover art`" />
        </div>
        <div class="release-details">
          <h3>{{ album.name }}</h3>
          <p>{{ artists }}</p>
          <p>{{ releaseMeta }}</p>
        </div>
      </div>

      <div class="release-tracklist">
        <template v-if="tracks.length === 0">
          <div class="release-status">
            {{ release.status === 'loading' ? 'Loading tracks…' : 'Track listing unavailable for this release.' }}
          </div>
        </template>
        <template v-else>
          <div
            v-for="(track, index) in tracks"
            :key="track.id || index"
            :class="['tracklist-item', { highlight: release.highlightTrackId && track.id === release.highlightTrackId }]"
          >
            <div>{{ index + 1 }}. {{ track.name }}</div>
            <span>{{ formatDuration(track.duration_ms) }}</span>
          </div>
        </template>
      </div>

      <div v-if="release.status === 'loading'" class="release-status">Fetching updated tracklist…</div>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useAppStore } from '../stores/appStore.js';
import { formatDuration, formatReleaseMeta, summariseArtists } from '../utils.js';

const store = useAppStore();
const panelRef = ref(null);

const release = store.state.release;

const album = computed(() => release.album);
const heading = computed(() => {
  if (album.value?.name) {
    return album.value.name;
  }
  if (release.status === 'loading') {
    return 'Loading release…';
  }
  if (release.status === 'error') {
    return 'Release unavailable';
  }
  return 'Release';
});

const isInitialLoading = computed(() => release.status === 'loading' && !album.value);
const isError = computed(() => release.status === 'error');

const errorMessage = computed(() => {
  if (!release.error) {
    return "Couldn't load release details.";
  }
  return `Couldn't load release details. ${release.error}`.trim();
});

const tracks = computed(() => {
  const trackContainer = album.value?.tracks;
  if (Array.isArray(trackContainer)) {
    return trackContainer;
  }
  return trackContainer?.items || [];
});

const artworkUrl = computed(() => {
  const images = album.value?.images || [];
  return images[0]?.url || 'https://via.placeholder.com/200?text=Spotify';
});

const artists = computed(() => summariseArtists(album.value?.artists || []));
const releaseMeta = computed(() => formatReleaseMeta(album.value));

const close = () => {
  store.actions.release.close();
};

const retry = () => {
  if (!release.albumId) {
    return;
  }
  store.actions.release.open({
    albumId: release.albumId,
    initialAlbum: album.value,
    highlightTrackId: release.highlightTrackId
  });
};

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
  }
};

watch(
  () => release.active,
  (active) => {
    if (active) {
      nextTick(() => {
        panelRef.value?.focus();
      });
    }
  }
);
</script>

<style scoped>
.release-view {
  position: absolute;
  inset: 0;
  padding: 2rem;
  border-radius: 1.35rem;
  background:
    linear-gradient(145deg, rgba(18, 18, 18, 0.95), rgba(12, 12, 12, 0.8)),
    radial-gradient(circle at 25% 20%, rgba(30, 215, 96, 0.16), transparent 55%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
  box-shadow: 0 40px 90px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(18px);
  z-index: 2;
  scrollbar-gutter: stable;
}

.release-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.release-back,
.release-retry {
  border: none;
  border-radius: 999px;
  padding: 0.5rem 1.1rem;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

.release-back:focus-visible,
.release-back:hover,
.release-retry:focus-visible,
.release-retry:hover {
  background: rgba(30, 215, 96, 0.65);
  color: #000000;
}

.release-content {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1.5rem;
}

.release-artwork img {
  width: 200px;
  height: 200px;
  border-radius: 1.25rem;
  object-fit: cover;
}

.release-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.release-details h3 {
  margin: 0;
  font-size: 1.75rem;
}

.release-details p {
  margin: 0;
  opacity: 0.8;
}

.release-tracklist {
  background: rgba(0, 0, 0, 0.35);
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 280px;
  overflow-y: auto;
}

.tracklist-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: rgba(255, 255, 255, 0.05);
}

.tracklist-item.highlight {
  background: rgba(30, 215, 96, 0.25);
}

.tracklist-item span {
  opacity: 0.75;
  font-size: 0.85rem;
}

.release-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  opacity: 0.8;
}

@media (max-width: 640px) {
  .release-view {
    padding: 1.75rem 1.25rem;
    text-align: center;
  }

  .release-content {
    grid-template-columns: 1fr;
  }

  .release-details {
    align-items: center;
  }

  .release-artwork img {
    margin: 0 auto;
  }

  .release-tracklist {
    max-height: none;
  }
}
</style>
