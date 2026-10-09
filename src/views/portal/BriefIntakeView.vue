<script setup lang="ts">
/**
 * 前采录入的独立路由页（`/portal/brief/new`、`/portal/brief/:id/edit`）。
 *
 * Spec-M P4 起录入本体只剩一份实现：`BriefIntakeForm.vue`（一屏一段的分步表单）。
 * 新建网站向导的第一步嵌的是同一份，这一页只把地址里的单号与租户号交给它 ——
 * 两条入口共用一个提交形状，不存在「向导里那套字段少两栏」的可能。
 * 因此带 `?tenantId=` 的老交棒链接（租户管理、站点清单）一个字都不必改。
 */
import BriefIntakeForm from './BriefIntakeForm.vue'
</script>

<template>
  <BriefIntakeForm />
</template>
