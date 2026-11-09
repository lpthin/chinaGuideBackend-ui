<script setup lang="ts">
/**
 * 路由级渲染兜底（SPEC-UI-9 H1-1）。
 *
 * 组件树里任何一块渲染抛错，Vue 会一路往上抛；没有 `onErrorCaptured` 时结果就是白屏，
 * 用户连「刷新试试」都没得点。这里包住 `<RouterView>`：捕获 → 阻止继续冒泡 → 摆一块
 * 与读失败同语义的错误块（`StateBlock`）+ 明确动作「刷新本页」。
 *
 * 换页后自动收回：上一页那一块的错误不该跟着新页面继续站着（`resetKey` 由 App 传 fullPath）。
 */
import { onErrorCaptured, ref, watch } from 'vue'
import StateBlock from './StateBlock.vue'
import { describeRenderError } from '../utils/errorText'
import { logError } from '../utils/errorLog'
import { rememberRawDetail } from '../utils/errorRaw'

const props = defineProps<{ resetKey?: string }>()

const failed = ref(false)
const detail = ref('')

onErrorCaptured((error) => {
  failed.value = true
  detail.value = describeRenderError(error)
  const rawText = error instanceof Error ? (error.stack || error.message) : String(error)
  rememberRawDetail(detail.value, rawText)
  logError('app/render-error', error)
  // 返回 false：这一块已经有人管了，别再冒泡到全局 errorHandler 重复留痕
  return false
})

watch(
  () => props.resetKey,
  () => {
    failed.value = false
    detail.value = ''
  }
)

function reloadPage(): void {
  window.location.reload()
}
</script>

<template>
  <div class="route-error-boundary">
    <slot v-if="!failed" />
    <div v-else class="route-error-boundary__fallback">
      <StateBlock
        state="error"
        title="这块没加载出来"
        :detail="detail"
        next="先点「刷新本页」；刷新后仍这样，把下面的诊断信息发给管理员。"
      />
      <a-button type="primary" class="route-error-boundary__refresh" @click="reloadPage">
        刷新本页
      </a-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.route-error-boundary {
  &__fallback {
    padding: var(--admin-space-5, 40px) var(--admin-space-3, 24px);
    text-align: center;
  }

  &__refresh {
    margin-top: var(--admin-space-2, 16px);
  }
}
</style>
