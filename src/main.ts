// 应用入口 - 挂载到 #app
import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@vueuse/head'
import Antd, { ConfigProvider } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import 'ant-design-vue/dist/reset.css'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './styles/admin-tokens.less'
import './styles/global.less'
import App from './App.vue'
import { router } from './router'
import { setupPortalTracking } from './portal/usePortalTrack'
import { ADMIN_THEME_TOKEN } from './styles/theme'

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

// 日期选择器的星期/月份跟随中文界面
dayjs.locale('zh-cn')

const head = createHead()
// P0 底座：后台第一次有主题出处（styles/theme.ts），控件外观统一由 a-config-provider 下发（Spec-F §9.2-1）
// 同一处再下发语言：验收现场量到 GEO 那 7 页里，表格空态念的是「No data」、分页念「20 / page」，
// 整屏中文界面夹着英文——组件自带的文案与主题同属「底座该管的事」，所以跟 theme 一起在这里发，
// 不在每个页面各抄一份 locale（那等于把同一件事交给 20 个视图各记一次）。
const app = createApp({
  name: 'Root',
  render: () =>
    h(ConfigProvider, { theme: { token: { ...ADMIN_THEME_TOKEN } }, locale: zhCN }, () => h(App)),
})
app.use(createPinia())
app.use(router)
// 门户访客埋点：注册在挂载之前，首屏那一次 afterEach 才不会漏
setupPortalTracking(router)
app.use(Antd)
app.use(head)
app.mount('#app')
