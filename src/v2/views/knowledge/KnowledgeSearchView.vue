<template>
  <div class="knowledge-search-container">
    <a-page-header title="知识库搜索" sub-title="全文搜索文档、卡片和实体">
    </a-page-header>

    <div class="search-content">
      <div class="search-bar-section">
        <a-input-search
          v-model:value="searchQuery"
          placeholder="输入关键词搜索知识库..."
          enter-button="搜索"
          size="large"
          @search="handleSearch"
          :loading="loading"
        />
        <div class="search-type-tabs">
          <a-radio-group v-model:value="searchType" button-style="solid" @change="handleSearch">
            <a-radio-button value="all">全部</a-radio-button>
            <a-radio-button value="document">文档</a-radio-button>
            <a-radio-button value="card">卡片</a-radio-button>
            <a-radio-button value="entity">实体</a-radio-button>
          </a-radio-group>
          <a-button type="link" @click="showAdvanced = !showAdvanced">
            <template #icon>
              <FilterOutlined v-if="!showAdvanced" />
              <UpOutlined v-else />
            </template>
            {{ showAdvanced ? '收起筛选' : '高级筛选' }}
          </a-button>
        </div>
      </div>

      <a-collapse v-if="showAdvanced" v-model:activeKey="advancedKey" class="advanced-filter" bordered>
        <a-collapse-panel key="1" header="筛选条件">
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12" :md="6">
              <a-form-item label="分类">
                <a-select
                  v-model:value="filterCategoryId"
                  placeholder="选择分类"
                  allow-clear
                  style="width: 100%"
                >
                  <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
                    {{ cat.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12" :md="6">
              <a-form-item label="标签">
                <a-input
                  v-model:value="filterTag"
                  placeholder="输入标签"
                  allow-clear
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12" :md="6">
              <a-form-item label="文件类型">
                <a-select
                  v-model:value="filterFileType"
                  placeholder="选择文件类型"
                  allow-clear
                  style="width: 100%"
                >
                  <a-select-option value="pdf">PDF</a-select-option>
                  <a-select-option value="word">Word</a-select-option>
                  <a-select-option value="ppt">PPT</a-select-option>
                  <a-select-option value="excel">Excel</a-select-option>
                  <a-select-option value="text">文本</a-select-option>
                  <a-select-option value="image">图片</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12" :md="6">
              <a-form-item label="时间范围">
                <a-select
                  v-model:value="filterTimeRange"
                  placeholder="选择时间范围"
                  style="width: 100%"
                >
                  <a-select-option value="all">全部</a-select-option>
                  <a-select-option value="7days">最近7天</a-select-option>
                  <a-select-option value="30days">最近30天</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <div class="filter-actions">
            <a-button type="primary" @click="handleSearch">
              <template #icon><SearchOutlined /></template>
              应用筛选
            </a-button>
            <a-button @click="resetFilters">
              <template #icon><ReloadOutlined /></template>
              重置
            </a-button>
          </div>
        </a-collapse-panel>
      </a-collapse>

      <div class="search-results-section" v-if="hasSearched">
        <div class="results-header">
          <div class="results-info">
            <span v-if="loading">搜索中...</span>
            <span v-else>
              找到 <strong>{{ total }}</strong> 条结果
              <span v-if="searchDuration" class="duration">(用时 {{ searchDuration.toFixed(2) }} 秒)</span>
            </span>
          </div>
          <div class="results-sort">
            <span class="sort-label">排序：</span>
            <a-radio-group v-model:value="sortBy" button-style="solid" size="small" @change="handleSearch">
              <a-radio-button value="relevance">相关度</a-radio-button>
              <a-radio-button value="time">最新</a-radio-button>
              <a-radio-button value="name">名称</a-radio-button>
            </a-radio-group>
          </div>
        </div>

        <a-spin :spinning="loading" tip="搜索中...">
          <div class="results-list" v-if="results.length > 0">
            <div
              v-for="item in results"
              :key="item.type + '-' + item.id"
              class="result-item"
              @click="handleResultClick(item)"
            >
              <div class="result-type-tag" :class="'type-' + item.type">
                <FileTextOutlined v-if="item.type === 'document'" />
                <FileOutlined v-else-if="item.type === 'card'" />
                <AppstoreOutlined v-else />
                {{ getTypeLabel(item.type) }}
              </div>
              <h3 class="result-title" v-html="item.highlightedTitle || item.title"></h3>
              <p class="result-snippet" v-html="item.highlightedSnippet || item.snippet"></p>
              <div class="result-meta">
                <span v-if="item.tags && item.tags.length > 0" class="result-tags">
                  <a-tag v-for="tag in item.tags.slice(0, 3)" :key="tag" color="blue" size="small">
                    {{ tag }}
                  </a-tag>
                </span>
                <span v-if="item.viewCount !== undefined" class="result-views">
                  <EyeOutlined /> {{ item.viewCount }}
                </span>
                <span v-if="item.createdAt" class="result-time">
                  <ClockCircleOutlined /> {{ formatTime(item.createdAt) }}
                </span>
              </div>
            </div>
          </div>

          <a-empty v-else-if="!loading" description="没有找到相关内容" class="empty-results" />
        </a-spin>

        <div class="pagination-wrapper" v-if="total > 0 && !loading">
          <a-pagination
            v-model:current="currentPage"
            :total="total"
            :page-size="pageSize"
            show-size-changer
            :page-size-options="['10', '20', '50']"
            show-quick-jumper
            show-total
            @change="handlePageChange"
            @showSizeChange="handleSizeChange"
          />
        </div>
      </div>

      <div class="search-placeholder" v-else>
        <div class="placeholder-icon">
          <SearchOutlined />
        </div>
        <h3>开始搜索知识库</h3>
        <p>输入关键词，搜索文档、知识卡片和实体</p>
        <div class="quick-searches">
          <span class="quick-label">热门搜索：</span>
          <a-tag
            v-for="keyword in hotKeywords"
            :key="keyword"
            color="blue"
            class="quick-tag"
            @click="quickSearch(keyword)"
          >
            {{ keyword }}
          </a-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  SearchOutlined,
  FilterOutlined,
  UpOutlined,
  ReloadOutlined,
  FileTextOutlined,
  FileOutlined,
  AppstoreOutlined,
  EyeOutlined,
  ClockCircleOutlined
} from '@ant-design/icons-vue'
import { knowledgeSearchApi, knowledgeCategoryApi } from '../../api/knowledge'
import type { KnowledgeSearchResultItem, KnowledgeSearchQuery } from '../../types/knowledge'

const router = useRouter()

const TENANT_ID = 1

const searchQuery = ref('')
const searchType = ref<'all' | 'document' | 'card' | 'entity'>('all')
const sortBy = ref<'relevance' | 'time' | 'name'>('relevance')
const currentPage = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const hasSearched = ref(false)
const showAdvanced = ref(false)
const advancedKey = ref(['1'])

const filterCategoryId = ref<number | undefined>()
const filterTag = ref('')
const filterFileType = ref('')
const filterTimeRange = ref<'all' | '7days' | '30days'>('all')

const results = ref<KnowledgeSearchResultItem[]>([])
const total = ref(0)
const searchDuration = ref(0)

const categories = ref<{ id: number; name: string }[]>([])

const hotKeywords = ref(['产品介绍', 'API文档', '使用指南', '常见问题'])

const loadCategories = async () => {
  try {
    const res: any = await knowledgeCategoryApi.all(TENANT_ID)
    const data = res?.data ?? res
    if (Array.isArray(data)) {
      categories.value = data.map((cat: any) => ({ id: cat.id, name: cat.name }))
    }
  } catch (error) {
    console.error('加载分类失败:', error)
  }
}

loadCategories()

const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    message.warning('请输入搜索关键词')
    return
  }

  loading.value = true
  hasSearched.value = true

  try {
    const params: KnowledgeSearchQuery = {
      query: searchQuery.value.trim(),
      type: searchType.value,
      categoryId: filterCategoryId.value,
      tag: filterTag.value || undefined,
      fileType: filterFileType.value || undefined,
      timeRange: filterTimeRange.value,
      sort: sortBy.value,
      page: currentPage.value,
      size: pageSize.value,
      tenantId: TENANT_ID
    }

    const res: any = await knowledgeSearchApi.search(params)
    const data = res?.data ?? res
    results.value = data?.records || []
    total.value = data?.total || 0
    searchDuration.value = data?.duration || 0
  } catch (error) {
    console.error('搜索失败:', error)
    message.error('搜索失败，请稍后重试')
    results.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filterCategoryId.value = undefined
  filterTag.value = ''
  filterFileType.value = ''
  filterTimeRange.value = 'all'
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  handleSearch()
}

const handleSizeChange = (_current: number, size: number) => {
  pageSize.value = size
  currentPage.value = 1
  handleSearch()
}

const quickSearch = (keyword: string) => {
  searchQuery.value = keyword
  currentPage.value = 1
  handleSearch()
}

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    document: '文档',
    card: '卡片',
    entity: '实体'
  }
  return labels[type] || type
}

const formatTime = (time: string) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days < 1) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return '刚刚'
    return `${hours}小时前`
  }
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString()
}

const handleResultClick = (item: KnowledgeSearchResultItem) => {
  if (item.type === 'document') {
    router.push(`/v2/workspace/knowledge/documents`)
  } else if (item.type === 'card') {
    router.push(`/v2/workspace/knowledge/cards/${item.id}`)
  } else if (item.type === 'entity') {
    router.push(`/v2/workspace/knowledge/graph`)
  }
}
</script>

<style lang="less" scoped>
.knowledge-search-container {
  .search-content {
    padding: 24px;
    max-width: 960px;
    margin: 0 auto;
  }
}

.search-bar-section {
  margin-bottom: 24px;

  .ant-input-search {
    margin-bottom: 16px;
  }

  .search-type-tabs {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}

.advanced-filter {
  margin-bottom: 24px;

  .filter-actions {
    margin-top: 16px;
    display: flex;
    gap: 12px;
  }
}

.search-results-section {
  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid #f0f0f0;
    margin-bottom: 16px;

    .results-info {
      color: #595959;
      font-size: 14px;

      strong {
        color: #1890ff;
        font-size: 16px;
        margin: 0 4px;
      }

      .duration {
        color: #8c8c8c;
        margin-left: 8px;
      }
    }

    .results-sort {
      display: flex;
      align-items: center;
      gap: 8px;

      .sort-label {
        color: #595959;
        font-size: 13px;
      }
    }
  }

  .results-list {
    .result-item {
      padding: 20px;
      border: 1px solid #f0f0f0;
      border-radius: 8px;
      margin-bottom: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #fff;

      &:hover {
        border-color: #1890ff;
        box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
        transform: translateY(-1px);
      }

      .result-type-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        margin-bottom: 8px;
        font-weight: 500;

        &.type-document {
          background: #e6f7ff;
          color: #1890ff;
        }

        &.type-card {
          background: #f6ffed;
          color: #52c41a;
        }

        &.type-entity {
          background: #fff7e6;
          color: #fa8c16;
        }
      }

      .result-title {
        font-size: 16px;
        font-weight: 600;
        color: #262626;
        margin: 0 0 8px 0;
        line-height: 1.5;

        :deep(em) {
          font-style: normal;
          color: #f5222d;
          font-weight: 600;
          background: #fff1f0;
          padding: 0 2px;
          border-radius: 2px;
        }
      }

      .result-snippet {
        font-size: 14px;
        color: #595959;
        line-height: 1.6;
        margin: 0 0 12px 0;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;

        :deep(em) {
          font-style: normal;
          color: #f5222d;
          font-weight: 500;
          background: #fff1f0;
          padding: 0 2px;
          border-radius: 2px;
        }
      }

      .result-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        font-size: 12px;
        color: #8c8c8c;

        .result-tags {
          display: flex;
          gap: 4px;
        }

        .result-views,
        .result-time {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }
    }
  }

  .empty-results {
    padding: 60px 0;
  }

  .pagination-wrapper {
    margin-top: 24px;
    display: flex;
    justify-content: center;
  }
}

.search-placeholder {
  text-align: center;
  padding: 80px 20px;

  .placeholder-icon {
    font-size: 64px;
    color: #d9d9d9;
    margin-bottom: 24px;
  }

  h3 {
    font-size: 20px;
    color: #262626;
    margin: 0 0 8px 0;
  }

  p {
    font-size: 14px;
    color: #8c8c8c;
    margin: 0 0 32px 0;
  }

  .quick-searches {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;

    .quick-label {
      color: #595959;
      font-size: 13px;
    }

    .quick-tag {
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        opacity: 0.8;
      }
    }
  }
}
</style>
