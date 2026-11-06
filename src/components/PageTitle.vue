<script setup lang="ts">
/**
 * 页标题：文字只取路由 `meta.title` 那一份（Spec-M UIB-3）。
 *
 * <p>左侧菜单、侧边面包屑和页面大标题读的都是同一条字符串，所以「菜单写着 A、点进去页面写着 B」
 * 这一类缺陷在结构上就不可能发生——建站那一组实测过一次（菜单「参考站摄取」，页面却没有标题，
 * 抽屉里另有一句「参考站拆解」）。页面自己再抄一遍菜单名，就是下一次改菜单名时漏改的那一处。</p>
 *
 * <p>路由没配 `meta.title` 时整块不渲：宁可少一行标题，也不摆一个编出来的名字。</p>
 *
 * <p>`description` 与 `#extra` 是给原来用 `a-page-header` 摆屏名的那 10 屏留的位置：副标题和右侧按钮照摆，
 * 只有标题那一行字换成菜单名那一份。</p>
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{ description?: string }>()

const route = useRoute()
const title = computed(() => {
  const raw = route.meta.title
  return typeof raw === 'string' ? raw : ''
})
</script>

<template>
  <div v-if="title || props.description || $slots.default || $slots.extra" class="page-title">
    <div class="page-title__head">
      <div class="page-title__names">
        <h3 v-if="title" class="page-title__text">{{ title }}</h3>
        <p v-if="props.description" class="page-title__desc">{{ props.description }}</p>
      </div>
      <div v-if="$slots.extra" class="page-title__extra">
        <slot name="extra" />
      </div>
    </div>
    <slot />
  </div>
</template>

<style scoped lang="less">
.page-title {
  margin-bottom: 16px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  &__names {
    min-width: 0;
  }

  &__extra {
    flex: none;
  }

  &__text {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    /* Spec-Q P0：原来是 #111827（偏蓝的近黑）。这一支被 82 个页面共用，
       而「站点内容」那 12 页正文各自抄的是 #1a1a1a ⇒ 同一个产品两支近黑。
       换成令牌是往多数那一支靠，肉眼差不到，但从此只有一个出处。 */
    color: var(--admin-text-primary);
  }

  &__desc {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--admin-text-secondary);
  }
}
</style>
