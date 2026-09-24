<template>
  <div class="revision-ticket-page">
    <a-form layout="inline" class="revision-ticket-page__filter">
      <a-form-item label="状态">
        <a-select
          v-model:value="statusFilter"
          style="width: 150px"
          allow-clear
          placeholder="全部状态"
          :options="statusOptions"
          @change="loadTickets"
        />
      </a-form-item>
      <a-form-item label="页面">
        <a-select
          v-model:value="pageFilter"
          style="width: 220px"
          allow-clear
          show-search
          option-filter-prop="label"
          placeholder="全部页面"
          :options="pageOptions"
          @change="loadTickets"
        />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button :loading="loading" @click="reload">刷新</a-button>
          <a-button type="primary" @click="openSessionModal">预览链接</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table
      :data-source="tickets"
      :columns="columns"
      :loading="loading"
      :pagination="paginationConfig"
      row-key="id"
      size="middle"
      :scroll="{ x: 1080 }"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'page'">
          {{ pageTitle(record.pageId) }}
        </template>
        <template v-else-if="column.key === 'block'">
          <div v-if="record.blockInstanceId">
            <span>{{ blockName(record.blockKey) }}</span>
            <span class="revision-ticket-page__muted">（{{ record.blockInstanceId }}）</span>
          </div>
          <a-tag v-else color="orange">未定位区块</a-tag>
        </template>
        <template v-else-if="column.key === 'clientText'">
          <a-tooltip :title="record.clientText">
            <span class="revision-ticket-page__text">{{ record.clientText }}</span>
          </a-tooltip>
          <div v-if="intentOf(record)" class="revision-ticket-page__muted">
            动作：{{ options.intents[intentOf(record) as string] || intentOf(record) }}
          </div>
        </template>
        <template v-else-if="column.key === 'viewport'">
          {{ record.viewport ? options.viewports[record.viewport] || record.viewport : '—' }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ options.statuses[record.status] || record.status }}</a-tag>
          <div v-if="record.source === 'admin'" class="revision-ticket-page__muted">运营代录</div>
        </template>
        <template v-else-if="column.key === 'tokens'">
          <span>{{ record.estimatedTokens ?? '—' }} / {{ record.actualTokens ?? '—' }}</span>
          <div v-if="record.quotaSkipped" class="revision-ticket-page__muted">配额未扣（草稿被门禁拦下）</div>
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ formatDateTime(record.createdAt) }}
        </template>
        <template v-else-if="column.key === 'op'">
          <a-button size="small" type="link" @click="openTicket(record.id)">审阅</a-button>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="还没有改版工单：先在「预览链接」里生成一条链接发给客户" />
      </template>
    </a-table>

    <!-- ---------------- 工单详情 ---------------- -->
    <a-drawer v-model:open="ticketOpen" :title="ticketTitle" width="960" placement="right">
      <a-spin :spinning="ticketLoading">
        <template v-if="ticket">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="页面">{{ pageTitle(ticket.pageId) }}</a-descriptions-item>
            <a-descriptions-item label="区块">
              {{ blockName(ticket.blockKey) }}（{{ ticket.blockInstanceId || '未定位' }}）
            </a-descriptions-item>
            <a-descriptions-item label="访客路径">{{ ticket.path || '—' }}</a-descriptions-item>
            <a-descriptions-item label="视口">{{ ticket.viewport ? options.viewports[ticket.viewport] || ticket.viewport : '—' }}</a-descriptions-item>
            <a-descriptions-item label="状态">{{ options.statuses[ticket.status] || ticket.status }}</a-descriptions-item>
            <a-descriptions-item label="提交时间">{{ formatDateTime(ticket.createdAt) }}</a-descriptions-item>
            <a-descriptions-item label="客户原话" :span="2">
              <div class="revision-ticket-page__quote">{{ ticket.clientText }}</div>
            </a-descriptions-item>
            <a-descriptions-item v-if="ticket.errorMessage" label="上次处理结果" :span="2">
              <span class="revision-ticket-page__error">{{ ticket.errorMessage }}</span>
            </a-descriptions-item>
          </a-descriptions>

          <a-alert
            v-if="!ticket.blockInstanceId"
            type="warning"
            show-icon
            style="margin-top: 12px"
            message="这条工单没有定位到具体区块，AI 起草会被后端直接拒掉（让模型猜「你说的是哪一块」，猜错的代价比不改高）"
          />

          <a-space style="margin-top: 16px" wrap>
            <a-button :loading="estimating" @click="runEstimate">先估算消耗</a-button>
            <a-button type="primary" :disabled="!estimate" :loading="drafting" @click="openDraftModal">
              让 AI 出草稿
            </a-button>
            <a-popconfirm title="驳回这条工单？" @confirm="rejectTicket">
              <a-button>驳回</a-button>
            </a-popconfirm>
            <a-popconfirm title="重新打开这条工单？" @confirm="reopenTicket">
              <a-button>重新打开</a-button>
            </a-popconfirm>
            <a-button :loading="draftsLoading" @click="loadDrafts">刷新草稿</a-button>
          </a-space>
          <p class="revision-ticket-page__muted">
            「先估算消耗」只算不调用模型；下一句按钮会真的产生一次 AI 调用并扣租户配额，所以必须先看一眼预估。
          </p>

          <a-alert
            v-if="estimate"
            type="info"
            show-icon
            style="margin-top: 8px"
            :message="`预计 ${estimate.estimatedTokens} token，本站剩余配额 ${estimate.remainingTokens} token`"
            :description="estimate.notice || (estimate.aiEnabled ? null : 'AI 起草当前未开启，确认也不会调用模型')"
          />

          <a-divider>AI 草稿</a-divider>
          <a-empty v-if="!drafts.length" description="这条工单还没有草稿" />
          <div v-for="draft in drafts" :key="draft.id" class="revision-ticket-page__draft">
            <DraftReviewCard :draft="draft" @changed="onDraftChanged" />
          </div>
        </template>
      </a-spin>
    </a-drawer>

    <!-- ---------------- 预览链接 ---------------- -->
    <a-modal v-model:open="sessionOpen" title="预览链接与已发出的会话" width="760" :footer="null">
      <a-form layout="inline">
        <a-form-item label="页面">
          <a-select
            v-model:value="sessionPageId"
            style="width: 220px"
            show-search
            option-filter-prop="label"
            placeholder="选择要发给客户的页面"
            :options="pageOptions"
          />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="sessionLabel" placeholder="例如：张总第二轮反馈" :maxlength="100" style="width: 200px" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" :loading="creatingSession" @click="createSession">生成链接</a-button>
        </a-form-item>
      </a-form>

      <a-alert
        v-if="createdPreviewUrl"
        type="success"
        show-icon
        style="margin-top: 12px"
        message="链接已生成，明文令牌只有这一次能看到，请立即复制"
      >
        <template #description>
          <div class="revision-ticket-page__token">{{ createdPreviewUrl }}</div>
          <a-button size="small" @click="copy(createdPreviewUrl)">复制</a-button>
        </template>
      </a-alert>

      <a-divider>已发出的会话</a-divider>
      <a-spin :spinning="sessionsLoading">
        <a-table
          :data-source="sessions"
          :columns="sessionColumns"
          :pagination="{ pageSize: 8, showTotal: (total: number) => `共 ${total} 条` }"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'pages'">
              <a-tag v-for="id in sessionPageIds(record)" :key="id">{{ pageTitle(id) }}</a-tag>
              <a-tag v-if="sessionAllowsTicketWrite(record)">可提反馈</a-tag>
            </template>
            <template v-else-if="column.key === 'state'">
              <a-tag v-if="record.revokedAt" color="red">已撤销</a-tag>
              <a-tag v-else-if="record.expiresAt && new Date(record.expiresAt) < new Date()" color="orange">已过期</a-tag>
              <a-tag v-else color="green">有效</a-tag>
            </template>
            <template v-else-if="column.key === 'expiresAt'">
              {{ formatDateTime(record.expiresAt) }}
            </template>
            <template v-else-if="column.key === 'op'">
              <a-popconfirm title="撤销后这条链接立刻打不开，确定吗？" @confirm="revokeSession(record.id)">
                <a-button size="small" :disabled="!!record.revokedAt">撤销</a-button>
              </a-popconfirm>
            </template>
          </template>
        </a-table>
      </a-spin>
      <p class="revision-ticket-page__muted">
        令牌授权的是「这一页 + 提反馈」，有效期与次数由后端配置；撤销只让链接失效，客户已经提的工单照常保留。
      </p>
    </a-modal>

    <!-- ---------------- 起草确认：烧钱动作必须显式确认 ---------------- -->
    <a-modal
      v-model:open="draftModalOpen"
      title="确认让 AI 改这一版？"
      :ok-text="confirmChecked ? '确认并起草' : '请先勾选确认'"
      :ok-button-props="{ disabled: !confirmChecked, loading: drafting }"
      @ok="runDraft"
    >
      <p v-if="estimate">
        预计消耗 <b>{{ estimate.estimatedTokens }}</b> token，
        本站剩余配额 <b>{{ estimate.remainingTokens }}</b> token。
      </p>
      <p v-else class="revision-ticket-page__error">还没有取到预估，请先点「先估算消耗」。</p>
      <p class="revision-ticket-page__muted">
        产出的是草稿，要点「应用到页面」才会对访客生效；被门禁拦下的草稿只留档、不能应用，但 token 已经花掉了。
      </p>
      <a-checkbox v-model:checked="confirmChecked">我已看过预估，确认这次调用会消耗租户配额</a-checkbox>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  portalTicketsApi,
  sessionAllowsTicketWrite,
  sessionPageIds,
  ticketIntent,
  type CreatedSession,
  type RevisionDraft,
  type RevisionTicket,
  type ReviewSession,
  type TicketEstimate,
  type TicketOptions
} from '../../api/portalTickets'
import { portalPagesApi, type PortalPage } from '../../api/portalPages'
import DraftReviewCard from './builder/DraftReviewCard.vue'
import { formatDateTime } from '../../utils/format'

/**
 * 改版工单审阅页：客户原话 → 预估 → AI 草稿 → 人工看字段级 diff → 应用/丢弃。
 *
 * 三条不能松的线：
 * 1. 状态/视口/动作标签全部来自后端 /portal/tickets/options，这里一个字都不抄；
 * 2. 起草按钮之前必须先取到 estimate，且弹窗要显式勾选确认——决策 D4 要求执行前给租户看预计消耗；
 * 3. validation_error 非空的草稿只显原因、应用按钮禁用：门禁拦下的内容一旦被点应用，白名单就白做了。
 *
 * 草稿的「改前/改后」渲的是后端 LayoutDiff 的字段级结果，不做整页视觉预览：
 * 候选 layout 里的 {"$data":"services"} 只有服务端能解析，在前端渲出来必然是假的。
 * 要按像素看效果，就应用后用页面搭建器的预览（那条路取的是已保存版本）。
 */

const EMPTY_OPTIONS: TicketOptions = { statuses: {}, viewports: {}, intents: {} }

const options = ref<TicketOptions>({ ...EMPTY_OPTIONS })
const pages = ref<PortalPage[]>([])
const tickets = ref<RevisionTicket[]>([])
const loading = ref(false)

const statusFilter = ref<string | undefined>(undefined)
const pageFilter = ref<number | null>(null)

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`
})

const columns = [
  { title: '编号', dataIndex: 'id', key: 'id', width: 72 },
  { title: '页面', key: 'page', width: 140 },
  { title: '定位区块', key: 'block', width: 200 },
  { title: '客户原话', key: 'clientText', width: 280 },
  { title: '视口', key: 'viewport', width: 80 },
  { title: '状态', key: 'status', width: 120 },
  { title: '预估/实际 token', key: 'tokens', width: 150 },
  { title: '提交时间', key: 'createdAt', width: 170 },
  { title: '操作', key: 'op', width: 90, fixed: 'right' as const }
]

const sessionColumns = [
  { title: '编号', dataIndex: 'id', key: 'id', width: 72 },
  { title: '备注', dataIndex: 'label', key: 'label', width: 170 },
  { title: '授权页面', key: 'pages', width: 220 },
  { title: '状态', key: 'state', width: 100 },
  { title: '过期时间', key: 'expiresAt', width: 170 },
  { title: '操作', key: 'op', width: 90 }
]

// ---------------- 抽屉：工单详情 ----------------
const ticketOpen = ref(false)
const ticketLoading = ref(false)
const ticket = ref<RevisionTicket | null>(null)
const estimate = ref<TicketEstimate | null>(null)
const estimating = ref(false)
const drafting = ref(false)
const draftsLoading = ref(false)
const drafts = ref<RevisionDraft[]>([])
const draftModalOpen = ref(false)
const confirmChecked = ref(false)

// ---------------- 预览链接 ----------------
const sessionOpen = ref(false)
const sessionsLoading = ref(false)
const creatingSession = ref(false)
const sessions = ref<ReviewSession[]>([])
const sessionPageId = ref<number | null>(null)
const sessionLabel = ref('')
const createdPreviewUrl = ref('')

const statusOptions = computed(() =>
  Object.entries(options.value.statuses).map(([value, label]) => ({ value, label }))
)

const pageOptions = computed(() =>
  pages.value.map(page => ({ value: page.id, label: page.title || page.slug || `页面 ${page.id}` }))
)

const ticketTitle = computed(() => (ticket.value ? `工单 #${ticket.value.id}` : '工单'))

function pageTitle(id: number) {
  const page = pages.value.find(item => item.id === id)
  return page ? page.title || page.slug || `页面 ${id}` : `页面 ${id}`
}

function blockName(blockKey: string | null | undefined) {
  return blockKey || '—'
}

function statusColor(status: string) {
  if (status === 'applied') return 'green'
  if (status === 'rejected' || status === 'expired') return 'red'
  if (status === 'needs_human') return 'orange'
  if (status === 'ai_drafted') return 'blue'
  return 'default'
}

function intentOf(record: RevisionTicket) {
  return ticketIntent(record)
}

function onTableChange(pagination: { current?: number; pageSize?: number }) {
  paginationConfig.current = pagination.current || 1
  paginationConfig.pageSize = pagination.pageSize || 10
}

async function reload() {
  await Promise.all([loadTickets(), loadPages()])
}

async function loadPages() {
  try {
    pages.value = await portalPagesApi.list()
  } catch (error) {
    message.error((error as Error).message || '页面列表加载失败')
  }
}

async function loadTickets() {
  loading.value = true
  try {
    tickets.value = await portalTicketsApi.list({ status: statusFilter.value, pageId: pageFilter.value })
    paginationConfig.total = tickets.value.length
  } catch (error) {
    tickets.value = []
    message.error((error as Error).message || '工单列表加载失败')
  } finally {
    loading.value = false
  }
}

async function openTicket(id: number) {
  ticketOpen.value = true
  ticketLoading.value = true
  ticket.value = null
  estimate.value = null
  drafts.value = []
  try {
    ticket.value = await portalTicketsApi.get(id)
    await loadDrafts()
  } catch (error) {
    message.error((error as Error).message || '工单加载失败')
  } finally {
    ticketLoading.value = false
  }
}

async function runEstimate() {
  if (!ticket.value) return
  estimating.value = true
  try {
    estimate.value = await portalTicketsApi.estimate(ticket.value.id)
  } catch (error) {
    estimate.value = null
    message.error((error as Error).message || '预估失败')
  } finally {
    estimating.value = false
  }
}

function openDraftModal() {
  if (!estimate.value) {
    // 决策 D4 的界面落点：没有预估就不给确认框，避免运营闭着眼睛点掉一次付费调用
    message.warning('请先点「先估算消耗」，看过预估 token 再起草')
    return
  }
  confirmChecked.value = false
  draftModalOpen.value = true
}

async function runDraft() {
  if (!ticket.value || !confirmChecked.value) return
  drafting.value = true
  try {
    const draft = await portalTicketsApi.aiDraft(ticket.value.id, true)
    draftModalOpen.value = false
    message.success('草稿已生成，请对照字段级差异后再决定是否应用')
    ticket.value = await portalTicketsApi.get(ticket.value.id)
    drafts.value = [draft, ...drafts.value]
  } catch (error) {
    message.error((error as Error).message || 'AI 起草失败')
  } finally {
    drafting.value = false
  }
}

async function loadDrafts() {
  if (!ticket.value) return
  draftsLoading.value = true
  try {
    drafts.value = await portalTicketsApi.draftsOfTicket(ticket.value.id)
  } catch (error) {
    drafts.value = []
    message.error((error as Error).message || '草稿列表加载失败')
  } finally {
    draftsLoading.value = false
  }
}

/** 草稿的 diff、应用与丢弃都在 DraftReviewCard 里；这两件事做完要把工单状态和页面版本一起刷回来 */
async function onDraftChanged() {
  await Promise.all([loadDrafts(), loadPages(), loadTickets()])
  if (ticket.value) {
    ticket.value = await portalTicketsApi.get(ticket.value.id)
  }
}

async function rejectTicket() {
  if (!ticket.value) return
  try {
    ticket.value = await portalTicketsApi.reject(ticket.value.id, '人工审阅后判定不改')
    message.success('已驳回')
    loadTickets()
  } catch (error) {
    message.error((error as Error).message || '驳回失败')
  }
}

async function reopenTicket() {
  if (!ticket.value) return
  try {
    ticket.value = await portalTicketsApi.reopen(ticket.value.id)
    message.success('已重新打开')
    loadTickets()
  } catch (error) {
    message.error((error as Error).message || '重新打开失败')
  }
}

function openSessionModal() {
  sessionOpen.value = true
  createdPreviewUrl.value = ''
  sessionPageId.value = pageFilter.value ?? pages.value[0]?.id ?? null
  loadSessions()
}

async function loadSessions() {
  sessionsLoading.value = true
  try {
    sessions.value = await portalTicketsApi.listSessions()
  } catch (error) {
    sessions.value = []
    message.error((error as Error).message || '会话列表加载失败')
  } finally {
    sessionsLoading.value = false
  }
}

async function createSession() {
  if (!sessionPageId.value) {
    message.warning('请先选择页面')
    return
  }
  creatingSession.value = true
  try {
    const created: CreatedSession = await portalTicketsApi.createSession({
      pageId: sessionPageId.value,
      label: sessionLabel.value || null
    })
    createdPreviewUrl.value = created.previewUrl
    message.success('预览链接已生成')
    await loadSessions()
  } catch (error) {
    message.error((error as Error).message || '生成失败')
  } finally {
    creatingSession.value = false
  }
}

async function revokeSession(id: number) {
  try {
    await portalTicketsApi.revokeSession(id)
    message.success('已撤销')
    await loadSessions()
  } catch (error) {
    message.error((error as Error).message || '撤销失败')
  }
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    message.success('已复制到剪贴板')
  } catch (error) {
    // 非安全上下文（http 域名下直接访问管理端） Clipboard API 不可用，这时只能靠选中文本手抄
    message.warning('浏览器拒绝了剪贴板写入，请手动选中上面的文本复制')
  }
}

onMounted(async () => {
  try {
    const [ticketOptions] = await Promise.all([portalTicketsApi.options(), loadPages()])
    options.value = { ...EMPTY_OPTIONS, ...ticketOptions }
  } catch (error) {
    message.error((error as Error).message || '词表加载失败')
  }
  loadTickets()
})
</script>

<style scoped lang="less">
.revision-ticket-page {
  padding: 16px;

  &__filter {
    margin-bottom: 12px;
    width: 100%;
    display: flex;
    flex-wrap: wrap;
  }

  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__text {
    display: inline-block;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }

  &__quote {
    white-space: pre-wrap;
  }

  &__error {
    color: #cf1322;
  }

  &__mono {
    font-family: Consolas, Menlo, monospace;
    font-size: 12px;
  }

  &__draft {
    padding: 12px 0 16px;
    border-bottom: 1px solid #f0f0f0;
  }

  &__warnings {
    margin-top: 8px;
    padding: 8px 12px;
    background: #fffbe6;
    border: 1px solid #ffe58f;
    color: #614700;
    font-size: 12px;
  }

  &__token {
    word-break: break-all;
    font-family: Consolas, Menlo, monospace;
    font-size: 12px;
    margin-bottom: 8px;
  }

  &__del {
    color: #cf1322;
    text-decoration: line-through;
  }

  &__ins {
    color: #389e0d;
  }
}
</style>
