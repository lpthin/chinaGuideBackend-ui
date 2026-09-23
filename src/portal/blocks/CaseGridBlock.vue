<template>
  <section v-if="items.length" class="pb-section pb-section--muted">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <div class="pb-grid" :class="gridClass">
        <PortalBlockLink v-for="(item, index) in items" :key="index" :url="field(item, 'link')" class="pb-card">
          <img v-if="field(item, 'coverImage')" :src="field(item, 'coverImage')" :alt="field(item, 'title')" class="pb-cover" />
          <h3 class="pb-card-title">{{ field(item, 'title') }}</h3>
          <p v-if="meta(item)" class="pb-card-meta">{{ meta(item) }}</p>
          <p v-if="field(item, 'summary')" class="pb-card-text">{{ field(item, 'summary') }}</p>
        </PortalBlockLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext, Item } from './types'
import { columnsClassOf, field, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const items = computed(() => list(props.blockProps, 'items'))
const gridClass = computed(() => columnsClassOf(props.blockProps))

/** 客户名与行业是案例的两个关键信息，缺一个就少一段，不补「未知行业」这类假值 */
function meta(item: Item) {
  return [field(item, 'customerName'), field(item, 'industry')].filter(Boolean).join(' · ')
}
</script>

<style scoped lang="less">
.pb-card-meta {
  margin: 0 0 8px;
  font-size: calc(13px * var(--portal-font-scale));
  color: var(--portal-color-primary);
}
</style>
