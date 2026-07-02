<template>
  <div class="knowledge-card-list-page">
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
                <div class="stat-title">知识卡片</div>
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
                <FolderOpenOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalCategories }}</div>
                <div class="stat-title">分类数</div>
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
            >
              <a-select-option :value="null">全部分类</a-select-option>
              <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.tag"
              style="width: 180px"
              placeholder="选择标签"
              allow-clear
              @change="loadData"
            >
              <a-select-option value="">全部标签</a-select-option>
              <a-select-option v-for="tag in tags" :key="tag.name" :value="tag.name">
                <a-tag :color="tag.color" style="margin-right: 0">{{ tag.name }}</a-tag>
              </a-select-option>
            </a-select>
            <a-input-search
              v-model:value="queryParams.keyword"
              placeholder="搜索标题/内容/标签"
              style="width: 280px"
              @search="loadData"
              enter-button
            />
            <a-button type="primary" @click="goToEdit()">
              <template #icon><PlusOutlined /></template>
              新建卡片
            </a-button>
          </a-space>
        </template>

        <template #extra>
          <a-space>
            <a-radio-group v-model:value="viewMode" button-style="solid">
              <a-radio-button value="card">卡片视图</a-radio-button>
              <a-radio-button value="list">列表视图</a-radio-button>
            </a-radio-group>
            <template v-if="selectedRowKeys.length > 0">
              <a-button size="small" @click="showBatchCategoryModal">
                移动分类
              </a-button>
              <a-button size="small" @click="showBatchTagModal">
                设置标签
              </a-button>
              <a-button danger size="small" @click="batchDelete">
                删除选中 ({{ selectedRowKeys.length }})
              </a-button>
            </template>
          </a-space>
        </template>

        <div v-if="viewMode === 'card'" class="card-view">
          <a-row :gutter="16">
            <a-col :span="6" v-for="card in cardList" :key="card.id">
              <a-card
                class="knowledge-card"
                hoverable
                :cover="card.coverImage ? renderCover(card.coverImage) : undefined"
                @click="goToDetail(card.id)"
              >
                <div class="card-checkbox-wrapper" @click.stop="toggleCardSelect(card.id)">
                  <a-checkbox :checked="selectedRowKeys.includes(card.id)" />
                </div>
                <template #actions>
                  <div @click.stop>
                    <EyeOutlined /> {{ card.viewCount }}
                  </div>
                  <div @click.stop>
                    <LikeOutlined /> {{ card.likeCount }}
                  </div>
                  <a-dropdown @click.stop>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item @click="goToEdit(card.id)">
                          <EditOutlined /> 编辑
                        </a-menu-item>
                        <a-menu-item @click="handleDelete(card.id)" danger>
                          <DeleteOutlined /> 删除
                        </a-menu-item>
                      </a-menu>
                    </template>
                    <EllipsisOutlined />
                  </a-dropdown>
                </template>

                <a-card-meta :title="card.title" :description="card.summary">
                  <template #title>
                    <div class="card-title">
                      <span>{{ card.title }}</span>
                      <a-tag v-if="card.status === 'disabled'" color="default" size="small">停用</a-tag>
                    </div>
                  </template>
                </a-card-meta>

                <div class="card-tags">
                  <a-tag v-for="tag in (card.tags || '').split(',').filter(t => t)" :key="tag" size="small" :color="getTagColor(tag)">
                    {{ tag }}
                  </a-tag>
                </div>

                <div class="card-footer">
                  <span>{{ getCategoryName(card.categoryId) }}</span>
                  <span>{{ formatDate(card.updatedAt) }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>
        </div>

        <a-table
          v-else
          :columns="columns"
          :data-source="cardList"
          :pagination="false"
          :row-selection="rowSelection"
          :row-key="record => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'title'">
              <a @click="goToDetail(record.id)">{{ record.title }}</a>
            </template>
            <template v-if="column.key === 'category'">
              {{ getCategoryName(record.categoryId) }}
            </template>
            <template v-if="column.key === 'tags'">
              <a-tag v-for="tag in (record.tags || '').split(',').filter(t => t)" :key="tag" size="small" :color="getTagColor(tag)">
                {{ tag }}
              </a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'active' ? 'green' : 'default'">
                {{ record.status === 'active' ? '启用' : '停用' }}
              </a-tag>
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="goToDetail(record.id)">查看</a-button>
                <a-button type="link" size="small" @click="goToEdit(record.id)">编辑</a-button>
                <a-button type="link" size="small" danger @click="handleDelete(record.id)">删除</a-button>
              </a-space>
            </template>
          </template>
        </a-table>

        <div class="pagination-wrapper">
          <a-pagination
            v-model:current="pagination.page"
            v-model:page-size="pagination.size"
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

    <!-- 批量设置分类弹窗 -->
    <a-modal v-model:open="batchCategoryModalVisible" title="批量移动分类" width="500px">
      <a-form layout="vertical">
        <a-form-item label="选择分类">
          <a-select
            v-model:value="batchCategoryId"
            placeholder="请选择分类"
            style="width: 100%"
            :allow-clear="true"
          >
            <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <p style="color: #8c8c8c; font-size: 12px">
          将把选中的 {{ selectedRowKeys.length }} 张卡片移动到所选分类
        </p>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="batchCategoryModalVisible = false">取消</a-button>
          <a-button type="primary" :loading="batchCategoryLoading" @click="handleBatchSetCategory">
            确认移动
          </a-button>
        </a-space>
      </template>
    </a-modal>

    <!-- 批量设置标签弹窗 -->
    <a-modal v-model:open="batchTagModalVisible" title="批量设置标签" width="500px">
      <a-form layout="vertical">
        <a-form-item label="选择标签">
          <a-select
            v-model:value="batchTagValue"
            mode="tags"
            placeholder="输入或选择标签，回车添加"
            style="width: 100%"
          >
            <a-select-option v-for="tag in tags" :key="tag.name" :value="tag.name">
              {{ tag.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <p style="color: #8c8c8c; font-size: 12px">
          将为选中的 {{ selectedRowKeys.length }} 张卡片设置标签（覆盖原有标签）
        </p>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="batchTagModalVisible = false">取消</a-button>
          <a-button type="primary" :loading="batchTagLoading" @click="handleBatchSetTags">
            确认设置
          </a-button>
        </a-space>
      </template>
    </a-modal>
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
  FolderOpenOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EllipsisOutlined,
} from '@ant-design/icons-vue'
import { knowledgeCardApi, knowledgeCategoryApi, knowledgeTagApi } from '../../api/knowledge'
import type { KnowledgeCard, KnowledgeCategory, KnowledgeTag } from '../../types/knowledge'

const router = useRouter()
const loading = ref(false)
const viewMode = ref<'card' | 'list'>('card')
const cardList = ref<KnowledgeCard[]>([])
const categories = ref<KnowledgeCategory[]>([])
const tags = ref<KnowledgeTag[]>([])
const selectedRowKeys = ref<number[]>([])

const batchCategoryModalVisible = ref(false)
const batchCategoryId = ref<number | null>(null)
const batchCategoryLoading = ref(false)
const batchTagModalVisible = ref(false)
const batchTagValue = ref<string[]>([])
const batchTagLoading = ref(false)

const stats = reactive({
  totalViews: 0,
  totalLikes: 0,
  totalCategories: 0,
})

const queryParams = reactive({
  tenantId: 1,
  categoryId: null as number | null,
  keyword: '',
  status: undefined as string | undefined,
  tag: '' as string,
})

const pagination = reactive({
  page: 1,
  size: 12,
  total: 0,
})

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '标题', key: 'title', width: 250 },
  { title: '分类', key: 'category', width: 120 },
  { title: '标签', key: 'tags', width: 200 },
  { title: '浏览', dataIndex: 'viewCount', key: 'viewCount', width: 80 },
  { title: '点赞', dataIndex: 'likeCount', key: 'likeCount', width: 80 },
  { title: '状态', key: 'status', width: 100 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 150 },
]

const rowSelection = {
  selectedRowKeys,
  onChange: (keys: number[]) => {
    selectedRowKeys.value = keys
  },
}

function renderCover(url: string) {
  return h('img', {
    src: url,
    alt: 'cover',
    style: 'height: 120px; object-fit: cover;',
  })
}

function getCategoryName(categoryId: number): string {
  const category = categories.value.find(c => c.id === categoryId)
  return category?.name || '-'
}

function getTagColor(tagName: string): string {
  const tag = tags.value.find(t => t.name === tagName)
  return tag?.color || 'blue'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function goToDetail(id: number) {
  router.push(`/knowledge/card/${id}`)
}

function goToEdit(id?: number) {
  if (id) {
    router.push(`/knowledge/card/${id}/edit`)
  } else {
    router.push('/knowledge/card/new')
  }
}

async function handleDelete(id: number) {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这张知识卡片吗？此操作不可恢复。',
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      try {
        await knowledgeCardApi.delete(id)
        message.success('删除成功')
        await loadData()
      } catch (error) {
        message.error('删除失败')
        console.error(error)
      }
    },
  })
}

async function batchDelete() {
  Modal.confirm({
    title: '确认批量删除',
    content: `确定要删除选中的 ${selectedRowKeys.value.length} 张知识卡片吗？此操作不可恢复。`,
    okText: '确定删除',
    cancelText: '取消',
    okType: 'danger',
    onOk: async () => {
      try {
        await knowledgeCardApi.batchDelete(selectedRowKeys.value)
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

function toggleCardSelect(id: number) {
  const idx = selectedRowKeys.value.indexOf(id)
  if (idx >= 0) {
    selectedRowKeys.value.splice(idx, 1)
  } else {
    selectedRowKeys.value.push(id)
  }
}

function showBatchCategoryModal() {
  batchCategoryId.value = null
  batchCategoryModalVisible.value = true
}

function showBatchTagModal() {
  batchTagValue.value = []
  batchTagModalVisible.value = true
}

async function handleBatchSetCategory() {
  if (selectedRowKeys.value.length === 0) return
  batchCategoryLoading.value = true
  try {
    await knowledgeCardApi.batchSetCategory(selectedRowKeys.value, batchCategoryId.value)
    message.success(`已批量设置 ${selectedRowKeys.value.length} 张卡片的分类`)
    batchCategoryModalVisible.value = false
    selectedRowKeys.value = []
    await loadData()
  } catch (error) {
    message.error('批量设置分类失败')
    console.error(error)
  } finally {
    batchCategoryLoading.value = false
  }
}

async function handleBatchSetTags() {
  if (selectedRowKeys.value.length === 0) return
  batchTagLoading.value = true
  try {
    await knowledgeCardApi.batchSetTags(selectedRowKeys.value, batchTagValue.value.join(','))
    message.success(`已批量设置 ${selectedRowKeys.value.length} 张卡片的标签`)
    batchTagModalVisible.value = false
    selectedRowKeys.value = []
    await loadData()
  } catch (error) {
    message.error('批量设置标签失败')
    console.error(error)
  } finally {
    batchTagLoading.value = false
  }
}

async function loadCategories() {
  try {
    const result = await knowledgeCategoryApi.all(1)
    categories.value = result
    stats.totalCategories = result.length
  } catch (error) {
    console.error(error)
    const mockData = generateMockCategories()
    categories.value = mockData
    stats.totalCategories = mockData.length
  }
}

async function loadTags() {
  try {
    const result = await knowledgeTagApi.list({ tenantId: 1 })
    tags.value = Array.isArray(result) ? result : (result as any).records || []
  } catch (error) {
    console.error(error)
    tags.value = []
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
    const result = await knowledgeCardApi.list(params)
    cardList.value = result.records
    pagination.total = result.total
    stats.totalViews = result.records.reduce((sum, c) => sum + c.viewCount, 0)
    stats.totalLikes = result.records.reduce((sum, c) => sum + c.likeCount, 0)
  } catch (error) {
    console.error(error)
    const mockData = generateMockCards()
    const start = (pagination.page - 1) * pagination.size
    const end = start + pagination.size
    cardList.value = mockData.slice(start, end)
    pagination.total = mockData.length
    stats.totalViews = mockData.reduce((sum, c) => sum + c.viewCount, 0)
    stats.totalLikes = mockData.reduce((sum, c) => sum + c.likeCount, 0)
  } finally {
    loading.value = false
  }
}

function generateMockCategories(): KnowledgeCategory[] {
  return [
    { id: 1, tenantId: 1, parentId: null, name: '开发指南', icon: 'book', description: '', sort: 1, status: 'active', createdAt: '', updatedAt: '' },
    { id: 2, tenantId: 1, parentId: 1, name: '前端开发', icon: 'folder', description: '', sort: 1, status: 'active', createdAt: '', updatedAt: '' },
    { id: 3, tenantId: 1, parentId: 1, name: '后端开发', icon: 'folder', description: '', sort: 2, status: 'active', createdAt: '', updatedAt: '' },
    { id: 4, tenantId: 1, parentId: null, name: '运维部署', icon: 'star', description: '', sort: 2, status: 'active', createdAt: '', updatedAt: '' },
  ]
}

function generateMockCards(): KnowledgeCard[] {
  const titles = [
    'Vue 3 组合式 API 入门指南',
    'TypeScript 高级类型技巧',
    'React Hooks 最佳实践',
    'Spring Boot 微服务架构',
    'Docker 容器化部署详解',
    'Node.js 性能优化指南',
    'CSS Grid 布局完全教程',
    'GraphQL 入门与实战',
    'Redis 缓存策略详解',
    'Kubernetes 集群管理',
    'JavaScript 异步编程',
    'Git 工作流最佳实践',
    'Webpack 配置优化',
    'MySQL 索引优化',
    'Nginx 反向代理配置',
  ]
  const summaries = [
    '本文详细介绍了 Vue 3 中组合式 API 的使用方法和最佳实践',
    '深入探讨 TypeScript 的高级类型系统，包括泛型、条件类型等',
    '从实际项目出发，讲解 React Hooks 的使用技巧和注意事项',
    'Spring Boot 微服务架构的完整指南，包含服务注册、发现等',
    'Docker 容器化的完整教程，从基础到生产环境部署',
  ]
  const tags = ['Vue', 'TypeScript', 'React', 'Spring', 'Docker', 'Node.js', 'CSS', 'GraphQL', 'Redis', 'K8s', 'JavaScript', 'Git', 'Webpack', 'MySQL', 'Nginx']

  return titles.map((title, index) => ({
    id: index + 1,
    tenantId: 1,
    categoryId: (index % 4) + 1,
    title,
    summary: summaries[index % summaries.length],
    content: '',
    coverImage: '',
    tags: [tags[index % tags.length], tags[(index + 1) % tags.length]].join(','),
    viewCount: Math.floor(Math.random() * 1000),
    likeCount: Math.floor(Math.random() * 100),
    sort: index,
    status: 'active',
    createdAt: '2024-01-01 10:00:00',
    updatedAt: '2024-01-15 10:00:00',
  }))
}

function h(tag: string, props: any, children?: any) {
  return { tag, props, children } as any
}

onMounted(async () => {
  await loadCategories()
  await loadTags()
  await loadData()
})
</script>

<style scoped lang="less">
.knowledge-card-list-page {
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

.card-view {
  padding: 8px 0;
}

.knowledge-card {
  margin-bottom: 16px;
  height: 280px;
  display: flex;
  flex-direction: column;
  position: relative;

  .card-checkbox-wrapper {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 4px;
    padding: 4px 8px;
  }

  :deep(.ant-card-body) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  :deep(.ant-card-meta-description) {
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-tags {
  margin: 12px 0;
  flex: 1;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8c8c8c;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
