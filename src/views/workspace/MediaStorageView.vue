<template>
  <div class="media-storage">
    <a-alert type="info" show-icon class="media-storage__notice">
      <template #message>
        这一屏只回答两件事：<strong>新素材写到哪儿</strong>，以及<strong>老素材还有多少行没跟上</strong>。
        迁移只复制、不删本地文件——内容表里存的仍是原来的 <code>/uploads/...</code> 地址，
        所以「搬完了」不等于「磁盘上的可以清了」。
        会改所有租户的 <code>media</code> 行，因此只有超管能进，且没有自动跑的定时任务：一次点一批。
      </template>
    </a-alert>

    <a-alert v-if="statusError" type="error" show-icon class="media-storage__notice" :message="statusError" />

    <a-descriptions v-else-if="state" :column="2" bordered size="middle" class="media-storage__state">
      <a-descriptions-item label="新素材写到哪儿">
        <strong>{{ state.activeStorage }}</strong>
      </a-descriptions-item>
      <a-descriptions-item label="这个进程配了哪几种存储">
        {{ state.availableStorages.join(' / ') || '一种都没配上' }}
      </a-descriptions-item>
      <a-descriptions-item label="素材总行数">{{ state.totalRows }}</a-descriptions-item>
      <a-descriptions-item label="还差多少行没跟上">
        <strong v-if="state.pendingRows > 0" class="media-storage__pending">{{ state.pendingRows }}</strong>
        <strong v-else>0</strong>
        <span v-if="state.drained">（已经搬完）</span>
      </a-descriptions-item>
      <a-descriptions-item label="明确保留本地副本">
        {{ state.retainedLocalRows }} 行
        <span class="media-storage__hint">这些搬完也仍会在磁盘上留一份，不算漏搬</span>
      </a-descriptions-item>
      <a-descriptions-item label="能不能搬">
        {{ migratable ? '可以' : blockedReason }}
      </a-descriptions-item>
    </a-descriptions>

    <p v-else class="media-storage__loading">存储状态还没取到，所以下面这些数一个都没有。</p>

    <a-form layout="inline" class="media-storage__toolbar">
      <a-form-item label="只搬这个租户">
        <a-input v-model:value="tenantId" style="width: 140px" placeholder="留空 = 全平台" allow-clear />
      </a-form-item>
      <a-form-item label="这次最多处理">
        <a-input-number v-model:value="limit" :min="1" :max="2000" style="width: 120px" />
        <span class="media-storage__hint">行（重跑安全，已经搬过的会幂等跳过）</span>
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button :disabled="loadingState" @click="loadState">刷新状态</a-button>
          <a-popconfirm
            :disabled="!canRun"
            ok-text="开始搬"
            cancel-text="取消"
            :title="confirmTitle"
            @confirm="run">
            <template #description>
              这批最多 {{ limit }} 行会往目标存储复制一遍；本地文件不删，内容表里的地址也不改。
            </template>
            <a-button type="primary" :disabled="!canRun" :loading="running">搬一批</a-button>
          </a-popconfirm>
        </a-space>
      </a-form-item>
    </a-form>

    <a-alert v-if="runError" type="error" show-icon class="media-storage__notice" :message="runError" />

    <template v-if="report">
      <a-descriptions :column="3" bordered size="middle" class="media-storage__report">
        <a-descriptions-item label="这次看了">{{ report.scanned }} 行</a-descriptions-item>
        <a-descriptions-item label="搬成">{{ report.migrated }} 行</a-descriptions-item>
        <a-descriptions-item label="本来就在目标存储">{{ report.skippedAlreadyOnTarget }} 行</a-descriptions-item>
        <a-descriptions-item label="源文件已不在">{{ report.missingSource }} 行</a-descriptions-item>
        <a-descriptions-item label="失败">
          <strong :class="report.failed > 0 ? 'media-storage__pending' : ''">{{ report.failed }} 行</strong>
        </a-descriptions-item>
        <a-descriptions-item label="搬到多少字节">{{ report.bytesMoved }}</a-descriptions-item>
        <a-descriptions-item label="搬到哪儿去了">{{ report.targetStorage }}</a-descriptions-item>
        <a-descriptions-item label="本地文件删了吗">
          {{ report.localFilesDeleted ? '删了' : '一个都没删' }}
        </a-descriptions-item>
        <a-descriptions-item label="这批账平不平">
          {{ report.clean ? '没有失败' : '有失败，见下面明细' }}
        </a-descriptions-item>
      </a-descriptions>

      <a-table v-if="report.errors.length" :data-source="report.errors" :columns="errorColumns"
               :pagination="false" row-key="(r: string) => r" size="small" class="media-storage__errors">
        <template #bodyCell="{ text }">
          <span class="media-storage__error-line">{{ text }}</span>
        </template>
      </a-table>
      <p v-else class="media-storage__count">
        上面这些数之后端返回，界面没有自己算任何一个（「看了多少」不等于「搬成 + 失败」时，
        说明有素材被吃掉了，那是后端的错，不该由这里圆回来）。
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { describeHttpError } from '../../api/http'
import { mediaStorageApi, type MediaMigrationReport, type MediaStorageState } from '../../api/mediaStorage'

/**
 * 超管「素材存储」：问题六要的「图片迁去 OSS」在这里有手可以点。
 *
 * 两条说法只跟着接口走：
 * 1. 「搬完了」只在后端 `drained` 为真时出现。状态没取到就整块不渲染，绝不把「我不知道」
 *    渲染成一张 0 的表——那读起来像全站素材已经都在 OSS 里了；
 * 2. 结果那九个格子全是后端返回的账，界面不做加法和换算。
 *
 * 「能不能搬」这一格是把后端会拒绝的两种情况提前说清楚（只配了一种存储、或者已经搬完），
 * 但真正的判据仍在后端：这里禁用按钮只是不让人点一颗必然报错的按钮。
 */

const state = ref<MediaStorageState | null>(null)
const report = ref<MediaMigrationReport | null>(null)
const tenantId = ref('')
const limit = ref(500)

const loadingState = ref(false)
const running = ref(false)
const statusError = ref('')
const runError = ref('')

const errorColumns = [{ title: '哪一条为什么没搬成', dataIndex: 'text', key: 'text' }]

/** 配了两种存储才谈得上「搬」：只有一种时后端会直接拒（把行标成搬过就永远搬不走了） */
const hasSecondStorage = computed(() => (state.value?.availableStorages.length ?? 0) > 1)
const migratable = computed(() => !!state.value && hasSecondStorage.value && state.value.pendingRows > 0)

const blockedReason = computed(() => {
  if (!state.value) return '状态还没取到'
  if (!hasSecondStorage.value) return '这个进程只配了一种存储，没有可搬去的地方（先配好 app.media.oss.* 并把 app.media.storage 设为 oss）'
  return '库里已经没有没跟上的行了'
})

const parsedTenantId = computed(() => {
  const trimmed = tenantId.value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
})

/** 填了就必须是个正整数：半截的租户号会让后端按「全平台」搬，那正是最怕的误操作 */
const tenantIdValid = computed(() => !tenantId.value.trim() || parsedTenantId.value !== null)
const canRun = computed(() => !!state.value && migratable.value && tenantIdValid.value)

const confirmTitle = computed(() =>
  parsedTenantId.value
    ? `把租户 ${parsedTenantId.value} 的素材往 ${state.value?.activeStorage} 搬最多 ${limit.value} 行？`
    : `把全平台的素材往 ${state.value?.activeStorage} 搬最多 ${limit.value} 行？`)

async function loadState() {
  loadingState.value = true
  statusError.value = ''
  try {
    state.value = await mediaStorageApi.status()
  } catch (err) {
    // 取不到就说取不到：把失败渲染成「还差 0 行」等于告诉超管全站已经搬完了
    statusError.value = describeHttpError(err)
    state.value = null
  } finally {
    loadingState.value = false
  }
}

async function run() {
  running.value = true
  runError.value = ''
  try {
    report.value = await mediaStorageApi.migrateToOss({ tenantId: parsedTenantId.value, limit: limit.value })
    await loadState()
  } catch (err) {
    runError.value = describeHttpError(err)
  } finally {
    running.value = false
  }
}

onMounted(() => loadState())
</script>

<style scoped lang="less">
.media-storage {
  padding: 16px;

  &__notice {
    margin-bottom: 12px;
  }

  &__state,
  &__report {
    margin-bottom: 12px;
  }

  &__toolbar {
    margin-bottom: 12px;
  }

  &__errors {
    margin-bottom: 12px;
  }

  &__pending {
    color: #d4380d;
  }

  &__hint {
    margin-left: 8px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__error-line {
    font-family: Consolas, Monaco, monospace;
    font-size: 12px;
    white-space: pre-wrap;
  }

  &__loading {
    margin-bottom: 12px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__count {
    margin-top: 8px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }
}
</style>
