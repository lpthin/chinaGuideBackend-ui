<script setup lang="ts">
/**
 * 向导第 ⑤ 步「平台与预算」：P1 只把形状摆在这里，能力排在 P2（§10-2 ⑤ + §6 两道闸）。
 * 这是整个向导里第一次真花钱的一步（选平台 = 定每轮外呼的对象），所以本期：
 * 面板写「下一期接入」并说明原因，主按钮「完成」禁用——界面上不许暗示任何诊断已被安排（§9.6）。
 */
</script>

<template>
  <div class="geobrand-wizard-platform">
    <h4 class="geobrand-wizard-platform__title">平台与预算：下一期接入</h4>
    <p class="geobrand-wizard-platform__reason">
      这一步要选检测平台并算出这一轮的花费预估——它是向导里第一次真花钱的动作，
      后端计划表与两道成本闸排在下一期，本期不接，接之前不放行。
    </p>
    <p class="geobrand-wizard-platform__notice">本页不会安排任何诊断：到这里为止保存的都只是档案与题池。</p>
    <a-button type="primary" disabled>完成</a-button>
  </div>
</template>

<style scoped lang="less">
.geobrand-wizard-platform {
  &__title {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  &__reason {
    margin: 0 0 8px;
    color: #595959;
    font-size: 13px;
  }

  &__notice {
    margin: 0 0 16px;
    color: #8c8c8c;
    font-size: 12px;
  }
}
</style>
