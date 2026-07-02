<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElSwitch } from 'element-plus'
import { Check, Edit } from '@element-plus/icons-vue'
import { getPaymentConfigsApi, savePaymentConfigApi, togglePaymentApi, initPaymentConfigsApi, type PaymentConfig } from '@/api/tenants'

const loading = ref(false)
const configs = ref<PaymentConfig[]>([])
const activeConfig = ref<PaymentConfig | null>(null)
const dialogVisible = ref(false)

const providerNames: Record<string, string> = {
  alipay: '支付宝',
  wechatpay: '微信支付'
}

const providerIcons: Record<string, string> = {
  alipay: '🟡',
  wechatpay: '🟢'
}

onMounted(async () => {
  await loadConfigs()
})

async function loadConfigs() {
  loading.value = true
  try {
    configs.value = await getPaymentConfigsApi()
  } catch (error) {
    ElMessage.error('加载支付配置失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function handleToggle(config: PaymentConfig) {
  try {
    await togglePaymentApi(config.provider, !config.enabled)
    config.enabled = !config.enabled
    ElMessage.success(`${providerNames[config.provider]}已${config.enabled ? '启用' : '禁用'}`)
  } catch (error) {
    config.enabled = !config.enabled
    ElMessage.error('切换失败')
    console.error(error)
  }
}

function openConfigDialog(config: PaymentConfig) {
  activeConfig.value = { ...config }
  dialogVisible.value = true
}

async function saveConfig() {
  if (!activeConfig.value) return
  
  loading.value = true
  try {
    await savePaymentConfigApi(activeConfig.value)
    ElMessage.success('配置保存成功')
    dialogVisible.value = false
    await loadConfigs()
  } catch (error) {
    ElMessage.error('保存失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function initializeConfigs() {
  try {
    await initPaymentConfigsApi()
    ElMessage.success('初始化成功')
    await loadConfigs()
  } catch (error) {
    ElMessage.error('初始化失败')
    console.error(error)
  }
}
</script>

<template>
  <div class="payment-config-page" v-loading="loading">
    <el-page-header @back="$router.back()" title="返回">
      <template #content>
        <span class="page-title">支付方式配置</span>
      </template>
    </el-page-header>

    <div class="config-intro">
      <h2>支付渠道管理</h2>
      <p>配置和管理您的支付渠道，包括支付宝和微信支付</p>
    </div>

    <div class="config-list">
      <el-card v-for="config in configs" :key="config.provider" class="config-card">
        <div class="config-header">
          <div class="config-info">
            <span class="provider-icon">{{ providerIcons[config.provider] }}</span>
            <span class="provider-name">{{ providerNames[config.provider] || config.provider }}</span>
            <el-tag v-if="config.enabled" type="success" size="small">已启用</el-tag>
            <el-tag v-else type="info" size="small">已禁用</el-tag>
          </div>
          <el-switch
            :model-value="config.enabled"
            @change="handleToggle(config)"
            active-text="启用"
            inactive-text="禁用"
          />
        </div>

        <el-divider />

        <div class="config-details">
          <div class="detail-item">
            <span class="label">商户号:</span>
            <span class="value">{{ config.merchantId || '未配置' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">应用ID:</span>
            <span class="value">{{ config.appId || '未配置' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">回调地址:</span>
            <span class="value">{{ config.callbackUrl || '未配置' }}</span>
          </div>
        </div>

        <div class="config-actions">
          <el-button type="primary" @click="openConfigDialog(config)">
            <el-icon><Edit /></el-icon>
            配置
          </el-button>
        </div>
      </el-card>
    </div>

    <el-empty v-if="configs.length === 0" description="暂无支付配置">
      <el-button type="primary" @click="initializeConfigs">初始化配置</el-button>
    </el-empty>

    <el-dialog v-model="dialogVisible" title="支付渠道配置" width="600px" destroy-on-close>
      <el-form v-if="activeConfig" :model="activeConfig" label-width="120px">
        <el-form-item label="支付渠道">
          <el-input v-model="providerNames[activeConfig.provider]" disabled />
        </el-form-item>
        
        <el-form-item label="应用ID">
          <el-input v-model="activeConfig.appId" placeholder="请输入应用ID" />
        </el-form-item>
        
        <el-form-item label="应用密钥">
          <el-input v-model="activeConfig.appSecret" type="password" placeholder="请输入应用密钥" show-password />
        </el-form-item>
        
        <el-form-item label="商户号">
          <el-input v-model="activeConfig.merchantId" placeholder="请输入商户号" />
        </el-form-item>
        
        <el-form-item label="私钥">
          <el-input v-model="activeConfig.privateKey" type="textarea" :rows="4" placeholder="请输入私钥" />
        </el-form-item>
        
        <el-form-item label="公钥">
          <el-input v-model="activeConfig.publicKey" type="textarea" :rows="4" placeholder="请输入公钥" />
        </el-form-item>
        
        <el-form-item label="回调地址">
          <el-input v-model="activeConfig.callbackUrl" placeholder="支付回调地址" />
        </el-form-item>
        
        <el-form-item label="返回地址">
          <el-input v-model="activeConfig.returnUrl" placeholder="支付完成返回地址" />
        </el-form-item>
        
        <el-form-item label="启用状态">
          <el-switch v-model="activeConfig.enabled" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveConfig">
          <el-icon v-if="!loading"><Check /></el-icon>
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.payment-config-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px 0;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.config-intro {
  text-align: center;
  margin: 40px 0;
}

.config-intro h2 {
  font-size: 24px;
  color: #303133;
  margin: 0 0 12px;
}

.config-intro p {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-card {
  border-radius: 12px;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.provider-icon {
  font-size: 24px;
}

.provider-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.config-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin: 16px 0;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item .label {
  font-size: 12px;
  color: #909399;
}

.detail-item .value {
  font-size: 14px;
  color: #303133;
}

.config-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
