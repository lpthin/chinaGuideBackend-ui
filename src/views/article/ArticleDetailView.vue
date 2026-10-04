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

          <!-- Spec-K Q-P3 定稿 (a)：译稿在后台看得见、改得动（改造前只有 /versions 那条口读得到，界面上一个字都没有） -->
          <a-card
            v-if="localeVersions.length"
            title="语言档（译文）"
            :bordered="false"
            style="margin-top: 16px"
          >
            <a-alert
              type="info"
              show-icon
              message="这里改的是那一档语言的稿子本身"
              description="上面正文摆的是源语言那一版；发布仍然按整篇走（校验的是源语言版），门户与爬虫口目前也只出源语言。要让译稿对外可见属于「多语言 URL」那一档，得连 sitemap / canonical / hreflang 一起开。"
              style="margin-bottom: 12px"
            />

            <div v-for="v in localeVersions" :key="v.id" class="locale-block">
              <div class="locale-head">
                <a-tag color="geekblue">{{ v.locale }}</a-tag>
                <a-tag v-if="v.translationStatus === 'translated'" color="green">机器已译</a-tag>
                <span class="locale-meta">{{ v.aiModel || '模型未记录' }} · 更新于 {{ formatTime(v.updatedAt) }}</span>
                <a-button v-if="editingLocaleId !== v.id" size="small" @click="startEditLocale(v)">改</a-button>
              </div>

              <template v-if="editingLocaleId !== v.id">
                <div class="locale-title">{{ v.title }}</div>
                <div class="locale-summary">{{ v.summary }}</div>
                <pre class="locale-body">{{ v.contentMd }}</pre>
              </template>
              <template v-else>
                <a-input v-model:value="localeDraft.title" placeholder="这一档的标题" style="margin-bottom: 8px" />
                <a-textarea
                  v-model:value="localeDraft.summary"
                  :rows="2"
                  placeholder="这一档的摘要"
                  style="margin-bottom: 8px"
                />
                <a-textarea
                  v-model:value="localeDraft.contentMd"
                  :rows="12"
                  placeholder="这一档的正文（Markdown）"
                  style="margin-bottom: 8px"
                />
                <a-space>
                  <a-button type="primary" :loading="savingLocale" @click="saveLocale(v)">保存这一档</a-button>
                  <a-button @click="cancelEditLocale">取消</a-button>
                </a-space>
              </template>
            </div>
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
import type { Article, ArticleLocaleEdit, ArticleLocaleVersion } from '../../types/article'
import { marked } from 'marked'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const article = ref<Article | null>(null)
const versions = ref<ArticleLocaleVersion[]>([])

/**
 * 源语言那一档：后端写库时把它的 translation_status 记成 source，上面的正文卡摆的也是它。
 * 认不出来时退回「非 source 的都算译稿」，宁可少摆一档也不把源语言当译稿再摆一遍。
 */
const sourceVersion = computed(() => versions.value.find(v => v.translationStatus === 'source') ?? null)
const localeVersions = computed(() =>
  versions.value.filter(v => (sourceVersion.value ? v.id !== sourceVersion.value.id : v.translationStatus !== 'source'))
)
const editingLocaleId = ref<number | null>(null)
const localeDraft = ref<ArticleLocaleEdit>({})
const savingLocale = ref(false)

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

async function loadVersions(id: number) {
  try {
    const data = await articleManageApi.versions(id)
    versions.value = Array.isArray(data) ? (data as ArticleLocaleVersion[]) : []
  } catch (error) {
    // 读不到就整块不摆，也不拿源语言那一版冒充「有译文」——但必须说人话，不能静默
    versions.value = []
    message.warning(`语言档读取失败：${describeHttpError(error)}`)
  }
}

function startEditLocale(version: ArticleLocaleVersion) {
  editingLocaleId.value = version.id
  localeDraft.value = {
    title: version.title ?? '',
    summary: version.summary ?? '',
    contentMd: version.contentMd ?? '',
  }
}

function cancelEditLocale() {
  editingLocaleId.value = null
  localeDraft.value = {}
}

async function saveLocale(version: ArticleLocaleVersion) {
  if (!article.value) return
  savingLocale.value = true
  try {
    const saved = await articleManageApi.updateVersion(article.value.id, version.id, localeDraft.value)
    const merged = { ...version, ...(saved as ArticleLocaleVersion) }
    versions.value = versions.value.map(item => (item.id === version.id ? merged : item))
    editingLocaleId.value = null
    localeDraft.value = {}
    message.success(`${version.locale} 这一档已保存`)
  } catch (error) {
    message.error(`保存失败：${describeHttpError(error)}`)
  } finally {
    savingLocale.value = false
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
    loadVersions(Number(id))
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

.locale-block {
  padding: 12px 0;
  border-top: 1px solid #f0f0f0;

  &:first-of-type {
    border-top: none;
  }

  .locale-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .locale-meta {
      flex: 1;
      font-size: 12px;
      color: #8c8c8c;
    }
  }

  .locale-title {
    font-size: 15px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 6px;
  }

  .locale-summary {
    font-size: 13px;
    color: #595959;
    margin-bottom: 8px;
  }

  .locale-body {
    max-height: 260px;
    overflow-y: auto;
    background: #fafafa;
    padding: 12px;
    font-size: 13px;
    line-height: 1.7;
    white-space: pre-wrap;
    color: #434343;
  }
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
