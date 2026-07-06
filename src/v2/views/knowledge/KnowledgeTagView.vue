<template>
  <div class="knowledge-tag-page">
    <a-spin :spinning="loading">
      <a-card :bordered="false">
        <template #title>
          <a-space>
            <a-input-search
              v-model:value="searchKeyword"
              placeholder="搜索标签"
              style="width: 200px"
              @search="onSearch"
              enter-button
            />
            <a-button type="primary" @click="showAddModal">
              <template #icon><PlusOutlined /></template>
              新建标签
            </a-button>
          </a-space>
        </template>

        <a-table
          :columns="columns"
          :data-source="pagedList"
          :pagination="paginationConfig"
          :row-key="record => record.id"
          :loading="loading"
          :locale="{ emptyText: '暂无标签' }"
        >
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
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { knowledgeTagApi } from '../../api/knowledge'
import type { KnowledgeTag, KnowledgeTagForm } from '../../types/knowledge'

const loading = ref(false)
const saving = ref(false)
const modalVisible = ref(false)
const searchKeyword = ref('')
const tagList = ref<KnowledgeTag[]>([])
const editingTag = ref<KnowledgeTag | null>(null)

const formData = reactive<KnowledgeTagForm>({
  tenantId: 1,
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

const paginationConfig = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
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

// 前端分页：基于 tagList 切片当前页数据
const pagedList = computed(() => {
  const start = (paginationConfig.current - 1) * paginationConfig.pageSize
  const end = start + paginationConfig.pageSize
  return tagList.value.slice(start, end)
})

function formatDateTime(value: string): string {
  if (!value) return '-'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : value
}

function onSearch() {
  paginationConfig.current = 1
  loadData()
}

function showAddModal() {
  editingTag.value = null
  formData.name = ''
  formData.color = 'blue'
  modalVisible.value = true
}

function editTag(record: KnowledgeTag) {
  editingTag.value = record
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
    message.error('删除失败')
    console.error(error)
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
    message.error('保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    // 后端过滤：仅传 keyword（API 支持），不传 page/size 以获取完整结果集
    const result = await knowledgeTagApi.list({
      tenantId: 1,
      keyword: searchKeyword.value,
    })
    const list = Array.isArray(result) ? result : (result as any).records || []
    tagList.value = list
    paginationConfig.total = list.length
    // 修正越界：搜索/删除后若当前页超出范围，回退到最后一页
    const maxPage = Math.max(1, Math.ceil(list.length / paginationConfig.pageSize))
    if (paginationConfig.current > maxPage) {
      paginationConfig.current = maxPage
    }
  } catch (error) {
    console.error(error)
    message.error('加载标签列表失败')
    tagList.value = []
    paginationConfig.total = 0
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.knowledge-tag-page {
  width: 100%;
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
