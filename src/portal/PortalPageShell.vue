<template>
  <div class="portal-shell">
    <header class="portal-shell__header">
      <div class="portal-shell__bar">
        <router-link to="/" class="portal-shell__brand">
          <img v-if="shell?.company?.logo" :src="shell.company.logo" :alt="shell.company.name || '站点标志'" />
          <span>{{ shell?.company?.name || shell?.siteName || '门户' }}</span>
        </router-link>
        <nav class="portal-shell__nav">
          <router-link v-for="item in navItems" :key="item.url" :to="item.url">{{ item.title }}</router-link>
        </nav>
      </div>
    </header>

    <main class="portal-shell__main">
      <slot :shell="shell" />
    </main>

    <footer class="portal-shell__footer">
      <div class="portal-shell__bar">
        <p v-if="shell?.company?.copyright">{{ shell.company.copyright }}</p>
        <!-- 联系方式只渲染后端真的填过的项，没填就不显示，也不用模板里的占位号码 -->
        <p v-if="hasContact" class="portal-shell__contact">
          <a v-if="shell?.company?.phone" :href="'tel:' + shell.company.phone">{{ shell.company.phone }}</a>
          <a v-if="shell?.company?.email" :href="'mailto:' + shell.company.email">{{ shell.company.email }}</a>
          <span v-if="shell?.company?.address">{{ shell.company.address }}</span>
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchSiteShell, type PortalNavItem, type PortalSiteShell } from './api/portalPublic'

/**
 * 详情页共用的门户壳：页头页脚只放后端真的有的信息。
 * 首页三套模板各自带完整页头页脚，这里不复用它们，是为了让详情页能独立存在
 * （访客从搜索结果直链进来，不经过首页）。
 */
const shell = ref<PortalSiteShell | null>(null)
const navItems = ref<PortalNavItem[]>([])
const hasContact = computed(() => {
  const company = shell.value?.company
  return Boolean(company && (company.phone || company.email || company.address))
})

onMounted(async () => {
  try {
    const data = await fetchSiteShell()
    shell.value = data
    navItems.value = (data.nav || []).slice(0, 6)
  } catch {
    // 壳数据取不到不影响正文渲染，页头留站点名为空即可，不弹假提示
  }
})
</script>

<style scoped lang="less">
.portal-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;

  &__bar {
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
  }

  &__header {
    background: #fff;
    border-bottom: 1px solid #eef0f3;
    padding: 16px 0;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
    text-decoration: none;

    img {
      height: 32px;
      width: auto;
    }
  }

  &__nav {
    margin-left: auto;
    display: flex;
    gap: 18px;
    flex-wrap: wrap;

    a {
      color: #4b5563;
      font-size: 14px;
      text-decoration: none;

      &:hover {
        color: #2563eb;
      }
    }
  }

  &__main {
    flex: 1;
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
    padding: 32px 24px 56px;
  }

  &__footer {
    background: #1f2937;
    color: #9ca3af;
    padding: 24px 0;
    font-size: 13px;
  }

  &__contact {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;

    a {
      color: #cbd5e1;
      text-decoration: none;

      &:hover {
        color: #fff;
      }
    }
  }
}
</style>
