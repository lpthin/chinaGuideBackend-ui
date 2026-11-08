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
  <p v-if="!loading" class="empty-line">
    <template v-if="notSent">{{ notSent }}</template>
    <template v-else-if="readFailed">
      这一发读失败：{{ readFailed }}（读失败不是「这一档没有」）
      <a-button v-if="retry" type="link" size="small" class="retry-on-failed" @click="onRetry">重试</a-button>
      <a-button v-if="rawDetail" type="link" size="small" @click="showRaw = !showRaw">
        {{ showRaw ? '收起原文' : '错误原文' }}
      </a-button>
      <template v-if="showRaw && rawDetail">
        <code class="raw-text">{{ rawDetail }}</code>
        <a-button type="link" size="small" @click="copyRaw">{{ copied ? '已复制' : '复制' }}</a-button>
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
import { computed, ref } from 'vue'
import { offersCreateOnEmpty, type EmptyReason } from '../utils/emptyPage'
import { errorRawDetail } from '../utils/errorRaw'

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

function onRetry() {
  props.retry?.()
}

/** 读失败时折叠出原始技术串（拍板 Q5-A）：人话在上，原文给工单用 */
const rawDetail = computed(() => errorRawDetail(props.readFailed))
const showRaw = ref(false)
const copied = ref(false)
async function copyRaw(): Promise<void> {
  if (!rawDetail.value) return
  try {
    await navigator.clipboard.writeText(rawDetail.value)
    copied.value = true
  } catch {
    copied.value = false
  }
}
</script>

<style scoped lang="less">
.empty-line {
  margin: 0;
  color: rgba(0, 0, 0, 0.45);
  text-align: center;
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
