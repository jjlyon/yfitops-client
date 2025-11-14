<template>
  <div class="app-shell" role="application">
    <header class="topbar">
      <div class="brand">
        <h1>{{ appTitle }}</h1>
        <span>{{ brandSubtitle }}</span>
      </div>
      <div class="search-wrapper" :data-enabled="searchEnabled ? 'true' : 'false'">
        <label class="sr-only" for="globalSearchInput">Search Spotify</label>
        <div class="search-input-container">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 0 0 1.57-4.23C15.99 6.02 13 3 9.5 3S3 6.02 3 9.5 6.02 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
            />
          </svg>
          <input
            id="globalSearchInput"
            ref="searchInput"
            class="search-input"
            type="search"
            :value="searchQuery"
            :disabled="!searchEnabled"
            :aria-busy="searchLoading ? 'true' : 'false'"
            autocomplete="off"
            spellcheck="false"
            :placeholder="searchPlaceholder"
            @input="onInput"
            @keydown="handleKeydown"
          />
          <span
            v-if="searchLoading"
            class="spinner"
            role="status"
            aria-live="polite"
          ></span>
        </div>
        <div class="search-tooltip">{{ searchTooltip }}</div>
      </div>
    </header>
    <main class="app-content">
      <AuthGate>
        <section
          class="search-state-panel"
          :class="{ 'search-state-panel--release-active': releaseActive }"
          aria-live="polite"
        >
          <SearchView ref="searchView" @focus-search="focusSearchInput" />
          <ReleasePanel />
        </section>
      </AuthGate>
    </main>
    <ToastRegion />
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, provide, ref, watchEffect } from 'vue';
import AuthGate from './components/AuthGate.vue';
import SearchView from './components/SearchView.vue';
import ReleasePanel from './components/ReleasePanel.vue';
import ToastRegion from './components/ToastRegion.vue';
import { provideAppStore } from './stores/appStore.js';

const spotify = inject('spotify', null);
const appInfo = inject('appInfo', null) || {};
const store = provideAppStore(provide, { spotify });

const searchInput = ref(null);
const searchView = ref(null);

const appTitle = computed(() => appInfo?.name || 'YFitOps Player');
const brandSubtitle = computed(() => appInfo?.description || 'Stay queued on what matters.');

watchEffect(() => {
  document.title = appTitle.value;
});

const searchEnabled = computed(() => store.state.search.enabled);
const searchLoading = computed(() => store.state.search.loading);
const releaseActive = computed(() => store.state.release.active);

const searchPlaceholder = 'Search songs or releases…';

const searchQuery = computed(() => store.state.search.query);

const searchTooltip = computed(() => {
  if (!searchEnabled.value) {
    return store.state.auth.message || 'Log in to start searching.';
  }
  if (store.state.search.status === 'error' && store.state.search.error) {
    return `Couldn't reach Spotify. ${store.state.search.error}`.trim();
  }
  return 'Press Enter to search · Esc clears · ↑/↓ to browse results';
});

const focusSearchInput = () => {
  nextTick(() => {
    searchInput.value?.focus();
  });
};

const onInput = (event) => {
  store.actions.search.scheduleSearch(event.target.value);
};

const performImmediateSearch = () => {
  store.actions.search.performSearch(store.state.search.query || '');
};

const clearSearch = () => {
  store.actions.search.reset();
  focusSearchInput();
};

const handleKeydown = (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    performImmediateSearch();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    clearSearch();
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    searchView.value?.focusFirstResult();
  }
};

onMounted(() => {
  store.actions.auth.checkStatus();
  focusSearchInput();
});
</script>

<style scoped>
.app-shell {
  width: min(100%, 1080px);
  background:
    linear-gradient(135deg, rgba(18, 18, 18, 0.92), rgba(18, 18, 18, 0.75));
  border-radius: 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(14px);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.45);
  position: relative;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.25rem 1.75rem;
  background: rgba(0, 0, 0, 0.35);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.brand h1 {
  font-size: 1.5rem;
  margin: 0;
}

.brand span {
  font-size: 0.875rem;
  opacity: 0.75;
}

.search-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.search-input-container {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: border 0.2s ease, background 0.2s ease;
}

.search-wrapper[data-enabled='true'] .search-input-container:focus-within {
  border: 1px solid rgba(30, 215, 96, 0.65);
  background: rgba(12, 12, 12, 0.85);
}

.search-icon {
  width: 20px;
  height: 20px;
  margin-right: 0.5rem;
  opacity: 0.65;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: #ffffff;
  font-size: 1rem;
  outline: none;
  min-width: 0;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

.search-input:disabled {
  opacity: 0.5;
}

.search-tooltip {
  font-size: 0.75rem;
  opacity: 0.6;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.app-content {
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.search-state-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.75rem;
  border-radius: 1.5rem;
  background: linear-gradient(
      160deg,
      rgba(18, 18, 18, 0.85) 0%,
      rgba(18, 18, 18, 0.65) 55%
    ),
    radial-gradient(circle at top right, rgba(30, 215, 96, 0.12), transparent 55%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  isolation: isolate;
  min-height: 420px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.search-state-panel--release-active {
  border-color: rgba(30, 215, 96, 0.35);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.55);
}

@media (max-width: 900px) {
  .topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .brand {
    align-items: center;
  }

  .search-tooltip {
    text-align: center;
  }
}

@media (max-width: 640px) {
  .app-shell {
    border-radius: 16px;
  }
}
</style>
