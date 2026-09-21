<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  DatabaseOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  UploadOutlined,
  FilterOutlined,
  AimOutlined,
  FundOutlined,
  FileSearchOutlined,
  RiseOutlined,
  CalendarOutlined,
} from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import * as echarts from 'echarts'
import { keywordApi } from '../../api'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const expanding = ref(false)
const showImportModal = ref(false)
const showConfigModal = ref(false)
const searchText = ref('')
const stageFilter = ref<string>('all') // all / new / suggested / articled
const categoryFilter = ref<string>('all')
const sortKey = ref<'intentValue' | 'searchVolume' | 'suggestionCount' | 'articleCount'>('intentValue')
const sortOrder = ref<'asc' | 'desc'>('desc')
const selectedRowKeys = ref<number[]>([])
const importText = ref('')

const funnelChartRef = ref<HTMLElement>()
const stageChartRef = ref<HTMLElement>()
let funnelChart: echarts.ECharts | null = null
let stageChart: echarts.ECharts | null = null

interface KW {
  id: number
  tenantId: number
  rawKeyword: string
  normalizedKeyword: string
  category: string
  searchVolume: number
  competition: number
  intentValue: number
  suggestionCount: number
  articleCount: number
  status: string
  sourceCodes: string
  priority: number
  createdAt: string
}

const keywords = ref<KW[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const tablePagination = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (t: number) => `共 ${t} 条`,
  onChange: (page: number, size: number) => {
    currentPage.value = page
    pageSize.value = size
    loadKeywords()
  },
}))

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: (string | number)[]) => {
    selectedRowKeys.value = keys.map(Number)
  },
}))

const libraryStats = reactive<{
  total: number
  cat_price: number; cat_choice: number; cat_effect: number; cat_guide: number
  cat_basic: number; cat_local: number; cat_news: number
  stage_new: number; stage_suggested: number; stage_articled: number
}>({
  total: 0,
  cat_price: 0, cat_choice: 0, cat_effect: 0, cat_guide: 0,
  cat_basic: 0, cat_local: 0, cat_news: 0,
  stage_new: 0, stage_suggested: 0, stage_articled: 0,
})

const expandConfig = reactive<{
  tenantId: number
  enabled: number
  weekday: string
  runTime: string
}>({
  tenantId: 0,
  enabled: 1,
  weekday: 'SUN',
  runTime: '03:00',
})

const WEEKDAY_OPTIONS = [
  { value: 'MON', label: '每周一' },
  { value: 'TUE', label: '每周二' },
  { value: 'WED', label: '每周三' },
  { value: 'THU', label: '每周四' },
  { value: 'FRI', label: '每周五' },
  { value: 'SAT', label: '每周六' },
  { value: 'SUN', label: '每周日' },
]

const WEEKDAY_TEXT: Record<string, string> = WEEKDAY_OPTIONS.reduce((acc, i) => ({ ...acc, [i.value]: i.label }), {})

const CATEGORY_OPTIONS = [
  { value: 'all', label: '全部分类' },
  { value: '价格', label: '价格' },
  { value: '选择', label: '选择' },
  { value: '效果', label: '效果' },
  { value: '攻略', label: '攻略' },
  { value: '基础', label: '基础' },
  { value: '本地服务', label: '本地服务' },
  { value: '行业动态', label: '行业动态' },
]

const nextRunText = computed(() => {
  const w = WEEKDAY_TEXT[expandConfig.weekday] || '每周日'
  const onOff = expandConfig.enabled === 1 ? '已开启' : '已关闭'
  return `${onOff} · ${w} ${expandConfig.runTime || '03:00'} 执行`
})

function currentTenant() {
  return auth.selectedTenantId || auth.tenantId || undefined
}

async function loadLibraryStats() {
  try {
    const res = await keywordApi.getLibraryStats(currentTenant()) as any
    const s = res?.data || res || {}
    Object.assign(libraryStats, {
      total: Number(s.total || 0),
      cat_price: Number(s.cat_price || 0),
      cat_choice: Number(s.cat_choice || 0),
      cat_effect: Number(s.cat_effect || 0),
      cat_guide: Number(s.cat_guide || 0),
      cat_basic: Number(s.cat_basic || 0),
      cat_local: Number(s.cat_local || 0),
      cat_news: Number(s.cat_news || 0),
      stage_new: Number(s.stage_new || 0),
      stage_suggested: Number(s.stage_suggested || 0),
      stage_articled: Number(s.stage_articled || 0),
    })
    renderFunnelChart()
    renderStageChart()
  } catch (e) { console.error(e) }
}

async function loadExpandConfig() {
  try {
    const res = await keywordApi.getExpandConfig(currentTenant()) as any
    const c = res?.data || res || {}
    Object.assign(expandConfig, {
      tenantId: c.tenantId || 0,
      enabled: c.enabled == null ? 1 : Number(c.enabled),
      weekday: c.weekday || 'SUN',
      runTime: c.runTime || '03:00',
    })
  } catch (e) { console.error(e) }
}

async function loadKeywords() {
  loading.value = true
  try {
    const res = await keywordApi.list({
      page: currentPage.value,
      size: pageSize.value,
      keyword: searchText.value || undefined,
      tenantId: currentTenant() as any,
    }) as any
    const records: KW[] = (res?.records || []).map((r: any) => ({
      id: r.id,
      tenantId: r.tenantId,
      rawKeyword: r.rawKeyword,
      normalizedKeyword: r.normalizedKeyword,
      category: r.category || '基础',
      searchVolume: Number(r.searchVolume || 0),
      competition: Number(r.competition || 0),
      intentValue: Number(r.intentValue || 0),
      suggestionCount: Number(r.suggestionCount || 0),
      articleCount: Number(r.articleCount || 0),
      status: r.status,
      sourceCodes: r.sourceCodes,
      priority: Number(r.priority || 0),
      createdAt: r.createdAt,
    }))
    // 前端再按 filter + sort 补充精修（stageFilter 基于 suggestion_count/article_count；服务端不过滤）
    let list = records.slice()
    if (stageFilter.value !== 'all') {
      list = list.filter(k => {
        const hasArt = k.articleCount > 0
        const hasSug = k.suggestionCount > 0
        if (stageFilter.value === 'new') return !hasSug && !hasArt
        if (stageFilter.value === 'suggested') return hasSug && !hasArt
        if (stageFilter.value === 'articled') return hasArt
        return true
      })
    }
    if (categoryFilter.value !== 'all') {
      list = list.filter(k => k.category === categoryFilter.value)
    }
    list.sort((a, b) => {
      const av = (a as any)[sortKey.value] ?? 0
      const bv = (b as any)[sortKey.value] ?? 0
      return sortOrder.value === 'desc' ? bv - av : av - bv
    })
    keywords.value = list
    total.value = Number(res?.total || 0)
  } finally {
    loading.value = false
  }
}

async function fetchAll() {
  await Promise.all([loadLibraryStats(), loadExpandConfig(), loadKeywords()])
}

async function triggerExpand() {
  expanding.value = true
  try {
    const res = await keywordApi.expand({ sourceCodes: [] }, currentTenant()) as any
    const msg = res?.message || res?.data?.message || '执行完成'
    message.success(msg)
    await fetchAll()
  } catch (e: any) {
    message.error(e?.message || '扩展失败')
  } finally {
    expanding.value = false
  }
}

function openConfig() {
  showConfigModal.value = true
}

async function saveConfig() {
  try {
    const res = await keywordApi.updateExpandConfig({
      enabled: expandConfig.enabled,
      weekday: expandConfig.weekday,
      runTime: expandConfig.runTime,
    }, currentTenant()) as any
    const c = res?.data || res
    Object.assign(expandConfig, c)
    message.success('配置已保存')
    showConfigModal.value = false
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

async function submitImport() {
  if (!importText.value.trim()) return message.warning('请输入关键词（一行一个）')
  const list = importText.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  if (!list.length) return message.warning('没有可导入的关键词')
  try {
    const res = await keywordApi.importKeywords({ keywords: list }, currentTenant()) as any
    message.success(`导入完成：${res?.imported ?? res?.data?.imported ?? 0}/${list.length}`)
    showImportModal.value = false
    importText.value = ''
    await fetchAll()
  } catch (e: any) {
    message.error(e?.message || '导入失败')
  }
}

const priorityModalVisible = ref(false)
const prioritySaving = ref(false)
const priorityInput = ref(5)

function openPriorityModal() {
  if (!selectedRowKeys.value.length) return message.warning('请先选择关键词')
  const first = keywords.value.find(k => k.id === selectedRowKeys.value[0])
  priorityInput.value = first?.priority ?? 5
  priorityModalVisible.value = true
}

async function submitPriority() {
  prioritySaving.value = true
  try {
    const res = await keywordApi.batchUpdatePriority(selectedRowKeys.value, priorityInput.value, currentTenant()) as any
    message.success(`已更新 ${res?.updated ?? 0} 个关键词的优先级`)
    priorityModalVisible.value = false
    selectedRowKeys.value = []
    await loadKeywords()
  } catch (e: any) {
    message.error(e?.message || '优先级更新失败')
  } finally {
    prioritySaving.value = false
  }
}

async function batchDelete() {
  if (!selectedRowKeys.value.length) return message.warning('请先选择要删除的关键词')
  Modal.confirm({
    title: `确认删除 ${selectedRowKeys.value.length} 个关键词？`,
    okType: 'danger',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      const res = await keywordApi.batchDelete(selectedRowKeys.value, currentTenant()) as any
      message.success(`已删除 ${res?.deleted ?? res?.data?.deleted ?? 0} 个`)
      selectedRowKeys.value = []
      await fetchAll()
    },
  })
}

function renderFunnelChart() {
  if (!funnelChartRef.value) return
  if (!funnelChart) funnelChart = echarts.init(funnelChartRef.value as HTMLElement)
  const data = [
    { value: libraryStats.cat_price, name: '价格（高转化）' },
    { value: libraryStats.cat_choice, name: '选择（对比）' },
    { value: libraryStats.cat_effect, name: '效果（评价）' },
    { value: libraryStats.cat_guide, name: '攻略（教程）' },
    { value: libraryStats.cat_local, name: '本地服务' },
    { value: libraryStats.cat_basic, name: '基础（科普）' },
    { value: libraryStats.cat_news, name: '行业动态' },
  ].filter(d => d.value > 0)
  funnelChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 个 ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 11, color: '#475569' } },
    color: ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#0ea5e9', '#6366f1', '#a855f7'],
    series: [{
      name: '转化漏斗分布',
      type: 'pie',
      radius: ['40%', '68%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      label: { show: true, fontSize: 11, formatter: '{b}\n{c}' },
      data,
    }],
  })
}

function renderStageChart() {
  if (!stageChartRef.value) return
  if (!stageChart) stageChart = echarts.init(stageChartRef.value as HTMLElement)
  const stages = [
    { name: '新词库（未生产）', value: libraryStats.stage_new, color: '#94a3b8' },
    { name: '已有内容建议', value: libraryStats.stage_suggested, color: '#f59e0b' },
    { name: '已生成文章', value: libraryStats.stage_articled, color: '#10b981' },
  ]
  const maxV = Math.max(1, ...stages.map(s => s.value))
  stageChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 16, right: 16, top: 16, bottom: 32, containLabel: true },
    xAxis: {
      type: 'category', data: stages.map(s => s.name),
      axisLabel: { color: '#475569', fontSize: 11, interval: 0 },
    },
    yAxis: {
      type: 'value', max: maxV,
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    },
    series: [{
      type: 'bar', barWidth: '48%',
      data: stages.map(s => ({ value: s.value, itemStyle: { color: s.color, borderRadius: [6, 6, 0, 0] } })),
      label: { show: true, position: 'top', color: '#0f172a', fontSize: 11, fontWeight: 600 },
    }],
  })
}

window.addEventListener?.('resize', () => {
  funnelChart?.resize()
  stageChart?.resize()
})

function stageTag(row: KW) {
  if ((row.articleCount || 0) > 0) return { text: '已生成文章', color: 'green' }
  if ((row.suggestionCount || 0) > 0) return { text: '已有内容建议', color: 'orange' }
  return { text: '新词库', color: 'default' }
}

function categoryClassColor(cat: string): string {
  switch (cat) {
    case '价格': return '#ef4444'
    case '选择': return '#f97316'
    case '效果': return '#f59e0b'
    case '攻略': return '#10b981'
    case '基础': return '#6366f1'
    case '本地服务': return '#0ea5e9'
    case '行业动态': return '#a855f7'
    default: return '#94a3b8'
  }
}

onMounted(fetchAll)
</script>

<template>
  <div class="keyword-library-page">
    <a-spin :spinning="loading">
      <!-- 顶部标题区 -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <DatabaseOutlined />
          </div>
          <div class="header-info">
            <h2 class="page-title">关键词库</h2>
            <p class="page-subtitle">
              <span class="subtitle-text">
                企业官网 SEO 关键词生产体系 · 单一真实源（SOT）
              </span>
              <span class="header-divider"></span>
              <span class="header-badge">
                <CalendarOutlined />
                下次扩展：{{ nextRunText }}
              </span>
            </p>
          </div>
        </div>
        <div class="header-actions">
          <a-button @click="fetchAll">
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
          <a-button @click="openConfig">
            <template #icon><SettingOutlined /></template>
            扩展配置
          </a-button>
          <a-button type="primary" :loading="expanding" @click="triggerExpand">
            <template #icon><PlayCircleOutlined /></template>
            立即扩展（3源白名单）
          </a-button>
          <a-button color="primary" variant="outlined" @click="showImportModal = true">
            <template #icon><UploadOutlined /></template>
            导入关键词
          </a-button>
        </div>
      </div>

      <!-- 指标卡 -->
      <div class="stat-cards">
        <div class="stat-card stat-card--indigo">
          <div class="stat-card__icon"><FundOutlined /></div>
          <div class="stat-card__content">
            <div class="stat-card__label">关键词总量</div>
            <div class="stat-card__value">{{ libraryStats.total }}</div>
            <div class="stat-card__hint">全租户词库（唯一真实源）</div>
          </div>
        </div>
        <div class="stat-card stat-card--rose">
          <div class="stat-card__icon"><AimOutlined /></div>
          <div class="stat-card__content">
            <div class="stat-card__label">高转化漏斗（价格+选择+效果+本地）</div>
            <div class="stat-card__value">
              {{ libraryStats.cat_price + libraryStats.cat_choice + libraryStats.cat_effect + libraryStats.cat_local }}
            </div>
            <div class="stat-card__hint">最贴近企业成交链路的词</div>
          </div>
        </div>
        <div class="stat-card stat-card--amber">
          <div class="stat-card__icon"><FileSearchOutlined /></div>
          <div class="stat-card__content">
            <div class="stat-card__label">已有内容建议（未生成文章）</div>
            <div class="stat-card__value">{{ libraryStats.stage_suggested }}</div>
            <div class="stat-card__hint">可直接进入 AI 生成页</div>
          </div>
        </div>
        <div class="stat-card stat-card--emerald">
          <div class="stat-card__icon"><RiseOutlined /></div>
          <div class="stat-card__content">
            <div class="stat-card__label">已生成文章（生产进度）</div>
            <div class="stat-card__value">{{ libraryStats.stage_articled }}</div>
            <div class="stat-card__hint">
              覆盖率：{{
                libraryStats.total === 0
                  ? '0%'
                  : Math.round(libraryStats.stage_articled * 100 / libraryStats.total) + '%'
              }}
            </div>
          </div>
        </div>
      </div>

      <!-- 图表两行：漏斗分布 + 生产进度 -->
      <div class="chart-row">
        <a-card class="chart-card" size="small" :bordered="false">
          <template #title>
            <div class="card-title">
              <ThunderboltOutlined style="color:#6366f1" />
              <span>转化漏斗分类分布</span>
            </div>
          </template>
          <div ref="funnelChartRef" class="chart-box"></div>
        </a-card>
        <a-card class="chart-card" size="small" :bordered="false">
          <template #title>
            <div class="card-title">
              <DatabaseOutlined style="color:#10b981" />
              <span>生产进度（新词 / 建议 / 文章）</span>
            </div>
          </template>
          <div ref="stageChartRef" class="chart-box"></div>
        </a-card>
      </div>

      <!-- 关键词库列表 -->
      <a-card class="list-card" size="small" :bordered="false">
        <div class="list-toolbar">
          <div class="filters">
            <a-input
              v-model:value="searchText"
              placeholder="搜索关键词（按回车查询）"
              allow-clear
              style="width:240px"
              @press-enter="loadKeywords"
            >
              <template #prefix><FilterOutlined /></template>
            </a-input>

            <a-select v-model:value="stageFilter" style="width:180px" @change="loadKeywords">
              <a-select-option value="all">全部生产阶段</a-select-option>
              <a-select-option value="new">新词库（未生产）</a-select-option>
              <a-select-option value="suggested">已有内容建议</a-select-option>
              <a-select-option value="articled">已生成文章</a-select-option>
            </a-select>

            <a-select v-model:value="categoryFilter" style="width:160px" @change="loadKeywords">
              <a-select-option v-for="c in CATEGORY_OPTIONS" :key="c.value" :value="c.value">
                {{ c.label }}
              </a-select-option>
            </a-select>

            <a-select v-model:value="sortKey" style="width:150px" @change="loadKeywords">
              <a-select-option value="intentValue">按意图价值</a-select-option>
              <a-select-option value="searchVolume">按搜索量</a-select-option>
              <a-select-option value="suggestionCount">按建议数</a-select-option>
              <a-select-option value="articleCount">按文章数</a-select-option>
            </a-select>

            <a-button @click="sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'" :aria-label="'toggle sort'">
              {{ sortOrder === 'desc' ? '↓ 倒序' : '↑ 正序' }}
            </a-button>

            <a-button type="text" @click="loadKeywords">
              <ReloadOutlined /> 查询
            </a-button>
          </div>

          <div class="actions">
            <a-tooltip title="蒸馏时按优先级从高到低选词">
              <a-button :disabled="!selectedRowKeys.length" @click="openPriorityModal">
                <template #icon><ThunderboltOutlined /></template>
                设优先级（{{ selectedRowKeys.length }}）
              </a-button>
            </a-tooltip>
            <a-tooltip title="批量删除">
              <a-button danger :disabled="!selectedRowKeys.length" @click="batchDelete">
                <template #icon><DeleteOutlined /></template>
                删除（{{ selectedRowKeys.length }}）
              </a-button>
            </a-tooltip>
          </div>
        </div>

        <a-table
          :scroll="{ x: 'max-content' }"
          :data-source="keywords"
          row-key="id"
          :pagination="tablePagination"
          :row-selection="rowSelection"
          class="kw-table"
        >
          <a-table-column title="#" type="index" width="48" />
          <a-table-column title="关键词" data-index="rawKeyword" min-width="180">
            <template #default="{ record }">
              <div class="kw-cell">
                <div class="kw-name">{{ record.rawKeyword || record.normalizedKeyword }}</div>
                <div class="kw-sub">{{ record.normalizedKeyword !== record.rawKeyword ? record.normalizedKeyword : '' }}</div>
              </div>
            </template>
          </a-table-column>

          <a-table-column title="分类" data-index="category" width="110">
            <template #default="{ record }">
              <a-tag :color="categoryClassColor(record.category)">{{ record.category || '基础' }}</a-tag>
            </template>
          </a-table-column>

          <a-table-column title="意图价值" data-index="intentValue" width="100" align="right">
            <template #default="{ record }">
              <a-progress
                :percent="record.intentValue || 0"
                :show-info="true"
                size="small"
                :stroke-color="record.intentValue >= 80 ? '#ef4444' : record.intentValue >= 60 ? '#f59e0b' : '#0ea5e9'"
              />
            </template>
          </a-table-column>

          <a-table-column title="搜索量" data-index="searchVolume" width="100" align="right">
            <template #default="{ record }">{{ (record.searchVolume || 0).toLocaleString() }}</template>
          </a-table-column>

          <a-table-column title="蒸馏优先级" data-index="priority" width="110" align="right">
            <template #default="{ record }">
              <a-tag :color="record.priority >= 8 ? 'red' : record.priority >= 5 ? 'orange' : 'default'">
                {{ record.priority || 0 }}
              </a-tag>
            </template>
          </a-table-column>

          <a-table-column title="竞争度" data-index="competition" width="110" align="right">
            <template #default="{ record }">
              <span class="comp-pill">{{ Number(record.competition || 0).toFixed(2) }}</span>
            </template>
          </a-table-column>

          <a-table-column title="生产状态" width="140">
            <template #default="{ record }">
              <a-tag :color="stageTag(record).color">{{ stageTag(record).text }}</a-tag>
            </template>
          </a-table-column>

          <a-table-column title="建议数 / 文章数" width="140" align="center">
            <template #default="{ record }">
              <div class="count-cell">
                <span class="count-item count-item--sug">
                  {{ record.suggestionCount || 0 }} 建议
                </span>
                <span class="count-divider"></span>
                <span class="count-item count-item--art">
                  {{ record.articleCount || 0 }} 文章
                </span>
              </div>
            </template>
          </a-table-column>

          <a-table-column title="来源" data-index="sourceCodes" width="130">
            <template #default="{ record }">
              <span class="source-tag">{{ record.sourceCodes || '—' }}</span>
            </template>
          </a-table-column>

          <a-table-column title="收录时间" data-index="createdAt" width="160">
            <template #default="{ record }">{{ record.createdAt ? String(record.createdAt).slice(0, 16) : '—' }}</template>
          </a-table-column>
        </a-table>
      </a-card>
    </a-spin>

    <!-- 扩展配置抽屉 -->
    <a-modal
      v-model:open="showConfigModal"
      title="每周关键词扩展配置（FR-11）"
      :ok-text="'保存'"
      :cancel-text="'取消'"
      @ok="saveConfig"
      :width="520"
    >
      <a-form layout="vertical" :model="expandConfig">
        <a-form-item label="启用每周自动扩展">
          <a-switch
            v-model:checked="(expandConfig as any).enabled"
            :checked-value="1"
            :un-checked-value="0"
            checked-children="开"
            un-checked-children="关"
          />
        </a-form-item>

        <a-form-item label="执行星期">
          <a-select v-model:value="expandConfig.weekday">
            <a-select-option v-for="w in WEEKDAY_OPTIONS" :key="w.value" :value="w.value">{{ w.label }}</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="执行时间（24小时制，示例 03:00）">
          <a-input v-model:value="expandConfig.runTime" placeholder="HH:mm" maxlength="5" />
        </a-form-item>

        <a-alert type="info" show-icon>
          <template #message>
            规则：{{ WEEKDAY_TEXT[expandConfig.weekday] }} {{ expandConfig.runTime }}
            命中的租户将由 Scheduler 每分钟自动扫描并触发 3 源白名单扩展（百度联想词 / 产品词扩展 / 地域词组合）。
          </template>
        </a-alert>
      </a-form>
    </a-modal>

    <!-- 导入关键词 -->
    <a-modal
      v-model:open="showImportModal"
      title="手动导入关键词（一行一个）"
      :ok-text="'确认导入'"
      :cancel-text="'取消'"
      @ok="submitImport"
      :width="520"
    >
      <a-textarea
        v-model:value="importText"
        :rows="10"
        placeholder="深圳种植牙价格&#10;种植牙哪家好&#10;种植牙效果对比"
      />
      <a-alert style="margin-top: 12px" type="info" show-icon message="导入后会自动进入 keyword 表（统一真实源），后续可参与聚类蒸馏 / 建议 / 生成链路。" />
    </a-modal>

    <a-modal
      v-model:open="priorityModalVisible"
      :title="`设置蒸馏优先级（已选 ${selectedRowKeys.length} 个关键词）`"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="prioritySaving"
      @ok="submitPriority"
      :width="420"
    >
      <a-slider v-model:value="priorityInput" :min="0" :max="10" :marks="{ 0: '0', 5: '5', 10: '10' }" />
      <a-alert
        style="margin-top: 16px"
        type="info"
        show-icon
        message="蒸馏选词按优先级从高到低，其次按搜索量；分值 0-10。"
      />
    </a-modal>
  </div>
</template>

<style lang="less" scoped>
@primary-color: #6366f1;
@card-bg: #ffffff;
@slate-50: #f8fafc;
@slate-100: #f1f5f9;
@slate-500: #64748b;
@slate-700: #334155;
@slate-900: #0f172a;

.keyword-library-page {
  padding: 20px 0 48px;
  background: @slate-50;
  min-height: 100vh;
  color: @slate-900;
}

.page-header {
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #ffffff 0%, #eef2ff 100%);
  border: 1px solid #e0e7ff;
  border-radius: 14px;
  margin-bottom: 18px;
  box-shadow: 0 8px 24px -16px rgba(99,102,241,0.35);
}
.header-content { display: flex; align-items: center; gap: 16px; }
.header-icon {
  width: 48px; height: 48px; border-radius: 12px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 22px;
  box-shadow: 0 6px 18px -8px rgba(99,102,241,0.6);
}
.header-info .page-title { margin: 0; font-size: 22px; font-weight: 700; color: @slate-900; }
.page-subtitle { margin: 4px 0 0; color: @slate-500; font-size: 13px; display: flex; align-items: center; gap: 12px; }
.header-divider { width: 1px; height: 14px; background: #e2e8f0; display: inline-block; }
.header-badge {
  display: inline-flex; align-items: center; gap: 6px;
  color: @primary-color; font-weight: 500;
  padding: 2px 10px; border-radius: 999px; background: #eef2ff;
}
.header-actions { display: flex; gap: 10px; flex-wrap: wrap; }

.stat-cards {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 18px;
  @media (max-width: 1200px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 600px)  { grid-template-columns: 1fr; }
}
.stat-card {
  position: relative; overflow: hidden;
  padding: 18px 20px; border-radius: 14px; background: #fff;
  display: flex; align-items: center; gap: 14px;
  border: 1px solid @slate-100;
  box-shadow: 0 6px 18px -18px rgba(15,23,42,0.2);
}
.stat-card__icon {
  width: 44px; height: 44px; border-radius: 12px; display:flex; align-items:center; justify-content:center;
  font-size: 20px; color: #fff; flex-shrink: 0;
}
.stat-card--indigo .stat-card__icon { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.stat-card--rose   .stat-card__icon { background: linear-gradient(135deg, #f43f5e, #ef4444); }
.stat-card--amber  .stat-card__icon { background: linear-gradient(135deg, #f59e0b, #f97316); }
.stat-card--emerald .stat-card__icon { background: linear-gradient(135deg, #10b981, #06b6d4); }

.stat-card__content { flex: 1; min-width: 0; }
.stat-card__label   { color: @slate-500; font-size: 12px; }
.stat-card__value   { font-size: 26px; font-weight: 700; color: @slate-900; margin-top: 4px; }
.stat-card__hint    { color: @slate-500; font-size: 12px; margin-top: 2px; }

.chart-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px;
  @media (max-width: 960px) { grid-template-columns: 1fr; }
}
.chart-card { border-radius: 14px; }
.card-title { display: flex; align-items: center; gap: 8px; font-weight: 600; color: @slate-700; }
.chart-box { width: 100%; height: 300px; }

.list-card { border-radius: 14px; }
.list-toolbar {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 4px 4px 14px; flex-wrap: wrap;
}
.filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.actions { display: flex; gap: 10px; }

.kw-table { padding-top: 6px; }
.kw-cell .kw-name { font-weight: 600; color: @slate-900; }
.kw-cell .kw-sub  { color: @slate-500; font-size: 12px; margin-top: 2px; }

.comp-pill {
  display: inline-block; min-width: 48px; text-align: center;
  padding: 2px 8px; border-radius: 999px;
  background: #f1f5f9; color: #334155; font-size: 12px;
}

.count-cell {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 10px; background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.count-item { font-size: 12px; font-weight: 500; }
.count-item--sug { color: #b45309; }
.count-item--art { color: #047857; }
.count-divider { width: 1px; height: 12px; background: #cbd5e1; }

.source-tag {
  font-size: 12px; color: @slate-500; padding: 2px 8px;
  background: #eef2ff; border-radius: 6px; border: 1px solid #e0e7ff;
}
</style>
