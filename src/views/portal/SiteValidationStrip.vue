<template>
  <div class="site-validation">
    <div class="site-validation__head">
      <b class="site-validation__title">交付前自检</b>
      <span v-if="siteId === null" class="site-validation__muted">
        还没选定站点：自检的账是按站点记的，没选站就不知道读哪一家的结论，所以这里一个结论都不念。
      </span>
      <span v-else-if="loadError" class="site-validation__muted">
        自检结论没读到（后端原话：{{ loadError }}）：读不到就当没读过，这里不演任何结论。
      </span>
      <span v-else-if="!loaded" class="site-validation__muted">正在读上一次的自检结论…</span>
      <span v-else class="site-validation__text">{{ summary }}</span>
    </div>

    <a-space size="4" class="site-validation__actions">
      <a-popconfirm
        title="重查只读页面与布局，不会改动任何内容，确认开始？"
        :disabled="siteId === null"
        @confirm="runScan"
      >
        <a-button size="small" :disabled="siteId === null" :loading="scanning">现在重查一遍</a-button>
      </a-popconfirm>
      <a-button size="small" :disabled="siteId === null" :loading="loading" @click="load">重新读一次</a-button>
    </a-space>

    <p v-if="scanError" class="site-validation__muted">这次重查没走通（后端原话：{{ scanError }}）：上面那一句仍然是上一次落账的那一跑。</p>
    <p v-else-if="scanNotice" class="site-validation__muted">{{ scanNotice }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { portalValidationApi, validationSummaryText, type ValidationRun } from '../../api/portalValidation'

/**
 * 交付前自检那一条摘要（设计文档 §6 层 2 的界面落点）。
 *
 * 三条刻意：
 * 1. 句子全部由 `validationSummaryText()` 拼，这一头不另写第二份文案——用例也是从那一支函数出发的；
 * 2. `latest` 回 null 就念「这个站还没跑过自检」：绝不在没有跑的时候念「0 条拦项」，
 *    谎报是这一族存在的理由所要杀掉的东西；
 * 3. 「现在重查一遍」只 POST `/portal/validation/scan?siteId=`（只读、不改内容、不调模型），
 *    摘要跟着用回执里那一行刚落账的跑，不自己拼状态；读口没成功时连一句结论都不念。
 *
 * siteId 必填（后端三条读口都先过 requireTargetSite）：没选站时一颗按钮都不给，也不发请求。
 */

const props = withDefaults(defineProps<{ siteId?: number | null }>(), { siteId: null })

const emit = defineEmits<{
  /** 重查落账后通知挂载方：巡检结果那张表该重新拉一次了 */
  (e: 'scanned', run: ValidationRun): void
}>()

const run = ref<ValidationRun | null>(null)
const loaded = ref(false)
const loading = ref(false)
const scanning = ref(false)
const loadError = ref('')
const scanError = ref('')
const scanNotice = ref('')

const summary = computed(() => validationSummaryText(run.value))

async function load() {
  const siteId = props.siteId
  if (siteId === null) return
  loading.value = true
  loadError.value = ''
  try {
    run.value = await portalValidationApi.latest(siteId)
    loaded.value = true
  } catch (error) {
    // 读不到就照实说读不到：run 清空，界面上不留任何一句结论
    run.value = null
    loaded.value = false
    loadError.value = (error as Error).message || '未知原因'
  } finally {
    loading.value = false
  }
}

async function runScan() {
  const siteId = props.siteId
  if (siteId === null || scanning.value) return
  scanning.value = true
  scanError.value = ''
  scanNotice.value = ''
  try {
    const result = await portalValidationApi.scan(siteId)
    // 摘要用的就是回执里那一行新账：界面不替后端推进状态，也不把计数归纳成「成功/失败」
    run.value = result.run
    loaded.value = true
    loadError.value = ''
    scanNotice.value = `刚刚那一跑已经落账（${result.findings?.length ?? 0} 条待处理问题记在下面的清单里）。`
    emit('scanned', result.run)
  } catch (error) {
    scanError.value = (error as Error).message || '未知原因'
  } finally {
    scanning.value = false
  }
}

watch(() => props.siteId, () => {
  run.value = null
  loaded.value = false
  loadError.value = ''
  scanError.value = ''
  scanNotice.value = ''
  void load()
})

onMounted(load)
</script>

<style scoped>
.site-validation {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fafafa;
}

.site-validation__head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}

.site-validation__title {
  color: rgba(0, 0, 0, 0.85);
}

.site-validation__text {
  color: rgba(0, 0, 0, 0.85);
}

.site-validation__muted {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
</style>
