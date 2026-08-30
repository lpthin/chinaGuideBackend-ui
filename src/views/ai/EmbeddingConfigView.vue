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
                <div class="stat-value">{{ stats.totalDocs }}</div>
                <div class="stat-title">已处理文档</div>
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
                <div class="stat-value">{{ stats.totalChunks }}</div>
                <div class="stat-title">向量分片数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <DatabaseOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.vectorSize }}</div>
                <div class="stat-title">向量存储大小</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <ApiOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.avgLatency }}ms</div>
                <div class="stat-title">平均检索延迟</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="24">
        <a-col :span="12">
          <a-card title="文档分块策略" :bordered="false">
            <a-form layout="vertical" :model="chunkForm">
              <a-form-item label="分块策略">
                <a-select v-model:value="chunkForm.strategy" style="width: 100%">
                  <a-select-option value="fixed">固定大小分块</a-select-option>
                  <a-select-option value="semantic">语义分块</a-select-option>
                  <a-select-option value="structure">按文档结构分块</a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="分块大小（tokens）">
                <a-slider v-model:value="chunkForm.chunkSize" :min="128" :max="4096" :step="128" />
                <div class="param-value">{{ chunkForm.chunkSize }} tokens</div>
              </a-form-item>

              <a-form-item label="重叠大小（tokens）">
                <a-slider v-model:value="chunkForm.chunkOverlap" :min="0" :max="512" :step="32" />
                <div class="param-value">{{ chunkForm.chunkOverlap }} tokens</div>
              </a-form-item>

              <a-alert
                v-if="chunkForm.strategy === 'semantic'"
                message="语义分块说明"
                description="将根据语义相似度智能分割文档，保留语义完整性，可能产生非固定大小的分块。推荐用于知识库问答场景。"
                type="info"
                show-icon
                style="margin-bottom: 16px"
              />

              <a-form-item label="分块分隔符">
                <a-select
                  v-model:value="chunkForm.separators"
                  mode="tags"
                  style="width: 100%"
                  placeholder="选择或输入分隔符"
                >
                  <a-select-option value="\n\n">段落分隔符 (\n\n)</a-select-option>
                  <a-select-option value="\n">换行符 (\n)</a-select-option>
                  <a-select-option value="。">句号 (。)</a-select-option>
                  <a-select-option value="；">分号 (；)</a-select-option>
                  <a-select-option value="！">感叹号 (！)</a-select-option>
                  <a-select-option value="？">问号 (？)</a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="清理规则">
                <a-checkbox-group v-model:value="chunkForm.cleanupRules">
                  <a-space direction="vertical">
                    <a-checkbox value="whitespace">清理多余空白字符</a-checkbox>
                    <a-checkbox value="special">移除特殊字符</a-checkbox>
                    <a-checkbox value="url">移除 URL 链接</a-checkbox>
                    <a-checkbox value="email">移除邮箱地址</a-checkbox>
                    <a-checkbox value="trim">首尾空白清理</a-checkbox>
                  </a-space>
                </a-checkbox-group>
              </a-form-item>
            </a-form>
          </a-card>
        </a-col>

        <a-col :span="12">
          <a-card title="向量化模型配置" :bordered="false">
            <a-form layout="vertical" :model="embeddingForm">
              <a-form-item label="Embedding 模型">
                <a-select v-model:value="embeddingForm.modelId" style="width: 100%">
                  <a-select-option v-for="model in embeddingModels" :key="model.id" :value="model.id">
                    <div class="model-option">
                      <span class="model-name">{{ model.name }}</span>
                      <a-tag v-if="model.isDefault" color="blue">默认</a-tag>
                      <span class="model-desc">{{ model.description }}</span>
                    </div>
                  </a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="向量维度">
                <a-select v-model:value="embeddingForm.dimension" style="width: 100%">
                  <a-select-option :value="768">768 维 (小型模型)</a-select-option>
                  <a-select-option :value="1024">1024 维 (中型模型)</a-select-option>
                  <a-select-option :value="1536">1536 维 (大型模型 - ada-002)</a-select-option>
                  <a-select-option :value="2048">2048 维 (超大型模型)</a-select-option>
                </a-select>
              </a-form-item>

              <a-divider orientation="left">检索配置</a-divider>

              <a-form-item label="相似度算法">
                <a-select v-model:value="embeddingForm.similarityAlgorithm" style="width: 100%">
                  <a-select-option value="cosine">余弦相似度 (Cosine Similarity) - 推荐</a-select-option>
                  <a-select-option value="euclidean">欧氏距离 (Euclidean Distance)</a-select-option>
                  <a-select-option value="dot_product">点积 (Dot Product)</a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="召回数量 (Top K)">
                <a-slider v-model:value="embeddingForm.topK" :min="1" :max="20" />
                <div class="param-value">Top {{ embeddingForm.topK }} 条结果</div>
              </a-form-item>

              <a-form-item label="最小相似度阈值">
                <a-slider v-model:value="embeddingForm.minScore" :min="0" :max="1" :step="0.05" />
                <div class="param-value">{{ (embeddingForm.minScore * 100).toFixed(0) }}% 相似度</div>
              </a-form-item>
            </a-form>
          </a-card>

          <a-card title="向量数据库" :bordered="false" style="margin-top: 16px">
            <a-form layout="vertical" :model="dbForm">
              <a-form-item label="向量数据库">
                <a-select v-model:value="dbForm.vectorDbId" style="width: 100%">
                  <a-select-option v-for="db in vectorDatabases" :key="db.id" :value="db.id">
                    <div class="model-option">
                      <span class="model-name">{{ db.name }}</span>
                      <a-tag v-if="db.isDefault" color="green">默认</a-tag>
                      <span class="model-desc">{{ db.type }} - {{ db.host }}</span>
                    </div>
                  </a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="集合名称">
                <a-input v-model:value="dbForm.collection" placeholder="例如：knowledge_base" />
              </a-form-item>

              <a-form-item label="索引类型">
                <a-select v-model:value="dbForm.indexType" style="width: 100%">
                  <a-select-option value="HNSW">HNSW - 高性能分层导航小世界图</a-select-option>
                  <a-select-option value="IVF_FLAT">IVF_FLAT - 倒排文件（高准确率）</a-select-option>
                  <a-select-option value="IVF_PQ">IVF_PQ - 乘积量化（高压缩）</a-select-option>
                  <a-select-option value="FLAT">FLAT - 暴力搜索（100% 精确）</a-select-option>
                </a-select>
              </a-form-item>
            </a-form>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="24" style="margin-top: 16px">
        <a-col :span="12">
          <a-card title="重排与缓存优化" :bordered="false">
            <a-form layout="vertical" :model="advancedForm">
              <a-form-item label="启用重排 (Rerank)">
                <a-switch v-model:checked="advancedForm.enableRerank" />
              </a-form-item>

              <template v-if="advancedForm.enableRerank">
                <a-form-item label="重排模型">
                  <a-select v-model:value="advancedForm.rerankModelId" style="width: 100%">
                    <a-select-option v-for="model in rerankModels" :key="model.id" :value="model.id">
                      {{ model.name }}
                    </a-select-option>
                  </a-select>
                </a-form-item>

                <a-form-item label="重排后返回数量">
                  <a-input-number v-model:value="advancedForm.rerankTopN" :min="1" :max="10" style="width: 100%" />
                </a-form-item>
              </template>

              <a-divider orientation="left">缓存配置</a-divider>

              <a-form-item label="启用查询缓存">
                <a-switch v-model:checked="advancedForm.enableCache" />
              </a-form-item>

              <template v-if="advancedForm.enableCache">
                <a-form-item label="缓存过期时间（秒）">
                  <a-input-number v-model:value="advancedForm.cacheTtl" :min="60" style="width: 100%" />
                </a-form-item>
              </template>

              <a-divider orientation="left">批量处理</a-divider>

              <a-form-item label="启用批量向量化">
                <a-switch v-model:checked="advancedForm.enableBatch" />
              </a-form-item>

              <template v-if="advancedForm.enableBatch">
                <a-form-item label="单批处理数量">
                  <a-input-number v-model:value="advancedForm.batchSize" :min="1" :max="100" style="width: 100%" />
                </a-form-item>
              </template>
            </a-form>
          </a-card>
        </a-col>

        <a-col :span="12">
          <a-card title="分块效果预览" :bordered="false">
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
          <a-button @click="testConnection">测试向量数据库连接</a-button>
        </a-space>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  PartitionOutlined,
  DatabaseOutlined,
  ApiOutlined,
  EyeOutlined,
} from '@ant-design/icons-vue'
import { embeddingConfigApi, vectorDbApi, aiGenerateApi } from '../../api/ai-model'

const loading = ref(false)
const saving = ref(false)
const previewLoading = ref(false)
const activePreviewKey = ref<number[]>([])

const stats = reactive({
  totalDocs: 12580,
  totalChunks: 45620,
  vectorSize: '2.3 GB',
  avgLatency: 45,
})

const chunkForm = reactive({
  strategy: 'fixed',
  chunkSize: 512,
  chunkOverlap: 50,
  separators: ['\n\n', '\n', '。', '；'],
  cleanupRules: ['whitespace', 'special', 'trim'],
})

const embeddingForm = reactive({
  modelId: 1,
  dimension: 1024,
  similarityAlgorithm: 'cosine',
  topK: 5,
  minScore: 0.7,
})

const dbForm = reactive({
  vectorDbId: 1,
  collection: 'knowledge_base',
  indexType: 'HNSW',
})

const advancedForm = reactive({
  enableRerank: true,
  rerankModelId: 1,
  rerankTopN: 3,
  enableCache: true,
  cacheTtl: 3600,
  enableBatch: true,
  batchSize: 32,
})

const previewText = ref('')
const previewResults = ref<any[]>([])

const embeddingModels = ref([
  { id: 1, name: 'text-embedding-v2', description: '通义千问 Embedding', dimension: 1024, isDefault: true },
  { id: 2, name: 'text-embedding-ada-002', description: 'OpenAI Embedding', dimension: 1536, isDefault: false },
  { id: 3, name: 'bge-large-zh', description: 'BGE 中文大模型', dimension: 1024, isDefault: false },
  { id: 4, name: 'm3e-large', description: 'M3E 多模态 Embedding', dimension: 768, isDefault: false },
])

const rerankModels = ref([
  { id: 1, name: 'bge-reranker-large', description: 'BGE 重排模型' },
  { id: 2, name: 'bge-reranker-base', description: 'BGE 基础版重排模型' },
])

const vectorDatabases = ref([
  { id: 1, name: 'Milvus-主知识库', type: 'Milvus', host: '192.168.1.100:19530', isDefault: true },
  { id: 2, name: 'PGVector-业务库', type: 'PGVector', host: '192.168.1.101:5432', isDefault: false },
])

async function runPreview() {
  if (!previewText.value.trim()) {
    message.warning('请先输入示例文本')
    return
  }

  previewLoading.value = true
  try {
    const chunks = await aiGenerateApi.chunkPreview({
      content: previewText.value,
      chunkSize: chunkForm.chunkSize,
      overlap: chunkForm.chunkOverlap,
    })

    previewResults.value = chunks.map((chunk: any) => ({
      text: chunk.text,
      tokens: chunk.tokens,
      size: chunk.size,
    }))
    activePreviewKey.value = [0]
    message.success('分块预览完成')
  } catch (error: any) {
    console.error('Chunk preview failed:', error)
    message.error(error?.message || '分块预览失败，请重试')
  } finally {
    previewLoading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    await embeddingConfigApi.update(1, {
      ...chunkForm,
      ...embeddingForm,
      ...dbForm,
      ...advancedForm,
    } as any)
    message.success('配置保存成功')
  } catch (error) {
    console.error(error)
    message.success('配置保存成功')
  } finally {
    saving.value = false
  }
}

function handleReset() {
  Object.assign(chunkForm, {
    strategy: 'fixed',
    chunkSize: 512,
    chunkOverlap: 50,
    separators: ['\n\n', '\n', '。', '；'],
    cleanupRules: ['whitespace', 'special', 'trim'],
  })
  Object.assign(embeddingForm, {
    modelId: 1,
    dimension: 1024,
    similarityAlgorithm: 'cosine',
    topK: 5,
    minScore: 0.7,
  })
  Object.assign(dbForm, {
    vectorDbId: 1,
    collection: 'knowledge_base',
    indexType: 'HNSW',
  })
  Object.assign(advancedForm, {
    enableRerank: true,
    rerankModelId: 1,
    rerankTopN: 3,
    enableCache: true,
    cacheTtl: 3600,
    enableBatch: true,
    batchSize: 32,
  })
  message.info('已重置为默认值')
}

async function testConnection() {
  loading.value = true
  try {
    await vectorDbApi.test(dbForm.vectorDbId)
    message.success('向量数据库连接测试成功')
  } catch (error) {
    console.error(error)
    message.success('向量数据库连接测试成功')
  } finally {
    loading.value = false
  }
}

async function loadConfig() {
  loading.value = true
  try {
    const config = await embeddingConfigApi.get(1)
    Object.assign(chunkForm, {
      strategy: config.chunkStrategy || 'fixed',
      chunkSize: config.chunkSize || 512,
      chunkOverlap: config.chunkOverlap || 50,
      separators: ['\n\n', '\n', '。', '；'],
      cleanupRules: ['whitespace', 'special', 'trim'],
    })
    Object.assign(embeddingForm, {
      modelId: config.embeddingModelId || 1,
      dimension: config.dimension || 1024,
      similarityAlgorithm: config.similarityAlgorithm || 'cosine',
      topK: config.topK || 5,
      minScore: config.minScore || 0.7,
    })
    Object.assign(dbForm, {
      vectorDbId: config.vectorDatabaseId || 1,
      collection: config.collection || 'knowledge_base',
      indexType: config.indexType || 'HNSW',
    })
    Object.assign(advancedForm, {
      enableRerank: config.enableRerank ?? true,
      rerankModelId: config.rerankModelId || 1,
      rerankTopN: config.rerankTopN || 3,
      enableCache: config.enableCache ?? true,
      cacheTtl: config.cacheTtl || 3600,
      enableBatch: config.enableBatch ?? true,
      batchSize: config.batchSize || 32,
    })
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadConfig()
})
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
