<script setup lang="ts">
/**
 * 域名绑定向导（Spec「上线交付收尾三件事」§2）：三步走。
 *
 * 第 1 步填要绑的域名并当场检测；第 2 步把客户该配的解析记录摆出来（记录值＝平台根域名，
 * 从检测结果里带回来，前端不自猜配置）；第 3 步确认保存。
 *
 * 检测不通过不是硬闸（客户可能用 CDN，检测天然测不准）：NOT_MATCHED / ROOT_NOT_CONFIGURED /
 * ERROR 都放行进第 2 步，但要把「仍要绑定」这个事实明说；只有 INVALID（格式都不对）拦着。
 */
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { siteApi } from '../api'
import { describeHttpError } from '../api/http'
import WizardSteps from './WizardSteps.vue'
import type { WizardState } from './wizardModel'
import type { Site } from '../types'
import { createSubmitGuard } from '../utils/submitGuard'

interface DomainCheckResult {
  status: 'OK' | 'NOT_MATCHED' | 'INVALID' | 'ROOT_NOT_CONFIGURED' | 'ERROR'
  message: string
  domainIps: string[]
  platformIps: string[]
  platformRoot: string
}

const props = defineProps<{
  open: boolean
  site: Site | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', site: Site): void
}>()

const steps = [
  { key: 'check', title: '填域名并检测' },
  { key: 'guide', title: '客户侧解析指引' },
  { key: 'confirm', title: '确认绑定' }
]

const wizardState = ref<WizardState>({ current: 0, maxReached: 0 })
const domain = ref('')
const checking = ref(false)
const result = ref<DomainCheckResult | null>(null)
const saving = ref(false)
/** 绑定是写入（SPEC-UI-9 H2）：同一拍连点只发一次，失败时域名原样留在输入框 */
const bindGuard = createSubmitGuard()

watch(() => props.open, (open) => {
  if (open) {
    domain.value = props.site?.domain || ''
    result.value = null
    wizardState.value = { current: 0, maxReached: 0 }
  }
}, { immediate: true })

const blocked = computed(() => !result.value || result.value.status === 'INVALID')
const platformRoot = computed(() => result.value?.platformRoot || '')

async function check() {
  if (!props.site?.id) return
  if (!domain.value.trim()) {
    message.warning('先填要绑的域名')
    return
  }
  checking.value = true
  try {
    result.value = await siteApi.domainCheck(props.site.id, domain.value.trim())
  } catch (error) {
    message.error(`检测失败：${describeHttpError(error)}`)
  } finally {
    checking.value = false
  }
}

async function beforeNext(): Promise<boolean | string | undefined> {
  if (wizardState.value.current === 0) {
    if (blocked.value) {
      return '先点「检测解析」拿到结果；格式不对的域名进不了下一步'
    }
  }
  return true
}

const resultColor: Record<string, string> = {
  OK: 'green',
  NOT_MATCHED: 'orange',
  INVALID: 'red',
  ROOT_NOT_CONFIGURED: 'blue',
  ERROR: 'red'
}

async function bind() {
  const site = props.site
  const siteId = site?.id
  if (!site || !siteId) return
  await bindGuard.run(async () => {
    saving.value = true
    try {
      // 只动域名一格：状态与名称原样带回（后端 update 认状态流转闸，原值原样是放行的）
      const saved = await siteApi.update(siteId, {
        id: siteId,
        name: site.name,
        status: site.status,
        domain: domain.value.trim()
      })
      message.success(`域名已绑定：${domain.value.trim()}`)
      emit('saved', saved)
      emit('update:open', false)
    } catch (error) {
      message.error(`绑定失败：${describeHttpError(error)}`)
    } finally {
      saving.value = false
    }
  })
}
</script>

<template>
  <a-modal
    :open="open"
    title="绑定域名"
    width="640px"
    :footer="null"
    @cancel="emit('update:open', false)"
  >
    <WizardSteps v-model:model-value="wizardState" :steps="steps" :before-next="beforeNext">
      <template #step-check>
        <a-form layout="vertical">
          <a-form-item label="要绑的域名" extra="填主机名即可，带不带 https:// 都认；保存前会自动清洗成主机名">
            <a-input v-model:value="domain" placeholder="www.example.com" />
          </a-form-item>
          <a-button type="primary" :loading="checking" :disabled="checking" @click="check">检测解析</a-button>
        </a-form>
        <a-alert
          v-if="result"
          style="margin-top: 16px"
          :type="result.status === 'OK' ? 'success' : result.status === 'NOT_MATCHED' ? 'warning' : 'error'"
          show-icon
        >
          <template #message>
            <a-tag :color="resultColor[result.status]">{{ result.status }}</a-tag>
            {{ result.message }}
          </template>
        </a-alert>
      </template>

      <template #step-guide>
        <!-- 检测没过仍要绑定的提醒只占一行灰字，不占色块（SPEC-UI-11 B 类） -->
        <p v-if="result && result.status !== 'OK'" class="scope-hint">
          检测没有通过，你选择仍要绑定：请先人工确认客户那边解析确实配好了。
        </p>
        <p>让客户在他的域名服务商后台（阿里云/腾讯云等）加一条解析记录：</p>
        <a-descriptions bordered :column="1" size="small">
          <a-descriptions-item label="记录类型">CNAME（推荐）或 A</a-descriptions-item>
          <a-descriptions-item label="主机记录">{{ domain || '-' }} 对应的子域（如 www；裸域名填 @）</a-descriptions-item>
          <a-descriptions-item label="记录值">
            <span v-if="platformRoot">{{ platformRoot }}</span>
            <span v-else class="domain-wizard__muted">平台根域名没配时按平台实际接入 IP 填（本地环境跳过）</span>
          </a-descriptions-item>
        </a-descriptions>
        <p style="margin-top: 12px">配好后回到上一步再点一次「检测解析」，显示「OK」就说明生效了。</p>
      </template>

      <template #step-confirm>
        <a-descriptions bordered :column="1" size="small">
          <a-descriptions-item label="站点">{{ site?.name || '-' }}（id={{ site?.id }}）</a-descriptions-item>
          <a-descriptions-item label="将绑定的域名">{{ domain.trim() || '-' }}</a-descriptions-item>
          <a-descriptions-item label="检测结果">
            <a-tag v-if="result" :color="resultColor[result.status]">{{ result.status }}</a-tag>
            <span v-else class="domain-wizard__muted">还没检测</span>
          </a-descriptions-item>
        </a-descriptions>
        <div style="margin-top: 24px">
          <a-button type="primary" :loading="saving" :disabled="saving" @click="bind">确认绑定</a-button>
        </div>
      </template>
    </WizardSteps>
  </a-modal>
</template>

<style scoped lang="less">
/* 前置条件与操作提醒：一行灰字，不占色块（SPEC-UI-11 B 类） */
.scope-hint {
  margin-bottom: 16px;
  color: #8c8c8c;
  font-size: 13px;
  line-height: 20px;
}

.domain-wizard__muted {
  color: #8c8c8c;
}
</style>
