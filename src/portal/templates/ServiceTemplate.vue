<template>
  <div class="service-template">
    <div v-if="loadError" class="load-error">{{ loadError }}</div>
    <header class="service-header" :class="{ scrolled: isScrolled }">
      <div class="container">
        <div class="header-content">
          <div class="logo">
            <div class="logo-icon">
              <component :is="HeartOutlined" />
            </div>
            <span v-if="companyInfo.name" class="logo-text">{{ companyInfo.name }}</span>
          </div>
          <nav class="nav-menu">
            <a
              v-for="item in navItems"
              :key="item.key"
              :href="item.path"
              class="nav-item"
              :class="{ active: currentPath === item.path }"
              @click.prevent="navigateTo(item.path)"
            >
              {{ item.label }}
            </a>
          </nav>
          <a-button type="primary" class="cta-btn" @click="navigateTo('/contact')">
            联系我们
          </a-button>
          <a-button class="mobile-menu-btn" type="text" @click="mobileMenuVisible = !mobileMenuVisible">
            <component :is="MenuOutlined" />
          </a-button>
        </div>
      </div>
      <div v-if="mobileMenuVisible" class="mobile-menu">
        <a
          v-for="item in navItems"
          :key="item.key"
          :href="item.path"
          class="mobile-nav-item"
          @click.prevent="navigateTo(item.path); mobileMenuVisible = false"
        >
          {{ item.label }}
        </a>
      </div>
    </header>

    <section v-if="heroData" class="service-hero">
      <div class="hero-bg">
        <div class="warm-gradient"></div>
        <div class="hero-shape shape-1"></div>
        <div class="hero-shape shape-2"></div>
      </div>
      <div class="container">
        <div class="hero-content">
          <div class="hero-text">
            <h1 v-if="heroData.title" class="hero-title">
              {{ heroData.title }}
            </h1>
            <p v-if="heroData.description" class="hero-subtitle">
              {{ heroData.description }}
            </p>
            <div v-if="heroData.buttonText && heroData.buttonLink" class="hero-buttons">
              <a-button type="primary" size="large" @click="navigateTo(heroData.buttonLink || '/')">
                {{ heroData.buttonText }}
                <component :is="ArrowRightOutlined" />
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="services.length" class="service-list section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">服务项目</span>
          <h2 class="section-title">我们提供的专业服务</h2>
        </div>
        <div class="services-grid">
          <a
            v-for="service in services"
            :key="service.id"
            :href="service.link || undefined"
            class="service-item"
          >
            <h3 class="service-name">{{ service.title }}</h3>
            <p v-if="service.summary" class="service-desc">{{ service.summary }}</p>
          </a>
        </div>
      </div>
    </section>

    <footer class="service-footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-brand">
            <div class="logo">
              <div class="logo-icon">
                <component :is="HeartOutlined" />
              </div>
              <span v-if="companyInfo.name" class="logo-text">{{ companyInfo.name }}</span>
            </div>
            <p v-if="companyInfo.slogan" class="footer-slogan">{{ companyInfo.slogan }}</p>
            <div class="footer-contact">
              <div v-if="contactInfo?.phone" class="contact-item">
                <component :is="PhoneOutlined" />
                <span>{{ contactInfo.phone }}</span>
              </div>
              <div v-if="contactInfo?.email" class="contact-item">
                <component :is="MailOutlined" />
                <span>{{ contactInfo.email }}</span>
              </div>
              <div v-if="contactInfo?.address" class="contact-item">
                <component :is="EnvironmentOutlined" />
                <span>{{ contactInfo.address }}</span>
              </div>
            </div>
          </div>
          <div v-for="linkGroup in footerLinks" :key="linkGroup.title + linkGroup.url" class="footer-column">
            <h4 class="footer-title">
              <a :href="linkGroup.url || undefined">{{ linkGroup.title }}</a>
            </h4>
            <ul v-if="linkGroup.children && linkGroup.children.length" class="footer-links">
              <li v-for="link in linkGroup.children" :key="link.title + link.url">
                <a :href="link.url || undefined">{{ link.title }}</a>
              </li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p v-if="companyInfo.copyright">{{ companyInfo.copyright }}</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import {
  HeartOutlined,
  MenuOutlined,
  ArrowRightOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined
} from '@ant-design/icons-vue'
import {
  getPortalData,
  type ApiSeoMeta,
  type ApiCompanyInfo,
  type ApiHeroData,
  type ApiServiceItem,
  type ApiCaseItem,
  type ApiNewsItem,
  type ApiContactInfo,
  type ApiFooterLink,
  type ApiBanner
} from '../api/portalData'

const router = useRouter()
const route = useRoute()
const isScrolled = ref(false)
const mobileMenuVisible = ref(false)
const currentPath = ref('/')

// 站点导航没有对应的后端表，属于前端自身的 UI 骨架，与 router 中真实存在的路由保持一致
const navItems = [
  { key: 'home', label: '首页', path: '/' },
  { key: 'about', label: '关于我们', path: '/about' },
  { key: 'services', label: '服务项目', path: '/services' },
  { key: 'cases', label: '案例展示', path: '/cases' },
  { key: 'news', label: '新闻动态', path: '/news' },
  { key: 'contact', label: '联系我们', path: '/contact' }
]

const seoMeta = ref<ApiSeoMeta | null>(null)
const faviconUrl = ref<string>('')
const companyInfo = ref<ApiCompanyInfo>({
  name: '',
  logo: null,
  slogan: '',
  copyright: '',
  description: ''
})
const heroData = ref<ApiHeroData | null>(null)
const services = ref<ApiServiceItem[]>([])
const cases = ref<ApiCaseItem[]>([])
const newsList = ref<ApiNewsItem[]>([])
const contactInfo = ref<ApiContactInfo | null>(null)
const footerLinks = ref<ApiFooterLink[]>([])
const banners = ref<ApiBanner[]>([])
const loadError = ref('')

const handleScroll = () => {
  isScrolled.value = window.scrollY > 50
}

const navigateTo = (path: string) => {
  currentPath.value = path
  router.push(path)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const loadData = async () => {
  try {
    const data = await getPortalData()
    loadError.value = ''
    seoMeta.value = data.seoMeta || null
    faviconUrl.value = data.faviconUrl || ''
    if (data.companyInfo) {
      companyInfo.value = data.companyInfo
    }
    heroData.value = data.heroData || null
    services.value = data.services || []
    cases.value = data.cases || []
    newsList.value = data.newsList || []
    contactInfo.value = data.contactInfo || null
    footerLinks.value = data.footerLinks || []
    banners.value = data.banners || []
  } catch (err: any) {
    console.error('加载数据失败:', err)
    loadError.value = err?.message || '数据加载失败'
  }
}

useHead({
  title: computed(() => seoMeta.value?.seoTitle || companyInfo.value?.name || '企业门户'),
  meta: computed(() => {
    const seo = seoMeta.value
    if (!seo) return []
    return [
      { name: 'description', content: seo.seoDescription || '' },
      { name: 'keywords', content: seo.seoKeywords || '' },
      { name: 'robots', content: seo.robotsMeta || 'index, follow' },
      { property: 'og:title', content: seo.ogTitle || seo.seoTitle || '' },
      { property: 'og:description', content: seo.ogDescription || seo.seoDescription || '' },
      { property: 'og:image', content: seo.ogImage || '' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: seo.twitterCardType || 'summary_large_image' },
      { name: 'twitter:title', content: seo.twitterTitle || seo.seoTitle || '' },
      { name: 'twitter:description', content: seo.twitterDescription || seo.seoDescription || '' },
      { name: 'twitter:image', content: seo.twitterImage || seo.ogImage || '' }
    ]
  }),
  link: computed(() => {
    const seo = seoMeta.value
    const links: any[] = []
    if (seo?.canonicalUrl) {
      links.push({ rel: 'canonical', href: seo.canonicalUrl })
    }
    if (faviconUrl.value) {
      links.push({ rel: 'icon', href: faviconUrl.value })
    }
    return links
  }),
  script: computed(() => {
    const seo = seoMeta.value
    const scripts: any[] = []
    if (seo?.schemaJson) {
      scripts.push({
        type: 'application/ld+json',
        children: seo.schemaJson
      })
    } else if (seo?.defaultSchemaJson) {
      scripts.push({
        type: 'application/ld+json',
        children: seo.defaultSchemaJson
      })
    }
    return scripts
  })
})

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
  currentPath.value = route.path
  loadData()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped lang="less">
.service-template {
  min-height: 100vh;
  background: #fffbf7;
  color: #2d2a26;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.load-error {
  position: relative;
  z-index: 1001;
  margin: 90px auto 0;
  max-width: 1200px;
  padding: 16px 24px;
  background: #fff1f0;
  border: 1px solid #ffa39e;
  border-radius: 8px;
  color: #cf1322;
  text-align: center;
}

.section {
  padding: 100px 0;
}

.section-header {
  text-align: center;
  margin-bottom: 60px;
}

.section-tag {
  display: inline-block;
  padding: 6px 20px;
  background: linear-gradient(135deg, rgba(255, 138, 76, 0.15), rgba(255, 107, 107, 0.15));
  color: #ff6b6b;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;

  &.light {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }
}

.section-title {
  font-size: 42px;
  font-weight: 700;
  margin-bottom: 16px;
  color: #2d2a26;

  &.light {
    color: #fff;
  }
}

.section-subtitle {
  font-size: 16px;
  color: #8b7d6b;
  max-width: 600px;
  margin: 0 auto;
}

.service-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  transition: all 0.3s ease;
  background: transparent;

  &.scrolled {
    background: rgba(255, 251, 247, 0.95);
    backdrop-filter: blur(20px);
    box-shadow: 0 4px 20px rgba(139, 125, 107, 0.1);
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 70px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;

    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #ff8a4c, #ff6b6b);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 20px;
    }

    .logo-text {
      font-size: 20px;
      font-weight: 700;
      color: #ff6b6b;
    }
  }

  .nav-menu {
    display: flex;
    gap: 40px;

    .nav-item {
      color: #5c544b;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s ease;
      position: relative;

      &:hover,
      &.active {
        color: #ff6b6b;

        &::after {
          width: 100%;
        }
      }

      &::after {
        content: '';
        position: absolute;
        bottom: -6px;
        left: 0;
        width: 0;
        height: 2px;
        background: #ff6b6b;
        transition: width 0.3s ease;
      }
    }
  }

  .cta-btn {
    background: linear-gradient(135deg, #ff8a4c, #ff6b6b);
    border: none;
    box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(255, 107, 107, 0.5);
    }
  }

  .mobile-menu-btn {
    display: none;
    font-size: 24px;
    color: #ff6b6b;
  }

  .mobile-menu {
    display: none;
    background: #fffbf7;
    padding: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);

    .mobile-nav-item {
      display: block;
      padding: 12px 0;
      color: #5c544b;
      text-decoration: none;
      border-bottom: 1px solid #f0e8df;

      &:last-child {
        border-bottom: none;
      }
    }
  }
}

.service-hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
  padding-top: 70px;

  .hero-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 0;

    .warm-gradient {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, #fff8f0 0%, #ffece0 50%, #ffe0d0 100%);
    }

    .hero-shape {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.5;

      &.shape-1 {
        width: 500px;
        height: 500px;
        background: #ffd4a3;
        top: -100px;
        right: -100px;
      }

      &.shape-2 {
        width: 400px;
        height: 400px;
        background: #ffb088;
        bottom: -100px;
        left: -100px;
      }
    }
  }

  .hero-content {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr;
    gap: 60px;
    align-items: center;
  }

  .hero-text {
    .hero-title {
      font-size: 56px;
      font-weight: 800;
      line-height: 1.2;
      color: #2d2a26;
      margin-bottom: 20px;
    }

    .hero-subtitle {
      font-size: 18px;
      color: #6b5d4f;
      line-height: 1.8;
      margin-bottom: 32px;
    }

    .hero-buttons {
      display: flex;
      gap: 16px;
      margin-bottom: 40px;

      .ant-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 32px;
        height: 52px;
        border-radius: 26px;
        font-size: 16px;
      }

      .ant-btn-primary {
        background: linear-gradient(135deg, #ff8a4c, #ff6b6b);
        border: none;
        box-shadow: 0 8px 25px rgba(255, 107, 107, 0.4);

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 35px rgba(255, 107, 107, 0.5);
        }
      }

      .ant-btn-default {
        background: #fff;
        border-color: #ffd4a3;
        color: #ff6b6b;

        &:hover {
          background: #fff8f0;
          border-color: #ff6b6b;
          color: #ff6b6b;
        }
      }
    }
  }
}

.service-list {
  background: #fff;

  .services-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }

  .service-item {
    display: block;
    color: inherit;
    text-decoration: none;
    background: #fffbf7;
    border-radius: 20px;
    padding: 40px 32px;
    border: 2px solid transparent;
    transition: all 0.4s ease;

    &:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 50px rgba(255, 107, 107, 0.15);
      border-color: #ffd4a3;
      background: #fff;
    }

    .service-name {
      font-size: 22px;
      font-weight: 700;
      color: #2d2a26;
      margin-bottom: 12px;
    }

    .service-desc {
      font-size: 14px;
      color: #6b5d4f;
      line-height: 1.7;
      margin-bottom: 20px;
    }
  }
}

.service-footer {
  background: #2d2a26;
  padding: 80px 0 30px;

  .footer-content {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
    gap: 40px;
    padding-bottom: 50px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .footer-brand {
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;

      .logo-icon {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #ff8a4c, #ff6b6b);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 20px;
      }

      .logo-text {
        font-size: 20px;
        font-weight: 700;
        color: #fff;
      }
    }

    .footer-slogan {
      font-size: 14px;
      color: #a0958a;
      margin-bottom: 24px;
    }

    .footer-contact {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .contact-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        color: #c4b9ad;

        svg {
          color: #ff8a4c;
        }
      }
    }
  }

  .footer-column {
    .footer-title {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 20px;

      a {
        color: #fff;
        text-decoration: none;

        &:hover {
          color: #ff8a4c;
        }
      }
    }

    .footer-links {
      list-style: none;
      padding: 0;
      margin: 0;

      li {
        margin-bottom: 12px;

        a {
          color: #a0958a;
          text-decoration: none;
          font-size: 14px;
          transition: color 0.3s ease;
          cursor: pointer;

          &:hover {
            color: #ff8a4c;
          }
        }
      }
    }
  }

  .footer-bottom {
    padding-top: 30px;
    text-align: center;
    color: #6b5d4f;
    font-size: 13px;

    p {
      margin: 4px 0;
    }
  }
}

@media (max-width: 992px) {
  .section {
    padding: 60px 0;
  }

  .section-title {
    font-size: 32px;
  }

  .service-header {
    .nav-menu,
    .cta-btn {
      display: none;
    }

    .mobile-menu-btn {
      display: block;
    }

    .mobile-menu {
      display: block;
    }
  }

  .service-hero {
    .hero-text .hero-title {
      font-size: 36px;
    }
  }

  .service-list .services-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .service-footer .footer-content {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .section-title {
    font-size: 26px;
  }

  .service-list .services-grid,
  .service-footer .footer-content {
    grid-template-columns: 1fr;
  }

  .service-hero .hero-text .hero-title {
    font-size: 28px;
  }

  .service-hero .hero-text .hero-buttons {
    flex-direction: column;
  }
}
</style>
