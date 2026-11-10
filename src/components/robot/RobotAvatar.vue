<script setup lang="ts">
/**
 * 机器人的形象（SPEC-UI-11 §9）。
 *
 * 纯内联 SVG + 纯 CSS 呼吸动画：不引 GIF、不引第三方插画、不新增运行时依赖。
 * 系统开了「减少动效」时动画整体关掉（见 RobotHost 的媒体查询），这里只负责画。
 */
import { ROBOT_COPY } from '../../copy/robot'

defineProps<{
  /** 有话说但没说（被频率/忙碌挡住）时冒一个小角标 */
  badge?: boolean
  /** 正在说话：耳机灯换成实心，呼吸略快 */
  speaking?: boolean
}>()

defineEmits<{ (event: 'open'): void }>()
</script>

<template>
  <button
    type="button"
    class="robot-avatar"
    :class="{ 'robot-avatar--speaking': speaking }"
    :aria-label="ROBOT_COPY.avatarAria"
    data-testid="robot-avatar"
    @click="$emit('open')"
  >
    <svg class="robot-avatar__face" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <!-- 天线：只作识别，不承载信息 -->
      <line x1="24" y1="4" x2="24" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="24" cy="4" r="2.5" fill="currentColor" />
      <!-- 头 -->
      <rect x="7" y="9" width="34" height="28" rx="10" fill="#ffffff" stroke="currentColor" stroke-width="2.5" />
      <!-- 眼睛 -->
      <circle cx="18" cy="22" r="3" fill="currentColor" />
      <circle cx="30" cy="22" r="3" fill="currentColor" />
      <!-- 嘴：待机是一条短横线 -->
      <line x1="19" y1="30" x2="29" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <!-- 两侧耳罩 -->
      <rect x="3" y="18" width="4" height="10" rx="2" fill="currentColor" />
      <rect x="41" y="18" width="4" height="10" rx="2" fill="currentColor" />
    </svg>
    <span v-if="badge" class="robot-avatar__badge" :aria-label="ROBOT_COPY.badgeAria" role="img"></span>
  </button>
</template>

<style scoped>
.robot-avatar {
  position: relative;
  width: 48px;
  height: 48px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #fff;
  color: var(--admin-primary, #1890ff);
  box-shadow: 0 4px 16px rgba(0, 21, 41, 0.16);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 待机呼吸：幅度只有 2px，够让人知道它醒着，不至于像在抖 */
  animation: robot-breathe 4.2s ease-in-out infinite;
}

.robot-avatar:hover {
  box-shadow: 0 6px 20px rgba(0, 21, 41, 0.22);
}

.robot-avatar:focus-visible {
  outline: 2px solid var(--admin-primary, #1890ff);
  outline-offset: 2px;
}

.robot-avatar--speaking {
  animation-duration: 2.1s;
}

.robot-avatar__face {
  width: 34px;
  height: 34px;
}

.robot-avatar__badge {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff4d4f;
  border: 2px solid #fff;
  box-sizing: content-box;
}

@keyframes robot-breathe {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .robot-avatar,
  .robot-avatar--speaking {
    animation: none;
  }
}
</style>
