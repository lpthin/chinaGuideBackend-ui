<template>
  <div class="portal-home">
    <PortalDynamicPage v-if="pageModel" :slug="slug" />
    <component :is="activeTemplate" v-else />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchSiteShell } from './api/portalPublic'
import { slugOfPath } from './portalPath'
import { reviewTokenOf } from './useReviewMode'
import PortalDynamicPage from './PortalDynamicPage.vue'

const TechTemplate = defineAsyncComponent(() =>
  import('./templates/TechTemplate.vue')
)

const ServiceTemplate = defineAsyncComponent(() =>
  import('./templates/ServiceTemplate.vue')
)

const SimpleTemplate = defineAsyncComponent(() =>
  import('./templates/SimpleTemplate.vue')
)

const route = useRoute()

const templates = {
  tech: TechTemplate,
  service: ServiceTemplate,
  simple: SimpleTemplate
}

type RenderKey = keyof typeof templates

/** 站点没配模板时的展示层默认；内容字段一律不用默认值兜底 */
const currentTemplate = ref<RenderKey>('tech')
const pageModel = ref(false)

const activeTemplate = computed(() => templates[currentTemplate.value])
/** 访客地址 → 页面 slug：/about 与 /p/my-page 走的是同一套页面模型 */
const slug = computed(() => slugOfPath(route.path))

function applyRenderKey(value: string | null | undefined) {
  if (value && value in templates) {
    currentTemplate.value = value as RenderKey
  }
}

/**
 * 两条渲染路径同时存在，是一个灰度开关的结果而不是长期状态：
 * site.page_model_enabled 打开的站点走区块白名单页面模型（PortalDynamicPage），
 * 没打开的仍走旧模板，等存量站点全部迁完（P3）就把这里和三套模板一起删掉。
 *
 * 用哪套模板由后台配置决定（portal_template.render_key），访客侧没有切换入口；
 * ?template= 仅用于后台「预览门户」链接指定旧样式，此时强制走模板分支，方便逐块比对是否视觉回归。
 */
async function decide() {
  // 预览链接只服务于页面模型那一套（工单要 blockInstanceId），所以带令牌时不进旧模板分支。
  // 不这么做的话：站点还没打开 page_model_enabled 时，客户点开的是一张旧模板页，
  // 底部工具条却承诺「点哪块改哪块」——那就是假通。
  const token = reviewTokenOf(route.query)
  if (token) {
    pageModel.value = true
    return
  }
  const preview = route.query.template
  if (typeof preview === 'string' && preview in templates) {
    pageModel.value = false
    currentTemplate.value = preview as RenderKey
    return
  }
  try {
    const shell = await fetchSiteShell()
    pageModel.value = Boolean(shell?.pageModelEnabled)
    applyRenderKey(shell?.template?.renderKey)
  } catch {
    // 站点壳取不到（域名未绑定等）时不给访客弹错误，退回默认模板分支由它自己显示空态
    pageModel.value = false
  }
}

onMounted(decide)
// /about → /services 复用同一组件实例，开关状态要跟着地址重算
watch(() => [route.path, route.query.template, route.query.reviewToken], decide)
</script>

<style scoped lang="less">
.portal-home {
  min-height: 100vh;
  position: relative;
}
</style>
