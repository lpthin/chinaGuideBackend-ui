<template>
  <div class="article-list-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ pagination.total }}</div>
                <div class="stat-title">文章总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <EyeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalViews }}</div>
                <div class="stat-title">总浏览</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <LikeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalLikes }}</div>
                <div class="stat-title">总点赞</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffec3d 100%)">
                <ShareAltOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalShares }}</div>
                <div class="stat-title">总分享</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <template #title>
          <a-space>
            <a-select
              v-model:value="queryParams.categoryId"
              style="width: 180px"
              placeholder="选择分类"
              @change="loadData"
              allowClear
            >
              <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.status"
              style="width: 120px"
              placeholder="选择状态"
              @change="loadData"
              allowClear
            >
              <a-select-option value="active">已发布</a-select-option>
              <a-select-option value="draft">草稿</a-select-option>
              <a-select-option value="disabled">已下架</a-select-option>
            </a-select>
            <a-input-search
              v-model:value="queryParams.keyword"
              placeholder="搜索标题/关键词"
              style="width: 280px"
              @search="loadData"
              enter-button
            />
            <a-button type="primary" @click="goToEdit()">
              <template #icon><PlusOutlined /></template>
              新建文章
            </a-button>
          </a-space>
        </template>

        <template #extra>
          <a-space>
            <a-button v-if="selectedRowKeys.length" type="link" danger @click="batchDelete">
              批量删除 ({{ selectedRowKeys.length }})
            </a-button>
            <a-button v-if="selectedRowKeys.length" type="link" @click="batchPublish">
              批量发布
            </a-button>
          </a-space>
        </template>

        <a-table
          :columns="columns"
          :data-source="articleList"
          :pagination="false"
          :row-selection="rowSelection"
          :row-key="record => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'title'">
              <a @click="goToDetail(record.id)">
                <div class="article-title">{{ record.title }}</div>
                <div class="article-summary">{{ record.summary }}</div>
              </a>
            </template>
            <template v-if="column.key === 'category'">
              {{ getCategoryName(record.categoryId) }}
            </template>
            <template v-if="column.key === 'keywords'">
              <a-tag v-for="tag in (record.keywords || '').split(',').filter(t => t)" :key="tag" size="small">
                {{ tag }}
              </a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusText(record.status) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="goToDetail(record.id)">查看</a-button>
                <a-button type="link" size="small" @click="goToEdit(record.id)">编辑</a-button>
                <a-popconfirm
                  title="确定要删除这篇文章吗？"
                  @confirm="handleDelete(record.id)"
                >
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>

        <div class="pagination-wrapper">
          <a-pagination
            v-model:current="pagination.page"
            v-model:pageSize="pagination.size"
            :total="pagination.total"
            :show-size-changer="true"
            :show-quick-jumper="true"
            :page-size-options="['10', '20', '50', '100']"
            @change="loadData"
            @showSizeChange="loadData"
            :show-total="(total) => `共 ${total} 条`"
          />
        </div>
      </a-card>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  FileTextOutlined,
  EyeOutlined,
  LikeOutlined,
  ShareAltOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { articleManageApi, articleCategoryApi } from '../../api/article'
import type { Article, ArticleCategory } from '../../types/article'

const router = useRouter()
const loading = ref(false)
const articleList = ref<Article[]>([])
const categories = ref<ArticleCategory[]>([])
const selectedRowKeys = ref<number[]>([])

const stats = reactive({
  totalViews: 0,
  totalLikes: 0,
  totalShares: 0,
})

const queryParams = reactive({
  tenantId: 1,
  categoryId: null as number | null,
  status: undefined as string | undefined,
  keyword: '',
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '标题', key: 'title', width: 300 },
  { title: '分类', key: 'category', width: 120 },
  { title: '关键词', key: 'keywords', width: 200 },
  { title: '浏览', dataIndex: 'viewCount', key: 'viewCount', width: 80, align: 'center' as const },
  { title: '点赞', dataIndex: 'likeCount', key: 'likeCount', width: 80, align: 'center' as const },
  { title: '分享', dataIndex: 'shareCount', key: 'shareCount', width: 80, align: 'center' as const },
  { title: '来源', dataIndex: 'source', key: 'source', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '发布时间', dataIndex: 'publishAt', key: 'publishAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 180 },
]

const rowSelection = {
  selectedRowKeys,
  onChange: (keys: number[]) => {
    selectedRowKeys.value = keys
  },
}

function getCategoryName(categoryId: number): string {
  const category = categories.value.find(c => c.id === categoryId)
  return category?.name || '-'
}

function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    active: 'green',
    draft: 'default',
    disabled: 'red',
  }
  return colorMap[status] || 'default'
}

function getStatusText(status: string): string {
  const textMap: Record<string, string> = {
    active: '已发布',
    draft: '草稿',
    disabled: '已下架',
  }
  return textMap[status] || status
}

function goToDetail(id: number) {
  router.push(`/article/${id}`)
}

function goToEdit(id?: number) {
  if (id) {
    router.push(`/article/${id}/edit`)
  } else {
    router.push('/article/new')
  }
}

async function handleDelete(id: number) {
  try {
    await articleManageApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error) {
    message.error('删除失败')
    console.error(error)
  }
}

async function batchDelete() {
  Modal.confirm({
    title: '确认批量删除',
    content: `确定要删除选中的 ${selectedRowKeys.value.length} 篇文章吗？`,
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      try {
        await articleManageApi.batchDelete(selectedRowKeys.value)
        message.success('批量删除成功')
        selectedRowKeys.value = []
        await loadData()
      } catch (error) {
        message.error('批量删除失败')
        console.error(error)
      }
    },
  })
}

async function batchPublish() {
  Modal.confirm({
    title: '确认批量发布',
    content: `确定要发布选中的 ${selectedRowKeys.value.length} 篇文章吗？`,
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      try {
        await Promise.all(selectedRowKeys.value.map(id => articleManageApi.publish(id)))
        message.success('批量发布成功')
        selectedRowKeys.value = []
        await loadData()
      } catch (error) {
        message.error('批量发布失败')
        console.error(error)
      }
    },
  })
}

async function loadCategories() {
  try {
    const result = await articleCategoryApi.all(1)
    categories.value = result
  } catch (error) {
    console.error(error)
    categories.value = generateMockCategories()
  }
}

async function loadData() {
  loading.value = true
  try {
    const params = {
      ...queryParams,
      page: pagination.page,
      size: pagination.size,
    }
    const result = await articleManageApi.list(params)
    articleList.value = result.records
    pagination.total = result.total
    stats.totalViews = result.records.reduce((sum, c) => sum + c.viewCount, 0)
    stats.totalLikes = result.records.reduce((sum, c) => sum + c.likeCount, 0)
    stats.totalShares = result.records.reduce((sum, c) => sum + c.shareCount, 0)
  } catch (error) {
    console.error(error)
    const mockData = generateMockArticles()
    const start = (pagination.page - 1) * pagination.size
    const end = start + pagination.size
    articleList.value = mockData.slice(start, end)
    pagination.total = mockData.length
    stats.totalViews = mockData.reduce((sum, c) => sum + c.viewCount, 0)
    stats.totalLikes = mockData.reduce((sum, c) => sum + c.likeCount, 0)
    stats.totalShares = mockData.reduce((sum, c) => sum + c.shareCount, 0)
  } finally {
    loading.value = false
  }
}

function generateMockCategories(): ArticleCategory[] {
  return [
    { id: 1, tenantId: 1, parentId: null, name: '公司新闻', icon: 'news', description: '', sort: 1, status: 'active', createdAt: '', updatedAt: '' },
    { id: 2, tenantId: 1, parentId: 1, name: '行业动态', icon: 'folder', description: '', sort: 1, status: 'active', createdAt: '', updatedAt: '' },
    { id: 3, tenantId: 1, parentId: 1, name: '产品发布', icon: 'folder', description: '', sort: 2, status: 'active', createdAt: '', updatedAt: '' },
    { id: 4, tenantId: 1, parentId: null, name: '技术博客', icon: 'book', description: '', sort: 2, status: 'active', createdAt: '', updatedAt: '' },
  ]
}

function generateMockArticles(): Article[] {
  const titles = [
    '公司完成新一轮融资，加速产品研发',
    '2024年行业发展趋势报告发布',
    '新产品 v2.0 正式发布，新增多项功能',
    'Vue 3 组合式 API 最佳实践',
    'TypeScript 5.0 新特性详解',
    '微服务架构设计原则',
    'Docker 容器化部署指南',
    'React 服务端渲染最佳实践',
    'Node.js 性能优化技巧',
    'Kubernetes 集群管理实战',
    '前端工程化完整方案',
    '数据库优化实战指南',
    'API 设计最佳实践',
    '自动化测试完整教程',
    'Git 工作流规范详解',
  ]
  const summaries = [
    '公司近期完成了由知名投资机构领投的新一轮融资，将用于加速产品研发和市场拓展',
    '本报告深入分析了2024年行业发展的主要趋势，包括AI技术应用、数字化转型等热点话题',
    '经过数月的紧张开发，新产品 v2.0 版本正式发布，本次更新包含了多项重大功能改进',
    '本文详细介绍了Vue 3组合式API的使用方法和最佳实践，帮助开发者更好地应用在项目中',
  ]
  const keywords = ['融资,发展,产品', 'Vue,TypeScript,前端', 'React,Node.js,后端', 'Docker,K8s,DevOps', 'Git,测试,工程化']
  const sources = ['原创', '转载', '翻译', '投稿']
  const statuses = ['active', 'draft', 'disabled']

  return titles.map((title, index) => ({
    id: index + 1,
    tenantId: 1,
    categoryId: (index % 4) + 1,
    templateId: null,
    title,
    summary: summaries[index % summaries.length],
    content: '',
    coverImage: '',
    keywords: keywords[index % keywords.length],
    source: sources[index % sources.length],
    viewCount: Math.floor(Math.random() * 10000),
    likeCount: Math.floor(Math.random() * 500),
    shareCount: Math.floor(Math.random() * 200),
    sort: index,
    status: statuses[index % statuses.length],
    publishAt: new Date(Date.now() - index * 86400000).toISOString().slice(0, 19).replace('T', ' '),
    createdAt: new Date(Date.now() - index * 86400000).toISOString().slice(0, 19).replace('T', ' '),
    updatedAt: new Date(Date.now() - index * 86400000 / 2).toISOString().slice(0, 19).replace('T', ' '),
  }))
}

onMounted(async () => {
  await loadCategories()
  await loadData()
})
</script>

<style scoped lang="less">
.article-list-page {
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

.article-title {
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.article-summary {
  font-size: 12px;
  color: #8c8c8c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
