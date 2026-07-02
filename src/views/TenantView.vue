<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getCurrentTenantApi } from '@/api/tenants'
import { useAuthStore } from '@/stores/auth'
import type { Tenant } from '@/types/api'
import { formatTime } from '@/utils/format'

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

function getStatusBgClass(status?: string): string {
  switch (status) {
    case 'active': return 'bg-success-light'
    case 'suspended': return 'bg-warning-light'
    case 'cancelled': return 'bg-danger-light'
    default: return 'bg-info-light'
  }
}
</script>

<template>
  <div class="tenant-page" v-loading="loading">
    <div class="page-header-wrapper">
      <el-page-header @back="$router.back()" title="返回">
        <template #content>
          <span class="page-title">租户管理</span>
        </template>
      </el-page-header>
    </div>

    <div v-if="tenant" class="tenant-content">
      <el-row :gutter="24">
        <el-col :xs="24" :lg="16">
          <div class="info-card-wrapper">
            <el-card class="info-card">
              <template #header>
                <div class="card-header">
                  <div class="header-left">
                    <div class="header-icon-wrapper">
                      <span class="header-icon">🏢</span>
                    </div>
                    <div>
                      <h3 class="card-title">基本信息</h3>
                      <p class="card-subtitle">管理您的租户账户</p>
                    </div>
                  </div>
                  <el-tag 
                    :type="getStatusType(tenant.status)" 
                    :class="[getStatusBgClass(tenant.status), 'status-tag']"
                  >
                    {{ getStatusText(tenant.status) }}
                  </el-tag>
                </div>
              </template>
              
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">租户名称</span>
                  <span class="info-value">{{ tenant.name }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">租户代码</span>
                  <code class="info-value code-value">{{ tenant.code }}</code>
                </div>
                <div class="info-item">
                  <span class="info-label">邮箱</span>
                  <span class="info-value">{{ tenant.email || '-' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">电话</span>
                  <span class="info-value">{{ tenant.phone || '-' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">创建时间</span>
                  <span class="info-value">{{ formatTime(tenant.createdAt) }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">更新时间</span>
                  <span class="info-value">{{ formatTime(tenant.updatedAt) }}</span>
                </div>
              </div>
            </el-card>
          </div>

          <div v-if="tenant.plan" class="plan-card-wrapper">
            <el-card class="plan-card">
              <template #header>
                <div class="card-header">
                  <div class="header-left">
                    <div class="header-icon-wrapper plan-icon">
                      <span class="header-icon">🎯</span>
                    </div>
                    <div>
                      <h3 class="card-title">当前套餐</h3>
                      <p class="card-subtitle">查看您的订阅详情</p>
                    </div>
                  </div>
                  <el-button type="primary" size="small" @click="$router.push('/plans')" class="upgrade-btn">
                    升级套餐
                  </el-button>
                </div>
              </template>
              
              <div class="plan-info">
                <div class="plan-name-wrapper">
                  <span class="plan-name">{{ tenant.plan.name }}</span>
                  <span v-if="tenant.plan.code === 'pro'" class="plan-badge">推荐</span>
                </div>
                <div class="plan-code">代码: {{ tenant.plan.code }}</div>
                <div v-if="tenant.plan.price" class="plan-price">
                  <span class="price-symbol">¥</span>
                  <span class="price-value">{{ tenant.plan.price }}</span>
                  <span class="price-period">/{{ tenant.plan.billingCycle || '月' }}</span>
                </div>
              </div>

              <el-divider class="plan-divider" />

              <div class="plan-limits">
                <div class="limit-item">
                  <div class="limit-icon">📝</div>
                  <div class="limit-content">
                    <span class="limit-label">文章配额</span>
                    <span class="limit-value">
                      {{ tenant.plan.articleLimit && tenant.plan.articleLimit > 0 ? tenant.plan.articleLimit + ' 篇' : '无限制' }}
                    </span>
                  </div>
                </div>
                <div class="limit-item">
                  <div class="limit-icon">🔑</div>
                  <div class="limit-content">
                    <span class="limit-label">关键词配额</span>
                    <span class="limit-value">
                      {{ tenant.plan.keywordLimit && tenant.plan.keywordLimit > 0 ? tenant.plan.keywordLimit + ' 个' : '无限制' }}
                    </span>
                  </div>
                </div>
                <div class="limit-item">
                  <div class="limit-icon">🖼️</div>
                  <div class="limit-content">
                    <span class="limit-label">媒体配额</span>
                    <span class="limit-value">
                      {{ tenant.plan.mediaLimit && tenant.plan.mediaLimit > 0 ? tenant.plan.mediaLimit + ' 个' : '无限制' }}
                    </span>
                  </div>
                </div>
                <div class="limit-item">
                  <div class="limit-icon">⚡</div>
                  <div class="limit-content">
                    <span class="limit-label">API 调用</span>
                    <span class="limit-value">
                      {{ tenant.plan.apiCallLimit && tenant.plan.apiCallLimit > 0 ? tenant.plan.apiCallLimit + ' 次' : '无限制' }}
                    </span>
                  </div>
                </div>
              </div>
            </el-card>
          </div>

          <div v-if="tenant.subscriptionStart || tenant.subscriptionEnd" class="subscription-card-wrapper">
            <el-card class="subscription-card">
              <template #header>
                <div class="card-header">
                  <div class="header-left">
                    <div class="header-icon-wrapper subscription-icon">
                      <span class="header-icon">📅</span>
                    </div>
                    <div>
                      <h3 class="card-title">订阅信息</h3>
                      <p class="card-subtitle">您的订阅期限</p>
                    </div>
                  </div>
                </div>
              </template>
              
              <div class="subscription-info">
                <div class="subscription-item">
                  <div class="subscription-icon-wrapper">
                    <span>📌</span>
                  </div>
                  <div>
                    <span class="subscription-label">订阅开始日期</span>
                    <span class="subscription-value">{{ formatTime(tenant.subscriptionStart) }}</span>
                  </div>
                </div>
                <div class="subscription-item">
                  <div class="subscription-icon-wrapper">
                    <span>🎯</span>
                  </div>
                  <div>
                    <span class="subscription-label">订阅结束日期</span>
                    <span class="subscription-value">{{ formatTime(tenant.subscriptionEnd) }}</span>
                  </div>
                </div>
              </div>
            </el-card>
          </div>
        </el-col>

        <el-col :xs="24" :lg="8">
          <div class="actions-card-wrapper">
            <el-card class="actions-card">
              <template #header>
                <div class="card-header">
                  <div class="header-left">
                    <div class="header-icon-wrapper actions-icon">
                      <span class="header-icon">⚡</span>
                    </div>
                    <div>
                      <h3 class="card-title">快捷操作</h3>
                      <p class="card-subtitle">常用功能入口</p>
                    </div>
                  </div>
                </div>
              </template>
              
              <div class="action-list">
                <el-button type="primary" @click="$router.push('/usage')" class="action-btn">
                  <span class="btn-icon">📊</span>
                  <span>查看使用量</span>
                </el-button>
                <el-button @click="$router.push('/plans')" class="action-btn">
                  <span class="btn-icon">⬆️</span>
                  <span>升级套餐</span>
                </el-button>
                <el-button type="info" @click="auth.logout(); $router.push('/tenant-login')" class="action-btn">
                  <span class="btn-icon">🔄</span>
                  <span>切换租户</span>
                </el-button>
              </div>
            </el-card>
          </div>

          <div class="help-card-wrapper">
            <el-card class="help-card">
              <template #header>
                <div class="card-header">
                  <div class="header-left">
                    <div class="header-icon-wrapper help-icon">
                      <span class="header-icon">💬</span>
                    </div>
                    <div>
                      <h3 class="card-title">帮助与支持</h3>
                      <p class="card-subtitle">获取专业支持</p>
                    </div>
                  </div>
                </div>
              </template>
              
              <div class="help-content">
                <p class="help-desc">如需修改租户信息或续费，请联系客服：</p>
                <div class="help-contact">
                  <div class="contact-item">
                    <span class="contact-icon">✉️</span>
                    <span class="contact-text">support@chinaguide.com</span>
                  </div>
                  <div class="contact-item">
                    <span class="contact-icon">📞</span>
                    <span class="contact-text">400-888-8888</span>
                  </div>
                </div>
              </div>
            </el-card>
          </div>
        </el-col>
      </el-row>
    </div>

    <el-empty v-else description="无法加载租户信息" class="empty-state" />
  </div>
</template>

<style scoped>
.tenant-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.page-header-wrapper {
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
  background: linear-gradient(135deg, #409eff, #67c23a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tenant-content {
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.info-card-wrapper,
.plan-card-wrapper,
.subscription-card-wrapper,
.actions-card-wrapper,
.help-card-wrapper {
  margin-bottom: 24px;
}

.info-card,
.plan-card,
.subscription-card,
.actions-card,
.help-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  overflow: hidden;
}

.info-card:hover,
.plan-card:hover,
.subscription-card:hover,
.actions-card:hover,
.help-card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
}

.header-icon-wrapper.plan-icon {
  background: linear-gradient(135deg, #f5a623 0%, #f7b84e 100%);
}

.header-icon-wrapper.subscription-icon {
  background: linear-gradient(135deg, #9b59b6 0%, #bb6bd9 100%);
}

.header-icon-wrapper.actions-icon {
  background: linear-gradient(135deg, #3498db 0%, #5dade2 100%);
}

.header-icon-wrapper.help-icon {
  background: linear-gradient(135deg, #1abc9c 0%, #1dd1a1 100%);
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 4px;
}

.card-subtitle {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.status-tag {
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 20px;
}

.bg-success-light {
  background: rgba(103, 194, 58, 0.1);
}

.bg-warning-light {
  background: rgba(230, 162, 60, 0.1);
}

.bg-danger-light {
  background: rgba(245, 108, 108, 0.1);
}

.bg-info-light {
  background: rgba(144, 147, 153, 0.1);
}

.upgrade-btn {
  border-radius: 8px;
  font-weight: 500;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 20px 24px;
}

.info-item {
  padding: 14px 16px;
  background: #f8fafc;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.info-item:hover {
  background: #f1f5f9;
  transform: translateX(4px);
}

.info-label {
  display: block;
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 6px;
}

.info-value {
  font-size: 15px;
  font-weight: 500;
  color: #1a1a2e;
}

.code-value {
  font-family: 'Monaco', 'Consolas', monospace;
  background: #1e293b;
  color: #e2e8f0;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
}

.plan-info {
  text-align: center;
  padding: 24px 0;
}

.plan-name-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.plan-name {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
}

.plan-badge {
  background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.plan-code {
  font-size: 14px;
  color: #94a3b8;
  margin: 8px 0;
}

.plan-price {
  margin-top: 12px;
}

.price-symbol {
  font-size: 24px;
  color: #409eff;
  vertical-align: top;
}

.price-value {
  font-size: 56px;
  font-weight: 700;
  color: #409eff;
  line-height: 1;
}

.price-period {
  font-size: 16px;
  color: #94a3b8;
  margin-left: 4px;
}

.plan-divider {
  margin: 0 24px;
  border-color: rgba(0, 0, 0, 0.06);
}

.plan-limits {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 20px 24px;
}

.limit-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #f8fafc;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.limit-item:hover {
  background: #f1f5f9;
  transform: translateY(-2px);
}

.limit-icon {
  font-size: 20px;
}

.limit-content {
  flex: 1;
}

.limit-label {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.limit-value {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.subscription-info {
  padding: 20px 24px;
}

.subscription-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.06);
}

.subscription-item:last-child {
  border-bottom: none;
}

.subscription-icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.subscription-label {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.subscription-value {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a2e;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 24px;
}

.action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border-radius: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
}

.btn-icon {
  font-size: 16px;
}

.help-content {
  padding: 16px 24px;
}

.help-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 16px;
  line-height: 1.6;
}

.help-contact {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #f8fafc;
  border-radius: 10px;
}

.contact-icon {
  font-size: 16px;
}

.contact-text {
  font-size: 14px;
  color: #475569;
}

.empty-state {
  padding: 80px 0;
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .plan-limits {
    grid-template-columns: 1fr;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .page-title {
    font-size: 20px;
  }
}
</style>
