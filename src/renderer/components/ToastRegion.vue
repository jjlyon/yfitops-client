<template>
  <div class="feedback-layer" aria-live="polite" aria-atomic="false">
    <div
      class="app-banner-region"
      role="region"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div
        v-for="banner in state.banners"
        :key="banner.id"
        :class="['app-banner', banner.variant ? `app-banner--${banner.variant}` : '']"
        tabindex="-1"
      >
        <div class="app-banner__text">
          <strong v-if="banner.title">{{ banner.title }}</strong>
          <p v-if="banner.message">{{ banner.message }}</p>
        </div>
        <button
          v-if="banner.actionLabel && banner.onAction"
          type="button"
          class="app-banner__action"
          @click="banner.onAction()"
        >
          {{ banner.actionLabel }}
        </button>
        <button
          type="button"
          class="app-banner__dismiss"
          @click="dismissBanner(banner.id)"
        >
          {{ banner.dismissLabel || 'Dismiss' }}
        </button>
      </div>
    </div>

    <div class="app-toast-region" aria-live="polite" aria-atomic="false">
      <div
        v-for="toast in state.toasts"
        :key="toast.id"
        :class="['app-toast', toast.variant ? `app-toast--${toast.variant}` : '']"
        role="status"
        tabindex="-1"
      >
        <div class="app-toast__text">
          <strong>{{ toast.message }}</strong>
          <p v-if="toast.description">{{ toast.description }}</p>
        </div>
        <button
          v-if="toast.actionLabel && toast.onAction"
          type="button"
          class="app-toast__action"
          @click="handleToastAction(toast)"
          :ref="(el) => setActionRef(toast.id, el)"
        >
          {{ toast.actionLabel }}
        </button>
        <button
          type="button"
          class="app-toast__dismiss"
          :aria-label="toast.dismissLabel || 'Dismiss notification'"
          @click="dismissToast(toast.id)"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
import { useFeedbackStore } from '../stores/feedbackStore.js';

const { state, dismissToast, dismissBanner } = useFeedbackStore();
const actionRefs = new Map();

const setActionRef = (id, el) => {
  if (!id) {
    return;
  }
  if (el) {
    actionRefs.set(id, el);
  } else {
    actionRefs.delete(id);
  }
};

const handleToastAction = (toast) => {
  toast.onAction?.();
  dismissToast(toast.id);
};

const focusLatestToastAction = () => {
  const latest = state.toasts[state.toasts.length - 1];
  if (!latest || !latest.focusAction) {
    return;
  }
  nextTick(() => {
    const target = actionRefs.get(latest.id);
    target?.focus();
  });
};

watch(
  () => state.toasts.map((toast) => toast.id),
  () => {
    focusLatestToastAction();
  }
);

onMounted(() => {
  focusLatestToastAction();
});

onBeforeUnmount(() => {
  actionRefs.clear();
});
</script>

<style scoped>
.feedback-layer {
  position: fixed;
  inset: 1.5rem;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-end;
  z-index: 100;
}

.app-banner-region {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: none;
}

.app-banner-region:empty {
  display: none;
}

.app-toast-region {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: min(320px, 100%);
  pointer-events: none;
}

.app-toast-region:empty {
  display: none;
}

.app-banner {
  pointer-events: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  color: #ffffff;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

.app-banner--warning {
  background: rgba(255, 200, 0, 0.18);
  border-color: rgba(255, 214, 102, 0.6);
  color: #fff2d6;
}

.app-banner__text {
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.app-banner__text p {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.85;
}

.app-banner__action,
.app-banner__dismiss {
  pointer-events: auto;
  border: none;
  border-radius: 999px;
  padding: 0.55rem 1.1rem;
  font-weight: 600;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.app-banner__action {
  background: rgba(30, 215, 96, 0.85);
  color: #000000;
}

.app-banner__dismiss {
  background: rgba(255, 255, 255, 0.12);
}

.app-banner__action:focus-visible,
.app-banner__dismiss:focus-visible,
.app-banner__action:hover,
.app-banner__dismiss:hover {
  outline: 2px solid rgba(30, 215, 96, 0.9);
  outline-offset: 2px;
}

.app-toast {
  pointer-events: auto;
  background: rgba(34, 34, 34, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  padding: 0.9rem 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45);
  color: #ffffff;
}

.app-toast--success {
  border-color: rgba(30, 215, 96, 0.7);
}

.app-toast--error {
  border-color: rgba(255, 105, 105, 0.75);
  background: rgba(255, 69, 58, 0.24);
}

.app-toast__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.app-toast__text p {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.85;
}

.app-toast__action,
.app-toast__dismiss {
  pointer-events: auto;
  border: none;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.app-toast__action {
  background: rgba(30, 215, 96, 0.85);
  color: #000000;
}

.app-toast__dismiss {
  align-self: flex-start;
  line-height: 1;
  font-size: 1rem;
  padding: 0.45rem 0.7rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
}

.app-toast__action:focus-visible,
.app-toast__dismiss:focus-visible,
.app-toast__action:hover,
.app-toast__dismiss:hover {
  outline: 2px solid rgba(30, 215, 96, 0.9);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .feedback-layer {
    inset: 1rem;
    align-items: stretch;
  }

  .app-toast-region {
    max-width: 100%;
    align-self: stretch;
  }

  .app-toast {
    flex-direction: column;
    align-items: stretch;
  }

  .app-banner {
    flex-direction: column;
    align-items: stretch;
  }

  .app-banner__action,
  .app-banner__dismiss,
  .app-toast__action,
  .app-toast__dismiss {
    width: 100%;
    text-align: center;
  }
}
</style>
