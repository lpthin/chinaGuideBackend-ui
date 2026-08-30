// 应用入口 - 挂载到 #app
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@vueuse/head'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import { router } from './router'

// 一次性迁移：v2_ 前缀 localStorage key → 无前缀
const keyMigration: [string, string][] = [
  ['v2_access_token', 'access_token'],
  ['v2_refresh_token', 'refresh_token'],
  ['v2_user_info', 'user_info'],
  ['v2_selected_tenant_id', 'selected_tenant_id'],
  ['v2_selected_tenant_code', 'selected_tenant_code'],
]
keyMigration.forEach(([oldK, newK]) => {
  const val = localStorage.getItem(oldK)
  if (val && !localStorage.getItem(newK)) localStorage.setItem(newK, val)
  if (val) localStorage.removeItem(oldK)
})

const app = createApp(App)
const head = createHead()
app.use(createPinia())
app.use(router)
app.use(Antd)
app.use(head)
app.mount('#app')
