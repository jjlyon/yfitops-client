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
    'is-busy': isBusy.value,
    'is-expanded': isHovering.value || isFocused.value
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
  right: 0;
  transform: translate(10px, -50%);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  isolation: isolate;
}

.queue-peek {
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(12, 12, 12, 0.92);
  color: #ffffff;
  border-radius: 0.35rem;
  padding: 0.35rem 0.45rem;
  cursor: pointer;
  display: block;
  width: 52px;
  height: 78px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.22s ease;
}

.queue-peek:focus-visible {
  outline: 2px solid rgba(30, 215, 96, 0.9);
  outline-offset: 2px;
}

.queue-control.is-expanded {
  transform: translate(50px, -50%);
}

.queue-control.is-expanded .queue-peek {
  background: linear-gradient(180deg, rgba(16, 16, 16, 0.98), rgba(20, 20, 20, 0.88));
  border-color: rgba(30, 215, 96, 0.32);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
}

.queue-peek:disabled {
  opacity: 0.65;
  cursor: progress;
}

.queue-skeleton {
  position: relative;
  width: 16px;
  height: 100%;
  min-height: 54px;
  display: grid;
  place-items: center;
}

.stack-bar {
  position: absolute;
  width: 16px;
  height: 5px;
  border-radius: 0.35rem;
  background: rgba(255, 255, 255, 0.8);
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.stack-bar.top {
  transform: translateY(-12px);
  opacity: 0.9;
}

.stack-bar.middle {
  transform: translateY(0);
  opacity: 0.75;
}

.stack-bar.bottom {
  transform: translateY(12px);
  opacity: 0.6;
}

.queue-control.mode-play_next .stack-bar.top {
  transform: translateY(-18px);
  opacity: 1;
}

.queue-control.mode-play_next .stack-bar.bottom {
  transform: translateY(16px);
  opacity: 0.45;
}

.queue-control.mode-append_queue .stack-bar.top {
  transform: translateY(-14px);
  opacity: 0.55;
}

.queue-control.mode-append_queue .stack-bar.bottom {
  transform: translateY(22px);
  opacity: 0.98;
}

.queue-control.is-expanded .queue-skeleton::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 0.7rem;
  background: linear-gradient(180deg, rgba(30, 215, 96, 0.32), rgba(30, 215, 96, 0.12));
  opacity: 0.75;
  filter: blur(8px);
  z-index: -1;
}

.queue-focus-actions {
  display: inline-flex;
  gap: 0.45rem;
  padding: 0.3rem 0.4rem;
  background: rgba(0, 0, 0, 0.9);
  border-radius: 0.95rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  position: absolute;
  right: calc(100% + 0.5rem);
  top: 50%;
  transform: translateY(-50%);
}

.queue-action {
  border: none;
  border-radius: 0.75rem;
  padding: 0.45rem 0.9rem;
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
