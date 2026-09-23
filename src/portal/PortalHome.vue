<template>
  <div class="portal-home">
    <component :is="activeTemplate" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { fetchTemplate } from './api/portalPublic'

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

const activeTemplate = computed(() => {
  return templates[currentTemplate.value]
})

function applyRenderKey(value: string | null | undefined) {
  if (value && value in templates) {
    currentTemplate.value = value as RenderKey
  }
}

/**
 * 用哪套模板由后台的站点/模板配置决定（portal_template.render_key，见接口 /api/portal/public/template）。
 * 历史上这里是三套词表各说各话：库里的 code 是 tech-pro/marketing-growth/minimal-elegance，
 * 前端组件叫 tech/service/simple，租户换模板门户毫无变化。现在前端只认后端给的渲染键。
 * ?template= 仅用于后台「预览门户」链接指定样式，访客页面上没有切换入口。
 */
onMounted(async () => {
  const preview = route.query.template
  if (typeof preview === 'string' && preview in templates) {
    currentTemplate.value = preview as RenderKey
    return
  }
  try {
    const template = await fetchTemplate()
    applyRenderKey(template?.renderKey)
  } catch {
    // 模板配置取不到就保持默认样式，不给访客弹错误
  }
})
</script>

<style scoped lang="less">
.portal-home {
  min-height: 100vh;
  position: relative;
}
</style>
