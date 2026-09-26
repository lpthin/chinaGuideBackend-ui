<template>
  <section v-if="entries.length" class="pb-section">
    <div class="pb-container pb-faq__wrap">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <div class="pb-faq">
        <div v-for="(entry, index) in entries" :key="index" class="pb-faq__item">
          <!-- 问答成对才是「折叠一条问答」：只有问题没问题答案、或反过来，就退化成一行静态文字，
               不摆一个点开里面空着的假按钮 -->
          <template v-if="entry.question && entry.answer">
            <button
              type="button"
              class="pb-faq__trigger"
              :aria-expanded="openIndexes.includes(index) ? 'true' : 'false'"
              @click="toggle(index)"
            >
              <span class="pb-faq__question">{{ entry.question }}</span>
              <span class="pb-faq__icon" aria-hidden="true"></span>
            </button>
            <div class="pb-faq__panel" :class="{ 'pb-faq__panel--open': openIndexes.includes(index) }">
              <div class="pb-faq__panel-inner">
                <p class="pb-faq__answer">{{ entry.answer }}</p>
              </div>
            </div>
          </template>
          <template v-else>
            <p v-if="entry.question" class="pb-faq__question pb-faq__question--static">{{ entry.question }}</p>
            <p v-if="entry.answer" class="pb-faq__answer">{{ entry.answer }}</p>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BlockContext } from './types'
import { field, list, text } from './types'

/**
 * 常见问题折叠（数据源 faqs，kind=faq：title→问题、body→答案）。
 *
 * 触发器是真 button 并带 aria-expanded：折叠控件用 div + onclick 的话键盘用户根本到不了这一格。
 * 允许同时展开多条——问答页的常见读法是「开着刚才那条、再看下一条」，强行互斥反而多一次点击。
 * 一条都拼不出内容（或 items 为空）就整块不渲染，不放「暂无常见问题」。
 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))

const entries = computed(() => list(props.blockProps, 'items')
  .map(item => ({
    question: field(item, 'question'),
    answer: field(item, 'answer')
  }))
  .filter(entry => entry.question || entry.answer))

const openIndexes = ref<number[]>([])

function toggle(index: number) {
  openIndexes.value = openIndexes.value.includes(index)
    ? openIndexes.value.filter(i => i !== index)
    : [...openIndexes.value, index]
}
</script>

<style scoped lang="less">
.pb-faq__wrap {
  max-width: 780px;
}

.pb-faq {
  &__item {
    border-bottom: 1px solid var(--portal-color-border);

    &:last-child {
      border-bottom: none;
    }
  }

  &__trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    padding: calc(18px * var(--portal-spacing-scale)) 0;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--portal-color-text);
    font: inherit;
  }

  &__question {
    margin: 0;
    font-size: calc(16px * var(--portal-font-scale));
    font-weight: 600;

    &--static {
      padding: calc(18px * var(--portal-spacing-scale)) 0 6px;
    }
  }

  &__icon {
    flex: none;
    width: 10px;
    height: 10px;
    border-right: 2px solid var(--portal-color-primary);
    border-bottom: 2px solid var(--portal-color-primary);
    transform: rotate(45deg);
    transition: transform 0.24s ease;
  }

  &__trigger[aria-expanded='true'] .pb-faq__icon {
    transform: rotate(225deg);
  }

  // 展开动画走 grid-template-rows（0fr→1fr）：不写死高度，答案长短都能丝滑收放
  &__panel {
    display: grid;
    grid-template-rows: 0fr;
    overflow: hidden;
    transition: grid-template-rows 0.28s ease;
  }

  &__panel--open {
    grid-template-rows: 1fr;
  }

  &__panel-inner {
    min-height: 0;
  }

  &__answer {
    margin: 0 0 calc(18px * var(--portal-spacing-scale));
    font-size: calc(15px * var(--portal-font-scale));
    line-height: 1.8;
    color: var(--portal-color-muted);
    white-space: pre-wrap;
  }
}

// 系统层要求减少动效时只留状态切换，不留展开/旋转动画（无障碍硬性要求）
@media (prefers-reduced-motion: reduce) {
  .pb-faq__panel {
    transition: none;
  }

  .pb-faq__icon {
    transition: none;
  }
}

@container portal-viewport (max-width: 1024px) {
  .pb-faq__question {
    font-size: calc(15px * var(--portal-font-scale));
  }
}

@container portal-viewport (max-width: 640px) {
  .pb-faq__trigger {
    gap: 10px;
    padding: calc(14px * var(--portal-spacing-scale)) 0;
  }
}
</style>
