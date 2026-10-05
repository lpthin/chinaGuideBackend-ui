<template>
  <div class="interaction-page">
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
            :disabled="!canManage"
            @update:checked="(v: boolean) => (form.aiCommentEnabled = v ? 1 : 0)"
          />
          <span class="field-hint">开了之后，新发布的稿子会在发布后一个月内挑随机时刻补写评论。</span>
        </a-form-item>

        <a-form-item label="虚拟点赞">
          <a-switch
            id="interaction-virtual-like"
            :checked="form.virtualLikeEnabled === 1"
            :disabled="!canManage"
            @update:checked="(v: boolean) => (form.virtualLikeEnabled = v ? 1 : 0)"
          />
          <span class="field-hint">开了之后，发布那一刻就按下面的区间写一个点赞数；关掉只显真人点的。</span>
        </a-form-item>

        <a-form-item label="读者评论怎么处理">
          <a-radio-group id="interaction-moderation-mode" v-model:value="form.moderationMode" :disabled="!canManage">
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
            :disabled="!canManage"
          />
          <span class="field-hint">1~10 条。一篇稿子底下十几条「好评」看起来就不像真实读者了。</span>
        </a-form-item>

        <a-form-item label="补写的点赞数区间">
          <a-space>
            <a-input-number id="interaction-like-min" v-model:value="form.likeSeedMin" :min="0" :max="999" :disabled="!canManage" />
            <span class="range-sep">~</span>
            <a-input-number id="interaction-like-max" v-model:value="form.likeSeedMax" :min="0" :max="999" :disabled="!canManage" />
          </a-space>
          <span class="field-hint">发布时在这段里随机取一个数。上界小于下界会存不下。</span>
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button :disabled="configLoading" @click="loadConfig">重新读取</a-button>
            <a-button id="interaction-save-config" type="primary" :loading="saving" :disabled="!canManage" @click="saveConfig">
              保存设置
            </a-button>
          </a-space>
          <div v-if="!canManage" class="permission-hint">
            改这几项要「读者互动」的管理权限（interaction:manage）——租户管理员默认有这一码，也可以在角色页分给别的角色。
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

    <a-card title="待审评论" :bordered="false">
      <FilterBar>
        <a-select
          id="interaction-status-filter"
          v-model:value="statusFilter"
          style="width: 180px"
          :options="statusOptions"
          @change="reloadQueue"
        />
        <template #actions>
          <a-space>
            <a-button size="small" :loading="queueLoading" @click="reloadQueue">刷新</a-button>
          </a-space>
        </template>
      </FilterBar>
      <a-alert v-if="queueError" type="error" show-icon message="队列没读到" :description="queueError" />
      <a-table
        v-else
        :columns="commentColumns"
        :data-source="comments"
        :loading="queueLoading"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <template #emptyText>
          <div class="empty-hint">{{ statusFilter === 'pending' ? '没有等待处理的评论。' : '这一档里没有记录。' }}</div>
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
              <a-button
                v-if="record.status === 'pending'"
                id="interaction-approve"
                type="link"
                size="small"
                @click="moderate(record, 'approve')"
              >放行</a-button>
              <a-button v-if="record.status === 'pending'" type="link" size="small" danger @click="moderate(record, 'reject')">
                驳回
              </a-button>
              <a-popconfirm
                title="摘除 = 从网站上撤下、也不再出现在这个列表里，但库里的记录仍然留着。确定摘除？"
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
      </a-table>
      <a-pagination
        v-if="total > pageSize"
        class="queue-pager"
        :current="page"
        :page-size="pageSize"
        :total="total"
        @change="(p: number) => { page = p; loadQueue() }"
      />
    </a-card>

    <a-card title="示例评论的排产计划" :bordered="false">
      <template #extra>
        <a-button size="small" :loading="seedLoading" @click="loadSeedTasks">刷新</a-button>
      </template>
      <a-alert v-if="seedError" type="error" show-icon message="排产计划没读到" :description="seedError" />
      <a-table
        v-else
        :columns="seedColumns"
        :data-source="seedTasks"
        :loading="seedLoading"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <template #emptyText>
          <div class="empty-hint">还没有排产计划：开着「AI 示例评论」再发布一篇稿子，这里才会出现时刻。</div>
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
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import FilterBar from '../../components/FilterBar.vue'
import {
  interactionApi,
  type InteractionCommentItem,
  type InteractionConfig,
  type InteractionSeedTask,
  type InteractionStats
} from '../../api/interaction'
import { useAuthStore } from '../../stores/auth'
import { formatDateTime } from '../../utils/format'

/**
 * 后台「读者互动」（P9-C，G-08）。
 *
 * 这一页最坏的形状是「开关开着，但补了多少、什么时候补、哪几条已经对外，租户一个都看不到」——
 * 那就是谎报。所以配置卡下面那句 `disclosure`、总账、排产计划三块都是必须存在的，
 * 而它们的话术全部来自后端，界面不拼第二份中文。
 *
 * 另一条硬规矩跟「每日产出」那页一样：读失败就老实地说读失败，不回填默认值、不摆空表。
 */

const authStore = useAuthStore()

const MANAGE_CODE = 'interaction:manage'

const canManage = computed(() => authStore.hasPermission(MANAGE_CODE))
const tenantId = computed(() => authStore.selectedTenantId ?? undefined)

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
const statusFilter = ref('pending')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const seedLoading = ref(false)
const seedError = ref('')
const seedTasks = ref<InteractionSeedTask[]>([])

const statusOptions = [
  { value: 'pending', label: '待审' },
  { value: 'approved', label: '已对外' },
  { value: 'rejected', label: '已驳回' },
  { value: 'all', label: '全部（待审 + 已对外 + 已驳回）' }
]

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

const statCells = computed(() => STAT_CELLS.map(cell => ({
  label: cell.label,
  value: stats.value ? Number(stats.value[cell.key] ?? 0) : 0
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
  configLoading.value = true
  try {
    const cfg = await interactionApi.config(tenantId.value)
    if (cfg) applyConfig(cfg)
    configError.value = ''
  } catch (error: any) {
    configError.value = error?.message || '配置读取失败'
  } finally {
    configLoading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  try {
    const saved = await interactionApi.saveConfig({ ...form }, tenantId.value)
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
  statsLoading.value = true
  try {
    stats.value = await interactionApi.stats(tenantId.value)
    statsError.value = ''
  } catch (error: any) {
    stats.value = null
    statsError.value = error?.message || '总账读取失败'
  } finally {
    statsLoading.value = false
  }
}

async function loadQueue() {
  queueLoading.value = true
  try {
    const data = await interactionApi.comments({ status: statusFilter.value, page: page.value, size: pageSize.value }, tenantId.value)
    comments.value = data?.items ?? []
    total.value = data?.total ?? 0
    queueError.value = ''
  } catch (error: any) {
    comments.value = []
    total.value = 0
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
  try {
    await interactionApi.moderate(record.id, action, tenantId.value)
    message.success(action === 'approve' ? '已放行，这条会显示在你官网上' : '已处理')
    await Promise.all([loadQueue(), loadStats()])
  } catch (error: any) {
    message.error(error?.message || '操作失败')
  }
}

async function loadSeedTasks() {
  seedLoading.value = true
  try {
    const data = await interactionApi.seedTasks(20, tenantId.value)
    seedTasks.value = Array.isArray(data) ? data : []
    seedError.value = ''
  } catch (error: any) {
    seedTasks.value = []
    seedError.value = error?.message || '排产计划读取失败'
  } finally {
    seedLoading.value = false
  }
}

watch(() => authStore.selectedTenantId, () => {
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
.interaction-page {
  width: 100%;
  padding: 8px 0;
}

.lead-alert,
.disclosure,
.queue-pager {
  margin-top: 16px;
}

.lead-alert {
  margin-bottom: 16px;
  margin-top: 0;
}

.config-form {
  max-width: 720px;
}

.field-hint {
  margin-left: 12px;
  color: #8c8c8c;
  font-size: 13px;
}

.block-hint {
  margin-left: 0;
  margin-top: 4px;
}

.permission-hint,
.updated-hint {
  margin-top: 8px;
  color: #8c8c8c;
  font-size: 13px;
}

.range-sep {
  color: #8c8c8c;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.stat-cell {
  background: #fafafa;
  border-radius: 6px;
  padding: 12px 16px;

  &__value {
    font-size: 22px;
    font-weight: 600;
    color: #1f2937;
  }

  &__label {
    margin-top: 2px;
    font-size: 13px;
    color: #8c8c8c;
  }
}

.skip-reason {
  color: #d46b08;
  font-size: 13px;
}

.note-text,
.muted,
.empty-hint {
  color: #8c8c8c;
  font-size: 13px;
}

.empty-hint {
  padding: 16px 0;
}
</style>
