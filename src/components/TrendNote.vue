<script setup lang="ts">
/**
 * 口径提示横幅（Spec-F §9.2-9）：固定话术集中在 copy/metrics.ts 的 TREND_NOTE，
 * 页面不再自写「本次是 API 口径」这类说明，也不许写得比常量更乐观。
 *
 * `text` 只有一个合法来源：接口跟着数据发回来的那一句（如报告的 `accessChannelNote`）。
 * 传它是为了让后端那句成为屏幕上的一句，而不是让页面借这个口子自己写解释。
 */
import { computed } from 'vue'
import { TREND_NOTE } from '../copy/metrics'

const props = defineProps<{ text?: string | null }>()

const shown = computed(() => props.text || TREND_NOTE)
</script>

<template>
  <div class="admin-trend-note">{{ shown }}</div>
</template>

<style scoped lang="less">
.admin-trend-note {
  margin-bottom: 16px;
  padding: 8px 16px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  color: #595959;
  font-size: 12px;
}
</style>
