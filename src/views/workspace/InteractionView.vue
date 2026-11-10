<template>
  <div class="interaction-page">
    <PageTitle description="访客在你官网文章下面写的评论与点的赞，都在这一屏处理。">
      <template #extra>
        <a-space wrap>
          <a-button id="interaction-open-config" @click="configOpen = true">互动设置</a-button>
          <a-button id="interaction-open-stats" @click="statsOpen = true">互动总账</a-button>
          <a-button id="interaction-open-seed" @click="seedOpen = true">排产计划</a-button>
        </a-space>
      </template>
    </PageTitle>

    <!-- 互动配置、总账、待审队列与排产计划都按客户分开：平台档（超管没选客户）不发请求、写口全灰。
         前置条件改成一行灰字，不占色块（SPEC-UI-11 B 类） -->
    <p v-if="isPlatformMode" class="scope-hint">
      互动设置、互动总账、待审评论与排产计划都按客户分开：请先在右上角切到「客户」并选一家，再读、再改。平台档这里不发业务请求。
    </p>

    <!-- 十格总账收进抽屉之后，首屏至少留这一格：它是「等我处理」里只数读者写的那一个数。
         旁边那句「只数读者写的」必须写出来——下面队列那一行数的是全部评论，两个数天生不一样。 -->
    <div class="interaction-head">
      <span class="interaction-head__value">{{ pendingReaderValue }}</span>
      <span class="interaction-head__label">等我处理的读者评论</span>
      <span class="interaction-head__note">只数读者写的，不含系统补的；十格全账在「互动总账」里</span>
    </div>

    <!-- 这句实话是后端发的（`disclosure`）：开关开着系统会替你补评论、前台又不标 AI，
         所以它必须留在首屏，不能只藏在设置抽屉里。界面不拼第二份中文。 -->
    <a-alert v-if="disclosure" class="interaction-disclosure" type="warning" show-icon :message="disclosure" />

    <!-- 待审评论这一块的壳走 Spec-Q 的 RecordListPage（B 型：第一条读数是「等我处理」）。
         这一屏不止一块，所以是 `section` 形：页头由上面那份 PageTitle 摆，这里只报这一块是谁。 -->
    <record-list-page
      section
      card-title="待审评论"
      :loading="queueLoading"
      :rows="comments"
      :columns="commentColumns"
      :scroll="{ x: 990 }"
      :read-failed="queueError"
      :retry="reloadQueue"
      :empty-line="queueEmptyLine"
      :empty-reason="queueEmptyReason"
      :not-sent="queueNotSent"
      :count-line="queueCountLine"
    >
      <template #filters>
        <!-- Q8 拍的「一排带计数的选项」：五个档平铺，数只认后端 counts 那一格（不随当前档变）。
             读不到 counts 时只摆档名不摆数，不编一个 0 顶上。 -->
        <div id="interaction-status-filter" class="status-chips" role="tablist">
          <button
            v-for="chip in statusChips"
            :key="chip.value"
            type="button"
            class="status-chip"
            :class="{ 'status-chip--active': statusFilter === chip.value }"
            @click="pickStatus(chip.value)"
          >{{ chip.label }}<span v-if="chip.count" class="status-chip__count">{{ chip.count }}</span></button>
        </div>
      </template>
      <template #actions>
        <a-space wrap>
          <a-button size="small" :loading="queueLoading" :disabled="queueLoading" @click="reloadQueue">刷新</a-button>
          <template v-if="canManage">
            <span v-if="selectedIds.length" class="muted">已选 {{ selectedIds.length }} 条</span>
            <a-button size="small" type="link" @click="selectAllOnPage">全选本页</a-button>
            <a-button
              v-if="selectedIds.length"
              id="interaction-batch-approve"
              size="small"
              type="primary"
              :loading="batchLoading" :disabled="batchLoading"
              @click="runBatch('approve')"
            >批量放行</a-button>
            <a-button
              v-if="selectedIds.length"
              id="interaction-batch-reject"
              size="small"
              danger
              :loading="batchLoading" :disabled="batchLoading"
              @click="runBatch('reject')"
            >批量驳回</a-button>
          </template>
        </a-space>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'select'">
          <a-checkbox
            :checked="selectedIds.includes(record.id)"
            :aria-label="'勾选第 ' + record.id + ' 条'"
            @change="(e: any) => toggleSelect(record.id, e.target.checked)"
          />
        </template>
        <template v-else-if="column.key === 'content'">
          <div class="comment-excerpt">{{ record.content }}</div>
          <a-button type="link" size="small" class="comment-excerpt__more" @click="openDetail(record)">看全文</a-button>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'source'">
          <div>{{ record.sourceText || '—' }}</div>
          <div v-if="record.authorName" class="muted">{{ record.authorName }}</div>
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-space v-if="canManage">
            <!--
              待审的行给放行，已摘除的行给放回：两个动作在后端是同一发 approve，
              区别只在转移表的哪一条边（pending→approved 与 removed→approved）。
              带后果的两个（驳回 / 摘除）收进「更多」：多一次点击，但少一次误点。
            -->
            <a-button
              v-if="record.status === 'pending' || record.status === 'removed'"
              id="interaction-approve"
              type="link"
              size="small"
              @click="moderate(record, 'approve')"
            >{{ record.status === 'removed' ? '放回' : '放行' }}</a-button>
            <a-dropdown v-if="record.status === 'pending' || record.status === 'approved'" :trigger="['click']">
              <a-button type="link" size="small">更多</a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item key="full" @click="openDetail(record)">看全文</a-menu-item>
                  <a-menu-item v-if="record.status === 'pending'" key="reject" @click="moderate(record, 'reject')">
                    驳回
                  </a-menu-item>
                  <a-menu-item key="remove" @click="askRemove(record)">摘除</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
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
          @change="(p: number) => { page = p; selectedIds = []; loadQueue() }"
        />
      </template>
    </record-list-page>

    <interaction-comment-drawer
      v-model:open="detailOpen"
      :comment="detailComment"
      :can-manage="canManage"
      :platform-mode="isPlatformMode"
      :remove-confirm-title="REMOVE_CONFIRM_TITLE"
      @moderate="(action: 'approve' | 'reject' | 'remove') => detailComment && moderate(detailComment, action)"
    />

    <!-- 「更多」里的摘除也要二次确认。下拉菜单一点就收起来，气泡确认挂不住，
         所以这一处用确认框；那句中文与详情抽屉里那颗共用同一份（下面那个常量）。 -->
    <a-modal
      v-model:open="removeConfirmOpen"
      title="确定摘除这一条？"
      :ok-text="'摘除'"
      :cancel-text="'先不'"
      @ok="confirmRemove"
    >
      <p>{{ REMOVE_CONFIRM_TITLE }}</p>
    </a-modal>

    <interaction-config-drawer
      v-model:open="configOpen"
      :loading="configLoading"
      :saving="saving"
      :error="configError"
      :disclosure="disclosure"
      :last-edited-at="lastEditedAt"
      :can-manage="canManage"
      :platform-mode="isPlatformMode"
      :config="config"
      @reload="loadConfig"
      @save="saveConfig"
    />
    <interaction-stats-drawer
      v-model:open="statsOpen"
      :loading="statsLoading"
      :error="statsError"
      :platform-mode="isPlatformMode"
      :stats="stats"
      @reload="loadStats"
    />
    <interaction-seed-plan-drawer
      v-model:open="seedOpen"
      :loading="seedLoading"
      :rows="seedTasks"
      :error="seedError"
      :empty-line="seedEmptyLine"
      :empty-reason="seedEmptyReason"
      :not-sent="seedNotSent"
      @reload="loadSeedTasks"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import RecordListPage from '../../components/RecordListPage.vue'
import InteractionConfigDrawer from './interaction/InteractionConfigDrawer.vue'
import InteractionStatsDrawer from './interaction/InteractionStatsDrawer.vue'
import InteractionSeedPlanDrawer from './interaction/InteractionSeedPlanDrawer.vue'
import InteractionCommentDrawer from './interaction/InteractionCommentDrawer.vue'
import {
  interactionApi,
  type InteractionCommentItem,
  type InteractionCommentPage,
  type InteractionConfig,
  type InteractionConfigForm,
  type InteractionSeedTask,
  type InteractionStats
} from '../../api/interaction'
import { useAuthStore } from '../../stores/auth'
import { formatNumber } from '../../utils/format'
import { JUMP_BACK_NOTICE, asEmptyReason, shouldJumpBackToFirstPage, type EmptyReason } from '../../utils/emptyPage'
import PageTitle from '../../components/PageTitle.vue'

/**
 * 后台「读者互动」（P9-C，G-08；Spec-R R1 重排）。
 *
 * 这一页最坏的形状是「开关开着，但补了多少、什么时候补、哪几条已经对外，租户一个都看不到」——
 * 那就是谎报。所以 `disclosure` 那句实话留在首屏，总账与排产计划收进页头按钮开的抽屉，
 * 而它们的话术全部来自后端，界面不拼第二份中文。
 *
 * Spec-R 之前这一屏是「说明 + 设置卡 + 总账卡 + 队列 + 排产卡」五块叠着：现场量到 1440 那一档
 * 第一行评论在 1478px 处，首屏一行都看不见（证据 scratch/spec-r-interaction/out/measure.json）。
 * 现在队列是第一块，三块低频内容各由页头一颗按钮开抽屉；读写仍留在这一页，
 * 所以开关抽屉不会动到队列的筛选、页码与滚动位置。
 *
 * 另一条硬规矩跟「每日产出」那页一样：读失败就老实地说读失败，不回填默认值、不摆空表。
 */

const authStore = useAuthStore()

const MANAGE_CODE = 'interaction:manage'

const canManage = computed(() => authStore.hasPermission(MANAGE_CODE))
/** 这一屏的请求会打到哪一家：超管跟右上角走，租户用户由登录态定 */
const requestedTenantId = computed(() => (authStore.isSuperAdmin ? authStore.selectedTenantId : authStore.tenantId))
/** 平台档 = 超管没选客户：互动都按客户存，这一档不发请求、写口全灰 */
const isPlatformMode = computed(() => requestedTenantId.value === null)

const configOpen = ref(false)
const statsOpen = ref(false)
const seedOpen = ref(false)

const configLoading = ref(false)
const saving = ref(false)
const configError = ref('')
const config = ref<InteractionConfig | null>(null)
const disclosure = computed(() => config.value?.disclosure ?? '')
const lastEditedAt = computed(() => config.value?.updatedAt ?? null)

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

/** 批量勾选（Q6）：只存 id，翻页/换档/切客户就清——一次上限 50 条、不跨页 */
const selectedIds = ref<number[]>([])
const batchLoading = ref(false)

const seedLoading = ref(false)
const seedError = ref('')
const seedTasks = ref<InteractionSeedTask[]>([])
const seedEmptyLine = ref('')
const seedEmptyReason = ref<EmptyReason>(null)

/**
 * 五档筛选（Q8 拍的「一排带计数的选项」）。「已摘除」是一档，不是一个查不回来的动作（那一条拍板）；
 * 「全部」把已摘除也算进来，所以四个数相加就是这一家现在查得到的全部评论。
 * 计数只认后端 `counts` 那一格：平台档 / 读失败时没有数，chip 只摆档名，不编一个 0。
 * 一个已知口径缺口写在这儿：这次改动之前摘除的评论是软删的那一形，
 * 四个数和这一档都看不到它们——那次以前的账不在这次范围内（Q1 拍的是「只管新的」）。
 */
const STATUS_CHIPS = [
  { value: 'pending', label: '待审' },
  { value: 'approved', label: '已对外' },
  { value: 'rejected', label: '已驳回' },
  { value: 'removed', label: '已摘除' },
  { value: 'all', label: '全部' }
]

const statusChips = computed(() => {
  const counts = queueCounts.value
  const countOf = (value: string) => {
    if (isPlatformMode.value || !counts) return ''
    if (value === 'all') {
      return formatNumber(counts.pending + counts.approved + counts.rejected + counts.removed)
    }
    return formatNumber(counts[value as keyof typeof counts] ?? 0)
  }
  return STATUS_CHIPS.map(chip => ({ ...chip, count: countOf(chip.value) }))
})

function pickStatus(value: string) {
  if (statusFilter.value === value) return
  statusFilter.value = value
  reloadQueue()
}

/** 页头留的那一格：后端 `stats.pendingReaderComments`，只数读者写的。平台档摆 —，与「读回来是 0」分开 */
const pendingReaderValue = computed(() => {
  if (isPlatformMode.value) return '—'
  return formatNumber(stats.value?.pendingReaderComments ?? 0)
})

/**
 * 待审队列的读数（Spec-Q §4.1 的 B 型：第一条摆「等我处理」，不是总数）。
 * 这四个数只认后端 `counts` 那一格——它按状态分开数，所以跟下面那颗下拉无关，
 * 也跟在界面里数当前页的行数是两件事（当前页几条写在翻页条的「共 N 条」里）。
 * 与页头那一格的口径差别由版式解决：页头那一格自己写着「只数读者写的」，这里写清「全部评论」。
 */
const queueCountLine = computed(() => {
  if (isPlatformMode.value || queueError.value || !queueCounts.value) return ''
  const counts = queueCounts.value
  return (
    `等我处理：待审 ${formatNumber(counts.pending)} 条。` +
    `已对外 ${formatNumber(counts.approved)} 条、已驳回 ${formatNumber(counts.rejected)} 条、` +
    `已摘除 ${formatNumber(counts.removed)} 条` +
    '（这四个数按这一家全部评论分开数，读者写的和系统补的都在内，不随下面的状态筛选变）'
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

const commentColumns = computed(() => [
  // 勾选列只在有管理权限时摆：没有批量动作的读口不占 50px
  ...(canManage.value ? [{ title: '', key: 'select', width: 50 }] : []),
  // 正文给上限宽度：不给的那一版被一条 1000 字的评论撑到 15445px，放行那颗按钮离手 14 屏。
  // 列宽之和就是上面 scroll.x 的那个数（990）：固定列宽 + 省略号，宽屏不再横向滚；
  // 现场量过 max-content 那一形（长标题把「文章」列撑到 523px、表 1599px），数字 x 才走固定列宽
  { title: '评论', key: 'content', width: 380 },
  { title: '文章', dataIndex: 'articleTitle', key: 'articleTitle', width: 160, ellipsis: true },
  { title: '来源', key: 'source', width: 160 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'actions', width: 150 }
])

/** 摘除那句确认词只此一份：行内「更多」的确认框与详情抽屉里那颗共用 */
const REMOVE_CONFIRM_TITLE =
  '摘除 = 从站点上撤下，前台不再显示；这一条会改到下面「已摘除」那一档，随时查得回来、也放得回去。确定摘除？'

const detailOpen = ref(false)
const detailComment = ref<InteractionCommentItem | null>(null)
const removeConfirmOpen = ref(false)
const removeTarget = ref<InteractionCommentItem | null>(null)

function openDetail(record: InteractionCommentItem) {
  detailComment.value = record
  detailOpen.value = true
}

function askRemove(record: InteractionCommentItem) {
  removeTarget.value = record
  removeConfirmOpen.value = true
}

function confirmRemove() {
  removeConfirmOpen.value = false
  if (removeTarget.value) moderate(removeTarget.value, 'remove')
  removeTarget.value = null
}

/** 状态码的中文只在这一处映射，没见过的码原样显示它自己（与每日产出那页同一纪律） */
const STATUS_LABELS: Record<string, string> = {
  pending: '待审',
  approved: '已对外',
  rejected: '已驳回',
  removed: '已摘除'
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

async function loadConfig() {
  // 配置按客户分开存：平台档没有「这一家」，这一发不发（开关与保存口由 isPlatformMode 全灰）
  if (isPlatformMode.value) {
    configError.value = ''
    configLoading.value = false
    return
  }
  configLoading.value = true
  try {
    config.value = await interactionApi.config(requestedTenantId.value ?? undefined)
    configError.value = ''
  } catch (error: any) {
    // 读失败不回填一套看着像存过的默认值：抽屉里只摆那句错，表单整块退场
    config.value = null
    configError.value = error?.message || '配置读取失败'
  } finally {
    configLoading.value = false
  }
}

async function saveConfig(form: InteractionConfigForm) {
  if (isPlatformMode.value) {
    message.warning('请先在右上角选择客户')
    return
  }
  saving.value = true
  try {
    // 保存后不关抽屉，并且把后端回的那份值回显进去——否则用户不知道存没存上
    config.value = await interactionApi.saveConfig(form, requestedTenantId.value ?? undefined)
    message.success('设置已保存')
  } catch (error: any) {
    // 区间与取值的判据在后端一处，这里原样念那句中文
    message.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function loadStats() {
  // 总账按客户算：平台档没有「这一家」，这一发不发（十格由抽屉摆 `—`）
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
  // 换档/刷新都清勾选：勾的是「这一页这几条」，换一个档还留着就是替人处理没看过的行
  selectedIds.value = []
  loadQueue()
}

/** 勾选上限与后端同数（50）：超了当场说，不让人勾完一整页点下去才被后端拒 */
const BATCH_MAX = 50

function toggleSelect(id: number, checked: boolean) {
  if (checked) {
    if (selectedIds.value.length >= BATCH_MAX) {
      message.warning(`一次最多批量处理 ${BATCH_MAX} 条；这一条先不勾，翻页会清空勾选`)
      return
    }
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id]
  } else {
    selectedIds.value = selectedIds.value.filter(existing => existing !== id)
  }
}

function selectAllOnPage() {
  const ids = comments.value.map(row => row.id).filter(id => !selectedIds.value.includes(id))
  const room = BATCH_MAX - selectedIds.value.length
  if (ids.length > room) {
    message.warning(`一次最多批量处理 ${BATCH_MAX} 条：这一页只勾到上限为止`)
    selectedIds.value = [...selectedIds.value, ...ids.slice(0, room)]
    return
  }
  selectedIds.value = [...selectedIds.value, ...ids]
}

/** 批量放行/驳回：后端逐行回 {id, ok, reason}，「M 条没动」要把每一行的原因念出来 */
async function runBatch(action: 'approve' | 'reject') {
  if (isPlatformMode.value) {
    message.warning('请先在右上角选择客户')
    return
  }
  batchLoading.value = true
  try {
    const outcome = await interactionApi.moderateBatch(selectedIds.value, action, requestedTenantId.value ?? undefined)
    const verb = action === 'approve' ? '放行' : '驳回'
    const failedRows = outcome?.results?.filter(row => !row.ok) ?? []
    if (!failedRows.length) {
      message.success(`批量${verb}完成：成功 ${formatNumber(outcome?.success ?? 0)} 条`)
    } else {
      message.warning(
        `批量${verb}完成：成功 ${formatNumber(outcome?.success ?? 0)} 条，` +
        `${formatNumber(failedRows.length)} 条没动（${failedRows.map(row => `#${row.id}：${row.reason}`).join('；')}）`
      )
    }
    selectedIds.value = []
    await Promise.all([loadQueue(), loadStats()])
  } catch (error: any) {
    // 上限 50 / 没勾行 / 动作不认，都被后端用中文拒：原样念
    message.error(error?.message || '批量处理失败')
  } finally {
    batchLoading.value = false
  }
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
    // 动作做完就关详情抽屉：队列重取之后那一行可能已经不在这一档里，留着会显示一份过期的状态
    detailOpen.value = false
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
/* 这一屏是「页头 + 一格数 + 一句实话 + 队列」，块与块的间距只在这一处定 */
.interaction-page {
  width: 100%;
  padding: var(--admin-space-1) 0;
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
}

/* 前置条件说明：一行灰字，不占色块（SPEC-UI-11 B 类） */
.scope-hint {
  margin: 0;
  color: var(--admin-text-secondary);
  font-size: 13px;
  line-height: 20px;
}

/* 页头留的那一格：只占一行，不做成一张卡（十格全账在抽屉里） */
.interaction-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--admin-space-1);

  &__value {
    font-size: 22px;
    font-weight: 600;
    color: var(--admin-text-primary);
    font-variant-numeric: var(--admin-font-nums);
  }

  &__label {
    font-size: 14px;
    color: var(--admin-text-primary);
  }

  &__note {
    font-size: 13px;
    color: var(--admin-text-secondary);
  }
}

.muted {
  color: var(--admin-text-secondary);
  font-size: 13px;
}

/* Q8：五个档平铺成一排，计数跟在档名后面；选中的那颗反白 */
.status-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--admin-space-1);
}

.status-chip {
  border: 1px solid var(--admin-border-color, #d9d9d9);
  background: transparent;
  border-radius: 999px;
  padding: 2px 12px;
  font-size: 13px;
  color: var(--admin-text-secondary);
  cursor: pointer;

  &--active {
    background: var(--admin-primary);
    border-color: var(--admin-primary);
    color: #fff;
  }

  &__count {
    margin-left: 4px;
    font-variant-numeric: var(--admin-font-nums);
  }
}

/* 正文两行封顶（隔壁留言管理那一屏同一形）：要读全文点「看全文」进详情抽屉，
   不用 hover 气泡——键盘与触屏拿不到 hover（WCAG 1.4.13） */
.comment-excerpt {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  line-height: 1.6;

  &__more {
    padding-left: 0;
    height: auto;
  }
}
</style>