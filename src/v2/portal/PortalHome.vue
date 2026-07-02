<template>
  <div class="portal-home">
    <div class="template-switcher">
      <div class="switcher-label">切换模板：</div>
      <div class="switcher-buttons">
        <a-button
          :type="currentTemplate === 'tech' ? 'primary' : 'default'"
          size="small"
          @click="switchTemplate('tech')"
        >
          科技型
        </a-button>
        <a-button
          :type="currentTemplate === 'service' ? 'primary' : 'default'"
          size="small"
          @click="switchTemplate('service')"
        >
          服务型
        </a-button>
        <a-button
          :type="currentTemplate === 'simple' ? 'primary' : 'default'"
          size="small"
          @click="switchTemplate('simple')"
        >
          简约型
        </a-button>
      </div>
    </div>

    <transition name="fade" mode="out-in">
      <component :is="activeTemplate" :key="currentTemplate" />
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent, onMounted } from 'vue'
import { useRoute } from 'vue-router'

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

const currentTemplate = ref<'tech' | 'service' | 'simple'>('tech')

const activeTemplate = computed(() => {
  return templates[currentTemplate.value]
})

const switchTemplate = (template: 'tech' | 'service' | 'simple') => {
  currentTemplate.value = template
  localStorage.setItem('portal-template', template)
}

onMounted(() => {
  const savedTemplate = localStorage.getItem('portal-template') as 'tech' | 'service' | 'simple' | null
  if (savedTemplate && templates[savedTemplate]) {
    currentTemplate.value = savedTemplate
  }

  const templateParam = route.query.template as string
  if (templateParam && templates[templateParam as keyof typeof templates]) {
    currentTemplate.value = templateParam as 'tech' | 'service' | 'simple'
  }
})
</script>

<style scoped lang="less">
.portal-home {
  min-height: 100vh;
  position: relative;
}

.template-switcher {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;

  .switcher-label {
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }

  .switcher-buttons {
    display: flex;
    gap: 8px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .template-switcher {
    top: auto;
    bottom: 20px;
    right: 20px;
    left: 20px;
    flex-direction: row;
    align-items: center;
    justify-content: center;

    .switcher-label {
      display: none;
    }

    .switcher-buttons {
      flex: 1;
      justify-content: center;

      .ant-btn {
        flex: 1;
      }
    }
  }
}
</style>
