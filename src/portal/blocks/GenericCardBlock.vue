<template>
  <section v-if="heading || body || entries.length" class="pb-section">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <p v-if="body" class="pb-generic__body">{{ body }}</p>
      <div v-if="entries.length" class="pb-grid" :class="gridClass">
        <PortalBlockLink v-for="(entry, index) in entries" :key="index" :url="entry.link" class="pb-card pb-generic">
          <img v-if="entry.image" :src="entry.image" :alt="entry.title" class="pb-generic__image" />
          <h3 v-if="entry.title" class="pb-card-title pb-generic__title">{{ entry.title }}</h3>
          <p v-if="entry.summary" class="pb-card-text pb-generic__summary">{{ entry.summary }}</p>
        </PortalBlockLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { columnsClassOf, field, image, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/**
 * 通用卡片（rendererKey=genericCard）：界面手工新增那一族唯一可用的渲染器。
 *
 * 它不绑定任何栏目，也不认得「合作伙伴墙」和「客户案例」的区别，只按区块自带的 props schema
 * 摆这一套槽位：heading 标题、text 正文、items 卡片（title|name / summary|description|text /
 * image / link|url）、columns 列数。所以它的天花板是「排版正确、内容如实」，不是「设计到位」——
 * 界面对新组件要念的是「通用样式，专属设计待补」，不许念成「组件已就绪」。
 *
 * 全部是文本插值：数据里出现 HTML 也只会当作字面量打出来。这一族的 props 由人在界面定 schema、
 * 由 AI 或租户往里填，门户又是免鉴权公开页，任何 v-html 都等于把渲染权交给数据。
 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const body = computed(() => text(props.blockProps, 'text'))
const gridClass = computed(() => columnsClassOf(props.blockProps))

const entries = computed(() => list(props.blockProps, 'items')
  .map(item => ({
    title: field(item, 'title', 'name'),
    summary: field(item, 'summary', 'description', 'text'),
    image: image(item, 'image', 'imageUrl', 'cover', 'mediaUrl'),
    link: field(item, 'link', 'url')
  }))
  // 标题、说明、图一个都没有的条目丢掉：摆一张空卡比少一张卡更像坏了
  .filter(entry => entry.title || entry.summary || entry.image))
</script>

<style scoped lang="less">
.pb-generic {
  display: flex;
  flex-direction: column;
  gap: calc(10px * var(--portal-spacing-scale));

  &__body {
    max-width: 860px;
    margin: 0 0 20px;
    font-size: calc(16px * var(--portal-font-scale));
    line-height: 1.9;
    color: var(--portal-color-muted);
    white-space: pre-wrap;
  }

  &__image {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 8px;
  }

  &__title {
    margin: 0;
  }

  &__summary {
    margin: 0;
  }
}
</style>
