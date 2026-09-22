<template>
  <div class="cluster-panel-page">
    <a-spin :spinning="loading">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">聚类蒸馏</h2>
          <span class="page-subtitle">智能聚类分析，一键生成优质内容建议</span>
        </div>
      </div>

      <!-- Stats Row -->
      <a-row :gutter="[12, 12]" class="stats-row">
        <a-col :xs="12" :sm="6" v-for="item in statItems" :key="item.key">
          <div class="stat-card" :class="`stat-card--${item.color}`">
            <div class="stat-card__icon"><component :is="item.icon" /></div>
            <div class="stat-card__body">
              <div class="stat-card__value">{{ item.value }}</div>
              <div class="stat-card__label">{{ item.label }}</div>
            </div>
          </div>
        </a-col>
      </a-row>

      <!-- Charts on TOP -->
      <a-row :gutter="[16, 16]" class="charts-row">
        <a-col :xs="24" :lg="12">
          <div class="section-card chart-card">
            <div class="section-card__title">
              <RadarChartOutlined class="title-icon" />
              <span>聚类质量雷达图</span>
            </div>
            <div ref="radarChartRef" class="chart-container"></div>
          </div>
        </a-col>
        <a-col :xs="24" :lg="12">
          <div class="section-card chart-card">
            <div class="section-card__title">
              <BarChartOutlined class="title-icon" />
              <span>聚类优先级排行</span>
            </div>
            <div ref="priorityRankChartRef" class="chart-container"></div>
          </div>
        </a-col>
      </a-row>

      <!-- Distill Toolbar + Cluster Table -->
      <div class="section-card cluster-table-card">
        <!-- Toolbar: actions + filters -->
        <div class="toolbar">
          <div class="toolbar__actions">
            <a-button
              type="primary"
              size="large"
              :loading="distilling"
              class="btn-primary"
              @click="distillAll"
            >
              <template #icon><ExperimentOutlined /></template>
              {{ distilling ? '蒸馏中...' : '一键智能蒸馏' }}
            </a-button>
            <a-button size="large" :loading="generating" @click="generateAllSuggestions">
              <template #icon><RocketOutlined /></template>
              批量生成建议
            </a-button>
            <a-button
              danger
              size="large"
              :loading="clearing"
              :disabled="selectedClusterKeys.length === 0"
              @click="batchDeleteClusters"
            >
              <template #icon><DeleteOutlined /></template>
              批量删除{{ selectedClusterKeys.length > 0 ? ` (${selectedClusterKeys.length})` : '' }}
            </a-button>
          </div>

          <div class="toolbar__filters">
            <a-input-search
              v-model:value="searchText"
              placeholder="搜索聚类 / 关键词"
              style="width: 220px"
              allow-clear
              @search="filterClusters"
            />
            <a-select v-model:value="priorityFilter" style="width: 140px" placeholder="优先级" allowClear>
              <a-select-option value="all">全部优先级</a-select-option>
              <a-select-option value="high">高 (≥80)</a-select-option>
              <a-select-option value="medium">中 (60-79)</a-select-option>
              <a-select-option value="low">低 (&lt;60)</a-select-option>
            </a-select>
          </div>
        </div>

        <!-- Cluster Table -->
        <a-table
          :scroll="{ x: 'max-content' }"
          :columns="tableColumns"
          :data-source="filteredClusters"
          :row-selection="{
            selectedRowKeys: selectedClusterKeys,
            onChange: (keys: (string | number)[]) => selectedClusterKeys = keys,
            preserveSelectedRowKeys: true,
          }"
          :pagination="{ pageSize: 8, showSizeChanger: true, pageSizeOptions: ['8', '16', '32'] }"
          :row-key="(record: any) => record.id"
          :locale="{ emptyText: '暂无聚类数据，点击上方「一键智能蒸馏」开始' }"
          size="middle"
          bordered
        >
          <!-- Priority column with progress -->
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'priority'">
              <div class="priority-cell">
                <a-progress
                  type="line"
                  :percent="record.priority || 0"
                  :show-info="false"
                  size="small"
                  :stroke-color="getPriorityColor(record.priority)"
                  style="width: 80px; margin-right: 8px"
                />
                <a-tag :color="getPriorityTagColor(record.priority)" class="priority-tag-sm">
                  P{{ record.priority || 0 }}
                </a-tag>
              </div>
            </template>

            <template v-else-if="column.key === 'keywords'">
              <div class="kw-tag-cloud-sm">
                <a-tag
                  v-for="kw in (record.keywords || []).slice(0, 4)"
                  :key="kw"
                  size="small"
                  class="kw-tag-sm"
                >
                  {{ kw }}
                </a-tag>
                <a-tag v-if="(record.keywords || []).length > 4" size="small" class="more-kw-tag">
                  +{{ (record.keywords || []).length - 4 }}
                </a-tag>
                <span v-if="!record.keywords?.length" class="empty-hint">—</span>
              </div>
            </template>

            <template v-else-if="column.key === 'suggestions'">
              <span v-if="record.contentSuggestions?.length">
                <a-tag color="green" class="count-tag">
                  <BulbOutlined /> {{ record.contentSuggestions.length }}
                </a-tag>
                <a
                  class="expand-link"
                  @click.stop="showClusterDetail(record)"
                >
                  查看
                </a>
              </span>
              <span v-else class="gray-hint">—</span>
            </template>

            <template v-else-if="column.key === 'date'">
              <span class="gray-hint">{{ formatDate(record.createdAt) }}</span>
            </template>

            <template v-else-if="column.key === 'actions'">
              <a-space size="small">
                <a-tooltip title="查看/编辑内容建议">
                  <a-button type="link" size="small" @click="openSuggestionModal(record)">
                    <BulbOutlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="生成文章">
                  <a-button type="link" size="small" @click="generateSingleArticle(record)">
                    <EditOutlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="详情">
                  <a-button type="link" size="small" @click="showClusterDetail(record)">
                    <EyeOutlined />
                  </a-button>
                </a-tooltip>
                <a-dropdown :trigger="['click']">
                  <template #overlay>
                    <a-menu>
                      <a-menu-item danger @click="deleteCluster(record)">
                        <DeleteOutlined /> 删除
                      </a-menu-item>
                    </a-menu>
                  </template>
                  <a-button type="text" size="small"><MoreOutlined /></a-button>
                </a-dropdown>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>

      <!-- Modals -->
      <a-modal v-model:open="showClusterModal" title="聚类详情" width="700px" :footer="null">
        <div v-if="selectedCluster" class="cluster-detail">
          <div class="detail-row">
            <div class="detail-label">聚类名称</div>
            <div class="detail-value">{{ selectedCluster.name }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">优先级</div>
            <div class="detail-value">
              <a-tag :color="getPriorityTagColor(selectedCluster.priority)">
                P{{ selectedCluster.priority }}
              </a-tag>
            </div>
          </div>
          <div class="detail-row">
            <div class="detail-label">搜索意图</div>
            <div class="detail-value">{{ selectedCluster.searchIntent || '-' }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">文章方向</div>
            <div class="detail-value">{{ selectedCluster.articleDirection || '-' }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">关键词列表</div>
            <div class="detail-value">
              <div class="kw-cloud">
                <a-tag
                  v-for="kw in (selectedCluster.keywords || []).slice(0, 10)"
                  :key="kw"
                  size="small"
                  class="kw-tag"
                >
                  {{ kw }}
                </a-tag>
                <a-tag v-if="(selectedCluster.keywords || []).length > 10" size="small" class="more-kw-tag">
                  +{{ (selectedCluster.keywords || []).length - 10 }}
                </a-tag>
              </div>
            </div>
          </div>
          <div class="detail-row">
            <div class="detail-label">创建时间</div>
            <div class="detail-value">{{ formatDate(selectedCluster.createdAt) }}</div>
          </div>
          <div class="detail-actions">
            <a-button type="primary" @click="generateSuggestions(selectedCluster)">
              <template #icon><BulbOutlined /></template>
              生成内容建议
            </a-button>
            <a-button @click="generateSingleArticle(selectedCluster)">
              <template #icon><EditOutlined /></template>
              生成文章
            </a-button>
          </div>
        </div>
      </a-modal>

      <!-- 内容建议编辑弹窗 -->
      <a-modal
        v-model:open="suggestionModalOpen"
        :title="`内容建议 · ${editingCluster?.name || ''}`"
        width="94vw"
        :footer="null"
        destroy-on-close
        :body-style="{ maxHeight: '78vh', overflowY: 'auto' }"
      >
        <div v-if="editingSuggestions.length === 0" class="suggestion-empty">
          <a-empty description="暂无内容建议，点击下方按钮重新生成" />
        </div>
        <div v-else>
          <a-row :gutter="[12, 12]">
            <a-col
              v-for="(sug, i) in pagedEditingSuggestions"
              :key="editingPage * 100 + i"
              :xs="24"
              :sm="8"
            >
              <div class="suggestion-card">
                <div class="suggestion-card__head">
                  <span class="suggestion-card__index">#{{ editingPage * editingPageSize + i + 1 }}</span>
                  <a-input v-model:value="sug.title" class="suggestion-card__title" borderless placeholder="标题" />
                  <a-tag :color="getScoreTagColor(sug.score)" size="small">{{ sug.score ?? 50 }}分</a-tag>
                </div>
                <div class="suggestion-card__body">
                  <a-textarea
                    v-model:value="sug.contentPrompt"
                    :rows="3"
                    placeholder="生成提示词"
                    class="suggestion-card__textarea"
                  />
                  <a-input v-model:value="sug.reason" placeholder="生成依据（可选）" class="suggestion-card__reason" />
                </div>
              </div>
            </a-col>
          </a-row>
          <div v-if="editingTotalPages > 1" class="suggestion-pagination">
            <a-pagination
              v-model:current="editingPage"
              :total="editingSuggestions.length"
              :page-size="editingPageSize"
              size="small"
              show-less-items
            />
          </div>
        </div>
        <div class="suggestion-edit-footer">
          <a-button @click="suggestionModalOpen = false">取消</a-button>
          <a-button
            :loading="regeneratingSuggestions"
            @click="regenerateSuggestions"
          >
            <ReloadOutlined /> 重新生成
          </a-button>
          <a-button
            type="primary"
            :loading="savingSuggestions"
            :disabled="editingSuggestions.length === 0"
            @click="saveSuggestions"
          >
            <SaveOutlined /> 保存
          </a-button>
        </div>
      </a-modal>

      <!-- 两阶段蒸馏：抽屉（loading → 预览勾选 → 确认保存） -->
      <a-drawer
        v-model:open="distillDrawerOpen"
        @close="closeDistillDrawer"
        title="一键智能蒸馏 · 预览结果"
        width="980px"
        :mask-closable="false"
        :close-on-click-modal="false"
        destroy-on-close
      >
        <!-- 阶段 0：蒸馏 loading -->
        <div v-if="distillPhase === 'loading'" class="drawer-loading">
          <a-spin size="large" />
          <div class="drawer-loading__title">正在智能蒸馏…</div>
          <p class="drawer-loading__desc">
            {{ distillSource
              ? '正在按 ' + (distillSource === 'rule_fallback' ? '规则聚类' : 'AI模型') + ' 聚合关键词'
              : '正在拉取待蒸馏关键词、执行聚类算法与内容建议…' }}
          </p>
          <a-progress :percent="distillProgress" status="active" style="width: 380px" />
          <div class="drawer-loading__steps">阶段 {{ currentDistillStep }} / {{ totalDistillSteps }}</div>
        </div>

        <!-- 错误态（蒸馏失败/无词） -->
        <div v-else-if="distillError && previewClusters.length === 0" class="drawer-empty">
          <ExperimentOutlined class="empty-icon" />
          <div class="empty-title">蒸馏异常</div>
          <p class="empty-desc">{{ distillError }}</p>
          <a-space>
            <a-button @click="closeDistillDrawer"><CloseOutlined /> 关闭</a-button>
            <a-button type="primary" @click="distillAll"><ExperimentOutlined /> 重新蒸馏</a-button>
          </a-space>
        </div>

        <!-- 阶段 1：预览结果 -->
        <template v-else>
          <!-- 顶部：摘要 + 搜索筛选 -->
          <div class="drawer-summary">
            <a-row :gutter="[12, 12]">
              <a-col :xs="12" :sm="6">
                <div class="mini-stat mini-stat--total">
                  <div class="mini-stat__value">{{ previewStats.total }}</div>
                  <div class="mini-stat__label">识别聚类</div>
                </div>
              </a-col>
              <a-col :xs="12" :sm="6">
                <div class="mini-stat mini-stat--selected">
                  <div class="mini-stat__value">{{ previewStats.selected }}</div>
                  <div class="mini-stat__label">已选保存</div>
                </div>
              </a-col>
              <a-col :xs="12" :sm="6">
                <div class="mini-stat mini-stat--high">
                  <div class="mini-stat__value">{{ previewStats.high }}</div>
                  <div class="mini-stat__label">高优先级 (≥80)</div>
                </div>
              </a-col>
              <a-col :xs="12" :sm="6">
                <div class="mini-stat mini-stat--sugg">
                  <div class="mini-stat__value">{{ previewStats.suggestions }}</div>
                  <div class="mini-stat__label">内容建议数</div>
                </div>
              </a-col>
            </a-row>
            <a-alert
              class="drawer-alert"
              type="info"
              show-icon
              :message="
                (distillSource === 'rule_fallback'
                  ? '当前未配置 AI 模型，已按规则聚类生成预览。管理员配置 AI 模型后，可获得更精准的语义聚类。'
                  : '蒸馏完成！请勾选要保存的聚类（默认已全选），然后点击右下角「确认保存」合并到下方列表。') + distillBatchHint
              "
            />
          </div>

          <!-- 筛选工具栏 -->
          <div class="drawer-toolbar">
            <div class="drawer-toolbar__left">
              <a-input-search
                v-model:value="previewSearch"
                placeholder="搜索聚类/搜索意图/关键词"
                style="width: 280px"
                allow-clear
              />
              <a-select
                v-model:value="previewPriority"
                style="width: 160px; margin-left: 8px"
                allow-clear
                placeholder="按优先级筛选"
              >
                <a-select-option value="all">全部优先级</a-select-option>
                <a-select-option value="high">高 (≥80)</a-select-option>
                <a-select-option value="medium">中 (60–79)</a-select-option>
                <a-select-option value="low">低 (<60)</a-select-option>
              </a-select>
            </div>
            <div class="drawer-toolbar__right">
              <a-button @click="previewSelectedRowKeys = filteredPreviewClusters.map((c: any) => String(c.id))" size="small">
                全选当前筛选结果
              </a-button>
              <a-button @click="previewSelectedRowKeys = []" size="small" style="margin-left: 8px">
                清空选择
              </a-button>
            </div>
          </div>

          <!-- 预览表格（带行选 / 展开 suggestions / 列渲染） -->
          <a-table
            :columns="previewDrawerTableColumns"
            :data-source="filteredPreviewClusters"
            :row-selection="{
              selectedRowKeys: previewSelectedRowKeys,
              onChange: onPreviewSelectChange,
              preserveSelectedRowKeys: true,
            }"
            :pagination="{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
            :row-key="(record: any) => String(record.id)"
            size="small"
            bordered
            :scroll="{ x: 1000, y: 'calc(100vh - 520px)' }"
            style="margin-top: 12px"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'priority'">
                <div class="priority-cell">
                  <a-progress
                    type="line"
                    :percent="record.priority || 0"
                    :show-info="false"
                    size="small"
                    :stroke-color="getPriorityColor(record.priority)"
                    style="width: 70px; margin-right: 6px"
                  />
                  <a-tag :color="getPriorityTagColor(record.priority)" style="margin: 0">
                    P{{ record.priority || 0 }}
                  </a-tag>
                </div>
              </template>

              <template v-else-if="column.key === 'cat'">
                <a-tag v-if="record.suggestedCategory" color="purple">{{ record.suggestedCategory }}</a-tag>
                <span v-else class="gray-hint">—</span>
              </template>

              <template v-else-if="column.key === 'sugg'">
                <a-tag v-if="record.contentSuggestions?.length" color="green">
                  <BulbOutlined /> {{ record.contentSuggestions.length }}
                </a-tag>
                <span v-else class="gray-hint">0</span>
              </template>

              <template v-else-if="column.key === 'kws'">
                <div class="kw-tag-cloud-sm">
                  <a-tag
                    v-for="(kw, i) in (record.keywords || []).slice(0, 3)"
                    :key="kw + i"
                    size="small"
                    class="kw-tag-sm"
                  >
                    {{ kw }}
                  </a-tag>
                  <a-tag
                    v-if="(record.keywords || []).length > 3"
                    size="small"
                    class="more-kw-tag"
                  >
                    +{{ (record.keywords || []).length - 3 }}
                  </a-tag>
                  <span v-if="!record.keywords?.length" class="gray-hint">—</span>
                </div>
              </template>
            </template>

            <!-- 展开行：显示内容建议列表 + 搜索意图 + 文章方向 -->
            <template #expandedRowRender="{ record }">
              <div class="preview-expand">
                <a-row :gutter="[12, 12]">
                  <a-col :xs="24" :md="12">
                    <div class="expand-block">
                      <div class="expand-block__title">搜索意图</div>
                      <p class="expand-block__text">{{ record.searchIntent || '—' }}</p>
                    </div>
                  </a-col>
                  <a-col :xs="24" :md="12">
                    <div class="expand-block">
                      <div class="expand-block__title">文章方向</div>
                      <p class="expand-block__text">{{ record.articleDirection || '—' }}</p>
                    </div>
                  </a-col>
                </a-row>
                <div class="expand-block">
                  <div class="expand-block__title">
                    内容建议
                    <a-tag color="green" style="margin-left: 8px">{{ (record.contentSuggestions || []).length }} 条</a-tag>
                  </div>
                  <a-row :gutter="[12, 12]" v-if="record.contentSuggestions?.length">
                    <a-col
                      :xs="24"
                      :sm="12"
                      v-for="(sug, i) in record.contentSuggestions"
                      :key="(sug.id ?? i) + '-' + (sug.title || i)"
                    >
                      <div class="suggestion-item">
                        <div class="suggestion-title-row">
                          <span class="suggestion-title">{{ sug.title }}</span>
                          <a-tag :color="getScoreTagColor(sug.score)" size="small">{{ sug.score }}分</a-tag>
                        </div>
                        <p class="suggestion-desc">{{ sug.contentPrompt || sug.suggestion }}</p>
                        <div v-if="sug.reason" class="suggestion-reason">
                          <ClockCircleOutlined /> 生成依据：{{ sug.reason }}
                        </div>
                      </div>
                    </a-col>
                  </a-row>
                  <span v-else class="gray-hint">（未生成内容建议，保存后可在列表中再生成）</span>
                </div>
              </div>
            </template>
          </a-table>
        </template>

        <!-- 底部：取消 / 仅保存选中 / 确认保存全部 -->
        <template #footer>
          <div class="drawer-footer">
            <a-button
              @click="closeDistillDrawer"
              :disabled="distillPhase === 'confirming'"
            >
              <CloseOutlined /> 关闭
            </a-button>
            <template v-if="!distillError || previewClusters.length">
              <a-button
                type="primary"
                :loading="distillPhase === 'confirming'"
                :disabled="distillPhase === 'loading'"
                ghost
                @click="confirmSave(true)"
              >
                <CheckOutlined /> 仅保存选中
                <span v-if="previewStats.selected" class="footer-sub"> ({{ previewStats.selected }} 条)</span>
              </a-button>
              <a-button
                type="primary"
                :loading="distillPhase === 'confirming'"
                :disabled="distillPhase === 'loading' || previewClusters.length === 0"
                @click="confirmSave(false)"
              >
                <CheckOutlined /> 确认保存全部 ({{ previewClusters.length }} 条)
              </a-button>
            </template>
          </div>
        </template>
      </a-drawer>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import * as echarts from 'echarts'
import { useAuthStore } from '../../stores/auth'
import {
  ApartmentOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  RocketOutlined,
  DeleteOutlined,
  FireOutlined,
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  RadarChartOutlined,
  BarChartOutlined,
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue'
import { clusterApi, suggestionApi } from '../../api'
import http from '../../api/http'
import { useRouter } from 'vue-router'
import type { KeywordCluster, KeywordContentSuggestion } from '../../types/workspace'

const authStore = useAuthStore()
const router = useRouter()

watch(() => authStore.selectedTenantId, () => {
  loadData()
})

const loading = ref(false)
const distilling = ref(false)
// 两阶段蒸馏：抽屉 + preview/confirm
const distillDrawerOpen = ref(false)
const distillPhase = ref<'loading' | 'ready' | 'confirming'>('loading')
const distillSource = ref<'ai_model' | 'rule_fallback' | 'empty' | ''>('')
const distillBatchHint = ref('')
const previewClusters = ref<KeywordCluster[]>([])
const previewSelectedRowKeys = ref<string[]>([])
const previewSearch = ref('')
const previewPriority = ref<string>('all')
const distillError = ref<string>('')
const generating = ref(false)
const clearing = ref(false)
const selectedClusterKeys = ref<(string | number)[]>([])
const searchText = ref('')
const priorityFilter = ref('all')
const distillProgress = ref(0)
const currentDistillStep = ref(0)
const totalDistillSteps = ref(0)

const radarChartRef = ref<HTMLElement>()
const priorityRankChartRef = ref<HTMLElement>()
let radarChart: echarts.ECharts | null = null
let priorityRankChart: echarts.ECharts | null = null

// Table columns
const tableColumns = [
  { title: '聚类名称', dataIndex: 'name', key: 'name', ellipsis: true, width: 180 },
  { title: '优先级', dataIndex: 'priority', key: 'priority', width: 170, align: 'center' as const },
  { title: '关键词', dataIndex: 'keywords', key: 'keywords' },
  { title: '内容建议', dataIndex: 'suggestions', key: 'suggestions', width: 140, align: 'center' as const },
  { title: '关键词数', dataIndex: 'keywordCount', key: 'kwCount', width: 100, align: 'center' as const,
    customRender: ({ record }: any) =>
      record.keywordCount || record.keywords?.length || 0
  },
  { title: '创建时间', dataIndex: 'date', key: 'date', width: 120, align: 'center' as const },
  { title: '操作', dataIndex: 'actions', key: 'actions', width: 170, fixed: 'right' as const, align: 'center' as const },
]

// 基于真实聚类数据计算雷达图指标
const radarData = computed(() => {
  const list = clusters.value as any[]
  if (list.length === 0) {
    return {
      indicators: [
        { name: '聚类质量', max: 100 },
        { name: '关键词多样性', max: 100 },
        { name: '建议相关性', max: 100 },
        { name: '语义一致性', max: 100 },
        { name: '覆盖范围', max: 100 },
        { name: '时效性', max: 100 }
      ],
      values: [0, 0, 0, 0, 0, 0]
    }
  }

  const avgPriority = list.reduce((sum: number, c: any) => sum + (c.priority || 0), 0) / list.length

  const avgKeywords = list.reduce((sum: number, c: any) => {
    const kwCount = c.keywords?.length || c.sourceKeywordIds ? 1 : 0
    return sum + Math.min(kwCount || 5, 10)
  }, 0) / list.length
  const keywordDiversity = Math.round((avgKeywords / 10) * 100)

  const clustersWithSuggCount = Object.keys(suggestionsMap.value).length
  const suggestionRelevance = list.length > 0 ? Math.round((clustersWithSuggCount / list.length) * 100) : 0

  const withIntent = list.filter((c: any) => c.searchIntent && c.searchIntent.trim().length > 0).length
  const semanticConsistency = list.length > 0 ? Math.round((withIntent / list.length) * 100) : 0

  const withDirection = list.filter((c: any) => c.articleDirection && c.articleDirection.trim().length > 0).length
  const coverage = list.length > 0 ? Math.round((withDirection / list.length) * 100) : 0

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recent = list.filter((c: any) => {
    if (!c.createdAt) return false
    return new Date(c.createdAt) >= sevenDaysAgo
  }).length
  const timeliness = list.length > 0 ? Math.round((recent / list.length) * 100) : 0

  return {
    indicators: [
      { name: '聚类质量', max: 100 },
      { name: '关键词多样性', max: 100 },
      { name: '建议相关性', max: 100 },
      { name: '语义一致性', max: 100 },
      { name: '覆盖范围', max: 100 },
      { name: '时效性', max: 100 }
    ],
    values: [Math.round(avgPriority), keywordDiversity, suggestionRelevance, semanticConsistency, coverage, timeliness]
  }
})

// 聚类优先级排行：top 10 按优先级降序，横向柱状图
const priorityRankData = computed(() => {
  const list = clusters.value as any[]
  if (list.length === 0) {
    return { names: [] as string[], values: [] as number[], categories: [] as string[], keywordCounts: [] as number[], suggestionCounts: [] as number[] }
  }
  const sorted = [...list].sort((a, b) => (b.priority || 0) - (a.priority || 0)).slice(0, 10)
  return {
    names: sorted.map((c: any) => c.name?.length > 8 ? c.name.slice(0, 8) + '…' : (c.name || '未知')),
    values: sorted.map((c: any) => c.priority ?? 0),
    categories: sorted.map((c: any) => c.category || '综合'),
    keywordCounts: sorted.map((c: any) => c.keywordCount ?? 0),
    suggestionCounts: sorted.map((c: any) => (suggestionsMap.value[c.id!] || []).length),
  }
})

const stats = reactive({
  totalClusters: 0,
  hasSuggestions: 0,
})

const highPriorityCount = computed(() =>
  (clusters.value as any[]).filter((c: any) => (c.priority || 0) >= 80).length
)

const statItems = computed(() => {
  const pendingCount = Math.max(stats.totalClusters - stats.hasSuggestions, 0)
  return [
    { key: 'total', value: stats.totalClusters, label: '聚类总数', icon: ApartmentOutlined, color: 'blue' },
    { key: 'high', value: highPriorityCount.value, label: '高优先级', icon: FireOutlined, color: 'red' },
    { key: 'suggestions', value: stats.hasSuggestions, label: '已生成建议', icon: BulbOutlined, color: 'green' },
    { key: 'pending', value: pendingCount, label: '待蒸馏', icon: ClockCircleOutlined, color: 'orange' },
  ]
})

const clusters = ref<KeywordCluster[]>([])
const suggestionsMap = ref<Record<number, KeywordContentSuggestion[]>>({})

const clustersWithSuggestions = computed(() => {
  return clusters.value.map((cluster: any) => ({
    ...cluster,
    contentSuggestions: cluster.contentSuggestions?.length
      ? cluster.contentSuggestions
      : (suggestionsMap.value[cluster.id!] || []),
  }))
})

const filteredClusters = computed(() => {
  let list = [...clustersWithSuggestions.value]
  // sort: high priority first
  list.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))
  if (searchText.value) {
    list = list.filter(
      (item: any) =>
        (item.name && item.name.includes(searchText.value)) ||
        (item.keywords && item.keywords.some((kw: string) => kw.includes(searchText.value)))
    )
  }
  if (priorityFilter.value && priorityFilter.value !== 'all') {
    list = list.filter((item: any) => {
      const p = item.priority || 0
      if (priorityFilter.value === 'high') return p >= 80
      if (priorityFilter.value === 'medium') return p >= 60 && p < 80
      return p < 60
    })
  }
  return list
})

function getPriorityTagColor(priority?: number) {
  const p = priority || 0
  if (p >= 80) return 'red'
  if (p >= 60) return 'orange'
  return 'green'
}

function getPriorityColor(priority?: number) {
  const p = priority || 0
  if (p >= 80) return '#ff4d4f'
  if (p >= 60) return '#fa8c16'
  return '#52c41a'
}

function getScoreTagColor(score?: number) {
  const s = score || 0
  if (s >= 90) return 'success'
  if (s >= 80) return 'processing'
  return 'default'
}

function filterClusters() {
  loadData()
}

const showClusterModal = ref(false)
const selectedCluster = ref<KeywordCluster | null>(null)

// 内容建议编辑弹窗
const suggestionModalOpen = ref(false)
const editingCluster = ref<KeywordCluster | null>(null)
const editingSuggestions = ref<any[]>([])
const regeneratingSuggestions = ref(false)
const savingSuggestions = ref(false)
const editingPage = ref(1)
const editingPageSize = 6

const pagedEditingSuggestions = computed(() => {
  const start = (editingPage.value - 1) * editingPageSize
  return editingSuggestions.value.slice(start, start + editingPageSize)
})

const editingTotalPages = computed(() =>
  Math.ceil(editingSuggestions.value.length / editingPageSize)
)

function showClusterDetail(item: any) {
  selectedCluster.value = item
  showClusterModal.value = true
}

function formatDate(date?: string) {
  if (!date) return '-'
  return date.slice(0, 10)
}

async function loadData() {
  loading.value = true
  try {
    const [clustersRes, suggestionsRes] = await Promise.all([
      clusterApi.list({ tenantId: authStore.selectedTenantId || undefined }),
      suggestionApi.list({ tenantId: authStore.selectedTenantId || undefined }),
    ])
    const clustersData = clustersRes.records
    const suggestionsData = suggestionsRes.records
    clusters.value = clustersData as any
    stats.totalClusters = clustersData.length
    stats.hasSuggestions = 0
    const map: Record<number, KeywordContentSuggestion[]> = {}
    suggestionsData.forEach((s: any) => {
      const cid = s.keywordClusterId || s.clusterId
      if (cid) {
        if (!map[cid]) map[cid] = []
        map[cid].push(s)
      }
    })
    suggestionsMap.value = map
    stats.hasSuggestions = Object.keys(map).length
  } catch (error) {
    clusters.value = []
    suggestionsMap.value = {}
    stats.totalClusters = 0
    stats.hasSuggestions = 0
    message.error('加载数据失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function distillAll() {
  // 一键智能蒸馏：打开抽屉，进入 loading → preview → 用户勾选 → confirm 落库
  distillDrawerOpen.value = true
  distillPhase.value = 'loading'
  distillSource.value = ''
  distillBatchHint.value = ''
  previewClusters.value = []
  previewSelectedRowKeys.value = []
  distillError.value = ''
  distilling.value = true
  distillProgress.value = 10
  currentDistillStep.value = 1
  totalDistillSteps.value = 2

  try {
    const res = await clusterApi.distill({
      tenantId: authStore.selectedTenantId || undefined,
      preview: true,
    })
    distillProgress.value = 90
    previewClusters.value = res.clusters || []
    distillSource.value = (res.distillSource as any) || (res.usedRuleFallback ? 'rule_fallback' : 'ai_model')
    distillBatchHint.value = res.remainingKeywords
      ? `本批只处理了 ${res.processedKeywords ?? 0} 个待聚类词，剩余 ${res.remainingKeywords} 个仍是待处理状态，再点一次「一键智能蒸馏」可继续。`
      : ''
    if (res.clusterCount === 0 || previewClusters.value.length === 0) {
      distillError.value = '没有可蒸馏的关键词，请先去「热词管理」做一次采集，或在「关键词」里导入待处理词。'
      distillPhase.value = 'ready'
      distillProgress.value = 100
      currentDistillStep.value = 2
      return
    }
    // 不默认选中，由用户按需勾选
    previewSelectedRowKeys.value = []
    distillPhase.value = 'ready'
    distillProgress.value = 100
    currentDistillStep.value = 2
  } catch (error: any) {
    distillError.value = error?.message || '蒸馏失败'
    distillPhase.value = 'ready'
    message.error('蒸馏失败：' + (error?.message || '系统异常'))
    console.error(error)
  } finally {
    distilling.value = false
  }
}

function onPreviewSelectChange(keys: (string | number)[]) {
  previewSelectedRowKeys.value = keys.map(String)
}

const filteredPreviewClusters = computed(() => {
  let list = previewClusters.value.slice()
  const q = previewSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter((c: any) => {
      const text = `${c.name || ''} ${c.searchIntent || ''} ${c.suggestedCategory || ''} ${(c.keywords || []).join(' ')}`.toLowerCase()
      return text.includes(q)
    })
  }
  if (previewPriority.value === 'high') {
    list = list.filter((c: any) => (c.priority || 0) >= 80)
  } else if (previewPriority.value === 'medium') {
    list = list.filter((c: any) => {
      const p = c.priority || 0
      return p >= 60 && p < 80
    })
  } else if (previewPriority.value === 'low') {
    list = list.filter((c: any) => (c.priority || 0) < 60)
  }
  // 按优先级倒序排列（高分在前）
  list.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))
  return list
})

const previewStats = computed(() => {
  const total = previewClusters.value.length
  // 只统计当前筛选结果中被选中的数量（与用户实际看到的一致）
  const filteredIds = new Set(filteredPreviewClusters.value.map(c => String(c.id)))
  const selected = previewSelectedRowKeys.value.filter(k => filteredIds.has(String(k))).length
  const high = previewClusters.value.filter((c: any) => (c.priority || 0) >= 80).length
  const suggestions = previewClusters.value.reduce((sum, c: any) => sum + ((c.contentSuggestions || []).length), 0)
  return { total, selected, high, suggestions }
})

function closeDistillDrawer() {
  if (distillPhase.value === 'confirming') return
  if (previewClusters.value.length && !distillError.value) {
    Modal.confirm({
      title: '关闭蒸馏结果',
      content: `当前有 ${previewStats.value.selected || previewClusters.value.length} 条聚类尚未保存，关闭后会丢失，确定关闭吗？`,
      okText: '确定关闭',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        distillDrawerOpen.value = false
      },
    })
  } else {
    distillDrawerOpen.value = false
  }
}

function getSelectedPreviewClusters(): KeywordCluster[] {
  const selIds = new Set(previewSelectedRowKeys.value.map(k => String(k)))
  if (selIds.size === 0) return []
  // 只从当前筛选结果中取选中的，与用户实际看到的一致
  return filteredPreviewClusters.value.filter(c => selIds.has(String(c.id)))
}

async function confirmSave(onlySelected = true) {
  const toSave = onlySelected ? getSelectedPreviewClusters() : previewClusters.value.slice()
  if (!toSave.length) {
    message.warning('请先勾选要保存的聚类（至少 1 条）')
    return
  }
  distillPhase.value = 'confirming'
  try {
    const res = await clusterApi.confirmDistill(
      { clusters: toSave },
      { tenantId: authStore.selectedTenantId || undefined }
    )
    message.success(`已保存 ${res.clusterCount || 0} 条聚类到列表`)
    distillDrawerOpen.value = false
    await loadData()
  } catch (error) {
    message.error('保存失败，请重试')
    console.error(error)
  } finally {
    distillPhase.value = 'ready'
  }
}

const previewDrawerTableColumns = [
  { title: '聚类名称', dataIndex: 'name', key: 'name', width: 260, ellipsis: true },
  { title: '优先级', dataIndex: 'priority', key: 'priority', width: 150, align: 'center' as const },
  { title: '建议分类', dataIndex: 'suggestedCategory', key: 'cat', width: 110, align: 'center' as const },
  { title: '搜索意图', dataIndex: 'searchIntent', key: 'intent', ellipsis: true },
  { title: '内容建议', dataIndex: 'contentSuggestions', key: 'sugg', width: 110, align: 'center' as const },
  { title: '涉及关键词', dataIndex: 'keywords', key: 'kws', width: 230 },
]

async function generateAllSuggestions() {
  generating.value = true
  try {
    for (const cluster of clusters.value) {
      await clusterApi.generateSuggestions(cluster.id, { tenantId: authStore.selectedTenantId || undefined })
    }
    message.success('内容建议生成完成！')
    await loadData()
  } catch (error) {
    message.error('生成建议失败')
    console.error(error)
  } finally {
    generating.value = false
  }
}

async function generateSuggestions(cluster: KeywordCluster) {
  try {
    await clusterApi.generateSuggestions(cluster.id, { tenantId: authStore.selectedTenantId || undefined })
    message.success('内容建议生成完成！')
    await loadData()
  } catch (error) {
    message.error('生成建议失败')
    console.error(error)
  }
}

// 打开内容建议编辑弹窗
function openSuggestionModal(cluster: KeywordCluster) {
  editingCluster.value = cluster
  editingSuggestions.value = (cluster.contentSuggestions || []).map((s: any) => ({ ...s }))
  editingPage.value = 1
  suggestionModalOpen.value = true
}

// 重新生成内容建议
async function regenerateSuggestions() {
  if (!editingCluster.value) return
  regeneratingSuggestions.value = true
  try {
    const res = await clusterApi.generateSuggestions(editingCluster.value.id, { tenantId: authStore.selectedTenantId || undefined })
    const newSugs = Array.isArray(res) ? res : (editingCluster.value.contentSuggestions || [])
    editingSuggestions.value = newSugs.map((s: any) => ({ ...s }))
    message.success('内容建议已重新生成')
  } catch (error) {
    message.error('重新生成失败')
    console.error(error)
  } finally {
    regeneratingSuggestions.value = false
  }
}

// 保存内容建议
async function saveSuggestions() {
  if (!editingSuggestions.value.length) {
    message.warning('暂无内容建议可保存')
    return
  }
  savingSuggestions.value = true
  try {
    for (const sug of editingSuggestions.value) {
      if (!sug.id || sug.id < 0) continue
      await suggestionApi.update(sug.id, {
        title: sug.title || '',
        contentPrompt: sug.contentPrompt || sug.suggestion || '',
        score: sug.score ?? 50,
        reason: sug.reason || '',
        status: sug.status || 'candidate',
      })
    }
    message.success('内容建议已保存')
    suggestionModalOpen.value = false
    await loadData()
  } catch (error) {
    message.error('保存失败')
    console.error(error)
  } finally {
    savingSuggestions.value = false
  }
}

function generateArticle(suggestion: KeywordContentSuggestion) {
  message.info(`开始生成文章: ${suggestion.title}`)
}

function generateSingleArticle(cluster: any) {
  router.push({
    name: 'workspace-article-generate',
    query: {
      clusterId: cluster.id,
      clusterName: cluster.name,
    },
  })
}

async function deleteCluster(cluster: KeywordCluster) {
  Modal.confirm({
    title: '确认删除聚类',
    content: `确定要删除聚类「${cluster.name}」吗？此操作会同时删除相关的内容建议，无法恢复。`,
    okText: '确定',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await http.delete(`/workspace/clusters/${cluster.id}`)
        message.success('聚类删除成功')
        await loadData()
      } catch (error) {
        message.error('删除失败')
        console.error(error)
      }
    },
  })
}

async function batchDeleteClusters() {
  const count = selectedClusterKeys.value.length
  if (count === 0) {
    message.warning('请先勾选要删除的聚类')
    return
  }
  Modal.confirm({
    title: '确认批量删除',
    content: `确定要删除选中的 ${count} 条聚类吗？此操作会同时删除相关的内容建议，无法恢复。`,
    okText: '确定',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      clearing.value = true
      try {
        await http.delete('/workspace/clusters/batch', { data: selectedClusterKeys.value })
        message.success(`已删除 ${count} 条聚类`)
        selectedClusterKeys.value = []
        await loadData()
      } catch (error) {
        message.error('删除失败')
        console.error(error)
      } finally {
        clearing.value = false
      }
    },
  })
}

const initRadarChart = () => {
  if (!radarChartRef.value) return
  radarChart = echarts.init(radarChartRef.value)

  const d = radarData.value
  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#f0f0f0', textStyle: { color: '#333' } },
    radar: {
      indicator: d.indicators,
      shape: 'polygon',
      splitNumber: 5,
      axisName: { color: '#666', fontSize: 12 },
      splitLine: { lineStyle: { color: 'rgba(114,46,209,0.12)' } },
      splitArea: { show: true, areaStyle: { color: ['rgba(114,46,209,0.02)', 'rgba(114,46,209,0.05)'] } },
      axisLine: { lineStyle: { color: 'rgba(114,46,209,0.15)' } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: d.values,
        name: '质量评分',
        areaStyle: { color: 'rgba(114,46,209,0.2)' },
        lineStyle: { color: '#722ed1', width: 2 },
        itemStyle: { color: '#722ed1' }
      }]
    }]
  }
  radarChart.setOption(option)
}

const initPriorityRankChart = () => {
  if (!priorityRankChartRef.value) return
  // 复用已有实例，避免重复 init 导致 zrender 叠加
  priorityRankChart = echarts.getInstanceByDom(priorityRankChartRef.value) || echarts.init(priorityRankChartRef.value)

  const d = priorityRankData.value as any
  if (d.names.length === 0) {
    priorityRankChart.setOption({ title: { text: '暂无数据，先点击一键智能蒸馏', left: 'center', top: 'center', textStyle: { color: '#94a3b8', fontSize: 14 } } }, true)
    return
  }

  // 按优先级着色：≥80 红、60-79 橙、<60 蓝
  const barColors = d.values.map((v: number) => {
    if (v >= 80) return '#ef4444'
    if (v >= 60) return '#f59e0b'
    return '#3b82f6'
  })

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const name = d.names[idx]
        const val = d.values[idx]
        const cat = d.categories[idx]
        const kw = d.keywordCounts[idx]
        const sugg = d.suggestionCounts[idx]
        return `<b>${name}</b><br/>优先级：<b>${val}</b><br/>分类：${cat}<br/>关键词数：${kw}<br/>内容建议：${sugg} 条`
      },
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#1e293b' }
    },
    grid: { left: '2%', right: '8%', top: '4%', bottom: '4%', containLabel: true },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { fontSize: 11, color: '#64748b' },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    yAxis: {
      type: 'category',
      data: d.names,
      axisLabel: { fontSize: 11, color: '#475569' },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [{
      type: 'bar',
      data: d.values.map((v: number, i: number) => ({
        value: v,
        itemStyle: { color: barColors[i], borderRadius: [0, 4, 4, 0] }
      })),
      barWidth: '60%',
      label: {
        show: true,
        position: 'right',
        formatter: (p: any) => `P${p.value}`,
        fontSize: 11,
        color: '#475569',
      },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.15)' } },
    }]
  }
  priorityRankChart.setOption(option, true)
}

const handleResize = () => {
  radarChart?.resize()
  priorityRankChart?.resize()
}

watch([radarData, priorityRankData], () => {
  if (radarChart) {
    const d = radarData.value
    radarChart.setOption({
      tooltip: { trigger: 'item' },
      radar: { indicator: d.indicators, shape: 'polygon', splitNumber: 5 },
      series: [{
        type: 'radar',
        data: [{
          value: d.values,
          name: '质量评分',
          areaStyle: { color: 'rgba(114,46,209,0.2)' },
          lineStyle: { color: '#722ed1', width: 2 },
          itemStyle: { color: '#722ed1' }
        }]
      }]
    }, true)
  }
  if (priorityRankChart) {
    initPriorityRankChart()
  }
}, { deep: true })

onMounted(() => {
  loadData()
  setTimeout(() => {
    initRadarChart()
    initPriorityRankChart()
    window.addEventListener('resize', handleResize)
  }, 100)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  radarChart?.dispose()
  priorityRankChart?.dispose()
})
</script>

<style scoped lang="less">
// Design tokens
@purple-500: #722ed1;
@purple-600: #531dab;
@purple-light: #f9f0ff;

@blue-500: #1890ff;
@green-500: #52c41a;
@orange-500: #fa8c16;
@red-500: #ff4d4f;

@gray-100: #fafafa;
@gray-200: #f0f0f0;
@gray-300: #d9d9d9;
@gray-400: #bfbfbf;
@gray-500: #8c8c8c;
@gray-600: #595959;
@gray-700: #434343;
@gray-900: #1a1a1a;

@radius-md: 10px;
@radius-lg: 12px;
@shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.1);

.cluster-panel-page {
  width: 100%;
  padding: 4px 0 24px 0;
  box-sizing: border-box;
}

// Page Header
.page-header {
  margin-bottom: 16px;
  padding: 0 4px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: @gray-900;
  margin: 0;
  letter-spacing: -0.01em;
}

.page-subtitle {
  font-size: 13px;
  color: @gray-500;
}

// Stats
.stats-row {
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid @gray-200;
  border-radius: @radius-md;
  padding: 14px 16px;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    border-color: @purple-500;
    box-shadow: @shadow-hover;
  }

  &__icon {
    width: 38px; height: 38px;
    border-radius: @radius-md;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; color: #fff;
    flex-shrink: 0;
  }

  &__body { display: flex; flex-direction: column; min-width: 0; }

  &__value {
    font-size: 22px; font-weight: 700;
    line-height: 1.1; color: @gray-900;
  }

  &__label {
    font-size: 12px; color: @gray-500; margin-top: 2px;
  }

  &--blue &__icon { background: @blue-500; }
  &--red &__icon { background: @red-500; }
  &--green &__icon { background: @green-500; }
  &--orange &__icon { background: @orange-500; }
}

// Section Card
.section-card {
  background: #fff;
  border: 1px solid @gray-200;
  border-radius: @radius-lg;
  overflow: hidden;
}

.section-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: @gray-700;
  padding: 14px 18px 0 18px;
}

.title-icon {
  color: @purple-500;
  font-size: 15px;
}

// Charts on top
.charts-row {
  margin-bottom: 16px;
}

.chart-container {
  height: 280px;
  width: 100%;
  padding: 12px 8px 8px 8px;
  box-sizing: border-box;
}

// ===== Cluster Table Card =====
.cluster-table-card {
  margin-bottom: 0;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid @gray-200;
  background: @gray-100;

  &__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  &__filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
}

.btn-primary {
  height: 40px;
  font-weight: 600;
  background: @purple-500 !important;
  border: none !important;
  box-shadow: 0 2px 8px rgba(114, 46, 209, 0.25);

  &:hover {
    background: @purple-600 !important;
    box-shadow: 0 4px 12px rgba(114, 46, 209, 0.35);
  }
}

// Distill progress inline
.distill-progress {
  padding: 10px 18px;
  background: @purple-light;
  display: flex;
  align-items: center;
  gap: 16px;

  :deep(.ant-progress) { flex: 1; max-width: 520px; }

  .progress-text {
    font-size: 12px;
    color: @gray-600;
    white-space: nowrap;
  }
}

// Priority cell
.priority-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.priority-tag-sm {
  margin: 0;
  min-width: 42px;
  text-align: center;
}

// Keywords cloud (in table)
.kw-tag-cloud-sm {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.kw-tag-sm {
  margin: 0;
}

.more-kw-tag {
  margin: 0;
  background: @gray-100;
  color: @gray-500;
  border: none;
}

.count-tag {
  margin: 0;
}

.expand-link {
  font-size: 12px;
  margin-left: 6px;
  color: @purple-500;
  cursor: pointer;

  &:hover { color: @purple-600; text-decoration: underline; }
}

.gray-hint {
  color: @gray-400;
}

.empty-hint {
  font-size: 12px;
  color: @gray-400;
}

// Expanded suggestion
.suggestion-expanded {
  padding: 8px 24px 16px 48px;
  background: #fcfcff;
}

.suggestion-item {
  padding: 12px 14px;
  background: @purple-light;
  border-radius: @radius-md;
  border-left: 3px solid @purple-500;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.suggestion-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 8px;
}

.suggestion-title {
  font-size: 13px;
  font-weight: 600;
  color: @gray-900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.suggestion-desc {
  font-size: 12px;
  color: @gray-500;
  margin: 0 0 10px 0;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

// Suggestion Edit Modal
.suggestion-empty {
  padding: 32px 0;
  text-align: center;
}

.suggestion-card-list {
  max-height: none;
}

.suggestion-card {
  border: 1px solid @gray-200;
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: @gray-100;
    border-bottom: 1px solid @gray-200;
  }

  &__index {
    font-weight: 600;
    color: #1677ff;
    font-size: 14px;
    flex-shrink: 0;
  }

  &__title {
    flex: 1;
    font-weight: 500;
    font-size: 14px;

    :deep(.ant-input) {
      padding: 0 4px;
      font-weight: 500;
    }
  }

  &__body {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__textarea {
    :deep(.ant-input) {
      font-size: 13px;
    }
  }

  &__reason {
    :deep(.ant-input) {
      font-size: 12px;
      color: @gray-500;
    }
  }
}

.suggestion-pagination {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

.suggestion-edit-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid @gray-200;
  margin-top: 4px;
}

// Cluster Detail Modal
.cluster-detail {
  .detail-row {
    display: flex;
    margin-bottom: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid @gray-200;

    &:last-of-type:not(.detail-actions) {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
  }

  .detail-label {
    width: 100px;
    font-size: 13px;
    font-weight: 600;
    color: @gray-500;
    flex-shrink: 0;
  }

  .detail-value {
    flex: 1;
    font-size: 13px;
    color: @gray-900;
  }

  .kw-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .detail-actions {
    display: flex;
    gap: 10px;
    border-top: 1px solid @gray-200;
    padding-top: 16px;
    margin-top: 4px;
  }
}

// Table tweak: hide default expand icon for rows without suggestions — we already show placeholder
:deep(.ant-table-row-expand-icon) {
  cursor: pointer;
}

// Responsive
@media (max-width: 992px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .page-title { font-size: 19px; }
  .chart-container { height: 220px; }
}

/* ============ 蒸馏抽屉样式 ============ */
.drawer-loading {
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #475569;
  &__title { font-size: 18px; font-weight: 600; color: #1e293b; margin-top: 8px; }
  &__desc  { margin: 0; color: #64748b; }
  &__steps { color: #94a3b8; font-size: 12px; }
}
.drawer-empty {
  min-height: 50vh;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  color: #64748b;
  .empty-icon { font-size: 48px; color: #94a3b8; }
  .empty-title { font-size: 17px; font-weight: 600; color: #1e293b; }
  .empty-desc { max-width: 540px; text-align: center; margin: 0; }
}
.drawer-summary {
  .mini-stat {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
    display: flex; flex-direction: column; gap: 4px;
    &__value { font-size: 22px; font-weight: 700; }
    &__label { font-size: 12px; color: #64748b; }
  }
  .mini-stat--total    &__value { color: #2563eb; }
  .mini-stat--selected &__value { color: #16a34a; }
  .mini-stat--high     &__value { color: #dc2626; }
  .mini-stat--sugg     &__value { color: #722ed1; }
  .drawer-alert { margin-top: 12px; }
}
.drawer-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 12px;
  &__left, &__right { display: flex; align-items: center; }
}
.drawer-footer {
  display: flex; justify-content: flex-end; align-items: center; gap: 10px;
  .footer-sub { font-size: 12px; opacity: 0.92; margin-left: 2px; }
}
.preview-expand {
  padding: 4px 8px 8px;
  .expand-block {
    background: #f8fafc;
    border: 1px solid #eef2f7;
    border-radius: 8px;
    padding: 10px 12px;
    margin-top: 8px;
    &__title { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; }
    &__text  { margin: 0; color: #475569; line-height: 1.65; }
  }
}
.suggestion-reason {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
  display: flex; align-items: center; gap: 4px;
}
</style>
