<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  clientBriefApi,
  clientCandidatesDifference,
  resolvePreviewUrl,
  type ClientBriefCandidate,
  type ClientBriefView
} from '@/api/siteBriefDelivery'

/**
 * 客户选择页（Spec-C §7 新增页 ClientDecisionView、§5 的两行公开端点、§8 P4）。
 *
 * 三条硬口径，都写在这段注释里并被用例逐条钉住：
 * 1. **拍板 10「打开链接即可看，零身份表单」**：这一页不索取姓名、邮箱、手机号、公司名——
 *    令牌本身就是准入凭证（`ClientBriefView` 的类注释原话）。所以整页只有两个可填的东西：
 *    「选了哪一套」和「一句要改什么」。第三根 `website` 是蜜罐，藏在看不见的地方且永不初值。
 * 2. **失败不许演成成功，作废与加载失败是两句话**（拍板 3A + §9-7）：
 *    - 后端拿到无效/过期/已撤销/已转正的令牌时回的是 200 + 空 candidates（静默失败是刻意的），
 *      页面据此说「这条链接现在打不开方案」；
 *    - 请求本身没走通（网络不通、5xx）→ 明说「这不是链接作废」并给重试；
 *    - 真的拿回 404 → 后端原样那句挂出来，并说明 404 在这一条链路上的含义就是链接不再生效。
 *    三种形状各自一句文案，谁都不许冒充谁。
 * 3. **提交一次之后锁死**：`decide` 对所有情况都回同一个成功，前端没有可分支的信息，
 *    所以成功分支只写「这一页不再接受第二次答复」（本地锁）+「等平台转正」，
 *    绝不写「平台已收到」。正式地址来自交付回执的 `maintenanceUrl`，不在这份响应里，
 *    于是这一页只写这一句文案，不摆任何「查看正式地址」的按钮（§3.2 骂的就是那种假入口）。
 *
 * 页面形态：一屏并排列 N 套（每套各用自己的预览令牌在新标签打开）、一句「三套差在哪」、
 * 选定 + 一句意见、提交一次。没有侧边栏、没有租户/超管那套外壳——它挂在路由表最外层，
 * 菜单是从 `/workspace` 的 children 单源生成的，所以结构上进不了管理端导航（见路由那份用例）。
 */

const route = useRoute()

/** 与后端 ClientDecisionService.NOTE_MAX 同档：真正的闸在服务端（超长整条丢弃），这里只是不让人白写一遍 */
const NOTE_MAX = 2000

type PageState = 'no-token' | 'loading' | 'failed' | 'unavailable' | 'ready'

const state = ref<PageState>('loading')
const loadError = ref('')
const view = ref<ClientBriefView | null>(null)

const token = computed(() => {
  const fromPath = route.params.token
  if (typeof fromPath === 'string' && fromPath.trim()) return fromPath.trim()
  const query = route.query as Record<string, unknown>
  // 手抄链接的两种落点：预览地址带的是 reviewToken（SiteVisibilityGuard.PREVIEW_TOKEN_PARAM），
  // 有人把它直接贴到选择页地址上时不该白看一次「链接里没有凭证」
  for (const key of ['reviewToken', 'token']) {
    const value = query[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
})

function errText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error)
}

/**
 * 「这条链接不再生效」还是「这一发请求没走通」——两者的处置完全不同（一个重发链接、一个刷新页面），
 * 所以文案必须分开。判据只用错误原文里的事实（后端 404 的说法是「不存在/已被删除」），不做二次加工。
 */
const linkRevoked = computed(() => /404|不存在|已被删除|过期|失效/.test(loadError.value))

async function load() {
  if (!token.value) {
    view.value = null
    loadError.value = ''
    state.value = 'no-token'
    return
  }
  state.value = 'loading'
  loadError.value = ''
  try {
    const data = await clientBriefApi.fetch(token.value)
    view.value = data ?? null
    // 空 candidates 就是后端那份「与真数据同构、只是没有内容」的静默失败形状：
    // 它涵盖令牌无效/已撤销/已转正/重跑后作废/被限流——对这几种情况，这条链接现在确实打不开方案
    const count = data?.candidates?.length ?? 0
    state.value = count > 0 ? 'ready' : 'unavailable'
  } catch (error) {
    view.value = null
    loadError.value = errText(error)
    state.value = 'failed'
  }
}

onMounted(load)

const candidates = computed<ClientBriefCandidate[]>(() => view.value?.candidates ?? [])

const headerTitle = computed(() => {
  const data = view.value
  if (!data) return '建站方案'
  if (data.title) return data.title
  return data.briefId ? `建站方案 · 需求单 #${data.briefId}` : '建站方案'
})

const difference = computed(() => clientCandidatesDifference(candidates.value))

/** 预览地址：绝对的原样用，相对的按当前 origin 拼（后端注释把这一步明确交给前端） */
function previewHref(candidate: ClientBriefCandidate): string {
  return resolvePreviewUrl(candidate.previewUrl)
}

function candidateLabel(candidate: ClientBriefCandidate, index: number): string {
  const no = candidate.candidateNo ?? index + 1
  const name = (candidate.name || '').trim()
  return name ? `第 ${no} 套 · ${name}` : `第 ${no} 套`
}

/** 这一份响应里有没有「这套侧重什么」的原话（拍板 5A 要的那句）；没有就照实说没有 */
const hasDifferentiationCopy = computed(() =>
  candidates.value.some(candidate => !!(candidate.differentiation || '').trim())
)

// ------------------------------------------------------------------
// 提交：选哪套 + 一句要改什么，一次
// ------------------------------------------------------------------

/** 选中的 siteId；0 = 「先不选，只写意见」（后端明列的合法形状：chosen_site_id 为空） */
const chosenSiteId = ref<number>(0)
const clientNote = ref('')
/** 蜜罐：不初值、访客看不见；机器人填了它，后端会演一次成功并丢掉这条答复（口径同留资） */
const honeypot = ref('')

const submitting = ref(false)
const submitError = ref('')
/** 本地锁：这一页只交一次。它不代表「平台已收到」——那件事前端无从知道 */
const submitted = ref(false)

const noteTooLong = computed(() => clientNote.value.trim().length > NOTE_MAX)
const nothingToSend = computed(
  () => chosenSiteId.value === 0 && !clientNote.value.trim()
)

/** 已经交过一次答复的两种证据：本地刚交过，或这份响应里的需求单状态已是「客户已答复」 */
const alreadyDecided = computed(() => view.value?.briefStatus === 'decided')
const formLocked = computed(() => submitted.value || alreadyDecided.value)

const canSubmit = computed(
  () => state.value === 'ready' && !formLocked.value && !submitting.value && !nothingToSend.value && !noteTooLong.value
)

async function submit() {
  if (!token.value || formLocked.value) return
  if (nothingToSend.value) {
    submitError.value = '两格都空着的那一发，后端会当成误触直接丢掉，所以这里不会替你发出去：'
      + '要么选一套，要么写一句要改什么。'
    return
  }
  if (noteTooLong.value) {
    submitError.value = `这句意见超过 ${NOTE_MAX} 字：后端对超长的答复整条丢弃（截半句的引语比空白更危险），请先删短。`
    return
  }
  submitting.value = true
  submitError.value = ''
  try {
    await clientBriefApi.decide(token.value, {
      chosenSiteId: chosenSiteId.value === 0 ? null : chosenSiteId.value,
      clientNote: clientNote.value.trim() ? clientNote.value.trim() : null,
      website: honeypot.value || undefined
    })
    submitted.value = true
  } catch (error) {
    // 这一发真的没走通（网络/服务）：不锁死、不演成功，错误原文挂着并允许再试
    submitError.value = `这一句没发出去：${errText(error)}`
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="client-decision">
    <header class="client-decision__head">
      <h1>{{ headerTitle }}</h1>
      <p class="client-decision__sub">这几套是照着你提的需求做出来的站点，点开任意一套都能直接看整站；
        看中哪一套就在下面选一选，再写一句要改什么。</p>
    </header>

    <!-- 地址里根本没有令牌：不是链接作废，是这条地址抄错了 -->
    <section v-if="state === 'no-token'" class="client-decision__panel">
      <h2>这条地址里没有凭证</h2>
      <p>方案链接是「地址本身就带钥匙」的：请回平台发给你的那条完整链接里点进来。
        这一页不问姓名、邮箱、手机号——拿到链接的人就是你，凭证抄错了才会打不开。</p>
    </section>

    <section v-else-if="state === 'loading'" class="client-decision__panel">
      <p>正在读这一单的方案……</p>
    </section>

    <!-- 请求没走通 vs. 后端回了 404：两种实话两句说法，谁都不演谁 -->
    <section v-else-if="state === 'failed'" class="client-decision__panel">
      <h2>{{ linkRevoked ? '这条链接已经不再生效' : '方案没读出来：这一发请求没走通' }}</h2>
      <p class="client-decision__quote">后端原话：{{ loadError }}</p>
      <p v-if="linkRevoked">改过需求重跑、或已经选定并交付之后，旧的那几条链接会被作废（这是刻意的：
        作废的方案不能再被点开）。要新的链接请找平台对接人。</p>
      <template v-else>
        <p>这不是链接作废：服务或网络通了就能再看。先重试一次，还是不行再找平台。</p>
        <button type="button" class="client-decision__button" @click="load">重新读取</button>
      </template>
    </section>

    <!-- 后端对「令牌无效/已撤销/已转正/重跑后作废/被限流」回的是同一个空清单：
         对这几种情况这句话都成立，所以它不是假话，也不比别人多知道一点 -->
    <section v-else-if="state === 'unavailable'" class="client-decision__panel">
      <h2>这条链接现在打不开方案</h2>
      <p>链接无效、已过期（预览链接 14 天有效）、或这一单已经收口——旧链接作废之后就是这个样子。
        要重看请找平台对接人要一条新链接。</p>
      <p class="client-decision__muted">这一页不显示任何「看起来像成功」的东西：没有候选、也没有提交入口。</p>
    </section>

    <template v-else>
      <!-- §9-4 / §6.7 那两句原话来自响应体（后端把它们当法务口径，不是 UI 装饰），一个字不改 -->
      <p v-if="view?.demoNotice" class="client-decision__notice">{{ view.demoNotice }}</p>
      <p v-else class="client-decision__muted">这一份响应里没有带演示内容说明：那句话在后端，这里不替它编一句。</p>
      <p v-if="view?.previewNotice" class="client-decision__notice">{{ view.previewNotice }}</p>

      <p class="client-decision__diff" :class="{ 'client-decision__diff--weak': !difference.visible }">
        {{ difference.text }}
      </p>
      <p v-if="!hasDifferentiationCopy" class="client-decision__muted">
        上面这一句只用了这条链接真带回来的字段（骨架名与预览地址）；「这套侧重什么」的原话由出方案那一步落库，
        还没随这条链接下发时，这里宁可空着也不替它写一句。
      </p>

      <section class="client-decision__grid">
        <article
          v-for="(candidate, index) in candidates"
          :key="`${candidate.siteId}-${index}`"
          class="client-decision__card"
        >
          <h2>{{ candidateLabel(candidate, index) }}</h2>
          <p class="client-decision__line"><b>这一套是什么骨架：</b>{{ (candidate.skeletonKey || '').trim() || '这条链接没带骨架名' }}</p>
          <p v-if="(candidate.differentiation || '').trim()" class="client-decision__line">
            <b>这套侧重什么：</b>{{ candidate.differentiation }}
          </p>
          <p v-if="previewHref(candidate)" class="client-decision__line">
            <!-- 每套各用自己的预览令牌：令牌绑站不绑页，点进去就是完整的一套站（含演示内容） -->
            <a :href="previewHref(candidate)" target="_blank" rel="noopener noreferrer">在新标签打开这一套</a>
          </p>
          <p v-else class="client-decision__muted">这一套的预览地址没在这份响应里：不摆一条打不开的链接。</p>
          <label class="client-decision__pick">
            <input v-model="chosenSiteId" type="radio" name="chosen-site" :value="candidate.siteId" :disabled="formLocked">
            就这套
          </label>
        </article>
      </section>

      <section class="client-decision__panel">
        <h2>最后一步：选一选，再写一句要改什么</h2>
        <p class="client-decision__muted">这里不问姓名、电话、邮箱——你手里这条链接本身就是凭证。</p>

        <label class="client-decision__pick client-decision__pick--note">
          <input v-model="chosenSiteId" type="radio" name="chosen-site" :value="0" :disabled="formLocked">
          先不选，只写意见
        </label>

        <p class="client-decision__label">要改什么（可空，一句就够；最多 {{ NOTE_MAX }} 字）</p>
        <!-- 这里刻意不给 maxlength：超长的答复在后端是「整条丢掉」而不是截半句，
             悄悄截断等于替客户改口供；让它看得见自己超了多少字（闸仍在服务端） -->
        <textarea
          v-model="clientNote"
          class="client-decision__textarea"
          rows="4"
          :disabled="formLocked"
          placeholder="例如：第二套的语气太硬，案例想放到首页第一屏"
        />
        <p v-if="noteTooLong" class="client-decision__error">这句意见超过了 {{ NOTE_MAX }} 字：后端会把整条答复丢掉，请先删短。</p>

        <!-- 蜜罐：留在源码里给机器人读，访客看不见、Tab 走不到，也永远没有初值 -->
        <div class="client-decision__honeypot" aria-hidden="true">
          <label for="cd-website">网站</label>
          <input id="cd-website" v-model="honeypot" name="website" type="text" tabindex="-1" autocomplete="off">
        </div>

        <button
          type="button"
          class="client-decision__button client-decision__button--primary"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ submitting ? '正在提交……' : '提交这一次答复' }}
        </button>

        <p v-if="nothingToSend && !submitted" class="client-decision__muted">
          还没选、也没写意见：这样的答复后端会当误触丢掉，所以按钮是灭的。
        </p>
        <p v-if="submitError" class="client-decision__error">{{ submitError }}</p>

        <!-- 交付后的三件事，只按响应/回执真说过的写 -->
        <div v-if="formLocked" class="client-decision__receipt">
          <h3>{{ submitted ? '已经提交过了：这一页不再接受第二次答复' : '这条链接上已经交过一次答复' }}</h3>
          <p v-if="submitted" class="client-decision__muted">
            这一句说的是「我们不会再替你改」：后端的回执对所有情况都长成同一个成功（限流、蜜罐也一样），
            前端无从知道你那条到底进没进库——所以要确认平台看没看到，请找对接人，别把这句话当回执。
          </p>
          <p v-else class="client-decision__muted">
            依据是这份响应里的需求单状态（{{ view?.briefStatus }}）：答复已经落在单子上了，
            要改主意请找平台对接人，这一页没有自助修改的入口。
          </p>
          <p><b>接下来：</b>等平台把这一套转正交付。交付之前这一套仍是候选站，只有拿着链接的人能看。</p>
          <p><b>正式地址：</b>来自转正那一步交付回执里的维护地址字段（`maintenanceUrl`），
            不在这条链接回的数据里——所以这一页今天既没有正式地址可显示，也不摆一个「查看正式地址」的按钮。
            交付后平台会把能打开的地址发给你。</p>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.client-decision {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px 20px 64px;
  color: #1f2937;
  font-size: 14px;
  line-height: 1.7;
}
.client-decision__head h1 {
  margin: 0 0 6px;
  font-size: 22px;
}
.client-decision__sub,
.client-decision__muted {
  color: #6b7280;
  font-size: 13px;
}
.client-decision__notice {
  margin: 12px 0;
  padding: 10px 12px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 6px;
  font-size: 13px;
}
.client-decision__diff {
  margin: 12px 0;
  padding: 10px 12px;
  background: #f0f5ff;
  border: 1px solid #adc6ff;
  border-radius: 6px;
}
.client-decision__diff--weak {
  background: #fafafa;
  border-color: #d9d9d9;
  color: #6b7280;
}
.client-decision__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  align-items: start;
  margin-bottom: 20px;
}
.client-decision__card,
.client-decision__panel {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}
.client-decision__panel {
  margin-bottom: 16px;
}
.client-decision__card h2,
.client-decision__panel h2 {
  margin: 0 0 8px;
  font-size: 16px;
}
.client-decision__line {
  margin: 6px 0;
  word-break: break-word;
}
.client-decision__label {
  margin: 12px 0 4px;
  font-weight: 600;
}
.client-decision__pick {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 10px;
}
.client-decision__textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font: inherit;
}
.client-decision__button {
  margin-top: 12px;
  padding: 6px 16px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  cursor: pointer;
}
.client-decision__button--primary {
  background: #1677ff;
  border-color: #1677ff;
  color: #fff;
}
.client-decision__button[disabled] {
  opacity: .55;
  cursor: not-allowed;
}
.client-decision__error {
  margin: 8px 0 0;
  color: #cf1322;
}
.client-decision__quote {
  padding: 8px 10px;
  background: #fafafa;
  border-left: 3px solid #d9d9d9;
  font-family: monospace;
  word-break: break-word;
}
.client-decision__receipt {
  margin-top: 16px;
  padding: 12px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 6px;
}
.client-decision__receipt h3 {
  margin: 0 0 6px;
  font-size: 15px;
}
/* 蜜罐留在源码里，但访客看不到、也 Tab 不到（同门户留资那一块的口径） */
.client-decision__honeypot {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
</style>
