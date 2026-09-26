<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  briefIsEditable,
  briefStatusLabelOrCode,
  buildBriefForm,
  EDITABLE_BRIEF_STATUSES,
  intakeLoopQuestions,
  readBriefSelections,
  siteBriefsApi,
  vocabularyApi,
  type BriefVocabularyQuestion,
  type SiteBrief,
  type SiteBriefForm,
  type SiteBriefVocabulary
} from '@/api/siteBriefs'
import { siteApi, tenantApi } from '@/api/workspace'
import type { Tenant } from '@/types/workspace'

/**
 * 前采需求单录入（Spec §4.1 / §7，任务 P1）。
 *
 * 三条纪律钉在这页：
 * 1. **13 题按词表循环渲染**——题目名、选项、单选还是多选全部来自
 *    `GET /admin/site-briefs/vocabulary`，模板里不许写死任何一个题目或选项
 *    （`site-brief-vocabulary.spec.ts` 扫源码守着）；
 * 2. **以勾选为主**：`notes` 是唯一自由文本且可空；
 * 3. **右侧那段话是后端渲染的**：只调 `summary-preview` 取（300ms debounce），
 *    失败时保留上一次结果并原话标「这段话还没刷新」——前端自己拼一句就等于抄了第二份词表。
 *
 * 这一页没有任何调用生成/估算的按钮（P3 才有），也不摆点不动的死链。
 *
 * 两条交棒入口（任务 P2 第 3 件的接收端）：
 * - `/portal/brief/new?tenantId=15`（租户管理那行「去录前采」）：租户从地址预填，用户不用重挑；
 * - 编辑一单时若它已不在 `draft/ready`，页面顶部先说清「保存会被后端拒」，并给回详情页的入口。
 */

/** color 题「AI 决定」的落库哨兵值：与后端词表里那条选项的 code 同一个码，不是自造的 */
const COLOR_AUTO = 'ai'
const NOTES_MAX = 500
const REFERENCE_MAX = 3
const PREVIEW_DEBOUNCE_MS = 300

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

/** 勾选结果：key 只可能来自词表（q.key），这里从不登记任何固定题目名 */
const selections = reactive<Record<string, string | string[]>>({})
const colorAuto = reactive<Record<string, boolean>>({})

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
  return Array.isArray(value) ? value : []
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

/** color 题的「AI 决定」开关：开 = 落哨兵值让后端自己定，关 = 回到取色器 */
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

function snapshotSelections(): Record<string, string | string[]> {
  const copy: Record<string, string | string[]> = {}
  Object.keys(selections).forEach(key => {
    const value = selections[key]
    copy[key] = Array.isArray(value) ? [...value] : value
  })
  return copy
}

function buildPayload(): SiteBriefForm {
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
    snapshotSelections()
  )
}

/** 保证每个词表题目都有形状（multi/cascade 是数组，其它是字符串），并认出 color 的哨兵值 */
function ensureShape() {
  questions.value.forEach(question => {
    const existing = selections[question.key]
    if (existing === undefined) {
      selections[question.key] = question.select === 'multi' || question.select === 'cascade' ? [] : ''
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

async function loadVocabulary() {
  vocabularyFailed.value = false
  try {
    vocabulary.value = await vocabularyApi.adminVocabulary()
    ensureShape()
    if (briefId.value === null) {
      const modes = vocabulary.value?.demoContentModes ?? []
      const full = modes.find(mode => mode.value === 'full')
      form.demoContentMode = (full ?? modes[0])?.value ?? ''
      form.candidateCount = clampCandidate(candidateMax.value)
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

function applyBrief(brief: SiteBrief) {
  briefId.value = brief.id ?? null
  status.value = brief.status || ''
  form.tenantId = brief.tenantId ?? null
  form.siteId = brief.siteId ?? null
  form.candidateCount = brief.candidateCount || 1
  form.demoContentMode = brief.demoContentMode || ''
  // 平铺字段按题目 key 回填成勾选袋；参考站/补充说明走元信息
  Object.entries(readBriefSelections(questions.value, brief)).forEach(([key, value]) => {
    selections[key] = Array.isArray(value) ? [...value] : String(value ?? '')
  })
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
  saving.value = true
  try {
    const payload = buildPayload()
    const wasNew = briefId.value === null
    const saved = wasNew
      ? await siteBriefsApi.create(payload)
      : await siteBriefsApi.update(briefId.value as number, payload)
    message.success('保存成功')
    if (saved) applyBrief(saved)
    if (wasNew && saved?.id) {
      router.replace({ name: 'workspace-portal-brief-intake', params: { id: String(saved.id) } })
    }
  } catch (error) {
    // 只有 draft/ready 能改，其他状态后端回一句中文拒绝理由：原样显示，一个字不改
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
  const parsed = Number(route.params.id)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** 地址里带的租户号（`/portal/brief/new?tenantId=15`）：只有它才允许预填租户 */
function routeTenantId(): number | null {
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

onMounted(async () => {
  booting.value = true
  const id = routeBriefId()
  await Promise.all([loadTenants(), loadSites()])
  if (id === null) {
    const fromQuery = routeTenantId()
    if (fromQuery !== null) {
      form.tenantId = fromQuery
      tenantFromQuery.value = true
    }
  }
  if (id !== null) await loadBrief(id)
  await loadVocabulary()
  ensureShape()
  await nextTick()
  booting.value = false
})
</script>

<template>
  <div class="brief-intake">
    <div class="brief-intake__head">
      <div>
        <h3>{{ briefId ? '编辑前采需求单' : '新建前采需求单' }}</h3>
        <p class="brief-intake__sub">
          这条头上定三件事：这单给哪个租户、出几套候选、演示内容哪一档。下面每题按词表勾，只有「补充说明」可以打字，而且可空。
        </p>
      </div>
      <a-space wrap>
        <a-tag v-if="status">当前状态：{{ statusText }}</a-tag>
        <a-button @click="backToList">返回列表</a-button>
        <a-button v-if="briefId" @click="goDetail">看这一单的详情</a-button>
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
        租户是从「租户管理」那一行带过来的（#{{ form.tenantId }}）：这一单就记在它名下，确认一下再往下勾题。
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
        前采词表没取到：下面的题目是空的，不是没有题可勾。
        <a-button size="small" type="link" @click="loadVocabulary">重新取词表</a-button>
      </template>
    </a-alert>

    <div class="brief-intake__body">
      <div class="brief-intake__form">
        <p v-if="!questions.length && !vocabularyFailed" class="brief-intake__muted">词表加载中…</p>

        <div v-for="q in questions" :key="q.key" class="brief-intake__question">
          <div class="brief-intake__q-label">{{ q.label }}</div>
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

          <div v-else-if="q.select === 'color'" class="brief-intake__color">
            <a-color-picker
              :value="textOf(q.key)"
              :disabled="colorAuto[q.key] === true"
              show-value
              @update:value="(value: unknown) => onPickColor(q.key, value)"
            />
            <a-switch :checked="colorAuto[q.key] === true" @update:checked="(checked: unknown) => onToggleAuto(q.key, checked)" />
            <span class="brief-intake__q-hint">AI 决定</span>
          </div>

          <!-- 词表出现不认识的新形态时退化成输入框：宁可让人打字，也不猜语义 -->
          <a-input
            v-else
            :value="textOf(q.key)"
            :placeholder="q.evidence || ''"
            @update:value="(value: unknown) => onPickText(q.key, value)"
          />
        </div>

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
          <div class="brief-intake__q-label">补充说明（唯一可打字的地方，可空）</div>
          <a-textarea
            v-model:value="form.notes"
            :maxlength="NOTES_MAX"
            show-count
            :rows="3"
            placeholder="词表盖不住的那一句话才写在这里；能勾的别打字"
          />
        </div>
      </div>

      <aside class="brief-intake__side">
        <div class="brief-intake__side-title">AI 将理解的这段话</div>
        <p v-if="summary" class="brief-intake__summary-text">{{ summary }}</p>
        <p v-else class="brief-intake__muted">还没有这段话：勾几题后，这段由后端渲染的话会自动刷新。</p>
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
.brief-intake__q-hint {
  color: #9ca3af;
  font-size: 12px;
  margin-bottom: 8px;
}
.brief-intake__color {
  display: flex;
  align-items: center;
  gap: 8px;
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
  top: 16px;
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
}
</style>
