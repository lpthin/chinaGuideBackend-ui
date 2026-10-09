<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  briefIsEditable,
  briefStatusLabelOrCode,
  buildBriefForm,
  cleanPagePlanForSubmit,
  EDITABLE_BRIEF_STATUSES,
  emptyPagePlanEntry,
  HOME_LAYOUT_MAX,
  intakeLoopQuestions,
  isIntakeStaticKey,
  PAGE_PLAN_MAX,
  PAGE_PRIORITY_CODES,
  PAGE_PURPOSE_MAX,
  PAGE_TITLE_MAX,
  pagePlanLocalHints,
  readBriefSelections,
  siteBriefsApi,
  vocabularyApi,
  type BriefPagePlanEntry,
  type BriefVocabularyQuestion,
  type SiteBrief,
  type SiteBriefForm,
  type SiteBriefVocabulary
} from '@/api/siteBriefs'
import { portalPagesApi, type PortalBlockMeta } from '@/api/portalPages'
import { portalSectionsApi, type SectionState } from '@/api/portalSections'
import { siteApi, tenantApi } from '@/api/workspace'
import type { Tenant } from '@/types/workspace'

/**
 * 前采录入表单（Spec-D D1 起：24 题「四组分区」；Spec-M P4 起：**分区 = 分步**，一屏一段）。
 *
 * 这一份是**唯一的前采实现**：`BriefIntakeView.vue`（独立路由页）与新建网站向导的第一步都渲染它，
 * 差别只在 `embedded` 与 `briefId`/`tenantId` 从哪儿来（props 优先，独立页仍读地址）。
 *
 * 这一页的四条纪律（每条都对应过一次的真实事故）：
 * 1. **题目、选项、分段名全部按词表循环渲染**——`GET /admin/site-briefs/vocabulary` 一份为准
 *    （`site-brief-vocabulary.spec.ts` 扫源码守着）；四段段名与「哪题属哪段」也是后端下发
 *    （`groups` + 每题 `group`），界面一个字都不抄。**分步只是把「一屏四段」改成「一段一屏」，
 *    提交形状没变**：仍然一次交整张表单，段与段之间不拦人（步序不是权限，拦人没意义）。
 *    词表没下发 `groups`（或只有一段）时**退回一段平铺**，不硬造分段。
 * 2. **必填只剩词表打了星的题**（D1 起：品牌或公司全称、最希望访客做完哪一件事）。星号来自
 *    `q.required`，界面不自编第二份必填名单；其余一律可跳过。
 * 3. **「跳过」要说人话**：没填的格子显式挂一句「客户未提供」——后端摘要段就是这么如实写给模型看的
 *    （省略那一行会让模型分不清「客户没偏好」与「我们没问」），界面因此不许留一个看着像填好的空框。
 * 4. **page_plan / home_layout 的本地提示不是闸**：`pagePlanLocalHints` 那组判据镜像自后端
 *    `SiteBriefIntake`，只为少跑几回后端；保存那一闸永远在服务端，被拒时它的中文原因
 *    （`BusinessException.message`，逐页点名）经 `Error.message` 原样列在页面底部，
 *    一个字不改、一条不吞——这页不摆点不动的死链，也不摆一个「本地说可以存」的假闸。
 *
 * 区块与栏目的名字不抄第二份：区块目录读 `GET /portal/blocks`（含后端现算的 notWired 标志，
 * 未接线的空壳不进候选），栏目词表读 `GET /portal/sections`（别的 view 的取法，照旧）。
 * 字体调性只把选项码存成一个字符串——这一页不引任何外部字体文件，落地由 theme token 负责。
 *
 * 两条交棒入口（P2 的接收端，未变）：
 * - `/portal/brief/new?tenantId=15`：租户从地址预填，用户不用重挑；
 * - 编辑一单时若它已不在 `draft/ready`，页面顶部先说清「保存会被后端拒」，并给回详情页的入口。
 */

/** color 题「AI 决定」的落库哨兵值：与后端词表里那条选项的 code 同一个码，不是自造的 */
const COLOR_AUTO = 'ai'
const NOTES_MAX = 500
const REFERENCE_MAX = 3
const PREVIEW_DEBOUNCE_MS = 300

/**
 * 这张表单有两个宿主：独立路由页（`BriefIntakeView`）和新建网站向导的第一步（`embedded`）。
 * props 优先、地址兜底——向导那侧传 `briefId`，独立页仍然从 `route.params.id` / `?tenantId=` 取，
 * 这样 `TenantPanel`、`SitesView` 那些「带着租户号来录一单」的老链接一个都不必改。
 */
const props = withDefaults(defineProps<{
  briefId?: number | null
  tenantId?: number | null
  embedded?: boolean
}>(), {
  briefId: null,
  tenantId: null,
  embedded: false
})

const emit = defineEmits<{ (event: 'saved', brief: SiteBrief): void }>()

const route = useRoute()
const router = useRouter()

const vocabulary = ref<SiteBriefVocabulary | null>(null)
const vocabularyFailed = ref(false)

const questions = computed<BriefVocabularyQuestion[]>(() => intakeLoopQuestions(vocabulary.value))
const candidateMax = computed(() => vocabulary.value?.candidateMaxCount ?? 1)
const demoModeOptions = computed(() =>
  (vocabulary.value?.demoContentModes ?? []).map(mode => ({
    value: mode.value,
    label: `${mode.label}（文章 ${mode.articleCount} 篇 / 案例 ${mode.caseCount} 条）`
  }))
)

const tenants = ref<Tenant[]>([])
const tenantsFailed = ref(false)
const sites = ref<Array<{ id?: number; name?: string; tenantId?: number }>>([])
const sitesFailed = ref(false)

// ---- 后端两份目录（区块名/栏目名的唯一来源；取不到就明说，绝不本地补一份） ----
const blockCatalog = ref<PortalBlockMeta[]>([])
const blocksFailed = ref(false)
const sectionStates = ref<SectionState[]>([])
const sectionsFailed = ref(false)

const briefId = ref<number | null>(null)
const status = ref('')
/** 租户是从「租户管理 > 去录前采」那条链接带过来的：预填取自地址，不让人再挑一遍 */
const tenantFromQuery = ref(false)

const form = reactive({
  tenantId: null as number | null,
  siteId: null as number | null,
  candidateCount: 1,
  demoContentMode: '',
  notes: '',
  referenceRows: [''] as string[]
})

/** 勾选结果：key 只可能来自词表（q.key），这里从不登记任何固定题目名。
 *  pages 形态存的是逐页条目数组（BriefPagePlanEntry），形状与后端 SiteBriefIntake 一一对齐 */
type SelectionValue = string | string[] | BriefPagePlanEntry[]
const selections = reactive<Record<string, SelectionValue>>({})
const colorAuto = reactive<Record<string, boolean>>({})
/** block-order 与每页 blocks 的下拉暂存值：按「题目 key(+页下标)」存，页面不认题目名 */
const blockDraft = reactive<Record<string, string>>({})

const summary = ref('')
const summaryStale = ref(false)
const summaryPending = ref(false)
const saveError = ref('')
const saving = ref(false)
/** 词表/存量单载入期间的变更不触发 preview；载入完成后才跟随用户动作 */
const booting = ref(true)

function errText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error)
}

function textOf(key: string): string {
  const value = selections[key]
  return typeof value === 'string' ? value : ''
}

function listOf(key: string): string[] {
  const value = selections[key]
  return Array.isArray(value) && typeof value[0] !== 'object' ? (value as string[]) : []
}

function pageRows(q: BriefVocabularyQuestion): BriefPagePlanEntry[] {
  const value = selections[q.key]
  if (!Array.isArray(value)) {
    // 首次触到 pages 题：给一个空数组挂上，行编辑器才有可写的目标（ensureShape 之后不该再走到这）
    selections[q.key] = []
  }
  return (selections[q.key] ?? []) as BriefPagePlanEntry[]
}

/** 后端读回的条目可能缺 blocks/带 null：归一成一个能直接编辑的形状 */
function normalizePageRow(row: Partial<BriefPagePlanEntry> | null | undefined): BriefPagePlanEntry {
  const base = emptyPagePlanEntry()
  if (!row) return base
  return {
    key: String(row.key ?? ''),
    slug: String(row.slug ?? ''),
    title: String(row.title ?? ''),
    purpose: String(row.purpose ?? ''),
    sectionKey: String(row.sectionKey ?? ''),
    blocks: Array.isArray(row.blocks) ? row.blocks.map(block => String(block ?? '')) : [],
    priority: String(row.priority ?? '')
  }
}

/**
 * 题目变更回调一律写成「key + 事件值」的两参形式，不写成工厂：
 * 模板里 `@update:value="onPickSingle(q.key)"` 会被编译成 `$event => onPickSingle(q.key)`——
 * 工厂在事件里被调用、返回的闭包直接被丢掉，勾选看着有反应，selections 一个字都不会写。
 * （这条是被 brief-intake-view.spec.ts 的真实控件事件用例打红后钉下的。）
 */
function onPickSingle(key: string, value: unknown) {
  selections[key] = value === null || value === undefined ? '' : String(value)
}

function onPickList(key: string, value: unknown) {
  selections[key] = Array.isArray(value) ? value.map(String) : []
}

function onPickText(key: string, value: unknown) {
  selections[key] = value === null || value === undefined ? '' : String(value)
}

function onPickColor(key: string, value: unknown) {
  selections[key] = value === null || value === undefined ? '' : String(value)
}

/** 原生色块只认 `#rrggbb`：别的写法（空、三名hex、颜色名）如实显示成黑色方格，文字格才是原值 */
function swatchColor(key: string): string {
  const raw = String(selections[key] ?? '')
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#000000'
}

/** color 题的「AI 决定」开关：开 = 落哨兵值让后端自己定，关 = 回到取色器（主/辅色两题共用同一判据） */
function onToggleAuto(key: string, checked: unknown) {
  const on = Boolean(checked)
  colorAuto[key] = on
  selections[key] = on ? COLOR_AUTO : ''
}

function cascaderOptions(question: BriefVocabularyQuestion) {
  return (question.options ?? []).map(option => ({
    value: option.code,
    label: option.label,
    children: (option.children ?? []).map(child => ({ value: child.code, label: child.label }))
  }))
}

// ---------------- 四组分区与锚点导航（段名只认词表 `groups` 那一份） ----------------

/** 词表声明顺序即分段顺序（后端 LinkedHashMap 保序下发），界面不重排也不猜 */
const sectionAnchors = computed(() => {
  const groups = vocabulary.value?.groups
  if (!groups) return []
  const seen: Array<{ code: string; label: string }> = []
  questions.value.forEach(question => {
    const code = question.group
    if (!code || seen.some(entry => entry.code === code)) return
    seen.push({ code, label: groups[code] || code })
  })
  return seen
})

/** 每题只在「本段第一题」前渲染一条段标题：分段只是渲染范围，题目循环仍是那一个 v-for */
const sectionStartKeys = computed(() => {
  const seen = new Set<string>()
  const starts = new Set<string>()
  loopQuestions.value.forEach(question => {
    const code = question.group || ''
    if (!code || seen.has(code)) return
    seen.add(code)
    starts.add(question.key)
  })
  return starts
})

// ---------------- 分步（Spec-M P4：一屏一段；段序与段名仍只认词表那一份） ----------------

/** 段数 >1 才分步；词表没下发 groups（老回包/只有一段）时退回一段平铺，不硬造分段 */
const isStepped = computed(() => sectionAnchors.value.length > 1)
const activeSection = ref('')
const activeIndex = computed(() => {
  const index = sectionAnchors.value.findIndex(section => section.code === activeSection.value)
  return index < 0 ? 0 : index
})
const activeAnchor = computed(() => sectionAnchors.value[activeIndex.value] || null)

/** 模板循环的那一撮题：分步时只摆当前这段，平铺时还是全部 */
const loopQuestions = computed(() =>
  isStepped.value ? questions.value.filter(question => (question.group || '') === activeSection.value) : questions.value
)

/** 那两块专用控件（参考站 / 补充说明）属于哪一段，问词表不问记忆：它们在后端题表里就带 group */
const staticSectionCode = computed(() => {
  const raw = vocabulary.value?.questions ?? []
  const found = raw.find(question => isIntakeStaticKey(question.key))
  return found?.group || sectionAnchors.value[sectionAnchors.value.length - 1]?.code || ''
})
const showStaticCards = computed(() => !isStepped.value || activeSection.value === staticSectionCode.value)

const unansweredInSection = computed(() => loopQuestions.value.filter(question => isUnanswered(question)).length)
const requiredUnansweredInSection = computed(() =>
  loopQuestions.value.filter(question => question.required === true && isUnanswered(question)).map(question => question.label)
)

function goToSection(code: string) {
  if (!sectionAnchors.value.some(section => section.code === code)) return
  activeSection.value = code
  // 换段等于换一屏：滚动位置归零，否则人以为自己还在上一段的第 7 题
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
}

function stepSection(offset: number) {
  const target = sectionAnchors.value[activeIndex.value + offset]
  if (target) goToSection(target.code)
}

function isSectionStart(q: BriefVocabularyQuestion): boolean {
  return sectionStartKeys.value.has(q.key)
}

function sectionLabelOf(q: BriefVocabularyQuestion): string {
  const code = q.group || ''
  return (code && (vocabulary.value?.groups?.[code] || code)) || ''
}

function sectionDomId(code: string): string {
  return `brief-intake-section-${code || 'none'}`
}

/** 段间导航上露的那两个短字：段名全称挂在段标题那一行，导航条只取「：」前的短名，不另起一名 */
function sectionShortName(label: string): string {
  const cut = label.split('：')[0]
  return cut || label
}

// ---------------- page_plan 行编辑器（上下移动代替拖拽：点了就真的会动） ----------------

function addPage(q: BriefVocabularyQuestion) {
  pageRows(q).push(emptyPagePlanEntry())
}

/** 快捷补一页带 key/slug 预设的骨架页：只预填「稳定标识」这两格（后端判据认的就是这两个码），
 *  标题与用途仍归客户原话，界面不替客户编 */
function addPresetPage(q: BriefVocabularyQuestion, preset: 'home' | 'contact') {
  pageRows(q).push({ ...emptyPagePlanEntry(), key: preset, slug: preset })
}

function removePage(q: BriefVocabularyQuestion, index: number) {
  pageRows(q).splice(index, 1)
}

function movePage(q: BriefVocabularyQuestion, index: number, delta: number) {
  moveInArray(pageRows(q), index, index + delta)
}

function moveInArray<T>(rows: T[], from: number, to: number) {
  if (to < 0 || to >= rows.length) return
  const [moved] = rows.splice(from, 1)
  rows.splice(to, 0, moved)
}

function onPageField(q: BriefVocabularyQuestion, index: number, field: keyof BriefPagePlanEntry, value: unknown) {
  const row = pageRows(q)[index] as unknown as Record<string, string>
  row[field] = value === null || value === undefined ? '' : String(value)
}

function pickPageSection(q: BriefVocabularyQuestion, index: number, sectionKey: string) {
  pageRows(q)[index].sectionKey = sectionKey
}

function pickPagePriority(q: BriefVocabularyQuestion, index: number, priority: string) {
  // 再点一次已选中的档 = 清回「没排先后」：留空是合法取值（后端 PRIORITIES 之外的只有 null）
  const row = pageRows(q)[index]
  row.priority = row.priority === priority ? '' : priority
}

function addPageBlock(q: BriefVocabularyQuestion, index: number) {
  const draftKey = `${q.key}|${index}`
  const picked = blockDraft[draftKey]
  if (!picked) return
  pageRows(q)[index].blocks.push(picked)
  blockDraft[draftKey] = ''
}

function movePageBlock(q: BriefVocabularyQuestion, index: number, blockIndex: number, delta: number) {
  moveInArray(pageRows(q)[index].blocks, blockIndex, blockIndex + delta)
}

function removePageBlock(q: BriefVocabularyQuestion, index: number, blockIndex: number) {
  pageRows(q)[index].blocks.splice(blockIndex, 1)
}

/** 本地即时提示（镜像判据，不是闸）：措辞在适配层，视图只列它给的行 */
function pageHints(q: BriefVocabularyQuestion): string[] {
  return pagePlanLocalHints(pageRows(q))
}

// ---------------- block-order 编辑器（home_layout 用；候选来自 /portal/blocks） ----------------

/**
 * 区块候选：后端逐行现算的 `notWired` 判据挡住空壳（摆上去就是一片空白的那类），
 * 已加进来的不再重复出现——同页/首页重名都会被后端中文拒，候选里直接排掉。
 */
function blockOptions(excluded: string[]) {
  return blockCatalog.value
    .filter(block => block.notWired !== true && !excluded.includes(block.blockKey))
    .map(block => ({ value: block.blockKey, label: `${block.name}（${block.blockKey}）` }))
}

/** 区块码换中文只认目录那一份；目录里没有（比如存量单里的旧码）就把码原样露出来 */
function blockLabel(blockKey: string): string {
  const found = blockCatalog.value.find(block => block.blockKey === blockKey)
  return found ? `${found.name}（${found.blockKey}）` : `${blockKey}（区块目录里没这一码）`
}

function addLayoutBlock(q: BriefVocabularyQuestion) {
  const picked = blockDraft[q.key]
  if (!picked) return
  if (!Array.isArray(selections[q.key])) selections[q.key] = []
  ;(selections[q.key] as string[]).push(picked)
  blockDraft[q.key] = ''
}

function moveLayoutBlock(q: BriefVocabularyQuestion, index: number, delta: number) {
  const rows = selections[q.key]
  if (Array.isArray(rows)) moveInArray(rows as string[], index, index + delta)
}

function removeLayoutBlock(q: BriefVocabularyQuestion, index: number) {
  const rows = selections[q.key]
  if (Array.isArray(rows)) (rows as string[]).splice(index, 1)
}

// ---------------- 栏目卡片（名字来自 /portal/sections；裸下拉被换掉的那一块） ----------------

/** 首卡「不属于任何栏目」的说明是判据转述（后端对首页亲口返回 null），不是第二个栏目名 */
const NONE_SECTION = ''
const sectionChoices = computed(() => [
  { key: NONE_SECTION, label: '不属于任何栏目', desc: '首页与自定义页本来就不挂栏目；填了 home 会被后端拒' },
  ...sectionStates.value.map(section => ({
    key: section.key,
    label: section.displayName,
    desc: section.publicPath ? `对外地址 ${section.publicPath}` : ''
  }))
])

// ---------------- 必填与「客户未提供」 ----------------

/** 这一题现在算不算没答：pages 看清洗后的行数，数组形态看非空项，字符串看 trim 后长度 */
function isUnanswered(q: BriefVocabularyQuestion): boolean {
  const value = selections[q.key]
  if (q.select === 'pages') return cleanPagePlanForSubmit((value as BriefPagePlanEntry[]) ?? []).length === 0
  if (Array.isArray(value)) {
    return value.filter(item => item !== '' && item != null).length === 0
  }
  return String(value ?? '').trim() === ''
}

/** 缺的必填题（星来自词表；今天两题，词表变了界面跟着变，不写死名单） */
const missingRequiredLabels = computed(() =>
  questions.value.filter(question => question.required === true && isUnanswered(question)).map(question => question.label)
)

function clampCandidate(value: number): number {
  const safe = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 1
  return Math.min(safe, Math.max(1, candidateMax.value))
}

function onCandidateInput(value: unknown) {
  form.candidateCount = clampCandidate(Number(value))
}

function onTenantChange(value: unknown) {
  form.tenantId = value === null || value === undefined || value === '' ? null : Number(value)
  // 站点是后链路按租户建出来的：换租户后原来绑的站不再属于这一单，宁可清空显示也不留一个错归属
  form.siteId = null
}

function onModeChange(value: unknown) {
  form.demoContentMode = value === null || value === undefined ? '' : String(value)
}

function cleanReferenceUrls(): string[] {
  return form.referenceRows.map(row => row.trim()).filter(Boolean)
}

function onReferenceInput(index: number, value: unknown) {
  form.referenceRows[index] = value === null || value === undefined ? '' : String(value)
}

function addReference() {
  if (form.referenceRows.length < REFERENCE_MAX) form.referenceRows.push('')
}

function removeReference(index: number) {
  form.referenceRows.splice(index, 1)
  if (!form.referenceRows.length) form.referenceRows.push('')
}

function snapshotSelections(): Record<string, SelectionValue> {
  const copy: Record<string, SelectionValue> = {}
  Object.keys(selections).forEach(key => {
    const value = selections[key]
    // 两种数组袋（string[] 与 BriefPagePlanEntry[]）各是各的形状：并成一项的联合 TS 不认，按原形状拷回去
    copy[key] = Array.isArray(value)
      ? [...(value as string[] | BriefPagePlanEntry[])] as SelectionValue
      : value
  })
  return copy
}

/** 提交前的按形态清洗：pages 丢全空行并 trim（半空的行照发——那是后端要逐页点名的），
 *  block-order 丢掉空的一格（后端对空格是中文拒，候选下拉本来就给不出空格） */
function buildPayload(): SiteBriefForm {
  const snapshot = snapshotSelections()
  questions.value.forEach(question => {
    if (question.select === 'pages') {
      // 存量单没填过时读回来可能是空串：编辑器一律按数组处理（pageRows/listOf 同样自愈）
      snapshot[question.key] = cleanPagePlanForSubmit(
        Array.isArray(snapshot[question.key]) ? (snapshot[question.key] as BriefPagePlanEntry[]) : []
      )
    } else if (question.select === 'block-order') {
      snapshot[question.key] = (Array.isArray(snapshot[question.key]) ? (snapshot[question.key] as string[]) : [])
        .map(item => String(item ?? '').trim()).filter(Boolean)
    }
  })
  // 后端 SiteBriefForm 是平铺字段：勾选袋按 q.key 收，交给适配层拍平（级联拆 industry/subIndustry、
  // 语言包成数组、参考站与补充说明走元信息）。siteId 不在建单入参里——转正是后链路的回填动作。
  return buildBriefForm(
    {
      tenantId: form.tenantId,
      status: status.value || null,
      candidateCount: clampCandidate(form.candidateCount),
      demoContentMode: form.demoContentMode,
      notes: form.notes,
      referenceUrls: cleanReferenceUrls()
    },
    snapshot as Record<string, string | string[]>
  )
}

/** 保证每个词表题目都有形状（multi/cascade/block-order 是数组、pages 是条目数组，其它是字符串），并认出 color 的哨兵值 */
function ensureShape() {
  questions.value.forEach(question => {
    const existing = selections[question.key]
    if (existing === undefined) {
      selections[question.key] =
        question.select === 'multi' || question.select === 'cascade' || question.select === 'block-order' || question.select === 'pages'
          ? []
          : ''
    }
    if (question.select === 'pages') {
      // 这一单没答时平铺字段是 null，`readBriefSelections` 回填成的是**空串**而不是条目数组：
      // 形状要在这里归一次，否则空串带进 .map 就是「读回一单把录入页炸掉」
      const rows = Array.isArray(existing) ? existing as BriefPagePlanEntry[] : []
      selections[question.key] = rows.map(normalizePageRow)
    }
    if (question.select === 'color') {
      colorAuto[question.key] = existing === COLOR_AUTO
      if (existing === COLOR_AUTO) selections[question.key] = COLOR_AUTO
    }
  })
}

let previewTimer: ReturnType<typeof setTimeout> | null = null
let previewSeq = 0

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(runPreview, PREVIEW_DEBOUNCE_MS)
}

async function runPreview() {
  previewTimer = null
  if (!vocabulary.value) return
  const seq = ++previewSeq
  summaryPending.value = true
  try {
    const result = await siteBriefsApi.summaryPreview(buildPayload())
    if (seq !== previewSeq) return
    summary.value = result?.requirementsSummary ?? ''
    summaryStale.value = false
  } catch (error) {
    if (seq !== previewSeq) return
    // 失败不清屏：保留上一次结果，原话标「这段话还没刷新」（界面上那句就长在模板里）
    summaryStale.value = true
  } finally {
    if (seq === previewSeq) summaryPending.value = false
  }
}

watch(
  () => JSON.stringify({
    tenantId: form.tenantId,
    siteId: form.siteId,
    candidateCount: form.candidateCount,
    demoContentMode: form.demoContentMode,
    notes: form.notes,
    referenceUrls: form.referenceRows,
    selections
  }),
  () => {
    if (!booting.value) schedulePreview()
  }
)

/** 空白新建那一单的三格默认值：档位取词表里的 full（词表没给就第一项），套数按词表上限拉满。
 *  独立页首次 boot 与向导里的「录一份新需求单」都走这一处——否则内嵌新建会把上一单的读数原样带进新单
 *  （现场抓到过：#36 的 1 套 / none 档就这么进了新单 #131，而独立页同一份表单给的是 3 套 / full）。 */
function applyNewBriefDefaults() {
  const modes = vocabulary.value?.demoContentModes ?? []
  const full = modes.find(mode => mode.value === 'full')
  form.demoContentMode = (full ?? modes[0])?.value ?? ''
  form.candidateCount = clampCandidate(candidateMax.value)
}

async function loadVocabulary() {
  vocabularyFailed.value = false
  try {
    vocabulary.value = await vocabularyApi.adminVocabulary()
    ensureShape()
    if (briefId.value === null) {
      applyNewBriefDefaults()
    } else {
      form.candidateCount = clampCandidate(form.candidateCount)
    }
  } catch (error) {
    vocabularyFailed.value = true
    vocabulary.value = null
    message.error(errText(error))
  }
}

async function loadTenants() {
  try {
    tenants.value = (await tenantApi.list()) || []
    tenantsFailed.value = false
  } catch (error) {
    tenantsFailed.value = true
  }
}

async function loadSites() {
  try {
    sites.value = (await siteApi.list()) || []
    sitesFailed.value = false
  } catch (error) {
    sitesFailed.value = true
  }
}

async function loadBlocks() {
  blocksFailed.value = false
  try {
    blockCatalog.value = (await portalPagesApi.blocks()) || []
  } catch (error) {
    blocksFailed.value = true
    message.error(errText(error))
  }
}

async function loadSections() {
  sectionsFailed.value = false
  try {
    sectionStates.value = (await portalSectionsApi.list()) || []
  } catch (error) {
    sectionsFailed.value = true
    message.error(errText(error))
  }
}

function applyBrief(brief: SiteBrief) {
  briefId.value = brief.id ?? null
  status.value = brief.status || ''
  form.tenantId = brief.tenantId ?? null
  form.siteId = brief.siteId ?? null
  form.candidateCount = brief.candidateCount || 1
  form.demoContentMode = brief.demoContentMode || ''
  // 平铺字段按题目 key 回填成勾选袋；参考站/补充说明走元信息；新 11 栏里结构化那两栏随后归一
  Object.entries(readBriefSelections(questions.value, brief)).forEach(([key, value]) => {
    selections[key] = Array.isArray(value) ? [...value] : String(value ?? '')
  })
  ensureShape()
  form.referenceRows = brief.referenceUrls?.length ? [...brief.referenceUrls] : ['']
  form.notes = brief.notes || ''
  if (brief.requirementsSummary) summary.value = brief.requirementsSummary
  summaryStale.value = false
  saveError.value = ''
}

async function loadBrief(id: number) {
  try {
    const brief = await siteBriefsApi.get(id)
    if (brief) applyBrief(brief)
  } catch (error) {
    message.error(errText(error))
  }
}

async function save() {
  saveError.value = ''
  if (!vocabulary.value) {
    message.warning('词表还没取到：先点「重新取词表」，勾完题才谈保存')
    return
  }
  if (!form.tenantId) {
    message.warning('先选这一单给哪个租户')
    return
  }
  if (missingRequiredLabels.value.length) {
    // 星号来自词表 q.required；这一句只是让人少跑一趟，真正的拒单理由仍以服务端回的那句为准
    message.warning(`还有打星的必填题没填：${missingRequiredLabels.value.join('、')}——其余题可以空着，摘要会按「客户未提供」如实写`)
    return
  }
  saving.value = true
  try {
    const payload = buildPayload()
    const wasNew = briefId.value === null
    const saved = wasNew
      ? await siteBriefsApi.create(payload)
      : await siteBriefsApi.update(briefId.value as number, payload)
    // 「保存成功」只在 create/update 真的回了一单之后才说；后端没回单就是没保存
    message.success('保存成功')
    if (saved) applyBrief(saved)
    if (saved) emit('saved', saved)
    if (wasNew && saved?.id && !props.embedded) {
      router.replace({ name: 'workspace-portal-brief-intake', params: { id: String(saved.id) } })
    }
  } catch (error) {
    // 锁单理由、page_plan 逐页点名的中文……全是后端 `BusinessException.message` 原话：
    // 换行分条只是排版，一个字都不改写（前端那份本地提示永远不冒充这一句）
    const reason = errText(error)
    saveError.value = reason
    message.error(reason)
  } finally {
    saving.value = false
  }
}

function backToList() {
  router.push({ name: 'workspace-portal-briefs' })
}

const tenantOptions = computed(() => {
  const options = tenants.value.map(tenant => ({ value: tenant.id, label: tenant.name || tenant.code || `#${tenant.id}` }))
  // 地址带过来的租户号可能不在这一页的租户列表里（列表没取全 / 取失败）：给它一条诚实的选项，
  // 而不是让下拉显示一个裸数字，那看着像控件坏了。
  if (form.tenantId && !options.some(option => option.value === form.tenantId)) {
    options.push({ value: form.tenantId, label: `租户 #${form.tenantId}（这一页的租户列表里没查到）` })
  }
  return options
})
const siteNameById = computed(() => {
  const map = new Map<number, string>()
  sites.value.forEach(site => {
    if (typeof site.id === 'number') map.set(site.id, site.name || `#${site.id}`)
  })
  return map
})
/** 站点只由后链路回填，界面上因此只是一段文字；站名没在列表里（列表分页没cover到/站已删）就退回显示 id，不猜 */
const boundSiteLabel = computed(() => {
  const id = form.siteId
  if (id === null || id === undefined) return ''
  return siteNameById.value.get(id) ?? `#${id}${sitesFailed.value ? '（站点列表没取到，名字刷新后才有）' : ''}`
})

function routeBriefId(): number | null {
  if (props.briefId && props.briefId > 0) return props.briefId
  const parsed = Number(route.params.id)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** 地址里带的租户号（`/portal/brief/new?tenantId=15`）：只有它才允许预填租户 */
function routeTenantId(): number | null {
  if (props.tenantId && props.tenantId > 0) return props.tenantId
  const query = (route.query ?? {}) as Record<string, unknown>
  const parsed = Number(query.tenantId)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** 状态中文只取自词表那一份 statusLabels（取不到就把原码露出来，绝不自己编映射） */
const statusText = computed(() => briefStatusLabelOrCode(vocabulary.value, status.value))
const editable = computed(() => briefIsEditable(status.value))
const editableStatusNames = computed(() =>
  EDITABLE_BRIEF_STATUSES.map(code => briefStatusLabelOrCode(vocabulary.value, code)).join('、')
)
/** 已经锁单的那一单：表单还开着，但保存一定会被后端中文拒——这句话必须先进页面 */
const lockedNotice = computed(() => briefId.value !== null && !!status.value && !editable.value)

function goDetail() {
  const id = briefId.value
  if (id === null) return
  router.push({ name: 'workspace-portal-brief-detail', params: { id: String(id) } })
}

/**
 * 换一单：先把上一单的袋子清干净。勾选袋是按题目 key 存的，只回填不清会留下上一单的答案
 * （`applyBrief` 只覆盖这单里有的那些 key，剩下的一样会被拍进 payload 交给后端）。
 */
function clearIntake() {
  Object.keys(selections).forEach(key => delete selections[key])
  Object.keys(colorAuto).forEach(key => delete colorAuto[key])
  Object.keys(blockDraft).forEach(key => delete blockDraft[key])
  form.siteId = null
  form.notes = ''
  form.referenceRows = ['']
  status.value = ''
  summary.value = ''
  summaryStale.value = false
  saveError.value = ''
  briefId.value = null
}

async function boot() {
  booting.value = true
  const id = routeBriefId()
  // 三份目录并行取：词表决定渲什么题，区块目录与栏目词表只喂那两个编辑器
  await Promise.all([loadTenants(), loadSites(), loadBlocks(), loadSections()])
  if (id === null) {
    const fromQuery = routeTenantId()
    if (fromQuery !== null) {
      form.tenantId = fromQuery
      tenantFromQuery.value = true
    }
  }
  // 词表必须先于存量单到手：D1 的 24 题里新栏（pagePlan/homeLayout/trustAnchors…）要按题目回填，
  // 先取单的话 questions 还是空的，读回来的勾选袋一道题都挂不上——「改一个字重录整张单」就是这么来的
  await loadVocabulary()
  activeSection.value = sectionAnchors.value[0]?.code || ''
  if (id !== null) await loadBrief(id)
  ensureShape()
  await nextTick()
  booting.value = false
}

/** 向导里换了下拉、或按了「录一份新的」：同一宿主要么换单、要么回到空白新建 */
watch(() => [props.briefId, props.tenantId], async () => {
  if (!props.embedded) return
  // 存完一单后宿主把它认下来的那个号又传回来（就是当前这一单）：这时不许重取，
  // 更不能把人从第四段拽回第一段——判断依据是「单号没变」，不是「我刚存过」
  if (routeBriefId() === briefId.value) return
  booting.value = true
  clearIntake()
  tenantFromQuery.value = false
  const id = routeBriefId()
  if (id === null) {
    const fromQuery = routeTenantId()
    if (fromQuery !== null) {
      form.tenantId = fromQuery
      tenantFromQuery.value = true
    }
    // 「录一份新需求单」不能把上一单的套数与档位带进新单：这一份默认与独立页刚进来时取自同一处
    applyNewBriefDefaults()
  }
  if (id !== null) await loadBrief(id)
  else ensureShape()
  activeSection.value = sectionAnchors.value[0]?.code || ''
  await nextTick()
  booting.value = false
})

onMounted(boot)
</script>

<template>
  <div class="brief-intake">
    <div v-if="!embedded" class="brief-intake__head">
      <div>
        <h3>{{ briefId ? '编辑前采需求单' : '新建前采需求单' }}</h3>
        <p class="brief-intake__sub">
          这条头上定三件事：这单给哪个租户、出几套候选、演示内容哪一档。下面按后端词表分
          {{ sectionAnchors.length || 1 }} 段收客户的原话（共 {{ questions.length }} 题，一屏一段），
          必填只有打了星的题（星来自词表，不是界面自造的名单），其余一律可跳过——没填的格子会显式写成「客户未提供」，
          摘要段就是这么如实喂给模型的。分屏只是排版，保存仍然一次交整张表单。
        </p>
      </div>
      <a-space wrap>
        <a-tag v-if="status">当前状态：{{ statusText }}</a-tag>
        <a-button @click="backToList">返回列表</a-button>
        <a-button v-if="briefId" @click="goDetail">看这一单的详情</a-button>
      </a-space>
    </div>
    <!-- 向导里嵌着一份时：那一格的标题与「返回列表」都是多余的，只留状态这一句和详情入口 -->
    <div v-else class="brief-intake__head brief-intake__head--embedded">
      <a-space wrap>
        <a-tag v-if="status">当前状态：{{ statusText }}</a-tag>
        <span v-if="briefId" class="brief-intake__muted">这一单是 #{{ briefId }}</span>
        <a-button v-if="briefId" size="small" @click="goDetail">看这一单的详情</a-button>
      </a-space>
    </div>

    <div class="brief-intake__profile">
      <a-space wrap>
        <span class="brief-intake__profile-label">租户</span>
        <a-select
          :value="form.tenantId"
          :options="tenantOptions"
          :placeholder="tenantsFailed ? '租户没取到，刷新重试' : '这一单给哪个租户'"
          show-search
          option-filter-prop="label"
          style="width: 220px"
          @update:value="onTenantChange"
        />
        <!-- 站点在这里**没有可选项**：候选站是后链路 AI 建出来之后才回填的（Spec-C §6.2），
             录入阶段给一个能选、选了又不入库的下拉，等于骗人填一遍。只在单子上确实绑过站时显示。 -->
        <template v-if="form.siteId">
          <span class="brief-intake__profile-label">已绑定站点</span>
          <span class="brief-intake__bound-site">{{ boundSiteLabel }}</span>
        </template>
        <span class="brief-intake__profile-label">候选套数（上限 {{ candidateMax }}）</span>
        <a-input-number
          :value="form.candidateCount"
          :min="1"
          :max="candidateMax"
          style="width: 110px"
          @update:value="onCandidateInput"
        />
        <span class="brief-intake__profile-label">演示内容档位</span>
        <a-select
          :value="form.demoContentMode || undefined"
          :options="demoModeOptions"
          :placeholder="vocabularyFailed ? '词表没取到，刷新重试' : '哪一档'"
          style="width: 280px"
          @update:value="onModeChange"
        />
      </a-space>
    </div>

    <a-alert v-if="tenantFromQuery && !briefId" type="info" show-icon class="brief-intake__alert">
      <template #message>
        租户是从「租户管理」那一行带过来的（#{{ form.tenantId }}）：这一单就记在它名下，确认一下再往下录。
      </template>
    </a-alert>

    <!-- 锁了单的一单：表单仍然打开（要看要对照），但先说清保存会被后端拒，别让人填完才发现 -->
    <a-alert v-if="lockedNotice" type="warning" show-icon class="brief-intake__alert">
      <template #message>
        这一单现在是「{{ statusText }}」，后端只收 {{ editableStatusNames }} 两种状态的修改，
        所以这里保存一定会被拒（拒的理由是后端那句中文，原样显示在页面底部）。要改得等生成链路把状态挪回可编辑，
        或者回详情页看这一单到底走到哪一步了。
        <a-button size="small" type="link" @click="goDetail">看详情</a-button>
      </template>
    </a-alert>

    <a-alert v-if="vocabularyFailed" type="error" show-icon class="brief-intake__alert">
      <template #message>
        前采词表没取到：下面的题目是空的，不是没有题可录。
        <a-button size="small" type="link" @click="loadVocabulary">重新取词表</a-button>
      </template>
    </a-alert>

    <!-- 分步导航：段名与段序只认词表 groups 下发的那一份；取不到的段名宁可露码也不编一个 -->
    <nav v-if="isStepped" class="brief-intake__anchors" aria-label="分段导航">
      <a-button
        v-for="(section, index) in sectionAnchors"
        :key="section.code"
        size="small"
        :type="section.code === activeSection ? 'primary' : 'default'"
        @click="goToSection(section.code)"
      >
        {{ index + 1 }}. {{ sectionShortName(section.label) }}
      </a-button>
    </nav>

    <!-- 这一段走到哪儿了：题数与空题数都从当前这段的循环里数，不抄词表里的固定题数 -->
    <div v-if="isStepped" class="brief-intake__stepper">
      <span class="brief-intake__step-hint">
        第 {{ activeIndex + 1 }} / {{ sectionAnchors.length }} 段「{{ activeAnchor ? sectionShortName(activeAnchor.label) : '' }}」：
        本段 {{ loopQuestions.length }} 题，
        {{ unansweredInSection ? `还有 ${unansweredInSection} 题空着` : '本段没有空格子' }}
        <template v-if="showStaticCards && isStepped">
          （这一屏另挂参考站与补充说明两张固定卡，它们是表单的固定字段、不在词表题数里）
        </template>
        <template v-if="requiredUnansweredInSection.length">
          （其中打星必填的：{{ requiredUnansweredInSection.join('、') }}——保存会被后端要这一题）
        </template>
        。
      </span>
      <a-space>
        <a-button size="small" :disabled="activeIndex === 0" @click="stepSection(-1)">上一段</a-button>
        <a-button size="small" :disabled="activeIndex >= sectionAnchors.length - 1" @click="stepSection(1)">下一段</a-button>
      </a-space>
    </div>

    <div class="brief-intake__body">
      <div class="brief-intake__form">
        <p v-if="!questions.length && !vocabularyFailed" class="brief-intake__muted">词表加载中…</p>

        <!-- 一个 v-for 走完这一段的全部题：分段只是在「本段第一题」前插一条段标题，分屏不改提交形状 -->
        <template v-for="q in loopQuestions" :key="q.key">
          <div
            v-if="isSectionStart(q)"
            :id="sectionDomId(q.group || '')"
            class="brief-intake__section-head"
          >
            {{ sectionLabelOf(q) }}
          </div>

          <div class="brief-intake__question">
            <div class="brief-intake__q-label">
              {{ q.label }}
              <span v-if="q.required" class="brief-intake__req">必填</span>
              <span v-else class="brief-intake__opt">可跳过</span>
            </div>
            <div v-if="q.evidence" class="brief-intake__q-hint">{{ q.evidence }}</div>

            <a-radio-group
              v-if="q.select === 'single'"
              :value="textOf(q.key)"
              @update:value="(value: unknown) => onPickSingle(q.key, value)"
            >
              <a-space wrap>
                <a-radio v-for="opt in q.options" :key="opt.code" :value="opt.code">{{ opt.label }}</a-radio>
              </a-space>
            </a-radio-group>

            <a-checkbox-group
              v-else-if="q.select === 'multi'"
              :value="listOf(q.key)"
              @update:value="(value: unknown) => onPickList(q.key, value)"
            >
              <a-space wrap>
                <a-checkbox v-for="opt in q.options" :key="opt.code" :value="opt.code">{{ opt.label }}</a-checkbox>
              </a-space>
            </a-checkbox-group>

            <a-cascader
              v-else-if="q.select === 'cascade'"
              :value="listOf(q.key)"
              :options="cascaderOptions(q)"
              allow-clear
              style="width: 100%"
              placeholder="主分类 / 子分类"
              @update:value="(value: unknown) => onPickList(q.key, value)"
            />

            <!-- 客户原话的长格子：逐字进摘要，界面不缩写 -->
            <a-textarea
              v-else-if="q.select === 'textarea'"
              :value="textOf(q.key)"
              :rows="2"
              placeholder="可空：客户的原话逐字进摘要"
              @update:value="(value: unknown) => onPickText(q.key, value)"
            />

            <!-- 页面清单：逐页行编辑器。这些本地提示只是让人少跑几回后端，保存那一闸在服务端 -->
            <div v-else-if="q.select === 'pages'" class="brief-intake__pages">
              <div v-for="(page, pageIndex) in pageRows(q)" :key="pageIndex" class="brief-intake__page-row">
                <div class="brief-intake__page-line">
                  <span class="brief-intake__page-no">第 {{ pageIndex + 1 }} 页</span>
                  <a-input
                    class="brief-intake__page-key"
                    :value="page.key"
                    placeholder="标识 key（小写字母/数字/连字符）"
                    @update:value="(value: unknown) => onPageField(q, pageIndex, 'key', value)"
                  />
                  <a-input
                    class="brief-intake__page-slug"
                    :value="page.slug"
                    placeholder="网址段 slug（进客户站地址栏）"
                    @update:value="(value: unknown) => onPageField(q, pageIndex, 'slug', value)"
                  />
                  <a-input
                    class="brief-intake__page-title"
                    :value="page.title"
                    :maxlength="PAGE_TITLE_MAX"
                    placeholder="页面标题（界面上那一个字，客户怎么说怎么写）"
                    @update:value="(value: unknown) => onPageField(q, pageIndex, 'title', value)"
                  />
                  <a-button size="small" :disabled="pageIndex === 0" @click="movePage(q, pageIndex, -1)">上移</a-button>
                  <a-button size="small" :disabled="pageIndex === pageRows(q).length - 1" @click="movePage(q, pageIndex, 1)">下移</a-button>
                  <a-button size="small" @click="removePage(q, pageIndex)">删除</a-button>
                </div>
                <a-textarea
                  class="brief-intake__page-purpose"
                  :value="page.purpose"
                  :maxlength="PAGE_PURPOSE_MAX"
                  :rows="2"
                  placeholder="这一页干什么（给模型的一句话，可空）"
                  @update:value="(value: unknown) => onPageField(q, pageIndex, 'purpose', value)"
                />
                <div class="brief-intake__section-pick">
                  <div class="brief-intake__q-hint">挂哪个栏目（栏目名来自后端栏目词表；换掉了以前的裸下拉）</div>
                  <div class="brief-intake__section-cards">
                    <button
                      v-for="choice in sectionChoices"
                      :key="choice.key"
                      type="button"
                      class="brief-intake__section-card"
                      :class="{ 'is-active': (page.sectionKey || '') === choice.key }"
                      @click="pickPageSection(q, pageIndex, choice.key)"
                    >
                      <span class="brief-intake__section-name">{{ choice.label }}</span>
                      <span class="brief-intake__section-desc">{{ choice.desc }}</span>
                    </button>
                  </div>
                  <p v-if="sectionsFailed" class="brief-intake__catalog-fail">
                    栏目词表没取到：卡片只剩「不属于任何栏目」那一张。
                    <a-button size="small" type="link" @click="loadSections">重新取栏目词表</a-button>
                  </p>
                </div>
                <div class="brief-intake__page-blocks">
                  <div class="brief-intake__q-hint">这一页要哪些区块（可空＝交给规划的 plan 步骤挑；候选来自区块目录）</div>
                  <div v-for="(pageBlock, pageBlockIndex) in page.blocks" :key="pageBlockIndex" class="brief-intake__block-row">
                    <span>{{ blockLabel(pageBlock) }}</span>
                    <a-button size="small" :disabled="pageBlockIndex === 0" @click="movePageBlock(q, pageIndex, pageBlockIndex, -1)">上移</a-button>
                    <a-button size="small" :disabled="pageBlockIndex === page.blocks.length - 1" @click="movePageBlock(q, pageIndex, pageBlockIndex, 1)">下移</a-button>
                    <a-button size="small" @click="removePageBlock(q, pageIndex, pageBlockIndex)">删除</a-button>
                  </div>
                  <a-space wrap>
                    <a-select
                      :value="blockDraft[q.key + '|' + pageIndex] || undefined"
                      :options="blockOptions(page.blocks)"
                      :disabled="!blockCatalog.length"
                      placeholder="从区块目录挑一个"
                      style="width: 280px"
                      @update:value="(value: unknown) => (blockDraft[q.key + '|' + pageIndex] = String(value ?? ''))"
                    />
                    <a-button size="small" :disabled="!blockDraft[q.key + '|' + pageIndex]" @click="addPageBlock(q, pageIndex)">添加区块</a-button>
                  </a-space>
                </div>
                <div class="brief-intake__page-priority">
                  <span class="brief-intake__q-hint">优先级（再点一次已选中的档＝清回没排先后）：</span>
                  <a-button
                    v-for="code in PAGE_PRIORITY_CODES"
                    :key="code"
                    size="small"
                    :class="{ 'is-active': page.priority === code }"
                    @click="pickPagePriority(q, pageIndex, code)"
                  >
                    {{ code }}
                  </a-button>
                  <span v-if="!page.priority" class="brief-intake__muted">没排先后</span>
                </div>
              </div>
              <a-space wrap>
                <a-button size="small" :disabled="pageRows(q).length >= PAGE_PLAN_MAX" @click="addPage(q)">添加一页</a-button>
                <a-button size="small" @click="addPresetPage(q, 'home')">加一页：首页（home）</a-button>
                <a-button size="small" @click="addPresetPage(q, 'contact')">加一页：联系页（contact）</a-button>
              </a-space>
              <ul v-if="pageHints(q).length" class="brief-intake__page-hints">
                <li v-for="hint in pageHints(q)" :key="hint">{{ hint }}</li>
              </ul>
              <p class="brief-intake__muted">上面的提示镜像自后端判据、只为少跑几趟；保存被拒时，它的中文原因会逐条原样列在页面底部。</p>
              <p v-if="blocksFailed" class="brief-intake__catalog-fail">
                区块目录没取到：每页的区块候选是空的。
                <a-button size="small" type="link" @click="loadBlocks">重新取区块目录</a-button>
              </p>
            </div>

            <!-- 首页区块顺序：上下移动代替拖拽，候选来自 /portal/blocks（未接线的空壳被后端标志挡在候选外） -->
            <div v-else-if="q.select === 'block-order'" class="brief-intake__layout">
              <div v-for="(layoutBlock, layoutIndex) in listOf(q.key)" :key="layoutIndex" class="brief-intake__block-row">
                <span>{{ blockLabel(layoutBlock) }}</span>
                <a-button size="small" :disabled="layoutIndex === 0" @click="moveLayoutBlock(q, layoutIndex, -1)">上移</a-button>
                <a-button size="small" :disabled="layoutIndex === listOf(q.key).length - 1" @click="moveLayoutBlock(q, layoutIndex, 1)">下移</a-button>
                <a-button size="small" @click="removeLayoutBlock(q, layoutIndex)">删除</a-button>
              </div>
              <a-space wrap>
                <a-select
                  :value="blockDraft[q.key] || undefined"
                  :options="blockOptions(listOf(q.key))"
                  :disabled="!blockCatalog.length"
                  placeholder="从区块目录挑一个"
                  style="width: 280px"
                  @update:value="(value: unknown) => (blockDraft[q.key] = String(value ?? ''))"
                />
                <a-button size="small" :disabled="!blockDraft[q.key]" @click="addLayoutBlock(q)">添加区块</a-button>
              </a-space>
              <p class="brief-intake__muted">
                已排 {{ listOf(q.key).length }} 个；后端上限 {{ HOME_LAYOUT_MAX }} 个——超了保存会被逐条中文拒，这里不冒充那道闸。
              </p>
              <p v-if="blocksFailed" class="brief-intake__catalog-fail">
                区块目录没取到：候选是空的，不是没有区块可排。
                <a-button size="small" type="link" @click="loadBlocks">重新取区块目录</a-button>
              </p>
            </div>

            <div v-else-if="q.select === 'color'" class="brief-intake__color">
              <!-- 色块与十六进制格是同一份值的两种入口，不依赖组件库：
                   装在 node_modules 的 ant-design-vue 4.2.6 没有 ColorPicker，上一版这里写 `<a-color-picker>`
                   在浏览器里整块不渲（控制台只留一句 Failed to resolve component），而单测给这个标签打了桩所以全绿。 -->
              <input
                type="color"
                class="brief-intake__swatch"
                :value="swatchColor(q.key)"
                :disabled="colorAuto[q.key] === true"
                @input="(event: Event) => onPickColor(q.key, (event.target as HTMLInputElement).value)"
              />
              <a-input
                :value="colorAuto[q.key] === true ? '' : textOf(q.key)"
                :disabled="colorAuto[q.key] === true"
                placeholder="#RRGGBB"
                style="width: 130px"
                @update:value="(value: unknown) => onPickColor(q.key, value)"
              />
              <a-switch :checked="colorAuto[q.key] === true" @update:checked="(checked: unknown) => onToggleAuto(q.key, checked)" />
              <span class="brief-intake__q-hint">AI 决定</span>
            </div>

            <!-- 词表出现不认识的新形态时退化成输入框：宁可让人打字，也不猜语义。
                 placeholder 不抄 q.evidence——那句在题目下面已经念过一遍（`.brief-intake__q-hint`），
                 摆进输入格就是一句话两遍，而且词表里那几句曾以「表名（V133）：」开头，等于把 schema 念给录单的人。 -->
            <a-input
              v-else
              :value="textOf(q.key)"
              placeholder="按客户原话打这一行"
              @update:value="(value: unknown) => onPickText(q.key, value)"
            />

            <!-- 「跳过」要说人话：没填的格子不许看着像填好了（后端摘要段同样会照实写这一格没给） -->
            <p v-if="isUnanswered(q)" class="brief-intake__skip" :class="{ 'brief-intake__skip--required': q.required }">
              {{ q.required ? '必填：这一题还空着，保存会被后端拒（理由以它回的中文为准）' : '客户未提供——摘要里会照实写这一格没给，不留一个看着像填好的空框' }}
            </p>
          </div>
        </template>

        <!-- 参考站与补充说明这两块专用控件跟着它们在后端题表里的 group 走，不在每段都摆一遍 -->
        <template v-if="showStaticCards">
        <div class="brief-intake__question brief-intake__static">
          <div class="brief-intake__q-label">参考站（最多 {{ REFERENCE_MAX }} 个 URL，可空）</div>
          <div class="brief-intake__q-hint">有参考站就填地址；摄取与喂给模型是后链路的事，这一页不调用。</div>
          <div v-for="(_, index) in form.referenceRows" :key="index" class="brief-intake__ref-row">
            <a-input
              :value="form.referenceRows[index]"
              placeholder="https://example.com"
              style="flex: 1"
              @update:value="(value: unknown) => onReferenceInput(index, value)"
            />
            <a-button size="small" @click="removeReference(index)">删除</a-button>
          </div>
          <a-button
            size="small"
            :disabled="form.referenceRows.length >= REFERENCE_MAX"
            @click="addReference"
          >
            添加参考站
          </a-button>
        </div>

        <div class="brief-intake__question brief-intake__static">
          <div class="brief-intake__q-label">补充说明（兜底的自由文本，可空）</div>
          <a-textarea
            v-model:value="form.notes"
            :maxlength="NOTES_MAX"
            show-count
            :rows="3"
            placeholder="词表盖不住的那一句话才写在这里；能勾的别打字"
          />
        </div>
        </template>
      </div>

      <aside class="brief-intake__side">
        <div class="brief-intake__side-title">AI 将理解的这段话</div>
        <p v-if="summary" class="brief-intake__summary-text">{{ summary }}</p>
        <p v-else class="brief-intake__muted">还没有这段话：录几题后，这段由后端渲染的话会自动刷新。</p>
        <div v-if="summaryStale" class="brief-intake__stale">这段话还没刷新</div>
        <div v-else-if="summaryPending" class="brief-intake__muted">刷新中…</div>
        <div class="brief-intake__side-note">
          这段话由后端按词表渲染（summary-preview 端点），前端一字不拼；保存后以后端落库的那份为准。
        </div>
      </aside>
    </div>

    <div class="brief-intake__footer">
      <a-button type="primary" :loading="saving" @click="save">保存</a-button>
      <span class="brief-intake__muted">保存只写需求单本身；这一页不提供出方案/预览，那是生成链路接通后的事。</span>
    </div>
    <div v-if="saveError" class="brief-intake__save-error">{{ saveError }}</div>
  </div>
</template>

<style scoped>
.brief-intake__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}
.brief-intake__head h3 {
  margin: 0 0 4px;
}
.brief-intake__sub,
.brief-intake__muted {
  color: #6b7280;
  font-size: 13px;
}
.brief-intake__profile {
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}
.brief-intake__profile-label {
  color: #6b7280;
  font-size: 13px;
}
.brief-intake__bound-site {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}
.brief-intake__alert {
  margin-bottom: 16px;
}
/* 锚点导航：吸顶在录入区上方，段名是词表下发的那一份 */
.brief-intake__anchors {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}
/* 分步那一行的进度与翻页：题数从当前这段的循环里数，界面无一处写死 */
.brief-intake__stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.brief-intake__step-hint {
  color: #6b7280;
  font-size: 13px;
}
.brief-intake__head--embedded {
  margin-bottom: 8px;
}
.brief-intake__section-head {
  padding: 10px 0 6px;
  margin-top: 8px;
  font-weight: 700;
  font-size: 15px;
  color: #111827;
  border-bottom: 2px solid #e5e7eb;
  scroll-margin-top: 64px;
}
.brief-intake__body {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.brief-intake__form {
  flex: 1;
  min-width: 0;
}
.brief-intake__question {
  padding: 12px 0;
  border-bottom: 1px dashed #f0f0f0;
}
.brief-intake__q-label {
  font-weight: 600;
  margin-bottom: 8px;
}
.brief-intake__req {
  margin-left: 8px;
  color: #cf1322;
  font-size: 12px;
}
.brief-intake__opt {
  margin-left: 8px;
  color: #9ca3af;
  font-size: 12px;
}
.brief-intake__q-hint {
  color: #9ca3af;
  font-size: 12px;
  margin-bottom: 8px;
}
/* 「客户未提供」：可跳过题的显式空态；必填还空着的那一句用红色，两样都不许看着像填好了 */
.brief-intake__skip {
  margin: 8px 0 0;
  font-size: 12px;
  color: #d46b08;
}
.brief-intake__skip--required {
  color: #cf1322;
}
.brief-intake__pages {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.brief-intake__page-row {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.brief-intake__page-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.brief-intake__page-no {
  color: #6b7280;
  font-size: 12px;
}
.brief-intake__page-key,
.brief-intake__page-slug {
  width: 160px;
}
.brief-intake__page-title {
  flex: 1;
  min-width: 200px;
}
.brief-intake__section-cards {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
/* 栏目卡片：带说明的单选（客户/超管点名旧的裸下拉太丑）；名字一份都不抄，全来自后端栏目词表 */
.brief-intake__section-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 140px;
  padding: 8px 10px;
  text-align: left;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
}
.brief-intake__section-card.is-active {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.12);
}
.brief-intake__section-name {
  font-weight: 600;
  font-size: 13px;
}
.brief-intake__section-desc {
  color: #9ca3af;
  font-size: 12px;
}
.brief-intake__block-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.brief-intake__page-priority .is-active {
  border-color: #1677ff;
  color: #1677ff;
}
.brief-intake__page-hints {
  margin: 0;
  padding-left: 18px;
  color: #d46b08;
  font-size: 12px;
}
.brief-intake__catalog-fail {
  margin: 4px 0 0;
  color: #cf1322;
  font-size: 12px;
}
.brief-intake__color {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brief-intake__swatch {
  width: 36px;
  height: 30px;
  padding: 0;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}
.brief-intake__swatch:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.brief-intake__color .brief-intake__q-hint {
  margin-bottom: 0;
}
.brief-intake__ref-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.brief-intake__side {
  width: 340px;
  flex: none;
  position: sticky;
  top: 48px;
  padding: 16px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 6px;
}
.brief-intake__side-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.brief-intake__summary-text {
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0 0 8px;
}
.brief-intake__stale {
  color: #d46b08;
  font-size: 13px;
}
.brief-intake__side-note {
  margin-top: 12px;
  color: #9ca3af;
  font-size: 12px;
}
.brief-intake__footer {
  margin-top: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.brief-intake__save-error {
  margin-top: 8px;
  color: #cf1322;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
