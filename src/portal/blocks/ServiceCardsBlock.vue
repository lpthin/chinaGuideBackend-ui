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
