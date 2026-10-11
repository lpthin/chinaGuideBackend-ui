<script setup lang="ts">
/**
 * 「人话一句话 + 后端原文折进展开」（Spec-M §10.16，他拍板的那条排版口径）。
 *
 * 默认只摆一句人话，后端原话一个字都不丢——折进下面那一栏里，要看就点开。
 * 这么摆的理由：界面里那些 2037 字 / 1871 字的墙今天没人读，读不了就等于没告诉他；
 * 但把原文直接删掉又会让「这句话从哪来」失去出处，所以两句都留着，只分主次。
 *
 * 三条纪律：
 * 1. `summary` 只由后端读数拼出来或由 `firstSentence()` 取第一句，**组件不造新事实**；
 * 2. 原文走 `{{ }}` 插值，永不 `v-html`（接口原话里带什么都有可能）；
 * 3. 取不到读数时说「没填/没取到」，不许把空念成「无」或「已完成」。
 */
import { computed } from 'vue'
import { firstSentence, hasFoldableRaw, jsonMessageSentence } from './foldedTextModel'

const props = withDefaults(defineProps<{
  /** 后端原话本体（逐字，展开区摆这一份） */
  raw?: string | null
  /** 已经拼好的人话那一句；不给就由 raw 取第一句 */
  summary?: string | null
  /** 展开那一栏的标题 */
  rawLabel?: string
  /** 既没有原话也没有那一句时说的那句（默认「没填」） */
  emptyText?: string
  /** error 把那一句标红：失败原因那一族要一眼看见 */
  tone?: 'plain' | 'error'
}>(), {
  raw: null,
  summary: null,
  rawLabel: '后端原话（逐字）',
  emptyText: '没填',
  tone: 'plain'
})

const rawText = computed(() => (props.raw ?? '').trim())

const line = computed(() => {
  const given = (props.summary ?? '').trim()
  if (given) return given
  if (!rawText.value) return ''
  // 机器话（JSON 错误体）先按错误字段取那一句，取不到才退回按行取句
  return jsonMessageSentence(rawText.value) ?? firstSentence(rawText.value)
})

const foldable = computed(() => hasFoldableRaw(rawText.value, line.value))

const shown = computed(() => line.value || props.emptyText)
</script>

<template>
  <div class="folded-text" :class="shown ? `folded-text--${tone}` : 'folded-text--empty'">
    <p class="folded-text__line">{{ shown }}</p>
    <a-collapse
      v-if="foldable"
      class="folded-text__fold"
      :bordered="false"
      :active-key="[]"
      size="small"
    >
      <a-collapse-panel key="raw" :header="rawLabel">
        <pre class="folded-text__raw">{{ rawText }}</pre>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>

<style scoped>
.folded-text__line {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;
  word-break: break-word;
}
.folded-text--error .folded-text__line {
  color: #cf1322;
}
.folded-text--empty .folded-text__line {
  color: #9ca3af;
}
.folded-text__fold {
  margin-top: 4px;
}
.folded-text__fold :deep(.ant-collapse-header) {
  padding: 4px 0 4px 20px !important;
  font-size: 12px;
  color: #6b7280;
}
.folded-text__fold :deep(.ant-collapse-content-box) {
  padding: 4px 0 8px 20px !important;
}
.folded-text__raw {
  margin: 0;
  padding: 8px 10px;
  background: #f6f7f9;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.55;
  color: #4b5563;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 320px;
  overflow: auto;
}
</style>
