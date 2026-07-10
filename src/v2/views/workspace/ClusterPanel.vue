<template>
  <div class="cluster-panel-page">
    <a-spin :spinning="loading">
      <!-- Page Header -->
      <div class="page-header" :class="{ 'fade-in-up': !loading }">
        <div class="header-left">
          <div class="header-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" opacity="0.3"/>
              <circle cx="24" cy="24" r="14" stroke="currentColor" stroke-width="2" opacity="0.5"/>
              <circle cx="24" cy="24" r="8" fill="currentColor" opacity="0.8"/>
              <circle cx="14" cy="18" r="3" fill="currentColor"/>
              <circle cx="34" cy="18" r="3" fill="currentColor"/>
              <circle cx="24" cy="32" r="3" fill="currentColor"/>
            </svg>
          </div>
          <div class="header-text">
            <h2 class="page-title">聚类蒸馏</h2>
            <span class="page-subtitle">智能聚类分析，一键生成优质内容建议</span>
          </div>
        </div>
        <div class="header-right">
          <a-tag color="purple" class="header-tag">
            <template #icon><ExperimentOutlined /></template>
            AI 智能蒸馏
          </a-tag>
        </div>
      </div>

      <!-- Stats Cards -->
      <a-row :gutter="[16, 16]" class="stats-row">
        <a-col :xs="24" :sm="12" :md="6" v-for="(item, index) in statItems" :key="item.key"
               class="stat-col" :style="{ animationDelay: `${index * 0.08}s` }">
          <div class="stat-card" :class="`stat-card--${item.color}`" @click="handleStatClick(item)">
            <div class="stat-card__glow" aria-hidden="true"></div>
            <div class="stat-card__pattern" aria-hidden="true">
              <svg viewBox="0 0 100 100" fill="none">
                <circle cx="85" cy="15" r="35" stroke="currentColor" stroke-width="0.5" opacity="0.25"/>
                <circle cx="95" cy="5" r="25" stroke="currentColor" stroke-width="0.5" opacity="0.15"/>
              </svg>
            </div>
            <div class="stat-card__content">
              <div class="stat-card__top">
                <div class="stat-card__icon">
                  <component :is="item.icon" />
                </div>
                <div class="stat-card__trend" :class="item.trend > 0 ? 'trend-up' : 'trend-down'">
                  <span class="trend-arrow">{{ item.trend > 0 ? '↗' : '↘' }}</span>
                  <span class="trend-value">{{ Math.abs(item.trend) }}%</span>
                </div>
              </div>
              <div class="stat-card__value">
                <span class="value-number">{{ item.value }}</span>
                <span class="value-unit">{{ item.unit }}</span>
              </div>
              <div class="stat-card__bottom">
                <span class="stat-card__label">{{ item.label }}</span>
              </div>
            </div>
          </div>
        </a-col>
      </a-row>

      <!-- Top Keywords Section -->
      <div class="section-card top-keywords-card" :class="{ 'fade-in-up': !loading }" style="margin-top: 20px">
        <div class="section-card__header">
          <div class="section-card__title">
            <StarOutlined class="title-icon star-icon" />
            <span>今日精选关键词</span>
            <a-tag color="gold" class="top-badge">TOP 3</a-tag>
          </div>
          <div class="section-card__actions">
            <a-button type="primary" size="large" class="btn-primary-gradient" @click="distillAll" :loading="distilling">
              <template #icon><ExperimentOutlined /></template>
              {{ distilling ? '蒸馏中...' : '一键蒸馏' }}
            </a-button>
            <a-button size="large" class="btn-secondary" @click="generateAllSuggestions" :loading="generating">
              <template #icon><RocketOutlined /></template>
              批量生成建议
            </a-button>
          </div>
        </div>

        <a-row :gutter="[20, 20]" class="top-keywords-row">
          <a-col :xs="24" :md="8" v-for="(keyword, idx) in topKeywords" :key="idx">
            <div class="top-keyword-card" :class="`rank-${idx + 1}`"
                 :style="{ animationDelay: `${(idx + 4) * 0.1}s` }">
              <div class="card-rank-badge">
                <CrownOutlined v-if="idx === 0" />
                <span v-else>{{ idx + 1 }}</span>
              </div>
              <div class="keyword-header">
                <div class="keyword-name">{{ keyword.name }}</div>
                <div class="keyword-priority-wrap">
                  <div class="priority-bar">
                    <div class="priority-fill" :style="{ width: `${keyword.priority}%` }"></div>
                  </div>
                  <span class="priority-score">{{ keyword.priority }}分</span>
                </div>
              </div>

              <div class="keyword-section">
                <div class="section-label">
                  <AppstoreOutlined /> 来源分布
                </div>
                <div class="source-distribution">
                  <a-tag color="blue">搜索</a-tag>
                  <a-tag color="green">新闻</a-tag>
                  <a-tag color="orange">社交</a-tag>
                </div>
              </div>

              <div class="keyword-section">
                <div class="section-label">
                  <TagsOutlined /> 相关关键词
                </div>
                <div class="related-tags">
                  <a-tag v-for="tag in keyword.tags.slice(0, 5)" :key="tag" size="small" class="related-tag">
                    {{ tag }}
                  </a-tag>
                </div>
              </div>

              <div class="keyword-section">
                <div class="section-label">
                  <ThunderboltOutlined /> 语义扩展推荐
                </div>
                <div class="extension-tags">
                  <a-tag v-for="word in keyword.related.slice(0, 4)" :key="word" color="purple" size="small">
                    {{ word }}
                  </a-tag>
                </div>
              </div>

              <div class="keyword-actions">
                <a-button type="primary" class="btn-generate" size="large" @click="generateSingleArticle(keyword)">
                  <template #icon><EditOutlined /></template>
                  一键生成文章
                </a-button>
                <a-button class="btn-detail" size="large" @click="showKeywordDetail(keyword)">
                  <template #icon><EyeOutlined /></template>
                  查看详情
                </a-button>
              </div>
            </div>
          </a-col>
        </a-row>
      </div>

      <!-- Main Content: Action + Cluster List -->
      <a-row :gutter="20" class="main-content" style="margin-top: 20px">
        <!-- Action Card -->
        <a-col :xs="24" :lg="8">
          <div class="section-card action-card" :class="{ 'fade-in-up': !loading }">
            <div class="section-card__title">
              <ControlOutlined class="title-icon" />
              <span>蒸馏操作</span>
            </div>

            <div class="main-action-area">
              <a-button
                type="primary"
                size="large"
                :loading="distilling"
                block
                class="btn-distill"
                @click="distillAll"
              >
                <template #icon><ExperimentOutlined /></template>
                {{ distilling ? '蒸馏中...' : '一键智能蒸馏' }}
              </a-button>
              <div v-if="distilling" class="distill-progress">
                <a-progress :percent="distillProgress" :show-info="false" size="small" />
                <span class="progress-text">正在蒸馏第 {{ currentDistillStep }}/{{ totalDistillSteps }} 个聚类...</span>
              </div>
            </div>

            <a-divider class="custom-divider" />

            <div class="action-section">
              <div class="section-title">
                <SettingOutlined /> 蒸馏设置
              </div>
              <a-space direction="vertical" style="width: 100%">
                <div class="setting-item">
                  <span class="setting-label">每日自动蒸馏</span>
                  <a-switch v-model:checked="distillConfig.autoDistill" />
                </div>
                <div class="setting-item" v-if="distillConfig.autoDistill">
                  <span class="setting-label">蒸馏时间</span>
                  <a-time-picker v-model:value="distillConfig.distillTime" format="HH:mm" size="small" />
                </div>
                <a-button block class="btn-config" @click="showDistillConfig = true">
                  <template #icon><SettingOutlined /></template>
                  蒸馏参数配置
                </a-button>
              </a-space>
            </div>

            <a-divider class="custom-divider" />

            <div class="action-section">
              <div class="section-title">
                <ThunderboltOutlined /> 快捷操作
              </div>
              <a-space direction="vertical" style="width: 100%">
                <a-button block class="btn-action" @click="generateAllSuggestions" :loading="generating">
                  <template #icon><RocketOutlined /></template>
                  批量生成内容建议
                </a-button>
                <a-button block danger class="btn-danger" @click="clearAllClusters" :loading="clearing">
                  <template #icon><DeleteOutlined /></template>
                  清空所有聚类
                </a-button>
              </a-space>
            </div>

            <a-divider class="custom-divider" />

            <div class="action-section">
              <div class="section-title">
                <InfoCircleOutlined /> 蒸馏质量
              </div>
              <div class="quality-score">
                <div class="score-circle">
                  <span class="score-number">85</span>
                  <span class="score-label">分</span>
                </div>
                <div class="score-desc">
                  <div class="score-item">
                    <span>聚类质量</span>
                    <span class="score-val">优秀</span>
                  </div>
                  <div class="score-item">
                    <span>建议相关性</span>
                    <span class="score-val">良好</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </a-col>

        <!-- Cluster List -->
        <a-col :xs="24" :lg="16">
          <div class="section-card cluster-list-card" :class="{ 'fade-in-up': !loading }">
            <div class="section-card__header">
              <div class="section-card__title">
                <UnorderedListOutlined class="title-icon" />
                <span>聚类列表</span>
                <a-tag color="blue" class="count-badge">{{ filteredClusters.length }} 个聚类</a-tag>
              </div>
              <div class="section-card__filters">
                <a-input-search
                  v-model:value="searchText"
                  placeholder="搜索聚类"
                  style="width: 200px"
                  @search="filterClusters"
                  allow-clear
                />
                <a-select v-model:value="priorityFilter" style="width: 130px" placeholder="优先级筛选" allowClear>
                  <a-select-option value="all">全部优先级</a-select-option>
                  <a-select-option value="high">高优先级(≥80)</a-select-option>
                  <a-select-option value="medium">中优先级(60-79)</a-select-option>
                  <a-select-option value="low">低优先级(<60)</a-select-option>
                </a-select>
              </div>
            </div>

            <div class="cluster-cards-grid">
              <a-row :gutter="[16, 16]">
                <a-col :xs="24" :sm="12" :xl="8" v-for="(item, index) in filteredClusters" :key="item.id">
                  <div class="cluster-card" :style="{ animationDelay: `${(index % 6) * 0.05}s` }">
                    <div class="cluster-card-header">
                      <div class="cluster-title-area">
                        <span class="cluster-name">{{ item.name }}</span>
                        <a-tag :color="getPriorityTagColor(item.priority)" class="priority-tag">
                          P{{ item.priority }}
                        </a-tag>
                      </div>
                      <a-dropdown :trigger="['click']">
                        <template #overlay>
                          <a-menu>
                            <a-menu-item @click="generateSuggestions(item)">
                              <BulbOutlined /> 生成建议
                            </a-menu-item>
                            <a-menu-item @click="showClusterDetail(item)">
                              <EyeOutlined /> 查看详情
                            </a-menu-item>
                            <a-menu-divider />
                            <a-menu-item danger @click="deleteCluster(item)">
                              <DeleteOutlined /> 删除聚类
                            </a-menu-item>
                          </a-menu>
                        </template>
                        <a-button type="text" size="small" class="more-btn">
                          <MoreOutlined />
                        </a-button>
                      </a-dropdown>
                    </div>

                    <div class="cluster-keywords-section">
                      <div class="section-label-sm">关键词</div>
                      <div class="keyword-tag-cloud">
                        <a-tag
                          v-for="kw in item.keywords?.slice(0, 6)"
                          :key="kw"
                          size="small"
                          class="kw-tag"
                        >
                          {{ kw }}
                        </a-tag>
                        <a-tag v-if="item.keywords?.length > 6" size="small" class="more-kw-tag">
                          +{{ item.keywords.length - 6 }}
                        </a-tag>
                      </div>
                    </div>

                    <div class="cluster-stats">
                      <div class="stat-item">
                        <span class="stat-icon-sm"><FileTextOutlined /></span>
                        <span class="stat-text">{{ item.keywordCount || item.keywords?.length || 0 }} 个关键词</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-icon-sm"><BulbOutlined /></span>
                        <span class="stat-text" :class="{ 'has-suggestions': item.contentSuggestions?.length }">
                          {{ item.contentSuggestions?.length || 0 }} 条建议
                        </span>
                      </div>
                    </div>

                    <div v-if="item.contentSuggestions?.length > 0" class="suggestions-preview">
                      <div class="suggestions-toggle" @click="toggleSuggestions(index)">
                        <span class="toggle-label">内容建议 ({{ item.contentSuggestions.length }})</span>
                        <span class="toggle-icon">
                          {{ expandedSuggestions.includes(index) ? '收起' : '展开' }}
                          <DownOutlined :class="{ 'rotate-up': expandedSuggestions.includes(index) }" />
                        </span>
                      </div>
                      <div v-show="expandedSuggestions.includes(index)" class="suggestions-list">
                        <div
                          v-for="sug in item.contentSuggestions.slice(0, 3)"
                          :key="sug.id"
                          class="suggestion-item"
                        >
                          <div class="suggestion-title-row">
                            <span class="suggestion-title">{{ sug.title }}</span>
                            <a-tag :color="getScoreTagColor(sug.score)" size="small">
                              {{ sug.score }}分
                            </a-tag>
                          </div>
                          <p class="suggestion-desc">{{ sug.contentPrompt || sug.suggestion }}</p>
                          <div class="suggestion-actions">
                            <a-button type="primary" size="small" @click="generateArticle(sug)">
                              生成文章
                            </a-button>
                            <a-button size="small">编辑模板</a-button>
                          </div>
                        </div>
                        <a v-if="item.contentSuggestions.length > 3" class="view-all-btn">
                          查看全部 {{ item.contentSuggestions.length }} 条建议
                        </a>
                      </div>
                    </div>

                    <div class="cluster-card-actions">
                      <a-button type="primary" size="small" class="btn-generate-article" @click="generateSingleArticle(item)">
                        <EditOutlined /> 一键生成文章
                      </a-button>
                      <a-button type="link" size="small" @click="generateSuggestions(item)">
                        <BulbOutlined /> 生成建议
                      </a-button>
                    </div>
                    <div class="cluster-card-footer">
                      <span class="cluster-date">{{ formatDate(item.createdAt) }}</span>
                    </div>
                  </div>
                </a-col>
              </a-row>
            </div>

            <a-empty v-if="filteredClusters.length === 0" description="暂无聚类数据" style="padding: 40px 0" />
          </div>
        </a-col>
      </a-row>

      <!-- Charts Section -->
      <a-row :gutter="20" style="margin-top: 20px">
        <a-col :xs="24" :lg="12">
          <div class="section-card chart-card" :class="{ 'fade-in-up': !loading }">
            <div class="section-card__title">
              <RadarChartOutlined class="title-icon" />
              <span>聚类质量雷达图</span>
            </div>
            <div ref="radarChartRef" class="chart-container"></div>
          </div>
        </a-col>
        <a-col :xs="24" :lg="12">
          <div class="section-card chart-card" :class="{ 'fade-in-up': !loading }">
            <div class="section-card__title">
              <HeatMapOutlined class="title-icon" />
              <span>关键词分布热力图</span>
            </div>
            <div ref="heatmapChartRef" class="chart-container"></div>
          </div>
        </a-col>
      </a-row>

      <!-- Modals -->
      <a-modal v-model:open="showDistillConfig" title="蒸馏参数配置" @ok="saveDistillConfig" width="600px">
        <a-form layout="vertical">
          <a-form-item label="聚类算法">
            <a-select v-model:value="distillConfig.algorithm" style="width: 100%">
              <a-select-option value="kmeans">K-Means 聚类</a-select-option>
              <a-select-option value="hierarchical">层次聚类</a-select-option>
              <a-select-option value="dbscan">DBSCAN 密度聚类</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="聚类数量">
            <a-slider v-model:value="distillConfig.clusterCount" :min="3" :max="20" />
            <div style="text-align: right">当前: {{ distillConfig.clusterCount }} 个聚类</div>
          </a-form-item>
          <a-form-item label="相似度阈值">
            <a-slider v-model:value="distillConfig.similarityThreshold" :min="0.5" :max="1" :step="0.05" />
            <div style="text-align: right">当前: {{ distillConfig.similarityThreshold }}</div>
          </a-form-item>
          <a-form-item label="每日自动蒸馏">
            <a-switch v-model:checked="distillConfig.autoDistill" />
            <span style="margin-left: 8px">启用每日自动蒸馏</span>
          </a-form-item>
          <a-form-item label="蒸馏时间">
            <a-time-picker v-model:value="distillConfig.distillTime" format="HH:mm" style="width: 100%" />
          </a-form-item>
        </a-form>
      </a-modal>

      <a-modal v-model:open="showKeywordModal" title="关键词语义扩展" width="800px" :footer="null">
        <div v-if="selectedKeyword" class="keyword-detail">
          <div class="keyword-detail-header">
            <h3 class="detail-title">{{ selectedKeyword.name }}</h3>
            <a-tag color="red" size="large">热度 {{ selectedKeyword.priority }}</a-tag>
          </div>
          <div class="semantic-extensions">
            <div class="extension-section">
              <div class="ext-header">
                <SyncOutlined /> 同义词
              </div>
              <div class="ext-tags">
                <a-tag v-for="w in selectedKeyword.synonyms" :key="w" color="blue" class="ext-tag">
                  {{ w }}
                </a-tag>
              </div>
            </div>
            <div class="extension-section">
              <div class="ext-header">
                <LinkOutlined /> 相关词
              </div>
              <div class="ext-tags">
                <a-tag v-for="w in selectedKeyword.related" :key="w" color="green" class="ext-tag">
                  {{ w }}
                </a-tag>
              </div>
            </div>
            <div class="extension-section">
              <div class="ext-header">
                <BranchesOutlined /> 长尾词
              </div>
              <div class="ext-tags">
                <a-tag v-for="w in selectedKeyword.longTail" :key="w" color="orange" class="ext-tag">
                  {{ w }}
                </a-tag>
              </div>
            </div>
          </div>
          <div class="detail-actions">
            <a-button type="primary" size="large" @click="generateSingleArticle(selectedKeyword)">
              <template #icon><EditOutlined /></template>
              生成文章
            </a-button>
          </div>
        </div>
      </a-modal>

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
  StarOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  RocketOutlined,
  SettingOutlined,
  DeleteOutlined,
  TrophyOutlined,
  FireOutlined,
  TagsOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  EditOutlined,
  EyeOutlined,
  ControlOutlined,
  InfoCircleOutlined,
  UnorderedListOutlined,
  MoreOutlined,
  FileTextOutlined,
  DownOutlined,
  RadarChartOutlined,
  HeatMapOutlined,
  SyncOutlined,
  LinkOutlined,
  BranchesOutlined,
  CrownOutlined,
} from '@ant-design/icons-vue'
import { clusterApi, suggestionApi } from '../../api'
import http from '../../api/http'
import type { KeywordCluster, KeywordContentSuggestion } from '../../types/workspace'

const authStore = useAuthStore()

watch(() => authStore.selectedTenantId, () => {
  loadData()
})

const loading = ref(false)
const distilling = ref(false)
const generating = ref(false)
const clearing = ref(false)
const searchText = ref('')
const priorityFilter = ref('all')
const showDistillConfig = ref(false)
const showKeywordModal = ref(false)
const expandedSuggestions = ref<number[]>([])
const distillProgress = ref(0)
const currentDistillStep = ref(0)
const totalDistillSteps = ref(0)

const radarChartRef = ref<HTMLElement>()
const heatmapChartRef = ref<HTMLElement>()
let radarChart: echarts.ECharts | null = null
let heatmapChart: echarts.ECharts | null = null

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

  // 聚类质量: 平均优先级分数
  const avgPriority = list.reduce((sum: number, c: any) => sum + (c.priority || 0), 0) / list.length

  // 关键词多样性: 平均每个聚类的关键词数量 (归一化到100, 假设10个词=100)
  const avgKeywords = list.reduce((sum: number, c: any) => {
    const kwCount = c.keywords?.length || c.sourceKeywordIds ? 1 : 0
    return sum + Math.min(kwCount || 5, 10)
  }, 0) / list.length
  const keywordDiversity = Math.round((avgKeywords / 10) * 100)

  // 建议相关性: 有建议的聚类占比
  const clustersWithSuggCount = Object.keys(suggestionsMap.value).length
  const suggestionRelevance = list.length > 0 ? Math.round((clustersWithSuggCount / list.length) * 100) : 0

  // 语义一致性: 有搜索意图的聚类占比
  const withIntent = list.filter((c: any) => c.searchIntent && c.searchIntent.trim().length > 0).length
  const semanticConsistency = list.length > 0 ? Math.round((withIntent / list.length) * 100) : 0

  // 覆盖范围: 有文章方向的聚类占比
  const withDirection = list.filter((c: any) => c.articleDirection && c.articleDirection.trim().length > 0).length
  const coverage = list.length > 0 ? Math.round((withDirection / list.length) * 100) : 0

  // 时效性: 最近7天内创建的聚类占比
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

// 基于真实聚类数据计算热力图
const heatmapData = computed(() => {
  const list = clusters.value as any[]

  if (list.length === 0) {
    return { xAxis: [], yAxis: [], data: [] }
  }

  // X轴: 取前5个聚类名称
  const topClusters = list.slice(0, 5).map((c: any) => c.name?.length > 4 ? c.name.slice(0, 4) + '..' : (c.name || '未知'))

  // Y轴: 按优先级分段 (高/中/低) + 有建议/无建议
  const yAxis = ['高优先级', '中优先级', '低优先级']

  const data: number[][] = []
  for (let x = 0; x < topClusters.length; x++) {
    const cluster = list[x]
    const priority = cluster.priority || 0
    const suggestionCount = (suggestionsMap.value[cluster.id!] || []).length

    // 高优先级行
    data.push([x, 0, priority >= 80 ? suggestionCount + 1 : 0])
    // 中优先级行
    data.push([x, 1, priority >= 60 && priority < 80 ? suggestionCount + 1 : 0])
    // 低优先级行
    data.push([x, 2, priority < 60 ? suggestionCount + 1 : 0])
  }

  const maxVal = Math.max(...data.map(d => d[2]), 1)

  return { xAxis: topClusters, yAxis, data, max: maxVal }
})

const stats = reactive({
  totalClusters: 0,
  hasSuggestions: 0,
})

// Stat items configuration
const statItems = computed(() => {
  const pendingCount = stats.totalClusters - stats.hasSuggestions
  return [
    {
      key: 'total',
      value: stats.totalClusters,
      label: '聚类总数',
      unit: '',
      icon: ApartmentOutlined,
      color: 'blue',
      trend: 0,
      path: '/cluster'
    },
    {
      key: 'top',
      value: topKeywords.value.length,
      label: '今日精选关键词',
      unit: '',
      icon: TrophyOutlined,
      color: 'gold',
      trend: 0,
      path: '/keywords'
    },
    {
      key: 'suggestions',
      value: stats.hasSuggestions,
      label: '已生成内容建议',
      unit: '',
      icon: BulbOutlined,
      color: 'green',
      trend: 0,
      path: '/suggestions'
    },
    {
      key: 'pending',
      value: pendingCount,
      label: '待蒸馏聚类数',
      unit: '',
      icon: ClockCircleOutlined,
      color: 'orange',
      trend: 0,
      path: '/pending'
    }
  ]
})

const clusters = ref<KeywordCluster[]>([])
const suggestionsMap = ref<Record<number, KeywordContentSuggestion[]>>({})

const distillConfig = reactive({
  algorithm: 'kmeans',
  clusterCount: 10,
  similarityThreshold: 0.7,
  autoDistill: false,
  distillTime: null as any,
})

const selectedKeyword = ref<any>(null)

const topKeywords = computed(() => {
  const sorted = [...clusters.value].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))
  return sorted.slice(0, 3).map((c: any) => ({
    id: c.id,
    name: c.name,
    priority: c.priority || 0,
    tags: c.keywords?.slice(0, 5) || [],
    synonyms: c.synonyms || [],
    related: c.relatedWords || [],
    longTail: c.longTailKeywords || [],
  }))
})

const clustersWithSuggestions = computed(() => {
  return clusters.value.map((cluster: any) => ({
    ...cluster,
    contentSuggestions: suggestionsMap.value[cluster.id!] || [],
  }))
})

const filteredClusters = computed(() => {
  let list = [...clustersWithSuggestions.value]
  if (searchText.value) {
    list = list.filter(
      (item: any) =>
        (item.name && item.name.includes(searchText.value)) ||
        (item.keywords && item.keywords.some((kw: string) => kw.includes(searchText.value)))
    )
  }
  if (priorityFilter.value !== 'all') {
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

function getScoreTagColor(score?: number) {
  const s = score || 0
  if (s >= 90) return 'success'
  if (s >= 80) return 'processing'
  return 'default'
}

function handleStatClick(item: any) {
  message.info(`跳转到 ${item.label} 页面`)
}

function toggleSuggestions(index: number) {
  const idx = expandedSuggestions.value.indexOf(index)
  if (idx > -1) {
    expandedSuggestions.value.splice(idx, 1)
  } else {
    expandedSuggestions.value.push(index)
  }
}

function filterClusters() {
  loadData()
}

const showClusterModal = ref(false)
const selectedCluster = ref<KeywordCluster | null>(null)

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
      if (s.keywordClusterId) {
        if (!map[s.keywordClusterId]) map[s.keywordClusterId] = []
        map[s.keywordClusterId].push(s)
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
  distilling.value = true
  distillProgress.value = 0
  currentDistillStep.value = 0
  totalDistillSteps.value = clusters.value.length || 10

  try {
    const res = await clusterApi.distill({ tenantId: authStore.selectedTenantId || undefined })
    distillProgress.value = 100
    currentDistillStep.value = totalDistillSteps.value
    message.success('蒸馏完成！')
    await loadData()
  } catch (error) {
    message.error('蒸馏失败')
    console.error(error)
  } finally {
    distilling.value = false
    distillProgress.value = 0
  }
}

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

function generateArticle(suggestion: KeywordContentSuggestion) {
  message.info(`开始生成文章: ${suggestion.title}`)
}

function generateSingleArticle(keyword: any) {
  message.info(`开始生成文章: ${keyword.name}`)
}

function showKeywordDetail(keyword: any) {
  selectedKeyword.value = keyword
  showKeywordModal.value = true
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

async function clearAllClusters() {
  Modal.confirm({
    title: '确认清空所有聚类',
    content: '此操作会删除所有聚类和对应的内容建议，无法恢复，确定继续吗？',
    okText: '确定',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      clearing.value = true
      try {
        await http.delete('/workspace/clusters/batch', { data: clusters.value.map(c => c.id) })
        message.success('所有聚类已清空')
        await loadData()
      } catch (error) {
        message.error('清空失败')
        console.error(error)
      } finally {
        clearing.value = false
      }
    },
  })
}

function saveDistillConfig() {
  message.success('蒸馏参数配置已保存')
  showDistillConfig.value = false
}

const initRadarChart = () => {
  if (!radarChartRef.value) return

  radarChart = echarts.init(radarChartRef.value)

  const d = radarData.value

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#f0f0f0',
      textStyle: { color: '#333' }
    },
    radar: {
      indicator: d.indicators,
      shape: 'polygon',
      splitNumber: 5,
      axisName: {
        color: '#666',
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(114, 46, 209, 0.12)'
        }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(114, 46, 209, 0.02)', 'rgba(114, 46, 209, 0.05)']
        }
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(114, 46, 209, 0.15)'
        }
      }
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: d.values,
            name: '质量评分',
            areaStyle: {
              color: 'rgba(114, 46, 209, 0.2)'
            },
            lineStyle: {
              color: '#722ed1',
              width: 2
            },
            itemStyle: {
              color: '#722ed1'
            }
          }
        ]
      }
    ]
  }

  radarChart.setOption(option)
}

const initHeatmapChart = () => {
  if (!heatmapChartRef.value) return

  heatmapChart = echarts.init(heatmapChartRef.value)

  const d = heatmapData.value

  if (d.xAxis.length === 0) {
    heatmapChart.setOption({
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#999', fontSize: 14 }
      }
    })
    return
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      position: 'top',
      formatter: (params: any) => {
        return `${d.xAxis[params.data[0]]} - ${d.yAxis[params.data[1]]}: ${params.data[2]}`
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#f0f0f0',
      textStyle: { color: '#333' }
    },
    grid: {
      left: '12%',
      right: '8%',
      top: '8%',
      bottom: '12%'
    },
    xAxis: {
      type: 'category',
      data: d.xAxis,
      splitArea: {
        show: true
      },
      axisLabel: {
        fontSize: 11,
        color: '#666'
      }
    },
    yAxis: {
      type: 'category',
      data: d.yAxis,
      splitArea: {
        show: true
      },
      axisLabel: {
        fontSize: 11,
        color: '#666'
      }
    },
    visualMap: {
      min: 0,
      max: d.max,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: {
        color: ['#f0f5ff', '#722ed1', '#391085']
      },
      textStyle: {
        color: '#666'
      }
    },
    series: [
      {
        type: 'heatmap',
        data: d.data,
        label: {
          show: true,
          fontSize: 11,
          color: '#fff'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: 'rgba(0, 0, 0, 0.25)'
          }
        }
      }
    ]
  }

  heatmapChart.setOption(option)
}

const handleResize = () => {
  radarChart?.resize()
  heatmapChart?.resize()
}

// 数据变化时更新图表
watch([radarData, heatmapData], () => {
  if (radarChart) {
    const d = radarData.value
    radarChart.setOption({
      radar: { indicator: d.indicators },
      series: [{ data: [{ value: d.values }] }]
    })
  }
  if (heatmapChart) {
    const d = heatmapData.value
    if (d.xAxis.length === 0) {
      heatmapChart.setOption({
        title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } },
        xAxis: { data: [] },
        yAxis: { data: [] },
        series: [{ data: [] }]
      })
    } else {
      heatmapChart.setOption({
        xAxis: { data: d.xAxis },
        yAxis: { data: d.yAxis },
        visualMap: { max: d.max },
        series: [{ data: d.data }]
      })
    }
  }
}, { deep: true })

onMounted(() => {
  loadData()
  setTimeout(() => {
    initRadarChart()
    initHeatmapChart()
    window.addEventListener('resize', handleResize)
  }, 100)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  radarChart?.dispose()
  heatmapChart?.dispose()
})
</script>

<style scoped lang="less">
// Design tokens
@purple-500: #722ed1;
@purple-400: #9254de;
@purple-600: #531dab;
@purple-light: #f9f0ff;
@indigo-500: #6366f1;
@cyan-500: #06b6d4;

@blue-500: #1890ff;
@green-500: #52c41a;
@orange-500: #fa8c16;
@gold-500: #faad14;

@gray-100: #fafafa;
@gray-200: #f5f5f5;
@gray-400: #d9d9d9;
@gray-500: #8c8c8c;
@gray-600: #595959;
@gray-700: #434343;
@gray-900: #1a1a1a;

@radius-sm: 8px;
@radius-md: 12px;
@radius-lg: 16px;

@shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
@shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);
@shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.12);

// Animation keyframes
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes breathe {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

// Global animations
.fade-in-up {
  animation: fadeInUp 0.6s ease-out forwards;
}

.stat-col {
  animation: fadeInUp 0.5s ease-out forwards;
  opacity: 0;
}

.cluster-panel-page {
  width: 100%;
  padding: 8px 0 24px 0;
  box-sizing: border-box;
}

// Page Header
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 0 4px;
  gap: 16px;

  &.fade-in-up {
    animation-delay: 0.1s;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  color: @purple-500;
  flex-shrink: 0;

  svg {
    width: 100%;
    height: 100%;
  }
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: @gray-900;
  margin: 0;
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: 13px;
  color: @gray-500;
}

.header-tag {
  font-size: 12px;
}

// Stats Cards
.stats-row {
  margin-bottom: 0;
}

.stat-card {
  position: relative;
  overflow: hidden;
  border-radius: @radius-lg;
  padding: 20px;
  min-height: 130px;
  cursor: pointer;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  background: #fff;
  border: 1px solid @gray-200;

  &:hover {
    transform: translateY(-6px);
    box-shadow: @shadow-lg;
  }

  &:focus-visible {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }

  &--blue {
    .stat-card__icon {
      background: linear-gradient(135deg, @blue-500 0%, #36cfc9 100%);
      box-shadow: 0 4px 16px rgba(24, 144, 255, 0.35);
    }
    .stat-card__glow {
      background: radial-gradient(circle at 30% 70%, rgba(24, 144, 255, 0.15) 0%, transparent 60%);
    }
    .stat-card__pattern { color: @blue-500; }
    .value-number { color: @blue-500; }
  }

  &--gold {
    .stat-card__icon {
      background: linear-gradient(135deg, @gold-500 0%, #ffec3d 100%);
      box-shadow: 0 4px 16px rgba(250, 173, 20, 0.35);
    }
    .stat-card__glow {
      background: radial-gradient(circle at 30% 70%, rgba(250, 173, 20, 0.15) 0%, transparent 60%);
    }
    .stat-card__pattern { color: @gold-500; }
    .value-number { color: @gold-500; }
  }

  &--green {
    .stat-card__icon {
      background: linear-gradient(135deg, @green-500 0%, #95de64 100%);
      box-shadow: 0 4px 16px rgba(82, 196, 26, 0.35);
    }
    .stat-card__glow {
      background: radial-gradient(circle at 30% 70%, rgba(82, 196, 26, 0.15) 0%, transparent 60%);
    }
    .stat-card__pattern { color: @green-500; }
    .value-number { color: @green-500; }
  }

  &--orange {
    .stat-card__icon {
      background: linear-gradient(135deg, @orange-500 0%, #ffc53d 100%);
      box-shadow: 0 4px 16px rgba(250, 140, 22, 0.35);
    }
    .stat-card__glow {
      background: radial-gradient(circle at 30% 70%, rgba(250, 140, 22, 0.15) 0%, transparent 60%);
    }
    .stat-card__pattern { color: @orange-500; }
    .value-number { color: @orange-500; }
  }
}

.stat-card__glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.stat-card__pattern {
  position: absolute;
  top: -20px;
  right: -20px;
  width: 120px;
  height: 120px;
  opacity: 0.5;
  pointer-events: none;

  svg {
    width: 100%;
    height: 100%;
  }
}

.stat-card__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.stat-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.stat-card__icon {
  width: 44px;
  height: 44px;
  border-radius: @radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
}

.stat-card__trend {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 20px;
  font-weight: 600;

  &.trend-up {
    color: @green-500;
    background: rgba(82, 196, 26, 0.1);
  }

  &.trend-down {
    color: #ff4d4f;
    background: rgba(255, 77, 79, 0.1);
  }
}

.trend-arrow {
  font-size: 10px;
}

.stat-card__value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 8px;
}

.value-number {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}

.value-unit {
  font-size: 14px;
  color: @gray-500;
}

.stat-card__bottom {
  margin-top: auto;
}

.stat-card__label {
  font-size: 13px;
  color: @gray-500;
}

// Section Card
.section-card {
  background: #fff;
  border-radius: @radius-lg;
  border: 1px solid @gray-200;
  overflow: hidden;

  &.fade-in-up {
    animation: fadeInUp 0.6s ease-out forwards;
  }

  &.top-keywords-card {
    background: linear-gradient(180deg, #fffbf0 0%, #fff 100%);
  }

  &.action-card {
    min-height: 100%;
  }

  &.chart-card {
    .chart-container {
      padding: 16px 8px 8px 8px;
    }
  }
}

.section-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid @gray-200;
  gap: 16px;
  flex-wrap: wrap;
}

.section-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: @gray-700;
}

.title-icon {
  color: @purple-500;
  font-size: 16px;
}

.star-icon {
  color: @gold-500;
}

.section-card__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.section-card__filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.top-badge,
.count-badge {
  margin: 0;
  margin-left: 4px;
}

// Buttons
.btn-primary-gradient {
  background: linear-gradient(135deg, @purple-500 0%, @purple-400 100%) !important;
  border: none !important;
  box-shadow: 0 4px 12px rgba(114, 46, 209, 0.3);

  &:hover {
    background: linear-gradient(135deg, @purple-600 0%, @purple-500 100%) !important;
    box-shadow: 0 6px 16px rgba(114, 46, 209, 0.4);
  }

  &:focus-visible {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }
}

.btn-secondary {
  background: #fff;
  border: 1px solid @gray-400;

  &:hover {
    border-color: @purple-500;
    color: @purple-500;
  }

  &:focus-visible {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }
}

.btn-config {
  background: @gray-100;
  border: 1px solid @gray-400;

  &:hover {
    border-color: @purple-500;
    color: @purple-500;
    background: @purple-light;
  }
}

.btn-action {
  background: #fff;
  border: 1px solid @gray-400;

  &:hover {
    border-color: @indigo-500;
    color: @indigo-500;
  }
}

.btn-danger {
  &:focus-visible {
    outline: 2px solid #ff4d4f;
    outline-offset: 2px;
  }
}

// Top Keywords
.top-keywords-row {
  margin-top: 8px;
  padding: 0 16px 16px 16px;
}

.top-keyword-card {
  position: relative;
  height: 100%;
  background: #fff;
  border: 2px solid @gray-200;
  border-radius: @radius-lg;
  padding: 28px 20px 20px 20px;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.35s;
  animation: fadeInUp 0.5s ease-out forwards;
  opacity: 0;

  &.rank-1 {
    border-color: #ffd700;
    background: linear-gradient(180deg, #fffbe6 0%, #fff 100%);

    .card-rank-badge {
      background: linear-gradient(135deg, #ffd700 0%, #ffb800 100%);
    }
  }

  &.rank-2 {
    border-color: #c0c0c0;
    background: linear-gradient(180deg, #fafafa 0%, #fff 100%);

    .card-rank-badge {
      background: linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%);
    }
  }

  &.rank-3 {
    border-color: #cd7f32;
    background: linear-gradient(180deg, #fff7e6 0%, #fff 100%);

    .card-rank-badge {
      background: linear-gradient(135deg, #cd7f32 0%, #a0522d 100%);
    }
  }

  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
  }
}

.card-rank-badge {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);

  .anticon {
    font-size: 18px;
  }
}

.keyword-header {
  text-align: center;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px dashed @gray-400;
}

.keyword-name {
  font-size: 22px;
  font-weight: 700;
  color: @gray-900;
  margin-bottom: 12px;
}

.keyword-priority-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.priority-bar {
  width: 100px;
  height: 6px;
  background: @gray-200;
  border-radius: 3px;
  overflow: hidden;
}

.priority-fill {
  height: 100%;
  background: linear-gradient(90deg, @green-500 0%, @gold-500 50%, #ff4d4f 100%);
  border-radius: 3px;
  transition: width 0.5s ease-out;
}

.priority-score {
  font-size: 15px;
  font-weight: 600;
  color: @gray-900;
}

.keyword-section {
  margin-bottom: 14px;
}

.section-label {
  font-size: 12px;
  color: @gray-500;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.source-distribution,
.related-tags,
.extension-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.related-tag {
  margin: 0;
}

.keyword-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid @gray-200;
}

.btn-generate {
  flex: 1.5;
  border-radius: @radius-sm;
  background: linear-gradient(135deg, @purple-500 0%, @purple-400 100%) !important;
  border: none !important;

  &:hover {
    background: linear-gradient(135deg, @purple-600 0%, @purple-500 100%) !important;
  }
}

.btn-detail {
  flex: 1;
  border-radius: @radius-sm;
}

// Action Card
.main-action-area {
  margin-bottom: 8px;
}

.btn-distill {
  height: 50px;
  font-size: 16px;
  font-weight: 600;
  border-radius: @radius-md;
  background: linear-gradient(135deg, @purple-500 0%, @purple-400 100%) !important;
  border: none !important;
  box-shadow: 0 4px 16px rgba(114, 46, 209, 0.3);

  &:hover {
    background: linear-gradient(135deg, @purple-600 0%, @purple-500 100%) !important;
    box-shadow: 0 6px 20px rgba(114, 46, 209, 0.4);
  }

  &:focus-visible {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }
}

.distill-progress {
  margin-top: 16px;
  padding: 12px;
  background: @purple-light;
  border-radius: @radius-sm;
}

.progress-text {
  display: block;
  font-size: 12px;
  color: @gray-600;
  margin-top: 8px;
  text-align: center;
}

.custom-divider {
  margin: 16px 0;
  border-color: @gray-200;
}

.action-section {
  margin-bottom: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: @gray-600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid @gray-200;

  .setting-label {
    font-size: 13px;
    color: @gray-600;
  }

  &:last-child {
    border-bottom: none;
  }
}

.quality-score {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: linear-gradient(135deg, @purple-light 0%, #fff 100%);
  border-radius: @radius-md;
}

.score-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, @purple-500 0%, @purple-400 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(114, 46, 209, 0.3);
}

.score-number {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.score-label {
  font-size: 11px;
  margin-top: 2px;
}

.score-desc {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.score-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: @gray-600;

  .score-val {
    font-weight: 600;
    color: @green-500;
  }
}

// Cluster List
.cluster-list-card {
  .section-card__header {
    background: @gray-100;
  }
}

.cluster-cards-grid {
  margin-top: 8px;
  padding: 16px;
}

.cluster-card {
  background: #fff;
  border: 1px solid @gray-200;
  border-radius: @radius-md;
  padding: 16px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.3s;
  animation: fadeInUp 0.4s ease-out forwards;
  opacity: 0;
  display: flex;
  flex-direction: column;
  height: 100%;

  &:hover {
    border-color: @purple-500;
    box-shadow: 0 8px 24px rgba(114, 46, 209, 0.12);
    transform: translateY(-4px);
  }

  &:focus-within {
    outline: 2px solid @indigo-500;
    outline-offset: 2px;
  }
}

.cluster-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 8px;
}

.cluster-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.cluster-name {
  font-size: 15px;
  font-weight: 600;
  color: @gray-900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.priority-tag {
  margin: 0;
  flex-shrink: 0;
}

.more-btn {
  flex-shrink: 0;

  &:hover {
    color: @purple-500;
    background: @purple-light;
  }
}

.cluster-keywords-section {
  margin-bottom: 12px;
}

.section-label-sm {
  font-size: 11px;
  color: @gray-500;
  margin-bottom: 6px;
}

.keyword-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.kw-tag {
  margin: 0;
}

.more-kw-tag {
  margin: 0;
  background: @gray-100;
  color: @gray-500;
  border: none;
}

.cluster-stats {
  display: flex;
  gap: 16px;
  padding: 10px 0;
  border-top: 1px solid @gray-200;
  border-bottom: 1px solid @gray-200;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: @gray-500;

  &.has-suggestions {
    color: @green-500;
  }
}

.stat-icon-sm {
  font-size: 12px;
}

.stat-text {
  font-size: 12px;
}

.suggestions-preview {
  margin-bottom: 12px;
  flex: 1;
}

.suggestions-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: @gray-100;
  border-radius: @radius-sm;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: @gray-200;
  }
}

.toggle-label {
  font-size: 12px;
  font-weight: 500;
  color: @gray-600;
}

.toggle-icon {
  font-size: 12px;
  color: @gray-500;
  display: flex;
  align-items: center;
  gap: 2px;

  .rotate-up {
    transform: rotate(180deg);
    transition: transform 0.2s;
  }
}

.suggestions-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-item {
  padding: 12px;
  background: @purple-light;
  border-radius: @radius-sm;
  border-left: 3px solid @purple-500;
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
}

.suggestion-desc {
  font-size: 12px;
  color: @gray-500;
  margin: 0 0 8px 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.suggestion-actions {
  display: flex;
  gap: 6px;
}

.view-all-btn {
  text-align: center;
  font-size: 12px;
  color: @purple-500;
  cursor: pointer;
  padding: 8px;
  border-radius: @radius-sm;
  transition: background 0.2s;
  display: block;

  &:hover {
    background: @purple-light;
  }
}

.cluster-card-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid @gray-200;
  margin-top: auto;
}

.btn-generate-article {
  background: linear-gradient(135deg, @purple-500 0%, @purple-400 100%) !important;
  border: none !important;

  &:hover {
    background: linear-gradient(135deg, @purple-600 0%, @purple-500 100%) !important;
  }
}

.cluster-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 8px;
  margin-top: 4px;
}

.cluster-date {
  font-size: 11px;
  color: @gray-400;
}

// Chart Container
.chart-container {
  height: 280px;
  width: 100%;
}

// Keyword Detail Modal
.keyword-detail {
  .keyword-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid @gray-200;
  }

  .detail-title {
    font-size: 22px;
    font-weight: 600;
    margin: 0;
    color: @gray-900;
  }
}

.semantic-extensions {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.extension-section {
  .ext-header {
    font-size: 14px;
    font-weight: 600;
    color: @gray-600;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ext-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ext-tag {
    font-size: 13px;
    padding: 4px 12px;
  }
}

.detail-actions {
  display: flex;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid @gray-200;
  gap: 10px;
}

.cluster-detail {
  .detail-row {
    display: flex;
    margin-bottom: 16px;
    padding-bottom: 16px;
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
    justify-content: flex-start;
  }
}

// Responsive
@media (max-width: 992px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .stat-card {
    min-height: 110px;
  }

  .value-number {
    font-size: 26px;
  }

  .section-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .page-title {
    font-size: 20px;
  }

  .page-subtitle {
    display: none;
  }

  .chart-container {
    height: 220px;
  }

  .keyword-name {
    font-size: 18px;
  }

  .score-circle {
    width: 60px;
    height: 60px;
  }

  .score-number {
    font-size: 22px;
  }

  .top-keyword-card {
    padding: 32px 16px 16px 16px;
  }

  .keyword-actions {
    flex-direction: column;

    .btn-generate,
    .btn-detail {
      flex: 1;
    }
  }
}

// Reduced motion
@media (prefers-reduced-motion: reduce) {
  .fade-in-up,
  .stat-col,
  .top-keyword-card,
  .cluster-card {
    animation: none;
    opacity: 1;
  }

  .stat-card,
  .top-keyword-card,
  .cluster-card {
    transition: none;

    &:hover {
      transform: none;
    }
  }
}
</style>
