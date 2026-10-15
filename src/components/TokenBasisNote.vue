<script setup lang="ts">
/**
 * 「这一个 token 数是怎么量出来的」那一句（Spec-M §10.38 / M-P27-B）。
 *
 * `text` 只有一个合法来源：预估接口跟着数一起发回来的 `tokenBasis`
 * （后端 `ai/TokenYardstick` 一处写死）。页面不许自己写「约等于字数除以 4」这类解释——
 * 抄一份就有两处口径，界面上那句「实测是它的几倍」正是这么对不上的。
 *
 * 与不受理那句话分家：`estimate.notice` 非空 = 这一轮不会受理，界面据此染警告色、禁用主按钮；
 * 这一句永远说的只是「数怎么来的」，塞进 notice 就等于对客户宣布一次不存在的拒收。
 *
 * 空就不渲染：读不到接口时宁可少一句，也不要摆一个「—」让人以为数没算出来。
 */
const props = defineProps<{ text?: string | null }>()
</script>

<template>
  <p v-if="props.text" class="token-basis-note">{{ props.text }}</p>
</template>

<style scoped lang="less">
.token-basis-note {
  margin: 6px 0 0;
  color: #8c8c8c;
  font-size: 12px;
  line-height: 1.6;
}
</style>
