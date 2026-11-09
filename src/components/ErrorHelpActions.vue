<script setup lang="ts">
/**
 * 权限 / 登录分流的求助动作（SPEC-UI-7 U2）。
 *
 * 403 一直念「请联系管理员」但没有任何入口，用户只能退出重进；
 * 401 的拦截器会自动跳登录页，但错误块里没有一句显式的话。
 * 这里补三件事：
 * - 403：有工单权限的人给「去「联系平台」提交工单」，所有人都有「复制诊断信息」；
 *   没有工单权限的人不摆一个点进去就 403 的按钮，只给可粘贴的诊断。
 * - 401：给「重新登录」，带上当前完整路径，登录后回到原页（LoginView 认 redirect）。
 * - 诊断动作（SPEC-UI-9 H3）：403 / 网络断 / 超时 / 服务异常都并排给「复制诊断信息」
 *   与「导出诊断包」——表格错误块、空态读失败、旧数据提示三种形态共用这一个组件。
 */
import { computed, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import type { RouteLocationRaw } from 'vue-router'
import { errorRawDetail } from '../utils/errorRaw'
import { buildDiagnosticText, errorKindOfText } from '../utils/errorText'
import { downloadDiagnosticPackage, sanitizeRawText } from '../utils/diagnostic'
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

/** 有原文就值得给诊断动作，哪怕这句话认不出类别（业务提示通常没有原文） */
const hasRawDetail = computed(() => !!errorRawDetail(props.text))

async function copyDiagnostic(): Promise<void> {
  const raw = errorRawDetail(props.text)
  // 单条复制与整包同源（SPEC-UI-9 H3）：敏感键同样替换、超长同样截断
  const text = buildDiagnosticText(props.text, raw ? sanitizeRawText(raw) : raw)
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    copyFailed.value = false
  } catch {
    copied.value = false
    copyFailed.value = true
  }
}

/**
 * 跳转时才取路由单例（SPEC-UI-9 补丁）：错误块会出现在几乎每一屏和大量单测里，
 * 顶层 import '../router' 会连带加载整张路由表与守卫，把只钉一块错误面的用例一起拖下水。
 */
function navigateTo(target: RouteLocationRaw): void {
  void import('../router').then(({ router }) => router.push(target))
}

function goSupport(): void {
  navigateTo('/workspace/portal/support')
}

/** 整包导出（SPEC-UI-9 H3）：一次故障可能牵动多页，单条复制不够时给整包 */
function exportDiagnostic(): void {
  downloadDiagnosticPackage()
}

function relogin(): void {
  const redirect = safeInternalPath(
    typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
    ''
  )
  navigateTo({ path: '/login', query: redirect ? { redirect } : {} })
}
</script>

<template>
  <!-- 根节点用 span：EmptyListHint 把它摆在 <p> 里，div 会被浏览器拆坏 -->
  <span v-if="kind || hasRawDetail" class="error-help-actions">
    <a-button
      v-if="kind && kind !== 'unauthorized' && canSubmitTicket"
      type="link"
      size="small"
      class="error-help-actions__ticket"
      @click="goSupport"
    >
      去「联系平台」提交工单
    </a-button>
    <a-button
      v-if="kind === 'unauthorized'"
      type="link"
      size="small"
      class="error-help-actions__relogin"
      @click="relogin"
    >
      重新登录
    </a-button>
    <template v-if="kind !== 'unauthorized'">
      <a-button type="link" size="small" class="error-help-actions__copy" @click="copyDiagnostic">
        {{ copied ? '已复制诊断信息' : '复制诊断信息' }}
      </a-button>
      <a-button type="link" size="small" class="error-help-actions__download" @click="exportDiagnostic">
        导出诊断包
      </a-button>
      <span v-if="copyFailed" class="error-help-actions__fail">复制失败，请展开原文手动选择</span>
    </template>
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
