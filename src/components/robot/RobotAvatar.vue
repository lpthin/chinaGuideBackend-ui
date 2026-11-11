<script setup lang="ts">
/**
 * 机器人的形象（SPEC-UI-11 §9）。
 *
 * 纯内联 SVG + 纯 CSS 呼吸动画：不引 GIF、不引第三方插画、不新增运行时依赖。
 * 系统开了「减少动效」时动画整体关掉（见 RobotHost 的媒体查询），这里只负责画。
 *
 * 2026-11-11 起可拖：只负责把 pointer 事件原样上报（moved 超过阈值才算拖），
 * 位置计算与落库都在 Host——小球不知道自己在哪，只知道手在动。
 */
import { ref } from 'vue'
import { ROBOT_COPY } from '../../copy/robot'

defineProps<{
  /** 有话说但没说（被频率/忙碌挡住）时冒一个小角标 */
  badge?: boolean
  /** 正在说话：耳机灯换成实心，呼吸略快 */
  speaking?: boolean
  /** 拖动进行中：呼吸停掉，光标换成抓取 */
  dragging?: boolean
}>()

const emit = defineEmits<{
  (event: 'open'): void
  /** 位移越过阈值的那一下触发一次，之后每次移动都发 */
  (event: 'drag-start', pointer: PointerEvent): void
  (event: 'drag-move', pointer: PointerEvent): void
  (event: 'drag-end', pointer: PointerEvent): void
}>()

/** 位移超过这个像素才算「拖」，否则都还给 click */
const DRAG_THRESHOLD_PX = 4

const pressing = ref(false)
const moved = ref(false)
let startX = 0
let startY = 0

function onPointerDown(event: PointerEvent): void {
  const target = event.currentTarget
  // 只跟左键/单指；右键菜单、多指缩放都不掺和
  if (event.button !== 0 || !(target instanceof HTMLElement)) return
  pressing.value = true
  moved.value = false
  startX = event.clientX
  startY = event.clientY
  target.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!pressing.value) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  if (!moved.value && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
    moved.value = true
    emit('drag-start', event)
  }
  if (moved.value) emit('drag-move', event)
}

function onPointerUp(event: PointerEvent): void {
  if (!pressing.value) return
  pressing.value = false
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.releasePointerCapture(event.pointerId)
  if (moved.value) emit('drag-end', event)
}

function onClick(): void {
  // 拖完松手的那次 click 不算「打开」：用户是在放手，不是在点按钮
  if (moved.value) {
    moved.value = false
    return
  }
  emit('open')
}
</script>

<template>
  <button
    type="button"
    class="robot-avatar"
    :class="{ 'robot-avatar--speaking': speaking, 'robot-avatar--dragging': dragging }"
    :aria-label="ROBOT_COPY.avatarAria"
    data-testid="robot-avatar"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click="onClick"
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
  /* 拖动是 pointer 事件驱动的：不拦住触摸滚动，拖就没法做 */
  touch-action: none;
}

.robot-avatar--dragging {
  animation: none;
  cursor: grabbing;
  box-shadow: 0 10px 26px rgba(0, 21, 41, 0.28);
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
