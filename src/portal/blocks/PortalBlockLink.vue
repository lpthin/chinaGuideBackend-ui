<template>
  <router-link v-if="link.kind === 'route'" :to="routeTarget" v-bind="$attrs">
    <slot />
  </router-link>
  <a v-else-if="link.kind === 'external'" :href="externalHref" target="_blank" rel="noopener" v-bind="$attrs">
    <slot />
  </a>
  <div v-else v-bind="$attrs">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { resolveLink } from './linkPolicy'

/**
 * 区块里所有可点元素的统一出口：站内走 router-link、站外走带 noopener 的 a、
 * 没有合法链接时退化成 div（卡片仍然可读，只是不可点），避免出现 href="#" 这种假链接。
 */
defineOptions({ inheritAttrs: false })

const props = defineProps<{ url?: string | null }>()

const link = computed(() => resolveLink(props.url))
const routeTarget = computed<RouteLocationRaw>(() => (link.value.target as RouteLocationRaw) ?? { path: '/' })
const externalHref = computed(() => (typeof link.value.target === 'string' ? link.value.target : ''))
</script>
