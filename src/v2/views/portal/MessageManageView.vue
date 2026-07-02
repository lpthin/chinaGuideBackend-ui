<template>
  <div class="message-manage-page">
    <a-spin :spinning="loading">
      <div class="header-wrapper">
        <div class="tenant-select-wrapper" style="width: 200px">
          <TenantSelect v-model:modelValue="selectedTenantId" @change="handleTenantChange" />
        </div>
      </div>

      <div class="content-wrapper">
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                  <MailOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.totalMessages }}</div>
                  <div class="stat-title">消息总数</div>
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
                  <div class="stat-value">{{ stats.readCount }}</div>
                  <div class="stat-title">已读</div>
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
                  <div class="stat-value">{{ stats.unreadCount }}</div>
                  <div class="stat-title">未读</div>
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
                  <div class="stat-value">{{ stats.totalRecipients }}</div>
                  <div class="stat-title">接收用户</div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-card :bordered="false">
          <template #title>
            <a-space>
              <a-radio-group v-model:value="queryParams.type" button-style="solid" @change="handleTypeChange">
                <a-radio-button value="inbox">收件箱</a-radio-button>
                <a-radio-button value="outbox">发件箱</a-radio-button>
              </a-radio-group>
              <a-select
                v-model:value="queryParams.status"
                style="width: 120px"
                placeholder="状态"
                allowClear
                @change="handleSearch"
              >
                <a-select-option value="unread">未读</a-select-option>
                <a-select-option value="read">已读</a-select-option>
              </a-select>
              <a-input-search
                v-model:value="queryParams.keyword"
                placeholder="搜索标题/内容"
                style="width: 250px"
                enter-button
                @search="handleSearch"
              />
              <a-button type="primary" @click="showSendModal = true">
                <template #icon><SendOutlined /></template>
                发送消息
              </a-button>
            </a-space>
          </template>

          <a-table
            :columns="columns"
            :data-source="messageList"
            :pagination="paginationConfig"
            :row-key="(record: PortalMessage) => record.id"
            :row-selection="rowSelection"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'title'">
                <div class="message-title" :class="{ unread: !record.isRead }">
                  <MailOutlined v-if="!record.isRead" class="unread-icon" />
                  <a @click="viewDetail(record)">{{ record.title }}</a>
                </div>
                <div class="message-summary">{{ record.content }}</div>
              </template>
              <template v-if="column.key === 'type'">
                <a-tag :color="getTypeColor(record.type)">
                  {{ getTypeName(record.type) }}
                </a-tag>
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="!record.isRead ? 'orange' : 'default'">
                  {{ !record.isRead ? '未读' : '已读' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="viewDetail(record)">查看</a-button>
                  <a-popconfirm
                    title="确定要删除这条消息吗？"
                    @confirm="handleDelete(record.id)"
                  >
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-card>
      </div>
    </a-spin>

    <a-modal
      v-model:open="showSendModal"
      title="发送消息"
      :confirm-loading="sending"
      @ok="handleSendMessage"
      ok-text="发送"
      cancel-text="取消"
    >
      <a-form :model="sendForm" layout="vertical">
        <a-form-item label="接收范围" required>
          <a-radio-group v-model:value="sendForm.scope">
            <a-radio value="ALL_TENANTS">全部租户</a-radio>
            <a-radio value="SPECIFIC_TENANT">指定租户</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="sendForm.scope === 'SPECIFIC_TENANT'" label="选择租户" required>
          <TenantSelect v-model:modelValue="sendForm.tenantId" placeholder="请选择租户" />
        </a-form-item>
        <a-form-item label="消息标题" required>
          <a-input v-model:value="sendForm.title" placeholder="请输入消息标题" />
        </a-form-item>
        <a-form-item label="消息内容" required>
          <a-textarea v-model:value="sendForm.content" placeholder="请输入消息内容" :rows="6" />
        </a-form-item>
        <a-form-item label="消息类型">
          <a-select v-model:value="sendForm.type" style="width: 200px">
            <a-select-option value="SYSTEM">系统通知</a-select-option>
            <a-select-option value="NOTICE">公告</a-select-option>
            <a-select-option value="OTHER">其他</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  MailOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  SendOutlined,
} from '@ant-design/icons-vue'
import { portalMessageApi } from '../../api/portal'
import type { PortalMessage, PortalMessageStats, PortalMessageBroadcast } from '../../types/portal'
import type { Tenant } from '../../types/workspace'
import TenantSelect from '../../components/TenantSelect.vue'

const loading = ref(false)
const sending = ref(false)
const selectedTenantId = ref<number | undefined>()
const showSendModal = ref(false)

const stats = reactive<PortalMessageStats>({
  totalMessages: 0,
  readCount: 0,
  unreadCount: 0,
  totalRecipients: 0,
})

const queryParams = reactive({
  type: 'inbox' as 'inbox' | 'outbox',
  status: undefined as string | undefined,
  keyword: '',
})

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const messageList = ref<PortalMessage[]>([])

const selectedRowKeys = ref<number[]>([])

const rowSelection = {
  selectedRowKeys,
  onChange: (keys: number[]) => {
    selectedRowKeys.value = keys
  },
}

const columns = computed(() => [
  { title: '标题', key: 'title', width: 300 },
  { title: '类型', key: 'type', width: 100 },
  { title: queryParams.type === 'inbox' ? '发件人' : '收件人', dataIndex: 'senderId', key: 'sender', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '发送时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 150 },
])

const sendForm = reactive<PortalMessageBroadcast>({
  scope: 'ALL_TENANTS',
  tenantId: undefined,
  title: '',
  content: '',
  type: 'SYSTEM',
})

function getTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    SYSTEM: 'blue',
    NOTICE: 'green',
    OTHER: 'default',
  }
  return colorMap[type] || 'default'
}

function getTypeName(type: string): string {
  const nameMap: Record<string, string> = {
    SYSTEM: '系统通知',
    NOTICE: '公告',
    OTHER: '其他',
  }
  return nameMap[type] || type
}

async function loadStats() {
  try {
    const result = await portalMessageApi.stats()
    Object.assign(stats, result as any)
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

async function loadMessageList() {
  loading.value = true
  try {
    const params = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      isRead: queryParams.status ? queryParams.status === 'read' : undefined,
      keyword: queryParams.keyword || undefined,
    }

    let result
    if (queryParams.type === 'inbox') {
      result = await portalMessageApi.list(params as any)
    } else {
      result = await portalMessageApi.outbox(params as any)
    }
    const data = result as any
    messageList.value = data.records || []
    paginationConfig.total = data.total || 0
  } catch (error) {
    message.error('加载消息列表失败')
  } finally {
    loading.value = false
  }
}

async function loadAllData() {
  await Promise.all([loadStats(), loadMessageList()])
}

function handleTenantChange(tenant: Tenant | null) {
  if (tenant) {
    selectedTenantId.value = tenant.id
    paginationConfig.current = 1
    loadAllData()
  }
}

function handleTypeChange() {
  paginationConfig.current = 1
  loadMessageList()
}

function handleSearch() {
  paginationConfig.current = 1
  loadMessageList()
}

function handleTableChange(pagination: any) {
  paginationConfig.current = pagination.current
  paginationConfig.pageSize = pagination.pageSize
  loadMessageList()
}

async function viewDetail(record: PortalMessage) {
  if (!record.isRead && queryParams.type === 'inbox') {
    try {
      await portalMessageApi.markRead(record.id)
      record.isRead = true
      stats.unreadCount -= 1
      stats.readCount += 1
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }
  message.info(`查看消息：${record.title}`)
}

async function handleDelete(id: number) {
  try {
    await portalMessageApi.delete(id)
    message.success('删除成功')
    loadAllData()
  } catch (error) {
    message.error('删除失败')
  }
}

async function handleSendMessage() {
  if (!sendForm.title.trim()) {
    message.warning('请输入消息标题')
    return
  }
  if (!sendForm.content.trim()) {
    message.warning('请输入消息内容')
    return
  }
  if (sendForm.scope === 'SPECIFIC_TENANT' && !sendForm.tenantId) {
    message.warning('请选择租户')
    return
  }

  sending.value = true
  try {
    const result = await portalMessageApi.broadcast({
      scope: sendForm.scope,
      tenantId: sendForm.scope === 'SPECIFIC_TENANT' ? sendForm.tenantId : undefined,
      title: sendForm.title,
      content: sendForm.content,
      type: sendForm.type,
    })
    const data = result as any
    message.success(`发送成功，共发送给 ${data.count} 位用户`)
    showSendModal.value = false
    sendForm.scope = 'ALL_TENANTS'
    sendForm.tenantId = undefined
    sendForm.title = ''
    sendForm.content = ''
    sendForm.type = 'SYSTEM'
    loadAllData()
  } catch (error) {
    message.error('发送失败')
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  const storedTenantId = localStorage.getItem('geocms_tenant_id')
  if (storedTenantId) {
    selectedTenantId.value = Number(storedTenantId)
    loadAllData()
  }
})
</script>

<style scoped lang="less">
.message-manage-page {
  width: 100%;
}

.header-wrapper {
  padding: 16px 24px 0;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.content-wrapper {
  padding: 24px;
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

.message-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #1a1a1a;

  &.unread {
    font-weight: 600;
  }
}

.unread-icon {
  color: #1890ff;
  font-size: 12px;
}

.message-summary {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}
</style>
