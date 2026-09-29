<template>
  <page-shell title="可抓取性体检" subtitle="爬虫与 AI 引擎今天从站外实际读得到什么——六项实测，读的是配置之外的那一份">
    <template #actions>
      <a-space>
        <a-button :loading="loading" @click="loadAll">刷新</a-button>
        <a-tooltip :title="RUN_HINT">
          <a-button type="primary" :disabled="!canRun" :loading="running" @click="runOnce">跑一次</a-button>
        </a-tooltip>
      </a-space>
    </template>

    <a-spin :spinning="loading">
      <state-block v-if="loadError" state="error" :detail="loadError" />

      <template v-else>
        <div v-if="snapshot && !snapshot.neverRun" class="audit-headline">{{ headline(snapshot) }}</div>
        <div v-if="!canRun" class="audit-permission-note">
          这一页只给读。「跑一次」挂的是平台侧那一码，租户点不到——留痕要能当证据用，
          就不能由被体检的一方随时重跑。
        </div>

        <div v-if="snapshot?.neverRun" class="audit-never-run">
          <state-block state="empty" :title="NEVER_RUN_TITLE" :next="NEVER_RUN_NEXT" />
        </div>

        <div v-if="countChips.length" class="audit-counts">
          <a-tag v-for="chip in countChips" :key="chip.key" :color="chip.color">{{ chip.text }}</a-tag>
        </div>

        <a-card
          v-for="row in rows"
          :key="row.checkKey"
          class="audit-row"
          :data-check-key="row.checkKey"
          :data-verdict="verdictOf(row) || 'absent'"
          size="small"
        >
          <template #title>
            <span class="audit-row__label">{{ row.label }}</span>
          </template>
          <template #extra>
            <status-tag
              domain="geoCrawlabilityVerdict"
              :status="verdictOf(row)"
              :label="verdictLabelOf(vocabulary, row)"
            />
          </template>

          <div class="audit-row__observed">
            <template v-if="row.kind === 'item'">
              <span class="audit-row__observed-text">{{ row.item.observedValue || PH_DASH }}</span>
              <span v-if="fractionText(row.item)" class="audit-row__fraction">{{ fractionText(row.item) }}</span>
            </template>
            <template v-else>
              <span class="audit-row__observed-text">{{ PH_NOT_RUN }}</span>
            </template>
          </div>

          <p v-if="reasonText(row.kind === 'item' ? row.item : null)" class="audit-row__reason">
            {{ reasonText(row.kind === 'item' ? row.item : null) }}
          </p>

          <a-descriptions :column="1" size="small" class="audit-row__criteria">
            <a-descriptions-item v-if="verdictDefinitionOf(vocabulary, row)" label="这一档说什么">
              {{ verdictDefinitionOf(vocabulary, row) }}
            </a-descriptions-item>
            <a-descriptions-item v-if="howMeasuredOf(vocabulary, row)" label="怎么测的">
              {{ howMeasuredOf(vocabulary, row) }}
            </a-descriptions-item>
            <a-descriptions-item v-if="passCriterionOf(vocabulary, row)" label="凭什么算通过">
              {{ passCriterionOf(vocabulary, row) }}
            </a-descriptions-item>
            <a-descriptions-item v-if="whyItMattersOf(vocabulary, row)" label="为什么重要">
              {{ whyItMattersOf(vocabulary, row) }}
            </a-descriptions-item>
            <a-descriptions-item v-if="row.kind === 'item' && row.item.measuredAt" label="测于">
              {{ row.item.measuredAt }}
            </a-descriptions-item>
          </a-descriptions>

          <a-collapse v-if="row.kind === 'item' && evidenceLines(row.item).length" ghost class="audit-row__evidence">
            <a-collapse-panel key="evidence" header="证据（这一行的原始读数）">
              <div v-for="line in evidenceLines(row.item)" :key="line.key" class="audit-row__evidence-line">
                <span class="audit-row__evidence-key">{{ line.key }}</span>
                <span class="audit-row__evidence-value">{{ line.value }}</span>
              </div>
            </a-collapse-panel>
          </a-collapse>
        </a-card>
      </template>
    </a-spin>
  </page-shell>
</template>

<script setup lang="ts">
/**
 * 可抓取性体检（Spec-F §8 / §10-7 / §11.6，P5 前端）。
 *
 * 这一页是整个 Spec 里唯一能自证的一部分：前面那些率量的是「模型怎么说」，这六项量的是
 * 「我们的门开着没有」。所以三条渲染纪律直接写在这里，用例逐条钉：
 * 1. <b>六项恒占六格</b>：库里缺哪项就念「未跑过」，界面不静悄悄少一行，也不把空列表画成绿灯；
 * 2. <b>一句话都不自己写</b>：项名、判据、取数句子、四档口径全部来自 `vocabulary()` 与行自带字段
 *    （§5 单源——前端抄一份中文，下一次后端改判据时页面上留的就是旧说法）；
 * 3. <b>SSR 那一行不灰、不藏、不改档</b>：Q12「还是挂着吧」期间它合法地长期不通过，
 *    界面上就让它红着，并把服务端那句因果原样念出来（§11.6-3）。
 *
 * 「跑一次」只给平台（V153 只把 `seo:audit:view` 授给 SITE_ADMIN，`seo:audit:run` 留在超管那一档）。
 * 没有 `?tenantId=`：租户由登录上下文决定，前端传参数会造成「读按 A、写按 B」的错位留痕。
 */
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageShell from '../../components/PageShell.vue'
import StateBlock from '../../components/StateBlock.vue'
import StatusTag from '../../components/StatusTag.vue'
import {
  geoCrawlabilityApi,
  type CrawlabilitySnapshot,
  type CrawlabilityVocabulary,
} from '../../api/geoCrawlability'
import { describeHttpError } from '../../api/http'
import { useAuthStore } from '../../stores/auth'
import { logError } from '../../utils/errorLog'
import { PH_DASH, PH_NOT_RUN } from '../../utils/display'
import {
  NEVER_RUN_NEXT,
  NEVER_RUN_TITLE,
  RUN_HINT,
  displayRows,
  evidenceLines,
  fractionText,
  headline,
  howMeasuredOf,
  passCriterionOf,
  reasonText,
  verdictCounts,
  verdictDefinitionOf,
  verdictLabelOf,
  verdictOf,
  whyItMattersOf,
} from './geoCrawlabilityModel'

const auth = useAuthStore()
const canRun = computed(() => auth.hasPermission('seo:audit:run'))

const loading = ref(false)
const running = ref(false)
const loadError = ref<string | null>(null)
const vocabulary = ref<CrawlabilityVocabulary | null>(null)
const snapshot = ref<CrawlabilitySnapshot | null>(null)

const rows = computed(() => displayRows(vocabulary.value, snapshot.value))

/** 四档各几行：分开摆，不合并成一个数（§5 禁令 1）。中文名念词表，本地不译 */
const countChips = computed(() => {
  if (!snapshot.value || snapshot.value.neverRun) {
    return []
  }
  const counts = verdictCounts(rows.value)
  const chips: Array<{ key: string; text: string; color: string }> = []
  for (const verdict of ['PASS', 'WARN', 'FAIL', 'NOT_MEASURED']) {
    const n = counts[verdict] ?? 0
    if (n === 0) {
      continue
    }
    chips.push({
      key: verdict,
      text: `${vocabulary.value?.verdicts?.[verdict] || verdict} ${n} 项`,
      color: verdict === 'PASS' ? 'green' : verdict === 'WARN' ? 'gold' : verdict === 'FAIL' ? 'red' : 'default',
    })
  }
  const absent = counts.ABSENT ?? 0
  if (absent > 0) {
    chips.push({ key: 'ABSENT', text: `${PH_NOT_RUN} ${absent} 项`, color: 'default' })
  }
  return chips
})

async function loadAll() {
  loading.value = true
  loadError.value = null
  try {
    const [v, s] = await Promise.all([geoCrawlabilityApi.vocabulary(), geoCrawlabilityApi.latest()])
    vocabulary.value = v
    snapshot.value = s
  } catch (error) {
    loadError.value = describeHttpError(error) || '读取体检结果失败'
    logError('geoseo-crawlability-load', error)
  } finally {
    loading.value = false
  }
}

async function runOnce() {
  running.value = true
  loadError.value = null
  try {
    snapshot.value = await geoCrawlabilityApi.run()
    message.success('这一轮六项已现测并各留一行')
  } catch (error) {
    loadError.value = describeHttpError(error) || '跑体检失败'
    logError('geoseo-crawlability-run', error)
  } finally {
    running.value = false
  }
}

onMounted(() => {
  loadAll()
})
</script>

<style scoped lang="less">
.audit-headline {
  margin-bottom: 12px;
  color: #595959;
  font-size: 13px;
}

.audit-permission-note,
.audit-never-run {
  margin-bottom: 12px;
}

.audit-permission-note {
  color: #8c8c8c;
  font-size: 12px;
}

.audit-counts {
  margin-bottom: 16px;
}

.audit-row {
  margin-bottom: 12px;

  &__label {
    font-weight: 600;
  }

  &__observed {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  &__observed-text {
    color: #262626;
  }

  &__fraction {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__reason {
    margin: 8px 0 0;
    color: #d46b08;
  }

  &__criteria {
    margin-top: 12px;
  }

  &__evidence-line {
    display: flex;
    gap: 8px;
    font-size: 12px;
  }

  &__evidence-key {
    color: #8c8c8c;
    flex-shrink: 0;
  }

  &__evidence-value {
    color: #262626;
    word-break: break-all;
  }
}
</style>
