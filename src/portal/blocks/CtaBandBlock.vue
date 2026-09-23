<template>
  <section v-if="heading || body || primaryText" class="pb-cta">
    <div class="pb-container pb-cta__inner">
      <div>
        <h2 v-if="heading" class="pb-cta__title">{{ heading }}</h2>
        <p v-if="body" class="pb-cta__text">{{ body }}</p>
      </div>
      <PortalBlockLink v-if="primaryText" :url="primaryLink" class="pb-cta__btn">{{ primaryText }}</PortalBlockLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const body = computed(() => text(props.blockProps, 'text'))
const primaryText = computed(() => text(props.blockProps, 'primaryText'))
const primaryLink = computed(() => text(props.blockProps, 'primaryLink'))
</script>

<style scoped lang="less">
.pb-cta {
  padding: calc(72px * var(--portal-spacing-scale)) 0;
  background: color-mix(in srgb, var(--portal-color-primary) 92%, #05010f);
  color: #fff;

  &__inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 28px;
    justify-content: space-between;
  }

  &__title {
    margin: 0 0 10px;
    font-size: calc(28px * var(--portal-font-scale));
    font-weight: 700;
  }

  &__text {
    margin: 0;
    max-width: 640px;
    font-size: calc(15px * var(--portal-font-scale));
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.82);
    white-space: pre-wrap;
  }

  &__btn {
    padding: 13px 32px;
    border-radius: calc(var(--portal-radius) - 2px);
    background: #fff;
    color: var(--portal-color-text);
    font-size: calc(15px * var(--portal-font-scale));
    text-decoration: none;
    white-space: nowrap;
  }
}
</style>
