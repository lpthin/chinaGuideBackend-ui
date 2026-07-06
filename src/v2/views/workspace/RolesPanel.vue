<template>
  <div class="roles-panel">
    <a-card :bordered="false">
      <template #title>
        <div class="card-header">
          <h3>角色管理</h3>
          <a-space>
            <a-input-search
              v-model:value="searchKeyword"
              placeholder="搜索角色名称"
              style="width: 200px"
              @search="loadRoles"
            />
            <a-button type="primary" @click="handleAdd">
              <template #icon><PlusOutlined /></template>
              新增角色
            </a-button>
          </a-space>
        </div>
      </template>

      <a-table
        :columns="columns"
        :data-source="roles"
        :pagination="pagination"
        :loading="loading"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'permissions'">
            <a-space size="small" wrap>
              <a-tag v-for="perm in record.permissionNames?.slice(0, 3)" :key="perm" color="blue" size="small">
                {{ perm }}
              </a-tag>
              <a-tag v-if="record.permissionNames && record.permissionNames.length > 3" size="small">
                +{{ record.permissionNames.length - 3 }}
              </a-tag>
            </a-space>
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
              <a-button type="link" size="small" @click="handleAssignPermissions(record)">
                <SafetyOutlined /> 权限
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

    <!-- 角色编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      title="编辑角色"
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
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="角色名称" name="name">
              <a-input v-model:value="formState.name" placeholder="请输入角色名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="角色编码" name="code">
              <a-input v-model:value="formState.code" placeholder="请输入角色编码" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="排序" name="sort">
          <a-input-number
            v-model:value="formState.sort"
            :min="1"
            :max="999"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea
            v-model:value="formState.description"
            placeholder="请输入角色描述"
            :rows="3"
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

    <!-- 权限分配弹窗 -->
    <a-modal
      v-model:open="permissionModalVisible"
      title="分配权限"
      width="700px"
      @ok="handlePermissionSubmit"
    >
      <a-tree
        v-model:checkedKeys="checkedPermissionKeys"
        :tree-data="permissionTree"
        checkable
        :default-expand-all="true"
        :field-names="{ children: 'children', title: 'name', key: 'id' }"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  EditOutlined,
  SafetyOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import { adminApi } from '../../api/workspace'
import { useAuthStore } from '../../stores/auth'
import type { Role } from '../../types'

const authStore = useAuthStore()

const loading = ref(false)
const searchKeyword = ref('')
const modalVisible = ref(false)
const permissionModalVisible = ref(false)
const formRef = ref()
const currentRoleId = ref<number | null>(null)

const roles = ref<Role[]>([])
const permissionTree = ref<any[]>([])
const checkedPermissionKeys = ref<(string | number)[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const formState = reactive({
  id: null as number | null,
  name: '',
  code: '',
  description: '',
  sort: 1,
  status: 'active' as 'active' | 'inactive',
})

const rules = {
  name: [
    { required: true, message: '请输入角色名称', trigger: 'blur' },
    { max: 50, message: '角色名称长度不能超过 50 个字符', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入角色编码', trigger: 'blur' },
    { max: 50, message: '角色编码长度不能超过 50 个字符', trigger: 'blur' },
  ],
  description: [
    { max: 200, message: '描述长度不能超过 200 个字符', trigger: 'blur' },
  ],
}

const columns = [
  {
    title: '角色名称',
    dataIndex: 'name',
    key: 'name',
    width: 150,
  },
  {
    title: '角色编码',
    dataIndex: 'code',
    key: 'code',
    width: 150,
  },
  {
    title: '权限',
    key: 'permissions',
    width: 350,
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
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
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
    width: 200,
  },
]

async function loadRoles() {
  loading.value = true
  try {
    const result = await adminApi.roles.list({
      page: pagination.current,
      size: pagination.pageSize,
      keyword: searchKeyword.value || undefined,
    })
    roles.value = result.records || []
    pagination.total = result.total || 0
  } catch (error: any) {
    message.error(error.message || '加载角色列表失败')
  } finally {
    loading.value = false
  }
}

async function loadPermissionTree() {
  try {
    const result = await adminApi.permissions.tree()
    permissionTree.value = result || []
  } catch (error: any) {
    message.error(error.message || '加载权限树失败')
  }
}

async function loadRolePermissions(roleId: number) {
  try {
    const permissionIds = await adminApi.roles.getPermissions(roleId)
    checkedPermissionKeys.value = permissionIds || []
  } catch (error: any) {
    message.error(error.message || '加载角色权限失败')
  }
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadRoles()
}

function handleAdd() {
  formState.id = null
  formState.name = ''
  formState.code = ''
  formState.description = ''
  formState.sort = 1
  formState.status = 'active'
  modalVisible.value = true
}

function handleEdit(record: Role) {
  formState.id = record.id
  formState.name = record.name
  formState.code = record.code
  formState.description = record.description || ''
  formState.sort = record.sort
  formState.status = record.status
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    
    if (formState.id) {
      await adminApi.roles.update(formState.id, {
        name: formState.name,
        code: formState.code,
        description: formState.description,
        sort: formState.sort,
        status: formState.status,
      })
      message.success('更新成功')
    } else {
      await adminApi.roles.create({
        name: formState.name,
        code: formState.code,
        description: formState.description,
        sort: formState.sort,
        status: formState.status,
      })
      message.success('创建成功')
    }
    
    modalVisible.value = false
    loadRoles()
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

async function handleAssignPermissions(record: Role) {
  currentRoleId.value = record.id
  await loadRolePermissions(record.id)
  permissionModalVisible.value = true
}

async function handlePermissionSubmit() {
  if (!currentRoleId.value) return
  
  try {
    const permIds = checkedPermissionKeys.value
      .filter(k => typeof k === 'number')
      .map(k => k as number)
    
    await adminApi.roles.assignPermissions(currentRoleId.value, permIds)
    message.success('权限分配成功')
    permissionModalVisible.value = false
    loadRoles()
  } catch (error: any) {
    message.error(error.message || '权限分配失败')
  }
}

async function handleDelete(record: Role) {
  if (record.code === 'super_admin' || record.id === 1) {
    message.error('超级管理员角色不能删除')
    return
  }
  
  try {
    await adminApi.roles.delete(record.id)
    message.success('删除成功')
    loadRoles()
  } catch (error: any) {
    message.error(error.message || '删除失败')
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    pagination.current = 1
    loadRoles()
  }
)

onMounted(() => {
  loadRoles()
  loadPermissionTree()
})
</script>

<style scoped lang="less">
.roles-panel {
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
