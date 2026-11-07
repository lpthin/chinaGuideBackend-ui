<template>
  <a-drawer
    :open="open"
    title="这一条评论"
    :width="640"
    placement="right"
    @update:open="emit('update:open', $event)"
  >
    <template v-if="comment">
      <a-descriptions :column="1" size="small" bordered>
        <a-descriptions-item label="现在是什么状态">
          <a-tag :color="statusColor(comment.status)">{{ statusLabel(comment.status) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="挂在哪篇文章">
          <span>{{ comment.articleTitle || '—' }}</span>
          <a
            v-if="articleHref"
            id="interaction-open-article"
            class="article-link"
            :href="articleHref"
            target="_blank"
            rel="noopener noreferrer"
          >到站点上看这一条（新标签打开）</a>
        </a-descriptions-item>
        <a-descriptions-item label="谁写的">
          {{ comment.sourceText || '—' }}<span v-if="comment.authorName"> · {{ comment.authorName }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="机器判语">
          <span v-if="comment.moderationNote">{{ comment.moderationNote }}</span>
          <span v-else class="muted">—（机器没判过这一条，不是判过了没说）</span>
        </a-descriptions-item>
        <a-descriptions-item label="什么时候提交的">{{ formatDateTime(comment.createdAt, true) }}</a-descriptions-item>
        <a-descriptions-item label="谁处理的、什么时候">
          <span v-if="comment.reviewedAt">{{ comment.reviewedByName || '—' }} · {{ formatDateTime(comment.reviewedAt, true) }}</span>
          <span v-else class="muted">还没人处理过</span>
        </a-descriptions-item>
      </a-descriptions>

      <h4 class="full-text__title">全文（一字不截断）</h4>
      <div id="interaction-comment-full-text" class="full-text">{{ comment.content }}</div>
    </template>
    <a-empty v-else description="这一条已经不在队列里了，关掉再点一行" />

    <template #footer>
      <a-space v-if="comment && canManage" wrap>
        <a-button
          v-if="comment.status === 'pending' || comment.status === 'removed'"
          id="interaction-drawer-approve"
          type="primary"
          :disabled="platformMode"
          @click="emit('moderate', 'approve')"
        >{{ comment.status === 'removed' ? '放回' : '放行' }}</a-button>
        <a-button
          v-if="comment.status === 'pending'"
          danger
          :disabled="platformMode"
          @click="emit('moderate', 'reject')"
        >驳回</a-button>
        <a-popconfirm
          v-if="comment.status === 'pending' || comment.status === 'approved'"
          :title="removeConfirmTitle"
          ok-text="摘除"
          cancel-text="先不"
          @confirm="emit('moderate', 'remove')"
        >
          <a-button danger :disabled="platformMode">摘除</a-button>
        </a-popconfirm>
        <span v-if="comment.status === 'rejected'" class="muted">已驳回的评论不能再改状态。</span>
      </a-space>
      <span v-else-if="comment" class="muted">只读：改这一条要「读者互动」的管理权限（interaction:manage）。</span>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * 一条评论的详情（Spec-R R2，Q2/Q3/Q7/Q9 那四条拍板）。
 *
 * 队列里那一格正文两行封顶，要读完才能决定放不放行，所以全文在这里一字不截断；
 * 机器判语、谁写的、谁在什么时候处理的也都在这里，行里不再摊六个窄列。
 * 「到站点上看这一条」强制新标签：当前页跳走会把队列的筛选与页码丢干净。
 *
 * 地址不在这里拼：后端回 `articleUrl`（PortalUrls + SiteResolver 那一处产出），
 * 相对路径才按当前 origin 补前缀；后端没给就不摆链接，不摆一条点了 404 的地址。
 */
import { computed } from 'vue'
import type { InteractionCommentItem } from '../../../api/interaction'
import { formatDateTime } from '../../../utils/format'

const props = defineProps<{
  open: boolean
  comment: InteractionCommentItem | null
  canManage: boolean
  platformMode: boolean
  removeConfirmTitle: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  moderate: [action: 'approve' | 'reject' | 'remove']
}>()

const STATUS_LABELS: Record<string, string> = {
  pending: '待审',
  approved: '已对外',
  rejected: '已驳回',
  removed: '已摘除'
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

function statusColor(status: string) {
  if (status === 'approved') return 'green'
  if (status === 'rejected') return 'red'
  if (status === 'pending') return 'orange'
  return 'default'
}

const articleHref = computed(() => {
  const url = props.comment?.articleUrl
  if (!url) return ''
  return url.startsWith('http') ? url : `${window.location.origin}${url}`
})
</script>

<style scoped lang="less">
.article-link {
  margin-left: var(--admin-space-1);
}

.full-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.7;
  color: var(--admin-text-primary);

  &__title {
    margin: var(--admin-space-2) 0 var(--admin-space-1);
    font-size: 14px;
    font-weight: 600;
  }
}

.muted {
  color: var(--admin-text-secondary);
  font-size: 13px;
}
</style>