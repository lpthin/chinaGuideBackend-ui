<template>
  <div class="build-workbench">
    <a-alert type="info" show-icon class="build-workbench__notice">
      <template #message>
        建站流水线 0（Spec §6.1）：把「选骨架 → 灌演示内容 → 组装 → 逐页发布 → 交棒租户」串成一页。
        运营模型是<strong>分配即建站</strong>——租户账号建好时，这些步骤就该已经走完，所以每一步都写着现状，
        而不是一句「请自行确认」。
      </template>
    </a-alert>

    <a-form layout="inline" class="build-workbench__toolbar">
      <a-form-item label="站点">
        <a-select v-model:value="siteId" style="width: 260px" :options="siteOptions"
                  placeholder="选一个要建的站点" @change="loadSiteState" />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button :loading="loadingSites || loadingCapabilities" @click="refreshAll">刷新</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-alert v-if="sitesError" type="error" show-icon class="build-workbench__notice" :message="sitesError" />
    <a-alert v-else-if="!loadingSites && !sites.length" type="warning" show-icon class="build-workbench__notice"
             message="一个站点都取不到" description="站点列表按登录态过滤：这个账号没挂任何站点，先去系统管理 > 站点管理建一个。" />

    <a-spin :spinning="loadingSites || loadingPages">
      <div class="build-workbench__steps">
        <!-- 步骤 1 选骨架 -->
        <a-card size="small" class="build-workbench__step">
          <template #title><span class="build-workbench__index">1</span> 选骨架</template>
          <p class="build-workbench__state">
            <template v-if="!selectedSite">先选站点，才知道这一站登记了哪套骨架。</template>
            <template v-else-if="!skeletonKey">
              这站还没登记骨架，先去骨架库应用一套（骨架是站点的出生证明，没有它就谈不上逐页补内容）。
            </template>
            <template v-else>
              已登记骨架 <strong>{{ skeletonKey }}</strong><span v-if="skeletonName">（{{ skeletonName }}）</span>
              ，实例化版本 v{{ skeletonVersion ?? '未知' }}。
              <span v-if="skeletonOutdated">平台那份已经出到 v{{ currentSkeletonVersion }}，差距由页面巡检提醒，这里不自动升级。</span>
            </template>
          </p>
          <a-button type="primary" @click="router.push({ name: 'workspace-portal-skeletons' })">去骨架库</a-button>
        </a-card>

        <!-- 步骤 2 灌演示内容 -->
        <a-card size="small" class="build-workbench__step">
          <template #title><span class="build-workbench__index">2</span> 灌演示内容</template>
          <p class="build-workbench__state">
            <template v-if="pagesError">演示内容没取到：{{ pagesError }}</template>
            <template v-else-if="!siteId">先选站点。</template>
            <template v-else-if="demoPageCount === 0">
              本站共 {{ pages.length }} 页，没有任何带演示标记的内容：先去「门户上线」生成演示门户，
              客户还没签就有东西可看，这一步是整个流水线的敲门砖。
            </template>
            <template v-else>
              本站共 {{ pages.length }} 页，其中带演示标记的内容 {{ demoPageCount }} 页；
              演示内容转正式只在那一步去标记，不复制第二份。
            </template>
          </p>
          <a-button :disabled="!siteId" @click="router.push({ name: 'workspace-portal-launch' })">去门户上线生成演示内容</a-button>
        </a-card>

        <!-- 步骤 3 AI 整站组装：本期未上线，不留假按钮 -->
        <a-card size="small" class="build-workbench__step">
          <template #title><span class="build-workbench__index">3</span> AI 整站组装</template>
          <p class="build-workbench__state">
            下一阶段（Spec Q3）功能，本期未上线：现在还没有组装任务端点，
            这里不放一个点了只会报错的按钮。整站组装上线后会带估算—确认—草稿三段门禁，
            本期的站先用第 1、2 步 + 搭建器手工微调（N5：组件搭建归超管，可手工可 AI 辅助）。
          </p>
          <a-tooltip title="AI 整站组装在 Q3 交付，本期没有这个端点，不放假入口">
            <a-button disabled>发起组装任务（下一阶段）</a-button>
          </a-tooltip>
        </a-card>

        <!-- 步骤 4 逐页发布 -->
        <a-card size="small" class="build-workbench__step">
          <template #title><span class="build-workbench__index">4</span> 逐页发布</template>
          <p class="build-workbench__state">
            <template v-if="pagesError">页面状态没取到：{{ pagesError }}</template>
            <template v-else-if="!siteId">先选站点。</template>
            <template v-else-if="!pages.length">这站一页都没有，先去第 1 步应用骨架。</template>
            <template v-else>
              共 {{ pages.length }} 页：
              <span v-for="line in statusLines" :key="line.status" class="build-workbench__status">{{ line.text }}</span>
              ；发布是逐页的动作，这一页不做批量（骨架只在建站/重建时实例化）。
            </template>
          </p>
          <a-button :disabled="!siteId" @click="router.push({ name: 'workspace-portal-pages' })">去页面搭建逐页发布</a-button>
        </a-card>

        <!-- 步骤 5 交棒租户 -->
        <a-card size="small" class="build-workbench__step">
          <template #title><span class="build-workbench__index">5</span> 交棒租户</template>
          <p class="build-workbench__state">
            <template v-if="sectionsError">栏目开通态没取到：{{ sectionsError }}</template>
            <template v-else-if="!siteId">先选站点。</template>
            <template v-else>
              已开通栏目 {{ enabledSectionCount }} 个（共 {{ sections.length }} 个可开）。
              交棒之后租户只做四件事：维护基础信息、发内容、传知识库、生成文章；
              栏目本身它改不了（N2 永久边界），有意见走「联系平台」工单。
            </template>
          </p>
          <a-button :disabled="!siteId" @click="router.push({ name: 'workspace-portal-sections' })">去栏目管理核对开通态</a-button>
        </a-card>
      </div>
    </a-spin>

    <!-- 建设链路的依赖体检：只报后端探出来的现状，一句都不替它归纳 -->
    <a-card size="small" class="build-workbench__caps">
      <template #title>依赖体检</template>
      <a-alert v-if="capabilitiesError" type="error" show-icon
               :message="capabilitiesError"
               description="体检没取到就是没取到：这一格不猜哪个开关开着，也不给一句「一切正常」。" />
      <template v-else-if="capabilities">
        <p class="build-workbench__state">
          建站这几步要不要真的发请求、真的花 token，由服务端配置里几道开关决定。下面五个格子读的就是接口回的那五个布尔位，
          本次探测的租户是 {{ capabilities.probedTenantId }}（不带租户时后端按平台探：平台有才等于任何租户最差也有）。
        </p>
        <div class="build-workbench__cap-chips">
          <span v-for="chip in capabilityChips" :key="chip.field" class="build-workbench__cap-chip">
            <a-tag :color="chip.on ? 'green' : 'red'">{{ chip.on ? '已开启' : '未开启' }}</a-tag>
            <span>{{ chip.label }}</span>
          </span>
        </div>
        <p class="build-workbench__cap-extra">
          另两个不是开关：截图服务这一次{{ capabilities.sidecarReachable ? '探得通' : '探不通' }}
          （后端探测原文：{{ capabilities.sidecarDetail || '没给' }}）；视觉模型
          {{ capabilities.visionModelReady ? '查到了' : '没查到' }}一条 model_type=vision 的配置行——
          它只是去配置里查了一行，没有真调过一次模型，所以不混进上面五个开关里充数。
        </p>
        <ul v-if="guidanceLines.length" class="build-workbench__guidance">
          <li v-for="(line, index) in guidanceLines" :key="index">{{ line }}</li>
        </ul>
        <p v-else class="build-workbench__cap-extra">后端这次一行说明都没给，这里就不替它编一句。</p>
        <p class="build-workbench__boundary">这一页只做检查与说明，开关仍要改配置重启。</p>
      </template>
      <p v-else class="build-workbench__state">体检还在读。</p>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { portalPagesApi, type PortalPage } from '../../api/portalPages'
import { portalSectionsApi, type SectionState } from '../../api/portalSections'
import { portalReferenceApi, type ReferenceCapabilities } from '../../api/referenceSites'
import { portalSkeletonsApi } from '../../api/portalSkeletons'
import { siteApi } from '../../api/workspace'

/**
 * 超管「建站工作台」（Spec §6.1 / §7.2 流水线 0，Q2）。
 *
 * 这一页只报现状 + 给真入口，不在这儿写库：
 * 1. 骨架登记来自 `/admin/sites` 的 skeletonKey/skeletonVersion（出生证明），骨架名去骨架库列表里查，
 *    查不到也只说明 key，不在前端留一份骨架清单（I-1）；
 * 2. 页数与状态计数来自 `/api/portal/pages`，状态中文说法来自 `/api/portal/pages/statuses`；
 * 3. AI 组装本期没有端点，就把按钮禁用并写清「下一阶段」，不放一个点了必然报错的假功能；
 * 4. 「依赖体检」读的是后端 ReferenceCapabilities 那一次快照：五个开关位按布尔显示，缺什么照它写的
 *    那几句中文原样列出来（那些句子里点名的是配置文件里的键，前端改一个字就对不上号了）。
 *    这里没有任何开关可以翻，所以它既不跟着站点走（探测按后端给的 probedTenantId 说），也不提供「一键启用」。
 */

interface SiteRow {
  id: number
  name: string
  skeletonKey: string | null
  skeletonVersion: number | null
}

/**
 * 体检卡上的五个格子：一个格子对应配置里的一道开关，取值就是响应里那个同名的布尔。
 *
 * sidecarReachable 与 visionModelReady 不在这里——前者是一次探测结果、后者只是查了一行模型配置，
 * 都不是「翻一下就生效」的开关，混进来会让读者以为它们和那四道闸门同一种东西。
 */
type CapabilitySwitchField =
  'sidecarConfigured' | 'crawlEnabled' | 'analyzeEnabled' | 'reviewAiEnabled' | 'assemblyEnabled'

const CAPABILITY_SWITCHES: Array<{ field: CapabilitySwitchField; label: string }> = [
  { field: 'sidecarConfigured', label: '截图服务（sidecar）' },
  { field: 'crawlEnabled', label: '参考站抓取' },
  { field: 'analyzeEnabled', label: '参考站 AI 摄取' },
  { field: 'reviewAiEnabled', label: '批注 → AI 改版草稿' },
  { field: 'assemblyEnabled', label: 'AI 整站组装' }
]

const router = useRouter()

const sites = ref<SiteRow[]>([])
const siteId = ref<number | null>(null)
const pages = ref<PortalPage[]>([])
const sections = ref<SectionState[]>([])
const skeletonVersions = ref<Record<string, number>>({})
const skeletonNames = ref<Record<string, string>>({})
const statusLabels = ref<Record<string, string>>({})
const capabilities = ref<ReferenceCapabilities | null>(null)

const loadingSites = ref(false)
const loadingPages = ref(false)
const loadingCapabilities = ref(false)
const sitesError = ref('')
const pagesError = ref('')
const sectionsError = ref('')
const capabilitiesError = ref('')

const selectedSite = computed(() => sites.value.find(site => site.id === siteId.value) || null)
const siteOptions = computed(() => sites.value.map(site => ({ value: site.id, label: site.name })))

const skeletonKey = computed(() => selectedSite.value?.skeletonKey || '')
const skeletonVersion = computed(() => selectedSite.value?.skeletonVersion ?? null)
const currentSkeletonVersion = computed(() => skeletonVersions.value[skeletonKey.value] ?? null)
const skeletonName = computed(() => skeletonNames.value[skeletonKey.value] || '')
const skeletonOutdated = computed(() => {
  const current = currentSkeletonVersion.value
  return current !== null && skeletonVersion.value !== null && current > skeletonVersion.value
})

const demoPageCount = computed(() => pages.value.filter(page => page.isDemo).length)

/** 五个开关格子：on 只取响应里那个同名布尔，没取到之前一个格子都不渲染（见模板的 v-else-if="capabilities"） */
const capabilityChips = computed(() => CAPABILITY_SWITCHES.map(item => ({
  field: item.field,
  label: item.label,
  on: capabilities.value ? capabilities.value[item.field] : false
})))

/** 后端写好的那几句原话：一条不改、一条不补，顺序也照它给的（缺几个就说几条） */
const guidanceLines = computed(() => capabilities.value?.guidance || [])

const statusLines = computed(() => {
  const counts = new Map<string, number>()
  pages.value.forEach(page => counts.set(page.status, (counts.get(page.status) || 0) + 1))
  return Array.from(counts.entries()).map(([status, count]) => ({
    status,
    // 词表里查不到的状态就照后端原样写出来：宁可难看一点也不替它编一个中文说法
    text: `${statusLabels.value[status] || status} ${count} 页`
  }))
})

async function loadSites() {
  loadingSites.value = true
  sitesError.value = ''
  try {
    const list = await siteApi.list()
    sites.value = (list || []).map((site: any) => ({
      id: site.id,
      name: site.name,
      skeletonKey: site.skeletonKey || null,
      skeletonVersion: typeof site.skeletonVersion === 'number' ? site.skeletonVersion : null
    }))
    if (siteId.value === null || !sites.value.some(site => site.id === siteId.value)) {
      siteId.value = sites.value.length ? sites.value[0].id : null
    }
  } catch (error: any) {
    sitesError.value = error?.message || '站点列表加载失败'
  } finally {
    loadingSites.value = false
  }
  await loadSiteState()
}

/** 骨架名与版本查一次就够：读不到不影响这一页（那一格只报 key） */
async function loadSkeletonIndex() {
  try {
    const list = await portalSkeletonsApi.list()
    const versions: Record<string, number> = {}
    const names: Record<string, string> = {}
    ;(list || []).forEach(skeleton => {
      versions[skeleton.skeletonKey] = skeleton.version
      names[skeleton.skeletonKey] = skeleton.name
    })
    skeletonVersions.value = versions
    skeletonNames.value = names
  } catch {
    skeletonVersions.value = {}
    skeletonNames.value = {}
  }
}

async function loadSiteState() {
  pages.value = []
  sections.value = []
  pagesError.value = ''
  sectionsError.value = ''
  if (siteId.value === null) {
    return
  }
  loadingPages.value = true
  try {
    if (Object.keys(statusLabels.value).length === 0) {
      statusLabels.value = await portalPagesApi.statusLabels()
    }
    pages.value = (await portalPagesApi.list({ siteId: siteId.value })) || []
  } catch (error: any) {
    pagesError.value = error?.message || '页面列表加载失败'
  } finally {
    loadingPages.value = false
  }
  try {
    sections.value = (await portalSectionsApi.adminList(siteId.value)) || []
  } catch (error: any) {
    sectionsError.value = error?.message || '栏目开通态加载失败'
  }
}

const enabledSectionCount = computed(() => sections.value.filter(section => section.enabled).length)

/**
 * 体检不带 tenantId：这一页选的是「站点」而不是租户，而平台那一份探测结论对任何租户都最差成立
 * （后端原话），拿站点去凑一个租户号只会得到一个看起来更具体、其实没依据的答案。
 */
async function loadCapabilities() {
  loadingCapabilities.value = true
  capabilitiesError.value = ''
  try {
    capabilities.value = await portalReferenceApi.capabilities()
  } catch (error: any) {
    capabilities.value = null
    capabilitiesError.value = error?.message || '依赖体检加载失败'
  } finally {
    loadingCapabilities.value = false
  }
}

/** 刷新：站点/这一站的页与栏目 + 体检一起重取，别让读者以为体检那颗格子也跟着刷了 */
async function refreshAll() {
  await Promise.all([loadSites(), loadCapabilities()])
}

onMounted(async () => {
  await Promise.all([loadSites(), loadSkeletonIndex(), loadCapabilities()])
})
</script>

<style scoped lang="less">
.build-workbench {
  padding: 16px;

  &__notice {
    margin-bottom: 12px;
  }

  &__toolbar {
    margin-bottom: 12px;
  }

  &__steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 12px;
  }

  &__step {
    align-self: start;
  }

  &__index {
    display: inline-block;
    width: 20px;
    height: 20px;
    margin-right: 6px;
    border-radius: 50%;
    background: #1677ff;
    color: #fff;
    text-align: center;
    line-height: 20px;
    font-size: 12px;
  }

  &__state {
    min-height: 66px;
    color: rgba(0, 0, 0, 0.65);
  }

  &__status {
    margin-right: 8px;
    white-space: nowrap;
  }

  &__caps {
    margin-top: 12px;
  }

  &__cap-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 8px 0;
  }

  &__cap-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__cap-extra {
    margin: 8px 0;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__guidance {
    margin: 8px 0;
    padding-left: 20px;
    color: rgba(0, 0, 0, 0.65);
  }

  &__boundary {
    margin: 8px 0 0;
    font-weight: 600;
  }
}
</style>
