<template>
  <div v-if="hasContent" class="pb-utility">
    <div class="pb-container pb-utility__inner">
      <p v-if="note" class="pb-utility__text">{{ note }}</p>
      <ul v-if="links.length" class="pb-utility__links">
        <li v-for="(item, index) in links" :key="index">
          <PortalBlockLink :url="field(item, 'url')" class="pb-utility__link">{{ field(item, 'title') }}</PortalBlockLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { field, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/**
 * 页眉辅助条：主导航上面那一条窄行（Spec-E #100 第 1 类缺口，第二家模板站 11 页里 11 页都有）。
 *
 * 模板里那一排写的是「语言 / 登录 / 搜索 / 关注」，我们一件都没有：门户免鉴权、没有访客账号、
 * 没有站内搜索，社交栏是 P-4 判过不要的。所以这一块只有两个槽，而且都拿得到真数据——
 * 一句辅助说明（电话那类要求绑 contactInfo.*，schema 里写着）和一排站内链接
 * （绑 footerLinks，不在版式里另抄一份地址）。
 *
 * 链接集那一格的槽名由后端定死叫 items：造页时的兜底绑法写的就是 items 这一格，
 * 这里改读别的名字，AI 生成的页上这一排就会永远取到空。
 *
 * 两格都空时整块不渲染，而不是留一条只有底色的空带：那一行在页首，空着比假着更容易被发现。
 */
const props = defineProps<BlockContext>()

const note = computed(() => text(props.blockProps, 'text'))
const links = computed(() => list(props.blockProps, 'items').filter(item => field(item, 'title')))

const hasContent = computed(() => Boolean(note.value) || links.value.length > 0)
</script>

<style scoped lang="less">
.pb-utility {
  padding: calc(8px * var(--portal-spacing-scale)) 0;
  background: color-mix(in srgb, var(--portal-color-text) 4%, transparent);
  border-bottom: 1px solid var(--portal-color-border);
  font-size: calc(13px * var(--portal-font-scale));
  color: var(--portal-color-muted);

  &__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  &__text {
    margin: 0;
    line-height: 1.6;
  }

  &__links {
    display: flex;
    align-items: center;
    gap: calc(18px * var(--portal-spacing-scale));
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__link {
    color: var(--portal-color-muted);
    text-decoration: none;

    &:hover {
      color: var(--portal-color-primary);
    }
  }
}

@container portal-viewport (max-width: 640px) {
  .pb-utility__inner {
    justify-content: flex-start;
    gap: 10px;
  }
}
</style>
