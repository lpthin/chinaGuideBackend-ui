<template>
  <div class="geoseo-company-page">
    <a-page-header
      title="企业信息"
      sub-title="维护企业基础信息、联系方式、社交媒体及核心能力，供 AI 搜索引擎更好地理解和引用您的业务。"
    />

    <div class="content-wrapper">
      <a-spin :spinning="loading">
        <a-tabs v-model:activeKey="activeTab" type="card">
          <!-- Tab 1: 公司基本信息 -->
          <a-tab-pane key="basic" tab="公司基本信息">
            <a-form layout="vertical" :model="form" class="tab-form">
              <a-form-item label="公司名称" required>
                <a-input v-model:value="form.companyName" placeholder="请输入公司名称" />
              </a-form-item>
              <a-form-item label="公司描述">
                <a-textarea
                  v-model:value="form.introduction"
                  :rows="4"
                  placeholder="请输入公司描述"
                />
              </a-form-item>
              <a-form-item label="Logo URL">
                <a-input v-model:value="form.logoUrl" placeholder="请输入 Logo 图片 URL" />
              </a-form-item>
              <a-form-item label="网站图标">
                <a-input v-model:value="form.faviconUrl" placeholder="请输入网站 favicon 图标 URL" />
                <div class="form-helper">网站favicon图标URL，建议32x32像素的.ico或.png格式</div>
              </a-form-item>
              <a-form-item label="官方网站">
                <a-input v-model:value="form.website" placeholder="请输入官方网站 URL" />
              </a-form-item>
              <div class="form-actions">
                <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
              </div>
            </a-form>
          </a-tab-pane>

          <!-- Tab 2: 联系方式 -->
          <a-tab-pane key="contact" tab="联系方式">
            <a-form layout="vertical" :model="form" class="tab-form">
              <a-form-item label="联系电话">
                <a-input v-model:value="form.phone" placeholder="请输入联系电话" />
              </a-form-item>
              <a-form-item label="服务热线">
                <a-input v-model:value="form.serviceHotline" placeholder="请输入服务热线" />
                <div class="form-helper">如 400-xxx-xxxx</div>
              </a-form-item>
              <a-form-item label="联系邮箱">
                <a-input v-model:value="form.email" placeholder="请输入联系邮箱" />
              </a-form-item>
              <a-form-item label="公司地址">
                <a-textarea
                  v-model:value="form.address"
                  :rows="2"
                  placeholder="请输入公司地址"
                />
              </a-form-item>
              <div class="form-actions">
                <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
              </div>
            </a-form>
          </a-tab-pane>

          <!-- Tab 3: 社交媒体 -->
          <a-tab-pane key="social" tab="社交媒体">
            <a-form layout="vertical" :model="form" class="tab-form">
              <a-form-item label="微信">
                <a-input v-model:value="form.wechat" placeholder="微信号或公众号" />
              </a-form-item>
              <a-form-item label="微博">
                <a-input v-model:value="form.weibo" placeholder="微博主页URL" />
              </a-form-item>
              <a-form-item label="抖音">
                <a-input v-model:value="form.douyin" placeholder="抖音号或主页URL" />
              </a-form-item>
              <a-form-item label="LinkedIn">
                <a-input v-model:value="form.linkedin" placeholder="LinkedIn公司主页URL" />
              </a-form-item>
              <a-form-item label="GitHub">
                <a-input v-model:value="form.github" placeholder="GitHub组织URL" />
              </a-form-item>
              <div class="form-actions">
                <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
              </div>
            </a-form>
          </a-tab-pane>

          <!-- Tab 4: 特色项目与核心产品 -->
          <a-tab-pane key="products" tab="特色项目与核心产品">
            <a-form layout="vertical" :model="form" class="tab-form">
              <a-alert
                type="info"
                show-icon
                message="这些信息会被 AI 搜索引擎用于理解您的业务范围和核心能力。请在 coreProducts 和 featureProjects 中每行填写一个项目。"
                class="tab-alert"
              />
              <a-form-item label="核心产品">
                <a-textarea
                  v-model:value="form.coreProducts"
                  :rows="4"
                  placeholder="每行一个核心产品描述"
                />
              </a-form-item>
              <a-form-item label="特色项目">
                <a-textarea
                  v-model:value="form.featureProjects"
                  :rows="6"
                  placeholder="每行一个特色项目名称"
                />
              </a-form-item>
              <div class="form-actions">
                <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
              </div>
            </a-form>
          </a-tab-pane>
        </a-tabs>
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { companyInfoApi } from '@/v2/api/portal'
import type { CompanyInfo, CompanyInfoForm } from '@/v2/types/portal'

const loading = ref(false)
const saving = ref(false)
const activeTab = ref('basic')

const defaultForm = (): CompanyInfoForm => ({
  companyName: '',
  introduction: '',
  logoUrl: '',
  faviconUrl: '',
  website: '',
  phone: '',
  serviceHotline: '',
  email: '',
  address: '',
  wechat: '',
  weibo: '',
  douyin: '',
  linkedin: '',
  github: '',
  coreProducts: '',
  featureProjects: ''
})

const form = reactive<CompanyInfoForm>(defaultForm())

function fillFormFromData(data: CompanyInfo) {
  Object.assign(form, defaultForm(), {
    companyName: data.companyName ?? '',
    introduction: data.introduction ?? '',
    logoUrl: data.logoUrl ?? '',
    faviconUrl: data.faviconUrl ?? '',
    website: data.website ?? '',
    phone: data.phone ?? '',
    serviceHotline: data.serviceHotline ?? '',
    email: data.email ?? '',
    address: data.address ?? '',
    wechat: data.wechat ?? '',
    weibo: data.weibo ?? '',
    douyin: data.douyin ?? '',
    linkedin: data.linkedin ?? '',
    github: data.github ?? '',
    coreProducts: data.coreProducts ?? '',
    featureProjects: data.featureProjects ?? ''
  })
}

async function loadCompanyInfo() {
  loading.value = true
  try {
    const data = await companyInfoApi.get()
    if (data) {
      fillFormFromData(data)
    }
  } catch (error) {
    message.error('加载企业信息失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (activeTab.value === 'basic' && !form.companyName?.trim()) {
    message.warning('请填写公司名称')
    return
  }
  saving.value = true
  try {
    await companyInfoApi.update(form)
    message.success('保存成功')
    await loadCompanyInfo()
  } catch (error) {
    message.error('保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadCompanyInfo()
})
</script>

<style scoped lang="less">
.geoseo-company-page {
  width: 100%;
  padding: 0;
}

.content-wrapper {
  padding: 24px;
}

.tab-form {
  max-width: 720px;
  padding-top: 8px;
}

.tab-alert {
  margin-bottom: 16px;
}

.form-helper {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
  line-height: 1.5;
}

.form-actions {
  margin-top: 16px;
}
</style>
