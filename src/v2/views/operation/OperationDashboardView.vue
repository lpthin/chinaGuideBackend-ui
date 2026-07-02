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
            </div>
          </a-card>
        </a-col>

        <a-col :span="8">
          <a-card title="分类分布" :bordered="false">
            <div class="pie-placeholder">
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
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16" style="margin-top: 16px">
        <a-col :span="12">
          <a-card title="热门文章 TOP10" :bordered="false">
            <a-list :data-source="topArticles" :split="false">
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
            <a-list :data-source="topCases" :split="false">
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
            <a-timeline>
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
import { ref, reactive, computed, onMounted } from 'vue'
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

const loading = ref(false)
const trendPeriod = ref<'week' | 'month' | 'quarter'>('week')

const stats = reactive({
  totalViews: 128563,
  viewGrowth: 12.5,
  totalArticles: 256,
  articleGrowth: 8.3,
  totalCases: 89,
  caseGrowth: 15.2,
  totalUsers: 3421,
  userGrowth: 2.1,
})

const trendData = computed(() => {
  const days = trendPeriod.value === 'week' ? 7 : trendPeriod.value === 'month' ? 30 : 90
  const labels = trendPeriod.value === 'week'
    ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    : Array.from({ length: Math.min(days, 15) }, (_, i) => `${i + 1}日`)

  return labels.map((date, index) => ({
    date,
    value: Math.floor(Math.random() * 5000) + 2000,
    height: 30 + Math.random() * 60,
  }))
})

const categoryData = [
  { name: '公司新闻', value: 45, color: '#1890ff' },
  { name: '行业动态', value: 62, color: '#52c41a' },
  { name: '产品发布', value: 28, color: '#faad14' },
  { name: '技术博客', value: 75, color: '#722ed1' },
  { name: '其他', value: 46, color: '#8c8c8c' },
]

const topArticles = [
  { title: '2024年行业发展趋势报告发布', viewCount: 8563, likeCount: 256 },
  { title: '公司完成新一轮融资，加速产品研发', viewCount: 7234, likeCount: 189 },
  { title: '新产品 v2.0 正式发布，新增多项功能', viewCount: 6521, likeCount: 178 },
  { title: 'Vue 3 组合式 API 最佳实践', viewCount: 5892, likeCount: 156 },
  { title: '微服务架构设计原则详解', viewCount: 4567, likeCount: 134 },
  { title: 'TypeScript 5.0 新特性介绍', viewCount: 4234, likeCount: 123 },
  { title: 'Docker 容器化部署完整指南', viewCount: 3892, likeCount: 98 },
  { title: '前端工程化完整方案分享', viewCount: 3567, likeCount: 87 },
  { title: 'API 设计最佳实践总结', viewCount: 3234, likeCount: 76 },
  { title: '自动化测试完整教程', viewCount: 2892, likeCount: 65 },
]

const topCases = [
  { title: '某大型电商平台数字化转型案例', viewCount: 6543, likeCount: 198 },
  { title: '金融行业智能客服系统解决方案', viewCount: 5432, likeCount: 167 },
  { title: '制造业生产管理系统成功案例', viewCount: 4321, likeCount: 134 },
  { title: '教育行业在线学习平台建设', viewCount: 3876, likeCount: 112 },
  { title: '医疗健康大数据平台实施案例', viewCount: 3234, likeCount: 98 },
]

const recentActivities = [
  { title: '新文章《2024 Q1 市场分析报告》已发布', time: '5分钟前', icon: PlusOutlined, color: '#52c41a' },
  { title: '用户 张三 提交了新的留言', time: '12分钟前', icon: MessageOutlined, color: '#1890ff' },
  { title: '文章《产品更新公告》被编辑更新', time: '30分钟前', icon: EditOutlined, color: '#faad14' },
  { title: 'Banner「春季特惠活动」已上线', time: '1小时前', icon: PlusOutlined, color: '#722ed1' },
  { title: '文章《旧版功能说明》已被删除', time: '2小时前', icon: DeleteOutlined, color: '#ff4d4f' },
  { title: '新用户 李四 完成注册', time: '3小时前', icon: UserOutlined, color: '#13c2c2' },
]

onMounted(() => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 500)
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
