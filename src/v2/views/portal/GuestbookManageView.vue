<template>
  <div class="guestbook-manage-page">
    <a-page-header title="留言管理" sub-title="管理门户网站的用户留言和回复">
    </a-page-header>

    <div class="content-wrapper">
      <a-spin :spinning="loading">
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                  <MessageOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.totalMessages }}</div>
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
                  <div class="stat-value">{{ stats.repliedCount }}</div>
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
                  <div class="stat-value">{{ stats.pendingCount }}</div>
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
                  <div class="stat-value">{{ stats.todayCount }}</div>
                  <div class="stat-title">今日新增</div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-card :bordered="false">
          <template #title>
            <a-space>
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
              <a-input-search
                v-model:value="queryParams.keyword"
                placeholder="搜索留言内容/用户"
                style="width: 250px"
                enter-button
                @search="loadData"
              />
            </a-space>
          </template>

          <a-table
            :columns="columns"
            :data-source="messageList"
            :pagination="false"
            :row-key="(record: any) => record.id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'content'">
                <div class="message-content">{{ record.content }}</div>
                <div v-if="record.reply" class="reply-content">
                  <span class="reply-label">回复：</span>{{ record.reply }}
                </div>
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="getStatusColor(record.status)">
                  {{ getStatusName(record.status) }}
                </a-tag>
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="handleReply(record)">
                    {{ record.reply ? '查看回复' : '回复' }}
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

          <div class="pagination-wrapper">
            <a-pagination
              v-model:current="pagination.page"
              v-model:page-size="pagination.size"
              :total="pagination.total"
              :show-size-changer="true"
              :show-quick-jumper="true"
              :page-size-options="['10', '20', '50']"
              @change="loadData"
              @showSizeChange="handleSizeChange"
              :show-total="(total: number) => `共 ${total} 条`"
            />
          </div>
        </a-card>
      </a-spin>
    </div>

    <a-modal
      v-model:open="replyModalVisible"
      :title="currentRecord?.reply ? '查看回复' : '回复留言'"
      @ok="handleReplyOk"
      :confirmLoading="saving"
      width="600px"
      :footer="currentRecord?.reply ? null : undefined"
    >
      <a-descriptions bordered :column="1" size="small">
        <a-descriptions-item label="留言用户">
          {{ currentRecord?.name }}
        </a-descriptions-item>
        <a-descriptions-item label="联系方式">
          <span v-if="currentRecord?.phone">电话：{{ currentRecord?.phone }}</span>
          <span v-if="currentRecord?.email" style="margin-left: 16px">邮箱：{{ currentRecord?.email }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="公司">
          {{ currentRecord?.company || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="主题">
          {{ currentRecord?.subject || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="留言内容">
          <div style="white-space: pre-wrap">{{ currentRecord?.content }}</div>
        </a-descriptions-item>
        <a-descriptions-item label="留言时间">
          {{ currentRecord?.createdAt }}
        </a-descriptions-item>
        <a-descriptions-item v-if="currentRecord?.reply" label="回复内容">
          <div style="white-space: pre-wrap">{{ currentRecord?.reply }}</div>
        </a-descriptions-item>
        <a-descriptions-item v-if="currentRecord?.replyAt" label="回复时间">
          {{ currentRecord?.replyAt }}
        </a-descriptions-item>
      </a-descriptions>

      <template v-if="!currentRecord?.reply">
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
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  MessageOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { guestbookApi } from '../../api/portal'
import type { Guestbook, GuestbookQuery } from '../../types/portal'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const replyModalVisible = ref(false)
const currentRecord = ref<Guestbook | null>(null)

const stats = reactive({
  totalMessages: 0,
  repliedCount: 0,
  pendingCount: 0,
  todayCount: 0,
})

const queryParams = reactive({
  status: undefined as string | undefined,
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
  { title: '用户姓名', dataIndex: 'name', key: 'name', width: 120 },
  { title: '联系方式', dataIndex: 'phone', key: 'phone', width: 150 },
  { title: '留言内容', key: 'content', width: 300 },
  { title: '状态', key: 'status', width: 100 },
  { title: '留言时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '回复时间', dataIndex: 'replyAt', key: 'replyAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 150 },
]

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
  replyForm.content = record.reply || ''
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
    await loadData()
  } catch (error) {
    message.error('回复失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await guestbookApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error) {
    message.error('删除失败')
    console.error(error)
  }
}

async function loadData() {
  loading.value = true
  try {
    const params: GuestbookQuery = {
      tenantId: auth.selectedTenantId || auth.tenantId,
      page: pagination.page,
      size: pagination.size,
      status: queryParams.status || undefined,
    }
    const result = await guestbookApi.list(params)
    messageList.value = result.records || []
    pagination.total = result.total || 0
    loadStats()
  } catch (error) {
    message.error('加载留言列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const tenantId = auth.selectedTenantId || auth.tenantId
    const allResult = await guestbookApi.list({ tenantId, page: 1, size: 1 })
    stats.totalMessages = allResult.total || 0
    
    const repliedResult = await guestbookApi.list({ tenantId, page: 1, size: 1, status: 'replied' })
    stats.repliedCount = repliedResult.total || 0
    
    const pendingResult = await guestbookApi.list({ tenantId, page: 1, size: 1, status: 'pending' })
    stats.pendingCount = pendingResult.total || 0
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

function handleSizeChange(_current: number, size: number) {
  pagination.page = 1
  pagination.size = size
  loadData()
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.guestbook-manage-page {
  width: 100%;
  padding: 0;
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
