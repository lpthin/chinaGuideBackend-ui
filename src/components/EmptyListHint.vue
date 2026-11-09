<template>
  <!--
    这一格这一发没行时界面说的那一句（M-P50 拍板 ④ 起头，M-P53 按「只保人会看错的屏」收进一处）。

    分成五份话，各说各的：
    - 没发出去（notSent）：连请求都没发，谈不上有没有行。
    - 读失败：这一发根本没读回来，它和「没行」是两件事，混在一起就是谎报。
    - 后端答了成因：逐字念 `emptyLine`（唯一出处在后端 `EmptyResultReasons.sentence`），界面不改写、不合并。
    - 后端没答、但这一屏自己知道该说什么（`ownLine`）：念页面那一句。这一支是给**不分页、后端也不回
      `emptyReason` 那一个格子**的老读口留的（门店就是其一）——那里念通用兜底等于把
      「还没有录过门店」这种有用的话换成「后端没回是哪一种空」，是倒退不是统一。
      后端一旦回了成因，这一支自动让位，界面依旧不替它挑成因。
    - 后端没答、页面也没备这一句：用自己那一句兜底，不替它挑一种成因。

    「真的没有」那一档下面会多摆一颗新建的按钮（M-P53 拍板「没有时给个新建按钮」），
    但只有这一屏本来就有新建动作、且登录的人有权限时才摆——读不到（NOT_VISIBLE）与翻过头
    （OUT_OF_RANGE）都不摆，那两种空不是说「这一档还空着」。
  -->
  <p
    v-if="!loading"
    class="empty-line"
    :aria-live="readFailed ? 'polite' : undefined"
    :aria-atomic="readFailed ? 'true' : undefined"
  >
    <template v-if="notSent">{{ notSent }}</template>
    <template v-else-if="readFailed">
      这一发读失败：{{ readFailed }}（读失败不是「这一档没有」）
      <span v-if="readAdvice" class="empty-line__advice">{{ readAdvice.canDo }}{{ readAdvice.askHelp }}</span>
      <span v-if="failureStreak >= 2" class="empty-line__advice empty-line__repeat-hint">{{ REPEAT_FAILURE_HINT }}</span>
      <!-- 403 / 401 的求助动作（SPEC-UI-7 U2）：和表格错误块同一颗组件，话与入口只做一份 -->
      <ErrorHelpActions v-if="readFailed" :text="readFailed" />
      <a-button
        v-if="retry"
        type="link"
        size="small"
        class="retry-on-failed"
        :loading="loading || retrying"
        :disabled="retrying"
        @click="onRetry"
      >
        重试
      </a-button>
      <a-button
        v-if="rawDetail"
        type="link"
        size="small"
        :aria-label="showRaw ? '收起错误原文' : '展开错误原文（排查用，可复制给工单）'"
        @click="showRaw = !showRaw"
      >
        {{ showRaw ? '收起原文' : '错误原文' }}
      </a-button>
      <template v-if="showRaw && rawDetail">
        <code class="raw-text">{{ rawDetail }}</code>
      </template>
    </template>
    <template v-else-if="emptyLine">{{ emptyLine }}</template>
    <template v-else-if="ownLine">{{ ownLine }}</template>
    <template v-else>这一格这一发没有行（后端没回是哪一种空，界面不替它猜）。</template>
    <!-- 读失败与「没发出去」都不摆新建入口：那两种空不是在说「这一档还空着」，
         摆出来等于让人去补一份根本不缺的东西（M1 空态与失败态分离）。 -->
    <a-button
      v-if="!notSent && !readFailed && canCreate && offersCreateOnEmpty(emptyReason)"
      type="primary"
      class="create-on-empty"
      @click="emit('create')"
    >
      {{ createLabel }}
    </a-button>
  </p>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { offersCreateOnEmpty, type EmptyReason } from '../utils/emptyPage'
import { errorRawDetail } from '../utils/errorRaw'
import { errorAdviceOfText, REPEAT_FAILURE_HINT } from '../utils/errorText'
import { recordErrorExposure, recordRetryAttempt, recordRetryOutcome } from '../utils/errorMetrics'
import ErrorHelpActions from './ErrorHelpActions.vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    readFailed?: string
    emptyLine?: string
    emptyReason?: EmptyReason
    canCreate?: boolean
    createLabel?: string
    /** 这一发压根没出去（例如超管没选定客户）。它既不是读失败也不是「没行」，得单独说一句 */
    notSent?: string
    /** 后端没回成因时，这一屏自己那句具体的话（比通用兜底有用；后端一答就让位） */
    ownLine?: string
    /** 读失败时的「重试」按钮：传页面重新加载这张表的函数；不传就只念原因（页面有刷新按钮时可省） */
    retry?: () => unknown
  }>(),
  {
    loading: false,
    readFailed: '',
    emptyLine: '',
    emptyReason: null,
    canCreate: false,
    createLabel: '新建',
    notSent: '',
    ownLine: '',
    retry: undefined,
  }
)

const emit = defineEmits<{ create: [] }>()

/**
 * 重试体验（SPEC-UI-7 U3）：组件内先拦重复点击；
 * 每一发读口落败记一笔，第 2 次后不再劝「再点一下」，改为劝把诊断发给管理员。
 */
const retrying = ref(false)
const failureStreak = ref(0)
/** 这一发重试已经发出去，等 loading 回落配一次成败（SPEC-UI-8 G1） */
let retryPending = false

async function runRetry(): Promise<void> {
  if (retrying.value || !props.retry) return
  retrying.value = true
  retryPending = true
  recordRetryAttempt(props.readFailed, 'manual')
  try {
    await props.retry()
  } finally {
    retrying.value = false
  }
}

function onRetry(): void {
  void runRetry()
}

watch(
  () => props.loading,
  (loading, wasLoading) => {
    if (loading || !wasLoading) return
    failureStreak.value = props.readFailed ? failureStreak.value + 1 : 0
    // 读失败曝光与重试结果（SPEC-UI-8 G1）：这里没有行，错误 + 0 行这一形就是空态行本身
    if (props.readFailed) recordErrorExposure(props.readFailed, 'empty', true)
    if (retryPending) {
      recordRetryOutcome(!props.readFailed, 'manual')
      retryPending = false
    }
  }
)

/** 读失败时折叠出原始技术串（拍板 Q5-A）：人话在上，原文给工单用 */
const rawDetail = computed(() => errorRawDetail(props.readFailed))
/** 读失败的三层文案（SPEC-UI-7 U1）：「可以做什么 / 要不要找人」跟人话同源 */
const readAdvice = computed(() => errorAdviceOfText(props.readFailed))
const showRaw = ref(false)
</script>

<style scoped lang="less">
.empty-line {
  margin: 0;
  color: rgba(0, 0, 0, 0.45);
  text-align: center;

  /* 错误态里的按钮都在原生 focus 顺序里，补一圈可见焦点环，键盘用户才看得见走到哪了 */
  button:focus-visible {
    outline: 2px solid var(--admin-primary, #1677ff);
    outline-offset: 2px;
  }

  &__advice {
    display: block;
    margin-top: 4px;
    font-size: 12px;
  }
}

.create-on-empty {
  display: block;
  margin: 12px auto 0;
}

.raw-text {
  display: inline-block;
  max-width: 100%;
  margin: 6px 0 0;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.03);
  font-size: 12px;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
