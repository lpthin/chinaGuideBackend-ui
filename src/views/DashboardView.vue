<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import type { Component } from 'vue'
import { Search, CollectionTag, DataAnalysis, Document, MagicStick, TrendCharts, Cpu, Upload, Connection, CreditCard, EditPen, View, Check } from '@element-plus/icons-vue'
import { getDashboardStatsApi } from '@/api/dashboard'
import { listKeywordsApi, listKeywordClustersApi, listKeywordCollectionJobsApi } from '@/api/keywords'
import { useSiteStore } from '@/stores/site'
import type { DashboardStats, Keyword, KeywordCluster, KeywordCollectionJob } from '@/types/api'

interface WorkflowCard {
  key: string; title: string; desc: string; metric: number; unit: string; color: string; route: string; icon: Component
}

const router = useRouter()
const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id || siteStore.currentSiteId)
const loading = ref(false)
const stats = ref<DashboardStats>({ keywords: 0, clusters: 0, articles: 0, pendingReviews: 0, approvedArticles: 0, pageViews: 0, todayPageViews: 0 })
const keywords = ref<Keyword[]>([])
const clusters = ref<KeywordCluster[]>([])
const collectionJobs = ref<KeywordCollectionJob[]>([])

const pendingKeywords = computed(() => keywords.value.filter((k) => k.status !== 'distilled').length)
const distilledKeywords = computed(() => keywords.value.filter((k) => k.status === 'distilled').length)
const promptReadyCount = computed(() => clusters.value.filter((c) => (c.contentSuggestions?.length ?? 0) > 0 || c.contentPrompt).length)
const latestJob = computed(() => collectionJobs.value[0])

function extractBatchDateKey(batchNo?: string, createdAt?: string) {
  const match = String(batchNo || '').match(/(\d{8})/)
  if (match) return match[1]
  const d = createdAt ? new Date(createdAt) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

const batchDisplayMap = computed(() => {
  const rows = [...collectionJobs.value].reverse()
  const dailyCount = new Map<string, number>()
  const result = new Map<string, string>()
  rows.forEach((job) => {
    const dateKey = extractBatchDateKey(job.batchNo, job.createdAt)
    const next = (dailyCount.get(dateKey) || 0) + 1
    dailyCount.set(dateKey, next)
    result.set(job.batchNo, `${dateKey.slice(0, 4)}年${dateKey.slice(4, 6)}月${dateKey.slice(6, 8)}日-${String(next).padStart(2, '0')}`)
  })
  return result
})

function formatBatchNo(row: KeywordCollectionJob | string | undefined) {
  const batchNo = typeof row === 'string' ? row : row?.batchNo
  if (!batchNo) return '-'
  return batchDisplayMap.value.get(batchNo) || batchNo.replace(/^kw-?/, '')
}

function formatChineseTime(value?: string) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatSources(value?: string | string[]) {
  if (!value) return []
  const sourceLabel: Record<string, string> = {
    site_profile: '站点画像', rule_expand: '规则扩展', baidu_suggest: '百度联想',
    5118: '5118', baidu_index: '百度指数', douyin_index: '抖音指数'
  }
  const rows = Array.isArray(value) ? value : String(value || '').split(',')
  return rows.map((item) => item.trim()).filter(Boolean).map((item) => sourceLabel[item] || item)
}

const workflowCards = computed<WorkflowCard[]>(() => [
  { key: 'collect', title: '热词采集', desc: '从站点画像与外部信源补充候选词', metric: collectionJobs.value.length, unit: '批次', color: '#6366f1', route: '/sites/keywords', icon: Search },
  { key: 'pool', title: '关键词池', desc: '默认看未蒸馏词，可按状态/信源/批次过滤', metric: keywords.value.length, unit: '个', color: '#0ea5e9', route: '/sites/keywords', icon: CollectionTag },
  { key: 'cluster', title: '意图聚类', desc: '一个聚类可沉淀最多 5 条内容建议', metric: clusters.value.length, unit: '组', color: '#8b5cf6', route: '/sites/keywords', icon: DataAnalysis },
  { key: 'prompt', title: '内容 Prompt', desc: '多建议列表、评分和详情编辑', metric: promptReadyCount.value, unit: '条', color: '#10b981', route: '/sites/keywords', icon: Document }
])

const quickMetrics = computed(() => [
  { label: '文章总数', value: stats.value.articles, icon: EditPen, color: '#2563eb', bg: '#eff6ff' },
  { label: '待审核', value: stats.value.pendingReviews, icon: View, color: '#f59e0b', bg: '#fffbeb' },
  { label: '可发布', value: stats.value.approvedArticles, icon: Check, color: '#10b981', bg: '#ecfdf5' },
  { label: '今日浏览', value: stats.value.todayPageViews, icon: CreditCard, color: '#8b5cf6', bg: '#f5f3ff' },
])

async function loadAll() {
  if (!currentSiteId.value) return
  loading.value = true
  try {
    const [st, kw, cl, jobs] = await Promise.all([
      getDashboardStatsApi(currentSiteId.value),
      listKeywordsApi(currentSiteId.value),
      listKeywordClustersApi(currentSiteId.value),
      listKeywordCollectionJobsApi(currentSiteId.value),
    ])
    stats.value = st
    keywords.value = kw
    clusters.value = cl
    collectionJobs.value = jobs
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载数据失败')
  } finally {
    loading.value = false
  }
}

function goToDistill() {
  router.push('/sites/keywords')
}

watchEffect(() => { if (currentSiteId.value) loadAll() })
</script>

<template>
  <div class="dashboard-page">
    <!-- Hero -->
    <section class="hero-card">
      <div class="hero-copy">
        <el-tag class="hero-kicker" effect="dark"><el-icon><MagicStick /></el-icon> GEO AI 工作台</el-tag>
        <h2>{{ siteStore.currentSite?.name || '内容生产' }} 仪表盘</h2>
        <p>把散乱热词整理成「关键词池 → 搜索意图 → 内容 Prompt」的生产流水线，优先产出能被搜索和大模型引用的内容选题。</p>
        <div class="hero-actions">
          <el-button type="primary" size="large" @click="goToDistill"><el-icon><Cpu /></el-icon>进入 AI 蒸馏</el-button>
          <el-button size="large" :loading="loading" @click="loadAll"><el-icon><Upload /></el-icon>刷新数据</el-button>
        </div>
      </div>
      <div class="hero-panel">
        <div class="hero-panel-title"><el-icon><TrendCharts /></el-icon> 当前漏斗</div>
        <div class="funnel-row"><span>关键词总量</span><strong>{{ keywords.length }}</strong></div>
        <div class="funnel-row"><span>待蒸馏</span><strong>{{ pendingKeywords }}</strong></div>
        <div class="funnel-row"><span>已蒸馏</span><strong>{{ distilledKeywords }}</strong></div>
        <div class="funnel-row highlight"><span>内容建议</span><strong>{{ promptReadyCount }}</strong></div>
        <p v-if="latestJob" class="latest-job">最近采集：{{ formatBatchNo(latestJob) }} · 入库 {{ latestJob.savedCount }} 个</p>
      </div>
    </section>

    <!-- Workflow -->
    <section class="workflow-grid">
      <div v-for="(item, index) in workflowCards" :key="item.key" class="workflow-card" :style="`--accent:${item.color}`" @click="goToDistill">
        <div class="workflow-index">0{{ index + 1 }}</div>
        <div class="workflow-icon"><el-icon><component :is="item.icon" /></el-icon></div>
        <div class="workflow-content"><h3>{{ item.title }}</h3><p>{{ item.desc }}</p></div>
        <div class="workflow-metric"><strong>{{ item.metric }}</strong><span>{{ item.unit }}</span></div>
      </div>
    </section>

    <!-- Metrics Row -->
    <section class="metrics-section">
      <h3 class="section-title"><el-icon><TrendCharts /></el-icon> 内容生产概览</h3>
      <div class="metrics-grid">
        <div v-for="m in quickMetrics" :key="m.label" class="metric-card" :style="`--accent:${m.color};--bg:${m.bg}`">
          <div class="metric-icon"><el-icon><component :is="m.icon" /></el-icon></div>
          <div class="metric-body">
            <span class="metric-label">{{ m.label }}</span>
            <strong class="metric-value">{{ m.value }}</strong>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom Grid -->
    <div class="bottom-grid">
      <!-- Recent Collection Jobs -->
      <section class="recent-section">
        <h3 class="section-title"><el-icon><Search /></el-icon> 最近采集</h3>
        <div v-if="collectionJobs.length" class="job-list">
          <div v-for="job in collectionJobs.slice(0, 5)" :key="job.id" class="job-row">
            <div class="job-badge">{{ formatBatchNo(job) }}</div>
            <div class="job-meta">
              <div class="job-sources">
                <el-tag v-for="s in formatSources(job.sourceCodes)" :key="s" size="small" round>{{ s }}</el-tag>
              </div>
              <span class="job-stats">候选 {{ job.candidateCount }} · 入库 {{ job.savedCount }}</span>
            </div>
            <span class="job-time">{{ formatChineseTime(job.createdAt) }}</span>
          </div>
        </div>
        <el-empty v-else description="暂无采集记录" :image-size="80" />
      </section>

      <!-- Clusters Preview -->
      <section class="recent-section">
        <h3 class="section-title"><el-icon><DataAnalysis /></el-icon> 最新聚类</h3>
        <div v-if="clusters.length" class="cluster-preview-list">
          <div v-for="c in clusters.slice(0, 5)" :key="c.id" class="cluster-preview-row">
            <div class="cluster-dot" :style="{ background: (c.priority || 0) >= 80 ? '#ef4444' : (c.priority || 0) >= 50 ? '#f59e0b' : '#10b981' }"></div>
            <div class="cluster-info">
              <strong>{{ c.name }}</strong>
              <span v-if="c.suggestedCategory" class="cluster-cat">{{ c.suggestedCategory }}</span>
            </div>
            <span v-if="c.priority" class="cluster-score">P{{ c.priority }}</span>
          </div>
        </div>
        <el-empty v-else description="暂无聚类数据" :image-size="80" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px;
}

/* ── Hero ── */
.hero-card {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 28px;
  padding: 32px 36px;
  border-radius: 24px;
  background: radial-gradient(circle at 12% 18%, rgba(96,165,250,.34), transparent 28%), linear-gradient(135deg,#0f172a 0%,#1e3a8a 48%,#5b21b6 100%);
  box-shadow: 0 24px 60px rgba(15,23,42,.18);
  color: #fff;
}
.hero-card:after {
  content: "";
  position: absolute;
  right: -90px;
  top: -90px;
  width: 260px;
  height: 260px;
  border-radius: 999px;
  background: rgba(255,255,255,.12);
}
.hero-copy, .hero-panel { position: relative; z-index: 1; }
.hero-kicker {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 14px;
  border: 0;
  background: rgba(255,255,255,.18);
  backdrop-filter: blur(14px);
}
.hero-copy h2 { margin: 0 0 10px; font-size: 34px; line-height: 1.15; letter-spacing: .02em; }
.hero-copy p { max-width: 720px; margin: 0; color: #dbeafe; font-size: 15px; line-height: 1.8; }
.hero-actions { display: flex; gap: 12px; margin-top: 22px; }
.hero-panel {
  padding: 20px;
  border: 1px solid rgba(255,255,255,.2);
  border-radius: 20px;
  background: rgba(15,23,42,.24);
  backdrop-filter: blur(18px);
}
.hero-panel-title { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; color: #bfdbfe; font-weight: 700; }
.funnel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255,255,255,.12);
  color: #e2e8f0;
}
.funnel-row strong { font-size: 26px; color: #fff; }
.funnel-row.highlight strong { color: #86efac; }
.latest-job { margin: 14px 0 0; color: #c4b5fd; font-size: 13px; }

/* ── Workflow Grid ── */
.workflow-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.workflow-card {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: linear-gradient(180deg, #fff, #f8fafc);
  box-shadow: 0 14px 35px rgba(15,23,42,.06);
  cursor: pointer;
  transition: box-shadow .2s, transform .2s;
}
.workflow-card:hover {
  box-shadow: 0 18px 40px rgba(15,23,42,.1);
  transform: translateY(-2px);
}
.workflow-index {
  position: absolute;
  right: 14px;
  top: 10px;
  color: #e2e8f0;
  font-weight: 900;
  font-size: 26px;
}
.workflow-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent, #2563eb) 12%, transparent);
  color: var(--accent, #2563eb);
  font-size: 22px;
}
.workflow-content h3 { margin: 0 0 6px; font-size: 16px; }
.workflow-content p { margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; }
.workflow-metric {
  grid-column: 1 / -1;
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 4px;
}
.workflow-metric strong { font-size: 30px; color: var(--accent, #0f172a); }
.workflow-metric span { color: #64748b; }

/* ── Section Title ── */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  font-size: 17px;
  color: #0f172a;
}

/* ── Metrics Grid ── */
.metrics-section { margin-top: 2px; }
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.metric-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15,23,42,.04);
}
.metric-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  background: var(--bg, #eff6ff);
  color: var(--accent, #2563eb);
}
.metric-body { display: flex; flex-direction: column; gap: 4px; }
.metric-label { font-size: 13px; color: #64748b; }
.metric-value { font-size: 28px; color: #0f172a; line-height: 1; }

/* ── Bottom Grid ── */
.bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.recent-section {
  padding: 20px;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15,23,42,.04);
}

/* Collection Jobs */
.job-list { display: flex; flex-direction: column; gap: 10px; }
.job-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
}
.job-row:last-child { border-bottom: 0; }
.job-badge {
  font-weight: 700;
  font-size: 14px;
  color: #2563eb;
  white-space: nowrap;
}
.job-meta { display: flex; flex-direction: column; gap: 4px; }
.job-sources { display: flex; gap: 4px; flex-wrap: wrap; }
.job-stats { font-size: 12px; color: #64748b; }
.job-time { font-size: 12px; color: #94a3b8; white-space: nowrap; }

/* Clusters */
.cluster-preview-list { display: flex; flex-direction: column; gap: 10px; }
.cluster-preview-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
}
.cluster-preview-row:last-child { border-bottom: 0; }
.cluster-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cluster-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.cluster-info strong { font-size: 14px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cluster-cat { font-size: 12px; color: #64748b; }
.cluster-score {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  flex-shrink: 0;
}

/* Responsive */
@media (max-width: 1280px) {
  .workflow-grid { grid-template-columns: repeat(2, 1fr); }
  .hero-card { grid-template-columns: 1fr; }
}
@media (max-width: 960px) {
  .metrics-grid { grid-template-columns: repeat(2, 1fr); }
  .bottom-grid { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .hero-card { padding: 22px; }
  .hero-copy h2 { font-size: 28px; }
  .hero-actions { flex-direction: column; align-items: stretch; }
  .workflow-grid { grid-template-columns: 1fr; }
  .metrics-grid { grid-template-columns: 1fr; }
}
</style>
