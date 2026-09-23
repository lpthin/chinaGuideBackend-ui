<template>
  <div class="review-toolbar" :class="{ 'review-toolbar--picking': selecting }">
    <div class="review-toolbar__head">
      <span class="review-toolbar__badge">预览页</span>
      <span class="review-toolbar__label">{{ label || '这条链接用于改版确认' }}</span>
      <span class="review-toolbar__hint">看到不满意的地方，点「圈选区块」再点页面上那一块</span>
    </div>

    <div v-if="!selection" class="review-toolbar__body">
      <a-button size="small" :type="selecting ? 'default' : 'primary'" @click="togglePick">
        {{ selecting ? '取消圈选' : '圈选区块' }}
      </a-button>
      <p v-if="selecting" class="review-toolbar__tip">鼠标移到页面上点中要改的那一块</p>
    </div>

    <div v-else class="review-toolbar__form">
      <p class="review-toolbar__picked">
        已选中：第 {{ selection.index }} 个区块
        <span v-if="selection.blockKey" class="review-toolbar__key">{{ selection.blockKey }}</span>
        <a-button type="link" size="small" @click="clearSelection">重新选择</a-button>
      </p>
      <a-textarea
        v-model:value="draft"
        :rows="3"
        :maxlength="1000"
        show-count
        placeholder="用一句话说清这块要怎么改，例如：标题太长，改成「20 年经验的口腔种植团队」"
      />
      <div class="review-toolbar__actions">
        <a-select
          v-model:value="intent"
          size="small"
          style="width: 160px"
          placeholder="问题类型（可选）"
          allow-clear
          :options="intentOptions"
        />
        <a-button size="small" type="primary" :loading="submitting" @click="send">提交反馈</a-button>
      </div>
    </div>

    <!-- 成功提示必须放在表单外面：submit() 成功会把 selection 清空，表单这一块整个卸载，
         写在里面的话客户点完「提交反馈」什么也看不到，等于又一次假成功 -->
    <p v-if="feedback" class="review-toolbar__feedback" :class="`review-toolbar__feedback--${feedback.kind}`">
      {{ feedback.text }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useReviewMode } from '../useReviewMode'

/**
 * 预览页底部的批注工具条。只在带 ?reviewToken= 时由 PortalDynamicPage 异步加载，
 * 所以它不在访客首屏包里，访客正常浏览门户时这段代码根本不会下载。
 *
 * 文案纪律：提交成功只说「已收到」。后端对无效令牌也返回成功（避免给探测者区分信号），
 * 前端因此无法承诺「一定会改」，这里就不写「运营会尽快为您处理」那种凭空承诺。
 */
const { label, selection, selecting, submitting, feedback, intents, startSelecting, stopSelecting, clearSelection, submit } = useReviewMode()

const draft = ref('')
const intent = ref<string | undefined>(undefined)

const intentOptions = computed(() =>
  Object.entries(intents.value).map(([value, text]) => ({ value, label: text }))
)

function togglePick() {
  if (selecting.value) {
    stopSelecting()
    return
  }
  startSelecting()
}

async function send() {
  const text = draft.value
  const ok = await submit(text, intent.value || null)
  if (ok) {
    draft.value = ''
    intent.value = undefined
  }
}
</script>

<style scoped lang="less">
.review-toolbar {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 90;
  width: min(420px, calc(100vw - 32px));
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  color: rgba(0, 0, 0, 0.88);
  font-size: 13px;

  &--picking {
    border-color: #1677ff;
  }

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
  }

  &__badge {
    padding: 1px 8px;
    border-radius: 10px;
    background: #e6f4ff;
    color: #0958d9;
    font-weight: 600;
  }

  &__label {
    font-weight: 600;
  }

  &__hint {
    flex: 1 0 100%;
    margin: 0;
    color: rgba(0, 0, 0, 0.45);
  }

  &__tip {
    margin: 8px 0 0;
    color: #0958d9;
  }

  &__picked {
    margin: 0 0 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__key {
    padding: 0 6px;
    border-radius: 4px;
    background: #f5f5f5;
    color: rgba(0, 0, 0, 0.65);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  &__feedback {
    margin: 8px 0 0;

    &--ok {
      color: #389e0d;
    }

    &--error {
      color: #cf1322;
    }
  }
}
</style>
