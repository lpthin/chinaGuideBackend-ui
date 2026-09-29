<script setup lang="ts">
/**
 * 页面骨架唯一出处（Spec-F §9.2-4）：标题 / 副标题 / 右上操作区 / 内容 / 底部。
 * padding 归本组件：页面里再写自己的 padding 就是违规（消灭 GeoSeoDashboardView 式手抄）。
 */
defineProps<{ title?: string; subtitle?: string }>()
defineSlots<{
  actions?: () => unknown
  default?: () => unknown
  footer?: () => unknown
}>()
</script>

<template>
  <div class="admin-page">
    <div class="admin-page__head">
      <div class="admin-page__heading">
        <h2 class="admin-page__title">{{ title }}</h2>
        <div v-if="subtitle" class="admin-page__subtitle">{{ subtitle }}</div>
      </div>
      <div class="admin-page__actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="admin-page__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="admin-page__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped lang="less">
.admin-page {
  padding: var(--admin-space-3, 24px);

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  &__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  &__subtitle {
    margin-top: 8px;
    color: #8c8c8c;
    font-size: 13px;
  }

  &__actions {
    flex-shrink: 0;
  }

  &__footer {
    margin-top: 24px;
  }
}
</style>
