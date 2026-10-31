<template>
  <!--
    这一格这一发没行时界面说的那一句（M-P50 拍板 ④ 起头，M-P53 按「只保人会看错的屏」收进一处）。

    分成四份话，各说各的：
    - 没发出去（notSent）：连请求都没发，谈不上有没有行。
    - 读失败：这一发根本没读回来，它和「没行」是两件事，混在一起就是谎报。
    - 后端答了成因：逐字念 `emptyLine`（唯一出处在后端 `EmptyResultReasons.sentence`），界面不改写、不合并。
    - 后端没答（那一格是 null）：用自己这一句兜底，不替它挑一种成因。

    「真的没有」那一档下面会多摆一颗新建的按钮（M-P53 拍板「没有时给个新建按钮」），
    但只有这一屏本来就有新建动作、且登录的人有权限时才摆——读不到（NOT_VISIBLE）与翻过头
    （OUT_OF_RANGE）都不摆，那两种空不是说「这一档还空着」。
  -->
  <p v-if="!loading" class="empty-line">
    <template v-if="notSent">{{ notSent }}</template>
    <template v-else-if="readFailed">这一发读失败：{{ readFailed }}（读失败不是「这一档没有」）</template>
    <template v-else-if="emptyLine">{{ emptyLine }}</template>
    <template v-else>这一格这一发没有行（后端没回是哪一种空，界面不替它猜）。</template>
    <a-button
      v-if="canCreate && offersCreateOnEmpty(emptyReason)"
      type="primary"
      class="create-on-empty"
      @click="emit('create')"
    >
      {{ createLabel }}
    </a-button>
  </p>
</template>

<script setup lang="ts">
import { offersCreateOnEmpty, type EmptyReason } from '../utils/emptyPage'

withDefaults(
  defineProps<{
    loading?: boolean
    readFailed?: string
    emptyLine?: string
    emptyReason?: EmptyReason
    canCreate?: boolean
    createLabel?: string
    /** 这一发压根没出去（例如超管没选定客户）。它既不是读失败也不是「没行」，得单独说一句 */
    notSent?: string
  }>(),
  {
    loading: false,
    readFailed: '',
    emptyLine: '',
    emptyReason: null,
    canCreate: false,
    createLabel: '新建',
    notSent: '',
  }
)

const emit = defineEmits<{ create: [] }>()
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
</style>
