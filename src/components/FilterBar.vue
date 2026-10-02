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
  /* 让本条自己成为查询容器：侧栏卡片里可用宽度只有 ~260px，跟视口宽度无关，
     只能用容器宽度判断「这一条放不下」，媒体查询在这里是瞎的。 */
  container-type: inline-size;

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

/* 窄容器（分类树这类侧栏卡片）里，搜索框 + 两三个按钮挤不进一行，会随机折成
   两三行、按钮还挂到卡片右边缘外面。这里改成有意排版：搜索框占满第一行，
   按钮组整行等宽排在第二行，长度靠 flex 收缩而不是折行。 */
@container (max-width: 380px) {
  .admin-filter-bar__fields {
    flex: 1 1 100%;
    min-width: 0;

    > * {
      flex: 1 1 100%;
      min-width: 0;
    }
  }

  .admin-filter-bar__actions {
    margin-left: 0;
    width: 100%;
    display: flex;
    gap: 8px;

    > * {
      flex: 1 1 0;
      min-width: 0;
    }

    /* 动作组一般再包一层 a-space，等宽要穿过它才落到每个按钮上 */
    :deep(.ant-space) {
      display: flex;
      flex: 1 1 0;
      width: 100%;
    }

    :deep(.ant-space-item) {
      flex: 1 1 0;
      min-width: 0;
    }

    :deep(.ant-btn) {
      width: 100%;
      padding-inline: 6px;
    }

    :deep(.ant-form-item) {
      margin-bottom: 0;
      width: 100%;
    }
  }
}
</style>
