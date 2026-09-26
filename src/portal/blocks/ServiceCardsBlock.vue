<template>
  <section v-if="items.length" class="pb-section">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <div class="pb-grid" :class="gridClass">
        <PortalBlockLink v-for="(item, index) in items" :key="keyOf(item, index)" :url="field(item, 'link')" class="pb-card">
          <h3 class="pb-card-title">{{ field(item, 'title', 'name') }}</h3>
          <p v-if="field(item, 'summary', 'description')" class="pb-card-text">
            {{ field(item, 'summary', 'description') }}
          </p>
        </PortalBlockLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { columnsClassOf, field, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/** 服务卡片：items 只可能来自 {"$data":"services"}，没服务就整块不出现（旧模板同一条纪律） */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const items = computed(() => list(props.blockProps, 'items'))
const gridClass = computed(() => columnsClassOf(props.blockProps))

function keyOf(item: Record<string, unknown>, index: number) {
  return typeof item.id === 'number' ? item.id : `${index}`
}
</script>

<style scoped lang="less">
/* 卡片外壳（.pb-card 的底色/边框/悬停抬起）在 portal-blocks.less 里，是多类网格共用的，
   这里只补本区块的强调色落点：静止态一动不动，悬停时顶边出现一条辅助色——
   用 inset 投影而不是 border-top，是为了不改动盒子高度（真加 2px 边框会把整排卡片顶下去）。
   阴影其余部分照抄公共样式：本选择器更具体，会把公共那条覆盖掉。 */
.pb-card:hover {
  box-shadow:
    inset 0 3px 0 var(--portal-color-accent),
    0 14px 30px rgba(15, 12, 41, 0.08);
}
</style>
