<script setup lang="ts">
/**
 * 追踪题录入行（向导 ③④ 步与档案页题池共用）。
 * 判据与后端一致（geoBrandWizard.questionViolation）：题面一违反就出红字警告，
 * 「加入问题池」按钮同时禁用——红星不校验这种旧病在这里拦住（§9.2-6）。
 */
import { computed } from 'vue'
import { questionViolation } from './geoBrandWizard'
import type { GeoQuestionKind } from '../../api/geoBrand'

const props = defineProps<{
  kind: GeoQuestionKind
  /** 品牌名 + 品牌词：判据的令牌表 */
  tokens: string[]
  coreWord: string
  questionText: string
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:coreWord', value: string): void
  (e: 'update:questionText', value: string): void
  (e: 'submit'): void
}>()

const violation = computed(() => questionViolation(props.kind, props.questionText, props.tokens))
const canSubmit = computed(() => !violation.value && props.questionText.trim().length > 0 && !props.saving)
</script>

<template>
  <div class="geobrand-question-draft">
    <div class="geobrand-question-draft__fields">
      <a-input
        class="geobrand-question-draft__core"
        :value="coreWord"
        placeholder="核心词"
        @update:value="(v: string) => emit('update:coreWord', v)"
      />
      <a-textarea
        class="geobrand-question-draft__text"
        :value="questionText"
        :rows="2"
        :placeholder="kind === 'MENTION' ? '问一个不带品牌名的行业问题' : '问一个关于我们的口碑问题'"
        @update:value="(v: string) => emit('update:questionText', v)"
      />
      <a-button type="primary" :disabled="!canSubmit" @click="emit('submit')">加入问题池</a-button>
    </div>
    <div v-if="violation" class="geobrand-question-warning">{{ violation }}</div>
  </div>
</template>

<style scoped lang="less">
.geobrand-question-draft {
  margin-bottom: 16px;

  &__fields {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  &__core {
    width: 200px;
    flex-shrink: 0;
  }

  &__text {
    flex: 1;
  }
}

.geobrand-question-warning {
  margin-top: 8px;
  color: #ff4d4f;
  font-size: 12px;
}
</style>
