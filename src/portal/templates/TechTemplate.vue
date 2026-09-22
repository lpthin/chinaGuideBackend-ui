<template>
  <div class="tech-template">
    <header class="tech-header" :class="{ scrolled: isScrolled }">
      <div class="container">
        <div class="header-content">
          <div class="logo">
            <span class="logo-icon">
              <component :is="ApiOutlined" />
            </span>
            <span class="logo-text">{{ companyInfo.name }}</span>
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
          <a-button type="primary" class="contact-btn" @click="navigateTo('/contact')">
            立即咨询
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

    <section class="tech-hero">
      <div class="hero-bg">
        <div class="gradient-bg"></div>
        <div class="grid-pattern"></div>
        <div class="floating-shapes">
          <div class="shape shape-1"></div>
          <div class="shape shape-2"></div>
          <div class="shape shape-3"></div>
        </div>
      </div>
      <div class="container">
        <div class="hero-content">
          <div class="hero-text">
            <div v-if="companyInfo.slogan" class="hero-badge">
              <component :is="RocketOutlined" />
              <span>{{ companyInfo.slogan }}</span>
            </div>
            <h1 class="hero-title">{{ heroData.title }}</h1>
            <p v-if="heroData.description" class="hero-description">{{ heroData.description }}</p>
            <div class="hero-buttons">
              <a-button type="primary" size="large" @click="navigateTo('/contact')">
                {{ heroData.buttonText || '立即咨询' }}
                <component :is="ArrowRightOutlined" />
              </a-button>
              <a-button
                v-if="heroData.buttonLink"
                size="large"
                ghost
                @click="openLink(heroData.buttonLink, '/about')"
              >
                了解更多
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="services.length" class="tech-services section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">核心服务</span>
          <h2 class="section-title">我们的服务</h2>
        </div>
        <div class="services-grid">
          <a
            v-for="service in services"
            :key="service.id"
            class="service-card"
            :href="service.link || undefined"
            @click.prevent="openLink(service.link, '/services')"
          >
            <h3 class="service-title">{{ service.title }}</h3>
            <p v-if="service.summary" class="service-description">{{ service.summary }}</p>
          </a>
        </div>
      </div>
    </section>

    <section v-if="aboutDescription" class="tech-about section">
      <div class="container">
        <div class="about-content">
          <div class="about-text">
            <span class="section-tag">关于我们</span>
            <h2 class="section-title">关于我们</h2>
            <p class="about-description">{{ aboutDescription }}</p>
            <a-button type="primary" size="large" @click="navigateTo('/about')">
              了解更多
              <component :is="ArrowRightOutlined" />
            </a-button>
          </div>
        </div>
      </div>
    </section>

    <section v-if="cases.length" class="tech-cases section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">案例展示</span>
          <h2 class="section-title">客户案例</h2>
        </div>
        <div class="cases-grid">
          <div v-for="item in cases" :key="item.id" class="case-card">
            <div v-if="item.coverImage" class="case-image">
              <img :src="item.coverImage" :alt="item.title || ''" />
              <div class="case-overlay">
                <a-button type="primary" ghost @click="openLink(item.link, '/cases')">
                  查看详情
                </a-button>
              </div>
            </div>
            <div class="case-content">
              <span v-if="item.industry" class="case-category">{{ item.industry }}</span>
              <h3 class="case-title">{{ item.title }}</h3>
              <p v-if="item.customerName" class="case-customer">{{ item.customerName }}</p>
              <p v-if="item.summary" class="case-description">{{ item.summary }}</p>
              <a
                v-if="item.link && !item.coverImage"
                class="case-link"
                :href="item.link"
                @click.prevent="openLink(item.link)"
              >
                查看详情 <component :is="ArrowRightOutlined" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="newsList.length" class="tech-news section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">新闻动态</span>
          <h2 class="section-title">最新资讯</h2>
          <p class="section-subtitle">了解最新动态和行业资讯</p>
        </div>
        <div class="news-grid">
          <div v-for="news in newsList" :key="news.id" class="news-card">
            <div v-if="news.coverImage" class="news-image">
              <img :src="news.coverImage" :alt="news.title || ''" />
            </div>
            <div class="news-content">
              <span v-if="news.category" class="news-category">{{ news.category }}</span>
              <div v-if="news.publishedAt" class="news-meta">
                <span class="news-date">
                  <component :is="CalendarOutlined" />
                  {{ formatDate(news.publishedAt) }}
                </span>
              </div>
              <h3 class="news-title">{{ news.title }}</h3>
              <p v-if="news.summary" class="news-summary">{{ news.summary }}</p>
              <a
                class="news-link"
                :href="news.link || undefined"
                @click.prevent="openLink(news.link, '/news')"
              >
                阅读全文 <component :is="ArrowRightOutlined" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="tech-contact section">
      <div class="container">
        <div class="contact-wrapper">
          <div class="contact-info">
            <span class="section-tag light">联系方式</span>
            <h2 class="section-title light">联系我们</h2>
            <p v-if="contactInfo.description" class="contact-subtitle">{{ contactInfo.description }}</p>
            <div v-if="contactInfo.address || contactInfo.phone || contactInfo.email" class="contact-details">
              <div v-if="contactInfo.address" class="contact-item">
                <div class="contact-icon">
                  <component :is="EnvironmentOutlined" />
                </div>
                <div class="contact-text">
                  <h4>公司地址</h4>
                  <p>{{ contactInfo.address }}</p>
                </div>
              </div>
              <div v-if="contactInfo.phone" class="contact-item">
                <div class="contact-icon">
                  <component :is="PhoneOutlined" />
                </div>
                <div class="contact-text">
                  <h4>联系电话</h4>
                  <p>{{ contactInfo.phone }}</p>
                </div>
              </div>
              <div v-if="contactInfo.email" class="contact-item">
                <div class="contact-icon">
                  <component :is="MailOutlined" />
                </div>
                <div class="contact-text">
                  <h4>电子邮箱</h4>
                  <p>{{ contactInfo.email }}</p>
                </div>
              </div>
            </div>
          </div>
          <div v-if="contactInfo.email" class="contact-form-wrapper">
            <div class="contact-form-card">
              <h3>在线咨询</h3>
              <a-form layout="vertical">
                <a-form-item label="您的姓名">
                  <a-input v-model:value="inquiry.name" size="large" placeholder="请输入您的姓名" />
                </a-form-item>
                <a-form-item label="联系电话">
                  <a-input v-model:value="inquiry.phone" size="large" placeholder="请输入您的电话" />
                </a-form-item>
                <a-form-item label="电子邮箱">
                  <a-input v-model:value="inquiry.email" size="large" placeholder="请输入您的邮箱" />
                </a-form-item>
                <a-form-item label="咨询内容">
                  <a-textarea
                    v-model:value="inquiry.content"
                    :rows="4"
                    size="large"
                    placeholder="请描述您的需求..."
                  />
                </a-form-item>
                <a-button type="primary" size="large" block @click="sendInquiry">
                  提交咨询
                  <component :is="SendOutlined" />
                </a-button>
                <p class="form-hint">提交后将通过本机邮件客户端发送至 {{ contactInfo.email }}</p>
              </a-form>
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="tech-footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-brand">
            <div class="logo">
              <span class="logo-icon">
                <component :is="ApiOutlined" />
              </span>
              <span v-if="companyInfo.name" class="logo-text">{{ companyInfo.name }}</span>
            </div>
            <p v-if="companyInfo.slogan" class="footer-slogan">{{ companyInfo.slogan }}</p>
            <ul v-if="contactChannels.length" class="contact-channels">
              <li v-for="channel in contactChannels" :key="channel.label" class="channel-item">
                <span class="channel-label">{{ channel.label }}</span>
                <a
                  v-if="channel.external"
                  class="channel-value"
                  :href="channel.value"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ channel.value }}</a>
                <span v-else class="channel-value">{{ channel.value }}</span>
              </li>
            </ul>
          </div>
          <div v-for="(group, groupIndex) in footerGroups" :key="`${group.title}-${groupIndex}`" class="footer-column">
            <h4 v-if="group.showTitle" class="footer-title">{{ group.title }}</h4>
            <ul class="footer-links">
              <li v-for="(link, index) in group.links" :key="`${group.title}-${index}`">
                <a :href="link.url" @click.prevent="openLink(link.url)">{{ link.title }}</a>
              </li>
            </ul>
          </div>
        </div>
        <div v-if="companyInfo.copyright" class="footer-bottom">
          <p>{{ companyInfo.copyright }}</p>
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
  ApiOutlined,
  MenuOutlined,
  RocketOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  SendOutlined
} from '@ant-design/icons-vue'
import {
  getPortalData,
  type ApiHeroData,
  type ApiServiceItem,
  type ApiCaseItem,
  type ApiNewsItem,
  type ApiContactInfo,
  type ApiCompanyInfo,
  type ApiFooterLink,
  type ApiSeoMeta
} from '../api/portalData'
import { formatDate } from '../../utils/format'

// 固定的站点导航（路由均在门户中真实存在），与站点内容无关
const navItems: { key: string; label: string; path: string }[] = [
  { key: 'home', label: '首页', path: '/' },
  { key: 'about', label: '关于我们', path: '/about' },
  { key: 'services', label: '服务项目', path: '/services' },
  { key: 'cases', label: '案例展示', path: '/cases' },
  { key: 'news', label: '新闻动态', path: '/news' },
  { key: 'contact', label: '联系我们', path: '/contact' }
]

const router = useRouter()
const route = useRoute()
const isScrolled = ref(false)
const mobileMenuVisible = ref(false)
const currentPath = ref('/')
const loading = ref(true)
const error = ref<string | null>(null)

// 从 API 加载的数据：后端没有的字段不声明也不兜底
const heroData = ref<ApiHeroData>({
  title: '',
  description: ''
})
const services = ref<ApiServiceItem[]>([])
const cases = ref<ApiCaseItem[]>([])
const newsList = ref<ApiNewsItem[]>([])
const footerLinks = ref<ApiFooterLink[]>([])
const contactInfo = ref<ApiContactInfo>({
  phone: '',
  email: '',
  website: '',
  address: '',
  description: '',
  serviceHotline: '',
  wechat: '',
  weibo: '',
  douyin: '',
  linkedin: '',
  github: ''
})
const companyInfo = ref<ApiCompanyInfo>({
  name: '',
  logo: '',
  slogan: '',
  copyright: '',
  description: ''
})
const seoMeta = ref<ApiSeoMeta | null>(null)
const faviconUrl = ref<string>('')

const aboutDescription = computed(
  () => companyInfo.value?.description || heroData.value?.description || ''
)

const handleScroll = () => {
  isScrolled.value = window.scrollY > 50
}

const navigateTo = (path: string) => {
  currentPath.value = path
  router.push(path)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const isExternalUrl = (value: string) =>
  /^https?:\/\//i.test(value) || value.startsWith('//')

/** 后端给的 link 可能是站内路径，也可能是完整外链 */
const openLink = (url?: string | null, fallback = '') => {
  const target = url || fallback
  if (!target) return
  if (isExternalUrl(target)) {
    window.open(target, '_blank', 'noopener')
    return
  }
  navigateTo(target)
}

const contactChannels = computed(() => {
  const info = contactInfo.value
  const source: [string, string | null][] = [
    ['官网', info?.website],
    ['服务热线', info?.serviceHotline],
    ['微信', info?.wechat],
    ['微博', info?.weibo],
    ['抖音', info?.douyin],
    ['LinkedIn', info?.linkedin],
    ['GitHub', info?.github]
  ]
  return source
    .filter(([, value]) => !!value)
    .map(([label, value]) => ({
      label,
      value: value as string,
      external: isExternalUrl(String(value))
    }))
})

const inquiry = ref({ name: '', phone: '', email: '', content: '' })

/** 门户是公开页面，留言写入需要鉴权的 /api/guestbook，游客拿不到身份；
 *  这里只能用邮件客户端把内容发给站点邮箱，不假装「提交成功」。 */
const sendInquiry = () => {
  const to = contactInfo.value.email
  if (!to) return
  const subject = `${inquiry.value.name || '门户网站咨询'} - 在线咨询`
  const body = [
    `姓名：${inquiry.value.name}`,
    `电话：${inquiry.value.phone}`,
    `邮箱：${inquiry.value.email}`,
    '',
    inquiry.value.content
  ].join('\n')
  window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** footerLinks 是扁平结构 { title, url, type, children }，把每组压成可点击的叶子节点 */
const collectFooterLeaves = (group: ApiFooterLink): ApiFooterLink[] => {
  const children = group.children ?? []
  if (!children.length) return group.url ? [group] : []
  return children.flatMap(collectFooterLeaves)
}

const footerGroups = computed(() => {
  const groups: { title: string; showTitle: boolean; links: ApiFooterLink[] }[] = []
  for (const group of footerLinks.value ?? []) {
    const leaves = collectFooterLeaves(group)
    if (!leaves.length) continue
    groups.push({
      title: group.title,
      showTitle: leaves.length > 1 || leaves[0] !== group,
      links: leaves
    })
  }
  return groups
})

const loadData = async () => {
  try {
    loading.value = true
    error.value = null

    const data = await getPortalData()

    heroData.value = data.heroData ?? heroData.value
    services.value = data.services ?? []
    cases.value = data.cases ?? []
    newsList.value = data.newsList ?? []
    footerLinks.value = data.footerLinks ?? []
    contactInfo.value = data.contactInfo ?? contactInfo.value
    companyInfo.value = data.companyInfo ?? companyInfo.value
    seoMeta.value = data.seoMeta ?? null
    faviconUrl.value = data.faviconUrl ?? ''
  } catch (err) {
    console.error('加载数据失败:', err)
    error.value = '加载失败，请稍后重试'
  } finally {
    loading.value = false
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
.tech-template {
  min-height: 100vh;
  background: #fff;
  color: #1a1a2e;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
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
  padding: 6px 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
  color: #6366f1;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;

  &.light {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }
}

.section-title {
  font-size: 42px;
  font-weight: 700;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #1a1a2e, #4c1d95);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;

  &.light {
    background: linear-gradient(135deg, #fff, #c4b5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.section-subtitle {
  font-size: 16px;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
}

.tech-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  transition: all 0.3s ease;
  background: transparent;

  &.scrolled {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
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
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 20px;
    }

    .logo-text {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }

  .nav-menu {
    display: flex;
    gap: 40px;

    .nav-item {
      color: #475569;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s ease;
      position: relative;

      &:hover,
      &.active {
        color: #6366f1;

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
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        transition: width 0.3s ease;
      }
    }
  }

  .contact-btn {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
    }
  }

  .mobile-menu-btn {
    display: none;
    font-size: 24px;
    color: #6366f1;
  }

  .mobile-menu {
    display: none;
    background: #fff;
    padding: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);

    .mobile-nav-item {
      display: block;
      padding: 12px 0;
      color: #475569;
      text-decoration: none;
      border-bottom: 1px solid #f1f5f9;

      &:last-child {
        border-bottom: none;
      }
    }
  }
}

.tech-hero {
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

    .gradient-bg {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
    }

    .grid-pattern {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image:
        linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px);
      background-size: 50px 50px;
    }

    .floating-shapes {
      .shape {
        position: absolute;
        border-radius: 50%;
        filter: blur(60px);
        opacity: 0.5;

        &.shape-1 {
          width: 400px;
          height: 400px;
          background: #6366f1;
          top: 10%;
          left: -100px;
          animation: float 8s ease-in-out infinite;
        }

        &.shape-2 {
          width: 300px;
          height: 300px;
          background: #8b5cf6;
          bottom: 20%;
          right: -50px;
          animation: float 10s ease-in-out infinite reverse;
        }

        &.shape-3 {
          width: 200px;
          height: 200px;
          background: #a78bfa;
          top: 50%;
          left: 50%;
          animation: float 12s ease-in-out infinite;
        }
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
    max-width: 820px;

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 30px;
      color: #a78bfa;
      font-size: 14px;
      margin-bottom: 24px;
    }

    .hero-title {
      font-size: 56px;
      font-weight: 800;
      line-height: 1.2;
      color: #fff;
      margin-bottom: 24px;
    }

    .hero-description {
      font-size: 18px;
      color: #94a3b8;
      line-height: 1.8;
      margin-bottom: 32px;
    }

    .hero-buttons {
      display: flex;
      gap: 16px;
      margin-bottom: 0;

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
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none;
        box-shadow: 0 8px 30px rgba(99, 102, 241, 0.5);

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(99, 102, 241, 0.6);
        }
      }

      .ant-btn-ghost {
        color: #fff;
        border-color: rgba(255, 255, 255, 0.3);

        &:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.5);
        }
      }
    }
  }
}

.tech-services {
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);

  .services-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }

  .service-card {
    display: block;
    background: #fff;
    border-radius: 20px;
    padding: 40px 32px;
    border: 1px solid #e2e8f0;
    transition: all 0.4s ease;
    position: relative;
    overflow: hidden;
    color: inherit;
    text-decoration: none;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.4s ease;
    }

    &:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 40px rgba(99, 102, 241, 0.15);
      border-color: transparent;

      &::before {
        transform: scaleX(1);
      }
    }

    .service-title {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 12px;
    }

    .service-description {
      font-size: 14px;
      color: #64748b;
      line-height: 1.7;
      margin: 0;
    }
  }
}

.tech-about {
  .about-content {
    display: grid;
    grid-template-columns: 1fr;
    gap: 40px;
    align-items: center;
  }

  .about-text {
    max-width: 880px;
    margin: 0 auto;

    .section-tag {
      margin-bottom: 16px;
    }

    .section-title {
      text-align: left;
      margin-bottom: 20px;
    }

    .about-description {
      font-size: 16px;
      color: #64748b;
      line-height: 1.8;
      margin-bottom: 32px;
    }

    .ant-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 52px;
      padding: 0 32px;
      border-radius: 26px;
    }
  }
}

.tech-cases {
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);

  .cases-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 32px;
  }

  .case-card {
    background: #fff;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    transition: all 0.4s ease;

    &:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);

      .case-image {
        .case-overlay {
          opacity: 1;
        }
      }
    }

    .case-image {
      position: relative;
      height: 280px;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.5s ease;
      }

      .case-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(99, 102, 241, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.4s ease;
      }
    }

    .case-content {
      padding: 28px;

      .case-category {
        display: inline-block;
        padding: 4px 12px;
        background: rgba(99, 102, 241, 0.1);
        color: #6366f1;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 12px;
      }

      .case-title {
        font-size: 20px;
        font-weight: 700;
        color: #1a1a2e;
        margin-bottom: 8px;
      }

      .case-customer {
        font-size: 14px;
        font-weight: 500;
        color: #6366f1;
        margin: 0 0 12px;
      }

      .case-description {
        font-size: 14px;
        color: #64748b;
        line-height: 1.7;
        margin-bottom: 16px;
      }

      .case-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #6366f1;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
        transition: gap 0.3s ease;

        &:hover {
          gap: 10px;
        }
      }
    }
  }
}

.tech-news {
  .news-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }

  .news-card {
    background: #fff;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.1);
    }

    .news-image {
      position: relative;
      height: 200px;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .news-content {
      padding: 24px;

      .news-category {
        display: inline-block;
        padding: 4px 12px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #fff;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 12px;
      }

      .news-meta {
        display: flex;
        gap: 20px;
        margin-bottom: 12px;
        font-size: 13px;
        color: #94a3b8;

        span {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }

      .news-title {
        font-size: 18px;
        font-weight: 600;
        color: #1a1a2e;
        margin-bottom: 12px;
        line-height: 1.5;
      }

      .news-summary {
        font-size: 14px;
        color: #64748b;
        line-height: 1.6;
        margin-bottom: 16px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .news-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #6366f1;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
        transition: gap 0.3s ease;

        &:hover {
          gap: 10px;
        }
      }
    }
  }
}

.tech-contact {
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
    z-index: 0;
  }

  .container {
    position: relative;
    z-index: 1;
  }

  .contact-wrapper {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 80px;
    align-items: center;
  }

  .contact-info {
    .section-title {
      text-align: left;
      margin-bottom: 16px;
    }

    .contact-subtitle {
      font-size: 16px;
      color: #94a3b8;
      margin-bottom: 40px;
    }

    .contact-details {
      display: flex;
      flex-direction: column;
      gap: 24px;

      .contact-item {
        display: flex;
        gap: 16px;

        .contact-icon {
          width: 52px;
          height: 52px;
          background: rgba(99, 102, 241, 0.2);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
          font-size: 22px;
          flex-shrink: 0;
        }

        .contact-text {
          h4 {
            font-size: 16px;
            font-weight: 600;
            color: #fff;
            margin-bottom: 4px;
          }

          p {
            font-size: 14px;
            color: #94a3b8;
            margin: 0;
          }
        }
      }
    }
  }

  .contact-form-wrapper {
    .contact-form-card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 40px;

      h3 {
        font-size: 24px;
        font-weight: 700;
        color: #fff;
        margin-bottom: 24px;
      }

      :deep(.ant-form-item-label > label) {
        color: #cbd5e1;
      }

      .form-hint {
        margin-top: 12px;
        font-size: 12px;
        color: #94a3b8;
      }

      :deep(.ant-input),
      :deep(.ant-input-affix-wrapper) {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.15);
        color: #fff;

        &:hover {
          border-color: #6366f1;
        }

        &.ant-input-focused,
        &.ant-input-affix-wrapper-focused {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }
      }

      :deep(.ant-input::placeholder) {
        color: #64748b;
      }

      .ant-btn-primary {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none;
        height: 52px;
        border-radius: 26px;
        font-size: 16px;
        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(99, 102, 241, 0.5);
        }
      }
    }
  }
}

.tech-footer {
  background: #0f0c29;
  padding: 80px 0 30px;

  .footer-content {
    display: grid;
    grid-template-columns: minmax(260px, 2fr) repeat(auto-fit, minmax(140px, 1fr));
    gap: 40px;
    padding-bottom: 60px;
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
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-radius: 10px;
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
      color: #64748b;
      margin-bottom: 24px;
      line-height: 1.7;
    }

    .contact-channels {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .channel-item {
        display: flex;
        gap: 8px;
        font-size: 13px;
        line-height: 1.6;
      }

      .channel-label {
        color: #64748b;
        flex-shrink: 0;
      }

      .channel-value {
        color: #94a3b8;
        text-decoration: none;
        word-break: break-all;

        &:hover {
          color: #a78bfa;
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
    }

    .footer-links {
      list-style: none;
      padding: 0;
      margin: 0;

      li {
        margin-bottom: 12px;

        a {
          color: #64748b;
          text-decoration: none;
          font-size: 14px;
          transition: color 0.3s ease;
          cursor: pointer;

          &:hover {
            color: #a78bfa;
          }
        }
      }
    }
  }

  .footer-bottom {
    padding-top: 30px;
    text-align: center;
    color: #475569;
    font-size: 13px;

    p {
      margin: 4px 0;
    }
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

@media (max-width: 992px) {
  .section {
    padding: 60px 0;
  }

  .section-title {
    font-size: 32px;
  }

  .tech-header {
    .nav-menu,
    .contact-btn {
      display: none;
    }

    .mobile-menu-btn {
      display: block;
    }

    .mobile-menu {
      display: block;
    }
  }

  .tech-hero {
    .hero-content {
      grid-template-columns: 1fr;
      gap: 40px;
    }

    .hero-text {
      .hero-title {
        font-size: 36px;
      }
    }
  }

  .tech-services .services-grid,
  .tech-news .news-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .tech-about .about-content,
  .tech-contact .contact-wrapper {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .tech-cases .cases-grid {
    grid-template-columns: 1fr;
  }

  .tech-footer .footer-content {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .section-title {
    font-size: 26px;
  }

  .tech-services .services-grid,
  .tech-news .news-grid,
  .tech-footer .footer-content {
    grid-template-columns: 1fr;
  }

  .tech-hero .hero-text .hero-title {
    font-size: 28px;
  }

  .tech-hero .hero-text .hero-buttons {
    flex-direction: column;
  }
}
</style>
