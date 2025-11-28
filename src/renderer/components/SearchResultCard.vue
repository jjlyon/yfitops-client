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
      <QueueHoverControl
        :pending-next="pendingNext"
        :pending-append="pendingAppend"
        @queue-next="emit('queue-next')"
        @queue-append="emit('queue-append')"
      />
    </template>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue';
import QueueHoverControl from './QueueHoverControl.vue';
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
  pendingAction: {
    type: String,
    default: null
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
  'queue-next',
  'queue-append'
]);

const mainButtonRef = ref(null);

const cardClasses = computed(() => [
  'result-card',
  props.isTrack ? 'track-card' : 'album-card'
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

const pendingNext = computed(() => isActionPending('play_next'));
const pendingAppend = computed(() => isActionPending('append_queue'));

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

.track-card {
  position: relative;
}
</style>
