<script setup lang="ts">
/**
 * 新建网站向导（Spec-M §3 那五步 / §7.1，D3：入口仍只给超管）。
 *
 * 这一页回答的是他那句「我不知道怎么给用户建一个新网站，没找到入口」：
 * 左侧「建站」组的第一项就是这里，五步一条线，**一步只说一件事、一件事只摆今天真存在的那一个动作**。
 *
 * 三条纪律写死在这里：
 * 1. **它不是第二个流水线**。估价、出初稿、签字、发预览、选定转正这些动作一个都不在这一页重做——
 *    它们各自有闸（估价的凭据两样、签字的空段点名、生成的配额与确认闸），复制一份就等于再造一份会漂移的真相。
 *    这一页读的是那些页面读的同几个只读口，然后把人送去按那一个按钮。
 * 2. **每一步「完成了没有」只由后端读数判**（说明书的 status、候选行的 siteId、预览令牌发没发过、
 *    需求单名下的站点），界面不许给任何一格手动打勾，也不许把「读失败」念成「还没有」。
 * 3. **读数搬进来，动作留在那一页**（他 2026-10-11 拍板「按你推荐的来，但问题要一个一个地过」）：
 *    以前第 2~5 步只有一句状态加一颗「去那一页」的按钮，等于把人来回赶；现在每一屏把那一屏该看的
 *    后端读数摊开（说明书七段、价签与逐套进度、候选现状、客户留痕），要看原文就点开，
 *    要按那一个花钱/签字的动作仍然去专用页——专用页留着「回向导」的入口，两边都不成为第二套真相。
 *
 * 取数时机分两层（`loadRailReadings` / `loadStepExtras`）：驱动顶上那条步序条的三件事一直读，
 * 多出来的逐套进度与客户留痕等人走到那一步再读——进页面不把五步的读数一次发完。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  briefStatusLabel,
  briefGenerationApi,
  siteBriefsApi,
  vocabularyApi,
  type BriefCandidateProgress,
  type BriefCandidateSite,
  type BriefEstimate,
  type SiteBrief,
  type SiteBriefVocabulary
} from '@/api/siteBriefs'
import {
  hasChosenDecision,
  siteBriefDeliveryApi,
  type BriefDecisionView
} from '@/api/siteBriefDelivery'
import { previewLinkStateColor, previewLinkStateHint, previewLinkStateOf, previewLinkStateText, showcaseBatchLineOf } from '@/api/siteBriefs'
import { siteSpecApi, type SpecDocumentView } from '@/api/siteSpec'
import BriefIntakeForm from '@/views/portal/BriefIntakeForm.vue'
import FoldedText from '@/components/FoldedText.vue'
import WizardSteps from '@/components/WizardSteps.vue'
import { createWizardState, type WizardState, type WizardStepDef } from '@/components/wizardModel'
import { createProposalProgressFollower } from '@/utils/proposalProgressFollow'

const route = useRoute()
const router = useRouter()

const STEP_KEYS = ['intake', 'spec', 'generate', 'candidates', 'deliver'] as const

const briefs = ref<SiteBrief[]>([])
const briefsError = ref('')
const vocabulary = ref<SiteBriefVocabulary | null>(null)
const briefId = ref<number | null>(readBriefIdFromQuery())

const spec = ref<SpecDocumentView | null>(null)
const specError = ref('')
const candidates = ref<BriefCandidateSite[]>([])
const candidatesError = ref('')
/**
 * 逐套进度的两条腿（推送 + 兜底轮询）在 `utils/proposalProgressFollow` 那一份里，
 * 这里只是把它接上：读数出口仍然只有 `progress` 那一条 GET，流里推的是同一份数组。
 * `onSettled` 挂的是顶上那条步序条——一整轮进终态后不重读，人看见的是一条不动的步序条。
 */
const progressFollow = createProposalProgressFollower({
  briefId: () => briefId.value,
  onSettled: () => loadRailReadings()
})
const progress = progressFollow.rows
const progressError = progressFollow.error
const progressSourceLine = progressFollow.sourceLine
/** 价签不是自动刷出来的：那一发是 POST，只有人在这屏点「先算一次价」才发（它零模型调用，但仍是请求） */
const quote = ref<BriefEstimate | null>(null)
const quoteError = ref('')
const quoteLoading = ref(false)
const decisions = ref<BriefDecisionView[]>([])
const decisionsError = ref('')

const wizard = ref<WizardState>(createWizardStateWithStep(readStepKeyFromQuery()))

function readBriefIdFromQuery(): number | null {
  const raw = route.query.briefId
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function readStepKeyFromQuery(): string | undefined {
  const raw = route.query.step
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && STEP_KEYS.includes(value as (typeof STEP_KEYS)[number]) ? value : undefined
}

/**
 * 「租户管理 > 去录前采」那一行带过来的租户号。
 *
 * 它决定两件事：第一步摊开的是**一张空单**（不自动打开列表里那张老单，链接的来意就是「给这家新录一单」），
 * 以及空单上那个租户已预填。选了已有需求单时它不动——表单那一刻读的是那一单自己的租户，
 * 这个号只在回到空白单时生效，正是「给同一家再录一单」想要的那个预填。
 */
const intakeTenantId = ref<number | null>(readTenantIdFromQuery())

function readTenantIdFromQuery(): number | null {
  const raw = route.query.tenantId
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** 步号写进地址：刷新、收藏夹、从别的页面退回来都还在原来那一步（Spec-F §9.2-4 那条持久化口径） */
function createWizardStateWithStep(stepKey?: string): WizardState {
  const index = stepKey ? STEP_KEYS.indexOf(stepKey as (typeof STEP_KEYS)[number]) : 0
  return { current: index < 0 ? 0 : index, maxReached: index < 0 ? 0 : index }
}

const currentBrief = computed(() => briefs.value.find(brief => brief.id === briefId.value) || null)

const auth = useAuthStore()

/**
 * 右上角声明的那一家与这一单挂名的那一家不是同一户时给出的读数（两家都没得比时回 null）。
 *
 * <p>为什么向导要管这件事：后端只有需求单详情、发预览、转正那几发按右上角拦归属
 * （`TenantGuard.checkOwnership` ⇒「无权限操作该需求单」），说明书与估价那几口是按这一单自己的租户解析的。
 * 于是「站在 180 走 326 的单」前四屏一切正常，向导自己的那颗交接口按下去却 403（10-16 走查现场）。
 * 界面不许把这一堵墙藏起来，也不许让人到了那一页才知道。</p>
 */
const scopeMismatch = computed(() => {
  if (!auth.isSuperAdmin) return null
  // 挂名那一家有两个出处：需求单列表那一行，和这一单自己的说明书读数。
  // 站在别家时列表里根本没有这一行（后端列表按右上角那一户筛），只认第一个就查不出这件事。
  const owner = currentBrief.value?.tenantId ?? spec.value?.tenantId ?? null
  if (owner === null || owner === undefined) return null
  const declared = auth.selectedTenantId
  if (declared === null || declared === owner) return null
  return { declared, owner }
})

/** 去那些按右上角拦归属的页面之前，先把声明的那一家对齐到这一单挂名的那一家 */
function alignScopeToBrief() {
  if (!scopeMismatch.value) return
  auth.switchTenant(scopeMismatch.value.owner, null)
}

/** 地址里带了 briefId、但列表还没读到（或那一单被筛掉了）：这一格要能说出单号，不许念成「没选单」 */
const briefLabel = computed(() => {
  if (!briefId.value) return ''
  const found = currentBrief.value
  return found ? `#${found.id} ${found.brandName || found.industry || '（没填品牌名）'}` : `#${briefId.value}`
})

function briefOption(brief: SiteBrief) {
  return {
    value: brief.id,
    label: `#${brief.id} ${brief.brandName || brief.industry || '（没填品牌名）'} · ${tenantLabel(brief)}`
  }
}

function tenantLabel(brief: SiteBrief): string {
  return brief.tenantId ? `租户 #${brief.tenantId}` : '未绑定租户'
}

/** 说明书七段里还空着几段：只数后端 `blank` 那一格，界面不猜段数也不抄段名 */
const blankSections = computed(() => (spec.value?.sections || []).filter(section => section.blank).length)
const filledSections = computed(() => (spec.value?.sections || []).length - blankSections.value)

const deliveredCandidates = computed(() => candidates.value.filter(candidate => candidate.siteId !== null))
const previewIssuedCount = computed(() => candidates.value.filter(candidate => candidate.previewIssued).length)
const needsHumanCount = computed(() => deliveredCandidates.value.filter(candidate => candidate.needsHuman).length)
const failedProgress = computed(() => progress.value.filter(row => row.status === 'failed' || !!row.errorMessage))

/** 进度行按第几套对齐到候选行上：两套读数各说各的，界面上要让人看见同一套的两面 */
function progressOf(candidate: BriefCandidateSite): BriefCandidateProgress | null {
  const byId = progress.value.find(row => row.candidateId === candidate.candidateId)
  if (byId) return byId
  const byNo = progress.value.find(row => row.candidateNo === candidate.candidateNo)
  return byNo ?? null
}

/**
 * 这一套的账：三本账拼成一句人话，直接摆在屏上。
 * 取不到读数的项念「没取到」，不许念成 0——0 是「一张都没出」，没取到是「这一格我没读到」，
 * 两者在「这一轮的实测代价要加进哪一头」这条判据上是两件事（M-P34 起这一轮真失败的那几套
 * 可以单独补跑，见 {@link roundActualLine} 下面那一句两条路的说法）。
 */
function setLedger(candidate: BriefCandidateSite): string {
  const row = progressOf(candidate)
  return [
    `演示内容 文章 ${row?.demoArticles ?? '没取到'} 篇 / 案例 ${row?.demoCases ?? '没取到'} 条 / 岗位 ${row?.demoJobs ?? '没取到'} 个`,
    `配图 成功 ${row?.imageDone ?? '没取到'} 张、失败 ${row?.imageFailed ?? 0} 张、跳过 ${row?.imageSkipped ?? 0} 张（跳过不等于失败）`,
    `实耗 ${row?.promptTokens ?? '没取到'} + ${row?.completionTokens ?? '没取到'} token`
  ].join('；')
}

/**
 * 这一轮的<b>实测</b>代价（网关实报那一把尺，逐套相加）。
 *
 * <p>它只为下面那句「重跑是整轮」服务：说「会再烧一趟」而不摆这一趟的数，等于让人凭感觉点头。</p>
 *
 * <p>没回实耗的套数单独念、<b>不并进合计</b>：把「这一套的账我还没读到」加成 0 就是把总数说小，
 * 而这一轮还在跑时每一套都可能暂时没有数（那是常态，不是缺陷）。
 * 尺的口径跟着候选行那两列走（{@code prompt_tokens}/{@code completion_tokens} 是模型实报），
 * 与价签那把字数尺是两把尺，不许互相套用。</p>
 */
const roundActualTokens = computed(() => {
  // 以「这一轮真有几套」为分母：进度接口少回一行，那一套就是「没回实耗」，而不是从合计里悄悄消失
  const rows = candidates.value.length
    ? candidates.value.map(candidate => progressOf(candidate))
    : progress.value.map(row => row as BriefCandidateProgress | null)
  let prompt = 0
  let completion = 0
  let unread = 0
  rows.forEach(row => {
    const p = typeof row?.promptTokens === 'number' ? row.promptTokens : null
    const c = typeof row?.completionTokens === 'number' ? row.completionTokens : null
    if (p === null || c === null) unread += 1
    prompt += p ?? 0
    completion += c ?? 0
  })
  return { sets: rows.length, prompt, completion, total: prompt + completion, unread }
})

const roundActualLine = computed(() => {
  const round = roundActualTokens.value
  if (!round.sets) return '这一轮还没有进度行，所以也没有实测代价可读（不是 0）。'
  return `这一轮实测：${round.prompt} + ${round.completion} = ${round.total} token（模型实报那一把尺，逐套相加）`
    + (round.unread ? `；另有 ${round.unread} 套这一发没回实耗，没算进上面那个数——不是当成 0` : '')
    + '。'
})

/** 下一趟会重生成几套：只认价签那一格，读不到就明说读不到（不拿进度行数冒充这一单的套数配置） */
const roundSetsLine = computed(() => {
  const sets = quote.value?.estimate?.candidateCount
  return sets ? `${sets} 套全部` : '这一单的几套（后端这一发没回套数）'
})

/** 这一套有没有单独要说的话：待人工、失败记录、后端那几条原话，任一样都算 */
function hasSetWords(candidate: BriefCandidateSite): boolean {
  const row = progressOf(candidate)
  return !!candidate.needsHuman || !!row?.errorMessage || !!(row?.notices?.length ?? 0) || !!(candidate.notices?.length ?? 0)
}

/** 原话逐字：失败原因在前，因为那一句要标红 */
function setRawWords(candidate: BriefCandidateSite): string | null {
  const row = progressOf(candidate)
  return [
    row?.errorMessage,
    ...(row?.notices ?? []),
    ...(candidate.notices ?? [])
  ].filter(Boolean).join('\n') || null
}

/**
 * 五步的状态全部从读数推出来：wait/process/finish/error 不是人点的，是那一格的后端事实。
 * 判据挑的是最保守的那一个：例如「出方案」这一步要**建出了站**才算走完，
 * 只看候选行数会把「一行失败记录」也念成完成。
 */
const stepDefs = computed<WizardStepDef[]>(() => [
  {
    key: 'intake',
    title: '需求单',
    status: briefId.value ? 'finish' : 'process'
  },
  {
    key: 'spec',
    title: '建站说明书',
    status: !briefId.value ? 'wait'
      : specError.value ? 'error'
      : spec.value?.status === 'CONFIRMED' ? 'finish'
      : spec.value?.exists ? 'process'
      : 'wait'
  },
  {
    key: 'generate',
    title: '估价与出方案',
    status: !briefId.value ? 'wait'
      : candidatesError.value ? 'error'
      : deliveredCandidates.value.length ? 'finish'
      : candidates.value.length ? 'process'
      : 'wait'
  },
  {
    key: 'candidates',
    title: '候选站比较',
    status: !deliveredCandidates.value.length ? 'wait'
      : previewIssuedCount.value ? 'finish'
      : 'process'
  },
  {
    key: 'deliver',
    title: '选定并转正',
    status: currentBrief.value?.siteId ? 'finish' : deliveredCandidates.value.length ? 'process' : 'wait'
  }
])

/** 每一步还差什么，说人话。这里没有任何一句是「界面替后端判的」，全部对着上面那些读数 */
const stepNotice = computed<Record<string, string>>(() => ({
  intake: briefId.value ? `正在做这一单：${briefLabel.value}` : '还没有选定需求单：先挑一张已有的，或录一份新的。',
  spec: !briefId.value ? '要先有需求单。'
    : specError.value ? `说明书没读到：${specError.value}`
    : !spec.value?.exists ? '这一单还没有说明书（AI 出初稿与逐段修改都在那一页）。'
    // 异步那一发在跑时，下面这几段还是<em>原来那一版</em>：这一句不说，向导就把「等模型」演成「文档就这样」
    : spec.value.draftStatus === 'RUNNING'
      ? `${spec.value.draftStatusLabel}：下面这几段还是原来那一版，跑成之前别按字面当成初稿在读；`
        + '进度、以往实测多久，都在说明书那一页读（这一页不另开第二张嘴）。'
      : spec.value.status === 'CONFIRMED'
        ? `已确认的第 ${spec.value.specVersion} 版，${spec.value.sections.length} 段全文就是生成的输入。`
        : `第 ${spec.value.specVersion} 版草稿：${spec.value.sections.length} 段里写了 ${filledSections.value} 段${blankSections.value ? `、空着 ${blankSections.value} 段` : '，一段都没空着'}。签字才能放行生成。`,
  generate: !briefId.value ? '要先有需求单。'
    : candidatesError.value ? `候选站没读到：${candidatesError.value}`
    : !candidates.value.length ? '这一单还没有候选站：先算一次价，再带凭据去按「开始出方案」。'
    : `候选 ${candidates.value.length} 套，建出站 ${deliveredCandidates.value.length} 套${failedProgress.value.length ? `，其中 ${failedProgress.value.length} 套有失败记录` : ''}。`,
  candidates: !deliveredCandidates.value.length ? '还没有可比较的候选站。'
    : `已发放预览地址 ${previewIssuedCount.value} / ${deliveredCandidates.value.length} 套`
      + (needsHumanCount.value ? `，其中 ${needsHumanCount.value} 套带「待人工」措辞` : '') + '。',
  deliver: currentBrief.value?.siteId ? `这一单已绑定站点 #${currentBrief.value.siteId}。`
    : hasChosenDecision(decisions.value) ? '客户已经选定了某一套，转正那一发还等人按。'
    : '客户还没选定（或还没转正）：选定动作在候选画廊与需求单详情里。'
}))

/** 下一步能不能走：只拦「连需求单都还没有」这一种，其余一律放行——步序不是权限，拦人没意义 */
function beforeNext(to: number) {
  const key = STEP_KEYS[to]
  if (key !== 'intake' && !briefId.value) return '先回到第一步选一份需求单（或录一份新的）。'
  return true
}

function onWizardStateChange(value: WizardState) {
  wizard.value = value
  syncQuery(value.current, briefId.value)
  loadRailReadings()
  loadStepExtras(value.current)
}

function selectBrief(value: unknown) {
  const parsed = Number(Array.isArray(value) ? value[0] : value)
  briefId.value = Number.isFinite(parsed) && parsed > 0 ? parsed : null
  syncQuery(wizard.value.current, briefId.value)
}

function syncQuery(stepIndex: number, id: number | null) {
  const query: Record<string, string> = { step: STEP_KEYS[stepIndex] ?? STEP_KEYS[0] }
  if (id) query.briefId = String(id)
  router.replace({ query })
}

async function loadBriefs() {
  try {
    const result: any = await siteBriefsApi.list()
    briefs.value = Array.isArray(result) ? result : (result?.records || [])
    briefsError.value = ''
    if (!briefId.value && !intakeTenantId.value && briefs.value.length) {
      briefId.value = briefs.value[0].id
      syncQuery(wizard.value.current, briefId.value)
    }
  } catch (error) {
    briefs.value = []
    briefsError.value = error instanceof Error ? error.message : String(error)
  }
}

async function loadSpec() {
  spec.value = null
  specError.value = ''
  if (!briefId.value) return
  try {
    spec.value = await siteSpecApi.read(briefId.value)
  } catch (error) {
    specError.value = error instanceof Error ? error.message : String(error)
  }
}

async function loadCandidates() {
  candidates.value = []
  candidatesError.value = ''
  if (!briefId.value) return
  try {
    candidates.value = (await briefGenerationApi.candidates(briefId.value)) || []
  } catch (error) {
    candidatesError.value = error instanceof Error ? error.message : String(error)
  }
}

/**
 * 这一趟的等待机在 `utils/proposalProgressFollow` 那一份（与候选画廊共用），这里只把它的名字接上：
 * 读数出口仍然只有 `progress` 那一条 GET，流里推的是同一份数组，界面上那一行「进度是怎么来的」
 * 跟着真在用的那一条腿换——不许写着「推送」而其实在轮询。
 */
const loadProgress = progressFollow.load
const stopFollowingProgress = progressFollow.stop
const waitLineOf = progressFollow.waitLineOf

async function loadDecisions() {
  decisions.value = []
  decisionsError.value = ''
  if (!briefId.value) return
  try {
    decisions.value = (await siteBriefDeliveryApi.decisions(briefId.value)) || []
  } catch (error) {
    decisionsError.value = error instanceof Error ? error.message : String(error)
  }
}

/**
 * 读数分两层，两层都是纯 GET：
 * 1. `loadRailReadings` 读**顶上一条步序条**要的三件事（说明书状态、候选行有没有建站、预览发没发过）——
 *    这一组必须一直读，否则第 2 步明明已签字、条上却画成「没开始」，那是界面在说谎；
 * 2. `loadStepExtras` 只读**当前这一步**的多出来的那几发（逐套进度、客户留痕），
 *    人不走到那一步就不用替他把五发都发出去。
 *
 * 价签那一发不在任何一层里：它是 POST，只认人在这屏点那一颗。
 */
async function loadRailReadings() {
  loadSpec()
  loadCandidates()
}

function loadStepExtras(stepIndex: number) {
  const key = STEP_KEYS[stepIndex]
  if (key === 'generate' || key === 'candidates') {
    loadProgress()
    return
  }
  // 人不在等这一趟的那两步：那条流与那只表都不留着跑，「读一次」与「一直听」的界限跟着屏幕走
  stopFollowingProgress()
  if (key === 'deliver') loadDecisions()
}

/** 在这一屏算一次价：零模型调用、零落库，但它是那一发花钱的凭据来源，所以仍然只由人点 */
async function loadQuote() {
  if (!briefId.value) return
  quoteLoading.value = true
  quoteError.value = ''
  try {
    quote.value = await briefGenerationApi.estimate(briefId.value)
  } catch (error) {
    quote.value = null
    quoteError.value = error instanceof Error ? error.message : String(error)
  } finally {
    quoteLoading.value = false
  }
}

const quoteSummary = computed(() => {
  const price = quote.value?.estimate
  if (!price) return ''
  if (!price.aiEnabled) return '出方案开关没开，现在不是可以花的报价：缺的开关在下面那一栏里逐条写着。'
  return `要是现在出方案：${price.candidateCount} 套、每套 ${price.pagesPerCandidate} 页，预估 ${price.estimatedTokens} token。这只是预估，不是最终账单。`
})

/** 钱算在谁头上（V142 交付态）：这一句决定界面对客户怎么说，口径跟着后端那一格走 */
const quoteBearer = computed(() => {
  const price = quote.value?.estimate
  if (!price) return ''
  return price.tenantBearsCost
    ? '这一单的交付已经确定：这一发算在这个租户的当月配额里。'
    : '这一单还没确定交付：这一发由平台自己承担，不扣这个租户的配额。'
})

/** 价签下面那几行明细：后端逐行拼好的原话，界面上只折起来，不重写 */
const quoteBreakdown = computed(() => (quote.value?.estimate?.breakdown ?? []).join('\n'))

/**
 * 「这一家在这条链上已经烧了多少」的第一行（M-P33 拍板 6）。
 *
 * <p>后端没回这一份读数时念「没回读数」，<b>不念成 0</b>：0 说的是「一次都没跑过」，
 * 那一档后端自己会拼出中文行（`WorkbenchBurnLedger`），前端替它编就等于把两件事说成一件。
 * 句子全部来自后端，前端只做取第一行这一件事——它同时也是一个闸：
 * 后端哪天把「次数」那行挪了位置，这里会当场露出原话而不是悄悄少摆一档。</p>
 */
const burnHeadline = computed(() => {
  if (!quote.value) return ''
  const burn = quote.value.platformBurn
  if (!burn) return '这一家已经烧掉多少，后端这一发没回读数（不是「0」，是这一格我没读到）。'
  return burn.lines?.[0] || '后端回了读数，但第一行是空的：这句按原样摆着，前端不替它编。'
})

/** 除第一行以外的那几行（钱、口径、那两条「不含」），折起来给愿意看的人 */
const burnRest = computed(() => (quote.value?.platformBurn?.lines ?? []).slice(1).join('\n'))

function statusText(brief: SiteBrief): string {
  return briefStatusLabel(vocabulary.value, brief.status)
}

/**
 * 第 4 步「状态」那一格的中文：读的是逐套进度那一行带回的 `stageLabel`。
 *
 * <p>候选行（`CandidateSite`）现在自带 `stageLabel`/`statusLabel`（后端 10-16 补上，出处仍是
 * `ProposalStages` 那份词表，第 3 步进度行用的也是同一份）——这是首选取值。
 * 但旧版后端还没升级时这一格会是 undefined，这时候才退回借进度那一行（`progress` 是另一个端点，
 * 不保证跟候选列表同时可用），都取不到才露原码：宁可露码，也不在前端抄第二份阶段词表（I-1）。</p>
 */
function candidateStageText(row: BriefCandidateSite): string {
  if (row.stageLabel || row.statusLabel) return row.stageLabel || row.statusLabel || '状态未知'
  const progressRow = progress.value.find(item => item.candidateId === row.candidateId)
  return progressRow?.stageLabel || progressRow?.stage || row.stage || row.status || '状态未知'
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false })
}

/** 「录一份新的」：把第一步那张空表单摊开就地录，不再跳去独立页（独立页还在，只是不再是必经之路） */
function startNewBrief() {
  briefId.value = null
  syncQuery(wizard.value.current, null)
}

/** 表单真存下一单之后向导才认这个号：后面四步读的都是它，列表里先补上这一行免得下拉里查无此单 */
function onIntakeSaved(saved: SiteBrief) {
  if (!saved?.id) return
  if (!briefs.value.some(brief => brief.id === saved.id)) briefs.value = [saved, ...briefs.value]
  briefId.value = saved.id
  syncQuery(wizard.value.current, saved.id)
}

function goBriefDetail() {
  if (!briefId.value) return
  alignScopeToBrief()
  router.push({ name: 'workspace-portal-brief-detail', params: { id: String(briefId.value) } })
}

function goSpec() {
  if (!briefId.value) return
  alignScopeToBrief()
  router.push({ name: 'workspace-portal-brief-spec', params: { brief: String(briefId.value) } })
}

function goCandidates() {
  if (!briefId.value) return
  alignScopeToBrief()
  router.push({ name: 'workspace-portal-brief-candidates', params: { id: String(briefId.value) } })
}

function goSites() {
  router.push({ name: 'workspace-sites', query: briefId.value ? { briefId: String(briefId.value) } : {} })
}

watch(briefId, () => {
  quote.value = null
  quoteError.value = ''
  decisions.value = []
  progress.value = []
  stopFollowingProgress()
  loadRailReadings()
  loadStepExtras(wizard.value.current)
})

onMounted(async () => {
  try {
    vocabulary.value = await vocabularyApi.adminVocabulary()
  } catch {
    // 词表只影响状态那一格中文：取不到就露原码，不让它把整页拖成报错
    vocabulary.value = null
  }
  await loadBriefs()
  loadRailReadings()
  loadStepExtras(wizard.value.current)
})

// 人走了那条流与那只表都得关掉：留着就是一边占着后端那条 SSE 工作线程，一边对着已经不看的页面空转
onUnmounted(stopFollowingProgress)
</script>

<template>
  <div class="site-wizard">
    <div class="page-header">
      <div>
        <h3>新建网站</h3>
        <p>
          五步一条线：录前采需求单 → AI 出说明书、超管逐段改并签字 → 估价并出 1~3 套候选 → 比较与发预览 → 客户选定后转正。
          每一步只摊开这一步自己的读数；花钱、签字那两发动作在那一屏自己的页面上按。
        </p>
      </div>
    </div>

    <a-alert v-if="scopeMismatch" type="warning" show-icon class="site-wizard__row">
      <template #message>
        这一单挂在租户 #{{ scopeMismatch.owner }} 名下，右上角现在站的是 #{{ scopeMismatch.declared }}。
        需求单详情、发预览与转正那几发按右上角那一户拦归属，照现在这样点过去会被后端当面拒
        （原话「无权限操作该需求单」）。下面这几屏读的是按这一单自己的租户解析的那几口，照旧能读。
      </template>
      <template #description>
        <a-button size="small" @click="alignScopeToBrief">
          把右上角切到 #{{ scopeMismatch.owner }}（切完这一条就消失，不影响已经录下的东西）
        </a-button>
      </template>
    </a-alert>

    <WizardSteps
      :steps="stepDefs"
      :model-value="wizard"
      :before-next="beforeNext"
      @update:model-value="onWizardStateChange"
    >
      <template #step-intake>
        <a-alert v-if="briefsError" type="error" show-icon>
          <template #message>需求单列表没取到：{{ briefsError }}（不是「一单都没有」，是这一发失败了）</template>
        </a-alert>
        <a-form layout="inline" class="site-wizard__row">
          <a-form-item label="选一张需求单">
            <a-select
              :value="briefId"
              :options="briefs.map(briefOption)"
              :placeholder="briefsError ? '列表读取失败' : (briefs.length ? '选一份已有的需求单' : '一份需求单都还没有')"
              style="width: 360px"
              @update:value="selectBrief"
            />
          </a-form-item>
          <a-form-item>
            <span class="site-wizard__hint">
              {{ currentBrief ? `状态：${statusText(currentBrief)}；这一单要出几套：${currentBrief.candidateCount ?? '-'}（意图，不是已经建出来的套数）` : stepNotice.intake }}
            </span>
          </a-form-item>
        </a-form>
        <a-space class="site-wizard__row">
          <a-button @click="startNewBrief">录一份新需求单</a-button>
          <a-button :disabled="!briefId" @click="goBriefDetail">看这一单的详情（喂模型的那句话在这里）</a-button>
        </a-space>
        <p v-if="!briefsError && !briefs.length" class="site-wizard__hint">
          一份需求单都还没有：第一步就是录它（题目与分段都来自后端前采词表），后面四步都要靠它这一个号。
        </p>
        <!-- 前采本体就地录：这一份和独立页 `BriefIntakeView` 用的是同一个组件，不存在第二套提交形状。
             地址带过来的租户号交给它预填（「租户管理 > 去录前采」那条链接的落点）。 -->
        <BriefIntakeForm :brief-id="briefId" :tenant-id="intakeTenantId ?? undefined" embedded @saved="onIntakeSaved" />
      </template>

      <template #step-spec>
        <a-alert v-if="specError" type="error" show-icon>
          <template #message>{{ stepNotice.spec }}</template>
        </a-alert>
        <p v-else class="site-wizard__reading">{{ stepNotice.spec }}</p>

        <!-- 七段清单：段名、顺序、上限全部来自后端回包，界面不抄第二份；原文折进展开 -->
        <div v-if="spec && spec.exists" class="site-wizard__sections">
          <div v-for="section in spec.sections" :key="section.key" class="site-wizard__section">
            <div class="site-wizard__section-head">
              <span class="site-wizard__section-title">{{ section.title }}</span>
              <a-tag v-if="section.blank">空着</a-tag>
              <a-tag v-else-if="section.overLimit" color="red">超出上限</a-tag>
              <a-tag v-else color="blue">{{ section.charCount }} 字</a-tag>
            </div>
            <FoldedText
              :raw="section.content"
              :summary="section.blank ? '这一段还没有字（AI 出初稿或你亲手写，都在下面那一页）。' : null"
              :empty-text="section.blank ? '这一段还没有字（AI 出初稿或你亲手写，都在下面那一页）。' : '没填'"
              raw-label="这一段全文（逐字）"
            />
          </div>
        </div>

        <div v-if="spec && spec.status !== 'CONFIRMED' && spec.blockers.length" class="site-wizard__blockers">
          <p class="site-wizard__sub-title">为什么还不能拿去生成</p>
          <ul class="site-wizard__list">
            <li v-for="blocker in spec.blockers" :key="blocker">{{ blocker }}</li>
          </ul>
        </div>
        <div v-if="spec && spec.notices.length" class="site-wizard__blockers">
          <p class="site-wizard__sub-title">后端这一发要对你说的话</p>
          <ul class="site-wizard__list">
            <li v-for="notice in spec.notices" :key="notice">{{ notice }}</li>
          </ul>
        </div>

        <p v-if="spec && spec.confirmedAt" class="site-wizard__hint">
          签字：{{ spec.confirmedBy || '（后端没回名字）' }} · {{ formatDateTime(spec.confirmedAt) }}
        </p>

        <a-space class="site-wizard__row">
          <a-button type="primary" :disabled="!briefId" @click="goSpec">去这一页出初稿 / 改某一段 / 签字</a-button>
        </a-space>
        <p class="site-wizard__hint">
          出初稿会真调模型、真花配额，而且整份覆盖改过的字；签字是一次显式动作。这两发都不在这一屏按。
        </p>
      </template>

      <template #step-generate>
        <a-alert v-if="candidatesError" type="error" show-icon>
          <template #message>{{ stepNotice.generate }}</template>
        </a-alert>
        <p v-else class="site-wizard__reading">{{ stepNotice.generate }}</p>

        <a-alert v-if="progressError" type="error" show-icon class="site-wizard__row">
          <template #message>逐套进度没读到：{{ progressError }}（不是「还在跑」，是这一发失败了）</template>
        </a-alert>

        <!-- 价签：后端那一发是零模型调用的纯算，但它是 POST，所以只由人点这一颗 -->
        <div class="site-wizard__quote">
          <a-space align="center">
            <a-button :loading="quoteLoading" :disabled="!briefId" @click="loadQuote">在这一屏算一次价（不花钱、不调模型）</a-button>
            <span v-if="quote" class="site-wizard__hint">第 {{ quote.attempt ?? 1 }} 次估算 · 凭据 {{ quote.estimateId }}</span>
          </a-space>
          <a-alert v-if="quoteError" type="error" show-icon class="site-wizard__row">
            <template #message>价签没算出来：{{ quoteError }}</template>
          </a-alert>
          <template v-if="quote">
            <p class="site-wizard__reading site-wizard__row">{{ quoteSummary }}</p>
            <p v-if="quoteBearer" class="site-wizard__hint">{{ quoteBearer }}</p>
            <!-- 已经烧掉的那一份（M-P33 拍板 6：只把读数摆出来，这一条链上没有闸，读不到也不拦确认） -->
            <div class="site-wizard__burn">
              <p class="site-wizard__reading">{{ burnHeadline }}</p>
              <p v-if="quote.platformBurn?.tokenBasis" class="site-wizard__hint">{{ quote.platformBurn.tokenBasis }}</p>
              <FoldedText
                v-if="burnRest"
                :raw="burnRest"
                summary="这份账是怎么算出来的（钱那一档、口径与那两条「不含」都在展开里）"
                raw-label="后端逐行拼的原话（逐字）"
              />
            </div>
            <p v-if="quote.estimate.missingSwitches?.length" class="site-wizard__hint">
              缺的开关：{{ quote.estimate.missingSwitches.join('、') }}（缺一样，确认框就不该能勾）
            </p>
            <FoldedText
              :raw="[quoteBreakdown, quote.estimate.notice].filter(Boolean).join('\n')"
              summary="这一份价格是怎么算出来的（明细与那句关于偏差的话都在展开里）"
              raw-label="后端逐行拼的明细（逐字）"
            />
          </template>
        </div>

        <div v-if="progress.length" class="site-wizard__row">
          <p class="site-wizard__sub-title">每一套跑到哪一步了</p>
          <p class="site-wizard__hint">{{ progressSourceLine }}</p>
          <a-table
            :data-source="progress"
            :columns="[
              { title: '第几套', dataIndex: 'candidateNo', key: 'candidateNo', width: 80 },
              { title: '阶段', key: 'stage', width: 150 },
              { title: '这一步已经等了', key: 'wait', width: 260 },
              { title: '这一套的状态', key: 'status', width: 150 },
              { title: '这一步说的话', key: 'detail' }
            ]"
            :pagination="false"
            :row-key="(record: BriefCandidateProgress) => `${record.candidateId ?? 'x'}-${record.candidateNo ?? 'n'}`"
            size="small"
            bordered
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'stage'">
                <a-tag>{{ record.stageLabel || record.stage || '后端没回阶段' }}</a-tag>
              </template>
              <template v-else-if="column.key === 'wait'">
                <span>{{ waitLineOf(record) }}</span>
                <!-- 「演示内容」这一格里分批在写第几类：句子只有 `showcaseBatchLineOf` 这一份出处，
                     后端没回批号（不在这一步、或这一趟根本没分批）就整行露空，不兜「第 ? 批」 -->
                <p v-if="showcaseBatchLineOf(record)" class="site-wizard__hint">{{ showcaseBatchLineOf(record) }}</p>
                <p v-if="record.stageLatencyNote" class="site-wizard__hint">{{ record.stageLatencyNote }}</p>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.status === 'failed' ? 'red' : record.status === 'succeeded' ? 'green' : 'blue'">
                  {{ record.statusLabel || record.status || '状态未知' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'detail'">
                <FoldedText
                  v-if="record.errorMessage"
                  :raw="record.errorMessage"
                  tone="error"
                  raw-label="失败原因原文（逐字）"
                />
                <FoldedText
                  v-else-if="record.notices?.length"
                  :raw="record.notices.join('\n')"
                  :summary="`这套有 ${record.notices.length} 条降级说明，点开看后端那几句原话`"
                  raw-label="降级说明（逐字）"
                />
                <span v-else class="site-wizard__hint">这一套这一发没有要说的话</span>
              </template>
              <template v-else>{{ record[column.dataIndex as string] ?? '-' }}</template>
            </template>
          </a-table>
          <p class="site-wizard__hint">{{ roundActualLine }}</p>
          <p class="site-wizard__hint">
            同一轮里哪一套失败只影响那一套：其它套照跑，系统不会在这一轮里替失败那一套重试。
            要重来有<b>两条路，价格差一个数量级</b>：
            只补这一轮里失败的那几套，去这一单的需求单详情页按「只补失败的那几套」——成功的那几套<b>不动</b>
            （站、页面、内容与已经发出去的预览链接原样保留，客户手里的链接不失效），
            那张价签也只数这一趟真会跑的那几套，得另外估算一次、另外勾一次确认；
            整轮重来则是先按「收口重跑」（那一步只把上一轮的候选转成「已归档」、撤销预览令牌，
            不调模型、不花钱），再按一次「开始出方案」，那就是{{ roundSetsLine }}重新生成一遍，
            <b>会再烧一趟上面那个数这个量级的钱</b>。两条路都是花钱的门禁，谁也不会替你自动重跑。
          </p>
        </div>

        <a-space class="site-wizard__row">
          <a-button type="primary" :disabled="!briefId" @click="goBriefDetail">带这两样凭据去需求单详情按「开始出方案」</a-button>
        </a-space>
        <p class="site-wizard__hint">
          只有已签字那一版说明书会被拿去生成；没签字时后端原话是「SPEC_NOT_CONFIRMED」，界面上照它那句话念。
          花钱那一发要同时带回上面那个估算号与预估 token 数，缺一样后端中文拒。
        </p>
      </template>

      <template #step-candidates>
        <p class="site-wizard__reading">{{ stepNotice.candidates }}</p>
        <a-table
          v-if="deliveredCandidates.length"
          :data-source="deliveredCandidates"
          :columns="[
            { title: '第几套', dataIndex: 'candidateNo', key: 'candidateNo', width: 90 },
            { title: '站点', key: 'site', width: 200 },
            { title: '这套侧重什么', dataIndex: 'focus', key: 'focus' },
            { title: '状态', key: 'status', width: 160 },
            { title: '预览地址', key: 'preview', width: 200 }
          ]"
          :pagination="false"
          row-key="candidateId"
          size="small"
          bordered
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'site'">
              {{ record.siteId ? `${record.siteName || record.siteCode || '（没有名字）'} #${record.siteId}` : '站还没建起来' }}
            </template>
            <template v-else-if="column.key === 'focus'">
              <FoldedText
                :raw="record.focus"
                :summary="record.focus ? null : 'plan 那一步没回这一套侧重什么'"
                raw-label="这套的规划原话（逐字）"
              />
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.needsHuman ? 'orange' : 'blue'">
                {{ candidateStageText(record) }}
              </a-tag>
              <p v-if="record.needsHuman" class="site-wizard__hint">待人工：这一套已交付、能预览，但有措辞没过极限用语闸，先看文案再发链接。</p>
            </template>
            <template v-else-if="column.key === 'preview'">
              <a-tag :color="previewLinkStateColor(previewLinkStateOf(record))">
                {{ previewLinkStateText(previewLinkStateOf(record)) }}
              </a-tag>
              <!-- 令牌明文只在签发那一刻存在过：这一屏不签，所以只摆现状与那句解释 -->
              <p class="site-wizard__hint">{{ previewLinkStateHint(previewLinkStateOf(record)) }}</p>
            </template>
            <template v-else>{{ record[column.dataIndex as string] ?? '-' }}</template>
          </template>
        </a-table>

        <!-- 每一套的账摆在明面上：藏在「点开这一行」里的读数和没读一样，他拍板的就是这一条 -->
        <div v-if="deliveredCandidates.length" class="site-wizard__row">
          <p class="site-wizard__sub-title">每一套的账</p>
          <ul class="site-wizard__list site-wizard__list--wide">
            <li v-for="candidate in deliveredCandidates" :key="`ledger-${candidate.candidateId}`">
              <p class="site-wizard__reading">第 {{ candidate.candidateNo }} 套：{{ setLedger(candidate) }}</p>
              <FoldedText
                v-if="hasSetWords(candidate)"
                :raw="setRawWords(candidate)"
                :summary="candidate.needsHuman ? '这一套带着要人过目的话，原文在展开里' : null"
                :tone="progressOf(candidate)?.errorMessage ? 'error' : 'plain'"
                raw-label="这一套的后端原话（逐字）"
              />
            </li>
          </ul>
          <p v-if="needsHumanCount" class="site-wizard__hint">
            「待人工」与「失败」是两件事：失败的那套根本没跑成，这一套内容是落库的、站是能开的，只是系统不敢替客户签字。
          </p>
        </div>

        <a-space class="site-wizard__row">
          <a-button type="primary" :disabled="!briefId" @click="goCandidates">打开候选画廊（三套并排比、按套发预览地址）</a-button>
        </a-space>
        <p class="site-wizard__hint">
          预览令牌绑站不绑页，而且明文只在签发那一刻存在过：所以发放要在画廊里按套亲手点，这一页不自动签。
        </p>
      </template>

      <template #step-deliver>
        <p class="site-wizard__reading">{{ stepNotice.deliver }}</p>
        <a-alert v-if="decisionsError" type="error" show-icon class="site-wizard__row">
          <template #message>客户答复留痕没读到：{{ decisionsError }}（不是「客户没答复」，是这一发失败了）</template>
        </a-alert>
        <div v-else-if="briefId" class="site-wizard__row">
          <p class="site-wizard__sub-title">客户在这条预览链接上答过什么</p>
          <ul v-if="decisions.length" class="site-wizard__list site-wizard__list--wide">
            <li v-for="row in decisions" :key="row.id">
              {{ formatDateTime(row.createdAt) }} · 第 {{ row.candidateNo ?? '?' }} 套
              {{ row.chosenSiteId ? `站 #${row.chosenSiteId}${row.chosenSiteName ? `（${row.chosenSiteName}）` : ''}` : '（只留了话，没选站）' }}
              <FoldedText
                :raw="row.clientNote"
                :summary="row.clientNote ? null : '客户没留言'"
                raw-label="客户原话（逐字）"
              />
            </li>
          </ul>
          <p v-else class="site-wizard__hint">
            一条留痕都没有：要么链接还没发给客户，要么客户还没答。发地址要在画廊里按套签，这一屏不代签。
          </p>
        </div>
        <p v-if="currentBrief" class="site-wizard__hint">
          这一单现在的状态：{{ statusText(currentBrief) }}；
          绑定站点：{{ currentBrief.siteId ? `#${currentBrief.siteId}` : '还没绑' }}。
          转正那一刻才交棒给租户（交付态、计费口径都跟着那一步变），所以这一发必须是人点的，向导不代签。
        </p>
        <a-space class="site-wizard__row">
          <a-button type="primary" :disabled="!briefId" @click="goBriefDetail">回需求单详情做选定与转正</a-button>
          <a-button @click="goSites">到站点清单只看这一单的站</a-button>
        </a-space>
      </template>
    </WizardSteps>
  </div>
</template>

<style scoped>
.site-wizard .page-header {
  margin-bottom: 16px;
}
.site-wizard .page-header p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}
.site-wizard__row {
  margin-top: 16px;
}
.site-wizard__hint {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 13px;
}
.site-wizard__reading {
  margin: 8px 0 0;
  font-size: 14px;
  color: #1f2937;
}
.site-wizard__sub-title {
  margin: 16px 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.site-wizard__list {
  margin: 4px 0 0;
  padding-left: 20px;
  color: #6b7280;
  font-size: 13px;
}
.site-wizard__list--wide {
  list-style: none;
  padding-left: 0;
}
.site-wizard__list--wide > li {
  padding: 6px 0;
  border-bottom: 1px dashed #e5e7eb;
}
.site-wizard__sections {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}
.site-wizard__section {
  padding: 10px 12px;
  border: 1px solid #eef0f3;
  border-radius: 6px;
  background: #fcfcfd;
}
.site-wizard__section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.site-wizard__section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}
.site-wizard__quote {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #eef0f3;
  border-radius: 6px;
}

/* 价签里那一格「已经烧掉的」：与「这一趟要花的」同屏但要看得出是两本账 */
.site-wizard__burn {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #e3e6eb;
}
</style>
