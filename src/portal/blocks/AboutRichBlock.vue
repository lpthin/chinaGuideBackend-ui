<template>
  <section v-if="heading || body" class="pb-section">
    <div class="pb-container pb-about">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <!-- 后端已把文本槽里的 HTML 判非法（about-rich 没有 richText 槽），这里只渲染纯文本，不用 v-html；
           换行靠 white-space: pre-wrap 保留，不再造一个段落拆分器 -->
      <p v-if="body" class="pb-about__p">{{ body }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { text } from './types'

const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const body = computed(() => text(props.blockProps, 'text'))
</script>

<style scoped lang="less">
.pb-about {
  max-width: 820px;

  &__p {
    margin: 0 0 18px;
    font-size: calc(16px * var(--portal-font-scale));
    line-height: 1.9;
    color: var(--portal-color-muted);
    white-space: pre-wrap;
  }
}
</style>
