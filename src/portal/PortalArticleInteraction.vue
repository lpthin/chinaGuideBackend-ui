<template>
  <section class="portal-interaction">
    <h2 class="portal-interaction__title">读者评论</h2>

    <div class="portal-interaction__like-row">
      <button
        id="portal-like-button"
        class="portal-interaction__like"
        type="button"
        :disabled="liking || liked"
        @click="sendLike"
      >
        <span aria-hidden="true">赞</span>
        <span class="portal-interaction__count">{{ likeCount }}</span>
      </button>
      <span v-if="liked" class="portal-interaction__muted">你已经点过赞了</span>
      <span v-else-if="likeError" class="portal-interaction__error">{{ likeError }}</span>
    </div>

    <p v-if="loading" class="portal-interaction__muted">评论加载中…</p>
    <p v-else-if="loadError" class="portal-interaction__error">{{ loadError }}</p>
    <ul v-else-if="items.length" class="portal-interaction__list">
      <li v-for="item in items" :key="item.id" class="portal-interaction__item">
        <p class="portal-interaction__who">
          <span class="portal-interaction__name">{{ item.authorName || '匿名读者' }}</span>
          <span v-if="item.createdAt" class="portal-interaction__time">{{ formatDate(item.createdAt) }}</span>
        </p>
        <!-- 读者写的是纯文本：这里绝不 v-html，后端那四道闸里有一道就是不收带标签的内容 -->
        <p class="portal-interaction__text">{{ item.content }}</p>
      </li>
    </ul>
    <p v-else class="portal-interaction__muted">还没有评论，来说两句。</p>

    <p v-if="hasMore" class="portal-interaction__more">
      <button class="portal-interaction__link" type="button" :disabled="loadingMore" @click="loadMore">
        {{ loadingMore ? '加载中…' : `还有 ${total - items.length} 条，展开看` }}
      </button>
    </p>

    <form v-if="!receipt" class="portal-interaction__form" novalidate @submit.prevent="send">
      <!-- 蜜罐：访客看不到它，也绝不给它初值；机器人填了后端会演一次成功并把这条丢掉 -->
      <div class="portal-interaction__honeypot" aria-hidden="true">
        <label for="portal-comment-website">网站</label>
        <input id="portal-comment-website"
               v-model="form.website"
               name="website"
               type="text"
               tabindex="-1"
               autocomplete="off">
      </div>

      <div class="portal-interaction__row">
        <label class="portal-interaction__label" for="portal-comment-name">昵称</label>
        <input id="portal-comment-name"
               v-model="form.authorName"
               class="portal-interaction__input"
               name="authorName"
               type="text"
               maxlength="40"
               autocomplete="nickname">
        <p class="portal-interaction__muted">不填就显示「匿名读者」。</p>
      </div>

      <div class="portal-interaction__row">
        <label class="portal-interaction__label" for="portal-comment-content">评论<span class="portal-interaction__required">必填</span></label>
        <textarea id="portal-comment-content"
                  v-model="form.content"
                  class="portal-interaction__input portal-interaction__input--area"
                  name="content"
                  maxlength="1000"
                  rows="4"></textarea>
      </div>

      <p v-if="error" class="portal-interaction__error">{{ error }}</p>
      <button id="portal-comment-submit" class="portal-interaction__submit" type="submit" :disabled="sending">
        {{ sending ? '提交中…' : '提交评论' }}
      </button>
      <p class="portal-interaction__muted">评论内容会先经过检查，再决定要不要站主确认。</p>
    </form>

    <!-- 回执与表单互斥：提交成功就把表单收走，访客不会再点第二次 -->
    <p v-else id="portal-comment-receipt" class="portal-interaction__receipt">{{ receipt }}</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  fetchArticleComments,
  likeArticle,
  submitArticleComment,
  type PortalCommentItem
} from './api/portalPublic'
import { formatDate } from '../utils/format'

/**
 * 门户文章页底下的评论区与点赞（P9-C / G-08）。
 *
 * 两条与留资表单相反的规矩，写在这里免得后人「顺手统一」：
 * ① 这里的错误**必须原样念出来**。留资那个人并不等结果，而写评论的人正对着输入框——
 *    告诉他「已提交」再把话丢掉，等于教他以后每天来写一遍。所以后端的
 *    「评论至少写 2 个字」「操作过于频繁」这类真错一律照 message 显示，不换成一句「提交失败」。
 * ② 提交成功后**不把自己那条插进列表**。默认口径是先进人工待审，插进去就是当着访客的面
 *    谎报「已经发布了」；列表只信后端返回的那一份。
 *
 * 数字同理：点赞数以接口回的当前总数为准，绝不本地 +1，否则一个人连点五下页面就多了五个赞。
 */
const props = defineProps<{ idOrSlug: string | number }>()


const PAGE_SIZE = 10
const CONTENT_MIN = 2
const CONTENT_MAX = 1000

const items = ref<PortalCommentItem[]>([])
const total = ref(0)
const likeCount = ref(0)
const page = ref(1)
const loading = ref(true)
const loadingMore = ref(false)
const loadError = ref('')

const form = reactive({ authorName: '', content: '', website: '' })
const sending = ref(false)
const error = ref('')
const receipt = ref('')

const liking = ref(false)
const liked = ref(false)
const likeError = ref('')

const hasMore = ref(false)

async function load(targetPage: number) {
  try {
    const data = await fetchArticleComments(props.idOrSlug, targetPage, PAGE_SIZE)
    const batch = data?.items ?? []
    items.value = targetPage === 1 ? batch : items.value.concat(batch)
    total.value = data?.total ?? 0
    likeCount.value = data?.likeCount ?? 0
    page.value = targetPage
    hasMore.value = items.value.length < total.value
    loadError.value = ''
  } catch (e) {
    // 读失败就说读失败：摆一张空列表读起来像「这篇还没有人评论过」，那是谎报
    if (targetPage === 1) {
      items.value = []
      total.value = 0
      loadError.value = e instanceof Error && e.message ? e.message : '评论加载失败'
    } else {
      loadError.value = e instanceof Error && e.message ? e.message : '评论加载失败'
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadMore() {
  loadingMore.value = true
  await load(page.value + 1)
}

async function sendLike() {
  if (liking.value || liked.value) {
    return
  }
  liking.value = true
  likeError.value = ''
  try {
    const receiptValue = await likeArticle(props.idOrSlug)
    // 以接口回的总数为准；recorded=false 是同一个人重复点（按 IP 去重），也一样不再往上加
    likeCount.value = receiptValue?.likeCount ?? likeCount.value
    liked.value = true
  } catch (e) {
    likeError.value = e instanceof Error && e.message ? e.message : '点赞没成功，请稍后再试'
  } finally {
    liking.value = false
  }
}

async function send() {
  if (sending.value) {
    return
  }
  error.value = ''
  const content = form.content.trim()
  if (content.length < CONTENT_MIN) {
    error.value = `评论至少写 ${CONTENT_MIN} 个字`
    return
  }
  if (content.length > CONTENT_MAX) {
    error.value = `评论不超过 ${CONTENT_MAX} 个字`
    return
  }
  sending.value = true
  try {
    const result = await submitArticleComment(props.idOrSlug, {
      authorName: form.authorName.trim(),
      content,
      // 蜜罐恒空，除非机器人自己填了
      website: form.website
    })
    // 那句话的出处是后端（「已发布」/「站主审核后会显示」/预览阶段不收/命中蜜罐），这里一个字都不改
    receipt.value = result?.message || '已提交，感谢留言'
    form.content = ''
    await load(1)
  } catch (e) {
    error.value = e instanceof Error && e.message ? e.message : '提交失败，请稍后重试'
  } finally {
    sending.value = false
  }
}

onMounted(() => load(1))
</script>

<style scoped lang="less">
.portal-interaction {
  margin-top: 36px;
  padding-top: 24px;
  border-top: 1px solid #eef0f3;

  &__title {
    font-size: 18px;
    margin: 0 0 16px;
  }

  &__like-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  &__like {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border: 1px solid #d1d5db;
    border-radius: 999px;
    background: #fff;
    font: inherit;
    font-size: 14px;
    color: #374151;
    cursor: pointer;

    &[disabled] {
      cursor: default;
      opacity: .7;
    }
  }

  &__count {
    font-weight: 600;
    color: #2563eb;
  }

  &__list {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
  }

  &__item {
    padding: 14px 0;
    border-bottom: 1px solid #f1f2f4;
  }

  &__who {
    display: flex;
    gap: 10px;
    align-items: baseline;
    margin: 0 0 6px;
    font-size: 13px;
  }

  &__name {
    font-weight: 600;
    color: #1f2937;
  }

  &__time {
    color: #9ca3af;
  }

  &__text {
    margin: 0;
    font-size: 15px;
    line-height: 1.8;
    color: #374151;
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__form {
    margin-top: 20px;
  }

  &__row {
    margin-bottom: 16px;
  }

  &__label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
  }

  &__required {
    margin-left: 6px;
    color: #2563eb;
    font-size: 12px;
  }

  &__input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font: inherit;
    font-size: 15px;
    color: #1f2937;
    background: #fff;

    &--area {
      min-height: 96px;
      resize: vertical;
    }
  }

  &__submit {
    padding: 8px 20px;
    border: 0;
    border-radius: 6px;
    background: #2563eb;
    color: #fff;
    font: inherit;
    font-size: 14px;
    cursor: pointer;

    &[disabled] {
      opacity: .6;
      cursor: not-allowed;
    }
  }

  &__receipt {
    margin: 20px 0 0;
    padding: 16px 20px;
    border-left: 3px solid #2563eb;
    background: #f8fafc;
    border-radius: 0 6px 6px 0;
    font-size: 15px;
  }

  &__error {
    margin: 6px 0;
    font-size: 13px;
    color: #cf1322;
  }

  &__muted {
    margin: 6px 0;
    font-size: 13px;
    color: #9ca3af;
  }

  &__link {
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    font-size: 13px;
    color: #2563eb;
    cursor: pointer;
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
