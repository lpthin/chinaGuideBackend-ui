<template>
  <div class="dashboard">
    <div class="page-header">
      <div class="header-content">
        <div class="header-avatar">
          <UserOutlined />
        </div>
        <div class="header-info">
          <h2 class="greeting">
            {{ greetingText }}，管理员
          </h2>
          <p class="subtitle">
            <span class="date-text">{{ currentDate }}</span>
          </p>
        </div>
      </div>
      <div class="header-actions">
        <a-button @click="refreshAll" class="refresh-btn" :loading="headerLoading">
          <template #icon><ReloadOutlined /></template>
          刷新数据
        </a-button>
      </div>
    </div>

    <!-- Q2a：平台档不调任何租户效果口，整页引导 -->
    <div v-if="isPlatformMode" class="platform-guide">
      <div class="guide-icon"><GlobalOutlined /></div>
      <h3>工作台是租户视角的效果首页</h3>
      <p>这里展示的是某一家站点的被 AI 引用、搜索引擎抓取、今日访问与 GEO/SEO 状态；平台档没有「这一家站」的口径。</p>
      <p class="guide-hint">请在顶栏切换到一家租户后再看。</p>
    </div>

    <template v-else>
      <!-- 主视觉：访问趋势（浏览量 + 搜索/AI 爬虫命中），窗口 KPI 直接嵌在头部 -->
      <section class="hero-card">
        <div class="hero-head">
          <div class="hero-title">
            <div class="hero-badge"><RiseOutlined /></div>
            <div>
              <h3>访问趋势</h3>
              <p v-if="trendCard.data" class="hero-range">{{ trendCard.data.from }} ~ {{ trendCard.data.to }}</p>
            </div>
          </div>
          <div class="hero-metrics">
            <div class="hm"><b>{{ fmt(pvToday) }}</b><span>今日浏览</span></div>
            <div class="hm"><b>{{ fmt(pvWindow) }}</b><span>近 {{ trendDays }} 天浏览</span></div>
            <div class="hm hm--amber"><b>{{ fmt(botWindow) }}</b><span>搜索爬虫命中</span></div>
            <div class="hm hm--violet"><b>{{ fmt(aiWindow) }}</b><span>AI 爬虫命中</span></div>
          </div>
          <div class="hero-tools">
            <a-radio-group v-model:value="trendDays" size="small" button-style="solid" class="chart-toggle">
              <a-radio-button :value="7">7天</a-radio-button>
              <a-radio-button :value="30">30天</a-radio-button>
              <a-radio-button :value="180">半年</a-radio-button>
            </a-radio-group>
            <a-tooltip>
              <template #title>
                PV/UV 来自门户前端埋点；bot/AI 抓取来自服务端 User-Agent 识别，两类口径不可相加
              </template>
              <span class="note-dot"><InfoCircleOutlined /></span>
            </a-tooltip>
          </div>
        </div>
        <div class="hero-body">
          <div v-if="trendCard.loading && !trendCard.data" class="hero-state">加载中…</div>
          <div v-else-if="trendCard.denied" class="hero-state hero-state--denied">当前账号没有访问趋势的查看权限</div>
          <div v-else-if="trendCard.error" class="hero-state hero-state--error" :title="trendCard.error">趋势读取失败</div>
          <template v-else>
            <div ref="trendChartRef" class="hero-chart"></div>
            <div v-if="trendCard.data && trendCard.data.empty" class="hero-empty">
              近 {{ trendDays }} 天没有采集到访问数据
            </div>
          </template>
        </div>
      </section>

      <!-- 效果五块：数字优先，口径长句收进 ⓘ 悬浮 -->
      <section class="stat-row">
        <div
          class="stat-tile stat-tile--citation"
          style="--tile-color: #4f46e5; --tile-soft: rgba(79, 70, 229, 0.1)"
          :style="{ animationDelay: '0.04s' }"
          @click="goto('workspace-portal-citations')"
        >
          <div class="st-head">
            <span class="st-icon"><RobotOutlined /></span>
            <span class="st-label">被 AI 引用</span>
            <a-tooltip v-if="citation.data">
              <template #title>
                <span>数据来自平台引用探测轮次（非全站埋点）<template v-if="citation.data.summary && citation.data.summary.probeCount > 0 && citation.data.summary.lastProbedAt">，截至 {{ formatDateTime(citation.data.summary.lastProbedAt) }}</template></span>
                <br v-if="citation.data.notice" />
                <span v-if="citation.data.notice">{{ citation.data.notice }}</span>
                <br v-if="citation.data.summary && citation.data.summary.lastProbeNotice" />
                <span v-if="citation.data.summary && citation.data.summary.lastProbeNotice">{{ citation.data.summary.lastProbeNotice }}</span>
              </template>
              <span class="st-note" @click.stop><InfoCircleOutlined /></span>
            </a-tooltip>
          </div>
          <div v-if="citation.loading && !citation.data" class="st-state">加载中…</div>
          <div v-else-if="citation.denied" class="st-state st-state--denied">没有查看权限</div>
          <div v-else-if="citation.error" class="st-state st-state--error" :title="citation.error">读取失败</div>
          <template v-else-if="citation.data">
            <template v-if="citation.data.summary">
              <div v-if="citation.data.summary.probeCount > 0" class="st-value">
                <span class="st-num">{{ formatMoney(citation.data.summary.citedCallCount) }}</span>
                <span class="st-unit">次</span>
              </div>
              <div v-else class="st-value"><span class="st-plain">未探测</span></div>
              <div class="st-sub" v-if="citation.data.summary.probeCount > 0">
                探测 {{ citation.data.summary.probeCount }} 轮 · 对象 {{ citation.data.summary.citedTargets }}/{{ citation.data.summary.totalTargets }}
              </div>
              <div class="st-sub" v-else>还没发起过任何一轮引用探测</div>
            </template>
            <div v-else class="st-value">
              <span class="st-plain">{{ citation.data.notice || '当前租户还没有可统计的站点' }}</span>
            </div>
          </template>
        </div>

        <div
          class="stat-tile stat-tile--bot"
          style="--tile-color: #0ea5e9; --tile-soft: rgba(14, 165, 233, 0.1)"
          :style="{ animationDelay: '0.1s' }"
          @click="goto('workspace-portal-analytics')"
        >
          <div class="st-head">
            <span class="st-icon"><GlobalOutlined /></span>
            <span class="st-label">搜索引擎收录抓取</span>
            <a-tooltip>
              <template #title>服务端按 User-Agent 识别的抓取命中，不是页面浏览量，也不是搜索排名</template>
              <span class="st-note" @click.stop><InfoCircleOutlined /></span>
            </a-tooltip>
          </div>
          <div v-if="botCard.loading && !botCard.data" class="st-state">加载中…</div>
          <div v-else-if="botCard.denied" class="st-state st-state--denied">没有查看权限</div>
          <div v-else-if="botCard.error" class="st-state st-state--error" :title="botCard.error">读取失败</div>
          <template v-else-if="botCard.data">
            <div class="st-value">
              <span class="st-num">{{ formatMoney(searchEngineHits) }}</span>
              <span class="st-unit">次</span>
            </div>
            <div class="st-sub">近 30 天命中</div>
          </template>
        </div>

        <div
          class="stat-tile stat-tile--today"
          style="--tile-color: #10b981; --tile-soft: rgba(16, 185, 129, 0.1)"
          :style="{ animationDelay: '0.16s' }"
          @click="goto('workspace-portal-analytics')"
        >
          <div class="st-head">
            <span class="st-icon"><EyeOutlined /></span>
            <span class="st-label">今日访问</span>
            <i class="live-dot" title="每分钟自动刷新"></i>
            <a-tooltip v-if="todayCard.data">
              <template #title>门户前端埋点 · 今日 {{ todayCard.data.from }} · 每分钟自动刷新</template>
              <span class="st-note" @click.stop><InfoCircleOutlined /></span>
            </a-tooltip>
          </div>
          <div v-if="todayCard.loading && !todayCard.data" class="st-state">加载中…</div>
          <div v-else-if="todayCard.denied" class="st-state st-state--denied">没有查看权限</div>
          <div v-else-if="todayCard.error" class="st-state st-state--error" :title="todayCard.error">读取失败</div>
          <template v-else-if="todayCard.data">
            <template v-if="!todayCard.data.empty">
              <div class="st-value">
                <span class="st-num">{{ formatMoney(todayCard.data.pageviews) }}</span>
                <span class="st-unit">次浏览</span>
              </div>
              <div class="st-sub">独立访客 {{ formatMoney(todayCard.data.uniqueVisitors) }}</div>
            </template>
            <div v-else class="st-value"><span class="st-plain">今日暂未采集到浏览</span></div>
          </template>
        </div>

        <div
          class="stat-tile stat-tile--geo"
          style="--tile-color: #f59e0b; --tile-soft: rgba(245, 158, 11, 0.12)"
          :style="{ animationDelay: '0.22s' }"
          @click="goto('workspace-geo-diagnostic', { tab: 'campaign' })"
        >
          <div class="st-head">
            <span class="st-icon"><ThunderboltOutlined /></span>
            <span class="st-label">GEO 诊断</span>
            <a-tooltip v-if="geoCard.data && geoCard.data.report">
              <template #title>截至轮次完成时刻 {{ formatDateTime(geoCard.data.report.generatedAt) }}；比率明细在报告页</template>
              <span class="st-note" @click.stop><InfoCircleOutlined /></span>
            </a-tooltip>
          </div>
          <div v-if="geoCard.loading && !geoCard.data" class="st-state">加载中…</div>
          <div v-else-if="geoCard.denied" class="st-state st-state--denied">没有查看权限</div>
          <div v-else-if="geoCard.error" class="st-state st-state--error" :title="geoCard.error">读取失败</div>
          <template v-else-if="geoCard.data">
            <template v-if="geoCard.data.report">
              <div class="st-value">
                <span class="st-num">#{{ geoCard.data.runId }}</span>
              </div>
              <div class="st-sub">
                提问 {{ geoCard.data.report.callCount }} 次 · 失败 {{ geoCard.data.report.failedCallCount }}
                <a class="inline-link" @click.stop="goto('workspace-geo-campaign-report', { runId: String(geoCard.data.runId) })">看报告 →</a>
              </div>
            </template>
            <template v-else>
              <div class="st-value"><span class="st-plain">{{ geoCard.data.notice || '还没有跑完过 GEO 诊断' }}</span></div>
              <div class="st-sub">
                <a class="inline-link" @click.stop="goto('workspace-geo-diagnostic', { tab: 'campaign' })">去跑一轮 →</a>
              </div>
            </template>
          </template>
        </div>

        <div
          class="stat-tile stat-tile--seo"
          style="--tile-color: #8b5cf6; --tile-soft: rgba(139, 92, 246, 0.1)"
          :style="{ animationDelay: '0.28s' }"
          @click="goto('workspace-geoseo-crawlability')"
        >
          <div class="st-head">
            <span class="st-icon"><SafetyCertificateOutlined /></span>
            <span class="st-label">SEO 体检</span>
            <a-tooltip v-if="seoCard.data && !seoCard.data.neverRun">
              <template #title>体检于 {{ formatDateTime(seoCard.data.measuredAt) }}；六项判据明细在体检页</template>
              <span class="st-note" @click.stop><InfoCircleOutlined /></span>
            </a-tooltip>
          </div>
          <div v-if="seoCard.loading && !seoCard.data" class="st-state">加载中…</div>
          <div v-else-if="seoCard.denied" class="st-state st-state--denied">没有查看权限</div>
          <div v-else-if="seoCard.error" class="st-state st-state--error" :title="seoCard.error">读取失败</div>
          <template v-else-if="seoCard.data">
            <div v-if="seoCard.data.neverRun" class="st-value">
              <span class="st-plain">没跑过体检</span>
            </div>
            <template v-else>
              <div class="st-value">
                <span class="st-num">{{ seoPass }}</span>
                <span class="st-unit">/ {{ seoCard.data.items.length }} 项通过</span>
              </div>
              <div class="seo-dots">
                <i
                  v-for="item in seoCard.data.items"
                  :key="item.checkKey"
                  class="seo-dot"
                  :class="`seo-dot--${(item.verdict || 'NOT_MEASURED').toLowerCase()}`"
                  :title="`${item.label || item.checkKey}：${item.verdictLabel || item.verdict}`"
                ></i>
              </div>
            </template>
          </template>
        </div>
      </section>

      <!-- 生产量一行 + 待办 -->
      <section class="bottom-row">
        <div class="prod-bar">
          <button class="pb-seg" @click="goto('workspace-keywords')">
            <span class="pb-num">{{ kwCard.data ? formatMoney(kwCard.data.total) : '—' }}</span>
            <span class="pb-label">关键词库</span>
            <span class="pb-sub" v-if="kwCard.data">已成文 {{ kwCard.data.stage_articled }}</span>
          </button>
          <button class="pb-seg" @click="goto('workspace-articles')">
            <span class="pb-num">{{ statsCard.data ? formatMoney(statsCard.data.totalArticles) : '—' }}</span>
            <span class="pb-label">篇文章</span>
            <span class="pb-sub" v-if="statsCard.data">今日 {{ statsCard.data.todayCount }} · 本月 {{ statsCard.data.monthCount }}</span>
          </button>
          <button class="pb-seg" @click="goto('workspace-publish')">
            <span class="pb-num">
              <span class="ok">{{ publishCard.data ? formatMoney(publishCard.data.successCount) : '—' }}</span>
              <span class="pb-unit">成</span>
              <span class="bad">{{ publishCard.data ? formatMoney(publishCard.data.failedCount) : '' }}</span>
              <span v-if="publishCard.data" class="pb-unit">败</span>
            </span>
            <span class="pb-label">平台发布</span>
            <span class="pb-sub" v-if="publishCard.data">按发布任务计数 · 累计 {{ publishCard.data.total }}</span>
          </button>
        </div>
        <div class="todo-bar">
          <span class="tb-num">{{ statsCard.data ? formatMoney(statsCard.data.pendingReview) : '—' }}</span>
          <span class="tb-label">
            <ClockCircleOutlined /> 待审核
          </span>
          <a-button type="primary" size="small" class="tb-btn" @click="goto('workspace-review')">
            去审核
          </a-button>
          <span class="tb-links">
            <button class="tb-link" @click="goto('workspace-portal-citations')">引用探测</button>
            <button class="tb-link" @click="goto('workspace-geo-diagnostic', { tab: 'campaign' })">GEO 战役</button>
            <button class="tb-link" @click="goto('workspace-publish')">发布记录</button>
          </span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import {
  RobotOutlined,
  GlobalOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  RiseOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { dashboardApi, keywordApi, publishApi } from '../../api'
import { citationApi, type CitationLatestSummary } from '../../api/citation'
import { analyticsApi, type AnalyticsBotSummary, type AnalyticsOverview, type AnalyticsTrendResult } from '../../api/analytics'
import { geoCrawlabilityApi, type CrawlabilitySnapshot } from '../../api/geoCrawlability'
import { geoCampaignApi, type GeoLatestReport } from '../../api/geoCampaign'
import { describeHttpError } from '../../api/http'
import { useAuthStore } from '../../stores/auth'
import type { DashboardStats } from '../../types/workspace'
import { formatDateTime, formatMoney } from '@/utils/format'
import { logError } from '../../utils/errorLog'

const router = useRouter()
const auth = useAuthStore()

interface Card<T> { loading: boolean; error: string | null; data: T | null; denied: boolean }
const newCard = <T>(): Card<T> => reactive({ loading: false, error: null, data: null, denied: false })

async function loadCard<T>(card: Card<T>, fn: () => Promise<T>) {
  card.loading = true
  card.error = null
  card.denied = false
  try {
    card.data = await fn()
  } catch (error) {
    logError('workspace/dashboard-view', '卡片数据加载失败:', error)
    card.error = describeHttpError(error)
    card.data = null
  } finally {
    card.loading = false
  }
}

/**
 * 这一块的接口后端按权限码执法（analytics:view / seo:audit:view / geo:report:view）。
 * 明知这个账号进不来还去发请求，换来的是一屏「读取失败」：租户以为系统坏了，
 * 真实原因只是「没有这块权限」。所以先按码判定，不给权限就不发请求、也不谎报失败。
 * 码与后端 @RequirePermission 对齐，超管照旧直接放行。
 */
function loadIfAllowed<T>(card: Card<T>, permissionCode: string, fn: () => Promise<T>) {
  if (auth.isSuperAdmin || auth.hasPermission(permissionCode)) return loadCard(card, fn)
  card.loading = false
  card.error = null
  card.data = null
  card.denied = true
  return Promise.resolve()
}

const citation = newCard<CitationLatestSummary>()
const botCard = newCard<AnalyticsBotSummary>()
const todayCard = newCard<AnalyticsOverview>()
const seoCard = newCard<CrawlabilitySnapshot>()
const geoCard = newCard<GeoLatestReport>()
const kwCard = newCard<{ total: number; stage_new: number; stage_suggested: number; stage_articled: number }>()
const statsCard = newCard<DashboardStats>()
const publishCard = newCard<{ total: number; successCount: number; failedCount: number }>()
const trendCard = newCard<AnalyticsTrendResult>()

/** 平台档 = 超管且没选租户：/portal、/analytics、/geoseo 口在这一档全部调不动（Spec-I Q2a） */
const isPlatformMode = computed(() => auth.isSuperAdmin && auth.selectedTenantId === null)

function currentTenantId(): number | undefined {
  return auth.selectedTenantId ?? undefined
}

function toDayParam(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function windowDays(days: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - (days - 1) * 86400000)
  return { from: toDayParam(from), to: toDayParam(to) }
}

const currentDate = computed(() => {
  const now = new Date()
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`
})

const greetingText = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '凌晨好'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 17) return '下午好'
  if (hour < 19) return '傍晚好'
  return '晚上好'
})

const searchEngineHits = computed(() => {
  const slice = botCard.data?.slices?.find(s => s.botCategory === 'search-engine')
  return slice ? slice.hits : 0
})

const seoPass = computed(() =>
  (seoCard.data?.items || []).filter(i => i.verdict === 'PASS').length
)

function fmt(v: number | null): string {
  return v === null ? '—' : formatMoney(v)
}

const pvToday = computed(() =>
  todayCard.data && !todayCard.data.empty ? todayCard.data.pageviews : null
)

function trendSum(key: 'pageviews' | 'uniqueVisitors' | 'botHits' | 'aiCrawlerHits'): number | null {
  const points = trendCard.data?.points
  if (!points) return null
  return points.reduce((acc, p) => acc + (p[key] || 0), 0)
}
const pvWindow = computed(() => trendSum('pageviews'))
const botWindow = computed(() => trendSum('botHits'))
const aiWindow = computed(() => trendSum('aiCrawlerHits'))

const headerLoading = computed(() =>
  !isPlatformMode.value && (citation.loading || botCard.loading || todayCard.loading || seoCard.loading || geoCard.loading)
)

const loadCitation = () => loadIfAllowed(citation, 'analytics:view', () => citationApi.summaryLatest())
const loadBot = () => loadIfAllowed(botCard, 'analytics:view', () => analyticsApi.bot({ tenantId: currentTenantId(), ...windowDays(30) }))
const loadToday = () => {
  const day = toDayParam(new Date())
  return loadIfAllowed(todayCard, 'analytics:view', () => analyticsApi.overview({ tenantId: currentTenantId(), from: day, to: day }))
}
const loadSeo = () => loadIfAllowed(seoCard, 'seo:audit:view', () => geoCrawlabilityApi.latest())
const loadGeo = () => loadIfAllowed(geoCard, 'geo:report:view', () => geoCampaignApi.latestReport())
const loadKeywords = () => loadCard(kwCard, () => keywordApi.getLibraryStats(currentTenantId()))
const loadStats = () => loadCard(statsCard, () => dashboardApi.getStats(currentTenantId()))
const loadPublish = () => loadCard(publishCard, () => publishApi.recordStats({ tenantId: currentTenantId() }))
const loadTrend = () => loadIfAllowed(trendCard, 'analytics:view', () => analyticsApi.trend({ tenantId: currentTenantId(), ...windowDays(trendDays.value) }))

const trendDays = ref(7)
const trendChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null

function renderTrendChart() {
  const result = trendCard.data
  if (!trendChartRef.value || !result) return
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }
  const points = result.points || []
  const dates = points.map(p => p.date.slice(5))
  const area = (top: string, bottom: string) => new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: top },
    { offset: 1, color: bottom },
  ])
  const option: echarts.EChartsOption = {
    animationDuration: 700,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderColor: 'rgba(148, 163, 184, 0.3)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      padding: [10, 14],
    },
    legend: {
      data: ['浏览量', '独立访客', 'bot 抓取', 'AI 抓取'],
      right: 0,
      top: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 16,
      textStyle: { color: 'rgba(203, 213, 225, 0.85)', fontSize: 12 },
    },
    grid: { left: 0, right: 0, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: 'rgba(203, 213, 225, 0.55)', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.16)', type: 'dashed' } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: 'rgba(203, 213, 225, 0.55)', fontSize: 11 },
    },
    series: [
      {
        name: '浏览量', type: 'line', smooth: 0.4, data: points.map(p => p.pageviews),
        lineStyle: { color: '#818cf8', width: 2.5 }, itemStyle: { color: '#818cf8' },
        showSymbol: false, areaStyle: { color: area('rgba(129, 140, 248, 0.32)', 'rgba(129, 140, 248, 0)') },
      },
      {
        name: '独立访客', type: 'line', smooth: 0.4, data: points.map(p => p.uniqueVisitors),
        lineStyle: { color: '#34d399', width: 2.5 }, itemStyle: { color: '#34d399' },
        showSymbol: false, areaStyle: { color: area('rgba(52, 211, 153, 0.2)', 'rgba(52, 211, 153, 0)') },
      },
      {
        name: 'bot 抓取', type: 'line', smooth: 0.4, data: points.map(p => p.botHits),
        lineStyle: { color: '#fbbf24', width: 2, type: 'dashed' }, itemStyle: { color: '#fbbf24' },
        showSymbol: false,
      },
      {
        name: 'AI 抓取', type: 'line', smooth: 0.4, data: points.map(p => p.aiCrawlerHits),
        lineStyle: { color: '#c084fc', width: 2.5 }, itemStyle: { color: '#c084fc' },
        showSymbol: false, areaStyle: { color: area('rgba(192, 132, 252, 0.24)', 'rgba(192, 132, 252, 0)') },
      },
    ],
  }
  trendChart.setOption(option, { notMerge: true })
}

watch(trendDays, async () => {
  await loadTrend()
  nextTick(renderTrendChart)
})

const handleResize = () => trendChart?.resize()

function goto(name: string, params?: Record<string, string>) {
  if (name === 'workspace-geo-campaign-report' && params?.runId) {
    router.push({ name, params: { runId: params.runId } })
    return
  }
  router.push({ name, query: params })
}

// AC-4：轮询只打「今日访问」这一个口；平台档与离页即停
let pollTimer: ReturnType<typeof setInterval> | null = null
function startPolling() {
  stopPolling()
  if (isPlatformMode.value) return
  pollTimer = setInterval(() => {
    loadToday()
  }, 60_000)
}
function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function refreshAll() {
  stopPolling()
  if (isPlatformMode.value) return
  await Promise.all([
    loadCitation(),
    loadBot(),
    loadToday(),
    loadSeo(),
    loadGeo(),
    loadKeywords(),
    loadStats(),
    loadPublish(),
    loadTrend(),
  ])
  nextTick(renderTrendChart)
  startPolling()
}

watch(() => auth.selectedTenantId, refreshAll)

onMounted(() => {
  refreshAll()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  stopPolling()
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  trendChart = null
})
</script>

<style lang="less" scoped>
@blue: #6366f1;
@indigo: #4f46e5;
@purple: #8b5cf6;
@green: #10b981;
@green-600: #16a34a;
@cyan: #0ea5e9;
@orange: #f59e0b;
@red: #ef4444;
@slate: #64748b;
@ink: #1a1f36;

.dashboard {
  width: 100%;
  min-height: 100%;
  padding: 4px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  padding: 8px;
  animation: fadeInDown 0.5s ease both;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, @blue 0%, @purple 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 19px;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
}

.header-info .greeting {
  margin: 0 0 4px 0;
  font-size: 21px;
  font-weight: 700;
  color: @ink;
}

.header-info .subtitle {
  margin: 0;
  font-size: 13px;
  color: @slate;
}

.refresh-btn {
  height: 34px;
  border-radius: 10px;
  font-weight: 500;
}

.platform-guide {
  background: #fff;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 16px;
  padding: 64px 24px;
  text-align: center;
  color: @slate;

  .guide-icon {
    font-size: 38px;
    color: #cbd5e1;
    margin-bottom: 14px;
  }

  h3 {
    margin: 0 0 10px;
    color: @ink;
    font-size: 17px;
  }

  p {
    margin: 4px 0;
    font-size: 13px;
  }

  .guide-hint {
    color: @indigo;
    font-weight: 500;
  }
}

/* ---------- 主视觉：访问趋势 ---------- */

.hero-card {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  padding: 20px 24px 12px;
  margin-bottom: 18px;
  background:
    radial-gradient(900px 300px at 85% -40%, rgba(139, 92, 246, 0.35), transparent 60%),
    radial-gradient(700px 260px at 10% 120%, rgba(14, 165, 233, 0.25), transparent 60%),
    linear-gradient(120deg, #131a33 0%, #1c2450 55%, #2a2560 100%);
  box-shadow: 0 18px 40px rgba(19, 26, 51, 0.35);
  animation: fadeInUp 0.55s ease both;
}

.hero-head {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.hero-title {
  display: flex;
  align-items: center;
  gap: 12px;

  .hero-badge {
    width: 40px;
    height: 40px;
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 19px;
    color: #fff;
    background: linear-gradient(135deg, @blue 0%, @purple 100%);
    box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
  }

  h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .hero-range {
    margin: 2px 0 0;
    font-size: 11px;
    color: rgba(203, 213, 225, 0.6);
    font-variant-numeric: tabular-nums;
  }
}

.hero-metrics {
  display: flex;
  gap: 26px;
  margin-left: auto;

  .hm {
    display: flex;
    flex-direction: column;
    gap: 2px;

    b {
      font-size: 26px;
      line-height: 1.1;
      font-weight: 700;
      color: #fff;
      font-variant-numeric: tabular-nums;
    }

    span {
      font-size: 11px;
      color: rgba(203, 213, 225, 0.65);
    }

    &--amber b { color: #fcd34d; }
    &--violet b { color: #d8b4fe; }
  }
}

.hero-tools {
  display: flex;
  align-items: center;
  gap: 10px;

  .note-dot {
    color: rgba(203, 213, 225, 0.6);
    cursor: help;

    &:hover { color: #fff; }
  }
}

.hero-body {
  position: relative;
  margin-top: 8px;
}

.hero-chart {
  height: 300px;
  width: 100%;
}

.hero-state {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(203, 213, 225, 0.65);
  font-size: 13px;

  &--error { color: #fca5a5; }
  /* 没有权限不是坏了：灰色说「这块不给这个账号看」，别用报错的红去骗运营 */
  &--denied { color: rgba(203, 213, 225, 0.45); }
}

.hero-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(203, 213, 225, 0.55);
  font-size: 13px;
}

:deep(.chart-toggle) {
  .ant-radio-button-wrapper {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.16);
    color: rgba(226, 232, 240, 0.75);
    font-size: 12px;

    &:not(.ant-radio-button-wrapper-checked):hover { color: #fff; }
  }

  .ant-radio-button-wrapper-checked {
    background: @blue;
    border-color: @blue;
    color: #fff;
  }

  .ant-radio-button-wrapper:first-child { border-radius: 8px 0 0 8px; }
  .ant-radio-button-wrapper:last-child { border-radius: 0 8px 8px 0; }
}

/* ---------- 效果五块 ---------- */

.stat-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.stat-tile {
  --tile-color: @slate;
  --tile-soft: rgba(100, 116, 139, 0.1);
  position: relative;
  background: #fff;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 16px;
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  overflow: hidden;
  animation: fadeInUp 0.5s ease both;
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;

  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: var(--tile-color);
    opacity: 0.85;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.3s ease;
  }

  &:hover {
    transform: translateY(-3px);
    border-color: var(--tile-color);
    box-shadow: 0 12px 28px var(--tile-soft);

    &::before { transform: scaleX(1); }
  }

  .st-head {
    display: flex;
    align-items: center;
    gap: 8px;

    .st-icon {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      color: var(--tile-color);
      background: var(--tile-soft);
    }

    .st-label {
      font-size: 12px;
      font-weight: 600;
      color: #475069;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .st-note {
      color: #b6bfcd;
      font-size: 12px;
      cursor: help;

      &:hover { color: var(--tile-color); }
    }
  }

  .live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: @green;
    animation: livePulse 1.8s ease-in-out infinite;
  }

  .st-value {
    display: flex;
    align-items: baseline;
    gap: 6px;

    .st-num {
      font-size: 28px;
      font-weight: 700;
      color: @ink;
      line-height: 1.15;
      font-variant-numeric: tabular-nums;
    }

    .st-unit {
      font-size: 11px;
      color: @slate;
    }

    .st-plain {
      font-size: 14px;
      font-weight: 600;
      color: #475069;
      line-height: 1.4;
    }
  }

  .st-sub {
    font-size: 11px;
    color: @slate;

    .inline-link {
      color: var(--tile-color);
      font-weight: 600;
      cursor: pointer;
      margin-left: 4px;
      white-space: nowrap;
    }
  }

  .st-state {
    font-size: 13px;
    color: #94a3b8;
    padding: 12px 0;

    &--error { color: @red; }
    &--denied { color: @slate; }
  }

  .seo-dots {
    display: flex;
    gap: 6px;

    .seo-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #94a3b8;
      transition: transform 0.2s ease;
      cursor: help;

      &:hover { transform: scale(1.35); }

      &--pass { background: @green; }
      &--warn { background: @orange; }
      &--fail { background: @red; }
    }
  }
}

/* ---------- 生产一行 + 待办 ---------- */

.bottom-row {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 14px;
}

.prod-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: #fff;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 16px;
  overflow: hidden;
  animation: fadeInUp 0.5s ease 0.1s both;

  .pb-seg {
    border: none;
    background: transparent;
    padding: 14px 16px;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: inherit;
    transition: background 0.2s ease;

    & + .pb-seg { border-left: 1px solid #f1f5f9; }

    &:hover { background: #f8fafc; }

    .pb-num {
      font-size: 20px;
      font-weight: 700;
      color: @ink;
      font-variant-numeric: tabular-nums;
      display: flex;
      align-items: baseline;
      gap: 3px;

      .pb-unit {
        font-size: 11px;
        font-weight: 400;
        color: @slate;
      }

      .pb-unit + .bad { margin-left: 8px; }

      .ok { color: @green-600; }
      .bad { color: @red; }
    }

    .pb-label {
      font-size: 12px;
      font-weight: 500;
      color: #475069;
    }

    .pb-sub {
      font-size: 11px;
      color: #98a1b3;
    }
  }
}

.todo-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  background: #fff;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 16px;
  padding: 14px 16px;
  animation: fadeInUp 0.5s ease 0.16s both;

  .tb-num {
    font-size: 24px;
    font-weight: 700;
    color: @orange;
    font-variant-numeric: tabular-nums;
  }

  .tb-label {
    font-size: 12px;
    color: @slate;
    margin-right: auto;
  }

  .tb-links {
    display: flex;
    gap: 6px;
    flex-basis: 100%;

    .tb-link {
      flex: 1;
      border: 1px solid #e8ecf4;
      background: #f8fafc;
      border-radius: 9px;
      padding: 5px 4px;
      font-size: 11px;
      color: #475069;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;

      &:hover {
        border-color: @indigo;
        color: @indigo;
        background: rgba(99, 102, 241, 0.06);
      }
    }
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes livePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.45); }
  55% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
}

@media (max-width: 1200px) {
  .stat-row {
    grid-template-columns: repeat(3, 1fr);
  }

  .bottom-row {
    grid-template-columns: 1fr;
  }

  .hero-metrics {
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .stat-row {
    grid-template-columns: 1fr;
  }

  .prod-bar {
    grid-template-columns: 1fr;

    .pb-seg + .pb-seg {
      border-left: none;
      border-top: 1px solid #f1f5f9;
    }
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
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
