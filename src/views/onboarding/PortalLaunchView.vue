<template>
  <ChecklistPage :steps="steps" :loading="loading" description="把「客户开通」到「访客能在门户上读到内容、爬虫能抓到」之间还缺的步骤摊开：数字全部来自接口真实返回，取不到就显示「未取到」而不是 0；发布仍然要在文章里走审核 → 发布，这里不代替那一步。">
    <template #actions>
      <a-space :size="8">
        <a-tag v-if="missingTenant" color="orange">超级管理员请先在右上角选择客户：本页没有跨客户的全局视图</a-tag>
        <a-button type="primary" :loading="loading" @click="loadAll">刷新</a-button>
      </a-space>
    </template>

    <template #site>
      <a-descriptions :column="1" size="small" bordered>
        <a-descriptions-item label="站点">{{ siteName }}</a-descriptions-item>
        <a-descriptions-item label="站点编码（?site= 用的就是它）">{{ siteFieldValue(readings, site?.code, '—') }}</a-descriptions-item>
        <a-descriptions-item label="访问域名">{{ siteFieldValue(readings, site?.domain, '未绑定') }}</a-descriptions-item>
      </a-descriptions>
      <p class="hint">
        没绑域名时门户仍然可以按站点编码预览，但 <b>sitemap.xml 不会输出任何 URL</b>
        （绝对地址只能来自已配置域名，系统不会拿访问者的请求域名凑一个）。
      </p>
      <p v-if="errors.site" class="error-line">{{ errors.site }}</p>
    </template>

    <template #company>
      <a-descriptions :column="1" size="small" bordered>
        <a-descriptions-item label="企业名称">{{ company?.companyName || (readings.tenantNotSelected ? '—' : readings.companyError ? '未取到' : '未填写') }}</a-descriptions-item>
        <a-descriptions-item label="简介">{{ company?.introduction || '未填写' }}</a-descriptions-item>
        <a-descriptions-item label="联系方式">{{ contactText(company) }}</a-descriptions-item>
      </a-descriptions>
      <p class="hint">
        门户的站名、页脚与 llms.txt 的站点摘要都读这张表（<code>portal_company_info</code>），
        改完门户即时生效。演示内容包里<b>故意不含企业信息</b>：那是事实数据，编一个比空着更糟。
      </p>
      <p v-if="errors.company" class="error-line">{{ errors.company }}</p>
    </template>

    <template #demo>
      <a-descriptions v-if="demo" :column="2" size="small" bordered>
        <a-descriptions-item label="分类">{{ demo.demo.categories }}</a-descriptions-item>
        <a-descriptions-item label="文章">{{ demo.demo.articles }}</a-descriptions-item>
        <a-descriptions-item label="案例">{{ demo.demo.cases }}</a-descriptions-item>
        <a-descriptions-item label="首页横幅">{{ demo.demo.banners }}</a-descriptions-item>
        <a-descriptions-item label="岗位">{{ demo.demo.jobs }}</a-descriptions-item>
        <a-descriptions-item label="标记">is_demo = 1</a-descriptions-item>
      </a-descriptions>
      <a-space class="actions">
        <a-select v-model:value="bootstrapMode" style="width: 210px" :options="MODE_OPTIONS" />
        <a-button :loading="acting === 'bootstrap'" @click="runBootstrap">
          {{ demo && hasDemoContent ? '补齐演示内容' : '生成演示门户内容' }}
        </a-button>
        <a-popconfirm
          title="去掉演示标记后，这些内容会当成门户上的正式页面，并进 sitemap 与访问统计，确定继续？"
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
        两种模式都只碰演示行，客户已有的真实内容不会被覆盖；标识撞车时该行会被跳过，
        并在返回的 conflicts 里说明。转正式内容<b>只去掉 is_demo 标记</b>，文章状态仍是原状态，
        要访客可见还得走审核 → 发布。
      </p>
      <ul v-if="demoConflicts.length" class="conflict-list">
        <li v-for="item in demoConflicts" :key="item">{{ item }}</li>
      </ul>
      <p v-if="errors.demo" class="error-line">{{ errors.demo }}</p>
    </template>

    <template #readers>
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
    </template>

    <template #seo>
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
        人工浏览来自门户埋点，抓取量由服务端按 User-Agent 识别，两者口径不同不可相加。
      </p>
    </template>
  </ChecklistPage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { DemoMode, DemoTypeCounts } from '../../api/onboarding'
import { backendFileUrl, demoSiteApi } from '../../api/onboarding'
import ChecklistPage from '../../components/ChecklistPage.vue'
import { contactText, siteFieldValue } from './launchChecklist'
import { useLaunchReadings } from './useLaunchReadings'

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

/** 后端回的是「每种内容各几条」，界面上念成人话：总数 + 逐类（词与第 3 步那张卡一致） */
const DEMO_TYPE_LABELS: Record<string, string> = {
  categories: '分类',
  articles: '文章',
  cases: '案例',
  banners: '首页横幅',
  jobs: '岗位',
}

function demoCountTotal(counts: DemoTypeCounts | undefined): number {
  return Object.values(counts || {}).reduce((sum, n) => sum + Number(n || 0), 0)
}

function demoCountsText(counts: DemoTypeCounts | undefined): string {
  const detail = Object.entries(counts || {})
    .filter(([, n]) => Number(n) > 0)
    .map(([key, n]) => `${DEMO_TYPE_LABELS[key] ?? key} ${Number(n)}`)
    .join('、')
  const total = demoCountTotal(counts)
  return total ? `${total} 条${detail ? `（${detail}）` : ''}` : '0 条'
}

// 五步的读数与三态全部走 useLaunchReadings：内容工作台那一屏的完成度带用的是同一个来源，
// 两处不许各写一套「读不到算什么」
const {
  authStore,
  loading,
  tenantNotSelected: missingTenant,
  readings,
  steps,
  site,
  siteName,
  company,
  demo,
  visibility,
  errors,
  reload: loadAll,
  loadDemo,
  describeError
} = useLaunchReadings()

const acting = ref<'bootstrap' | 'publish' | null>(null)
const bootstrapMode = ref<DemoMode>('skip')
const actionResult = ref('')
const demoConflicts = ref<string[]>([])

const hasDemoContent = computed(() => {
  const counts = demo.value?.demo
  if (!counts) {
    return false
  }
  return counts.categories + counts.articles + counts.cases + counts.banners + counts.jobs > 0
})

function fileUrl(path: string): string | undefined {
  return backendFileUrl(path, site.value?.code || null) ?? undefined
}

function requireSelectedTenantId(): number {
  const id = authStore.selectedTenantId
  if (id === null) {
    throw new Error('请先在右上角选择客户')
  }
  return id
}

async function runBootstrap(): Promise<void> {
  acting.value = 'bootstrap'
  actionResult.value = ''
  try {
    const result = await demoSiteApi.bootstrap(requireSelectedTenantId(), bootstrapMode.value)
    demoConflicts.value = result.conflicts || []
    const changed = demoCountTotal(result.created) + demoCountTotal(result.updated)
    actionResult.value = `${changed ? '演示内容已生成' : '演示内容已经在，这一趟没有新增也没有更新'}：`
      + `新增 ${demoCountsText(result.created)}、更新 ${demoCountsText(result.updated)}、跳过 ${demoCountsText(result.skipped)}`
      + (demoConflicts.value.length ? `；有 ${demoConflicts.value.length} 条与已有内容标识冲突被跳过` : '')
    if (demoConflicts.value.length) {
      message.warning(`有 ${demoConflicts.value.length} 条演示内容与已有内容标识冲突，已跳过`)
    } else if (changed) {
      message.success('演示内容已生成')
    } else {
      message.info('演示内容已经在，这一趟没有新增')
    }
    await loadDemo()
  } catch (error) {
    message.error(describeError(error))
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
    message.error(describeError(error))
  } finally {
    acting.value = null
  }
}

onMounted(loadAll)
</script>

<style scoped>
.scope-note {
  margin-bottom: var(--admin-space-2);
}

.actions {
  margin-top: var(--admin-space-1);
}

.result {
  margin-top: var(--admin-space-1);
}

.hint {
  margin: var(--admin-space-1) 0 0;
  color: var(--admin-text-secondary);
  font-size: 13px;
}

.error-line {
  margin: var(--admin-space-1) 0 0;
  color: var(--admin-danger-text);
  font-size: 13px;
}

.conflict-list {
  margin: var(--admin-space-1) 0 0;
  padding-left: 20px;
  color: var(--admin-warning-text);
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
  margin-left: var(--admin-space-1);
  color: var(--admin-text-muted);
}
</style>
