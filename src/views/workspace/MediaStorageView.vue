<template>
  <div class="media-storage">
    <a-alert type="info" show-icon class="media-storage__notice">
      <template #message>
        这一屏管三件事：<strong>新素材写到哪儿</strong>（下面那份配置，全站只有一个人能改）、
        <strong>老素材还有多少行没跟上</strong>，以及<strong>这次要不要搬一批</strong>。
        迁移只复制、不删本地文件——内容表里存的仍是原来的 <code>/uploads/...</code> 地址，
        所以「搬完了」不等于「磁盘上的可以清了」。
        会改所有租户的 <code>media</code> 行，也只有超管能进，且没有自动跑的定时任务：一次点一批。
      </template>
    </a-alert>

    <a-card size="small" class="media-storage__card">
      <template #title>
        <span>存储配置</span>
        <span class="media-storage__subtitle">存进库里的这一行会盖过 YAML 与环境变量；改完不用重启</span>
      </template>
      <template #extra>
        <a-space>
          <a-button size="small" class="js-reload-config" :disabled="loadingConfig" @click="loadConfig">
            刷新配置
          </a-button>
          <a-button size="small" class="js-test" :disabled="!canTest" :loading="testing" @click="runTest">
            测试连接
          </a-button>
          <a-popconfirm
            class="js-save-pop"
            :disabled="!canSave"
            ok-text="就这样存"
            cancel-text="再看看"
            :title="saveTitle"
            @confirm="save">
            <template #description>
              这份配置决定全站每一个新上传落在哪儿，改完立刻生效（历史素材按各自的 <code>storage_type</code> 照常读）。
            </template>
            <a-button type="primary" size="small" class="js-save" :disabled="!canSave" :loading="saving">
              保存配置
            </a-button>
          </a-popconfirm>
        </a-space>
      </template>

      <a-alert v-if="configError" type="error" show-icon class="media-storage__row" :message="configError" />

      <p v-if="!config && !loadingConfig" class="media-storage__loading">
        没读到库里这份配置，所以下面三颗按钮都点不动——看不见库里已有什么就让人保存，
        等于让一张空表单把别人的参数清掉。
      </p>

      <a-form v-if="config" layout="vertical" :model="form" class="media-storage__form">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="新素材写到哪儿">
              <a-select v-model:value="form.storage" class="js-field-storage">
                <a-select-option value="">还没选：沿用 YAML 的 app.media.storage</a-select-option>
                <a-select-option value="local">本地磁盘（local）</a-select-option>
                <a-select-option value="oss">阿里云 OSS（oss）</a-select-option>
              </a-select>
              <span class="media-storage__hint">
                只有选 OSS 才要求下面四项齐、且先测通；选回本地不需要测试，也不删已经搬走的东西
              </span>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="Endpoint（接入点）">
              <a-input v-model:value="form.endpoint" class="js-field-endpoint"
                       placeholder="oss-cn-hangzhou.aliyuncs.com" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="Bucket（桶名）">
              <a-input v-model:value="form.bucket" class="js-field-bucket" placeholder="例如 aiwebsites" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="AccessKey ID">
              <a-input v-model:value="form.accessKeyId" class="js-field-ak"
                       placeholder="留空或保留掩码 = 不改这一项" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="AccessKey Secret">
              <a-input-password v-model:value="form.accessKeySecret" class="js-field-sk"
                                placeholder="只会写进去，永远读不回来" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="公开访问域名（可选）">
              <a-input v-model:value="form.publicBaseUrl" class="js-field-public"
                       placeholder="CDN / 自定义域名；留空 = 用 https://桶.Endpoint" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="公开素材键前缀（可选）">
              <a-input v-model:value="form.keyPrefix" class="js-field-keyprefix"
                       placeholder="留空 = 键直接落在 {租户id}/ 下" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="私有素材前缀">
              <a-input v-model:value="form.privatePrefix" class="js-field-privateprefix"
                       placeholder="留空 = 用代码默认值 private" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16" class="media-storage__secret-line">
          <a-col :span="24">
            密钥那两栏在库里是 AES-GCM 密文，接口永远只回掩码：
            <strong>留空、或把 <code>****</code> / 「已保存（不显示）」原样发回去，都表示「这一项不改」</strong>。
            想换新密钥就把整栏覆盖成新值——没有「看一眼旧密钥」这个操作，也不该有。
            <template v-if="config.configured">
              <br />上一次改动（改配置、或只点了一次「测试连接」，都会刷新这一行）：{{ config.updatedBy || '（没留名）' }} · {{ formatTime(config.updatedAt) || '时间未知' }}
            </template>
          </a-col>
        </a-row>
      </a-form>

      <a-alert v-if="testError" type="error" show-icon class="media-storage__row" :message="testError" />
      <a-alert v-else-if="testResult" :type="testResult.success ? 'success' : 'warning'" show-icon
               class="media-storage__row" :message="testResult.message" />
      <a-alert v-else-if="config" :type="lastTestType" show-icon class="media-storage__row"
               :message="lastTestMessage" :description="config.lastTestMessage || undefined" />

      <a-alert v-if="saveError" type="error" show-icon class="media-storage__row" :message="saveError" />
      <a-alert v-if="saveDone" type="success" show-icon class="media-storage__row" :message="saveDone" />
    </a-card>

    <a-card size="small" title="现在的状态" class="media-storage__card">
      <a-alert v-if="statusError" type="error" show-icon :message="statusError" />
      <a-descriptions v-else-if="state" :column="2" bordered size="middle">
        <a-descriptions-item label="新素材写到哪儿">
          <strong>{{ state.activeStorage }}</strong>
        </a-descriptions-item>
        <a-descriptions-item label="这份判定来自哪里">
          {{ configSourceLabel }}
        </a-descriptions-item>
        <a-descriptions-item label="系统现在认识哪几种存储">
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
        <a-descriptions-item label="能不能搬" :span="2">
          <strong v-if="migratable">可以</strong>
          <strong v-else class="media-storage__pending">{{ blockedReason }}</strong>
          <div v-if="state.note" class="media-storage__note">后端那句原话：{{ state.note }}</div>
        </a-descriptions-item>
      </a-descriptions>
      <p v-else class="media-storage__loading">存储状态还没取到，所以下面这些数一个都没有。</p>
    </a-card>

    <a-card size="small" title="搬一批过去" class="media-storage__card">
      <a-form layout="inline" class="media-storage__toolbar">
        <a-form-item label="只搬这个租户">
          <a-input v-model:value="tenantId" class="js-tenant" style="width: 140px" placeholder="留空 = 全平台" allow-clear />
        </a-form-item>
        <a-form-item label="这次最多处理">
          <a-input-number v-model:value="limit" class="js-limit" :min="1" :max="2000" style="width: 120px" />
          <span class="media-storage__hint">行（重跑安全，已经搬过的会幂等跳过）</span>
        </a-form-item>
        <a-form-item class="toolbar-actions">
          <a-space>
            <a-button class="js-refresh-state" :disabled="loadingState" @click="loadState">刷新状态</a-button>
            <a-popconfirm
              class="js-migrate-pop"
              :disabled="!canRun"
              ok-text="开始搬"
              cancel-text="取消"
              :title="confirmTitle"
              @confirm="run">
              <template #description>
                这批最多 {{ limit }} 行会往目标存储复制一遍；本地文件不删，内容表里的地址也不改。
              </template>
              <a-button type="primary" class="js-migrate" :disabled="!canRun" :loading="running">搬一批</a-button>
            </a-popconfirm>
          </a-space>
        </a-form-item>
      </a-form>

      <a-alert v-if="runError" type="error" show-icon :message="runError" />

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
        <p v-else class="media-storage__hint">
          上面这些数之后端返回，界面没有自己算任何一个（「看了多少」不等于「搬成 + 失败」时，
          说明有素材被吃掉了，那是后端的错，不该由这里圆回来）。
        </p>
      </template>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { describeHttpError } from '../../api/http'
import {
  mediaStorageApi,
  type MediaMigrationReport,
  type MediaStorageConfig,
  type MediaStorageConfigForm,
  type MediaStorageState,
  type MediaStorageTestResult
} from '../../api/mediaStorage'

/**
 * 超管「素材存储」：OSS 那四个参数现在就在这屏上填，不用改 YAML、不用重启。
 *
 * 三条说法只跟着接口走：
 * 1. 「搬完了」只在后端 `drained` 为真时出现。状态没取到就整块不渲染，绝不把「我不知道」
 *    渲染成一张 0 的表——那读起来像全站素材已经都在 OSS 里了；
 * 2. 结果那九个格子全是后端返回的账，界面不做加法和换算；
 * 3. 「测试通过」这件事是后端按参数指纹记的（`lastTestMatchesCurrent`），界面上再叠一层
 *    「框里的字还是不是当初测过的那组」。改了一个字符就重新要求测一次——
 *    因为这一行配置决定的是从此以后全站每一个上传，一个打错的桶名不会只让这一次保存失败。
 *
 * 真正的判据全在后端那三道闸里（写入目标只认 local/oss/没选、选 OSS 必须四项齐、必须先测通）。
 * 这里的禁用只是不让人点一颗必然被拒的按钮，不是把规则抄一份到浏览器里。
 */

const state = ref<MediaStorageState | null>(null)
const report = ref<MediaMigrationReport | null>(null)
const config = ref<MediaStorageConfig | null>(null)
const testResult = ref<MediaStorageTestResult | null>(null)
const tenantId = ref('')
const limit = ref(500)

const loadingState = ref(false)
const loadingConfig = ref(false)
const testing = ref(false)
const saving = ref(false)
const running = ref(false)
const statusError = ref('')
const runError = ref('')
const configError = ref('')
const testError = ref('')
const saveError = ref('')
const saveDone = ref('')

/** 表单里那份（可能还没保存的）参数。读到配置后从库里那份回填，密钥回填的是掩码 */
const form = reactive<Required<MediaStorageConfigForm>>({
  storage: '',
  endpoint: '',
  bucket: '',
  accessKeyId: '',
  accessKeySecret: '',
  publicBaseUrl: '',
  keyPrefix: '',
  privatePrefix: ''
})

const errorColumns = [{ title: '哪一条为什么没搬成', dataIndex: 'text', key: 'text' }]

const isOss = computed(() => form.storage === 'oss')

/** 四项连接参数齐了才谈得上测一次（缺项后端当「这次测试没发生」，不记失败） */
const TEST_FIELDS: Array<[keyof MediaStorageConfigForm, string]> = [
  ['endpoint', 'Endpoint（接入点）'],
  ['bucket', 'Bucket（桶名）'],
  ['accessKeyId', 'AccessKey ID'],
  ['accessKeySecret', 'AccessKey Secret']
]

const missingForTest = computed(() => TEST_FIELDS
  .filter(([key]) => !String(form[key] ?? '').trim())
  .map(([, label]) => label))

const canTest = computed(() => !!config.value && missingForTest.value.length === 0)

/**
 * 框里的连接参数与读到的那份不一样 = 换了一组参数，之前那次通过不再算数。
 *
 * 只比那七项连接参数，**故意不比写入目标**：选 local / oss 是这一屏要让人做的动作，
 * 而后端那次指纹（`connectionFingerprint`）里也不含 storage——两边口径必须一致，
 * 否则会出现「界面说没测过、后端说测过了」这种没人能核对的账。
 */
const formDirty = computed(() => {
  const stored = config.value
  if (!stored) return true
  const pairs: Array<[string | null, string | null]> = [
    [form.endpoint, stored.endpoint],
    [form.bucket, stored.bucket],
    [form.accessKeyId, stored.accessKeyId],
    [form.accessKeySecret, stored.accessKeySecret],
    [form.publicBaseUrl, stored.publicBaseUrl],
    [form.keyPrefix, stored.keyPrefix],
    [form.privatePrefix, stored.privatePrefix]
  ]
  return pairs.some(([current, original]) => (current ?? '').trim() !== (original ?? '').trim())
})

/** 后端记的那次通过 + 界面看见的这框内容 = 同一组参数，才允许把它设成全站写入目标 */
const testedAndUntouched = computed(() =>
  !!config.value && config.value.lastTestStatus === 'ok' && config.value.lastTestMatchesCurrent && !formDirty.value)

const canSave = computed(() => !!config.value && !(isOss.value && !testedAndUntouched.value))

const saveTitle = computed(() => isOss.value
  ? `把 ${form.bucket || '（桶名还没填）'} 设为全站新素材的落点？`
  : '保存这份配置？')

const lastTestType = computed(() => {
  const status = config.value?.lastTestStatus
  return status === 'ok' ? 'success' : status === 'failed' ? 'warning' : 'info'
})

const lastTestMessage = computed(() => {
  const stored = config.value
  if (!stored) return ''
  if (!stored.lastTestStatus) return '这组参数还没测过：先点「测试连接」，通过了才允许把写入目标设成 OSS。'
  const head = stored.lastTestStatus === 'ok' ? '上次测试通过' : '上次测试没通过'
  const when = stored.lastTestedAt ? `（${formatTime(stored.lastTestedAt)}）` : ''
  if (stored.lastTestStatus === 'ok' && !stored.lastTestMatchesCurrent) {
    // 这一句挡住的是「拿 A 桶测通、把参数改成 B 桶就存」：那个 ok 属于一套已经不存在的参数
    return `${head}${when}，但库里这份参数后来被改过，那次通过不再算数——请重测一次`
  }
  if (stored.lastTestStatus === 'ok' && formDirty.value) {
    return `${head}${when}，但你框里填的已经和测过的那组不一样了，保存前请重新测一次`
  }
  return `${head}${when}`
})

/** 迁移这道题：配了两种存储才谈得上「搬」，且后端得真拿得出可用后端 */
const hasSecondStorage = computed(() => (state.value?.availableStorages.length ?? 0) > 1)
const migratable = computed(() => !!state.value && state.value.usable && hasSecondStorage.value && state.value.pendingRows > 0)

const configSourceLabel = computed(() => {
  switch (state.value?.configSource) {
    case 'database': return '本页面存的那份（库里）'
    case 'database-unreadable': return '库里那份读不出来，暂时按 YAML / 环境变量在服务'
    case 'env': return 'YAML / 环境变量（界面上还没保存过配置）'
    default: return '后端没说'
  }
})

const blockedReason = computed(() => {
  if (!state.value) return '状态还没取到'
  if (state.value.note) return state.value.note
  if (!hasSecondStorage.value) return '没有可搬去的地方：OSS 后端还没建出来，请在上面的「存储配置」里填全四项并保存'
  if (state.value.activeStorage !== 'oss') return '写入目标还不是 OSS，现在点「搬」只会把文件从磁盘复制到磁盘，请在上面把写入目标存成 oss'
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
const canRun = computed(() => migratable.value && tenantIdValid.value)

const confirmTitle = computed(() =>
  parsedTenantId.value
    ? `把租户 ${parsedTenantId.value} 的素材往 ${state.value?.activeStorage} 搬最多 ${limit.value} 行？`
    : `把全平台的素材往 ${state.value?.activeStorage} 搬最多 ${limit.value} 行？`)

/** 后端回的是 LocalDateTime 的序列化值，这里只做「看得顺一点」，不做时区换算 */
function formatTime(value: string | null): string {
  if (!value) return ''
  return value.replace('T', ' ').slice(0, 19)
}

function applyConfig(next: MediaStorageConfig | null) {
  config.value = next
  if (!next) return
  form.storage = next.storage ?? ''
  form.endpoint = next.endpoint ?? ''
  form.bucket = next.bucket ?? ''
  form.accessKeyId = next.accessKeyId ?? ''
  // 密钥读不回来，这一栏只会是那句占位；原样发回去 = 不改
  form.accessKeySecret = next.accessKeySecret ?? ''
  form.publicBaseUrl = next.publicBaseUrl ?? ''
  form.keyPrefix = next.keyPrefix ?? ''
  form.privatePrefix = next.privatePrefix ?? ''
  testResult.value = null
  testError.value = ''
  saveDone.value = ''
}

async function loadConfig() {
  loadingConfig.value = true
  configError.value = ''
  try {
    applyConfig(await mediaStorageApi.config())
  } catch (err) {
    // 读不到就不渲染表单：让一张空表单去 PUT，效果是把库里那份真配置清成空值
    configError.value = describeHttpError(err)
    config.value = null
  } finally {
    loadingConfig.value = false
  }
}

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

async function runTest() {
  testing.value = true
  testError.value = ''
  testResult.value = null
  try {
    testResult.value = await mediaStorageApi.testConfig({ ...form })
    // 测的就是框里这组参数，所以后端记下的指纹与掩码要重新读一遍才知道
    await loadConfig()
  } catch (err) {
    testError.value = describeHttpError(err)
  } finally {
    testing.value = false
  }
}

async function save() {
  saving.value = true
  saveError.value = ''
  saveDone.value = ''
  try {
    applyConfig(await mediaStorageApi.saveConfig({ ...form }))
    saveDone.value = isOss.value
      ? '已保存，新素材从现在起写往 OSS。已有素材还各自留在原来的存储上，要继续就点下面的「搬一批」。'
      : '已保存。'
    await loadState()
  } catch (err) {
    saveError.value = describeHttpError(err)
  } finally {
    saving.value = false
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

onMounted(() => {
  loadConfig()
  loadState()
})
</script>

<style scoped lang="less">
.media-storage {
  padding: 16px;

  &__notice {
    margin-bottom: 12px;
  }

  &__card {
    margin-bottom: 12px;
  }

  &__subtitle {
    margin-left: 8px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
    font-weight: normal;
  }

  &__form {
    margin-bottom: 4px;
  }

  &__row {
    margin-bottom: 8px;
  }

  &__secret-line {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__toolbar {
    margin-bottom: 12px;
  }

  &__report,
  &__errors {
    margin-top: 12px;
  }

  &__pending {
    color: #d4380d;
  }

  &__hint {
    display: block;
    margin-left: 8px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__note {
    margin-top: 4px;
    color: rgba(0, 0, 0, 0.65);
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
}
</style>
