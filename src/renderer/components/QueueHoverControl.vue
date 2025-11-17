<template>
  <div
    ref="controlRef"
    class="queue-control"
    :class="controlClasses"
    @mouseenter="handleEnter"
    @mousemove="handleMove"
    @mouseleave="handleLeave"
    @focusin="handleFocusIn"
    @focusout="handleFocusOut"
  >
    <button
      ref="peekButtonRef"
      type="button"
      class="queue-peek"
      :aria-label="activeLabel"
      :aria-busy="isBusy ? 'true' : 'false'"
      :disabled="isBusy"
      @click.stop="handlePrimaryClick"
    >
      <span class="queue-peek-label">Queue</span>
      <div class="queue-skeleton" aria-hidden="true">
        <span class="stack-bar top"></span>
        <span class="stack-bar middle"></span>
        <span class="stack-bar bottom"></span>
      </div>
    </button>

    <div v-if="isFocused" class="queue-focus-actions">
      <button
        type="button"
        class="queue-action"
        :disabled="pendingNext"
        :aria-busy="pendingNext ? 'true' : 'false'"
        @click.stop="emitAction('play_next')"
      >
        Play Next
      </button>
      <button
        type="button"
        class="queue-action"
        :disabled="pendingAppend"
        :aria-busy="pendingAppend ? 'true' : 'false'"
        @click.stop="emitAction('append_queue')"
      >
        Add to Queue
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  pendingNext: {
    type: Boolean,
    default: false
  },
  pendingAppend: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['queue-next', 'queue-append']);

const controlRef = ref(null);
const peekButtonRef = ref(null);
const hoverMode = ref('append_queue');
const isHovering = ref(false);
const isFocused = ref(false);

const isBusy = computed(() => props.pendingNext || props.pendingAppend);

const activeLabel = computed(() =>
  hoverMode.value === 'play_next' ? 'Play this track next' : 'Add this track to the queue'
);

const controlClasses = computed(() => [
  `mode-${hoverMode.value}`,
  {
    'is-hovering': isHovering.value,
    'is-focused': isFocused.value,
    'is-busy': isBusy.value
  }
]);

const emitAction = (mode) => {
  if (mode === 'play_next') {
    emit('queue-next');
    return;
  }
  emit('queue-append');
};

const updateModeFromEvent = (event) => {
  const rect = controlRef.value?.getBoundingClientRect();
  if (!rect) {
    return;
  }
  const relativeY = event.clientY - rect.top;
  const ratio = Math.max(0, Math.min(1, relativeY / rect.height));
  hoverMode.value = ratio <= 0.4 ? 'play_next' : 'append_queue';
};

const handleEnter = (event) => {
  isHovering.value = true;
  updateModeFromEvent(event);
};

const handleMove = (event) => {
  updateModeFromEvent(event);
};

const handleLeave = () => {
  isHovering.value = false;
  hoverMode.value = 'append_queue';
};

const handlePrimaryClick = () => {
  emitAction(hoverMode.value);
};

const handleFocusIn = () => {
  isFocused.value = true;
};

const handleFocusOut = (event) => {
  const nextTarget = event.relatedTarget;
  if (!controlRef.value?.contains(nextTarget)) {
    isFocused.value = false;
  }
};
</script>

<style scoped>
.queue-control {
  position: absolute;
  top: 50%;
  right: -0.35rem;
  transform: translate(100%, -50%);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  isolation: isolate;
}

.queue-peek {
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  border-radius: 0.85rem;
  padding: 0.35rem 0.6rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.queue-peek:focus-visible {
  outline: 2px solid rgba(30, 215, 96, 0.9);
  outline-offset: 3px;
}

.queue-control.is-hovering .queue-peek,
.queue-control.is-focused .queue-peek {
  transform: translateX(4px);
  background: rgba(30, 215, 96, 0.25);
  border-color: rgba(30, 215, 96, 0.55);
}

.queue-peek:disabled {
  opacity: 0.65;
  cursor: progress;
}

.queue-peek-label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.queue-skeleton {
  position: relative;
  width: 16px;
  height: 18px;
  display: grid;
  place-items: center;
}

.stack-bar {
  position: absolute;
  width: 14px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.stack-bar.top {
  transform: translateY(-6px);
  opacity: 0.9;
}

.stack-bar.middle {
  transform: translateY(0);
  opacity: 0.75;
}

.stack-bar.bottom {
  transform: translateY(6px);
  opacity: 0.6;
}

.queue-control.mode-play_next .stack-bar.top {
  transform: translateY(-8px);
  opacity: 1;
}

.queue-control.mode-play_next .stack-bar.bottom {
  transform: translateY(10px);
  opacity: 0.55;
}

.queue-control.mode-append_queue .stack-bar.top {
  transform: translateY(-10px);
  opacity: 0.6;
}

.queue-control.mode-append_queue .stack-bar.bottom {
  transform: translateY(12px);
  opacity: 0.95;
}

.queue-control.is-hovering .queue-skeleton::after,
.queue-control.is-focused .queue-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 0.5rem;
  background: linear-gradient(180deg, rgba(30, 215, 96, 0.45), rgba(30, 215, 96, 0.15));
  opacity: 0.75;
  filter: blur(6px);
  z-index: -1;
}

.queue-focus-actions {
  display: inline-flex;
  gap: 0.4rem;
  padding: 0.25rem;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.queue-action {
  border: none;
  border-radius: 0.75rem;
  padding: 0.4rem 0.85rem;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}

.queue-action:hover,
.queue-action:focus-visible {
  background: rgba(30, 215, 96, 0.8);
  color: #000000;
  outline: none;
  transform: translateY(-1px);
}

.queue-action:disabled {
  opacity: 0.6;
  cursor: progress;
}
</style>
