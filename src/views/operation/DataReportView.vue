<template>
  <div class="data-report-page">
    <a-spin :spinning="loading">
      <a-alert
        v-if="!tenantId"
        type="info"
        show-icon
        style="margin-bottom: 16px"
        message="还没选租户"
        description="页面顶部的租户下拉里先选一家，这里才会显示这家的报表。"
      />
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ fmtCount(stats.totalArticles) }}</div>
                <div class="stat-title">文章总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <EyeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ fmtCount(stats.totalViews) }}</div>
                <div class="stat-title">总浏览量</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <UserOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ fmtCount(stats.totalUsers) }}</div>
                <div class="stat-title">活跃用户</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffd666 100%)">
                <LikeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ fmtCount(stats.totalLikes) }}</div>
                <div class="stat-title">总互动量</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <!-- 筛选原塞在卡片 #title 槽（overflow:hidden 窄容器会裁切堆行），改用 FilterBar：筛选靠左、动作靠右 -->
        <filter-bar>
          <a-range-picker
            v-model:value="queryParams.dateRange"
            value-format="YYYY-MM-DD"
            style="width: 280px"
            :placeholder="['开始日期', '结束日期']"
            @change="loadData"
          />
          <template #actions>
            <a-space>
              <!-- 这一格只决定「导出哪一份」，点它不该重新拉一遍页面上的图表 -->
              <a-select
                v-model:value="queryParams.reportType"
                style="width: 150px"
                aria-label="导出内容"
              >
                <a-select-option value="article">导出：文章数据</a-select-option>
                <a-select-option value="knowledge">导出：知识库文档</a-select-option>
                <a-select-option value="user">导出：用户数据</a-select-option>
                <a-select-option value="traffic">导出：流量数据</a-select-option>
              </a-select>
              <a-button type="primary" :loading="exporting" @click="exportReport">
                <template #icon><DownloadOutlined /></template>
                导出报表
              </a-button>
            </a-space>
          </template>
        </filter-bar>

        <a-tabs v-model:activeKey="activeTab">
          <a-tab-pane key="overview" tab="数据概览">
            <a-row :gutter="16" style="margin-top: 16px">
              <a-col :span="16">
                <a-card title="流量趋势" size="small">
                  <div class="chart-container">
                    <template v-if="chartData.length > 0">
                      <div class="chart-bar-group">
                        <div
                          v-for="(item, index) in chartData"
                          :key="index"
                          class="chart-bar-item"
                        >
                          <div class="bar-value">{{ item.value }}</div>
                          <div
                            class="bar"
                            :style="{ height: `${(item.value / maxValue) * 200}px` }"
                          ></div>
                          <div class="bar-label">{{ item.date }}</div>
                        </div>
                      </div>
                    </template>
                    <a-empty v-else :description="emptyText('trend')" />
                  </div>
                </a-card>
              </a-col>
              <a-col :span="8">
                <a-card title="分类占比" size="small">
                  <div class="pie-chart-container">
                    <template v-if="categoryData.length > 0">
                      <div class="pie-legend">
                        <div
                          v-for="(item, index) in categoryData"
                          :key="index"
                          class="legend-item"
                        >
                          <span
                            class="legend-color"
                            :style="{ background: item.color }"
                          ></span>
                          <span class="legend-name">{{ item.name }}</span>
                          <span class="legend-value">{{ item.value }}篇</span>
                          <span class="legend-percent">{{ item.percent }}%</span>
                        </div>
                      </div>
                    </template>
                    <a-empty v-else :description="emptyText('category')" />
                  </div>
                </a-card>
              </a-col>
            </a-row>
          </a-tab-pane>

          <a-tab-pane key="user" tab="用户分析">
            <a-row :gutter="16" style="margin-top: 16px">
              <a-col :span="12">
                <a-card title="用户增长趋势" size="small">
                  <div class="chart-container">
                    <template v-if="userGrowthData.length > 0">
                      <div class="chart-line">
                        <div
                          v-for="(item, index) in userGrowthData"
                          :key="index"
                          class="line-point"
                          :style="{ left: `${(index / (userGrowthData.length - 1)) * 100}%`, bottom: `${(item.value / 500) * 100}%` }"
                        >
                          <div class="point-tooltip">{{ item.value }}人</div>
                        </div>
                      </div>
                    </template>
                    <a-empty v-else :description="emptyText('growth')" />
                  </div>
                </a-card>
              </a-col>
              <a-col :span="12">
                <a-card title="用户活跃度" size="small">
                  <template v-if="userActivityData.length > 0">
                    <a-list size="small" :data-source="userActivityData">
                      <template #renderItem="{ item }">
                        <a-list-item>
                          <span>{{ item.name }}</span>
                          <a-progress
                            :percent="item.value"
                            :stroke-color="item.color"
                            size="small"
                            style="width: 200px"
                          />
                          <span>{{ item.value }}%</span>
                        </a-list-item>
                      </template>
                    </a-list>
                  </template>
                  <a-empty v-else :description="emptyText('activity')" />
                </a-card>
              </a-col>
            </a-row>
          </a-tab-pane>

          <a-tab-pane key="source" tab="来源分析">
            <a-row :gutter="16" style="margin-top: 16px">
              <a-col :span="12">
                <a-card title="流量来源" size="small">
                  <div class="source-list">
                    <template v-if="sourceData.length > 0">
                      <div
                        v-for="(item, index) in sourceData"
                        :key="index"
                        class="source-item"
                      >
                        <div class="source-header">
                          <span class="source-name">{{ item.name }}</span>
                          <span class="source-percent">{{ item.percent }}%</span>
                        </div>
                        <a-progress
                          :percent="item.percent"
                          :stroke-color="item.color"
                          size="small"
                          :show-info="false"
                        />
                        <div class="source-detail">
                          <span>访问量：{{ item.visits.toLocaleString() }}</span>
                          <span>占比：{{ item.percent }}%</span>
                        </div>
                      </div>
                    </template>
                    <a-empty v-else :description="emptyText('source')" />
                  </div>
                </a-card>
              </a-col>
              <a-col :span="12">
                <a-card title="设备分布" size="small">
                  <div class="device-list">
                    <template v-if="deviceData.length > 0">
                      <div
                        v-for="(item, index) in deviceData"
                        :key="index"
                        class="device-item"
                      >
                        <div class="device-icon" :style="{ background: item.color }">
                          <component :is="item.icon" />
                        </div>
                        <div class="device-info">
                          <div class="device-name">{{ item.name }}</div>
                          <div class="device-stats">
                            <span>访问：{{ item.visits.toLocaleString() }}</span>
                            <span>占比：{{ item.percent }}%</span>
                          </div>
                        </div>
                      </div>
                    </template>
                    <a-empty v-else :description="emptyText('device')" />
                  </div>
                </a-card>
              </a-col>
            </a-row>
          </a-tab-pane>
        </a-tabs>
      </a-card>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  EyeOutlined,
  UserOutlined,
  LikeOutlined,
  DownloadOutlined,
  MobileOutlined,
  TabletOutlined,
  DesktopOutlined,
} from '@ant-design/icons-vue'
import { operationApi } from '../../api/operation'
import { useAuthStore } from '../../stores/auth'
import { logError } from '../../utils/errorLog'
import FilterBar from '../../components/FilterBar.vue'
import type {
  TrafficTrendItem,
  CategoryDistributionItem,
  UserGrowthItem,
  UserActivityItem,
  TrafficSourceItem,
  DeviceDistributionItem
} from '../../types/operation'

const authStore = useAuthStore()
const loading = ref(false)
const activeTab = ref('overview')

/** 读不到就是 null、界面摆「—」：这四格以前恒 0，读失败和「真的是 0」长得一模一样 */
const stats = reactive<{
  totalArticles: number | null
  totalViews: number | null
  totalUsers: number | null
  totalLikes: number | null
}>({
  totalArticles: null,
  totalViews: null,
  totalUsers: null,
  totalLikes: null,
})

type SectionKey = 'trend' | 'category' | 'growth' | 'activity' | 'source' | 'device'

const sectionNames: Record<SectionKey, string> = {
  trend: '流量趋势',
  category: '分类占比',
  growth: '用户增长趋势',
  activity: '用户活跃度',
  source: '流量来源',
  device: '设备分布',
}

/** 哪一块是「这次没取到」，而不是「这段时间真的没有数据」——这两件事不许写成同一句话 */
const failed = reactive<Record<SectionKey, boolean>>({
  trend: false,
  category: false,
  growth: false,
  activity: false,
  source: false,
  device: false,
})

const queryParams = reactive({
  /** 只决定导出哪一份，不参与页面取数 */
  reportType: 'article',
  /** 先头 a-range-picker 的 value-format 已把它变成 ['YYYY-MM-DD','YYYY-MM-DD'] 字符串；清空时是 null */
  dateRange: null as string[] | null,
})

const exporting = ref(false)

const hasDateRange = computed(
  () => Array.isArray(queryParams.dateRange) && queryParams.dateRange.length === 2
)

/** 超管看选中的那一家，普通用户看自己登录态里那家；以前只认选中态，普通租户管理员整屏恒 0 */
const tenantId = computed<number>(() => authStore.selectedTenantId || authStore.tenantId || 0)

function emptyText(key: SectionKey): string {
  return failed[key]
    ? `${sectionNames[key]}这次没取到，页面顶部的提示里有原因；把日期改一下再试`
    : '这段时间没有数据'
}

function fmtCount(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString()
}

function asCount(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

/** 选了区间就按区间查；没选就让后端按各自默认口径（最近 7 天 / 6 个月 / 30 天） */
function dateParams(): { startDate?: string; endDate?: string } {
  if (!hasDateRange.value) return {}
  return { startDate: queryParams.dateRange![0], endDate: queryParams.dateRange![1] }
}

const chartData = ref<{ date: string; value: number }[]>([])
const maxValue = computed(() => {
  if (chartData.value.length === 0) return 0
  return Math.max(...chartData.value.map(d => d.value))
})

const categoryData = ref<{ name: string; value: number; color: string; percent: number }[]>([])

const userGrowthData = ref<{ date: string; value: number }[]>([])
const userActivityData = ref<{ name: string; value: number; color: string }[]>([])
const sourceData = ref<{ name: string; visits: number; percent: number; color: string }[]>([])
const deviceData = ref<{ name: string; visits: number; percent: number; color: string; icon: any }[]>([])

const iconMap: Record<string, any> = {
  mobile: MobileOutlined,
  tablet: TabletOutlined,
  desktop: DesktopOutlined,
  MobileOutlined,
  TabletOutlined,
  DesktopOutlined,
}

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

function mapTrafficTrend(data: TrafficTrendItem[]): { date: string; value: number }[] {
  return data.map(item => ({
    date: item.date,
    value: item.views
  }))
}

function mapCategoryDistribution(data: CategoryDistributionItem[]): { name: string; value: number; color: string; percent: number }[] {
  const total = data.reduce((sum, item) => sum + item.count, 0) || 1
  return data.map((item, index) => ({
    name: item.categoryName,
    value: item.count,
    color: chartColors[index % chartColors.length],
    percent: Math.round((item.count / total) * 100)
  }))
}

function mapUserGrowth(data: UserGrowthItem[]): { date: string; value: number }[] {
  return data.map(item => ({
    date: item.month,
    value: item.newUsers
  }))
}

function mapUserActivity(data: UserActivityItem[]): { name: string; value: number; color: string }[] {
  return data.map((item, index) => ({
    name: item.description,
    value: item.count,
    color: chartColors[index % chartColors.length]
  }))
}

function mapTrafficSource(data: TrafficSourceItem[]): { name: string; visits: number; percent: number; color: string }[] {
  const total = data.reduce((sum, item) => sum + item.count, 0) || 1
  return data.map((item, index) => ({
    name: item.source,
    visits: item.count,
    percent: Math.round((item.count / total) * 100),
    color: chartColors[index % chartColors.length]
  }))
}

function mapDeviceDistribution(data: DeviceDistributionItem[]): { name: string; visits: number; percent: number; color: string; icon: any }[] {
  const total = data.reduce((sum, item) => sum + item.count, 0) || 1
  return data.map((item, index) => ({
    name: item.device,
    visits: item.count,
    percent: Math.round((item.count / total) * 100),
    color: chartColors[index % chartColors.length],
    icon: iconMap[item.deviceKey] || DesktopOutlined
  }))
}

function errText(error: unknown): string {
  return (error as Error | null)?.message || '未知原因'
}

function clearStats() {
  stats.totalArticles = null
  stats.totalViews = null
  stats.totalUsers = null
  stats.totalLikes = null
}

async function loadStats() {
  if (!tenantId.value) {
    clearStats()
    return
  }
  try {
    const { startDate, endDate } = dateParams()
    const res: any = await operationApi.getStats(tenantId.value, startDate, endDate)
    stats.totalArticles = asCount(res?.totalArticles)
    stats.totalViews = asCount(res?.totalViews)
    stats.totalUsers = asCount(res?.totalUsers)
    stats.totalLikes = asCount(res?.totalLikes)
  } catch (error) {
    clearStats()
    logError('operation/data-report-view', '加载统计数据失败', error)
    message.error(`四张统计卡这次没取到：${errText(error)}`)
  }
}

async function loadTrafficTrend() {
  if (!tenantId.value) {
    chartData.value = []
    return
  }
  try {
    const { startDate, endDate } = dateParams()
    const res: any = await operationApi.getTrafficTrend(tenantId.value, 7, startDate, endDate)
    chartData.value = mapTrafficTrend(res || [])
    failed.trend = false
  } catch (error) {
    chartData.value = []
    failed.trend = true
    logError('operation/data-report-view', '加载流量趋势失败', error)
    message.error(`流量趋势这次没取到：${errText(error)}`)
  }
}

async function loadCategoryDistribution() {
  if (!tenantId.value) {
    categoryData.value = []
    return
  }
  try {
    const { startDate, endDate } = dateParams()
    const res: any = await operationApi.getCategoryDistribution(tenantId.value, startDate, endDate)
    categoryData.value = mapCategoryDistribution(res || [])
    failed.category = false
  } catch (error) {
    categoryData.value = []
    failed.category = true
    logError('operation/data-report-view', '加载分类分布失败', error)
    message.error(`分类占比这次没取到：${errText(error)}`)
  }
}

async function loadUserGrowth() {
  if (!tenantId.value) {
    userGrowthData.value = []
    return
  }
  try {
    const { startDate, endDate } = dateParams()
    const res: any = await operationApi.getUserGrowth(tenantId.value, 6, startDate, endDate)
    userGrowthData.value = mapUserGrowth(res || [])
    failed.growth = false
  } catch (error) {
    userGrowthData.value = []
    failed.growth = true
    logError('operation/data-report-view', '加载用户增长失败', error)
    message.error(`用户增长趋势这次没取到：${errText(error)}`)
  }
}

async function loadUserActivity() {
  if (!tenantId.value) {
    userActivityData.value = []
    return
  }
  try {
    const { startDate, endDate } = dateParams()
    const res: any = await operationApi.getUserActivity(tenantId.value, startDate, endDate)
    userActivityData.value = mapUserActivity(res || [])
    failed.activity = false
  } catch (error) {
    userActivityData.value = []
    failed.activity = true
    logError('operation/data-report-view', '加载用户活跃度失败', error)
    message.error(`用户活跃度这次没取到：${errText(error)}`)
  }
}

async function loadTrafficSource() {
  if (!tenantId.value) {
    sourceData.value = []
    return
  }
  try {
    const { startDate, endDate } = dateParams()
    const res: any = await operationApi.getTrafficSource(tenantId.value, startDate, endDate)
    sourceData.value = mapTrafficSource(res || [])
    failed.source = false
  } catch (error) {
    sourceData.value = []
    failed.source = true
    logError('operation/data-report-view', '加载流量来源失败', error)
    message.error(`流量来源这次没取到：${errText(error)}`)
  }
}

async function loadDeviceDistribution() {
  if (!tenantId.value) {
    deviceData.value = []
    return
  }
  try {
    const { startDate, endDate } = dateParams()
    const res: any = await operationApi.getDeviceDistribution(tenantId.value, startDate, endDate)
    deviceData.value = mapDeviceDistribution(res || [])
    failed.device = false
  } catch (error) {
    deviceData.value = []
    failed.device = true
    logError('operation/data-report-view', '加载设备分布失败', error)
    message.error(`设备分布这次没取到：${errText(error)}`)
  }
}

async function loadAllData() {
  if (!tenantId.value) {
    clearStats()
    chartData.value = []
    categoryData.value = []
    userGrowthData.value = []
    userActivityData.value = []
    sourceData.value = []
    deviceData.value = []
    return
  }
  loading.value = true
  try {
    // 七个口各自把失败原因说出来，这里不再叠一句笼统的「数据加载失败」
    await Promise.all([
      loadStats(),
      loadTrafficTrend(),
      loadCategoryDistribution(),
      loadUserGrowth(),
      loadUserActivity(),
      loadTrafficSource(),
      loadDeviceDistribution(),
    ])
  } finally {
    loading.value = false
  }
}

function loadData() {
  if (hasDateRange.value && queryParams.dateRange![0] > queryParams.dateRange![1]) {
    message.warning('开始日期不能晚于结束日期：把日期改一下，页面留着上一份读数不动')
    return
  }
  loadAllData()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const exportLabels: Record<string, string> = {
  article: '文章数据',
  knowledge: '知识库文档',
  user: '用户数据',
  traffic: '流量数据',
}

/** 后端把单元格里的换行压成了空格，所以一行就是一条记录；第一行是表头 */
function countCsvRows(csv: string): number {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim() !== '')
  return Math.max(0, lines.length - 1)
}

function jsonReason(text: string): string {
  try {
    const body = JSON.parse(text)
    return body?.message || body?.msg || String(body?.code ?? '') || '后端拒绝了这次导出'
  } catch {
    return text.slice(0, 200) || '后端拒绝了这次导出'
  }
}

async function exportReport() {
  if (!tenantId.value) {
    message.warning('先在页面顶部选一家租户，再导出这家的报表')
    return
  }
  if (hasDateRange.value && queryParams.dateRange![0] > queryParams.dateRange![1]) {
    message.warning('开始日期不能晚于结束日期，先改日期再导出')
    return
  }
  const type = queryParams.reportType
  const label = exportLabels[type] || type
  exporting.value = true
  message.loading({ content: `正在导出${label}…`, key: 'export' })
  try {
    const { startDate, endDate } = dateParams()
    const payload: any = await operationApi.exportStats(
      tenantId.value,
      type as 'article' | 'knowledge' | 'user' | 'traffic',
      startDate,
      endDate
    )
    // responseType:'blob' 下，后端拒绝时回来的也是 Blob（内容其实是 JSON）；
    // 不看形状就 downloadBlob，等于把一句错误原因存成 .csv 还念「导出成功」
    if (!(payload instanceof Blob)) {
      message.error({ content: '没导出：后端回的既不是文件也不是错误说明', key: 'export' })
      return
    }
    // 成功那一支后端一定回 text/csv；导到一半炸掉时后端回的是 500 + 一句「导出失败: …」，
    // 不看类型就存盘，等于把报错正文存成 .csv 还念「已导出」
    const bodyType = (payload.type || '').toLowerCase()
    if (bodyType.includes('json') || !bodyType.includes('csv')) {
      message.error({ content: `没导出：${jsonReason(await payload.text())}`, key: 'export' })
      return
    }
    if (payload.size === 0) {
      message.error({ content: '没导出：拿到的是空文件', key: 'export' })
      return
    }
    const rows = countCsvRows(await payload.text())
    const range = hasDateRange.value ? `_${queryParams.dateRange![0]}_${queryParams.dateRange![1]}` : ''
    downloadBlob(payload, `${label}${range}.csv`)
    message.success({ content: `已导出${label}，共 ${rows} 行`, key: 'export' })
  } catch (error) {
    logError('operation/data-report-view', '导出失败', error)
    message.error({ content: `没导出：${errText(error)}`, key: 'export' })
  } finally {
    exporting.value = false
  }
}

watch(tenantId, () => {
  loadAllData()
})

onMounted(() => {
  loadAllData()
})
</script>

<style scoped lang="less">
.data-report-page {
  width: 100%;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
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
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.chart-container {
  height: 280px;
  padding: 20px 0;
  position: relative;
}

.chart-bar-group {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 100%;
  padding-bottom: 40px;
  position: relative;
}

.chart-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;
}

.bar-value {
  font-size: 12px;
  color: #1a1a1a;
  font-weight: 500;
  margin-bottom: 8px;
}

.bar {
  width: 40px;
  background: linear-gradient(180deg, #1890ff 0%, #36cfc9 100%);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: height 0.3s;
}

.bar-label {
  position: absolute;
  bottom: -24px;
  font-size: 12px;
  color: #8c8c8c;
}

.pie-chart-container {
  padding: 16px 0;
}

.pie-legend {
  .legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      margin-right: 8px;
    }

    .legend-name {
      flex: 1;
      font-size: 13px;
      color: #595959;
    }

    .legend-value {
      font-size: 13px;
      font-weight: 500;
      color: #1a1a1a;
      margin-right: 16px;
    }

    .legend-percent {
      font-size: 13px;
      color: #8c8c8c;
    }
  }
}

.growth-up {
  color: #52c41a;
}

.growth-down {
  color: #ff4d4f;
}

.chart-line {
  position: relative;
  height: 200px;
  border-bottom: 1px solid #e8e8e8;
  border-left: 1px solid #e8e8e8;
  margin: 20px;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: #f5f5f5;
  }

  &::after {
    content: '';
    position: absolute;
    top: 25%;
    left: 0;
    right: 0;
    height: 1px;
    background: #f5f5f5;
  }
}

.line-point {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1890ff;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.4);
  transform: translateX(-50%);

  &:hover .point-tooltip {
    opacity: 1;
    visibility: visible;
  }
}

.point-tooltip {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #1a1a1a;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s;

  &::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 4px 4px 0;
    border-style: solid;
    border-color: #1a1a1a transparent transparent;
  }
}

.source-list {
  padding: 8px 0;

  .source-item {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    .source-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;

      .source-name {
        font-weight: 500;
        color: #1a1a1a;
      }

      .source-percent {
        color: #8c8c8c;
      }
    }

    .source-detail {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 12px;
      color: #8c8c8c;
    }
  }
}

.device-list {
  padding: 8px 0;

  .device-item {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }

    .device-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
    }

    .device-info {
      flex: 1;

      .device-name {
        font-weight: 500;
        color: #1a1a1a;
        margin-bottom: 4px;
      }

      .device-stats {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: #8c8c8c;
      }
    }
  }
}
</style>
