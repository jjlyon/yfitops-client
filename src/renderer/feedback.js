let toastRegion = null;
let bannerRegion = null;
let toastCounter = 0;
const activeToasts = new Map();
const activeBanners = new Map();

const getRegion = (region) => {
  if (!region) {
    throw new Error('Feedback region is not initialised.');
  }
  return region;
};

const removeToast = (id) => {
  const toast = activeToasts.get(id);
  if (!toast) {
    return;
  }
  if (toast.timeout) {
    clearTimeout(toast.timeout);
  }
  toast.element.remove();
  activeToasts.delete(id);
};

export const initFeedback = ({ toastRegion: toastRegionElement, bannerRegion: bannerRegionElement } = {}) => {
  toastRegion = toastRegionElement || null;
  bannerRegion = bannerRegionElement || null;
};

export const showToast = ({
  id,
  message,
  description,
  variant = 'info',
  duration = 6000,
  actionLabel,
  onAction,
  dismissLabel = 'Dismiss notification'
} = {}) => {
  const region = getRegion(toastRegion);

  if (id && activeToasts.has(id)) {
    removeToast(id);
  }

  const toastId = id || `toast-${Date.now()}-${toastCounter += 1}`;

  const toast = document.createElement('div');
  toast.className = `app-toast app-toast--${variant}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('tabindex', '-1');

  const textWrapper = document.createElement('div');
  textWrapper.className = 'app-toast__text';

  const messageEl = document.createElement('strong');
  messageEl.textContent = message || '';
  textWrapper.appendChild(messageEl);

  if (description) {
    const descriptionEl = document.createElement('p');
    descriptionEl.textContent = description;
    textWrapper.appendChild(descriptionEl);
  }

  toast.appendChild(textWrapper);

  if (actionLabel && typeof onAction === 'function') {
    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'app-toast__action';
    actionButton.textContent = actionLabel;
    actionButton.addEventListener('click', () => {
      onAction();
      removeToast(toastId);
    });
    toast.appendChild(actionButton);
  }

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'app-toast__dismiss';
  dismissButton.setAttribute('aria-label', dismissLabel);
  dismissButton.textContent = '×';
  dismissButton.addEventListener('click', () => removeToast(toastId));
  toast.appendChild(dismissButton);

  region.appendChild(toast);

  const toastInfo = { element: toast, timeout: null };
  if (duration > 0) {
    toastInfo.timeout = setTimeout(() => {
      removeToast(toastId);
    }, duration);
  }

  activeToasts.set(toastId, toastInfo);

  // Move focus only if the toast includes an action to ensure keyboard users can respond.
  if (actionLabel && typeof onAction === 'function') {
    const focusTarget = toast.querySelector('.app-toast__action');
    focusTarget?.focus();
  }

  return toastId;
};

export const dismissToast = (id) => {
  removeToast(id);
};

const clearExistingBanner = (id) => {
  if (!id) {
    return;
  }
  const existing = activeBanners.get(id);
  if (existing) {
    existing.element.remove();
    activeBanners.delete(id);
  }
};

export const showBanner = ({
  id,
  title,
  message,
  variant = 'info',
  actionLabel,
  onAction,
  dismissLabel = 'Dismiss',
  onDismiss
} = {}) => {
  const region = getRegion(bannerRegion);
  if (!id) {
    throw new Error('A banner id is required.');
  }

  clearExistingBanner(id);

  const banner = document.createElement('div');
  banner.className = `app-banner app-banner--${variant}`;
  banner.setAttribute('role', 'alert');
  banner.setAttribute('tabindex', '-1');

  const textWrapper = document.createElement('div');
  textWrapper.className = 'app-banner__text';

  if (title) {
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    textWrapper.appendChild(titleEl);
  }

  if (message) {
    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    textWrapper.appendChild(messageEl);
  }

  banner.appendChild(textWrapper);

  if (actionLabel && typeof onAction === 'function') {
    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'app-banner__action';
    actionButton.textContent = actionLabel;
    actionButton.addEventListener('click', () => {
      onAction();
    });
    banner.appendChild(actionButton);
  }

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'app-banner__dismiss';
  dismissButton.textContent = dismissLabel;
  dismissButton.addEventListener('click', () => {
    banner.remove();
    activeBanners.delete(id);
    if (typeof onDismiss === 'function') {
      onDismiss();
    }
  });
  banner.appendChild(dismissButton);

  region.appendChild(banner);
  banner.focus();

  activeBanners.set(id, { element: banner });

  return id;
};

export const dismissBanner = (id) => {
  if (!id) {
    return;
  }
  const banner = activeBanners.get(id);
  if (!banner) {
    return;
  }
  banner.element.remove();
  activeBanners.delete(id);
};
