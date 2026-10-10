<script setup lang="ts">
/**
 * 页标题：文字只取路由 `meta.title` 那一份（Spec-M UIB-3）。
 *
 * <p>左侧菜单、侧边面包屑和页面大标题读的都是同一条字符串，所以「菜单写着 A、点进去页面写着 B」
 * 这一类缺陷在结构上就不可能发生——建站那一组实测过一次（菜单「参考站摄取」，页面却没有标题，
 * 抽屉里另有一句「参考站拆解」）。页面自己再抄一遍菜单名，就是下一次改菜单名时漏改的那一处。</p>
 *
 * <p>路由没配 `meta.title` 时整块不渲：宁可少一行标题，也不摆一个编出来的名字。</p>
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => {
  const raw = route.meta.title
  return typeof raw === 'string' ? raw : ''
})
</script>

<template>
  <div v-if="title || $slots.default" class="page-title">
    <h3 v-if="title" class="page-title__text">{{ title }}</h3>
    <slot />
  </div>
</template>

<style scoped lang="less">
.page-title {
  margin-bottom: 16px;

  &__text {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }
}
</style>
