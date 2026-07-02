<template>
  <div class="article-detail-page">
    <a-spin :spinning="loading">
      <a-page-header
        :title="article?.title"
        @back="goBack"
      >
        <template #extra>
          <a-space>
            <a-button @click="handleShare">
              <ShareAltOutlined /> 分享
            </a-button>
            <a-button type="primary" @click="goToEdit">编辑</a-button>
          </a-space>
        </template>
      </a-page-header>

      <a-row :gutter="24" style="margin-top: 16px">
        <a-col :span="18">
          <a-card :bordered="false">
            <div class="article-meta">
              <a-space>
                <a-tag color="blue">{{ categoryName }}</a-tag>
                <span><UserOutlined /> {{ article?.source || '原创' }}</span>
                <span><EyeOutlined /> {{ article?.viewCount }} 浏览</span>
                <span><LikeOutlined /> {{ article?.likeCount }} 点赞</span>
                <span><ShareAltOutlined /> {{ article?.shareCount }} 分享</span>
                <span>{{ formatDate(article?.publishAt || '') }}</span>
              </a-space>
            </div>

            <div class="article-keywords">
              <a-tag v-for="keyword in keywordList" :key="keyword" color="cyan">
                {{ keyword }}
              </a-tag>
            </div>

            <a-divider />

            <div class="article-summary">
              <strong>摘要：</strong>{{ article?.summary }}
            </div>

            <a-divider />

            <div class="article-content" v-html="article?.content"></div>
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
            </a-list>
          </a-card>

          <a-card title="操作" style="margin-top: 16px" :bordered="false">
            <a-space direction="vertical" style="width: 100%">
              <a-button type="primary" block @click="handleLike">
                <LikeOutlined /> 点赞 ({{ article?.likeCount }})
              </a-button>
              <a-button block @click="goToEdit">
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

const router = useRouter()
const route = useRoute()
const loading = ref(false)

const article = ref<any>({
  id: 1,
  title: '2024年行业发展趋势报告发布',
  summary: '本报告深入分析了2024年行业发展的主要趋势，包括AI技术应用、数字化转型、云计算普及、数据安全等热点话题，为企业决策提供参考依据。',
  content: `
    <h2>一、人工智能技术的广泛应用</h2>
    <p>2024年，人工智能技术继续在各个领域发挥重要作用。从智能客服到自动驾驶，从医疗诊断到金融分析，AI正在改变我们的工作和生活方式。</p>

    <h3>1.1 大语言模型的发展</h3>
    <p>大语言模型（LLM）在2024年取得了显著进展，模型规模不断扩大，能力也在持续增强。企业开始将LLM应用于客户服务、内容生成、代码辅助等场景。</p>

    <h3>1.2 多模态AI的崛起</h3>
    <p>文本、图像、音频、视频的多模态AI模型开始普及，为用户提供更丰富的交互体验。</p>

    <h2>二、数字化转型加速</h2>
    <p>越来越多的企业开始全面数字化转型，从传统的线下业务转向线上运营，提高效率，降低成本。</p>

    <h3>2.1 云端优先战略</h3>
    <p>企业普遍采用云端优先战略，将核心系统迁移到云上，实现弹性扩展和高可用性。</p>

    <h3>2.2 数据驱动决策</h3>
    <p>数据分析和商业智能成为企业决策的重要依据，数据驱动的文化正在形成。</p>

    <h2>三、总结与展望</h2>
    <p>2024年是技术快速发展的一年，企业需要紧跟趋势，积极拥抱新技术，才能在激烈的竞争中立于不败之地。</p>
  `,
  categoryId: 1,
  source: '原创',
  keywords: 'AI,数字化,云计算,数据安全',
  viewCount: 8563,
  likeCount: 256,
  shareCount: 89,
  status: 'active',
  publishAt: '2024-03-15 10:00:00',
  createdAt: '2024-03-10 09:00:00',
  updatedAt: '2024-03-15 08:00:00',
})

const categoryName = computed(() => {
  const categories: Record<number, string> = {
    1: '公司新闻',
    2: '行业动态',
    3: '产品发布',
    4: '技术博客',
  }
  return categories[article.value.categoryId] || '未分类'
})

const keywordList = computed(() => {
  return article.value.keywords?.split(',').filter(k => k) || []
})

const relatedArticles = [
  { id: 2, title: '公司完成新一轮融资，加速产品研发' },
  { id: 3, title: '新产品 v2.0 正式发布，新增多项功能' },
  { id: 4, title: 'Vue 3 组合式 API 最佳实践' },
  { id: 5, title: '微服务架构设计原则详解' },
]

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
  router.push(`/article/${article.value.id}/edit`)
}

function goToDetail(id: number) {
  router.push(`/article/${id}`)
}

function handleShare() {
  message.success('分享链接已复制')
}

function handleLike() {
  article.value.likeCount += 1
  message.success('点赞成功')
}

async function handleDelete() {
  try {
    message.success('删除成功')
    router.push('/article/list')
  } catch (error) {
    message.error('删除失败')
  }
}

onMounted(() => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 300)
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
