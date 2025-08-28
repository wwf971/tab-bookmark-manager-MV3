import { createApp } from 'vue'
import { createPinia } from 'pinia'
import UploadTab from '../../popup/UploadTab.vue'
import '../../assets/base.css'
import '../../assets/popup.css'

const app = createApp(UploadTab)
app.use(createPinia())
app.mount('#app')