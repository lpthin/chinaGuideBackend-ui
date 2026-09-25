<template>
  <section class="pb-section pb-inquiry">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <p v-if="body" class="pb-inquiry__text">{{ body }}</p>

      <!-- 回执与表单互斥：提交成功就把表单收走，访客不会再点第二次；
           后端对「真收了 / 被限流 / 命中蜜罐」回的是同一个形状，前端没有可分支的信息，一律按已收到显示 -->
      <p v-if="receipt" class="pb-inquiry__receipt">{{ receipt }}</p>
      <form v-else class="pb-inquiry__form" novalidate @submit.prevent="send">
        <!-- 蜜罐：访客看不到它，也绝不给它初值；机器人填了后端会当场演一次成功并丢掉这条记录（见 InquiryService） -->
        <div class="pb-inquiry__honeypot" aria-hidden="true">
          <label for="pb-inquiry-website">网站</label>
          <input id="pb-inquiry-website"
                 v-model="form.website"
                 name="website"
                 type="text"
                 tabindex="-1"
                 autocomplete="off">
        </div>

        <div class="pb-inquiry__row">
          <label class="pb-inquiry__label" for="pb-inquiry-name">姓名</label>
          <input id="pb-inquiry-name"
                 v-model="form.name"
                 class="pb-inquiry__input"
                 name="name"
                 type="text"
                 autocomplete="name">
          <p v-if="errors.name" class="pb-inquiry__error">{{ errors.name }}</p>
        </div>

        <div class="pb-inquiry__row">
          <label class="pb-inquiry__label" for="pb-inquiry-phone">电话</label>
          <input id="pb-inquiry-phone"
                 v-model="form.phone"
                 class="pb-inquiry__input"
                 name="phone"
                 type="tel"
                 autocomplete="tel">
          <p v-if="errors.phone" class="pb-inquiry__error">{{ errors.phone }}</p>
        </div>

        <div class="pb-inquiry__row">
          <label class="pb-inquiry__label" for="pb-inquiry-email">邮箱</label>
          <input id="pb-inquiry-email"
                 v-model="form.email"
                 class="pb-inquiry__input"
                 name="email"
                 type="email"
                 autocomplete="email">
          <p v-if="errors.email" class="pb-inquiry__error">{{ errors.email }}</p>
        </div>

        <div class="pb-inquiry__row">
          <label class="pb-inquiry__label" for="pb-inquiry-content">
            留言<span class="pb-inquiry__required">必填</span>
          </label>
          <textarea id="pb-inquiry-content"
                    v-model="form.content"
                    class="pb-inquiry__input pb-inquiry__input--area"
                    name="content"
                    rows="4"></textarea>
          <p v-if="errors.content" class="pb-inquiry__error">{{ errors.content }}</p>
        </div>

        <p v-if="errors.contact" class="pb-inquiry__error">{{ errors.contact }}</p>
        <p v-if="failure" class="pb-inquiry__error">{{ failure }}</p>

        <button class="pb-primary-btn pb-inquiry__submit" type="submit" :disabled="readOnly || sending">
          {{ submitText }}
        </button>
        <p v-if="readOnly" class="pb-inquiry__muted">演示/预览视图：这里没有能收线索的站点，提交不会发出请求。</p>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { BlockContext } from './types'
import { isDemoContext, text } from './types'
import { submitInquiry } from '../api/portalPublic'

/**
 * 留资表单（inquiry-form）。
 *
 * 只有文案槽：提交地址由服务端写死成公开端点 /api/portal/public/inquiry，
 * 区块能配一个 action 就等于允许把访客信息发到站外。
 * 长度上限与格式正则照抄后端 InquiryService.validate()——不是为了拦得住，
 * 而是让访客当场看到「哪一格不对」；后端不合规时是静默丢弃并回成功，前端没第二次机会提醒。
 */
const props = defineProps<BlockContext>()

const NAME_MAX = 50
const PHONE_MAX = 30
const EMAIL_MAX = 120
const CONTENT_MAX = 2000
const PHONE_PATTERN = /^[0-9+\-()\s]{5,30}$/
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@.]{2,20}$/

const heading = computed(() => text(props.blockProps, 'heading'))
const body = computed(() => text(props.blockProps, 'text'))
const submitText = computed(() => text(props.blockProps, 'submitText') || '提交')
const successText = computed(() => text(props.blockProps, 'successText') || '已收到，感谢留言')

/** 画廊与搭建器预览里没有可信站点：提交是写操作，宁可不给点 */
const readOnly = computed(() => isDemoContext(props.shell))

const form = reactive({ name: '', phone: '', email: '', content: '', website: '' })
const errors = reactive<{ contact?: string; name?: string; phone?: string; email?: string; content?: string }>({})
const sending = ref(false)
const failure = ref('')
const receipt = ref('')

function validate() {
  const name = form.name.trim()
  const phone = form.phone.trim()
  const email = form.email.trim()
  const content = form.content.trim()
  errors.contact = !name && !phone && !email ? '姓名、电话、邮箱至少留一个' : undefined
  errors.name = name.length > NAME_MAX ? `姓名不超过 ${NAME_MAX} 个字` : undefined
  errors.phone = phone.length > PHONE_MAX
    ? `电话不超过 ${PHONE_MAX} 位`
    : (phone && !PHONE_PATTERN.test(phone) ? '电话只能含数字与 + - ( ) 空格，至少 5 位' : undefined)
  errors.email = email.length > EMAIL_MAX
    ? `邮箱不超过 ${EMAIL_MAX} 个字符`
    : (email && !EMAIL_PATTERN.test(email) ? '邮箱格式不对' : undefined)
  errors.content = !content
    ? '请填写留言内容'
    : (content.length > CONTENT_MAX ? `留言不超过 ${CONTENT_MAX} 个字` : undefined)
  return ![errors.contact, errors.name, errors.phone, errors.email, errors.content].some(Boolean)
}

async function send() {
  if (readOnly.value || sending.value) {
    return
  }
  failure.value = ''
  if (!validate()) {
    return
  }
  sending.value = true
  try {
    // page 只作来源线索（后端有路径白名单）；website 恒为空，除非机器人自己填了
    await submitInquiry({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      content: form.content.trim(),
      website: form.website,
      page: typeof window === 'undefined' ? '' : window.location.pathname
    })
    receipt.value = successText.value
  } catch (error) {
    // 请求真的没到后端才说失败；「到了但被丢掉」前端无从得知，也不该得知
    failure.value = error instanceof Error && error.message ? error.message : '提交失败，请稍后重试'
  } finally {
    sending.value = false
  }
}
</script>

<style scoped lang="less">
.pb-inquiry {
  &__text {
    margin: 0 auto calc(28px * var(--portal-spacing-scale));
    max-width: 640px;
    font-size: calc(15px * var(--portal-font-scale));
    line-height: 1.8;
    color: var(--portal-color-muted);
    white-space: pre-wrap;
  }

  &__form {
    max-width: 640px;
    margin: 0 auto;
  }

  &__row {
    margin-bottom: calc(18px * var(--portal-spacing-scale));
  }

  &__label {
    display: block;
    margin-bottom: 6px;
    font-size: calc(14px * var(--portal-font-scale));
    color: var(--portal-color-text);
  }

  &__required {
    margin-left: 6px;
    color: var(--portal-color-primary);
    font-size: calc(12px * var(--portal-font-scale));
  }

  &__input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--portal-color-border);
    border-radius: calc(var(--portal-radius) - 4px);
    background: var(--portal-color-bg);
    color: var(--portal-color-text);
    font: inherit;
    font-size: calc(15px * var(--portal-font-scale));

    &--area {
      min-height: 120px;
      resize: vertical;
    }
  }

  &__error {
    margin: 6px 0 0;
    font-size: calc(13px * var(--portal-font-scale));
    color: #cf1322;
  }

  &__receipt {
    margin: 0 auto;
    max-width: 640px;
    padding: calc(24px * var(--portal-spacing-scale));
    border: 1px solid var(--portal-color-border);
    border-radius: var(--portal-radius);
    background: color-mix(in srgb, var(--portal-color-primary) 6%, transparent);
    font-size: calc(16px * var(--portal-font-scale));
    text-align: center;
  }

  &__muted {
    margin: 10px 0 0;
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }

  &__submit {
    margin-top: 6px;

    &[disabled] {
      opacity: .55;
      cursor: not-allowed;
    }
  }

  // 蜜罐要留在 HTML 里（机器人读的就是这份源码），只是访客看不见、Tab 也走不到它
  &__honeypot {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
}
</style>
