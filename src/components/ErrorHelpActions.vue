<script setup lang="ts">
/**
 * 权限 / 登录分流的求助动作（SPEC-UI-7 U2）。
 *
 * 403 一直念「请联系管理员」但没有任何入口，用户只能退出重进；
 * 401 的拦截器会自动跳登录页，但错误块里没有一句显式的话。
 * 这里补两件事：
 * - 403：有工单权限的人给「去「联系平台」提交工单」，所有人都有「复制诊断信息」；
 *   没有工单权限的人不摆一个点进去就 403 的按钮，只给可粘贴的诊断。
 * - 401：给「重新登录」，带上当前完整路径，登录后回到原页（LoginView 认 redirect）。
 */
import { computed, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { router } from '../router'
import { errorRawDetail } from '../utils/errorRaw'
import { buildDiagnosticText, errorKindOfText } from '../utils/errorText'
import { safeInternalPath } from '../utils/redirect'

const props = defineProps<{ text: string }>()

const kind = computed(() => errorKindOfText(props.text))

/** 工单入口按权限摆：路由守卫对超管放行，所以超管视为有 */
const canSubmitTicket = computed(() => {
  try {
    const auth = useAuthStore()
    return auth.isSuperAdmin || auth.hasPermission('portal:ticket:submit')
  } catch {
    // 没有会话（例如单测直接挂载错误块）：按「有入口」处理，真实会话里仍由 store 决定
    return true
  }
})

const copied = ref(false)
const copyFailed = ref(false)

async function copyDiagnostic(): Promise<void> {
  const text = buildDiagnosticText(props.text, errorRawDetail(props.text))
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    copyFailed.value = false
  } catch {
    copied.value = false
    copyFailed.value = true
  }
}

function goSupport(): void {
  void router.push('/workspace/portal/support')
}

function relogin(): void {
  const redirect = safeInternalPath(
    typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
    ''
  )
  void router.push({ path: '/login', query: redirect ? { redirect } : {} })
}
</script>

<template>
  <!-- 根节点用 span：EmptyListHint 把它摆在 <p> 里，div 会被浏览器拆坏 -->
  <span v-if="kind === 'forbidden' || kind === 'unauthorized'" class="error-help-actions">
    <template v-if="kind === 'forbidden'">
      <a-button
        v-if="canSubmitTicket"
        type="link"
        size="small"
        class="error-help-actions__ticket"
        @click="goSupport"
      >
        去「联系平台」提交工单
      </a-button>
      <a-button type="link" size="small" class="error-help-actions__copy" @click="copyDiagnostic">
        {{ copied ? '已复制诊断信息' : '复制诊断信息' }}
      </a-button>
      <span v-if="copyFailed" class="error-help-actions__fail">复制失败，请展开原文手动选择</span>
    </template>
    <a-button
      v-else
      type="link"
      size="small"
      class="error-help-actions__relogin"
      @click="relogin"
    >
      重新登录
    </a-button>
  </span>
</template>

<style scoped lang="less">
.error-help-actions {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;

  &__fail {
    font-size: 12px;
    color: var(--admin-text-secondary);
  }
}
</style>
