import { state } from './state.js';

let loginButton = null;
let status = null;
let searchInput = null;
let searchTooltip = null;
let searchWrapper = null;
let searchView = null;
let authView = null;
let resetSearchState = () => {};
let closeReleaseView = () => {};

export const initAuth = ({
  loginButton: loginButtonElement,
  status: statusElement,
  searchInput: searchInputElement,
  searchTooltip: searchTooltipElement,
  searchWrapper: searchWrapperElement,
  searchView: searchViewElement,
  authView: authViewElement,
  resetSearchState: resetSearchStateFn,
  closeReleaseView: closeReleaseViewFn
} = {}) => {
  loginButton = loginButtonElement;
  status = statusElement;
  searchInput = searchInputElement;
  searchTooltip = searchTooltipElement;
  searchWrapper = searchWrapperElement;
  searchView = searchViewElement;
  authView = authViewElement;
  resetSearchState = resetSearchStateFn || (() => {});
  closeReleaseView = closeReleaseViewFn || (() => {});
};

export const updateForProfile = (profile) => {
  if (!profile) {
    return;
  }

  state.profile = profile;
  if (loginButton) {
    loginButton.hidden = true;
    loginButton.disabled = false;
  }
  if (status) {
    status.textContent = '';
  }
  if (searchInput) {
    searchInput.disabled = false;
  }
  if (searchTooltip) {
    searchTooltip.textContent = 'Press Enter to search · Esc clears · ↑/↓ to browse results';
  }
  if (searchWrapper) {
    searchWrapper.dataset.enabled = 'true';
  }
  if (searchView) {
    searchView.hidden = false;
  }
  if (authView) {
    authView.hidden = true;
  }

  resetSearchState({ announce: true });
};

export const showLoginPrompt = (message) => {
  if (loginButton) {
    loginButton.hidden = false;
    loginButton.disabled = false;
  }
  if (status) {
    status.textContent = message;
  }
  if (searchTooltip) {
    searchTooltip.textContent = 'Log in to start searching.';
  }
  if (searchInput) {
    searchInput.disabled = true;
  }
  if (searchView) {
    searchView.hidden = true;
  }
  if (authView) {
    authView.hidden = false;
  }
  closeReleaseView();
};

export const showError = (message) => {
  if (loginButton) {
    loginButton.hidden = false;
    loginButton.disabled = false;
  }
  if (status) {
    status.textContent = message;
  }
  if (searchTooltip) {
    searchTooltip.textContent = message;
  }
  if (searchInput) {
    searchInput.disabled = true;
  }
  if (searchView) {
    searchView.hidden = true;
  }
  if (authView) {
    authView.hidden = false;
  }
  closeReleaseView();
};
