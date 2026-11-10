<script setup lang="ts">
/**
 * 设置面板（SPEC-UI-11 §6）：频率、临时安静、内容开关、静音清单、位置、显示本体。
 *
 * 面板不自己读写存储：所有改动都往上抛事件，由中枢统一落本地并防抖同步后端。
 * 静音清单必须可反悔——这是「用户可控」这条底线的最后一道，所以逐条恢复与全部恢复都留着。
 */
import { computed } from 'vue'
import {
  ROBOT_CATEGORIES,
  type RobotCategory,
  type RobotFrequency,
  type RobotPosition
} from './robotTypes'
import { ROBOT_CATEGORY_COPY, ROBOT_COPY, ROBOT_FREQUENCY_COPY } from '../../copy/robot'
import type { RobotPrefs } from './robotPrefs'

const props = defineProps<{
  open: boolean
  prefs: RobotPrefs
}>()

const emit = defineEmits<{
  (event: 'update:open', open: boolean): void
  (event: 'set-rate', rate: RobotFrequency): void
  (event: 'set-category', category: RobotCategory, enabled: boolean): void
  (event: 'quiet', choice: 'hour' | 'today' | null): void
  (event: 'unmute', key: string): void
  (event: 'unmute-page', page: string): void
  (event: 'restore-all'): void
  (event: 'set-position', position: RobotPosition): void
  (event: 'set-avatar', visible: boolean): void
}>()

const frequencies = computed(() =>
  (Object.keys(ROBOT_FREQUENCY_COPY) as RobotFrequency[]).map(rate => ({
    rate,
    ...ROBOT_FREQUENCY_COPY[rate]
  }))
)

const categories = ROBOT_CATEGORIES.map(category => ({
  category,
  ...ROBOT_CATEGORY_COPY[category]
}))

const mutedTotal = computed(() => props.prefs.mutedKeys.length + props.prefs.mutedPages.length)
const quieting = computed(() => (props.prefs.quietUntil ?? 0) > Date.now())
</script>

<template>
  <a-drawer
    :open="open"
    placement="right"
    :width="360"
    :title="ROBOT_COPY.settings.title"
    @close="emit('update:open', false)"
  >
    <div class="robot-settings" data-testid="robot-settings">
      <a-tabs size="small">
        <a-tab-pane key="rate" :tab="ROBOT_COPY.settings.tabs.rate">
      <section class="robot-settings__section">
        <h4 class="robot-settings__title">{{ ROBOT_COPY.settings.frequency }}</h4>
        <label
          v-for="item in frequencies"
          :key="item.rate"
          class="robot-settings__option"
          :class="{ 'robot-settings__option--active': prefs.rate === item.rate }"
        >
          <input
            type="radio"
            name="robot-rate"
            :value="item.rate"
            :checked="prefs.rate === item.rate"
            @change="emit('set-rate', item.rate)"
          />
          <span class="robot-settings__option-body">
            <span class="robot-settings__option-label">{{ item.label }}</span>
            <span class="robot-settings__option-hint">{{ item.hint }}</span>
          </span>
        </label>
      </section>

      <section class="robot-settings__section">
        <h4 class="robot-settings__title">{{ ROBOT_COPY.settings.quiet }}</h4>
        <div class="robot-settings__row">
          <button type="button" class="robot-settings__chip" @click="emit('quiet', 'hour')">
            {{ ROBOT_COPY.quietHour }}
          </button>
          <button type="button" class="robot-settings__chip" @click="emit('quiet', 'today')">
            {{ ROBOT_COPY.quietToday }}
          </button>
          <button v-if="quieting" type="button" class="robot-settings__chip" @click="emit('quiet', null)">
            {{ ROBOT_COPY.quietResumed }}
          </button>
        </div>
      </section>
        </a-tab-pane>

        <a-tab-pane key="content" :tab="ROBOT_COPY.settings.tabs.content">
      <section class="robot-settings__section">
        <h4 class="robot-settings__title">{{ ROBOT_COPY.settings.content }}</h4>
        <label v-for="item in categories" :key="item.category" class="robot-settings__check">
          <input
            type="checkbox"
            :checked="prefs.categories[item.category]"
            @change="emit('set-category', item.category, ($event.target as HTMLInputElement).checked)"
          />
          <span class="robot-settings__option-body">
            <span class="robot-settings__option-label">{{ item.label }}</span>
            <span class="robot-settings__option-hint">{{ item.hint }}</span>
          </span>
        </label>
      </section>

      <section class="robot-settings__section">
        <h4 class="robot-settings__title">
          {{ ROBOT_COPY.settings.muted }}
          <button
            v-if="mutedTotal > 0"
            type="button"
            class="robot-settings__link"
            @click="emit('restore-all')"
          >
            {{ ROBOT_COPY.settings.restoreAll }}
          </button>
        </h4>
        <p v-if="mutedTotal === 0" class="robot-settings__empty">{{ ROBOT_COPY.settings.mutedEmpty }}</p>
        <ul v-else class="robot-settings__muted">
          <li v-for="key in prefs.mutedKeys" :key="`key-${key}`" class="robot-settings__muted-row">
            <span class="robot-settings__muted-name" :title="key">{{ key }}</span>
            <button type="button" class="robot-settings__link" @click="emit('unmute', key)">
              {{ ROBOT_COPY.settings.restore }}
            </button>
          </li>
          <li v-for="page in prefs.mutedPages" :key="`page-${page}`" class="robot-settings__muted-row">
            <span class="robot-settings__muted-name" :title="page">整页：{{ page }}</span>
            <button type="button" class="robot-settings__link" @click="emit('unmute-page', page)">
              {{ ROBOT_COPY.settings.restore }}
            </button>
          </li>
        </ul>
      </section>
        </a-tab-pane>

        <a-tab-pane key="layout" :tab="ROBOT_COPY.settings.tabs.layout">
      <section class="robot-settings__section">
        <h4 class="robot-settings__title">{{ ROBOT_COPY.settings.position }}</h4>
        <div class="robot-settings__row">
          <label
            v-for="position in (['br', 'bl'] as RobotPosition[])"
            :key="position"
            class="robot-settings__chip"
            :class="{ 'robot-settings__chip--active': prefs.position === position }"
          >
            <input
              type="radio"
              name="robot-position"
              :value="position"
              :checked="prefs.position === position"
              @change="emit('set-position', position)"
            />
            {{ position === 'br' ? ROBOT_COPY.settings.positionRight : ROBOT_COPY.settings.positionLeft }}
          </label>
        </div>
      </section>

      <section class="robot-settings__section">
        <label class="robot-settings__check">
          <input
            type="checkbox"
            :checked="prefs.avatar"
            @change="emit('set-avatar', ($event.target as HTMLInputElement).checked)"
          />
          <span class="robot-settings__option-body">
            <span class="robot-settings__option-label">{{ ROBOT_COPY.settings.avatar }}</span>
            <span class="robot-settings__option-hint">{{ ROBOT_COPY.settings.avatarHint }}</span>
          </span>
        </label>
      </section>
        </a-tab-pane>
      </a-tabs>
    </div>
  </a-drawer>
</template>

<style scoped lang="less">
.robot-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;

  &__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__title {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--admin-text-primary, #1a1a1a);
  }

  &__option,
  &__check {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--admin-border-soft, #f0f0f0);
    border-radius: 8px;
    cursor: pointer;
  }

  &__option--active {
    border-color: var(--admin-primary, #1890ff);
    background: #e8f4ff;
  }

  &__option input,
  &__check input {
    margin-top: 2px;
    flex: none;
  }

  &__option-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__option-label {
    font-size: 13px;
    color: var(--admin-text-primary, #1a1a1a);
  }

  &__option-hint {
    font-size: 12px;
    line-height: 18px;
    color: var(--admin-text-secondary, #8c8c8c);
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 12px;
    border: 1px solid var(--admin-border-soft, #f0f0f0);
    border-radius: 15px;
    background: #fff;
    font-size: 12px;
    color: var(--admin-text-primary, #1a1a1a);
    cursor: pointer;
  }

  &__chip--active {
    border-color: var(--admin-primary, #1890ff);
    color: var(--admin-primary, #1890ff);
  }

  &__chip input {
    margin: 0;
  }

  &__empty {
    margin: 0;
    font-size: 12px;
    color: var(--admin-text-secondary, #8c8c8c);
  }

  &__muted {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__muted-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: var(--admin-text-secondary, #8c8c8c);
  }

  &__muted-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__link {
    padding: 0;
    border: none;
    background: transparent;
    font-size: 12px;
    color: var(--admin-primary, #1890ff);
    cursor: pointer;
  }
}
</style>
