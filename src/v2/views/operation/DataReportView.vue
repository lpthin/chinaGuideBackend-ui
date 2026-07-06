<template>
  <div class="data-report-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalArticles }}</div>
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
                <div class="stat-value">{{ stats.totalViews.toLocaleString() }}</div>
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
                <div class="stat-value">{{ stats.totalUsers }}</div>
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
                <div class="stat-value">{{ stats.totalLikes.toLocaleString() }}</div>
                <div class="stat-title">总互动量</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <template #title>
          <a-space>
            <a-select
              v-model:value="queryParams.reportType"
              style="width: 150px"
              placeholder="报表类型"
              @change="loadData"
            >
              <a-select-option value="article">文章数据</a-select-option>
              <a-select-option value="knowledge">知识库数据</a-select-option>
              <a-select-option value="user">用户数据</a-select-option>
              <a-select-option value="traffic">流量数据</a-select-option>
            </a-select>
            <a-range-picker
              v-model:value="queryParams.dateRange"
              style="width: 300px"
              @change="loadData"
            />
            <a-button type="primary" @click="exportReport">
              <template #icon><DownloadOutlined /></template>
              导出报表
            </a-button>
          </a-space>
        </template>

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
                    <a-empty v-else description="暂无数据" />
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
                    <a-empty v-else description="暂无数据" />
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
                    <a-empty v-else description="暂无数据" />
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
                  <a-empty v-else description="暂无数据" />
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
                    <a-empty v-else description="暂无数据" />
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
                    <a-empty v-else description="暂无数据" />
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

const stats = reactive({
  totalArticles: 0,
  totalViews: 0,
  totalUsers: 0,
  totalLikes: 0,
})

const queryParams = reactive({
  reportType: 'article',
  dateRange: [] as any[],
})

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

function getTenantId(): number {
  return authStore.selectedTenantId || 0
}

async function loadStats() {
  try {
    const res = await operationApi.getStats(getTenantId())
    Object.assign(stats, res as any)
  } catch (error) {
    console.error('加载统计数据失败', error)
    message.error('加载统计数据失败')
  }
}

async function loadTrafficTrend() {
  try {
    const res = await operationApi.getTrafficTrend(getTenantId(), 7)
    chartData.value = mapTrafficTrend(res as any)
  } catch (error) {
    console.error('加载流量趋势失败', error)
    message.error('加载流量趋势失败')
  }
}

async function loadCategoryDistribution() {
  try {
    const res = await operationApi.getCategoryDistribution(getTenantId())
    categoryData.value = mapCategoryDistribution(res as any)
  } catch (error) {
    console.error('加载分类分布失败', error)
    message.error('加载分类分布失败')
  }
}

async function loadUserGrowth() {
  try {
    const res = await operationApi.getUserGrowth(getTenantId(), 6)
    userGrowthData.value = mapUserGrowth(res as any)
  } catch (error) {
    console.error('加载用户增长失败', error)
    message.error('加载用户增长失败')
  }
}

async function loadUserActivity() {
  try {
    const res = await operationApi.getUserActivity(getTenantId())
    userActivityData.value = mapUserActivity(res as any)
  } catch (error) {
    console.error('加载用户活跃度失败', error)
    message.error('加载用户活跃度失败')
  }
}

async function loadTrafficSource() {
  try {
    const res = await operationApi.getTrafficSource(getTenantId())
    sourceData.value = mapTrafficSource(res as any)
  } catch (error) {
    console.error('加载流量来源失败', error)
    message.error('加载流量来源失败')
  }
}

async function loadDeviceDistribution() {
  try {
    const res = await operationApi.getDeviceDistribution(getTenantId())
    deviceData.value = mapDeviceDistribution(res as any)
  } catch (error) {
    console.error('加载设备分布失败', error)
    message.error('加载设备分布失败')
  }
}

async function loadAllData() {
  if (!authStore.selectedTenantId) return
  loading.value = true
  try {
    await Promise.all([
      loadStats(),
      loadTrafficTrend(),
      loadCategoryDistribution(),
      loadUserGrowth(),
      loadUserActivity(),
      loadTrafficSource(),
      loadDeviceDistribution(),
    ])
  } catch (error) {
    console.error('数据加载失败', error)
    message.error('数据加载失败')
  } finally {
    loading.value = false
  }
}

function loadData() {
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

async function exportReport() {
  try {
    message.loading({ content: '正在生成报表...', key: 'export' })
    const typeMap: Record<string, 'article' | 'traffic' | 'user'> = {
      article: 'article',
      knowledge: 'article',
      user: 'user',
      traffic: 'traffic'
    }
    const exportType = typeMap[queryParams.reportType] || 'article'
    const blob: any = await operationApi.exportStats(getTenantId(), exportType, 'excel')
    const filenameMap: Record<string, string> = {
      article: '文章数据报表.csv',
      knowledge: '知识库数据报表.csv',
      user: '用户数据报表.csv',
      traffic: '流量数据报表.csv'
    }
    const filename = filenameMap[queryParams.reportType] || '统计报表.csv'
    downloadBlob(blob, filename)
    message.success({ content: '报表导出成功', key: 'export' })
  } catch (error) {
    console.error('导出失败', error)
    message.error({ content: '导出失败', key: 'export' })
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    loadAllData()
  }
)

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
