<template>
  <div class="operation-dashboard-page">
    <a-spin :spinning="loading">
      <a-alert
        v-if="scopeNotice"
        class="scope-alert"
        type="info"
        show-icon
        :message="scopeNotice"
      />
      <!-- 这两条与「看的是哪一家」分开摆：读不到的原因不能被上面那句范围说明顶掉 -->
      <a-alert
        v-if="dashboardState === 'unreadable'"
        class="scope-alert"
        type="warning"
        show-icon
        :message="emptyLine"
      />
      <a-alert
        v-if="dashboardState === 'failed'"
        class="scope-alert"
        type="error"
        show-icon
        :message="`这一屏没读上来：${readError}`"
      />

      <a-row :gutter="16" style="margin-bottom: 8px">
        <a-col :span="6">
          <a-card class="stat-card main-stat" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <EyeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ countText(stats.totalViews) }}</div>
                <div class="stat-title">总浏览量</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ countText(stats.totalArticles) }}</div>
                <div class="stat-title">文章总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <ReadOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ countText(stats.totalCases) }}</div>
                <div class="stat-title">客户案例</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffec3d 100%)">
                <UserOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ countText(stats.todayActiveUsers) }}</div>
                <div class="stat-title">今日活跃用户</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>
      <div class="metric-footnote">
        这里的数只数客户自己产出的内容：演示内容与机器抓取都不计入；浏览只数真人打开。
      </div>

      <a-row :gutter="16">
        <a-col :span="16">
          <a-card :bordered="false">
            <template #title>浏览趋势<span class="card-sub">{{ periodLabel }}</span></template>
            <template #extra>
              <a-radio-group v-model:value="trendPeriod" button-style="solid" size="small">
                <a-radio-button value="week">本周</a-radio-button>
                <a-radio-button value="month">本月</a-radio-button>
                <a-radio-button value="quarter">本季</a-radio-button>
              </a-radio-group>
            </template>
            <div class="chart-container">
              <div v-if="trendNotice" class="chart-state">{{ trendNotice }}</div>
              <template v-else-if="trendData.length > 0">
                <div class="chart-placeholder">
                  <div
                    v-for="(item, index) in trendData"
                    :key="item.date"
                    class="chart-bar"
                    :title="`${item.date}：${item.value} 次浏览`"
                  >
                    <div class="bar-label">{{ showTrendLabel(index) ? item.date.substring(5) : '' }}</div>
                    <div class="bar-wrapper">
                      <div class="bar" :style="{ height: `${item.height}%` }">
                        <span v-if="trendData.length <= 14" class="bar-value">{{ item.value.toLocaleString() }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <a-empty v-else description="这一段时间里一次浏览都没有" />
            </div>
          </a-card>
        </a-col>

        <a-col :span="8">
          <a-card title="分类分布" :bordered="false">
            <div class="pie-placeholder">
              <div v-if="pieNotice" class="chart-state">{{ pieNotice }}</div>
              <template v-else-if="categoryData.length > 0">
                <div class="pie-chart" :style="{ background: pieGradient }">
                  <div class="pie-center">
                    <div class="pie-total">{{ categoryTotal }}</div>
                    <div class="pie-label">有分类的文章</div>
                  </div>
                </div>
                <div class="pie-legend">
                  <div v-for="item in categoryData" :key="item.name" class="legend-item">
                    <span class="legend-color" :style="{ background: item.color }"></span>
                    <span class="legend-name">{{ item.name }}</span>
                    <span class="legend-value">{{ item.value }}</span>
                  </div>
                </div>
              </template>
              <a-empty v-else description="这一家还没有发布过带分类的文章" />
            </div>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import {
  EyeOutlined,
  FileTextOutlined,
  ReadOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { useAuthStore } from '../../stores/auth'
import { operationApi } from '../../api/operation'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import type {
  TrafficTrendItem,
  CategoryDistributionItem
} from '../../types/operation'

type ReadState = 'idle' | 'loading' | 'ok' | 'unreadable' | 'failed'

const auth = useAuthStore()

const loading = ref(false)
const trendPeriod = ref<'week' | 'month' | 'quarter'>('week')

const dashboardState = ref<ReadState>('idle')
const emptyLine = ref('')
const readError = ref('')

/** null 表示这一格这次没读到（读失败或这一家读不到）：卡片摆「—」，绝不摆 0 */
const stats = reactive({
  totalViews: null as number | null,
  totalArticles: null as number | null,
  totalCases: null as number | null,
  todayActiveUsers: null as number | null,
})

const trendData = ref<{ date: string; value: number; height: number }[]>([])
const trendState = ref<ReadState>('idle')
const trendError = ref('')
const categoryData = ref<{ name: string; value: number; color: string }[]>([])
const pieState = ref<ReadState>('idle')
const pieError = ref('')

const chartColors = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#722ed1',
  '#eb2f96',
  '#13c2c2',
  '#fa8c16',
  '#2f54eb',
]

/**
 * 这一屏的数属于谁。超管没选定客户就是 null ⇒ 一发 `/api/operation/*` 都不发。
 *
 * 改前这里是 `auth.selectedTenantId || 0`：`selectedTenantId` 只有超管的租户切换器会写
 * （`WorkspaceView.vue` 里 `v-if="auth.isSuperAdmin"`），租户管理员永远拿到 0，
 * 而 `loadAllData` 第一句 `if (!auth.selectedTenantId) return` 把他永久挡在门外，
 * 屏幕照样摆一屏 0、一个字不提。
 */
const requestedTenantId = computed<number | null>(() => {
  if (auth.isSuperAdmin) return auth.selectedTenantId ?? null
  return auth.user?.tenantId ?? null
})

const scopeNotice = computed(() => {
  const id = requestedTenantId.value
  if (id === null) {
    return auth.isSuperAdmin
      ? '当前没有选定客户，这一屏不发请求、也不摆任何一家的数。请在右上角选一家客户。'
      : '登录信息里没有客户编号，这一屏不摆数。'
  }
  const code = auth.selectedTenantCode
  const who = auth.isSuperAdmin
    ? `当前看的是${code ? `客户「${code}」` : '选中的那一家客户'}（编号 #${id}）`
    : `当前看的是你所在客户（编号 #${id}）`
  return `${who}的运营数据。`
})

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * 本周 / 本月 / 本季各是「日历上说的那一段」到今天，不是「近 7/30/92 天」——
 * 标题上写着本周，柱子却从上周三开始，那是另一种谎报。
 */
const trendRange = computed(() => {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (trendPeriod.value === 'week') {
    const offsetFromMonday = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - offsetFromMonday)
  } else if (trendPeriod.value === 'month') {
    start.setDate(1)
  } else {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1)
  }
  return { startDate: isoDate(start), endDate: isoDate(today) }
})

const periodLabel = computed(() => `${trendRange.value.startDate} 至 ${trendRange.value.endDate}`)

const trendNotice = computed(() => {
  if (dashboardState.value === 'unreadable') return emptyLine.value
  if (dashboardState.value === 'failed') return `这一屏没读上来：${readError.value}`
  if (trendState.value === 'failed') return `浏览趋势没读上来：${trendError.value}`
  return ''
})

const pieNotice = computed(() => {
  if (dashboardState.value === 'unreadable') return emptyLine.value
  if (dashboardState.value === 'failed') return `这一屏没读上来：${readError.value}`
  if (pieState.value === 'failed') return `分类分布没读上来：${pieError.value}`
  return ''
})

const categoryTotal = computed(() => categoryData.value.reduce((sum, item) => sum + item.value, 0))

/** 真饼图：每一块的角度按这一家的真实分类数算，不是模板里写死的那五段固定角度 */
const pieGradient = computed(() => {
  const total = categoryTotal.value
  if (total <= 0) return ''
  let passed = 0
  const stops = categoryData.value.map(item => {
    const from = (passed / total) * 360
    passed += item.value
    const to = (passed / total) * 360
    return `${item.color} ${from}deg ${to}deg`
  })
  return `conic-gradient(${stops.join(', ')})`
})

function countText(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString()
}

function mapTrendData(data: TrafficTrendItem[]): { date: string; value: number; height: number }[] {
  if (data.length === 0) return []
  const maxValue = Math.max(...data.map(item => item.views)) || 1
  return data.map(item => ({
    date: item.date,
    value: item.views,
    height: item.views === 0 ? 0 : Math.max(4, (item.views / maxValue) * 90)
  }))
}

function mapCategoryData(data: CategoryDistributionItem[]): { name: string; value: number; color: string }[] {
  return data.map((item, index) => ({
    name: item.categoryName,
    value: item.count,
    color: chartColors[index % chartColors.length]
  }))
}

/** 92 天的柱子上每根都写日期会糊成一片：只写头尾与每月一号 */
function showTrendLabel(index: number): boolean {
  if (trendData.value.length <= 31) return true
  if (index === 0 || index === trendData.value.length - 1) return true
  return trendData.value[index].date.endsWith('-01')
}

function resetAll() {
  dashboardState.value = 'idle'
  emptyLine.value = ''
  readError.value = ''
  stats.totalViews = null
  stats.totalArticles = null
  stats.totalCases = null
  stats.todayActiveUsers = null
  trendData.value = []
  trendState.value = 'idle'
  trendError.value = ''
  categoryData.value = []
  pieState.value = 'idle'
  pieError.value = ''
}

async function loadDashboard(tenantId: number) {
  dashboardState.value = 'loading'
  try {
    const res = await operationApi.getDashboard(tenantId)
    if (!res) {
      dashboardState.value = 'failed'
      readError.value = '后端一个字没回'
      return
    }
    // 「这一家读不到」与「这一家什么都没干」是两件事，后端分两格说，界面分开念
    if (res.tenantUnreadable) {
      dashboardState.value = 'unreadable'
      emptyLine.value = res.emptyLine || '这一家读不到'
      return
    }
    dashboardState.value = 'ok'
    stats.totalViews = res.keyMetrics?.totalViews ?? 0
    stats.totalArticles = res.keyMetrics?.totalArticles ?? 0
    stats.totalCases = res.keyMetrics?.totalCases ?? 0
    stats.todayActiveUsers = res.today?.activeUsers ?? 0
  } catch (error) {
    logError('operation/operation-dashboard-view', '加载看板数据失败', error)
    dashboardState.value = 'failed'
    readError.value = describeHttpError(error)
  }
}

async function loadTrafficTrend(tenantId: number) {
  trendState.value = 'loading'
  trendError.value = ''
  try {
    const { startDate, endDate } = trendRange.value
    const res = await operationApi.getTrafficTrend(tenantId, 7, startDate, endDate)
    trendData.value = mapTrendData((res || []) as TrafficTrendItem[])
    trendState.value = 'ok'
  } catch (error) {
    logError('operation/operation-dashboard-view', '加载浏览趋势失败', error)
    trendData.value = []
    trendState.value = 'failed'
    trendError.value = describeHttpError(error)
  }
}

async function loadCategoryDistribution(tenantId: number) {
  pieState.value = 'loading'
  pieError.value = ''
  try {
    const res = await operationApi.getCategoryDistribution(tenantId)
    categoryData.value = mapCategoryData((res || []) as CategoryDistributionItem[])
    pieState.value = 'ok'
  } catch (error) {
    logError('operation/operation-dashboard-view', '加载分类分布失败', error)
    categoryData.value = []
    pieState.value = 'failed'
    pieError.value = describeHttpError(error)
  }
}

async function loadAllData() {
  const tenantId = requestedTenantId.value
  resetAll()
  if (tenantId === null) return

  loading.value = true
  try {
    await loadDashboard(tenantId)
    // 这一家读不到就别再往下问：那两口只会回空数组，摆出来的「没有数据」是假的
    if (dashboardState.value !== 'ok') return
    await Promise.all([loadTrafficTrend(tenantId), loadCategoryDistribution(tenantId)])
  } finally {
    loading.value = false
  }
}

watch(requestedTenantId, () => {
  loadAllData()
})

watch(trendPeriod, () => {
  const tenantId = requestedTenantId.value
  if (tenantId === null || dashboardState.value !== 'ok') return
  loadTrafficTrend(tenantId)
})

onMounted(() => {
  loadAllData()
})
</script>

<style scoped lang="less">
.operation-dashboard-page {
  width: 100%;
}

.scope-alert {
  margin-bottom: 16px;
}

.stat-card {
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &.main-stat {
    .stat-value {
      font-size: 28px;
    }
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 14px;
  color: #8c8c8c;
  margin-top: 4px;
}

.metric-footnote {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 16px;
}

.card-sub {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: #8c8c8c;
}

.chart-container {
  min-height: 300px;
  display: flex;
  align-items: flex-end;
  padding: 20px 0;
}

.chart-state {
  width: 100%;
  align-self: center;
  text-align: center;
  color: #8c8c8c;
  line-height: 1.8;
}

.chart-placeholder {
  display: flex;
  width: 100%;
  align-items: flex-end;
  height: 260px;
  gap: 4px;
  overflow-x: auto;
}

.chart-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1 0 auto;
  min-width: 18px;
}

.bar-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
  white-space: nowrap;
}

.bar-wrapper {
  width: 100%;
  max-width: 40px;
  height: 200px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 60%;
  background: linear-gradient(180deg, #1890ff 0%, #36cfc9 100%);
  border-radius: 4px 4px 0 0;
  position: relative;
  transition: height 0.3s;
  min-height: 2px;

  &:hover {
    background: linear-gradient(180deg, #40a9ff 0%, #5cdbd3 100%);
  }
}

.bar-value {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #1a1a1a;
  white-space: nowrap;
}

.pie-placeholder {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px 0;
  min-height: 260px;
}

.pie-chart {
  width: 120px;
  height: 120px;
  flex: 0 0 auto;
  border-radius: 50%;
  /* 兜底：数据没到时是一块灰饼，不是模板里那五段固定颜色 */
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    width: 80px;
    height: 80px;
    background: #fff;
    border-radius: 50%;
  }
}

.pie-center {
  position: relative;
  z-index: 1;
  text-align: center;
}

.pie-total {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
}

.pie-label {
  font-size: 12px;
  color: #8c8c8c;
}

.pie-legend {
  flex: 1;
  min-width: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;

  &:last-child {
    margin-bottom: 0;
  }
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-right: 8px;
}

.legend-name {
  flex: 1;
  color: #595959;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-value {
  font-weight: 500;
  color: #1a1a1a;
}
</style>
