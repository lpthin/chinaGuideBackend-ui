<template>
  <div class="notification-inbox">
    <a-alert type="info" show-icon class="notification-inbox__notice">
      <template #message>
        这里是站内待办：巡检闭环（跑一轮之后写进来的那一条）与公开页留资都会落到这一张表。
        列表按登录态过滤——超管没选租户时看到全平台的，租户账号只看到自己那一份。
        「类型」那一列显示的是后端写入时用的类型码，<strong>中文说法在标题与内容里</strong>：
        这一页不维护第二份类型字典，后端哪天改了名，这里不会指着旧名字说瞎话。
      </template>
    </a-alert>

    <a-form layout="inline" class="notification-inbox__toolbar">
      <a-form-item label="状态">
        <a-select v-model:value="status" style="width: 140px" :options="statusOptions" @change="reload" />
      </a-form-item>
      <a-form-item label="类型码">
        <a-input v-model:value="typeFilter" style="width: 200px" placeholder="照后端写入时那个类型码填"
                 allow-clear @press-enter="reload" />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button @click="reload">刷新</a-button>
          <a-button type="primary" :disabled="loading || unread === null || unread === 0"
                    :loading="readingAll" @click="readAll">全部标为已读</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table :data-source="records" :columns="columns" :loading="loading" row-key="id"
             :pagination="pagination" @change="onTableChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <span class="notification-inbox__type">{{ record.type }}</span>
        </template>
        <template v-else-if="column.key === 'status'">
          {{ statusText(record.status) }}
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ record.createdAt || '后端没给时间' }}
        </template>
        <template v-else-if="column.key === 'content'">
          <span class="notification-inbox__content">{{ record.content || record.title }}</span>
        </template>
        <template v-else-if="column.key === 'siteId'">
          {{ record.siteId ?? '不绑站点' }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button size="small" :disabled="record.status !== UNREAD" @click="markRead(record)">
            标为已读
          </a-button>
        </template>
      </template>
      <template #emptyText>
        <!-- 这一屏的空从前只有一句写死的「按当前筛选没有待办」：「这一档真的没有」「这一页翻过了头」
             「选中的那一家读不到」「这一发读失败」四种念法长成一个样（M-P88）。
             这一页没有「新建待办」这个动作，所以不摆新建入口。 -->
        <empty-list-hint
          :loading="loading"
          :read-failed="readFailed"
          :empty-line="emptyLine"
          :empty-reason="emptyReason"
        />
      </template>
    </a-table>

    <p class="notification-inbox__count">
      未读 {{ unread === null ? '没取到' : unread }} 条（未读数与列表分开取，任一失败都只说自己的那段）。
      <span v-if="markedAll !== null">刚把 {{ markedAll }} 条标为已读。</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { describeHttpError } from '../../api/http'
import { notificationsApi, type NotificationRecord } from '../../api/notifications'
import EmptyListHint from '../../components/EmptyListHint.vue'
import {
  asEmptyReason,
  shouldJumpBackToFirstPage,
  JUMP_BACK_NOTICE,
  type EmptyReason
} from '../../utils/emptyPage'

/**
 * 超管待办（Spec §13.3-6 的最后一公里）。
 *
 * 三个判定只跟着接口走：
 * 1. 行数据、未读数、「全部标为已读」改了几条，全部来自 `/api/notifications`；
 * 2. 状态文案：库里存 unread/read 两个值，界面上说未读/已读——这是纯展示层的说法，
 *    不是后端词表；出现第三个值时原样写出来，不替它归成「已读」；
 * 3. 「标为已读」只对未读那一行可点，已读的行不给出一个点了只会重复写的按钮；
 * 4. 空表那一格逐字念后端回的成因（M-P88）：真的没有 / 这一页翻过了头 / 选中的那一家读不到 /
 *    这一发读失败，四种不许长成一个样；「翻过了头」由界面自己翻回第一页再读一遍。
 */

const UNREAD = 'unread'
const READ = 'read'

const records = ref<NotificationRecord[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const unread = ref<number | null>(null)

const status = ref<string | undefined>(UNREAD)
const typeFilter = ref('')

const loading = ref(false)
const readingAll = ref(false)
const readFailed = ref('')
const emptyLine = ref('')
const emptyReason = ref<EmptyReason>(null)
const markedAll = ref<number | null>(null)

const statusOptions = [
  { value: '', label: '全部' },
  { value: UNREAD, label: '未读' },
  { value: READ, label: '已读' }
]

const columns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 150 },
  { title: '内容', dataIndex: 'content', key: 'content' },
  { title: '站点', dataIndex: 'siteId', key: 'siteId', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 110 }
]

const pagination = computed(() => ({
  current: page.value,
  pageSize: size.value,
  total: total.value,
  showTotal: (count: number) => `共 ${count} 条`
}))

/** 未读/已读是展示层说法；库里有第三种值就原样写，不替它归类 */
function statusText(value: string): string {
  if (value === UNREAD) return '未读'
  if (value === READ) return '已读'
  return value
}

async function load() {
  loading.value = true
  readFailed.value = ''
  emptyLine.value = ''
  emptyReason.value = null
  try {
    const result = await notificationsApi.list({
      page: page.value, size: size.value, status: status.value, type: typeFilter.value
    })
    records.value = result.records || []
    total.value = result.total || 0
    emptyLine.value = result.emptyLine || ''
    emptyReason.value = asEmptyReason(result.emptyReason)
    // 「这一页翻过了头」不是一句解释就完事：翻回第一页再读一遍，最多多发一发
    if (shouldJumpBackToFirstPage(emptyReason.value, page.value)) {
      page.value = 1
      await load()
      message.info(JUMP_BACK_NOTICE)
    }
  } catch (err) {
    // 读失败不是「这一档没有」：旧行清掉，让这一格念出失败那一句
    records.value = []
    total.value = 0
    readFailed.value = describeHttpError(err)
    message.error(`加载待办列表失败：${describeHttpError(err)}`)
  } finally {
    loading.value = false
  }
}

async function loadUnread() {
  try {
    unread.value = (await notificationsApi.unreadCount()).total
  } catch {
    unread.value = null
  }
}

function reload() {
  page.value = 1
  return Promise.all([load(), loadUnread()])
}

function onTableChange(pager: { current?: number; pageSize?: number }) {
  page.value = pager.current || 1
  size.value = pager.pageSize || size.value
  void load()
}

async function markRead(record: NotificationRecord) {
  try {
    await notificationsApi.read(record.id)
    await Promise.all([load(), loadUnread()])
  } catch (err) {
    message.error(`标为已读失败：${describeHttpError(err)}`)
  }
}

/** 后端回的是「改了几条」，界面就报几条：不写「已全部标记」这种把结果自己圆掉的话 */
async function readAll() {
  readingAll.value = true
  readFailed.value = ''
  try {
    const changed = await notificationsApi.readAll()
    markedAll.value = typeof changed === 'number' ? changed : 0
    await reload()
  } catch (err) {
    message.error(`全部标为已读失败：${describeHttpError(err)}`)
  } finally {
    readingAll.value = false
  }
}

onMounted(() => reload())
</script>

<style scoped lang="less">
.notification-inbox {
  padding: 16px;

  &__notice {
    margin-bottom: 12px;
  }

  &__toolbar {
    margin-bottom: 12px;
  }

  &__content {
    white-space: pre-wrap;
  }

  &__type {
    font-family: Consolas, Monaco, monospace;
    font-size: 12px;
  }

  &__count {
    margin-top: 8px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }
}
</style>
