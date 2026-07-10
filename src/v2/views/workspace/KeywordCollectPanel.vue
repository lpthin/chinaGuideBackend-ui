<template>
  <div class="keyword-collect-page">
    <a-spin :spinning="loading">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <ThunderboltOutlined />
          </div>
          <div class="header-info">
            <h2 class="page-title">关键词采集</h2>
            <p class="page-subtitle">
              <span class="subtitle-text">多平台智能采集，高效拓展关键词库</span>
              <span class="header-divider"></span>
              <span class="header-badge">
                <span class="badge-dot"></span>
                智能采集引擎
              </span>
            </p>
          </div>
        </div>
        <div class="header-actions">
          <a-button @click="fetchData" class="header-btn">
            <template #icon><ReloadOutlined /></template>
            刷新数据
          </a-button>
        </div>
      </div>

      <div class="stat-cards">
        <div
          class="stat-card"
          v-for="(item, index) in statItems"
          :key="item.key"
          :class="`stat-card--${item.color}`"
          :style="{ animationDelay: `${index * 0.08}s` }"
        >
          <div class="stat-card__glow"></div>
          <div class="stat-card__pattern" aria-hidden="true">
            <svg viewBox="0 0 100 100" fill="none">
              <circle cx="80" cy="20" r="40" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
              <circle cx="90" cy="10" r="30" stroke="currentColor" stroke-width="0.5" opacity="0.2"/>
            </svg>
          </div>
          <div class="stat-card__content">
            <div class="stat-card__top">
              <div class="stat-card__icon">
                <component :is="item.icon" />
              </div>
              <div class="stat-card__trend" :class="`trend-${item.trendType}`">
                <span class="trend-arrow">{{ getTrendArrow(item.trendType) }}</span>
                <span class="trend-value">{{ item.trendValue }}</span>
              </div>
            </div>
            <div class="stat-card__value">
              <span class="value-number">{{ item.value }}</span>
              <span class="value-unit">{{ item.unit }}</span>
            </div>
            <div class="stat-card__bottom">
              <span class="stat-card__label">{{ item.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="content-grid">
        <div class="chart-card chart-card--wide">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title__icon card-title__icon--blue">
                <LineChartOutlined />
              </div>
              <div class="card-title__text">
                <h3>采集趋势</h3>
                <p>追踪关键词采集量变化</p>
              </div>
            </div>
            <a-radio-group v-model:value="trendTimeRange" size="small" button-style="solid" class="chart-toggle">
              <a-radio-button value="7">近7天</a-radio-button>
              <a-radio-button value="30">近30天</a-radio-button>
            </a-radio-group>
          </div>
          <div ref="trendChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card chart-card--narrow">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title__icon card-title__icon--purple">
                <PieChartOutlined />
              </div>
              <div class="card-title__text">
                <h3>数据源分布</h3>
                <p>各来源关键词占比</p>
              </div>
            </div>
          </div>
          <div ref="sourceChartRef" class="chart-container chart-container--pie"></div>
        </div>
      </div>

      <div class="content-grid">
        <div class="section-card section-card--wide">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title__icon card-title__icon--green">
                <CloudServerOutlined />
              </div>
              <div class="card-title__text">
                <h3>数据源配置</h3>
                <p>管理各平台采集开关</p>
              </div>
            </div>
            <div class="card-actions">
              <a-tag :color="enabledSourcesCount > 0 ? 'success' : 'default'" class="source-count-tag">
                已启用 {{ enabledSourcesCount }} 个
              </a-tag>
              <a-button type="link" size="small" @click="expandAllSources" class="expand-btn">
                {{ allExpanded ? '全部收起' : '全部展开' }}
              </a-button>
            </div>
          </div>

          <div class="source-tabs">
            <a-radio-group v-model:value="activeSourceTab" button-style="solid" size="middle">
              <a-radio-button value="search">
                <template #icon><SearchOutlined /></template>
                搜索引擎
              </a-radio-button>
              <a-radio-button value="news">
                <template #icon><ReadOutlined /></template>
                新闻媒体
              </a-radio-button>
              <a-radio-button value="social">
                <template #icon><ShareAltOutlined /></template>
                社交媒体
              </a-radio-button>
              <a-radio-button value="industry">
                <template #icon><AppstoreOutlined /></template>
                行业网站
              </a-radio-button>
            </a-radio-group>
          </div>

          <div class="source-cards-wrap">
            <div class="source-grid">
              <div
                class="source-card"
                v-for="source in filteredDataSources"
                :key="source.key"
                :class="{ active: source.enabled }"
              >
                <div class="source-card__glow"></div>
                <div class="source-header">
                  <div class="source-name-wrap">
                    <div class="source-icon" :class="source.key">
                      <component :is="getSourceIcon(source.key)" />
                    </div>
                    <div class="source-name-info">
                      <div class="source-name">{{ source.name }}</div>
                      <div class="source-status">
                        <span class="status-badge" :class="`status-${source.status}`">
                          <span class="status-dot"></span>
                          {{ getStatusText(source.status) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <a-switch
                    v-model:checked="source.enabled"
                    class="source-switch"
                    @change="toggleSource(source)"
                  />
                </div>
                <div class="source-desc">{{ source.description }}</div>
                <div class="source-stats">
                  <div class="stat-item">
                    <span class="stat-label">今日采集</span>
                    <span class="stat-num">{{ getSourceTodayCount(source.key) }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">成功率</span>
                    <span class="stat-num stat-num--success">
                      {{ getSourceSuccessRate(source.key) }}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="section-card section-card--narrow collect-action-card">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title__icon card-title__icon--orange">
                <PlayCircleOutlined />
              </div>
              <div class="card-title__text">
                <h3>采集操作</h3>
                <p>一键启动关键词采集</p>
              </div>
            </div>
          </div>

          <div class="main-action-area">
            <a-button
              type="primary"
              :loading="collecting"
              class="btn-start-collect"
              block
              size="large"
              @click="startCollect"
            >
              <template #icon><PlayCircleOutlined /></template>
              {{ collecting ? '采集中...' : '开始采集' }}
            </a-button>
            <div v-if="collecting" class="collect-progress">
              <a-progress :percent="collectProgress" :show-info="false" size="small" />
              <span class="progress-text">
                正在采集第 {{ currentCollectStep }}/{{ totalCollectSteps }} 个数据源...
              </span>
            </div>
          </div>

          <div class="action-section">
            <div class="action-section__title">
              <SettingOutlined /> 配置管理
            </div>
            <div class="action-btns">
              <a-button class="action-btn" @click="showCronModal = true">
                <template #icon><ClockCircleOutlined /></template>
                定时采集
              </a-button>
              <a-button class="action-btn" @click="showRuleModal = true">
                <template #icon><FilterOutlined /></template>
                采集规则
              </a-button>
            </div>
          </div>

          <div class="action-section">
            <div class="action-section__title">
              <ImportOutlined /> 数据导入导出
            </div>
            <div class="action-btns">
              <a-button class="action-btn" @click="showImportModal = true">
                <template #icon><UploadOutlined /></template>
                导入关键词
              </a-button>
              <a-button class="action-btn" @click="exportKeywords">
                <template #icon><DownloadOutlined /></template>
                导出关键词
              </a-button>
            </div>
          </div>

          <div class="action-section">
            <div class="action-section__title">
              <ClusterOutlined /> 快捷操作
            </div>
            <div class="action-btns">
              <a-button
                type="primary"
                ghost
                class="action-btn action-btn--distill"
                :disabled="selectedRowKeys.length === 0 || distilling"
                @click="startDistill"
              >
                <template #icon><ClusterOutlined /></template>
                {{ distilling ? '蒸馏中...' : '智能蒸馏' }}
              </a-button>
            </div>
          </div>
        </div>
      </div>

      <div class="table-section">
        <div class="card-header">
          <div class="card-title">
            <div class="card-title__icon card-title__icon--blue">
              <UnorderedListOutlined />
            </div>
            <div class="card-title__text">
              <h3>关键词池</h3>
              <p>已采集关键词总览</p>
            </div>
            <a-tag color="blue" class="table-count-tag">{{ totalFiltered }} 条数据</a-tag>
          </div>
        </div>

        <div class="table-toolbar">
          <a-space wrap size="middle">
            <a-input-search
              v-model:value="searchText"
              placeholder="搜索关键词"
              style="width: 220px"
              @search="fetchData"
              enter-button
              allow-clear
            />
            <a-select v-model:value="statusFilter" style="width: 130px" placeholder="状态筛选" allowClear>
              <a-select-option value="all">全部状态</a-select-option>
              <a-select-option value="pending">待蒸馏</a-select-option>
              <a-select-option value="distilled">已蒸馏</a-select-option>
            </a-select>
            <a-select v-model:value="priorityFilter" style="width: 140px" placeholder="优先级筛选" allowClear>
              <a-select-option value="all">全部优先级</a-select-option>
              <a-select-option value="high">高优先级(≥80)</a-select-option>
              <a-select-option value="medium">中优先级(60-79)</a-select-option>
              <a-select-option value="low">低优先级(<60)</a-select-option>
            </a-select>
            <a-select v-model:value="sourceFilter" style="width: 140px" placeholder="来源筛选" allowClear>
              <a-select-option value="all">全部来源</a-select-option>
              <a-select-option value="site_profile">站点画像</a-select-option>
              <a-select-option value="rule_expand">规则扩展</a-select-option>
              <a-select-option value="baidu_suggest">百度联想</a-select-option>
            </a-select>
            <a-button type="primary" danger :disabled="selectedRowKeys.length === 0" @click="batchDelete">
              <template #icon><DeleteOutlined /></template>
              批量删除
            </a-button>
            <a-button type="primary" :disabled="selectedRowKeys.length === 0" @click="batchSetPriority">
              <template #icon><StarOutlined /></template>
              批量设置优先级
            </a-button>
            <a-button type="primary" ghost :disabled="selectedRowKeys.length === 0 || distilling" @click="startDistill">
              <template #icon><ClusterOutlined /></template>
              批量加入蒸馏队列
            </a-button>
          </a-space>
        </div>

        <a-table
          class="keyword-table"
          :columns="keywordColumns"
          :data-source="filteredKeywords"
          :pagination="paginationConfig"
          :loading="loading"
          row-key="id"
          @change="handleTableChange"
          :row-selection="{ selectedRowKeys: selectedRowKeys, onChange: onSelectChange }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'rawKeyword'">
              <div class="keyword-cell">
                <span class="keyword-text">{{ record.rawKeyword }}</span>
                <span v-if="record.priority && record.priority >= 80" class="hot-tag">
                  <FireOutlined /> 热门
                </span>
              </div>
            </template>
            <template v-else-if="column.key === 'sourceCodes'">
              <div class="source-tags">
                <a-tag v-if="record.sourceCodes" size="small" color="blue">
                  {{ getSourceText(record.sourceCodes) }}
                </a-tag>
                <span v-else>-</span>
              </div>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)" size="small">
                {{ getKeywordStatusText(record.status) }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'priority'">
              <div class="priority-cell">
                <a-progress
                  v-if="record.priority"
                  :percent="record.priority"
                  :show-info="false"
                  size="small"
                  :stroke-color="getPriorityColor(record.priority)"
                  style="width: 80px; margin-right: 8px"
                />
                <span class="priority-text">{{ record.priority || '-' }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'quality'">
              <div class="quality-stars">
                <StarFilled v-for="n in getStarCount(record.quality)" :key="n" class="star-filled" />
                <StarOutlined v-for="n in (5 - getStarCount(record.quality))" :key="`empty-${n}`" class="star-empty" />
                <span class="quality-text">{{ record.quality || '-' }}</span>
              </div>
            </template>
          </template>
        </a-table>
      </div>

      <a-modal
        v-model:open="showImportModal"
        title="导入关键词"
        @ok="handleImport"
        :confirmLoading="importing"
        width="600px"
      >
        <a-alert
          message="导入说明"
          description="每行一个关键词，支持批量导入，重复关键词会自动去重。"
          type="info"
          style="margin-bottom: 16px"
        />
        <a-textarea
          v-model:value="importText"
          placeholder="请输入关键词，每行一个，例如：&#10;中国旅游&#10;支付宝使用&#10;微信支付"
          :rows="8"
          show-count
        />
      </a-modal>

      <a-modal
        v-model:open="showCronModal"
        title="定时采集配置"
        @ok="saveCronConfig"
        width="500px"
      >
        <a-form layout="vertical">
          <a-form-item label="启用定时采集">
            <a-switch v-model:checked="cronConfig.enabled" />
          </a-form-item>
          <a-form-item label="采集频率">
            <a-select v-model:value="cronConfig.frequency" style="width: 100%">
              <a-select-option value="hourly">每小时</a-select-option>
              <a-select-option value="daily">每天</a-select-option>
              <a-select-option value="weekly">每周</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="执行时间">
            <a-time-picker v-model:value="cronConfig.executeTime" format="HH:mm" style="width: 100%" />
          </a-form-item>
        </a-form>
      </a-modal>

      <a-modal
        v-model:open="showRuleModal"
        title="采集规则配置"
        @ok="saveRuleConfig"
        width="600px"
      >
        <a-alert
          message="采集规则说明"
          description="配置关键词采集的过滤规则，提高关键词质量。"
          type="info"
          style="margin-bottom: 16px"
        />
        <a-form layout="vertical">
          <a-form-item label="关键词最小长度">
            <a-input-number v-model:value="ruleConfig.minLength" :min="1" :max="50" style="width: 100%" />
          </a-form-item>
          <a-form-item label="关键词最大长度">
            <a-input-number v-model:value="ruleConfig.maxLength" :min="1" :max="100" style="width: 100%" />
          </a-form-item>
          <a-form-item label="排除敏感词">
            <a-switch v-model:checked="ruleConfig.filterSensitive" />
          </a-form-item>
          <a-form-item label="自动去重">
            <a-switch v-model:checked="ruleConfig.autoDeduplicate" />
          </a-form-item>
        </a-form>
      </a-modal>

      <a-modal
        v-model:open="showDistillProgress"
        title="蒸馏进度"
        :footer="null"
        :closable="distillProgress >= 100"
        width="500px"
      >
        <a-progress
          :percent="distillProgress"
          :status="distillProgress >= 100 ? 'success' : 'active'"
          style="margin-bottom: 16px"
        />
        <a-alert v-if="distillProgress >= 100" message="蒸馏完成！" type="success" />
      </a-modal>

      <a-modal
        v-model:open="showPriorityModal"
        title="批量设置优先级"
        @ok="confirmBatchPriority"
        width="400px"
      >
        <a-alert
          message="提示"
          description="将为选中的关键词设置统一优先级，范围为 0-100，数值越高优先级越高。"
          type="info"
          style="margin-bottom: 16px"
        />
        <a-form layout="vertical">
          <a-form-item label="优先级">
            <a-input-number
              v-model:value="batchPriorityValue"
              :min="0"
              :max="100"
              :step="5"
              style="width: 100%"
            />
            <div class="priority-hint">
              <span class="hint-item">低(0-59)</span>
              <span class="hint-item">中(60-79)</span>
              <span class="hint-item">高(80-100)</span>
            </div>
          </a-form-item>
        </a-form>
      </a-modal>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { message } from 'ant-design-vue'
import * as echarts from 'echarts'
import {
  FileTextOutlined,
  LineChartOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  StarOutlined,
  ClusterOutlined,
  CloudServerOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  SearchOutlined,
  ReadOutlined,
  ShareAltOutlined,
  AppstoreOutlined,
  ImportOutlined,
  FilterOutlined,
  UnorderedListOutlined,
  FireOutlined,
  PieChartOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  BulbOutlined,
  WeiboOutlined,
  DashboardOutlined,
  StarFilled,
  ReloadOutlined,
} from '@ant-design/icons-vue'
import { keywordApi, clusterApi } from '../../api'
import { useAuthStore } from '../../stores/auth'
import type { KeywordCluster } from '../../types/workspace'

interface Keyword {
  id?: number
  rawKeyword?: string
  normalizedKeyword?: string
  sourceCodes?: string
  keywordType?: string
  priority?: number
  status?: string
  createdAt?: string
  quality?: number
}

const auth = useAuthStore()
const loading = ref(false)
const chartLoading = ref(false)
const collecting = ref(false)
const distilling = ref(false)
const importing = ref(false)
const showImportModal = ref(false)
const showCronModal = ref(false)
const showRuleModal = ref(false)
const showDistillProgress = ref(false)
const distillProgress = ref(0)
const searchText = ref('')
const statusFilter = ref('all')
const priorityFilter = ref('all')
const sourceFilter = ref('all')
const selectedRowKeys = ref<number[]>([])
const activeSourceTab = ref('search')
const allExpanded = ref(false)
const trendTimeRange = ref('7')
const collectProgress = ref(0)
const currentCollectStep = ref(0)
const totalCollectSteps = ref(0)
const importText = ref('')

const trendChartRef = ref<HTMLElement>()
const sourceChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let sourceChart: echarts.ECharts | null = null

const chartData = ref<{
  trendData: { dates: string[]; counts: number[] } | null
  sourceDistribution: { name: string; value: number }[]
}>({
  trendData: null,
  sourceDistribution: []
})

const stats = reactive({
  todayCount: 0,
  weekCount: 0,
  pendingDistill: 0,
  dataSourceCount: 0,
})

const ruleConfig = reactive({
  minLength: 2,
  maxLength: 20,
  filterSensitive: true,
  autoDeduplicate: true,
})

const dataSources = ref([
  { key: 'site_profile', name: '站点画像', description: '基于站点内容自动扩展相关关键词', status: 'online', enabled: true, category: 'search' },
  { key: 'rule_expand', name: '规则扩展', description: '基于预设规则扩展关键词', status: 'online', enabled: true, category: 'search' },
  { key: 'baidu_suggest', name: '百度联想', description: '调用百度接口获取联想词', status: 'online', enabled: true, category: 'search' },
  { key: 'news', name: '新闻热点', description: '从新闻平台获取热点关键词', status: 'limit', enabled: false, category: 'news' },
  { key: 'social_media', name: '社交媒体', description: '从微博、抖音等平台获取热词', status: 'offline', enabled: false, category: 'social' },
  { key: 'industry', name: '行业网站', description: '从垂直行业网站采集关键词', status: 'online', enabled: false, category: 'industry' },
])

const sourceCategoryMap: Record<string, string[]> = {
  search: ['site_profile', 'rule_expand', 'baidu_suggest'],
  news: ['news'],
  social: ['social_media'],
  industry: ['industry'],
}

const cronConfig = reactive({
  enabled: false,
  frequency: 'daily',
  executeTime: null as any,
})

const keywords = ref<Keyword[]>([])
const currentPage = ref(1)
const pageSize = ref(10)

const statItems = computed(() => [
  {
    key: 'today',
    icon: FileTextOutlined,
    value: stats.todayCount,
    label: '今日采集关键词数',
    unit: '个',
    trendType: 'up',
    trendValue: '12%',
    color: 'blue',
  },
  {
    key: 'week',
    icon: LineChartOutlined,
    value: stats.weekCount,
    label: '本周新增关键词数',
    unit: '个',
    trendType: 'up',
    trendValue: '8%',
    color: 'purple',
  },
  {
    key: 'pending',
    icon: ClockCircleOutlined,
    value: stats.pendingDistill,
    label: '待蒸馏关键词数',
    unit: '个',
    trendType: 'down',
    trendValue: '3%',
    color: 'green',
  },
  {
    key: 'datasource',
    icon: DatabaseOutlined,
    value: stats.dataSourceCount,
    label: '数据源接入数',
    unit: '个',
    trendType: 'stable',
    trendValue: '稳定',
    color: 'orange',
  },
])

function getTrendArrow(type: string) {
  switch (type) {
    case 'up': return '↗'
    case 'down': return '↘'
    default: return '→'
  }
}

const enabledSourcesCount = computed(() => dataSources.value.filter(s => s.enabled).length)

const filteredDataSources = computed(() => {
  const categoryKeys = sourceCategoryMap[activeSourceTab.value] || []
  return dataSources.value.filter(s => categoryKeys.includes(s.key))
})

const filteredKeywords = computed(() => {
  let list = [...keywords.value]

  if (statusFilter.value !== 'all') {
    list = list.filter(item => {
      const itemStatus = (item.status || '').toLowerCase().trim()
      if (statusFilter.value === 'pending') {
        return itemStatus !== 'distilled'
      } else {
        return itemStatus === 'distilled'
      }
    })
  }

  if (priorityFilter.value !== 'all') {
    list = list.filter(item => {
      const priority = item.priority || 0
      if (priorityFilter.value === 'high') {
        return priority >= 80
      } else if (priorityFilter.value === 'medium') {
        return priority >= 60 && priority < 80
      } else {
        return priority < 60
      }
    })
  }

  if (sourceFilter.value !== 'all') {
    list = list.filter(item => {
      const sources = item.sourceCodes?.split(',') || []
      return sources.includes(sourceFilter.value)
    })
  }

  if (searchText.value) {
    const searchLower = searchText.value.toLowerCase()
    list = list.filter(
      item =>
        (item.rawKeyword && item.rawKeyword.toLowerCase().includes(searchLower)) ||
        (item.normalizedKeyword && item.normalizedKeyword.toLowerCase().includes(searchLower))
    )
  }

  return list
})

const totalFiltered = computed(() => filteredKeywords.value.length)

const paginationConfig = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: totalFiltered.value,
  showSizeChanger: true,
  showQuickJumper: true,
  pageSizes: [10, 20, 30, 50],
  showTotal: (total: number) => `共 ${total} 条`,
}))

const keywordColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '关键词', dataIndex: 'rawKeyword', key: 'rawKeyword', width: 220 },
  { title: '归一化关键词', dataIndex: 'normalizedKeyword', key: 'normalizedKeyword', width: 200 },
  { title: '来源', key: 'sourceCodes', width: 140 },
  { title: '类型', dataIndex: 'keywordType', key: 'keywordType', width: 100 },
  { title: '优先级', key: 'priority', width: 140 },
  { title: '质量评分', key: 'quality', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '采集时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
]

const sourceLabelMap: Record<string, string> = {
  site_profile: '站点画像',
  rule_expand: '规则扩展',
  baidu_suggest: '百度联想',
  news: '新闻热点',
  social_media: '社交媒体',
  industry: '行业网站',
}

const sourceIconMap: Record<string, any> = {
  site_profile: GlobalOutlined,
  rule_expand: BulbOutlined,
  baidu_suggest: SearchOutlined,
  news: ReadOutlined,
  social_media: WeiboOutlined,
  industry: DashboardOutlined,
}

function getSourceIcon(key: string) {
  return sourceIconMap[key] || GlobalOutlined
}

function getSourceText(source?: string) {
  if (!source) return '-'
  const sources = source.split(',')
  return sources.map(s => sourceLabelMap[s] || s).join(', ')
}

function getSourceTodayCount(key: string) {
  const counts: Record<string, number> = {
    site_profile: 156,
    rule_expand: 89,
    baidu_suggest: 234,
    news: 67,
    social_media: 45,
    industry: 78,
  }
  return counts[key] || 0
}

function getSourceSuccessRate(key: string) {
  const rates: Record<string, number> = {
    site_profile: 95,
    rule_expand: 88,
    baidu_suggest: 92,
    news: 76,
    social_media: 0,
    industry: 85,
  }
  return rates[key] || 0
}

function getPriorityColor(priority?: number) {
  if (!priority) return 'default'
  if (priority >= 80) return '#f5222d'
  if (priority >= 60) return '#fa8c16'
  return '#52c41a'
}

function getKeywordStatusText(status?: string) {
  const statusLower = (status || '').toLowerCase().trim()
  if (!statusLower) return '待蒸馏'
  if (statusLower === 'distilled') return '已蒸馏'
  return '待蒸馏'
}

function getStatusColor(status?: string) {
  switch (status) {
    case 'online': return 'success'
    case 'limit': return 'warning'
    case 'offline': return 'error'
    default: return 'default'
  }
}

function getStarCount(quality?: number) {
  if (!quality) return 0
  if (quality >= 90) return 5
  if (quality >= 80) return 4
  if (quality >= 60) return 3
  if (quality >= 40) return 2
  return 1
}

function getStatusText(status: string) {
  switch (status) {
    case 'online': return '在线'
    case 'limit': return '限流'
    case 'offline': return '离线'
    default: return '未知'
  }
}

function toggleSource(source: any) {
  message.success(`${source.name} 已${source.enabled ? '启用' : '停用'}`)
  stats.dataSourceCount = dataSources.value.filter(s => s.enabled).length
}

function expandAllSources() {
  allExpanded.value = !allExpanded.value
}

function onSelectChange(keys: number[]) {
  selectedRowKeys.value = keys
}

function handleTableChange(pagination: any) {
  if (pagination.current !== undefined && pagination.current !== currentPage.value) {
    currentPage.value = pagination.current
  }
  if (pagination.pageSize !== undefined && pagination.pageSize !== pageSize.value) {
    pageSize.value = pagination.pageSize
    currentPage.value = 1
  }
}

async function loadKeywordStats() {
  chartLoading.value = true
  try {
    const res = await keywordApi.getKeywordStats()
    chartData.value.trendData = res.trendData
    chartData.value.sourceDistribution = res.sourceDistribution
    initTrendChart()
    initSourceChart()
  } catch (error) {
    console.error('获取图表数据失败:', error)
    message.error('获取图表数据失败')
  } finally {
    chartLoading.value = false
  }
}

async function fetchData() {
  loading.value = true
  try {
    const [statsRes, keywordRes] = await Promise.all([
      keywordApi.getStats(),
      keywordApi.list({}),
    ])
    const statsData = statsRes
    const keywordData = keywordRes.records
    keywords.value = keywordData as unknown as Keyword[]
    stats.todayCount = (statsData as any).todayCount || keywordData.slice(0, 10).length
    stats.weekCount = (statsData as any).weekCount || keywordData.length
    stats.pendingDistill = statsData.pending || keywordData.filter((k: any) => k.status !== 'distilled').length
    stats.dataSourceCount = dataSources.value.filter(s => s.enabled).length
  } catch (error) {
    console.error('获取数据失败:', error)
    message.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

async function loadAllData() {
  await Promise.all([
    fetchData(),
    loadKeywordStats()
  ])
}

async function startCollect() {
  const enabledSources = dataSources.value.filter(s => s.enabled)
  if (enabledSources.length === 0) {
    message.warning('请至少启用一个数据源')
    return
  }
  collecting.value = true
  collectProgress.value = 0
  currentCollectStep.value = 0
  totalCollectSteps.value = enabledSources.length
  
  try {
    const res = await keywordApi.collect({
      sourceCodes: enabledSources.map(s => s.key),
    })
    
    collectProgress.value = 100
    currentCollectStep.value = totalCollectSteps.value
    const savedCount = res?.collected ?? 0
    message.success(`采集完成，新增 ${savedCount} 个关键词`)
    fetchData()
  } catch (error) {
    console.error('采集失败:', error)
    message.error('采集失败')
  } finally {
    collecting.value = false
    collectProgress.value = 0
  }
}

async function handleImport() {
  if (!importText.value.trim()) {
    message.warning('请输入关键词')
    return
  }
  importing.value = true
  try {
    const keywordsList = importText.value.split('\n').map((k: string) => k.trim()).filter(Boolean)
    const res = await keywordApi.importKeywords({ keywords: keywordsList })
    showImportModal.value = false
    importText.value = ''
    message.success(`导入成功，共 ${res.imported ?? 0} 个关键词`)
    fetchData()
  } catch (error) {
    console.error('导入失败:', error)
    message.error('导入失败')
  } finally {
    importing.value = false
  }
}

function exportKeywords() {
  const dataToExport = filteredKeywords.value
  if (dataToExport.length === 0) {
    message.warning('没有可导出的数据')
    return
  }
  message.success(`成功导出 ${dataToExport.length} 个关键词`)
}

async function batchDelete() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择要删除的关键词')
    return
  }
  try {
    await keywordApi.batchDelete(selectedRowKeys.value)
    message.success(`成功删除 ${selectedRowKeys.value.length} 个关键词`)
    selectedRowKeys.value = []
    fetchData()
  } catch (error) {
    console.error('批量删除失败:', error)
    message.error('批量删除失败')
  }
}

function batchSetPriority() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择关键词')
    return
  }
  showPriorityModal.value = true
}

const showPriorityModal = ref(false)
const batchPriorityValue = ref(80)

async function confirmBatchPriority() {
  if (batchPriorityValue.value < 0 || batchPriorityValue.value > 100) {
    message.warning('优先级值必须在 0-100 之间')
    return
  }
  try {
    await keywordApi.batchUpdatePriority(selectedRowKeys.value, batchPriorityValue.value)
    message.success(`成功设置 ${selectedRowKeys.value.length} 个关键词的优先级为 ${batchPriorityValue.value}`)
    showPriorityModal.value = false
    selectedRowKeys.value = []
    fetchData()
  } catch (error) {
    console.error('批量设置优先级失败:', error)
    message.error('批量设置优先级失败')
  }
}

async function startDistill() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择要蒸馏的关键词')
    return
  }
  distilling.value = true
  showDistillProgress.value = true
  distillProgress.value = 0
  try {
    await clusterApi.distill()
    distillProgress.value = 100
    message.success('蒸馏完成！')
    fetchData()
  } catch (error) {
    console.error('启动蒸馏失败:', error)
    message.error('启动蒸馏失败')
  } finally {
    distilling.value = false
    showDistillProgress.value = false
  }
}

function saveCronConfig() {
  message.success('定时采集配置已保存')
  showCronModal.value = false
}

function saveRuleConfig() {
  message.success('采集规则配置已保存')
  showRuleModal.value = false
}

const initTrendChart = () => {
  if (!trendChartRef.value || !chartData.value.trendData) return
  
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e8ecf4',
      borderWidth: 1,
      textStyle: { color: '#1a1f36', fontSize: 12 },
      padding: [12, 16],
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#6366f1', type: 'dashed', width: 1 }
      }
    },
    grid: {
      left: 0,
      right: 0,
      bottom: 0,
      top: 20,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartData.value.trendData.dates,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 }
    },
    series: [
      {
        name: '采集数量',
        type: 'line',
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        data: chartData.value.trendData.counts,
        lineStyle: { color: '#6366f1', width: 2.5 },
        itemStyle: { color: '#6366f1' },
        emphasis: {
          itemStyle: { borderColor: '#fff', borderWidth: 2, shadowBlur: 10, shadowColor: 'rgba(99, 102, 241, 0.4)' }
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(99, 102, 241, 0.18)' },
            { offset: 1, color: 'rgba(99, 102, 241, 0.02)' }
          ])
        }
      }
    ]
  }
  
  trendChart.setOption(option)
}

const initSourceChart = () => {
  if (!sourceChartRef.value || !chartData.value.sourceDistribution || chartData.value.sourceDistribution.length === 0) return
  
  if (!sourceChart) {
    sourceChart = echarts.init(sourceChartRef.value)
  }
  
  const colors = ['#6366f1', '#a855f7', '#22c55e', '#f97316', '#ec4899']
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e8ecf4',
      borderWidth: 1,
      textStyle: { color: '#1a1f36', fontSize: 12 },
      padding: [12, 16]
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#64748b', fontSize: 12 },
      itemGap: 14
    },
    series: [
      {
        type: 'pie',
        radius: ['55%', '78%'],
        center: ['32%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 3
        },
        label: {
          show: false
        },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 600,
            color: '#1a1f36'
          },
          itemStyle: {
            shadowBlur: 20,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.15)'
          }
        },
        labelLine: {
          show: false
        },
        data: chartData.value.sourceDistribution.map((item, index) => ({
          ...item,
          itemStyle: {
            color: colors[index % colors.length]
          }
        }))
      }
    ]
  }
  
  sourceChart.setOption(option)
}

const handleResize = () => {
  trendChart?.resize()
  sourceChart?.resize()
}

onMounted(() => {
  fetchData()
  setTimeout(() => {
    initTrendChart()
    initSourceChart()
    window.addEventListener('resize', handleResize)
  }, 100)
})

watch(
  () => auth.tenantId,
  () => {
    fetchData()
  }
)

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  sourceChart?.dispose()
})
</script>

<style lang="less" scoped>
@indigo-50: #eef2ff;
@indigo-100: #e0e7ff;
@indigo-500: #6366f1;
@indigo-600: #4f46e5;
@purple-50: #faf5ff;
@purple-100: #f3e8ff;
@purple-500: #a855f7;
@purple-600: #9333ea;
@green-50: #f0fdf4;
@green-100: #dcfce7;
@green-500: #22c55e;
@green-600: #16a34a;
@orange-50: #fff7ed;
@orange-100: #ffedd5;
@orange-500: #f97316;
@orange-600: #ea580c;
@red-50: #fef2f2;
@red-500: #ef4444;
@slate-50: #f8fafc;
@slate-100: #f1f5f9;
@slate-200: #e2e8f0;
@slate-300: #cbd5e1;
@slate-400: #94a3b8;
@slate-500: #64748b;
@slate-600: #475569;
@slate-700: #334155;
@slate-900: #0f172a;
@pink-500: #ec4899;
@cyan-500: #06b6d4;

.keyword-collect-page {
  width: 100%;
  padding: 4px;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 8px;
  animation: fadeInDown 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, @indigo-500 0%, @purple-500 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
}

.header-info .page-title {
  margin: 0 0 6px 0;
  font-size: 24px;
  font-weight: 700;
  color: @slate-900;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.header-info .page-subtitle {
  margin: 0;
  font-size: 13px;
  color: @slate-500;
  display: flex;
  align-items: center;
  gap: 12px;
}

.subtitle-text {
  color: @slate-500;
}

.header-divider {
  width: 1px;
  height: 12px;
  background: @slate-200;
}

.header-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  color: @indigo-600;
  font-size: 12px;
  font-weight: 500;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: @indigo-500;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.header-btn {
  height: 38px;
  border-radius: 10px;
  font-weight: 500;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:focus-visible {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  margin-bottom: 20px;
}

.stat-card {
  position: relative;
  background: #ffffff;
  border-radius: 16px;
  padding: 22px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.04), 0 1px 2px rgba(16, 24, 40, 0.03);
  animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
  border: 1px solid rgba(226, 232, 240, 0.6);
}

.stat-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px -12px rgba(16, 24, 40, 0.15);
  border-color: transparent;
}

.stat-card:active {
  transform: translateY(-3px);
}

.stat-card:focus-visible {
  outline: 2px solid @indigo-500;
  outline-offset: 2px;
}

.stat-card__glow {
  position: absolute;
  top: -50%;
  right: -20%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  opacity: 0;
  filter: blur(40px);
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.stat-card--blue .stat-card__glow { background: @indigo-500; }
.stat-card--purple .stat-card__glow { background: @purple-500; }
.stat-card--green .stat-card__glow { background: @green-500; }
.stat-card--orange .stat-card__glow { background: @orange-500; }

.stat-card:hover .stat-card__glow {
  opacity: 0.12;
}

.stat-card__pattern {
  position: absolute;
  top: 0;
  right: 0;
  width: 120px;
  height: 120px;
  opacity: 0.4;
  pointer-events: none;
  transition: all 0.4s ease;
}

.stat-card--blue .stat-card__pattern { color: @indigo-500; }
.stat-card--purple .stat-card__pattern { color: @purple-500; }
.stat-card--green .stat-card__pattern { color: @green-500; }
.stat-card--orange .stat-card__pattern { color: @orange-500; }

.stat-card:hover .stat-card__pattern {
  opacity: 0.6;
  transform: scale(1.1) rotate(5deg);
}

.stat-card__content {
  position: relative;
  z-index: 1;
}

.stat-card__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
}

.stat-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: #fff;
  transition: transform 0.3s ease;
}

.stat-card:hover .stat-card__icon {
  transform: scale(1.08) rotate(-5deg);
}

.stat-card--blue .stat-card__icon {
  background: linear-gradient(135deg, @indigo-500 0%, @indigo-600 100%);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
}

.stat-card--purple .stat-card__icon {
  background: linear-gradient(135deg, @purple-500 0%, @purple-600 100%);
  box-shadow: 0 6px 16px rgba(168, 85, 247, 0.35);
}

.stat-card--green .stat-card__icon {
  background: linear-gradient(135deg, @green-500 0%, @green-600 100%);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.35);
}

.stat-card--orange .stat-card__icon {
  background: linear-gradient(135deg, @orange-500 0%, @orange-600 100%);
  box-shadow: 0 6px 16px rgba(249, 115, 22, 0.35);
}

.stat-card__trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
}

.trend-up {
  color: @green-600;
  background: @green-50;
}

.trend-down {
  color: @red-500;
  background: @red-50;
}

.trend-stable {
  color: @slate-500;
  background: @slate-100;
}

.trend-arrow {
  font-size: 14px;
  line-height: 1;
}

.stat-card__value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 8px;
}

.value-number {
  font-size: 32px;
  font-weight: 700;
  color: @slate-900;
  line-height: 1.1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.value-unit {
  font-size: 14px;
  color: @slate-400;
  font-weight: 500;
}

.stat-card__bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-card__label {
  font-size: 13px;
  color: @slate-500;
  font-weight: 500;
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 18px;
  margin-bottom: 20px;
}

.chart-card,
.section-card,
.table-section {
  background: #ffffff;
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.04), 0 1px 2px rgba(16, 24, 40, 0.03);
  transition: box-shadow 0.3s ease;
  border: 1px solid rgba(226, 232, 240, 0.6);
  animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.chart-card:hover,
.section-card:hover,
.table-section:hover {
  box-shadow: 0 8px 24px -8px rgba(16, 24, 40, 0.12);
}

.chart-card:focus-visible,
.section-card:focus-visible,
.table-section:focus-visible {
  outline: 2px solid @indigo-500;
  outline-offset: 2px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-title__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
}

.card-title__icon--blue {
  background: linear-gradient(135deg, @indigo-500 0%, @indigo-600 100%);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.card-title__icon--purple {
  background: linear-gradient(135deg, @purple-500 0%, @purple-600 100%);
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
}

.card-title__icon--green {
  background: linear-gradient(135deg, @green-500 0%, @green-600 100%);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.card-title__icon--orange {
  background: linear-gradient(135deg, @orange-500 0%, @orange-600 100%);
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
}

.card-title__text h3 {
  margin: 0 0 2px 0;
  font-size: 15px;
  font-weight: 600;
  color: @slate-900;
  line-height: 1.3;
}

.card-title__text p {
  margin: 0;
  font-size: 12px;
  color: @slate-400;
  line-height: 1.4;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.source-count-tag {
  margin: 0;
}

.expand-btn {
  font-size: 12px;
}

.chart-toggle {
  font-size: 12px;
}

.chart-container {
  height: 280px;
  width: 100%;
}

.chart-container--pie {
  height: 260px;
}

.section-card--wide {
  grid-column: 1;
}

.section-card--narrow {
  grid-column: 2;
}

.source-tabs {
  margin-bottom: 20px;
}

.source-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.source-card {
  position: relative;
  border: 1px solid @slate-200;
  border-radius: 12px;
  padding: 16px;
  background: #fff;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  &.active {
    border-color: @indigo-500;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(168, 85, 247, 0.03) 100%);
  }

  &:hover {
    box-shadow: 0 8px 20px -8px rgba(99, 102, 241, 0.2);
    transform: translateY(-2px);
    border-color: transparent;
  }

  &:focus-visible {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }
}

.source-card__glow {
  position: absolute;
  top: -30%;
  right: -20%;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  opacity: 0;
  filter: blur(30px);
  transition: opacity 0.3s ease;
  pointer-events: none;
  background: @indigo-500;
}

.source-card:hover .source-card__glow {
  opacity: 0.08;
}

.source-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.source-name-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.source-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
  flex-shrink: 0;
  transition: transform 0.3s ease;

  &.site_profile {
    background: linear-gradient(135deg, @indigo-500 0%, @indigo-600 100%);
  }

  &.rule_expand {
    background: linear-gradient(135deg, @purple-500 0%, @purple-600 100%);
  }

  &.baidu_suggest {
    background: linear-gradient(135deg, @green-500 0%, @green-600 100%);
  }

  &.news {
    background: linear-gradient(135deg, @orange-500 0%, @orange-600 100%);
  }

  &.social_media {
    background: linear-gradient(135deg, @pink-500 0%, #ec4899 100%);
  }

  &.industry {
    background: linear-gradient(135deg, @cyan-500 0%, #0891b2 100%);
  }
}

.source-card:hover .source-icon {
  transform: scale(1.08) rotate(-5deg);
}

.source-name-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.source-name {
  font-weight: 600;
  color: @slate-900;
  font-size: 14px;
}

.source-status {
  display: flex;
  align-items: center;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;

  &.status-online {
    color: @green-600;
    background: @green-50;
    .status-dot { background: @green-500; }
  }

  &.status-limit {
    color: @orange-600;
    background: @orange-50;
    .status-dot { background: @orange-500; }
  }

  &.status-offline {
    color: @red-500;
    background: @red-50;
    .status-dot { background: @red-500; }
  }
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.source-desc {
  font-size: 12px;
  color: @slate-500;
  line-height: 1.6;
  margin-bottom: 12px;
}

.source-stats {
  display: flex;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid @slate-100;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 11px;
  color: @slate-400;
}

.stat-num {
  font-size: 14px;
  font-weight: 600;
  color: @slate-900;
  font-variant-numeric: tabular-nums;

  &--success {
    color: @green-600;
  }
}

.collect-action-card {
  display: flex;
  flex-direction: column;
}

.main-action-area {
  margin-bottom: 20px;
}

.btn-start-collect {
  height: 48px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 12px;
  background: linear-gradient(135deg, @indigo-500 0%, @purple-500 100%);
  border: none;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: linear-gradient(135deg, @indigo-600 0%, @purple-600 100%);
    box-shadow: 0 10px 28px rgba(99, 102, 241, 0.45);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }
}

.collect-progress {
  margin-top: 12px;
}

.progress-text {
  display: block;
  font-size: 12px;
  color: @slate-500;
  margin-top: 6px;
  text-align: center;
}

.action-section {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.action-section__title {
  font-size: 13px;
  font-weight: 600;
  color: @slate-600;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.action-btn {
  flex: 1;
  min-width: calc(50% - 4px);
  border-radius: 10px;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }

  &--distill {
    grid-column: 1 / -1;
  }
}

.table-section {
  margin-bottom: 0;
}

.table-count-tag {
  margin-left: 8px;
}

.table-toolbar {
  margin-bottom: 16px;
}

.keyword-table {
  :deep(.ant-table-thead > tr > th) {
    background: @slate-50;
    font-weight: 600;
    color: @slate-600;
    border-bottom: 1px solid @slate-200;
  }

  :deep(.ant-table-tbody > tr:hover > td) {
    background: @slate-50;
  }
}

.keyword-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.keyword-text {
  font-weight: 500;
  color: @slate-900;
}

.hot-tag {
  font-size: 11px;
  color: @red-500;
  background: @red-50;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 2px;
}

.priority-cell {
  display: flex;
  align-items: center;
}

.priority-text {
  font-size: 12px;
  color: @slate-600;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.quality-stars {
  display: flex;
  align-items: center;
  gap: 2px;
}

.star-filled {
  color: #f59e0b;
  font-size: 14px;
}

.star-empty {
  color: @slate-200;
  font-size: 14px;
}

.quality-text {
  margin-left: 6px;
  font-size: 12px;
  color: @slate-600;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.source-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1200px) {
  .stat-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .content-grid {
    grid-template-columns: 1fr;
  }

  .section-card--wide,
  .section-card--narrow {
    grid-column: 1;
  }

  .source-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .stat-cards {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .chart-container {
    height: 220px;
  }

  .action-btns {
    grid-template-columns: 1fr;
  }

  .action-btn--distill {
    grid-column: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
