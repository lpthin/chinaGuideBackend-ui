<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getTenantUsageApi, getCurrentTenantApi } from '@/api/tenants'
import type { Tenant, TenantUsage } from '@/types/api'

const loading = ref(false)
const tenant = ref<Tenant | null>(null)
const usageRecords = ref<TenantUsage[]>([])
const usageMap = ref<Record<string, TenantUsage>>({})

onMounted(async () => {
  loading.value = true
  try {
    const [tenantData, usageData] = await Promise.all([
      getCurrentTenantApi(),
      getTenantUsageApi()
    ])
    tenant.value = tenantData
    usageMap.value = usageData
    usageRecords.value = Object.values(usageData)
  } catch (error) {
    ElMessage.error('加载使用量数据失败')
    console.error(error)
  } finally {
    loading.value = false
  }
})

const usageItems = computed(() => {
  const plan = tenant.value?.plan
  const items = [
    {
      key: 'articles',
      label: '文章',
      icon: '📄',
      used: usageMap.value['articles']?.usedCount || 0,
      limit: plan?.articleLimit || 0,
      unit: '篇'
    },
    {
      key: 'keywords',
      label: '关键词',
      icon: '🔑',
      used: usageMap.value['keywords']?.usedCount || 0,
      limit: plan?.keywordLimit || 0,
      unit: '个'
    },
    {
      key: 'media',
      label: '媒体文件',
      icon: '🖼️',
      used: usageMap.value['media']?.usedCount || 0,
      limit: plan?.mediaLimit || 0,
      unit: '个'
    },
    {
      key: 'api_calls',
      label: 'API 调用',
      icon: '📡',
      used: usageMap.value['api_calls']?.usedCount || 0,
      limit: plan?.apiCallLimit || 0,
      unit: '次'
    }
  ]
  return items
})

function getPercentage(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function getStatus(percentage: number): '' | 'success' | 'warning' | 'exception' {
  if (percentage >= 100) return 'exception'
  if (percentage >= 90) return 'warning'
  return 'success'
}

function isUnlimited(limit: number): boolean {
  return limit <= 0
}
</script>

<template>
  <div class="usage-page" v-loading="loading">
    <el-page-header @back="$router.back()" title="返回">
      <template #content>
        <span class="page-title">使用量统计</span>
      </template>
    </el-page-header>

    <el-card v-if="tenant" class="tenant-info-card">
      <div class="tenant-info">
        <div class="tenant-name">{{ tenant.name }}</div>
        <div class="tenant-code">租户代码: {{ tenant.code }}</div>
        <el-tag v-if="tenant.plan" type="success">{{ tenant.plan.name }}</el-tag>
      </div>
    </el-card>

    <div class="usage-grid">
      <el-card 
        v-for="item in usageItems" 
        :key="item.key" 
        class="usage-card"
        shadow="hover"
      >
        <div class="usage-header">
          <span class="usage-icon">{{ item.icon }}</span>
          <span class="usage-label">{{ item.label }}</span>
        </div>
        
        <div class="usage-content">
          <template v-if="isUnlimited(item.limit)">
            <div class="usage-unlimited">
              <span class="usage-count">{{ item.used.toLocaleString() }}</span>
              <span class="usage-unit">{{ item.unit }}</span>
            </div>
            <el-tag type="info" size="small">无限制</el-tag>
          </template>
          <template v-else>
            <div class="usage-stats">
              <span class="usage-count">{{ item.used.toLocaleString() }}</span>
              <span class="usage-separator">/</span>
              <span class="usage-limit">{{ item.limit.toLocaleString() }}</span>
              <span class="usage-unit">{{ item.unit }}</span>
            </div>
            <el-progress 
              :percentage="getPercentage(item.used, item.limit)" 
              :status="getStatus(getPercentage(item.used, item.limit))"
              :stroke-width="12"
            />
            <div class="usage-remaining">
              剩余: {{ Math.max(0, item.limit - item.used).toLocaleString() }} {{ item.unit }}
            </div>
          </template>
        </div>
      </el-card>
    </div>

    <el-card class="usage-detail-card">
      <template #header>
        <div class="card-header">
          <span>使用量详情</span>
          <el-button type="primary" size="small" @click="$router.push('/plans')">
            升级套餐
          </el-button>
        </div>
      </template>
      
      <el-table :data="usageRecords" stripe>
        <el-table-column prop="usageType" label="使用类型" width="150">
          <template #default="{ row }">
            <el-tag>{{ row.usageType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="usedCount" label="已使用" width="150">
          <template #default="{ row }">
            {{ row.usedCount.toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="date" label="统计日期" width="180" />
        <el-table-column prop="createdAt" label="创建时间" />
      </el-table>
    </el-card>

    <el-alert
      v-if="usageItems.some(item => !isUnlimited(item.limit) && getStatus(getPercentage(item.used, item.limit)) !== 'success')"
      title="使用量提醒"
      type="warning"
      show-icon
      :closable="false"
      class="usage-alert"
    >
      <template #default>
        您已达到当前套餐的使用量限制的 90% 以上，建议升级套餐以获得更多配额。
        <el-button type="warning" size="small" @click="$router.push('/plans')">
          立即升级
        </el-button>
      </template>
    </el-alert>
  </div>
</template>

<style scoped>
.usage-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.tenant-info-card {
  margin-bottom: 24px;
}

.tenant-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.tenant-name {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.tenant-code {
  color: #909399;
  font-size: 14px;
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.usage-card {
  border-radius: 12px;
}

.usage-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.usage-icon {
  font-size: 28px;
}

.usage-label {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.usage-content {
  padding: 8px 0;
}

.usage-stats,
.usage-unlimited {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 12px;
}

.usage-count {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
}

.usage-separator {
  font-size: 20px;
  color: #909399;
  margin: 0 2px;
}

.usage-limit {
  font-size: 20px;
  color: #606266;
}

.usage-unit {
  font-size: 14px;
  color: #909399;
  margin-left: 4px;
}

.usage-remaining {
  margin-top: 8px;
  font-size: 13px;
  color: #909399;
  text-align: right;
}

.usage-detail-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.usage-alert {
  margin-top: 16px;
}

.usage-alert .el-button {
  margin-left: 16px;
}
</style>
