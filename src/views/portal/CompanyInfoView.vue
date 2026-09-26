<template>
  <div class="company-info-page">
    <a-page-header title="企业信息" sub-title="维护企业基础信息和画像，供行业热词收集、关键词蒸馏和内容生成使用。">
      <template #extra>
        <a-space>
          <a-button @click="handleReset">重置</a-button>
          <a-button type="primary" :loading="saving" @click="handleSave">保存修改</a-button>
        </a-space>
      </template>
    </a-page-header>

    <div class="content-wrapper">
      <a-spin :spinning="loading">

      <a-row :gutter="24">
        <a-col :span="16">
          <a-card title="基础信息" :bordered="false" class="info-card">
            <a-form layout="vertical" :model="form">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="公司名称" required>
                    <a-input v-model:value="form.companyName" placeholder="请输入公司名称" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="英文名称">
                    <a-input v-model:value="form.englishName" placeholder="请输入英文名称" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="公司简称">
                    <a-input v-model:value="form.shortName" placeholder="请输入公司简称" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="成立日期">
                    <a-date-picker
                      v-model:value="foundedDateVal"
                      style="width: 100%"
                      placeholder="选择成立日期"
                      value-format="YYYY-MM-DD"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="统一社会信用代码">
                    <a-input v-model:value="form.creditCode" placeholder="请输入统一社会信用代码" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="法人代表">
                    <a-input v-model:value="form.legalRepresentative" placeholder="请输入法人代表姓名" />
                  </a-form-item>
                </a-col>
                <a-col :span="24">
                  <a-form-item label="公司地址">
                    <a-input
                      v-model:value="form.address"
                      placeholder="请输入详细地址"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="所在省份">
                    <a-select v-model:value="form.provinceName" style="width: 100%" placeholder="选择省份" allow-clear>
                      <a-select-option value="北京市">北京市</a-select-option>
                      <a-select-option value="上海市">上海市</a-select-option>
                      <a-select-option value="广东省">广东省</a-select-option>
                      <a-select-option value="浙江省">浙江省</a-select-option>
                      <a-select-option value="江苏省">江苏省</a-select-option>
                      <a-select-option value="四川省">四川省</a-select-option>
                      <a-select-option value="湖北省">湖北省</a-select-option>
                      <a-select-option value="山东省">山东省</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="所在城市">
                    <a-select v-model:value="form.cityName" style="width: 100%" placeholder="选择城市" allow-clear>
                      <a-select-option value="北京市">北京市</a-select-option>
                      <a-select-option value="上海市">上海市</a-select-option>
                      <a-select-option value="广州市">广州市</a-select-option>
                      <a-select-option value="深圳市">深圳市</a-select-option>
                      <a-select-option value="杭州市">杭州市</a-select-option>
                      <a-select-option value="南京市">南京市</a-select-option>
                      <a-select-option value="成都市">成都市</a-select-option>
                      <a-select-option value="武汉市">武汉市</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="邮政编码">
                    <a-input v-model:value="form.postalCode" placeholder="请输入邮政编码" />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
          </a-card>

          <a-card title="联系方式" :bordered="false" class="info-card">
            <a-form layout="vertical" :model="form">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="联系电话">
                    <a-input v-model:value="form.phone" placeholder="请输入联系电话" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="传真号码">
                    <a-input v-model:value="form.fax" placeholder="请输入传真号码" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="电子邮箱">
                    <a-input v-model:value="form.email" placeholder="请输入电子邮箱" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="官方网站">
                    <a-input v-model:value="form.website" placeholder="请输入官方网站" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="客服热线">
                    <a-input v-model:value="form.serviceHotline" placeholder="请输入客服热线" />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
          </a-card>

          <a-card title="公司简介" :bordered="false" class="info-card">
            <a-form layout="vertical" :model="form">
              <a-form-item label="公司简介">
                <a-textarea
                  v-model:value="form.introduction"
                  :rows="5"
                  placeholder="请输入公司简介"
                  :maxlength="2000"
                  show-count
                />
              </a-form-item>
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="主营业务">
                    <a-textarea
                      v-model:value="form.business"
                      :rows="3"
                      placeholder="请输入主营业务"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="企业文化">
                    <a-textarea
                      v-model:value="form.culture"
                      :rows="3"
                      placeholder="请输入企业文化"
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
          </a-card>

          <a-card title="行业与画像" :bordered="false" class="info-card">
            <a-alert v-if="profileFailed" type="warning" show-icon style="margin-bottom: 16px">
              <template #message>
                画像词表没取到，刷新重试：行业 / 目标市场 / 目标用户 / 商业模式的下拉暂时是空的，不是没有可选项。
                <a-button size="small" type="link" @click="loadProfileVocabulary">重新取词表</a-button>
              </template>
            </a-alert>
            <a-form layout="vertical" :model="form">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="行业分类">
                    <a-cascader
                      v-model:value="industryPath"
                      :options="industryOptions"
                      :not-found-content="profileHint(PROFILE_QUESTION_KEYS.industry)"
                      filterable
                      clearable
                      style="width:100%"
                      placeholder="选择主行业 / 细分行业"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="目标市场">
                    <a-select
                      v-model:value="targetRegionsList"
                      mode="multiple"
                      :options="regionOptions"
                      :not-found-content="profileHint(PROFILE_QUESTION_KEYS.targetRegions)"
                      filterable
                      allow-clear
                      style="width:100%"
                      placeholder="多选，可输入自定义市场"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="目标用户">
                    <a-select
                      v-model:value="targetAudienceList"
                      mode="multiple"
                      :options="audienceOptions"
                      :not-found-content="profileHint(PROFILE_QUESTION_KEYS.targetAudience)"
                      filterable
                      allow-clear
                      style="width:100%"
                      placeholder="多选，可输入自定义用户"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="商业模式">
                    <a-select
                      v-model:value="businessModelList"
                      mode="multiple"
                      :options="businessModelOptions"
                      :not-found-content="profileHint(PROFILE_QUESTION_KEYS.businessModel)"
                      filterable
                      allow-clear
                      style="width:100%"
                      placeholder="多选，可输入自定义模式"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="搜索语言">
                    <a-select
                      v-model:value="searchLocalesList"
                      mode="multiple"
                      :options="localeOptions"
                      filterable
                      allow-clear
                      style="width:100%"
                      placeholder="多选，如 en/ja/ko"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="24">
                  <a-form-item label="核心产品/栏目">
                    <a-textarea
                      v-model:value="form.coreProducts"
                      :rows="2"
                      placeholder="后续用于判断该收集哪些行业主题"
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
          </a-card>

          <a-card title="竞品与关键词" :bordered="false" class="info-card">
            <a-form layout="vertical" :model="form">
              <a-form-item label="竞品域名">
                <div class="list-editor">
                  <div
                    v-for="(_, index) in competitorDomainsList"
                    :key="`competitor-${index}`"
                    class="list-editor-row"
                  >
                    <a-input
                      v-model:value="competitorDomainsList[index]"
                      placeholder="如 travelchinaguide.com"
                    />
                    <a-button type="primary" variant="link" @click="addListItem(competitorDomainsList)">
                      添加
                    </a-button>
                    <a-button variant="link" danger @click="removeListItem(competitorDomainsList, index)">
                      删除
                    </a-button>
                  </div>
                </div>
              </a-form-item>
              <a-form-item label="种子关键词">
                <div class="list-editor">
                  <div
                    v-for="(_, index) in seedKeywordsList"
                    :key="`seed-${index}`"
                    class="list-editor-row"
                  >
                    <a-input
                      v-model:value="seedKeywordsList[index]"
                      placeholder="用于启动行业热词收集"
                    />
                    <a-button type="primary" variant="link" @click="addListItem(seedKeywordsList)">
                      添加
                    </a-button>
                    <a-button variant="link" danger @click="removeListItem(seedKeywordsList, index)">
                      删除
                    </a-button>
                  </div>
                </div>
              </a-form-item>
              <a-form-item label="排除关键词">
                <div class="list-editor">
                  <div
                    v-for="(_, index) in excludedKeywordsList"
                    :key="`excluded-${index}`"
                    class="list-editor-row"
                  >
                    <a-input
                      v-model:value="excludedKeywordsList[index]"
                      placeholder="不希望采集/生成的词，如无关品牌、成人、灰产词"
                    />
                    <a-button type="primary" variant="link" @click="addListItem(excludedKeywordsList)">
                      添加
                    </a-button>
                    <a-button variant="link" danger @click="removeListItem(excludedKeywordsList, index)">
                      删除
                    </a-button>
                  </div>
                </div>
              </a-form-item>
            </a-form>
          </a-card>
        </a-col>

        <a-col :span="8">
          <a-card title="品牌标识" :bordered="false" class="info-card">
            <div class="logo-upload-section">
              <div class="upload-item">
                <div class="upload-label">公司Logo</div>
                <a-upload
                  list-type="picture-card"
                  :file-list="logoFileList"
                  :before-upload="beforeUpload"
                  :max-count="1"
                  @change="handleLogoChange"
                >
                  <div>
                    <PlusOutlined />
                    <div style="margin-top: 8px">上传Logo</div>
                  </div>
                </a-upload>
                <div class="upload-tip">建议尺寸：200x200像素</div>
              </div>

              <div class="upload-item" style="margin-top: 24px">
                <div class="upload-label">网站图标（Favicon）</div>
                <a-upload
                  list-type="picture-card"
                  :file-list="faviconFileList"
                  :before-upload="beforeFaviconUpload"
                  :max-count="1"
                  @change="handleFaviconChange"
                >
                  <div>
                    <PlusOutlined />
                    <div style="margin-top: 8px">上传图标</div>
                  </div>
                </a-upload>
                <div class="upload-tip">建议尺寸：64x64像素</div>
              </div>
            </div>
          </a-card>

          <a-card title="社交媒体" :bordered="false" class="info-card">
            <a-form layout="vertical" :model="form">
              <a-form-item label="微信公众号">
                <a-input v-model:value="form.wechat" placeholder="请输入微信公众号名称">
                  <template #prefix>
                    <WechatOutlined />
                  </template>
                </a-input>
              </a-form-item>
              <a-form-item label="微博">
                <a-input v-model:value="form.weibo" placeholder="请输入微博账号">
                  <template #prefix>
                    <WeiboCircleOutlined />
                  </template>
                </a-input>
              </a-form-item>
              <a-form-item label="抖音">
                <a-input v-model:value="form.douyin" placeholder="请输入抖音账号">
                  <template #prefix>
                    <PlayCircleOutlined />
                  </template>
                </a-input>
              </a-form-item>
              <a-form-item label="LinkedIn">
                <a-input v-model:value="form.linkedin" placeholder="请输入LinkedIn账号">
                  <template #prefix>
                    <LinkedinFilled />
                  </template>
                </a-input>
              </a-form-item>
              <a-form-item label="GitHub">
                <a-input v-model:value="form.github" placeholder="请输入GitHub账号">
                  <template #prefix>
                    <GithubFilled />
                  </template>
                </a-input>
              </a-form-item>
            </a-form>
          </a-card>

          <a-card title="公司资质" :bordered="false" class="info-card">
            <a-upload
              v-model:file-list="certificateFileList"
              :before-upload="beforeCertificateUpload"
              multiple
              list-type="picture-card"
            >
              <div>
                <PlusOutlined />
                <div style="margin-top: 8px">上传资质</div>
              </div>
            </a-upload>
            <div class="upload-tip">支持上传营业执照、资质证书、荣誉证书等</div>
          </a-card>
        </a-col>
      </a-row>
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  WechatOutlined,
  WeiboCircleOutlined,
  PlayCircleOutlined,
  LinkedinFilled,
  GithubFilled,
} from '@ant-design/icons-vue'
import { companyInfoApi } from '@/api/portal'
import { describeHttpError } from '@/api/http'
import { PROFILE_QUESTION_KEYS, findProfileQuestion, vocabularyApi } from '@/api/siteBriefs'
import type { BriefVocabularyQuestion, SiteBriefVocabulary } from '@/api/siteBriefs'
import type { CompanyInfo, CompanyInfoForm } from '@/types/portal'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const tenantId = computed(() => auth.selectedTenantId || auth.tenantId)
const loading = ref(false)
const saving = ref(false)

const logoFileList = ref<any[]>([])
const faviconFileList = ref<any[]>([])
const certificateFileList = ref<any[]>([])

/**
 * 行业/市场/用户/商业模式的下拉词表唯一真相在后端（Spec §5 回写补充第 1 条）：
 * 这里与站点管理读的是同一份 `GET /portal/vocabulary` 的 questions——以前这两页各抄一份
 * 中文清单（同一值两处可填的病），现在只按题目 key 取题、把 code→label 透传给控件。
 * 取不到词表时下拉里明说「词表没取到，刷新重试」，绝不退回写死的默认值（I-1）。
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

function profileQuestion(key: string): BriefVocabularyQuestion | null {
  return findProfileQuestion(profileVocabulary.value, key)
}

function profileOptions(key: string) {
  return (profileQuestion(key)?.options ?? []).map(option => ({ value: option.code, label: option.label }))
}

function profileHint(key: string): string {
  if (profileLoading.value) return '词表加载中…'
  if (profileFailed.value) return '词表没取到，刷新重试'
  if (!profileQuestion(key)) return '词表里没这道题，刷新重试'
  return '没有可选项'
}

const industryOptions = computed(() => {
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

// 语言清单同样只认后端那一份词表（见 PROFILE_QUESTION_KEYS.languages 上的注释）
const localeOptions = computed(() => profileOptions(PROFILE_QUESTION_KEYS.languages))

const defaultForm = (): CompanyInfoForm => ({
  companyName: '',
  englishName: '',
  shortName: '',
  foundedDate: '',
  creditCode: '',
  legalRepresentative: '',
  address: '',
  provinceName: '',
  cityName: '',
  postalCode: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
  serviceHotline: '',
  introduction: '',
  business: '',
  culture: '',
  industry: '',
  subIndustry: '',
  targetRegions: '',
  targetAudience: '',
  businessModel: '',
  coreProducts: '',
  competitorDomains: '',
  seedKeywords: '',
  excludedKeywords: '',
  searchLocales: '',
  wechat: '',
  weibo: '',
  douyin: '',
  linkedin: '',
  github: '',
  logoUrl: '',
  faviconUrl: '',
  certificateUrls: ''
})

const form = reactive<CompanyInfoForm>(defaultForm())

const industryPath = ref<string[]>([])
const targetRegionsList = ref<string[]>([])
const targetAudienceList = ref<string[]>([])
const businessModelList = ref<string[]>([])
const searchLocalesList = ref<string[]>([])
const competitorDomainsList = ref<string[]>([''])
const seedKeywordsList = ref<string[]>([''])
const excludedKeywordsList = ref<string[]>([''])

const foundedDateVal = computed({
  get: () => form.foundedDate || undefined,
  set: (val: any) => {
    form.foundedDate = val || ''
  }
})

function parseList(value?: string): string[] {
  const items = (value || '')
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
  return items.length ? items : ['']
}

function joinList(items: string[]): string {
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

function fillFormFromData(data: CompanyInfo) {
  Object.assign(form, defaultForm(), data)
  industryPath.value = [data.industry, data.subIndustry].filter(Boolean) as string[]
  targetRegionsList.value = parseList(data.targetRegions).filter(Boolean)
  targetAudienceList.value = parseList(data.targetAudience).filter(Boolean)
  businessModelList.value = parseList(data.businessModel).filter(Boolean)
  searchLocalesList.value = parseList(data.searchLocales).filter(Boolean)
  competitorDomainsList.value = parseList(data.competitorDomains)
  seedKeywordsList.value = parseList(data.seedKeywords)
  excludedKeywordsList.value = parseList(data.excludedKeywords)

  if (data.logoUrl) {
    logoFileList.value = [{
      uid: '-1',
      name: 'logo.png',
      status: 'done',
      url: data.logoUrl
    }]
  }
  if (data.faviconUrl) {
    faviconFileList.value = [{
      uid: '-1',
      name: 'favicon.png',
      status: 'done',
      url: data.faviconUrl
    }]
  }
  const certificates = parseList(data.certificateUrls).filter(Boolean)
  certificateFileList.value = certificates.map((url, index) => ({
    uid: `certificate-${index}`,
    name: `资质文件${index + 1}`,
    status: 'done',
    url
  }))
}

async function loadCompanyInfo() {
  loading.value = true
  try {
    const data = await companyInfoApi.get(tenantId.value)
    if (data) {
      fillFormFromData(data)
    }
  } catch (error) {
    message.error(`加载企业信息失败：${describeHttpError(error)}`)
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (!form.companyName?.trim()) {
    message.warning('请填写公司名称')
    return
  }
  saving.value = true
  try {
    const payload: CompanyInfoForm = {
      ...form,
      industry: industryPath.value[0] || '',
      subIndustry: industryPath.value[1] || '',
      targetRegions: joinList(targetRegionsList.value),
      targetAudience: joinList(targetAudienceList.value),
      businessModel: joinList(businessModelList.value),
      searchLocales: joinList(searchLocalesList.value),
      competitorDomains: joinList(competitorDomainsList.value),
      seedKeywords: joinList(seedKeywordsList.value),
      excludedKeywords: joinList(excludedKeywordsList.value)
    }
    await companyInfoApi.update(payload, tenantId.value)
    message.success('保存成功')
    await loadCompanyInfo()
  } catch (error) {
    message.error(`保存失败：${describeHttpError(error)}`)
    console.error(error)
  } finally {
    saving.value = false
  }
}

function handleReset() {
  loadCompanyInfo()
  message.info('已重置表单')
}

function checkImage(file: File): boolean {
  if (!file.type.startsWith('image/')) {
    message.error('只能上传图片文件')
    return false
  }
  if (file.size / 1024 / 1024 >= 2) {
    message.error('图片大小不能超过 2MB')
    return false
  }
  return true
}

async function uploadCompanyImage(
  kind: 'logo' | 'favicon' | 'certificate',
  file: File,
  onUploaded: (url: string) => void,
  successText: string
) {
  try {
    const res = await companyInfoApi.uploadImage(kind, file, tenantId.value) as any
    onUploaded(res?.url || '')
    message.success(successText)
  } catch (error) {
    message.error(`上传失败：${describeHttpError(error)}`)
  }
}

function beforeUpload(file: File) {
  if (!checkImage(file)) return false
  uploadCompanyImage('logo', file, (url) => {
    form.logoUrl = url
    logoFileList.value = [{ uid: 'logo', name: file.name, status: 'done', url }]
  }, 'Logo 上传成功')
  return false
}

function beforeFaviconUpload(file: File) {
  if (!checkImage(file)) return false
  uploadCompanyImage('favicon', file, (url) => {
    form.faviconUrl = url
    faviconFileList.value = [{ uid: 'favicon', name: file.name, status: 'done', url }]
  }, '网站图标上传成功')
  return false
}

function beforeCertificateUpload(file: File) {
  if (!checkImage(file)) return false
  uploadCompanyImage('certificate', file, (url) => {
    const existing = parseList(form.certificateUrls).filter(Boolean)
    existing.push(url)
    form.certificateUrls = existing.join(',')
    certificateFileList.value = existing.map((item, index) => ({
      uid: `certificate-${index}`,
      name: `资质文件${index + 1}`,
      status: 'done',
      url: item
    }))
  }, '资质文件上传成功')
  return false
}

function handleLogoChange(info: any) {
  logoFileList.value = info.fileList
  if (!info.fileList.length) form.logoUrl = ''
}

function handleFaviconChange(info: any) {
  faviconFileList.value = info.fileList
  if (!info.fileList.length) form.faviconUrl = ''
}

watch(tenantId, () => {
  loadCompanyInfo()
})

onMounted(() => {
  loadCompanyInfo()
  loadProfileVocabulary()
})
</script>

<style scoped lang="less">
.company-info-page {
  width: 100%;
  padding: 0;
}

.content-wrapper {
}

.info-card {
  margin-bottom: 16px;
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

  :deep(.ant-input) {
    flex: 1;
  }
}

.logo-upload-section {
  .upload-label {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a1a;
    margin-bottom: 12px;
  }

  .upload-tip {
    font-size: 12px;
    color: #8c8c8c;
    margin-top: 8px;
  }
}
</style>
