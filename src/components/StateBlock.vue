<script setup lang="ts">
/**
 * 三态块（Spec-F §9.2-4）：空 / 错 / 未取到，三态语义不许互换（display.ts 的 PH_NONE / PH_NOT_MEASURED），
 * 每态自带一条「下一步做什么」，消灭 v-if 整块消失后用户面对空白。
 */
import { computed } from 'vue'
import { PH_NONE, PH_NOT_MEASURED } from '../utils/display'
import { errorRawDetail } from '../utils/errorRaw'
import { errorAdviceOfText } from '../utils/errorText'
import ErrorHelpActions from './ErrorHelpActions.vue'

const props = defineProps<{
  state: 'empty' | 'error' | 'not-measured'
  title?: string
  detail?: string
  next?: string
  /** 读口连续失败后的加一句（U3）：由调用方数次数，这里只负责摆出来 */
  hint?: string
}>()

const TEXTS = {
  empty: { title: PH_NONE, next: '调整筛选条件，或新建一条记录' },
  error: { title: '读取失败', next: '稍后重试；持续失败请把页面上的原因或 traceId 提交工单' },
  'not-measured': { title: PH_NOT_MEASURED, next: '完成一次诊断/取数后这里才会出数，空着不代表是 0' },
} as const

const shownTitle = computed(() => props.title || TEXTS[props.state].title)
/**
 * 读失败按 5 类文案库分流（SPEC-UI-7 U1）：detail 是「发生了什么」，
 * next 是「可以做什么」，help 是「要不要找人」。认不出来的一律回落通用句，
 * 不把业务提示硬说成服务异常。
 */
const advice = computed(() => (props.state === 'error' ? errorAdviceOfText(props.detail) : null))
const shownNext = computed(() => {
  if (props.next) return props.next
  return advice.value?.canDo || TEXTS[props.state].next
})
const shownHelp = computed(() => (props.next ? '' : advice.value?.askHelp || ''))

/** 原文材料折叠在错误块里（拍板 Q5-A）：人话是标题，原始技术串给工单用 */
const rawDetail = computed(() => (props.state === 'error' ? errorRawDetail(props.detail) : null))
</script>

<template>
  <div
    class="admin-state-block"
    :data-state="state"
    :role="state === 'error' ? 'status' : undefined"
    :aria-live="state === 'error' ? 'polite' : undefined"
    :aria-atomic="state === 'error' ? 'true' : undefined"
  >
    <div class="admin-state-block__title">{{ shownTitle }}</div>
    <div v-if="detail" class="admin-state-block__detail">{{ detail }}</div>
    <div class="admin-state-block__next">{{ shownNext }}</div>
    <div v-if="shownHelp" class="admin-state-block__help">{{ shownHelp }}</div>
    <!-- 403 / 401 的求助动作（SPEC-UI-7 U2）：念了「找管理员」就得给出入口 -->
    <div v-if="state === 'error' && detail" class="admin-state-block__help-actions">
      <ErrorHelpActions :text="detail" />
    </div>
    <div v-if="hint" class="admin-state-block__hint">{{ hint }}</div>
    <!-- 复制单条 / 导出整包 / 找管理员都收口在 ErrorHelpActions（SPEC-UI-9 H3），
         这里只留原始技术串本身 -->
    <details v-if="rawDetail" class="admin-state-block__raw">
      <summary>错误原文（排查用，可复制给工单）</summary>
      <pre class="admin-state-block__rawtext">{{ rawDetail }}</pre>
    </details>
    <div v-if="$slots.default" class="admin-state-block__extra">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="less">
.admin-state-block {
  padding: var(--admin-space-3, 24px);
  text-align: center;
  color: var(--admin-text-secondary);

  /* 标题比正文深一档这件事靠令牌表达，不靠再抄一支 #595959：
     这一支原来和 82 个页面页头用的那支近黑不是同一支，同一屏里两种「深灰字」。 */
  &__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--admin-text-primary);
  }

  &__detail {
    margin-top: var(--admin-space-1, 8px);
    font-size: 12px;
  }

  &__next {
    margin-top: var(--admin-space-1, 8px);
    font-size: 12px;
  }

  &__help {
    margin-top: 4px;
    font-size: 12px;
  }

  &__help-actions {
    margin-top: var(--admin-space-1, 8px);
  }

  &__hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--admin-text-secondary);
  }

  &__extra {
    margin-top: var(--admin-space-2, 16px);
  }

  &__raw {
    margin-top: var(--admin-space-1, 8px);
    text-align: left;
    font-size: 12px;

    summary {
      cursor: pointer;
      color: var(--admin-text-secondary);
    }

    summary:focus-visible {
      outline: 2px solid var(--admin-primary, #1677ff);
      outline-offset: 2px;
    }
  }

  &__rawtext {
    margin: 8px 0;
    padding: 8px;
    max-height: 160px;
    overflow: auto;
    background: var(--admin-fill-secondary, #f5f5f5);
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
