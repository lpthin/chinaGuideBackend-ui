<script setup lang="ts">
/**
 * 口径提示横幅（Spec-F §9.2-9）：固定话术集中在 copy/metrics.ts 的 TREND_NOTE，
 * 页面不再自写「本次是 API 口径」这类说明，也不许写得比常量更乐观。
 */
import { TREND_NOTE } from '../copy/metrics'
</script>

<template>
  <div class="admin-trend-note">{{ TREND_NOTE }}</div>
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
