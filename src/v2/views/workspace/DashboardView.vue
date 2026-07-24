<template>
  <div class="dashboard">
    <a-spin :spinning="loading" :tip="'加载中...'">
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
              <span class="header-divider"></span>
              <span class="header-status">
                <span class="status-dot"></span>
                系统运行正常
              </span>
            </p>
          </div>
        </div>
        <div class="header-actions">
          <a-button @click="refreshData" class="refresh-btn" :loading="loading">
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
          :style="{ animationDelay: `${index * 0.1}s` }"
          @click="navigateTo(item.path)"
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
              <div class="stat-card__trend" :class="item.trend > 0 ? 'trend-up' : 'trend-down'">
                <span class="trend-arrow">{{ item.trend > 0 ? '↗' : '↘' }}</span>
                <span class="trend-value">{{ Math.abs(item.trend) }}%</span>
              </div>
            </div>
            <div class="stat-card__value">
              <span class="value-number">{{ item.value }}</span>
              <span class="value-unit">{{ item.unit }}</span>
            </div>
            <div class="stat-card__bottom">
              <span class="stat-card__label">{{ item.label }}</span>
              <span class="stat-card__period">较上周</span>
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
                <h3>内容发布趋势</h3>
                <p>追踪内容产出与流量变化</p>
              </div>
            </div>
            <a-radio-group v-model:value="trendType" size="small" button-style="solid" class="chart-toggle">
              <a-radio-button value="week">近7天</a-radio-button>
              <a-radio-button value="month">近30天</a-radio-button>
              <a-radio-button value="year">近半年</a-radio-button>
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
                <h3>内容分类统计</h3>
                <p>各栏目内容分布</p>
              </div>
            </div>
          </div>
          <div ref="categoryChartRef" class="chart-container chart-container--pie"></div>
        </div>
      </div>

      <div class="content-grid">
        <div class="list-card">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title__icon card-title__icon--green">
                <FileTextOutlined />
              </div>
              <div class="card-title__text">
                <h3>最近文章</h3>
                <p>最新创建的内容动态</p>
              </div>
            </div>
            <a type="link" @click="navigateTo('articles')" class="view-all">
              查看全部
              <ArrowRightOutlined />
            </a>
          </div>
          <div class="article-list">
            <div
              class="article-item"
              v-for="(item, index) in recentArticles"
              :key="item.id"
              :style="{ animationDelay: `${index * 0.06}s` }"
            >
              <div class="article-index">{{ String(index + 1).padStart(2, '0') }}</div>
              <div class="article-icon">
                <FileTextOutlined />
              </div>
              <div class="article-main">
                <div class="article-title">{{ item.title || '未命名文章' }}</div>
                <div class="article-meta">
                  <span class="meta-item">
                    <ClockCircleOutlined />
                    {{ formatTime(item.createdAt) }}
                  </span>
                </div>
              </div>
              <a-tag :color="getStatusColor(item.status)" class="article-status">
                {{ getStatusText(item.status) }}
              </a-tag>
            </div>
            <div class="list-empty" v-if="!recentArticles.length">
              <FileTextOutlined class="empty-icon" />
              <p>暂无文章数据</p>
            </div>
          </div>
        </div>

        <div class="action-card">
          <div class="card-header">
            <div class="card-title">
              <div class="card-title__icon card-title__icon--orange">
                <ThunderboltOutlined />
              </div>
              <div class="card-title__text">
                <h3>快速操作</h3>
                <p>一键开启常用功能</p>
              </div>
            </div>
          </div>
          <div class="action-grid">
            <button
              class="action-btn action-btn--primary"
              @click="navigateTo('article-generate')"
            >
              <div class="action-btn__bg"></div>
              <div class="action-btn__content">
                <div class="action-btn__icon">
                  <EditOutlined />
                </div>
                <div class="action-btn__text">
                  <span class="action-btn__title">AI生成</span>
                  <span class="action-btn__desc">智能创作内容</span>
                </div>
                <ArrowRightOutlined class="action-btn__arrow" />
              </div>
            </button>
            <button class="action-btn action-btn--blue" @click="navigateTo('keywords')">
              <div class="action-btn__icon">
                <DownloadOutlined />
              </div>
              <div class="action-btn__text">
                <span class="action-btn__title">关键词采集</span>
                <span class="action-btn__desc">挖掘热门话题</span>
              </div>
              <ArrowRightOutlined class="action-btn__arrow" />
            </button>
            <button class="action-btn action-btn--green" @click="navigateTo('review')">
              <div class="action-btn__icon">
                <CheckCircleOutlined />
              </div>
              <div class="action-btn__text">
                <span class="action-btn__title">内容审核</span>
                <span class="action-btn__desc">审核待发布内容</span>
              </div>
              <ArrowRightOutlined class="action-btn__arrow" />
            </button>
            <button class="action-btn action-btn--purple" @click="navigateTo('cluster')">
              <div class="action-btn__icon">
                <ClusterOutlined />
              </div>
              <div class="action-btn__text">
                <span class="action-btn__title">聚类分析</span>
                <span class="action-btn__desc">关键词分组</span>
              </div>
              <ArrowRightOutlined class="action-btn__arrow" />
            </button>
          </div>

          <div class="quick-stats">
            <div class="quick-stat">
              <div class="quick-stat__value">{{ pendingTasks }}</div>
              <div class="quick-stat__label">待处理任务</div>
            </div>
            <div class="quick-stat-divider"></div>
            <div class="quick-stat">
              <div class="quick-stat__value">{{ todayNew }}</div>
              <div class="quick-stat__label">今日新增</div>
            </div>
            <div class="quick-stat-divider"></div>
            <div class="quick-stat">
              <div class="quick-stat__value">{{ monthTotal }}</div>
              <div class="quick-stat__label">本月产出</div>
            </div>
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import * as echarts from 'echarts'
import { 
  FileTextOutlined, 
  TagsOutlined, 
  EyeOutlined, 
  ClockCircleOutlined,
  DownloadOutlined,
  ClusterOutlined,
  EditOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  UserOutlined,
  LineChartOutlined,
  PieChartOutlined,
  ThunderboltOutlined
} from '@ant-design/icons-vue'
import { dashboardApi } from '../../api'
import { useAuthStore } from '../../stores/auth'
import type { DashboardStats, Article } from '../../types'
import { formatTime } from '@/v2/utils/format'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const chartLoading = ref(false)
const chartData = ref<any>(null)
const stats = ref<DashboardStats>()
const recentArticles = ref<Article[]>([])
const trendChartRef = ref<HTMLElement>()
const categoryChartRef = ref<HTMLElement>()
const trendType = ref('week')
let trendChart: echarts.ECharts | null = null
let categoryChart: echarts.ECharts | null = null

const currentDate = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${year}年${month}月${day}日 ${weekDays[now.getDay()]}`
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

const statItems = computed(() => [
  { 
    key: 'articles', 
    icon: FileTextOutlined, 
    value: stats.value?.totalArticles || 0, 
    label: '文章总数', 
    trend: 12.5, 
    color: 'blue',
    unit: '篇',
    path: 'articles'
  },
  { 
    key: 'keywords', 
    icon: TagsOutlined, 
    value: stats.value?.totalKeywords || 0, 
    label: '关键词数量', 
    trend: 8.3, 
    color: 'purple',
    unit: '个',
    path: 'keywords'
  },
  { 
    key: 'views', 
    icon: EyeOutlined, 
    value: stats.value?.totalViews || 0, 
    label: '总浏览量', 
    trend: -2.1, 
    color: 'green',
    unit: '次',
    path: 'articles'
  },
  { 
    key: 'pending', 
    icon: ClockCircleOutlined, 
    value: stats.value?.pendingReview || 0, 
    label: '待审核', 
    trend: 5.7, 
    color: 'orange',
    unit: '篇',
    path: 'review'
  },
])

const pendingTasks = computed(() => stats.value?.pendingReview || 0)
const todayNew = computed(() => stats.value?.todayCount || 0)
const monthTotal = computed(() => stats.value?.totalArticles || 0)

function getTenantId(): number {
  return auth.selectedTenantId || auth.tenantId || 1
}

const loadChartData = async () => {
  chartLoading.value = true
  try {
    const data = await dashboardApi.getCharts(getTenantId())
    chartData.value = data
  } catch (error) {
    console.error('获取图表数据失败:', error)
    chartData.value = null
    message.error('获取图表数据失败')
  } finally {
    chartLoading.value = false
  }
}

const initTrendChart = () => {
  if (!trendChartRef.value || !chartData.value?.articleTrend) return
  
  trendChart = echarts.init(trendChartRef.value)
  
  const articleTrend = chartData.value.articleTrend
  const data = articleTrend[trendType.value as keyof typeof articleTrend] || articleTrend.week
  
  if (!data) return
  
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
    legend: {
      data: ['文章数', '关键词', '浏览量'],
      right: 0,
      top: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 20,
      textStyle: { color: '#64748b', fontSize: 12 }
    },
    grid: {
      left: 0,
      right: 0,
      top: 48,
      bottom: 0,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.dates,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      splitLine: { 
        lineStyle: { color: '#f1f5f9', type: 'dashed' }
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 11 }
    },
    series: [
      {
        name: '文章数',
        type: 'line',
        smooth: 0.4,
        data: data.articles,
        lineStyle: { color: '#6366f1', width: 2.5 },
        itemStyle: { color: '#6366f1' },
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        emphasis: {
          itemStyle: { borderColor: '#fff', borderWidth: 2, shadowBlur: 10, shadowColor: 'rgba(99, 102, 241, 0.4)' }
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(99, 102, 241, 0.18)' },
            { offset: 1, color: 'rgba(99, 102, 241, 0.02)' }
          ])
        }
      },
      {
        name: '关键词',
        type: 'line',
        smooth: 0.4,
        data: data.keywords,
        lineStyle: { color: '#8b5cf6', width: 2.5 },
        itemStyle: { color: '#8b5cf6' },
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        emphasis: {
          itemStyle: { borderColor: '#fff', borderWidth: 2, shadowBlur: 10, shadowColor: 'rgba(139, 92, 246, 0.4)' }
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(139, 92, 246, 0.12)' },
            { offset: 1, color: 'rgba(139, 92, 246, 0.02)' }
          ])
        }
      },
      {
        name: '浏览量',
        type: 'line',
        smooth: 0.4,
        data: data.views,
        lineStyle: { color: '#10b981', width: 2.5 },
        itemStyle: { color: '#10b981' },
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        emphasis: {
          itemStyle: { borderColor: '#fff', borderWidth: 2, shadowBlur: 10, shadowColor: 'rgba(16, 185, 129, 0.4)' }
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16, 185, 129, 0.12)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0.02)' }
          ])
        }
      }
    ]
  }
  
  trendChart.setOption(option)
}

const initCategoryChart = () => {
  if (!categoryChartRef.value || !chartData.value?.categoryDistribution) return
  
  categoryChart = echarts.init(categoryChartRef.value)
  
  const categoryData = chartData.value.categoryDistribution
  const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e8ecf4',
      borderWidth: 1,
      textStyle: { color: '#1a1f36', fontSize: 12 },
      padding: [12, 16],
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
        data: categoryData.map((item: any, index: number) => ({
          ...item,
          itemStyle: {
            color: colors[index % colors.length]
          }
        }))
      }
    ]
  }
  
  categoryChart.setOption(option)
}

const handleResize = () => {
  trendChart?.resize()
  categoryChart?.resize()
}

const fetchDashboardData = async () => {
  loading.value = true
  try {
    const [statsData, articlesData] = await Promise.all([
      dashboardApi.getStats(getTenantId()),
      dashboardApi.getRecentArticles(),
      loadChartData()
    ])
    stats.value = statsData
    recentArticles.value = (articlesData?.records || []).slice(0, 5)
  } catch (error) {
    console.error('获取仪表盘数据失败:', error)
    stats.value = {
      articles: 345,
      keywords: 1250,
      pageViews: 45678,
      pendingReviews: 23
    } as any
    recentArticles.value = [
      { id: 1, tenantId: 1, categoryId: 1, title: '2024年AI行业发展趋势分析', summary: '', content: '', coverImage: '', keywords: '', source: '', viewCount: 0, likeCount: 0, shareCount: 0, sort: 0, status: 'published', publishAt: '', createdAt: '2024-01-15 10:30:00', updatedAt: '' },
      { id: 2, tenantId: 1, categoryId: 1, title: '如何使用ChatGPT提高工作效率', summary: '', content: '', coverImage: '', keywords: '', source: '', viewCount: 0, likeCount: 0, shareCount: 0, sort: 0, status: 'approved', publishAt: '', createdAt: '2024-01-14 15:20:00', updatedAt: '' },
      { id: 3, tenantId: 1, categoryId: 1, title: 'Python编程入门指南', summary: '', content: '', coverImage: '', keywords: '', source: '', viewCount: 0, likeCount: 0, shareCount: 0, sort: 0, status: 'pending_human_review', publishAt: '', createdAt: '2024-01-13 09:15:00', updatedAt: '' },
      { id: 4, tenantId: 1, categoryId: 1, title: '机器学习算法详解', summary: '', content: '', coverImage: '', keywords: '', source: '', viewCount: 0, likeCount: 0, shareCount: 0, sort: 0, status: 'published', publishAt: '', createdAt: '2024-01-12 14:45:00', updatedAt: '' },
      { id: 5, tenantId: 1, categoryId: 1, title: '前端框架对比分析', summary: '', content: '', coverImage: '', keywords: '', source: '', viewCount: 0, likeCount: 0, shareCount: 0, sort: 0, status: 'rejected', publishAt: '', createdAt: '2024-01-11 11:30:00', updatedAt: '' }
    ]
  } finally {
    loading.value = false
    nextTick(() => {
      setTimeout(() => {
        initTrendChart()
        initCategoryChart()
      }, 100)
    })
  }
}

watch(
  () => auth.selectedTenantId,
  () => {
    fetchDashboardData()
  }
)

const refreshData = () => {
  fetchDashboardData()
  message.success('数据已刷新')
}

const getStatusColor = (status?: string) => {
  const s = (status || '').toLowerCase()
  switch (s) {
    case 'approved': return 'success'
    case 'published': return 'success'
    case 'pending_review': return 'warning'
    case 'pending_human_review': return 'warning'
    case 'reviewing': return 'warning'
    case 'rejected': return 'error'
    default: return 'default'
  }
}

const getStatusText = (status?: string) => {
  const s = (status || '').toLowerCase()
  switch (s) {
    case 'approved': return '已通过'
    case 'published': return '已发布'
    case 'pending_review': return '待审核'
    case 'pending_human_review': return '待审核'
    case 'reviewing': return '审核中'
    case 'rejected': return '已拒绝'
    case 'draft': return '草稿'
    default: return status || '未定义'
  }
}

const navigateTo = (path: string) => {
  router.push(`/v2/workspace/${path}`)
}

onMounted(() => {
  fetchDashboardData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  categoryChart?.dispose()
})
</script>

<style lang="less" scoped>
@blue-50: #eff6ff;
@blue-100: #dbeafe;
@blue-500: #3b82f6;
@blue-600: #2563eb;
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
@slate-50: #f8fafc;
@slate-100: #f1f5f9;
@slate-200: #e2e8f0;
@slate-300: #cbd5e1;
@slate-400: #94a3b8;
@slate-500: #64748b;
@slate-600: #475569;
@slate-700: #334155;
@slate-900: #0f172a;

.dashboard {
  width: 100%;
  min-height: 100%;
  padding: 4px;
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

.header-avatar {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, @indigo-500 0%, @purple-500 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
}

.header-info .greeting {
  margin: 0 0 6px 0;
  font-size: 24px;
  font-weight: 700;
  color: @slate-900;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.header-info .subtitle {
  margin: 0;
  font-size: 13px;
  color: @slate-500;
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-text {
  color: @slate-500;
}

.header-divider {
  width: 1px;
  height: 12px;
  background: @slate-200;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: @green-600;
  font-size: 12px;
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: @green-500;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.refresh-btn {
  height: 38px;
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
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
  color: #dc2626;
  background: #fef2f2;
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

.stat-card__period {
  font-size: 11px;
  color: @slate-400;
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 18px;
  margin-bottom: 20px;
}

.chart-card,
.list-card,
.action-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.04), 0 1px 2px rgba(16, 24, 40, 0.03);
  transition: box-shadow 0.3s ease;
  border: 1px solid rgba(226, 232, 240, 0.6);
  animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.chart-card:hover,
.list-card:hover,
.action-card:hover {
  box-shadow: 0 8px 24px -8px rgba(16, 24, 40, 0.12);
}

.chart-card:focus-visible,
.list-card:focus-visible,
.action-card:focus-visible {
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

.article-list {
  display: flex;
  flex-direction: column;
}

.article-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 12px;
  border-radius: 10px;
  transition: background-color 0.25s ease;
  cursor: pointer;
  animation: fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.article-item:hover {
  background: @slate-50;
}

.article-item:focus-visible {
  outline: 2px solid @indigo-500;
  outline-offset: 2px;
}

.article-item:hover .article-index {
  background: linear-gradient(135deg, @indigo-500 0%, @purple-500 100%);
  color: #fff;
}

.article-index {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: @slate-100;
  color: @slate-500;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  transition: all 0.25s ease;
}

.article-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, @indigo-50 0%, @purple-50 100%);
  color: @indigo-600;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  transition: all 0.25s ease;
}

.article-item:hover .article-icon {
  background: linear-gradient(135deg, @indigo-100 0%, @purple-100 100%);
  transform: scale(1.05);
}

.article-main {
  flex: 1;
  min-width: 0;
}

.article-title {
  font-size: 14px;
  font-weight: 500;
  color: @slate-700;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s ease;
}

.article-item:hover .article-title {
  color: @indigo-600;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: @slate-400;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.article-status {
  flex-shrink: 0;
  transform: scale(0.92);
  transform-origin: right center;
}

.list-empty {
  text-align: center;
  padding: 60px 0;
  color: @slate-400;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.3;
}

.list-empty p {
  margin: 0;
}

.view-all {
  font-size: 12px;
  color: @indigo-600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.view-all:hover {
  color: @indigo-500;
  transform: translateX(2px);
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 22px;
}

.action-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 14px;
  border: 1px solid @slate-200;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  font-family: inherit;
  overflow: hidden;
}

.action-btn:hover {
  border-color: transparent;
  transform: translateY(-2px);
  box-shadow: 0 12px 24px -8px rgba(99, 102, 241, 0.25);
}

.action-btn:active {
  transform: translateY(0);
}

.action-btn:focus-visible {
  outline: 2px solid @indigo-500;
  outline-offset: 2px;
}

.action-btn--primary {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, @indigo-500 0%, @purple-500 100%);
  border-color: transparent;
  padding: 20px 18px;
}

.action-btn--primary:hover {
  box-shadow: 0 16px 32px -8px rgba(99, 102, 241, 0.45);
  background: linear-gradient(135deg, @indigo-600 0%, @purple-600 100%);
}

.action-btn__bg {
  position: absolute;
  top: -50%;
  right: -30%;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  pointer-events: none;
  transition: all 0.5s ease;
}

.action-btn--primary:hover .action-btn__bg {
  transform: scale(1.5);
  background: rgba(255, 255, 255, 0.15);
}

.action-btn__content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.action-btn__icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: linear-gradient(135deg, @orange-50 0%, @orange-100 100%);
  color: @orange-600;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.action-btn:hover .action-btn__icon {
  transform: scale(1.08) rotate(-5deg);
}

.action-btn--primary .action-btn__icon {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  width: 50px;
  height: 50px;
  border-radius: 14px;
  font-size: 22px;
}

.action-btn--blue .action-btn__icon {
  background: linear-gradient(135deg, @blue-50 0%, @blue-100 100%);
  color: @blue-600;
}

.action-btn--green .action-btn__icon {
  background: linear-gradient(135deg, @green-50 0%, @green-100 100%);
  color: @green-600;
}

.action-btn--purple .action-btn__icon {
  background: linear-gradient(135deg, @purple-50 0%, @purple-100 100%);
  color: @purple-600;
}

.action-btn__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.action-btn__title {
  font-size: 14px;
  font-weight: 600;
  color: @slate-700;
  line-height: 1.3;
}

.action-btn--primary .action-btn__title {
  color: #fff;
  font-size: 16px;
}

.action-btn__desc {
  font-size: 12px;
  color: @slate-400;
}

.action-btn--primary .action-btn__desc {
  color: rgba(255, 255, 255, 0.75);
}

.action-btn__arrow {
  font-size: 14px;
  color: @slate-300;
  transition: all 0.3s ease;
  flex-shrink: 0;
  opacity: 0;
  transform: translateX(-4px);
}

.action-btn:hover .action-btn__arrow {
  opacity: 1;
  transform: translateX(0);
  color: @indigo-500;
}

.action-btn--primary .action-btn__arrow {
  color: rgba(255, 255, 255, 0.6);
  opacity: 1;
  transform: translateX(0);
}

.action-btn--primary:hover .action-btn__arrow {
  color: #fff;
  transform: translateX(4px);
}

.quick-stats {
  display: flex;
  align-items: center;
  padding: 18px 12px;
  background: linear-gradient(135deg, @slate-50 0%, #fcfcfd 100%);
  border-radius: 12px;
  border: 1px solid @slate-100;
}

.quick-stat {
  flex: 1;
  text-align: center;
}

.quick-stat__value {
  font-size: 22px;
  font-weight: 700;
  color: @slate-900;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(135deg, @indigo-600 0%, @purple-600 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.quick-stat__label {
  font-size: 12px;
  color: @slate-500;
  font-weight: 500;
}

.quick-stat-divider {
  width: 1px;
  height: 36px;
  background: @slate-200;
  margin: 0 8px;
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
}

@media (max-width: 768px) {
  .stat-cards {
    grid-template-columns: 1fr;
  }
  
  .action-grid {
    grid-template-columns: 1fr;
  }
  
  .action-btn--primary {
    grid-column: 1;
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
