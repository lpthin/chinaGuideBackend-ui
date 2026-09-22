<template>
  <div class="simple-template">
    <div v-if="loadError" class="load-error">{{ loadError }}</div>
    <header class="simple-header" :class="{ scrolled: isScrolled }">
      <div class="container">
        <div class="header-content">
          <a v-if="companyInfo.name" class="logo" @click="navigateTo('/')">
            <span class="logo-mark">{{ companyInfo.name.charAt(0) }}</span>
            <span class="logo-text">{{ companyInfo.name }}</span>
          </a>
          <nav class="nav-menu">
            <a
              v-for="item in simpleNavItems"
              :key="item.key"
              :href="item.path"
              class="nav-item"
              :class="{ active: currentPath === item.path }"
              @click.prevent="navigateTo(item.path)"
            >
              {{ item.label }}
            </a>
          </nav>
          <a-button type="text" class="menu-toggle" @click="mobileMenuVisible = !mobileMenuVisible">
            <component :is="mobileMenuVisible ? CloseOutlined : MenuOutlined" />
          </a-button>
        </div>
      </div>
      <div v-if="mobileMenuVisible" class="mobile-menu">
        <a
          v-for="item in simpleNavItems"
          :key="item.key"
          :href="item.path"
          class="mobile-nav-item"
          @click.prevent="navigateTo(item.path); mobileMenuVisible = false"
        >
          {{ item.label }}
        </a>
      </div>
    </header>

    <section v-if="heroData" class="simple-hero">
      <div class="container">
        <div class="hero-content">
          <span v-if="companyInfo.slogan" class="hero-label">{{ companyInfo.slogan }}</span>
          <h1 v-if="heroData.title" class="hero-title">
            {{ heroData.title }}
          </h1>
          <p v-if="heroData.description" class="hero-desc">
            {{ heroData.description }}
          </p>
          <a v-if="cases.length" class="scroll-indicator" @click="scrollToWorks">
            <span>探索作品</span>
            <component :is="DownOutlined" />
          </a>
        </div>
      </div>
    </section>

    <section v-if="cases.length" class="simple-works section" id="works">
      <div class="container">
        <div class="section-header">
          <span class="section-number">01</span>
          <h2 class="section-title">精选作品</h2>
        </div>
        <div class="works-masonry">
          <div
            v-for="(work, index) in cases"
            :key="work.id"
            class="work-item"
            :class="`work-${index + 1}`"
          >
            <div class="work-image">
              <img v-if="work.coverImage" :src="work.coverImage" :alt="work.title || ''" />
              <div class="work-overlay">
                <div class="work-info">
                  <span v-if="work.industry" class="work-category">{{ work.industry }}</span>
                  <h3 class="work-title">{{ work.title }}</h3>
                  <p v-if="work.summary" class="work-desc">{{ work.summary }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="heroData?.description || companyInfo.description" class="simple-about section">
      <div class="container">
        <div class="about-grid">
          <div class="about-left">
            <span class="section-number">02</span>
            <h2 class="section-title">
              关于
              <br />
              我们
            </h2>
          </div>
          <div class="about-right">
            <div class="about-text">
              <p v-if="heroData?.description" class="lead">
                {{ heroData.description }}
              </p>
              <p v-if="companyInfo.description">
                {{ companyInfo.description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="contactInfo" class="simple-contact section">
      <div class="container">
        <div class="contact-content">
          <span class="section-number">03</span>
          <h2 class="contact-title">
            有项目想法？
            <br />
            让我们聊聊
          </h2>
          <p v-if="contactInfo.description" class="contact-desc">
            {{ contactInfo.description }}
          </p>
          <div class="contact-info">
            <a v-if="contactInfo.email" :href="`mailto:${contactInfo.email}`" class="contact-email">
              {{ contactInfo.email }}
              <component :is="ArrowRightOutlined" />
            </a>
            <div v-if="contactInfo.address || contactInfo.phone" class="contact-details">
              <span v-if="contactInfo.address">{{ contactInfo.address }}</span>
              <span v-if="contactInfo.phone">{{ contactInfo.phone }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="simple-footer">
      <div class="container">
        <div class="footer-content">
          <div v-if="companyInfo.name" class="footer-left">
            <span class="logo-mark">{{ companyInfo.name.charAt(0) }}</span>
            <span>{{ companyInfo.name }}</span>
          </div>
          <div class="footer-right">
            <span v-if="companyInfo.copyright">{{ companyInfo.copyright }}</span>
          </div>
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
  MenuOutlined,
  CloseOutlined,
  DownOutlined,
  ArrowRightOutlined
} from '@ant-design/icons-vue'
import {
  getPortalData,
  type ApiSeoMeta,
  type ApiCompanyInfo,
  type ApiHeroData,
  type ApiCaseItem,
  type ApiContactInfo
} from '../api/portalData'

const router = useRouter()
const route = useRoute()
const isScrolled = ref(false)
const mobileMenuVisible = ref(false)
const currentPath = ref('/')

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
const cases = ref<ApiCaseItem[]>([])
const contactInfo = ref<ApiContactInfo | null>(null)
const loadError = ref('')

// 站点导航没有对应的后端表，属于前端自身的 UI 骨架，与 router 中真实存在的路由保持一致
const simpleNavItems = [
  { key: 'home', label: '首页', path: '/' },
  { key: 'works', label: '作品', path: '/cases' },
  { key: 'about', label: '关于', path: '/about' },
  { key: 'contact', label: '联系', path: '/contact' }
]

const handleScroll = () => {
  isScrolled.value = window.scrollY > 30
}

const navigateTo = (path: string) => {
  currentPath.value = path
  router.push(path)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const scrollToWorks = () => {
  const worksSection = document.getElementById('works')
  if (worksSection) {
    worksSection.scrollIntoView({ behavior: 'smooth' })
  }
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
    cases.value = data.cases || []
    contactInfo.value = data.contactInfo || null
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
.simple-template {
  min-height: 100vh;
  background: #fff;
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  font-weight: 300;
  letter-spacing: 0.02em;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 40px;
}

.load-error {
  position: relative;
  z-index: 1001;
  margin: 100px auto 0;
  max-width: 1200px;
  padding: 16px 40px;
  background: #fff1f0;
  border: 1px solid #ffa39e;
  border-radius: 8px;
  color: #cf1322;
  text-align: center;
}

.section {
  padding: 140px 0;
}

.simple-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  background: transparent;

  &.scrolled {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid #f0f0f0;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 80px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: #1a1a1a;
    cursor: pointer;

    .logo-mark {
      width: 36px;
      height: 36px;
      background: #1a1a1a;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .logo-text {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.2em;
    }
  }

  .nav-menu {
    display: flex;
    gap: 48px;

    .nav-item {
      color: #666;
      text-decoration: none;
      font-size: 14px;
      font-weight: 400;
      transition: color 0.3s ease;
      position: relative;

      &:hover,
      &.active {
        color: #1a1a1a;

        &::after {
          width: 100%;
        }
      }

      &::after {
        content: '';
        position: absolute;
        bottom: -4px;
        left: 0;
        width: 0;
        height: 1px;
        background: #1a1a1a;
        transition: width 0.3s ease;
      }
    }
  }

  .menu-toggle {
    display: none;
    font-size: 20px;
    color: #1a1a1a;
  }

  .mobile-menu {
    display: none;
    background: #fff;
    padding: 20px 40px;
    border-top: 1px solid #f0f0f0;

    .mobile-nav-item {
      display: block;
      padding: 16px 0;
      color: #1a1a1a;
      text-decoration: none;
      font-size: 16px;
      border-bottom: 1px solid #f5f5f5;

      &:last-child {
        border-bottom: none;
      }
    }
  }
}

.simple-hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding-top: 80px;
  position: relative;

  .hero-content {
    max-width: 800px;
  }

  .hero-label {
    display: inline-block;
    font-size: 12px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 32px;
  }

  .hero-title {
    font-size: 72px;
    font-weight: 300;
    line-height: 1.2;
    margin-bottom: 32px;
    letter-spacing: -0.02em;
  }

  .hero-desc {
    font-size: 18px;
    line-height: 1.8;
    color: #666;
    margin-bottom: 48px;
    font-weight: 300;
  }

  .scroll-indicator {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #999;
    font-size: 12px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 0.3s ease;

    &:hover {
      color: #1a1a1a;

      svg {
        transform: translateY(4px);
      }
    }

    svg {
      font-size: 16px;
      transition: transform 0.3s ease;
      animation: bounce 2s infinite;
    }
  }
}

.simple-works {
  background: #fafafa;

  .section-header {
    display: flex;
    align-items: baseline;
    gap: 24px;
    margin-bottom: 60px;

    .section-number {
      font-size: 14px;
      color: #ccc;
      letter-spacing: 0.1em;
    }

    .section-title {
      font-size: 42px;
      font-weight: 300;
      letter-spacing: -0.02em;
      margin: 0;
    }
  }

  .works-masonry {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 300px;
    gap: 24px;

    .work-item {
      position: relative;
      overflow: hidden;
      background: #eee;

      &.work-1 {
        grid-column: span 2;
        grid-row: span 2;
      }

      &.work-4 {
        grid-row: span 2;
      }

      &.work-6 {
        grid-column: span 2;
      }

      .work-image {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .work-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0);
          display: flex;
          align-items: flex-end;
          padding: 32px;
          transition: background 0.4s ease;

          .work-info {
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.4s ease;

            .work-category {
              display: block;
              font-size: 12px;
              letter-spacing: 0.2em;
              text-transform: uppercase;
              color: rgba(255, 255, 255, 0.7);
              margin-bottom: 8px;
            }

            .work-title {
              font-size: 24px;
              font-weight: 400;
              color: #fff;
              margin: 0 0 8px;
            }

            .work-desc {
              font-size: 14px;
              color: rgba(255, 255, 255, 0.8);
              margin: 0;
              max-width: 400px;
              line-height: 1.6;
            }
          }
        }
      }

      &:hover {
        .work-image {
          img {
            transform: scale(1.05);
          }

          .work-overlay {
            background: rgba(0, 0, 0, 0.6);

            .work-info {
              transform: translateY(0);
              opacity: 1;
            }
          }
        }
      }
    }
  }
}

.simple-about {
  .about-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 80px;
    align-items: start;
  }

  .about-left {
    position: sticky;
    top: 120px;

    .section-number {
      font-size: 14px;
      color: #ccc;
      letter-spacing: 0.1em;
      display: block;
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 42px;
      font-weight: 300;
      letter-spacing: -0.02em;
      line-height: 1.3;
      margin: 0;
    }
  }

  .about-right {
    .about-text {
      .lead {
        font-size: 22px;
        line-height: 1.6;
        color: #1a1a1a;
        margin-bottom: 24px;
        font-weight: 300;
      }

      p {
        font-size: 16px;
        line-height: 1.8;
        color: #666;
        margin: 0;
      }
    }
  }
}

.simple-contact {
  background: #1a1a1a;
  color: #fff;

  .contact-content {
    max-width: 700px;

    .section-number {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.4);
      letter-spacing: 0.1em;
      display: block;
      margin-bottom: 32px;
    }

    .contact-title {
      font-size: 56px;
      font-weight: 300;
      line-height: 1.2;
      letter-spacing: -0.02em;
      margin-bottom: 24px;
    }

    .contact-desc {
      font-size: 18px;
      line-height: 1.8;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 60px;
      font-weight: 300;
    }

    .contact-info {
      margin-bottom: 48px;

      .contact-email {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        font-size: 32px;
        color: #fff;
        text-decoration: none;
        margin-bottom: 24px;
        transition: all 0.3s ease;
        font-weight: 300;

        &:hover {
          gap: 20px;
          color: rgba(255, 255, 255, 0.7);
        }

        svg {
          font-size: 24px;
        }
      }

      .contact-details {
        display: flex;
        gap: 32px;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.5);
      }
    }
  }
}

.simple-footer {
  background: #1a1a1a;
  color: rgba(255, 255, 255, 0.4);
  padding: 32px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);

  .footer-content {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .footer-left {
      display: flex;
      align-items: center;
      gap: 10px;

      .logo-mark {
        width: 28px;
        height: 28px;
        background: #fff;
        color: #1a1a1a;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
      }

      span:last-child {
        font-size: 12px;
        letter-spacing: 0.2em;
        color: rgba(255, 255, 255, 0.6);
      }
    }

    .footer-right {
      font-size: 12px;
      letter-spacing: 0.05em;
    }
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(6px);
  }
}

@media (max-width: 992px) {
  .container {
    padding: 0 24px;
  }

  .section {
    padding: 80px 0;
  }

  .simple-header {
    .nav-menu {
      display: none;
    }

    .menu-toggle {
      display: block;
    }

    .mobile-menu {
      display: block;
    }
  }

  .simple-hero {
    .hero-title {
      font-size: 48px;
    }

    .hero-desc {
      font-size: 16px;
    }
  }

  .simple-works {
    .works-masonry {
      grid-template-columns: repeat(2, 1fr);
      grid-auto-rows: 250px;

      .work-item {
        &.work-1,
        &.work-6 {
          grid-column: span 2;
        }

        &.work-4 {
          grid-row: span 1;
        }
      }
    }
  }

  .simple-about {
    .about-grid {
      grid-template-columns: 1fr;
      gap: 40px;
    }

    .about-left {
      position: static;

      .section-title {
        font-size: 32px;
      }
    }
  }

  .simple-contact {
    .contact-title {
      font-size: 36px;
    }

    .contact-email {
      font-size: 24px !important;
    }
  }
}

@media (max-width: 576px) {
  .container {
    padding: 0 20px;
  }

  .simple-hero {
    .hero-title {
      font-size: 36px;
    }

    .hero-desc {
      font-size: 15px;
    }
  }

  .simple-works {
    .section-header {
      flex-direction: column;
      gap: 8px;

      .section-title {
        font-size: 28px;
      }
    }

    .works-masonry {
      grid-template-columns: 1fr;
      grid-auto-rows: 280px;
      gap: 16px;

      .work-item {
        &.work-1,
        &.work-6 {
          grid-column: span 1;
          grid-row: span 1;
        }
      }
    }
  }

  .simple-about {
    .about-right {
      .about-text .lead {
        font-size: 18px;
      }
    }
  }

  .simple-contact {
    .contact-title {
      font-size: 28px;
    }

    .contact-desc {
      font-size: 15px;
    }

    .contact-email {
      font-size: 18px !important;
    }

    .contact-details {
      flex-direction: column;
      gap: 8px !important;
    }
  }

  .simple-footer {
    .footer-content {
      flex-direction: column;
      gap: 16px;
      text-align: center;
    }
  }
}
</style>
