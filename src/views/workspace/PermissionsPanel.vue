<template>
  <div class="permissions-panel">
    <PageTitle />
    <a-card :bordered="false">
      <!-- 筛选与按钮原先塞在卡片 #title 槽（overflow:hidden 会裁切），改走统一的 FilterBar；
           卡片头那句「权限管理」撤了：屏名上面刚念过一遍，这里再摆就是同一屏两个标题 -->
      <filter-bar>
        <a-select
          v-model:value="filterType"
          placeholder="权限类型"
          style="width: 120px"
          allowClear
          @change="loadPermissions"
        >
          <a-select-option value="menu">菜单</a-select-option>
          <a-select-option value="button">按钮</a-select-option>
        </a-select>
        <template #actions>
          <a-space>
            <a-button type="primary" @click="handleAdd">
              <template #icon><PlusOutlined /></template>
              新增权限
            </a-button>
          </a-space>
        </template>
      </filter-bar>

      <!-- 权限是树形：children 行随父行展开，客户端分页会把父子行切开，所以这张表保留 pagination=false -->
      <DataTable
        :columns="columns"
        :data-source="permissions"
        :pagination="false"
        :loading="loading"
        :error="permissionsError"
        :retry="loadPermissions"
        empty-line="这一栏还没有内容。"
        row-key="id"
        :default-expand-all="true"
        :children-column-name="'children'"
        :indent-size="20"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <span>{{ record.name }}</span>
          </template>
          <template v-if="column.key === 'type'">
            <a-tag :color="getTypeColor(record.type)">
              {{ getTypeName(record.type) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'active' ? 'green' : 'default'">
              {{ record.status === 'active' ? '启用' : '禁用' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button type="link" size="small" @click="handleEdit(record)">
                <EditOutlined /> 编辑
              </a-button>
              <a-button
                type="link"
                size="small"
                danger
                @click="handleDelete(record)"
              >
                <DeleteOutlined /> 删除
              </a-button>
            </a-space>
          </template>
        </template>
      </DataTable>
    </a-card>

    <!-- 权限编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="formState.id ? '编辑权限' : '新增权限'"
      width="600px"
      :confirm-loading="submitting"
      @ok="handleSubmit"
      @cancel="handleModalCancel"
    >
      <a-form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="权限名称" name="name">
              <a-input v-model:value="formState.name" placeholder="请输入权限名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="权限编码" name="code">
              <a-input v-model:value="formState.code" placeholder="请输入权限编码" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import FilterBar from '../../components/FilterBar.vue'
import DataTable from '../../components/DataTable.vue'
import { adminApi } from '../../api/workspace'
import { describeHttpError } from '../../api/http'
import { formatDateTime } from '../../utils/format'
import { createSubmitGuard } from '../../utils/submitGuard'
import { useAuthStore } from '../../stores/auth'
import PageTitle from '../../components/PageTitle.vue'

const authStore = useAuthStore()

const loading = ref(false)
const submitting = ref(false)
const filterType = ref<string | undefined>()
const modalVisible = ref(false)
const formRef = ref()

const permissions = ref<any[]>([])
const permissionsError = ref<string | null>(null)

const formState = reactive({
  id: null as number | null,
  name: '',
  code: '',
})

const rules = {
  name: [
    { required: true, message: '请输入权限名称', trigger: 'blur' },
    { max: 50, message: '权限名称长度不能超过 50 个字符', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入权限编码', trigger: 'blur' },
    { max: 100, message: '权限编码长度不能超过 100 个字符', trigger: 'blur' },
  ],
}

const columns = [
  {
    title: '权限名称',
    key: 'name',
    width: 250,
  },
  {
    title: '权限编码',
    dataIndex: 'code',
    key: 'code',
    width: 200,
  },
  {
    title: '类型',
    key: 'type',
    width: 100,
  },
  {
    title: '路由/API',
    key: 'path',
    width: 200,
    customRender: ({ record }: { record: any }) => record.path || record.api || record.action || '-',
  },
  {
    title: '排序',
    dataIndex: 'sort',
    key: 'sort',
    width: 80,
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    customRender: ({ text }: { text: string }) => formatDateTime(text),
  },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right' as const,
    width: 220,
  },
]

function getTypeName(type: string): string {
  const nameMap: Record<string, string> = {
    menu: '菜单',
    button: '按钮',
    api: 'API',
  }
  return nameMap[type] || type
}

function getTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    menu: 'blue',
    button: 'green',
    api: 'purple',
  }
  return colorMap[type] || 'default'
}

async function loadPermissions() {
  loading.value = true
  permissionsError.value = null
  try {
    const result = await adminApi.permissions.tree()
    let treeData = result || []
    
    if (filterType.value) {
      treeData = filterTreeByType(treeData, filterType.value)
    }
    
    permissions.value = treeData
  } catch (error) {
    permissionsError.value = (error as { message?: string })?.message || '加载权限列表失败'
  } finally {
    loading.value = false
  }
}

function filterTreeByType(tree: any[], type: string): any[] {
  return tree
    .map(node => {
      const filteredChildren = node.children ? filterTreeByType(node.children, type) : []
      if (node.type === type || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren }
      }
      return null
    })
    .filter(Boolean)
}

function handleAdd() {
  formState.id = null
  formState.name = ''
  formState.code = ''
  modalVisible.value = true
}

function handleEdit(record: any) {
  if (typeof record.id !== 'number') {
    message.warning('模块分组不是权限记录，无法编辑')
    return
  }
  formState.id = record.id
  formState.name = record.name
  formState.code = record.code
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    submitting.value = true

    if (formState.id) {
      await adminApi.permissions.update(formState.id, {
        name: formState.name,
        code: formState.code,
      })
      message.success('更新成功')
    } else {
      await adminApi.permissions.create({
        name: formState.name,
        code: formState.code,
      })
      message.success('创建成功')
    }

    modalVisible.value = false
    loadPermissions()
  } catch (error: any) {
    if (!error?.errorFields) {
      message.error(`操作失败：${describeHttpError(error)}`)
    }
  } finally {
    submitting.value = false
  }
}

function handleModalCancel() {
  formRef.value?.resetFields()
  modalVisible.value = false
}

// 删除是不可逆写入（SPEC-UI-10 G-2）：同一拍连点两次只发一次请求
const deleteGuard = createSubmitGuard()

async function handleDelete(record: any) {
  if (deleteGuard.pending.value) return
  void deleteGuard.run(async () => {
    if (record.children && record.children.length > 0) {
      message.error('存在子权限，无法删除')
      return
    }

    if (typeof record.id !== 'number') {
      message.error('该节点无法删除')
      return
    }

    try {
      await adminApi.permissions.delete(record.id)
      message.success('删除成功')
      loadPermissions()
    } catch (error) {
      message.error(`删除失败：${describeHttpError(error)}`)
    }
  })
}

watch(
  () => authStore.selectedTenantId,
  () => {
    loadPermissions()
  }
)

onMounted(() => {
  loadPermissions()
})
</script>
