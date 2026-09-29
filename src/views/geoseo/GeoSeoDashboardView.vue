<template>
  <page-shell title="GEO总览仪表盘" subtitle="生成引擎优化全局视图">
    <a-spin :spinning="loading">
      <div class="dashboard-content">
        <!-- 1. 分数那一格：Q2-A 定稿删总分，这里只留「为什么空着」 -->
        <a-card title="GEO总分" class="section-card">
          <state-block
            state="not-measured"
            :title="GEO_SCORE_TITLE"
            :detail="GEO_SCORE_DETAIL"
            :next="GEO_SCORE_NEXT"
          />
          <div class="geo-hard-rule">{{ METRIC_HARD_RULES.noCombinedScore }}</div>
        </a-card>

        <!-- 2. 索引状态统计：这一屏剩下的四个数都是库里的真实行数，不是算出来的 -->
        <a-card title="索引状态统计" class="section-card">
          <a-row :gutter="16">
            <a-col :xs="12" :sm="6">
              <a-statistic
                title="文章总数"
                :value="dashboardData?.articleCount ?? 0"
                :value-style="{ color: '#1890ff' }"
              >
                <template #prefix><FileTextOutlined /></template>
              </a-statistic>
            </a-col>
            <a-col :xs="12" :sm="6">
              <a-statistic
                title="已发布文章"
                :value="dashboardData?.publishedCount ?? 0"
                :value-style="{ color: '#52c41a' }"
              >
                <template #prefix><CheckCircleOutlined /></template>
              </a-statistic>
            </a-col>
            <a-col :xs="12" :sm="6">
              <a-statistic
                title="竞品数量"
                :value="dashboardData?.competitorCount ?? 0"
                :value-style="{ color: '#fa8c16' }"
              >
                <template #prefix><TeamOutlined /></template>
              </a-statistic>
            </a-col>
            <a-col :xs="12" :sm="6">
              <a-statistic
                title="追踪关键词"
                :value="dashboardData?.keywordCount ?? 0"
                :value-style="{ color: '#722ed1' }"
              >
                <template #prefix><KeyOutlined /></template>
              </a-statistic>
            </a-col>
          </a-row>
        </a-card>

        <!-- 3. 待优化建议列表 -->
        <a-card title="待优化建议" class="section-card">
          <data-table
            :data-source="sortedSuggestions"
            :columns="suggestionColumns"
            :loading="loading"
            :error="loadError"
            row-key="message"
            size="middle"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'severity'">
                <a-tag :color="getSeverityColor(record.severity)">
                  {{ getSeverityLabel(record.severity) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'message'">
                <div class="suggestion-message">{{ record.message }}</div>
                <div class="suggestion-index">建议 #{{ index + 1 }}</div>
              </template>
            </template>
          </data-table>
        </a-card>
      </div>
    </a-spin>
  </page-shell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  KeyOutlined,
} from '@ant-design/icons-vue'
import PageShell from '../../components/PageShell.vue'
import StateBlock from '../../components/StateBlock.vue'
import DataTable from '../../components/DataTable.vue'
import { METRIC_HARD_RULES } from '../../copy/metrics'
import { logError } from '../../utils/errorLog'
import { geoDashboardApi } from '../../api/geoseo'
import type { GeoDashboard } from '../../types/geoseo'

/**
 * GEO 总览（Spec-F §1.3 / §0.4 Q2-A）。
 *
 * 这一屏今天只剩两类东西：库里的真实行数，与后端如实给出的待优化建议。
 * 那个「GEO总分」与它的六维度评分已经下线：它们由 `GeoDashboardController:90` 那类
 * 「配置字段填没填」的二值当场加权造出来（crawlerAccessibility = robotsTxt 非空 ? 100 : 50），
 * 没抓过爬虫、没测过引用，摆在界面上就是谎报（§9.6）。空着的那一格用 StateBlock 说明白
 * 「谁将来填它」，不静悄悄留个数字。
 * 「排名变化概览」也一并撤了：它的源表 `geoseo_keyword_rank` 没有数据源，
 * `/api/geoseo/keywords/{id}/check` 现在返回 501 NOT_IMPLEMENTED（Q7-A），页面留着只是错觉。
 */

const GEO_SCORE_TITLE = 'GEO 总分已下线：这里没有真观测值可显示'
const GEO_SCORE_DETAIL =
  '总分与六维度评分来自「配置字段填没填」的当场加权，不是任何能力的测量，已按 Q2-A 从界面上删除。'
const GEO_SCORE_NEXT =
  '补上这一格的是「分平台 × 分指标」矩阵（引用探测的每一轮真数）与可抓取性体检清单（§8 那六项实测）：'
  + '前者在 GEO 诊断报告里，后者已经在「可抓取性体检」那一页，六项各一行、各带自己的证据。'

const loading = ref(false)
const loadError = ref<string | null>(null)
const dashboardData = ref<GeoDashboard | null>(null)

const loadData = async () => {
  loading.value = true
  loadError.value = null
  try {
    dashboardData.value = await geoDashboardApi.get()
  } catch (error) {
    message.error('加载GEO仪表盘数据失败')
    loadError.value = (error as Error).message || '加载GEO仪表盘数据失败'
    logError('geoseo-dashboard-load', error)
  } finally {
    loading.value = false
  }
}

const suggestionColumns = [
  { title: '严重程度', key: 'severity', width: 120 },
  { title: '建议', key: 'message' },
]

// 建议按严重程度排序: high -> medium -> low
const sortedSuggestions = computed(() => {
  const list = dashboardData.value?.suggestions ?? []
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
  return [...list].sort((a, b) => {
    const oa = order[a.severity] ?? 99
    const ob = order[b.severity] ?? 99
    return oa - ob
  })
})

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'high':
      return 'red'
    case 'medium':
      return 'orange'
    case 'low':
      return 'blue'
    default:
      return 'default'
  }
}

function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'high':
      return '高'
    case 'medium':
      return '中'
    case 'low':
      return '低'
    default:
      return severity
  }
}

onMounted(() => {
  loadData()
})
</script>

<style lang="less" scoped>
.dashboard-content {
  .section-card {
    margin-bottom: 16px;
  }

  .geo-hard-rule {
    margin-top: 8px;
    color: #8c8c8c;
    font-size: 12px;
    text-align: center;
  }

  .suggestion-message {
    color: #262626;
  }

  .suggestion-index {
    font-size: 12px;
    color: #8c8c8c;
  }
}
</style>
