import { defineStore } from 'pinia'
import { ref } from 'vue'
import { siteApi } from '../api'
import type { Site } from '../types'

export const useSiteStore = defineStore('site', () => {
  const sites = ref<Site[]>([])
  const currentSite = ref<Site | null>(null)
  const loading = ref(false)

  async function loadSites() {
    loading.value = true
    try {
      const res = await siteApi.list({})
      sites.value = res.records || []
      if (sites.value.length > 0 && !currentSite.value) {
        currentSite.value = sites.value[0]
      }
    } catch (e) {
      console.error('加载站点列表失败:', e)
    } finally {
      loading.value = false
    }
  }

  function setCurrentSite(site: Site | null) {
    currentSite.value = site
  }

  return {
    sites,
    currentSite,
    loading,
    loadSites,
    setCurrentSite,
  }
})
