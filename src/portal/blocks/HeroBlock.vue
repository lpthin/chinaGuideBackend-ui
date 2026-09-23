<template>
  <section v-if="hasContent" class="pb-hero">
    <div class="pb-hero__bg" aria-hidden="true">
      <span class="pb-hero__shape pb-hero__shape--1"></span>
      <span class="pb-hero__shape pb-hero__shape--2"></span>
    </div>
    <div class="pb-container pb-hero__content">
      <span v-if="eyebrow" class="pb-hero__eyebrow">{{ eyebrow }}</span>
      <h1 v-if="title" class="pb-hero__title">{{ title }}</h1>
      <p v-if="subtitle" class="pb-hero__subtitle">{{ subtitle }}</p>
      <p v-if="description" class="pb-hero__desc">{{ description }}</p>
      <div v-if="primaryText || secondaryText" class="pb-hero__actions">
        <PortalBlockLink v-if="primaryText" :url="primaryLink" class="pb-hero__btn pb-hero__btn--primary">
          {{ primaryText }}
        </PortalBlockLink>
        <PortalBlockLink v-if="secondaryText" :url="secondaryLink" class="pb-hero__btn pb-hero__btn--ghost">
          {{ secondaryText }}
        </PortalBlockLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/** 主视觉：槽位全空就整块不渲染，不留一块只有渐变的空白高度。 */
const props = defineProps<BlockContext>()

const eyebrow = computed(() => text(props.blockProps, 'eyebrow'))
const title = computed(() => text(props.blockProps, 'title'))
const subtitle = computed(() => text(props.blockProps, 'subtitle'))
const description = computed(() => text(props.blockProps, 'description'))
const primaryText = computed(() => text(props.blockProps, 'primaryText'))
const primaryLink = computed(() => text(props.blockProps, 'primaryLink'))
const secondaryText = computed(() => text(props.blockProps, 'secondaryText'))
const secondaryLink = computed(() => text(props.blockProps, 'secondaryLink'))

const hasContent = computed(() => Boolean(title.value || subtitle.value || description.value || eyebrow.value))
</script>

<style scoped lang="less">
.pb-hero {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 520px;
  padding: calc(96px * var(--portal-spacing-scale)) 0;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--portal-color-primary) 62%, #05010f) 0%,
    color-mix(in srgb, var(--portal-color-primary) 38%, #1b1035) 55%,
    color-mix(in srgb, var(--portal-color-primary) 22%, #14122b) 100%
  );

  &__bg {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
    background-size: 56px 56px;
  }

  &__shape {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    background: color-mix(in srgb, var(--portal-color-primary) 55%, transparent);

    &--1 {
      width: 320px;
      height: 320px;
      top: -80px;
      right: 8%;
    }

    &--2 {
      width: 260px;
      height: 260px;
      bottom: -100px;
      left: 12%;
      opacity: 0.7;
    }
  }

  &__content {
    position: relative;
    text-align: center;
    color: #fff;
  }

  &__eyebrow {
    display: inline-block;
    padding: 6px 16px;
    margin-bottom: 18px;
    border-radius: 20px;
    font-size: calc(13px * var(--portal-font-scale));
    background: rgba(255, 255, 255, 0.14);
  }

  &__title {
    margin: 0 0 14px;
    font-size: calc(52px * var(--portal-font-scale));
    font-weight: 700;
    line-height: 1.15;
  }

  &__subtitle {
    margin: 0 0 10px;
    font-size: calc(20px * var(--portal-font-scale));
    color: rgba(255, 255, 255, 0.86);
  }

  &__desc {
    margin: 0 auto 28px;
    max-width: 720px;
    font-size: calc(16px * var(--portal-font-scale));
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.72);
  }

  &__actions {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
  }

  &__btn {
    padding: 12px 30px;
    border-radius: calc(var(--portal-radius) - 2px);
    font-size: calc(15px * var(--portal-font-scale));
    text-decoration: none;

    &--primary {
      background: #fff;
      color: var(--portal-color-text);
    }

    &--ghost {
      border: 1px solid rgba(255, 255, 255, 0.6);
      color: #fff;
    }
  }
}

@container portal-viewport (max-width: 640px) {
  .pb-hero {
    min-height: 420px;

    &__title {
      font-size: calc(30px * var(--portal-font-scale));
    }
  }
}
</style>
