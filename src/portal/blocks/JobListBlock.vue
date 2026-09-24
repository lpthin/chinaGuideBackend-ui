<template>
  <section v-if="items.length" class="pb-section">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <!-- 岗位字段全部来自 portal_job（区块只有 items 一个数据槽，结构里抄不进去第二份岗位）。
           长文本用 pre-wrap 保留换行、不用 v-html：门户是免鉴权公开页。 -->
      <article v-for="(item, index) in items" :key="index" class="pb-job">
        <h3 class="pb-job__title">{{ field(item, 'title') }}</h3>
        <p v-if="meta(item)" class="pb-job__meta">{{ meta(item) }}</p>
        <p v-if="field(item, 'salaryText')" class="pb-job__salary">{{ field(item, 'salaryText') }}</p>
        <p v-if="field(item, 'description')" class="pb-job__text">{{ field(item, 'description') }}</p>
        <details v-if="field(item, 'requirements')" class="pb-job__more">
          <summary class="pb-job__more-title">任职要求</summary>
          <p class="pb-job__text">{{ field(item, 'requirements') }}</p>
        </details>
        <details v-if="field(item, 'benefits')" class="pb-job__more">
          <summary class="pb-job__more-title">福利待遇</summary>
          <p class="pb-job__text">{{ field(item, 'benefits') }}</p>
        </details>
        <p v-if="field(item, 'publishAt')" class="pb-job__date">发布于 {{ formatDate(field(item, 'publishAt')) }}</p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext, Item } from './types'
import { field, list, text } from './types'
import { formatDate } from '../../utils/format'

const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const items = computed(() => list(props.blockProps, 'items'))

/** 一条岗位里库里没填的部分直接不出现，不拿「面议」「不限」这类话冒充数据 */
function meta(item: Item) {
  return [field(item, 'department'), field(item, 'jobType'), field(item, 'location'),
    field(item, 'experienceReq'), field(item, 'educationReq')].filter(Boolean).join(' · ')
}
</script>

<style scoped lang="less">
.pb-job {
  padding: calc(22px * var(--portal-spacing-scale)) 0;
  border-bottom: 1px solid var(--portal-color-border);

  &:last-child {
    border-bottom: none;
  }

  &__title {
    margin: 0;
    font-size: calc(19px * var(--portal-font-scale));
    font-weight: 600;
    color: var(--portal-color-text);
  }

  &__meta {
    margin: 8px 0 0;
    font-size: calc(14px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }

  &__salary {
    margin: 8px 0 0;
    font-size: calc(15px * var(--portal-font-scale));
    font-weight: 600;
    color: var(--portal-color-primary);
  }

  &__text {
    margin: 10px 0 0;
    font-size: calc(15px * var(--portal-font-scale));
    line-height: 1.8;
    color: var(--portal-color-muted);
    white-space: pre-wrap;
  }

  &__more {
    margin-top: 10px;
  }

  &__more-title {
    cursor: pointer;
    font-size: calc(14px * var(--portal-font-scale));
    color: var(--portal-color-primary);
  }

  &__date {
    margin: 10px 0 0;
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }
}
</style>
