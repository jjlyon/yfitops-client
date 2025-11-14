<template>
  <article :class="cardClasses">
    <button
      ref="mainButtonRef"
      type="button"
      class="result-main"
      :data-focus-index="index"
      @click="emit('view-release', { item, index })"
      @keydown.arrow-down.prevent="emit('focus-next', index + 1)"
      @keydown.arrow-up.prevent="emit('focus-prev', index - 1)"
      @keydown.escape.prevent="emit('escape')"
    >
      <div class="result-meta">
        <img :src="artwork" :alt="`${item.name} cover art`" />
        <div class="text-group">
          <strong>{{ item.name }}</strong>
          <span>{{ summary }}</span>
        </div>
      </div>
    </button>

    <template v-if="isTrack">
      <button
        type="button"
        class="menu-toggle"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        @click.stop="emit('toggle-menu')"
      >
        Queue
      </button>
      <div class="result-actions">
        <button
          v-for="action in trackActions"
          :key="action.mode"
          type="button"
          @click.stop="emit('queue-track', action.mode)"
          :disabled="isActionPending(action.mode)"
          :aria-busy="isActionPending(action.mode) ? 'true' : 'false'"
        >
          {{ action.label }}
        </button>
      </div>
    </template>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue';
import { summariseArtists } from '../utils.js';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    required: true
  },
  isTrack: {
    type: Boolean,
    default: false
  },
  menuOpen: {
    type: Boolean,
    default: false
  },
  pendingAction: {
    type: String,
    default: null
  },
  trackActions: {
    type: Array,
    default: () => []
  },
  actionKey: {
    type: Function,
    default: null
  }
});

const emit = defineEmits([
  'view-release',
  'focus-next',
  'focus-prev',
  'escape',
  'toggle-menu',
  'queue-track'
]);

const mainButtonRef = ref(null);

const cardClasses = computed(() => [
  'result-card',
  props.isTrack ? 'track-card' : 'album-card',
  { 'track-menu-open': props.isTrack && props.menuOpen }
]);

const artwork = computed(() => {
  const images = props.item.album?.images || props.item.images || [];
  return images[0]?.url || 'https://via.placeholder.com/200?text=Spotify';
});

const summary = computed(() => {
  if (Array.isArray(props.item.artists)) {
    return summariseArtists(props.item.artists);
  }
  return '';
});

const isActionPending = (mode) => {
  if (!props.actionKey || !props.pendingAction) {
    return false;
  }
  return props.pendingAction === props.actionKey(props.item, mode);
};

const focusMain = () => {
  mainButtonRef.value?.focus();
};

defineExpose({
  focusMain
});
</script>

<style scoped>
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

.result-meta {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.result-meta img {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
}

.text-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.text-group strong {
  font-size: 1rem;
}

.text-group span {
  font-size: 0.85rem;
  opacity: 0.75;
}

button.result-main {
  all: unset;
  cursor: pointer;
  display: flex;
  width: 100%;
}

button.result-main:focus-visible {
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
</style>
