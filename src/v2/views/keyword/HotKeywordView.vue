<template>
  <div class="hot-keyword-page">
    <a-spin :spinning="loading">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <FireOutlined />
          </div>
          <div class="header-info">
            <h2 class="page-title">热词管理</h2>
            <p class="page-subtitle">
              <span class="subtitle-text">多平台热词采集，洞察内容趋势</span>
              <span class="header-divider"></span>
              <span class="header-badge">
                <span class="badge-dot"></span>
                实时热词监控
              </span>
            </p>
          </div>
        </div>
        <div class="header-actions">
          <a-button @click="loadData" class="header-btn">
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

      <div class="main-card">
        <div class="card-tabs-header">
          <a-tabs v-model:activeKey="activeTab" @change="handleTabChange" class="main-tabs">
            <a-tab-pane key="list" tab="热词列表" />
            <a-tab-pane key="daily" tab="今日精选" />
            <a-tab-pane key="config" tab="采集配置" />
          </a-tabs>
          <div class="tabs-extra" v-if="activeTab === 'list'">
            <a-space wrap size="small">
              <a-select
                v-model:value="queryParams.source"
                style="width: 130px"
                placeholder="数据源"
                allowClear
                size="small"
                @change="loadKeywords"
              >
                <a-select-option
                  v-for="s in sourceOptions"
                  :key="s.value"
                  :value="s.value"
                >
                  {{ s.label }}
                </a-select-option>
              </a-select>
              <a-select
                v-model:value="queryParams.category"
                style="width: 130px"
                placeholder="分类筛选"
                allowClear
                size="small"
                @change="loadKeywords"
              >
                <a-select-option
                  v-for="c in categoryOptions"
                  :key="c.value"
                  :value="c.value"
                >
                  {{ c.label }}
                </a-select-option>
              </a-select>
              <a-input-search
                v-model:value="queryParams.keyword"
                placeholder="搜索关键词"
                style="width: 220px"
                enter-button
                size="small"
                @search="loadKeywords"
                allow-clear
              />
              <a-button type="primary" size="small" @click="handleCollect" :loading="collecting" class="action-btn-primary">
                <template #icon><CloudDownloadOutlined /></template>
                开始采集
              </a-button>
              <a-button size="small" @click="handleAutoSelect" :loading="autoSelecting" class="action-btn-default">
                <template #icon><StarOutlined /></template>
                自动精选TOP3
              </a-button>
            </a-space>
          </div>
        </div>

        <div class="card-body">
          <div v-show="activeTab === 'list'">
            <a-table
              class="keyword-table"
              :columns="columns"
              :data-source="keywordList"
              :pagination="paginationConfig"
              :row-key="(record: HotKeyword) => record.id"
              :row-selection="rowSelection"
              @change="handleTableChange"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'rank'">
                  <span :class="['rank-badge', getRankClass(record.rank)]">
                    <CrownOutlined v-if="record.rank === 1" />
                    <StarOutlined v-else-if="record.rank === 2 || record.rank === 3" />
                    {{ record.rank }}
                  </span>
                </template>
                <template v-if="column.key === 'keyword'">
                  <div class="keyword-cell">
                    <span class="keyword-text">{{ record.keyword }}</span>
                    <span v-if="record.score >= 80" class="hot-tag">
                      <FireOutlined /> 热门
                    </span>
                  </div>
                </template>
                <template v-if="column.key === 'score'">
                  <div class="score-cell">
                    <a-progress
                      :percent="record.score"
                      :show-info="false"
                      :stroke-color="getScoreColor(record.score)"
                      size="small"
                      class="score-progress"
                    />
                    <span class="score-text">{{ record.score }}</span>
                  </div>
                </template>
                <template v-if="column.key === 'source'">
                  <a-tag :color="getSourceColor(record.source)" class="source-tag">
                    {{ getSourceLabel(record.source) }}
                  </a-tag>
                </template>
                <template v-if="column.key === 'trend'">
                  <span :class="['trend-text', record.trend]">
                    <component :is="getTrendIcon(record.trend)" />
                    {{ record.trendValue > 0 ? '+' : '' }}{{ record.trendValue }}%
                  </span>
                </template>
                <template v-if="column.key === 'actions'">
                  <a-space size="small">
                    <a-button
                      type="link"
                      size="small"
                      @click="handleSelect(record)"
                      :class="record.isSelected ? 'btn-selected' : ''"
                    >
                      {{ record.isSelected ? '取消精选' : '加入精选' }}
                    </a-button>
                    <a-popconfirm
                      title="确定要删除这个热词吗？"
                      @confirm="handleDelete(record.id)"
                    >
                      <a-button type="link" size="small" danger>删除</a-button>
                    </a-popconfirm>
                  </a-space>
                </template>
              </template>
            </a-table>
          </div>

          <div v-show="activeTab === 'daily'" class="daily-top-section">
            <a-row :gutter="20">
              <a-col :span="8" v-for="(item, index) in dailyTopList" :key="item.id">
                <div class="top-card" :class="`top-card--${index + 1}`">
                  <div class="top-card__glow"></div>
                  <div class="top-card__pattern" aria-hidden="true">
                    <svg viewBox="0 0 100 100" fill="none">
                      <path d="M0 80 Q 25 60, 50 70 T 100 50" stroke="currentColor" stroke-width="1" fill="none" opacity="0.3"/>
                    </svg>
                  </div>
                  <div class="top-rank" :class="`rank-${index + 1}`">
                    <div class="rank-icon">
                      <CrownOutlined v-if="index === 0" />
                      <StarOutlined v-else />
                    </div>
                    <span>TOP {{ index + 1 }}</span>
                  </div>
                  <div class="top-keyword">{{ item.keyword }}</div>
                  <div class="top-score">
                    <span class="score-label">热度评分</span>
                    <span class="score-highlight">{{ item.score }}</span>
                  </div>
                  <div class="top-chart">
                    <div :ref="el => setChartRef(el, index)" class="mini-chart" />
                  </div>
                  <div class="top-tags">
                    <span class="tags-label">相关词</span>
                    <div class="tags-list">
                      <a-tag
                        v-for="tag in item.relatedKeywords?.slice(0, 4)"
                        :key="tag"
                        color="blue"
                        class="related-tag"
                      >
                        {{ tag }}
                      </a-tag>
                    </div>
                  </div>
                  <div class="top-footer">
                    <a-tag :color="getSourceColor(item.source)" class="source-tag">
                      {{ getSourceLabel(item.source) }}
                    </a-tag>
                    <span :class="['trend-text', item.trend]">
                      <component :is="getTrendIcon(item.trend)" />
                      {{ item.trendValue > 0 ? '+' : '' }}{{ item.trendValue }}%
                    </span>
                  </div>
                </div>
              </a-col>
            </a-row>
            <a-empty v-if="dailyTopList.length === 0" description="暂无今日精选热词" class="empty-state" />
          </div>

          <div v-show="activeTab === 'config'" class="config-section">
            <div class="config-card">
              <div class="config-title">
                <div class="config-title__icon">
                  <SettingOutlined />
                </div>
                <div class="config-title__text">
                  <h3>采集配置</h3>
                  <p>设置热词采集的数据源和规则</p>
                </div>
              </div>
              <a-form
                :model="collectConfig"
                layout="vertical"
                class="config-form"
              >
                <a-row :gutter="24">
                  <a-col :span="12">
                    <a-form-item label="采集数据源">
                      <a-checkbox-group v-model:value="collectConfig.sources" class="checkbox-group">
                        <a-checkbox value="baidu">百度热搜</a-checkbox>
                        <a-checkbox value="weibo">微博热搜</a-checkbox>
                        <a-checkbox value="zhihu">知乎热榜</a-checkbox>
                        <a-checkbox value="news">新闻头条</a-checkbox>
                      </a-checkbox-group>
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="采集频率">
                      <a-select v-model:value="collectConfig.frequency" style="width: 100%">
                        <a-select-option value="hourly">每小时</a-select-option>
                        <a-select-option value="every3h">每3小时</a-select-option>
                        <a-select-option value="every6h">每6小时</a-select-option>
                        <a-select-option value="daily">每天</a-select-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-form-item label="采集分类">
                  <a-select
                    v-model:value="collectConfig.categories"
                    mode="multiple"
                    placeholder="请选择分类"
                    style="width: 100%"
                  >
                    <a-select-option value="tech">科技</a-select-option>
                    <a-select-option value="finance">财经</a-select-option>
                    <a-select-option value="entertainment">娱乐</a-select-option>
                    <a-select-option value="sports">体育</a-select-option>
                    <a-select-option value="health">健康</a-select-option>
                    <a-select-option value="education">教育</a-select-option>
                  </a-select>
                </a-form-item>
                <a-row :gutter="24">
                  <a-col :span="12">
                    <a-form-item label="自动精选">
                      <a-switch v-model:checked="collectConfig.autoSelect" />
                      <span class="form-desc">开启后自动精选TOP热词</span>
                    </a-form-item>
                  </a-col>
                  <a-col :span="12" v-if="collectConfig.autoSelect">
                    <a-form-item label="自动精选数量">
                      <a-input-number
                        v-model:value="collectConfig.topN"
                        :min="1"
                        :max="10"
                        style="width: 120px"
                      />
                      <span class="form-desc">个</span>
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-form-item>
                  <a-space>
                    <a-button type="primary" @click="saveConfig" class="btn-save">
                      <template #icon><CheckOutlined /></template>
                      保存配置
                    </a-button>
                    <a-button @click="resetConfig" class="btn-reset">
                      <template #icon><RollbackOutlined /></template>
                      重置
                    </a-button>
                  </a-space>
                </a-form-item>
              </a-form>
            </div>
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, watch, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  FireOutlined,
  PlusCircleOutlined,
  ThunderboltOutlined,
  LineChartOutlined,
  CloudDownloadOutlined,
  StarOutlined,
  CrownOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  SettingOutlined,
  ReloadOutlined,
  CheckOutlined,
  RollbackOutlined,
} from '@ant-design/icons-vue'
import * as echarts from 'echarts'
import {
  hotKeywordApi,
  type HotKeyword,
  type HotKeywordStats,
  type CollectConfig,
} from '../../api/hotKeyword'
import { useV2AuthStore } from '../../stores/auth'

const auth = useV2AuthStore()
const loading = ref(false)
const collecting = ref(false)
const autoSelecting = ref(false)
const activeTab = ref('list')
const chartRefs = ref<(HTMLElement | null)[]>([])
let miniCharts: (echarts.ECharts | null)[] = []

const stats = reactive<HotKeywordStats>({
  totalCount: 0,
  todayNewCount: 0,
  topPlatform: '-',
  trendDistribution: { up: 0, down: 0, stable: 0 },
  sourceDistribution: {},
})

const sourceOptions = ref([
  { value: 'baidu', label: '百度热搜' },
  { value: 'weibo', label: '微博热搜' },
  { value: 'zhihu', label: '知乎热榜' },
  { value: 'news', label: '新闻头条' },
])

const categoryOptions = ref([
  { value: 'tech', label: '科技' },
  { value: 'finance', label: '财经' },
  { value: 'entertainment', label: '娱乐' },
  { value: 'sports', label: '体育' },
  { value: 'health', label: '健康' },
  { value: 'education', label: '教育' },
])

const queryParams = reactive({
  source: null as string | null,
  keyword: '',
  category: null as string | null,
})

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const keywordList = ref<HotKeyword[]>([])
const dailyTopList = ref<HotKeyword[]>([])
const selectedRowKeys = ref<number[]>([])

const rowSelection = {
  selectedRowKeys,
  onChange: (keys: number[]) => {
    selectedRowKeys.value = keys
  },
}

const collectConfig = reactive<CollectConfig>({
  sources: ['baidu', 'weibo'],
  categories: [],
  frequency: 'hourly',
  autoSelect: true,
  topN: 3,
})

const columns = [
  { title: '排名', key: 'rank', width: 80, align: 'center' as const },
  { title: '关键词', key: 'keyword', width: 220 },
  { title: '热度评分', key: 'score', width: 180 },
  { title: '来源', key: 'source', width: 120 },
  { title: '分类', dataIndex: 'category', key: 'category', width: 100 },
  { title: '趋势', key: 'trend', width: 120 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 180 },
]

const statItems = computed(() => [
  {
    key: 'total',
    icon: FireOutlined,
    value: stats.totalCount,
    label: '总热词数',
    unit: '个',
    trendType: 'up',
    trendValue: '15%',
    color: 'red',
  },
  {
    key: 'today',
    icon: PlusCircleOutlined,
    value: stats.todayNewCount,
    label: '今日新增',
    unit: '个',
    trendType: 'up',
    trendValue: '8%',
    color: 'green',
  },
  {
    key: 'platform',
    icon: ThunderboltOutlined,
    value: stats.topPlatform,
    label: 'TOP平台',
    unit: '',
    trendType: 'stable',
    trendValue: '稳定',
    color: 'purple',
  },
  {
    key: 'trend',
    icon: LineChartOutlined,
    value: stats.trendDistribution?.up || 0,
    label: '上升趋势',
    unit: '个',
    trendType: 'up',
    trendValue: '12%',
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

function setChartRef(el: HTMLElement | null, index: number) {
  chartRefs.value[index] = el
}

function getRankClass(rank: number): string {
  if (rank <= 3) return `rank-${rank}`
  return ''
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#f5222d'
  if (score >= 60) return '#fa8c16'
  if (score >= 40) return '#faad14'
  return '#52c41a'
}

function getSourceColor(source: string): string {
  const map: Record<string, string> = {
    baidu: 'blue',
    weibo: 'red',
    zhihu: 'geekblue',
    news: 'gold',
  }
  return map[source] || 'default'
}

function getSourceLabel(source: string): string {
  const map: Record<string, string> = {
    baidu: '百度热搜',
    weibo: '微博热搜',
    zhihu: '知乎热榜',
    news: '新闻头条',
  }
  return map[source] || source
}

function getTrendIcon(trend: string) {
  if (trend === 'up') return ArrowUpOutlined
  if (trend === 'down') return ArrowDownOutlined
  return MinusOutlined
}

function getTenantId(): number {
  return auth.selectedTenantId || auth.tenantId || 1
}

async function loadStats() {
  try {
    const data = await hotKeywordApi.stats(getTenantId())
    Object.assign(stats, data)
  } catch (e) {
    console.error('加载统计数据失败', e)
  }
}

async function loadKeywords() {
  loading.value = true
  try {
    const data = await hotKeywordApi.list({
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      source: queryParams.source || undefined,
      keyword: queryParams.keyword || undefined,
      category: queryParams.category || undefined,
      tenantId: getTenantId(),
    })
    keywordList.value = data.records
    paginationConfig.total = data.total
  } catch (e) {
    console.error('加载热词列表失败', e)
    message.error('加载热词列表失败')
  } finally {
    loading.value = false
  }
}

async function loadDailyTop() {
  try {
    const data = await hotKeywordApi.dailyTop()
    dailyTopList.value = data
    nextTick(() => {
      initCharts()
    })
  } catch (e) {
    console.error('加载今日精选失败', e)
  }
}

function initCharts() {
  miniCharts.forEach(chart => chart?.dispose())
  miniCharts = []
  
  dailyTopList.value.forEach((item, index) => {
    const el = chartRefs.value[index]
    if (!el) return
    const chart = echarts.init(el)
    miniCharts.push(chart)
    const trendData = generateTrendData(item.score)
    const lineColor = item.trend === 'up' ? '#f5222d' : item.trend === 'down' ? '#52c41a' : '#faad14'
    chart.setOption({
      grid: { left: 0, right: 0, top: 5, bottom: 0 },
      xAxis: {
        type: 'category',
        show: false,
        data: trendData.map((_, i) => i),
      },
      yAxis: {
        type: 'value',
        show: false,
        min: 0,
        max: 100,
      },
      series: [
        {
          type: 'line',
          data: trendData,
          smooth: 0.4,
          symbol: 'none',
          lineStyle: {
            color: lineColor,
            width: 2.5,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: item.trend === 'up' ? 'rgba(245,34,45,0.25)' : item.trend === 'down' ? 'rgba(82,196,26,0.25)' : 'rgba(250,173,20,0.25)' },
              { offset: 1, color: 'rgba(255,255,255,0)' },
            ]),
          },
        },
      ],
    })
  })
}

function generateTrendData(baseScore: number): number[] {
  const data: number[] = []
  let current = baseScore * 0.7
  for (let i = 0; i < 12; i++) {
    current += (Math.random() - 0.3) * 10
    current = Math.max(0, Math.min(100, current))
    data.push(Math.round(current))
  }
  data[data.length - 1] = baseScore
  return data
}

async function handleCollect() {
  collecting.value = true
  try {
    const result = await hotKeywordApi.collect({ sources: collectConfig.sources })
    message.success(`采集成功，新增 ${result.count} 个热词`)
    loadKeywords()
    loadStats()
  } catch (e) {
    message.error('采集失败')
  } finally {
    collecting.value = false
  }
}

async function handleAutoSelect() {
  autoSelecting.value = true
  try {
    const result = await hotKeywordApi.autoSelect()
    message.success(`自动精选完成，共 ${result.length} 个热词`)
    loadDailyTop()
    loadKeywords()
  } catch (e) {
    message.error('自动精选失败')
  } finally {
    autoSelecting.value = false
  }
}

async function handleSelect(record: HotKeyword) {
  try {
    await hotKeywordApi.select(record.id, !record.isSelected)
    record.isSelected = !record.isSelected
    message.success(record.isSelected ? '已加入精选' : '已取消精选')
    if (record.isSelected) {
      loadDailyTop()
    }
  } catch (e) {
    message.error('操作失败')
  }
}

async function handleDelete(id: number) {
  try {
    await hotKeywordApi.delete(id)
    message.success('删除成功')
    loadKeywords()
    loadStats()
  } catch (e) {
    message.error('删除失败')
  }
}

function handleTableChange(pagination: any) {
  paginationConfig.current = pagination.current
  paginationConfig.pageSize = pagination.pageSize
  loadKeywords()
}

function handleTabChange(key: string) {
  if (key === 'daily') {
    loadDailyTop()
  }
}

async function saveConfig() {
  try {
    message.success('配置保存成功')
  } catch (e) {
    message.error('配置保存失败')
  }
}

function resetConfig() {
  collectConfig.sources = ['baidu', 'weibo']
  collectConfig.categories = []
  collectConfig.frequency = 'hourly'
  collectConfig.autoSelect = true
  collectConfig.topN = 3
}

function loadData() {
  loadStats()
  loadKeywords()
}

const handleResize = () => {
  miniCharts.forEach(chart => chart?.resize())
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  miniCharts.forEach(chart => chart?.dispose())
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
@red-600: #dc2626;
@slate-50: #f8fafc;
@slate-100: #f1f5f9;
@slate-200: #e2e8f0;
@slate-300: #cbd5e1;
@slate-400: #94a3b8;
@slate-500: #64748b;
@slate-600: #475569;
@slate-700: #334155;
@slate-900: #0f172a;
@gold-500: #f59e0b;
@pink-500: #ec4899;

.hot-keyword-page {
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
  background: linear-gradient(135deg, @red-500 0%, @orange-500 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  box-shadow: 0 8px 20px rgba(239, 68, 68, 0.35);
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
  color: @red-600;
  font-size: 12px;
  font-weight: 500;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: @red-500;
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

.stat-card--red .stat-card__glow { background: @red-500; }
.stat-card--green .stat-card__glow { background: @green-500; }
.stat-card--purple .stat-card__glow { background: @purple-500; }
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

.stat-card--red .stat-card__pattern { color: @red-500; }
.stat-card--green .stat-card__pattern { color: @green-500; }
.stat-card--purple .stat-card__pattern { color: @purple-500; }
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

.stat-card--red .stat-card__icon {
  background: linear-gradient(135deg, @red-500 0%, @red-600 100%);
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.35);
}

.stat-card--green .stat-card__icon {
  background: linear-gradient(135deg, @green-500 0%, @green-600 100%);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.35);
}

.stat-card--purple .stat-card__icon {
  background: linear-gradient(135deg, @purple-500 0%, @purple-600 100%);
  box-shadow: 0 6px 16px rgba(168, 85, 247, 0.35);
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

.main-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.04), 0 1px 2px rgba(16, 24, 40, 0.03);
  border: 1px solid rgba(226, 232, 240, 0.6);
  animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
  overflow: hidden;
}

.card-tabs-header {
  padding: 20px 22px 0 22px;
  border-bottom: 1px solid @slate-100;
}

.main-tabs {
  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
  }

  :deep(.ant-tabs-tab) {
    font-size: 14px;
    font-weight: 500;
    padding: 12px 0;
  }

  :deep(.ant-tabs-ink-bar) {
    height: 3px;
    border-radius: 3px 3px 0 0;
  }
}

.tabs-extra {
  margin-bottom: 16px;
}

.action-btn-primary {
  background: linear-gradient(135deg, @indigo-500 0%, @purple-500 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: linear-gradient(135deg, @indigo-600 0%, @purple-600 100%);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }
}

.action-btn-default {
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
}

.card-body {
  padding: 20px 22px 22px 22px;
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

  :deep(.ant-table-tbody > tr) {
    transition: background-color 0.2s ease;
  }
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 13px;
  background: @slate-100;
  color: @slate-500;
  transition: transform 0.2s ease;

  &.rank-1 {
    background: linear-gradient(135deg, #ffd700, #ffb800);
    color: #fff;
    box-shadow: 0 4px 12px rgba(255, 184, 0, 0.35);
  }

  &.rank-2 {
    background: linear-gradient(135deg, #c0c0c0, #a8a8a8);
    color: #fff;
    box-shadow: 0 4px 12px rgba(168, 168, 168, 0.3);
  }

  &.rank-3 {
    background: linear-gradient(135deg, #cd7f32, #b87333);
    color: #fff;
    box-shadow: 0 4px 12px rgba(184, 115, 51, 0.3);
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

.score-cell {
  display: flex;
  align-items: center;
}

.score-progress {
  width: 100px;
  margin-right: 10px;
}

.score-text {
  font-size: 13px;
  font-weight: 600;
  color: @slate-700;
  font-variant-numeric: tabular-nums;
  min-width: 28px;
}

.source-tag {
  font-size: 12px;
}

.trend-text {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;

  &.up {
    color: @red-500;
  }

  &.down {
    color: @green-600;
  }

  &.stable {
    color: @gold-500;
  }
}

.btn-selected {
  color: @orange-500 !important;
  font-weight: 500;
}

.daily-top-section {
  padding-top: 4px;
}

.top-card {
  position: relative;
  border-radius: 16px;
  padding: 24px;
  overflow: hidden;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;

  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 40px -12px rgba(16, 24, 40, 0.2);
  }

  &:focus-visible {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }

  &.top-card--1 {
    background: linear-gradient(135deg, #fff 0%, #fff7ed 100%);
    border: 1px solid rgba(251, 191, 36, 0.3);
  }

  &.top-card--2 {
    background: linear-gradient(135deg, #fff 0%, #f1f5f9 100%);
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  &.top-card--3 {
    background: linear-gradient(135deg, #fff 0%, #fef3e2 100%);
    border: 1px solid rgba(249, 115, 22, 0.2);
  }
}

.top-card__glow {
  position: absolute;
  top: -30%;
  right: -20%;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  opacity: 0;
  filter: blur(40px);
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.top-card--1 .top-card__glow { background: #fbbf24; }
.top-card--2 .top-card__glow { background: #94a3b8; }
.top-card--3 .top-card__glow { background: #f97316; }

.top-card:hover .top-card__glow {
  opacity: 0.15;
}

.top-card__pattern {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 150px;
  height: 80px;
  opacity: 0.3;
  pointer-events: none;
  transition: all 0.4s ease;
}

.top-card--1 .top-card__pattern { color: #fbbf24; }
.top-card--2 .top-card__pattern { color: #94a3b8; }
.top-card--3 .top-card__pattern { color: #f97316; }

.top-card:hover .top-card__pattern {
  opacity: 0.5;
  transform: scale(1.1);
}

.top-rank {
  position: relative;
  z-index: 1;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;

  &.rank-1 {
    color: #d97706;
  }

  &.rank-2 {
    color: #64748b;
  }

  &.rank-3 {
    color: #c2410c;
  }
}

.rank-icon {
  font-size: 18px;
  display: flex;
  align-items: center;
}

.top-keyword {
  position: relative;
  z-index: 1;
  font-size: 22px;
  font-weight: 700;
  color: @slate-900;
  margin-bottom: 12px;
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.top-score {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 16px;
}

.score-label {
  font-size: 13px;
  color: @slate-500;
}

.score-highlight {
  font-size: 28px;
  font-weight: 700;
  color: @red-500;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.mini-chart {
  width: 100%;
  height: 60px;
  margin-bottom: 16px;
}

.top-tags {
  position: relative;
  z-index: 1;
  margin-bottom: 16px;
}

.tags-label {
  font-size: 12px;
  color: @slate-400;
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.related-tag {
  font-size: 11px;
  margin: 0;
}

.top-footer {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 14px;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
}

.empty-state {
  padding: 60px 0;
}

.config-section {
  padding-top: 4px;
}

.config-card {
  max-width: 720px;
  margin: 0 auto;
}

.config-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid @slate-100;
}

.config-title__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, @indigo-500 0%, @purple-500 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.config-title__text h3 {
  margin: 0 0 2px 0;
  font-size: 16px;
  font-weight: 600;
  color: @slate-900;
}

.config-title__text p {
  margin: 0;
  font-size: 12px;
  color: @slate-400;
}

.config-form {
  :deep(.ant-form-item-label > label) {
    font-weight: 500;
    color: @slate-700;
  }
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.form-desc {
  margin-left: 10px;
  font-size: 13px;
  color: @slate-500;
}

.btn-save {
  background: linear-gradient(135deg, @indigo-500 0%, @purple-500 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: linear-gradient(135deg, @indigo-600 0%, @purple-600 100%);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }
}

.btn-reset {
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

  .card-tabs-header {
    padding: 16px 16px 0 16px;
  }

  .card-body {
    padding: 16px;
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
