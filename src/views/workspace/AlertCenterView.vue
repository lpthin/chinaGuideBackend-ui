<script setup lang="ts">
/**
 * 报警中心（Spec-H P3 / H-5）：把「报警规则 / 报警记录 / 通知渠道」三颗收成一颗，
 * 页内三 tab。三个子视图原来各自独占一个路由、一个菜单项，但它们是同一主题
 * （报警这件事的 CRUD / 列表 / 配置）的不同面，用户以前要在三个入口之间跳来跳去。
 *
 * 容器只负责：
 * 1. 读 `route.query.tab`，落到 `<a-tabs>` 的 activeKey；
 * 2. 三个 tab 各挂一个子视图（延迟加载，与老路由同一个 component）；
 * 3. 切 tab 时把 query 写回去（前进/后退能回到同一个 tab，收藏夹不断）。
 *
 * 老的三个地址（`alert/rules`、`alert/records`、`alert/channels`）在路由表里改成
 * 无名 redirect，带 `?tab=…` 落到这一页对应 tab —— 收藏夹与文档链接不断。
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlertOutlined,
  HistoryOutlined,
  SettingOutlined
} from '@ant-design/icons-vue'
import AlertRuleManageView from './AlertRuleManageView.vue'
import AlertRecordView from './AlertRecordView.vue'
import AlertChannelView from './AlertChannelView.vue'

const VALID_TABS = ['rules', 'records', 'channels'] as const
type AlertTab = typeof VALID_TABS[number]

const route = useRoute()
const router = useRouter()

const activeTab = computed<AlertTab>(() => {
  const raw = route.query.tab
  if (typeof raw === 'string' && VALID_TABS.includes(raw as AlertTab)) return raw as AlertTab
  return 'rules'
})

function onTabChange(key: string | number) {
  router.replace({ query: { ...route.query, tab: String(key) } })
}

const TABS = [
  { key: 'rules', label: '规则', icon: AlertOutlined, component: AlertRuleManageView },
  { key: 'records', label: '记录', icon: HistoryOutlined, component: AlertRecordView },
  { key: 'channels', label: '渠道', icon: SettingOutlined, component: AlertChannelView }
]
</script>

<template>
  <div class="alert-center">
    <a-tabs :active-key="activeTab" @change="onTabChange" class="alert-center__tabs">
      <a-tab-pane v-for="tab in TABS" :key="tab.key">
        <template #tab>
          <span class="alert-center__tab-label">
            <component :is="tab.icon" class="alert-center__tab-icon" />
            {{ tab.label }}
          </span>
        </template>
        <component :is="tab.component" />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped lang="less">
.alert-center {
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
