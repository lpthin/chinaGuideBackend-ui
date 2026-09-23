<template>
  <section v-if="heading || entries.length" class="pb-section">
    <div class="pb-container pb-contact">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <p v-if="description" class="pb-contact__desc">{{ description }}</p>
      <div v-if="entries.length" class="pb-contact__grid">
        <component :is="row.href ? 'a' : 'div'"
                   v-for="row in entries"
                   :key="row.label"
                   class="pb-contact__item"
                   :href="row.href || undefined">
          <span class="pb-contact__label">{{ row.label }}</span>
          <span class="pb-contact__value">{{ row.value }}</span>
        </component>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { text } from './types'

/**
 * 联系方式。
 *
 * 值只来自站点壳（portal_company_info），一项都没填就只显示标题；
 * 绝不写死 400-800-1234 / demo@example.com 这类占位号码——那是旧模板留给访客的假信息。
 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const description = computed(() => text(props.blockProps, 'description'))

const entries = computed(() => {
  const company = props.shell?.company
  return [
    { label: '电话', value: company?.phone ?? '', href: company?.phone ? `tel:${company.phone}` : '' },
    { label: '邮箱', value: company?.email ?? '', href: company?.email ? `mailto:${company.email}` : '' },
    { label: '地址', value: company?.address ?? '', href: '' }
  ].filter(row => row.value)
})
</script>

<style scoped lang="less">
.pb-contact {
  text-align: center;

  &__desc {
    margin: 0 auto 28px;
    max-width: 640px;
    font-size: calc(15px * var(--portal-font-scale));
    line-height: 1.8;
    color: var(--portal-color-muted);
    white-space: pre-wrap;
  }

  &__grid {
    display: flex;
    flex-wrap: wrap;
    gap: calc(24px * var(--portal-spacing-scale));
    justify-content: center;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 200px;
    padding: calc(22px * var(--portal-spacing-scale));
    border: 1px solid var(--portal-color-border);
    border-radius: var(--portal-radius);
    text-decoration: none;
  }

  &__label {
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }

  &__value {
    font-size: calc(16px * var(--portal-font-scale));
    font-weight: 600;
    color: var(--portal-color-text);
  }
}
</style>
