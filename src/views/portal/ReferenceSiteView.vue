<template>
  <div class="reference-site-page">
    <PageTitle />
    <a-form layout="inline" class="reference-site-page__filter">
      <a-form-item label="状态">
        <a-select
          v-model:value="statusFilter"
          style="width: 160px"
          allow-clear
          placeholder="全部状态"
          :options="statusOptions"
          @change="loadTasks"
        />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button :loading="loading" @click="reload">刷新</a-button>
          <a-button type="primary" @click="openCreateModal">新建摄取任务</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-alert type="info" show-icon class="reference-site-page__notice">
      <template #message>
        这里摄取的是别人的站点「长什么样的结构」，不是把别人的网页搬进来：落库的只有版式结构、样式取值与映射建议，
        生成出来的是一份草稿页，用的是我们自己的区块和你们自己的内容。
      </template>
    </a-alert>

    <a-alert v-if="staticOptionsNote" type="warning" show-icon class="reference-site-page__notice">
      <template #message>{{ staticOptionsNote }}</template>
    </a-alert>

    <a-table
      :data-source="tasks"
      :columns="columns"
      :loading="loading"
      :pagination="paginationConfig"
      row-key="id"
      size="middle"
      :scroll="{ x: 1160 }"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'source'">
          <a v-if="record.sourceUrl" :href="record.sourceUrl" target="_blank" rel="noopener noreferrer">
            {{ record.sourceUrl }}
          </a>
          <span v-else class="reference-site-page__muted">（截图任务，没有网址）</span>
        </template>
        <template v-else-if="column.key === 'mode'">
          {{ referenceModeLabel(record.mode) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="referenceStatusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          <loading-outlined v-if="referenceIsRunning(record.status)" spin class="reference-site-page__muted" />
        </template>
        <template v-else-if="column.key === 'error'">
          <a-tooltip v-if="record.errorMessage" :title="record.errorMessage">
            <span class="reference-site-page__error">{{ record.errorMessage }}</span>
          </a-tooltip>
          <span v-else class="reference-site-page__muted">—</span>
        </template>
        <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
        <template v-else-if="column.key === 'op'">
          <a-button size="small" type="link" @click="openTask(record.id)">审阅</a-button>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="还没有参考站摄取任务：新建一个任务，填参考站网址或者直接上传截图" />
      </template>
    </a-table>

    <!-- ---------------- 新建任务 ---------------- -->
    <a-modal
      v-model:open="createOpen"
      title="新建参考站摄取任务"
      :ok-text="createLoading ? '创建中' : '创建任务'"
      :confirm-loading="createLoading"
      @ok="createTask"
    >
      <a-form layout="vertical">
        <a-form-item label="怎么提供参考站">
          <a-radio-group v-model:value="createForm.mode">
            <a-radio value="screenshot_upload">上传截图（不向外网发请求）</a-radio>
            <a-radio value="url">按网址抓取（需要截图服务在线）</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="createForm.mode === 'url'" label="参考站地址">
          <a-input v-model:value="createForm.sourceUrl" placeholder="https://example.com" :maxlength="500" />
          <p class="reference-site-page__muted">
            只抓你有权抓的站点。抓取前会过一遍 SSRF 检查与对方的 robots.txt，被限制就是被限制，我们不会绕。
          </p>
        </a-form-item>
        <a-form-item label="最多抓几页">
          <a-input-number v-model:value="createForm.maxPages" :min="1" :max="maxPagesLimit" />
          <span class="reference-site-page__muted">
            个页面（1–{{ maxPagesLimit }}，超出后端会直接按 {{ maxPagesLimit }} 收）。
            模板站常有 9~11 条路由，卡在 6 页的表现是「清单列了十条、抓完只剩六页」，看不出是漏了还是没有
          </span>
        </a-form-item>
        <a-form-item v-if="createForm.mode === 'url'" label="遵守对方 robots.txt">
          <a-switch v-model:checked="createForm.obeyRobots" />
        </a-form-item>
      </a-form>
      <p class="reference-site-page__muted">
        截图任务创建后停在「结构归纳中」等进料；网址任务要再点一次「开始抓取」才真的发请求——
        这中间没有任何自动往下走的动作。
      </p>
    </a-modal>

    <!-- ---------------- 任务详情 ---------------- -->
    <ReferenceTaskDrawer
      ref="drawer"
      v-model:open="detailOpen"
      :status-labels="statusLabels"
      :vocabularies="vocabularies"
      :vocab-error="vocabError"
      :blocks="blocks"
      :sites="sites"
      @reload-tasks="loadTasks"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { LoadingOutlined } from '@ant-design/icons-vue'
import PageTitle from '../../components/PageTitle.vue'
import ReferenceTaskDrawer from './ReferenceTaskDrawer.vue'
import {
  portalReferenceApi,
  referenceIsRunning,
  referenceModeLabel,
  referenceStatusColor,
  REFERENCE_MAX_PAGES_LIMIT,
  type ReferenceSite,
  type ReferenceVocabularies
} from '../../api/referenceSites'
import { portalPagesApi, type PortalBlockMeta } from '../../api/portalPages'
import { siteApi } from '../../api/workspace'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'

/**
 * 参考站摄取任务列表（Spec §7）。
 *
 * 这一层只管两件事：整页那份共用的词表（状态标签与七套显示名各读一次，往抽屉里下发），
 * 和「底数据按码取」——缺 portal:build:manage 时不发那两个口，也不把列表变成空表。
 * 一个任务怎么抓、怎么确认、怎么沉淀在 ReferenceTaskDrawer，四栏各自在自己的组件里。
 */

const EMPTY_STATUS_LABELS: Record<string, string> = {}

const auth = useAuthStore()
const canBuild = computed(() => auth.hasPermission('portal:build:manage'))

/** 页数上限的真源在后端 clamp；这里只是把输入框的上限对齐，免得填 20 存成 12 而没人知道 */
const maxPagesLimit = REFERENCE_MAX_PAGES_LIMIT

const statusLabels = ref<Record<string, string>>({ ...EMPTY_STATUS_LABELS })
const vocabularies = ref<ReferenceVocabularies | null>(null)
/** 词表读不到时界面仍然照跑（标签退回后端原值），但要把「这份词表旧了/没读到」说在明处 */
const vocabError = ref<string | null>(null)
const tasks = ref<ReferenceSite[]>([])
const loading = ref(false)
const statusFilter = ref<string | undefined>(undefined)

const blocks = ref<PortalBlockMeta[]>([])
const sites = ref<Array<{ id: number; name: string }>>([])
const staticOptionsNote = ref('')

const detailOpen = ref(false)
const drawer = ref<InstanceType<typeof ReferenceTaskDrawer> | null>(null)

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`
})

const columns = [
  { title: '编号', dataIndex: 'id', key: 'id', width: 72 },
  { title: '来源网址', key: 'source', width: 260 },
  { title: '方式', key: 'mode', width: 120 },
  { title: '状态', key: 'status', width: 130 },
  { title: '已抓页数', dataIndex: 'pagesCrawled', key: 'pagesCrawled', width: 90 },
  { title: '最近一次结果', key: 'error', width: 260 },
  { title: '创建人', dataIndex: 'createdBy', key: 'createdBy', width: 110 },
  { title: '创建时间', key: 'createdAt', width: 170 },
  { title: '操作', key: 'op', width: 90, fixed: 'right' as const }
]

const statusOptions = computed(() =>
  Object.entries(statusLabels.value).map(([value, label]) => ({ value, label }))
)

function statusLabel(status: string | null | undefined) {
  if (!status) return '未知'
  return statusLabels.value[status] || status
}

function onTableChange(pagination: { current?: number; pageSize?: number }) {
  paginationConfig.current = pagination.current || 1
  paginationConfig.pageSize = pagination.pageSize || 10
}

async function reload() {
  await Promise.all([loadVocabularies(), loadTasks(), loadStaticOptions()])
}

async function loadTasks() {
  loading.value = true
  try {
    tasks.value = await portalReferenceApi.list(statusFilter.value)
    paginationConfig.total = tasks.value.length
  } catch (error) {
    tasks.value = []
    message.error((error as Error).message || '任务列表加载失败')
  } finally {
    loading.value = false
  }
}

/** 词表只有一份，在后端。读不到时标签退回原值，并把这件事写在路由清单顶上 */
async function loadVocabularies() {
  try {
    vocabularies.value = await portalReferenceApi.vocabularies()
    vocabError.value = null
  } catch (error) {
    vocabError.value = (error as Error).message || '接口没有响应'
  }
}

async function loadStaticOptions() {
  // 区块元数据与站点下拉都是 portal:build:manage 的口，这一页按 portal:build:reference 放行。
  // 缺码就不发：摄取任务本身照常列得出来，两个下拉如实为空，而不是各报一次「加载失败」。
  if (!canBuild.value) {
    blocks.value = []
    sites.value = []
    staticOptionsNote.value = '这个账号没有 portal:build:manage，读不到区块元数据与站点清单：映射时的区块下拉和「生成草稿页」的站点下拉会空着，摄取与分析照常'
    return
  }
  try {
    const [blockList, siteList] = await Promise.all([portalPagesApi.blocks(), siteApi.list()])
    blocks.value = blockList || []
    // 站点列表由后端按登录态过滤（TenantGuard）：超管看到全部，租户只看到自己的
    sites.value = (siteList || []).map(site => ({ id: site.id, name: site.name }))
    staticOptionsNote.value = ''
  } catch (error) {
    // 区块表与站点表只影响下拉可选值；拿不到就报错，但不把已经加载的列表变成空表
    message.error((error as Error).message || '区块/站点列表加载失败')
  }
}

// ---------------- 新建 ----------------
const createOpen = ref(false)
const createLoading = ref(false)
const createForm = reactive<{ mode: string; sourceUrl: string; maxPages: number; obeyRobots: boolean }>({
  mode: 'screenshot_upload',
  sourceUrl: '',
  maxPages: 3,
  obeyRobots: true
})

function openCreateModal() {
  createForm.mode = 'screenshot_upload'
  createForm.sourceUrl = ''
  createForm.maxPages = 3
  createForm.obeyRobots = true
  createOpen.value = true
}

async function createTask() {
  if (createForm.mode === 'url' && !createForm.sourceUrl.trim()) {
    message.warning('按网址抓取必须填参考站地址')
    return
  }
  createLoading.value = true
  try {
    const created = await portalReferenceApi.create({
      mode: createForm.mode,
      sourceUrl: createForm.sourceUrl.trim() || null,
      maxPages: createForm.maxPages,
      obeyRobots: createForm.obeyRobots
    })
    createOpen.value = false
    message.success(
      created.mode === 'url' ? '任务已创建，点「审阅」后再按「开始抓取」才会发请求' : '任务已创建，请上传参考站截图'
    )
    await loadTasks()
    openTask(created.id)
  } catch (error) {
    message.error((error as Error).message || '创建失败')
  } finally {
    createLoading.value = false
  }
}

function openTask(id: number) {
  detailOpen.value = true
  // 每次「审阅」都从后端重读：清单是缓存的，这一行现在到底几条路由、什么状态，只有接口知道
  drawer.value?.open(id)
}

onMounted(async () => {
  try {
    const labels = await portalReferenceApi.statusLabels()
    statusLabels.value = { ...EMPTY_STATUS_LABELS, ...labels }
  } catch (error) {
    message.error((error as Error).message || '状态词表加载失败')
  }
  await loadVocabularies()
  await Promise.all([loadTasks(), loadStaticOptions()])
})
</script>

<style scoped lang="less">
.reference-site-page {
  padding: 16px;

  &__filter {
    margin-bottom: 12px;
    width: 100%;
    display: flex;
    flex-wrap: wrap;
  }

  &__notice {
    margin-bottom: 12px;
  }

  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__error {
    color: #cf1322;
    display: inline-block;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }
}
</style>
