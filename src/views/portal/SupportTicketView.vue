<template>
  <div class="support-ticket-page">
    <a-page-header
      :title="isQueue ? '平台工单队列' : '联系平台'"
      :sub-title="isQueue ? '处理租户提交给平台的工单' : '对网站建设有疑问？在这里联系平台，处理结果会显示在下方'"
    >
      <template #extra>
        <a-button v-if="!isQueue" type="primary" @click="openSubmit">提交新工单</a-button>
      </template>
    </a-page-header>

    <div class="content-wrapper">
      <a-card :bordered="false">
        <template #title>
          <a-space>
            <a-select
              v-model:value="statusFilter"
              style="width: 140px"
              placeholder="状态筛选"
              allowClear
              @change="loadData"
            >
              <a-select-option v-for="(label, code) in statusLabels" :key="code" :value="code">
                {{ label }}
              </a-select-option>
            </a-select>
          </a-space>
        </template>

        <a-table
          :scroll="{ x: 'max-content' }"
          :columns="columns"
          :data-source="tickets"
          :loading="loading"
          :pagination="false"
          :row-key="(r: SupportTicket) => r.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ statusLabels[record.status] || record.status }}</a-tag>
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
                <a-button v-if="isQueue && record.status !== 'closed'" type="link" size="small" @click="openReply(record)">
                  {{ record.replyContent ? '追加回复' : '回复' }}
                </a-button>
                <a-popconfirm
                  v-if="record.status !== 'closed'"
                  title="关闭后不能再回复，确定吗？"
                  @confirm="handleClose(record)"
                >
                  <a-button type="link" size="small" danger>关闭</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <a-modal v-model:open="submitVisible" title="提交工单" :confirm-loading="saving" @ok="handleSubmit">
      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="submitForm.topic" :maxlength="200" show-count placeholder="一句话说明诉求" />
        </a-form-item>
        <a-form-item label="内容" required>
          <a-textarea
            v-model:value="submitForm.content"
            :rows="5"
            :maxlength="2000"
            show-count
            placeholder="想调整哪些栏目/页面、希望什么效果、有没有参考示例"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="replyVisible" title="回复工单" :confirm-loading="saving" @ok="handleReplyOk">
      <a-descriptions v-if="current" bordered :column="1" size="small" style="margin-bottom: 16px">
        <a-descriptions-item label="标题">{{ current.topic }}</a-descriptions-item>
        <a-descriptions-item label="提交人">
          {{ current.userName || '-' }}（租户 {{ current.tenantId }}）
        </a-descriptions-item>
        <a-descriptions-item label="内容">
          <div style="white-space: pre-wrap">{{ current.content }}</div>
        </a-descriptions-item>
        <a-descriptions-item v-if="current.replyContent" label="上一条回复">
          <div style="white-space: pre-wrap">{{ current.replyContent }}</div>
        </a-descriptions-item>
      </a-descriptions>
      <a-textarea v-model:value="replyText" :rows="4" :maxlength="2000" show-count placeholder="回复内容会通知提交人" />
    </a-modal>

    <a-modal v-model:open="detailVisible" title="工单详情" :footer="null" width="640px">
      <a-descriptions v-if="current" bordered :column="1" size="small">
        <a-descriptions-item label="标题">{{ current.topic }}</a-descriptions-item>
        <a-descriptions-item label="状态">{{ statusLabels[current.status] || current.status }}</a-descriptions-item>
        <a-descriptions-item label="提交人">{{ current.userName || '-' }}</a-descriptions-item>
        <a-descriptions-item label="提交时间">{{ formatDateTime(current.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="内容">
          <div style="white-space: pre-wrap">{{ current.content }}</div>
        </a-descriptions-item>
        <a-descriptions-item v-if="current.replyContent" label="平台回复">
          <div style="white-space: pre-wrap">{{ current.replyContent }}</div>
          <div style="color: #8c8c8c; font-size: 12px; margin-top: 4px">
            {{ current.replierName || '' }} · {{ formatDateTime(current.replyTime) }}
          </div>
        </a-descriptions-item>
        <a-descriptions-item v-else label="平台回复">平台还没有回复这条工单</a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { supportTicketsApi, type SupportTicket } from '../../api/supportTickets'
import { formatDateTime } from '../../utils/format'

const props = withDefaults(defineProps<{ mode?: 'mine' | 'queue' }>(), { mode: 'mine' })
const isQueue = computed(() => props.mode === 'queue')

const loading = ref(false)
const saving = ref(false)
const tickets = ref<SupportTicket[]>([])
const statusFilter = ref<string | undefined>(undefined)
/** 状态词表只来自 /statuses，这里绝不抄第二份中文标签 */
const statusLabels = ref<Record<string, string>>({})

const submitVisible = ref(false)
const replyVisible = ref(false)
const detailVisible = ref(false)
const current = ref<SupportTicket | null>(null)
const submitForm = reactive({ topic: '', content: '' })
const replyText = ref('')

const columns = computed(() => {
  const base = [
    { title: '标题', dataIndex: 'topic', key: 'topic', width: 260 },
    { title: '状态', key: 'status', width: 100 },
    { title: '提交时间', key: 'createdAt', width: 180 },
    { title: '操作', key: 'actions', fixed: 'right' as const, width: 200 },
  ]
  if (isQueue.value) {
    base.splice(1, 0, { title: '提交人', dataIndex: 'userName', key: 'userName', width: 140 })
  }
  return base
})

function statusColor(status: string): string {
  const colorMap: Record<string, string> = { open: 'orange', replied: 'green', closed: 'default' }
  return colorMap[status] || 'default'
}

async function loadData() {
  loading.value = true
  try {
    tickets.value = isQueue.value
      ? await supportTicketsApi.listForAdmin(statusFilter.value)
      : await supportTicketsApi.listMine(statusFilter.value)
  } catch (error) {
    message.error('加载工单列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function openSubmit() {
  submitForm.topic = ''
  submitForm.content = ''
  submitVisible.value = true
}

async function handleSubmit() {
  if (!submitForm.topic.trim() || !submitForm.content.trim()) {
    message.error('标题和内容都要填')
    return
  }
  saving.value = true
  try {
    await supportTicketsApi.submit({ topic: submitForm.topic.trim(), content: submitForm.content.trim() })
    message.success('已提交，平台处理后结果会显示在这里')
    submitVisible.value = false
    await loadData()
  } catch (error) {
    console.error(error)
  } finally {
    saving.value = false
  }
}

function openDetail(record: SupportTicket) {
  current.value = record
  detailVisible.value = true
}

function openReply(record: SupportTicket) {
  current.value = record
  replyText.value = ''
  replyVisible.value = true
}

async function handleReplyOk() {
  if (!replyText.value.trim()) {
    message.error('请先填写回复内容')
    return
  }
  saving.value = true
  try {
    await supportTicketsApi.reply(current.value!.id, replyText.value.trim())
    message.success('已回复')
    replyVisible.value = false
    await loadData()
  } catch (error) {
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function handleClose(record: SupportTicket) {
  try {
    if (isQueue.value) {
      await supportTicketsApi.closeByAdmin(record.id)
    } else {
      await supportTicketsApi.close(record.id)
    }
    message.success('已关闭')
    await loadData()
  } catch (error) {
    console.error(error)
  }
}

onMounted(async () => {
  try {
    statusLabels.value = await supportTicketsApi.statuses()
  } catch (error) {
    console.error('加载工单状态词表失败:', error)
  }
  loadData()
})
</script>

<style scoped lang="less">
.support-ticket-page {
  width: 100%;
  padding: 0;
}
</style>
