<template>
  <a-drawer :open="open" :title="detailTitle" width="1080" placement="right" @update:open="emit('update:open', $event)">
    <a-spin :spinning="detailLoading">
      <template v-if="task">
        <a-descriptions :column="3" size="small" bordered>
          <a-descriptions-item label="状态">
            <a-tag :color="referenceStatusColor(task.status)">{{ statusLabel(task.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="方式">{{ referenceModeLabel(task.mode) }}</a-descriptions-item>
          <a-descriptions-item label="已抓页数">{{ task.pagesCrawled ?? 0 }} / {{ task.maxPages ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="来源网址" :span="2">{{ task.sourceUrl || '—' }}</a-descriptions-item>
          <a-descriptions-item label="robots.txt">{{ task.obeyRobots === false ? '不遵守' : '遵守' }}</a-descriptions-item>
          <a-descriptions-item label="创建人">{{ task.createdBy || '—' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatDateTime(task.createdAt) }}</a-descriptions-item>
          <!-- 重跑一趟时后端不会清掉上一趟的结束时间（那一列只在终态写）：还在跑就别显示它，
               否则界面拿着上一次的结束时刻说这一趟「已经结束了」 -->
          <a-descriptions-item v-if="!referenceIsRunning(task.status)" label="结束时间">
            {{ formatDateTime(task.finishedAt) }}
          </a-descriptions-item>
          <a-descriptions-item v-if="task.errorMessage" label="最近一次结果" :span="3">
            <span class="reference-site-page__error">{{ task.errorMessage }}</span>
          </a-descriptions-item>
        </a-descriptions>

        <a-space style="margin-top: 16px" wrap>
          <a-button v-if="canAddRoute" @click="openRouteModal">补录一条路由</a-button>
          <a-button v-if="canDiscover" :loading="discovering" @click="runDiscover">只列路由清单</a-button>
          <a-button v-if="canCrawl" :loading="crawling" type="primary" @click="startCrawl">
            {{ selectedPageIds.length ? `抓取勾中的 ${selectedPageIds.length} 页` : '开始抓取' }}
          </a-button>
          <a-button :loading="estimating" @click="runEstimate">先估算消耗</a-button>
          <a-button type="primary" :disabled="!estimate" :loading="analyzing" @click="openAnalyzeModal">
            开始 AI 摄取
          </a-button>
          <a-button :disabled="task.status !== 'done'" @click="openApplyModal">生成草稿页</a-button>
          <a-button :loading="detailLoading" @click="refreshDetail">刷新进度</a-button>
        </a-space>
        <p class="reference-site-page__muted">
          抓取分两步：<b>只列路由清单</b>不抓页面、只读一次首页，把这一站有哪几条路由列出来（不花钱、不改状态）；
          勾完再<b>开始抓取</b>。一条都不勾就是老行为——从首页顺着链接自己找，抓满上面那个页数上限。
          <b>补录一条路由</b>给「页面上没有入口、只能靠代码跳过去」的那些页用，它只往清单里加一行，不发请求。
        </p>
        <p class="reference-site-page__muted">
          「先估算消耗」只算不调用模型；「开始 AI 摄取」会真的产生两次 AI 调用，但这一族<b>不进租户的
          token 账单</b>（参考站拆解是平台自己的研发动作，V142 起由平台承担），所以预估数字只是给我们看成本，
          不是向客户收钱的报价。必须先看过预估再勾选确认这条规矩照旧。
          抓取与 AI 摄取都在后台排队执行，这里的进度是靠刷新看出来的，不是按了就算完成的。
        </p>
        <p class="reference-site-page__muted">
          停在「失败」或「需人工处理」的任务<b>不用新建一个重做</b>：已抓到的页面与已上传的截图都还在这个任务里，
          按「最近一次结果」那一栏说的补好料（起截图服务、去掉打不开的路由、或改地址），再点一次上面那两个按钮就行。
          而「结构归纳中」「区块映射中」迟迟不动时，先确认后端有没有重启过——那一趟的执行者跟着进程一起没了，
          界面只能等下一次启动把它收尾。
        </p>

        <!-- 后端给了 notice 就是「这一轮跑不了 / 不该跑」，用 warning 而不是 info：
             它念的是拒绝理由，用信息色等于把闸说成提示 -->
        <a-alert
          v-if="estimate"
          :type="estimate.notice ? 'warning' : 'info'"
          show-icon
          style="margin-top: 8px"
          :message="estimateMessage"
        />
        <a-alert
          v-if="referenceIsRunning(task.status)"
          type="warning"
          show-icon
          style="margin-top: 8px"
          message="任务正在后台执行，这里每 5 秒自动刷新一次；关闭抽屉不影响它继续跑"
        />

        <a-tabs v-model:activeKey="tab" style="margin-top: 16px">
          <a-tab-pane key="pages" :tab="`路由清单（${crawledCount} / ${pages.length}）`">
            <ReferencePagesTab
              :reference-id="currentId"
              :pages="pages"
              :loading="pagesLoading"
              :selectable="canCrawl"
              v-model:selected-page-ids="selectedPageIds"
              :vocabularies="vocabularies"
              :vocab-error="vocabError"
              :shot-urls="shotUrls"
              @uploaded="loadPages"
            />
          </a-tab-pane>

          <a-tab-pane key="mappings" :tab="`区块映射（${mappings.length}）`">
            <ReferenceMappingsTab
              :reference-id="currentId"
              :mappings="mappings"
              :loading="mappingsLoading"
              :blocks="blocks"
              @verified="afterVerify"
            />
          </a-tab-pane>

          <a-tab-pane key="unmatched" :tab="`暂未对上现有区块（${trueGapCount}）`">
            <ReferenceUnmatchedTab
              :reference-id="currentId"
              :groups="unmatchedGroups"
              :loading="unmatchedLoading"
              @promoted="loadMappings"
            />
          </a-tab-pane>

          <a-tab-pane key="package" :tab="`拆出来的模板证据${packageTabSuffix}`">
            <ReferencePackageTab :pkg="templatePackage" :vocabularies="vocabularies" :loading="packageLoading" @load="loadPackage" />
          </a-tab-pane>
        </a-tabs>
      </template>
    </a-spin>

    <!-- ---------------- 人工补录一条路由 ---------------- -->
    <a-modal
      v-model:open="routeOpen"
      title="补录一条路由"
      ok-text="加进清单"
      :confirm-loading="addingRoute"
      @ok="submitRoute"
    >
      <a-form layout="vertical">
        <a-form-item label="站内路径">
          <a-input v-model:value="routeForm.path" :maxlength="200" placeholder="/appointment" />
          <p class="reference-site-page__muted">
            只填路径，以 <b>/</b> 开头。地址由后端按参考站本站的 origin 拼：贴完整 URL 就意味着这里要再判一次
            SSRF 与跨站，而那一判在出站闸那里已经有一份了，不该抄第二份。
          </p>
        </a-form-item>
        <a-form-item label="这一页叫什么（可选，只用于清单上认行）">
          <a-input v-model:value="routeForm.pageName" :maxlength="100" placeholder="例如：预约表单" />
        </a-form-item>
      </a-form>
      <p class="reference-site-page__muted">
        补录只往清单里加一行（来源写「人工补录」），不发请求；要抓它还得回列表勾上再按「开始抓取」，
        那一趟同样要过 robots 与限流，不会因为是人写的就开后门。
      </p>
    </a-modal>

    <!-- ---------------- AI 摄取确认：烧钱动作必须显式确认 ---------------- -->
    <a-modal
      v-model:open="analyzeOpen"
      title="确认让 AI 读这个参考站？"
      :ok-text="estimate?.notice ? '这一轮不会受理' : confirmChecked ? '确认并开始摄取' : '请先勾选确认'"
      :ok-button-props="{ disabled: !confirmChecked || !!estimate?.notice, loading: analyzing }"
      @ok="runAnalyze"
    >
      <p v-if="estimate">
        预计消耗 <b>{{ estimate.estimatedTokens }}</b> token（结构归纳 + 区块映射两步加起来），
        这一族由平台承担、<b>不计入该租户的额度</b>。
      </p>
      <p v-else class="reference-site-page__error">还没有取到预估，请先点「先估算消耗」。</p>
      <p v-if="estimate && estimate.notice" class="reference-site-page__error">
        {{ estimate.notice }}
      </p>
      <p class="reference-site-page__muted">
        这一步产出的是「观察到的结构 + 映射建议」，还要你逐条确认，最后按「生成草稿页」才会出现一份草稿；
        草稿不发布，访客看不到。
      </p>
      <a-checkbox v-model:checked="confirmChecked">我已看过预估，确认这次调用会产生平台的 token 消耗</a-checkbox>
    </a-modal>

    <!-- ---------------- 生成草稿页 ---------------- -->
    <a-modal
      v-model:open="applyOpen"
      title="把这些映射装成一份草稿页"
      :confirm-loading="applying"
      ok-text="生成草稿页"
      @ok="submitApply"
    >
      <a-form layout="vertical">
        <a-form-item label="用哪一页的结构">
          <a-select v-model:value="applyForm.referencePageId" style="width: 100%" :options="pageOptions" />
        </a-form-item>
        <a-form-item label="放到哪个站点">
          <a-select v-model:value="applyForm.siteId" style="width: 100%" :options="siteOptions" />
        </a-form-item>
        <a-form-item label="页面标题">
          <a-input v-model:value="applyForm.title" :maxlength="120" placeholder="例如：首页（参考站结构）" />
        </a-form-item>
        <a-form-item label="访问路径 slug">
          <a-input v-model:value="applyForm.slug" :maxlength="120" placeholder="留空由后端起一个" />
        </a-form-item>
      </a-form>
      <p class="reference-site-page__muted">
        生成的是 status=draft 的页面，发布仍然要你去「页面搭建」里自己按；没确认过的映射不会进来。
      </p>
    </a-modal>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import ReferencePagesTab from './reference/ReferencePagesTab.vue'
import ReferenceMappingsTab from './reference/ReferenceMappingsTab.vue'
import ReferenceUnmatchedTab from './reference/ReferenceUnmatchedTab.vue'
import ReferencePackageTab from './reference/ReferencePackageTab.vue'
import {
  portalReferenceApi,
  referenceIsRunning,
  referenceModeLabel,
  referenceStatusColor,
  unmatchedTrueGapCountOf,
  type ApplyForm,
  type ReferenceEstimate,
  type ReferenceMapping,
  type ReferencePage,
  type ReferenceSite,
  type ReferenceVocabularies,
  type TemplatePackage,
  type UnmatchedGroup
} from '../../api/referenceSites'
import { formatDateTime } from '../../utils/format'
import type { PortalBlockMeta } from '../../api/portalPages'

/**
 * 一个摄取任务的全部读数与动作：任务详情 + 四栏 + 三个弹窗。
 *
 * 界面上刻意做到的四件事，这一层管前三件（词表那件在页面壳那一层读，四栏共用）：
 * 1. 异步受理的动作用轮询跟到落定为止——按完按钮就弹「已完成」是最像成功的假通；
 * 2. 花钱的动作一律先预估再确认，包括「只有截图时让视觉模型看图」这一路（见 Spec §7.9）；
 *    能不能看图不是这里猜的，后端在预估里给中文原因，界面只负责把它显示出来。
 * 3. 抓取拆成「只列路由清单」与「勾完再抓」两步（Spec-E T2）：SPA 模板站的原文里根本没有导航，
 *    让工具自己决定抓哪几页，结果就是「清单明明十条、抓完只剩六页」而没人知道差在哪。
 *
 * 唯一能写进线上的动作是「生成草稿页」，而它出的是 draft，发布仍归租户自己按。
 */

const props = defineProps<{
  open: boolean
  statusLabels: Record<string, string>
  vocabularies: ReferenceVocabularies | null
  vocabError: string | null
  /** /portal/blocks 那一份：确认映射时的区块下拉与可绑定路径都从它读 */
  blocks: PortalBlockMeta[]
  sites: Array<{ id: number; name: string }>
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'reload-tasks'): void
}>()

const detailLoading = ref(false)
const task = ref<ReferenceSite | null>(null)
const tab = ref('pages')
const pages = ref<ReferencePage[]>([])
const pagesLoading = ref(false)
/** 素材 id → 后端现签的可显示地址；截图列的 <img> 只能用这个，不能拿 id 拼 */
const shotUrls = ref<Record<number, string>>({})
const mappings = ref<ReferenceMapping[]>([])
const mappingsLoading = ref(false)
const unmatchedGroups = ref<UnmatchedGroup[]>([])
const unmatchedLoading = ref(false)
/** 勾选要抓的那几条路由。只在还能开始抓取的任务上有意义，见 ReferencePagesTab 里 selectable 的注释 */
const selectedPageIds = ref<number[]>([])

const crawling = ref(false)
const discovering = ref(false)
const addingRoute = ref(false)
const routeOpen = ref(false)
const routeForm = reactive<{ path: string; pageName: string }>({ path: '', pageName: '' })
const estimating = ref(false)
const analyzing = ref(false)
const applying = ref(false)
const estimate = ref<ReferenceEstimate | null>(null)

const analyzeOpen = ref(false)
const confirmChecked = ref(false)
const applyOpen = ref(false)
const applyForm = reactive<ApplyForm>({
  referencePageId: null,
  siteId: null,
  slug: '',
  title: ''
})

/**
 * 模板包：不随任务自动载入，是这一栏里一个显式的只读快照。
 *
 * <p>为什么不在打开抽屉时顺手拉：一份包里带着每页的槽位形状，抽屉每次轮询都重取一遍毫无意义；
 * 更重要的是「载入模板包」不该给人「它在推进什么」的错觉——它什么都不推进。</p>
 */
const templatePackage = ref<TemplatePackage | null>(null)
const packageLoading = ref(false)

/** refreshDetail 既要能按 id 拉，也要能在轮询里沿用当前 id，所以把 id 单独存一份 */
const currentId = ref(0)

/** 任务在跑时的轮询：5 秒一次，最多跟 4 分钟。到点还没落定就如实说「还在跑」，不猜结果 */
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollLeft = 0

const pageOptions = computed(() =>
  pages.value.map(page => ({
    value: page.id,
    label: page.routePath || page.url || `第 ${page.id} 号页面（截图）`
  }))
)
const siteOptions = computed(() => props.sites.map(site => ({ value: site.id, label: site.name })))

const detailTitle = computed(() => (task.value ? `摄取任务 #${task.value.id}` : '摄取任务'))

const trueGapCount = computed(() => unmatchedTrueGapCountOf(unmatchedGroups.value))

/** 后端只有两个模式常量，且认不出家族时直接不写这一格：所以「没写」要说成没认出，不能说成某一种 */
const packageTabSuffix = computed(() => {
  if (!templatePackage.value) return ''
  return `（${templatePackage.value.crawledCount} 页有版面）`
})

/**
 * 三个动作各自能按的时机，判据全部跟后端同源：
 * requestCrawl 认 pending 与 failed 两个来路（后者是商用 #108：截图服务没起这类失败修好之后该能原地重跑），
 * requestDiscover 只拒绝「正在抓」，addRoute 只要有个本站地址就能补。
 * 界面自己放宽一次，就是让用户点下去才知道被拒。
 */
const canCrawl = computed(
  () => task.value?.mode === 'url' && ['pending', 'failed'].includes(task.value?.status || '')
)
const canDiscover = computed(
  () => task.value?.mode === 'url' && !!task.value?.sourceUrl && task.value?.status !== 'crawling'
)
const canAddRoute = computed(() => task.value?.mode === 'url' && !!task.value?.sourceUrl)

const crawledCount = computed(
  () => pages.value.filter(page => !page.crawlState || page.crawlState === 'ok').length
)

const estimateMessage = computed(() => {
  if (!estimate.value) return ''
  // 「本站剩余配额」这一句 V142 起撤掉：这一族压根不落租户账单，念一个不会被扣的数字等于让人以为在花钱
  const base = `预计 ${estimate.value.estimatedTokens} token，平台承担、不计入该租户额度`
  return estimate.value.notice ? `${base}。${estimate.value.notice}` : base
})

function statusLabel(status: string | null | undefined) {
  if (!status) return '未知'
  return props.statusLabels[status] || status
}

async function openTask(id: number) {
  tab.value = 'pages'
  estimate.value = null
  currentId.value = id
  task.value = null
  pages.value = []
  mappings.value = []
  unmatchedGroups.value = []
  shotUrls.value = {}
  selectedPageIds.value = []
  templatePackage.value = null
  await refreshDetail()
  startPollIfNeeded()
}

async function refreshDetail() {
  if (!currentId.value) return
  detailLoading.value = true
  try {
    task.value = await portalReferenceApi.get(currentId.value)
    await Promise.all([loadPages(), loadMappings()])
  } catch (error) {
    message.error((error as Error).message || '任务加载失败')
  } finally {
    detailLoading.value = false
  }
}

function startPollIfNeeded() {
  stopPoll()
  if (!task.value || !referenceIsRunning(task.value.status)) return
  pollLeft = 48
  let previous = signatureOf(task.value)
  let stalledFor = 0
  pollTimer = setInterval(async () => {
    pollLeft -= 1
    if (pollLeft <= 0) {
      stopPoll()
      message.warning('任务还在后台执行，暂时没有新进展；稍后再点「刷新进度」看看')
      return
    }
    try {
      const latest = await portalReferenceApi.get(currentId.value)
      task.value = latest
      if (!referenceIsRunning(latest.status)) {
        stopPoll()
        await Promise.all([loadPages(), loadMappings()])
        emit('reload-tasks')
        return
      }
      // 截图服务没起时后端会「降级不失败」：状态停在结构归纳中、原因写在 error_message 里，
      // 之后不会再变。连着 6 次（30 秒）一模一样就别继续问了，把用户引去看那条原因。
      if (signatureOf(latest) === previous) {
        stalledFor += 1
        if (stalledFor >= 6) {
          stopPoll()
          message.warning('这段时间任务没有推进。如果它停在「结构归纳中」并带着「截图服务…」这类说明，'
            + '那是它在等你补料或等服务上线，不是还在跑')
        }
      } else {
        previous = signatureOf(latest)
        stalledFor = 0
      }
    } catch (error) {
      stopPoll()
      message.error((error as Error).message || '进度刷新失败')
    }
  }, 5000)
}

/** 判断「有没有进展」看的三个字段：状态、已抓页数、后端写下的原因 */
function signatureOf(task: ReferenceSite) {
  return `${task.status}|${task.pagesCrawled ?? 0}|${task.errorMessage ?? ''}`
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function loadPages() {
  if (!currentId.value) return
  pagesLoading.value = true
  try {
    pages.value = await portalReferenceApi.pages(currentId.value)
    // 清单会重排甚至少几行，勾中一个已经不存在的号会让后端整次抓取被拒（它逐条核对归属）
    selectedPageIds.value = selectedPageIds.value.filter(id => pages.value.some(page => page.id === id))
    loadShotUrls()
  } catch (error) {
    pages.value = []
    message.error((error as Error).message || '页面列表加载失败')
  } finally {
    pagesLoading.value = false
  }
}

/**
 * 把截图素材的公开地址一次性取回来。
 *
 * 这一路失败不清空页面列表：截图显不出来只是少一格预览，结构/映射/生成草稿仍然可操作，
 * 让一个次要的图床查询把整个抽屉变成错误页是不对的。
 */
async function loadShotUrls() {
  if (!pages.value.some(page => page.shotDesktopId || page.shotTabletId || page.shotMobileId)) return
  try {
    const result = await portalReferenceApi.shotMedia()
    const map: Record<number, string> = {}
    for (const item of result?.records || []) {
      if (item && item.id && item.url) map[item.id] = item.url
    }
    shotUrls.value = map
  } catch {
    shotUrls.value = {}
  }
}

async function loadMappings() {
  if (!currentId.value) return
  mappingsLoading.value = true
  unmatchedLoading.value = true
  try {
    mappings.value = await portalReferenceApi.mappings(currentId.value)
  } catch (error) {
    mappings.value = []
    message.error((error as Error).message || '映射列表加载失败')
  } finally {
    mappingsLoading.value = false
  }
  try {
    unmatchedGroups.value = await portalReferenceApi.unmatchedGroups(currentId.value)
  } catch {
    unmatchedGroups.value = []
  } finally {
    unmatchedLoading.value = false
  }
}

async function startCrawl() {
  if (!currentId.value) return
  crawling.value = true
  try {
    // 一条都不勾 = 不带 pageIds = 后端按老行为从首页顺链接抓；勾了 = 只跑勾的那几条
    task.value = await portalReferenceApi.crawl(currentId.value, selectedPageIds.value)
    message.success('抓取已受理，正在后台执行；进度看这里')
    await Promise.all([loadPages(), loadMappings()])
    startPollIfNeeded()
    emit('reload-tasks')
  } catch (error) {
    message.error((error as Error).message || '抓取启动失败')
  } finally {
    crawling.value = false
  }
}

/**
 * 第一步：只列路由。它<b>不改状态</b>，所以按完之后不能靠状态轮询看结果——
 * 唯一诚实的做法是等后端把结论写进「最近一次结果」那一格，然后重读清单。
 *
 * <p>这里复用同一个 {@code pollTimer}：结论落地就是 signature 变了（后端 report 写的就是那一格）。
 * 到点还没变就说「没有新进展」而不是弹一个「发现完成」——后者是假通。</p>
 */
async function runDiscover() {
  if (!currentId.value) return
  discovering.value = true
  try {
    const accepted = await portalReferenceApi.discoverRoutes(currentId.value)
    task.value = accepted
    message.success('路由发现已受理：这一趟不抓页面、不花钱，跑完清单会自己变长')
    // 任务本身还在跑（比如结构归纳中）时不抢那个轮询：那一头的进度更重要，清单靠「刷新进度」看
    if (referenceIsRunning(accepted.status)) startPollIfNeeded()
    else startDiscoverPoll(signatureOf(accepted))
  } catch (error) {
    message.error((error as Error).message || '路由清单启动失败')
  } finally {
    discovering.value = false
  }
}

function startDiscoverPoll(baseline: string) {
  stopPoll()
  pollLeft = 24
  pollTimer = setInterval(async () => {
    pollLeft -= 1
    if (pollLeft <= 0) {
      stopPoll()
      message.warning('路由清单还没有新结果。如果上面「最近一次结果」那一格已经写了原因，那是它在等你决定，不是还在跑')
      return
    }
    try {
      const latest = await portalReferenceApi.get(currentId.value)
      task.value = latest
      if (signatureOf(latest) !== baseline) {
        stopPoll()
        await loadPages()
        emit('reload-tasks')
      }
    } catch (error) {
      stopPoll()
      message.error((error as Error).message || '路由清单刷新失败')
    }
  }, 2500)
}

function openRouteModal() {
  routeForm.path = ''
  routeForm.pageName = ''
  routeOpen.value = true
}

async function submitRoute() {
  if (!currentId.value) return
  const path = routeForm.path.trim()
  if (!path.startsWith('/')) {
    message.warning('路由要写成站内路径，比如 /services')
    return
  }
  addingRoute.value = true
  try {
    const row = await portalReferenceApi.addRoute(currentId.value, {
      path,
      pageName: routeForm.pageName.trim() || null
    })
    routeOpen.value = false
    message.success(`已加进清单：${row.routePath || path}。勾上它再按「开始抓取」才会真的发请求`)
    await loadPages()
  } catch (error) {
    message.error((error as Error).message || '补录失败')
  } finally {
    addingRoute.value = false
  }
}

/** 只读取证快照：失败就显式说失败，别让上一份包的旧数据留在屏幕上被当成新结果 */
async function loadPackage() {
  if (!currentId.value) return
  packageLoading.value = true
  try {
    templatePackage.value = await portalReferenceApi.templatePackage(currentId.value)
  } catch (error) {
    templatePackage.value = null
    message.error((error as Error).message || '模板包载入失败')
  } finally {
    packageLoading.value = false
  }
}

async function runEstimate() {
  if (!currentId.value) return
  estimating.value = true
  try {
    estimate.value = await portalReferenceApi.analyzeEstimate(currentId.value)
  } catch (error) {
    estimate.value = null
    message.error((error as Error).message || '预估失败')
  } finally {
    estimating.value = false
  }
}

function openAnalyzeModal() {
  if (!estimate.value) {
    // 决策 D4 的界面落点：没有预估就不给确认框，别让运营闭着眼睛点掉两次付费调用
    message.warning('请先点「先估算消耗」，看过预估 token 再摄取')
    return
  }
  confirmChecked.value = false
  analyzeOpen.value = true
}

async function runAnalyze() {
  if (!currentId.value || !confirmChecked.value) return
  analyzing.value = true
  try {
    task.value = await portalReferenceApi.analyze(currentId.value, true)
    analyzeOpen.value = false
    message.success('AI 摄取已受理，正在后台跑两步模型')
    startPollIfNeeded()
    emit('reload-tasks')
  } catch (error) {
    message.error((error as Error).message || 'AI 摄取启动失败')
  } finally {
    analyzing.value = false
  }
}

/**
 * 人工确认落完之后由这里重读：那一笔请求在「区块映射」那一栏自己发，
 * 但确认会同时动映射行、任务列表与任务本身，只有这一层同时握着那三份状态。
 */
async function afterVerify() {
  if (!currentId.value) return
  await loadMappings()
  emit('reload-tasks')
  task.value = await portalReferenceApi.get(currentId.value)
}

function openApplyModal() {
  applyForm.referencePageId = pages.value[0]?.id ?? null
  applyForm.siteId = props.sites.length === 1 ? props.sites[0].id : null
  applyForm.slug = ''
  applyForm.title = task.value?.sourceUrl ? `参考 ${task.value.sourceUrl}` : '参考站结构页'
  applyOpen.value = true
}

async function submitApply() {
  if (!currentId.value) return
  applying.value = true
  try {
    const result = await portalReferenceApi.apply(currentId.value, { ...applyForm })
    applyOpen.value = false
    message.success(
      `草稿页已生成：${result.blocks} 个区块进来，${result.skippedUnverified} 条没确认的映射被跳过。` +
        '请到「页面搭建」核对内容后再发布'
    )
    emit('reload-tasks')
    await refreshDetail()
  } catch (error) {
    message.error((error as Error).message || '生成草稿页失败')
  } finally {
    applying.value = false
  }
}

onUnmounted(stopPoll)

/** 暴露名仍叫 open（壳那边是 drawer.value?.open(id)）：内部必须换名，
 *  否则 setup 里那个同名函数会盖掉 open prop，:open 绑上函数＝恒真＝抽屉永远开着 */
defineExpose({ open: openTask })
</script>

<style scoped lang="less">
.reference-site-page {
  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__error {
    color: #cf1322;
    display: inline-block;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }
}
</style>
