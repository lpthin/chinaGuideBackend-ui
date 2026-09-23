<template>
  <section v-if="entries.length" class="pb-section pb-section--tight">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <div class="pb-logos">
        <PortalBlockLink v-for="(entry, index) in entries" :key="index" :url="entry.url" class="pb-logos__item">
          <img v-if="entry.image" :src="entry.image" :alt="entry.name" />
          <span v-if="entry.name">{{ entry.name }}</span>
        </PortalBlockLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { field, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/** 标志墙：常见数据源是 featureProjects / cases；名与图都没有的条目直接丢掉，不留空格子 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))

const entries = computed(() => list(props.blockProps, 'items')
  .map(item => ({
    name: field(item, 'name', 'title'),
    image: field(item, 'image', 'coverImage', 'logo', 'avatar'),
    url: field(item, 'url', 'link')
  }))
  .filter(entry => entry.name || entry.image))
</script>

<style scoped lang="less">
.pb-logos {
  display: flex;
  flex-wrap: wrap;
  gap: calc(28px * var(--portal-spacing-scale));
  justify-content: center;
  align-items: center;

  &__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-width: 120px;
    color: var(--portal-color-muted);
    font-size: calc(14px * var(--portal-font-scale));
    text-decoration: none;

    img {
      height: 44px;
      width: auto;
      object-fit: contain;
      filter: grayscale(1);
      opacity: 0.75;
    }

    &:hover img {
      filter: none;
      opacity: 1;
    }
  }
}
</style>
