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
                  </div>
                </a-card>
              </a-col>
              <a-col :span="8">
                <a-card title="分类占比" size="small">
                  <div class="pie-chart-container">
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
                  </div>
                </a-card>
              </a-col>
            </a-row>
          </a-tab-pane>

          <a-tab-pane key="article" tab="文章分析">
            <a-table
              :columns="articleColumns"
              :data-source="articleData"
              :pagination="articlePagination"
              :row-key="record => record.id"
              style="margin-top: 16px"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'viewGrowth'">
                  <span :class="record.viewGrowth >= 0 ? 'growth-up' : 'growth-down'">
                    <ArrowUpOutlined v-if="record.viewGrowth >= 0" />
                    <ArrowDownOutlined v-else />
                    {{ Math.abs(record.viewGrowth) }}%
                  </span>
                </template>
              </template>
            </a-table>
          </a-tab-pane>

          <a-tab-pane key="user" tab="用户分析">
            <a-row :gutter="16" style="margin-top: 16px">
              <a-col :span="12">
                <a-card title="用户增长趋势" size="small">
                  <div class="chart-container">
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
                  </div>
                </a-card>
              </a-col>
              <a-col :span="12">
                <a-card title="用户活跃度" size="small">
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
                </a-card>
              </a-col>
            </a-row>
          </a-tab-pane>

          <a-tab-pane key="source" tab="来源分析">
            <a-row :gutter="16" style="margin-top: 16px">
              <a-col :span="12">
                <a-card title="流量来源" size="small">
                  <div class="source-list">
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
                  </div>
                </a-card>
              </a-col>
              <a-col :span="12">
                <a-card title="设备分布" size="small">
                  <div class="device-list">
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
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  EyeOutlined,
  UserOutlined,
  LikeOutlined,
  DownloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MobileOutlined,
  TabletOutlined,
  DesktopOutlined,
} from '@ant-design/icons-vue'

const loading = ref(false)
const activeTab = ref('overview')

const stats = reactive({
  totalArticles: 1256,
  totalViews: 895623,
  totalUsers: 3256,
  totalLikes: 45632,
})

const queryParams = reactive({
  reportType: 'article',
  dateRange: [] as any[],
})

const chartData = ref([
  { date: '周一', value: 12500 },
  { date: '周二', value: 15800 },
  { date: '周三', value: 14200 },
  { date: '周四', value: 18500 },
  { date: '周五', value: 21200 },
  { date: '周六', value: 16800 },
  { date: '周日', value: 13500 },
])

const maxValue = computed(() => Math.max(...chartData.value.map(d => d.value)))

const categoryData = ref([
  { name: '公司新闻', value: 356, color: '#1890ff', percent: 28 },
  { name: '行业动态', value: 423, color: '#52c41a', percent: 34 },
  { name: '技术博客', value: 289, color: '#722ed1', percent: 23 },
  { name: '产品发布', value: 188, color: '#fa8c16', percent: 15 },
])

const articleColumns = [
  { title: '文章标题', dataIndex: 'title', key: 'title', width: 250 },
  { title: '分类', dataIndex: 'category', key: 'category', width: 120 },
  { title: '浏览量', dataIndex: 'views', key: 'views', width: 100, align: 'right' },
  { title: '周环比', key: 'viewGrowth', width: 100, align: 'right' },
  { title: '点赞数', dataIndex: 'likes', key: 'likes', width: 100, align: 'right' },
  { title: '评论数', dataIndex: 'comments', key: 'comments', width: 100, align: 'right' },
  { title: '作者', dataIndex: 'author', key: 'author', width: 100 },
  { title: '发布时间', dataIndex: 'publishTime', key: 'publishTime', width: 180 },
]

const articleData = ref([
  { id: 1, title: '2024年AI行业发展趋势分析报告', category: '行业动态', views: 15680, viewGrowth: 25.6, likes: 456, comments: 89, author: '张三', publishTime: '2024-03-15' },
  { id: 2, title: '产品 v2.0 正式发布，新增多项AI功能', category: '产品发布', views: 12350, viewGrowth: 18.3, likes: 328, comments: 67, author: '李四', publishTime: '2024-03-14' },
  { id: 3, title: '公司完成新一轮融资，估值突破10亿', category: '公司新闻', views: 28960, viewGrowth: 42.1, likes: 892, comments: 156, author: '王五', publishTime: '2024-03-13' },
  { id: 4, title: '深度解析：大语言模型的商业化路径', category: '技术博客', views: 9870, viewGrowth: -5.2, likes: 234, comments: 45, author: '赵六', publishTime: '2024-03-12' },
  { id: 5, title: '一文读懂AIGC在各行业的应用', category: '技术博客', views: 18650, viewGrowth: 32.8, likes: 567, comments: 98, author: '钱七', publishTime: '2024-03-11' },
])

const articlePagination = reactive({
  current: 1,
  pageSize: 10,
  total: 56,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const userGrowthData = ref([
  { date: '1月', value: 280 },
  { date: '2月', value: 320 },
  { date: '3月', value: 380 },
  { date: '4月', value: 420 },
  { date: '5月', value: 480 },
  { date: '6月', value: 520 },
])

const userActivityData = ref([
  { name: '日活跃用户', value: 68, color: '#1890ff' },
  { name: '周活跃用户', value: 82, color: '#52c41a' },
  { name: '月活跃用户', value: 95, color: '#722ed1' },
  { name: '用户留存率', value: 76, color: '#fa8c16' },
  { name: '用户转化率', value: 24, color: '#eb2f96' },
])

const sourceData = ref([
  { name: '直接访问', visits: 285620, percent: 32, color: '#1890ff' },
  { name: '搜索引擎', visits: 198560, percent: 22, color: '#52c41a' },
  { name: '社交媒体', visits: 156890, percent: 18, color: '#722ed1' },
  { name: '外部链接', visits: 124580, percent: 14, color: '#fa8c16' },
  { name: '邮件营销', visits: 89650, percent: 10, color: '#eb2f96' },
  { name: '其他来源', visits: 40323, percent: 4, color: '#8c8c8c' },
])

const deviceData = ref([
  { name: '桌面端', visits: 456820, percent: 51, color: '#1890ff', icon: DesktopOutlined },
  { name: '移动端', visits: 385260, percent: 43, color: '#52c41a', icon: MobileOutlined },
  { name: '平板端', visits: 53543, percent: 6, color: '#722ed1', icon: TabletOutlined },
])

async function loadData() {
  loading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    message.success('数据加载完成')
  } catch (error) {
    message.error('数据加载失败')
  } finally {
    loading.value = false
  }
}

async function exportReport() {
  try {
    message.loading({ content: '正在生成报表...', key: 'export' })
    await new Promise(resolve => setTimeout(resolve, 2000))
    message.success({ content: '报表导出成功', key: 'export' })
  } catch (error) {
    message.error('导出失败')
  }
}

onMounted(() => {
  loadData()
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
