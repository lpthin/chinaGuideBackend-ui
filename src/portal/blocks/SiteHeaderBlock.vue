<template>
  <header class="pb-header" :class="{ 'pb-header--scrolled': scrolled }">
    <div class="pb-container pb-header__bar">
      <router-link to="/" class="pb-header__brand">
        <img v-if="logo" :src="logo" :alt="siteName || '站点标志'" />
        <span v-if="siteName">{{ siteName }}</span>
      </router-link>

      <nav class="pb-header__nav">
        <router-link
          v-for="item in navItems"
          :key="item.url + item.title"
          :to="item.url"
          class="pb-header__link"
          :class="{ 'pb-header__link--active': isActive(item.url) }"
        >
          {{ item.title }}
        </router-link>
      </nav>

      <a-button class="pb-header__toggle" type="text" @click="mobileOpen = !mobileOpen">
        <component :is="MenuOutlined" />
      </a-button>
    </div>

    <div v-if="mobileOpen" class="pb-header__mobile">
      <router-link
        v-for="item in navItems"
        :key="'m' + item.url + item.title"
        :to="item.url"
        class="pb-header__mobile-link"
        @click="mobileOpen = false"
      >
        {{ item.title }}
      </router-link>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { MenuOutlined } from '@ant-design/icons-vue'
import type { BlockContext } from './types'
import { text } from './types'

/**
 * 页头：站点名/标志可由区块槽位覆盖，导航只有一份——来自后端 portal_page（PortalContentService.nav），
 * 前端不再自带六条硬编码链接，这正是旧模板「导航与页面脱节」的根因。
 * 这里也不放「联系我们」按钮：它会和导航里的同名项重复，而且路由写死在数据驱动的区块里。
 */
const props = defineProps<BlockContext>()

const route = useRoute()
const mobileOpen = ref(false)
const scrolled = ref(false)

const siteName = computed(() => text(props.blockProps, 'siteName') || props.shell?.company?.name || props.shell?.siteName || '')
const logo = computed(() => text(props.blockProps, 'logoUrl') || props.shell?.company?.logo || '')
const navItems = computed(() => (props.shell?.nav ?? []).filter(item => item.title && item.url))

function isActive(url: string) {
  return route.path === url
}

function onScroll() {
  scrolled.value = window.scrollY > 24
}

window.addEventListener('scroll', onScroll, { passive: true })
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<style scoped lang="less">
.pb-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--portal-color-border);

  &__bar {
    display: flex;
    align-items: center;
    gap: 20px;
    height: 68px;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: calc(19px * var(--portal-font-scale));
    font-weight: 700;
    color: var(--portal-color-text);
    text-decoration: none;

    img {
      height: 32px;
      width: auto;
    }
  }

  &__nav {
    margin-left: auto;
    display: flex;
    gap: 32px;
  }

  &__link {
    color: #475569;
    font-size: calc(15px * var(--portal-font-scale));
    text-decoration: none;
    position: relative;

    &:hover,
    &--active {
      color: var(--portal-color-primary);
    }

    &::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 0;
      width: 0;
      height: 2px;
      background: var(--portal-color-primary);
      transition: width 0.25s ease;
    }

    &:hover::after,
    &--active::after {
      width: 100%;
    }
  }

  &__toggle {
    display: none;
  }

  &__mobile {
    display: none;
    padding: 8px 0 16px;
    border-top: 1px solid var(--portal-color-border);
  }

  &__mobile-link {
    display: block;
    padding: 12px 0;
    color: #475569;
    text-decoration: none;
  }
}

@media (max-width: 900px) {
  .pb-header {
    &__nav {
      display: none;
    }

    &__toggle {
      display: inline-flex;
      margin-left: auto;
    }

    &__mobile {
      display: block;
    }
  }
}
</style>
