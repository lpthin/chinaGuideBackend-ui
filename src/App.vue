<script setup lang="ts">
/**
 * 根组件（SPEC-UI-9 H1）。
 *
 * 除了 `<router-view />` 之外只挂三样全局兜底：
 * - 断网横幅：只念「网络」这一件事，哪一页/哪个操作仍由页面错误块说；
 * - 路由级渲染兜底：白屏的第一个出口；
 * - 分包加载失败的全屏提示：发版后老标签页唯一的自救动作是刷新。
 */
import { onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import RouteErrorBoundary from './components/RouteErrorBoundary.vue'
import { isOnline, networkRecovered, setupConnectivity } from './utils/connectivity'
import { chunkLoadNoticeVisible, reloadPageForChunkFailure } from './utils/chunkLoad'

const route = useRoute()
const stopConnectivity = setupConnectivity()
onUnmounted(stopConnectivity)
</script>

<template>
  <div class="app-root">
    <!-- 断网 / 恢复：全局只有这一条，页面错误块继续说「哪一页、哪个操作」 -->
    <div
      v-if="!isOnline"
      class="app-network-banner app-network-banner--offline"
      role="status"
      aria-live="polite"
    >
      网络已断开，操作会失败；恢复后请重试
    </div>
    <div
      v-else-if="networkRecovered"
      class="app-network-banner app-network-banner--online"
      role="status"
      aria-live="polite"
    >
      网络已恢复
    </div>

    <RouteErrorBoundary :reset-key="route.fullPath">
      <router-view />
    </RouteErrorBoundary>

    <!-- 分包加载失败（发版后老标签页）：只提示一次，动作只有刷新 -->
    <div
      v-if="chunkLoadNoticeVisible"
      class="app-chunk-notice"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-chunk-notice-title"
    >
      <div class="app-chunk-notice__panel">
        <div id="app-chunk-notice-title" class="app-chunk-notice__title">页面版本已更新，刷新后继续</div>
        <p class="app-chunk-notice__body">
          这一页是在旧版本上打开的，刷新一次就能拿到最新内容。刷新不会丢已经提交的数据。
        </p>
        <a-button type="primary" @click="reloadPageForChunkFailure">刷新页面</a-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.app-root {
  min-height: 100%;
}

.app-network-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1050;
  padding: 6px 16px;
  font-size: 13px;
  text-align: center;

  &--offline {
    color: #fff;
    background: var(--admin-error, #ff4d4f);
  }

  &--online {
    color: #fff;
    background: var(--admin-success, #52c41a);
  }
}

.app-chunk-notice {
  position: fixed;
  inset: 0;
  z-index: 1060;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);

  &__panel {
    width: min(420px, calc(100vw - 32px));
    padding: var(--admin-space-4, 32px);
    border-radius: var(--admin-radius-lg, 8px);
    background: var(--admin-bg-container, #fff);
    text-align: center;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--admin-text-primary, rgba(0, 0, 0, 0.88));
  }

  &__body {
    margin: var(--admin-space-2, 16px) 0 var(--admin-space-3, 24px);
    font-size: 13px;
    color: var(--admin-text-secondary, rgba(0, 0, 0, 0.65));
  }
}
</style>
