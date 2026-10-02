<template>
  <a-card size="small" class="advice-card">
    <template #title>AI 推导栏目建议</template>

    <p class="advice-card__lead">
      按这张需求单读出来的栏目建议，逐条过目；认可的那几条仍然由超管自己保存。
      <strong>这些是建议，点了「保存到站点」才会生效</strong>：模型只出主意，写库那一下始终是超管自己按的。
    </p>

    <!-- 生成那一发要花钱：没有「进页面就自动调一次」这回事，只有这一颗按钮发得出去 -->
    <a-alert type="warning" show-icon class="advice-card__notice">
      <template #message>
        「生成一版建议」会真的调用模型、消耗这个租户的配额，点一次花一次——所以它不会自己跑，
        要人明确点这一颗。
      </template>
    </a-alert>

    <p v-if="briefId === null" class="advice-card__muted">
      还没有需求单编号：这一口是按需求单开的，没有单号就没有可问的对象，所以这里一颗按钮都不给。
    </p>

    <template v-else>
      <a-alert v-if="adviceDenied" type="warning" show-icon class="advice-card__notice">
        <template #message>{{ adviceDenied }}</template>
      </a-alert>
      <a-alert v-else-if="notReady" type="info" show-icon class="advice-card__notice">
        <template #message>
          这一套还没准备好（后端原话：{{ notReady }}）。
          这里宁可空着也不摆一张「暂无建议」的列表——空列表会让人以为「生成过了、结论是没有」，那不是事实。
        </template>
      </a-alert>

      <a-alert v-else-if="loadError" type="error" show-icon class="advice-card__notice">
        <template #message>建议没读到（后端原话：{{ loadError }}）：读不到就当没读过，下面不演任何结论。</template>
      </a-alert>

      <a-spin v-else :spinning="loading">
        <template v-if="view && view.generated">
          <p class="advice-card__muted">
            生成时间：{{ view.generatedAt || '后端没随回执带时间' }} · 共 {{ adviceItems.length }} 条。
          </p>
          <p v-if="!adviceItems.length" class="advice-card__muted">
            后端这次回的是 0 条建议：这是真生成过、结论就是没有可建议的，不是接口没数据。
          </p>
          <ul v-else class="advice-card__list">
            <li v-for="item in adviceItems" :key="item.sectionKey" class="advice-card__item">
              <div class="advice-card__item-head">
                <b>{{ item.label }}</b>
                <a-tag>{{ item.enabled ? '开通' : '关掉' }}</a-tag>
                <a-tag>{{ item.navVisible ? '进顶部导航' : '不进导航' }}</a-tag>
                <a-tag>导航顺序 {{ item.navSort }}</a-tag>
              </div>
              <!-- 理由一个字都不改：模型那句话是这条建议的全部依据，归纳成「推荐」就没人能复核了 -->
              <p class="advice-card__reason">{{ item.reason }}</p>
            </li>
          </ul>
        </template>
        <p v-else class="advice-card__muted">
          这张需求单还没有生成过建议（后端回的 generated=false）。下面那一颗是第一次生成。
        </p>
      </a-spin>

      <a-space v-if="!adviceDenied" wrap class="advice-card__actions">
        <a-button :disabled="!canGenerate" :loading="generating" @click="generate">
          {{ hasAdvice ? '再生成一版（再花一次模型的钱）' : '生成一版建议（会调用模型）' }}
        </a-button>
        <a-button :loading="loading" :disabled="briefId === null" @click="load">刷新建议</a-button>
        <a-button v-if="mode === 'apply'" type="primary" :disabled="!canApply" @click="emitApply">
          填进下面的草稿
        </a-button>
        <a-button v-else type="primary" :disabled="!canSave" :loading="saving" @click="save">
          保存到站点
        </a-button>
      </a-space>

      <p v-if="mode === 'apply'" class="advice-card__muted">
        {{
          localEditsPending
            ? '这一页还有没保存的改动：先点「保存到站点」或「全部还原」再来填草稿。'
              + '建议直接盖在没存过的改动上，那些改动就找不回来了。'
            : '点了「填进下面的草稿」只是把值搬到卡片里，仍然要在下面那条「保存到站点」按一次才落库。'
        }}
      </p>
      <p v-else-if="siteId === null" class="advice-card__muted">
        这一单还没有绑定站点：建议可以先看，但没有可写的站点，所以「保存到站点」是灭的。
      </p>

      <p v-if="generateNotice" class="advice-card__notice-text">{{ generateNotice }}</p>
      <a-alert v-if="saveError" type="error" show-icon class="advice-card__notice">
        <template #message>保存失败（后端原话：{{ saveError }}）：整批要么全写、要么一条都不写，
          所以库里还是保存前那份，下面列的还是旧值。</template>
      </a-alert>
    </template>
  </a-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  isMissingEndpoint,
  portalSectionsApi,
  type SectionAdviceItem,
  type SectionAdviceView,
  type SectionBulkItem,
  type SectionState
} from '../../api/portalSections'
import { useAuthStore } from '../../stores/auth'

/**
 * 「AI 推导栏目建议」复核卡（Spec-D D4，拍板 N2：栏目动作只归超管，AI 只出建议）。
 *
 * 四条刻意：
 * 1. 生成那一发只在人明确点按钮时发出去，进页面只读 GET——付模型的口不许自己响；
 * 2. 界面不猜后端口在不在：404 就说「这一套还没准备好」并原样带上中文原因，
 *    绝不退化成一张空的建议列表（空列表会被读成「生成过，结论是没有」）；
 * 3. 「采纳」有两种落点，由挂载方选一种，不在同一张卡上并存两条写库路：
 *    `apply` = 只把值搬进栏目页草稿，写库仍是栏目页那条 bulk；
 *    `save`  = 需求单详情里没有草稿可搬，这张卡自己发那一条 bulk，但仍然要人点「保存到站点」；
 * 4. 建议里那句理由一个字都不改地显示：那是这条建议唯一可复核的依据。
 *
 * 栏目 key 与中文名全来自后端回包（I-1）：这张卡不认识任何栏目，只对得上接口给的那几个 key。
 */

const props = withDefaults(defineProps<{
  briefId?: number | null
  /** 保存的目标站点；null = 这张需求单还没落成站点，写库无处可去 */
  siteId?: number | null
  /** apply：把建议交回父组件填草稿；save：这张卡自己发那一条 bulk 请求 */
  mode?: 'apply' | 'save'
  /** 栏目页上有未保存改动时置真：不许把建议盖在人还没存的改动上 */
  localEditsPending?: boolean
}>(), {
  briefId: null,
  siteId: null,
  mode: 'save',
  localEditsPending: false
})

const emit = defineEmits<{
  (e: 'apply', items: SectionAdviceItem[]): void
  (e: 'saved', states: SectionState[]): void
}>()

const auth = useAuthStore()
// 建议这一口挂在需求单下（GET/POST /admin/site-briefs/{id}/section-advice），要的是 portal:build:manage，
// 而这张卡同时挂在栏目页（portal:build:section）上：缺码就不发，也别说成「读失败」。
const canReadAdvice = computed(() => auth.hasPermission('portal:build:manage'))

const view = ref<SectionAdviceView | null>(null)
const loading = ref(false)
const generating = ref(false)
const saving = ref(false)
const loadError = ref('')
/** 后端这一口还没上线时的那句中文原因；有值就只显示这一句，不显示任何列表 */
const notReady = ref('')
/** 缺 portal:build:manage 时的那句话：这一口不发请求，也不演成「读失败」或「没有建议」 */
const adviceDenied = ref('')
const generateNotice = ref('')
const saveError = ref('')

const adviceItems = computed<SectionAdviceItem[]>(() => view.value?.items ?? [])
const hasAdvice = computed(() => !!view.value?.generated)
const canGenerate = computed(() => props.briefId !== null && !generating.value && !loading.value)
const canApply = computed(() =>
  props.mode === 'apply' && hasAdvice.value && adviceItems.value.length > 0 && !props.localEditsPending
)
const canSave = computed(() =>
  props.mode === 'save' && hasAdvice.value && adviceItems.value.length > 0 && props.siteId !== null
)

async function load() {
  if (props.briefId === null) {
    return
  }
  if (!canReadAdvice.value) {
    view.value = null
    loadError.value = ''
    notReady.value = ''
    adviceDenied.value =
      '这个账号没有 portal:build:manage，建议那一发读不出来：这里不给任何结论——既不是「读失败」，也不是「生成过了、结论是没有」。'
    return
  }
  adviceDenied.value = ''
  loading.value = true
  loadError.value = ''
  notReady.value = ''
  try {
    view.value = await portalSectionsApi.advice(props.briefId)
  } catch (error: any) {
    const reason = error?.message || '未知原因'
    view.value = null
    // 后端没实现完时这一口就是 404：那是「还没做好」，不是「做好了但没有建议」，两句话必须分开说
    if (isMissingEndpoint(error)) {
      notReady.value = reason
    } else {
      loadError.value = reason
    }
  } finally {
    loading.value = false
  }
}

/** POST 只在这一颗按钮上发一次；回 202/ok 后由前端再拉一次 GET 看生成到没生成出来 */
async function generate() {
  if (props.briefId === null) {
    return
  }
  generating.value = true
  generateNotice.value = ''
  try {
    await portalSectionsApi.generateAdvice(props.briefId)
    await load()
    if (!view.value?.generated) {
      generateNotice.value =
        '生成请求已经发出去了，但再拉一次建议时后端回的是「还没生成好」（这一发是异步的）：'
        + '过一会儿点「刷新建议」看结果，这里不猜它好了没有。'
    } else {
      message.success('建议已生成，逐条过目再决定要不要保存')
    }
  } catch (error: any) {
    generateNotice.value = `生成没走通（后端原话：${error?.message || '未知原因'}）：模型一次都没调也说不准，`
      + '按这一口的设计就是没花成的钱不记在界面上，以账单为准。'
  } finally {
    generating.value = false
  }
}

/** 建议 → 那一条 bulk 的请求体：字段名一一对上后端 SectionForm，这里只做搬运，不做判断 */
function toBulkItems(items: SectionAdviceItem[]): SectionBulkItem[] {
  return items.map(item => ({
    key: item.sectionKey,
    displayName: item.label,
    enabled: item.enabled,
    navVisible: item.navVisible,
    navSort: item.navSort
  }))
}

function emitApply() {
  emit('apply', adviceItems.value)
}

async function save() {
  if (props.siteId === null || !canSave.value) {
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    const states = await portalSectionsApi.adminBulkUpdate(props.siteId, toBulkItems(adviceItems.value))
    emit('saved', states)
    message.success('建议已保存到站点')
  } catch (error: any) {
    // 整批原子：后端那句中文原因就是「为什么一条都没写」，原样挂出来而不是转成「保存失败」三个字
    saveError.value = error?.message || '未知原因'
  } finally {
    saving.value = false
  }
}

watch(() => props.briefId, () => {
  view.value = null
  void load()
})

onMounted(load)
</script>

<style scoped lang="less">
.advice-card {
  &__lead {
    margin-bottom: 12px;
  }

  &__notice {
    margin-bottom: 12px;
  }

  &__notice-text {
    margin-top: 12px;
    color: rgba(0, 0, 0, 0.65);
  }

  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__list {
    margin: 0;
    padding-left: 18px;
  }

  &__item {
    margin-bottom: 12px;
  }

  &__item-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  // 理由那一句要能读完整，所以单独占一行而不是挤在标签后面
  &__reason {
    margin: 4px 0 0;
    color: rgba(0, 0, 0, 0.65);
  }

  &__actions {
    margin-top: 12px;
  }
}
</style>
