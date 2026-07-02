<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CreditCard, User, Document, Check } from '@element-plus/icons-vue'

const loading = ref(false)
const stats = ref({
  totalTenants: 0,
  activeTenants: 0,
  totalRevenue: 0,
  monthlyRevenue: 0,
  tenantGrowth: [] as Array<{ label: string; value: number }>,
  revenueTrend: [] as Array<{ label: string; value: number }>
})

const statCards = [
  { label: '总租户数', key: 'totalTenants', icon: User, color: '#3b82f6', bg: '#eff6ff' },
  { label: '活跃租户', key: 'activeTenants', icon: User, color: '#10b981', bg: '#ecfdf5' },
  { label: '总收入', key: 'totalRevenue', icon: Document, color: '#8b5cf6', bg: '#f5f3ff', prefix: '¥' },
  { label: '本月收入', key: 'monthlyRevenue', icon: CreditCard, color: '#f59e0b', bg: '#fffbeb', prefix: '¥' }
]

onMounted(async () => {
  await loadStats()
})

async function loadStats() {
  loading.value = true
  try {
    stats.value = {
      totalTenants: 75,
      activeTenants: 62,
      totalRevenue: 22500.00,
      monthlyRevenue: 6800.00,
      tenantGrowth: [
        { label: '4周前', value: 15 },
        { label: '3周前', value: 28 },
        { label: '2周前', value: 42 },
        { label: '1周前', value: 58 },
        { label: '本周', value: 75 }
      ],
      revenueTrend: [
        { label: '1月', value: 2800 },
        { label: '2月', value: 3600 },
        { label: '3月', value: 4200 },
        { label: '4月', value: 5100 },
        { label: '5月', value: 6800 }
      ]
    }
  } catch (error) {
    ElMessage.error('加载统计数据失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function formatValue(value: number, prefix?: string) {
  if (prefix) {
    return `${prefix}${value.toLocaleString()}`
  }
  return value.toLocaleString()
}

function getBarHeight(value: number, max: number) {
  const percentage = Math.min(100, (value / max) * 100)
  return `${percentage}%`
}
</script>

<template>
  <div class="admin-dashboard-page" v-loading="loading">
    <div class="page-header">
      <h2>数据看板</h2>
      <p>平台数据概览与业务指标</p>
    </div>

    <div class="stats-grid">
      <div v-for="card in statCards" :key="card.key" class="stat-card" :style="{ background: card.bg }">
        <div class="stat-icon" :style="{ background: card.color, color: '#fff' }">
          <el-icon :size="24"><component :is="card.icon" /></el-icon>
        </div>
        <div class="stat-content">
          <p class="stat-label">{{ card.label }}</p>
          <p class="stat-value">{{ formatValue(stats[card.key], card.prefix) }}</p>
        </div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-header">
          <h3 class="chart-title">租户增长趋势</h3>
          <el-icon><Document /></el-icon>
        </div>
        <div class="chart-container">
          <div class="bar-chart">
            <div v-for="(item, index) in stats.tenantGrowth" :key="index" class="bar-item">
              <div class="bar-wrapper">
                <div class="bar" :style="{ height: getBarHeight(item.value, 75), background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)' }"></div>
              </div>
              <span class="bar-label">{{ item.label }}</span>
              <span class="bar-value">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <h3 class="chart-title">收入趋势</h3>
          <el-icon><Check /></el-icon>
        </div>
        <div class="chart-container">
          <div class="bar-chart">
            <div v-for="(item, index) in stats.revenueTrend" :key="index" class="bar-item">
              <div class="bar-wrapper">
                <div class="bar" :style="{ height: getBarHeight(item.value, 6800), background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)' }"></div>
              </div>
              <span class="bar-label">{{ item.label }}</span>
              <span class="bar-value">¥{{ item.value.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-dashboard-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h2 {
  font-size: 28px;
  color: #1f2937;
  margin: 0 0 8px;
}

.page-header p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  border-radius: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.chart-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.chart-container {
  min-height: 280px;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 240px;
  padding-bottom: 20px;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.bar-wrapper {
  width: 40px;
  height: 180px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 32px;
  border-radius: 8px 8px 0 0;
  transition: height 0.3s ease;
}

.bar-label {
  font-size: 12px;
  color: #6b7280;
}

.bar-value {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
