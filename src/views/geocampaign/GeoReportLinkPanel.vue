<script setup lang="ts">
/**
 * 只读外链管理（Spec-G G6，登录态这一侧）。
 *
 * 这一屏只做三件事：发一条、看发过哪几条、撤某一条。三条各自的诚实口径：
 *
 * 1. <b>地址是相对路径回来的，由界面按当前 origin 拼</b>（`reportLinkUrl`）：同源部署时这就是对的，
 *    dev 下 UI 在 5190 也是对的。后端不许拿请求的 origin 凑一个绝对地址（那是候选站预览链
 *    当年被骂过的口径），前端也不许另写一份拼法。
 * 2. <b>已经发出去的旧链接念不出地址</b>：库里只存 SHA-256，明文只在刚签发那一次回得来。
 *    所以列表那一排只有「活着吗 / 到什么时候 / 谁签的」，没有「再复制一次」的按钮——
 *    摆一个点不开的按钮就是假入口（§9.6 那条纪律在这儿同样成立）。
 * 3. <b>撤销只撤这一轮发出去的某一条</b>：后端两道闸（认租户 + 认这条是不是这一轮发的），
 *    界面对它拒的那一句原样念，不改写成「操作失败」。
 *
 * 「客户拿到链接之后能看什么」这件事在这一屏要说清：链接开的是同一份报告，但那是<b>只读</b>的——
 * 判定、重算、一键成内容都不在那一屏上。写动作留在自己的后台，这才叫「给别人看数」而不是「给别人改数」。
 */
import { computed, ref, watch } from 'vue'
import { notification } from 'ant-design-vue'
import {
  geoCampaignApi,
  type GeoIssuedReportLink,
  type GeoReportLinkSummary,
} from '../../api/geoCampaign'
import { reportLinkUrl } from '../../api/geoReportAccess'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { formatDateTimeWithZone } from '../../utils/format'

const props = defineProps<{ runId: number | null }>()

const label = ref('')
const links = ref<GeoReportLinkSummary[]>([])
const issued = ref<GeoIssuedReportLink | null>(null)
const loading = ref(false)
const issuing = ref(false)
const error = ref<string | null>(null)

/** 刚发出去那一条的完整地址：只在这一屏出现一次，抄下来或复制走 */
const issuedUrl = computed(() => reportLinkUrl(issued.value?.path))

async function loadLinks() {
  if (!props.runId) return
  loading.value = true
  error.value = null
  try {
    links.value = await geoCampaignApi.reportLinks(props.runId)
  } catch (e) {
    error.value = describeHttpError(e)
    logError('geocampaign/只读链接列表', e)
  } finally {
    loading.value = false
  }
}

async function issue() {
  if (!props.runId || issuing.value) return
  issuing.value = true
  try {
    // 备注名可空：留空时后端按「只读链接」兜，界面无需自己编一个名字
    issued.value = await geoCampaignApi.issueReportLink(props.runId, label.value.trim() || null)
    label.value = ''
    notification.success({
      message: '只读链接已发出',
      description: '这个地址只会显示一次：库里存的是散列，之后任何接口都念不出它。',
    })
    await loadLinks()
  } catch (e) {
    notification.error({ message: '链接未发出', description: describeHttpError(e) })
    logError('geocampaign/发只读链接', e)
  } finally {
    issuing.value = false
  }
}

async function copyIssued() {
  if (!issuedUrl.value) return
  try {
    await navigator.clipboard.writeText(issuedUrl.value)
    notification.success({ message: '地址已复制' })
  } catch (e) {
    // 复制失败不演成成功：那一栏地址本来就看得见，让人自己选走（内嵌浏览器常没这个权限）
    notification.warning({
      message: '这个浏览器不让页面写剪贴板',
      description: '地址就在下面那一栏，选中它手动复制即可。',
    })
    logError('geocampaign/复制只读链接', e)
  }
}

async function revoke(link: GeoReportLinkSummary) {
  if (!props.runId) return
  try {
    const next = await geoCampaignApi.revokeReportLink(props.runId, link.sessionId)
    links.value = links.value.map((row) => (row.sessionId === next.sessionId ? next : row))
    notification.success({
      message: '这一条已撤销',
      description: '拿这条链接的人下一次打开就是「链接无效或已过期」，同一轮的其他链接不受影响。',
    })
  } catch (e) {
    notification.error({ message: '撤销未受理', description: describeHttpError(e) })
    logError('geocampaign/撤销只读链接', e)
  }
}

function stateText(link: GeoReportLinkSummary): string {
  if (link.revokedAt) return '已撤销'
  if (!link.active) return '已过期'
  return '有效'
}

watch(() => props.runId, () => {
  issued.value = null
  void loadLinks()
}, { immediate: true })
</script>

<template>
  <section class="geo-report-link" data-card="report-link">
    <h3 class="geo-report-link__title">给客户看的只读链接</h3>
    <p class="geo-report-link__hint">
      发一条出去，对方不用登录就能看<b>这一轮</b>的报告与每一个数背后的原文；
      链接开的是<b>只读</b>那一屏——判定、按勾选重算、一键成内容都留在自己后台，
      别人拿这条链接改不动这一轮的账。
    </p>

    <div class="geo-report-link__row">
      <a-input v-model:value="label" placeholder="备注名（可选，例如「给张总的第三季度报告」）" allow-clear />
      <a-button type="primary" :loading="issuing" :disabled="!runId" @click="issue">发一条只读链接</a-button>
    </div>

    <div v-if="issued" class="geo-report-link__issued" data-testid="issued-link">
      <a-input :value="issuedUrl" readonly data-testid="issued-url" />
      <a-button size="small" @click="copyIssued">复制</a-button>
      <span class="geo-report-link__until">
        到 {{ formatDateTimeWithZone(issued.expiresAt) }} 失效 · 此后打开就是「链接无效或已过期」
      </span>
    </div>

    <p v-if="error" class="geo-report-link__error">{{ error }}</p>

    <table v-if="links.length" class="geo-report-link__table" data-testid="link-table">
      <thead>
        <tr>
          <th>备注名</th>
          <th>谁发的</th>
          <th>发出时间</th>
          <th>到什么时候</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="link in links" :key="link.sessionId">
          <td>{{ link.label || '—' }}</td>
          <td>{{ link.createdBy || '—' }}</td>
          <td>{{ formatDateTimeWithZone(link.createdAt) }}</td>
          <td>{{ formatDateTimeWithZone(link.expiresAt) }}</td>
          <td>{{ stateText(link) }}</td>
          <td>
            <!-- 已经失效的没有「撤销」可点：那一发什么都改变不了，摆着就是假入口 -->
            <a-button v-if="link.active" size="small" danger @click="revoke(link)">撤销</a-button>
            <span v-else>—</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="loading" class="geo-report-link__hint">正在读这一轮发过哪几条链接…</p>
    <!-- 读失败时上面那一句就是全部实话：这里再补一句「还没发过」就是把「我读不到」说成「没有」 -->
    <p v-else-if="!error" class="geo-report-link__hint">
      这一轮还没发过只读链接。上面按一次「发一条只读链接」，地址只会出现这一次。
    </p>

    <p class="geo-report-link__note">
      列表里没有「再复制一次」：令牌是散列存的，旧链接的地址连我们自己都念不出来。
      要再给一个人看，就再发一条——它们各自能单独撤销。
    </p>
  </section>
</template>

<style scoped lang="less">
.geo-report-link {
  margin: 16px 0;
  padding: 12px 16px;
  border: 1px solid var(--geo-border, #e5e7eb);
  border-radius: 8px;

  &__title {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 600;
  }

  &__hint,
  &__note {
    margin: 6px 0;
    color: rgba(0, 0, 0, 0.55);
    font-size: 12px;
    line-height: 1.6;
  }

  &__row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__issued {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
  }

  &__until {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.55);
  }

  &__error {
    margin-top: 8px;
    color: #cf1322;
    font-size: 12px;
  }

  &__table {
    width: 100%;
    margin-top: 12px;
    border-collapse: collapse;
    font-size: 12px;

    th,
    td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--geo-border, #f0f0f0);
      text-align: left;
      white-space: nowrap;
    }

    td:nth-child(1) {
      white-space: normal;
    }
  }
}
</style>
