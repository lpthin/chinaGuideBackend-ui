// v2 应用入口 - 挂载到 #app-v2
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@vueuse/head'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import { router } from './router'

const app = createApp(App)
const head = createHead()
app.use(createPinia())
app.use(router)
app.use(Antd)
app.use(head)
app.mount('#app-v2')
