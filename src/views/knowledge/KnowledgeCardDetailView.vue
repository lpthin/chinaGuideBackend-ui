<template>
  <div class="knowledge-card-detail-page">
    <a-alert v-if="requestedTenantId === null" class="scope-alert" type="info" show-icon :message="scopeNotice" />
    <a-spin :spinning="loading">
      <a-page-header
        :title="card?.title"
        @back="goBack"
      >
        <template #extra>
          <a-space>
            <a-button @click="goBack">返回</a-button>
            <a-button type="primary" :disabled="requestedTenantId === null" @click="goToEdit">编辑</a-button>
          </a-space>
        </template>
      </a-page-header>

      <a-row :gutter="24" style="margin-top: 16px">
        <a-col :span="18">
          <a-card :bordered="false">
            <div class="card-info">
              <a-space>
                <a-tag color="blue">{{ categoryName }}</a-tag>
                <span><EyeOutlined style="margin-right: 4px" /> {{ card?.viewCount }} 浏览</span>
                <span>更新于 {{ formatDateTime(card?.updatedAt) }}</span>
              </a-space>
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
              <a-button block @click="goToEdit" :disabled="requestedTenantId === null">
                <EditOutlined /> 编辑
              </a-button>
              <a-button block danger @click="handleDelete" :disabled="requestedTenantId === null">
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import { knowledgeCardApi } from '../../api/knowledge'
import { describeHttpError } from '../../api/http'
import { formatDateTime } from '../../utils/format'
import type { KnowledgeCard } from '../../types/knowledge'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

/** 这一屏摆的是「哪一家」的卡片。没选客户时不发请求、不摆任何一家的内容。 */
const requestedTenantId = computed<number | null>(() => {
  if (auth.isSuperAdmin) return auth.selectedTenantId ?? null
  return auth.user?.tenantId ?? null
})

const scopeNotice = computed(() => {
  const id = requestedTenantId.value
  if (id === null) {
    return auth.isSuperAdmin
      ? '当前没有选定客户，这一屏不发请求、也不摆任何一家的知识卡片。请在右上角选一家客户。'
      : '登录信息里没有客户编号，这一屏不发请求、也不摆数。'
  }
  return `这一屏只摆编号 ${id} 的客户的知识卡片。`
})

const loading = ref(false)
const card = ref<KnowledgeCard | null>(null)
const relatedCards = ref<KnowledgeCard[]>([])

const cardId = computed(() => Number(route.params.id))

const categoryName = computed(() => card.value?.categoryName || '-')

const tagList = computed(() => {
  if (card.value?.tagList && card.value.tagList.length) return card.value.tagList
  if (!card.value?.tags) return []
  return typeof card.value.tags === 'string' ? card.value.tags.split(',').filter(t => t) : []
})

function goBack() {
  router.back()
}

function goToEdit() {
  if (requestedTenantId.value === null) {
    message.warning('当前没有选定客户，这一发没发出去（没有打开编辑）。请在右上角选一家客户。')
    return
  }
  router.push(`/workspace/knowledge/cards/edit/${cardId.value}`)
}

function goToDetail(id: number) {
  router.push(`/workspace/knowledge/cards/${id}`)
}

async function handleDelete() {
  if (requestedTenantId.value === null) {
    message.warning('当前没有选定客户，这一发没发出去（没有删除）。请在右上角选一家客户。')
    return
  }
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这张知识卡片吗？此操作不可恢复。',
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      try {
        await knowledgeCardApi.delete(cardId.value)
        message.success('删除成功')
        router.push('/workspace/knowledge/cards')
      } catch (error) {
        message.error(`删除失败：${describeHttpError(error)}`)
      }
    },
  })
}

async function loadCard() {
  if (requestedTenantId.value === null) {
    card.value = null
    return
  }
  loading.value = true
  try {
    const result = await knowledgeCardApi.get(cardId.value)
    card.value = result
  } catch (error) {
    message.error(`加载卡片详情失败：${describeHttpError(error)}`)
    card.value = null
  } finally {
    loading.value = false
  }
}

async function loadRelatedCards() {
  const tenantId = requestedTenantId.value
  if (tenantId === null || !card.value?.categoryId) {
    relatedCards.value = []
    return
  }
  try {
    const result = await knowledgeCardApi.list({
      tenantId,
      categoryId: card.value.categoryId,
      page: 1,
      size: 5,
    })
    relatedCards.value = result.records.filter(c => c.id !== cardId.value).slice(0, 4)
  } catch (error) {
    message.error(`加载相关推荐失败：${describeHttpError(error)}`)
    relatedCards.value = []
  }
}

watch(
  requestedTenantId,
  async () => {
    relatedCards.value = []
    await loadCard()
    await loadRelatedCards()
  }
)

onMounted(async () => {
  await loadCard()
  await loadRelatedCards()
})
</script>

<style scoped lang="less">
.scope-alert {
  margin-bottom: 16px;
}

.knowledge-card-detail-page {
  width: 100%;
}

.card-info {
  margin-bottom: 16px;
  color: #8c8c8c;
  font-size: 14px;
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
