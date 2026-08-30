<template>
  <div class="geoseo-dashboard-view">
    <a-spin :spinning="loading">
      <a-page-header title="GEO总览仪表盘" sub-title="生成引擎优化全局视图" />

      <div class="dashboard-content">
        <!-- 1. GEO总分仪表盘 -->
        <a-card title="GEO总分" class="score-card">
          <div class="total-score-wrap">
            <a-progress
              type="circle"
              :percent="dashboardData?.totalScore ?? 0"
              :size="180"
              :stroke-color="totalScoreColor"
              :format="() => `${dashboardData?.totalScore ?? 0}`"
            />
            <div class="score-desc">
              <div class="score-label" :style="{ color: totalScoreColor }">{{ totalScoreLabel }}</div>
              <div class="score-hint">总分 100，分数越高代表 GEO 优化效果越好</div>
            </div>
          </div>
        </a-card>

        <!-- 2. 6维度评分卡片 -->
        <a-card title="维度评分" class="section-card">
          <a-row :gutter="[16, 16]">
            <a-col :xs="24" :sm="12" :md="8" v-for="dim in dimensionList" :key="dim.key">
              <div class="dimension-card">
                <div class="dimension-header">
                  <span class="dimension-name">{{ dim.name }}</span>
                  <a-tag color="blue">权重 {{ dim.weight }}</a-tag>
                </div>
                <div class="dimension-score" :style="{ color: getScoreColor(dim.value) }">
                  {{ dim.value }}
                  <span class="dimension-score-unit">/ 100</span>
                </div>
                <a-progress
                  :percent="dim.value"
                  :stroke-color="getScoreColor(dim.value)"
                  :show-info="false"
                />
              </div>
            </a-col>
          </a-row>
        </a-card>

        <!-- 3. 索引状态统计 -->
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

        <!-- 4. 排名变化概览 -->
        <a-card title="排名变化概览" class="section-card" v-if="rankChanges.length > 0">
          <a-table
            :data-source="rankChanges"
            :pagination="false"
            row-key="keyword"
            size="middle"
          >
            <a-table-column title="关键词" data-index="keyword" />
            <a-table-column title="搜索引擎" data-index="searchEngine" :width="120">
              <template #default="{ text }">
                <a-tag>{{ text }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column title="排名变化" :width="220">
              <template #default="{ record }">
                <span class="rank-change">
                  <span class="rank-prev">{{ record.previousRank }}</span>
                  <span class="rank-arrow">→</span>
                  <span class="rank-current" :style="{ color: getRankChangeColor(record.currentRank, record.previousRank) }">
                    {{ record.currentRank }}
                  </span>
                  <span
                    v-if="record.currentRank !== record.previousRank"
                    class="rank-delta"
                    :style="{ color: getRankChangeColor(record.currentRank, record.previousRank) }"
                  >
                    ({{ getRankDeltaText(record.currentRank, record.previousRank) }})
                  </span>
                </span>
              </template>
            </a-table-column>
          </a-table>
        </a-card>

        <!-- 5. 待优化建议列表 -->
        <a-card title="待优化建议" class="section-card">
          <a-empty v-if="sortedSuggestions.length === 0" description="暂无优化建议" />
          <a-list v-else :data-source="sortedSuggestions" item-layout="horizontal">
            <template #renderItem="{ item, index }">
              <a-list-item>
                <a-list-item-meta>
                  <template #avatar>
                    <a-tag :color="getSeverityColor(item.severity)">
                      {{ getSeverityLabel(item.severity) }}
                    </a-tag>
                  </template>
                  <template #title>
                    <span class="suggestion-message">{{ item.message }}</span>
                  </template>
                  <template #description>
                    <span class="suggestion-index">建议 #{{ index + 1 }}</span>
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </div>
    </a-spin>
  </div>
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
import { geoDashboardApi } from '../../api/geoseo'
import type { GeoDashboard } from '../../types/geoseo'

const loading = ref(false)
const dashboardData = ref<GeoDashboard | null>(null)

const loadData = async () => {
  loading.value = true
  try {
    dashboardData.value = await geoDashboardApi.get()
  } catch (error) {
    message.error('加载GEO仪表盘数据失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// 总分颜色: 0-40 红色, 40-70 橙色, 70-100 绿色
const totalScoreColor = computed(() => {
  const score = dashboardData.value?.totalScore ?? 0
  return getScoreColor(score)
})

const totalScoreLabel = computed(() => {
  const score = dashboardData.value?.totalScore ?? 0
  if (score < 40) return '亟待优化'
  if (score < 70) return '有待提升'
  return '表现良好'
})

// 6 维度评分列表
const dimensionList = computed(() => {
  const dims = dashboardData.value?.dimensions
  return [
    { key: 'aiCitability', name: 'AI可引用性', weight: '25%', value: dims?.aiCitability ?? 0 },
    { key: 'schemaCompleteness', name: 'Schema完整度', weight: '10%', value: dims?.schemaCompleteness ?? 0 },
    { key: 'metaCompleteness', name: 'Meta完整度', weight: '20%', value: dims?.metaCompleteness ?? 0 },
    { key: 'crawlerAccessibility', name: '爬虫可访问性', weight: '15%', value: dims?.crawlerAccessibility ?? 0 },
    { key: 'contentQuality', name: '内容质量', weight: '20%', value: dims?.contentQuality ?? 0 },
    { key: 'brandAuthority', name: '品牌权威度', weight: '10%', value: dims?.brandAuthority ?? 0 },
  ]
})

// 排名变化列表
const rankChanges = computed(() => {
  return dashboardData.value?.rankChanges ?? []
})

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

function getScoreColor(score: number): string {
  if (score < 40) return '#ff4d4f'
  if (score < 70) return '#faad14'
  return '#52c41a'
}

// 排名变化颜色: 数字越小排名越靠前，因此 currentRank < previousRank 为提升（绿色）
function getRankChangeColor(currentRank: number, previousRank: number): string {
  if (currentRank < previousRank) return '#52c41a'
  if (currentRank > previousRank) return '#ff4d4f'
  return '#8c8c8c'
}

function getRankDeltaText(currentRank: number, previousRank: number): string {
  const delta = currentRank - previousRank
  if (delta < 0) return `↑${Math.abs(delta)}`
  return `↓${Math.abs(delta)}`
}

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
.geoseo-dashboard-view {
  .dashboard-content {
    padding: 0 24px 24px;
  }

  .score-card {
    margin-bottom: 16px;

    .total-score-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 48px;
      padding: 24px 0;
    }

    .score-desc {
      .score-label {
        font-size: 24px;
        font-weight: 600;
        line-height: 1.2;
      }

      .score-hint {
        margin-top: 8px;
        font-size: 13px;
        color: #8c8c8c;
        max-width: 240px;
      }
    }
  }

  .section-card {
    margin-bottom: 16px;
  }

  .dimension-card {
    padding: 20px;
    background: #fafafa;
    border-radius: 8px;
    height: 100%;

    .dimension-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .dimension-name {
      font-size: 15px;
      font-weight: 500;
      color: #262626;
    }

    .dimension-score {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 12px;

      .dimension-score-unit {
        font-size: 14px;
        font-weight: 400;
        color: #8c8c8c;
      }
    }
  }

  .rank-change {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    .rank-prev {
      color: #8c8c8c;
    }

    .rank-arrow {
      color: #bfbfbf;
    }

    .rank-current {
      font-weight: 600;
    }

    .rank-delta {
      font-size: 12px;
    }
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
