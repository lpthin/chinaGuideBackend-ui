<script setup lang="ts">
/**
 * 读失败度量看板（SPEC-UI-9 H4-2）。
 *
 * 只在 `/workspace/dev/metrics` 可达（hidden、仅平台账号，不进菜单、不进页面浏览分母）。
 * 数据来自 localStorage 的度量快照：刷新与换标签都不丢，保留 7 天（SPEC-UI-10 G-5）。
 * 页面上放全局四个数、错误类型分布与分页明细，现场排障时不必开控制台再手算。
 */
import { onMounted, ref } from 'vue'
import {
  getErrorKindBreakdown,
  getErrorMetrics,
  getErrorMetricsByPage,
  type ErrorKindRow,
  type ErrorMetricsSnapshot
} from '../../utils/errorMetrics'
import { listRawDetails, type RawDetailEntry } from '../../utils/errorRaw'

interface PageRow extends ErrorMetricsSnapshot {
  path: string
}

/** 超线阈值（SPEC-UI-10 G-4）：过线标红，不靠人记数 */
const THRESHOLD = {
  /** 曝光率超过一成算异常 */
  exposureRate: 0.1,
  /** 重试成功率低于六成说明重试没带来恢复 */
  retrySuccessRate: 0.6,
  /** 平均恢复超过 15 秒说明用户等太久了 */
  avgRecoveryMs: 15000,
  /** 样本太小时不判红，避免 1 次浏览 1 次错误就满屏红 */
  minPageViews: 5
}

const globalMetrics = ref<ErrorMetricsSnapshot>(getErrorMetrics())
const kindRows = ref<ErrorKindRow[]>([])
const pageRows = ref<PageRow[]>([])
const recentErrors = ref<RawDetailEntry[]>([])

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/** 曝光率过线且样本够 */
function exposureBad(): boolean {
  const m = globalMetrics.value
  return m.pageViews >= THRESHOLD.minPageViews && m.exposureRate > THRESHOLD.exposureRate
}

/** 误判空态应该恒为 0，出现一次就不对 */
function falseEmptyBad(): boolean {
  return globalMetrics.value.falseEmptyShown > 0
}

function retryBad(): boolean {
  const m = globalMetrics.value
  return m.retryAttempts >= THRESHOLD.minPageViews && m.retrySuccessRate < THRESHOLD.retrySuccessRate
}

function recoveryBad(): boolean {
  return globalMetrics.value.avgRecoveryMs > THRESHOLD.avgRecoveryMs
}

function refresh(): void {
  globalMetrics.value = getErrorMetrics()
  kindRows.value = getErrorKindBreakdown()
  pageRows.value = Object.entries(getErrorMetricsByPage())
    .map(([path, snapshot]) => ({ path, ...snapshot }))
    .sort((a, b) => b.exposures - a.exposures)
  recentErrors.value = listRawDetails().slice(0, 20)
}

onMounted(refresh)
</script>

<template>
  <div class="metrics-page">
    <div class="metrics-page__head">
      <h2 class="metrics-page__title">读失败度量</h2>
      <a-button size="small" @click="refresh">刷新</a-button>
    </div>
    <p class="metrics-page__note">
      口径与 SPEC-UI-8 钉死的一致；hidden / 开发页不计入页面浏览分母。数据保留最近 7 天，
      跨标签共享，清除站点数据即清空。卡片标红表示过线，阈值写在页面脚本里。
    </p>

    <div class="metrics-page__cards">
      <div class="metrics-card" :class="{ 'metrics-card--alert': exposureBad() }">
        <div class="metrics-card__label">错误曝光率</div>
        <div class="metrics-card__value">{{ pct(globalMetrics.exposureRate) }}</div>
        <div class="metrics-card__hint">
          {{ globalMetrics.exposedPageViews }} / {{ globalMetrics.pageViews }} 次页面浏览
          <span v-if="exposureBad()">· 超过 {{ pct(THRESHOLD.exposureRate) }}</span>
        </div>
      </div>
      <div class="metrics-card" :class="{ 'metrics-card--alert': retryBad() }">
        <div class="metrics-card__label">重试成功率</div>
        <div class="metrics-card__value">{{ pct(globalMetrics.retrySuccessRate) }}</div>
        <div class="metrics-card__hint">
          {{ globalMetrics.retrySuccesses }} / {{ globalMetrics.retryAttempts }} 次重试
          <span v-if="retryBad()">· 低于 {{ pct(THRESHOLD.retrySuccessRate) }}</span>
        </div>
      </div>
      <div class="metrics-card" :class="{ 'metrics-card--alert': falseEmptyBad() }">
        <div class="metrics-card__label">误判空态率</div>
        <div class="metrics-card__value">{{ pct(globalMetrics.falseEmptyRate) }}</div>
        <div class="metrics-card__hint">
          {{ globalMetrics.falseEmptyShown }} 次 / {{ globalMetrics.exposures }} 次错误曝光
          <span v-if="falseEmptyBad()">· 这个数应该恒为 0</span>
        </div>
      </div>
      <div class="metrics-card" :class="{ 'metrics-card--alert': recoveryBad() }">
        <div class="metrics-card__label">平均恢复耗时</div>
        <div class="metrics-card__value">{{ globalMetrics.avgRecoveryMs }} ms</div>
        <div class="metrics-card__hint">
          {{ globalMetrics.recoveryCount }} 次恢复 · 错误 + 0 行 {{ globalMetrics.errorZeroRowCases }} 次
          <span v-if="recoveryBad()">· 超过 {{ THRESHOLD.avgRecoveryMs }} ms</span>
        </div>
      </div>
    </div>

    <h3 class="metrics-page__subtitle">错误类型分布（{{ kindRows.length }} 类）</h3>
    <p v-if="!kindRows.length" class="metrics-page__empty">还没有记录到错误。</p>
    <ul v-else class="metrics-page__kinds">
      <li v-for="row in kindRows" :key="row.kind" class="metrics-page__kind">
        <span class="metrics-page__kind-label">{{ row.label }}</span>
        <span class="metrics-page__kind-bar">
          <span class="metrics-page__kind-fill" :style="{ width: pct(row.ratio) }" />
        </span>
        <span class="metrics-page__kind-count">{{ row.count }} 次 · {{ pct(row.ratio) }}</span>
      </li>
    </ul>

    <h3 class="metrics-page__subtitle">按页面明细（{{ pageRows.length }} 页）</h3>
    <a-table
      :data-source="pageRows"
      :pagination="false"
      row-key="path"
      size="small"
      class="metrics-page__table"
    >
      <a-table-column title="页面" data-index="path" key="path" :ellipsis="true" />
      <a-table-column title="浏览" data-index="pageViews" key="pageViews" :width="70" />
      <a-table-column title="曝光页" data-index="exposedPageViews" key="exposedPageViews" :width="80" />
      <a-table-column title="错误次数" data-index="exposures" key="exposures" :width="80" />
      <a-table-column title="错误+0行" data-index="errorZeroRowCases" key="errorZeroRowCases" :width="90" />
      <a-table-column title="重试" data-index="retryAttempts" key="retryAttempts" :width="70" />
      <a-table-column title="重试成功" data-index="retrySuccesses" key="retrySuccesses" :width="80" />
      <a-table-column title="平均恢复" key="avgRecoveryMs" :width="90">
        <template #default="{ record }">{{ record.avgRecoveryMs }} ms</template>
      </a-table-column>
    </a-table>

    <h3 class="metrics-page__subtitle">最近错误（{{ recentErrors.length }} 条）</h3>
    <p v-if="!recentErrors.length" class="metrics-page__empty">这个会话还没有记录到错误。</p>
    <ul v-else class="metrics-page__errors">
      <li v-for="item in recentErrors" :key="item.humanText + item.at" class="metrics-page__error">
        <div class="metrics-page__error-head">
          <span class="metrics-page__error-text">{{ item.humanText }}</span>
          <span class="metrics-page__error-meta">{{ item.at }} · {{ item.page || '未知页面' }}</span>
        </div>
        <pre class="metrics-page__raw">{{ item.rawText }}</pre>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="less">
.metrics-page {
  padding: var(--admin-space-3, 24px);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    margin: 0;
    font-size: 18px;
    color: var(--admin-text-primary, rgba(0, 0, 0, 0.88));
  }

  &__note {
    margin: var(--admin-space-1, 8px) 0 var(--admin-space-3, 24px);
    font-size: 12px;
    color: var(--admin-text-tertiary, rgba(0, 0, 0, 0.45));
  }

  &__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--admin-space-2, 16px);
  }

  &__subtitle {
    margin: var(--admin-space-4, 32px) 0 var(--admin-space-2, 16px);
    font-size: 14px;
    color: var(--admin-text-primary, rgba(0, 0, 0, 0.88));
  }

  &__kinds {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__kind {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 6px 0;
    font-size: 13px;
  }

  &__kind-label {
    width: 72px;
    flex: none;
    color: var(--admin-text-primary, rgba(0, 0, 0, 0.88));
  }

  &__kind-bar {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: var(--admin-fill-secondary, #f5f5f5);
    overflow: hidden;
  }

  &__kind-fill {
    display: block;
    height: 100%;
    background: var(--admin-color-primary, #1677ff);
  }

  &__kind-count {
    width: 140px;
    flex: none;
    text-align: right;
    color: var(--admin-text-secondary, rgba(0, 0, 0, 0.65));
  }

  &__table {
    background: var(--admin-bg-container, #fff);
  }

  &__empty {
    font-size: 13px;
    color: var(--admin-text-tertiary, rgba(0, 0, 0, 0.45));
  }

  &__errors {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__error {
    padding: var(--admin-space-2, 16px) 0;
    border-bottom: 1px solid var(--admin-border-secondary, #f0f0f0);
  }

  &__error-head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: baseline;
  }

  &__error-text {
    font-size: 13px;
    color: var(--admin-text-primary, rgba(0, 0, 0, 0.88));
  }

  &__error-meta {
    font-size: 12px;
    color: var(--admin-text-tertiary, rgba(0, 0, 0, 0.45));
  }

  &__raw {
    margin: 8px 0 0;
    padding: 8px;
    max-height: 120px;
    overflow: auto;
    background: var(--admin-fill-secondary, #f5f5f5);
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.metrics-card {
  padding: var(--admin-space-2, 16px);
  border: 1px solid var(--admin-border-secondary, #f0f0f0);
  border-radius: var(--admin-radius-lg, 8px);
  background: var(--admin-bg-container, #fff);

  &__label {
    font-size: 12px;
    color: var(--admin-text-tertiary, rgba(0, 0, 0, 0.45));
  }

  &__value {
    margin-top: 4px;
    font-size: 24px;
    font-weight: 600;
    color: var(--admin-text-primary, rgba(0, 0, 0, 0.88));
  }

  &__hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--admin-text-secondary, rgba(0, 0, 0, 0.65));
  }

  /** 过线：只把数字与描边标红，不整块变红，避免看板变成一片红 */
  &--alert {
    border-color: var(--admin-color-error, #ff4d4f);

    .metrics-card__value,
    .metrics-card__hint {
      color: var(--admin-color-error, #ff4d4f);
    }
  }
}
</style>
