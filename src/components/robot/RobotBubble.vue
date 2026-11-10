<script setup lang="ts">
/**
 * 气泡（SPEC-UI-11 §4.2 / §9）。
 *
 * 一句话 + 最多两个动作；长解释收在「看详细说明」里，点开才看。
 * 无障碍：容器 `role="status"` + `aria-live="polite"`，出现时不抢焦点、不滚动页面；
 * 关闭与动作按钮都在 Tab 顺序里，`prefers-reduced-motion` 时只淡入不位移。
 */
import { computed } from 'vue'
import { ROBOT_COPY, ROBOT_CATEGORY_COPY } from '../../copy/robot'
import type { RobotAction, RobotNotice } from './robotTypes'

const props = defineProps<{
  notice: RobotNotice
  detailOpen: boolean
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'toggle-detail'): void
  (event: 'action', action: RobotAction): void
  (event: 'mute-key'): void
  (event: 'mute-page'): void
  (event: 'mute-category'): void
}>()

const categoryLabel = computed(() => ROBOT_CATEGORY_COPY[props.notice.category]?.label ?? '')
const actions = computed(() => (props.notice.actions ?? []).slice(0, 2))
</script>

<template>
  <section class="robot-bubble" role="status" aria-live="polite" data-testid="robot-bubble">
    <header class="robot-bubble__head">
      <span class="robot-bubble__eyebrow">{{ categoryLabel }}</span>
      <button type="button" class="robot-bubble__close" :aria-label="ROBOT_COPY.close" @click="emit('close')">
        ×
      </button>
    </header>

    <p class="robot-bubble__text">{{ notice.text }}</p>

    <button
      v-if="notice.detail || notice.docUrl"
      type="button"
      class="robot-bubble__detail-toggle"
      :aria-expanded="detailOpen"
      @click="emit('toggle-detail')"
    >
      {{ detailOpen ? ROBOT_COPY.detailCollapse : ROBOT_COPY.detailToggle }}
    </button>
    <p v-if="detailOpen && notice.detail" class="robot-bubble__detail">{{ notice.detail }}</p>
    <a
      v-if="detailOpen && notice.docUrl"
      class="robot-bubble__doc"
      :href="notice.docUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ ROBOT_COPY.detailDoc }}
    </a>

    <footer class="robot-bubble__foot">
      <div class="robot-bubble__actions">
        <button
          v-for="action in actions"
          :key="action.label"
          type="button"
          class="robot-bubble__action"
          :class="{ 'robot-bubble__action--primary': action.kind === 'navigate' }"
          @click="emit('action', action)"
        >
          {{ action.label }}
        </button>
      </div>
      <div class="robot-bubble__mutes">
        <button type="button" class="robot-bubble__mute" @click="emit('mute-key')">
          {{ ROBOT_COPY.actionLater }}
        </button>
        <button type="button" class="robot-bubble__mute" @click="emit('mute-page')">
          {{ ROBOT_COPY.actionMutePage }}
        </button>
        <button type="button" class="robot-bubble__mute" @click="emit('mute-category')">
          {{ ROBOT_COPY.actionMuteCategory }}
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped lang="less">
.robot-bubble {
  width: 320px;
  max-width: calc(100vw - 48px);
  padding: 12px 14px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--admin-border-soft, #f0f0f0);
  box-shadow: 0 8px 28px rgba(0, 21, 41, 0.16);
  text-align: left;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__eyebrow {
    font-size: 12px;
    color: var(--admin-text-secondary, #8c8c8c);
  }

  &__close {
    flex: none;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--admin-text-secondary, #8c8c8c);
    font-size: 18px;
    line-height: 20px;
    cursor: pointer;
  }

  &__close:hover {
    background: var(--admin-fill-hover, #fafafa);
    color: var(--admin-text-primary, #1a1a1a);
  }

  &__text {
    margin: 6px 0 0;
    font-size: 14px;
    line-height: 22px;
    color: var(--admin-text-primary, #1a1a1a);
  }

  &__detail-toggle {
    margin-top: 4px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--admin-primary, #1890ff);
    font-size: 12px;
    cursor: pointer;
  }

  &__doc {
    display: inline-block;
    margin-top: 4px;
    font-size: 12px;
    color: var(--admin-primary, #1677ff);
    text-decoration: underline;
  }

  &__detail {
    margin: 6px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--admin-table-header-bg, #fafafa);
    font-size: 12px;
    line-height: 20px;
    color: var(--admin-text-secondary, #8c8c8c);
  }

  &__foot {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__actions {
    display: flex;
    gap: 8px;
  }

  &__action {
    height: 28px;
    padding: 0 12px;
    border-radius: 6px;
    border: 1px solid var(--admin-border-soft, #f0f0f0);
    background: #fff;
    color: var(--admin-text-primary, #1a1a1a);
    font-size: 13px;
    cursor: pointer;
  }

  &__action--primary {
    border-color: var(--admin-primary, #1890ff);
    background: var(--admin-primary, #1890ff);
    color: #fff;
  }

  &__action:focus-visible,
  &__mute:focus-visible,
  &__close:focus-visible,
  &__detail-toggle:focus-visible {
    outline: 2px solid var(--admin-primary, #1890ff);
    outline-offset: 2px;
  }

  &__mutes {
    display: flex;
    gap: 12px;
  }

  &__mute {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--admin-text-secondary, #8c8c8c);
    font-size: 12px;
    cursor: pointer;
  }

  &__mute:hover {
    color: var(--admin-primary, #1890ff);
  }
}

@media (max-width: 768px) {
  .robot-bubble {
    width: 100%;
    max-width: none;
  }
}
</style>
