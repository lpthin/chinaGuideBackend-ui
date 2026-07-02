<template>
  <div class="knowledge-card-detail-page">
    <a-spin :spinning="loading">
      <a-page-header
        :title="card?.title"
        @back="goBack"
      >
        <template #extra>
          <a-space>
            <a-button @click="goBack">返回</a-button>
            <a-button type="primary" @click="goToEdit">编辑</a-button>
          </a-space>
        </template>
      </a-page-header>

      <a-row :gutter="24" style="margin-top: 16px">
        <a-col :span="18">
          <a-card :bordered="false">
            <div v-if="card?.coverImage" class="cover-image">
              <img :src="card.coverImage" alt="cover" />
            </div>

            <div class="card-info">
              <a-space>
                <a-tag color="blue">{{ categoryName }}</a-tag>
                <span><EyeOutlined style="margin-right: 4px" /> {{ card?.viewCount }} 浏览</span>
                <span><LikeOutlined style="margin-right: 4px" /> {{ card?.likeCount }} 点赞</span>
                <span>更新于 {{ formatDate(card?.updatedAt || '') }}</span>
              </a-space>
            </div>

            <div v-if="card?.document" class="document-link">
              <FileTextOutlined style="margin-right: 8px; color: #1890ff" />
              <span>关联文档：</span>
              <a @click="goToDocument(card.document.id)">{{ card.document.title }}</a>
            </div>

            <div class="card-tags">
              <a-tag v-for="tag in tagList" :key="tag">
                {{ tag }}
              </a-tag>
            </div>

            <a-divider />

            <div class="card-content" v-html="card?.content"></div>
          </a-card>
        </a-col>

        <a-col :span="6">
          <a-card title="相关推荐" :bordered="false">
            <a-list size="small" :data-source="relatedCards">
              <template #renderItem="{ item }">
                <a-list-item>
                  <a @click="goToDetail(item.id)">{{ item.title }}</a>
                </a-list-item>
              </template>
            </a-list>
          </a-card>

          <a-card title="操作" style="margin-top: 16px" :bordered="false">
            <a-space direction="vertical" style="width: 100%">
              <a-button type="primary" block @click="handleLike">
                <LikeOutlined /> 点赞 ({{ card?.likeCount }})
              </a-button>
              <a-button block @click="goToEdit">
                <EditOutlined /> 编辑
              </a-button>
              <a-button block danger @click="handleDelete">
                <DeleteOutlined /> 删除
              </a-button>
            </a-space>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  EyeOutlined,
  LikeOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from '@ant-design/icons-vue'
import { knowledgeCardApi, knowledgeCategoryApi } from '../../api/knowledge'
import type { KnowledgeCard, KnowledgeCategory } from '../../types/knowledge'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const card = ref<KnowledgeCard | null>(null)
const categories = ref<KnowledgeCategory[]>([])
const relatedCards = ref<KnowledgeCard[]>([])

const cardId = computed(() => Number(route.params.id))

const categoryName = computed(() => {
  if (!card.value) return '-'
  const category = categories.value.find(c => c.id === card.value!.categoryId)
  return category?.name || '-'
})

const tagList = computed(() => {
  if (!card.value?.tags) return []
  return card.value.tags.split(',').filter(t => t)
})

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function goBack() {
  router.back()
}

function goToEdit() {
  router.push(`/knowledge/card/${cardId.value}/edit`)
}

function goToDetail(id: number) {
  router.push(`/knowledge/card/${id}`)
}

function goToDocument(docId: number) {
  router.push(`/knowledge/document/${docId}`)
}

async function handleLike() {
  try {
    await knowledgeCardApi.like(cardId.value)
    message.success('点赞成功')
    if (card.value) {
      card.value.likeCount += 1
    }
  } catch (error) {
    message.error('点赞失败')
    console.error(error)
  }
}

async function handleDelete() {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这张知识卡片吗？此操作不可恢复。',
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      try {
        await knowledgeCardApi.delete(cardId.value)
        message.success('删除成功')
        router.push('/knowledge/cards')
      } catch (error) {
        message.error('删除失败')
        console.error(error)
      }
    },
  })
}

async function loadCategories() {
  try {
    const result = await knowledgeCategoryApi.all(1)
    categories.value = result
  } catch (error) {
    console.error(error)
  }
}

async function loadCard() {
  loading.value = true
  try {
    const result = await knowledgeCardApi.get(cardId.value)
    card.value = result
  } catch (error) {
    console.error(error)
    card.value = generateMockCard()
  } finally {
    loading.value = false
  }
}

async function loadRelatedCards() {
  try {
    const result = await knowledgeCardApi.list({
      tenantId: 1,
      categoryId: card.value?.categoryId,
      page: 1,
      size: 5,
    })
    relatedCards.value = result.records.filter(c => c.id !== cardId.value).slice(0, 4)
  } catch (error) {
    console.error(error)
    relatedCards.value = generateMockRelatedCards()
  }
}

function generateMockCard(): KnowledgeCard {
  return {
    id: 1,
    tenantId: 1,
    categoryId: 1,
    title: 'Vue 3 组合式 API 入门指南',
    summary: '本文详细介绍了 Vue 3 中组合式 API 的使用方法和最佳实践',
    content: `
      <h2>什么是组合式 API</h2>
      <p>组合式 API 是 Vue 3 引入的一种新的组件编写方式。它允许我们使用函数来组织组件逻辑，而不是依赖选项对象。</p>
      
      <h3>核心概念</h3>
      <ul>
        <li><strong>ref</strong> - 创建响应式的基本类型数据</li>
        <li><strong>reactive</strong> - 创建响应式的对象</li>
        <li><strong>computed</strong> - 创建计算属性</li>
        <li><strong>watch</strong> - 监听数据变化</li>
        <li><strong>生命周期钩子</strong> - onMounted, onUpdated 等</li>
      </ul>
      
      <h3>使用示例</h3>
      <pre><code>
import { ref, computed, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)
    
    function increment() {
      count.value++
    }
    
    onMounted(() => {
      console.log('Component mounted')
    })
    
    return { count, doubled, increment }
  }
}
      </code></pre>
      
      <h3>为什么使用组合式 API</h3>
      <p>组合式 API 提供了更好的代码组织方式，特别是在处理复杂组件时。它使得逻辑复用变得更加容易，并且提供了更好的 TypeScript 支持。</p>
    `,
    coverImage: '',
    tags: 'Vue,Vue3,组合式API',
    viewCount: 1256,
    likeCount: 89,
    sort: 0,
    status: 'active',
    createdAt: '2024-01-01 10:00:00',
    updatedAt: '2024-01-15 10:00:00',
  }
}

function generateMockRelatedCards(): KnowledgeCard[] {
  const titles = [
    'TypeScript 高级类型技巧',
    'Vue 3 响应式原理详解',
    'Pinia 状态管理入门',
    'Vite 构建工具使用指南',
  ]
  return titles.map((title, index) => ({
    id: index + 2,
    tenantId: 1,
    categoryId: 1,
    title,
    summary: '',
    content: '',
    coverImage: '',
    tags: '',
    viewCount: 0,
    likeCount: 0,
    sort: 0,
    status: 'active',
    createdAt: '',
    updatedAt: '',
  }))
}

onMounted(async () => {
  await loadCategories()
  await loadCard()
  await loadRelatedCards()
})
</script>

<style scoped lang="less">
.knowledge-card-detail-page {
  width: 100%;
}

.cover-image {
  margin-bottom: 24px;
  border-radius: 8px;
  overflow: hidden;

  img {
    width: 100%;
    max-height: 300px;
    object-fit: cover;
  }
}

.card-info {
  margin-bottom: 16px;
  color: #8c8c8c;
  font-size: 14px;
}

.document-link {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 6px;
  font-size: 14px;
  color: #595959;

  a {
    color: #1890ff;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.card-tags {
  margin-bottom: 16px;
}

.card-content {
  font-size: 15px;
  line-height: 1.8;
  color: #333;

  h2 {
    font-size: 22px;
    font-weight: 600;
    margin: 32px 0 16px;
    color: #1a1a1a;
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 24px 0 12px;
    color: #1a1a1a;
  }

  p {
    margin: 16px 0;
  }

  ul,
  ol {
    margin: 16px 0;
    padding-left: 24px;
  }

  li {
    margin: 8px 0;
  }

  pre {
    background: #f6f8fa;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 16px 0;
  }

  code {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 14px;
  }

  strong {
    color: #1890ff;
  }
}
</style>
