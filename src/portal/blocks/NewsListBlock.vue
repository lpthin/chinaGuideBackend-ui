<template>
  <section v-if="items.length" class="pb-section">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <div class="pb-grid pb-grid--3">
        <PortalBlockLink v-for="(item, index) in items" :key="index" :url="field(item, 'link')" class="pb-card pb-news">
          <img v-if="field(item, 'coverImage')" :src="field(item, 'coverImage')" :alt="field(item, 'title')" class="pb-cover" />
          <div class="pb-news__meta">
            <time v-if="field(item, 'publishedAt')" :datetime="field(item, 'publishedAt')">
              {{ formatDate(field(item, 'publishedAt')) }}
            </time>
            <span v-if="field(item, 'category')" class="pb-news__category">{{ field(item, 'category') }}</span>
          </div>
          <h3 class="pb-card-title">{{ field(item, 'title') }}</h3>
          <p v-if="showSummary && field(item, 'summary')" class="pb-card-text">{{ field(item, 'summary') }}</p>
        </PortalBlockLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { field, flag, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'
import { formatDate } from '../../utils/format'

const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const items = computed(() => list(props.blockProps, 'items'))
/** 摘要默认显示：旧模板的新闻卡片一直带摘要，区块配置没写 showSummary 时不该突然变样 */
const showSummary = computed(() => flag(props.blockProps, 'showSummary', true))
</script>

<style scoped lang="less">
.pb-news {
  &__meta {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 10px;
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }

  &__category {
    color: var(--portal-color-primary);
  }
}
</style>
