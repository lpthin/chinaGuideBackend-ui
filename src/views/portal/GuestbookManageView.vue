<template>
  <div class="guestbook-manage-page">
    <a-page-header title="留言管理" sub-title="管理门户网站的用户留言和回复">
    </a-page-header>

    <div class="content-wrapper">
      <!-- 这一屏属于哪一家：改前超管没选客户时，界面拿 auth.tenantId 兜底偷偷去问 1 号（M-P100 现测 (b)） -->
      <a-alert v-if="scopeNotice" class="scope-alert" type="info" show-icon :message="scopeNotice" />
      <a-alert
        v-if="statsState === 'failed'"
        class="scope-alert"
        type="error"
        show-icon
        :message="`那四个数没读上来：${statsError}（读不到不是「这一家没有留言」）`"
      />
      <a-spin :spinning="loading">
        <a-row :gutter="16" style="margin-bottom: 4px">
          <a-col :span="24">
            <!-- 四张卡的口径写死在屏上：它们数的是这一家全部留言，不跟着下面的筛选走 -->
            <span class="stats-scope-line">
              下面四个数数的是这一家<strong>全部留言</strong>（不随下面的状态、类型、关键词筛选变）。
            </span>
          </a-col>
        </a-row>
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                  <MessageOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ statText(stats?.totalMessages) }}</div>
                  <div class="stat-title">留言总数</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                  <CheckCircleOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ statText(stats?.repliedCount) }}</div>
                  <div class="stat-title">已回复</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%)">
                  <ClockCircleOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ statText(stats?.pendingCount) }}</div>
                  <div class="stat-title">待回复</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #eb2f96 0%, #ff85c0 100%)">
                  <UserOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ statText(stats?.todayCount) }}</div>
                  <div class="stat-title">今日新增</div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-card :bordered="false">
          <!-- 筛选栏原本塞在卡片 #title 槽：那是 overflow:hidden 的卡头，窄时会被裁切；改用 FilterBar -->
          <filter-bar>
            <a-select
              v-model:value="queryParams.status"
              style="width: 120px"
              placeholder="状态筛选"
              allowClear
              @change="loadData"
            >
              <a-select-option value="pending">待回复</a-select-option>
              <a-select-option value="replied">已回复</a-select-option>
              <a-select-option value="closed">已关闭</a-select-option>
            </a-select>
            <!-- 类型名一个都不写在这里：这份词表后端有，抄一份就会跟它分家（I-1） -->
            <a-select
              v-model:value="queryParams.type"
              style="width: 140px"
              placeholder="类型筛选"
              allowClear
              @change="loadData"
            >
              <a-select-option v-for="(label, code) in typeLabels" :key="code" :value="code">
                {{ label }}
              </a-select-option>
            </a-select>
            <a-input-search
              v-model:value="queryParams.keyword"
              placeholder="搜索留言内容/用户"
              style="width: 250px"
              enter-button
              @search="loadData"
            />
          </filter-bar>

          <a-table
            :scroll="{ x: 'max-content' }"
            :columns="columns"
            :data-source="messageList"
            :pagination="false"
            :row-key="(record: any) => record.id"
          >
            <!-- 这一屏的空会被销售读成「这家没有线索」，所以那一句只认后端回的成因（N-05） -->
            <template #emptyText>
              <empty-list-hint
                :loading="loading"
                :not-sent="notSentLine"
                :read-failed="readFailed"
                :empty-line="emptyLine"
                :empty-reason="emptyReason"
              />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'content'">
                <div class="message-content">{{ record.content }}</div>
                <div v-if="record.replyContent" class="reply-content">
                  <span class="reply-label">回复：</span>{{ record.replyContent }}
                </div>
              </template>
              <template v-if="column.key === 'type'">
                <a-tag>{{ typeLabelOf(record.type) }}</a-tag>
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="getStatusColor(record.status)">
                  {{ getStatusName(record.status) }}
                </a-tag>
              </template>
              <template v-if="column.key === 'company'">
                {{ record.companyName || '—' }}
              </template>
              <template v-if="column.key === 'budget'">
                {{ budgetLabelOf(record.budgetCode) }}
              </template>
              <template v-if="column.key === 'createTime'">
                {{ formatDateTime(record.createTime) }}
              </template>
              <template v-if="column.key === 'replyTime'">
                {{ formatDateTime(record.replyTime) }}
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="handleReply(record)">
                    {{ record.replyContent ? '查看回复' : '回复' }}
                  </a-button>
                  <a-popconfirm
                    title="确定要删除这条留言吗？"
                    @confirm="handleDelete(record.id)"
                  >
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>

          <div v-if="!notSentLine" class="pagination-wrapper">
            <a-pagination
              v-model:current="pagination.page"
              v-model:page-size="pagination.size"
              :total="pagination.total"
              :show-size-changer="true"
              :show-quick-jumper="true"
              :page-size-options="['10', '20', '50']"
              @change="loadData"
              @showSizeChange="handleSizeChange"
              :show-total="(total: number) => countLabel(total)"
            />
          </div>
        </a-card>
      </a-spin>
    </div>

    <a-modal
      v-model:open="replyModalVisible"
      :title="currentRecord?.replyContent ? '查看回复' : '回复留言'"
      @ok="handleReplyOk"
      :confirmLoading="saving"
      width="600px"
      :footer="currentRecord?.replyContent ? null : undefined"
    >
      <a-descriptions bordered :column="1" size="small">
        <a-descriptions-item label="留言用户">
          {{ currentRecord?.userName || '—' }}
        </a-descriptions-item>
        <a-descriptions-item label="联系方式">
          <span v-if="currentRecord?.phone">电话：{{ currentRecord?.phone }}</span>
          <span v-if="currentRecord?.email" style="margin-left: 16px">邮箱：{{ currentRecord?.email }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="公司">
          {{ currentRecord?.companyName || '—' }}
        </a-descriptions-item>
        <a-descriptions-item label="预算范围">
          {{ budgetLabelOf(currentRecord?.budgetCode) }}
        </a-descriptions-item>
        <a-descriptions-item label="留言内容">
          <div style="white-space: pre-wrap">{{ currentRecord?.content }}</div>
        </a-descriptions-item>
        <a-descriptions-item label="留言时间">
          {{ formatDateTime(currentRecord?.createTime) }}
        </a-descriptions-item>
        <a-descriptions-item v-if="currentRecord?.replyContent" label="回复内容">
          <div style="white-space: pre-wrap">{{ currentRecord?.replyContent }}</div>
        </a-descriptions-item>
        <a-descriptions-item v-if="currentRecord?.replyTime" label="回复时间">
          {{ formatDateTime(currentRecord?.replyTime) }}
        </a-descriptions-item>
      </a-descriptions>

      <template v-if="!currentRecord?.replyContent">
        <a-divider orientation="left">回复内容</a-divider>
        <a-form layout="vertical">
          <a-form-item label="回复内容">
            <a-textarea
              v-model:value="replyForm.content"
              :rows="4"
              placeholder="请输入回复内容"
              :maxlength="500"
              show-count
            />
          </a-form-item>
        </a-form>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  MessageOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { guestbookApi } from '../../api/portal'
import type { Guestbook, GuestbookQuery, GuestbookStats } from '../../types/portal'
import { formatDateTime } from '../../utils/format'
import FilterBar from '../../components/FilterBar.vue'
import EmptyListHint from '../../components/EmptyListHint.vue'
import { describeHttpError } from '../../api/http'
import { JUMP_BACK_NOTICE, asEmptyReason, shouldJumpBackToFirstPage, type EmptyReason } from '../../utils/emptyPage'
import { useAuthStore } from '../../stores/auth'
import { logError } from '../../utils/errorLog'

const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
// 空态的那一句只认后端（N-05）：没发出去 / 读失败 / 后端答了成因 / 后端没答，四件事分开说
const notSentLine = ref('')
const readFailed = ref('')
const emptyLine = ref('')
const emptyReason = ref<EmptyReason>(null)
const replyModalVisible = ref(false)
const currentRecord = ref<Guestbook | null>(null)

/**
 * 这一屏的数属于谁。超管没选定客户就是 null ⇒ 列表和统计一口都不发。
 * 改前是 `auth.selectedTenantId || auth.tenantId`，而 `auth.tenantId` 兜底成 1，
 * 所以超管没选客户时这一屏偷偷摆的是 1 号那一家（M-P100 现测 (b)：`selected_tenant_id=null` 仍发 `tenantId=1`）。
 */
const requestedTenantId = computed<number | null>(() => {
  if (auth.isSuperAdmin) return auth.selectedTenantId ?? null
  return auth.user?.tenantId ?? null
})

const scopeNotice = computed(() => {
  const id = requestedTenantId.value
  if (id === null) {
    return auth.isSuperAdmin
      ? '当前没有选定客户，这一屏不发请求、也不摆任何一家的数。请在右上角选一家客户。'
      : '登录信息里没有客户编号，这一屏不发请求、也不摆数。'
  }
  const code = auth.selectedTenantCode
  const who = auth.isSuperAdmin
    ? `当前看的是${code ? `客户「${code}」` : '选中的那一家客户'}（编号 #${id}）`
    : `当前看的是你所在客户（编号 #${id}）`
  return `${who}的留言数据。`
})

type StatsState = 'idle' | 'loading' | 'ok' | 'failed'

/** 后端 `GET /guestbook/stats` 一口回四个数；null 表示「没读到」，界面就摆 `—`，不摆 0 */
const stats = ref<GuestbookStats | null>(null)
const statsState = ref<StatsState>('idle')
const statsError = ref('')

/** 读不到就摆 `—`：把「没读到」画成 0 是这一屏原来最主要的假话 */
function statText(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString()
}

/** 「共 N 条」只在真读回来的时候念数字；没发出去或读失败时它是「没读到」，不是 0 */
function countLabel(total: number): string {
  if (notSentLine.value || readFailed.value) return '条数没读到'
  return `共 ${total} 条`
}

const queryParams = reactive({
  status: undefined as string | undefined,
  type: undefined as string | undefined,
  keyword: '',
})

const pagination = reactive({
  page: 1,
  size: 10,
  total: 0,
})

const replyForm = reactive({
  content: '',
})

const messageList = ref<Guestbook[]>([])

const columns = [
  { title: '访客', dataIndex: 'userName', key: 'userName', width: 120 },
  { title: '类型', key: 'type', width: 110 },
  { title: '联系方式', dataIndex: 'phone', key: 'phone', width: 150 },
  // 拍板 2026-09-27 补的两格：销售看线索时第一眼要找的就是「哪家公司、单子多大」
  { title: '公司', key: 'company', width: 180 },
  { title: '预算范围', key: 'budget', width: 120 },
  { title: '留言内容', key: 'content', width: 300 },
  { title: '状态', key: 'status', width: 100 },
  { title: '留言时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: '回复时间', dataIndex: 'replyTime', key: 'replyTime', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 150 },
]

/** 中文标签只有一个来源：GET /guestbook/types 与 GET /guestbook/budgets（I-1）。
 *  拉不到时原样显示代码，不自造一个「未知类型」「未知档位」——那等于假装系统认得这个值 */
const typeLabels = ref<Record<string, string>>({})
const budgetLabels = ref<Record<string, string>>({})

function typeLabelOf(type?: string | null): string {
  if (!type) return '—'
  return typeLabels.value[type] || type
}

function budgetLabelOf(code?: string | null): string {
  if (!code) return '—'
  return budgetLabels.value[code] || code
}

async function loadVocabulary() {
  try {
    typeLabels.value = await guestbookApi.types()
  } catch (error) {
    // 词表拉不到不该挡住列表：徽标退化成后端原话，仍然是可信信息
    logError('portal/guestbook-manage-view', '加载留言类型词表失败:', error)
  }
  try {
    budgetLabels.value = await guestbookApi.budgets()
  } catch (error) {
    logError('portal/guestbook-manage-view', '加载预算档位词表失败:', error)
  }
}

function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    pending: 'orange',
    replied: 'green',
    closed: 'default',
  }
  return colorMap[status] || 'default'
}

function getStatusName(status: string): string {
  const nameMap: Record<string, string> = {
    pending: '待回复',
    replied: '已回复',
    closed: '已关闭',
  }
  return nameMap[status] || status
}

function handleReply(record: Guestbook) {
  currentRecord.value = record
  replyForm.content = record.replyContent || ''
  replyModalVisible.value = true
}

async function handleReplyOk() {
  if (!replyForm.content.trim()) {
    message.error('请输入回复内容')
    return
  }

  saving.value = true
  try {
    if (!currentRecord.value) return
    await guestbookApi.reply(currentRecord.value.id, replyForm.content)
    message.success('回复成功')
    replyModalVisible.value = false
    await refreshAfterChange()
  } catch (error) {
    // 后端那句原因原文比「回复失败」有用：这一家读不到、这条已被别人回过，是两种不同的下一步
    message.error(`回复失败：${describeHttpError(error)}`)
    logError('portal/guestbook-manage-view', error)
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await guestbookApi.delete(id)
    message.success('删除成功')
    // 删一条会同时挪动「留言总数」和「待回复/已回复」，两头都得重取一遍
    await refreshAfterChange()
  } catch (error) {
    message.error(`删除失败：${describeHttpError(error)}`)
    logError('portal/guestbook-manage-view', error)
  }
}

async function loadData() {
  const tenantId = requestedTenantId.value
  if (tenantId === null) {
    // 没选定客户时连请求都不发：发出去后端也只会回「请先选择租户」，而界面拿别人的家的数摆在这儿更糟
    loading.value = false
    notSentLine.value = '当前没有选定客户，这一发没发出去，所以这里的行一条都不是（不是「这一家没有留言」）。'
    readFailed.value = ''
    emptyLine.value = ''
    emptyReason.value = null
    messageList.value = []
    pagination.total = 0
    return
  }
  loading.value = true
  notSentLine.value = ''
  readFailed.value = ''
  emptyLine.value = ''
  emptyReason.value = null
  try {
    const params: GuestbookQuery = {
      tenantId,
      page: pagination.page,
      size: pagination.size,
      status: queryParams.status || undefined,
      type: queryParams.type || undefined,
      keyword: queryParams.keyword.trim() || undefined,
    }
    const result = await guestbookApi.list(params)
    messageList.value = result.records || []
    pagination.total = result.total || 0
    emptyLine.value = result.emptyLine || ''
    emptyReason.value = asEmptyReason(result.emptyReason)
    // 「这一页翻过了头」不是一句解释就完事：翻回第一页再读一遍（判据在 emptyPage，最多多发一发）
    if (shouldJumpBackToFirstPage(emptyReason.value, pagination.page)) {
      pagination.page = 1
      await loadData()
      message.info(JUMP_BACK_NOTICE)
      return
    }
  } catch (error) {
    readFailed.value = describeHttpError(error)
    messageList.value = []
    pagination.total = 0
    message.error(`加载留言列表失败：${readFailed.value}`)
    logError('portal/guestbook-manage-view', error)
  } finally {
    loading.value = false
  }
}

/**
 * 四个数一口取回来。改前这里发四口 `list?page=1&size=1` 只为各拿一个 `total`，
 * 且四发挤在同一个 `try` 里 —— 中间一发断了后面几发根本不发，卡照旧摆 0（M-P100 现测 (c)）。
 * 它也不再挂在 `loadData()` 的尾巴上：列表与统计各读各的，一边断不影响另一边说真话。
 */
async function loadStats() {
  const tenantId = requestedTenantId.value
  if (tenantId === null) {
    stats.value = null
    statsState.value = 'idle'
    statsError.value = ''
    return
  }
  statsState.value = 'loading'
  statsError.value = ''
  try {
    stats.value = await guestbookApi.stats(tenantId)
    statsState.value = 'ok'
  } catch (error) {
    stats.value = null
    statsState.value = 'failed'
    statsError.value = describeHttpError(error)
    logError('portal/guestbook-manage-view', '加载统计数据失败:', error)
  }
}

function loadAll() {
  // 词表与这一家的数互不依赖：一处断不该把另外两处拖成摆 0
  loadVocabulary()
  loadStats()
  loadData()
}

/** 回完/删完要两头一起重取：待回复与已回复那两张卡跟这两个动作直接相关 */
function refreshAfterChange() {
  return Promise.all([loadData(), loadStats()])
}

function handleSizeChange(_current: number, size: number) {
  pagination.page = 1
  pagination.size = size
  loadData()
}

onMounted(() => {
  loadAll()
})
</script>

<style scoped lang="less">
.guestbook-manage-page {
  width: 100%;
  padding: 0;
}

.content-wrapper {
}

.scope-alert {
  margin-bottom: 12px;
}

.stats-scope-line {
  display: inline-block;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.message-content {
  font-size: 14px;
  color: #1a1a1a;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.6;
}

.reply-content {
  font-size: 12px;
  color: #8c8c8c;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 4px;
  border-left: 3px solid #1890ff;

  .reply-label {
    color: #1890ff;
    font-weight: 500;
  }
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
