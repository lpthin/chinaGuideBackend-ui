<template>
  <section v-if="hasContent" class="pb-hero">
    <div class="pb-hero__bg" aria-hidden="true">
      <div v-if="photoStyle" class="pb-hero__photo" :style="photoStyle"></div>
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

/**
 * 主视觉：槽位全空就整块不渲染，不留一块只有渐变的空白高度。
 *
 * <p>{@code imageUrl} 这一格是 Spec-C §6.5-5 要的那张主视觉图：以前除了页头 logo，全站没有第二个
 * 能填图的槽，"给 hero 配一张图"这句话在渲染层无处落笔。它按**底图**处理——铺在渐变之上、文字之下，
 * 所以 {@code hasContent} 刻意不看它：一张图配零文案不是一个可用的主视觉，让这种组合渲染出来，
 * 页首就只剩一张孤图，而缺文案这件事本该由"这一块没出来"暴露出去。</p>
 */
const props = defineProps<BlockContext>()

const eyebrow = computed(() => text(props.blockProps, 'eyebrow'))
const title = computed(() => text(props.blockProps, 'title'))
const subtitle = computed(() => text(props.blockProps, 'subtitle'))
const description = computed(() => text(props.blockProps, 'description'))
const primaryText = computed(() => text(props.blockProps, 'primaryText'))
const primaryLink = computed(() => text(props.blockProps, 'primaryLink'))
const secondaryText = computed(() => text(props.blockProps, 'secondaryText'))
const secondaryLink = computed(() => text(props.blockProps, 'secondaryLink'))

/**
 * 只认「站内相对路径」或 https 绝对地址，且不含引号/括号/空白/反斜杠。
 *
 * <p>值来自素材库或 AI 输出，最后要拼进 CSS 的 {@code url("...")}。放行一个带引号或括号的字符串，
 * 等于允许写图的人往这一格的样式里追加任意声明；认不下就当没有这张图，宁地图位空着。</p>
 */
const photoUrl = computed(() => {
  const value = text(props.blockProps, 'imageUrl')
  if (!value) {
    return ''
  }
  const absolute = /^https:\/\/[^\s"'()\\]+$/i
  const relative = /^\/[^\s"'()\\]*$/
  return absolute.test(value) || relative.test(value) ? value : ''
})

const photoStyle = computed(() => (photoUrl.value ? { backgroundImage: `url("${photoUrl.value}")` } : null))

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

  /* 主视觉底图：压在渐变之上、文字之下，靠透明度让位给白色标题——
     这里不做"图够暗就提亮"的判断，那需要知道图片内容，而区块层拿不到。 */
  &__photo {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0.34;
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
