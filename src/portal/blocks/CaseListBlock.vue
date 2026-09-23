<template>
  <section v-if="items.length" class="pb-section pb-section--tight">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <ul class="pb-case-list">
        <li v-for="(item, index) in items" :key="index">
          <PortalBlockLink :url="field(item, 'link')" class="pb-case-list__row">
            <span class="pb-case-list__title">{{ field(item, 'title') }}</span>
            <span v-if="meta(item)" class="pb-case-list__meta">{{ meta(item) }}</span>
            <p v-if="field(item, 'summary')" class="pb-case-list__summary">{{ field(item, 'summary') }}</p>
          </PortalBlockLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext, Item } from './types'
import { field, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const items = computed(() => list(props.blockProps, 'items'))

function meta(item: Item) {
  return [field(item, 'customerName'), field(item, 'industry')].filter(Boolean).join(' · ')
}
</script>

<style scoped lang="less">
.pb-case-list {
  margin: 0;
  padding: 0;
  list-style: none;

  &__row {
    display: block;
    padding: calc(22px * var(--portal-spacing-scale)) 0;
    border-bottom: 1px solid var(--portal-color-border);
    text-decoration: none;
  }

  &__title {
    display: block;
    font-size: calc(18px * var(--portal-font-scale));
    font-weight: 600;
    color: var(--portal-color-text);
  }

  &__meta {
    display: block;
    margin-top: 6px;
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-primary);
  }

  &__summary {
    margin: 8px 0 0;
    font-size: calc(14px * var(--portal-font-scale));
    line-height: 1.7;
    color: var(--portal-color-muted);
  }
}
</style>
