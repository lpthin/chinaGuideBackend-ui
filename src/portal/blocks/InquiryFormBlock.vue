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
          <label class="pb-inquiry__label" for="pb-inquiry-company">公司</label>
          <input id="pb-inquiry-company"
                 v-model="form.company"
                 class="pb-inquiry__input"
                 name="company"
                 type="text"
                 autocomplete="organization">
          <p v-if="errors.company" class="pb-inquiry__error">{{ errors.company }}</p>
        </div>

        <!-- 档位不在这里写死：那是我们筛线索用的枚举，唯一出处是后端 InquiryBudgets（I-1）。
             拉不到词表时下拉只剩占位，访客照样能把线索留下——这一格本来就是可跳过的 -->
        <div class="pb-inquiry__row">
          <label class="pb-inquiry__label" for="pb-inquiry-budget">预算范围</label>
          <select id="pb-inquiry-budget"
                  v-model="form.budget"
                  class="pb-inquiry__input"
                  name="budget">
            <option value="">{{ budgetOptions.length ? '请选择（可跳过）' : '档位暂时取不到，可在留言里说明' }}</option>
            <option v-for="option in budgetOptions" :key="option.code" :value="option.code">
              {{ option.label }}
            </option>
          </select>
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
        <p v-if="readOnlyNote" class="pb-inquiry__muted">{{ readOnlyNote }}</p>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { BlockContext } from './types'
import { isDemoContext, isPreviewContext, text } from './types'
import { fetchInquiryBudgets, submitInquiry } from '../api/portalPublic'

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
const COMPANY_MAX = 100
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
const demoView = computed(() => isDemoContext(props.shell))
/**
 * 候选站那条预览链接翻开的视图：这一整套站还没交付，收线索的那个人还没决定要不要它。
 * 只认后端壳层那一个事实（与 InquiryService 里那条闸同一份口径），
 * 不在这里拿「地址栏有没有 reviewToken」猜第二套——猜出来的那份和后端对不上时，
 * 界面就会当着客户的面谎报「这里收线索」。
 */
const previewView = computed(() => isPreviewContext(props.shell))
const readOnly = computed(() => demoView.value || previewView.value)

/** 不给点的两种原因是两回事，那句实话得分开说：一种是没有站点，一种是站点还没交付 */
const readOnlyNote = computed(() => {
  if (demoView.value) {
    return '演示视图（区块画廊、骨架预览与搭建器）：这里没有能收线索的站点，提交不会发出请求。'
  }
  if (previewView.value) {
    return '这一套方案还在预览阶段：提交不会发出请求，也不会进任何人的线索列表。'
      + '等这一套在平台上被选定、上线之后，这张表单才收访客留资。'
  }
  return ''
})

const form = reactive({ name: '', phone: '', email: '', company: '', budget: '', content: '', website: '' })
const errors = reactive<{ contact?: string; name?: string; company?: string; phone?: string; email?: string; content?: string }>({})
const sending = ref(false)
const failure = ref('')
const receipt = ref('')

/** 预算档位：码与中文都来自后端那份词表，顺序就是它给的顺序（小档在前，「还没定」在最后） */
const budgets = ref<Record<string, string>>({})
const budgetOptions = computed(() => Object.entries(budgets.value).map(([code, label]) => ({ code, label })))

onMounted(async () => {
  if (readOnly.value) {
    return
  }
  try {
    budgets.value = await fetchInquiryBudgets()
  } catch (error) {
    // 词表拉不到只少一个下拉，不该让整张表单不能提交：这一格后端本来就可空
    console.error('加载预算档位失败:', error)
  }
})

function validate() {
  const name = form.name.trim()
  const company = form.company.trim()
  const phone = form.phone.trim()
  const email = form.email.trim()
  const content = form.content.trim()
  errors.contact = !name && !phone && !email ? '姓名、电话、邮箱至少留一个' : undefined
  errors.name = name.length > NAME_MAX ? `姓名不超过 ${NAME_MAX} 个字` : undefined
  errors.company = company.length > COMPANY_MAX ? `公司名不超过 ${COMPANY_MAX} 个字` : undefined
  errors.phone = phone.length > PHONE_MAX
    ? `电话不超过 ${PHONE_MAX} 位`
    : (phone && !PHONE_PATTERN.test(phone) ? '电话只能含数字与 + - ( ) 空格，至少 5 位' : undefined)
  errors.email = email.length > EMAIL_MAX
    ? `邮箱不超过 ${EMAIL_MAX} 个字符`
    : (email && !EMAIL_PATTERN.test(email) ? '邮箱格式不对' : undefined)
  errors.content = !content
    ? '请填写留言内容'
    : (content.length > CONTENT_MAX ? `留言不超过 ${CONTENT_MAX} 个字` : undefined)
  return ![errors.contact, errors.name, errors.company, errors.phone, errors.email, errors.content].some(Boolean)
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
      company: form.company.trim(),
      budget: form.budget,
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
