<script setup lang="ts">
/**
 * 读失败度量看板（SPEC-UI-9 H4-2）。
 *
 * 只在 `/workspace/dev/metrics` 可达（hidden，不进菜单、不进页面浏览分母）。
 * 数据来自 sessionStorage 的会话快照：刷新不丢，关标签即清。
 * 页面上放全局四个数与分页明细，现场排障时不必开控制台再手算。
 */
import { onMounted, ref } from 'vue'
import {
  getErrorMetrics,
  getErrorMetricsByPage,
  type ErrorMetricsSnapshot
} from '../../utils/errorMetrics'
import { listRawDetails, type RawDetailEntry } from '../../utils/errorRaw'

interface PageRow extends ErrorMetricsSnapshot {
  path: string
}

const globalMetrics = ref<ErrorMetricsSnapshot>(getErrorMetrics())
const pageRows = ref<PageRow[]>([])
const recentErrors = ref<RawDetailEntry[]>([])

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function refresh(): void {
  globalMetrics.value = getErrorMetrics()
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
      <h2 class="metrics-page__title">读失败度量（会话内）</h2>
      <a-button size="small" @click="refresh">刷新</a-button>
    </div>
    <p class="metrics-page__note">
      口径与 SPEC-UI-8 钉死的一致；hidden / 开发页不计入页面浏览分母。刷新页面仍保留，
      关闭标签页即清空。
    </p>

    <div class="metrics-page__cards">
      <div class="metrics-card">
        <div class="metrics-card__label">错误曝光率</div>
        <div class="metrics-card__value">{{ pct(globalMetrics.exposureRate) }}</div>
        <div class="metrics-card__hint">
          {{ globalMetrics.exposedPageViews }} / {{ globalMetrics.pageViews }} 次页面浏览
        </div>
      </div>
      <div class="metrics-card">
        <div class="metrics-card__label">重试成功率</div>
        <div class="metrics-card__value">{{ pct(globalMetrics.retrySuccessRate) }}</div>
        <div class="metrics-card__hint">
          {{ globalMetrics.retrySuccesses }} / {{ globalMetrics.retryAttempts }} 次重试
        </div>
      </div>
      <div class="metrics-card">
        <div class="metrics-card__label">误判空态率</div>
        <div class="metrics-card__value">{{ pct(globalMetrics.falseEmptyRate) }}</div>
        <div class="metrics-card__hint">
          {{ globalMetrics.falseEmptyShown }} 次 / {{ globalMetrics.exposures }} 次错误曝光
        </div>
      </div>
      <div class="metrics-card">
        <div class="metrics-card__label">平均恢复耗时</div>
        <div class="metrics-card__value">{{ globalMetrics.avgRecoveryMs }} ms</div>
        <div class="metrics-card__hint">
          {{ globalMetrics.recoveryCount }} 次恢复 · 错误 + 0 行 {{ globalMetrics.errorZeroRowCases }} 次
        </div>
      </div>
    </div>

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
}
</style>
