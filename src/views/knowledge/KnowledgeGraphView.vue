<template>
  <div class="knowledge-graph-container">
    <a-page-header title="知识图谱" sub-title="可视化展示知识库中的实体与关系">
      <template #extra>
        <a-space>
          <a-button @click="showFilterPanel = !showFilterPanel">
            <template #icon><FilterOutlined /></template>
            筛选
          </a-button>
          <a-button @click="refreshGraph">
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
          <a-button @click="openExtractModal">
            <template #icon><FileTextOutlined /></template>
            从文档提取
          </a-button>
          <a-button type="primary" @click="rebuildGraph">
            <template #icon><BuildOutlined /></template>
            重建图谱
          </a-button>
        </a-space>
      </template>
    </a-page-header>

    <div class="content-wrapper">
      <a-row :gutter="16">
        <a-col :xs="24" :md="6" v-show="showFilterPanel">
          <a-card title="筛选条件" class="filter-card">
            <a-form layout="vertical">
              <a-form-item label="实体类型">
                <a-select v-model:value="selectedTypes" mode="multiple" placeholder="选择实体类型">
                  <a-select-option v-for="type in entityTypes" :key="type.value" :value="type.value">
                    <a-tag :color="type.color">{{ type.label }} ({{ type.count }})</a-tag>
                  </a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="关系类型">
                <a-select v-model:value="selectedRelationTypes" mode="multiple" placeholder="选择关系类型">
                  <a-select-option v-for="rel in relationTypes" :key="rel.value" :value="rel.value">
                    {{ rel.label }} ({{ rel.count }})
                  </a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="节点数量">
                <a-slider v-model:value="nodeLimit" :min="50" :max="500" :step="10" />
                <div class="slider-value">显示 {{ nodeLimit }} 个节点</div>
              </a-form-item>
              <a-form-item label="最小置信度">
                <a-slider v-model:value="minConfidence" :min="0" :max="100" :step="5" />
                <div class="slider-value">
                  {{ minConfidence > 0 ? `只画置信度 ≥ ${minConfidence}% 的实体与关系` : '不过滤（置信度多低都画）' }}
                </div>
              </a-form-item>
              <a-form-item>
                <a-space>
                  <a-button type="primary" block @click="applyFilter">应用筛选</a-button>
                  <a-button block @click="resetFilter">重置</a-button>
                </a-space>
              </a-form-item>
            </a-form>
          </a-card>

          <a-card title="统计概览" class="stats-card" style="margin-top: 16px">
            <a-statistic title="实体总数" :value="statsReady ? stats.totalEntities : '—'" :value-style="{ color: '#1890ff' }">
              <template #prefix><NodeIndexOutlined /></template>
            </a-statistic>
            <a-divider />
            <a-statistic title="关系总数" :value="statsReady ? stats.totalRelations : '—'" :value-style="{ color: '#52c41a' }">
              <template #prefix><ApartmentOutlined /></template>
            </a-statistic>
            <a-divider />
            <a-statistic title="实体类型" :value="statsReady ? stats.entityTypes.length : '—'" :value-style="{ color: '#722ed1' }">
              <template #prefix><AppstoreOutlined /></template>
            </a-statistic>
            <div class="stats-note">
              <template v-if="statsReady">
                这是这一家全部的实体与关系（不受筛选和画布节点数影响）；画布上现在画了
                {{ graphData?.nodeCount ?? 0 }} 个点、{{ graphData?.linkCount ?? 0 }} 条线。
              </template>
              <template v-else>读不到这一家的统计，所以不摆 0（原因见右侧红条）。</template>
            </div>
          </a-card>
        </a-col>

        <a-col :xs="24" :md="showFilterPanel ? 18 : 24">
          <a-card class="graph-card">
            <a-alert
              v-if="readError"
              type="error"
              show-icon
              :message="readError"
              style="margin-bottom: 12px"
            />
            <a-alert
              v-else-if="graphData?.truncated"
              type="warning"
              show-icon
              style="margin-bottom: 12px"
              :message="`画布只画了最新的 ${graphData?.nodeCount} 个实体，按当前筛选一共命中 ${graphData?.matchedEntities} 个；把「节点数量」拉大能多看一些（最多 500 个）。`"
            />
            <div class="graph-toolbar">
              <a-space>
                <a-button-group>
                  <a-button @click="zoomIn">
                    <ZoomInOutlined />
                  </a-button>
                  <a-button @click="zoomOut">
                    <ZoomOutOutlined />
                  </a-button>
                  <a-button @click="fitView">
                    <FullscreenOutlined />
                  </a-button>
                </a-button-group>
                <a-divider type="vertical" />
                <a-radio-group v-model:value="layoutType" button-style>
                  <a-radio-button value="force">力导向</a-radio-button>
                  <a-radio-button value="circular">环形</a-radio-button>
                  <a-radio-button value="radial">辐射</a-radio-button>
                </a-radio-group>
                <a-divider type="vertical" />
                <a-input-search
                  v-model:value="searchKeyword"
                  placeholder="搜索节点..."
                  style="width: 200px"
                  @search="searchNode"
                />
              </a-space>
              <a-space v-if="selectedNode">
                <a-tag color="blue">选中: {{ selectedNode.name }}</a-tag>
                <a-button type="link" size="small" @click="focusNeighbors">查看关联</a-button>
                <a-button type="link" size="small" @click="clearSelection">取消选择</a-button>
              </a-space>
            </div>
            <div ref="graphRef" class="graph-container"></div>
            <div v-if="!loading && !readError && isEmptyGraph" class="graph-empty">
              <a-empty :description="emptyLine || '这一格没有可画的实体。'" />
            </div>
            <div v-if="loading" class="graph-loading">
              <a-spin size="large" tip="正在加载知识图谱..." />
            </div>
          </a-card>

          <a-row :gutter="16" style="margin-top: 16px">
            <a-col :xs="24" :md="12">
              <a-card title="最近提取的实体" size="small">
                <a-list :data-source="recentEntities" :locale="{ emptyText: recentEntityEmptyText }">
                  <template #renderItem="{ item }">
                    <a-list-item>
                      <a-list-item-meta>
                        <template #avatar>
                          <a-avatar :style="{ backgroundColor: getEntityColor(item.type) }">{{ item.name.charAt(0) }}</a-avatar>
                        </template>
                        <template #title>
                          <span>{{ item.name }}</span>
                          <a-tag size="small" :color="getEntityColor(item.type)" style="margin-left: 8px">{{ item.type }}</a-tag>
                        </template>
                        <template #description>
                          关联 {{ item.degree }} 条 · 置信度 {{ formatPercent(item.confidence) }}
                        </template>
                      </a-list-item-meta>
                    </a-list-item>
                  </template>
                </a-list>
              </a-card>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-card title="最近提取的关系" size="small">
                <a-list :data-source="recentRelations" :locale="{ emptyText: recentRelationEmptyText }">
                  <template #renderItem="{ item }">
                    <a-list-item>
                      <a-list-item-meta>
                        <template #title>
                          <span style="color: #1890ff">{{ item.sourceName || '—' }}</span>
                          <ArrowRightOutlined style="margin: 0 8px; color: #8c8c8c" />
                          <a-tag size="small">{{ item.relationType }}</a-tag>
                          <ArrowRightOutlined style="margin: 0 8px; color: #8c8c8c" />
                          <span style="color: #52c41a">{{ item.targetName || '—' }}</span>
                        </template>
                        <template #description>
                          置信度 {{ formatPercent(item.confidence) }}
                        </template>
                      </a-list-item-meta>
                    </a-list-item>
                  </template>
                </a-list>
              </a-card>
            </a-col>
          </a-row>
        </a-col>
      </a-row>
    </div>

    <a-modal
      v-model:open="showExtractModal"
      title="从文档提取实体和关系"
      width="900px"
      :confirm-loading="extracting"
      @ok="confirmExtraction"
      @cancel="closeExtractModal"
      :ok-text="'确认并入库'"
      :cancel-text="'取消'"
    >
      <div v-if="!extractionResult">
        <a-form layout="vertical">
          <a-form-item label="选择文档">
            <a-select
              v-model:value="selectedDocumentId"
              placeholder="请选择要提取的文档"
              :disabled="extracting"
              show-search
              :filter-option="(input: string, option: any) => option.label.toLowerCase().includes(input.toLowerCase())"
            >
              <a-select-option v-for="doc in documentList" :key="doc.id" :value="doc.id" :label="doc.title">
                {{ doc.title }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-button type="primary" block @click="doExtract" :loading="extracting">
              开始提取
            </a-button>
          </a-form-item>
        </a-form>
      </div>

      <div v-else>
        <a-tabs v-model:activeKey="activeTab">
          <a-tab-pane key="entities" :tab="`实体 (${selectedEntities.length}/${extractionResult.entities.length})`">
            <a-table
              :scroll="{ x: 'max-content' }"
              :data-source="extractionResult.entities"
              :pagination="{ pageSize: 5 }"
              size="small"
              row-key="name"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'select'">
                  <a-checkbox
                    :checked="selectedEntities.some(e => e.name === record.name && e.type === record.type)"
                    @change="(e: any) => toggleEntitySelection(record, e.target.checked)"
                  />
                </template>
                <template v-else-if="column.key === 'name'">
                  {{ record.name }}
                </template>
                <template v-else-if="column.key === 'type'">
                  <a-tag :color="getEntityColor(record.type)">{{ record.type }}</a-tag>
                </template>
                <template v-else-if="column.key === 'description'">
                  {{ record.description || '-' }}
                </template>
                <template v-else-if="column.key === 'confidence'">
                  {{ (record.confidence * 100).toFixed(0) }}%
                </template>
              </template>
              <a-table-column key="select" width="50" title="" />
              <a-table-column key="name" title="实体名称" />
              <a-table-column key="type" title="类型" width="120" />
              <a-table-column key="description" title="描述" />
              <a-table-column key="confidence" title="置信度" width="100" />
            </a-table>
            <div style="margin-top: 8px">
              <a-checkbox
                :checked="allEntitiesSelected"
                @change="(e: any) => toggleAllEntities(e.target.checked)"
              >
                全选实体
              </a-checkbox>
            </div>
          </a-tab-pane>

          <a-tab-pane key="relations" :tab="`关系 (${selectedRelations.length}/${extractionResult.relations.length})`">
            <a-table
              :scroll="{ x: 'max-content' }"
              :data-source="extractionResult.relations"
              :pagination="{ pageSize: 5 }"
              size="small"
              row-key="(r) => r.sourceName + '-' + r.relationType + '-' + r.targetName"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'select'">
                  <a-checkbox
                    :checked="selectedRelations.some(r => r.sourceName === record.sourceName && r.targetName === record.targetName && r.relationType === record.relationType)"
                    @change="(e: any) => toggleRelationSelection(record, e.target.checked)"
                  />
                </template>
                <template v-else-if="column.key === 'source'">
                  <span style="color: #1890ff">{{ record.sourceName }}</span>
                </template>
                <template v-else-if="column.key === 'relation'">
                  <a-tag>{{ record.relationType }}</a-tag>
                </template>
                <template v-else-if="column.key === 'target'">
                  <span style="color: #52c41a">{{ record.targetName }}</span>
                </template>
                <template v-else-if="column.key === 'confidence'">
                  {{ (record.confidence * 100).toFixed(0) }}%
                </template>
              </template>
              <a-table-column key="select" width="50" title="" />
              <a-table-column key="source" title="源实体" />
              <a-table-column key="relation" title="关系" width="100" />
              <a-table-column key="target" title="目标实体" />
              <a-table-column key="confidence" title="置信度" width="100" />
            </a-table>
            <div style="margin-top: 8px">
              <a-checkbox
                :checked="allRelationsSelected"
                @change="(e: any) => toggleAllRelations(e.target.checked)"
              >
                全选关系
              </a-checkbox>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-modal>

    <a-drawer v-model:open="showDetailDrawer" title="节点详情" width="480">
      <div v-if="selectedNode" class="node-detail">
        <a-descriptions title="基本信息" bordered column="1">
          <a-descriptions-item label="实体名称">{{ selectedNode.name }}</a-descriptions-item>
          <a-descriptions-item label="实体类型">
            <a-tag :color="getEntityColor(selectedNode.type)">{{ selectedNode.type }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="关联数量">{{ selectedNode.degree }} 条</a-descriptions-item>
          <a-descriptions-item label="置信度">{{ formatPercent(selectedNode.confidence) }}</a-descriptions-item>
          <a-descriptions-item label="来源文档">{{ selectedNode.sourceDocumentIds || '—' }}</a-descriptions-item>
          <a-descriptions-item label="提取时间">{{ selectedNode.createdAt ? formatDateTime(selectedNode.createdAt) : '—' }}</a-descriptions-item>
        </a-descriptions>
        <div v-if="selectedNode.description" class="node-description">{{ selectedNode.description }}</div>

        <a-divider>关联实体</a-divider>
        <a-list :data-source="nodeNeighbors" size="small">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta>
                <template #avatar>
                  <a-avatar :style="{ backgroundColor: getEntityColor(item.type) }">{{ item.name.charAt(0) }}</a-avatar>
                </template>
                <template #title>
                  {{ item.name }}
                  <a-tag size="small" style="margin-left: 8px">{{ item.relation }}</a-tag>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>

        <a-divider>出现位置</a-divider>
        <a-timeline>
          <a-timeline-item v-for="(loc, index) in nodeLocations" :key="index">
            <div class="location-item">
              <div class="location-doc">{{ loc.document }}</div>
              <div class="location-text">"{{ loc.text }}"</div>
            </div>
          </a-timeline-item>
        </a-timeline>
      </div>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import * as echarts from 'echarts'
import {
  FilterOutlined,
  ReloadOutlined,
  BuildOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  FullscreenOutlined,
  NodeIndexOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
  FileTextOutlined
} from '@ant-design/icons-vue'
import { knowledgeGraphApi, knowledgeEntityApi, knowledgeDocumentApi } from '../../api/knowledge'
import type { ExtractionResult, ExtractedEntity, ExtractedRelation } from '../../api/knowledge'
import type { KnowledgeDocument, KnowledgeGraphData, GraphNode, GraphLink, GraphTypeCount } from '../../types/knowledge'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'
import { logWarn } from '../../utils/errorLog'

const authStore = useAuthStore()
const showFilterPanel = ref(true)
const showDetailDrawer = ref(false)
const loading = ref(false)
const graphRef = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null

const showExtractModal = ref(false)
const extracting = ref(false)
const selectedDocumentId = ref<number | null>(null)
const documentList = ref<KnowledgeDocument[]>([])
const extractionResult = ref<ExtractionResult | null>(null)
const selectedEntities = ref<ExtractedEntity[]>([])
const selectedRelations = ref<ExtractedRelation[]>([])
const activeTab = ref('entities')
let rebuildStatusTimer: number | null = null

const allEntitiesSelected = computed(() => {
  if (!extractionResult.value || extractionResult.value.entities.length === 0) return false
  return selectedEntities.value.length === extractionResult.value.entities.length
})

const allRelationsSelected = computed(() => {
  if (!extractionResult.value || extractionResult.value.relations.length === 0) return false
  return selectedRelations.value.length === extractionResult.value.relations.length
})

const selectedTypes = ref<string[]>([])
const selectedRelationTypes = ref<string[]>([])
const nodeLimit = ref(150)
// 0 = 不过滤。默认必须给 0：给 50 会让首屏把置信度低于一半的实体悄悄藏掉
const minConfidence = ref(0)
const searchKeyword = ref('')
const layoutType = ref<'force' | 'circular' | 'radial'>('force')
const selectedNode = ref<GraphNode | null>(null)

// 实体类型颜色：已知类型给固定色，其余按名字散列到同一套色板（否则所有类型都是灰的）
const ENTITY_COLOR_MAP: Record<string, string> = {
  '产品': '#1890ff',
  '技术': '#52c41a',
  '人员': '#722ed1',
  '组织': '#fa8c16',
  '地点': '#eb2f96',
  '时间': '#13c2c2',
  '其他': '#8c8c8c',
  'PRODUCT': '#1890ff',
  'TECHNOLOGY': '#52c41a',
  'PERSON': '#722ed1',
  'ORG': '#fa8c16',
  'ORGANIZATION': '#fa8c16',
  'LOCATION': '#eb2f96',
  'TIME': '#13c2c2',
  'CONCEPT': '#2f54eb',
  'EVENT': '#faad14',
  'DOCUMENT': '#08979c'
}
const ENTITY_PALETTE = ['#1890ff', '#52c41a', '#722ed1', '#fa8c16', '#eb2f96', '#13c2c2', '#2f54eb', '#faad14', '#08979c']

const getEntityColor = (type: string): string => {
  if (!type) return '#8c8c8c'
  const known = ENTITY_COLOR_MAP[type]
  if (known) return known
  let hash = 0
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) % 997
  return ENTITY_PALETTE[hash % ENTITY_PALETTE.length]
}

const formatPercent = (value?: number) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `${(Number(value) * 100).toFixed(0)}%`
}

// 统计卡：读不到就说读不到（statsReady=false 时界面摆 —，不摆 0）
const stats = reactive({
  totalEntities: 0,
  totalRelations: 0,
  entityTypes: [] as GraphTypeCount[]
})
const statsReady = ref(false)
const readError = ref('')

// 实体/关系类型列表 - 由 API 填充
const entityTypes = ref<{ value: string; label: string; count: number; color: string }[]>([])
const relationTypes = ref<{ value: string; label: string; count: number }[]>([])

// 最近提取的实体/关系 - 由 API 填充
const recentEntities = ref<GraphNode[]>([])
const recentRelations = ref<GraphLink[]>([])

// 这两块空着的时候也要分清「这一家真的没有」与「这一发读不到」：读失败时念「读不到」，不许念「暂无数据」
const recentEntityEmptyText = computed(() =>
  statsReady.value ? '这一家还没有提取过实体' : '读不到这一家的实体（原因见右侧红条）'
)
const recentRelationEmptyText = computed(() =>
  statsReady.value ? '这一家还没有提取过关系' : '读不到这一家的关系（原因见右侧红条）'
)

// 节点详情抽屉数据 - 由 API 填充
const nodeNeighbors = ref<{ name: string; type: string; relation: string }[]>([])
const nodeLocations = ref<{ document: string; text: string }[]>([])

// 图谱数据 - 由 API 填充
const graphData = ref<KnowledgeGraphData | null>(null)
const graphNodes = ref<any[]>([])
const isEmptyGraph = computed(() => !!graphData.value && (graphData.value.nodes?.length ?? 0) === 0)
const emptyLine = computed(() => graphData.value?.emptyLine || '')

// 环形成环：度数最大的那个摆圆心，其余按离它几步分环
const radialPositions = (nodes: any[], links: any[]) => {
  if (!nodes.length) return
  const adjacency = new Map<number, Set<number>>()
  nodes.forEach(n => adjacency.set(n.id, new Set()))
  links.forEach(l => {
    adjacency.get(l.source)?.add(l.target)
    adjacency.get(l.target)?.add(l.source)
  })
  const center = [...nodes].sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0))[0]
  const ringOf = new Map<number, number>([[center.id, 0]])
  const queue: number[] = [center.id]
  while (queue.length) {
    const current = queue.shift() as number
    for (const next of adjacency.get(current) ?? []) {
      if (!ringOf.has(next)) {
        ringOf.set(next, (ringOf.get(current) ?? 0) + 1)
        queue.push(next)
      }
    }
  }
  const knownRings = Array.from(ringOf.values())
  const maxRing = knownRings.length ? Math.max(...knownRings) : 0
  const buckets = new Map<number, any[]>()
  nodes.forEach(n => {
    // 连不到圆心的零星节点摆最外环，不让它们叠在中间
    const ring = ringOf.get(n.id) ?? maxRing + 1
    if (!buckets.has(ring)) buckets.set(ring, [])
    buckets.get(ring)!.push(n)
  })
  const outer = Math.max(1, ...Array.from(buckets.keys()))
  buckets.forEach((list, ring) => {
    if (ring === 0) {
      list[0].x = 0
      list[0].y = 0
      return
    }
    const radius = Math.min(340, (ring / outer) * 340)
    list.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / list.length - Math.PI / 2
      node.x = Math.cos(angle) * radius
      node.y = Math.sin(angle) * radius * 0.72
    })
  })
}

// 加载知识图谱数据（三个筛选都真发出去；失败时清空且不摆 0）
const loadGraphData = async (): Promise<boolean> => {
  loading.value = true
  try {
    const res: any = await knowledgeGraphApi.getGraph({
      limit: nodeLimit.value,
      types: selectedTypes.value,
      relationTypes: selectedRelationTypes.value,
      minConfidence: minConfidence.value
    })
    const data: KnowledgeGraphData | null = res?.data ?? res ?? null
    if (!data) {
      throw new Error('后端没有回图谱数据')
    }

    graphData.value = data
    readError.value = ''
    statsReady.value = true

    stats.totalEntities = data.totalEntities ?? 0
    stats.totalRelations = data.totalRelations ?? 0
    stats.entityTypes = data.entityTypes ?? []

    entityTypes.value = (data.entityTypes || []).map(t => ({
      value: t.type,
      label: t.type,
      count: t.count,
      color: getEntityColor(t.type)
    }))
    relationTypes.value = (data.relationTypes || []).map(t => ({
      value: t.type,
      label: t.type,
      count: t.count
    }))
    recentEntities.value = data.recentEntities || []
    recentRelations.value = data.recentRelations || []

    initGraph()
    return true
  } catch (e: any) {
    logWarn('knowledge/knowledge-graph-view', '加载知识图谱数据失败', e)
    readError.value = e?.message || '读不到知识图谱：这一发没有拿到答复，下面不是「这一家没有图谱」。'
    message.error(readError.value)
    graphData.value = null
    statsReady.value = false
    recentEntities.value = []
    recentRelations.value = []
    initGraph()
    return false
  } finally {
    loading.value = false
  }
}

const initGraph = () => {
  if (!graphRef.value) return

  if (chartInstance) {
    chartInstance.dispose()
  }

  chartInstance = echarts.init(graphRef.value)

  const categories = entityTypes.value.map(e => ({
    name: e.value,
    itemStyle: { color: e.color }
  }))

  // 后端 GraphNode 已经带齐界面要的字段（名字/类型/置信度/连线条数/来源文档/时间），不再另建映射
  const nodes: any[] = (graphData.value?.nodes || []).map(n => ({
    id: n.id,
    name: n.name,
    value: n.degree,
    category: n.type,
    // 点的大小按这个点在关系表里连了几条算：孤点小、枢纽大，且一致可解释
    symbolSize: Math.min(70, 20 + (n.degree || 0) * 6),
    itemStyle: { color: getEntityColor(n.type) },
    degree: n.degree,
    type: n.type,
    confidence: n.confidence,
    description: n.description,
    sourceDocumentIds: n.sourceDocumentIds,
    createdAt: n.createdAt
  }))

  const links: any[] = (graphData.value?.links || []).map(l => ({
    id: l.id,
    source: l.source,
    target: l.target,
    value: l.confidence,
    sourceName: l.sourceName,
    targetName: l.targetName,
    relationType: l.relationType,
    label: {
      show: true,
      formatter: l.relationType,
      fontSize: 10
    }
  }))

  // 保存节点引用，供 focusNodeAdjacency 查找索引使用
  graphNodes.value = nodes

  // 「辐射」= 自己算坐标 + layout:none；ECharts 的 graph 没有 radial 这个内置布局
  const mode = layoutType.value
  const radial = mode === 'radial'
  const graphLayout: 'force' | 'circular' | 'none' = radial ? 'none' : mode
  if (radial) {
    radialPositions(nodes, links)
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          return `${params.name}<br/>类型: ${params.data.category}<br/>关联数: ${params.value} 条`
        }
        return `${params.data.sourceName || params.data.source} → ${params.data.targetName || params.data.target}`
          + `<br/>${params.data.relationType || ''}`
      }
    },
    legend: {
      show: true,
      data: categories.map(c => c.name),
      right: 20,
      top: 20
    },
    animationDuration: 1500,
    animationEasingUpdate: 'quinticInOut',
    series: [
      {
        name: '知识图谱',
        type: 'graph',
        layout: graphLayout,
        data: nodes,
        links: links,
        categories: categories,
        roam: true,
        draggable: true,
        label: {
          show: true,
          position: 'right',
          fontSize: 12,
          formatter: '{b}'
        },
        lineStyle: {
          color: 'source',
          curveness: 0.3,
          width: 1.5
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 4 }
        },
        force: {
          repulsion: 200,
          edgeLength: [50, 150],
          gravity: 0.1
        },
        circular: {
          rotateLabel: true
        }
      }
    ]
  }

  chartInstance.setOption(option)

  chartInstance.on('click', (params: any) => {
    if (params.dataType === 'node') {
      selectedNode.value = params.data
      showDetailDrawer.value = true
      loadNodeNeighbors(params.data)
    }
  })
}

// 加载选中节点的邻接关系
const loadNodeNeighbors = async (node: any) => {
  nodeNeighbors.value = []
  nodeLocations.value = []
  const entityId = Number(node.id)
  if (!entityId || isNaN(entityId)) return
  try {
    const res: any = await knowledgeGraphApi.getNeighbors(entityId, 1)
    const data: KnowledgeGraphData | null = res?.data ?? res ?? null
    if (!data) return
    const links = data.links || []
    const neighborNodes = (data.nodes || []).filter(n => Number(n.id) !== entityId)
    nodeNeighbors.value = neighborNodes.map(n => {
      // 查找连接该邻居与选中节点的边，取它的关系类型
      const link = links.find(l =>
        (l.source === entityId && l.target === Number(n.id)) ||
        (l.target === entityId && l.source === Number(n.id))
      )
      return {
        name: n.name,
        type: n.type,
        relation: link?.relationType || '关联'
      }
    })
  } catch (e) {
    logWarn('knowledge/knowledge-graph-view', '加载邻接节点失败', e)
  }
}

// 通过 graphRoam 缩放 - 比直接修改 series.zoom 更可靠
const zoomIn = () => {
  chartInstance?.dispatchAction({
    type: 'graphRoam',
    seriesIndex: 0,
    zoom: 1.2
  })
}

const zoomOut = () => {
  chartInstance?.dispatchAction({
    type: 'graphRoam',
    seriesIndex: 0,
    zoom: 0.8
  })
}

const fitView = () => {
  if (!chartInstance) return
  // 重置缩放和居中 - 通过 setOption 更新 series 配置
  chartInstance.setOption({
    series: [{
      zoom: 1,
      center: ['50%', '50%']
    }]
  })
}

// 通过 focusNodeAdjacency 高亮目标节点及其相邻节点
const searchNode = () => {
  if (!chartInstance || !searchKeyword.value) return
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return

  const idx = graphNodes.value.findIndex(n =>
    String(n.name || '').toLowerCase().includes(keyword)
  )
  if (idx < 0) {
    message.warning('未找到匹配的节点')
    return
  }

  // 先取消之前的高亮
  chartInstance.dispatchAction({ type: 'downplay', seriesIndex: 0 })
  // 高亮目标节点及相邻节点
  chartInstance.dispatchAction({
    type: 'focusNodeAdjacency',
    seriesIndex: 0,
    dataIndex: idx
  })
}

// 通过 focusNodeAdjacency 高亮关联节点（其他节点降低透明度）
const focusNeighbors = () => {
  const node = selectedNode.value
  if (!chartInstance || !node) return
  const idx = graphNodes.value.findIndex(n =>
    String(n.id) === String(node.id) ||
    String(n.name) === String(node.name)
  )
  if (idx < 0) {
    message.warning('未找到当前节点的位置')
    return
  }
  chartInstance.dispatchAction({
    type: 'focusNodeAdjacency',
    seriesIndex: 0,
    dataIndex: idx
  })
}

const clearSelection = () => {
  selectedNode.value = null
  if (chartInstance) {
    chartInstance.dispatchAction({ type: 'downplay' })
  }
}

// 只有真拿到数据才念「已应用」；没拿到时 loadGraphData 已经弹过红条，不再补一句假的成功
const applyFilter = async () => {
  const ok = await loadGraphData()
  if (!ok) return
  const applied: string[] = []
  if (selectedTypes.value.length) applied.push(`实体类型 ${selectedTypes.value.join('、')}`)
  if (selectedRelationTypes.value.length) applied.push(`关系类型 ${selectedRelationTypes.value.join('、')}`)
  if (minConfidence.value > 0) applied.push(`置信度 ≥ ${minConfidence.value}%`)
  const scope = applied.length ? applied.join('；') : '不限条件'
  const data = graphData.value
  message.success(`已按「${scope}」取数：画布 ${data?.nodeCount ?? 0} 个实体、${data?.linkCount ?? 0} 条关系`)
}

const resetFilter = () => {
  selectedTypes.value = []
  selectedRelationTypes.value = []
  nodeLimit.value = 150
  minConfidence.value = 0
  applyFilter()
}

const refreshGraph = async () => {
  const ok = await loadGraphData()
  if (ok) message.success('图谱已刷新')
}

const rebuildGraph = () => {
  Modal.confirm({
    title: '确认重建知识图谱？',
    content: '重建图谱将从所有文档中提取实体和关系，可能需要较长时间。是否继续？',
    okText: '确认重建',
    cancelText: '取消',
    onOk: async () => {
      try {
        await knowledgeGraphApi.rebuild()
        message.loading({ content: '正在重建知识图谱...', key: 'rebuild', duration: 0 })
        startRebuildStatusPolling()
      } catch (e: any) {
        message.error(e?.message || '重建失败')
      }
    }
  })
}

const startRebuildStatusPolling = () => {
  if (rebuildStatusTimer) {
    clearInterval(rebuildStatusTimer)
  }
  rebuildStatusTimer = window.setInterval(async () => {
    try {
      const res: any = await knowledgeGraphApi.getRebuildStatus()
      const status = res.data || res
      if (status.status === 'completed') {
        message.success({ content: `知识图谱重建完成，新增实体 ${status.extractedEntities || 0} 个，关系 ${status.extractedRelations || 0} 个`, key: 'rebuild' })
        if (rebuildStatusTimer) {
          clearInterval(rebuildStatusTimer)
          rebuildStatusTimer = null
        }
        // 重建完成后重新加载图谱数据（包含最新统计）
        await loadGraphData()
      } else if (status.status === 'failed') {
        message.error({ content: `图谱重建失败: ${status.error || '未知错误'}`, key: 'rebuild' })
        if (rebuildStatusTimer) {
          clearInterval(rebuildStatusTimer)
          rebuildStatusTimer = null
        }
      } else if (status.status === 'processing') {
        message.loading({ 
          content: `正在重建知识图谱... ${status.progress || 0}% (${status.processedDocuments || 0}/${status.totalDocuments || 0} 文档)`, 
          key: 'rebuild', 
          duration: 0 
        })
      }
    } catch (e) {
      logWarn('knowledge/knowledge-graph-view', '获取重建状态失败', e)
    }
  }, 2000)
}

const openExtractModal = async () => {
  showExtractModal.value = true
  extractionResult.value = null
  selectedEntities.value = []
  selectedRelations.value = []
  selectedDocumentId.value = null
  activeTab.value = 'entities'
  
  try {
    const res: any = await knowledgeDocumentApi.list({ tenantId: authStore.selectedTenantId || authStore.tenantId, page: 1, size: 50 })
    const data = res.data || res
    documentList.value = data.records || data || []
  } catch (e) {
    logWarn('knowledge/knowledge-graph-view', '加载文档列表失败', e)
  }
}

const closeExtractModal = () => {
  showExtractModal.value = false
}

const doExtract = async () => {
  if (!selectedDocumentId.value) {
    message.warning('请选择要提取的文档')
    return
  }
  
  extracting.value = true
  try {
    const res: any = await knowledgeEntityApi.extractFromDocument(selectedDocumentId.value)
    const data = res.data || res
    extractionResult.value = data
    selectedEntities.value = [...(data.entities || [])]
    selectedRelations.value = [...(data.relations || [])]
    message.success('提取完成，请确认要入库的实体和关系')
  } catch (e: any) {
    message.error(e?.message || '提取失败')
  } finally {
    extracting.value = false
  }
}

const toggleEntitySelection = (entity: ExtractedEntity, checked: boolean) => {
  if (checked) {
    if (!selectedEntities.value.some(e => e.name === entity.name && e.type === entity.type)) {
      selectedEntities.value.push(entity)
    }
  } else {
    selectedEntities.value = selectedEntities.value.filter(e => !(e.name === entity.name && e.type === entity.type))
  }
}

const toggleAllEntities = (checked: boolean) => {
  if (checked && extractionResult.value) {
    selectedEntities.value = [...extractionResult.value.entities]
  } else {
    selectedEntities.value = []
  }
}

const toggleRelationSelection = (relation: ExtractedRelation, checked: boolean) => {
  if (checked) {
    if (!selectedRelations.value.some(r => 
        r.sourceName === relation.sourceName && 
        r.targetName === relation.targetName && 
        r.relationType === relation.relationType)) {
      selectedRelations.value.push(relation)
    }
  } else {
    selectedRelations.value = selectedRelations.value.filter(r => 
      !(r.sourceName === relation.sourceName && 
        r.targetName === relation.targetName && 
        r.relationType === relation.relationType))
  }
}

const toggleAllRelations = (checked: boolean) => {
  if (checked && extractionResult.value) {
    selectedRelations.value = [...extractionResult.value.relations]
  } else {
    selectedRelations.value = []
  }
}

const confirmExtraction = async () => {
  if (!selectedDocumentId.value) {
    message.warning('请选择文档')
    return
  }
  if (selectedEntities.value.length === 0 && selectedRelations.value.length === 0) {
    message.warning('请至少选择一个实体或关系')
    return
  }
  
  extracting.value = true
  try {
    const res: any = await knowledgeEntityApi.confirmExtraction(
      selectedDocumentId.value,
      selectedEntities.value,
      selectedRelations.value
    )
    const data = res.data || res
    message.success(`入库完成：新增实体 ${data.createdEntities} 个，关系 ${data.createdRelations} 个，跳过重复实体 ${data.skippedEntities} 个，关系 ${data.skippedRelations} 个`)
    showExtractModal.value = false
    // 入库后重新加载图谱数据（包含最新统计）
    await loadGraphData()
  } catch (e: any) {
    message.error(e?.message || '确认失败')
  } finally {
    extracting.value = false
  }
}

const handleResize = () => {
  chartInstance?.resize()
}

// 筛选面板展开/收起后，容器宽度变化，需要触发 resize
watch(showFilterPanel, () => {
  nextTick(() => {
    chartInstance?.resize()
  })
})

// 换布局要真的重画（以前这个开关只在下次取数时才生效，点了没反应）
watch(layoutType, () => {
  initGraph()
})

onMounted(() => {
  // 首次加载图谱数据（由 API 返回）
  loadGraphData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (rebuildStatusTimer) {
    clearInterval(rebuildStatusTimer)
  }
  chartInstance?.dispose()
})
</script>

<style lang="less" scoped>
.knowledge-graph-container {
  .content-wrapper {
    padding: 24px;
  }
}

.filter-card,
.stats-card {
  .ant-statistic {
    margin-bottom: 8px;
  }
}

.slider-value {
  font-size: 12px;
  color: #8c8c8c;
  text-align: right;
}

.stats-note {
  margin-top: 8px;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.6;
}

.graph-card {
  .graph-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #f0f0f0;
  }

  .graph-container {
    height: 600px;
    width: 100%;
    position: relative;
  }

  .graph-empty {
    position: absolute;
    top: 72px;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 48px;
    text-align: center;
  }

  .graph-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }
}

.node-detail {
  .node-description {
    margin-top: 12px;
    font-size: 13px;
    color: #595959;
    line-height: 1.7;
  }

  .location-item {
    .location-doc {
      font-size: 12px;
      color: #1890ff;
      margin-bottom: 4px;
    }
    .location-text {
      font-size: 13px;
      color: #595959;
      font-style: italic;
    }
  }
}
</style>
