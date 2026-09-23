<template>
  <div class="portal-analytics-page">
    <a-alert type="info" show-icon class="scope-note">
      <template #message>
        本页两块数字口径不同，不能相加：<b>人工浏览</b>来自门户前端埋点（只有真浏览器会执行那段脚本）；
        <b>抓取</b>由服务端按 User-Agent 识别，只能看到 /robots.txt、/sitemap.xml、/llms.txt、/llms-full.txt
        和门户公开接口
        ——门户页面本身由前端服务器返回，后端看不到抓页面的请求，所以它表示「抓了 SEO 文件 / 调了门户接口」，不是页面浏览量。
      </template>
    </a-alert>

    <a-form layout="inline" class="filter-bar">
      <a-form-item label="统计区间">
        <a-range-picker v-model:value="dateRange" :allow-clear="false" style="width: 260px" />
      </a-form-item>
      <a-form-item label="Top 页面">
        <a-select v-model:value="topSize" style="width: 110px" :options="TOP_OPTIONS" />
      </a-form-item>
      <a-form-item v-if="missingTenant" class="toolbar-fill">
        <a-tag color="orange">超管请先在右上角选择租户：统计没有跨租户的全局视图</a-tag>
      </a-form-item>
      <a-form-item v-else class="toolbar-fill" />
      <a-form-item class="toolbar-actions">
        <a-button type="primary" :loading="loading" @click="loadAll">刷新</a-button>
      </a-form-item>
    </a-form>

    <a-spin :spinning="loading">
      <a-card title="门户人工浏览（埋点）" :bordered="false" class="block-card">
        <template #extra>
          <span class="block-hint">数据来自访客浏览器上报，爬虫不执行脚本，不会计入这里</span>
        </template>
        <a-row :gutter="16">
          <a-col :span="6">
            <a-statistic title="页面浏览量 PV" :value="overview.pageviews" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="独立访客 UV（按天去重）" :value="overview.uniqueVisitors" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="平均停留时长" :value="avgDurationText" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="有时长上报的页面数" :value="overview.durationEvents" />
          </a-col>
        </a-row>
        <a-empty
          v-if="overview.empty"
          class="empty-hint"
          description="该区间没有采到埋点数据（不等于 0 次浏览）：请确认门户已被访问，且访客侧埋点脚本已随本次发布上线"
        />
        <a-table
          v-else
          class="inner-table"
          :columns="pageColumns"
          :data-source="pages.pages"
          :pagination="false"
          row-key="pageUrl"
          size="small"
          :scroll="{ x: 'max-content' }"
        />
      </a-card>

      <a-card title="AI 抓取与爬虫（服务端识别）" :bordered="false" class="block-card">
        <template #extra>
          <span class="block-hint">按 User-Agent 分类，词表在 bot-ua.yml，改配置即可增删爬虫</span>
        </template>
        <a-empty
          v-if="botSummary.empty"
          description="该区间服务端没有识别到爬虫抓取（SEO 文件与门户接口都没有机器人请求）"
        />
        <a-row v-else :gutter="16">
          <a-col v-for="slice in botSummary.slices" :key="slice.botCategory" :span="8">
            <a-card size="small" :title="botCategoryLabel(slice.botCategory)" class="slice-card">
              <a-statistic :value="slice.hits" suffix="次" />
              <ul class="top-list">
                <li v-for="item in slice.topPages" :key="item.pageUrl">
                  <span class="top-url">{{ item.pageUrl }}</span>
                  <span class="top-count">{{ item.count }} 次</span>
                </li>
              </ul>
            </a-card>
          </a-col>
        </a-row>
      </a-card>

      <a-card title="按天趋势" :bordered="false" class="block-card">
        <template #extra>
          <span class="block-hint">四条线分别对应两套采集口径，所以不做合计</span>
        </template>
        <div v-show="!trend.empty" ref="trendRef" class="trend-chart" />
        <a-empty v-if="trend.empty" class="empty-hint" description="该区间没有任何可绘制的数据" />
      </a-card>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import dayjs, { type Dayjs } from 'dayjs'
import { message } from 'ant-design-vue'
import { useAuthStore } from '../../stores/auth'
import { analyticsApi, botCategoryLabel, pageTypeLabel } from '../../api/analytics'
import type {
  AnalyticsBotSummary,
  AnalyticsOverview,
  AnalyticsPagesResult,
  AnalyticsTrendResult,
} from '../../api/analytics'

const authStore = useAuthStore()

const TOP_OPTIONS = [
  { label: '前 10', value: 10 },
  { label: '前 20', value: 20 },
  { label: '前 50', value: 50 },
]

const loading = ref(false)
const dateRange = ref<[Dayjs, Dayjs]>([
  dayjs().subtract(29, 'day'),
  dayjs(),
])
const topSize = ref(10)

const pageColumns = [
  { title: '页面', dataIndex: 'pageUrl', key: 'pageUrl' },
  { title: '类型', key: 'pageType', width: 120, customRender: ({ record }: any) => pageTypeLabel(record.pageType) },
  { title: '浏览量', dataIndex: 'count', key: 'count', width: 100 },
  { title: '独立访客', dataIndex: 'visitors', key: 'visitors', width: 110 },
]

const overview = ref<AnalyticsOverview>({
  tenantId: 0, from: '', to: '', pageviews: 0, uniqueVisitors: 0,
  durationEvents: 0, avgDurationMs: null, empty: true,
})
const pages = ref<AnalyticsPagesResult>({ from: '', to: '', pages: [], empty: true })
const botSummary = ref<AnalyticsBotSummary>({ from: '', to: '', slices: [], empty: true })
const trend = ref<AnalyticsTrendResult>({ from: '', to: '', points: [], empty: true })

const trendRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

const missingTenant = computed(
  () => authStore.isSuperAdmin && authStore.selectedTenantId === null,
)

const rangeParams = computed(() => ({
  tenantId: authStore.selectedTenantId ?? undefined,
  from: dateRange.value[0]?.format('YYYY-MM-DD'),
  to: dateRange.value[1]?.format('YYYY-MM-DD'),
}))

const avgDurationText = computed(() => {
  const value = overview.value.avgDurationMs
  if (!value) return '暂无时长上报'
  const seconds = Math.round(value / 1000)
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
})

async function loadAll(): Promise<void> {
  if (missingTenant.value) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const [overviewResult, pagesResult, botResult, trendResult] = await Promise.all([
      analyticsApi.overview(rangeParams.value),
      analyticsApi.pages({ ...rangeParams.value, limit: topSize.value }),
      analyticsApi.bot({ ...rangeParams.value, top: 5 }),
      analyticsApi.trend(rangeParams.value),
    ])
    overview.value = overviewResult
    pages.value = pagesResult
    botSummary.value = botResult
    trend.value = trendResult
    await nextTick()
    renderTrend()
  } catch (error: any) {
    message.error(error?.message || '门户访问统计加载失败')
  } finally {
    loading.value = false
  }
}

function renderTrend(): void {
  if (trend.value.empty || !trendRef.value) return
  if (!chart) {
    chart = echarts.init(trendRef.value)
  }
  const dates = trend.value.points.map((point) => point.date)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['人工浏览 PV', '独立访客', '服务端抓取', '其中 AI 抓取'] },
    grid: { left: 45, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '人工浏览 PV', type: 'line', smooth: true, data: trend.value.points.map((p) => p.pageviews) },
      { name: '独立访客', type: 'line', smooth: true, data: trend.value.points.map((p) => p.uniqueVisitors) },
      { name: '服务端抓取', type: 'line', smooth: true, data: trend.value.points.map((p) => p.botHits) },
      {
        name: '其中 AI 抓取',
        type: 'line',
        smooth: true,
        lineStyle: { type: 'dashed' },
        data: trend.value.points.map((p) => p.aiCrawlerHits),
      },
    ],
  })
}

function handleResize(): void {
  chart?.resize()
}

onMounted(() => {
  loadAll()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})

watch(dateRange, () => loadAll())
watch(topSize, () => loadAll())
watch(() => authStore.selectedTenantId, () => loadAll())
</script>

<style scoped>
.portal-analytics-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-bar {
  row-gap: 12px;
}

.toolbar-fill {
  flex: 1;
}

.toolbar-actions {
  margin-right: 0;
}

.block-card {
  margin-bottom: 16px;
}

.block-hint {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.inner-table {
  margin-top: 16px;
}

.empty-hint {
  margin-top: 16px;
}

.slice-card {
  margin-bottom: 16px;
}

.top-list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.top-list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  line-height: 22px;
}

.top-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.65);
}

.top-count {
  flex: none;
  color: rgba(0, 0, 0, 0.45);
}

.trend-chart {
  height: 280px;
}
</style>
