<template>
  <!--
    同一份 404 内容，两个出口：门户那一路把它摆进站点壳，管理侧维持今天这块裸卡片。

    为什么要分开：这个视图是 `/:pathMatch(.*)*` 兜底的，访客输错一个门户地址也会落到这里，
    而那里今天一个页头都没有——导航全丢，等于把来访的人送进一条死路（缺陷 #2）。
    挂上壳之后他看到的页头页脚与站内任何一页是同一份组件、同一条 shell.nav。

    管理侧（/workspace、/login、/admin、/brief/…）不挂：判据用的是 previewNavigation 里那条
    isPortalPath（与续预览令牌同一把尺），判否的一侧连 PortalPageShell 都不 mount，
    所以也不会多发一次 /site 请求——工作台看板上不该冒出访客页头，那是两个产品面。

    壳取不到时（站点没绑域名、接口失败）PortalPageShell 自己把 shell 留成 null：
    页头只剩站点名为空、导航一条都不渲，正文这块 404 照常摆出来，既不报错也不编假链接。
  -->
  <component :is="portalChrome ? PortalPageShell : 'div'">
    <div class="not-found-page" :class="{ 'not-found-page--framed': portalChrome }">
      <div class="not-found-container">
        <div class="error-code">404</div>
        <h1 class="error-title">页面未找到</h1>
        <p class="error-desc">抱歉，您访问的页面不存在或已被移除。</p>
        <div class="error-actions">
          <a-button type="primary" size="large" @click="goHome">
            <template #icon><HomeOutlined /></template>
            返回首页
          </a-button>
          <a-button size="large" @click="goBack">
            <template #icon><ArrowLeftOutlined /></template>
            返回上一页
          </a-button>
        </div>
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons-vue'
import PortalPageShell from '../portal/PortalPageShell.vue'
import { isPortalPath } from '../portal/previewNavigation'

const route = useRoute()
const router = useRouter()

/** 只有门户路径的 404 才配带站点壳：判据见上面那段，清单在 previewNavigation 里唯一一份 */
const portalChrome = computed(() => isPortalPath(route.path))

const goHome = () => {
  router.push('/')
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}
</script>

<style scoped lang="less">
.not-found-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%);
  padding: 20px;

  /**
   * 站进壳里的那一版只把 100vh 收掉：撑满视口是壳（.portal-shell）在做的事，
   * 卡片再占一个 100vh 就是「页头 + 一屏 + 页脚」，访客刚落地就得先滚一段没意义的高。
   * 渐变底与那块内容都不动——404 该说的还是同一句话，只是头上多了导航。
   */
  &--framed {
    min-height: 0;
    padding: 48px 20px;
  }
}

.not-found-container {
  text-align: center;
  max-width: 500px;
}

.error-code {
  font-size: 120px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #1890ff 0%, #722ed1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.error-title {
  font-size: 28px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 12px;
}

.error-desc {
  font-size: 16px;
  color: #595959;
  margin-bottom: 32px;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
