<script setup lang="ts">
/**
 * 列表页筛选栏（Spec-F §9.2-4）：字段靠左、按钮组靠右。
 * 沿用 styles/global.less:39-52 已定稿的 .toolbar-actions / .toolbar-fill 命名与语义，不新造一套。
 */
defineSlots<{
  default?: () => unknown
  actions?: () => unknown
}>()
</script>

<template>
  <div class="admin-filter-bar toolbar-fill">
    <div class="admin-filter-bar__fields">
      <slot />
    </div>
    <div class="admin-filter-bar__actions toolbar-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped lang="less">
.admin-filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;

  &__fields {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* 动作组贴右：与 global.less 里 toolbar-actions 的 margin-left:auto 同一语义 */
  &__actions {
    margin-left: auto;
  }
}
</style>
