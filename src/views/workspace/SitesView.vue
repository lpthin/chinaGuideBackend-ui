<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { siteApi, tenantApi } from '../../api'
import { PROFILE_QUESTION_KEYS, findProfileQuestion, vocabularyApi } from '@/api/siteBriefs'
import type { BriefVocabularyQuestion, SiteBriefVocabulary } from '@/api/siteBriefs'
import { useAuthStore } from '../../stores/auth'
import { useSiteStore } from '@/stores/site'
import type { Site } from '../../types'
import type { Tenant } from '../../types/workspace'

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

/**
 * 行业/市场/用户/商业模式这四份下拉的词表唯一真相在后端（Spec §5 回写补充第 1 条）：
 * 这里只按题目 key 找题、把 code→label 透传给控件，取不到就明说「词表没取到」，
 * 绝不退回任何写死的清单（I-1）。
 */
const profileVocabulary = ref<SiteBriefVocabulary | null>(null)
const profileFailed = ref(false)
const profileLoading = ref(true)

async function loadProfileVocabulary() {
  profileFailed.value = false
  try {
    profileVocabulary.value = await vocabularyApi.portalVocabulary()
  } catch (error) {
    profileVocabulary.value = null
    profileFailed.value = true
  } finally {
    profileLoading.value = false
  }
}

function profileOptions(key: string): SelectOption[] {
  const question = findProfileQuestion(profileVocabulary.value, key)
  return (question?.options ?? []).map(option => ({ value: option.code, label: option.label }))
}

function profileQuestion(key: string): BriefVocabularyQuestion | null {
  return findProfileQuestion(profileVocabulary.value, key)
}

/** 词表没取到 / 词表里没这一题：下拉里说的都是这句真话，不给空列表装样子 */
function profileHint(key: string): string {
  if (profileLoading.value) return '词表加载中…'
  if (profileFailed.value) return '词表没取到，刷新重试'
  if (!profileQuestion(key)) return '词表里没这道题，刷新重试'
  return '没有可选项'
}

const industryOptions = computed<CascaderOption[]>(() => {
  const question = profileQuestion(PROFILE_QUESTION_KEYS.industry)
  return (question?.options ?? []).map(option => ({
    value: option.code,
    label: option.label,
    children: (option.children ?? []).map(child => ({ value: child.code, label: child.label }))
  }))
})

const regionOptions = computed(() => profileOptions(PROFILE_QUESTION_KEYS.targetRegions))
const audienceOptions = computed(() => profileOptions(PROFILE_QUESTION_KEYS.targetAudience))
const businessModelOptions = computed(() => profileOptions(PROFILE_QUESTION_KEYS.businessModel))

// 语言清单同样只认后端那一份词表（见 PROFILE_QUESTION_KEYS.languages 上的注释）：
// 以前这里和 CompanyInfoView 各抄了一份逐字相同的十语清单，第三处抄本就是第三个真相。
const localeOptions = computed<SelectOption[]>(() => profileOptions(PROFILE_QUESTION_KEYS.languages))

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
  status: 'enabled'
})

const siteStore = useSiteStore()
const form = reactive<SiteForm>(defaultForm())
const sites = ref<Site[]>([])

/**
 * 租户名只用来把「这一站归谁」说清楚（Spec-C §3.2 P0：建站域与内容域分开后，
 * 超管第一件要看的就是站点归属）。取不到就把原话的 tenantId 报出来，不编名字。
 */
const tenantNames = ref<Record<number, string>>({})
const tenantsFailed = ref(false)

async function loadTenantNames() {
  try {
    const list = await tenantApi.list()
    const map: Record<number, string> = {}
    ;(list || []).forEach((tenant: Tenant) => {
      if (tenant?.id != null) map[tenant.id] = tenant.name || tenant.code || `#${tenant.id}`
    })
    tenantNames.value = map
    tenantsFailed.value = false
  } catch (e) {
    tenantsFailed.value = true
  }
}

function tenantLabel(site: Site) {
  if (!site.tenantId) return '未绑定租户'
  return tenantNames.value[site.tenantId] || `租户 #${site.tenantId}`
}

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
    const res = await siteApi.list()
    sites.value = res || []
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
    // tenantId 一律不入 payload：改归属是后端的开通/移交动作，这张表单没有这个权利
    const { enabledLocalesList, industryPath, targetRegionsList, targetAudienceList, businessModelList, searchLocalesList, competitorDomainsList, seedKeywordsList, excludedKeywordsList, tenantId, ...rest } = form
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
  if (!auth.isSuperAdmin) {
    message.error('无权限访问站点管理')
    router.push('/workspace/dashboard')
    return
  }
  load()
  loadTenantNames()
  loadProfileVocabulary()
})
</script>

<template>
  <div class="sites-view">
    <div class="page-header">
      <div>
        <h3>站点管理</h3>
        <p>维护站点画像与归属：域名、租户、启用状态都在这里改；行业画像供热词收集、关键词蒸馏和内容生成使用。</p>
      </div>
      <a-button type="primary" @click="resetForm(); modalVisible = true">
        <template #icon><PlusOutlined /></template>
        新建站点
      </a-button>
    </div>

    <a-alert v-if="profileFailed" type="warning" show-icon style="margin-bottom: 16px">
      <template #message>
        站点画像词表没取到，刷新重试：行业 / 目标市场 / 目标用户 / 商业模式的下拉暂时是空的，不是没有可选项。
        <a-button size="small" type="link" @click="loadProfileVocabulary">重新取词表</a-button>
      </template>
    </a-alert>

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
      <a-table-column title="归属租户" width="160" ellipsis show-overflow-tooltip>
        <template #default="{ record }">{{ tenantLabel(record) }}</template>
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
          <a-button v-if="record.id" type="link" size="small" @click="resetForm(record); modalVisible = true">
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
            <a-form-item label="域名" extra="访客从哪个域名进来就打开这个站点，填主机名即可（带不带 https:// 都认），暂不支持带路径">
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
              <a-cascader v-model:value="form.industryPath" :options="industryOptions" :show-search="true" allow-clear :not-found-content="profileHint(PROFILE_QUESTION_KEYS.industry)" style="width:100%" placeholder="选择主行业 / 细分行业" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="目标市场">
              <a-select v-model:value="form.targetRegionsList" mode="multiple" :show-search="true" allow-create default-first-option :not-found-content="profileHint(PROFILE_QUESTION_KEYS.targetRegions)" style="width:100%" placeholder="多选，可输入自定义市场">
                <a-select-option v-for="item in regionOptions" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="目标用户">
              <a-select v-model:value="form.targetAudienceList" mode="multiple" :show-search="true" allow-create default-first-option :not-found-content="profileHint(PROFILE_QUESTION_KEYS.targetAudience)" style="width:100%" placeholder="多选，可输入自定义用户">
                <a-select-option v-for="item in audienceOptions" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="商业模式">
              <a-select v-model:value="form.businessModelList" mode="multiple" :show-search="true" allow-create default-first-option :not-found-content="profileHint(PROFILE_QUESTION_KEYS.businessModel)" style="width:100%" placeholder="多选，可输入自定义模式">
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
