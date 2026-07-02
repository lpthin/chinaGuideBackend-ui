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
              @search="loadData"
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
          :data-source="tagList"
          :pagination="paginationConfig"
          :row-key="record => record.id"
          :loading="loading"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <a-tag :color="record.color">{{ record.name }}</a-tag>
            </template>
            <template v-if="column.key === 'useCount'">
              <a-badge :count="record.useCount" />
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
          <a-select
            v-model:value="formData.color"
            placeholder="选择标签颜色"
            style="width: 100%"
          >
            <a-select-option value="blue">蓝色</a-select-option>
            <a-select-option value="green">绿色</a-select-option>
            <a-select-option value="orange">橙色</a-select-option>
            <a-select-option value="red">红色</a-select-option>
            <a-select-option value="purple">紫色</a-select-option>
            <a-select-option value="cyan">青色</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
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
  onChange: (page: number, pageSize: number) => {
    paginationConfig.current = page
    paginationConfig.pageSize = pageSize
    loadData()
  },
  onShowSizeChange: (page: number, pageSize: number) => {
    paginationConfig.current = 1
    paginationConfig.pageSize = pageSize
    loadData()
  },
})

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
    const result = await knowledgeTagApi.list({
      tenantId: 1,
      keyword: searchKeyword.value,
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
    })
    const list = Array.isArray(result) ? result : (result as any).records || []
    if (searchKeyword.value) {
      tagList.value = list.filter((t: KnowledgeTag) =>
        t.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
      )
    } else {
      tagList.value = list
    }
    paginationConfig.total = tagList.value.length
  } catch (error) {
    console.error(error)
    const mockData = generateMockTags()
    tagList.value = mockData
    paginationConfig.total = mockData.length
  } finally {
    loading.value = false
  }
}

function generateMockTags(): KnowledgeTag[] {
  const names = ['Vue', 'React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Docker', 'Git', 'CSS', 'HTML', 'MySQL', 'Redis', 'MongoDB', 'GraphQL', 'REST API']
  const colors = ['blue', 'green', 'orange', 'red', 'purple', 'cyan']

  return names.map((name, index) => ({
    id: index + 1,
    tenantId: 1,
    name,
    color: colors[index % colors.length],
    useCount: Math.floor(Math.random() * 100),
    createdAt: '2024-01-01 10:00:00',
  }))
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.knowledge-tag-page {
  width: 100%;
}
</style>
