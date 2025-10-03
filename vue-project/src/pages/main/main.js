import { createApp } from 'vue'
import { createPinia } from 'pinia'
// import TabManager from '../../components/TabsManager.vue'
import Main from './main.vue'
import '@/assets/main.css'

const app = createApp(Main)
app.use(createPinia())
app.mount('#app')