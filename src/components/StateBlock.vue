<script setup lang="ts">
/**
 * 三态块（Spec-F §9.2-4）：空 / 错 / 未取到，三态语义不许互换（display.ts 的 PH_NONE / PH_NOT_MEASURED），
 * 每态自带一条「下一步做什么」，消灭 v-if 整块消失后用户面对空白。
 */
import { computed, ref } from 'vue'
import { PH_NONE, PH_NOT_MEASURED } from '../utils/display'
import { errorRawDetail } from '../utils/errorRaw'

const props = defineProps<{
  state: 'empty' | 'error' | 'not-measured'
  title?: string
  detail?: string
  next?: string
}>()

const TEXTS = {
  empty: { title: PH_NONE, next: '调整筛选条件，或新建一条记录' },
  error: { title: '读取失败', next: '稍后重试；持续失败请把页面上的原因或 traceId 提交工单' },
  'not-measured': { title: PH_NOT_MEASURED, next: '完成一次诊断/取数后这里才会出数，空着不代表是 0' },
} as const

const shownTitle = computed(() => props.title || TEXTS[props.state].title)
/**
 * 读失败的「下一步」要按原因分流（拍板 Q3-A）：权限不足让人一直「稍后重试」，
 * 问题不会好；登录失效更该去重新登录。判定只看人话文案（status 在 describeHttpError 里已经丢掉）。
 */
const PERMISSION_HINT = /没有权限|权限不足|无权/
const LOGIN_HINT = /登录状态已失效|重新登录/
const shownNext = computed(() => {
  if (props.next) return props.next
  if (props.state === 'error' && props.detail) {
    if (PERMISSION_HINT.test(props.detail)) return '请联系管理员，或换一个有该权限的账号。'
    if (LOGIN_HINT.test(props.detail)) return '请重新登录后再试。'
  }
  return TEXTS[props.state].next
})

/** 原文材料折叠在错误块里（拍板 Q5-A）：人话是标题，原始技术串给工单用 */
const rawDetail = computed(() => (props.state === 'error' ? errorRawDetail(props.detail) : null))
const copied = ref(false)
async function copyRaw(): Promise<void> {
  if (!rawDetail.value) return
  try {
    await navigator.clipboard.writeText(rawDetail.value)
    copied.value = true
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div class="admin-state-block" :data-state="state">
    <div class="admin-state-block__title">{{ shownTitle }}</div>
    <div v-if="detail" class="admin-state-block__detail">{{ detail }}</div>
    <div class="admin-state-block__next">{{ shownNext }}</div>
    <details v-if="rawDetail" class="admin-state-block__raw">
      <summary>错误原文（排查用，可复制给工单）</summary>
      <pre class="admin-state-block__rawtext">{{ rawDetail }}</pre>
      <button type="button" class="admin-state-block__copy" @click="copyRaw">
        {{ copied ? '已复制' : '复制原文' }}
      </button>
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

  &__copy {
    border: none;
    background: none;
    padding: 0;
    color: var(--admin-primary, #1677ff);
    cursor: pointer;
    font-size: 12px;
  }
}
</style>
