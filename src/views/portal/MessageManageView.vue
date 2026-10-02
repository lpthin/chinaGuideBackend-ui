<template>
  <div class="message-manage-page">
    <a-spin :spinning="loading">
      <div class="content-wrapper">
        <!-- 后端这一口按「当前登录用户 + 当前选中的租户」算，超管没选租户时它直接拒（`TENANT_REQUIRED`）。
             以前这条失败只进控制台，三格照显示 0 ——等于把「没读到」说成「真的没有」。
             读不到就露「—」并把去哪儿选写在明处。 -->
        <a-alert v-if="statsNote" type="info" show-icon class="message-manage-page__notice">
          <template #message>{{ statsNote }}</template>
        </a-alert>
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="8">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                  <MailOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ statsNote ? '—' : stats.inbox }}</div>
                  <div class="stat-title">我的收件箱</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%)">
                  <ClockCircleOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ statsNote ? '—' : stats.unread }}</div>
                  <div class="stat-title">未读</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                  <SendOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ statsNote ? '—' : stats.outbox }}</div>
                  <div class="stat-title">我的发件箱</div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-card :bordered="false">
          <!-- 筛选栏原本塞在卡片 #title 槽：那是 overflow:hidden 的卡头，窄时会被裁切；改用 FilterBar -->
          <filter-bar>
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
            <template #actions>
              <a-space>
                <!-- 跨租户群发是平台职能：后端 /api/admin/tenants 每个方法第一行 checkSuperAdmin()，
                     租户档点开弹窗只会看到一个空的下拉框。入口不摆出来，比摆出来让人撞墙诚实。 -->
                <a-button v-if="auth.isSuperAdmin" type="primary" @click="showSendModal = true">
                  <template #icon><SendOutlined /></template>
                  发送消息
                </a-button>
              </a-space>
            </template>
          </filter-bar>

          <a-table
            :scroll="{ x: 'max-content' }"
            :columns="columns"
            :data-source="messageList"
            :pagination="paginationConfig"
            :row-key="(record: PortalMessage) => record.id"
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
              <template v-if="column.key === 'createdAt'">
                {{ formatDateTime(record.createdAt) }}
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="viewDetail(record)">查看</a-button>
                  <!-- 拍板 1a：只有这一家的管理员能删，后端 requireTenantAdminOf 是这么判的，界面按同一条摆。
                       拍板 2a：库里只有一个 is_deleted，删了就是这一家所有人都看不到，所以那句要写在确认里。 -->
                  <a-popconfirm
                    v-if="canDelete"
                    title="删除后这家租户里的所有人都看不到这条消息，确定删除吗？"
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

    <a-modal v-model:open="detailVisible" title="消息详情" :footer="null" width="640px">
      <a-descriptions bordered :column="1" size="small">
        <a-descriptions-item label="标题">{{ currentMessage?.title }}</a-descriptions-item>
        <a-descriptions-item label="类型">
          <a-tag :color="getTypeColor(currentMessage?.type)">{{ getTypeName(currentMessage?.type) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="发件人">{{ currentMessage?.senderId ?? '-' }}</a-descriptions-item>
        <a-descriptions-item label="发送时间">{{ formatDateTime(currentMessage?.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="内容">
          <div style="white-space: pre-wrap">{{ currentMessage?.content || '-' }}</div>
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  MailOutlined,
  ClockCircleOutlined,
  SendOutlined,
} from '@ant-design/icons-vue'
import { portalMessageApi } from '../../api/portal'
import type { PortalMessage, PortalMessageStats, PortalMessageBroadcast } from '../../types/portal'
import type { Tenant } from '../../types/workspace'
import TenantSelect from '../../components/TenantSelect.vue'
import FilterBar from '../../components/FilterBar.vue'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'
import { logError } from '../../utils/errorLog'

const auth = useAuthStore()
const loading = ref(false)
const sending = ref(false)
const showSendModal = ref(false)
const detailVisible = ref(false)
const currentMessage = ref<PortalMessage | null>(null)

const stats = reactive<PortalMessageStats>({
  inbox: 0,
  unread: 0,
  outbox: 0,
})

/** 统计那一发读不到时写在明处的一句话；有值就代表这三个数是「没读到」，不是「真的为 0」 */
const statsNote = ref('')

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

const SITE_ADMIN_ROLE = 'SITE_ADMIN'

/** 这一屏的请求会打到哪一家：超管跟右上角走，租户用户由后端按登录态定，客户端说不了话 */
const actingTenantId = computed(() => (auth.isSuperAdmin ? auth.selectedTenantId : auth.tenantId))

/**
 * 与后端 `MessageController.requireTenantAdminOf` 同一条判据（拍板 1a）：
 * 角色要有 SITE_ADMIN，而且人得站在自己归属的那一家 —— 超管切到别家也删不了别人家的信。
 * 摆不出动作的按钮不摆；真正的拒绝仍然由后端来做，这里只是不让人撞墙。
 */
const canDelete = computed(() => auth.hasRole(SITE_ADMIN_ROLE) && actingTenantId.value === auth.tenantId)

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

function getTypeColor(type?: string): string {
  const colorMap: Record<string, string> = {
    SYSTEM: 'blue',
    NOTICE: 'green',
    OTHER: 'default',
  }
  return colorMap[type || ''] || 'default'
}

function getTypeName(type?: string): string {
  const nameMap: Record<string, string> = {
    SYSTEM: '系统通知',
    NOTICE: '公告',
    OTHER: '其他',
  }
  return nameMap[type || ''] || type || '-'
}

async function loadStats() {
  statsNote.value = ''
  try {
    const result = await portalMessageApi.stats()
    Object.assign(stats, result as any)
  } catch (error: any) {
    const reason = String(error?.message || '')
    // 「没选租户」是这一口最常见的失败原因（超管停在平台档时请求根本不带租户头），
    // 它要说的是去哪儿选，而不是笼统一句读失败；控件名照顶栏那颗分段开关的原话写
    statsNote.value = reason.includes('请先选择租户')
      ? '这三个数按「你在这家租户里的信」算：请先在右上角切到「租户」并选一家，再回来看这一屏'
      : `统计数据读取失败：${reason || '未知原因'}`
    logError('portal/message-manage-view', '加载统计数据失败:', error)
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
  currentMessage.value = record
  detailVisible.value = true
  if (!record.isRead && queryParams.type === 'inbox') {
    try {
      await portalMessageApi.markRead(record.id)
      record.isRead = true
      // 四个数没读到时不去动它们：0 减一就成了 -1，那比 0 更像坏掉了
      if (!statsNote.value && stats.unread > 0) stats.unread -= 1
    } catch (error) {
      logError('portal/message-manage-view', '标记已读失败:', error)
    }
  }
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
  loadAllData()
})
</script>

<style scoped lang="less">
.message-manage-page {
  width: 100%;
}

.content-wrapper {
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
