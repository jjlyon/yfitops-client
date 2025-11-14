import { inject, reactive } from 'vue';

const feedbackKey = Symbol('feedbackStore');

export const useFeedbackStore = () => {
  const store = inject(feedbackKey, null);
  if (!store) {
    throw new Error('Feedback store is not provided.');
  }
  return store;
};

export const provideFeedbackStore = (provide) => {
  const state = reactive({
    toasts: [],
    banners: []
  });

  let toastCounter = 0;
  const toastTimers = new Map();

  const removeToast = (id) => {
    if (!id) {
      return;
    }
    const index = state.toasts.findIndex((toast) => toast.id === id);
    if (index >= 0) {
      state.toasts.splice(index, 1);
    }
    const timer = toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.delete(id);
    }
  };

  const showToast = ({
    id,
    message,
    description,
    variant = 'info',
    duration = 6000,
    actionLabel,
    onAction,
    dismissLabel = 'Dismiss notification'
  } = {}) => {
    if (!message) {
      return null;
    }

    if (id) {
      removeToast(id);
    }

    const toastId = id || `toast-${Date.now()}-${(toastCounter += 1)}`;

    const toast = {
      id: toastId,
      message,
      description: description || null,
      variant,
      actionLabel: actionLabel || null,
      onAction: typeof onAction === 'function' ? onAction : null,
      dismissLabel,
      focusAction: Boolean(actionLabel && typeof onAction === 'function')
    };

    state.toasts.push(toast);

    if (duration > 0) {
      const timer = setTimeout(() => {
        removeToast(toastId);
      }, duration);
      toastTimers.set(toastId, timer);
    }

    return toastId;
  };

  const dismissToast = (id) => {
    removeToast(id);
  };

  const showBanner = ({
    id,
    title,
    message,
    variant = 'info',
    actionLabel,
    onAction,
    dismissLabel = 'Dismiss',
    onDismiss
  } = {}) => {
    if (!id) {
      throw new Error('Banner id is required.');
    }

    const existingIndex = state.banners.findIndex((banner) => banner.id === id);
    if (existingIndex >= 0) {
      state.banners.splice(existingIndex, 1);
    }

    const banner = {
      id,
      title: title || null,
      message: message || null,
      variant,
      actionLabel: actionLabel || null,
      onAction: typeof onAction === 'function' ? onAction : null,
      dismissLabel,
      onDismiss: typeof onDismiss === 'function' ? onDismiss : null
    };

    state.banners.push(banner);

    return id;
  };

  const dismissBanner = (id) => {
    if (!id) {
      return;
    }
    const index = state.banners.findIndex((banner) => banner.id === id);
    if (index >= 0) {
      const [banner] = state.banners.splice(index, 1);
      banner?.onDismiss?.();
    }
  };

  provide(feedbackKey, {
    state,
    showToast,
    dismissToast,
    showBanner,
    dismissBanner
  });

  return {
    state,
    showToast,
    dismissToast,
    showBanner,
    dismissBanner
  };
};
