<template>
  <section v-if="hasContent" class="pb-page-hero">
    <div class="pb-container pb-page-hero__inner">
      <h1 v-if="title" class="pb-page-hero__title">{{ title }}</h1>
      <p v-if="subtitle" class="pb-page-hero__subtitle">{{ subtitle }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { text } from './types'

/**
 * 内页标题条：一条有底色的窄横幅 + 标题 + 副标题（Spec-E T6，形状是从模板站逐页量出来的，实测 180–260px）。
 *
 * <p>与主视觉的分工：hero 是首页那一屏（520px 起、能配图、有 CTA），这一块是内页的那一条。
 * 两者不共用组件正是重点——把内页首屏也长成主视觉，每个列表页都会多出一整屏没内容的渐变。
 * 所以这里没有图槽也没有按钮槽（后端 dataSchema 同样只有两个文字槽），
 * 值来自 props，{@code $data} 绑定由后端解析，组件只看「有没有字」。</p>
 *
 * <p>两个槽都空时整块不渲染：一条只有底色的空带子会占掉首屏两百多像素，
 * 而缺标题这件事本该由「这一条没出来」暴露出去。</p>
 */
const props = defineProps<BlockContext>()

const title = computed(() => text(props.blockProps, 'title'))
const subtitle = computed(() => text(props.blockProps, 'subtitle'))

const hasContent = computed(() => Boolean(title.value || subtitle.value))
</script>

<style scoped lang="less">
.pb-page-hero {
  /* 比主视觉浅一档的底色：同一支主色，压得更实、渐变幅度更小——
     它是「页首的一条」，不是「整屏的一张海报」，深浅差别就是两者的分工。 */
  padding: calc(46px * var(--portal-spacing-scale)) 0;
  background: linear-gradient(
    120deg,
    color-mix(in srgb, var(--portal-color-primary) 88%, #05010f) 0%,
    color-mix(in srgb, var(--portal-color-primary) 66%, #1b1035) 100%
  );
  color: #fff;

  &__inner {
    display: grid;
    gap: calc(10px * var(--portal-spacing-scale));
    justify-items: center;
    text-align: center;
  }

  &__title {
    margin: 0;
    font-size: calc(34px * var(--portal-font-scale));
    font-weight: 700;
    line-height: 1.25;
  }

  &__subtitle {
    margin: 0;
    max-width: 720px;
    font-size: calc(15px * var(--portal-font-scale));
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.78);
    white-space: pre-wrap;
  }
}

@container portal-viewport (max-width: 640px) {
  .pb-page-hero {
    padding: calc(32px * var(--portal-spacing-scale)) 0;

    &__title {
      font-size: calc(24px * var(--portal-font-scale));
    }
  }
}
</style>
