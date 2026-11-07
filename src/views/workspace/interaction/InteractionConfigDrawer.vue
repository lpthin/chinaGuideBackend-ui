<template>
  <a-drawer
    :open="open"
    title="读者互动设置"
    :width="560"
    placement="right"
    @update:open="emit('update:open', $event)"
  >
    <a-spin :spinning="loading">
      <a-alert v-if="error" type="error" show-icon message="这一家的配置没读到" :description="error" />
      <a-form v-else :model="form" layout="vertical">
        <a-form-item label="AI 示例评论">
          <a-switch
            id="interaction-ai-comment"
            :checked="form.aiCommentEnabled === 1"
            :disabled="disabled"
            @update:checked="(v: boolean) => (form.aiCommentEnabled = v ? 1 : 0)"
          />
          <div class="field-hint">开了之后，新发布的稿子会在发布后一个月内挑随机时刻补写评论。</div>
        </a-form-item>

        <a-form-item label="虚拟点赞">
          <a-switch
            id="interaction-virtual-like"
            :checked="form.virtualLikeEnabled === 1"
            :disabled="disabled"
            @update:checked="(v: boolean) => (form.virtualLikeEnabled = v ? 1 : 0)"
          />
          <div class="field-hint">开了之后，发布那一刻就按下面的区间写一个点赞数；关掉只显真人点的。</div>
        </a-form-item>

        <a-form-item label="读者评论怎么处理">
          <a-radio-group id="interaction-moderation-mode" v-model:value="form.moderationMode" :disabled="disabled">
            <a-radio-button value="review">先进待审队列，我点放行才对外</a-radio-button>
            <a-radio-button value="auto">安全闸判过就直接显示</a-radio-button>
          </a-radio-group>
          <div class="field-hint">
            选了「判过就直接显示」，机器判不过的那一条也不会被丢掉，它会退回待审队列里等人。
          </div>
        </a-form-item>

        <a-form-item label="每篇最多补几条示例评论">
          <a-input-number id="interaction-seed-per-article" v-model:value="form.aiCommentMaxPerArticle" :min="1" :max="10" :disabled="disabled" />
          <div class="field-hint">1~10 条。一篇稿子底下十几条「好评」看起来就不像真实读者了。</div>
        </a-form-item>

        <a-form-item label="补写的点赞数区间">
          <a-space>
            <a-input-number id="interaction-like-min" v-model:value="form.likeSeedMin" :min="0" :max="999" :disabled="disabled" />
            <span class="range-sep">~</span>
            <a-input-number id="interaction-like-max" v-model:value="form.likeSeedMax" :min="0" :max="999" :disabled="disabled" />
          </a-space>
          <div class="field-hint">发布时在这段里随机取一个数。上界小于下界会存不下。</div>
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button :disabled="loading" @click="emit('reload')">重新读取</a-button>
            <a-button id="interaction-save-config" type="primary" :loading="saving" :disabled="disabled" @click="emit('save', { ...form })">
              保存设置
            </a-button>
          </a-space>
          <div v-if="!canManage" class="permission-hint">
            改这几项要「读者互动」的管理权限（interaction:manage）——客户管理员默认有这一码，也可以在角色页分给别的角色。
          </div>
          <div v-else-if="lastEditedAt" class="updated-hint">上次修改：{{ formatDateTime(lastEditedAt, true) }}</div>
        </a-form-item>
      </a-form>

      <a-alert v-if="disclosure" class="disclosure" type="warning" show-icon message="系统替你补了多少" :description="disclosure" />
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * 「读者互动设置」那一块（Spec-R R1）：原来占首屏 711px、手机 1005px 的一张卡，挪进右侧抽屉。
 *
 * 读写留在父页（切客户要跟着重取、保存完要回显后端那份值），这里只管表单与三态：
 * 读失败摆那句错、不渲染表单；平台档与缺 manage 码时所有写口全灰。
 * `disclosure` 原样念后端那一份，界面不拼第二份中文。
 */
import { computed, reactive, watch } from 'vue'
import type { InteractionConfig, InteractionConfigForm } from '../../../api/interaction'
import { formatDateTime } from '../../../utils/format'

const props = defineProps<{
  open: boolean
  loading: boolean
  saving: boolean
  error: string
  disclosure: string
  lastEditedAt: string | null
  canManage: boolean
  platformMode: boolean
  config: InteractionConfig | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  reload: []
  save: [form: InteractionConfigForm]
}>()

const disabled = computed(() => !props.canManage || props.platformMode)

const form = reactive<Required<InteractionConfigForm>>({
  aiCommentEnabled: 0,
  virtualLikeEnabled: 0,
  moderationMode: 'review',
  aiCommentMaxPerArticle: 3,
  likeSeedMin: 6,
  likeSeedMax: 28
})

watch(() => props.config, cfg => {
  if (!cfg) return
  form.aiCommentEnabled = cfg.aiCommentEnabled ?? 0
  form.virtualLikeEnabled = cfg.virtualLikeEnabled ?? 0
  form.moderationMode = cfg.moderationMode ?? 'review'
  form.aiCommentMaxPerArticle = cfg.aiCommentMaxPerArticle ?? 3
  form.likeSeedMin = cfg.likeSeedMin ?? 6
  form.likeSeedMax = cfg.likeSeedMax ?? 28
}, { immediate: true })
</script>

<style scoped lang="less">
.field-hint {
  margin-top: 4px;
  color: var(--admin-text-secondary);
  font-size: 13px;
}

.permission-hint,
.updated-hint {
  margin-top: var(--admin-space-1);
  color: var(--admin-text-secondary);
  font-size: 13px;
}

.range-sep {
  color: var(--admin-text-secondary);
}

.disclosure {
  margin-top: var(--admin-space-2);
}
</style>