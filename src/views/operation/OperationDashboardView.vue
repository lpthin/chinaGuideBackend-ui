<template>
  <div class="operation-dashboard-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card main-stat" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <EyeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalViews.toLocaleString() }}</div>
                <div class="stat-title">总浏览量</div>
                <div class="stat-trend up">
                  <ArrowUpOutlined /> {{ stats.viewGrowth }}%
                </div>
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
                <div class="stat-value">{{ stats.totalArticles.toLocaleString() }}</div>
                <div class="stat-title">文章总数</div>
                <div class="stat-trend up">
                  <ArrowUpOutlined /> {{ stats.articleGrowth }}%
                </div>
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
                <div class="stat-value">{{ stats.totalCases.toLocaleString() }}</div>
                <div class="stat-title">客户案例</div>
                <div class="stat-trend up">
                  <ArrowUpOutlined /> {{ stats.caseGrowth }}%
                </div>
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
                <div class="stat-value">{{ stats.totalUsers.toLocaleString() }}</div>
                <div class="stat-title">活跃用户</div>
                <div class="stat-trend down">
                  <ArrowDownOutlined /> {{ stats.userGrowth }}%
                </div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="16">
          <a-card title="浏览趋势" :bordered="false">
            <template #extra>
              <a-radio-group v-model:value="trendPeriod" button-style="solid" size="small">
                <a-radio-button value="week">本周</a-radio-button>
                <a-radio-button value="month">本月</a-radio-button>
                <a-radio-button value="quarter">本季</a-radio-button>
              </a-radio-group>
            </template>
            <div class="chart-container">
              <template v-if="trendData.length > 0">
                <div class="chart-placeholder">
                  <div v-for="(item, index) in trendData" :key="index" class="chart-bar">
                    <div class="bar-label">{{ item.date }}</div>
                    <div class="bar-wrapper">
                      <div class="bar" :style="{ height: `${item.height}%` }">
                        <span class="bar-value">{{ item.value.toLocaleString() }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <a-empty v-else description="暂无数据" />
            </div>
          </a-card>
        </a-col>

        <a-col :span="8">
          <a-card title="分类分布" :bordered="false">
            <div class="pie-placeholder">
              <template v-if="categoryData.length > 0">
                <div class="pie-chart">
                  <div class="pie-center">
                    <div class="pie-total">{{ stats.totalArticles }}</div>
                    <div class="pie-label">总文章</div>
                  </div>
                </div>
                <div class="pie-legend">
                  <div v-for="(item, index) in categoryData" :key="index" class="legend-item">
                    <span class="legend-color" :style="{ background: item.color }"></span>
                    <span class="legend-name">{{ item.name }}</span>
                    <span class="legend-value">{{ item.value }}</span>
                  </div>
                </div>
              </template>
              <a-empty v-else description="暂无数据" />
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16" style="margin-top: 16px">
        <a-col :span="12">
          <a-card title="热门文章 TOP10" :bordered="false">
            <a-empty v-if="topArticles.length === 0" description="暂无数据" />
            <a-list v-else :data-source="topArticles" :split="false">
              <template #renderItem="{ item, index }">
                <a-list-item class="rank-item">
                  <span class="rank-number" :class="{ top: index < 3 }">{{ index + 1 }}</span>
                  <div class="rank-content">
                    <div class="rank-title">{{ item.title }}</div>
                    <div class="rank-meta">
                      <span><EyeOutlined /> {{ item.viewCount }}</span>
                      <span><LikeOutlined /> {{ item.likeCount }}</span>
                    </div>
                  </div>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>

        <a-col :span="12">
          <a-card title="热门案例 TOP5" :bordered="false">
            <a-empty v-if="topCases.length === 0" description="暂无数据" />
            <a-list v-else :data-source="topCases" :split="false">
              <template #renderItem="{ item, index }">
                <a-list-item class="rank-item">
                  <span class="rank-number" :class="{ top: index < 3 }">{{ index + 1 }}</span>
                  <div class="rank-content">
                    <div class="rank-title">{{ item.title }}</div>
                    <div class="rank-meta">
                      <span><EyeOutlined /> {{ item.viewCount }}</span>
                      <span><LikeOutlined /> {{ item.likeCount }}</span>
                    </div>
                  </div>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>
      </a-row>

      <a-row style="margin-top: 16px">
        <a-col :span="24">
          <a-card title="最新动态" :bordered="false">
            <a-empty v-if="recentActivities.length === 0" description="暂无动态" />
            <a-timeline v-else>
              <a-timeline-item v-for="(item, index) in recentActivities" :key="index">
                <template #dot>
                  <component :is="item.icon" :style="{ color: item.color }" />
                </template>
                <div class="activity-content">
                  <div class="activity-title">{{ item.title }}</div>
                  <div class="activity-time">{{ item.time }}</div>
                </div>
              </a-timeline-item>
            </a-timeline>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  EyeOutlined,
  FileTextOutlined,
  ReadOutlined,
  UserOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  LikeOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MessageOutlined,
} from '@ant-design/icons-vue'
import { useAuthStore } from '../../stores/auth'
import { operationApi } from '../../api/operation'
import type {
  TrafficTrendItem,
  CategoryDistributionItem
} from '../../types/operation'

const auth = useAuthStore()

const loading = ref(false)
const trendPeriod = ref<'week' | 'month' | 'quarter'>('week')

const stats = reactive({
  totalViews: 0,
  viewGrowth: 0,
  totalArticles: 0,
  articleGrowth: 0,
  totalCases: 0,
  caseGrowth: 0,
  totalUsers: 0,
  userGrowth: 0,
})

const trendData = ref<{ date: string; value: number; height: number }[]>([])
const categoryData = ref<{ name: string; value: number; color: string }[]>([])
const topArticles = ref<{ title: string; viewCount: number; likeCount: number }[]>([])
const topCases = ref<{ title: string; viewCount: number; likeCount: number }[]>([])
const recentActivities = ref<{ title: string; time: string; icon: any; color: string }[]>([])

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

function getTenantId(): number {
  return auth.selectedTenantId || 0
}

function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function mapTrendData(data: TrafficTrendItem[]): { date: string; value: number; height: number }[] {
  if (data.length === 0) return []
  const maxValue = Math.max(...data.map(d => d.views)) || 1
  return data.map(item => ({
    date: item.date.substring(5),
    value: item.views,
    height: Math.max(10, (item.views / maxValue) * 90)
  }))
}

function mapCategoryData(data: CategoryDistributionItem[]): { name: string; value: number; color: string }[] {
  return data.map((item, index) => ({
    name: item.categoryName,
    value: item.count,
    color: chartColors[index % chartColors.length]
  }))
}

async function loadStats() {
  try {
    const res: any = await operationApi.getStats(getTenantId())
    stats.totalViews = res.totalViews || 0
    stats.totalArticles = res.totalArticles || 0
    stats.totalUsers = res.totalUsers || 0
    stats.totalCases = 0
  } catch (error) {
    console.error('加载统计数据失败', error)
    message.error('加载统计数据失败')
  }
}

async function loadTrafficTrend() {
  try {
    const res: any = await operationApi.getTrafficTrend(getTenantId(), 7)
    trendData.value = mapTrendData(res as TrafficTrendItem[])
    if (trendData.value.length >= 2) {
      const current = trendData.value[trendData.value.length - 1].value
      const previous = trendData.value[trendData.value.length - 2].value
      stats.viewGrowth = calculateGrowth(current, previous)
    }
  } catch (error) {
    console.error('加载流量趋势失败', error)
    message.error('加载流量趋势失败')
  }
}

async function loadCategoryDistribution() {
  try {
    const res: any = await operationApi.getCategoryDistribution(getTenantId())
    categoryData.value = mapCategoryData(res as CategoryDistributionItem[])
  } catch (error) {
    console.error('加载分类分布失败', error)
    message.error('加载分类分布失败')
  }
}

async function loadDashboard() {
  try {
    const res: any = await operationApi.getDashboard(getTenantId())
    if (res.keyMetrics) {
      stats.totalViews = res.keyMetrics.totalViews || 0
      stats.totalArticles = res.keyMetrics.totalArticles || 0
      stats.totalUsers = res.keyMetrics.totalUsers || 0
    }
    if (res.weeklyTrend && res.weeklyTrend.length > 0) {
      trendData.value = mapTrendData(res.weeklyTrend as TrafficTrendItem[])
    }
  } catch (error) {
    console.error('加载看板数据失败', error)
  }
}

async function loadAllData() {
  if (!auth.selectedTenantId) return
  loading.value = true
  try {
    await Promise.all([
      loadDashboard(),
      loadCategoryDistribution(),
    ])
  } catch (error) {
    console.error('数据加载失败', error)
    message.error('数据加载失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => auth.selectedTenantId,
  () => {
    loadAllData()
  }
)

onMounted(() => {
  loadAllData()
})
</script>

<style scoped lang="less">
.operation-dashboard-page {
  width: 100%;
}

.stat-card {
  cursor: pointer;
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

.stat-trend {
  font-size: 12px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;

  &.up {
    color: #52c41a;
  }

  &.down {
    color: #ff4d4f;
  }
}

.chart-container {
  height: 300px;
  display: flex;
  align-items: flex-end;
  padding: 20px 0;
}

.chart-placeholder {
  display: flex;
  width: 100%;
  justify-content: space-around;
  align-items: flex-end;
  height: 260px;
}

.chart-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.bar-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
}

.bar-wrapper {
  width: 40px;
  height: 200px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 32px;
  background: linear-gradient(180deg, #1890ff 0%, #36cfc9 100%);
  border-radius: 4px 4px 0 0;
  position: relative;
  transition: height 0.3s;
  min-height: 20px;

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
}

.pie-chart {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: conic-gradient(
    #1890ff 0deg 57deg,
    #52c41a 57deg 143deg,
    #faad14 143deg 180deg,
    #722ed1 180deg 274deg,
    #8c8c8c 274deg 360deg
  );
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
}

.legend-value {
  font-weight: 500;
  color: #1a1a1a;
}

.rank-item {
  padding: 12px 0 !important;
  display: flex;
  align-items: center;
  gap: 12px;
}

.rank-number {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
  color: #8c8c8c;

  &.top {
    background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
    color: #fff;
  }
}

.rank-content {
  flex: 1;
  min-width: 0;
}

.rank-title {
  font-size: 14px;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.rank-meta {
  font-size: 12px;
  color: #8c8c8c;
  display: flex;
  gap: 16px;

  span {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.activity-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.activity-title {
  font-size: 14px;
  color: #1a1a1a;
}

.activity-time {
  font-size: 12px;
  color: #8c8c8c;
}
</style>
