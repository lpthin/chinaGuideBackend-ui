<template>
  <footer class="pb-footer">
    <div class="pb-container">
      <nav v-if="links.length" class="pb-footer__links">
        <PortalBlockLink v-for="(link, index) in links" :key="index" :url="link.url">{{ link.title }}</PortalBlockLink>
      </nav>
      <div v-if="contactLine.length" class="pb-footer__contact">
        <a v-if="company?.phone" :href="'tel:' + company.phone">{{ company.phone }}</a>
        <a v-if="company?.email" :href="'mailto:' + company.email">{{ company.email }}</a>
        <span v-if="company?.address">{{ company.address }}</span>
      </div>
      <p v-if="copyright" class="pb-footer__copy">{{ copyright }}</p>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { field, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/**
 * 页脚。
 *
 * 链接优先用区块绑定的 footerLinks，没绑定就退回站点导航（同一个 portal_page 真相源）；
 * 版权行只在后台真填了才显示，不用 © 2024 之类的写死年份。
 */
const props = defineProps<BlockContext>()

const company = computed(() => props.shell?.company ?? null)
const copyright = computed(() => text(props.blockProps, 'copyright') || company.value?.copyright || '')

const links = computed(() => {
  const bound = list(props.blockProps, 'links')
    .map(item => ({ title: field(item, 'title', 'name'), url: field(item, 'url', 'link') }))
    .filter(link => link.title && link.url)
  if (bound.length) {
    return bound
  }
  return (props.shell?.nav ?? []).map(item => ({ title: item.title, url: item.url }))
})

const contactLine = computed(() => {
  const value = company.value
  return [value?.phone, value?.email, value?.address].filter(Boolean)
})
</script>

<style scoped lang="less">
.pb-footer {
  padding: calc(40px * var(--portal-spacing-scale)) 0;
  background: #1f2937;
  color: #9ca3af;
  font-size: calc(13px * var(--portal-font-scale));

  &__links {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin-bottom: 18px;

    a {
      color: #cbd5e1;
      text-decoration: none;

      &:hover {
        color: #fff;
      }
    }
  }

  &__contact {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    margin-bottom: 18px;

    a {
      color: #cbd5e1;
      text-decoration: none;
    }
  }

  &__copy {
    margin: 0;
  }
}
</style>
