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

        <!-- 平台档专属：上面那三格在这里天然是「—」（它们按「你在这家租户里的信」算），
             而「我发的公告被读了多少」是跨租户的问题，只有不选租户时才有意义，所以摆在这下面。 -->
        <a-card v-if="isPlatformMode" :bordered="false" class="broadcast-summary-card">
          <template #title>我发出的公告 · 各家的阅读情况</template>
          <a-alert v-if="broadcastNote" type="warning" show-icon>
            <template #message>{{ broadcastNote }}</template>
          </a-alert>
          <a-spin :spinning="broadcastLoading">
            <a-table
              :columns="broadcastColumns"
              :data-source="broadcastRows"
              :pagination="false"
              row-key="rowKey"
              size="small"
              :locale="{ emptyText: '你还没有以发送人身份发出去过消息' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'title'">{{ record.title }}</template>
                <template v-else-if="column.key === 'type'">
                  <a-tag :color="getTypeColor(record.type)">{{ getTypeName(record.type) }}</a-tag>
                </template>
                <template v-else-if="column.key === 'sentTime'">{{ formatDateTime(record.sentTime) }}</template>
                <template v-else-if="column.key === 'tenantCount'">{{ record.tenantCount }} 家</template>
                <template v-else-if="column.key === 'delivered'">{{ record.delivered }}</template>
                <template v-else-if="column.key === 'read'">
                  {{ record.readCount }} / {{ record.unreadCount }}
                </template>
                <template v-else-if="column.key === 'removed'">{{ record.removedCount }}</template>
              </template>
            </a-table>
            <!-- 口径写在明处，别让人把「送达副本」当成「收到人数」：群发是按收件人一行一行摊的 -->
            <div class="broadcast-summary-card__note">
              一行 = 一个收件人收到的那一份；同一批摊到几家、读了几家看得见，谁把它删了也单独一列。
              系统告警不是从这里发的（发送人是平台），所以不混进这几行。
            </div>
          </a-spin>
        </a-card>

        <!-- 这张卡不能整块藏：「发送消息」就在它的 #actions 里，那是平台档的正活儿。
             只收掉按「这一家」查的那几样 —— 三个筛子和下面那张表。 -->
        <a-card :bordered="false">
          <!-- 筛选栏原本塞在卡片 #title 槽：那是 overflow:hidden 的卡头，窄时会被裁切；改用 FilterBar -->
          <filter-bar>
            <template v-if="!isPlatformMode">
              <a-radio-group v-model:value="queryParams.type" button-style="solid" @change="handleTypeChange">
                <a-radio-button value="inbox">收件箱</a-radio-button>
                <a-radio-button value="outbox">发件箱</a-radio-button>
              </a-radio-group>
              <!-- 后端只有 getInboxList 带 status 形参（发件箱那句没有），筛子就只在收件箱这一格摆 -->
              <a-select
                v-if="queryParams.type === 'inbox'"
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
            </template>
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

          <!-- 平台档里这张表拿不到任何东西：后端那句查询要先有「这一家」（resolveTenantId），
               没租户直接回 TENANT_REQUIRED —— 现场实测。摆一张空表等于说「你没信」，
               所以这里说的是去哪儿切，而不是留一张假空表。 -->
          <a-alert v-if="isPlatformMode" type="info" show-icon>
            <template #message>
              平台档看的是上面那张跨租户的公告阅读表。要看你自己这一家的收件箱 / 发件箱，请在右上角切到「租户」并选一家。
            </template>
          </a-alert>
          <a-table
            v-else
            :scroll="{ x: 'max-content' }"
            :columns="columns"
            :data-source="messageList"
            :pagination="paginationConfig"
            :row-key="(record: PortalMessage) => record.id"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record, text }">
              <template v-if="column.key === 'title'">
                <div class="message-title" :class="{ unread: isUnread(record) }">
                  <MailOutlined v-if="isUnread(record)" class="unread-icon" />
                  <a @click="viewDetail(record)">{{ record.title }}</a>
                </div>
                <div class="message-summary">{{ record.content }}</div>
              </template>
              <template v-if="column.key === 'type'">
                <a-tag :color="getTypeColor(record.type)">
                  {{ getTypeName(record.type) }}
                </a-tag>
              </template>
              <!-- 库里历史行的 receiver_name 是 NULL（现场 id 1、2 就是），留白看着像坏了，补一个横杠 -->
              <template v-if="column.key === 'counterpart'">
                <span class="counterpart-cell">{{ text || '-' }}</span>
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="isUnread(record) ? 'orange' : 'default'">
                  {{ isUnread(record) ? '未读' : '已读' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'createTime'">
                {{ formatDateTime(record.createTime) }}
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="viewDetail(record)">查看</a-button>
                  <!-- 拍板 1a：只有这一家的管理员能删，后端 requireTenantAdminOf 是这么判的，界面按同一条摆。
                       确认文案按实测语义写（上一版「这家租户所有人都看不到」是错的）：一行只装一个收件人
                       （群发在发送时就摊成 N 行），删掉的是这一对当事人看到的这一条。 -->
                  <a-popconfirm
                    v-if="canDelete"
                    :title="deleteConfirmTitle(record)"
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
        <!-- 发件人显示名字不显示 id：后端每行都带 senderName，之前这格抄的是 senderId，
             于是详情里写着「发件人 13」。姓名缺时退回 id，不至于空白 -->
        <a-descriptions-item label="发件人">{{ currentMessage?.senderName || currentMessage?.senderId || '-' }}</a-descriptions-item>
        <a-descriptions-item label="发送时间">{{ formatDateTime(currentMessage?.createTime) }}</a-descriptions-item>
        <a-descriptions-item label="内容">
          <div style="white-space: pre-wrap">{{ currentMessage?.content || '-' }}</div>
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  MailOutlined,
  ClockCircleOutlined,
  SendOutlined,
} from '@ant-design/icons-vue'
import { portalMessageApi } from '../../api/portal'
import type { PortalMessage, PortalMessageStats, PortalMessageQuery, PortalMessageBroadcast, PortalBroadcastReadRow } from '../../types/portal'
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

/**
 * 平台档 = 超管且右上角没选租户。这一档下按人算的那三个数读不到（后端 `TENANT_REQUIRED`），
 * 但「我发的公告被读了多少」本来就是跨租户的问题 —— 所以这一档不是空屏，而是给那张跨租户的表。
 */
const isPlatformMode = computed(() => auth.isSuperAdmin && auth.selectedTenantId === null)

const broadcastRows = ref<(PortalBroadcastReadRow & { rowKey: string })[]>([])
const broadcastLoading = ref(false)
/** 有值就代表这一张表是「没读到」，不是「你没发过公告」 */
const broadcastNote = ref('')

const broadcastColumns = [
  { title: '公告标题', key: 'title', width: 260 },
  { title: '类型', key: 'type', width: 100 },
  { title: '发出时间', key: 'sentTime', width: 180 },
  { title: '覆盖租户', key: 'tenantCount', width: 100 },
  { title: '送达副本', key: 'delivered', width: 100 },
  { title: '已读 / 未读', key: 'read', width: 130 },
  { title: '已被删除', key: 'removed', width: 100 },
]

async function loadBroadcastSummary() {
  if (!isPlatformMode.value) return
  broadcastLoading.value = true
  broadcastNote.value = ''
  try {
    const result = await portalMessageApi.broadcastSummary()
    // 后端一行没有主键（它是按标题+发送时间归并出来的聚合行），表要 row-key 就得自己造一个
    broadcastRows.value = (Array.isArray(result) ? result : []).map((row, index) => ({
      ...row,
      rowKey: `${row.sentTime ?? 'no-time'}|${row.title ?? 'no-title'}|${index}`,
    }))
  } catch (error: any) {
    broadcastRows.value = []
    broadcastNote.value = `公告阅读情况读取失败：${String(error?.message || '未知原因')}`
    logError('portal/message-manage-view', '加载公告阅读情况失败:', error)
  } finally {
    broadcastLoading.value = false
  }
}

/**
 * 后端行里没有 `isRead` 这个布尔，读没读写在 `status` 上（`unread` / `read`）。
 * 之前模板一律读 `record.isRead`，拿到的是 undefined，`!undefined` 恒真 ——
 * 所以每一行都被摆成「未读」，包括库里已经读过的。
 */
function isUnread(record: PortalMessage): boolean {
  return record.status !== 'read'
}

/**
 * 删一行 = 删掉这一对当事人眼前的这一条（库里一行只挂一个 receiver_id）。
 * 收件箱视角里那个收件人就是我；发件箱视角里要说清对方那一份也没了。
 */
function deleteConfirmTitle(record: PortalMessage): string {
  if (queryParams.type === 'outbox') {
    return `删除后「${record.receiverName || '这个收件人'}」的收件箱和你发件箱里的这条都没了，确定删除吗？`
  }
  // 收件箱这一侧：发件人是真人时你们读的是同一行，删了对方那侧也没了，这话要说全。
  // 但系统告警的 sender_id 现场实测是 0（库里那几个 13/12/11 行），背后没有「发件人的发件箱」
  // 那个人 —— 对这种行还写「发件人那份也没了」就是谎报副作用。
  return record.senderId
    ? '删除后这条消息从你的收件箱里消失，发件人发件箱里的这条记录也一并没了，确定删除吗？'
    : '删除后这条系统提醒从你的收件箱里消失，确定删除吗？'
}

const columns = computed(() => [
  { title: '标题', key: 'title', width: 300 },
  { title: '类型', key: 'type', width: 100 },
  // 表头会换词（收件箱问「谁发的」、发件箱问「发给谁」），dataIndex 也得跟着换。
  // 之前它写死 senderId：切到发件箱后表头写着「收件人」，格子里印的却是自己的 id。
  // 名字后端每行都带（senderName / receiverName），不再拿 id 顶替人名。
  {
    title: queryParams.type === 'inbox' ? '发件人' : '收件人',
    dataIndex: queryParams.type === 'inbox' ? 'senderName' : 'receiverName',
    key: 'counterpart',
    width: 120,
  },
  { title: '状态', key: 'status', width: 100 },
  { title: '发送时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 150 },
])

const sendForm = reactive<PortalMessageBroadcast>({
  scope: 'ALL_TENANTS',
  tenantId: undefined,
  title: '',
  content: '',
  type: 'SYSTEM',
})

/**
 * 库里的类型码大小写不统一，而且不止这一套：`AlertNotificationService:162` 往 portal_message 写的是
 * 小写 `alert`（现场 5 行「【高】AI模型不可用」），历史那两行 Test 是小写 `system`，
 * 而界面上那颗下拉发出去的是大写 SYSTEM / NOTICE / OTHER。查表一律先转大写，
 * 认不出来的原样显示 —— 宁可见原码，也别编一个词出来。
 */
function typeKey(type?: string): string {
  return (type || '').toUpperCase()
}

const TYPE_NAME: Record<string, string> = {
  SYSTEM: '系统通知',
  NOTICE: '公告',
  ALERT: '系统报警',
  OTHER: '其他',
}

function getTypeColor(type?: string): string {
  const colorMap: Record<string, string> = {
    SYSTEM: 'blue',
    NOTICE: 'green',
    ALERT: 'red',
    OTHER: 'default',
  }
  return colorMap[typeKey(type)] || 'default'
}

function getTypeName(type?: string): string {
  return TYPE_NAME[typeKey(type)] || type || '-'
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
  // 平台档没有「这一家」可查，这一枪发出去必吃 TENANT_REQUIRED（见上面那张卡的注释）
  if (isPlatformMode.value) {
    messageList.value = []
    paginationConfig.total = 0
    return
  }
  loading.value = true
  try {
    const params: PortalMessageQuery = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      keyword: queryParams.keyword || undefined,
    }
    // 后端只有收件箱那条形参里有 status（getInboxList），发件箱的 getOutboxList 没收这个参数，
    // 所以筛子也只在收件箱这一档摆出来（模板里那颗 select 上挂了 v-if）。
    // 之前这里发的是 isRead=true/false，后端没这个形参、多余键直接丢，状态筛选点了没反应。
    if (queryParams.type === 'inbox') {
      params.status = queryParams.status
    }
    const result = queryParams.type === 'inbox'
      ? await portalMessageApi.list(params)
      : await portalMessageApi.outbox(params)
    messageList.value = result.records || []
    paginationConfig.total = result.total || 0
  } catch (error: any) {
    message.error(`加载消息列表失败：${String(error?.message || '未知原因')}`)
    logError('portal/message-manage-view', '加载消息列表失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadAllData() {
  await Promise.all([loadStats(), loadMessageList(), loadBroadcastSummary()])
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
  if (isUnread(record) && queryParams.type === 'inbox') {
    try {
      await portalMessageApi.markRead(record.id)
      // 回写的是后端那一个键：库里读态存在 status 上，没有 isRead 可写
      record.status = 'read'
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
  } catch (error: any) {
    // 后端拒的时候给的是成句的原因（「只有该租户的管理员可以删除站内信」），
    // 只报一句「删除失败」等于把为什么吞了，人只能反复点
    message.error(`删除失败：${String(error?.message || '未知原因')}`)
    logError('portal/message-manage-view', '删除站内信失败:', error)
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

// 顶栏切租户不会重挂这个组件，不盯着 selectedTenantId 复查，切过去之后看到的还是上一档的数
watch(actingTenantId, () => {
  loadAllData()
})
</script>

<style scoped lang="less">
.message-manage-page {
  width: 100%;
}

.broadcast-summary-card {
  margin-bottom: 16px;

  &__note {
    margin-top: 8px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
    line-height: 1.6;
  }
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
