<template>
  <a-tag v-if="isDemo" color="orange" :title="hint">演示内容</a-tag>
</template>

<script setup lang="ts">
defineProps<{ isDemo?: boolean | null }>()

const hint = '演示内容包生成的内容：门户、sitemap 与访问统计都不会把它算成真实数据。'
</script>
