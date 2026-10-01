<script setup lang="ts">
/**
 * GEO 诊断工作台容器（Spec-H P3 / H-4）：把「品牌档案 / 诊断向导 / 诊断工作台」三颗收成一颗，
 * 页内三 tab。三个子视图原来各自独占一个路由、一个菜单项，但它们是同一主题
 * （GEO 品牌诊断的档案 / 向导 / 计划与轮次）的不同面，用户以前要在三个入口之间跳来跳去。
 *
 * 容器只负责：
 * 1. 读 `route.query.tab`，落到 `<a-tabs>` 的 activeKey；
 * 2. 三个 tab 各挂一个子视图（延迟加载，与老路由同一个 component）；
 * 3. 切 tab 时把 query 写回去（前进/后退能回到同一个 tab，收藏夹不断）。
 *
 * 老的三个地址（`geo/brand`、`geo/diagnosis`、`geo/campaign`）在路由表里改成
 * 无名 redirect，带 `?tab=…` 落到这一页对应 tab —— 收藏夹与文档链接不断。
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IdcardOutlined,
  AimOutlined,
  BarChartOutlined
} from '@ant-design/icons-vue'
import GeoBrandProfileView from '../geobrand/GeoBrandProfileView.vue'
import GeoBrandDiagnosisWizardView from '../geobrand/GeoBrandDiagnosisWizardView.vue'
import GeoCampaignWorkbenchView from './GeoCampaignWorkbenchView.vue'

const VALID_TABS = ['brand', 'wizard', 'campaign'] as const
type DiagnosticTab = typeof VALID_TABS[number]

const route = useRoute()
const router = useRouter()

const activeTab = computed<DiagnosticTab>(() => {
  const raw = route.query.tab
  if (typeof raw === 'string' && VALID_TABS.includes(raw as DiagnosticTab)) return raw as DiagnosticTab
  return 'campaign'
})

function onTabChange(key: string | number) {
  router.replace({ query: { ...route.query, tab: String(key) } })
}

const TABS = [
  { key: 'brand', label: '品牌档案', icon: IdcardOutlined, component: GeoBrandProfileView },
  { key: 'wizard', label: '诊断向导', icon: AimOutlined, component: GeoBrandDiagnosisWizardView },
  { key: 'campaign', label: '诊断工作台', icon: BarChartOutlined, component: GeoCampaignWorkbenchView }
]
</script>

<template>
  <div class="geo-diagnostic-workbench">
    <a-tabs :active-key="activeTab" @change="onTabChange" class="geo-diagnostic-workbench__tabs">
      <a-tab-pane v-for="tab in TABS" :key="tab.key">
        <template #tab>
          <span class="geo-diagnostic-workbench__tab-label">
            <component :is="tab.icon" class="geo-diagnostic-workbench__tab-icon" />
            {{ tab.label }}
          </span>
        </template>
        <component :is="tab.component" />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped lang="less">
.geo-diagnostic-workbench {
  padding: 0;

  &__tabs {
    :deep(.ant-tabs-nav) {
      margin-bottom: 16px;
    }
  }

  &__tab-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  &__tab-icon {
    font-size: 14px;
  }
}
</style>
