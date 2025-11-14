<template>
  <section v-if="showAuthCard" class="auth-card" aria-live="polite">
    <p>{{ authMessage }}</p>
    <button
      v-if="showLoginButton"
      type="button"
      @click="login"
      :disabled="loggingIn"
    >
      {{ loggingIn ? 'Opening Spotify…' : 'Log in with Spotify' }}
    </button>
  </section>
  <template v-else>
    <slot />
  </template>
</template>

<script setup>
import { computed } from 'vue';
import { useAppStore } from '../stores/appStore.js';

const store = useAppStore();

const authStatus = computed(() => store.state.auth.status);
const authMessage = computed(() => store.state.auth.message);
const loggingIn = computed(() => store.state.auth.loggingIn);
const hasProfile = computed(() => Boolean(store.state.profile));

const showAuthCard = computed(() => authStatus.value !== 'ready' || !hasProfile.value);
const showLoginButton = computed(() =>
  authStatus.value === 'prompt' || authStatus.value === 'error'
);

const login = () => {
  store.actions.auth.login();
};
</script>

<style scoped>
.auth-card {
  text-align: center;
  padding: 2.5rem;
  border-radius: 1.5rem;
  background-color: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.auth-card button {
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  border: none;
  background: #1db954;
  color: #000;
  font-weight: 600;
  cursor: pointer;
}

.auth-card button[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
