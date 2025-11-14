import { createApp } from 'vue';
import App from './App.vue';
import './styles/base.css';

const app = createApp(App);

app.provide('spotify', window.spotify || null);
app.provide('appInfo', window.appInfo || null);

app.mount('#app');
