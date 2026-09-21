<template>
  <div class="embedding-config-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.processedDocs }}</div>
                <div class="stat-title">已向量化文档</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <PartitionOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.vectorChunks }}</div>
                <div class="stat-title">向量分片数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <RobotOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value model-value">{{ currentModelName }}</div>
                <div class="stat-title">Embedding 模型</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <DatabaseOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ form.dimension || '-' }}</div>
                <div class="stat-title">向量维度</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="24">
        <a-col :span="12">
          <a-card title="文档分块策略" :bordered="false">
            <a-form layout="vertical" :model="form">
              <a-form-item label="分块策略">
                <a-select v-model:value="form.chunkStrategy" style="width: 100%">
                  <a-select-option value="fixed">固定大小分块</a-select-option>
                  <a-select-option value="semantic">语义分块</a-select-option>
                  <a-select-option value="structure">按文档结构分块</a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="分块大小（tokens）">
                <a-slider v-model:value="form.chunkSize" :min="128" :max="4096" :step="128" />
                <div class="param-value">{{ form.chunkSize }} tokens</div>
              </a-form-item>

              <a-form-item label="重叠大小（tokens）">
                <a-slider v-model:value="form.chunkOverlap" :min="0" :max="512" :step="32" />
                <div class="param-value">{{ form.chunkOverlap }} tokens</div>
              </a-form-item>

              <a-form-item label="分块分隔符">
                <a-select v-model:value="form.separator" style="width: 100%">
                  <a-select-option value="\n\n">段落分隔符 (\n\n)</a-select-option>
                  <a-select-option value="\n">换行符 (\n)</a-select-option>
                  <a-select-option value="。">句号 (。)</a-select-option>
                  <a-select-option value="；">分号 (；)</a-select-option>
                  <a-select-option value="！">感叹号 (！)</a-select-option>
                  <a-select-option value="？">问号 (？)</a-select-option>
                </a-select>
              </a-form-item>

              <a-alert
                v-if="form.chunkStrategy === 'semantic'"
                message="语义分块说明"
                description="将根据语义相似度智能分割文档，保留语义完整性，可能产生非固定大小的分块。推荐用于知识库问答场景。"
                type="info"
                show-icon
              />
            </a-form>
          </a-card>

          <a-card title="向量数据库连接" :bordered="false" style="margin-top: 16px">
            <a-form layout="vertical" :model="form">
              <a-form-item>
                <template #label>
                  <a-space>
                    <span>连接配置</span>
                    <a-button type="link" size="small" style="padding: 0" @click="openConnModal">
                      <SettingOutlined /> 管理连接
                    </a-button>
                  </a-space>
                </template>
                <a-select v-model:value="form.vectorDbId" style="width: 100%" placeholder="选择向量库连接" allow-clear>
                  <a-select-option v-for="db in connections" :key="db.id" :value="db.id">
                    <div class="model-option">
                      <span class="model-name">
                        {{ db.name }}
                        <a-tag v-if="db.isDefault" color="green" style="margin-left: 6px">默认</a-tag>
                      </span>
                      <span class="model-desc">{{ db.dbType }} - {{ db.host || db.endpoint || '-' }}</span>
                    </div>
                  </a-select-option>
                </a-select>
                <a-button size="small" style="margin-top: 8px" @click="testSelectedConnection">
                  <ThunderboltOutlined /> 测试当前连接
                </a-button>
              </a-form-item>

              <a-form-item label="集合名称">
                <a-input v-model:value="form.collectionName" placeholder="例如：knowledge_base" />
              </a-form-item>

              <a-form-item label="索引类型">
                <a-select v-model:value="form.indexType" style="width: 100%">
                  <a-select-option value="HNSW">HNSW - 高性能分层导航小世界图</a-select-option>
                  <a-select-option value="IVF_FLAT">IVF_FLAT - 倒排文件（高准确率）</a-select-option>
                  <a-select-option value="IVF_PQ">IVF_PQ - 乘积量化（高压缩）</a-select-option>
                  <a-select-option value="FLAT">FLAT - 暴力搜索（100% 精确）</a-select-option>
                </a-select>
              </a-form-item>
            </a-form>
          </a-card>
        </a-col>

        <a-col :span="12">
          <a-card title="向量化模型配置" :bordered="false">
            <a-form layout="vertical" :model="form">
              <a-form-item label="Embedding 模型">
                <a-select v-model:value="form.embeddingModelId" style="width: 100%" placeholder="选择已配置的 Embedding 模型" allow-clear>
                  <a-select-option v-for="model in embeddingModels" :key="model.id" :value="model.id">
                    <div class="model-option">
                      <span class="model-name">
                        {{ model.modelName || model.name }}
                        <a-tag v-if="model.isDefault" color="blue" style="margin-left: 6px">默认</a-tag>
                      </span>
                      <span class="model-desc">{{ model.provider }} · {{ model.name }}</span>
                    </div>
                  </a-select-option>
                </a-select>
                <div v-if="!embeddingModels.length" class="empty-hint">
                  暂无 Embedding 类型模型，请先在「大模型配置」中创建。
                </div>
              </a-form-item>

              <a-form-item label="向量维度">
                <a-select v-model:value="form.dimension" style="width: 100%">
                  <a-select-option :value="768">768 维 (小型模型)</a-select-option>
                  <a-select-option :value="1024">1024 维 (bge-m3 / text-embedding-v2)</a-select-option>
                  <a-select-option :value="1536">1536 维 (ada-002)</a-select-option>
                  <a-select-option :value="2048">2048 维 (超大型模型)</a-select-option>
                </a-select>
              </a-form-item>

              <a-divider orientation="left">检索配置</a-divider>

              <a-form-item label="相似度算法">
                <a-select v-model:value="form.similarityMetric" style="width: 100%">
                  <a-select-option value="cosine">余弦相似度 (Cosine Similarity) - 推荐</a-select-option>
                  <a-select-option value="euclidean">欧氏距离 (Euclidean Distance)</a-select-option>
                  <a-select-option value="dot_product">点积 (Dot Product)</a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="召回数量 (Top K)">
                <a-slider v-model:value="form.topK" :min="1" :max="20" />
                <div class="param-value">Top {{ form.topK }} 条结果</div>
              </a-form-item>

              <a-form-item label="最小相似度阈值">
                <a-slider v-model:value="form.minScore" :min="0" :max="1" :step="0.05" />
                <div class="param-value">{{ (form.minScore * 100).toFixed(0) }}% 相似度</div>
              </a-form-item>
            </a-form>
          </a-card>

          <a-card title="分块效果预览" :bordered="false" style="margin-top: 16px">
            <a-textarea
              v-model:value="previewText"
              :rows="6"
              placeholder="在此粘贴示例文本，查看分块效果..."
              style="margin-bottom: 16px"
            />
            <a-button type="primary" @click="runPreview" :loading="previewLoading">
              <EyeOutlined /> 预览分块效果
            </a-button>

            <div v-if="previewResults.length" style="margin-top: 16px">
              <a-statistic
                title="预计分块数量"
                :value="previewResults.length"
                style="margin-bottom: 16px; display: inline-block"
              />
              <a-collapse v-model:activeKey="activePreviewKey">
                <a-collapse-panel
                  v-for="(chunk, index) in previewResults"
                  :key="index"
                  :header="'分块 ' + (index + 1) + ' (' + chunk.tokens + ' tokens)'"
                >
                  <p style="white-space: pre-wrap; margin: 0">{{ chunk.text }}</p>
                </a-collapse-panel>
              </a-collapse>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <div class="action-bar">
        <a-space>
          <a-button @click="handleReset">重置为默认值</a-button>
          <a-button type="primary" :loading="saving" @click="handleSave">保存配置</a-button>
        </a-space>
      </div>
    </a-spin>

    <a-modal v-model:open="connModalVisible" title="向量数据库连接管理" :footer="null" width="860px">
      <div style="margin-bottom: 12px; text-align: right">
        <a-button type="primary" size="small" @click="openConnForm()">
          <PlusOutlined /> 添加连接
        </a-button>
      </div>
      <a-table
        :scroll="{ x: 'max-content' }"
        :columns="connColumns"
        :data-source="connections"
        :pagination="false"
        size="small"
        :row-key="(record: VectorDatabaseConfig) => record.id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'address'">
            {{ record.host ? `${record.host}:${record.port ?? '-'}` : record.endpoint || '-' }}
          </template>
          <template v-if="column.key === 'isDefault'">
            <a-badge v-if="record.isDefault" status="success" text="默认" />
            <span v-else>-</span>
          </template>
          <template v-if="column.key === 'isActive'">
            <a-switch
              v-model:checked="record.isActive"
              :loading="togglingId === record.id"
              @change="toggleConnStatus(record)"
            />
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button type="link" size="small" :loading="testingId === record.id" @click="testConnection(record.id)">测试</a-button>
              <a-button type="link" size="small" @click="openConnForm(record)">编辑</a-button>
              <a-button v-if="!record.isDefault" type="link" size="small" @click="setDefaultConn(record.id)">设为默认</a-button>
              <a-popconfirm title="确定要删除此连接吗？" @confirm="deleteConn(record.id)">
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-modal>

    <a-modal
      v-model:open="connFormVisible"
      :title="editingConnId ? '编辑连接' : '添加连接'"
      :confirm-loading="connSaving"
      @ok="handleSaveConn"
      width="640px"
    >
      <a-form layout="vertical" :model="connForm">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="配置名称" required>
              <a-input v-model:value="connForm.name" placeholder="例如：Milvus-主知识库" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="数据库类型" required>
              <a-select v-model:value="connForm.dbType" style="width: 100%" placeholder="选择类型">
                <a-select-option value="milvus">Milvus</a-select-option>
                <a-select-option value="pgvector">PGVector</a-select-option>
                <a-select-option value="chroma">Chroma</a-select-option>
                <a-select-option value="pinecone">Pinecone</a-select-option>
                <a-select-option value="weaviate">Weaviate</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="主机地址">
              <a-input v-model:value="connForm.host" placeholder="例如：192.168.1.100" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="端口">
              <a-input-number v-model:value="connForm.port" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="Endpoint（云服务地址，与主机/端口二选一）">
          <a-input v-model:value="connForm.endpoint" placeholder="例如：https://api.pinecone.io" />
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="用户名">
              <a-input v-model:value="connForm.username" placeholder="数据库用户名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="密码">
              <a-input-password v-model:value="connForm.password" placeholder="数据库密码" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="数据库名">
              <a-input v-model:value="connForm.databaseName" placeholder="例如：vector_db" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Schema">
              <a-input v-model:value="connForm.schemaName" placeholder="默认：public" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="API Key">
          <a-input-password v-model:value="connForm.apiKey" placeholder="输入 API Key" />
        </a-form-item>

        <a-form-item label="启用状态">
          <a-switch v-model:checked="connForm.isActive" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  PartitionOutlined,
  DatabaseOutlined,
  RobotOutlined,
  EyeOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { embeddingConfigApi, vectorDbApi, modelConfigApi, aiGenerateApi } from '../../api/ai-model'
import type { ModelConfig, VectorDatabaseConfig, EmbeddingConfigForm } from '../../types/ai-model'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const getTenantId = () => authStore.selectedTenantId || authStore.tenantId || 1

const loading = ref(false)
const saving = ref(false)
const previewLoading = ref(false)
const testingId = ref<number | null>(null)
const togglingId = ref<number | null>(null)
const activePreviewKey = ref<number[]>([])

const stats = reactive({
  processedDocs: 0,
  vectorChunks: 0,
})

function defaultForm(): EmbeddingConfigForm {
  return {
    chunkStrategy: 'fixed',
    chunkSize: 512,
    chunkOverlap: 50,
    separator: '\n\n',
    enableSemanticChunk: false,
    embeddingModelId: undefined,
    vectorDbId: undefined,
    dimension: 1024,
    similarityMetric: 'cosine',
    topK: 5,
    minScore: 0.7,
    collectionName: 'knowledge_base',
    indexType: 'HNSW',
  }
}

const form = reactive<EmbeddingConfigForm>(defaultForm())

const previewText = ref('')
const previewResults = ref<{ text: string; tokens: number; size: number }[]>([])

const embeddingModels = ref<ModelConfig[]>([])
const connections = ref<VectorDatabaseConfig[]>([])

const currentModelName = computed(() => {
  const model = embeddingModels.value.find(m => m.id === form.embeddingModelId)
  return model?.modelName || model?.name || '未配置'
})

// ===== 主配置加载/保存 =====

async function loadConfig() {
  const config = await embeddingConfigApi.get(getTenantId())
  Object.assign(form, defaultForm(), {
    chunkStrategy: config.chunkStrategy || 'fixed',
    chunkSize: config.chunkSize || 512,
    chunkOverlap: config.chunkOverlap ?? 50,
    separator: config.separator || '\n\n',
    embeddingModelId: config.embeddingModelId ?? undefined,
    vectorDbId: config.vectorDbId ?? undefined,
    dimension: config.dimension || 1024,
    similarityMetric: config.similarityMetric || 'cosine',
    topK: config.topK || 5,
    minScore: config.minScore != null ? Number(config.minScore) : 0.7,
    collectionName: config.collectionName || 'knowledge_base',
    indexType: config.indexType || 'HNSW',
  })
}

async function loadStats() {
  const result = await embeddingConfigApi.stats(getTenantId())
  stats.processedDocs = result.processedDocs
  stats.vectorChunks = result.vectorChunks
}

async function loadEmbeddingModels() {
  const result = await modelConfigApi.list({ tenantId: getTenantId(), page: 1, size: 100 })
  embeddingModels.value = (result.records || []).filter(
    m => ((m.modelType || '') as string).toLowerCase().includes('embedding')
  )
}

async function loadConnections() {
  connections.value = await vectorDbApi.list(getTenantId())
}

async function loadAll() {
  loading.value = true
  try {
    await Promise.all([loadConfig(), loadEmbeddingModels(), loadConnections(), loadStats()])
  } catch (error) {
    console.error('加载向量化配置失败:', error)
    message.error('加载向量化配置失败')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  const payload: EmbeddingConfigForm = {
    chunkStrategy: form.chunkStrategy,
    chunkSize: form.chunkSize,
    chunkOverlap: form.chunkOverlap,
    separator: form.separator,
    enableSemanticChunk: form.chunkStrategy === 'semantic',
    embeddingModelId: form.embeddingModelId,
    vectorDbId: form.vectorDbId,
    dimension: form.dimension,
    similarityMetric: form.similarityMetric,
    topK: form.topK,
    minScore: form.minScore,
    collectionName: form.collectionName,
    indexType: form.indexType,
  }
  saving.value = true
  try {
    await embeddingConfigApi.update(getTenantId(), payload)
    message.success('配置保存成功')
    await loadStats()
  } catch (error: any) {
    console.error('保存配置失败:', error)
    message.error(error?.message || '保存配置失败')
  } finally {
    saving.value = false
  }
}

function handleReset() {
  Object.assign(form, defaultForm())
  message.info('已重置为默认值（未保存）')
}

// ===== 连接测试 =====

async function testSelectedConnection() {
  if (!form.vectorDbId) {
    message.warning('请先选择一个向量数据库连接')
    return
  }
  await testConnection(form.vectorDbId)
}

async function testConnection(id: number) {
  testingId.value = id
  try {
    const result = await vectorDbApi.test(id)
    if (result.success) {
      message.success(result.message)
    } else {
      message.error(result.message)
    }
  } catch (error: any) {
    console.error('连接测试失败:', error)
    message.error(error?.message || '连接测试失败')
  } finally {
    testingId.value = null
  }
}

// ===== 连接管理弹窗 =====

const connModalVisible = ref(false)
const connFormVisible = ref(false)
const connSaving = ref(false)
const editingConnId = ref<number | null>(null)

const connColumns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '类型', dataIndex: 'dbType', key: 'dbType', width: 100 },
  { title: '地址', key: 'address', width: 180 },
  { title: '默认', key: 'isDefault', width: 70, align: 'center' as const },
  { title: '启用', key: 'isActive', width: 70, align: 'center' as const },
  { title: '操作', key: 'actions', width: 240 },
]

const connForm = reactive({
  name: '',
  dbType: 'milvus',
  host: '',
  port: 19530,
  endpoint: '',
  username: '',
  password: '',
  databaseName: '',
  schemaName: '',
  apiKey: '',
  isActive: true,
})

function openConnModal() {
  connModalVisible.value = true
  loadConnections().catch(() => message.error('加载连接列表失败'))
}

function openConnForm(record?: VectorDatabaseConfig) {
  editingConnId.value = record?.id ?? null
  Object.assign(connForm, {
    name: record?.name || '',
    dbType: record?.dbType || 'milvus',
    host: record?.host || '',
    port: record?.port ?? 19530,
    endpoint: record?.endpoint || '',
    username: record?.username || '',
    password: record?.password || '',
    databaseName: record?.databaseName || '',
    schemaName: record?.schemaName || '',
    apiKey: record?.apiKey || '',
    isActive: record?.isActive ?? true,
  })
  connFormVisible.value = true
}

async function handleSaveConn() {
  if (!connForm.name || !connForm.dbType) {
    message.error('请填写名称和类型')
    return
  }
  connSaving.value = true
  try {
    if (editingConnId.value) {
      await vectorDbApi.update(editingConnId.value, { ...connForm })
      message.success('连接已更新')
    } else {
      await vectorDbApi.create(getTenantId(), { ...connForm })
      message.success('连接已创建')
    }
    connFormVisible.value = false
    await loadConnections()
  } catch (error: any) {
    console.error('保存连接失败:', error)
    message.error(error?.message || '保存连接失败')
  } finally {
    connSaving.value = false
  }
}

async function toggleConnStatus(record: VectorDatabaseConfig) {
  togglingId.value = record.id
  try {
    await vectorDbApi.toggleStatus(record.id)
    message.success('状态已更新')
  } catch (error: any) {
    record.isActive = !record.isActive
    message.error(error?.message || '状态切换失败')
  } finally {
    togglingId.value = null
  }
}

async function setDefaultConn(id: number) {
  try {
    await vectorDbApi.setDefault(id)
    message.success('已设为默认连接')
    await loadConnections()
  } catch (error: any) {
    message.error(error?.message || '设置失败')
  }
}

async function deleteConn(id: number) {
  try {
    await vectorDbApi.delete(id)
    message.success('删除成功')
    if (form.vectorDbId === id) {
      form.vectorDbId = undefined
    }
    await loadConnections()
  } catch (error: any) {
    console.error(error)
    message.error(error?.message || '删除失败')
  }
}

// ===== 分块预览 =====

async function runPreview() {
  if (!previewText.value.trim()) {
    message.warning('请先输入示例文本')
    return
  }
  previewLoading.value = true
  try {
    const chunks = await aiGenerateApi.chunkPreview({
      content: previewText.value,
      chunkSize: form.chunkSize,
      overlap: form.chunkOverlap,
    })
    previewResults.value = chunks
    activePreviewKey.value = [0]
    message.success('分块预览完成')
  } catch (error: any) {
    console.error('分块预览失败:', error)
    message.error(error?.message || '分块预览失败，请重试')
  } finally {
    previewLoading.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped lang="less">
.embedding-config-page {
  width: 100%;
  padding-bottom: 80px;
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
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.2;
}

.model-value {
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.param-value {
  text-align: center;
  color: #1890ff;
  font-weight: 500;
  font-size: 14px;
  margin-top: 8px;
}

.model-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-name {
  font-weight: 500;
}

.model-desc {
  font-size: 12px;
  color: #8c8c8c;
}

.empty-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #fa8c16;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 240px;
  right: 0;
  background: #fff;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
  z-index: 100;
}
</style>
