<template>
  <a-drawer
    :open="open"
    title="示例评论的排产计划"
    :width="720"
    placement="right"
    @update:open="emit('update:open', $event)"
  >
    <record-list-page
      section
      :loading="loading"
      :rows="rows"
      :columns="COLUMNS"
      :read-failed="error"
      :retry="() => emit('reload')"
      :empty-line="emptyLine"
      :empty-reason="emptyReason"
      :not-sent="notSent"
    >
      <template #actions>
        <a-button size="small" :loading="loading" :disabled="loading" @click="emit('reload')">刷新</a-button>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'fireAt'">
          {{ formatDateTime(record.fireAt, true) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'detail'">
          <span v-if="record.skipReasonText" class="skip-reason">{{ record.skipReasonText }}</span>
          <span v-if="record.note" class="note-text">{{ record.note }}</span>
          <span v-if="!record.skipReasonText && !record.note" class="muted">—</span>
        </template>
      </template>
    </record-list-page>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * 「示例评论的排产计划」（Spec-R R1）：这是系统那侧的账，与「我今天要处理哪几条」是两件事，
 * 所以从页底挪进抽屉。表壳照旧走 RecordListPage 的 section 形，三态与横向滚层不另写一套。
 *
 * `skipReasonText` 原样念后端那一份，界面不拼第二份中文，也不把库里的码（SWITCH_OFF 这一类）摆给人看。
 */
import RecordListPage from '../../../components/RecordListPage.vue'
import type { InteractionSeedTask } from '../../../api/interaction'
import { formatDateTime } from '../../../utils/format'
import type { EmptyReason } from '../../../utils/emptyPage'

defineProps<{
  open: boolean
  loading: boolean
  rows: InteractionSeedTask[]
  error: string
  emptyLine: string
  emptyReason: EmptyReason
  notSent: string
}>()

const emit = defineEmits<{ 'update:open': [value: boolean], reload: [] }>()

const COLUMNS = [
  { title: '文章 id', dataIndex: 'articleId', key: 'articleId', width: 90 },
  { title: '第几条', dataIndex: 'seq', key: 'seq', width: 80 },
  { title: '计划时刻', key: 'fireAt', width: 160 },
  { title: '状态', key: 'status', width: 90 },
  { title: '说明', key: 'detail' }
]

const STATUS_LABELS: Record<string, string> = {
  PENDING: '等待时刻',
  DONE: '已补写',
  SKIPPED: '跳过',
  FAILED: '失败'
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

function statusColor(status: string) {
  if (status === 'DONE') return 'green'
  if (status === 'FAILED') return 'red'
  if (status === 'SKIPPED') return 'orange'
  return 'blue'
}
</script>

<style scoped lang="less">
/* 这一支橙是 antd 的 orange-7，比令牌里那支 colorWarning 深；换成 #faad14 在白底上对比度不够 */
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