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
        :data="permissionTree"
        checkable
        :expand-default="true"
        :field-names="{ children: 'children', title: 'name', key: 'id' }"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  EditOutlined,
  SafetyOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import type { Role, Permission } from '../../types'

const loading = ref(false)
const searchKeyword = ref('')
const modalVisible = ref(false)
const permissionModalVisible = ref(false)
const formRef = ref()
const currentRoleId = ref<number | null>(null)

const roles = ref<Role[]>([
  {
    id: 1,
    tenantId: 1,
    name: '超级管理员',
    code: 'super_admin',
    description: '系统最高权限，可访问所有功能',
    status: 'active',
    sort: 1,
    createdAt: '2024-01-01 00:00:00',
    updatedAt: '2024-01-01 00:00:00',
    permissions: [],
    permissionNames: ['用户管理', '角色管理', '权限管理', '内容管理', '系统配置'],
  },
  {
    id: 2,
    tenantId: 1,
    name: '内容管理员',
    code: 'content_admin',
    description: '负责内容的发布、审核、管理',
    status: 'active',
    sort: 2,
    createdAt: '2024-01-01 00:00:00',
    updatedAt: '2024-01-01 00:00:00',
    permissions: [],
    permissionNames: ['文章管理', '分类管理', '媒体库', '评论管理'],
  },
  {
    id: 3,
    tenantId: 1,
    name: '普通用户',
    code: 'user',
    description: '基础浏览权限',
    status: 'active',
    sort: 3,
    createdAt: '2024-01-01 00:00:00',
    updatedAt: '2024-01-01 00:00:00',
    permissions: [],
    permissionNames: ['文章浏览', '个人中心'],
  },
])

const permissionTree = ref<Permission[]>([
  {
    id: 1,
    tenantId: 1,
    name: '用户管理',
    code: 'user',
    type: 'menu',
    status: 'active',
    sort: 1,
    createdAt: '',
    updatedAt: '',
    children: [
      { id: 11, tenantId: 1, name: '查看用户', code: 'user:view', type: 'button', status: 'active', sort: 1, createdAt: '', updatedAt: '' },
      { id: 12, tenantId: 1, name: '创建用户', code: 'user:create', type: 'button', status: 'active', sort: 2, createdAt: '', updatedAt: '' },
      { id: 13, tenantId: 1, name: '编辑用户', code: 'user:edit', type: 'button', status: 'active', sort: 3, createdAt: '', updatedAt: '' },
      { id: 14, tenantId: 1, name: '删除用户', code: 'user:delete', type: 'button', status: 'active', sort: 4, createdAt: '', updatedAt: '' },
    ],
  },
  {
    id: 2,
    tenantId: 1,
    name: '角色管理',
    code: 'role',
    type: 'menu',
    status: 'active',
    sort: 2,
    createdAt: '',
    updatedAt: '',
    children: [
      { id: 21, tenantId: 1, name: '查看角色', code: 'role:view', type: 'button', status: 'active', sort: 1, createdAt: '', updatedAt: '' },
      { id: 22, tenantId: 1, name: '创建角色', code: 'role:create', type: 'button', status: 'active', sort: 2, createdAt: '', updatedAt: '' },
      { id: 23, tenantId: 1, name: '编辑角色', code: 'role:edit', type: 'button', status: 'active', sort: 3, createdAt: '', updatedAt: '' },
      { id: 24, tenantId: 1, name: '删除角色', code: 'role:delete', type: 'button', status: 'active', sort: 4, createdAt: '', updatedAt: '' },
    ],
  },
  {
    id: 3,
    tenantId: 1,
    name: '内容管理',
    code: 'content',
    type: 'menu',
    status: 'active',
    sort: 3,
    createdAt: '',
    updatedAt: '',
    children: [
      { id: 31, tenantId: 1, name: '文章管理', code: 'content:article', type: 'menu', status: 'active', sort: 1, createdAt: '', updatedAt: '' },
      { id: 32, tenantId: 1, name: '分类管理', code: 'content:category', type: 'menu', status: 'active', sort: 2, createdAt: '', updatedAt: '' },
      { id: 33, tenantId: 1, name: '媒体库', code: 'content:media', type: 'menu', status: 'active', sort: 3, createdAt: '', updatedAt: '' },
    ],
  },
])

const checkedPermissionKeys = ref<number[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: roles.value.length,
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

function loadRoles() {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 500)
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

function handleSubmit() {
  formRef.value?.validate().then(() => {
    message.success(formState.id ? '更新成功' : '创建成功')
    modalVisible.value = false
    loadRoles()
  })
}

function handleModalCancel() {
  formRef.value?.resetFields()
  modalVisible.value = false
}

function handleAssignPermissions(record: Role) {
  currentRoleId.value = record.id
  checkedPermissionKeys.value = record.permissions?.map(p => p.id) || []
  permissionModalVisible.value = true
}

function handlePermissionSubmit() {
  message.success('权限分配成功')
  permissionModalVisible.value = false
  loadRoles()
}

function handleDelete(record: Role) {
  if (record.code === 'super_admin') {
    message.error('超级管理员角色不能删除')
    return
  }
  const index = roles.value.findIndex(r => r.id === record.id)
  if (index > -1) {
    roles.value.splice(index, 1)
    message.success('删除成功')
  }
}

onMounted(() => {
  loadRoles()
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
