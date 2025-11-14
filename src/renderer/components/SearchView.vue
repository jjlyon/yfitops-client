<template>
  <div
    ref="resultsRef"
    class="results-container"
    role="region"
    aria-label="Search results"
    @click="handleContainerClick"
  >
    <div v-if="showIdleMessage" class="state-message">
      <strong>Start typing to search the Spotify catalog.</strong>
    </div>

    <div v-else-if="searchState.status === 'loading'" class="result-grid">
      <div class="state-message">
        <strong>Searching…</strong>
      </div>
    </div>

    <div v-else-if="searchState.status === 'error'" class="state-message">
      <strong>Couldn't reach Spotify. {{ searchState.error }}</strong>
      <button type="button" @click="retrySearch">Try again</button>
    </div>

    <template v-else-if="searchState.status === 'success'">
      <div v-if="totalResults === 0" class="state-message">
        <strong>No matches found.</strong>
      </div>
      <template v-else>
        <div class="results-tablist" role="tablist" aria-label="Result types">
          <button
            v-for="(tab, index) in tabs"
            :key="tab.key"
            type="button"
            class="results-tab"
            :id="`results-tab-${tab.key}`"
            role="tab"
            :aria-selected="searchState.activeTab === tab.key"
            :tabindex="searchState.activeTab === tab.key ? 0 : -1"
            @click="selectTab(tab.key)"
            @keydown.arrow-right.prevent="focusNextTab(index + 1)"
            @keydown.arrow-left.prevent="focusNextTab(index - 1)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div
          class="result-grid"
          :id="`results-panel-${searchState.activeTab}`"
          role="tabpanel"
          :aria-labelledby="`results-tab-${searchState.activeTab}`"
        >
          <template v-if="activeItems.length === 0">
            <div class="state-message">
              <strong>No {{ activeTabLabel.toLowerCase() }} found.</strong>
            </div>
          </template>
          <template v-else>
            <article
              v-for="(item, index) in activeItems"
              :key="item.id || `${searchState.activeTab}-${index}`"
              :class="['result-card', isTracksTab ? 'track-card' : 'album-card', { 'track-menu-open': isMenuOpen(item) }]"
            >
              <button
                type="button"
                class="result-main"
                :data-focus-index="index"
                :ref="(el) => setFocusTarget(el, index)"
                @click="viewRelease(item, index)"
                @keydown.arrow-down.prevent="focusItem(index + 1)"
                @keydown.arrow-up.prevent="focusItem(index - 1)"
                @keydown.escape.prevent="handleEscape()"
              >
                <div class="result-meta">
                  <img :src="artworkUrl(item)" :alt="`${item.name} cover art`" />
                  <div class="text-group">
                    <strong>{{ item.name }}</strong>
                    <span>{{ summarise(item) }}</span>
                  </div>
                </div>
              </button>

              <template v-if="isTracksTab">
                <button
                  type="button"
                  class="menu-toggle"
                  :aria-expanded="openMenuId === item.id ? 'true' : 'false'"
                  @click.stop="toggleMenu(item)"
                >
                  Queue
                </button>
                <div class="result-actions">
                  <button
                    v-for="action in trackActions"
                    :key="action.mode"
                    type="button"
                    @click.stop="queueTrack(item, action.mode)"
                    :disabled="pendingAction === actionKey(item, action.mode)"
                    :aria-busy="pendingAction === actionKey(item, action.mode) ? 'true' : 'false'"
                  >
                    {{ action.label }}
                  </button>
                </div>
              </template>
            </article>
          </template>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useAppStore } from '../stores/appStore.js';
import { summariseArtists } from '../utils.js';

const store = useAppStore();
const emit = defineEmits(['focus-search']);

const resultsRef = ref(null);
const focusTargets = ref([]);
const openMenuId = ref(null);
const pendingAction = ref(null);
const lastFocusIndex = ref(null);

const searchState = store.state.search;
const releaseState = store.state.release;
const tabs = store.tabs;

const trackActions = [
  { label: 'Play', mode: 'play_now' },
  { label: 'Play Next', mode: 'play_next' },
  { label: 'Add to Queue', mode: 'append_queue' }
];

const showIdleMessage = computed(
  () => searchState.status === 'idle' && !searchState.query
);

const totalResults = computed(() => {
  const tracks = store.state.search.results.tracks || [];
  const albums = store.state.search.results.albums || [];
  return tracks.length + albums.length;
});

const isTracksTab = computed(() => searchState.activeTab === 'tracks');

const activeItems = computed(() => {
  const results = store.state.search.results[searchState.activeTab];
  return Array.isArray(results) ? results : [];
});

const activeTabLabel = computed(() => {
  const tab = tabs.find((entry) => entry.key === searchState.activeTab);
  return tab ? tab.label : 'Results';
});

const setFocusTarget = (el, index) => {
  if (el) {
    focusTargets.value[index] = el;
  }
};

const focusItem = (index) => {
  if (index < 0) {
    emit('focus-search');
    return;
  }
  nextTick(() => {
    const target = focusTargets.value[index];
    if (target) {
      target.focus();
    } else {
      emit('focus-search');
    }
  });
};

const focusFirstResult = () => {
  focusItem(0);
};

defineExpose({
  focusFirstResult,
  focusItem
});

const resetFocusTargets = () => {
  focusTargets.value = [];
  nextTick(() => {
    if (lastFocusIndex.value != null) {
      focusItem(lastFocusIndex.value);
    }
  });
};

watch(activeItems, resetFocusTargets);

watch(
  () => releaseState.active,
  (active, wasActive) => {
    if (!active && wasActive) {
      if (lastFocusIndex.value != null) {
        focusItem(lastFocusIndex.value);
      } else {
        emit('focus-search');
      }
      lastFocusIndex.value = null;
    }
  }
);

const summarise = (item) => {
  if (Array.isArray(item.artists)) {
    return summariseArtists(item.artists);
  }
  return '';
};

const artworkUrl = (item) => {
  const images = item.album?.images || item.images || [];
  return images[0]?.url || 'https://via.placeholder.com/200?text=Spotify';
};

const selectTab = (key) => {
  store.actions.search.setActiveTab(key);
  nextTick(() => {
    focusFirstResult();
  });
};

const focusNextTab = (index) => {
  const total = tabs.length;
  let nextIndex = index;
  if (nextIndex < 0) {
    nextIndex = total - 1;
  } else if (nextIndex >= total) {
    nextIndex = 0;
  }
  selectTab(tabs[nextIndex].key);
  const tabElement = resultsRef.value?.querySelector(`#results-tab-${tabs[nextIndex].key}`);
  tabElement?.focus();
};

const viewRelease = (item, index) => {
  lastFocusIndex.value = index;
  openMenuId.value = null;
  if (searchState.activeTab === 'tracks') {
    store.actions.release.open({
      albumId: item.album?.id,
      initialAlbum: item.album,
      highlightTrackId: item.id
    });
    // eslint-disable-next-line no-console
    console.info('search_result_clicked', {
      entityType: 'track',
      action: 'view_release',
      uri: item.uri,
      queryLength: searchState.query.length
    });
  } else {
    store.actions.release.open({
      albumId: item.id,
      initialAlbum: item
    });
    // eslint-disable-next-line no-console
    console.info('search_result_clicked', {
      entityType: 'album',
      action: 'view_release',
      uri: item.uri,
      queryLength: searchState.query.length
    });
  }
};

const toggleMenu = (item) => {
  openMenuId.value = openMenuId.value === item.id ? null : item.id;
};

const isMenuOpen = (item) => openMenuId.value === item.id;

const actionKey = (item, mode) => `${item.id}-${mode}`;

const queueTrack = async (track, mode) => {
  openMenuId.value = null;
  const key = actionKey(track, mode);
  pendingAction.value = key;
  try {
    await store.actions.queue.fromSearch({ track, mode });
  } finally {
    pendingAction.value = null;
  }
};

const retrySearch = () => {
  store.actions.search.performSearch(searchState.query || '');
};

const handleEscape = () => {
  openMenuId.value = null;
  emit('focus-search');
};

const handleContainerClick = (event) => {
  if (!resultsRef.value) {
    return;
  }
  if (!event.target.closest('.track-card')) {
    openMenuId.value = null;
  }
};

const handleOutsideKey = (event) => {
  if (event.key === 'Escape') {
    openMenuId.value = null;
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleOutsideKey);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleOutsideKey);
});
</script>

<style scoped>
.results-container {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 260px;
}

.state-message {
  padding: 2.5rem 1.5rem;
  border-radius: 1.25rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
}

.state-message button {
  margin-top: 1rem;
  padding: 0.65rem 1.4rem;
  border-radius: 999px;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

.state-message strong {
  display: block;
  font-size: 1.1rem;
  margin-bottom: 0.25rem;
}

.results-tablist {
  display: flex;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 999px;
  padding: 0.35rem;
  align-self: flex-start;
}

.results-tab {
  border: none;
  border-radius: 999px;
  padding: 0.5rem 1.1rem;
  background: transparent;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  opacity: 0.7;
}

.results-tab:focus-visible {
  outline: 2px solid rgba(30, 215, 96, 0.9);
  outline-offset: 2px;
}

.results-tab[aria-selected='true'] {
  background: rgba(30, 215, 96, 0.8);
  color: #000000;
  opacity: 1;
}

.result-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.result-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  position: relative;
  transition: transform 0.2s ease, background 0.2s ease;
}

.result-card:focus-within,
.result-card:hover {
  transform: translateY(-2px);
  background: rgba(30, 215, 96, 0.15);
}

.result-card img {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
}

.result-card .result-meta {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.result-card .text-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.result-card .text-group strong {
  font-size: 1rem;
}

.result-card .text-group span {
  font-size: 0.85rem;
  opacity: 0.75;
}

.result-card button.result-main {
  all: unset;
  cursor: pointer;
  display: flex;
  width: 100%;
}

.result-card button.result-main:focus-visible {
  outline: 2px solid rgba(30, 215, 96, 0.9);
  outline-offset: 3px;
}

.result-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.result-actions button {
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: none;
  background: rgba(0, 0, 0, 0.35);
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.track-card {
  position: relative;
}

.track-card .menu-toggle {
  position: absolute;
  top: 1rem;
  right: 1rem;
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  background: rgba(0, 0, 0, 0.45);
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  opacity: 0.8;
}

.track-card .menu-toggle:focus-visible,
.track-card.track-menu-open .menu-toggle {
  outline: 2px solid rgba(30, 215, 96, 0.9);
  outline-offset: 2px;
  opacity: 1;
}

.track-card .result-actions {
  display: none;
}

.track-card.track-menu-open .result-actions {
  display: flex;
}

.result-actions button:hover,
.result-actions button:focus-visible {
  background: rgba(30, 215, 96, 0.65);
  color: #000000;
}

@media (max-width: 640px) {
  .result-grid {
    grid-template-columns: 1fr;
  }
}
</style>
