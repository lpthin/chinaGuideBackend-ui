<template>
  <div class="template-preview-container" :class="template.type">
    <header class="template-header" :class="layoutConfig.headerStyle">
      <div class="header-content">
        <div class="logo">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" :fill="colorConfig.primary" />
              <path d="M2 17L12 22L22 17" :stroke="colorConfig.primary" stroke-width="2" />
              <path d="M2 12L12 17L22 12" :stroke="colorConfig.primary" stroke-width="2" />
            </svg>
          </div>
          <span class="logo-text">{{ template.name }}</span>
        </div>
        <nav class="nav-menu">
          <a v-for="item in navItems" :key="item" href="#" class="nav-item">{{ item }}</a>
        </nav>
        <div class="header-actions">
          <button class="btn btn-outline">联系我们</button>
          <button class="btn btn-primary">开始使用</button>
        </div>
      </div>
    </header>

    <main class="template-main">
      <section class="hero-section">
        <div class="hero-content">
          <h1 class="hero-title">{{ getHeroTitle() }}</h1>
          <p class="hero-subtitle">{{ getHeroSubtitle() }}</p>
          <div class="hero-actions">
            <button class="btn btn-large btn-primary">立即开始</button>
            <button class="btn btn-large btn-outline">了解更多</button>
          </div>
        </div>
        <div class="hero-visual">
          <div class="hero-placeholder">
            <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="40" width="360" height="220" rx="12" :fill="colorConfig.primary" opacity="0.1" />
              <rect x="40" y="60" width="120" height="24" rx="4" :fill="colorConfig.primary" opacity="0.3" />
              <rect x="40" y="100" width="200" height="12" rx="4" :fill="colorConfig.secondary" opacity="0.2" />
              <rect x="40" y="120" width="180" height="12" rx="4" :fill="colorConfig.secondary" opacity="0.2" />
              <rect x="40" y="140" width="160" height="12" rx="4" :fill="colorConfig.secondary" opacity="0.2" />
              <rect x="40" y="180" width="80" height="32" rx="6" :fill="colorConfig.primary" />
              <circle cx="300" cy="150" r="60" :fill="colorConfig.accent" opacity="0.4" />
              <path d="M280 130 L310 155 L290 170" :stroke="colorConfig.primary" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
        </div>
      </section>

      <section class="features-section">
        <div class="section-header">
          <h2 class="section-title">核心优势</h2>
          <p class="section-desc">为您的企业提供全方位的数字化解决方案</p>
        </div>
        <div class="features-grid">
          <div v-for="(feature, index) in features" :key="feature.title" class="feature-card">
            <div class="feature-icon" :style="{ background: colorConfig.primary + '20' }">
              <svg v-if="index === 0" viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" :style="{ color: colorConfig.primary }">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else-if="index === 1" viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" :style="{ color: colorConfig.primary }">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" fill="none"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else-if="index === 2" viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" :style="{ color: colorConfig.primary }">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" :style="{ color: colorConfig.primary }">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3 class="feature-title">{{ feature.title }}</h3>
            <p class="feature-desc">{{ feature.desc }}</p>
          </div>
        </div>
      </section>

      <section class="stats-section" :style="{ background: colorConfig.primary + '10' }">
        <div class="stats-grid">
          <div v-for="stat in stats" :key="stat.label" class="stat-item">
            <div class="stat-number" :style="{ color: colorConfig.primary }">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </section>

      <section class="cta-section">
        <div class="cta-content">
          <h2 class="cta-title">准备好开始了吗？</h2>
          <p class="cta-desc">立即加入我们，开启数字化转型之旅</p>
          <button class="btn btn-large btn-light">免费咨询</button>
        </div>
      </section>
    </main>

    <footer class="template-footer" :class="layoutConfig.footerStyle">
      <div class="footer-content" v-if="layoutConfig.footerStyle !== 'minimal'">
        <div class="footer-col">
          <h4 class="footer-title">关于我们</h4>
          <ul class="footer-links">
            <li><a href="#">公司简介</a></li>
            <li><a href="#">发展历程</a></li>
            <li><a href="#">团队介绍</a></li>
            <li><a href="#">加入我们</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4 class="footer-title">产品服务</h4>
          <ul class="footer-links">
            <li><a href="#">解决方案</a></li>
            <li><a href="#">产品功能</a></li>
            <li><a href="#">定价方案</a></li>
            <li><a href="#">客户案例</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4 class="footer-title">支持帮助</h4>
          <ul class="footer-links">
            <li><a href="#">帮助中心</a></li>
            <li><a href="#">开发文档</a></li>
            <li><a href="#">常见问题</a></li>
            <li><a href="#">联系客服</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4 class="footer-title">联系方式</h4>
          <ul class="footer-links">
            <li>电话：400-888-8888</li>
            <li>邮箱：contact@company.com</li>
            <li>地址：北京市朝阳区xxx大厦</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2024 {{ template.name }}. 保留所有权利。</p>
        <div class="footer-social">
          <a href="#" class="social-link">微信</a>
          <a href="#" class="social-link">微博</a>
          <a href="#" class="social-link">LinkedIn</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PortalTemplate } from '../../types/portal'

interface Props {
  template: PortalTemplate
}

const props = defineProps<Props>()

const templateConfig = computed(() => {
  try {
    if (props.template.configJson) {
      return JSON.parse(props.template.configJson)
    }
  } catch (e) {
    // 解析失败返回默认配置
  }
  return {
    colorConfig: {
      primary: '#1890ff',
      secondary: '#096dd9',
      accent: '#40a9ff',
      background: '#ffffff',
      text: '#000000',
      textSecondary: '#666666'
    },
    fontConfig: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      baseFontSize: 14
    },
    layoutConfig: {
      headerStyle: 'modern',
      footerStyle: 'full',
      sidebarEnabled: false,
      contentWidth: 'boxed'
    }
  }
})

const colorConfig = computed(() => templateConfig.value.colorConfig)
const layoutConfig = computed(() => templateConfig.value.layoutConfig)
const fontConfig = computed(() => templateConfig.value.fontConfig)

const navItems = ['首页', '产品', '解决方案', '关于我们', '联系']

const features = [
  { title: '智能分析', desc: 'AI驱动的数据分析，洞察业务增长机会' },
  { title: '高效协作', desc: '团队实时协作，提升工作效率与沟通质量' },
  { title: '安全可靠', desc: '企业级安全保障，数据加密存储与传输' },
  { title: '持续创新', desc: '快速迭代更新，紧跟行业最新技术趋势' }
]

const stats = [
  { value: '1000+', label: '企业客户' },
  { value: '99.9%', label: '服务可用性' },
  { value: '50+', label: '技术专利' },
  { value: '24/7', label: '客户支持' }
]

const getHeroTitle = () => {
  switch (props.template.type) {
    case 'tech':
      return '科技驱动 创新未来'
    case 'marketing':
      return '品牌增长 营销赋能'
    case 'minimal':
      return '简约而不简单'
    default:
      return '欢迎访问我们的网站'
  }
}

const getHeroSubtitle = () => {
  switch (props.template.type) {
    case 'tech':
      return '领先的人工智能技术，为您的企业提供智能化转型解决方案'
    case 'marketing':
      return '专业的数字营销团队，帮助您的品牌实现爆发式增长'
    case 'minimal':
      return '精致的产品体验，卓越的服务品质，成就非凡商业价值'
    default:
      return '我们致力于为客户提供最优质的产品和服务'
  }
}
</script>

<style lang="less" scoped>
.template-preview-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1f1f1f;
  line-height: 1.6;

  &.tech {
    --gradient-start: #1890ff;
    --gradient-end: #096dd9;
  }
  &.marketing {
    --gradient-start: #fa8c16;
    --gradient-end: #fa541c;
  }
  &.minimal {
    --gradient-start: #1f1f1f;
    --gradient-end: #434343;
  }
}

.template-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #f0f0f0;

  &.centered {
    .header-content {
      flex-direction: column;
      gap: 16px;
      padding: 24px 40px;
    }
  }

  &.classic {
    .header-content {
      justify-content: space-between;
    }
  }

  &.modern {
    .header-content {
      justify-content: space-between;
    }
    background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
    border-bottom: none;

    .logo-text, .nav-item {
      color: #fff !important;
    }

    .btn-outline {
      border-color: rgba(255, 255, 255, 0.5);
      color: #fff;
      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px 40px;
    display: flex;
    align-items: center;
    gap: 48px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
    font-size: 18px;

    .logo-icon {
      width: 36px;
      height: 36px;
    }
  }

  .nav-menu {
    display: flex;
    gap: 32px;

    .nav-item {
      text-decoration: none;
      color: #434343;
      font-weight: 500;
      transition: color 0.3s;

      &:hover {
        color: var(--gradient-start);
      }
    }
  }

  .header-actions {
    display: flex;
    gap: 12px;
    margin-left: auto;
  }
}

.btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
  font-size: 14px;

  &-primary {
    background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
    color: #fff;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  }

  &-outline {
    background: transparent;
    border: 2px solid var(--gradient-start);
    color: var(--gradient-start);

    &:hover {
      background: var(--gradient-start);
      color: #fff;
    }
  }

  &-large {
    padding: 12px 28px;
    font-size: 16px;
  }

  &-light {
    background: #fff;
    color: var(--gradient-start);
    font-weight: 600;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  }
}

.template-main {
  min-height: calc(100vh - 80px);
}

.hero-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 80px 40px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;

  .hero-title {
    font-size: 48px;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 24px;
    background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-subtitle {
    font-size: 18px;
    color: #666;
    margin-bottom: 32px;
    line-height: 1.8;
  }

  .hero-actions {
    display: flex;
    gap: 16px;
  }

  .hero-placeholder {
    svg {
      width: 100%;
      height: auto;
    }
  }
}

.features-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 80px 40px;

  .section-header {
    text-align: center;
    margin-bottom: 48px;
  }

  .section-title {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 12px;
  }

  .section-desc {
    font-size: 16px;
    color: #666;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 32px;
  }

  .feature-card {
    text-align: center;
    padding: 32px 24px;
    border-radius: 16px;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-8px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
    }

    .feature-icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .feature-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .feature-desc {
      font-size: 14px;
      color: #666;
      line-height: 1.6;
    }
  }
}

.stats-section {
  padding: 60px 40px;

  .stats-grid {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 48px;
    text-align: center;

    .stat-number {
      font-size: 40px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .stat-label {
      font-size: 14px;
      color: #666;
    }
  }
}

.cta-section {
  background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
  padding: 80px 40px;
  text-align: center;
  color: #fff;

  .cta-title {
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  .cta-desc {
    font-size: 18px;
    opacity: 0.9;
    margin-bottom: 32px;
  }
}

.template-footer {
  background: #1f1f1f;
  color: #fff;

  &.minimal {
    .footer-content {
      display: none;
    }
  }

  &.compact {
    .footer-content {
      display: none;
    }
  }

  .footer-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 60px 40px 32px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 48px;
  }

  .footer-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 20px;
  }

  .footer-links {
    list-style: none;
    padding: 0;
    margin: 0;

    li {
      margin-bottom: 12px;

      a {
        color: #999;
        text-decoration: none;
        transition: color 0.3s;

        &:hover {
          color: #fff;
        }
      }
    }
  }

  .footer-bottom {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 40px;
    border-top: 1px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;

    p {
      margin: 0;
      font-size: 14px;
      color: #999;
    }
  }

  .footer-social {
    display: flex;
    gap: 24px;

    .social-link {
      color: #999;
      text-decoration: none;
      font-size: 14px;

      &:hover {
        color: #fff;
      }
    }
  }
}

@media (max-width: 768px) {
  .hero-section {
    grid-template-columns: 1fr;
    text-align: center;

    .hero-title {
      font-size: 32px;
    }

    .hero-actions {
      justify-content: center;
    }
  }

  .features-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  .footer-content {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  .nav-menu {
    display: none !important;
  }
}
</style>
