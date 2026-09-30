<script setup lang="ts">
/**
 * 诊断报告的只读外链页（Spec-G G6，访客侧）。
 *
 * 形状与 `/brief/:token` 同一条路：令牌就在地址里，`meta.requiresAuth === false`，
 * 挂在路由表最外层——管理端菜单是从 `/workspace` 的 children 单源生成的，
 * 所以这一页结构上进不了后台导航，不需要另写一份「隐藏路由」。
 *
 * 三条口径：
 *
 * 1. <b>报告本体复用同一块视图</b>（`GeoCampaignReportView`，传 `token` 不传 `runId`）。
 *    另写一份「给客户看的报告」就是第二个真相：以后加一个率、改一句口径，客户那一屏必然落后。
 * 2. <b>这一页没有轮次号这个输入</b>：读的是哪一轮由令牌自己说（后端 URL 上也没有那个位置）。
 *    顶栏那句「轮次 N」来自 `/context`，它是<em>自证</em>——应当与报告头部念的那一轮一致。
 * 3. <b>失效就是后端那一句，不拆成两种说法</b>：无效、过期、已撤销、被人手改过作用域，
 *    后端一律回「链接无效或已过期」；界面原样念，绝不替它区分「这条链接存在但过期了」——
 *    一分就把这一页变成有效令牌探测器。
 *
 * 到期时刻与报告各读各的：`/context` 失败不影响报告本体，反之也一样。所以顶部那一栏读不出时
 * 只是不显示，不会把整页变成错误态；而报告读不到时，页面下方仍是后端那一句。
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import GeoCampaignReportView from './GeoCampaignReportView.vue'
import { geoPublicApi, type GeoReportLinkContext } from '../../api/geoReportAccess'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { formatDateTimeWithZone } from '../../utils/format'

const route = useRoute()

const context = ref<GeoReportLinkContext | null>(null)
const contextError = ref<string | null>(null)

const token = computed(() => {
  const fromPath = route.params.token
  if (typeof fromPath === 'string' && fromPath.trim()) return fromPath.trim()
  const query = route.query as Record<string, unknown>
  // 手抄链接的落点：有人把令牌贴在查询串上时不该白看一次「地址里没有凭证」
  const value = query.token
  return typeof value === 'string' ? value.trim() : ''
})

async function loadContext() {
  if (!token.value) return
  try {
    context.value = await geoPublicApi(token.value).context()
  } catch (e) {
    // 原样递过去：这一栏读不出只是少一句提示，报告本体自己会给出它那一问的结果
    contextError.value = describeHttpError(e)
    logError('geocampaign/只读链接顶栏', e)
  }
}

onMounted(loadContext)
</script>

<template>
  <div class="geo-public" data-testid="public-report-page">
    <header class="geo-public__bar">
      <div class="geo-public__brand">
        <span class="geo-public__title">GEO 诊断报告 · 只读</span>
        <span v-if="context" class="geo-public__run">轮次 {{ context.runId }}</span>
        <span v-if="context?.expiresAt" class="geo-public__until">
          本链接到 {{ formatDateTimeWithZone(context.expiresAt) }} 失效
        </span>
      </div>
      <p class="geo-public__note">
        这一页是只读的：上面的每一个数都能点开那条回答的原文，但改不了这一轮的账——
        判定、按勾选重算、一键成内容都要在自己后台登录后才点得动。
      </p>
      <p v-if="contextError" class="geo-public__error">{{ contextError }}</p>
    </header>

    <!-- 不传 runId：这一轮是令牌说的，地址栏里那个数字换不出别人的报告 -->
    <GeoCampaignReportView v-if="token" :token="token" />
    <div v-else class="geo-public__empty">
      <h2 class="geo-public__empty-title">链接里没有凭证</h2>
      <p class="geo-public__empty-text">
        只读链接的地址形如 <code>/geo-report/&lt;64 位令牌&gt;</code>，请从别人发给你的那条完整地址打开。
      </p>
    </div>
  </div>
</template>

<style scoped lang="less">
.geo-public {
  max-width: 1180px;
  margin: 0 auto;
  padding: 16px 20px 40px;

  &__bar {
    padding: 12px 16px;
    margin-bottom: 12px;
    border: 1px solid var(--admin-border, #e5e7eb);
    border-radius: 8px;
    background: var(--admin-bg-soft, #fafafa);
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
  }

  &__run,
  &__until {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.55);
  }

  &__note {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: rgba(0, 0, 0, 0.65);
  }

  &__error {
    margin: 6px 0 0;
    font-size: 12px;
    color: #cf1322;
  }

  &__empty {
    padding: 32px 16px;
    text-align: center;

    &-title {
      margin: 0 0 8px;
      font-size: 16px;
    }

    &-text {
      margin: 0;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.55);
    }
  }
}
</style>
