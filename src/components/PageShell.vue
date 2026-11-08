<script setup lang="ts">
/**
 * 页面骨架唯一出处（Spec-F §9.2-4 / Spec-UI-1 §3.4）：标题 / 副标题 / 右上操作区 / 内容 / 底部。
 *
 * 留白归外壳：`.workspace-area` 给一次 32px（Spec-UI-1 §3.3），所以这里不再自己加 padding——
 * 否则「外壳 32 + 本组件 24」又是一层叠一层，和改造前 32/36/56 三档的老毛病一样。
 *
 * 标题缺省读 `route.meta.title`，与 PageTitle 同一规则：页头文字只有一个出处，
 * 页面不必再把 meta 里的字抄一遍。显式传 `title` 的页仍然优先用传入值（存量 3 页不动）。
 */
import { computed, getCurrentInstance } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{ title?: string; subtitle?: string }>()
defineSlots<{
  actions?: () => unknown
  default?: () => unknown
  footer?: () => unknown
}>()

/** 单元测试里 mount 不带 router，这里必须先确认 router 存在，否则 useRoute() 会在 setup 阶段炸掉 */
const instance = getCurrentInstance()
const route = instance?.appContext.config.globalProperties.$router ? useRoute() : null

const resolvedTitle = computed(() => {
  if (props.title) return props.title
  const metaTitle = route?.meta?.title
  return typeof metaTitle === 'string' ? metaTitle : ''
})
</script>

<template>
  <div class="admin-page">
    <div class="admin-page__head">
      <div class="admin-page__heading">
        <h2 v-if="resolvedTitle" class="admin-page__title">{{ resolvedTitle }}</h2>
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
  /* 留白归外壳（.workspace-area），这里只负责页头与块间距 */
  padding: 0;

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
