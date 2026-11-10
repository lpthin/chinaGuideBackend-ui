<script setup lang="ts">
/**
 * 机器人唯一挂载点（SPEC-UI-11 §4.4）：只挂在 `WorkspaceView.vue` 一次。
 *
 * 不挂 `App.vue`：那里同时服务登录页与门户访客页，挂上去等于把后台机器人漏给访客。
 *
 * 这一层只做三件事：跟着路由进出页面、把现场事件（失焦、弹窗关闭、回到标签页）转成「可以说了」、
 * 渲染「当前该说的那一条」。所有判断都在中枢里，Host 自己不做业务决定。
 * 渲染抛错时整块自行隐藏（验收 #9）：机器人挂了不能连累页面。
 */
import { computed, onErrorCaptured, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { createSubmitGuard } from '../../utils/submitGuard'
import { ROBOT_COPY } from '../../copy/robot'
import { robotCenter } from './robotCenter'
import { buildRobotRollout, isRobotRolloutEnabled, resolveRobotRollout, type RobotRollout } from './robotRollout'
import { collectRobotSignals } from './robotSignals'
import { recordRobotTelemetry, robotTelemetrySummary, type RobotTelemetrySummary } from './robotTelemetry'
import RobotAvatar from './RobotAvatar.vue'
import RobotBubble from './RobotBubble.vue'
import RobotHelpPanel from './RobotHelpPanel.vue'
import RobotSettingsPanel from './RobotSettingsPanel.vue'
import type { RobotAction } from './robotTypes'

const center = robotCenter
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const prefs = center.prefs
const active = center.active
const badge = center.badge
const settingsOpen = center.settingsOpen
const detailOpen = center.detailOpen
const helpEntries = center.helpEntries

const failed = ref(false)
/** 灰度/熔断（R-10）：off 时整块不渲染，页面回到接入前；首屏先用构建期那一档，远端回来再覆盖 */
const rollout = ref<RobotRollout>(buildRobotRollout())
const robotEnabled = computed(() => isRobotRolloutEnabled(rollout.value, auth.user?.id ?? null))
/** 本机近 7 天统计：打开设置时算一次，关闭率由此可见（§12） */
const stats = ref<RobotTelemetrySummary | null>(null)
const helpOpen = ref(false)
/**
 * 页头问号挂到 `WorkspaceView` 头部预留的插槽里（R-5）；
 * 拿不到插槽（比如单独挂 Host 的场景）就退化成机器人这一摞里的一颗小按钮，不消失。
 */
const helpSlotReady = ref(false)
const actionGuard = createSubmitGuard()

onErrorCaptured(() => {
  // 机器人自身异常必须为 0（§12）；真出了也只会让这一块消失，页面照常
  failed.value = true
  recordRobotTelemetry({ type: 'error', key: 'robot.host', page: route.path })
  return false
})

watch(
  () => auth.user?.id ?? null,
  async () => {
    // 没有远端配置时立刻返回构建期那一档；这里 await 只影响覆盖，不影响首屏
    rollout.value = await resolveRobotRollout()
  },
  { immediate: true }
)

watch(settingsOpen, open => {
  if (open) stats.value = robotTelemetrySummary()
})

/** 登录态变化时按账号重读偏好：换号不继承上一个人的频率与静音清单 */
watch(
  () => auth.user?.id ?? null,
  id => {
    void center.attachUser(id)
  },
  { immediate: true }
)

/**
 * 信号源（R-7 / R-8）：登录态或选中的客户一变就采一次待办 / 体检 / 引用结果。
 * 采集失败静默、没有客户上下文就不说；开关、频率与静音全部由中枢执行。
 */
watch(
  () => [auth.user?.id ?? null, auth.selectedTenantId ?? null] as const,
  () => {
    if (!auth.user?.id) return
    void collectRobotSignals(center, {
      isSuperAdmin: auth.isSuperAdmin,
      selectedTenantId: auth.selectedTenantId,
      hasPermission: code => auth.hasPermission(code)
    })
  },
  { immediate: true }
)

/** 路由是页面生命周期的唯一来源：进入一页重置本页计数，离开就收起当前这条 */
watch(
  () => route.path,
  path => center.enterPage(path),
  { immediate: true }
)

function flush(): void {
  center.flush()
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') center.flush()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && active.value) center.dismiss('user')
}

onMounted(() => {
  document.addEventListener('focusout', flush)
  document.addEventListener('click', flush)
  document.addEventListener('visibilitychange', onVisibilityChange)
  document.addEventListener('keydown', onKeydown)
  helpSlotReady.value = !!document.getElementById('robot-help-entry')
})

onUnmounted(() => {
  document.removeEventListener('focusout', flush)
  document.removeEventListener('click', flush)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  document.removeEventListener('keydown', onKeydown)
  center.leavePage()
})

function handleMuteCategory(): void {
  const current = active.value
  if (!current) return
  center.setCategory(current.category, false)
  center.dismiss('user')
}

/** 页头问号：只看说明，不打断当前这条气泡 */
function openHelp(): void {
  helpOpen.value = !helpOpen.value
  if (helpOpen.value) center.openSettings(false)
}

/** 从问号那边切去设置时先收起说明，两个抽屉不叠着 */
function openSettings(): void {
  helpOpen.value = false
  center.openSettings(true)
}

function handleAction(action: RobotAction): void {
  // 连点两次「去看」不能推两次路由（验收 #12）：router.push 在途时第二次直接丢掉
  void actionGuard.run(async () => {
    if (action.kind === 'navigate' && action.to) await router.push(action.to)
    center.runAction(action.kind, action.label)
  })
}
</script>

<template>
  <div
    v-if="!failed && robotEnabled"
    class="robot-host"
    :class="`robot-host--${prefs.position}`"
    data-testid="robot-host"
  >
    <!-- 页头问号（R-5）：这一页的说明条删掉之后，用户复看全文的唯一常驻入口 -->
    <Teleport to="#robot-help-entry" :disabled="!helpSlotReady">
      <button
        v-if="helpEntries.length"
        type="button"
        class="robot-host__help"
        :aria-label="ROBOT_COPY.help.aria"
        :aria-expanded="helpOpen"
        data-testid="robot-help-entry"
        @click="openHelp"
      >
        ?
      </button>
    </Teleport>

    <transition name="robot-pop">
      <RobotBubble
        v-if="active"
        :notice="active"
        :detail-open="detailOpen"
        class="robot-host__bubble"
        @close="center.dismiss('user')"
        @toggle-detail="center.openDetail(!detailOpen)"
        @action="handleAction"
        @mute-key="center.muteCurrent()"
        @mute-page="center.mutePage()"
        @mute-category="handleMuteCategory"
      />
    </transition>

    <RobotAvatar
      v-if="prefs.avatar"
      :badge="badge && !active"
      :speaking="!!active"
      @open="openSettings"
    />
    <!--
      本体关掉之后的兜底入口：设置面板还不能从别处打开，
      否则「隐藏」就变成了不可逆——用户再也找不到地方把它打开。
      页头问号只管看说明，不管开关，所以这两颗不是同一件事。
    -->
    <button
      v-else
      type="button"
      class="robot-host__reopen"
      :aria-label="ROBOT_COPY.avatarAria"
      @click="openSettings"
    >
      ?
    </button>

    <RobotSettingsPanel
      :open="settingsOpen"
      :prefs="prefs"
      :stats="stats"
      @update:open="center.openSettings($event)"
      @set-rate="center.setRate($event)"
      @set-category="(category, enabled) => center.setCategory(category, enabled)"
      @quiet="center.setQuiet($event)"
      @unmute="center.unmuteKey($event)"
      @unmute-page="center.unmutePage($event)"
      @restore-all="center.restoreAll()"
      @set-position="center.setPosition($event)"
      @set-avatar="center.setAvatar($event)"
    />

    <RobotHelpPanel
      :open="helpOpen"
      :entries="helpEntries"
      @update:open="helpOpen = $event"
    />
  </div>
</template>

<style scoped>
.robot-host {
  position: fixed;
  bottom: 24px;
  z-index: 900; /* 低于 Modal/Drawer/popconfirm（antd 1000+），高于内容 */
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}

.robot-host--br {
  right: 24px;
}

.robot-host--bl {
  left: 24px;
  align-items: flex-start;
}

.robot-host > * {
  pointer-events: auto;
}

.robot-host__reopen {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--admin-border-soft, #f0f0f0);
  border-radius: 50%;
  background: #fff;
  color: var(--admin-text-muted, #bfbfbf);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.robot-host__reopen:hover {
  color: var(--admin-primary, #1890ff);
  border-color: var(--admin-primary, #1890ff);
}

/* 页头问号：常驻、极轻，不抢标题与操作按钮的位置（R-5） */
.robot-host__help {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--admin-border-soft, #f0f0f0);
  border-radius: 50%;
  background: #fff;
  color: var(--admin-text-secondary, #8c8c8c);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.robot-host__help:hover,
.robot-host__help[aria-expanded='true'] {
  color: var(--admin-primary, #1890ff);
  border-color: var(--admin-primary, #1890ff);
}

.robot-host__help:focus-visible {
  outline: 2px solid var(--admin-primary, #1890ff);
  outline-offset: 2px;
}

.robot-pop-enter-active {
  transition: opacity 0.18s ease-out, transform 0.18s ease-out;
}

.robot-pop-leave-active {
  transition: opacity 0.12s ease-in;
}

.robot-pop-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.robot-pop-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .robot-host {
    left: 16px;
    right: 16px;
    bottom: 16px;
    align-items: stretch;
  }

  .robot-host--bl,
  .robot-host--br {
    left: 16px;
    right: 16px;
  }

  .robot-host > .robot-avatar,
  .robot-host > .robot-host__reopen {
    align-self: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .robot-pop-enter-active,
  .robot-pop-leave-active {
    transition: opacity 0.12s linear;
  }

  .robot-pop-enter-from {
    transform: none;
  }
}
</style>
