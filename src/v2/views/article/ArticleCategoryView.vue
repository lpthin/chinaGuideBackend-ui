<template>
  <div class="article-category-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <ApartmentOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalCategories }}</div>
                <div class="stat-title">分类总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalArticles }}</div>
                <div class="stat-title">文章总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <EyeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalViews }}</div>
                <div class="stat-title">总浏览量</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffec3d 100%)">
                <ArrowUpOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.maxLevel }}</div>
                <div class="stat-title">最大层级</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="24">
        <a-col :span="6">
          <a-card title="分类结构" :bordered="false">
            <template #extra>
              <a-space>
                <a-button type="primary" size="small" @click="showAddModal">
                  <template #icon><PlusOutlined /></template>
                  新增
                </a-button>
                <a-button size="small" @click="expandAll">
                  <template #icon><DownOutlined /></template>
                  全部展开
                </a-button>
                <a-button size="small" @click="collapseAll">
                  <template #icon><UpOutlined /></template>
                  全部收起
                </a-button>
              </a-space>
            </template>
            <a-input-search
              v-model:value="searchText"
              placeholder="搜索分类"
              style="margin-bottom: 12px"
              @search="onSearch"
            />
            <a-tree
              v-if="treeData.length"
              v-model:selectedKeys="selectedKeys"
              v-model:expandedKeys="expandedKeys"
              :tree-data="treeData"
              :show-icon="true"
              :draggable="true"
              @drop="onDrop"
              @select="onSelect"
            >
              <template #icon="{ isLeaf }">
                <FolderOutlined v-if="!isLeaf" />
                <FileOutlined v-else />
              </template>
              <template #title="{ key, title, status, icon, articleCount }">
                <div class="tree-node">
                  <span class="node-title">{{ title }}</span>
                  <a-tag v-if="status === 'disabled'" color="default" size="small">停用</a-tag>
                  <span class="node-count">{{ articleCount || 0 }}篇</span>
                  <div class="node-actions">
                    <a-button type="link" size="small" @click.stop="editCategory(key)">编辑</a-button>
                    <a-button type="link" size="small" danger @click.stop="deleteCategory(key)">删除</a-button>
                  </div>
                </div>
              </template>
            </a-tree>
            <a-empty v-else description="暂无分类" />
          </a-card>
        </a-col>

        <a-col :span="18">
          <a-card title="分类详情" :bordered="false" v-if="currentCategory">
            <a-form layout="vertical">
              <a-row :gutter="24">
                <a-col :span="12">
                  <a-form-item label="分类名称">
                    <a-input v-model:value="currentCategory.name" placeholder="请输入分类名称" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="上级分类">
                    <a-tree-select
                      v-model:value="currentCategory.parentId"
                      :tree-data="treeSelectData"
                      placeholder="选择上级分类（不选则为顶级）"
                      :tree-default-expand-all="true"
                      style="width: 100%"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="分类图标">
                    <a-select v-model:value="currentCategory.icon" style="width: 100%" placeholder="选择图标">
                      <a-select-option value="folder"><FolderOutlined /> 文件夹</a-select-option>
                      <a-select-option value="file"><FileOutlined /> 文件</a-select-option>
                      <a-select-option value="book"><BookOutlined /> 书籍</a-select-option>
                      <a-select-option value="news"><NotificationOutlined /> 新闻</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="排序号">
                    <a-input-number v-model:value="currentCategory.sort" :min="0" style="width: 100%" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="状态">
                    <a-radio-group v-model:value="currentCategory.status">
                      <a-radio value="active">启用</a-radio>
                      <a-radio value="disabled">停用</a-radio>
                    </a-radio-group>
                  </a-form-item>
                </a-col>
              </a-row>

              <a-divider orientation="left">描述信息</a-divider>

              <a-row :gutter="24">
                <a-col :span="24">
                  <a-form-item label="分类描述">
                    <a-textarea
                      v-model:value="currentCategory.description"
                      :rows="3"
                      placeholder="请输入分类描述"
                      :maxlength="500"
                      show-count
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>

            <template #extra>
              <a-space>
                <a-button @click="resetForm">重置</a-button>
                <a-button type="primary" :loading="saving" @click="saveCategory">保存</a-button>
              </a-space>
            </template>
          </a-card>
          <a-empty v-else description="请选择左侧分类进行编辑" />
        </a-col>
      </a-row>

      <a-modal
        v-model:open="showModal"
        :title="editingCategory ? '编辑分类' : '新增分类'"
        @ok="handleModalOk"
        @cancel="showModal = false"
        :confirmLoading="saving"
        :maskClosable="false"
        :destroyOnClose="true"
        width="600px"
      >
        <a-form layout="vertical">
          <a-form-item label="分类名称" required>
            <a-input v-model:value="modalForm.name" placeholder="请输入分类名称" />
          </a-form-item>
          <a-form-item label="上级分类">
            <a-tree-select
              v-model:value="modalForm.parentId"
              :tree-data="treeSelectData"
              placeholder="选择上级分类（不选则为顶级）"
              :tree-default-expand-all="true"
              style="width: 100%"
            />
          </a-form-item>
          <a-form-item label="分类图标">
            <a-select v-model:value="modalForm.icon" style="width: 100%" placeholder="选择图标">
              <a-select-option value="folder"><FolderOutlined /> 文件夹</a-select-option>
              <a-select-option value="file"><FileOutlined /> 文件</a-select-option>
              <a-select-option value="book"><BookOutlined /> 书籍</a-select-option>
              <a-select-option value="news"><NotificationOutlined /> 新闻</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="排序号">
            <a-input-number v-model:value="modalForm.sort" :min="0" style="width: 100%" />
          </a-form-item>
          <a-form-item label="分类描述">
            <a-textarea
              v-model:value="modalForm.description"
              :rows="3"
              placeholder="请输入分类描述"
            />
          </a-form-item>
        </a-form>
      </a-modal>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  ApartmentOutlined,
  FileTextOutlined,
  EyeOutlined,
  ArrowUpOutlined,
  PlusOutlined,
  DownOutlined,
  UpOutlined,
  FolderOutlined,
  FileOutlined,
  BookOutlined,
  NotificationOutlined,
} from '@ant-design/icons-vue'
import { articleCategoryApi } from '../../api/article'
import type { ArticleCategory, ArticleCategoryForm } from '../../types/article'

const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const editingCategory = ref<ArticleCategory | null>(null)

const stats = reactive({
  totalCategories: 0,
  totalArticles: 0,
  totalViews: 0,
  maxLevel: 3,
})

const searchText = ref('')
const selectedKeys = ref<string[]>([])
const expandedKeys = ref<string[]>([])
const categories = ref<ArticleCategory[]>([])
const currentCategory = ref<ArticleCategory | null>(null)

const modalForm = reactive<ArticleCategoryForm>({
  tenantId: 1,
  name: '',
  parentId: null,
  icon: 'folder',
  description: '',
  sort: 0,
  status: 'active',
})

const treeData = computed(() => buildTree(categories.value, null))
const treeSelectData = computed(() => buildSelectTree(categories.value, null))

function buildTree(list: ArticleCategory[], parentId: number | null): any[] {
  return list
    .filter(item => item.parentId === parentId)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
    .map(item => ({
      title: item.name,
      key: String(item.id),
      status: item.status,
      icon: item.icon,
      articleCount: 0,
      children: buildTree(list, item.id),
    }))
}

function buildSelectTree(list: ArticleCategory[], parentId: number | null): any[] {
  return list
    .filter(item => item.parentId === parentId)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
    .map(item => ({
      title: item.name,
      value: item.id,
      children: buildSelectTree(list, item.id),
    }))
}

function onSearch(value: string) {
  if (value) {
    const keys = findNodeKeys(categories.value, item => item.name.includes(value))
    expandedKeys.value = keys
  }
}

function findNodeKeys(list: ArticleCategory[], matchFn: (item: ArticleCategory) => boolean): string[] {
  const keys: string[] = []
  list.forEach(item => {
    if (matchFn(item)) {
      keys.push(String(item.id))
      let parent = list.find(p => p.id === item.parentId)
      while (parent) {
        keys.push(String(parent.id))
        parent = list.find(p => p.id === parent!.parentId)
      }
    }
  })
  return [...new Set(keys)]
}

function expandAll() {
  const allKeys = categories.value.map(c => String(c.id))
  expandedKeys.value = allKeys
}

function collapseAll() {
  expandedKeys.value = []
}

function onSelect(keys: string[]) {
  if (keys.length) {
    const id = Number(keys[0])
    const category = categories.value.find(c => c.id === id)
    if (category) {
      currentCategory.value = { ...category }
    }
  }
}

function onDrop(info: any) {
  const dragKey = info.dragNode.key
  const dropKey = info.node.key
  const dropPos = info.node.pos.split('-')
  const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1])

  const data = [...categories.value]
  const dragItem = data.find(item => String(item.id) === dragKey)
  const dropItem = data.find(item => String(item.id) === dropKey)

  if (!dragItem || !dropItem) return

  if (dropPosition === 0) {
    dragItem.parentId = dropItem.id
    message.success('已移动为子分类')
  } else {
    dragItem.parentId = dropItem.parentId
    message.success('已移动到同一级别')
  }
}

function showAddModal() {
  editingCategory.value = null
  modalForm.name = ''
  modalForm.parentId = selectedKeys.value.length ? Number(selectedKeys.value[0]) : null
  modalForm.icon = 'folder'
  modalForm.description = ''
  modalForm.sort = 0
  modalForm.status = 'active'
  showModal.value = true
}

function editCategory(key: string) {
  const id = Number(key)
  const category = categories.value.find(c => c.id === id)
  if (category) {
    editingCategory.value = category
    modalForm.name = category.name
    modalForm.parentId = category.parentId
    modalForm.icon = category.icon
    modalForm.description = category.description
    modalForm.sort = category.sort
    modalForm.status = category.status
    showModal.value = true
  }
}

async function deleteCategory(key: string) {
  Modal.confirm({
    title: '确认删除',
    content: '删除此分类将同时删除其所有子分类，确定要删除吗？',
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      try {
        await articleCategoryApi.delete(Number(key))
        message.success('删除成功')
        await loadData()
      } catch (error) {
        message.error('删除失败')
        console.error(error)
      }
    },
  })
}

async function handleModalOk() {
  if (!modalForm.name) {
    message.error('请输入分类名称')
    return
  }
  saving.value = true
  try {
    if (editingCategory.value) {
      await articleCategoryApi.update(editingCategory.value.id, modalForm)
      message.success('更新成功')
    } else {
      await articleCategoryApi.create(modalForm)
      message.success('创建成功')
    }
    showModal.value = false
    await loadData()
  } catch (error) {
    message.error('操作失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function saveCategory() {
  if (!currentCategory.value?.name) {
    message.error('请输入分类名称')
    return
  }
  saving.value = true
  try {
    await articleCategoryApi.update(currentCategory.value.id, currentCategory.value)
    message.success('保存成功')
    await loadData()
  } catch (error) {
    message.error('保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

function resetForm() {
  if (selectedKeys.value.length) {
    const id = Number(selectedKeys.value[0])
    const category = categories.value.find(c => c.id === id)
    if (category) {
      currentCategory.value = { ...category }
    }
  }
}

async function loadData() {
  loading.value = true
  try {
    const result = await articleCategoryApi.all(1)
    categories.value = result
    stats.totalCategories = result.length
    stats.totalArticles = result.reduce((sum, c) => sum + 0, 0)
    stats.totalViews = 0
    stats.maxLevel = getMaxLevel(result)
    if (result.length && !selectedKeys.value.length) {
      selectedKeys.value = [String(result[0].id)]
      currentCategory.value = { ...result[0] }
    }
  } catch (error) {
    console.error(error)
    const mockData = generateMockData()
    categories.value = mockData
    stats.totalCategories = mockData.length
    stats.totalArticles = mockData.reduce((sum, c) => sum + 0, 0)
    stats.totalViews = 0
    stats.maxLevel = getMaxLevel(mockData)
    if (mockData.length && !selectedKeys.value.length) {
      selectedKeys.value = [String(mockData[0].id)]
      currentCategory.value = { ...mockData[0] }
    }
  } finally {
    loading.value = false
  }
}

function getMaxLevel(list: ArticleCategory[]): number {
  let max = 1
  list.forEach(item => {
    let level = 1
    let parentId = item.parentId
    while (parentId) {
      level++
      const parent = list.find(p => p.id === parentId)
      parentId = parent?.parentId || null
    }
    max = Math.max(max, level)
  })
  return max
}

function generateMockData(): ArticleCategory[] {
  return [
    {
      id: 1,
      tenantId: 1,
      parentId: null,
      name: '公司新闻',
      icon: 'news',
      description: '公司内部新闻和公告',
      sort: 1,
      status: 'active',
      createdAt: '2024-01-01 10:00:00',
      updatedAt: '2024-01-01 10:00:00',
    },
    {
      id: 2,
      tenantId: 1,
      parentId: 1,
      name: '行业动态',
      icon: 'folder',
      description: '行业最新动态和趋势分析',
      sort: 1,
      status: 'active',
      createdAt: '2024-01-01 10:00:00',
      updatedAt: '2024-01-01 10:00:00',
    },
    {
      id: 3,
      tenantId: 1,
      parentId: 1,
      name: '产品发布',
      icon: 'folder',
      description: '新产品发布和功能更新',
      sort: 2,
      status: 'active',
      createdAt: '2024-01-01 10:00:00',
      updatedAt: '2024-01-01 10:00:00',
    },
    {
      id: 4,
      tenantId: 1,
      parentId: null,
      name: '技术博客',
      icon: 'book',
      description: '技术分享和开发经验',
      sort: 2,
      status: 'active',
      createdAt: '2024-01-01 10:00:00',
      updatedAt: '2024-01-01 10:00:00',
    },
    {
      id: 5,
      tenantId: 1,
      parentId: 4,
      name: '前端技术',
      icon: 'file',
      description: '前端技术相关文章',
      sort: 1,
      status: 'active',
      createdAt: '2024-01-01 10:00:00',
      updatedAt: '2024-01-01 10:00:00',
    },
    {
      id: 6,
      tenantId: 1,
      parentId: 4,
      name: '后端技术',
      icon: 'file',
      description: '后端技术相关文章',
      sort: 2,
      status: 'active',
      createdAt: '2024-01-01 10:00:00',
      updatedAt: '2024-01-01 10:00:00',
    },
  ]
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.article-category-page {
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

.tree-node {
  display: flex;
  align-items: center;
  width: 100%;
  padding-right: 8px;
}

.node-title {
  flex: 1;
}

.node-count {
  font-size: 12px;
  color: #8c8c8c;
  margin-left: 8px;
}

.node-actions {
  opacity: 0;
  transition: opacity 0.3s;
  margin-left: auto;
}

:deep(.ant-tree-treenode):hover .node-actions {
  opacity: 1;
}
</style>
