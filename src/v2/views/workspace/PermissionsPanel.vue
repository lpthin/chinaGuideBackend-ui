<template>
  <div class="permissions-panel">
    <a-card :bordered="false">
      <template #title>
        <div class="card-header">
          <h3>权限管理</h3>
          <a-space>
            <a-select
              v-model:value="filterType"
              placeholder="权限类型"
              style="width: 120px"
              allowClear
              @change="loadPermissions"
            >
              <a-select-option value="menu">菜单</a-select-option>
              <a-select-option value="button">按钮</a-select-option>
              <a-select-option value="api">API</a-select-option>
            </a-select>
            <a-button type="primary" @click="handleAdd">
              <template #icon><PlusOutlined /></template>
              新增权限
            </a-button>
          </a-space>
        </div>
      </template>

      <a-table
        :columns="columns"
        :data-source="permissions"
        :pagination="false"
        :loading="loading"
        row-key="id"
        :default-expand-all="true"
        :children-column-name="'children'"
        :indent-size="20"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <span>
              <component :is="getIcon(record.icon)" style="margin-right: 8px" />
              {{ record.name }}
            </span>
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
              <a-button type="link" size="small" @click="handleAddChild(record)">
                <PlusOutlined /> 子权限
              </a-button>
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
      </a-table>
    </a-card>

    <!-- 权限编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      title="编辑权限"
      width="600px"
      @ok="handleSubmit"
      @cancel="handleModalCancel"
    >
      <a-form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
      >
        <a-form-item v-if="formState.parentId" label="父级权限">
          <span>{{ getParentName(formState.parentId) }}</span>
        </a-form-item>
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
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="权限类型" name="type">
              <a-select v-model:value="formState.type" placeholder="请选择类型">
                <a-select-option value="menu">菜单</a-select-option>
                <a-select-option value="button">按钮</a-select-option>
                <a-select-option value="api">API</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="图标" name="icon">
              <a-input v-model:value="formState.icon" placeholder="请输入图标名称" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item v-if="formState.type === 'menu'" label="路由路径" name="path">
          <a-input v-model:value="formState.path" placeholder="请输入路由路径" />
        </a-form-item>
        <a-form-item v-if="formState.type === 'api'" label="API地址" name="api">
          <a-input v-model:value="formState.api" placeholder="请输入API地址" />
        </a-form-item>
        <a-form-item label="排序" name="sort">
          <a-input-number
            v-model:value="formState.sort"
            :min="1"
            :max="999"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-radio-group v-model:value="formState.status">
            <a-radio value="active">启用</a-radio>
            <a-radio value="inactive">禁用</a-radio>
          </a-radio-group>
        </a-form-item>
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
  MenuOutlined,
  AppstoreOutlined,
  SettingOutlined,
  SafetyOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'
import { adminApi } from '../../api/workspace'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
const filterType = ref<string | undefined>()
const modalVisible = ref(false)
const formRef = ref()

const iconMap: Record<string, any> = {
  MenuOutlined,
  AppstoreOutlined,
  SettingOutlined,
  SafetyOutlined,
  UserOutlined,
  TeamOutlined,
}

const permissions = ref<any[]>([])

const formState = reactive({
  id: null as number | null,
  parentId: null as number | string | null,
  name: '',
  code: '',
  type: 'menu' as 'menu' | 'button' | 'api',
  icon: '',
  path: '',
  api: '',
  sort: 1,
  status: 'active' as 'active' | 'inactive',
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
  type: [
    { required: true, message: '请选择权限类型', trigger: 'change' },
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
  },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right' as const,
    width: 220,
  },
]

function getIcon(iconName?: string) {
  if (!iconName || !iconMap[iconName]) {
    return MenuOutlined
  }
  return iconMap[iconName]
}

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

function findPermission(
  list: any[],
  id: number | string
): any | null {
  for (const item of list) {
    if (item.id === id) {
      return item
    }
    if (item.children) {
      const found = findPermission(item.children, id)
      if (found) return found
    }
  }
  return null
}

function getParentName(parentId: number | string | null): string {
  if (!parentId) return '-'
  const parent = findPermission(permissions.value, parentId)
  return parent?.name || '-'
}

async function loadPermissions() {
  loading.value = true
  try {
    const result = await adminApi.permissions.tree()
    let treeData = result || []
    
    if (filterType.value) {
      treeData = filterTreeByType(treeData, filterType.value)
    }
    
    permissions.value = treeData
  } catch (error: any) {
    message.error(error.message || '加载权限列表失败')
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
  formState.parentId = null
  formState.name = ''
  formState.code = ''
  formState.type = 'menu'
  formState.icon = ''
  formState.path = ''
  formState.api = ''
  formState.sort = 1
  formState.status = 'active'
  modalVisible.value = true
}

function handleAddChild(record: any) {
  formState.id = null
  formState.parentId = record.id
  formState.name = ''
  formState.code = ''
  formState.type = 'button'
  formState.icon = ''
  formState.path = ''
  formState.api = ''
  formState.sort = 1
  formState.status = 'active'
  modalVisible.value = true
}

function handleEdit(record: any) {
  formState.id = typeof record.id === 'number' ? record.id : null
  formState.parentId = record.parentId
  formState.name = record.name
  formState.code = record.code
  formState.type = record.type || 'menu'
  formState.icon = record.icon || ''
  formState.path = record.path || ''
  formState.api = record.api || ''
  formState.sort = record.sort || 1
  formState.status = record.status || 'active'
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    
    if (formState.id) {
      message.success('更新成功')
    } else {
      message.success('创建成功')
    }
    
    modalVisible.value = false
    loadPermissions()
  } catch (error: any) {
    if (error.message && error.message !== '校验失败') {
      message.error(error.message || '操作失败')
    }
  }
}

function handleModalCancel() {
  formRef.value?.resetFields()
  modalVisible.value = false
}

async function handleDelete(record: any) {
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
  } catch (error: any) {
    message.error(error.message || '删除失败')
  }
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

<style scoped lang="less">
.permissions-panel {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
  }
}
</style>
