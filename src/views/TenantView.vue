<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getCurrentTenantApi } from '@/api/tenants'
import { useAuthStore } from '@/stores/auth'
import type { Tenant } from '@/types/api'

const loading = ref(false)
const tenant = ref<Tenant | null>(null)
const auth = useAuthStore()

onMounted(async () => {
  loading.value = true
  try {
    tenant.value = await getCurrentTenantApi()
  } catch (error) {
    ElMessage.error('加载租户信息失败')
    console.error(error)
  } finally {
    loading.value = false
  }
})

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function getStatusType(status?: string): 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'active': return 'success'
    case 'suspended': return 'warning'
    case 'cancelled': return 'danger'
    default: return 'info'
  }
}

function getStatusText(status?: string): string {
  switch (status) {
    case 'active': return '活跃'
    case 'suspended': return '已暂停'
    case 'cancelled': return '已取消'
    default: return status || '-'
  }
}
</script>

<template>
  <div class="tenant-page" v-loading="loading">
    <el-page-header @back="$router.back()" title="返回">
      <template #content>
        <span class="page-title">租户管理</span>
      </template>
    </el-page-header>

    <div v-if="tenant" class="tenant-content">
      <el-row :gutter="24">
        <el-col :xs="24" :lg="16">
          <el-card class="info-card">
            <template #header>
              <div class="card-header">
                <span>基本信息</span>
                <el-tag :type="getStatusType(tenant.status)">
                  {{ getStatusText(tenant.status) }}
                </el-tag>
              </div>
            </template>
            
            <el-descriptions :column="2" border>
              <el-descriptions-item label="租户名称">
                {{ tenant.name }}
              </el-descriptions-item>
              <el-descriptions-item label="租户代码">
                <code>{{ tenant.code }}</code>
              </el-descriptions-item>
              <el-descriptions-item label="邮箱">
                {{ tenant.email || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="电话">
                {{ tenant.phone || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">
                {{ formatDate(tenant.createdAt) }}
              </el-descriptions-item>
              <el-descriptions-item label="更新时间">
                {{ formatDate(tenant.updatedAt) }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card v-if="tenant.plan" class="plan-card">
            <template #header>
              <div class="card-header">
                <span>当前套餐</span>
                <el-button type="primary" size="small" @click="$router.push('/plans')">
                  升级套餐
                </el-button>
              </div>
            </template>
            
            <div class="plan-info">
              <div class="plan-name">{{ tenant.plan.name }}</div>
              <div class="plan-code">代码: {{ tenant.plan.code }}</div>
              <div v-if="tenant.plan.price" class="plan-price">
                ¥{{ tenant.plan.price }}/{{ tenant.plan.billingCycle || '月' }}
              </div>
            </div>

            <el-divider />

            <div class="plan-limits">
              <div class="limit-item">
                <span class="limit-label">文章配额</span>
                <span class="limit-value">
                  {{ tenant.plan.articleLimit && tenant.plan.articleLimit > 0 ? tenant.plan.articleLimit + ' 篇' : '无限制' }}
                </span>
              </div>
              <div class="limit-item">
                <span class="limit-label">关键词配额</span>
                <span class="limit-value">
                  {{ tenant.plan.keywordLimit && tenant.plan.keywordLimit > 0 ? tenant.plan.keywordLimit + ' 个' : '无限制' }}
                </span>
              </div>
              <div class="limit-item">
                <span class="limit-label">媒体配额</span>
                <span class="limit-value">
                  {{ tenant.plan.mediaLimit && tenant.plan.mediaLimit > 0 ? tenant.plan.mediaLimit + ' 个' : '无限制' }}
                </span>
              </div>
              <div class="limit-item">
                <span class="limit-label">API 调用</span>
                <span class="limit-value">
                  {{ tenant.plan.apiCallLimit && tenant.plan.apiCallLimit > 0 ? tenant.plan.apiCallLimit + ' 次' : '无限制' }}
                </span>
              </div>
            </div>
          </el-card>

          <el-card v-if="tenant.subscriptionStart || tenant.subscriptionEnd" class="subscription-card">
            <template #header>
              <span>订阅信息</span>
            </template>
            
            <el-descriptions :column="2" border>
              <el-descriptions-item label="订阅开始日期">
                {{ formatDate(tenant.subscriptionStart) }}
              </el-descriptions-item>
              <el-descriptions-item label="订阅结束日期">
                {{ formatDate(tenant.subscriptionEnd) }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>

        <el-col :xs="24" :lg="8">
          <el-card class="actions-card">
            <template #header>
              <span>快捷操作</span>
            </template>
            
            <div class="action-list">
              <el-button type="primary" @click="$router.push('/usage')">
                查看使用量
              </el-button>
              <el-button @click="$router.push('/plans')">
                升级套餐
              </el-button>
              <el-button type="info" @click="auth.logout(); $router.push('/tenant-login')">
                切换租户
              </el-button>
            </div>
          </el-card>

          <el-card class="help-card">
            <template #header>
              <span>帮助与支持</span>
            </template>
            
            <div class="help-content">
              <p>如需修改租户信息或续费，请联系客服：</p>
              <ul>
                <li>邮箱: support@chinaguide.com</li>
                <li>电话: 400-888-8888</li>
              </ul>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-empty v-else description="无法加载租户信息" />
  </div>
</template>

<style scoped>
.tenant-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.tenant-content {
  margin-top: 24px;
}

.info-card,
.plan-card,
.subscription-card,
.actions-card,
.help-card {
  margin-bottom: 24px;
  border-radius: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.plan-info {
  text-align: center;
  padding: 20px 0;
}

.plan-info .plan-name {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.plan-info .plan-code {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.plan-info .plan-price {
  font-size: 20px;
  color: #409eff;
  font-weight: 600;
}

.plan-limits {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.limit-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.limit-label {
  color: #606266;
}

.limit-value {
  font-weight: 600;
  color: #303133;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-list .el-button {
  width: 100%;
}

.help-content {
  color: #606266;
  font-size: 14px;
}

.help-content ul {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
}

.help-content li {
  padding: 8px 0;
}
</style>
