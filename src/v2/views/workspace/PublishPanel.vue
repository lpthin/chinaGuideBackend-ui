<template>
  <div class="publish-panel-page">
    <a-spin :spinning="loading">
      <!-- 顶部数据概览区 -->
      <a-row :gutter="[16, 16]" style="margin-bottom: 20px">
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-blue" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <ClockCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.pendingCount }}</div>
                <div class="stat-title">待发布文章数</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-trend up">
                <ArrowUpOutlined /> 12%
              </span>
              <span class="stat-label">较昨日</span>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-purple" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <SendOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.todayPublished }}</div>
                <div class="stat-title">今日已发布</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-trend up">
                <ArrowUpOutlined /> 8%
              </span>
              <span class="stat-label">较昨日</span>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-green" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <CheckCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.successRate }}%</div>
                <div class="stat-title">发布成功率</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-trend up">
                <ArrowUpOutlined /> 2%
              </span>
              <span class="stat-label">较上周</span>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-orange" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <SyncOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.pendingQueue }}</div>
                <div class="stat-title">积压队列</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-trend down">
                <ArrowDownOutlined /> 5%
              </span>
              <span class="stat-label">较昨日</span>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 发布模式配置区 -->
      <a-card class="config-card" :bordered="false" style="margin-bottom: 20px">
        <template #title>
          <div class="card-title">
            <SettingOutlined class="title-icon" />
            <span>发布模式配置</span>
          </div>
        </template>
        <template #extra>
          <a-space>
            <a-switch v-model:checked="autoPublishEnabled" checked-children="自动" un-checked-children="手动" @change="onAutoModeChange" />
          </a-space>
        </template>

        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :md="8">
            <div class="mode-card" :class="{ active: publishConfig.mode === 'manual' }" @click="setMode('manual')">
              <div class="mode-icon-wrap">
                <EditOutlined class="mode-icon" />
              </div>
              <div class="mode-info">
                <div class="mode-title">手动发布</div>
                <div class="mode-desc">需人工点击发布按钮，完全可控</div>
              </div>
              <div v-if="publishConfig.mode === 'manual'" class="mode-active-tag">
                <CheckOutlined />
              </div>
            </div>
          </a-col>
          <a-col :xs="24" :md="8">
            <div class="mode-card" :class="{ active: publishConfig.mode === 'auto' }" @click="setMode('auto')">
              <div class="mode-icon-wrap">
                <RocketOutlined class="mode-icon" />
              </div>
              <div class="mode-info">
                <div class="mode-title">自动发布</div>
                <div class="mode-desc">审核通过后自动按规则发布</div>
              </div>
              <div v-if="publishConfig.mode === 'auto'" class="mode-active-tag">
                <CheckOutlined />
              </div>
            </div>
          </a-col>
          <a-col :xs="24" :md="8">
            <div class="mode-card" :class="{ active: publishConfig.mode === 'schedule' }" @click="setMode('schedule')">
              <div class="mode-icon-wrap">
                <ClockCircleOutlined class="mode-icon" />
              </div>
              <div class="mode-info">
                <div class="mode-title">定时发布</div>
                <div class="mode-desc">按设定时间批量自动发布</div>
              </div>
              <div v-if="publishConfig.mode === 'schedule'" class="mode-active-tag">
                <CheckOutlined />
              </div>
            </div>
          </a-col>
        </a-row>

        <a-divider />

        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :md="6">
            <div class="quick-config-item" @click="showScheduleConfig = true">
              <div class="quick-config-icon calendar">
                <CalendarOutlined />
              </div>
              <div class="quick-config-info">
                <div class="quick-config-title">定时日历</div>
                <div class="quick-config-desc">设置发布时间表</div>
              </div>
              <RightOutlined class="quick-config-arrow" />
            </div>
          </a-col>
          <a-col :xs="24" :md="6">
            <div class="quick-config-item" @click="showFrequencyConfig = true">
              <div class="quick-config-icon frequency">
                <BarChartOutlined />
              </div>
              <div class="quick-config-info">
                <div class="quick-config-title">发布频率</div>
                <div class="quick-config-desc">{{ publishConfig.frequency === 'hourly' ? '每小时' : publishConfig.frequency === 'daily' ? '每天' : '工作日' }}</div>
              </div>
              <RightOutlined class="quick-config-arrow" />
            </div>
          </a-col>
          <a-col :xs="24" :md="6">
            <div class="quick-config-item" @click="showPlatformConfig = true">
              <div class="quick-config-icon platform">
                <ShareAltOutlined />
              </div>
              <div class="quick-config-info">
                <div class="quick-config-title">多平台发布</div>
                <div class="quick-config-desc">已配置 3 个平台</div>
              </div>
              <RightOutlined class="quick-config-arrow" />
            </div>
          </a-col>
          <a-col :xs="24" :md="6">
            <div class="quick-config-item" @click="showTimeline = true">
              <div class="quick-config-icon timeline">
                <OrderedListOutlined />
              </div>
              <div class="quick-config-info">
                <div class="quick-config-title">发布时间线</div>
                <div class="quick-config-desc">查看发布进度</div>
              </div>
              <RightOutlined class="quick-config-arrow" />
            </div>
          </a-col>
        </a-row>

        <div v-if="publishConfig.mode === 'schedule'" class="schedule-config">
          <a-divider />
          <h4 class="section-title">
            <ClockCircleOutlined class="section-icon" />
            定时发布配置
          </h4>
          <a-form layout="inline">
            <a-form-item label="发布频率">
              <a-select v-model:value="publishConfig.frequency" style="width: 150px">
                <a-select-option value="hourly">每小时</a-select-option>
                <a-select-option value="daily">每天</a-select-option>
                <a-select-option value="workday">工作日</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="发布时间">
              <a-time-picker v-model:value="publishConfig.publishTime" format="HH:mm" />
            </a-form-item>
            <a-form-item label="每批数量">
              <a-input-number v-model:value="publishConfig.batchSize" :min="1" :max="100" />
            </a-form-item>
            <a-form-item label="间隔时间">
              <a-input-number v-model:value="publishConfig.interval" :min="1" :max="60" />
              <span style="margin-left: 8px">秒</span>
            </a-form-item>
          </a-form>
        </div>

        <div v-if="publishConfig.mode === 'auto'" class="schedule-config">
          <a-divider />
          <h4 class="section-title">
            <SafetyOutlined class="section-icon" />
            防爬虫策略
          </h4>
          <a-form layout="inline">
            <a-form-item label="发布间隔">
              <a-input-number v-model:value="publishConfig.interval" :min="1" :max="600" />
              <span style="margin-left: 8px">秒</span>
            </a-form-item>
            <a-form-item label="随机偏移">
              <a-switch v-model:checked="publishConfig.randomOffset" />
              <span style="margin-left: 8px">±30秒随机时间</span>
            </a-form-item>
          </a-form>
        </div>
      </a-card>

      <!-- 发布队列管理区 -->
      <a-row :gutter="20" style="margin-bottom: 20px">
        <a-col :xs="24" :lg="16">
          <a-card class="queue-card" :bordered="false">
            <template #title>
              <div class="card-title">
                <UnorderedListOutlined class="title-icon" />
                <span>发布队列</span>
              </div>
            </template>
            <template #extra>
              <a-space>
                <a-button type="primary" :disabled="!canPublishSelected" @click="batchPublish">
                  <template #icon><SendOutlined /></template>
                  立即发布 ({{ selectedRows.length }})
                </a-button>
                <a-button :disabled="!selectedRows.length || activeTab !== 'pending'" @click="showBatchSchedule = true">
                  <template #icon><ScheduleOutlined /></template>
                  定时发布
                </a-button>
                <a-button danger :disabled="!canCancelSelected" @click="batchCancel">
                  <template #icon><DeleteOutlined /></template>
                  取消发布
                </a-button>
              </a-space>
            </template>

            <a-tabs v-model:activeKey="activeTab" class="queue-tabs" @change="onTabChange">
              <a-tab-pane key="pending" tab="待发布" />
              <a-tab-pane key="publishing" tab="发布中" />
              <a-tab-pane key="published" tab="已发布" />
              <a-tab-pane key="failed" tab="发布失败" />
            </a-tabs>

            <div class="queue-list">
              <div v-for="article in filteredArticles" :key="article.id" class="queue-item" :class="{ selected: selectedRowKeys.includes(article.id) }">
                <div class="queue-checkbox">
                  <a-checkbox :checked="selectedRowKeys.includes(article.id)" :disabled="!canSelectArticle(article)" @change="(e: any) => toggleSelect(article, e.target.checked)" />
                </div>
                <div class="queue-cover">
                  <img v-if="article.coverImage" :src="article.coverImage" :alt="article.title" />
                  <div v-else class="default-cover">
                    <FileTextOutlined />
                  </div>
                </div>
                <div class="queue-content">
                  <div class="queue-title">{{ article.title }}</div>
                  <div class="queue-meta">
                    <a-tag :color="getStatusColor(article.status)" size="small">{{ getStatusText(article.status) }}</a-tag>
                    <span class="meta-item">
                      <FolderOutlined /> {{ article.categoryName || '未分类' }}
                    </span>
                    <span class="meta-item">
                      <UserOutlined /> {{ article.authorName || '未知' }}
                    </span>
                    <span v-if="article.scheduleTime" class="meta-item">
                      <ClockCircleOutlined /> {{ formatTime(article.scheduleTime) }}
                    </span>
                  </div>
                </div>
                <div class="queue-priority">
                  <a-select v-model:value="article.priority" size="small" style="width: 100px" @change="changePriority(article)">
                    <a-select-option value="high">
                      <span class="priority-high">高优先级</span>
                    </a-select-option>
                    <a-select-option value="normal">
                      <span class="priority-normal">普通</span>
                    </a-select-option>
                    <a-select-option value="low">
                      <span class="priority-low">低优先级</span>
                    </a-select-option>
                  </a-select>
                </div>
                <div class="queue-actions">
                  <a-button type="link" size="small" :disabled="!canPublishArticle(article)" @click="publishArticle(article)">立即发布</a-button>
                  <a-button type="link" size="small" :disabled="article.status !== 'pending'" @click="showScheduleModal(article)">设置时间</a-button>
                  <a-button type="link" size="small" danger :disabled="!canCancelArticle(article)" @click="cancelPublish(article)">取消</a-button>
                </div>
              </div>
              <a-empty v-if="!filteredArticles.length" :description="getEmptyDescription()" />
            </div>
          </a-card>
        </a-col>

        <a-col :xs="24" :lg="8">
          <a-card class="timeline-card" :bordered="false">
            <template #title>
              <div class="card-title">
                <ClockCircleOutlined class="title-icon" />
                <span>今日发布时间线</span>
              </div>
            </template>
            <div class="timeline-container">
              <a-timeline mode="left">
                <a-timeline-item v-for="(item, index) in timelineData" :key="index" :color="item.color">
                  <template #dot>
                    <div class="timeline-dot" :class="item.color">
                      <component :is="getTimelineIcon(item.type)" />
                    </div>
                  </template>
                  <div class="timeline-item-content">
                    <div class="timeline-time">{{ item.time }}</div>
                    <div class="timeline-title">{{ item.title }}</div>
                    <div class="timeline-desc" v-if="item.desc">{{ item.desc }}</div>
                    <a-button v-if="item.canRetry" type="link" size="small" danger @click="retryPublish(item)">
                      <ReloadOutlined /> 重试
                    </a-button>
                  </div>
                </a-timeline-item>
              </a-timeline>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 数据统计看板 -->
      <a-row :gutter="[16, 16]" style="margin-bottom: 20px">
        <a-col :xs="24" :md="10">
          <a-card class="chart-card" :bordered="false">
            <template #title>
              <div class="card-title-sm">每日发布趋势</div>
            </template>
            <div ref="trendChartRef" class="chart-container"></div>
          </a-card>
        </a-col>
        <a-col :xs="24" :md="6">
          <a-card class="chart-card" :bordered="false">
            <template #title>
              <div class="card-title-sm">发布成功率</div>
            </template>
            <div ref="successRateChartRef" class="chart-container"></div>
          </a-card>
        </a-col>
        <a-col :xs="24" :md="8">
          <a-card class="chart-card" :bordered="false">
            <template #title>
              <div class="card-title-sm">栏目分布</div>
            </template>
            <div ref="categoryChartRef" class="chart-container"></div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 已发布记录区 -->
      <a-card class="record-card" :bordered="false">
        <template #title>
          <div class="card-title">
            <HistoryOutlined class="title-icon" />
            <span>发布记录</span>
          </div>
        </template>
        <template #extra>
          <a-space>
            <a-date-picker v-model:value="dateRange" mode="date" placeholder="选择日期" />
            <a-button @click="exportReport">
              <template #icon><FileExcelOutlined /></template>
              导出报表
            </a-button>
          </a-space>
        </template>

        <div class="record-timeline">
          <a-timeline>
            <a-timeline-item v-for="(record, index) in publishRecords" :key="index" :color="record.success ? 'green' : 'red'">
              <div class="record-item">
                <div class="record-header">
                  <div class="record-title">{{ record.title }}</div>
                  <a-space>
                    <a-tag :color="record.success ? 'success' : 'error'">
                      <CheckCircleOutlined v-if="record.success" />
                      <CloseCircleOutlined v-else />
                      {{ record.success ? '发布成功' : '发布失败' }}
                    </a-tag>
                    <a-tag color="blue">{{ record.categoryName || '未分类' }}</a-tag>
                  </a-space>
                </div>
                <div class="record-meta">
                  <span class="meta-item">
                    <UserOutlined /> 操作人: {{ record.operator }}
                  </span>
                  <span class="meta-item">
                    <CalendarOutlined /> 发布时间: {{ formatTime(record.publishTime) }}
                  </span>
                  <span class="meta-item">
                    <EyeOutlined /> 阅读量: {{ record.views || 0 }}
                  </span>
                  <span class="meta-item">
                    <LikeOutlined /> 互动数: {{ record.interactions || 0 }}
                  </span>
                </div>
                <div v-if="!record.success" class="record-error">
                  <AlertOutlined /> 失败原因: {{ record.errorMsg }}
                  <a-button type="link" size="small" danger @click="retryRecord(record)">
                    <ReloadOutlined /> 重试发布
                  </a-button>
                </div>
                <div class="record-stats" v-if="record.success">
                  <div class="stat-item">
                    <span class="stat-num">{{ record.views || 0 }}</span>
                    <span class="stat-label">阅读量</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-num">{{ record.likes || 0 }}</span>
                    <span class="stat-label">点赞</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-num">{{ record.comments || 0 }}</span>
                    <span class="stat-label">评论</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-num">{{ record.shares || 0 }}</span>
                    <span class="stat-label">分享</span>
                  </div>
                </div>
              </div>
            </a-timeline-item>
          </a-timeline>
        </div>
      </a-card>

      <!-- 定时发布设置弹窗 -->
      <a-modal v-model:open="showBatchSchedule" title="定时发布设置" @ok="confirmBatchSchedule">
        <a-alert message="提示" description="将为 {{ selectedRows.length }} 篇文章设置定时发布" type="info" style="margin-bottom: 16px" />
        <a-form layout="vertical">
          <a-form-item label="发布时间">
            <a-date-picker v-model:value="scheduleForm.date" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 单篇定时设置弹窗 -->
      <a-modal v-model:open="showSingleSchedule" title="设置发布时间" @ok="confirmSingleSchedule">
        <a-form layout="vertical">
          <a-form-item label="发布时间">
            <a-date-picker v-model:value="scheduleForm.date" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 发布时间线弹窗 -->
      <a-modal v-model:open="showTimeline" title="发布时间线" width="800px" :footer="null">
        <a-timeline>
          <a-timeline-item v-for="(item, index) in timelineData" :key="index" :color="item.color">
            <div class="timeline-item">
              <div class="timeline-time">{{ item.time }}</div>
              <div class="timeline-title">{{ item.title }}</div>
              <div class="timeline-desc" v-if="item.desc">{{ item.desc }}</div>
            </div>
          </a-timeline-item>
        </a-timeline>
      </a-modal>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import * as echarts from 'echarts'
import {
  ClockCircleOutlined,
  SendOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CalendarOutlined,
  EditOutlined,
  RocketOutlined,
  ScheduleOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SettingOutlined,
  RightOutlined,
  BarChartOutlined,
  ShareAltOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  FileTextOutlined,
  FolderOutlined,
  UserOutlined,
  HistoryOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  LikeOutlined,
  AlertOutlined,
  ReloadOutlined,
  CheckOutlined,
  SafetyOutlined,
} from '@ant-design/icons-vue'
import { publishApi, articleApi } from '../../api'

const loading = ref(false)
const showBatchSchedule = ref(false)
const showSingleSchedule = ref(false)
const showTimeline = ref(false)
const showScheduleConfig = ref(false)
const showFrequencyConfig = ref(false)
const showPlatformConfig = ref(false)
const autoPublishEnabled = ref(false)
const activeTab = ref('pending')

const trendChartRef = ref<HTMLElement>()
const successRateChartRef = ref<HTMLElement>()
const categoryChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let successRateChart: echarts.ECharts | null = null
let categoryChart: echarts.ECharts | null = null

const mockTrendData = {
  dates: ['1日', '2日', '3日', '4日', '5日', '6日', '7日'],
  success: [25, 32, 28, 35, 30, 22, 28],
  failed: [2, 3, 1, 2, 0, 1, 2]
}

const mockSuccessRateData = {
  total: 200,
  success: 190,
  failed: 10
}

const mockCategoryData = [
  { name: '技术文章', value: 65 },
  { name: '行业资讯', value: 45 },
  { name: '产品评测', value: 35 },
  { name: '用户指南', value: 30 },
  { name: '案例分析', value: 25 }
]

const stats = reactive({
  pendingCount: 0,
  todayPublished: 0,
  successRate: 0,
  pendingQueue: 0,
})

const publishConfig = reactive({
  mode: 'manual' as 'manual' | 'auto' | 'schedule',
  frequency: 'daily',
  publishTime: null as any,
  batchSize: 10,
  interval: 30,
  randomOffset: true,
})

const articles = ref<any[]>([])
const publishRecords = ref<any[]>([])
const selectedRowKeys = ref<number[]>([])
const selectedRows = ref<any[]>([])
const dateRange = ref<any>(null)
const currentScheduledArticle = ref<any>(null)

const filteredArticles = computed(() => {
  let result = articles.value
  switch (activeTab.value) {
    case 'pending':
      return result.filter(a => a.status === 'pending' || a.status === 'APPROVED' || a.status === 'scheduled')
    case 'publishing':
      return result.filter(a => a.status === 'publishing' || a.status === 'processing')
    case 'published':
      return result.filter(a => a.status === 'published' || a.status === 'success')
    case 'failed':
      return result.filter(a => a.status === 'failed' || a.status === 'error')
    default:
      return result
  }
})

const canPublishSelected = computed(() => {
  return selectedRows.value.some(r => canPublishArticle(r))
})

const canCancelSelected = computed(() => {
  return selectedRows.value.some(r => canCancelArticle(r))
})

function canPublishArticle(article: any) {
  const status = article?.status
  return status === 'pending' || status === 'APPROVED' || status === 'scheduled' || status === 'failed' || status === 'error'
}

function canCancelArticle(article: any) {
  const status = article?.status
  return status === 'pending' || status === 'APPROVED' || status === 'scheduled' || status === 'publishing' || status === 'processing'
}

function canSelectArticle(article: any) {
  const status = article?.status
  return activeTab.value === 'pending' 
    ? (status === 'pending' || status === 'APPROVED' || status === 'scheduled')
    : true
}

function getEmptyDescription() {
  switch (activeTab.value) {
    case 'pending': return '暂无待发布文章'
    case 'publishing': return '暂无发布中的文章'
    case 'published': return '暂无已发布文章'
    case 'failed': return '暂无发布失败的文章'
    default: return '暂无数据'
  }
}

const scheduleForm = reactive({
  date: null as any,
})

const timelineData = ref([
  { time: '09:00', title: '批量发布 15 篇文章', desc: '全部成功', color: 'green', type: 'success', canRetry: false },
  { time: '12:00', title: '批量发布 10 篇文章', desc: '2 篇失败', color: 'red', type: 'error', canRetry: true },
  { time: '15:00', title: '手动发布 3 篇文章', desc: '全部成功', color: 'green', type: 'success', canRetry: false },
  { time: '18:00', title: '待发布 8 篇', desc: '队列中', color: 'blue', type: 'pending', canRetry: false },
])

const tableColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '文章标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '所属栏目', dataIndex: 'categoryName', key: 'categoryName', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '计划发布时间', key: 'scheduleTime', width: 180 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const },
]

function getStatusColor(status?: string) {
  switch (status) {
    case 'pending': return 'processing'
    case 'scheduled': return 'blue'
    case 'published': return 'success'
    case 'failed': return 'error'
    default: return 'default'
  }
}

function getStatusText(status?: string) {
  switch (status) {
    case 'pending': return '待发布'
    case 'scheduled': return '定时中'
    case 'published': return '已发布'
    case 'failed': return '失败'
    default: return '未知'
  }
}

function formatTime(time?: string) {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

function setMode(mode: 'manual' | 'auto' | 'schedule') {
  publishConfig.mode = mode
  autoPublishEnabled.value = mode === 'auto' || mode === 'schedule'
  message.success(`已切换为${mode === 'manual' ? '手动发布' : mode === 'auto' ? '自动发布' : '定时发布'}模式`)
}

function onAutoModeChange(checked: boolean) {
  if (checked) {
    setMode('auto')
  } else {
    setMode('manual')
  }
}

function onSelectChange(keys: number[], rows: any[]) {
  selectedRowKeys.value = keys
  selectedRows.value = rows
}

function toggleSelect(article: any, checked: boolean) {
  if (checked) {
    selectedRowKeys.value = [...selectedRowKeys.value, article.id]
    selectedRows.value = [...selectedRows.value, article]
  } else {
    selectedRowKeys.value = selectedRowKeys.value.filter(k => k !== article.id)
    selectedRows.value = selectedRows.value.filter(r => r.id !== article.id)
  }
}

function changePriority(article: any) {
  message.success('优先级已更新')
}

function getTimelineIcon(type: string) {
  switch (type) {
    case 'success': return CheckCircleOutlined
    case 'error': return CloseCircleOutlined
    case 'pending': return ClockCircleOutlined
    default: return ClockCircleOutlined
  }
}

function retryPublish(item: any) {
  message.success('已重新加入发布队列')
}

function retryRecord(record: any) {
  message.success('已重新发布')
}

function onTabChange(key: string) {
  selectedRowKeys.value = []
  selectedRows.value = []
}

async function loadData() {
  loading.value = true
  try {
    const [allData, statsData] = await Promise.all([
      publishApi.list({ page: 1, size: 100 }) as any,
      publishApi.getStats() as any,
    ])
    const allList = allData?.records || allData || []
    articles.value = allList.map((a: any) => ({ ...a, priority: a.priority || 'normal' }))
    publishRecords.value = []
    stats.pendingCount = statsData?.pending || allList.filter((a: any) => a.status === 'pending' || a.status === 'APPROVED' || a.status === 'scheduled').length
    stats.todayPublished = statsData?.completed || 0
    stats.successRate = statsData?.completed && (statsData.completed + statsData.failed) > 0
      ? Math.round((statsData.completed / (statsData.completed + statsData.failed)) * 100)
      : 0
    stats.pendingQueue = statsData?.pending || 0
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function batchPublish() {
  const publishableRows = selectedRows.value.filter(r => canPublishArticle(r))
  if (!publishableRows.length) {
    message.warning('没有可发布的文章')
    return
  }
  try {
    const promises = publishableRows.map(r => publishApi.create({ articleId: r.id, platform: 'default' }))
    await Promise.all(promises)
    message.success(`成功发布 ${publishableRows.length} 篇文章`)
    selectedRowKeys.value = []
    selectedRows.value = []
    await loadData()
  } catch (error) {
    message.error('发布失败')
    console.error(error)
  }
}

function confirmBatchSchedule() {
  message.success('定时发布已设置')
  showBatchSchedule.value = false
}

function showScheduleModal(article: any) {
  currentScheduledArticle.value = article
  showSingleSchedule.value = true
}

function confirmSingleSchedule() {
  message.success('发布时间已设置')
  showSingleSchedule.value = false
}

async function publishArticle(article: any) {
  try {
    await publishApi.create({ articleId: article.id, platform: 'default' })
    message.success('发布成功')
    await loadData()
  } catch (error) {
    message.error('发布失败')
    console.error(error)
  }
}

async function cancelPublish(article: any) {
  try {
    if (article.jobId) {
      await publishApi.cancel(article.jobId)
    }
    message.success('已取消发布')
    await loadData()
  } catch (error) {
    message.error('取消失败')
    console.error(error)
  }
}

function batchCancel() {
  const cancelableRows = selectedRows.value.filter(r => canCancelArticle(r))
  if (!cancelableRows.length) {
    message.warning('没有可取消的文章')
    return
  }
  Modal.confirm({
    title: '确认取消',
    content: `将取消 ${cancelableRows.length} 篇文章的发布计划`,
    onOk: async () => {
      try {
        const promises = cancelableRows
          .filter(r => r.jobId)
          .map(r => publishApi.cancel(r.jobId))
        await Promise.all(promises)
        message.success('已批量取消')
        selectedRowKeys.value = []
        selectedRows.value = []
        await loadData()
      } catch (error) {
        message.error('取消失败')
        console.error(error)
      }
    },
  })
}

function exportReport() {
  message.info('正在生成报表...')
  setTimeout(() => message.success('报表导出成功'), 1000)
}

const initTrendChart = () => {
  if (!trendChartRef.value) return
  
  trendChart = echarts.init(trendChartRef.value)
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['成功', '失败'],
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '20%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: mockTrendData.dates
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '成功',
        type: 'line',
        smooth: true,
        data: mockTrendData.success,
        lineStyle: {
          color: '#52c41a',
          width: 3
        },
        itemStyle: {
          color: '#52c41a'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
            { offset: 1, color: 'rgba(82, 196, 26, 0.05)' }
          ])
        }
      },
      {
        name: '失败',
        type: 'line',
        smooth: true,
        data: mockTrendData.failed,
        lineStyle: {
          color: '#ff4d4f',
          width: 2
        },
        itemStyle: {
          color: '#ff4d4f'
        }
      }
    ]
  }
  
  trendChart.setOption(option)
}

const initSuccessRateChart = () => {
  if (!successRateChartRef.value) return
  
  successRateChart = echarts.init(successRateChartRef.value)
  
  const option: any = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          position: 'center',
          formatter: () => {
            return `${((mockSuccessRateData.success / mockSuccessRateData.total) * 100).toFixed(1)}%\n成功率`
          },
          rich: {
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          {
            value: mockSuccessRateData.success,
            name: '成功',
            itemStyle: { color: '#52c41a' }
          },
          {
            value: mockSuccessRateData.failed,
            name: '失败',
            itemStyle: { color: '#ff4d4f' }
          }
        ]
      }
    ]
  }
  
  successRateChart.setOption(option)
}

const initCategoryChart = () => {
  if (!categoryChartRef.value) return
  
  categoryChart = echarts.init(categoryChartRef.value)
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: {
        fontSize: 11
      }
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        labelLine: {
          show: false
        },
        data: mockCategoryData.map((item, index) => ({
          ...item,
          itemStyle: {
            color: ['#1890ff', '#722ed1', '#52c41a', '#fa8c16', '#eb2f96'][index]
          }
        }))
      }
    ]
  }
  
  categoryChart.setOption(option)
}

const handleResize = () => {
  trendChart?.resize()
  successRateChart?.resize()
  categoryChart?.resize()
}

onMounted(() => {
  loadData()
  setTimeout(() => {
    initTrendChart()
    initSuccessRateChart()
    initCategoryChart()
    window.addEventListener('resize', handleResize)
  }, 100)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  successRateChart?.dispose()
  categoryChart?.dispose()
})
</script>

<style scoped lang="less">
.publish-panel-page {
  width: 100%;
  padding: 8px 0;
}

.card-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;

  .title-icon {
    margin-right: 8px;
    color: #1890ff;
  }
}

.card-title-sm {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;
  border-radius: 12px;
  overflow: hidden;

  :deep(.ant-card-body) {
    padding: 20px;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  &.stat-card-blue {
    .stat-icon {
      background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
    }
  }

  &.stat-card-purple {
    .stat-icon {
      background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%);
    }
  }

  &.stat-card-green {
    .stat-icon {
      background: linear-gradient(135deg, #52c41a 0%, #95de64 100%);
    }
  }

  &.stat-card-orange {
    .stat-icon {
      background: linear-gradient(135deg, #fa8c16 0%, #ffec3d 100%);
    }
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.stat-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.stat-trend {
  font-size: 12px;
  font-weight: 500;

  &.up {
    color: #52c41a;
  }

  &.down {
    color: #ff4d4f;
  }
}

.stat-label {
  font-size: 12px;
  color: #8c8c8c;
}

.config-card {
  border-radius: 12px;

  :deep(.ant-card-head) {
    border-bottom: none;
    padding-bottom: 0;
  }

  :deep(.ant-card-body) {
    padding-top: 16px;
  }
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 16px;

  .section-icon {
    margin-right: 8px;
    color: #1890ff;
  }
}

.mode-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: 2px solid #e8e8e8;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  background: #fff;

  &:hover {
    border-color: #1890ff;
    background: #f0f9ff;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
  }

  &.active {
    border-color: #1890ff;
    background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%);
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2);
  }
}

.mode-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mode-icon {
  font-size: 28px;
  color: #fff;
}

.mode-info {
  flex: 1;
}

.mode-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.mode-desc {
  font-size: 13px;
  color: #8c8c8c;
}

.mode-active-tag {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #52c41a;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
}

.quick-config-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 10px;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: #f0f9ff;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
}

.quick-config-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
  flex-shrink: 0;

  &.calendar {
    background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  }

  &.frequency {
    background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%);
  }

  &.platform {
    background: linear-gradient(135deg, #52c41a 0%, #95de64 100%);
  }

  &.timeline {
    background: linear-gradient(135deg, #fa8c16 0%, #ffec3d 100%);
  }
}

.quick-config-info {
  flex: 1;
}

.quick-config-title {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 2px;
}

.quick-config-desc {
  font-size: 12px;
  color: #8c8c8c;
}

.quick-config-arrow {
  color: #bfbfbf;
}

.schedule-config {
  h4 {
    margin-bottom: 16px;
    font-weight: 500;
  }
}

.queue-card,
.timeline-card,
.chart-card,
.record-card {
  border-radius: 12px;

  :deep(.ant-card-head) {
    border-bottom: 1px solid #f0f0f0;
  }
}

.queue-tabs {
  margin-bottom: 16px;

  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
  }

  :deep(.ant-tabs-tab) {
    font-size: 14px;
    font-weight: 500;
  }
}

.queue-list {
  max-height: 500px;
  overflow-y: auto;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  transition: all 0.3s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #fafafa;
  }

  &.selected {
    background: #e6f7ff;
  }
}

.queue-checkbox {
  flex-shrink: 0;
}

.queue-cover {
  width: 72px;
  height: 54px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .default-cover {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    font-size: 24px;
    color: #d9d9d9;
  }
}

.queue-content {
  flex: 1;
  min-width: 0;
}

.queue-title {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;

  .meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #8c8c8c;
  }
}

.queue-priority {
  flex-shrink: 0;

  :deep(.ant-select-selector) {
    border-radius: 6px;
  }
}

.priority-high {
  color: #ff4d4f;
  font-weight: 500;
}

.priority-normal {
  color: #1890ff;
}

.priority-low {
  color: #8c8c8c;
}

.queue-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.timeline-container {
  max-height: 500px;
  overflow-y: auto;
  padding: 8px 0;
}

.timeline-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;

  &.green {
    background: #52c41a;
  }

  &.red {
    background: #ff4d4f;
  }

  &.blue {
    background: #1890ff;
  }
}

.timeline-item-content {
  padding-bottom: 16px;

  .timeline-time {
    font-size: 12px;
    color: #8c8c8c;
    margin-bottom: 4px;
  }

  .timeline-title {
    font-weight: 500;
    color: #1a1a1a;
    margin-bottom: 4px;
    font-size: 14px;
  }

  .timeline-desc {
    font-size: 12px;
    color: #8c8c8c;
  }
}

.chart-container {
  height: 220px;
  width: 100%;
}

.record-timeline {
  padding: 16px 0;
}

.record-item {
  width: 100%;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.record-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

.record-meta {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 12px;

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #8c8c8c;
  }
}

.record-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #cf1322;
}

.record-stats {
  display: flex;
  gap: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-num {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .stat-label {
    font-size: 12px;
    color: #8c8c8c;
  }
}

.timeline-item {
  .timeline-time {
    font-size: 12px;
    color: #8c8c8c;
    margin-bottom: 4px;
  }

  .timeline-title {
    font-weight: 500;
    margin-bottom: 4px;
  }

  .timeline-desc {
    font-size: 13px;
    color: #8c8c8c;
  }
}
</style>
