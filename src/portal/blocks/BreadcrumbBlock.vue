<template>
  <nav v-if="crumbs.length" class="pb-breadcrumb" aria-label="面包屑">
    <div class="pb-container">
      <ol class="pb-breadcrumb__list">
        <li v-for="(crumb, index) in crumbs" :key="index" class="pb-breadcrumb__item">
          <PortalBlockLink
            v-if="index < crumbs.length - 1"
            :url="field(crumb, 'url')"
            class="pb-breadcrumb__link"
          >{{ titleOf(crumb) }}</PortalBlockLink>
          <span v-else class="pb-breadcrumb__current" aria-current="page">{{ titleOf(crumb) }}</span>
          <span v-if="index < crumbs.length - 1" class="pb-breadcrumb__sep" aria-hidden="true">&rsaquo;</span>
        </li>
      </ol>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext, Item } from './types'
import { field, list } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/**
 * 面包屑（Spec-E #100 第 2 类缺口，第二家模板站 10 页里 10 页都有）。
 *
 * 这一块的组件里没有任何找父级的逻辑，这是重点而不是偷懒：可见的这条路径与首包 JSON-LD 里那条
 * BreadcrumbList 必须是同一条，而那条算法在后端只有一份（BreadcrumbTrail）。前端只要按
 * location.pathname 猜一次「这一页挂在哪儿」，两处就各说一套，而分叉只有拿真机去比对爬虫读到的
 * 那一份时才看得出来。
 *
 * 所以取数只有一个合法来源：items 绑 breadcrumbs（列表槽本来就只接受绑定）。
 * 后端算不出父级时给的是空数组，这里就整块不出 —— 今天的导航是扁平的一份页面清单，
 * 第三级在这套系统里没有出处，猜一条出来就是造假。
 */
const props = defineProps<BlockContext>()

const crumbs = computed<Item[]>(() => list(props.blockProps, 'items').filter(item => titleOf(item)))

function titleOf(crumb: Item | undefined): string {
  return field(crumb, 'title', 'name')
}
</script>

<style scoped lang="less">
.pb-breadcrumb {
  padding: calc(14px * var(--portal-spacing-scale)) 0 0;

  &__list {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__link {
    color: var(--portal-color-muted);
    text-decoration: none;

    &:hover {
      color: var(--portal-color-primary);
    }
  }

  &__current {
    color: var(--portal-color-text);
  }

  &__sep {
    color: var(--portal-color-border);
  }
}
</style>
