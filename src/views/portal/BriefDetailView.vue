<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  briefAllowsProposalRerun,
  briefAnswerRows,
  briefDemoModeText,
  briefIsEditable,
  briefStatusLabel,
  briefStatusLabelOrCode,
  briefGenerationApi,
  EDITABLE_BRIEF_STATUSES,
  ESTIMATE_UNDERESTIMATE_DISCLAIMER,
  siteStatusColor,
  siteStatusText,
  siteBriefsApi,
  vocabularyApi,
  type BriefCandidateProgress,
  type BriefEstimate,
  type BriefEstimateQuote,
  type SiteBrief,
  type SiteBriefVocabulary
} from '@/api/siteBriefs'
import {
  hasChosenDecision,
  siteBriefDeliveryApi,
  type BriefDecisionView,
  type CancelReceipt,
  type PromoteReceipt,
  type RegenerateReceipt
} from '@/api/siteBriefDelivery'
import { siteApi, tenantApi } from '@/api/workspace'
import FoldedText from '@/components/FoldedText.vue'
import { firstSentence } from '@/components/foldedTextModel'
import SectionAdviceCard from './SectionAdviceCard.vue'
import { formatDateTime } from '@/utils/format'
import type { Site } from '@/types'
import type { Tenant } from '@/types/workspace'

/**
 * 需求单详情（Spec-C §3.2「需求单详情 = 后链路的落点」；P3 起「出方案」这条主线也挂在这一页）。
 *
 * 三条口径：
 * 1. **13 题的答案按词表读回**——题目名与选项中文全部经 `GET /admin/site-briefs/vocabulary`
 *    翻成人话（`briefAnswerRows` 是唯一实现点），页面不写题名、不写选项名，也不认「库里存过什么」；
 *    词表取不到就明说「没有答案可读回」，不退回一份本地清单（I-1）。
 * 2. **`requirements_summary` 原话照抄**：那是后端按上面的选择确定性渲染、并且真的喂给模型的那句，
 *    界面一个字都不改、也不另拼一份。
 * 3. **能不能改由后端的状态机说了算**：只有 `EDITABLE_STATUSES`（draft/ready）给编辑入口，
 *    其余状态这里只写一句中文说明为什么不给——摆一个保存必然被拒的表单是骗人填一遍。
 *
 * 「出方案」四步门禁（拍板 9A，§9-1）：预估 →（看过真能花的报价后）亲手勾确认 → 执行 → 按套看进度。
 * estimate/generate/progress 是 §5 定死的 P3 契约口；后端编排器没上线时这一发拿回什么错误，
 * 页面就把那句错误原样挂出来，绝不在本地演算一份假报价。
 * 「③ 客户答复留痕 / ④ 转正交棒 / 重跑收口」是 P4 的三口（`api/siteBriefDelivery`），
 * 只按后端真回的东西渲染：转正按钮只认「留痕里有一条真的选了某一套」，客户没选就没有按钮；
 * 交付地址只认 promote 回执里的 `maintenanceUrl`，回执没拿到时写文案，不摆假链接、不造按钮。
 * Spec-D D5-3 起回执里还带着交棒清单（`handoverNotice` 一句原话 + `handoverItems` 三条落地页）：
 * 链接只用后端给的 `url`，这一页不拼第二份路径。
 */

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadError = ref('')
const brief = ref<SiteBrief | null>(null)

const vocabulary = ref<SiteBriefVocabulary | null>(null)
const vocabularyFailed = ref(false)

const tenants = ref<Tenant[]>([])
const tenantsFailed = ref(false)
const sites = ref<Site[]>([])
const sitesFailed = ref(false)

function errText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error)
}

/**
 * 「这一句是谁说的」要一直看得见（§10.16）：被拒的原话只上屏第一句，剩下的逐字进展开，
 * 但短到只有一句时展开根本不存在，所以前缀拼在这一句上，而不是只写在展开标题里。
 */
function rejectedLine(action: string, raw: string): string {
  return `${action}被后端拒了：${firstSentence(raw) || '后端这一回没给原因'}`
}

function clientNoteText(row: BriefDecisionView): string {
  return (row.clientNote ?? '').trim()
}

function routeBriefId(): number | null {
  const parsed = Number(route.params.id)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const briefId = computed(() => routeBriefId())

const statusText = computed(() =>
  briefStatusLabel(vocabulary.value, brief.value?.status, brief.value?.statusLabel)
)
const editable = computed(() => briefIsEditable(brief.value?.status))

/** 锁单说明里的两个可改状态名也取自词表：这一句除了连接词之外没有一个字是抄的 */
const editableStatusNames = computed(() =>
  EDITABLE_BRIEF_STATUSES.map(code => briefStatusLabelOrCode(vocabulary.value, code)).join('、')
)

const tenantText = computed(() => {
  const id = brief.value?.tenantId
  if (!id) return '未绑定租户'
  const found = tenants.value.find(tenant => tenant.id === id)
  if (found) return found.name || found.code || `租户 #${id}`
  return tenantsFailed.value
    ? `租户 #${id}（租户列表没取到，名字刷新后才有）`
    : `租户 #${id}`
})

const demoModeText = computed(() => briefDemoModeText(vocabulary.value, brief.value?.demoContentMode))

const answerRows = computed(() => (brief.value ? briefAnswerRows(vocabulary.value, brief.value) : []))
const answeredCount = computed(() => answerRows.value.filter(row => row.value).length)

/**
 * 词表还在路上（既没回来也没失败）。
 * 10-16 走查现场：这一页刚进来会闪一屏「共 0 题，其中 0 题有答案」和
 * 「词表回包空了，刷新重试」，1.5 秒后才变成真的 24 题——把「还没取到」说成
 * 「取到的是空的」是谎报，用户照那句去刷新只会更糊涂。
 */
const vocabularyPending = computed(() => vocabulary.value === null && !vocabularyFailed.value)

function siteLabel(site: Site): string {
  return site.name || site.code || `站点 #${site.id ?? '?'}`
}

function tenantNameOf(site: Site): string {
  if (!site.tenantId) return '未绑定租户'
  return tenants.value.find(tenant => tenant.id === site.tenantId)?.name || `租户 #${site.tenantId}`
}

/**
 * 这一单名下的站：候选站靠 V115 的 `build_brief_id` 认亲，转正站靠需求单回填的 `site_id`。
 * 两个来源可能指同一行，按 id 去重；`build_brief_id` 这一列后端还没上时这里就是空的，
 * 页面据此写「没有绑站」，不会把「列还没上」说成「一单没建过站」。
 */
const linkedSites = computed<Site[]>(() => {
  const id = briefId.value
  const current = brief.value
  const out: Site[] = []
  const seen = new Set<number>()
  if (id !== null) {
    sites.value
      .filter(site => site.buildBriefId === id)
      .sort((left, right) => (left.candidateNo ?? 0) - (right.candidateNo ?? 0))
      .forEach(site => {
        if (typeof site.id === 'number' && !seen.has(site.id)) {
          seen.add(site.id)
          out.push(site)
        }
      })
  }
  const promotedId = current?.siteId
  if (typeof promotedId === 'number' && !seen.has(promotedId)) {
    const promoted = sites.value.find(site => site.id === promotedId)
    if (promoted) out.push(promoted)
    else out.push({ id: promotedId, code: '', name: '', domain: '', status: '', tenantId: current?.tenantId ?? undefined } as Site)
  }
  return out
})

/** 转正回填了 site_id，但站点列表里查不到这一行（列表分页没 cover 到 / 站被删）时说的实话 */
const promotedSiteMissing = computed(() => {
  const promotedId = brief.value?.siteId
  if (typeof promotedId !== 'number') return false
  return !sites.value.some(site => site.id === promotedId)
})

const boundSiteText = computed(() => {
  const promotedId = brief.value?.siteId
  if (typeof promotedId !== 'number') return '还没有绑定站点：转正才会回填'
  const found = sites.value.find(site => site.id === promotedId)
  return found ? `${siteLabel(found)}（#${promotedId}）` : `站点 #${promotedId}（站点列表里没这一行）`
})

const sitesUnavailable = computed(() => sitesFailed.value && !sites.value.length)

const columns = [
  { title: '题目', key: 'question', width: 260 },
  { title: '当时勾的 / 填的', key: 'answer' },
  { title: '这一格会被用在哪里', key: 'evidence', width: 280 }
]

const siteColumns = [
  { title: '站点', key: 'site', width: 260 },
  { title: '归属租户', key: 'siteTenant', width: 160 },
  { title: '候选号', key: 'candidateNo', width: 120 },
  { title: '状态', key: 'siteStatus', width: 130 },
  { title: '操作', key: 'siteOp', width: 190 }
]

/** 能改时按钮写「去录入」还是「继续编辑」，看的是后端有没有渲染过摘要——不是前端猜的 */
const intakeLabel = computed(() => (brief.value?.requirementsSummary ? '继续编辑这 13 题' : '去录入这 13 题'))

async function loadVocabulary() {
  vocabularyFailed.value = false
  try {
    vocabulary.value = await vocabularyApi.adminVocabulary()
  } catch (error) {
    vocabulary.value = null
    vocabularyFailed.value = true
    message.error(errText(error))
  }
}

async function loadAux() {
  try {
    tenants.value = (await tenantApi.list()) || []
    tenantsFailed.value = false
  } catch (error) {
    tenantsFailed.value = true
  }
  try {
    sites.value = (await siteApi.list()) || []
    sitesFailed.value = false
  } catch (error) {
    sitesFailed.value = true
  }
}

async function load() {
  const id = routeBriefId()
  if (id === null) {
    loadError.value = '地址里的需求单号不是一个正整数，这一单读不出来'
    brief.value = null
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    brief.value = await siteBriefsApi.get(id)
  } catch (error) {
    brief.value = null
    loadError.value = errText(error)
    message.error(loadError.value)
  } finally {
    loading.value = false
  }
}

function goIntake() {
  const id = briefId.value
  if (id === null) return
  router.push({ name: 'workspace-portal-brief-intake', params: { id: String(id) } })
}

function goList() {
  router.push({ name: 'workspace-portal-briefs' })
}

/** 「从需求单进入」的另一头：站点清单带着本单号过去，只列这一单名下的站 */
function goSites() {
  const id = briefId.value
  if (id === null) return
  router.push({ name: 'workspace-sites', query: { briefId: String(id) } })
}

/** 组装任务是既有的真页面：`?siteId=` 过去它就替这个站把任务列表拉出来（不是新能力） */
function goAssemble(site: Site) {
  if (typeof site.id !== 'number') return
  router.push({ name: 'workspace-portal-assemble-jobs', query: { siteId: String(site.id) } })
}

/** 候选画廊：三套并排比较（骨架 / 侧重原话 / 预览 / 进度 / 截图位的实话）都住在那一页 */
function goGallery() {
  const id = briefId.value
  if (id === null) return
  router.push({ name: 'workspace-portal-brief-candidates', params: { id: String(id) } })
}

/**
 * 建站说明书（Spec-M P0）：这一单「喂给 AI 的那份文档」住在那一页。
 * 来路只有详情页这一颗按钮——它是出方案之前的准备动作，不是一级菜单。
 */
function goSpec() {
  const id = briefId.value
  if (id === null) return
  router.push({ name: 'workspace-portal-brief-spec', params: { brief: String(id) } })
}

// ------------------------------------------------------------------
// 出方案四步门禁（拍板 9A：预估 → 勾选确认 → 执行 → 按套看进度；不自动重试）
// ------------------------------------------------------------------

const estimate = ref<BriefEstimate | null>(null)
const estimating = ref(false)
const confirmChecked = ref(false)
const generating = ref(false)
/** 进度回的是**数组**（每套一条），不是 `{candidates:[…]}`：读错一层就是「永远读不到进度」 */
const progress = ref<BriefCandidateProgress[] | null>(null)
const progressError = ref('')
const loadingProgress = ref(false)
/** 「开始出方案」拿回的中文（成功提示或失败原文）挂在门禁那一格里，不靠 toast 一闪而过 */
const generateNotice = ref('')

const busy = computed(
  () => estimating.value || generating.value
    || rerunEstimating.value || rerunning.value
    || loadingProgress.value
)

/** 那颗价签本体：后端把数字装在 `estimate` 这一层里，外层是「哪一单的哪一次估算 + 凭据」 */
const quote = computed(() => estimate.value?.estimate ?? null)

/**
 * 最近一次后端下发的「这一趟算不算在租户头上」，按需求单 id 存着。
 *
 * 10-16 走查现场：按下「开始出方案」成功后这一格的 `estimate` 会被收回（下一趟要重新出价），
 * 于是上面那句价签变成 null，计费那句话就退回默认档「扣这个租户的配额」——可这一单是售前的，
 * 后端在三十秒前刚说过这一趟由平台承担。钱的方向被界面反过来念，等于给一次没发生的扣费背书。
 */
const bearsCostRead = ref<{ briefId: number; value: boolean } | null>(null)

/** 预估要属于当前这一单才能当确认的依据：换单之后的旧报价不能拿来确认（组装页同一条口径） */
const estimateFresh = computed(
  () => !!estimate.value && !!brief.value && estimate.value.briefId === brief.value.id
    && !!quote.value && !!estimate.value.estimateId
)

/** 门禁只对「还没发出去的单」开放：draft/ready 之外，钱要么在花、要么花完了，轮不到这里再按 */
const gateOpen = computed(() => briefIsEditable(brief.value?.status))

/**
 * 确认框能勾的前提是「手里有一份属于当前单、而且真的能花的报价」：`aiEnabled=false` 时那不是报价。
 *
 * <p>缺口只认这一个开关。<b>不看 `missingSwitches` 是否为空</b>——那份清单里「没有可用图像模型」
 * 这一条在开关全开时也会出现，而拍板 8B 明令配图永远不阻塞一套候选（缺图就记 skipped 只出文字）。
 * 拿它当闸等于把 8B 反着实现一遍：该给勾的时候不给勾。所以缺口在这里只显示、不门禁。</p>
 */
const canConfirm = computed(
  () => gateOpen.value && estimateFresh.value && quote.value?.aiEnabled === true && !busy.value
)

const canEstimate = computed(() => !!brief.value && !busy.value)

const canGenerate = computed(() => canConfirm.value && confirmChecked.value && !busy.value)

/**
 * 一份价签的中文：数字、逐行明细、那句关于偏差的话全部来自后端，界面只拼接不改写。
 *
 * <p>整轮与补跑共用这一支：两趟的价格算给不同的套数，但<b>那份明细的口径只有一份出处</b>
 * （{@code SiteProposalEstimator}）。界面若给补跑另拼一份「大约是多少」，就是第二套算价逻辑。</p>
 */
function priceText(current: BriefEstimateQuote | null): string {
  if (!current) return ''
  const parts = [`预计 ${current.estimatedTokens} token`]
  // 逐行口径（套数/文字/演示内容/配图/合计，以及已交付时的「当月剩余配额」）全来自后端 breakdown：
  // 后端是拼在这一份里下发的，界面上没有第二个数字可拼；售前那一趟后端根本不给剩余额度那一句
  if (current.breakdown?.length) parts.push(...current.breakdown)
  // §9-1 那句原话永远跟在数字旁边，一个字不改：估算闸门偏松是明令缓决的后果，不许藏。
  // 但**只有一份**：后端 estimate.notice 就是那句话的出处（含实测倍数），界面再拼一遍本地常量
  // 就成了两处真相——后端更新了样本、界面还在说旧倍数。所以只在后端没给时兜底。
  parts.push(current.notice || ESTIMATE_UNDERESTIMATE_DISCLAIMER)
  return parts.join('。')
}

const estimateText = computed(() => priceText(quote.value))

/** 补跑那一张价签：同一支拼法，只是后端算的是失败那几套的钱 */
const rerunEstimateText = computed(() => priceText(rerunQuote.value))

/** 开关缺口（缺哪个开关、为什么这次没图）：后端原话逐条列，只说明不门禁（拍板 8B） */
const missingSwitchLines = computed(() => quote.value?.missingSwitches ?? [])

/**
 * 「这一家在这条链上已经烧了多少」那几行（M-P33 拍板 6）：后端原话逐条列 + 那句尺。
 *
 * <p>与 `missingSwitchLines` 同一族纪律——<b>只摆读数，不门禁</b>：这一条链上门禁只有那六道
 * （确认、开关、规格、同租户在飞、凭据、配额），拿「已经烧得多」再拦一道是反着实现一遍拍板。
 * 句子全在后端那一处（`WorkbenchBurnLedger`），界面上不拼第二个数字。</p>
 */
const burnLines = computed(() => {
  const burn = estimate.value?.platformBurn
  if (!burn) return []
  return [...(burn.lines ?? []), ...(burn.tokenBasis ? [burn.tokenBasis] : [])]
})

/** 这一档今天到底能不能出图：false 不是失败，图位会留空并由人补（拍板 8B） */
const imageAvailable = computed(() => quote.value?.imageAvailable !== false)

/**
 * 这一次的钱算不算在该租户头上——只认后端 V142 下发的布尔值，界面不自己判交付态。
 * 价签被收回时（出方案一启动就收）退回这一单最近一次的后端读数；
 * 这一单从来没出过价才按「算他的」说：宁可多警告一句，也不许把在烧钱的趟说成免费。
 */
const tenantBearsCost = computed(() => {
  if (quote.value) return quote.value.tenantBearsCost !== false
  const read = bearsCostRead.value
  if (read && read.briefId === brief.value?.id) return read.value
  return true
})

const generatingNow = computed(() => brief.value?.status === 'generating')

async function loadProgress() {
  const id = briefId.value
  if (id === null) return
  loadingProgress.value = true
  progressError.value = ''
  try {
    const rows = await briefGenerationApi.progress(id)
    progress.value = rows ?? []
  } catch (error) {
    // 后端口没上线/网络不通时把错误原文挂出来：不静默，也不把「没取到」演成「没在跑」
    progress.value = null
    progressError.value = errText(error)
  } finally {
    loadingProgress.value = false
  }
}

async function runEstimate() {
  const current = brief.value
  if (!current || !canEstimate.value) return
  estimating.value = true
  // 出价之前先把旧的确认收回：新价格没看过，勾就不该还留着
  confirmChecked.value = false
  estimate.value = null
  try {
    estimate.value = await briefGenerationApi.estimate(current.id)
    if (estimate.value?.estimate) {
      bearsCostRead.value = { briefId: current.id, value: estimate.value.estimate.tenantBearsCost !== false }
    }
  } catch (error) {
    estimate.value = null
    message.error(errText(error))
  } finally {
    estimating.value = false
  }
}

async function runGenerate() {
  const current = brief.value
  const priced = estimate.value
  const price = quote.value
  // 二次守卫（门禁的第三道）：这一发的语义是「花钱」，没勾确认就连函数层面都不许把它发出去；
  // 凭据缺一样也不发——后端 9A 那道闸会原样拒回来，但把一次注定被拒的调用发出去不是「门禁」。
  if (!current || !confirmChecked.value || !canGenerate.value || !priced || !price) {
    message.warning('没看过预估、或没亲手勾确认，这一发不会发出：花钱的调用不接受默认确认')
    return
  }
  generating.value = true
  generateNotice.value = ''
  try {
    await briefGenerationApi.generate(current.id, true, {
      estimateId: priced.estimateId,
      expectedTokens: price.estimatedTokens
    })
    confirmChecked.value = false
    estimate.value = null
    generateNotice.value = '出方案已启动：候选站是按套各一条子任务的，下面按套显示进度。要重来不会自动发生——失败的那套缺什么，修完再走一遍门禁。'
    message.success('已提交，流水线在跑：这一单进入「生成中」，进度按套看')
    await load()
    await loadProgress()
    await loadAux()
  } catch (error) {
    // 后端那句中文（缺 confirm / 开关没开 / 必填题没答完…）原样显示，不改写、不翻译
    generateNotice.value = errText(error)
    message.error(errText(error))
  } finally {
    generating.value = false
  }
}

// ------------------------------------------------------------------
// M-P34：只补这一轮里失败的那几套（另一张价签、另一道确认，不是「收口重跑」也不是整轮）
// ------------------------------------------------------------------
//
// 这一族与上面整轮那一族<b>并排放着、各自一套状态</b>，理由不是排版：
// - 凭据不通用。后端把「mode=rerunFailed|sets=第几套」盖进了 `estimateId` 的散列，
//   整轮那张价签来补跑会被 9A 拒，反过来也一样——所以这里必须有<b>第二支 estimate</b>，
//   界面上也就必须有第二个勾。共用一个 `confirmChecked` 等于让一次看图替两趟不同的活签字。
// - 价格不是一个数：只数失败的那几套（实测是整轮的 1/N），摆在同一行会让人拿整轮的数点头。
// - 后果不一样：补跑不动成功那几套的站、页面、内容与已发预览链接；整轮重来会把它们重新生成一遍。
// 判据与写口同源（`briefAllowsProposalRerun` 镜像后端那两档 + 进度里真有 failed 的行），
// 所以界面不摆一个必被拒的把手；但真正的闸仍在服务端。

const rerunEstimate = ref<BriefEstimate | null>(null)
const rerunEstimating = ref(false)
const rerunChecked = ref(false)
const rerunning = ref(false)
const rerunNotice = ref('')
/** 受理回执里后端那几句原话（只补哪几套、截图那一格为什么不动）：逐字列，界面不复述 */
const rerunReceiptNotices = ref<string[]>([])

/** 这一轮里真失败的那几套：只认后端 `status`，界面不拿「看着像失败」当判据 */
const failedRows = computed(() => (progress.value ?? []).filter(row => row.status === 'failed'))

const rerunQuote = computed(() => rerunEstimate.value?.estimate ?? null)

/** 补跑的报价也要属于当前这一单：换单之后的旧价签不能拿来确认（与整轮同一条口径） */
const rerunEstimateFresh = computed(
  () => !!rerunEstimate.value && !!brief.value && rerunEstimate.value.briefId === brief.value.id
    && !!rerunQuote.value && !!rerunEstimate.value.estimateId
)

/**
 * 能不能出价：状态在那两档里、这一轮确实有失败的那一套、进度读到了。
 *
 * <p>「进度还没读到」是<b>不知道</b>，不是「没有失败的」：所以这时不给按钮，
 * 但理由要说成「没读到」，不能说成「这一轮没有要补的」。</p>
 */
const canRerunEstimate = computed(
  () => !!brief.value && briefAllowsProposalRerun(brief.value?.status)
    && !!progress.value && failedRows.value.length > 0 && !busy.value
)

const canRerunConfirm = computed(
  () => rerunEstimateFresh.value && rerunQuote.value?.aiEnabled === true && !busy.value
    && failedRows.value.length > 0
)

const canRerun = computed(() => canRerunConfirm.value && rerunChecked.value && !busy.value)

/** 这一发会重生成第几套：编号只从进度行里取，界面不猜也不写「第 2 套」这种硬编码 */
const rerunTargetLine = computed(() => {
  const nos = failedRows.value.map(row => row.candidateNo).filter(no => typeof no === 'number')
  return nos.length ? nos.map(no => `第 ${no} 套`).join('、') : '这一轮失败的那几套'
})

/** 按钮灭着的时候说一句人话：到底是哪一格不满足，只从这三份读数里判，不编第四种说法 */
const rerunBlockedLine = computed(() => {
  if (!brief.value) return ''
  if (!briefAllowsProposalRerun(brief.value.status)) {
    return `这一单现在是「${statusText.value}」，补跑只在「待出方案」与「等客户确认」两档开放：`
      + '客户已经选定或已经转正交付的单子再补一套候选，会跟交付凭证打架。要整单重来走下面的「收口重跑」。'
  }
  if (!progress.value) {
    return '进度还没读到，所以「这一轮有没有失败的那一套」界面不知道（这不是「没有」）：先点上面的「刷新进度」。'
  }
  if (!failedRows.value.length) {
    return '这一轮的进度里没有失败的那一套：这里不给按钮。对哪一套都不满意要重新出，'
      + '走下面的「收口重跑」再跑整轮，那会再烧一趟整轮的钱。'
  }
  if (!rerunEstimateFresh.value) {
    return '还没看过补跑这一趟的价格：先按「只补失败的那几套：先估算」。那是一份零模型调用的报价，不花钱。'
  }
  if (!rerunChecked.value) {
    return '确认框还没勾上：这一发会真的调模型，看过价格并亲手勾了才轮得到点执行。'
  }
  return ''
})

async function runRerunEstimate() {
  const current = brief.value
  if (!current || !canRerunEstimate.value) return
  rerunEstimating.value = true
  rerunChecked.value = false
  rerunEstimate.value = null
  try {
    rerunEstimate.value = await briefGenerationApi.rerunEstimate(current.id)
    // 钱的方向也从这一份读数落一份：整轮那张没出过时，补跑这张是这一屏唯一一份后端计费读数。
    // 不记就等于让「会消耗租户配额 / 由平台承担」那句话退回默认档——那是界面在猜钱的方向。
    if (rerunEstimate.value?.estimate) {
      bearsCostRead.value = {
        briefId: current.id,
        value: rerunEstimate.value.estimate.tenantBearsCost !== false
      }
    }
  } catch (error) {
    rerunEstimate.value = null
    rerunNotice.value = errText(error)
    message.error(errText(error))
  } finally {
    rerunEstimating.value = false
  }
}

async function runRerunFailed() {
  const current = brief.value
  const priced = rerunEstimate.value
  const price = rerunQuote.value
  // 与整轮同一道二次守卫：没勾确认或凭据不全就连函数层面都不发——把一次注定被拒的调用发出去不是「门禁」
  if (!current || !rerunChecked.value || !canRerun.value || !priced || !price) {
    message.warning('没看过补跑的预估、或没亲手勾确认，这一发不会发出：花钱的调用不接受默认确认')
    return
  }
  rerunning.value = true
  rerunNotice.value = ''
  try {
    const receipt = await briefGenerationApi.rerunFailed(current.id, true, {
      estimateId: priced.estimateId,
      expectedTokens: price.estimatedTokens
    })
    rerunChecked.value = false
    rerunEstimate.value = null
    rerunNotice.value = '补跑已受理：' + rerunTargetLine.value
      + '重新从「建候选站」那一步开始跑。成功的那几套一个字不动，客户手里的预览链接照旧能用。'
      + (receipt?.notices?.length ? '（后端那几句原话在下面逐字列着）' : '')
    rerunReceiptNotices.value = receipt?.notices ?? []
    message.success('已提交，流水线在跑：这一单进入「生成中」，进度按套看')
    await load()
    await loadProgress()
    await loadAux()
  } catch (error) {
    rerunNotice.value = errText(error)
    message.error(errText(error))
  } finally {
    rerunning.value = false
  }
}

// ------------------------------------------------------------------

//
// 这一段的纪律只有一条：**界面上不声称响应没说过的状态**。
// - 转正按钮的判据是 `GET /admin/site-briefs/{id}/decisions` 真回了一条 `chosenSiteId` 非空的留痕，
//   不是「看着像等客户确认」；客户只提意见没选（后端明列的合法形状）时这里就是没有按钮。
// - 交付地址只从 promote 回执的 `maintenanceUrl` 来；这一页没拿到回执，就写「没有地址可显示」，
//   不拼一条看起来对的（§3.2 骂旧工作台「交棒是一句提示语不是一个真链接」，反方向同样是错）。
// - regenerate 只收口（归档 + 撤令牌 + 回到待出方案），后端明说它一分钱不花；花钱的出方案仍在②。

const decisions = ref<BriefDecisionView[]>([])
const decisionsError = ref('')
const loadingDecisions = ref(false)
const promoting = ref(false)
const promoteReceipt = ref<PromoteReceipt | null>(null)
const promoteError = ref('')
const regenerating = ref(false)
const regenerateReceipt = ref<RegenerateReceipt | null>(null)
const regenerateError = ref('')

/** 留痕里有没有「客户真的选了某一套」：这是转正按钮唯一的判据 */
const hasClientChoice = computed(() => hasChosenDecision(decisions.value))

/** 已经交付的单不再显示「转正」：后端对它是幂等回执，但按钮挂在那儿会让人以为还要再点一次 */
const alreadyPromoted = computed(() => brief.value?.status === 'promoted')

const canPromote = computed(
  () => !!brief.value && hasClientChoice.value && !alreadyPromoted.value && !promoting.value && !regenerating.value
)

/** 重跑收口只对「已经有候选要收」的单开放：草稿/待出方案没东西可收，已交付/已作废后端整条拒 */
const REGENERATABLE_STATUSES = ['generating', 'awaiting_client', 'decided'] as const

const canRegenerate = computed(() => {
  const status = brief.value?.status
  return !!status
    && (REGENERATABLE_STATUSES as readonly string[]).includes(status)
    && !promoting.value
    && !regenerating.value
})

async function loadDecisions() {
  const id = briefId.value
  if (id === null) return
  loadingDecisions.value = true
  decisionsError.value = ''
  try {
    decisions.value = (await siteBriefDeliveryApi.decisions(id)) || []
  } catch (error) {
    // 读不到留痕不等于没有留痕：错误原文挂着，转正按钮照旧不出现（宁可少给一个入口）
    decisions.value = []
    decisionsError.value = errText(error)
  } finally {
    loadingDecisions.value = false
  }
}

async function runPromote() {
  const current = brief.value
  if (!current || !canPromote.value) return
  promoting.value = true
  promoteError.value = ''
  try {
    // 不带 siteId：后端默认取「本单最近一条客户选定了的答复」，替客户定是另一件事，这一页不替他定
    promoteReceipt.value = await siteBriefDeliveryApi.promote(current.id)
    message.success('已转正：选中的那套转正式站，其余候选归档并撤销预览令牌')
    await load()
    await loadDecisions()
    await loadAux()
  } catch (error) {
    // 后端的中文拒绝（租户对不上、不是本单候选、没有选定留痕…）原样挂在格子里
    promoteReceipt.value = null
    promoteError.value = errText(error)
    message.error(promoteError.value)
  } finally {
    promoting.value = false
  }
}

async function runRegenerate() {
  const current = brief.value
  if (!current || !canRegenerate.value) return
  regenerating.value = true
  regenerateError.value = ''
  try {
    regenerateReceipt.value = await siteBriefDeliveryApi.regenerate(current.id)
    // 拍板 3A：旧候选从此作废——客户手里的旧链接立刻打不开
    promoteReceipt.value = null
    message.success('已收口：旧候选转「已归档」并撤销全部预览令牌，需求单回到待出方案')
    await load()
    await loadDecisions()
    await loadAux()
  } catch (error) {
    regenerateReceipt.value = null
    regenerateError.value = errText(error)
    message.error(regenerateError.value)
  } finally {
    regenerating.value = false
  }
}

// ---- 作废（2026-10-21 流程评审拍板②：「客户不做了」要有日常收尾口） ----
const cancelling = ref(false)
const cancelModalOpen = ref(false)
const cancelReason = ref('')
const cancelReceipt = ref<CancelReceipt | null>(null)
const cancelError = ref('')

/** 除「已转正（交付凭证）」与「已作废（幂等）」之外都能作废——含 generating：与在跑流水的并发由后端条件写兜底 */
const CANCELLABLE_STATUSES = ['draft', 'ready', 'generating', 'awaiting_client', 'decided'] as const

const canCancel = computed(() => {
  const status = brief.value?.status
  return !!status && (CANCELLABLE_STATUSES as readonly string[]).includes(status)
})

async function runCancel() {
  const current = brief.value
  const reason = cancelReason.value.trim()
  if (!current || !reason) {
    message.warning('作废必须写明原因，界面上这一句不会空着提交')
    return
  }
  cancelling.value = true
  cancelError.value = ''
  try {
    cancelReceipt.value = await siteBriefDeliveryApi.cancel(current.id, reason)
    cancelModalOpen.value = false
    cancelReason.value = ''
    message.success('已作废：候选全部转「已归档」（不删），预览令牌全部撤销，旧链接当场失效')
    await load()
    await loadDecisions()
    await loadAux()
  } catch (error) {
    cancelReceipt.value = null
    cancelError.value = errText(error)
    message.error(cancelError.value)
  } finally {
    cancelling.value = false
  }
}

// 生成中每 8 秒拉一次进度；任一步失败只影响该套，所以这里只刷新、绝不替它「重试推进」
let pollTimer: ReturnType<typeof setInterval> | null = null

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function syncPolling() {
  stopPolling()
  if (generatingNow.value) {
    pollTimer = setInterval(() => {
      void loadProgress()
      void load()
    }, 8000)
  }
}

onMounted(async () => {
  await Promise.all([load(), loadAux()])
  await loadVocabulary()
  if (brief.value && (brief.value.status === 'generating' || linkedSites.value.length)) await loadProgress()
  // 留痕只在「单子已经发到客户手上或更往后」才有东西可读：draft/ready 阶段不发这一发
  if (brief.value && !briefIsEditable(brief.value.status)) await loadDecisions()
  syncPolling()
})

watch(brief, () => syncPolling())

onUnmounted(stopPolling)
</script>

<template>
  <div class="brief-detail">
    <div class="page-header brief-detail__head">
      <div>
        <h3>需求单 #{{ briefId ?? '?' }}</h3>
        <p class="brief-detail__sub">
          这一页是一条交付单现在走到哪一步的落点：前采答了什么、后端喂给模型的是哪句话、名下列出了哪些站。
        </p>
      </div>
      <div class="brief-detail__head-actions">
        <a-space wrap>
          <a-tag>{{ statusText }}</a-tag>
          <a-button @click="goList">返回列表</a-button>
          <!-- 后端状态机允许改才给编辑入口：不许摆一张填完保存必然被拒的表单（那等于骗人填一遍） -->
          <a-button v-if="editable" type="primary" @click="goIntake">{{ intakeLabel }}</a-button>
        </a-space>
        <p v-if="brief && !editable" class="brief-detail__locked">
          这一单现在是「{{ statusText }}」，已经不在可编辑状态里（后端只收 {{ editableStatusNames }} 两种状态的修改），
          所以上面没有编辑按钮：把 13 题改一遍保存会被整单拒掉，这里不摆那种入口。要看答了什么就在下面两格里看。
        </p>
      </div>
    </div>

    <a-alert v-if="loadError" type="error" show-icon class="brief-detail__alert">
      <template #message>
        需求单没读到：{{ loadError }}
        <a-button size="small" type="link" @click="load">重试</a-button>
      </template>
    </a-alert>

    <a-alert v-if="vocabularyFailed" type="error" show-icon class="brief-detail__alert">
      <template #message>
        前采词表没取到：下面「13 题答了什么」那一格读不出来——题目名与选项中文只有一份，在后端的词表里，
        这一页不抄第二份本地清单来凑。
        <a-button size="small" type="link" @click="loadVocabulary">重新取词表</a-button>
      </template>
    </a-alert>

    <template v-if="brief">
      <a-card size="small" title="这一单的抬头三件事" class="brief-detail__panel">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="租户">{{ tenantText }}</a-descriptions-item>
          <a-descriptions-item label="状态">{{ statusText }}</a-descriptions-item>
          <a-descriptions-item label="候选套数">{{ brief.candidateCount ?? '-' }}</a-descriptions-item>
          <a-descriptions-item label="演示内容档位">{{ demoModeText }}</a-descriptions-item>
          <a-descriptions-item label="绑定站点">{{ boundSiteText }}</a-descriptions-item>
          <a-descriptions-item label="创建人">{{ brief.createdBy || '-' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatDateTime(brief.createdAt) }}</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatDateTime(brief.updatedAt) }}</a-descriptions-item>
          <!-- 只有已作废的单才摆这一行：别的状态那列是 null，摆出来等于把「草稿」说成「有人写过为什么不做了」 -->
          <a-descriptions-item v-if="brief.status === 'cancelled'" label="作废原因" :span="2">
            {{ brief.cancelReason
              || '这张单作废时还没有存原因的位置（那一列是 2026-10-21 之后加的），当时的原因只在服务端日志里' }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <a-card size="small" class="brief-detail__panel">
        <template #title>AI 将理解的这段话（后端渲染、落库留痕的那一份）</template>
        <div v-if="brief.requirementsSummary" class="brief-detail__summary">
          <!-- 这一格以前是整段 1871 字的墙：默认只念它的第一句，剩下的逐字进展开；
               字数那一行说的是库里这一份，展开在不在都成立（短到只有一句时不该谎称「全文在展开里」） -->
          <FoldedText :raw="brief.requirementsSummary" raw-label="喂给模型的那句原话（逐字）" />
          <p class="brief-detail__muted">
            这一句由后端按 13 题的选择渲染，并真的喂给模型；库里这一份共 {{ brief.requirementsSummary.length }} 字，界面一个字都没改。
          </p>
        </div>
        <p v-else class="brief-detail__muted">
          库里还没有这段话：它由后端按 13 题的选择确定性渲染，必填题没答完时后端不会渲染摘要。
        </p>
        <p class="brief-detail__muted">
          模型拿到的就是上面这一句原话——界面不改写、不另拼一份（这一页也没有第二段话可拼）。
          要换这段话只能改上面的选择再保存，由后端重新渲染。
        </p>
      </a-card>

      <a-card size="small" class="brief-detail__panel">
        <template #title>前采 13 题答了什么（按词表读回）</template>
        <p v-if="vocabularyFailed" class="brief-detail__muted">词表没取到，这一格现在是空的：上面那条「重新取词表」修好它就回来了。</p>
        <template v-else>
          <p v-if="vocabularyPending" class="brief-detail__muted">词表正在取，取回来才知道这 13 题答了什么。</p>
          <p v-else class="brief-detail__muted">
            共 {{ answerRows.length }} 题，其中 {{ answeredCount }} 题有答案。空着的那一格就是当时没勾/没填，不是这里没显示出来。
          </p>
          <a-table
            :data-source="answerRows"
            :columns="columns"
            :loading="loading"
            :pagination="false"
            row-key="key"
            size="small"
            bordered
            :scroll="{ x: 900 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'question'">
                <div>{{ record.label }}</div>
                <div v-if="record.required" class="brief-detail__muted">必填题</div>
              </template>
              <template v-else-if="column.key === 'answer'">
                <span v-if="record.value" class="brief-detail__answer">
                  {{ record.value }}<span v-if="record.unknown" class="brief-detail__unknown">（词表里已经没有这个码了）</span>
                </span>
                <span v-else class="brief-detail__muted">没答</span>
              </template>
              <template v-else-if="column.key === 'evidence'">
                <span class="brief-detail__muted">{{ record.evidence || '后端没说明这一格会被用在哪里' }}</span>
              </template>
            </template>
            <template #emptyText>
              <a-empty
                :description="vocabularyPending
                  ? '词表还在路上，这一格还没填上——稍等一下它就回来了'
                  : '词表里一道题都没有：那不是「这单没答题」，是词表回包空了，刷新重试'"
              />
            </template>
          </a-table>
        </template>
      </a-card>

      <!-- Spec-D D4：栏目建议挂在这里——它是按这张需求单读出来的，超管看完建议再决定要不要动栏目。
           写库仍然只有卡上那一条「保存到站点」，模型只出主意（拍板 N2）。 -->
      <SectionAdviceCard class="brief-detail__panel" mode="save" :brief-id="brief.id"
                         :site-id="brief.siteId ?? null" />

      <a-card size="small" class="brief-detail__panel">
        <template #title>② 出方案：预估 → 勾选确认 → 执行（花钱的门禁，一步都不合并）</template>
        <p class="brief-detail__muted">
          出方案会按套建候选站并真的调模型，{{ tenantBearsCost
            ? '扣这个租户的 token 配额'
            : '这一次由平台承担、不进该租户的账单（超管确定交付之后才开始计他的额度）' }}；
          这一格先把价报给你看，
          看过、而且后端明确这一路开着，才轮得到勾确认；没勾，执行按钮就是灭的——一次点击都不该在没人看过价格的情况下发生。
        </p>
        <p v-if="brief && !gateOpen" class="brief-detail__locked">
          这一单现在是「{{ statusText }}」，出方案的门禁只对 {{ editableStatusNames }} 两种状态开放：
          钱要么已经在花、要么已经花完，轮不到在这里再按一次。
        </p>
        <a-space wrap class="brief-detail__actions">
          <a-button @click="goSpec">建站说明书（喂 AI 的那七段）</a-button>
          <a-button :disabled="!canEstimate" :loading="estimating" @click="runEstimate">先估算消耗（不调模型）</a-button>
          <a-checkbox v-model:checked="confirmChecked" :disabled="!canConfirm">
            我已看过这次预估，确认出方案{{ tenantBearsCost ? '会消耗租户配额' : '的这次消耗由平台承担' }}
          </a-checkbox>
          <a-button type="primary" :disabled="!canGenerate" :loading="generating" @click="runGenerate">
            开始出方案（建 {{ brief?.candidateCount ?? '?' }} 套候选）
          </a-button>
          <a-button @click="goGallery">候选画廊：并排比较每一套</a-button>
          <a-button :loading="loadingProgress" @click="loadProgress">刷新进度</a-button>
        </a-space>
        <p v-if="!estimate && gateOpen" class="brief-detail__muted">
          还没有预估，确认框与「开始出方案」都是灭的：这是门禁，不是忘了做。
        </p>
        <p v-else-if="quote && !quote.aiEnabled" class="brief-detail__locked">
          后端回了「这一路没开」：开关没开时那份预估不是可以花的报价，点下去只会拿回一条中文错误、模型一次都不调，
          所以确认框在这里给不了勾。
        </p>
        <p v-else-if="confirmChecked" class="brief-detail__locked">
          确认框已经勾上：再点「开始出方案」就会真的调用模型{{
            tenantBearsCost ? '并扣配额' : '（这一趟由平台承担，不进该租户的账单）' }}。要收手先把勾去掉。
        </p>
        <a-alert v-if="estimate" type="info" show-icon class="brief-detail__alert" :message="estimateText" />
        <!-- 已经烧掉的那一本账（M-P33 拍板 6）：与上面那句「这一趟要花多少」并排摆着，只读数不设闸 -->
        <ul v-if="burnLines.length" class="brief-detail__progress-list">
          <li v-for="line in burnLines" :key="line" class="brief-detail__muted">{{ line }}</li>
        </ul>
        <p v-else-if="estimate" class="brief-detail__muted">
          这一家在这条链上已经烧掉多少，后端这一发没回读数（不是「0」，是这一格我没读到）。
        </p>
        <!-- 缺口只说明、不门禁：配图缺了照样出一套纯文字候选（拍板 8B），拿它当闸就是反着实现一遍 -->
        <ul v-if="missingSwitchLines.length" class="brief-detail__progress-list">
          <li v-for="line in missingSwitchLines" :key="line" class="brief-detail__locked">{{ line }}</li>
        </ul>
        <p v-else-if="quote && imageAvailable" class="brief-detail__muted">
          这一档没有开关缺口：出方案与配图两条路都认得出可用的模型。
        </p>
        <p v-if="generateNotice" class="brief-detail__muted">{{ generateNotice }}</p>

        <template v-if="progressError">
          <a-alert type="error" show-icon class="brief-detail__alert">
            <template #message>
              进度没读到（后端口还没上线时就是这一句原文，不是「没在跑」）：{{ progressError }}
            </template>
          </a-alert>
        </template>
        <template v-else-if="progress">
          <!-- 候选是按套各一条子任务的：进度按套列，不给一个假装同步的总百分比（§6.2） -->
          <div class="brief-detail__progress">
            <p class="brief-detail__muted">
              进度按套显示（每套一条子任务，任一步失败只影响该套）；这里刻意没有总百分比。
            </p>
            <div v-if="!progress.length" class="brief-detail__muted">
              后端回了空清单：这一单还没有候选子任务（刚提交还没排上，或还没出过方案）。
            </div>
            <ul v-else class="brief-detail__progress-list">
              <li v-for="row in progress" :key="`${row.candidateNo ?? 'x'}-${row.siteId ?? 'nosite'}`">
                <b>{{ row.candidateNo == null ? '未编号的一套' : `第 ${row.candidateNo} 套` }}</b>
                <a-tag>{{ row.statusLabel || row.status }}</a-tag>
                <span class="brief-detail__muted">
                  阶段：{{ row.stageLabel || row.stage || '还没进入阶段' }}
                  <template v-if="row.siteId"> · 站点 #{{ row.siteId }}</template>
                  <template v-if="row.estimatedTokens != null"> · 本套预计 {{ row.estimatedTokens }} token</template>
                </span>
                <FoldedText
                  v-if="row.errorMessage"
                  :raw="row.errorMessage"
                  :summary="`这一套的失败原因：${firstSentence(row.errorMessage)}`"
                  raw-label="失败原因（后端原话逐字）"
                  tone="error"
                />
                <FoldedText
                  v-if="row.notices?.length"
                  :raw="row.notices?.join('\n')"
                  :summary="`这一套有 ${row.notices.length} 条降级说明要对你说的话`"
                  raw-label="这一套的降级说明（后端原话逐字）"
                />
              </li>
            </ul>
          </div>
        </template>

        <!-- M-P34：只补失败那一套。与上面的整轮那一族并排、各自一套确认，因为后端给的是两张不同的价签 -->
        <div class="brief-detail__progress">
          <p class="brief-detail__line"><b>只补这一轮里失败的那几套（成功的那几套一个字不动）</b></p>
          <p class="brief-detail__muted">
            这一发不是「收口重跑」，也不是整轮重来：{{ rerunTargetLine }}
            重新从「建候选站」那一步跑，而交付了的那几套的站、页面、内容与<b>已经发出去的预览链接原样保留</b>
            （客户手里的链接不会因为这一趟失效）。价格另算一张——它只数这一趟真会跑的那几套，
            所以整轮那张价签在这里<b>不能</b>用，反之亦然。
          </p>
          <a-space wrap class="brief-detail__actions">
            <a-button :disabled="!canRerunEstimate" :loading="rerunEstimating" @click="runRerunEstimate">
              只补失败的那几套：先估算（不调模型）
            </a-button>
            <a-checkbox v-model:checked="rerunChecked" :disabled="!canRerunConfirm">
              我已看过补跑这一趟的预估，确认只重跑失败的那几套{{
                tenantBearsCost ? '会消耗租户配额' : '的这次消耗由平台承担' }}
            </a-checkbox>
            <a-button type="primary" danger :disabled="!canRerun" :loading="rerunning" @click="runRerunFailed">
              只补失败的那几套：开始跑（{{ rerunTargetLine }}）
            </a-button>
          </a-space>
          <p v-if="rerunBlockedLine" class="brief-detail__muted">{{ rerunBlockedLine }}</p>
          <a-alert v-if="rerunEstimate" type="info" show-icon class="brief-detail__alert"
                   :message="`这张价签只算补跑这一趟：${rerunEstimateText}`" />
          <ul v-if="rerunReceiptNotices.length" class="brief-detail__progress-list">
            <li v-for="line in rerunReceiptNotices" :key="line" class="brief-detail__muted">{{ line }}</li>
          </ul>
          <p v-if="rerunNotice" class="brief-detail__muted">{{ rerunNotice }}</p>
        </div>
      </a-card>

      <a-card size="small" class="brief-detail__panel">
        <template #title>③ 客户答复留痕 → ④ 转正交棒（重跑收口在同一格）</template>

        <a-alert v-if="decisionsError" type="error" show-icon class="brief-detail__alert">
          <template #message>
            客户答复留痕没读到（{{ decisionsError }}）：读不到就当没有——下面这一格不摆转正按钮，
            免得点出一个后端拒的错误。刷新重试才有。
            <a-button size="small" type="link" @click="loadDecisions">重新读留痕</a-button>
          </template>
        </a-alert>

        <template v-else-if="decisions.length">
          <ul class="brief-detail__progress-list">
            <li v-for="row in decisions" :key="row.id">
              <b>
                <template v-if="row.chosenSiteId == null">只提了意见，没选哪一套</template>
                <template v-else>选定第 {{ row.candidateNo ?? '?' }} 套 · {{ row.chosenSiteName || '站点名没随回执下来' }}（站点 #{{ row.chosenSiteId }}）</template>
              </b>
              <span class="brief-detail__muted">
                · 来源会话 {{ row.sessionId == null ? '（超管代录，没有链接）' : `#${row.sessionId}` }} · {{ formatDateTime(row.createdAt) }}
              </span>
              <!-- 客户原话默认只念第一句，长答复的其余部分逐字进展开（§10.16）；
                   「是谁说的话」写在句首，展开不存在时这句 attribution 也不丢 -->
              <FoldedText
                v-if="clientNoteText(row)"
                :raw="clientNoteText(row)"
                :summary="`客户在这条答复里的原话：${firstSentence(clientNoteText(row))}`"
                raw-label="客户原话（逐字）"
                class="brief-detail__answer"
              />
            </li>
          </ul>
        </template>
        <p v-else class="brief-detail__muted">
          后端回的是空清单：这一单还没有客户答复（选择页一次都没交过，或答复被服务端的静默失败口径丢掉了）。
        </p>

        <a-space wrap class="brief-detail__actions">
          <!-- 判据是「留痕里真有一条选定了的」，不是状态看着像：客户只提意见时这里就该没有按钮 -->
          <a-popconfirm
            v-if="canPromote"
            title="转正会把选中的那套转成正式站、其余候选转「已归档」并撤销全部预览令牌，客户手里的旧链接当场作废。确认？"
            ok-text="转正交棒"
            cancel-text="先不"
            @confirm="runPromote"
          >
            <a-button type="primary" :loading="promoting">转正交棒（按最近一条客户选定的答复）</a-button>
          </a-popconfirm>
          <a-popconfirm
            v-if="canRegenerate"
            title="重跑收口会把本单候选全部转「已归档」（不删）并撤销全部预览令牌，需求单回到待出方案。这一步不调模型、不花钱。确认？"
            ok-text="收口重跑"
            cancel-text="先不"
            @confirm="runRegenerate"
          >
            <a-button :loading="regenerating">收口重跑（旧候选作废，不花钱）</a-button>
          </a-popconfirm>
          <a-button v-if="canCancel" danger :disabled="promoting || regenerating" @click="cancelModalOpen = true">
            作废这张单（客户不做了）
          </a-button>
          <a-modal
            v-model:open="cancelModalOpen"
            title="作废这张需求单"
            ok-text="确认作废（候选归档、不删除）"
            cancel-text="先不"
            :confirm-loading="cancelling"
            @ok="runCancel"
          >
            <p class="brief-detail__muted">
              口径与「收口重跑」一致：候选全部转「已归档」（只超管可查，一行不删）、客户手里的预览链接全部作废，
              区别是这张单落「已作废」——之后不能再改、不能再出方案、不能重跑。要重来请开一张新需求单。
            </p>
            <a-textarea
              v-model:value="cancelReason"
              :maxlength="500"
              :rows="3"
              placeholder="原因（必填，存进这张单，之后在详情页「作废原因」那一行能查回来）：例如「客户线下说不做了」「试单放弃」"
            />
            <FoldedText
              v-if="cancelError"
              :raw="cancelError"
              :summary="rejectedLine('作废', cancelError)"
              raw-label="后端拒绝原文（逐字）"
            />
          </a-modal>
          <a-button :loading="loadingDecisions" @click="loadDecisions">刷新留痕</a-button>
        </a-space>

        <p v-if="!canPromote && !canRegenerate" class="brief-detail__muted">
          这一格今天没有转正与收口重跑那两颗动作可点：转正要等客户答复留痕里有一条真的选了某一套；
          收口重跑要等这一单确实已经出过方案（还在草稿/待出方案的单子上没有候选要收，
          已交付与已作废那两态后端会整条拒）。这里不摆「点了只会拿回一句拒绝」的按钮。
        </p>
        <!-- 被拒那一句要说清是哪一步被拒（§10.16）：原话第一句上屏，长错误体逐字进展开 -->
        <FoldedText
          v-if="promoteError"
          :raw="promoteError"
          :summary="rejectedLine('转正', promoteError)"
          raw-label="转正被拒的原话（逐字）"
          tone="error"
        />
        <FoldedText
          v-if="regenerateError"
          :raw="regenerateError"
          :summary="rejectedLine('收口重跑', regenerateError)"
          raw-label="收口重跑被拒的原话（逐字）"
          tone="error"
        />

        <!-- 交付回执：只渲染 promote 响应里真有的那几格（§6.3 R-1 到这一刻才兑现） -->
        <template v-if="promoteReceipt">
          <a-alert type="success" show-icon class="brief-detail__alert">
            <template #message>
              已交付：{{ promoteReceipt.siteName }}（站点 #{{ promoteReceipt.siteId }}）· 需求单状态
              {{ promoteReceipt.briefStatusLabel || promoteReceipt.briefStatus }}
              · 租户 {{ promoteReceipt.tenantName || '（回执里没带租户名）' }}
            </template>
          </a-alert>
          <p class="brief-detail__line">
            <b>租户维护地址（可复制，⑤ 交棒就是这一条真链接）：</b>
            <span class="brief-detail__summary-inline">{{ promoteReceipt.maintenanceUrl }}</span>
          </p>
          <p v-if="promoteReceipt.maintenanceUrlRelative" class="brief-detail__locked">
            这条是站内相对路径：后端说管理后台根地址（app.portal.delivery.admin-base-url）没配。
            发给租户前请自己补上域名——这一页不猜域名，猜错一次就是把租户领到别人的后台。
          </p>
          <p class="brief-detail__muted">{{ promoteReceipt.archivedNotice }}</p>
          <p class="brief-detail__muted">
            归档的候选：{{ promoteReceipt.archivedSiteIds.length ? promoteReceipt.archivedSiteIds.join('、') : '没有' }}
            · 撤销预览令牌 {{ promoteReceipt.revokedTokenCount }} 条
          </p>
          <!-- D5-3 交棒清单：那句原话与三条链接都只用后端回执里给的内容（I-1——路径的真相在后端
               那一份，这边绝不拼第二份）。`urlRelative` 时如实写明这是相对路径、要拼上后台域名才能
               发给租户：这一页不猜域名，和上面维护地址那条同一口径。回执里没有这两格就不摆这一节，
               不演「清单已备好」。 -->
          <p v-if="promoteReceipt.handoverNotice" class="brief-detail__line">
            <b>交棒清单（后端原话）：</b>{{ promoteReceipt.handoverNotice }}
          </p>
          <ul v-if="promoteReceipt.handoverItems?.length" class="brief-detail__handover">
            <li v-for="item in promoteReceipt.handoverItems" :key="item.key">
              <b>{{ item.label }}</b>：
              <a class="brief-detail__handover-url" :href="item.url" target="_blank" rel="noopener">{{ item.url }}</a>
              <span v-if="item.urlRelative" class="brief-detail__locked">
                （这是相对路径：后端没配管理后台根地址，发给租户前要自己拼上后台域名——这里不猜）
              </span>
              <p v-if="item.notice" class="brief-detail__muted">{{ item.notice }}</p>
            </li>
          </ul>
        </template>
        <p v-else-if="alreadyPromoted" class="brief-detail__muted">
          这一单已是「{{ statusText }}」。交付回执（含租户维护地址那一条真链接）只在转正那一步的响应里给过，
          页面重新读需求单读不到它（§5 的 GET 口没有那个字段）——所以这里没有地址可显示，
          也不摆一条我拼出来的假链接：要重取请按后端说的用幂等口再点一次转正（第二次只回同一张回执、一行都不动）。
        </p>
        <p v-if="regenerateReceipt" class="brief-detail__muted">{{ regenerateReceipt.nextStepNotice }}</p>
        <p v-if="cancelReceipt" class="brief-detail__muted">{{ cancelReceipt.notice }}</p>
      </a-card>

      <a-card size="small" class="brief-detail__panel">
        <template #title>这一单名下的站点</template>
        <template v-if="linkedSites.length">
          <p class="brief-detail__muted">
            候选与转正的站都在这儿；「第几套」是建它时记的候选号，归档的也照样列出来（客户否掉了什么是要留证的）。
          </p>
          <p v-if="sitesUnavailable" class="brief-detail__muted">
            站点列表这次没取到：下面这一格只能按需求单自己回填的那个站号显示，候选清单要刷新重试才有。
          </p>
          <a-table
            :data-source="linkedSites"
            :columns="siteColumns"
            :pagination="false"
            row-key="id"
            size="small"
            bordered
            :scroll="{ x: 860 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'site'">
                <div>{{ siteLabel(record) }}</div>
                <div class="brief-detail__muted">#{{ record.id ?? '-' }} · {{ record.domain || '没有域名' }}</div>
              </template>
              <template v-else-if="column.key === 'siteTenant'">{{ tenantNameOf(record) }}</template>
              <template v-else-if="column.key === 'candidateNo'">
                {{ record.candidateNo == null ? '没记候选号' : `第 ${record.candidateNo} 套` }}
              </template>
              <template v-else-if="column.key === 'siteStatus'">
                <a-tag :color="siteStatusColor(record.status)">{{ siteStatusText(record.status) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'siteOp'">
                <a-button size="small" type="link" @click="goAssemble(record)">这一站的组装任务</a-button>
              </template>
            </template>
          </a-table>
          <a-space wrap class="brief-detail__actions">
            <a-button @click="goSites">到站点清单只看这一单的站</a-button>
          </a-space>
          <p v-if="promotedSiteMissing" class="brief-detail__muted">
            上面有一行是需求单回填的转正站号，但站点列表里查不到它：可能是列表没取全，也可能这个站已经不在了。
          </p>
        </template>
        <p v-else class="brief-detail__muted">
          这一单名下现在没有站点。候选站是「出方案」执行后由生成链路建出来并把 `build_brief_id` 回填到站上的；
          上面②那一格走完门禁才会发生。若刚提交过，先点「刷新进度」看排上了没有。
          <template v-if="sitesUnavailable">（另外：站点列表这次没取到，即使有绑站也显示不出来，请刷新重试。）</template>
        </p>
      </a-card>
    </template>

    <a-card v-else-if="!loadError" size="small" class="brief-detail__panel">
      <p class="brief-detail__muted">正在读这一单…</p>
    </a-card>
  </div>
</template>

<style scoped>
.brief-detail .page-header {
  margin-bottom: 16px;
}
.brief-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.brief-detail__head h3 {
  margin: 0 0 4px;
}
.brief-detail__head-actions {
  text-align: right;
  max-width: 460px;
}
.brief-detail__sub,
.brief-detail__muted {
  color: #6b7280;
  font-size: 13px;
}
.brief-detail__locked {
  margin: 8px 0 0;
  color: #d46b08;
  font-size: 12px;
}
.brief-detail__alert {
  margin-bottom: 16px;
}
.brief-detail__panel {
  margin-bottom: 16px;
}
.brief-detail__summary {
  margin: 0 0 8px;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 6px;
}
.brief-detail__line {
  margin: 6px 0;
  word-break: break-word;
}
/* D5-3 交棒清单：三条各一行，链接用等宽并允许断行——它是给人在后台地址栏里粘的，不许被裁掉 */
.brief-detail__handover {
  margin: 4px 0 8px;
  padding-left: 20px;
  word-break: break-word;
}
.brief-detail__handover li {
  margin-bottom: 6px;
}
.brief-detail__handover-url {
  font-family: monospace;
  word-break: break-all;
}
.brief-detail__summary-inline {
  padding: 2px 6px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 4px;
  font-family: monospace;
  overflow-wrap: anywhere;
}
.brief-detail__answer {
  word-break: break-word;
}
.brief-detail__unknown {
  color: #d46b08;
  font-size: 12px;
}
.brief-detail__actions {
  margin-top: 12px;
}
.brief-detail__progress {
  margin-top: 12px;
}
.brief-detail__progress-list {
  margin: 4px 0 0;
  padding-left: 20px;
}
.brief-detail__progress-list li {
  margin-bottom: 6px;
  line-height: 1.7;
}
</style>
