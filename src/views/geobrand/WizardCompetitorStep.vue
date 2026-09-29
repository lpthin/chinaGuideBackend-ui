<script setup lang="ts">
/**
 * 向导第 ② 步的「留空＝自动发现」面板（§10-2 ②、§0.4 Q13）。
 * 自动发现的行服务端落库时 enabled=false——这里照原样画成未勾选的开关，
 * 并明说「未勾选的不计入 SOV 分母」：勾了才算对比对象（分母被杂牌污染就没法看了）。
 * discovered/kept/limit/skipped 四个数原样念，上限要告诉人在哪改。
 */
import { notification } from 'ant-design-vue'
import DictTag from '../../components/DictTag.vue'
import StatusTag from '../../components/StatusTag.vue'
import { geoBrandApi, type GeoAutoDiscoverResult, type GeoBrandCompetitor } from '../../api/geoBrand'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { autoDiscoverSummary } from './geoBrandWizard'

const props = defineProps<{
  profileId: number | null
  autoResult: GeoAutoDiscoverResult | null
  discovering?: boolean
}>()

const emit = defineEmits<{ (e: 'discover'): void }>()

function requestDiscover() {
  if (!props.profileId) {
    notification.error({ message: '还没有品牌档案', description: '请先在第①步保存品牌档案，再自动发现竞品' })
    return
  }
  emit('discover')
}

/** 开关只把「勾选」这一动作打给后端；取消勾选同样走这条（enabled 与库同步，不各画各的） */
async function setEnabled(item: GeoBrandCompetitor, enabled: boolean) {
  if (!props.profileId) return
  try {
    await geoBrandApi.setCompetitorEnabled(props.profileId, item.id, enabled)
    item.enabled = enabled
  } catch (e) {
    notification.error({ message: '切换竞品启用状态失败', description: describeHttpError(e) })
    logError('geobrand/竞品自动发现', e)
  }
}
</script>

<template>
  <div class="geobrand-wizard-discover">
    <p class="geobrand-wizard-discover__hint">
      留空＝自动发现：一个都没手填时，从上一轮引用共现的品牌里抽取；按提及频次取前 N 个，N 是平台上限。
      未勾选的不计入 SOV 分母。
    </p>
    <a-button :loading="discovering" @click="requestDiscover">自动发现同类竞品</a-button>

    <div v-if="autoResult" class="geobrand-wizard-discover__result">
      <p class="geobrand-wizard-discover__counts">{{ autoDiscoverSummary(autoResult) }}</p>
      <div v-for="item in autoResult.items" :key="item.id" class="geobrand-wizard-discover__row">
        <a-switch :checked="item.enabled === true" @change="(v: boolean) => setEnabled(item, v)" />
        <span class="geobrand-wizard-discover__name">{{ item.name }}</span>
        <StatusTag domain="geoOrigin" :status="item.origin" />
        <DictTag v-for="word in item.words" :key="word" kind="competitor" :value="word" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.geobrand-wizard-discover {
  margin-top: 24px;

  &__hint {
    margin: 0 0 8px;
    color: #595959;
    font-size: 12px;
  }

  &__result {
    margin-top: 16px;
  }

  &__counts {
    margin: 0 0 16px;
    font-size: 13px;
    color: #595959;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__name {
    font-weight: 600;
  }
}
</style>
