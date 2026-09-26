<template>
  <section v-if="entries.length" class="pb-section">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <ol class="pb-timeline">
        <li v-for="(entry, index) in entries" :key="index" class="pb-timeline__item">
          <div class="pb-timeline__when">
            <!-- 缺 date 的条目照常显示事件本身：库里 subtitle 不填是常态，
                 年份只是锚点，不是这条里程碑存不存在的条件 -->
            <span v-if="entry.date" class="pb-timeline__date">{{ entry.date }}</span>
          </div>
          <div class="pb-timeline__body">
            <h3 v-if="entry.title" class="pb-timeline__title">{{ entry.title }}</h3>
            <p v-if="entry.description" class="pb-timeline__text">{{ entry.description }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { field, list, text } from './types'

/**
 * 发展时间线（数据源 milestones，kind=milestone：subtitle→date、title→事件、body→说明）。
 *
 * 时间点、标题、说明各自按「有没有值」决定出不出行——但一条里程碑至少得有一样才配占一格，
 * 三样全空的条目直接丢掉，整块没条目就返回空（不放「暂无里程碑」这种占位文案）。
 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))

const entries = computed(() => list(props.blockProps, 'items')
  .map(item => ({
    date: field(item, 'date'),
    title: field(item, 'title'),
    description: field(item, 'description')
  }))
  .filter(entry => entry.date || entry.title || entry.description))
</script>

<style scoped lang="less">
.pb-timeline {
  margin: 0;
  padding: 0;
  list-style: none;

  &__item {
    display: grid;
    grid-template-columns: minmax(96px, 140px) minmax(0, 1fr);
    gap: calc(20px * var(--portal-spacing-scale));
    padding: calc(16px * var(--portal-spacing-scale)) 0;
    border-bottom: 1px solid var(--portal-color-border);

    &:last-child {
      border-bottom: none;
    }
  }

  &__when {
    display: flex;
    justify-content: flex-end;
  }

  &__date {
    font-size: calc(15px * var(--portal-font-scale));
    font-weight: 700;
    color: var(--portal-color-primary);
    white-space: nowrap;
  }

  &__title {
    margin: 0;
    font-size: calc(17px * var(--portal-font-scale));
    font-weight: 600;
    color: var(--portal-color-text);
  }

  &__text {
    margin: 8px 0 0;
    font-size: calc(15px * var(--portal-font-scale));
    line-height: 1.8;
    color: var(--portal-color-muted);
    white-space: pre-wrap;
  }
}

@container portal-viewport (max-width: 1024px) {
  .pb-timeline__item {
    grid-template-columns: minmax(84px, 110px) minmax(0, 1fr);
  }
}

@container portal-viewport (max-width: 640px) {
  // 窄屏把时间点挪到事件上方：两列在 375 放不下，日期被挤成竖排就白做了
  .pb-timeline__item {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .pb-timeline__when {
    justify-content: flex-start;
  }
}
</style>
