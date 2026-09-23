<template>
  <section v-if="slides.length" class="pb-banner">
    <a-carousel v-if="slides.length > 1" autoplay :dots="true">
      <PortalBlockLink v-for="slide in slides" :key="slide.id" :url="slide.link" class="pb-banner__slide">
        <img :src="slide.image" :alt="slide.title" />
        <div v-if="slide.title || slide.subtitle" class="pb-banner__caption">
          <h2 v-if="slide.title">{{ slide.title }}</h2>
          <p v-if="slide.subtitle">{{ slide.subtitle }}</p>
        </div>
      </PortalBlockLink>
    </a-carousel>
    <PortalBlockLink v-else :url="slides[0].link" class="pb-banner__slide pb-banner__slide--single">
      <img :src="slides[0].image" :alt="slides[0].title" />
    </PortalBlockLink>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { field, list } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/**
 * 轮播：没有图片的 banner 一律不进轮播（a-carousel 里放空白块比不放更难看）。
 * 旧模板取了 banners 数据却从没渲染，所以内置首页不含本区块——要用得站点自己加。
 */
const props = defineProps<BlockContext>()

const slides = computed(() => list(props.blockProps, 'items')
  .map(item => ({
    id: field(item, 'id') || field(item, 'imageUrl'),
    image: field(item, 'imageUrl', 'image', 'coverImage'),
    title: field(item, 'title'),
    subtitle: field(item, 'subtitle'),
    link: field(item, 'linkUrl', 'link')
  }))
  .filter(slide => slide.image))
</script>

<style scoped lang="less">
.pb-banner {
  background: var(--portal-color-bg);

  &__slide {
    position: relative;
    display: block;
    text-decoration: none;

    img {
      width: 100%;
      height: 420px;
      object-fit: cover;
      display: block;
    }

    &--single img {
      height: 360px;
    }
  }

  &__caption {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 40px 24px;
    color: #fff;
    background: linear-gradient(transparent, rgba(5, 1, 15, 0.72));

    h2 {
      margin: 0 0 6px;
      font-size: calc(28px * var(--portal-font-scale));
    }

    p {
      margin: 0;
      font-size: calc(15px * var(--portal-font-scale));
      opacity: 0.86;
    }
  }
}
</style>
