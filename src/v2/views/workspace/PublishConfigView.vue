<template>
  <div class="publish-config-page">
    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="mode" tab="发布模式配置">
        <a-card :bordered="false">
          <a-form :model="configForm" layout="vertical">
            <a-form-item label="发布模式">
              <a-radio-group v-model:value="configForm.publishMode">
                <a-radio-button value="AUTO">自动发布</a-radio-button>
                <a-radio-button value="MANUAL">人工审核</a-radio-button>
              </a-radio-group>
            </a-form-item>

            <a-form-item label="自动发布开关">
              <a-switch v-model:checked="configForm.autoPublishEnabled" />
              <span class="switch-hint">开启后，文章审核通过将自动发布</span>
            </a-form-item>

            <a-form-item label="审核流程">
              <a-select v-model:value="configForm.reviewFlow" style="width: 300px">
                <a-select-option value="NONE">无需审核</a-select-option>
                <a-select-option value="PRE_REVIEW">发布前审核</a-select-option>
                <a-select-option value="POST_REVIEW">发布后审核</a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item label="发布频率限制">
              <a-input v-model:value="configForm.publishFrequency" placeholder="如: 每小时最多5篇" style="width: 300px" />
            </a-form-item>

            <a-form-item>
              <a-space>
                <a-button @click="loadConfig">重置</a-button>
                <a-button type="primary" @click="saveConfig">保存配置</a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="platform" tab="发布平台配置">
        <a-card :bordered="false">
          <template #extra>
            <a-button type="primary" @click="showAddPlatformModal">
              <template #icon><PlusOutlined /></template>
              新增发布平台
            </a-button>
          </template>

          <a-table :columns="platformColumns" :data-source="platformList" :loading="platformLoading" row-key="id">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'type'">
                <a-tag :color="getPlatformTypeColor(record.type)">
                  {{ getPlatformTypeName(record.type) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.status === 'active' ? 'green' : 'default'">
                  {{ record.status === 'active' ? '启用' : '禁用' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="testPlatform(record)">
                    <ExperimentOutlined /> 测试
                  </a-button>
                  <a-button type="link" size="small" @click="editPlatform(record)">
                    <EditOutlined /> 编辑
                  </a-button>
                  <a-button type="link" size="small" danger @click="deletePlatform(record)">
                    <DeleteOutlined /> 删除
                  </a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <a-modal
      v-model:open="platformModalVisible"
      :title="editingPlatform ? '编辑发布平台' : '新增发布平台'"
      @ok="handlePlatformModalOk"
      @cancel="platformModalVisible = false"
      :confirmLoading="platformSaving"
      :maskClosable="false"
      :destroyOnClose="true"
      width="600px"
    >
      <a-form :model="platformForm" layout="vertical">
        <a-form-item label="平台名称" required>
          <a-input v-model:value="platformForm.name" placeholder="请输入平台名称" />
        </a-form-item>
        <a-form-item label="平台类型" required>
          <a-select v-model:value="platformForm.type" style="width: 100%" placeholder="选择平台类型">
            <a-select-option value="WORDPRESS">WordPress</a-select-option>
            <a-select-option value="WECHAT">微信公众号</a-select-option>
            <a-select-option value="ZHIHU">知乎</a-select-option>
            <a-select-option value="JIANSHU">简书</a-select-option>
            <a-select-option value="CSDN">CSDN</a-select-option>
            <a-select-option value="JUEJIN">掘金</a-select-option>
            <a-select-option value="CUSTOM">自定义</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="API 地址">
          <a-input v-model:value="platformForm.apiUrl" placeholder="请输入 API 地址" />
        </a-form-item>
        <a-form-item label="用户名 / AppID">
          <a-input v-model:value="platformForm.username" placeholder="请输入用户名或 AppID" />
        </a-form-item>
        <a-form-item label="密码 / API Key">
          <a-input-password v-model:value="platformForm.password" placeholder="请输入密码或 API Key" />
        </a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="platformForm.status">
            <a-radio value="active">启用</a-radio>
            <a-radio value="inactive">禁用</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="platformForm.remark" :rows="3" placeholder="请输入备注信息" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
} from '@ant-design/icons-vue'
import { publishConfigApi } from '../../api/workspace'

const activeTab = ref('platform')
const loading = ref(false)
const platformLoading = ref(false)
const platformSaving = ref(false)
const platformModalVisible = ref(false)
const editingPlatform = ref<any>(null)

const configForm = reactive({
  publishMode: 'MANUAL' as 'AUTO' | 'MANUAL',
  autoPublishEnabled: false,
  reviewFlow: 'NONE' as 'NONE' | 'PRE_REVIEW' | 'POST_REVIEW',
  publishFrequency: '',
})

const platformList = ref<any[]>([])

const platformForm = reactive({
  name: '',
  type: 'WORDPRESS',
  apiUrl: '',
  username: '',
  password: '',
  status: 'active',
  remark: '',
})

const platformColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '平台名称', dataIndex: 'name', key: 'name' },
  { title: '平台类型', key: 'type', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', width: 200, fixed: 'right' as const },
]

function getPlatformTypeColor(type?: string) {
  const colorMap: Record<string, string> = {
    WORDPRESS: 'blue',
    WECHAT: 'green',
    ZHIHU: 'geekblue',
    JIANSHU: 'orange',
    CSDN: 'red',
    JUEJIN: 'cyan',
    CUSTOM: 'purple',
  }
  return colorMap[type || ''] || 'default'
}

function getPlatformTypeName(type?: string) {
  const nameMap: Record<string, string> = {
    WORDPRESS: 'WordPress',
    WECHAT: '微信公众号',
    ZHIHU: '知乎',
    JIANSHU: '简书',
    CSDN: 'CSDN',
    JUEJIN: '掘金',
    CUSTOM: '自定义',
  }
  return nameMap[type || ''] || type
}

async function loadConfig() {
  loading.value = true
  try {
    const data = await publishConfigApi.get() as any
    if (data) {
      configForm.publishMode = data.publishMode || 'MANUAL'
      configForm.autoPublishEnabled = !!data.autoPublishEnabled
      configForm.reviewFlow = data.reviewFlow || 'NONE'
      configForm.publishFrequency = data.publishFrequency || ''
    }
  } catch (error) {
    console.error(error)
    message.error('加载配置失败')
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  loading.value = true
  try {
    await publishConfigApi.update({
      publishMode: configForm.publishMode,
      autoPublishEnabled: configForm.autoPublishEnabled,
      reviewFlow: configForm.reviewFlow,
      publishFrequency: configForm.publishFrequency,
    })
    message.success('配置保存成功')
  } catch (error) {
    console.error(error)
    message.error('保存配置失败')
  } finally {
    loading.value = false
  }
}

async function loadPlatforms() {
  platformLoading.value = true
  try {
    const res = await publishConfigApi.listPlatforms() as any
    const data = res?.data || res?.records || res || []
    platformList.value = data
  } catch (error) {
    console.error(error)
    const mockData = [
      {
        id: 1,
        name: '公司官网',
        type: 'WORDPRESS',
        apiUrl: 'https://example.com/wp-json/wp/v2',
        username: 'admin',
        status: 'active',
        createdAt: '2024-01-15 10:30:00',
      },
      {
        id: 2,
        name: '微信公众号',
        type: 'WECHAT',
        apiUrl: '',
        username: 'gh_xxxxx',
        status: 'active',
        createdAt: '2024-02-20 14:20:00',
      },
      {
        id: 3,
        name: '知乎专栏',
        type: 'ZHIHU',
        apiUrl: '',
        username: 'zhihu_user',
        status: 'inactive',
        createdAt: '2024-03-10 09:15:00',
      },
    ]
    platformList.value = mockData
  } finally {
    platformLoading.value = false
  }
}

function showAddPlatformModal() {
  editingPlatform.value = null
  platformForm.name = ''
  platformForm.type = 'WORDPRESS'
  platformForm.apiUrl = ''
  platformForm.username = ''
  platformForm.password = ''
  platformForm.status = 'active'
  platformForm.remark = ''
  platformModalVisible.value = true
}

function editPlatform(record: any) {
  editingPlatform.value = record
  platformForm.name = record.name
  platformForm.type = record.type
  platformForm.apiUrl = record.apiUrl || ''
  platformForm.username = record.username || ''
  platformForm.password = ''
  platformForm.status = record.status || 'active'
  platformForm.remark = record.remark || ''
  platformModalVisible.value = true
}

async function handlePlatformModalOk() {
  if (!platformForm.name) {
    message.error('请输入平台名称')
    return
  }
  if (!platformForm.type) {
    message.error('请选择平台类型')
    return
  }
  platformSaving.value = true
  try {
    if (editingPlatform.value) {
      await publishConfigApi.updatePlatform(editingPlatform.value.id, platformForm)
      message.success('更新成功')
    } else {
      await publishConfigApi.createPlatform(platformForm)
      message.success('创建成功')
    }
    platformModalVisible.value = false
    await loadPlatforms()
  } catch (error) {
    console.error(error)
    message.error('操作失败')
  } finally {
    platformSaving.value = false
  }
}

function deletePlatform(record: any) {
  Modal.confirm({
    title: '确认删除',
    content: `确定删除发布平台「${record.name}」吗？删除后不可恢复。`,
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      try {
        await publishConfigApi.deletePlatform(record.id)
        message.success('删除成功')
        await loadPlatforms()
      } catch (error) {
        console.error(error)
        message.error('删除失败')
      }
    },
  })
}

async function testPlatform(record: any) {
  try {
    const res = await publishConfigApi.testPlatform(record.id) as any
    if (res?.success) {
      message.success('连接测试成功')
    } else {
      message.error(res?.message || '连接测试失败')
    }
  } catch (error) {
    console.error(error)
    message.error('连接测试失败')
  }
}

onMounted(() => {
  loadConfig()
  loadPlatforms()
})
</script>

<style scoped lang="less">
.publish-config-page {
  width: 100%;
  padding: 8px 0;
}

.switch-hint {
  margin-left: 12px;
  color: #8c8c8c;
  font-size: 13px;
}
</style>
