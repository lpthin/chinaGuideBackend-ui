import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import Antd from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { ConfigProvider } from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import VForm3 from 'vform3-builds'
import 'vform3-builds/dist/designer.style.css'
import './styles/global.css'
import App from './App.vue'
import { router } from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.use(Antd)
app.use(VForm3)
app.mount('#app')
