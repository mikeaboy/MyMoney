import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import axios from 'axios';

// 設定 Axios 預設值
window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');

