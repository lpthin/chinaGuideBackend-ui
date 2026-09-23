<template>
  <section v-if="entries.length" class="pb-stats">
    <div class="pb-container">
      <h2 v-if="heading" class="pb-section-title pb-stats__heading">{{ heading }}</h2>
      <div class="pb-stats__row">
        <div v-for="(entry, index) in entries" :key="index" class="pb-stats__item">
          <strong class="pb-stats__value">{{ entry.value }}</strong>
          <span v-if="entry.label" class="pb-stats__label">{{ entry.label }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { field, list, text } from './types'

/**
 * 数字条。
 *
 * 大字号取 value/number/count，没有数值时退回条目名——绝不用 Math.random 或硬编码「10+ 年经验」凑数，
 * 那正是本次要消灭的假数据形态。
 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))

const entries = computed(() => list(props.blockProps, 'items')
  .map(item => ({
    value: field(item, 'value', 'number', 'count', 'title', 'name'),
    label: field(item, 'label', 'summary', 'description')
  }))
  .filter(entry => entry.value))
</script>

<style scoped lang="less">
.pb-stats {
  padding: calc(64px * var(--portal-spacing-scale)) 0;
  background: color-mix(in srgb, var(--portal-color-primary) 8%, var(--portal-color-bg));

  &__heading {
    text-align: center;
    margin-bottom: 28px;
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: calc(32px * var(--portal-spacing-scale));
    justify-content: center;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 140px;
    text-align: center;
  }

  &__value {
    font-size: calc(34px * var(--portal-font-scale));
    font-weight: 700;
    color: var(--portal-color-primary);
  }

  &__label {
    font-size: calc(14px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }
}
</style>
