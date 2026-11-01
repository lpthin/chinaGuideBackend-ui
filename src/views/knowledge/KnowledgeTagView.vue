<template>
  <div class="knowledge-tag-page">
    <PageTitle />
    <a-spin :spinning="loading">
      <a-alert class="scope-alert" type="info" show-icon :message="scopeNotice" />
      <a-card :bordered="false">
        <!-- 这排控件原先挂在 #title 槽里，该槽是 overflow:hidden 的卡头标题区，改走 FilterBar -->
        <filter-bar>
          <a-input-search
            v-model:value="searchKeyword"
            placeholder="搜索标签"
            style="width: 200px"
            @search="onSearch"
            enter-button
          />
          <template #actions>
            <a-space>
              <a-button v-if="requestedTenantId !== null" type="primary" @click="showAddModal">
                <template #icon><PlusOutlined /></template>
                新建标签
              </a-button>
            </a-space>
          </template>
        </filter-bar>

        <a-table
          :scroll="{ x: 'max-content' }"
          :columns="columns"
          :data-source="pagedList"
          :pagination="paginationConfig"
          :row-key="(record: any) => record.id"
          :loading="loading"
        >
          <!-- 「暂无标签」在这一屏会被读成「这家还没建标签」，而它也可能是没发请求或读失败 -->
          <template #emptyText>
            <a-empty
              v-if="searchKeyword"
              :description="`没找到名字里带「${searchKeyword}」的标签（是在这一屏已读到的 ${tagList.length} 个标签里找的）`"
            />
            <empty-list-hint
              v-else
              :loading="loading"
              :not-sent="notSentLine"
              :read-failed="readFailed"
              :empty-line="emptyLine"
              :empty-reason="emptyReason"
              :can-create="canCreateHere"
              create-label="新建标签"
              @create="showAddModal"
            />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <span class="tag-name-text">{{ record.name }}</span>
            </template>
            <template v-if="column.key === 'useCount'">
              <a-badge :count="record.useCount" />
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="editTag(record)">编辑</a-button>
                <a-popconfirm
                  title="确定要删除这个标签吗？"
                  @confirm="handleDelete(record.id)"
                >
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-spin>

    <a-modal
      v-model:open="modalVisible"
      :title="editingTag ? '编辑标签' : '新建标签'"
      @ok="handleModalOk"
      :confirmLoading="saving"
      width="500px"
    >
      <a-form layout="vertical" :model="formData">
        <a-form-item label="标签名称" required>
          <a-input
            v-model:value="formData.name"
            placeholder="请输入标签名称"
          />
        </a-form-item>
        <a-form-item label="标签颜色">
          <a-radio-group v-model:value="formData.color" class="color-radio-group">
            <a-radio
              v-for="opt in colorOptions"
              :key="opt.value"
              :value="opt.value"
            >
              <span class="color-option">
                <span class="color-dot" :style="{ background: opt.hex }"></span>
                <span class="color-label">{{ opt.label }}</span>
              </span>
            </a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { knowledgeTagApi } from '../../api/knowledge'
import { describeHttpError } from '../../api/http'
import { formatDateTime } from '../../utils/format'
import type { KnowledgeTag, KnowledgeTagForm } from '../../types/knowledge'
import { useAuthStore } from '../../stores/auth'
import { asEmptyReason, offersCreateOnEmpty, type EmptyReason } from '../../utils/emptyPage'
import { logError } from '../../utils/errorLog'
import FilterBar from '../../components/FilterBar.vue'
import EmptyListHint from '../../components/EmptyListHint.vue'
import PageTitle from '../../components/PageTitle.vue'

const authStore = useAuthStore()

/**
 * 这一屏的数属于谁。超管没选定客户就是 null ⇒ 一发请求都不发。
 *
 * 改前这里是 `selectedTenantId || tenantId || 1`：`tenantId` 那个 getter 在没人选客户时回的是登录账号
 * 名下那一家，最后那个 `|| 1` 更会把人指到第一家去。而且后端这一口以前根本不接 `tenantId` 参数，
 * 界面发什么都不改得动它 —— 树上摆的是所有家放在一起的标签，同屏那一句「共 N 条」也按那份数念。
 */
const requestedTenantId = computed<number | null>(() => {
  if (authStore.isSuperAdmin) return authStore.selectedTenantId ?? null
  return authStore.user?.tenantId ?? null
})

const scopeNotice = computed(() => {
  const id = requestedTenantId.value
  if (id === null) {
    return authStore.isSuperAdmin
      ? '当前没有选定客户，这一屏不发请求、也不摆任何一家的标签。请在右上角选一家客户。'
      : '登录信息里没有客户编号，这一屏不发请求、也不摆数。'
  }
  const code = authStore.selectedTenantCode
  const who = authStore.isSuperAdmin
    ? `当前看的是${code ? `客户「${code}」` : '选中的那一家客户'}（编号 #${id}）`
    : `当前看的是你所在客户（编号 #${id}）`
  return `${who}的标签。`
})

const loading = ref(false)
const saving = ref(false)
const modalVisible = ref(false)
const searchKeyword = ref('')
const tagList = ref<KnowledgeTag[]>([])
const editingTag = ref<KnowledgeTag | null>(null)
// 没发出去与读失败各说各的：两种都不是「这一家没有标签」
const notSentLine = ref('')
const readFailed = ref('')
// 后端答的那一种空：「这一档查过了，一条都没有」与「那一家读不到」是两句话，界面不改写、不合并
const emptyLine = ref('')
const emptyReason = ref<EmptyReason>(null)

/** 该不该摆「新建标签」：选定客户了、这一发读回来了、且后端答的是「真的没有」 */
const canCreateHere = computed(
  () =>
    requestedTenantId.value !== null &&
    !notSentLine.value &&
    !readFailed.value &&
    offersCreateOnEmpty(emptyReason.value)
)

const formData = reactive<KnowledgeTagForm>({
  // 归属在每次打开新建时按「这一屏选定的那一家」填（见 showAddModal）。
  // 这里留 0 只是类型占位：0 不是任何一家的编号，真发出去后端的写闸会当面拒。
  tenantId: 0,
  name: '',
  color: 'blue',
})

// 颜色选项：value 对齐 a-tag 的预设颜色，hex 用于色块预览
const colorOptions = [
  { label: '蓝色', value: 'blue', hex: '#1677ff' },
  { label: '绿色', value: 'green', hex: '#52c41a' },
  { label: '橙色', value: 'orange', hex: '#fa8c16' },
  { label: '红色', value: 'red', hex: '#f5222d' },
  { label: '紫色', value: 'purple', hex: '#722ed1' },
  { label: '青色', value: 'cyan', hex: '#13c2c2' },
  { label: '粉色', value: 'pink', hex: '#eb2f96' },
  { label: '金色', value: 'gold', hex: '#faad14' },
]

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '标签名称', key: 'name', width: 200 },
  { title: '使用次数', key: 'useCount', width: 120, align: 'center' as const },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 200 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 150 },
]

/** 「共 N 条」只在真读回来的时候念数字；没发出去或读失败时它是「没读到」，不是 0 */
function countLabel(total: number): string {
  if (notSentLine.value || readFailed.value) return '条数没读到'
  return `共 ${total} 条`
}

const paginationConfig = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => countLabel(total),
  // 前端分页：仅更新本地分页状态，不触发后端请求
  onChange: (page: number, pageSize: number) => {
    paginationConfig.current = page
    paginationConfig.pageSize = pageSize
  },
  onShowSizeChange: (_page: number, pageSize: number) => {
    paginationConfig.current = 1
    paginationConfig.pageSize = pageSize
  },
})

// 后端 /knowledge/tags 只按 status 过滤，关键字在前端过滤
const filteredList = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return tagList.value
  return tagList.value.filter(t => (t.name || '').toLowerCase().includes(kw))
})

// 前端分页：基于过滤结果切片当前页数据
const pagedList = computed(() => {
  const start = (paginationConfig.current - 1) * paginationConfig.pageSize
  const end = start + paginationConfig.pageSize
  return filteredList.value.slice(start, end)
})

watch(filteredList, (list) => {
  paginationConfig.total = list.length
  const maxPage = Math.max(1, Math.ceil(list.length / paginationConfig.pageSize))
  if (paginationConfig.current > maxPage) {
    paginationConfig.current = maxPage
  }
})

function onSearch() {
  paginationConfig.current = 1
}

function showAddModal() {
  editingTag.value = null
  formData.tenantId = requestedTenantId.value ?? 0
  formData.name = ''
  formData.color = 'blue'
  modalVisible.value = true
}

function editTag(record: KnowledgeTag) {
  editingTag.value = record
  formData.tenantId = record.tenantId
  formData.name = record.name
  formData.color = record.color
  modalVisible.value = true
}

async function handleDelete(id: number) {
  try {
    await knowledgeTagApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error) {
    message.error(`删除失败：${describeHttpError(error)}`)
  }
}

async function handleModalOk() {
  if (!formData.name) {
    message.error('请输入标签名称')
    return
  }

  saving.value = true
  try {
    if (editingTag.value) {
      await knowledgeTagApi.update(editingTag.value.id, formData)
      message.success('更新成功')
    } else {
      await knowledgeTagApi.create(formData)
      message.success('创建成功')
    }
    modalVisible.value = false
    await loadData()
  } catch (error) {
    message.error(`保存失败：${describeHttpError(error)}`)
  } finally {
    saving.value = false
  }
}

async function loadData() {
  const tenantId = requestedTenantId.value
  if (tenantId === null) {
    // 没选定客户 ⇒ 这一发不发。tagList 清空、总数清零，界面上那一行念的是「没发出去」
    tagList.value = []
    paginationConfig.total = 0
    readFailed.value = ''
    emptyLine.value = ''
    emptyReason.value = null
    // 三屏同一句「这一发没发出去」（分类屏、留言管理屏都这么说），别在这一屏自造第二套说法
    notSentLine.value = authStore.isSuperAdmin
      ? '当前没有选定客户，这一发没发出去，所以这里的标签一个都不是（不是「这一家没有标签」）。请在右上角选一家客户。'
      : '登录信息里没有客户编号，这一发没发出去，所以这里的标签一个都不是。'
    return
  }
  notSentLine.value = ''
  loading.value = true
  // 上一家答的那一种空不许留着：加载中那一眼摆出来的成因必须是这一次的
  emptyLine.value = ''
  emptyReason.value = null
  try {
    const result = await knowledgeTagApi.list({ tenantId })
    const list = Array.isArray(result) ? result : (result as any).records || []
    readFailed.value = ''
    emptyLine.value = result.emptyLine || ''
    emptyReason.value = asEmptyReason(result.emptyReason)
    tagList.value = list
    paginationConfig.total = list.length
    const maxPage = Math.max(1, Math.ceil(list.length / paginationConfig.pageSize))
    if (paginationConfig.current > maxPage) {
      paginationConfig.current = maxPage
    }
  } catch (error) {
    readFailed.value = describeHttpError(error)
    message.error(`加载标签列表失败：${readFailed.value}`)
    logError('knowledge/tag-view', '加载标签列表失败', error)
    tagList.value = []
    paginationConfig.total = 0
    emptyLine.value = ''
    emptyReason.value = null
  } finally {
    loading.value = false
  }
}

// 换了一家公司，上一家的标签不能继续摆着当这一家的
watch(requestedTenantId, () => {
  tagList.value = []
  paginationConfig.total = 0
  searchKeyword.value = ''
  paginationConfig.current = 1
  loadData()
})

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.knowledge-tag-page {
  width: 100%;
}

.scope-alert {
  margin-bottom: 12px;
}

.tag-name-text {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.color-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.color-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
}
</style>
