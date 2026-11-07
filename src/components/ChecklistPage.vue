<script setup lang="ts">
/**
 * D 型「检查清单」页模板（Spec-Q §4.1 D 型，P4 第一次落地；用它的是门户上线那一屏）。
 *
 * 立这个组件的理由是实测：改之前那一屏是 5 张卡 + 3 个 a-descriptions + 2 个 a-statistic，
 * 整页高 2404px，没有一个地方说「五步里齐了几步」；两个统计数停在「未取到」上，
 * 屏上只有一个 24px 大字，连下一步去哪儿都不指（§1.4）。
 * 这里收成四件事：
 *
 * 1. 页头一次：标题 + 一句说明 + 右上那组动作（刷新）。
 * 2. 一条总读数：五步里齐了几步。分子分母都由 checklistPageModel.ts 从步骤清单算，模板不猜；
 *    「还差」和「还不知道」分成两组念——把「没取到数」算进「还差」等于替后端说它没说过的话。
 * 3. 每步一行：序号 + 状态角标 + 那一格自己的内容（插槽）+ 差什么 + **一个「去哪儿补」的链接**。
 *    unknown 那一档必须带链接，这是 §4.1 对「未取到」的要求。
 * 4. 顶栏一排锚点：长页（2404px）能跳到某一步，不用从头滚。
 *
 * 不做两件事：
 * - 不替页面决定每一步里摆什么。五步的正文（descriptions、统计数、灌演示包那三个按钮）
 *   形状完全不同，硬做成统一的「字段行」会把第 3 步那两个动作按钮挤没了；
 *   所以正文一律走与 step.key 同名的插槽，模板只统一状态、差什么、去哪儿补这三句的位置。
 * - 不在这里判断「齐了没」。level 由页面按后端回的数字给，模板只看它上色与分组。
 */
import { computed } from 'vue'
import PageTitle from './PageTitle.vue'
import {
  CHECKLIST_LEVEL_COLOR,
  checklistAnchorId,
  checklistNotMeasuredText,
  checklistPendingText,
  checklistProgress,
  checklistProgressText,
  type ChecklistLevel,
  type ChecklistStep
} from './checklistPageModel'

const props = withDefaults(
  defineProps<{
    /** 这一屏是干什么的，只这一句（同一屏不许在每张卡头再解释一遍） */
    description?: string
    loading?: boolean
    steps?: readonly ChecklistStep[]
  }>(),
  {
    description: '',
    loading: false,
    steps: () => [],
  }
)

const progress = computed(() => checklistProgress(props.steps))
const progressText = computed(() => checklistProgressText(progress.value))
const pendingText = computed(() => checklistPendingText(progress.value))
const notMeasuredText = computed(() => checklistNotMeasuredText(progress.value))

/** 序号给成字符串，1 起；模板里不做 step.key 的拼接 */
const rows = computed(() => props.steps.map((step, index) => ({ ...step, index: index + 1 })))

function colorOf(level: ChecklistLevel): string {
  return CHECKLIST_LEVEL_COLOR[level]
}

function jump(key: string) {
  const target = document.getElementById(checklistAnchorId(key))
  if (!target || typeof target.scrollIntoView !== 'function') return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="checklist-page">
    <PageTitle :description="description">
      <template v-if="$slots.actions" #extra>
        <slot name="actions" />
      </template>
    </PageTitle>

    <slot name="notice" />

    <div v-if="rows.length" class="checklist-page__summary">
      <b class="checklist-page__summary-num" data-checklist-progress>{{ progressText }}</b>
      <a
        v-for="step in rows"
        :key="step.key"
        class="checklist-page__chip"
        :class="`checklist-page__chip--${step.level}`"
        :href="`#${checklistAnchorId(step.key)}`"
        data-checklist-anchor
        @click.prevent="jump(step.key)"
      >
        <span class="checklist-page__chip-index">{{ step.index }}</span>
        {{ step.title }}
        <em>{{ step.stateText }}</em>
      </a>
    </div>

    <p v-if="pendingText" class="checklist-page__pending" data-checklist-pending>{{ pendingText }}</p>
    <p v-if="notMeasuredText" class="checklist-page__unknown" data-checklist-unknown>
      {{ notMeasuredText }}——这几格是没取到数，不是「取到了、确实缺」
    </p>

    <a-spin :spinning="loading">
      <a-card
        v-for="row in rows"
        :id="checklistAnchorId(row.key)"
        :key="row.key"
        :bordered="false"
        class="checklist-page__step"
        :data-checklist-step="row.key"
      >
        <template #title>
          <span class="checklist-page__index">{{ row.index }}</span>
          {{ row.title }}
        </template>
        <template #extra>
          <a-tag :color="colorOf(row.level)">{{ row.stateText }}</a-tag>
        </template>

        <slot :name="row.key" />

        <p v-if="row.gap" class="checklist-page__gap">{{ row.gap }}</p>

        <p v-if="row.links?.length" class="checklist-page__links">
          <span class="checklist-page__links-label">去哪儿补：</span>
          <template v-for="link in row.links" :key="link.label">
            <router-link v-if="link.to" :to="link.to" class="checklist-page__link">{{ link.label }}</router-link>
            <a v-else-if="link.href" :href="link.href" target="_blank" rel="noopener" class="checklist-page__link">{{ link.label }}</a>
            <span v-else class="checklist-page__link-plain">{{ link.label }}</span>
          </template>
        </p>
      </a-card>
    </a-spin>
  </div>
</template>

<style scoped>
.checklist-page {
  padding-bottom: var(--admin-space-3);
}

.checklist-page__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--admin-space-1);
  margin-bottom: var(--admin-space-2);
}

.checklist-page__summary-num {
  font-size: 15px;
  font-variant-numeric: var(--admin-font-nums);
}

.checklist-page__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border: 1px solid var(--admin-border-soft);
  border-radius: 999px;
  font-size: 12px;
  line-height: 18px;
  color: var(--admin-text-primary);
  background: var(--admin-fill-hover);
}

.checklist-page__chip em {
  font-style: normal;
  color: var(--admin-text-secondary);
}

.checklist-page__chip-index {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--admin-text-muted);
  color: #fff;
  text-align: center;
  line-height: 16px;
  font-size: 11px;
}

/* 那一排圆点不按档位上色：档位已经由卡片右上角的角标（a-tag）说过一遍，
   同一屏说两遍就是四支色。这里只留「第几步」。 */

.checklist-page__pending,
.checklist-page__unknown {
  margin: 0 0 var(--admin-space-2);
  font-size: 13px;
  color: var(--admin-text-secondary);
}

.checklist-page__unknown {
  color: var(--admin-warning-text);
}

.checklist-page__step {
  margin-bottom: var(--admin-space-2);
  border-radius: var(--admin-radius-card);
}

.checklist-page__index {
  display: inline-block;
  width: 22px;
  height: 22px;
  margin-right: var(--admin-space-1);
  border-radius: 50%;
  background: var(--admin-primary);
  color: #fff;
  text-align: center;
  line-height: 22px;
  font-size: 12px;
}

.checklist-page__gap {
  margin: var(--admin-space-1) 0 0;
  font-size: 13px;
  color: var(--admin-warning-text);
}

.checklist-page__links {
  margin: var(--admin-space-1) 0 0;
  font-size: 13px;
  color: var(--admin-text-secondary);
}

.checklist-page__link {
  margin-right: var(--admin-space-1);
}

.checklist-page__links-label {
  margin-right: 4px;
}

:deep(.ant-card-head-title) {
  white-space: normal;
  word-break: break-word;
}
</style>
