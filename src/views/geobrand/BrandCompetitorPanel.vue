<script setup lang="ts">
/**
 * 档案下的竞品子表（向导第 ② 步维护的是同一批行）。
 * 颜色全部走 StatusTag/statusTokens（§9.2-4：视图里不许再写本地色表）。
 * 自动发现的行默认未启用——未勾选的不计入 SOV 分母（§0.4 Q13-A）。
 */
import { onMounted, ref, watch } from 'vue'
import { message, notification } from 'ant-design-vue'
import DataTable from '../../components/DataTable.vue'
import DictTag from '../../components/DictTag.vue'
import StatusTag from '../../components/StatusTag.vue'
import { geoBrandApi, type GeoBrandCompetitor } from '../../api/geoBrand'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { PH_DASH } from '../../utils/display'

const props = defineProps<{ profileId: number }>()

const competitors = ref<GeoBrandCompetitor[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const adding = ref(false)
const newName = ref('')
const newWordsText = ref('')

const columns = [
  { title: '竞品名', dataIndex: 'name', key: 'name', width: 180 },
  { title: '竞品词', dataIndex: 'words', key: 'words' },
  { title: '来源', dataIndex: 'origin', key: 'origin', width: 110 },
  { title: '计入对比', dataIndex: 'enabled', key: 'enabled', width: 100 },
  { title: '操作', key: 'actions', width: 80 },
]

const splitWords = (text: string): string[] =>
  text.split(/[,，\s]+/).map((word) => word.trim()).filter(Boolean)

async function reload() {
  if (!props.profileId) return
  loading.value = true
  error.value = null
  try {
    competitors.value = await geoBrandApi.competitors(props.profileId) || []
  } catch (e) {
    error.value = describeHttpError(e)
    logError('geobrand/竞品组', e)
  } finally {
    loading.value = false
  }
}

async function addCompetitor() {
  if (!newName.value.trim()) {
    message.warning('请填写竞品名')
    return
  }
  adding.value = true
  try {
    const created = await geoBrandApi.addCompetitor(props.profileId, {
      name: newName.value.trim(),
      words: splitWords(newWordsText.value),
    })
    competitors.value = [...competitors.value, created]
    newName.value = ''
    newWordsText.value = ''
    message.success('竞品已添加')
  } catch (e) {
    notification.error({ message: '添加竞品失败', description: describeHttpError(e) })
    logError('geobrand/竞品组', e)
  } finally {
    adding.value = false
  }
}

async function toggleEnabled(record: GeoBrandCompetitor, enabled: boolean) {
  try {
    await geoBrandApi.setCompetitorEnabled(props.profileId, record.id, enabled)
    record.enabled = enabled
  } catch (e) {
    notification.error({ message: '切换竞品启用状态失败', description: describeHttpError(e) })
    logError('geobrand/竞品组', e)
  }
}

async function removeCompetitor(record: GeoBrandCompetitor) {
  try {
    await geoBrandApi.deleteCompetitor(props.profileId, record.id)
    competitors.value = competitors.value.filter((item) => item.id !== record.id)
    message.success('竞品已删除')
  } catch (e) {
    notification.error({ message: '删除竞品失败', description: describeHttpError(e) })
    logError('geobrand/竞品组', e)
  }
}

watch(() => props.profileId, reload)
onMounted(reload)
defineExpose({ reload })
</script>

<template>
  <div class="geobrand-competitor-panel">
    <h4 class="geobrand-competitor-panel__title">同类竞品</h4>
    <div class="geobrand-competitor-panel__hint">勾选的竞品才计入对比；取消勾选的不计入 SOV 分母。</div>
    <div class="geobrand-competitor-panel__add">
      <a-input v-model:value="newName" placeholder="竞品名" style="width: 180px" />
      <a-input v-model:value="newWordsText" placeholder="竞品词，逗号分隔" style="width: 240px" />
      <a-button :loading="adding" @click="addCompetitor">添加</a-button>
    </div>
    <DataTable
      :data-source="competitors"
      :loading="loading"
      :error="error"
      :columns="columns"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'words'">
          <span v-if="!(record as GeoBrandCompetitor).words?.length">{{ PH_DASH }}</span>
          <DictTag
            v-for="word in (record as GeoBrandCompetitor).words"
            :key="word"
            kind="competitor"
            :value="word"
          />
        </template>
        <template v-else-if="column.key === 'origin'">
          <StatusTag domain="geoOrigin" :status="(record as GeoBrandCompetitor).origin" />
        </template>
        <template v-else-if="column.key === 'enabled'">
          <a-switch
            :checked="(record as GeoBrandCompetitor).enabled"
            @change="(v: boolean) => toggleEnabled(record as GeoBrandCompetitor, v)"
          />
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-button size="small" danger @click="removeCompetitor(record as GeoBrandCompetitor)">删除</a-button>
        </template>
      </template>
    </DataTable>
  </div>
</template>

<style scoped lang="less">
.geobrand-competitor-panel {
  margin-bottom: 24px;

  &__title {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  &__hint {
    margin-bottom: 8px;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__add {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
}
</style>
