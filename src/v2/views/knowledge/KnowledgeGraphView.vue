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
                          <span style="color: #1890ff">{{ item.source }}</span>
                          <ArrowRightOutlined style="margin: 0 8px; color: #8c8c8c" />
                          <a-tag size="small">{{ item.relationType }}</a-tag>
                          <ArrowRightOutlined style="margin: 0 8px; color: #8c8c8c" />
                          <span style="color: #52c41a">{{ item.target }}</span>
                        </template>
                        <template #description>
                          置信度 {{ (item.confidence * 100).toFixed(0) }}% · 来源: {{ item.sourceDocument || '未知' }}
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
          <a-descriptions-item label="来源文档">产品需求规格说明书.pdf</a-descriptions-item>
          <a-descriptions-item label="首次提取时间">2024-01-15 10:30</a-descriptions-item>
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
import { ref, reactive, onMounted, onUnmounted, nextTick, computed } from 'vue'
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
import type { ExtractionResult, ExtractedEntity, ExtractedRelation, KnowledgeDocument } from '../../api/knowledge'

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

const stats = reactive({
  totalEntities: 234,
  totalRelations: 156,
  entityTypes: [
    { value: '产品', label: '产品', count: 45, color: '#1890ff' },
    { value: '技术', label: '技术', count: 38, color: '#52c41a' },
    { value: '人员', label: '人员', count: 32, color: '#722ed1' },
    { value: '组织', label: '组织', count: 25, color: '#fa8c16' },
    { value: '地点', label: '地点', count: 22, color: '#eb2f96' },
    { value: '时间', label: '时间', count: 18, color: '#13c2c2' },
    { value: '其他', label: '其他', count: 54, color: '#8c8c8c' }
  ]
})

const entityTypes = ref([
  { value: '产品', label: '产品', count: 45, color: '#1890ff' },
  { value: '技术', label: '技术', count: 38, color: '#52c41a' },
  { value: '人员', label: '人员', count: 32, color: '#722ed1' },
  { value: '组织', label: '组织', count: 25, color: '#fa8c16' },
  { value: '地点', label: '地点', count: 22, color: '#eb2f96' },
  { value: '时间', label: '时间', count: 18, color: '#13c2c2' }
])

const relationTypes = ref([
  { value: '属于', label: '属于', count: 42 },
  { value: '使用', label: '使用', count: 38 },
  { value: '包含', label: '包含', count: 29 },
  { value: '关联', label: '关联', count: 25 },
  { value: '依赖', label: '依赖', count: 14 },
  { value: '开发', label: '开发', count: 8 }
])

const recentEntities = ref([
  { id: 1, name: '用户管理模块', type: '产品', occurrences: 12, confidence: 0.95 },
  { id: 2, name: 'Vue 3', type: '技术', occurrences: 8, confidence: 0.92 },
  { id: 3, name: '张三', type: '人员', occurrences: 6, confidence: 0.88 },
  { id: 4, name: '产品部', type: '组织', occurrences: 5, confidence: 0.85 },
  { id: 5, name: '北京', type: '地点', occurrences: 4, confidence: 0.80 }
])

const recentRelations = ref([
  { id: 1, source: '用户管理模块', target: 'Vue 3', relationType: '使用', confidence: 0.92, sourceDocument: '产品需求文档.pdf' },
  { id: 2, source: '张三', target: '产品部', relationType: '属于', confidence: 0.95, sourceDocument: '组织架构.docx' },
  { id: 3, source: '用户管理模块', target: '权限系统', relationType: '依赖', confidence: 0.88, sourceDocument: '系统设计.pdf' },
  { id: 4, source: '产品部', target: '北京', relationType: '位于', confidence: 0.82, sourceDocument: '公司介绍.pdf' }
])

const nodeNeighbors = ref([
  { name: '权限系统', type: '产品', relation: '依赖' },
  { name: 'Vue 3', type: '技术', relation: '使用' },
  { name: '产品部', type: '组织', relation: '负责' },
  { name: '张三', type: '人员', relation: '开发' }
])

const nodeLocations = ref([
  { document: '产品需求规格说明书.pdf', text: '用户管理模块包含登录、注册、密码找回等功能...' },
  { document: '系统架构设计文档.docx', text: '用户管理模块采用微服务架构，独立部署...' }
])

const getEntityColor = (type: string): string => {
  const found = entityTypes.value.find(e => e.value === type)
  return found?.color || '#8c8c8c'
}

const initGraph = () => {
  if (!graphRef.value) return

  if (chartInstance) {
    chartInstance.dispose()
  }

  chartInstance = echarts.init(graphRef.value)

  const categories = entityTypes.value.map((e, i) => ({
    name: e.value,
    itemStyle: { color: e.color }
  }))

  const nodes = generateMockNodes()
  const links = generateMockLinks(nodes)

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
    }
  })
}

const generateMockNodes = () => {
  const types = entityTypes.value.map(e => e.value)
  const names = [
    '用户管理', '权限系统', 'Vue 3', 'TypeScript', 'Node.js',
    'MySQL', 'Redis', '微服务', 'API网关', '负载均衡',
    '消息队列', 'Elasticsearch', '监控系统', '日志服务',
    '产品部', '技术部', '运营部', '张三', '李四', '王五',
    '北京', '上海', '广州', '深圳', 'Q1计划', 'Q2规划'
  ]

  return names.map((name, index) => ({
    id: index,
    name: name,
    value: Math.floor(Math.random() * 10) + 1,
    category: types[index % types.length],
    symbolSize: Math.random() * 30 + 20,
    itemStyle: { color: getEntityColor(types[index % types.length]) }
  }))
}

const generateMockLinks = (nodes: any[]) => {
  const links: any[] = []
  const relationTypes = ['属于', '使用', '包含', '关联', '依赖', '开发']

  for (let i = 0; i < Math.min(nodes.length * 1.5, 50); i++) {
    const source = Math.floor(Math.random() * nodes.length)
    const target = Math.floor(Math.random() * nodes.length)
    if (source !== target) {
      links.push({
        source: source,
        target: target,
        lineStyle: { curveness: Math.random() * 0.5 - 0.25 },
        label: {
          show: Math.random() > 0.7,
          formatter: relationTypes[Math.floor(Math.random() * relationTypes.length)],
          fontSize: 10
        }
      })
    }
  }
  return links
}

const zoomIn = () => {
  if (chartInstance) {
    const option = chartInstance.getOption()
    const currentZoom = (option as any).series[0].zoom || 1
    chartInstance.setOption({
      series: [{ zoom: currentZoom * 1.2 }]
    })
  }
}

const zoomOut = () => {
  if (chartInstance) {
    const option = chartInstance.getOption()
    const currentZoom = (option as any).series[0].zoom || 1
    chartInstance.setOption({
      series: [{ zoom: currentZoom * 0.8 }]
    })
  }
}

const fitView = () => {
  if (chartInstance) {
    chartInstance.setOption({
      series: [{ zoom: 1, center: ['50%', '50%'] }]
    })
  }
}

const searchNode = () => {
  if (!chartInstance || !searchKeyword.value) return

  chartInstance.dispatchAction({
    type: 'highlight',
    seriesIndex: 0,
    name: searchKeyword.value
  })
}

const focusNeighbors = () => {
  if (!chartInstance || !selectedNode.value) return
  message.info('正在查看关联节点...')
}

const clearSelection = () => {
  selectedNode.value = null
  if (chartInstance) {
    chartInstance.dispatchAction({ type: 'downplay' })
  }
}

const onCanvasClick = (event: MouseEvent) => {
}

const applyFilter = () => {
  loading.value = true
  setTimeout(() => {
    initGraph()
    loading.value = false
    message.success('筛选已应用')
  }, 800)
}

const resetFilter = () => {
  selectedTypes.value = []
  selectedRelationTypes.value = []
  nodeLimit.value = 150
  minConfidence.value = 50
  applyFilter()
}

const refreshGraph = () => {
  loading.value = true
  setTimeout(() => {
    initGraph()
    loading.value = false
    message.success('图谱已刷新')
  }, 800)
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
        stats.totalEntities += (status.extractedEntities || 0)
        stats.totalRelations += (status.extractedRelations || 0)
        initGraph()
        if (rebuildStatusTimer) {
          clearInterval(rebuildStatusTimer)
          rebuildStatusTimer = null
        }
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
    stats.totalEntities += data.createdEntities
    stats.totalRelations += data.createdRelations
    showExtractModal.value = false
    initGraph()
  } catch (e: any) {
    message.error(e?.message || '确认失败')
  } finally {
    extracting.value = false
  }
}

const handleResize = () => {
  chartInstance?.resize()
}

onMounted(() => {
  nextTick(() => {
    initGraph()
  })
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
