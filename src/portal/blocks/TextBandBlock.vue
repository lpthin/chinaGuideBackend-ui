<template>
  <section v-if="heading || body || items.length" class="pb-section pb-section--muted">
    <div class="pb-container pb-band">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <p v-if="body" class="pb-band__text">{{ body }}</p>
      <ul v-if="items.length" class="pb-band__list">
        <li v-for="(item, index) in items" :key="index">
          <strong v-if="field(item, 'title', 'name')">{{ field(item, 'title', 'name') }}</strong>
          <span>{{ field(item, 'summary', 'description') }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { field, list, text } from './types'

/** 通用文字段落：文字来自 layout_json 的字面值，条目来自数据绑定，两者都不许塞 HTML */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const body = computed(() => text(props.blockProps, 'text'))
const items = computed(() => list(props.blockProps, 'items'))
</script>

<style scoped lang="less">
.pb-band {
  max-width: 860px;

  &__text {
    margin: 0 0 20px;
    font-size: calc(16px * var(--portal-font-scale));
    line-height: 1.9;
    color: var(--portal-color-muted);
    white-space: pre-wrap;
  }

  &__list {
    margin: 0;
    padding-left: 20px;
    color: var(--portal-color-text);
    font-size: calc(15px * var(--portal-font-scale));
    line-height: 2;

    span {
      margin-left: 8px;
      color: var(--portal-color-muted);
    }
  }
}
</style>
