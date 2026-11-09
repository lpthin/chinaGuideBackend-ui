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
import { logError } from './utils/errorLog'
import { notifyChunkLoadFailure, setupChunkLoadGuard } from './utils/chunkLoad'
import { getErrorMetrics, getErrorMetricsByPage } from './utils/errorMetrics'

declare global {
  interface Window {
    /** 现场取值（SPEC-UI-9 H4-2）：控制台可直接读四个数与分页明细，不必开看板 */
    __uiErrorMetrics?: {
      getErrorMetrics: typeof getErrorMetrics
      getErrorMetricsByPage: typeof getErrorMetricsByPage
    }
  }
}

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
// 渲染异常的最后一道留痕（SPEC-UI-9 H1-1）：被 RouteErrorBoundary 接住的不会再走到这里，
// 走到这里说明兜底本身也失败了——控制台之外至少还有一条带页面代号的记录。
app.config.errorHandler = (error, _instance, info) => {
  logError('app/render-error', info, error)
}

// 分包加载失败（SPEC-UI-9 H1-2）：`vite:preloadError` 与 `router.onError` 两个口都接，
// 任一命中即给一次全屏提示；判定收口在 isChunkLoadFailure。
setupChunkLoadGuard()
router.onError((error) => {
  notifyChunkLoadFailure(error)
})

// 现场排障（SPEC-UI-9 H4-2）：浏览器控制台 `__uiErrorMetrics.getErrorMetrics()` 即可取数
window.__uiErrorMetrics = { getErrorMetrics, getErrorMetricsByPage }

app.use(createPinia())
app.use(router)
// 门户访客埋点：注册在挂载之前，首屏那一次 afterEach 才不会漏
setupPortalTracking(router)
app.use(Antd)
app.use(head)
app.mount('#app')
