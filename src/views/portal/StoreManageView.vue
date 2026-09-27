<template>
  <div class="store-manage-page">
    <a-page-header title="门店" sub-title="门户「联系我们」页地图上那些点位从这里录">
    </a-page-header>

    <a-alert type="info" show-icon class="store-manage-page__notice">
      <template #message>
        门店是按<strong>公司</strong>归属的，不是按站点：同一家公司名下几个站看到的都是这一批门店。
        地图上只摆「营业中」的点位，一次最多摆 {{ options?.portalRowLimit ?? '—' }} 个（按排序取靠前的）；
        每一家要么填地址、要么填经纬度，两边都没有的那一家在地图上指不出位置。
      </template>
    </a-alert>

    <a-alert v-if="optionsError" type="warning" show-icon class="store-manage-page__notice" :message="optionsError" />

    <div class="content-wrapper">
      <a-card :bordered="false">
        <a-form layout="inline" class="store-manage-page__filter">
          <a-form-item label="门店名">
            <a-input
              v-model:value="query.keyword"
              style="width: 200px"
              placeholder="按名字筛（地址不参与筛选）"
              allow-clear
              @press-enter="loadRows"
            />
          </a-form-item>
          <a-form-item label="状态">
            <a-select
              v-model:value="query.status"
              style="width: 160px"
              placeholder="全部状态"
              allow-clear
              :options="statusFilterOptions"
            />
          </a-form-item>
          <a-form-item class="toolbar-actions">
            <a-space wrap>
              <a-button type="primary" :loading="loading" @click="loadRows">搜索</a-button>
              <a-button @click="resetQuery">重置</a-button>
              <a-button @click="openCreate">
                <template #icon><PlusOutlined /></template>
                新增门店
              </a-button>
            </a-space>
          </a-form-item>
        </a-form>

        <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="store-manage-page__notice" />

        <a-spin v-if="!loadError" :spinning="loading">
          <p class="store-manage-page__count">共 {{ total }} 家{{ onPortalNotice }}</p>
          <a-table
            :scroll="{ x: 'max-content' }"
            :columns="columns"
            :data-source="rows"
            :pagination="false"
            :row-key="(record: any) => record.id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <div class="store-name">{{ record.name }}</div>
                <div v-if="record.businessHours" class="store-muted">营业时间 {{ record.businessHours }}</div>
                <div v-if="record.phone" class="store-muted">电话 {{ record.phone }}</div>
              </template>
              <template v-if="column.key === 'location'">
                <div v-if="record.address">{{ record.address }}</div>
                <div v-if="hasCoord(record)" class="store-muted">
                  {{ record.longitude }}, {{ record.latitude }}
                </div>
                <div v-if="!record.address && !hasCoord(record)" class="store-warn">
                  既没地址也没经纬度：门户地图上指不出这一家
                </div>
                <div v-else-if="!hasCoord(record)" class="store-muted">没有经纬度：跳转按地址搜</div>
              </template>
              <template v-if="column.key === 'sort'">{{ record.sortOrder }}</template>
              <template v-if="column.key === 'status'">
                <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
                <div v-if="offPortalReason(record)" class="store-warn">{{ offPortalReason(record) }}</div>
              </template>
              <template v-if="column.key === 'updated'">
                <div>{{ formatDateTime(record.updatedAt) }}</div>
                <div v-if="record.updateBy" class="store-muted">{{ record.updateBy }}</div>
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
                  <a-popconfirm
                    :title="`确定删除「${record.name}」吗？门户地图上这一格会一起消失`"
                    @confirm="handleDelete(record)"
                  >
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
            <template #emptyText>
              <a-empty description="还没有录过门店：点「新增门店」把第一家实体网点填进来">
                <template #image><span /></template>
              </a-empty>
            </template>
          </a-table>
        </a-spin>
      </a-card>
    </div>

    <a-modal
      v-model:open="formVisible"
      :title="editingId ? '编辑门店' : '新增门店'"
      width="640px"
      :confirm-loading="saving"
      ok-text="保存"
      @ok="submitForm"
    >
      <!-- 后端那句中文拒绝原因原样上屏：坐标超范围、名称超长这类话，重写一遍只会含糊 -->
      <a-alert v-if="formError" type="error" show-icon :message="formError" style="margin-bottom: 12px" />
      <a-form :model="form" layout="vertical">
        <a-form-item label="门店名称" required>
          <a-input v-model:value="form.name" placeholder="访客要在地图上认出的那个名字" />
        </a-form-item>
        <a-form-item label="地址">
          <a-input v-model:value="form.address" placeholder="填到能被找到的程度；没有经纬度时这一格就是必填" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="经度">
              <a-input v-model:value="form.longitude" placeholder="如 120.15000000，最多 8 位小数" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="纬度">
              <a-input v-model:value="form.latitude" placeholder="如 30.25000000，与经度一起填" />
            </a-form-item>
          </a-col>
        </a-row>
        <p class="store-manage-page__hint">
          经纬度要么两个都填、要么两个都空着只填地址；两个都填时跳转用坐标，只有地址时跳转按地址搜。
        </p>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="联系电话">
              <a-input v-model:value="form.phone" placeholder="可选，如 0571-88886666" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="营业时间">
              <a-input v-model:value="form.businessHours" placeholder="可选，如 周一至周六 9:00–18:00" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="营业状态">
              <a-select v-model:value="form.status" :options="statusFormOptions" />
              <p v-if="!statusVisibleOnPortal" class="store-manage-page__hint">
                这一档不会出现在门户地图上，只是留着以后恢复用。
              </p>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="排序">
              <a-input-number v-model:value="form.sortOrder" :min="0" style="width: 100%" />
              <p class="store-manage-page__hint">数字小的排在前面，地图的点位上限也按它取。</p>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { portalStoreApi, type StoreForm, type StoreOptions, type StoreRow } from '../../api/portalStores'
import { formatDateTime } from '../../utils/format'

/**
 * 租户侧「门店」录入页（Spec-D 收尾那一格：地图有渲染、没人往里写行）。
 *
 * 三条口径不在这里另立一套：状态三档的中文、「哪一档会上地图」、点位上限
 * 全来自 GET /options；后端那句中文拒绝原因原样上屏。
 */

const loading = ref(false)
const saving = ref(false)
const rows = ref<StoreRow[]>([])
const total = ref(0)
const loadError = ref('')
const options = ref<StoreOptions | null>(null)
const optionsError = ref('')
const formVisible = ref(false)
const formError = ref('')
const editingId = ref<number | null>(null)

const query = reactive({ keyword: '', status: undefined as number | undefined })

const emptyForm = (): Required<StoreForm> & { longitude: string; latitude: string } => ({
  name: '',
  address: '',
  phone: '',
  longitude: '',
  latitude: '',
  businessHours: '',
  status: defaultStatus(),
  sortOrder: 0
})

const form = reactive<Required<StoreForm> & { longitude: string; latitude: string }>(emptyForm())

const columns = [
  { title: '门店', key: 'name', width: 240 },
  { title: '位置', key: 'location', width: 320 },
  { title: '排序', key: 'sort', width: 80, align: 'center' as const },
  { title: '状态', key: 'status', width: 220 },
  { title: '最后修改', key: 'updated', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 140 }
]

function defaultStatus(): number {
  // 默认档取词表里「会上地图」的那一档（营业中）；词表还没读到时兜 1，与服务端列默认值同一语义
  return options.value?.statuses.find(item => item.visibleOnPortal)?.code ?? 1
}

const statusFilterOptions = computed(() =>
  (options.value?.statuses || []).map(item => ({ value: item.code, label: item.label })))

const statusFormOptions = computed(() =>
  (options.value?.statuses || []).map(item => ({ value: item.code, label: item.label })))

function statusLabel(code: number): string {
  return options.value?.statuses.find(item => item.code === code)?.label ?? `状态 ${code}`
}

function statusVisible(code: number): boolean {
  return options.value?.statuses.find(item => item.code === code)?.visibleOnPortal ?? false
}

function statusColor(code: number): string {
  return statusVisible(code) ? 'green' : 'default'
}

function hasCoord(record: StoreRow): boolean {
  return record.longitude !== null && record.longitude !== undefined
    && record.latitude !== null && record.latitude !== undefined
}

/**
 * 「这一家为什么在地图上找不到」：状态不在门户那一档，或者排在点位上限之后。
 *
 * 上限那条判断成立的前提是界面与门户翻同一份顺序（后端 StoreServiceTest 钉着这条），
 * 所以这里只在「没带筛选条件」时给结论——筛过的列表里那个下标不是门户里的下标，猜了就是谎报。
 */
function offPortalReason(record: StoreRow): string {
  if (!statusVisible(record.status)) {
    return `「${statusLabel(record.status)}」不在门户地图上`
  }
  const limit = options.value?.portalRowLimit
  if (!limit || query.keyword.trim() || query.status !== undefined) {
    return ''
  }
  const rank = rows.value.filter(item => statusVisible(item.status)).findIndex(item => item.id === record.id)
  return rank >= limit ? `营业中的第 ${rank + 1} 家，超出地图一次摆 ${limit} 个点位，不会显示` : ''
}

const statusCount = computed(() => rows.value.filter(item => statusVisible(item.status)).length)

const onPortalNotice = computed(() => {
  const limit = options.value?.portalRowLimit
  if (!limit || query.keyword.trim() || query.status !== undefined) {
    return ''
  }
  return `；其中 ${Math.min(statusCount.value, limit)} 家会出现在门户地图上（上限 ${limit} 个点位，按排序取靠前的）`
})

const statusVisibleOnPortal = computed(() => statusVisible(Number(form.status)))

async function loadOptions() {
  try {
    options.value = await portalStoreApi.options()
    if (editingId.value === null && form.status === undefined) {
      form.status = defaultStatus()
    }
  } catch (error: any) {
    // 词表读不到只影响下拉与那句提醒，列表照样能翻——不把它演成「门店功能坏了」
    options.value = null
    optionsError.value = `门店词表取不到（${error?.message || '后端未响应'}）：状态中文与地图点位上限暂时念不出来，列表仍按后端给的码显示`
  }
}

async function loadRows() {
  loading.value = true
  loadError.value = ''
  try {
    const [list, count] = await Promise.all([
      portalStoreApi.list(query.keyword, query.status),
      portalStoreApi.count(query.keyword, query.status)
    ])
    rows.value = list || []
    total.value = Number(count) || 0
  } catch (error: any) {
    // 读失败与「还没有门店」是两件事：失败只说失败，空态那一句绝不一起冒出来
    rows.value = []
    total.value = 0
    loadError.value = `门店列表读取失败：${error?.message || '后端未响应'}`
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.keyword = ''
  query.status = undefined
  loadRows()
}

function openCreate() {
  editingId.value = null
  formError.value = ''
  Object.assign(form, emptyForm())
  formVisible.value = true
}

function openEdit(record: StoreRow) {
  editingId.value = record.id
  formError.value = ''
  Object.assign(form, {
    name: record.name ?? '',
    address: record.address ?? '',
    phone: record.phone ?? '',
    longitude: record.longitude === null || record.longitude === undefined ? '' : String(record.longitude),
    latitude: record.latitude === null || record.latitude === undefined ? '' : String(record.latitude),
    businessHours: record.businessHours ?? '',
    status: record.status,
    sortOrder: record.sortOrder ?? 0
  })
  formVisible.value = true
}

async function submitForm() {
  const payload: StoreForm = {
    name: form.name,
    address: form.address || null,
    phone: form.phone || null,
    longitude: form.longitude.trim() || null,
    latitude: form.latitude.trim() || null,
    businessHours: form.businessHours || null,
    status: form.status,
    sortOrder: form.sortOrder
  }
  saving.value = true
  formError.value = ''
  try {
    if (editingId.value) {
      await portalStoreApi.update(editingId.value, payload)
      message.success('门店已更新')
    } else {
      await portalStoreApi.create(payload)
      message.success('门店已保存')
    }
    formVisible.value = false
    await loadRows()
  } catch (error: any) {
    // 后端的判据（名称必填/坐标配对/长度上限/状态白名单）在这里是唯一出处：原样上屏，不静默重试
    formError.value = error?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function handleDelete(record: StoreRow) {
  try {
    await portalStoreApi.remove(record.id)
    message.success(`「${record.name}」已删除，门户地图上不再摆它`)
    await loadRows()
  } catch (error: any) {
    message.error(error?.message || '删除失败')
  }
}

onMounted(async () => {
  await loadOptions()
  await loadRows()
})
</script>

<style scoped lang="less">
.store-manage-page {
  width: 100%;

  &__notice {
    margin-bottom: 16px;
  }

  &__filter {
    margin-bottom: 16px;
  }

  &__count {
    color: #8c8c8c;
    font-size: 13px;
    margin-bottom: 8px;
  }

  &__hint {
    color: #8c8c8c;
    font-size: 12px;
    margin: 4px 0 0;
  }
}

.store-name {
  font-weight: 500;
  color: #1a1a1a;
}

.store-muted {
  font-size: 12px;
  color: #8c8c8c;
}

.store-warn {
  font-size: 12px;
  color: #faad14;
}

.toolbar-actions {
  margin-left: auto;
}
</style>
