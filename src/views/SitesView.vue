<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createSiteApi, listSitesApi, updateSiteApi } from '@/api/sites'
import { useSiteStore } from '@/stores/site'
import type { Site } from '@/types/api'

const siteStore = useSiteStore()
const loading = ref(false)
const dialogVisible = ref(false)
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

const form = reactive<SiteForm>(defaultForm())

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
    siteStore.sites = await listSitesApi()
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!form.code.trim() || !form.name.trim()) {
    ElMessage.warning('请填写站点编码和名称')
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
    if (editingId.value) await updateSiteApi(editingId.value, payload)
    else await createSiteApi(payload)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h2>站点管理</h2>
        <p>维护站点画像，供行业热词收集、关键词蒸馏和内容生成使用。</p>
      </div>
      <el-button type="primary" @click="resetForm(); dialogVisible = true">新建站点</el-button>
    </div>

    <el-table v-loading="loading" :data="siteStore.sites" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="code" label="编码" width="150" />
      <el-table-column prop="name" label="名称" min-width="180" />
      <el-table-column prop="domain" label="域名" min-width="220" show-overflow-tooltip />
      <el-table-column prop="industry" label="行业" width="140" show-overflow-tooltip />
      <el-table-column prop="targetRegions" label="目标市场" width="160" show-overflow-tooltip />
      <el-table-column prop="seedKeywords" label="种子词" min-width="220" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'enabled' || row.status === 'active'" type="success">启用</el-tag>
          <el-tag v-else-if="row.status === 'disabled'" type="info">禁用</el-tag>
          <el-tag v-else>{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="resetForm(row); dialogVisible = true">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑站点' : '新建站点'" width="860px">
      <el-form :model="form" label-width="130px">
        <el-divider content-position="left">基础信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="站点编码" required><el-input v-model="form.code" placeholder="china-guide" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="站点名称" required><el-input v-model="form.name" placeholder="China Survival Guide" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="品牌名"><el-input v-model="form.brandName" placeholder="对外品牌/产品名" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="域名"><el-input v-model="form.domain" placeholder="https://www.example.com" /></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="站点描述"><el-input v-model="form.description" type="textarea" :rows="2" placeholder="一句话说明站点定位和核心价值" /></el-form-item></el-col>
        </el-row>

        <el-divider content-position="left">行业与热词画像</el-divider>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="行业分类"><el-cascader v-model="form.industryPath" :options="industryOptions" filterable clearable style="width:100%" placeholder="选择主行业 / 细分行业" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="目标市场"><el-select v-model="form.targetRegionsList" multiple filterable allow-create default-first-option style="width:100%" placeholder="多选，可输入自定义市场"><el-option v-for="item in regionOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="目标用户"><el-select v-model="form.targetAudienceList" multiple filterable allow-create default-first-option style="width:100%" placeholder="多选，可输入自定义用户"><el-option v-for="item in audienceOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="商业模式"><el-select v-model="form.businessModelList" multiple filterable allow-create default-first-option style="width:100%" placeholder="多选，可输入自定义模式"><el-option v-for="item in businessModelOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="搜索语言"><el-select v-model="form.searchLocalesList" multiple filterable allow-create default-first-option style="width:100%" placeholder="多选，如 en/ja/ko"><el-option v-for="loc in localeOptions" :key="loc.value" :label="loc.label" :value="loc.value" /></el-select></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="核心产品/栏目"><el-input v-model="form.coreProducts" type="textarea" :rows="2" placeholder="后续用于判断该收集哪些行业主题" /></el-form-item></el-col>
          <el-col :span="24">
            <el-form-item label="竞品域名">
              <div class="list-editor">
                <div v-for="(_, index) in form.competitorDomainsList" :key="`competitor-${index}`" class="list-editor-row">
                  <el-input v-model="form.competitorDomainsList[index]" placeholder="如 travelchinaguide.com" />
                  <el-button type="primary" plain @click="addListItem(form.competitorDomainsList)">添加</el-button>
                  <el-button @click="removeListItem(form.competitorDomainsList, index)">删除</el-button>
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="种子关键词">
              <div class="list-editor">
                <div v-for="(_, index) in form.seedKeywordsList" :key="`seed-${index}`" class="list-editor-row">
                  <el-input v-model="form.seedKeywordsList[index]" placeholder="用于启动行业热词收集" />
                  <el-button type="primary" plain @click="addListItem(form.seedKeywordsList)">添加</el-button>
                  <el-button @click="removeListItem(form.seedKeywordsList, index)">删除</el-button>
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="排除关键词">
              <div class="list-editor">
                <div v-for="(_, index) in form.excludedKeywordsList" :key="`excluded-${index}`" class="list-editor-row">
                  <el-input v-model="form.excludedKeywordsList[index]" placeholder="不希望采集/生成的词，如无关品牌、成人、灰产词" />
                  <el-button type="primary" plain @click="addListItem(form.excludedKeywordsList)">添加</el-button>
                  <el-button @click="removeListItem(form.excludedKeywordsList, index)">删除</el-button>
                </div>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">发布配置</el-divider>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="默认语言"><el-select v-model="form.defaultLocale" style="width:100%"><el-option v-for="loc in localeOptions" :key="loc.value" :label="loc.label" :value="loc.value" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="启用语言"><el-select v-model="form.enabledLocalesList" multiple style="width:100%"><el-option v-for="loc in localeOptions" :key="loc.value" :label="loc.label" :value="loc.value" /></el-select></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="前端项目路径"><el-input v-model="form.frontendProjectPath" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="发布模式"><el-select v-model="form.publishMode" style="width:100%"><el-option label="静态 HTML" value="static_html" /><el-option label="动态" value="dynamic" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option label="启用" value="enabled" /><el-option label="禁用" value="disabled" /></el-select></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px}
.page-header h2{margin:0 0 6px}
.page-header p{margin:0;color:#6b7280;font-size:13px}
.list-editor{width:100%;display:flex;flex-direction:column;gap:8px}
.list-editor-row{display:flex;gap:8px;align-items:center}
.list-editor-row .el-input{flex:1}
</style>
