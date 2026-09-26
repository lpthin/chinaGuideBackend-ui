<template>
  <div class="portal-launch-page">
    <a-alert type="info" show-icon class="scope-note">
      <template #message>
        这一页只做一件事：把「租户开通」到「访客能在门户上读到内容、爬虫能抓到」之间还缺的步骤摊开。
        数字全部来自接口真实返回，取不到就显示「未取到」而不是 0；
        <b>发布仍然要在文章里走审核 → 发布</b>，这里不代替那一步。
      </template>
    </a-alert>

    <a-form layout="inline" class="filter-bar">
      <a-form-item v-if="missingTenant" class="toolbar-fill">
        <a-tag color="orange">超管请先在右上角选择租户：本页没有跨租户的全局视图</a-tag>
      </a-form-item>
      <a-form-item v-else class="toolbar-fill" />
      <a-form-item class="toolbar-actions">
        <a-button type="primary" :loading="loading" @click="loadAll">刷新</a-button>
      </a-form-item>
    </a-form>

    <a-spin :spinning="loading">
      <a-card :bordered="false" class="step-card">
        <template #title><span class="step-index">1</span> 站点与访问域名</template>
        <template #extra><a-tag :color="siteState.color">{{ siteState.text }}</a-tag></template>
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="站点">{{ siteText }}</a-descriptions-item>
          <a-descriptions-item label="站点编码（?site= 用的就是它）">{{ site?.code || '—' }}</a-descriptions-item>
          <a-descriptions-item label="访问域名">{{ site?.domain || '未绑定' }}</a-descriptions-item>
        </a-descriptions>
        <p class="hint">
          域名由平台管理员在「系统管理 → 站点管理」绑定。没绑域名时门户仍然可以按站点编码预览，
          但 <b>sitemap.xml 不会输出任何 URL</b>（绝对地址只能来自已配置域名，系统不会拿访问者的请求域名凑一个）。
        </p>
        <p v-if="errors.site" class="error-line">{{ errors.site }}</p>
      </a-card>

      <a-card :bordered="false" class="step-card">
        <template #title><span class="step-index">2</span> 企业信息</template>
        <template #extra><a-tag :color="companyState.color">{{ companyState.text }}</a-tag></template>
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="企业名称">{{ company?.companyName || '未填写' }}</a-descriptions-item>
          <a-descriptions-item label="简介">{{ company?.introduction || '未填写' }}</a-descriptions-item>
          <a-descriptions-item label="联系方式">
            {{ contactText }}
          </a-descriptions-item>
        </a-descriptions>
        <p class="hint">
          门户的站名、页脚与 llms.txt 的站点摘要都读这张表（<code>portal_company_info</code>），
          改完门户即时生效。演示内容包里<b>故意不含企业信息</b>：那是事实数据，编一个比空着更糟。
        </p>
        <p class="hint">
          <router-link :to="{ name: 'workspace-portal-company' }">去填写企业信息</router-link>
        </p>
        <p v-if="errors.company" class="error-line">{{ errors.company }}</p>
      </a-card>

      <a-card :bordered="false" class="step-card">
        <template #title><span class="step-index">3</span> 演示内容</template>
        <template #extra><a-tag :color="demoState.color">{{ demoState.text }}</a-tag></template>

        <template v-if="authStore.isSuperAdmin">
          <a-descriptions v-if="demo" :column="2" size="small" bordered>
            <a-descriptions-item label="分类">{{ demo.demo.categories }}</a-descriptions-item>
            <a-descriptions-item label="文章">{{ demo.demo.articles }}</a-descriptions-item>
            <a-descriptions-item label="案例">{{ demo.demo.cases }}</a-descriptions-item>
            <a-descriptions-item label="首页 Banner">{{ demo.demo.banners }}</a-descriptions-item>
            <a-descriptions-item label="岗位">{{ demo.demo.jobs }}</a-descriptions-item>
            <a-descriptions-item label="标记">is_demo = 1</a-descriptions-item>
          </a-descriptions>
          <a-space class="actions">
            <a-select v-model:value="bootstrapMode" style="width: 210px" :options="MODE_OPTIONS" />
            <a-button :loading="acting === 'bootstrap'" @click="runBootstrap">
              {{ demo && hasDemoContent ? '补齐演示内容' : '生成演示门户内容' }}
            </a-button>
            <a-popconfirm
              title="去掉演示标记后，这些内容会进入门户列表、sitemap 与访问统计，确定继续？"
              ok-text="确定"
              cancel-text="取消"
              :disabled="!hasDemoContent"
              @confirm="runPublishDemo"
            >
              <a-button danger :disabled="!hasDemoContent" :loading="acting === 'publish'">
                转为正式内容
              </a-button>
            </a-popconfirm>
          </a-space>
          <a-alert v-if="actionResult" type="success" show-icon class="result" :message="actionResult" />
          <p class="hint">
            两种模式都只碰演示行，租户已有的真实内容不会被覆盖；标识撞车时该行会被跳过，
            并在返回的 conflicts 里说明。转正式内容<b>只去掉 is_demo 标记</b>，文章状态仍是原状态，
            要访客可见还得走审核 → 发布。
          </p>
          <ul v-if="demoConflicts.length" class="conflict-list">
            <li v-for="item in demoConflicts" :key="item">{{ item }}</li>
          </ul>
        </template>
        <p v-else class="hint">
          演示内容包由平台管理员在开通租户时生成（超管功能）。需要一套演示门户，请联系平台管理员。
        </p>
        <p v-if="errors.demo" class="error-line">{{ errors.demo }}</p>
      </a-card>

      <a-card :bordered="false" class="step-card">
        <template #title><span class="step-index">4</span> 访客实际能看到的内容</template>
        <template #extra><a-tag :color="visibilityState.color">{{ visibilityState.text }}</a-tag></template>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-statistic title="门户文章列表返回的文章数" :value="visibility.articles ?? '未取到'" />
          </a-col>
          <a-col :span="12">
            <a-statistic title="门户案例列表返回的案例数" :value="visibility.cases ?? '未取到'" />
          </a-col>
        </a-row>
        <p class="hint">
          这两个数直接调用门户的公开接口，和访客打开列表页看到的是同一份结果（已发布 + 非演示），
          所以它比后台的文章总数更能说明「上线了没有」。
        </p>
        <p class="hint">
          <router-link :to="{ name: 'workspace-articles' }">去文章管理</router-link>
          ·
          <router-link :to="{ name: 'workspace-case-list' }">去案例管理</router-link>
        </p>
        <p v-if="errors.visibility" class="error-line">{{ errors.visibility }}</p>
      </a-card>

      <a-card :bordered="false" class="step-card">
        <template #title><span class="step-index">5</span> 门户预览与 SEO / GEO 出口</template>
        <template #extra>
          <a-button v-if="portalPreviewUrl" type="link" :href="portalPreviewUrl" target="_blank">
            打开门户预览
          </a-button>
          <a-tag v-else color="default">没有站点编码，无法预览</a-tag>
        </template>
        <ul class="file-list">
          <li v-for="file in SEO_FILES" :key="file.path">
            <span class="file-name">{{ file.name }}</span>
            <a v-if="fileUrl(file.path)" :href="fileUrl(file.path)" target="_blank">{{ file.path }}</a>
            <code v-else>{{ file.path }}</code>
            <span class="file-note">{{ file.note }}</span>
          </li>
        </ul>
        <p class="hint">
          这些文件由后端直接返回，不走前端路由。本地开发时前端与后端不同端口，
          需要在 <code>.env</code> 里配置 <code>VITE_BACKEND_ORIGIN</code> 才能给出可点击链接，
          否则只显示路径——给一个点开是 SPA 首页的假链接没有意义。
        </p>
        <p class="hint">
          <router-link :to="{ name: 'workspace-portal-analytics' }">访问统计</router-link>
          ：人工浏览来自门户埋点，抓取量由服务端按 User-Agent 识别，两者口径不同不可相加。
        </p>
      </a-card>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useAuthStore } from '../../stores/auth'
import { companyInfoApi, siteApi } from '../../api'
import { backendFileUrl, demoSiteApi, portalVisibilityApi } from '../../api/onboarding'
import type { DemoMode, DemoStatusResult } from '../../api/onboarding'
import type { CompanyInfo, Site } from '../../types'

interface SiteBrief {
  id?: number
  code: string
  name: string
  domain: string
}

interface StateTag {
  color: 'green' | 'orange' | 'red' | 'blue' | 'default'
  text: string
}

const SEO_FILES = [
  { name: '爬虫协议', path: '/robots.txt', note: 'AI 爬虫白名单 + sitemap 地址' },
  { name: '站点地图', path: '/sitemap.xml', note: '只含已发布、非演示、且门户上真能打开的页面' },
  { name: 'AI 摘要清单', path: '/llms.txt', note: '站名/摘要 + 文章与案例的链接清单' },
  { name: 'AI 全文语料', path: '/llms-full.txt', note: '带正文的长文版，单篇按长度截断' },
]

const MODE_OPTIONS = [
  { label: '只补缺（skip）', value: 'skip' },
  { label: '覆盖同名演示内容（overwrite）', value: 'overwrite' },
]

const authStore = useAuthStore()

const loading = ref(false)
const acting = ref<'bootstrap' | 'publish' | null>(null)
const bootstrapMode = ref<DemoMode>('skip')
const actionResult = ref('')

const site = ref<SiteBrief | null>(null)
const company = ref<CompanyInfo | null>(null)
const demo = ref<DemoStatusResult | null>(null)
const demoConflicts = ref<string[]>([])
const visibility = ref<{ articles: number | null, cases: number | null }>({ articles: null, cases: null })
const errors = ref<Record<string, string>>({})

const missingTenant = computed(() => authStore.isSuperAdmin && authStore.selectedTenantId === null)

const siteText = computed(() => {
  if (!site.value) {
    return errors.value.site ? '未取到' : '该租户还没有站点'
  }
  return `${site.value.name}${site.value.id ? `（ID ${site.value.id}）` : ''}`
})

const siteState = computed<StateTag>(() => {
  if (errors.value.site) {
    return { color: 'red', text: '读取失败' }
  }
  if (!site.value) {
    return { color: 'red', text: '缺少站点' }
  }
  return site.value.domain ? { color: 'green', text: '已绑定域名' } : { color: 'orange', text: '未绑定域名' }
})

const contactText = computed(() => {
  const values = [company.value?.phone, company.value?.email, company.value?.serviceHotline]
    .filter((value): value is string => !!value)
  return values.length ? values.join(' / ') : '未填写'
})

const companyState = computed<StateTag>(() => {
  if (errors.value.company) {
    return { color: 'red', text: '读取失败' }
  }
  const info = company.value
  if (!info?.companyName) {
    return { color: 'red', text: '未填写' }
  }
  if (!info.introduction || !(info.phone || info.email)) {
    return { color: 'orange', text: '信息不完整' }
  }
  return { color: 'green', text: '已填写' }
})

const hasDemoContent = computed(() => {
  const counts = demo.value?.demo
  if (!counts) {
    return false
  }
  return counts.categories + counts.articles + counts.cases + counts.banners + counts.jobs > 0
})

const demoState = computed<StateTag>(() => {
  if (!authStore.isSuperAdmin) {
    return { color: 'default', text: '超管功能' }
  }
  if (errors.value.demo) {
    return { color: 'red', text: '读取失败' }
  }
  if (!demo.value) {
    return { color: 'default', text: '未读取' }
  }
  return hasDemoContent.value ? { color: 'blue', text: '已有演示内容' } : { color: 'orange', text: '尚无演示内容' }
})

const visibilityState = computed<StateTag>(() => {
  if (errors.value.visibility) {
    return { color: 'red', text: '读取失败' }
  }
  if (visibility.value.articles === null) {
    return { color: 'default', text: '未取到' }
  }
  return visibility.value.articles > 0 ? { color: 'green', text: '门户已有可读内容' } : { color: 'orange', text: '门户上还没有已发布内容' }
})

const portalPreviewUrl = computed(() => {
  if (!site.value?.code) {
    return ''
  }
  // 门户是 SPA，本地按站点编码定位租户；线上由域名决定，这个链接只用于开发/验收
  return `${window.location.origin}/?site=${encodeURIComponent(site.value.code)}`
})

function fileUrl(path: string): string | undefined {
  return backendFileUrl(path, site.value?.code || null) ?? undefined
}

function reset(): void {
  errors.value = {}
  actionResult.value = ''
}

async function loadOwnSite(): Promise<void> {
  const rows = await siteApi.list()
  const first = Array.isArray(rows) ? rows[0] : undefined
  site.value = first ? toBrief(first) : null
}

function toBrief(row: Site): SiteBrief {
  return { id: row.id, code: row.code, name: row.name, domain: row.domain }
}

async function loadAll(): Promise<void> {
  reset()
  visibility.value = { articles: null, cases: null }
  if (missingTenant.value) {
    site.value = null
    company.value = null
    demo.value = null
    return
  }
  loading.value = true
  const tasks: Promise<void>[] = [
    loadCompany(),
    authStore.isSuperAdmin ? loadDemoStatus() : loadOwnSite(),
  ]
  await Promise.all(tasks)
  if (site.value?.code) {
    await loadVisibility(site.value.code)
  }
  loading.value = false
}

async function loadCompany(): Promise<void> {
  try {
    company.value = await companyInfoApi.get(authStore.selectedTenantId ?? undefined)
  } catch (error) {
    company.value = null
    errors.value.company = describe(error)
  }
}

async function loadDemoStatus(): Promise<void> {
  try {
    const status = await demoSiteApi.status(requireSelectedTenantId())
    demo.value = status
    // 超管视角下站点信息就在 status 返回里，不必再调一次站点列表
    site.value = status.siteCode
      ? { id: status.siteId ?? undefined, code: status.siteCode, name: status.siteName || '', domain: status.domain || '' }
      : null
  } catch (error) {
    demo.value = null
    site.value = null
    errors.value.demo = describe(error)
    errors.value.site = describe(error)
  }
}

async function loadVisibility(siteCode: string): Promise<void> {
  const [articles, cases] = await Promise.all([
    portalVisibilityApi.publishedArticles(siteCode).catch((error) => {
      errors.value.visibility = describe(error)
      return null
    }),
    portalVisibilityApi.publishedCases(siteCode).catch((error) => {
      errors.value.visibility = describe(error)
      return null
    }),
  ])
  visibility.value = {
    articles: articles ? Number(articles.total) : null,
    cases: cases ? Number(cases.total) : null,
  }
}

async function runBootstrap(): Promise<void> {
  acting.value = 'bootstrap'
  actionResult.value = ''
  try {
    const result = await demoSiteApi.bootstrap(requireSelectedTenantId(), bootstrapMode.value)
    demoConflicts.value = result.conflicts || []
    actionResult.value = `演示内容已生成：新增 ${result.created} 条、更新 ${result.updated} 条、跳过 ${result.skipped} 条`
      + (demoConflicts.value.length ? `；有 ${demoConflicts.value.length} 条与已有内容标识冲突被跳过` : '')
    if (!demoConflicts.value.length) {
      message.success('演示内容已生成')
    } else {
      message.warning(`有 ${demoConflicts.value.length} 条演示内容与已有内容标识冲突，已跳过`)
    }
    await loadDemoStatus()
  } catch (error) {
    message.error(describe(error))
  } finally {
    acting.value = null
  }
}

async function runPublishDemo(): Promise<void> {
  acting.value = 'publish'
  actionResult.value = ''
  try {
    const result = await demoSiteApi.publish(requireSelectedTenantId())
    demoConflicts.value = []
    actionResult.value = result.notice
    message.success('演示标记已去掉，仍需按正常流程发布内容')
    await loadAll()
  } catch (error) {
    message.error(describe(error))
  } finally {
    acting.value = null
  }
}

function requireSelectedTenantId(): number {
  const id = authStore.selectedTenantId
  if (id === null) {
    throw new Error('请先在右上角选择租户')
  }
  return id
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : '请求未成功'
}

onMounted(loadAll)
</script>

<style scoped>
.portal-launch-page {
  padding-bottom: 24px;
}

.scope-note {
  margin-bottom: 16px;
}

.step-card {
  margin-bottom: 16px;
}

.step-index {
  display: inline-block;
  width: 22px;
  height: 22px;
  margin-right: 8px;
  border-radius: 50%;
  background: #1677ff;
  color: #fff;
  text-align: center;
  line-height: 22px;
  font-size: 12px;
}

.actions {
  margin-top: 12px;
}

.result {
  margin-top: 12px;
}

.hint {
  margin: 8px 0 0;
  color: rgba(0, 0, 0, 0.55);
  font-size: 13px;
}

.error-line {
  margin: 8px 0 0;
  color: #cf1322;
  font-size: 13px;
}

.conflict-list {
  margin: 8px 0 0;
  padding-left: 20px;
  color: #d46b08;
  font-size: 13px;
}

.file-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
}

.file-list li {
  margin-bottom: 6px;
}

.file-name {
  display: inline-block;
  min-width: 96px;
  font-weight: 500;
}

.file-note {
  margin-left: 8px;
  color: rgba(0, 0, 0, 0.45);
}
</style>
