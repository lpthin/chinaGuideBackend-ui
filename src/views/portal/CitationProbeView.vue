<template>
  <div class="citation-page">
    <filter-bar>
      <span class="citation-page__filter-label">站点</span>
      <a-select
        v-model:value="siteId"
        style="width: 220px"
        placeholder="选择站点"
        :options="siteOptions"
        @change="onSiteChange"
      />
      <template #actions>
        <a-space>
          <a-button :loading="loading" @click="load">刷新</a-button>
          <a-button @click="openQuestionDrawer">题库</a-button>
          <a-button type="primary" :disabled="!siteId" @click="openCreateModal">新建一轮探测</a-button>
        </a-space>
      </template>
    </filter-bar>

    <a-alert
      v-if="!siteId"
      type="info"
      show-icon
      message="先选一个站点：探测是「拿这个品牌问题去问各家模型」，问的是某一站点的品牌与页面，不存在跨站的一轮"
    />
    <a-alert
      v-else-if="vocabulary"
      type="info"
      show-icon
      style="margin-bottom: 12px"
      :message="roundNotice"
    />

    <state-block
      v-if="!loading && !loadError && probes.length === 0"
      state="empty"
      :title="probeEmptyTitle"
    />
    <data-table
      v-else
      :data-source="probes"
      :columns="columns"
      :loading="loading"
      :error="loadError"
      row-key="id"
      size="middle"
      :scroll="{ x: 1180 }"
      :pagination="{
        current: probePage,
        pageSize: probeSize,
        total: probeTotal,
        showSizeChanger: true,
        pageSizeOptions: ['20', '50', '100']
      }"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <status-tag domain="run" :status="record.status" :label="statusLabel(record.status)" />
          <div v-if="record.errorMessage" class="citation-page__muted">{{ record.errorMessage }}</div>
        </template>
        <template v-else-if="column.key === 'scope'">
          <div>{{ record.modelCount ?? PH_DASH }} 个模型 × {{ record.questionCount ?? PH_DASH }} 道题</div>
          <div class="citation-page__muted">判定对象 {{ record.targetCount ?? PH_DASH }} 条</div>
        </template>
        <template v-else-if="column.key === 'cited'">
          <div>{{ record.citedTargetCount ?? PH_DASH }} / {{ record.targetCount ?? PH_DASH }}</div>
          <div class="citation-page__muted">
            调用 {{ record.callCount ?? 0 }} 次，失败 {{ record.failedCallCount ?? 0 }} 次
          </div>
        </template>
        <template v-else-if="column.key === 'tokens'">
          <div>{{ tokensText(record) }}</div>
          <div class="citation-page__muted">预估 {{ record.estimatedTokens ?? PH_DASH }}</div>
        </template>
        <template v-else-if="column.key === 'time'">
          <div>{{ formatDateTime(record.createdAt) || PH_DASH }}</div>
          <div class="citation-page__muted">{{ formatDateTime(record.finishedAt) || '未跑完' }}</div>
        </template>
        <template v-else-if="column.key === 'op'">
          <a-space>
            <a-button
              size="small"
              type="link"
              :disabled="!siteId"
              @click="runEstimate(record)"
            >
              先估算消耗
            </a-button>
            <a-button
              size="small"
              type="link"
              :disabled="settled(record.status) || running(record.status)"
              @click="openRunModal(record)"
            >
              起跑
            </a-button>
            <a-button size="small" type="link" @click="openDetail(record)">详情</a-button>
          </a-space>
        </template>
      </template>
    </data-table>

    <!-- ---------------- 新建一轮 ---------------- -->
    <a-modal v-model:open="createOpen" title="新建一轮品牌引用探测" :confirm-loading="creating" @ok="createProbe">
      <a-alert
        type="info"
        show-icon
        message="这一步一次模型都不调：只把「这一轮问哪些模型、用哪些题、有多少对象参与判定」拍成快照。钱在「起跑」那一步才花。"
      />
      <a-form layout="vertical" style="margin-top: 12px">
        <a-form-item label="模型（不选 = 用当前所有可对话模型，服务端按上限截断）">
          <a-select
            v-model:value="createForm.modelIds"
            mode="multiple"
            allow-clear
            placeholder="留空即全部可用模型"
            :options="modelOptions"
            :loading="modelsLoading"
          />
        </a-form-item>
        <div v-if="modelsLoading" class="citation-page__muted">
          可探模型来自 ai_model_config 的配置行，界面不预置「支持哪几家」的清单。
        </div>
      </a-form>
    </a-modal>

    <!-- ---------------- 起跑：确认门 ---------------- -->
    <a-modal v-model:open="runOpen" title="确认起跑这一轮" :ok-button-props="{ disabled: !runConfirmed }" @ok="startRun">
      <template v-if="runTarget">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="外呼次数">{{ runTarget.callCount ?? PH_DASH }} 次（模型数 × 题数）</a-descriptions-item>
          <a-descriptions-item label="预估 token">{{ runTarget.estimatedTokens ?? PH_DASH }}</a-descriptions-item>
          <a-descriptions-item label="本租户剩余">{{ runTarget.remainingTokens ?? PH_DASH }}</a-descriptions-item>
        </a-descriptions>
        <a-alert
          v-if="runTarget.notice"
          type="warning"
          show-icon
          style="margin-top: 12px"
          :message="runTarget.notice"
        />
        <a-checkbox v-model:checked="runConfirmed" style="margin-top: 12px">
          我已看过上面的预估，这一轮会真调用模型并扣租户配额
        </a-checkbox>
        <div class="citation-page__muted">
          不勾也能点确认——后端会以 CITATION_CONFIRM_REQUIRED 打回，这里只是让界面少一次白跑。
          探测开关（app.portal.citation.enabled）关着时同样打回，原因照实显示在任务行上。
        </div>
      </template>
    </a-modal>

    <!-- ---------------- 任务详情 ---------------- -->
    <a-drawer v-model:open="detailOpen" title="这一轮问了什么、答了什么" width="1080" placement="right">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="3" size="small" bordered>
            <a-descriptions-item label="状态">
              <status-tag domain="run" :status="detail.probe.status" :label="statusLabel(detail.probe.status)" />
            </a-descriptions-item>
            <a-descriptions-item label="模型">{{ detail.probe.modelCount ?? PH_DASH }}</a-descriptions-item>
            <a-descriptions-item label="题目数">{{ detail.probe.questionCount ?? PH_DASH }}</a-descriptions-item>
            <a-descriptions-item label="被引用对象">{{ detail.probe.citedTargetCount ?? 0 }} / {{ detail.probe.targetCount ?? 0 }}</a-descriptions-item>
            <a-descriptions-item label="调用">{{ detail.probe.callCount ?? 0 }}</a-descriptions-item>
            <a-descriptions-item label="失败">{{ detail.probe.failedCallCount ?? 0 }}</a-descriptions-item>
          </a-descriptions>

          <a-tabs style="margin-top: 16px">
            <a-tab-pane key="calls" :tab="`逐次外呼（${detail.calls.length}）`">
              <a-table
                :data-source="detail.calls"
                :columns="callColumns"
                :pagination="{ pageSize: 20 }"
                row-key="id"
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'ask'">
                    <a-tooltip :title="record.questionText">
                      <span class="citation-page__text">{{ record.questionText }}</span>
                    </a-tooltip>
                  </template>
                  <template v-else-if="column.key === 'result'">
                    <a-tag v-if="!record.success" color="red">调用失败</a-tag>
                    <a-tag v-else-if="record.citedCount > 0" color="green">命中 {{ record.citedCount }} 条</a-tag>
                    <a-tag v-else-if="record.brandMentioned" color="blue">只提到品牌</a-tag>
                    <a-tag v-else>没提到我们</a-tag>
                    <div v-if="record.errorMessage" class="citation-page__muted">{{ record.errorMessage }}</div>
                  </template>
                  <template v-else-if="column.key === 'cost'">
                    <div>{{ (record.promptTokens ?? 0) + (record.completionTokens ?? 0) }} token</div>
                    <div class="citation-page__muted">{{ record.callDurationMs ?? PH_DASH }} ms</div>
                  </template>
                </template>
              </a-table>
            </a-tab-pane>
            <a-tab-pane key="hits" :tab="`命中明细（${detail.hits.length}）`">
              <a-table
                :data-source="detail.hits"
                :columns="hitColumns"
                :pagination="{ pageSize: 20 }"
                row-key="id"
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'target'">
                    <div>{{ typeLabel(record.targetType) }}：{{ record.targetLabel || PH_DASH }}</div>
                    <div class="citation-page__muted">{{ record.targetUrl || PH_DASH }}</div>
                  </template>
                  <template v-else-if="column.key === 'kind'">
                    <a-tag>{{ matchKindLabel(record.matchKind) }}</a-tag>
                    <div class="citation-page__muted">命中字面串：{{ record.matchedText || PH_DASH }}</div>
                  </template>
                </template>
              </a-table>
            </a-tab-pane>
          </a-tabs>
        </template>
      </a-spin>
    </a-drawer>

    <!-- ---------------- 题库 ---------------- -->
    <a-drawer v-model:open="questionOpen" title="品牌问题题库" width="880" placement="right">
      <a-alert
        type="info"
        show-icon
        message="题库是数据不是代码：换行业、加本地化提问都在这里加一行，不改程序。占位符只有 {{region}}、{{industry}}、{{brand}} 三个，写了别的后端会拒。"
      />
      <a-form
        ref="questionFormRef"
        layout="inline"
        style="margin-top: 12px"
        :model="questionForm"
        :rules="questionRules"
      >
        <a-form-item label="题目" name="questionText">
          <a-input v-model:value="questionForm.questionText" style="width: 380px" placeholder="例：{{region}}哪家口腔医院比较靠谱？" />
        </a-form-item>
        <a-form-item label="排序">
          <a-input-number v-model:value="questionForm.sort" :min="0" style="width: 90px" />
        </a-form-item>
        <a-form-item class="toolbar-actions">
          <a-button type="primary" :loading="savingQuestion" @click="saveQuestion">新增</a-button>
        </a-form-item>
      </a-form>
      <data-table
        :data-source="questions"
        :columns="questionColumns"
        :loading="questionsLoading"
        row-key="id"
        size="small"
        style="margin-top: 12px"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'text'">
            <div>{{ record.questionText }}</div>
            <div class="citation-page__muted">
              {{ record.tenantId ? `租户 ${record.tenantId} 专用` : '平台通用题' }} · {{ record.source || 'seed' }}
            </div>
          </template>
          <template v-else-if="column.key === 'enabled'">
            <a-switch
              :checked="record.enabled !== false"
              :loading="togglingId === record.id"
              @change="(value: boolean) => toggleQuestion(record, value)"
            />
          </template>
        </template>
      </data-table>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { siteApi } from '../../api/workspace'
import FilterBar from '../../components/FilterBar.vue'
import DataTable from '../../components/DataTable.vue'
import StateBlock from '../../components/StateBlock.vue'
import StatusTag from '../../components/StatusTag.vue'
import { required } from '../../utils/rules'
import { PH_DASH, PH_NOT_RUN } from '../../utils/display'
import { logError } from '../../utils/errorLog'
import { formatDateTime } from '../../utils/format'
import {
  citationApi,
  citationIsSettled,
  citationModelIds,
  citationTokensUsed,
  type CitationEstimate,
  type CitationModelOption,
  type CitationProbe,
  type CitationProbeView,
  type CitationQuestion,
  type CitationVocabulary
} from '../../api/citation'

/**
 * 超管侧的品牌引用探测（决议 N10 方案 B）。
 *
 * 三条刻意：
 * 1. 状态、对象类型、命中强度的中文全来自 `/labels`，TS 里一个都不翻译——
 *    抄一份的下场是后端改词表而界面不动（I-1，栏目词表那次已经踩过）；
 * 2. 「起跑」必须先打过 estimate：没有那串数字，确认就只是替用户点了个勾选框；
 * 3. 这里没有任何入口能改页面内容或发布内容，探测只读不写，产出的只有统计与证据。
 */

/** 状态的颜色与兜底文案在 utils/statusTokens.ts（run 域），中文词表到手时由 label 覆盖 */

const siteId = ref<number | null>(null)
const sites = ref<Array<{ id: number; name: string }>>([])
const probes = ref<CitationProbe[]>([])
const vocabulary = ref<CitationVocabulary | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
/** 分页归后端（§7.3：page/size，默认 20、单页最多 100）；total 是「共 N 轮」那个分母，不是这一页的条数 */
const probePage = ref(1)
const probeSize = ref(20)
const probeTotal = ref(0)

const models = ref<CitationModelOption[]>([])
const modelsLoading = ref(false)

const createOpen = ref(false)
const creating = ref(false)
const createForm = reactive<{ modelIds: number[] }>({ modelIds: [] })

const runOpen = ref(false)
const runConfirmed = ref(false)
const runTarget = ref<CitationEstimate | null>(null)
const runProbeId = ref<number | null>(null)

const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref<CitationProbeView | null>(null)

const questionOpen = ref(false)
const questionsLoading = ref(false)
const savingQuestion = ref(false)
const questions = ref<CitationQuestion[]>([])
const questionForm = reactive<{ questionText: string; sort: number | null }>({ questionText: '', sort: null })
const questionFormRef = ref()
/** 红星与校验同出一处：`required('题目')` 既画那颗星，也是提交时拦下来的那条规则（§9.2-6） */
const questionRules = { questionText: [required('题目')] }
const togglingId = ref<number | null>(null)

const columns = [
  { title: '状态', key: 'status', width: 190 },
  { title: '这一轮问什么', key: 'scope', width: 190 },
  { title: '被引用 / 判定对象', key: 'cited', width: 170 },
  { title: 'token', key: 'tokens', width: 140 },
  { title: '创建 / 完成', key: 'time', width: 180 },
  { title: '操作', key: 'op', width: 250, fixed: 'left' }
]

const callColumns = [
  { title: '模型', dataIndex: 'modelName', key: 'modelName', width: 150 },
  { title: '问题', key: 'ask' },
  { title: '结果', key: 'result', width: 170 },
  { title: '花费', key: 'cost', width: 110 }
]

const hitColumns = [
  { title: '被引用的对象', key: 'target' },
  { title: '判定强度', key: 'kind', width: 260 },
  { title: '什么时候', dataIndex: 'probedAt', key: 'probedAt', width: 180 }
]

const questionColumns = [
  { title: '题目', key: 'text' },
  { title: '启用', key: 'enabled', width: 90 }
]

const siteOptions = computed(() => sites.value.map((site) => ({ value: site.id, label: site.name })))

const modelOptions = computed(() => models.value.map((model) => ({
  value: model.id,
  label: `${model.name}（${model.provider}）`
})))

const settled = citationIsSettled

function running(status: string): boolean {
  return status === 'running'
}

function statusLabel(status: string): string {
  const labels = vocabulary.value?.statuses || {}
  return labels[status] || status
}

function typeLabel(type: string): string {
  const labels = vocabulary.value?.targetTypes || {}
  return labels[type] || type
}

function matchKindLabel(kind: string): string {
  const labels = vocabulary.value?.matchKinds || {}
  return labels[kind] || kind
}

function tokensText(probe: CitationProbe): string {
  const used = citationTokensUsed(probe)
  // 「还没花钱」与「花了 0 个」要分得开：后者会让人以为门禁把调用吞了。
  // 这一格的措辞用占位符单源里的 PH_NOT_RUN（一次都没跑过），不是 '—'（跑过但没数）。
  return used === null ? PH_NOT_RUN : `${used} 实烧`
}

/** 空态那句话原样保留在这里：DataTable 自己判空，页面特有的那句话只能由 StateBlock 的 title 传进去 */
const probeEmptyTitle = '这个站点还没有探测任务：点「新建一轮探测」先把这一轮问什么定下来'

const latest = computed(() => probes.value.find((probe) => probe.status !== 'pending') || null)

const roundNotice = computed(() => {
  if (!latest.value) return '这个站点还没有跑过探测：新建一轮 → 估算 → 勾选确认起跑。'
  const ids = citationModelIds(latest.value)
  return `最近一轮：${statusLabel(latest.value.status)}，用了 ${latest.value.modelCount ?? ids.length} 个模型、`
    + `${latest.value.questionCount ?? PH_DASH} 道题。开关（app.portal.citation.enabled）默认关着，`
    + '关掉时起跑会被直接打回，不会偷偷调模型。'
})

async function loadVocabulary(): Promise<void> {
  if (vocabulary.value) return
  try {
    vocabulary.value = await citationApi.adminLabels()
  } catch (error) {
    message.error((error as Error).message || '词表加载失败')
  }
}

async function load(): Promise<void> {
  if (!siteId.value) {
    probes.value = []
    probeTotal.value = 0
    return
  }
  loading.value = true
  loadError.value = null
  try {
    const pageData = await citationApi.listPaged({
      siteId: siteId.value,
      page: probePage.value,
      size: probeSize.value
    })
    probes.value = pageData?.records || []
    probeTotal.value = Number(pageData?.total ?? probes.value.length)
  } catch (error) {
    loadError.value = (error as Error).message || '探测任务加载失败'
    message.error(loadError.value)
    logError('citation-probe-list', error)
  } finally {
    loading.value = false
  }
}

/** 翻页不改筛选条件、只换这一页：分页归后端，界面不再一次捞 200 条自己切 */
function onTableChange(pagination: { current?: number; pageSize?: number }): void {
  probePage.value = pagination?.current ?? probePage.value
  probeSize.value = pagination?.pageSize ?? probeSize.value
  load()
}

async function onSiteChange(): Promise<void> {
  probePage.value = 1
  await loadModels()
  await load()
}

async function loadModels(): Promise<void> {
  modelsLoading.value = true
  try {
    models.value = await citationApi.models(siteId.value)
  } catch (error) {
    message.error((error as Error).message || '可探测模型加载失败')
  } finally {
    modelsLoading.value = false
  }
}

function openCreateModal(): void {
  createForm.modelIds = []
  createOpen.value = true
}

async function createProbe(): Promise<void> {
  if (!siteId.value) return
  creating.value = true
  try {
    const probe = await citationApi.create({ siteId: siteId.value, modelIds: createForm.modelIds })
    message.success(`已建任务 #${probe.id}，先估算再起跑`)
    createOpen.value = false
    await load()
    await runEstimate(probe)
  } catch (error) {
    message.error((error as Error).message || '探测任务创建失败')
  } finally {
    creating.value = false
  }
}

/** 只算不调：打完这一发之后 ai_call_log 不该多一行，这里也不显示任何「已消耗」的字样 */
async function runEstimate(probe: CitationProbe): Promise<void> {
  try {
    const estimate = await citationApi.estimate(probe.id)
    runTarget.value = estimate
    runProbeId.value = probe.id
    runConfirmed.value = false
    runOpen.value = true
  } catch (error) {
    message.error((error as Error).message || '估算失败')
  }
}

function openRunModal(probe: CitationProbe): void {
  if (probe.estimatedTokens === null || probe.estimatedTokens === undefined) {
    message.warning('还没有估算过这一轮的消耗，先点「先估算消耗」')
    return
  }
  runProbeId.value = probe.id
  runEstimate(probe)
}

async function startRun(): Promise<void> {
  if (!runProbeId.value) return
  try {
    await citationApi.run(runProbeId.value, runConfirmed.value)
    message.success('已派给探测线程池，刷新看进度（这一轮是几十次外呼，不会在一次请求里跑完）')
    runOpen.value = false
    await load()
  } catch (error) {
    message.error((error as Error).message || '起跑失败')
  }
}

async function openDetail(probe: CitationProbe): Promise<void> {
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await citationApi.view(probe.id)
  } catch (error) {
    message.error((error as Error).message || '任务详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

async function openQuestionDrawer(): Promise<void> {
  questionOpen.value = true
  questionsLoading.value = true
  try {
    questions.value = await citationApi.questions(null)
  } catch (error) {
    message.error((error as Error).message || '题库加载失败')
  } finally {
    questionsLoading.value = false
  }
}

async function saveQuestion(): Promise<void> {
  // 校验走 utils/rules.ts：红星由这条规则画出来，拦下来也是同一条规则，不再手写一句 message.warning
  try {
    await questionFormRef.value?.validate()
  } catch (error) {
    logError('citation-question-invalid', error)
    return
  }
  const text = questionForm.questionText.trim()
  savingQuestion.value = true
  try {
    await citationApi.saveQuestion({ questionText: text, sort: questionForm.sort })
    questionForm.questionText = ''
    questionForm.sort = null
    questions.value = await citationApi.questions(null)
    message.success('已加入题库')
  } catch (error) {
    message.error((error as Error).message || '题目保存失败')
  } finally {
    savingQuestion.value = false
  }
}

async function toggleQuestion(question: CitationQuestion, enabled: boolean): Promise<void> {
  togglingId.value = question.id
  try {
    await citationApi.toggleQuestion(question.id, enabled)
    question.enabled = enabled
  } catch (error) {
    message.error((error as Error).message || '状态更新失败')
  } finally {
    togglingId.value = null
  }
}

onMounted(async () => {
  await loadVocabulary()
  try {
    const list = await siteApi.list()
    sites.value = (list || []).map((site: any) => ({ id: site.id, name: site.name }))
    siteId.value = sites.value[0]?.id ?? null
  } catch {
    // 站点列表拿不到时整页只有一句话可说：没有站点就没有探测对象，不假装能加载
    message.warning('拿不到站点列表：先确认已登录且有可见站点')
    return
  }
  await onSiteChange()
})
</script>

<style scoped>
/* 靠右那组按钮交给 FilterBar 与 global.less 的 .toolbar-actions，这里不再抄一份 margin-left */
.citation-page__filter-label {
  color: #595959;
  font-size: 13px;
}
.citation-page__muted {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.citation-page__text {
  display: inline-block;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
</style>
