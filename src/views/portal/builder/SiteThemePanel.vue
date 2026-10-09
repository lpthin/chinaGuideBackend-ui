<template>
  <a-card size="small" title="站点主题（整站）" class="site-theme">
    <template #extra>
      <span class="site-theme__muted">{{ fields.length }} 个样式变量</span>
    </template>

    <a-alert
      type="info"
      show-icon
      message="改一次，全站生效：这一份是整站的样式源，不用重新生成"
      :description="notice"
    />

    <p v-if="!siteId" class="site-theme__muted">先在上方选一个站点：站级主题是挂在站点上的，「全部站点」这一档没有可改的对象。</p>
    <template v-else>
      <a-spin :spinning="loading">
        <ThemeTokenForm
          :fields="fields"
          :model="model"
          empty-hint="样式变量清单还没取到：这里不留第二份清单，刷新页面重试。"
          @update="write"
          @clear="clear"
        />
        <p v-if="updatedAt" class="site-theme__muted">最后一次改动：{{ updatedAt }}</p>

        <!-- 白名单没取到时不摆动作：那一份 model 是空的，此时点「保存」发出去的是「整站清空」 -->
        <template v-if="fields.length">
          <a-space class="site-theme__actions" wrap>
            <a-button size="small" type="primary" :loading="saving" @click="save">保存（整份替换）</a-button>
            <a-button size="small" :loading="saving" @click="clearAll">清空站级主题</a-button>
          </a-space>

          <a-divider style="margin: 12px 0" />

          <a-space class="site-theme__actions" wrap>
            <a-input v-model:value="skinName" size="small" placeholder="存成一份皮肤的名字" style="width: 180px" />
            <a-button size="small" :disabled="!skinName.trim()" :loading="saving" @click="saveSkin">存为皮肤</a-button>
          </a-space>
          <a-space class="site-theme__actions" wrap>
            <a-select
              v-model:value="presetId"
              size="small"
              style="width: 220px"
              placeholder="选一份已有皮肤"
              :options="presetOptions"
              :loading="loadingPresets"
            />
            <a-button size="small" :disabled="!presetId" :loading="saving" @click="applySkin">套到整站</a-button>
          </a-space>
          <p class="site-theme__muted">
            存皮肤抽的是这一站当前已保存的样式变量；套皮肤写的是站级主题这一份，逐页那份覆盖位不动。
          </p>
        </template>
      </a-spin>
    </template>
  </a-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { siteThemeApi } from '../../../api/siteTheme'
import { themePresetsApi, type ThemePreset, type ThemeTokenField } from '../../../api/themePresets'
import ThemeTokenForm from './ThemeTokenForm.vue'

/**
 * 站级主题的编辑面板（Spec-M §9.1 / 判据②④）。
 *
 * <p>为什么措辞要写「改一次全站生效」：这一条正是站级主题存在的理由——改造前每一页各存一份
 * theme_json，改一次主色要重跑生成或者逐页点。现在合成只有一个地方做（读侧），
 * 这里写的就是那个打底的那一份；页面级只是「这一页要不一样」。
 * 清单本身不在这里抄第二遍，由调用方把 /portal/theme-presets/tokens 那份传进来。</p>
 */
const props = defineProps<{
  siteId: number | null
  fields: ThemeTokenField[]
}>()

/** 写成功就通知一次：外层那个「预览」取的是接口合成的那一份，不重取就还显示旧主色 */
const emit = defineEmits<{ (e: 'updated'): void }>()

const model = ref<Record<string, string | number>>({})
const loading = ref(false)
const saving = ref(false)
const updatedAt = ref<string | null>(null)
const appliedPresetName = ref<string | null>(null)
const skinName = ref('')
const presetId = ref<number | undefined>()
const presets = ref<ThemePreset[]>([])
const loadingPresets = ref(false)

const presetOptions = computed(() =>
  presets.value
    .filter(item => item.tokensJson)
    .map(item => ({ value: item.id, label: item.name }))
)

const notice = computed(() =>
  appliedPresetName.value
    ? `这一站当前套的是皮肤「${appliedPresetName.value}」。套皮肤写的是这一份，逐页覆盖位不动。`
    : '这里写的是整站打底的样式变量；某页在搭建器里设过「本页覆盖」的键，那一页仍按它自己那份显示。'
)

watch(() => props.siteId, load, { immediate: true })

async function load(siteId: number | null) {
  model.value = {}
  updatedAt.value = null
  appliedPresetName.value = null
  presetId.value = undefined
  if (!siteId) {
    return
  }
  loading.value = true
  try {
    const site = await siteThemeApi.get(siteId)
    model.value = site.themeJson ? JSON.parse(site.themeJson) : {}
    updatedAt.value = site.themeUpdatedAt
    // 皮肤清单在「这一站还没套过皮肤」时也要取：只在套过时取的话，第一次套皮肤根本没有入口
    const list = await loadPresets()
    if (site.themePresetId) {
      appliedPresetName.value = list.find(item => item.id === site.themePresetId)?.name || `#${site.themePresetId}`
    }
  } catch (error) {
    message.error((error as Error).message || '站级主题加载失败')
  } finally {
    loading.value = false
  }
}

async function loadPresets(force = false) {
  if (presets.value.length && !force) {
    return presets.value
  }
  loadingPresets.value = true
  try {
    presets.value = (await themePresetsApi.list()) || []
  } catch {
    // 皮肤清单取不到只影响「套皮肤」那两行，主题本体照样能编辑，不弹打断式的错
    presets.value = []
  } finally {
    loadingPresets.value = false
  }
  return presets.value
}

function write(key: string, value: string | number | null | undefined) {
  // a-select 的清除回 undefined、a-input-number 回 null：两种都得当成「去掉这一键」
  if (value === '' || value === null || value === undefined) {
    clear(key)
    return
  }
  model.value = { ...model.value, [key]: value as string | number }
}

function clear(key: string) {
  const next = { ...model.value }
  delete next[key]
  model.value = next
}

async function save() {
  if (!props.siteId) {
    return
  }
  await apply(
    () => siteThemeApi.update(props.siteId as number, payloadOf(model.value)),
    '已写入站级主题，未设本页覆盖的页面都会跟着变'
  )
}

/** 空对象发空白串：那才是「这一站没有站级主题」，后端会显式把那一列写成 NULL */
function payloadOf(value: Record<string, string | number>): string {
  return Object.keys(value).length ? JSON.stringify(value) : ''
}

async function clearAll() {
  model.value = {}
  await apply(
    () => siteThemeApi.update(props.siteId as number, ''),
    '这一站的站级主题已清空，各页回到自己的覆盖位与骨架默认值'
  )
}

async function saveSkin() {
  if (!props.siteId) {
    return
  }
  await apply(
    () => siteThemeApi.saveSkin(props.siteId as number, skinName.value.trim()),
    '已把这一站的样式变量存成一份皮肤'
  )
  // 清单原来命中缓存就直接返回，于是「存为皮肤」成功后下拉里没有刚存的那一份，得刷新页面才看得到。
  // 存完强制重取一次，让新建的那一份立刻可选。
  await loadPresets(true)
}

async function applySkin() {
  if (!props.siteId || !presetId.value) {
    return
  }
  await apply(
    () => siteThemeApi.applySkin(props.siteId as number, presetId.value as number),
    '已套到整站：站级主题换成了那份皮肤'
  )
}

async function apply(call: () => Promise<unknown>, success: string) {
  saving.value = true
  try {
    await call()
    message.success(success)
    await load(props.siteId)
    emit('updated')
  } catch (error) {
    // 校验原因（白名单外的键、非法色值、区间）是后端拼好的中文，原样念，不改成「保存失败」
    message.error((error as Error).message || '写入失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="less">
.site-theme {
  &__muted {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.45);
  }

  &__actions {
    margin-top: 8px;
  }
}
</style>
