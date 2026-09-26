<template>
  <div class="article-detail-page">
    <a-spin :spinning="loading">
      <a-page-header
        :title="article?.title"
        @back="goBack"
      >
        <template #extra>
          <a-space>
            <a-button @click="copyLink">
              <ShareAltOutlined /> 复制本页链接
            </a-button>
            <a-button type="primary" @click="goToEdit">编辑</a-button>
          </a-space>
        </template>
      </a-page-header>

      <a-row :gutter="24" style="margin-top: 16px">
        <a-col :span="18">
          <a-card :bordered="false" v-if="article">
            <div class="article-meta">
              <a-space>
                <a-tag v-if="categoryName" color="blue">{{ categoryName }}</a-tag>
                <span v-else class="category-empty">分类未设置</span>
                <span><UserOutlined /> {{ article.source || '未填写来源' }}</span>
                <span><EyeOutlined /> {{ article.viewCount }} 浏览</span>
                <span><LikeOutlined /> {{ article.likeCount }} 点赞</span>
                <span>{{ formatTime(article.publishedAt) }}</span>
              </a-space>
            </div>

            <div class="article-keywords">
              <a-tag v-for="keyword in keywordList" :key="keyword" color="cyan">
                {{ keyword }}
              </a-tag>
            </div>

            <a-divider />

            <div class="article-summary">
              <strong>摘要：</strong>{{ article.summary }}
            </div>

            <a-divider />

            <div class="article-content" v-html="renderedContent"></div>
          </a-card>

          <a-card v-else :bordered="false">
            <a-empty description="文章不存在或已被删除" />
          </a-card>
        </a-col>

        <a-col :span="6">
          <a-card title="相关文章" :bordered="false">
            <a-list size="small" :data-source="relatedArticles" :split="false">
              <template #renderItem="{ item }">
                <a-list-item>
                  <a @click="goToDetail(item.id)">{{ item.title }}</a>
                </a-list-item>
              </template>
              <template #empty>
                <a-empty description="同分类暂无其他文章" />
              </template>
            </a-list>
          </a-card>

          <a-card title="操作" style="margin-top: 16px" :bordered="false" v-if="article">
            <a-space direction="vertical" style="width: 100%">
              <a-button type="primary" block @click="goToEdit">
                <EditOutlined /> 编辑文章
              </a-button>
              <a-popconfirm
                title="确定要删除这篇文章吗？"
                @confirm="handleDelete"
              >
                <a-button type="primary" danger block>
                  <DeleteOutlined /> 删除文章
                </a-button>
              </a-popconfirm>
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
import { message } from 'ant-design-vue'
import {
  EyeOutlined,
  LikeOutlined,
  ShareAltOutlined,
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import { articleManageApi } from '../../api/article'
import { describeHttpError } from '../../api/http'
import { formatTime } from '../../utils/format'
import type { Article } from '../../types/article'
import { marked } from 'marked'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const article = ref<Article | null>(null)

/** 后端详情接口会带 categoryName；没有就是真的没分类，不能写成「未分类」冒充 */
const categoryName = computed(() => article.value?.categoryName || '')

const keywordList = computed(() => {
  if (!article.value?.keywords) return []
  return article.value.keywords.split(',').filter(k => k.trim())
})

const renderedContent = computed(() => {
  if (!article.value?.content) return ''
  try {
    return marked.parse(article.value.content) as string
  } catch {
    return article.value.content
  }
})

const relatedArticles = ref<{ id: number; title: string }[]>([])

function goBack() {
  router.back()
}

function goToEdit() {
  if (article.value) {
    router.push({ name: 'workspace-article-edit', params: { id: article.value.id } })
  }
}

function goToDetail(id: number) {
  router.push(`/workspace/articles/${id}`)
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    message.success('链接已复制')
  } catch {
    message.error('浏览器不允许复制，请手动复制地址栏链接')
  }
}

async function loadRelated(current: Article) {
  if (!current.categoryId) {
    relatedArticles.value = []
    return
  }
  try {
    const data: any = await articleManageApi.list({ tenantId: current.tenantId, categoryId: current.categoryId, page: 1, size: 6 })
    relatedArticles.value = (data?.records || [])
      .filter((item: any) => item.id !== current.id)
      .slice(0, 5)
      .map((item: any) => ({ id: item.id, title: item.title }))
  } catch {
    // 相关文章只是补充信息，加载失败就留空，不用假数据顶替
    relatedArticles.value = []
  }
}

async function handleDelete() {
  if (!article.value) return
  try {
    await articleManageApi.delete(article.value.id)
    message.success('删除成功')
    router.push('/workspace/articles')
  } catch (error) {
    message.error(`删除失败：${describeHttpError(error)}`)
  }
}

async function loadArticle() {
  const id = route.params.id
  if (!id) {
    message.error('文章ID不存在')
    return
  }

  loading.value = true
  try {
    const data = await articleManageApi.get(Number(id))
    article.value = data as Article
    loadRelated(data as Article)
  } catch (error) {
    message.error(`加载文章详情失败：${describeHttpError(error)}`)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadArticle()
})
</script>

<style scoped lang="less">
.article-detail-page {
  width: 100%;
}

.article-meta {
  font-size: 14px;
  color: #8c8c8c;
  margin-bottom: 16px;

  .category-empty {
    color: #bfbfbf;
  }
}

.article-keywords {
  margin-bottom: 16px;
}

.article-summary {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.8;
  color: #595959;
}

.article-content {
  font-size: 15px;
  line-height: 2;
  color: #333;

  h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 32px 0 16px;
    color: #1a1a1a;
    padding-bottom: 8px;
    border-bottom: 2px solid #1890ff;
  }

  h3 {
    font-size: 17px;
    font-weight: 600;
    margin: 24px 0 12px;
    color: #1a1a1a;
  }

  p {
    margin: 16px 0;
    text-indent: 2em;
  }

  ul,
  ol {
    margin: 16px 0;
    padding-left: 2em;
  }

  li {
    margin: 8px 0;
  }

  pre {
    background: #f5f5f5;
    padding: 16px;
    border-radius: 4px;
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
