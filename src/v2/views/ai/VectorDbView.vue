<template>
  <div class="vector-db-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <DatabaseOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalDbs }}</div>
                <div class="stat-title">向量数据库</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <CloudServerOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.activeDbs }}</div>
                <div class="stat-title">已启用</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <SwapOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalDimensions }}</div>
                <div class="stat-title">向量维度</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <PartitionOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalCollections }}</div>
                <div class="stat-title">集合数</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <template #title>
          <a-space>
            <a-select
              v-model:value="filterType"
              style="width: 180px"
              placeholder="按类型筛选"
              allowClear
            >
              <a-select-option v-for="dbType in dbTypes" :key="dbType.id" :value="dbType.id">
                <span class="db-type-option">
                  <component :is="dbType.icon" style="margin-right: 8px" />
                  {{ dbType.name }}
                </span>
              </a-select-option>
            </a-select>
            <a-button type="primary" @click="showAddModal = true">
              <template #icon><PlusOutlined /></template>
              添加数据库
            </a-button>
          </a-space>
        </template>

        <a-table
          :columns="columns"
          :data-source="filteredDbs"
          :pagination="false"
          :row-key="record => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'type'">
              <a-tag :color="getDbTypeColor(record.type)">
                <component :is="getDbTypeIcon(record.type)" style="margin-right: 4px" />
                {{ getDbTypeName(record.type) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'metricType'">
              <a-tag color="blue">{{ getMetricName(record.metricType) }}</a-tag>
            </template>
            <template v-if="column.key === 'isDefault'">
              <a-badge v-if="record.isSystemDefault" status="success" text="默认" />
              <span v-else>-</span>
            </template>
            <template v-if="column.key === 'isActive'">
              <a-switch
                v-model:checked="record.isActive"
                :loading="togglingId === record.id"
                @change="toggleDbStatus(record)"
              />
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="testConnection(record)" :loading="testingId === record.id">
                  <ThunderboltOutlined /> 测试
                </a-button>
                <a-button type="link" size="small" @click="editDb(record)">编辑</a-button>
                <a-popconfirm
                  title="确定要删除此配置吗？"
                  @confirm="deleteDb(record.id)"
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
      v-model:open="showAddModal"
      :title="editingDb ? '编辑向量数据库' : '添加向量数据库'"
      @ok="handleSaveDb"
      :confirm-loading="saving"
      width="700px"
    >
      <a-form layout="vertical" :model="dbForm">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="配置名称" required>
              <a-input v-model:value="dbForm.name" placeholder="例如：Milvus-知识库向量库" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="数据库类型" required>
              <a-select v-model:value="dbForm.type" style="width: 100%" placeholder="选择数据库类型">
                <a-select-option v-for="dbType in dbTypes" :key="dbType.id" :value="dbType.id">
                  <span class="db-type-option">
                    <component :is="dbType.icon" style="margin-right: 8px" />
                    {{ dbType.name }}
                  </span>
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">连接配置</a-divider>

        <a-row :gutter="16" v-if="dbForm.type === 'milvus' || dbForm.type === 'chroma'">
          <a-col :span="12">
            <a-form-item label="主机地址" required>
              <a-input v-model:value="dbForm.host" placeholder="例如：localhost" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="端口" required>
              <a-input-number v-model:value="dbForm.port" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16" v-if="dbForm.type === 'pgvector'">
          <a-col :span="12">
            <a-form-item label="主机地址" required>
              <a-input v-model:value="dbForm.host" placeholder="例如：localhost" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="端口" required>
              <a-input-number v-model:value="dbForm.port" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="数据库名" required>
              <a-input v-model:value="dbForm.database" placeholder="例如：vector_db" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Schema">
              <a-input v-model:value="dbForm.schema" placeholder="默认：public" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16" v-if="dbForm.type === 'pinecone' || dbForm.type === 'weaviate'">
          <a-col :span="24">
            <a-form-item label="Endpoint" required>
              <a-input v-model:value="dbForm.endpoint" placeholder="云服务 Endpoint" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="API Key" required>
              <a-input-password v-model:value="dbForm.apiKey" placeholder="输入 API Key" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12" v-if="dbForm.type === 'pgvector'">
            <a-form-item label="用户名">
              <a-input v-model:value="dbForm.username" placeholder="数据库用户名" />
            </a-form-item>
          </a-col>
          <a-col :span="12" v-if="dbForm.type === 'pgvector'">
            <a-form-item label="密码">
              <a-input-password v-model:value="dbForm.password" placeholder="数据库密码" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">向量配置</a-divider>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="向量维度" required>
              <a-select v-model:value="dbForm.dimension" style="width: 100%">
                <a-select-option :value="768">768 (text-embedding-ada-002)</a-select-option>
                <a-select-option :value="1024">1024 (text-embedding-v2)</a-select-option>
                <a-select-option :value="1536">1536 (text-embedding-3-large)</a-select-option>
                <a-select-option :value="2048">2048</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="相似度算法" required>
              <a-select v-model:value="dbForm.metricType" style="width: 100%">
                <a-select-option value="cosine">余弦相似度 (Cosine)</a-select-option>
                <a-select-option value="euclidean">欧氏距离 (Euclidean)</a-select-option>
                <a-select-option value="dot_product">点积 (Dot Product)</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="索引类型">
              <a-select v-model:value="dbForm.indexType" style="width: 100%">
                <a-select-option value="HNSW">HNSW (高性能)</a-select-option>
                <a-select-option value="IVF_FLAT">IVF_FLAT (高准确率)</a-select-option>
                <a-select-option value="IVF_PQ">IVF_PQ (高压缩)</a-select-option>
                <a-select-option value="FLAT">FLAT (暴力搜索)</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">索引参数</a-divider>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="nlist (聚类中心数量)">
              <a-input-number v-model:value="dbForm.nlist" :min="1" :max="65536" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="ef_construction (建图精度)">
              <a-input-number v-model:value="dbForm.efConstruction" :min="1" :max="512" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="ef_search (搜索精度)">
              <a-input-number v-model:value="dbForm.efSearch" :min="1" :max="512" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="默认集合名">
              <a-input v-model:value="dbForm.collection" placeholder="例如：knowledge_base" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="启用状态">
              <a-switch v-model:checked="dbForm.isActive" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  DatabaseOutlined,
  CloudServerOutlined,
  SwapOutlined,
  PartitionOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  BlockOutlined,
  FolderOutlined,
} from '@ant-design/icons-vue'
import { vectorDbApi } from '../../api/ai-model'
import type { VectorDatabaseConfig } from '../../types/ai-model'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const getTenantId = () => authStore.selectedTenantId || authStore.tenantId || 1

const loading = ref(false)
const saving = ref(false)
const testingId = ref<number | null>(null)
const togglingId = ref<number | null>(null)

const showAddModal = ref(false)
const editingDb = ref<VectorDatabaseConfig | null>(null)

const filterType = ref<string | null>(null)

const dbConfigs = ref<VectorDatabaseConfig[]>([])

const stats = computed(() => ({
  totalDbs: dbConfigs.value.length,
  activeDbs: dbConfigs.value.filter(c => c.isActive).length,
  totalDimensions: new Set(dbConfigs.value.map(c => c.dimension)).size,
  totalCollections: dbConfigs.value.filter(c => c.collection).length,
}))

const dbTypes = [
  { id: 'milvus', name: 'Milvus', icon: DatabaseOutlined },
  { id: 'pgvector', name: 'PGVector', icon: CloudServerOutlined },
  { id: 'chroma', name: 'Chroma', icon: BlockOutlined },
  { id: 'pinecone', name: 'Pinecone', icon: ApiOutlined },
  { id: 'weaviate', name: 'Weaviate', icon: FolderOutlined },
]

const dbForm = reactive({
  name: '',
  type: '',
  host: '',
  port: 19530,
  endpoint: '',
  apiKey: '',
  username: '',
  password: '',
  database: '',
  schema: '',
  collection: '',
  dimension: 1024,
  metricType: 'cosine',
  indexType: 'HNSW',
  nlist: 1024,
  efConstruction: 256,
  efSearch: 128,
  isActive: true,
})

const columns = [
  { title: '配置名称', dataIndex: 'name', key: 'name', width: 220 },
  { title: '类型', key: 'type', width: 140 },
  { title: '主机/Endpoint', key: 'host', width: 200, customRender: ({ record }: { record: VectorDatabaseConfig }) => record.host || record.endpoint || '-' },
  { title: '端口', dataIndex: 'port', key: 'port', width: 100 },
  { title: '向量维度', dataIndex: 'dimension', key: 'dimension', width: 100 },
  { title: '距离算法', key: 'metricType', width: 120 },
  { title: '默认', key: 'isDefault', width: 80, align: 'center' as const },
  { title: '状态', key: 'isActive', width: 100, align: 'center' as const },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 200 },
]

const filteredDbs = computed(() => {
  let result = dbConfigs.value
  if (filterType.value) {
    result = result.filter(c => c.type === filterType.value)
  }
  return result
})

function getDbTypeIcon(type: string) {
  const map: Record<string, any> = {
    milvus: DatabaseOutlined,
    pgvector: CloudServerOutlined,
    chroma: BlockOutlined,
    pinecone: ApiOutlined,
    weaviate: FolderOutlined,
  }
  return map[type] || DatabaseOutlined
}

function getDbTypeColor(type: string) {
  const map: Record<string, string> = {
    milvus: 'blue',
    pgvector: 'green',
    chroma: 'purple',
    pinecone: 'orange',
    weaviate: 'cyan',
  }
  return map[type] || 'default'
}

function getDbTypeName(type: string) {
  const map: Record<string, string> = {
    milvus: 'Milvus',
    pgvector: 'PGVector',
    chroma: 'Chroma',
    pinecone: 'Pinecone',
    weaviate: 'Weaviate',
  }
  return map[type] || type
}

function getMetricName(metric: string) {
  const map: Record<string, string> = {
    cosine: '余弦相似度',
    euclidean: '欧氏距离',
    dot_product: '点积',
  }
  return map[metric] || metric
}

function editDb(config: VectorDatabaseConfig) {
  editingDb.value = config
  Object.assign(dbForm, {
    name: config.name,
    type: config.type,
    host: config.host || '',
    port: config.port || 19530,
    endpoint: config.endpoint || '',
    apiKey: config.apiKey || '',
    username: config.username || '',
    password: config.password || '',
    database: config.database || '',
    schema: config.schema || '',
    collection: config.collection || '',
    dimension: config.dimension || 1024,
    metricType: config.metricType || 'cosine',
    indexType: config.indexType || 'HNSW',
    nlist: config.nlist || 1024,
    efConstruction: config.efConstruction || 256,
    efSearch: config.efSearch || 128,
    isActive: config.isActive,
  })
  showAddModal.value = true
}

async function toggleDbStatus(config: VectorDatabaseConfig) {
  togglingId.value = config.id
  try {
    await vectorDbApi.toggleStatus(config.id)
    message.success('状态切换成功')
  } catch (error) {
    console.error(error)
    config.isActive = !config.isActive
    message.error('状态切换失败')
  } finally {
    togglingId.value = null
  }
}

async function testConnection(config: VectorDatabaseConfig) {
  testingId.value = config.id
  try {
    const result = await vectorDbApi.test(config.id)
    if (result.success) {
      message.success('连接成功！')
    } else {
      message.error(`连接失败：${result.message}`)
    }
  } catch (error) {
    console.error(error)
    message.error('连接测试失败')
  } finally {
    testingId.value = null
  }
}

async function deleteDb(id: number) {
  try {
    await vectorDbApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error) {
    console.error(error)
    message.error('删除失败')
  }
}

async function handleSaveDb() {
  if (!dbForm.name || !dbForm.type) {
    message.error('请填写必填字段')
    return
  }

  const needsHost = ['milvus', 'pgvector', 'chroma'].includes(dbForm.type)
  const needsEndpoint = ['pinecone', 'weaviate'].includes(dbForm.type)

  if (needsHost && !dbForm.host) {
    message.error('请填写主机地址')
    return
  }
  if (needsEndpoint && !dbForm.endpoint) {
    message.error('请填写 Endpoint')
    return
  }

  saving.value = true
  try {
    if (editingDb.value) {
      await vectorDbApi.update(editingDb.value.id, dbForm as any)
      message.success('更新成功')
    } else {
      await vectorDbApi.create(getTenantId(), dbForm as any)
      message.success('创建成功')
    }
    showAddModal.value = false
    await loadData()
  } catch (error) {
    console.error(error)
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    const result = await vectorDbApi.list(getTenantId())
    dbConfigs.value = result
  } catch (error) {
    console.error('加载向量数据库配置失败:', error)
    message.error('加载向量数据库配置失败')
    dbConfigs.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.vector-db-page {
  width: 100%;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.db-type-option {
  display: flex;
  align-items: center;
}
</style>
