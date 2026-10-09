<template>
  <div class="theme-token-form">
    <p v-if="!fields.length" class="theme-token-form__muted">{{ emptyHint }}</p>
    <div v-for="token in fields" :key="token.key" class="theme-token-form__row">
      <label>{{ designTokenLabel(token.key) }}</label>
      <a-input-number
        v-if="token.kind === 'SCALE'"
        size="small"
        :value="(model as Record<string, string | number>)[token.key] as number"
        :min="token.min"
        :max="token.max"
        step="0.05"
        @update:value="emit('update', token.key, $event)"
      />
      <!-- 字体只给下拉、不给输入框：theme_json 的值最终会变成 CSS 的 font-family，
           放开自由文本等于把「不许产出任意样式」从侧面撕开。选项就是后端 /tokens 回的那份枚举 -->
      <a-select
        v-else-if="token.kind === 'FONT'"
        size="small"
        :value="(model as Record<string, string | number>)[token.key] as string"
        placeholder="（未设）"
        allow-clear
        :options="token.options || []"
        @update:value="emit('update', token.key, $event)"
      />
      <a-input
        v-else
        size="small"
        :value="(model as Record<string, string | number>)[token.key] ?? ''"
        :placeholder="designTokenPlaceholder(token.key)"
        @update:value="emit('update', token.key, $event)"
      />
      <a-button size="small" type="text" @click="emit('clear', token.key)">清</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { designTokenLabel, designTokenPlaceholder } from '../../../portal/designTokens'
import type { ThemeTokenField } from '../../../api/themePresets'

/**
 * design token 的那一行输入框：搭建器（本页覆盖）与站级主题面板共用这一份渲法。
 *
 * <p>为什么要抽出来：白名单从服务端取（11 个旋钮里有颜色、长度、比例、字体四种渲法），
 * 两处各写一遍的话，后端加第 12 个键时必然有一处漏——漏的那处不是报错，是少一个输入框
 * （这仓库历史上就是这么漂出三套词表的）。清单、种类、区间、字体选项都来自 /tokens，这里只渲不判。</p>
 */
defineProps<{
  fields: ThemeTokenField[]
  model: Record<string, string | number>
  emptyHint?: string
}>()

const emit = defineEmits<{
  (e: 'update', key: string, value: string | number | null | undefined): void
  (e: 'clear', key: string): void
}>()
</script>

<style scoped lang="less">
.theme-token-form {
  &__row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;

    > label {
      width: 84px;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.65);
    }
  }

  &__muted {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.45);
  }
}
</style>
