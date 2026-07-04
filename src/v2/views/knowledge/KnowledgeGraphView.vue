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
              <a-form-item label="最小关联度">
                <a-slider v-model:value="minConfidence" :min="0" :max="100" :step="5" />
                <div class="slider-value">最小置信度 {{ minConfidence }}%</div>
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
            <a-statistic title="实体总数" :value="stats.totalEntities" :value-style="{ color: '#1890ff' }">
              <template #prefix><NodeIndexOutlined /></template>
            </a-statistic>
            <a-divider />
            <a-statistic title="关系总数" :value="stats.totalRelations" :value-style="{ color: '#52c41a' }">
              <template #prefix><ApartmentOutlined /></template>
            </a-statistic>
            <a-divider />
            <a-statistic title="实体类型" :value="stats.entityTypes.length" :value-style="{ color: '#722ed1' }">
              <template #prefix><AppstoreOutlined /></template>
            </a-statistic>
          </a-card>
        </a-col>

        <a-col :xs="24" :md="showFilterPanel ? 18 : 24">
          <a-card class="graph-card">
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
                <a-tag color="blue">选中: {{ selectedNode.label }}</a-tag>
                <a-button type="link" size="small" @click="focusNeighbors">查看关联</a-button>
                <a-button type="link" size="small" @click="clearSelection">取消选择</a-button>
              </a-space>
            </div>
            <div ref="graphRef" class="graph-container" @click="onCanvasClick"></div>
            <div v-if="loading" class="graph-loading">
              <a-spin size="large" tip="正在加载知识图谱..." />
            </div>
          </a-card>

          <a-row :gutter="16" style="margin-top: 16px">
            <a-col :xs="24" :md="12">
              <a-card title="最近提取的实体" size="small">
                <a-list :data-source="recentEntities">
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
                          出现 {{ item.occurrences }} 次 · 置信度 {{ (item.confidence * 100).toFixed(0) }}%
                        </template>
                      </a-list-item-meta>
                    </a-list-item>
                  </template>
                </a-list>
              </a-card>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-card title="最近提取的关系" size="small">
                <a-list :data-source="recentRelations">
                  <template #renderItem="{ item }">
                    <a-list-item>
                      <a-list-item-meta>
                        <template #title>
                          <span style="color: #1890ff">{{ item.sourceEntityName || '—' }}</span>
                          <ArrowRightOutlined style="margin: 0 8px; color: #8c8c8c" />
                          <a-tag size="small">{{ item.relationType }}</a-tag>
                          <ArrowRightOutlined style="margin: 0 8px; color: #8c8c8c" />
                          <span style="color: #52c41a">{{ item.targetEntityName || '—' }}</span>
                        </template>
                        <template #description>
                          置信度 {{ (item.confidence * 100).toFixed(0) }}% · 来源: {{ item.sourceDocumentId ? '文档 #' + item.sourceDocumentId : '未知' }}
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
          <a-descriptions-item label="实体名称">{{ selectedNode.label }}</a-descriptions-item>
          <a-descriptions-item label="实体类型">
            <a-tag :color="getEntityColor(selectedNode.type)">{{ selectedNode.type }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="关联数量">{{ selectedNode.value }}</a-descriptions-item>
          <a-descriptions-item label="来源文档">{{ selectedNode.sourceDocument || '—' }}</a-descriptions-item>
          <a-descriptions-item label="首次提取时间">{{ selectedNode.extractTime || '—' }}</a-descriptions-item>
        </a-descriptions>

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
import type { KnowledgeDocument, KnowledgeEntity, KnowledgeRelation, KnowledgeGraphData } from '../../types/knowledge'

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
const minConfidence = ref(50)
const searchKeyword = ref('')
const layoutType = ref('force')
const selectedNode = ref<any>(null)

// 实体类型颜色映射
const ENTITY_COLOR_MAP: Record<string, string> = {
  '产品': '#1890ff',
  '技术': '#52c41a',
  '人员': '#722ed1',
  '组织': '#fa8c16',
  '地点': '#eb2f96',
  '时间': '#13c2c2',
  '其他': '#8c8c8c'
}

const getEntityColor = (type: string): string => {
  return ENTITY_COLOR_MAP[type] || '#8c8c8c'
}

// 统计数据 - 初始全部为 0，由 API 填充
const stats = reactive({
  totalEntities: 0,
  totalRelations: 0,
  entityTypes: [] as { type: string; count: number }[]
})

// 实体/关系类型列表 - 由 API 填充
const entityTypes = ref<{ value: string; label: string; count: number; color: string }[]>([])
const relationTypes = ref<{ value: string; label: string; count: number }[]>([])

// 最近提取的实体/关系 - 由 API 填充
const recentEntities = ref<KnowledgeEntity[]>([])
const recentRelations = ref<KnowledgeRelation[]>([])

// 节点详情抽屉数据 - 由 API 填充
const nodeNeighbors = ref<{ name: string; type: string; relation: string }[]>([])
const nodeLocations = ref<{ document: string; text: string }[]>([])

// 图谱数据 - 由 API 填充
const graphData = ref<KnowledgeGraphData | null>(null)
const graphNodes = ref<any[]>([])

// 加载知识图谱数据
const loadGraphData = async () => {
  loading.value = true
  try {
    const type = selectedTypes.value.length === 1 ? selectedTypes.value[0] : undefined
    const res: any = await knowledgeGraphApi.getGraph(nodeLimit.value, type)
    const data: KnowledgeGraphData | null = res?.data ?? res ?? null

    if (!data) {
      // API 无数据 - 显示空状态
      graphData.value = null
      stats.totalEntities = 0
      stats.totalRelations = 0
      stats.entityTypes = []
      entityTypes.value = []
      relationTypes.value = []
      recentEntities.value = []
      recentRelations.value = []
      initGraph()
      return
    }

    graphData.value = data

    // 更新统计数据
    stats.totalEntities = data.stats?.totalEntities ?? 0
    stats.totalRelations = data.stats?.totalRelations ?? 0
    stats.entityTypes = data.stats?.entityTypes ?? []

    // 更新实体类型列表（带颜色）
    entityTypes.value = (data.stats?.entityTypes || []).map(t => ({
      value: t.type,
      label: t.type,
      count: t.count,
      color: getEntityColor(t.type)
    }))

    // 更新关系类型列表
    relationTypes.value = (data.stats?.relationTypes || []).map(t => ({
      value: t.type,
      label: t.type,
      count: t.count
    }))

    // 更新最近实体/关系
    recentEntities.value = (data.entities || []).slice(0, 5)
    recentRelations.value = (data.relations || []).slice(0, 5)

    initGraph()
  } catch (e: any) {
    console.warn('加载知识图谱数据失败', e)
    message.error('加载知识图谱数据失败')
    // 出错时显示空状态，不使用假数据
    graphData.value = null
    stats.totalEntities = 0
    stats.totalRelations = 0
    stats.entityTypes = []
    entityTypes.value = []
    relationTypes.value = []
    recentEntities.value = []
    recentRelations.value = []
    initGraph()
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

  // 构建实体信息映射（用于节点详情抽屉的来源文档/提取时间）
  const entityMap = new Map<string, KnowledgeEntity>()
  ;(graphData.value?.entities || []).forEach(e => {
    entityMap.set(String(e.id), e)
    entityMap.set(e.name, e)
  })

  // 将后端 GraphNode 转为 ECharts 节点格式
  const rawNodes = graphData.value?.nodes || []
  const nodes: any[] = rawNodes.map(n => {
    const entity = entityMap.get(String(n.id)) || entityMap.get(n.label)
    return {
      id: n.id,
      name: n.label,
      value: n.size,
      category: n.type,
      symbolSize: Math.max(20, n.size || 30),
      itemStyle: { color: n.color || getEntityColor(n.type) },
      // 来源文档/提取时间 - 从实体数据中读取，无值时为空字符串（模板显示 "—"）
      sourceDocument: entity?.sourceDocumentId ? `文档 #${entity.sourceDocumentId}` : '',
      extractTime: entity?.createdAt || ''
    }
  })

  // 将后端 GraphEdge 转为 ECharts 边格式
  const links: any[] = (graphData.value?.edges || []).map(e => ({
    source: e.source,
    target: e.target,
    value: e.value,
    label: {
      show: true,
      formatter: e.label,
      fontSize: 10
    }
  }))

  // 保存节点引用，供 focusNodeAdjacency 查找索引使用
  graphNodes.value = nodes

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          return `${params.name}<br/>类型: ${params.data.category}<br/>关联数: ${params.value}`
        }
        return `${params.data.source} → ${params.data.target}`
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
        layout: layoutType.value,
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
    const edges = data.edges || []
    const neighborNodes = (data.nodes || []).filter(n => String(n.id) !== String(node.id))
    nodeNeighbors.value = neighborNodes.map(n => {
      // 查找连接该邻居与选中节点的边，获取关系类型
      const edge = edges.find(e =>
        (e.source === String(node.id) && e.target === String(n.id)) ||
        (e.target === String(node.id) && e.source === String(n.id))
      )
      return {
        name: n.label,
        type: n.type,
        relation: edge?.label || '关联'
      }
    })
  } catch (e) {
    console.warn('加载邻接节点失败', e)
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
  if (!chartInstance || !selectedNode.value) return
  const idx = graphNodes.value.findIndex(n =>
    String(n.id) === String(selectedNode.value.id) ||
    String(n.name) === String(selectedNode.value.name)
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

const onCanvasClick = (event: MouseEvent) => {
}

const applyFilter = async () => {
  await loadGraphData()
  message.success('筛选已应用')
}

const resetFilter = () => {
  selectedTypes.value = []
  selectedRelationTypes.value = []
  nodeLimit.value = 150
  minConfidence.value = 50
  applyFilter()
}

const refreshGraph = async () => {
  await loadGraphData()
  message.success('图谱已刷新')
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
      console.warn('获取重建状态失败', e)
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
    const res: any = await knowledgeDocumentApi.list({ page: 1, size: 50 })
    const data = res.data || res
    documentList.value = data.records || data || []
  } catch (e) {
    console.warn('加载文档列表失败', e)
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
