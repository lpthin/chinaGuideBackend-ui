<script setup lang="ts">
/**
 * 页头问号的展开面板（R-5）。
 *
 * 只做一件事：把这一页被搬走的「口径 / 引导」原文原样摆出来。
 * 内容来自中枢的 `helpEntries`，不是自己再去页面上找——页面已经把说明条删了，
 * 这里是用户能复看的唯一出口（§11 回滚保证：删 `a-alert` 但保留问号）。
 *
 * 面板不提供「编辑」也不提供「反馈」：v1 只做讲解（§16 已拍板第 1 条）。
 */
import { ROBOT_CATEGORY_COPY, ROBOT_COPY } from '../../copy/robot'
import type { RobotNotice } from './robotTypes'

defineProps<{ open: boolean; entries: RobotNotice[] }>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()
</script>

<template>
  <a-drawer
    :open="open"
    :title="ROBOT_COPY.help.title"
    :width="420"
    placement="right"
    data-testid="robot-help-panel"
    @close="emit('update:open', false)"
  >
    <ul class="robot-help">
      <li v-for="entry in entries" :key="entry.key" class="robot-help__item">
        <p class="robot-help__eyebrow">{{ ROBOT_CATEGORY_COPY[entry.category].label }}</p>
        <p class="robot-help__text">{{ entry.text }}</p>
        <p v-if="entry.detail" class="robot-help__detail">{{ entry.detail }}</p>
      </li>
    </ul>
  </a-drawer>
</template>

<style scoped>
.robot-help {
  margin: 0;
  padding: 0;
  list-style: none;
}

.robot-help__item + .robot-help__item {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--admin-border-soft, #f0f0f0);
}

.robot-help__eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--admin-text-muted, #8c8c8c);
}

.robot-help__text {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text-primary);
}

.robot-help__detail {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--admin-text-secondary);
}
</style>
