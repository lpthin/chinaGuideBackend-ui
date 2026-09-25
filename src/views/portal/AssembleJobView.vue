<template>
  <div class="assemble-job-page">
    <a-alert type="info" show-icon class="assemble-job-page__notice">
      <template #message>
        AI 整站组装要跑两步模型（整站规划 + 逐页文案），扣的是这个站点所属租户的 token 配额，
        所以这一页没有「一键整站上线」：先估算、看过预估再亲手勾确认才调用模型；调用之后拿到的仍然只是逐页草稿，
        访客能看到什么，只由「应用这一页」这一个一个的点击决定。这条路只有平台侧走得通（N4：组件搭建与组装归超管），租户侧没有它。
      </template>
    </a-alert>

    <!-- ---------------- 第 1 步：建任务（不花钱） ---------------- -->
    <a-card size="small" title="1 建一个组装任务（只存快照，不调模型）" class="assemble-job-page__panel">
      <a-form layout="inline" class="assemble-job-page__create">
        <a-form-item label="站点">
          <a-select
            v-model:value="siteId"
            style="width: 240px"
            :options="siteOptions"
            placeholder="选一个要组装的站点"
            @change="onSiteChange"
          />
        </a-form-item>
        <a-form-item label="按哪套骨架">
          <a-select
            v-model:value="createForm.skeletonKey"
            style="width: 260px"
            :options="publishedSkeletonOptions"
            placeholder="只列已发布的骨架"
          />
        </a-form-item>
        <a-form-item label="参考站（可留空）">
          <a-select
            v-model:value="createForm.referenceSiteId"
            style="width: 240px"
            allow-clear
            :options="referenceOptions"
            placeholder="不用参考站"
          />
        </a-form-item>
        <a-form-item class="toolbar-actions">
          <a-space wrap>
            <a-button :loading="loadingBase" @click="loadBaseData">刷新站点与骨架</a-button>
            <a-button type="primary" :disabled="!canCreate" :loading="creating" @click="submitCreate">
              新建组装任务
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
      <p v-if="referencesError" class="assemble-job-page__muted">{{ referencesError }}</p>
      <p class="assemble-job-page__muted">
        建任务只是把「当时的站点画像 + 骨架页面清单」拍成快照存下来，一次模型都不调；花钱的是下面第 3 步。
        没发布的骨架不进下拉——最终裁判是后端的 requirePublished，这里只是不把注定失败的选项摆出来。
      </p>
      <p v-if="sitesError" class="assemble-job-page__error">{{ sitesError }}</p>
      <p v-else-if="!loadingBase && !sites.length" class="assemble-job-page__error">
        一个站点都取不到：这个账号名下没有站点，先去系统管理 &gt; 站点管理建一个。
      </p>
      <p v-else-if="!publishedSkeletonOptions.length" class="assemble-job-page__error">
        骨架库里现在没有可组装的骨架——整站组装必须按一套骨架来，先去骨架库确认它的状态。
      </p>
    </a-card>

    <!-- ---------------- 第 2 步：这个站点的任务历史 ---------------- -->
    <a-card size="small" title="2 本站的组装任务" class="assemble-job-page__panel">
      <a-alert v-if="jobsError" type="error" show-icon class="assemble-job-page__notice" :message="jobsError" />
      <a-table
        :data-source="jobs"
        :columns="jobColumns"
        :loading="loadingJobs"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ x: 1080 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'skeleton'">
            <span>{{ skeletonNameOf(record.skeletonKey) }}</span>
            <div class="assemble-job-page__muted">{{ record.skeletonKey }} · v{{ record.skeletonVersion ?? '?' }}</div>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'tokens'">
            <div>预估 {{ record.estimatedTokens ?? '—' }}</div>
            <div class="assemble-job-page__muted">实耗 {{ tokensUsedOf(record) }}</div>
          </template>
          <template v-else-if="column.key === 'error'">
            <a-tooltip v-if="record.errorMessage" :title="record.errorMessage">
              <span class="assemble-job-page__error">{{ record.errorMessage }}</span>
            </a-tooltip>
            <span v-else class="assemble-job-page__muted">—</span>
          </template>
          <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
          <template v-else-if="column.key === 'op'">
            <a-button size="small" type="link" @click="openDetail(record.id)">看产出与操作</a-button>
          </template>
        </template>
        <template #emptyText>
          <!-- 读失败时不说「还没有任务」：那是把一次 403 说成「这站干净」，是骗人的空状态 -->
          <a-empty v-if="!jobsError" description="这个站点还没有组装任务：上面第 1 步建一个（建任务不花钱）" />
        </template>
      </a-table>
    </a-card>

    <!-- ---------------- 第 3 步：出价 → 确认 → 逐页草稿 ---------------- -->
    <a-card v-if="job" size="small" :title="`3 任务 #${job.id}：出价、组装、逐页应用`" class="assemble-job-page__panel">
      <a-spin :spinning="detailLoading">
        <a-descriptions :column="3" size="small" bordered>
          <a-descriptions-item label="状态">
            <a-tag :color="statusColor(job.status)">{{ statusText(job.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="骨架">{{ job.skeletonKey }} v{{ job.skeletonVersion ?? '?' }}</a-descriptions-item>
          <a-descriptions-item label="参考站">{{ referenceText(job.referenceSiteId) }}</a-descriptions-item>
          <a-descriptions-item label="预估 token">{{ job.estimatedTokens ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="实耗 token">{{ tokensUsedOf(job) }}</a-descriptions-item>
          <a-descriptions-item label="创建人">{{ job.createdBy || '—' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatDateTime(job.createdAt) }}</a-descriptions-item>
          <a-descriptions-item v-if="job.errorMessage" label="最近一次结果" :span="3">
            <span class="assemble-job-page__error">{{ job.errorMessage }}</span>
          </a-descriptions-item>
        </a-descriptions>

        <a-alert
          v-if="detailError"
          type="error"
          show-icon
          class="assemble-job-page__notice"
          :message="detailError"
        />

        <a-space wrap class="assemble-job-page__actions">
          <a-button :disabled="!canEstimate" :loading="estimating" @click="runEstimate">先估算消耗</a-button>
          <a-checkbox
            v-model:checked="confirmChecked"
            class="assemble-job-page__confirm"
            :disabled="!canConfirm"
          >
            我已看过这次预估，确认整站组装会消耗租户配额
          </a-checkbox>
          <a-button type="primary" :disabled="!canRun" :loading="running" @click="runAssemble">
            开始整站组装
          </a-button>
          <a-popconfirm
            :title="`确认回滚本任务应用过的 ${appliedCount} 页？访客会退回这些页组装前的版本`"
            :disabled="!canRollback"
            @confirm="rollbackAll"
          >
            <a-button danger :disabled="!canRollback" :loading="rollingBack">回滚本任务应用过的页面</a-button>
          </a-popconfirm>
          <a-button :loading="detailLoading" @click="refreshDetail">刷新产出</a-button>
        </a-space>
        <p class="assemble-job-page__muted">
          「先估算消耗」只算不调模型；「开始整站组装」会真的跑两步并扣配额，所以必须先看过预估、再亲手勾选上面那个确认框。
          组装是同步的：这一发请求回来就是结果，没有轮询，也不需要有人在这儿替它「推进状态」。
        </p>
        <p v-if="!estimate && !settled" class="assemble-job-page__muted">
          还没有预估，「开始整站组装」是灭的——别让一次点击在没人看过价格的情况下发生。
        </p>
        <p v-if="settled" class="assemble-job-page__error">
          这个任务已经落定（{{ statusText(job.status) }}），这一轮不能再按组装：要重来请回第 1 步新建一个任务，
          因为一笔账按任务 id 记，复用旧任务会把两次的钱记成一笔。
        </p>
        <p v-else-if="confirmChecked" class="assemble-job-page__error">
          确认框已经勾上了：再点「开始整站组装」就会真的调用模型并扣配额。要收手就先把勾去掉。
        </p>

        <a-alert v-if="estimate" type="info" show-icon class="assemble-job-page__notice" :message="estimateMessage" />
        <a-alert
          v-if="estimate && !estimate.aiEnabled"
          type="warning"
          show-icon
          class="assemble-job-page__notice"
          :message="estimate.notice || '后端没有说明这一路为什么没开'"
          description="这不是一个可以花的报价：开关没开的时候，点下去只会拿回一条中文错误，模型一次都不会调。所以「开始整站组装」在这里是灭的。"
        />

        <a-alert
          type="warning"
          show-icon
          class="assemble-job-page__notice"
          message="草稿不会自己见客：下面每一页都要单独点「应用这一页」，全表没有任何一个批量入口"
        />
        <p class="assemble-job-page__muted">
          已应用 {{ appliedCount }} 页（回滚只退回这 {{ appliedCount }} 页）；
          可应用 {{ applicableCount }} 页；被门禁拒 {{ rejectedCount }} 页；没产出草稿 {{ noDraftCount }} 页。
        </p>

        <a-table
          :data-source="drafts"
          :columns="draftColumns"
          :pagination="false"
          row-key="pageKey"
          size="small"
          :scroll="{ x: 980 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'page'">
              <div>{{ record.title || '（后端没给标题）' }}</div>
              <div class="assemble-job-page__muted">
                {{ record.pageKey }}<span v-if="record.pageId !== null"> · 页面 {{ record.pageId }}</span>
                <span v-else> · 站点上已经没有这一页</span>
              </div>
            </template>
            <template v-else-if="column.key === 'state'">
              <a-tag :color="draftStateColor(stateOf(record))">{{ draftStateText(stateOf(record)) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'notes'">
              <p v-if="record.error" class="assemble-job-page__error">{{ record.error }}</p>
              <ul v-if="record.warnings && record.warnings.length" class="assemble-job-page__warnings">
                <li v-for="warning in record.warnings" :key="warning">{{ warning }}</li>
              </ul>
              <span v-if="!record.error && !(record.warnings && record.warnings.length)" class="assemble-job-page__muted">
                没有门禁原因，也没有素材来源提示
              </span>
            </template>
            <template v-else-if="column.key === 'op'">
              <a-button
                size="small"
                type="link"
                :disabled="!canApplyRow(record)"
                :loading="applyingPageId === record.pageId"
                @click="applyRow(record)"
              >
                应用这一页
              </a-button>
            </template>
          </template>
          <template #emptyText>
            <a-empty description="这一轮还没有产出：先把第 3 步的「先估算消耗 → 勾选确认 → 开始整站组装」走完" />
          </template>
        </a-table>
      </a-spin>
    </a-card>

    <a-alert
      v-else-if="selectedJobId"
      type="error"
      show-icon
      class="assemble-job-page__panel"
      :message="detailError || '这个任务读不出来'"
    />
    <a-card v-else size="small" title="3 出价、组装、逐页应用" class="assemble-job-page__panel">
      <p class="assemble-job-page__muted">
        还没选中任务。上面第 2 步点「看产出与操作」才会展开第 3 步——这一段刻意不做成默认展开：
        一进来就摆出一堆烧钱按钮不是好设计。
      </p>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  assembleIsSettled,
  assembleTokensUsed,
  draftRowState,
  portalAssembleApi,
  type AssembleDraftRow,
  type AssembleDraftState,
  type AssembleEstimate,
  type AssembleTokenTally,
  type PortalAssembleJob
} from '../../api/portalAssemble'
import { portalSkeletonsApi, type SkeletonView } from '../../api/portalSkeletons'
import { portalReferenceApi, type ReferenceSite } from '../../api/referenceSites'
import { siteApi } from '../../api/workspace'
import { describeHttpError } from '../../api/http'
import { formatDateTime } from '../../utils/format'

/**
 * AI 整站组装任务视图（Spec §6.3，Q3；N4：只有平台能发起）。
 *
 * 这一页把后端的三道闸原样摆出来，一道都不合并：
 * 1. 建任务不花钱（只存快照），所以它放在最上面且没有任何 confirm 概念；
 * 2. 出价（estimate）与组装（run）是两次请求：没看过预估就点不动组装，勾了确认框才点得动，
 *    界面上的 confirmChecked 只可能是超管亲手勾的，任何一次请求都不许默认带 true；
 * 3. 组装产出的只是逐页草稿——应用一页是一次点击，页面里刻意不提供批量应用；
 *    回滚要 popconfirm 再确认一次，且只退回本任务应用过的那几页。
 *
 * 状态的中文说法全部来自 `/admin/portal/assemble-jobs/statuses`（I-1：前端不抄第二份词表）。
 * 组装是同步跑完的动作，所以这里没有轮询：请求回来读 detail 就是真相，
 * 「已应用/被门禁拒/没产出草稿」这三种落点各自一句话，不把「白烧了 token」说成「没干活」。
 */

const DRAFT_STATE_TEXT: Record<AssembleDraftState, string> = {
  'no-draft': '没产出草稿',
  rejected: '被门禁拒',
  applied: '已应用',
  applicable: '可应用'
}

const DRAFT_STATE_COLOR: Record<AssembleDraftState, string> = {
  'no-draft': 'default',
  rejected: 'orange',
  applied: 'green',
  applicable: 'blue'
}

const jobColumns = [
  { title: '编号', dataIndex: 'id', key: 'id', width: 72 },
  { title: '骨架', key: 'skeleton', width: 220 },
  { title: '状态', key: 'status', width: 130 },
  { title: 'token', key: 'tokens', width: 150 },
  { title: '最近一次结果', key: 'error', width: 240 },
  { title: '创建人', dataIndex: 'createdBy', key: 'createdBy', width: 110 },
  { title: '创建时间', key: 'createdAt', width: 170 },
  { title: '操作', key: 'op', width: 130, fixed: 'right' as const }
]

const draftColumns = [
  { title: '页面', key: 'page', width: 240 },
  { title: '这一页的落点', key: 'state', width: 120 },
  { title: '门禁原因 / 素材来源提示', key: 'notes', width: 380 },
  { title: '操作', key: 'op', width: 120, fixed: 'right' as const }
]

const sites = ref<Array<{ id: number; name: string }>>([])
const skeletons = ref<SkeletonView[]>([])
const references = ref<ReferenceSite[]>([])
const statusLabels = ref<Record<string, string>>({})
const jobs = ref<PortalAssembleJob[]>([])

const siteId = ref<number | null>(null)
const loadingBase = ref(false)
const loadingJobs = ref(false)
const creating = ref(false)
const sitesError = ref('')
const referencesError = ref('')
const jobsError = ref('')

/** 建任务表单里没有 confirm 这个东西：这一步不花钱，花钱的确认归第 3 步 */
const createForm = reactive<{ skeletonKey: string | undefined; referenceSiteId: number | null }>({
  skeletonKey: undefined,
  referenceSiteId: null
})

const selectedJobId = ref<number | null>(null)
const job = ref<PortalAssembleJob | null>(null)
const drafts = ref<AssembleDraftRow[]>([])
const detailLoading = ref(false)
const detailError = ref('')

const estimate = ref<AssembleEstimate | null>(null)
const estimating = ref(false)
const running = ref(false)
const rollingBack = ref(false)
/** 应用是逐页的动作，一次只可能有一页在路上：这个 id 就是那一行的 loading 依据 */
const applyingPageId = ref<number | null>(null)
const confirmChecked = ref(false)

const siteOptions = computed(() => sites.value.map(site => ({ value: site.id, label: site.name })))

/**
 * 只有已发布的骨架能当组装的底本。这里筛的是后端的原始状态 key（显示名仍来自词表/骨架列表），
 * 目的是不把注定被 requirePublished 拒掉的选项摆出来；能不能组装仍然由后端说了算。
 */
const publishedSkeletonOptions = computed(() =>
  skeletons.value
    .filter(item => item.status === 'published')
    .map(item => ({ value: item.skeletonKey, label: `${item.name}（${item.pages?.length ?? 0} 页）` }))
)

const referenceOptions = computed(() =>
  references.value.map(item => ({
    value: item.id,
    label: `#${item.id} ${item.sourceUrl || '（截图任务，没有网址）'}`
  }))
)

/** 任何一个花钱或写数据的请求在路上，其他写动作一律先灭掉：连点两次就是两次扣费 */
const busy = computed(
  () => estimating.value || running.value || creating.value || rollingBack.value || applyingPageId.value !== null
)

const settled = computed(() => assembleIsSettled(job.value?.status))

const canCreate = computed(
  () => !!siteId.value && !!createForm.skeletonKey && !busy.value && !loadingBase.value
)

const canEstimate = computed(() => !!job.value && !settled.value && !busy.value)

/** 预估必须属于当前这个任务：换过任务之后的旧报价不能拿来确认 */
const estimateMatches = computed(() => !!estimate.value && !!job.value && estimate.value.jobId === job.value.id)

/**
 * 确认框能勾的前提是「手里有一份属于当前任务、而且真的能花的报价」：
 * aiEnabled 为 false 时那份预估不是报价（后端明确说了确认也不会调用），
 * 所以连确认都不给勾——别让超管按下去才知道这一路没开。
 */
const canConfirm = computed(
  () => estimateMatches.value && estimate.value?.aiEnabled === true && !settled.value && !busy.value
)

const canRun = computed(
  () =>
    !!job.value &&
    !busy.value &&
    !settled.value &&
    estimateMatches.value &&
    // 后端没开这一路时给的是「未开启」的说明而不是报价，界面不该假装能下单
    estimate.value?.aiEnabled === true &&
    confirmChecked.value
)

const appliedRows = computed(() => drafts.value.filter(row => draftRowState(row) === 'applied'))
const appliedCount = computed(() => appliedRows.value.length)
const applicableCount = computed(() => drafts.value.filter(row => draftRowState(row) === 'applicable').length)
const rejectedCount = computed(() => drafts.value.filter(row => draftRowState(row) === 'rejected').length)
const noDraftCount = computed(() => drafts.value.filter(row => draftRowState(row) === 'no-draft').length)

/** 回滚要真的退回过东西才有意义：一页都没应用过时灭着，省一次 ASSEMBLE_NOTHING_APPLIED */
const canRollback = computed(() => !!job.value && appliedCount.value > 0 && !busy.value)

const estimateMessage = computed(() => {
  const current = estimate.value
  if (!current) return ''
  const base = `预计 ${current.estimatedTokens} token，该租户剩余配额 ${current.remainingTokens} token`
  return current.notice ? `${base}。${current.notice}` : base
})

function statusText(status: string | null | undefined): string {
  if (!status) return '—'
  // 词表里没有的状态原样写出来：前端不替后端编一个中文名
  return statusLabels.value[status] || status
}

function statusColor(status: string): string {
  if (status === 'done') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'needs_human') return 'orange'
  if (status === 'estimating') return 'blue'
  return 'default'
}

function stateOf(row: AssembleDraftRow): AssembleDraftState {
  return draftRowState(row)
}

function draftStateText(state: AssembleDraftState): string {
  return DRAFT_STATE_TEXT[state]
}

function draftStateColor(state: AssembleDraftState): string {
  return DRAFT_STATE_COLOR[state]
}

function canApplyRow(row: AssembleDraftRow): boolean {
  // 一次一页：被门禁拒的、压根没草稿的行永远点不动
  return !busy.value && draftRowState(row) === 'applicable'
}

function tokensUsedOf(row: AssembleTokenTally): string {
  const used = assembleTokensUsed(row)
  return used === null ? '还没跑' : `${used}`
}

function skeletonNameOf(skeletonKey: string): string {
  const found = skeletons.value.find(item => item.skeletonKey === skeletonKey)
  // 查不到就只报 key：骨架可能已经退役，这里不替它编名字
  return found ? found.name : skeletonKey
}

function referenceText(id: number | null): string {
  if (id === null || id === undefined) return '不用参考站'
  const found = references.value.find(item => item.id === id)
  return found ? `#${id} ${found.sourceUrl || '（截图任务）'}` : `#${id}`
}

function fail(fallback: string, error: unknown): string {
  return describeHttpError(error) || fallback
}

async function loadBaseData() {
  loadingBase.value = true
  sitesError.value = ''
  try {
    const [siteList, skeletonList] = await Promise.all([siteApi.list(), portalSkeletonsApi.list()])
    sites.value = (siteList || []).map((site: { id: number; name: string }) => ({ id: site.id, name: site.name }))
    skeletons.value = skeletonList || []
  } catch (error) {
    sites.value = []
    skeletons.value = []
    sitesError.value = fail('站点或骨架列表加载失败', error)
  } finally {
    loadingBase.value = false
  }
  await loadReferences()
}

/** 参考站只是可选语料：它读不到不该把整页变成错误页，只在提示里说一句 */
async function loadReferences() {
  referencesError.value = ''
  try {
    references.value = await portalReferenceApi.list()
  } catch (error) {
    references.value = []
    referencesError.value = `参考站列表没取到（${fail('未知原因', error)}）：不影响建任务，可以先不用参考站组装`
  }
}

async function loadJobs() {
  if (!siteId.value) {
    jobs.value = []
    jobsError.value = ''
    return
  }
  loadingJobs.value = true
  try {
    jobs.value = await portalAssembleApi.list(siteId.value)
  } catch (error) {
    jobs.value = []
    jobsError.value = fail('组装任务列表加载失败', error)
  } finally {
    loadingJobs.value = false
  }
}

/** 换站点等于换了一批任务：详情、预估、勾都跟着作废，不能把上一站的确认带到这一站 */
async function onSiteChange() {
  closeDetail()
  await loadJobs()
}

function closeDetail() {
  selectedJobId.value = null
  job.value = null
  drafts.value = []
  detailError.value = ''
  estimate.value = null
  confirmChecked.value = false
}

async function submitCreate() {
  if (!canCreate.value || !siteId.value || !createForm.skeletonKey) return
  creating.value = true
  try {
    const created = await portalAssembleApi.create({
      siteId: siteId.value,
      skeletonKey: createForm.skeletonKey,
      referenceSiteId: createForm.referenceSiteId ?? null
    })
    message.success('任务已建好：这一步只存了快照，一次模型都没调。要看产出请先在第 3 步出价')
    await loadJobs()
    await openDetail(created.id)
  } catch (error) {
    message.error(fail('建任务失败', error))
  } finally {
    creating.value = false
  }
}

async function openDetail(id: number) {
  selectedJobId.value = id
  job.value = null
  drafts.value = []
  detailError.value = ''
  estimate.value = null
  confirmChecked.value = false
  await refreshDetail()
}

async function refreshDetail() {
  if (!selectedJobId.value) return
  detailLoading.value = true
  try {
    const view = await portalAssembleApi.detail(selectedJobId.value)
    job.value = view.job
    drafts.value = view.drafts || []
    detailError.value = ''
  } catch (error) {
    job.value = null
    drafts.value = []
    detailError.value = fail('任务详情加载失败', error)
  } finally {
    detailLoading.value = false
  }
}

async function runEstimate() {
  if (!canEstimate.value || !job.value) return
  estimating.value = true
  // 出价之前先把旧的确认收回：新价格没看过，勾就不该还留着
  confirmChecked.value = false
  estimate.value = null
  try {
    estimate.value = await portalAssembleApi.estimate(job.value.id)
  } catch (error) {
    estimate.value = null
    message.error(fail('预估失败', error))
  } finally {
    estimating.value = false
  }
}

async function runAssemble() {
  const current = job.value
  // 二次守卫：这一发的语义是「花钱」，调用方没勾确认也不许替它勾上
  if (!current || !canRun.value) return
  running.value = true
  try {
    const updated = await portalAssembleApi.run(current.id, true)
    job.value = updated
    confirmChecked.value = false
    message.success('这一轮组装已经跑完（同步执行）：产出是逐页草稿，访客还看不到，请在下面逐页核对后点「应用这一页」')
    await Promise.all([refreshDetail(), loadJobs()])
  } catch (error) {
    message.error(fail('组装启动失败', error))
    await Promise.all([refreshDetail(), loadJobs()])
  } finally {
    running.value = false
  }
}

async function applyRow(row: AssembleDraftRow) {
  const current = job.value
  if (!current || !canApplyRow(row) || row.pageId === null) return
  applyingPageId.value = row.pageId
  try {
    const page = await portalAssembleApi.applyPage(current.id, row.pageId)
    message.success(
      `「${page?.title || row.pageKey}」已应用，访客现在看到的就是这一版；` +
        '要撤回去用上面的「回滚本任务应用过的页面」'
    )
    await Promise.all([refreshDetail(), loadJobs()])
  } catch (error) {
    message.error(fail('应用这一页失败', error))
  } finally {
    applyingPageId.value = null
  }
}

/** 这一步只在 popconfirm 里确认过一次之后才执行——回滚会把访客正在看的内容换回去 */
async function rollbackAll() {
  const current = job.value
  if (!current || !canRollback.value) return
  rollingBack.value = true
  try {
    const count = await portalAssembleApi.rollbackAll(current.id)
    message.success(`已回滚 ${count} 页：只退回本任务应用过的那几页，别的改动一律没动`)
    await Promise.all([refreshDetail(), loadJobs()])
  } catch (error) {
    message.error(fail('回滚失败', error))
  } finally {
    rollingBack.value = false
  }
}

onMounted(async () => {
  try {
    statusLabels.value = await portalAssembleApi.statusLabels()
  } catch (error) {
    // 词表读不到时不猜中文：状态标签退回原样显示 key，界面照样能用
    message.error(fail('状态词表加载失败', error))
  }
  await loadBaseData()
})
</script>

<style scoped lang="less">
.assemble-job-page {
  padding: 16px;

  &__panel {
    margin-bottom: 16px;
  }

  &__notice {
    margin-bottom: 12px;
  }

  &__create {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
  }

  &__actions {
    margin-top: 16px;
  }

  &__confirm {
    margin: 0 4px;
  }

  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
    margin: 8px 0 0;
  }

  &__error {
    color: #cf1322;
    font-size: 12px;
    margin: 8px 0 0;
  }

  &__warnings {
    margin: 4px 0 0;
    padding-left: 18px;
    color: #d46b08;
    font-size: 12px;
  }
}
</style>
