<template>
  <div class="interaction-page">
    <PageTitle />
    <!-- 互动配置、总账、待审队列与排产计划都按客户分开：平台档（超管没选客户）不发请求、写口全灰 -->
    <a-alert v-if="isPlatformMode" class="scope-alert" type="info" show-icon>
      <template #message>
        互动设置、互动总账、待审评论与排产计划都按客户分开：请先在右上角切到「客户」并选一家，再读、再改。平台档这里不发业务请求。
      </template>
    </a-alert>
    <a-alert
      class="lead-alert"
      type="info"
      show-icon
      message="访客在你官网文章下面写的评论与点的赞，都在这一个页面里处理。"
      description="两个开关默认都是关的：开着「示例评论」表示系统会替你在新发的稿子里补写评论，而前台不会标出哪几条是补的。"
    />

    <a-card title="读者互动设置" :bordered="false" :loading="configLoading">
      <a-alert v-if="configError" type="error" show-icon message="这一家的配置没读到" :description="configError" />
      <a-form v-else :model="form" layout="vertical" class="config-form">
        <a-form-item label="AI 示例评论">
          <a-switch
            id="interaction-ai-comment"
            :checked="form.aiCommentEnabled === 1"
            :disabled="!canManage || isPlatformMode"
            @update:checked="(v: boolean) => (form.aiCommentEnabled = v ? 1 : 0)"
          />
          <span class="field-hint">开了之后，新发布的稿子会在发布后一个月内挑随机时刻补写评论。</span>
        </a-form-item>

        <a-form-item label="虚拟点赞">
          <a-switch
            id="interaction-virtual-like"
            :checked="form.virtualLikeEnabled === 1"
            :disabled="!canManage || isPlatformMode"
            @update:checked="(v: boolean) => (form.virtualLikeEnabled = v ? 1 : 0)"
          />
          <span class="field-hint">开了之后，发布那一刻就按下面的区间写一个点赞数；关掉只显真人点的。</span>
        </a-form-item>

        <a-form-item label="读者评论怎么处理">
          <a-radio-group id="interaction-moderation-mode" v-model:value="form.moderationMode" :disabled="!canManage || isPlatformMode">
            <a-radio-button value="review">先进待审队列，我点放行才对外</a-radio-button>
            <a-radio-button value="auto">安全闸判过就直接显示</a-radio-button>
          </a-radio-group>
          <div class="field-hint block-hint">
            选了「判过就直接显示」，机器判不过的那一条也不会被丢掉，它会退回上面那个待审队列里等人。
          </div>
        </a-form-item>

        <a-form-item label="每篇最多补几条示例评论">
          <a-input-number
            id="interaction-seed-per-article"
            v-model:value="form.aiCommentMaxPerArticle"
            :min="1"
            :max="10"
            :disabled="!canManage || isPlatformMode"
          />
          <span class="field-hint">1~10 条。一篇稿子底下十几条「好评」看起来就不像真实读者了。</span>
        </a-form-item>

        <a-form-item label="补写的点赞数区间">
          <a-space>
            <a-input-number id="interaction-like-min" v-model:value="form.likeSeedMin" :min="0" :max="999" :disabled="!canManage || isPlatformMode" />
            <span class="range-sep">~</span>
            <a-input-number id="interaction-like-max" v-model:value="form.likeSeedMax" :min="0" :max="999" :disabled="!canManage || isPlatformMode" />
          </a-space>
          <span class="field-hint">发布时在这段里随机取一个数。上界小于下界会存不下。</span>
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button :disabled="configLoading" @click="loadConfig">重新读取</a-button>
            <a-button id="interaction-save-config" type="primary" :loading="saving" :disabled="!canManage || isPlatformMode" @click="saveConfig">
              保存设置
            </a-button>
          </a-space>
          <div v-if="!canManage" class="permission-hint">
            改这几项要「读者互动」的管理权限（interaction:manage）——客户管理员默认有这一码，也可以在角色页分给别的角色。
          </div>
          <div v-else-if="lastEditedAt" class="updated-hint">上次修改：{{ formatDateTime(lastEditedAt, true) }}</div>
        </a-form-item>
      </a-form>

      <a-alert v-if="disclosure" class="disclosure" type="warning" show-icon message="系统替你补了多少" :description="disclosure" />
    </a-card>

    <a-card title="这一家的互动总账" :bordered="false" :loading="statsLoading">
      <template #extra>
        <a-button size="small" :loading="statsLoading" @click="loadStats">刷新</a-button>
      </template>
      <a-alert v-if="statsError" type="error" show-icon message="总账没读到" :description="statsError" />
      <div v-else class="stat-grid">
        <div v-for="cell in statCells" :key="cell.label" class="stat-cell">
          <div class="stat-cell__value">{{ cell.value }}</div>
          <div class="stat-cell__label">{{ cell.label }}</div>
        </div>
      </div>
    </a-card>

    <!-- 待审评论这一块的壳走 Spec-Q 的 RecordListPage（B 型：第一条读数是「等我处理」）。
         这一屏不止一张卡，所以是 `section` 形：页头由上面那份 PageTitle 摆，这里只报这一块是谁。 -->
    <record-list-page
      section
      card-title="待审评论"
      :loading="queueLoading"
      :rows="comments"
      :columns="commentColumns"
      :read-failed="queueError"
      :empty-line="queueEmptyLine"
      :empty-reason="queueEmptyReason"
      :not-sent="queueNotSent"
      :count-line="queueCountLine"
    >
      <template #filters>
        <a-select
          id="interaction-status-filter"
          v-model:value="statusFilter"
          style="width: 180px"
          :options="statusOptions"
          @change="reloadQueue"
        />
      </template>
      <template #actions>
        <a-space>
          <a-button size="small" :loading="queueLoading" @click="reloadQueue">刷新</a-button>
        </a-space>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'sourceText'">
          {{ record.sourceText || '—' }}
        </template>
        <template v-else-if="column.key === 'moderationNote'">
          <span v-if="record.moderationNote" class="note-text">{{ record.moderationNote }}</span>
          <span v-else class="muted">—</span>
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ formatDateTime(record.createdAt, true) }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-space v-if="canManage">
            <!--
              待审的行给放行，已摘除的行给放回：两个动作在后端是同一发 approve，
              区别只在转移表的哪一条边（pending→approved 与 removed→approved）。
              已驳回不给摘除按钮——它本来就不在前台，没有「撤下」这件事，
              而且摘完只能放回成「已对外」，等于替租户把一条他驳回过的话放行。
            -->
            <a-button
              v-if="record.status === 'pending' || record.status === 'removed'"
              id="interaction-approve"
              type="link"
              size="small"
              @click="moderate(record, 'approve')"
            >{{ record.status === 'removed' ? '放回' : '放行' }}</a-button>
            <a-button v-if="record.status === 'pending'" type="link" size="small" danger @click="moderate(record, 'reject')">
              驳回
            </a-button>
            <a-popconfirm
              v-if="record.status === 'pending' || record.status === 'approved'"
              title="摘除 = 从站点上撤下，前台不再显示；这一条会改到下面「已摘除」那一档，随时查得回来、也放得回去。确定摘除？"
              ok-text="摘除"
              cancel-text="先不"
              @confirm="moderate(record, 'remove')"
            >
              <a-button type="link" size="small" danger>摘除</a-button>
            </a-popconfirm>
          </a-space>
          <span v-else class="muted">只读</span>
        </template>
      </template>

      <template #footer>
        <!-- 读失败 / 平台档这两种形状里 `total` 都是 0，这条翻页条自然不会摆：
             那条「共 0 条」会把「没查过」说成「查过了、真的没有」 -->
        <a-pagination
          v-if="total > pageSize"
          :current="page"
          :page-size="pageSize"
          :total="total"
          :show-total="(count: number) => `共 ${count} 条`"
          @change="(p: number) => { page = p; loadQueue() }"
        />
      </template>
    </record-list-page>

    <record-list-page
      section
      card-title="示例评论的排产计划"
      :loading="seedLoading"
      :rows="seedTasks"
      :columns="seedColumns"
      :read-failed="seedError"
      :empty-line="seedEmptyLine"
      :empty-reason="seedEmptyReason"
      :not-sent="seedNotSent"
    >
      <template #actions>
        <a-space>
          <a-button size="small" :loading="seedLoading" @click="loadSeedTasks">刷新</a-button>
        </a-space>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'fireAt'">
          {{ formatDateTime(record.fireAt, true) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="seedStatusColor(record.status)">{{ seedStatusLabel(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'detail'">
          <span v-if="record.skipReasonText" class="skip-reason">{{ record.skipReasonText }}</span>
          <span v-if="record.note" class="note-text">{{ record.note }}</span>
          <span v-if="!record.skipReasonText && !record.note" class="muted">—</span>
        </template>
      </template>
    </record-list-page>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import RecordListPage from '../../components/RecordListPage.vue'
import {
  interactionApi,
  type InteractionCommentItem,
  type InteractionCommentPage,
  type InteractionConfig,
  type InteractionSeedTask,
  type InteractionStats
} from '../../api/interaction'
import { useAuthStore } from '../../stores/auth'
import { formatDateTime, formatNumber } from '../../utils/format'
import { JUMP_BACK_NOTICE, asEmptyReason, shouldJumpBackToFirstPage, type EmptyReason } from '../../utils/emptyPage'
import PageTitle from '../../components/PageTitle.vue'

/**
 * 后台「读者互动」（P9-C，G-08）。
 *
 * 这一页最坏的形状是「开关开着，但补了多少、什么时候补、哪几条已经对外，租户一个都看不到」——
 * 那就是谎报。所以配置卡下面那句 `disclosure`、总账、排产计划三块都是必须存在的，
 * 而它们的话术全部来自后端，界面不拼第二份中文。
 *
 * 另一条硬规矩跟「每日产出」那页一样：读失败就老实地说读失败，不回填默认值、不摆空表。
 *
 * Spec-Q P2：待审评论与排产计划两块走 `RecordListPage` 的 `section` 形（这一屏不止一张卡，
 * 页头由上面的 PageTitle 摆一次）。跟着换掉的三件事：表不再 `size="small"`（与其余列表页同一密度）、
 * 读失败从「卡上一条 alert + 表退场」变成模板的错误块、平台档那一发没发出去的说法从页顶那一条
 * 扩到每一块自己都说一句（空表在平台档会被读成「这一家没人评论」）。
 */

const authStore = useAuthStore()

const MANAGE_CODE = 'interaction:manage'

const canManage = computed(() => authStore.hasPermission(MANAGE_CODE))
/** 这一屏的请求会打到哪一家：超管跟右上角走，租户用户由登录态定 */
const requestedTenantId = computed(() => (authStore.isSuperAdmin ? authStore.selectedTenantId : authStore.tenantId))
/** 平台档 = 超管没选客户：互动都按客户存，这一档不发请求、写口全灰 */
const isPlatformMode = computed(() => requestedTenantId.value === null)

const configLoading = ref(false)
const saving = ref(false)
const configError = ref('')
const disclosure = ref('')
const lastEditedAt = ref<string | null>(null)

const form = reactive({
  aiCommentEnabled: 0,
  virtualLikeEnabled: 0,
  moderationMode: 'review',
  aiCommentMaxPerArticle: 3,
  likeSeedMin: 6,
  likeSeedMax: 28
})

const statsLoading = ref(false)
const statsError = ref('')
const stats = ref<InteractionStats | null>(null)

const queueLoading = ref(false)
const queueError = ref('')
const comments = ref<InteractionCommentItem[]>([])
const queueEmptyLine = ref('')
const queueEmptyReason = ref<EmptyReason>(null)
const statusFilter = ref('pending')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
/** 队列那一口自己带的三档计数（后端 `counts`）：读数那一行只念它，不在界面拿当前页的行数凑 */
const queueCounts = ref<InteractionCommentPage['counts'] | null>(null)

const seedLoading = ref(false)
const seedError = ref('')
const seedTasks = ref<InteractionSeedTask[]>([])
const seedEmptyLine = ref('')
const seedEmptyReason = ref<EmptyReason>(null)

/**
 * 五档。「已摘除」是一档，不是一个查不回来的动作（那一条拍板）；
 * 「全部」把已摘除也算进来，所以下面那四个数相加就是这一家现在查得到的全部评论。
 * 一个已知口径缺口写在这儿：这次改动之前摘除的评论是软删的那一形，
 * 四个数和这一档都看不到它们——那次以前的账不在这次范围内（Q1 拍的是「只管新的」）。
 */
const statusOptions = [
  { value: 'pending', label: '待审' },
  { value: 'approved', label: '已对外' },
  { value: 'rejected', label: '已驳回' },
  { value: 'removed', label: '已摘除' },
  { value: 'all', label: '全部（待审 + 已对外 + 已驳回 + 已摘除）' }
]

/**
 * 待审队列的读数（Spec-Q §4.1 的 B 型：第一条摆「等我处理」，不是总数）。
 * 这四个数只认后端 `counts` 那一格——它按状态分开数，所以跟下面那颗下拉无关，
 * 也跟在界面里数当前页的行数是两件事（当前页几条写在翻页条的「共 N 条」里）。
 * 口径差别写在明处：`counts` 数的是这一家全部评论（读者写的 + 系统按开关补的都在内），
 * 上面总账那一格「等我处理的读者评论」只数读者写的，因此可能比这里小——
 * 同屏两个「等我处理」不写清是谁的，就会被读成其中一个坏了。
 */
const queueCountLine = computed(() => {
  if (isPlatformMode.value || queueError.value || !queueCounts.value) return ''
  const counts = queueCounts.value
  return (
    `等我处理：待审 ${formatNumber(counts.pending)} 条。` +
    `已对外 ${formatNumber(counts.approved)} 条、已驳回 ${formatNumber(counts.rejected)} 条、` +
    `已摘除 ${formatNumber(counts.removed)} 条` +
    '（这四个数按这一家全部评论分开数，读者写的和系统补的都在内，不随下面的状态筛选变；' +
    '上面总账那一格「等我处理的读者评论」只数读者写的，可能比这里少）'
  )
})

/**
 * 队列与排产都按客户分开存：平台档（超管没选客户）那一发不发出去。
 * 这种形状走模板的「这一发没发出去」那一形，说的必须是去哪儿切，
 * 而不是留一张空表让人读成「这一家没人评论」。
 */
const queueNotSent = computed(() =>
  isPlatformMode.value
    ? '待审队列按客户分开存：平台档没有「这一家」，这一发没有发出去，所以这里不能说「没有评论」。请在右上角切到「客户」并选一家。'
    : ''
)

const seedNotSent = computed(() =>
  isPlatformMode.value
    ? '排产计划按客户分开存：平台档没有「这一家」，这一发没有发出去，所以这里不能说「没有计划」。请在右上角切到「客户」并选一家。'
    : ''
)

const commentColumns = [
  { title: '文章', dataIndex: 'articleTitle', key: 'articleTitle', width: 180, ellipsis: true },
  { title: '谁写的', key: 'sourceText', width: 150 },
  { title: '作者', dataIndex: 'authorName', key: 'authorName', width: 110 },
  { title: '内容', dataIndex: 'content', key: 'content' },
  { title: '状态', key: 'status', width: 90 },
  { title: '机器判语', key: 'moderationNote', width: 200 },
  { title: '时间', key: 'createdAt', width: 160 },
  { title: '操作', key: 'actions', width: 170 }
]

const seedColumns = [
  { title: '文章 id', dataIndex: 'articleId', key: 'articleId', width: 100 },
  { title: '第几条', dataIndex: 'seq', key: 'seq', width: 90 },
  { title: '计划时刻', key: 'fireAt', width: 170 },
  { title: '状态', key: 'status', width: 100 },
  { title: '说明', key: 'detail' }
]

const STAT_CELLS: Array<{ key: keyof InteractionStats, label: string }> = [
  { key: 'pendingReaderComments', label: '等我处理的读者评论' },
  { key: 'approvedReaderComments', label: '已对外的读者评论' },
  { key: 'readerComments', label: '读者评论总数' },
  { key: 'seededComments', label: '系统补写的评论' },
  { key: 'readerLikes', label: '真人点的赞' },
  { key: 'virtualLikes', label: '系统补写的赞' },
  { key: 'seedPending', label: '还在等时刻的补写计划' },
  { key: 'seedDone', label: '已补写完成' },
  { key: 'seedSkipped', label: '到点没补（已说明原因）' },
  { key: 'seedFailed', label: '补写失败' }
]

// 平台档没有「这一家」：十格一起摆 `—`，与「读回来是 0」分开
const statCells = computed(() => STAT_CELLS.map(cell => ({
  label: cell.label,
  value: isPlatformMode.value ? '—' : (stats.value ? Number(stats.value[cell.key] ?? 0) : 0)
})))

/** 状态码的中文只在这一处映射，没见过的码原样显示它自己（与每日产出那页同一纪律） */
const STATUS_LABELS: Record<string, string> = {
  pending: '待审',
  approved: '已对外',
  rejected: '已驳回',
  removed: '已摘除'
}

const SEED_STATUS_LABELS: Record<string, string> = {
  PENDING: '等待时刻',
  DONE: '已补写',
  SKIPPED: '跳过',
  FAILED: '失败'
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

function statusColor(status: string) {
  if (status === 'approved') return 'green'
  if (status === 'rejected') return 'red'
  if (status === 'pending') return 'orange'
  return 'default'
}

function seedStatusLabel(status: string) {
  return SEED_STATUS_LABELS[status] ?? status
}

function seedStatusColor(status: string) {
  if (status === 'DONE') return 'green'
  if (status === 'FAILED') return 'red'
  if (status === 'SKIPPED') return 'orange'
  return 'blue'
}

function applyConfig(cfg: InteractionConfig) {
  form.aiCommentEnabled = cfg.aiCommentEnabled ?? 0
  form.virtualLikeEnabled = cfg.virtualLikeEnabled ?? 0
  form.moderationMode = cfg.moderationMode ?? 'review'
  form.aiCommentMaxPerArticle = cfg.aiCommentMaxPerArticle ?? 3
  form.likeSeedMin = cfg.likeSeedMin ?? 6
  form.likeSeedMax = cfg.likeSeedMax ?? 28
  disclosure.value = cfg.disclosure ?? ''
  lastEditedAt.value = cfg.updatedAt ?? null
}

async function loadConfig() {
  // 配置按客户分开存：平台档没有「这一家」，这一发不发（开关与保存口由 isPlatformMode 全灰）
  if (isPlatformMode.value) {
    configError.value = ''
    configLoading.value = false
    return
  }
  configLoading.value = true
  try {
    const cfg = await interactionApi.config(requestedTenantId.value ?? undefined)
    if (cfg) applyConfig(cfg)
    configError.value = ''
  } catch (error: any) {
    configError.value = error?.message || '配置读取失败'
  } finally {
    configLoading.value = false
  }
}

async function saveConfig() {
  if (isPlatformMode.value) {
    message.warning('请先在右上角选择客户')
    return
  }
  saving.value = true
  try {
    const saved = await interactionApi.saveConfig({ ...form }, requestedTenantId.value ?? undefined)
    if (saved) applyConfig(saved)
    message.success('设置已保存')
  } catch (error: any) {
    // 区间与取值的判据在后端一处，这里原样念那句中文
    message.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function loadStats() {
  // 总账按客户算：平台档没有「这一家」，这一发不发（十格由 statCells 摆 `—`）
  if (isPlatformMode.value) {
    stats.value = null
    statsError.value = ''
    statsLoading.value = false
    return
  }
  statsLoading.value = true
  try {
    stats.value = await interactionApi.stats(requestedTenantId.value ?? undefined)
    statsError.value = ''
  } catch (error: any) {
    stats.value = null
    statsError.value = error?.message || '总账读取失败'
  } finally {
    statsLoading.value = false
  }
}

async function loadQueue() {
  // 待审队列按客户分开存：平台档没有「这一家」，这一发不发、旧行清掉
  if (isPlatformMode.value) {
    comments.value = []
    total.value = 0
    queueCounts.value = null
    queueEmptyLine.value = ''
    queueEmptyReason.value = null
    queueError.value = ''
    queueLoading.value = false
    return
  }
  queueLoading.value = true
  try {
    const data = await interactionApi.comments({ status: statusFilter.value, page: page.value, size: pageSize.value }, requestedTenantId.value ?? undefined)
    comments.value = data?.items ?? []
    total.value = data?.total ?? 0
    queueCounts.value = data?.counts ?? null
    queueEmptyLine.value = data?.emptyLine ?? ''
    queueEmptyReason.value = asEmptyReason(data?.emptyReason)
    queueError.value = ''
    // 「这一页翻过了头」不是一句解释就完事：翻回第一页再读一遍（判据在 emptyPage，最多多发一发）
    if (shouldJumpBackToFirstPage(queueEmptyReason.value, page.value)) {
      page.value = 1
      await loadQueue()
      message.info(JUMP_BACK_NOTICE)
      return
    }
  } catch (error: any) {
    comments.value = []
    total.value = 0
    // 读失败时上一回的三档计数跟着作废：读数那一行不念，比念一个过期的数诚实
    queueCounts.value = null
    queueEmptyLine.value = ''
    queueEmptyReason.value = null
    queueError.value = error?.message || '队列读取失败'
  } finally {
    queueLoading.value = false
  }
}

function reloadQueue() {
  page.value = 1
  loadQueue()
}

async function moderate(record: InteractionCommentItem, action: 'approve' | 'reject' | 'remove') {
  if (isPlatformMode.value) {
    message.warning('请先在右上角选择客户')
    return
  }
  try {
    await interactionApi.moderate(record.id, action, requestedTenantId.value ?? undefined)
    message.success(
      action === 'approve'
        ? '已放行，这条会显示在你官网上'
        // 摘除那句要说清「这条挪去哪、还能不能回来」，只念「已处理」会让人以为它消失了
        : action === 'remove'
          ? '已摘除，前台不再显示；这一条在下面「已摘除」那一档，点「放回」就回去'
          : '已处理'
    )
    await Promise.all([loadQueue(), loadStats()])
  } catch (error: any) {
    message.error(error?.message || '操作失败')
  }
}

async function loadSeedTasks() {
  // 排产计划按客户分开存：平台档没有「这一家」，这一发不发、旧行清掉
  if (isPlatformMode.value) {
    seedTasks.value = []
    seedEmptyLine.value = ''
    seedEmptyReason.value = null
    seedError.value = ''
    seedLoading.value = false
    return
  }
  seedLoading.value = true
  try {
    const data = await interactionApi.seedTasks(20, requestedTenantId.value ?? undefined)
    seedTasks.value = Array.isArray(data?.records) ? data.records : []
    seedEmptyLine.value = data?.emptyLine ?? ''
    seedEmptyReason.value = asEmptyReason(data?.emptyReason)
    seedError.value = ''
  } catch (error: any) {
    seedTasks.value = []
    seedEmptyLine.value = ''
    seedEmptyReason.value = null
    seedError.value = error?.message || '排产计划读取失败'
  } finally {
    seedLoading.value = false
  }
}

// 顶栏切客户不会重挂这一屏：配置 / 总账 / 队列 / 排产都是那一家的，切过去要跟着换
watch(requestedTenantId, () => {
  loadConfig()
  loadStats()
  reloadQueue()
  loadSeedTasks()
})

onMounted(() => {
  loadConfig()
  loadStats()
  loadQueue()
  loadSeedTasks()
})
</script>

<style scoped lang="less">
/* 这一屏是「页头 + 提示 + 四块」，块与块的间距只在这一处定：
   改之前四张卡直接贴在一起，只有 lead-alert / disclosure 各自抄了一句 margin-top: 16px */
.interaction-page {
  width: 100%;
  padding: var(--admin-space-1) 0;
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
}

/* disclosure 那张提醒在配置卡里面，够不着上面那层 gap，只能自己留 */
.disclosure {
  margin-top: var(--admin-space-2);
}

.config-form {
  max-width: 720px;
}

.field-hint {
  margin-left: 12px;
  color: var(--admin-text-secondary);
  font-size: 13px;
}

.block-hint {
  margin-left: 0;
  margin-top: 4px;
}

.permission-hint,
.updated-hint {
  margin-top: var(--admin-space-1);
  color: var(--admin-text-secondary);
  font-size: 13px;
}

.range-sep {
  color: var(--admin-text-secondary);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.stat-cell {
  background: var(--admin-fill-hover);
  border-radius: 6px;
  padding: 12px var(--admin-space-2);

  &__value {
    font-size: 22px;
    font-weight: 600;
    color: var(--admin-text-primary);
    /* 十格数字上下要对得齐，中文默认字面的数字是比例宽度 */
    font-variant-numeric: var(--admin-font-nums);
  }

  &__label {
    margin-top: 2px;
    font-size: 13px;
    color: var(--admin-text-secondary);
  }
}

/* 这一支橙是 antd 的 orange-7，比令牌里那支 colorWarning 深；换成 #faad14 在白底上对比度不够，判不动 */
.skip-reason {
  color: #d46b08;
  font-size: 13px;
}

.note-text,
.muted {
  color: var(--admin-text-secondary);
  font-size: 13px;
}
</style>
