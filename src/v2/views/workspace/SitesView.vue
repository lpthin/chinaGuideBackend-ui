<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { siteApi } from '../../api'
import { useAuthStore } from '@/stores/auth'
import { useSiteStore } from '@/stores/site'
import type { Site } from '../../types'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const modalVisible = ref(false)
const editingId = ref<number | null>(null)

interface SelectOption {
  value: string
  label: string
}

interface CascaderOption extends SelectOption {
  children?: SelectOption[]
}

const industryOptions: CascaderOption[] = [
  { value: '入境旅游', label: '入境旅游', children: [
    { value: '中国自由行', label: '中国自由行' },
    { value: '支付指南', label: '支付指南' },
    { value: '交通指南', label: '交通指南' },
    { value: '住宿与酒店', label: '住宿与酒店' },
    { value: '签证与入境', label: '签证与入境' }
  ] },
  { value: 'SaaS', label: 'SaaS', children: [
    { value: 'AI工具', label: 'AI工具' },
    { value: '营销自动化', label: '营销自动化' },
    { value: '客户管理', label: '客户管理' },
    { value: '数据分析', label: '数据分析' }
  ] },
  { value: '跨境电商', label: '跨境电商', children: [
    { value: '独立站', label: '独立站' },
    { value: '亚马逊', label: '亚马逊' },
    { value: 'TikTok Shop', label: 'TikTok Shop' },
    { value: '物流与支付', label: '物流与支付' }
  ] },
  { value: '本地生活', label: '本地生活', children: [
    { value: '餐饮', label: '餐饮' },
    { value: '酒旅', label: '酒旅' },
    { value: '到店服务', label: '到店服务' }
  ] }
]

const regionOptions = ['全球', '中国大陆', '香港', '澳门', '台湾', '美国', '加拿大', '英国', '德国', '法国', '西班牙', '日本', '韩国', '新加坡', '马来西亚', '泰国', '越南', '澳大利亚'].map((value) => ({ value, label: value }))
const audienceOptions = ['首次来华游客', '背包客', '商务旅客', '留学生', '外籍工作者', '家庭亲子游客', '高端定制游客', '数字游民', '采购商', '企业决策者'].map((value) => ({ value, label: value }))
const businessModelOptions = ['广告', 'Affiliate', '线索', '订阅', '会员', '电商', '咨询服务', 'SaaS授权', '品牌赞助'].map((value) => ({ value, label: value }))

const localeOptions: SelectOption[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ru', label: 'Русский' },
  { value: 'th', label: 'ไทย' },
  { value: 'vi', label: 'Tiếng Việt' }
]

interface SiteForm extends Omit<Site, 'enabledLocales' | 'competitorDomains' | 'seedKeywords' | 'excludedKeywords' | 'industry' | 'subIndustry' | 'targetRegions' | 'targetAudience' | 'businessModel' | 'searchLocales'> {
  industryPath: string[]
  targetRegionsList: string[]
  targetAudienceList: string[]
  businessModelList: string[]
  searchLocalesList: string[]
  enabledLocalesList: string[]
  competitorDomainsList: string[]
  seedKeywordsList: string[]
  excludedKeywordsList: string[]
}

const defaultForm = (): SiteForm => ({
  code: '',
  name: '',
  domain: '',
  description: '',
  brandName: '',
  industryPath: [],
  targetRegionsList: [],
  targetAudienceList: [],
  businessModelList: [],
  coreProducts: '',
  competitorDomainsList: [''],
  seedKeywordsList: [''],
  excludedKeywordsList: [''],
  searchLocalesList: ['en'],
  siteType: 'content_site',
  defaultLocale: 'zh-CN',
  enabledLocalesList: ['zh-CN'],
  frontendProjectPath: '',
  publishMode: 'static_html',
  themeCode: 'default',
  status: 'enabled'
})

const siteStore = useSiteStore()
const form = reactive<SiteForm>(defaultForm())
const sites = ref<Site[]>([])

function parseList(value?: string) {
  const items = (value || '')
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
  return items.length ? items : ['']
}

function joinList(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean).join(',')
}

function addListItem(items: string[]) {
  items.push('')
}

function removeListItem(items: string[], index: number) {
  if (items.length === 1) {
    items[0] = ''
    return
  }
  items.splice(index, 1)
}

function resetForm(site?: Site) {
  editingId.value = site?.id || null
  Object.assign(form, defaultForm(), site || {})
  form.industryPath = [site?.industry, site?.subIndustry].filter(Boolean) as string[]
  form.targetRegionsList = parseList(site?.targetRegions).filter(Boolean)
  form.targetAudienceList = parseList(site?.targetAudience).filter(Boolean)
  form.businessModelList = parseList(site?.businessModel).filter(Boolean)
  form.searchLocalesList = parseList(site?.searchLocales).filter(Boolean)
  form.competitorDomainsList = parseList(site?.competitorDomains)
  form.seedKeywordsList = parseList(site?.seedKeywords)
  form.excludedKeywordsList = parseList(site?.excludedKeywords)
  form.enabledLocalesList = (site?.enabledLocales || site?.defaultLocale || 'zh-CN')
    .split(',')
    .map((locale) => locale.trim())
    .filter(Boolean)
}

async function load() {
  loading.value = true
  try {
    sites.value = await siteApi.list()
  } catch (e) {
    message.error('加载站点列表失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!form.code.trim() || !form.name.trim()) {
    message.warning('请填写站点编码和名称')
    return
  }
  try {
    const { enabledLocalesList, industryPath, targetRegionsList, targetAudienceList, businessModelList, searchLocalesList, competitorDomainsList, seedKeywordsList, excludedKeywordsList, ...rest } = form
    const payload: Site = {
      ...rest,
      industry: industryPath[0] || '',
      subIndustry: industryPath[1] || '',
      targetRegions: joinList(targetRegionsList),
      targetAudience: joinList(targetAudienceList),
      businessModel: joinList(businessModelList),
      searchLocales: joinList(searchLocalesList),
      enabledLocales: enabledLocalesList.join(','),
      competitorDomains: joinList(competitorDomainsList),
      seedKeywords: joinList(seedKeywordsList),
      excludedKeywords: joinList(excludedKeywordsList)
    }
    if (editingId.value) await siteApi.update(editingId.value, payload)
    else await siteApi.create(payload)
    message.success('保存成功')
        modalVisible.value = false
        await load()
        await siteStore.loadSites()
  } catch (e) {
    message.error('保存失败')
  }
}

onMounted(() => {
  // 非管理员无权限访问
  if (!auth.user?.isAdmin && !auth.isAdmin) {
    message.error('无权限访问站点管理')
    router.push('/v2/workspace/dashboard')
    return
  }
  load()
})
</script>

<template>
  <div class="sites-view">
    <div class="page-header">
      <div>
        <h3>站点管理</h3>
        <p>维护站点画像，供行业热词收集、关键词蒸馏和内容生成使用。</p>
      </div>
      <a-button type="primary" @click="resetForm(); modalVisible = true">
        <template #icon><PlusOutlined /></template>
        新建站点
      </a-button>
    </div>

    <a-table
      :data-source="sites"
      :loading="loading"
      :pagination="false"
      row-key="id"
      bordered
      :scroll="{ x: 1400 }"
    >
      <a-table-column title="ID" data-index="id" width="70" align="center">
        <template #default="{ text }">{{ text || '-' }}</template>
      </a-table-column>
      <a-table-column title="编码" data-index="code" width="150">
        <template #default="{ text }">{{ text || '-' }}</template>
      </a-table-column>
      <a-table-column title="名称" data-index="name" min-width="180">
        <template #default="{ text }">{{ text || '-' }}</template>
      </a-table-column>
      <a-table-column title="域名" data-index="domain" min-width="220" ellipsis show-overflow-tooltip>
        <template #default="{ text }">{{ text || '-' }}</template>
      </a-table-column>
      <a-table-column title="行业" data-index="industry" width="140" ellipsis>
        <template #default="{ text }">{{ text || '-' }}</template>
      </a-table-column>
      <a-table-column title="目标市场" data-index="targetRegions" width="160" ellipsis show-overflow-tooltip>
        <template #default="{ text }">{{ text || '-' }}</template>
      </a-table-column>
      <a-table-column title="种子词" data-index="seedKeywords" min-width="220" ellipsis show-overflow-tooltip>
        <template #default="{ text }">{{ text || '-' }}</template>
      </a-table-column>
      <a-table-column title="状态" width="100" align="center">
        <template #default="{ record }">
          <a-tag :color="record.status === 'enabled' || record.status === 'active' ? 'green' : 'default'">
            {{ record.status === 'enabled' || record.status === 'active' ? '启用' : record.status === 'disabled' ? '禁用' : record.status || '-' }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="操作" width="100" fixed="right" align="center">
        <template #default="{ record }">
          <a-button v-if="record.id" type="link" size="small" @click="resetForm(record); modalVisible.value = true">
            编辑
          </a-button>
          <span v-else>-</span>
        </template>
      </a-table-column>
    </a-table>

    <a-modal
      v-model:open="modalVisible"
      :title="editingId ? '编辑站点' : '新建站点'"
      @ok="save"
      @cancel="modalVisible = false"
      width="900px"
    >
      <a-form :model="form" label-colon :label-col="{ span: 5 }">
        <a-divider orientation="left">基础信息</a-divider>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="站点编码" required>
              <a-input v-model:value="form.code" placeholder="china-guide" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="站点名称" required>
              <a-input v-model:value="form.name" placeholder="China Survival Guide" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="品牌名">
              <a-input v-model:value="form.brandName" placeholder="对外品牌/产品名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="域名">
              <a-input v-model:value="form.domain" placeholder="https://www.example.com" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="站点描述">
              <a-textarea v-model:value="form.description" :auto-size="{ minRows: 2, maxRows: 4 }" placeholder="一句话说明站点定位和核心价值" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">行业与热词画像</a-divider>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="行业分类">
              <a-cascader v-model:value="form.industryPath" :options="industryOptions" :show-search="true" allow-clear style="width:100%" placeholder="选择主行业 / 细分行业" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="目标市场">
              <a-select v-model:value="form.targetRegionsList" mode="multiple" :show-search="true" allow-create default-first-option style="width:100%" placeholder="多选，可输入自定义市场">
                <a-select-option v-for="item in regionOptions" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="目标用户">
              <a-select v-model:value="form.targetAudienceList" mode="multiple" :show-search="true" allow-create default-first-option style="width:100%" placeholder="多选，可输入自定义用户">
                <a-select-option v-for="item in audienceOptions" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="商业模式">
              <a-select v-model:value="form.businessModelList" mode="multiple" :show-search="true" allow-create default-first-option style="width:100%" placeholder="多选，可输入自定义模式">
                <a-select-option v-for="item in businessModelOptions" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="搜索语言">
              <a-select v-model:value="form.searchLocalesList" mode="multiple" :show-search="true" allow-create default-first-option style="width:100%" placeholder="多选，如 en/ja/ko">
                <a-select-option v-for="loc in localeOptions" :key="loc.value" :value="loc.value">{{ loc.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="核心产品/栏目">
              <a-textarea v-model:value="form.coreProducts" :auto-size="{ minRows: 2, maxRows: 4 }" placeholder="后续用于判断该收集哪些行业主题" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="竞品域名">
              <div class="list-editor">
                <div v-for="(_, index) in form.competitorDomainsList" :key="`competitor-${index}`" class="list-editor-row">
                  <a-input v-model:value="form.competitorDomainsList[index]" placeholder="如 travelchinaguide.com" style="flex:1" />
                  <a-button type="primary" ghost @click="addListItem(form.competitorDomainsList)">添加</a-button>
                  <a-button @click="removeListItem(form.competitorDomainsList, index)">删除</a-button>
                </div>
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="种子关键词">
              <div class="list-editor">
                <div v-for="(_, index) in form.seedKeywordsList" :key="`seed-${index}`" class="list-editor-row">
                  <a-input v-model:value="form.seedKeywordsList[index]" placeholder="用于启动行业热词收集" style="flex:1" />
                  <a-button type="primary" ghost @click="addListItem(form.seedKeywordsList)">添加</a-button>
                  <a-button @click="removeListItem(form.seedKeywordsList, index)">删除</a-button>
                </div>
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="排除关键词">
              <div class="list-editor">
                <div v-for="(_, index) in form.excludedKeywordsList" :key="`excluded-${index}`" class="list-editor-row">
                  <a-input v-model:value="form.excludedKeywordsList[index]" placeholder="不希望采集/生成的词，如无关品牌、成人、灰产词" style="flex:1" />
                  <a-button type="primary" ghost @click="addListItem(form.excludedKeywordsList)">添加</a-button>
                  <a-button @click="removeListItem(form.excludedKeywordsList, index)">删除</a-button>
                </div>
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">发布配置</a-divider>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="默认语言">
              <a-select v-model:value="form.defaultLocale" style="width:100%">
                <a-select-option v-for="loc in localeOptions" :key="loc.value" :value="loc.value">{{ loc.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="启用语言">
              <a-select v-model:value="form.enabledLocalesList" mode="multiple" style="width:100%">
                <a-select-option v-for="loc in localeOptions" :key="loc.value" :value="loc.value">{{ loc.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="前端项目路径">
              <a-input v-model:value="form.frontendProjectPath" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="发布模式">
              <a-select v-model:value="form.publishMode" style="width:100%">
                <a-select-option value="static_html">静态 HTML</a-select-option>
                <a-select-option value="dynamic">动态</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="form.status" style="width:100%">
                <a-select-option value="enabled">启用</a-select-option>
                <a-select-option value="disabled">禁用</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.sites-view {
  padding: 24px;
}
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}
.page-header h3 {
  margin: 0 0 8px;
}
.page-header p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}
.list-editor {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.list-editor-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
