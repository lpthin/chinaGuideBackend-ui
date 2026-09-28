<template>
  <section v-if="rows.length" class="pb-section pb-section--tight">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <ul class="pb-related">
        <li v-for="(item, index) in rows" :key="index">
          <PortalBlockLink :url="field(item, 'link', 'url')" class="pb-related__row">
            <span class="pb-related__title">{{ field(item, 'title', 'name') }}</span>
            <span v-if="meta(item)" class="pb-related__meta">{{ meta(item) }}</span>
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

/**
 * 相关推荐（Spec-E #100 第 3 类缺口：模板站页尾那一排「相关阅读」）。
 *
 * 与 news-list 的分工是这块存在的唯一理由：那一块回答「这一栏有什么」——按时序陈列、带日期与摘要；
 * 这一块回答「读完了还能读什么」——只要一行行标题，来源还常常是服务或案例。
 * 把两者合成一块的代价是 news-list 长出「显示日期/显示摘要/换来源」三组旋钮，
 * 而每一组都要有人在取数层兑现，兑现不了的就是假通。
 *
 * 来源不固定，所以只有 items 一个数据槽（列表槽只接受 $data 绑定），
 * 条目字段按 link/url、title/name 两组顺序取，服务端解析不出来的就没有这一行。
 * 一行都没取到就整块不渲染：页尾一段只有标题没有内容的空盒子，比没有这一段更可疑。
 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const rows = computed<Item[]>(() => list(props.blockProps, 'items').filter(item => field(item, 'title', 'name')))

function meta(item: Item) {
  return [field(item, 'category'), field(item, 'summary')].filter(Boolean).join(' · ')
}
</script>

<style scoped lang="less">
.pb-related {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: calc(10px * var(--portal-spacing-scale)) calc(28px * var(--portal-spacing-scale));
  margin: 0;
  padding: 0;
  list-style: none;

  &__row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: calc(12px * var(--portal-spacing-scale)) 0;
    border-bottom: 1px solid var(--portal-color-border);
    text-decoration: none;
  }

  &__title {
    font-size: calc(15px * var(--portal-font-scale));
    font-weight: 600;
    color: var(--portal-color-text);
  }

  &__meta {
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }
}

@container portal-viewport (max-width: 760px) {
  .pb-related {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
