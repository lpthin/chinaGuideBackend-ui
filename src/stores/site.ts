import { defineStore } from 'pinia'
import { listSitesApi } from '@/api/sites'
import type { Site } from '@/types/api'

interface SiteState {
  sites: Site[]
  currentSiteId: number | null
}

export const useSiteStore = defineStore('site', {
  state: (): SiteState => ({
    sites: [],
    currentSiteId: Number(localStorage.getItem('geocms_current_site_id')) || null
  }),
  getters: {
    currentSite: (state) => state.sites.find((site) => site.id === state.currentSiteId) || state.sites[0] || null
  },
  actions: {
    async loadSites() {
      this.sites = await listSitesApi()
      if (!this.currentSiteId && this.sites[0]?.id) {
        this.setCurrentSite(this.sites[0].id)
      }
    },
    setCurrentSite(siteId: number) {
      this.currentSiteId = siteId
      localStorage.setItem('geocms_current_site_id', String(siteId))
    }
  }
})
