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
            <div class="hero-badge">
              <component :is="RocketOutlined" />
              <span>创新科技 · 引领未来</span>
            </div>
            <h1 class="hero-title">
              {{ heroData.title }}
              <span class="gradient-text">{{ heroData.subtitle }}</span>
            </h1>
            <p class="hero-description">{{ heroData.description }}</p>
            <div class="hero-buttons">
              <a-button type="primary" size="large" @click="navigateTo('/contact')">
                {{ heroData.primaryButtonText }}
                <component :is="ArrowRightOutlined" />
              </a-button>
              <a-button size="large" ghost @click="navigateTo('/about')">
                {{ heroData.secondaryButtonText }}
              </a-button>
            </div>
            <div class="hero-stats">
              <div v-for="(item, index) in aboutData.highlights" :key="index" class="stat-item">
                <span class="stat-value">{{ item.value }}</span>
                <span class="stat-label">{{ item.label }}</span>
              </div>
            </div>
          </div>
          <div class="hero-visual">
            <div class="tech-card main-card">
              <div class="card-glow"></div>
              <div class="card-content">
                <div class="tech-icon">
                  <component :is="CloudServerOutlined" />
                </div>
                <div class="tech-title">智能云平台</div>
                <div class="tech-desc">一站式数字化解决方案</div>
                <div class="tech-metrics">
                  <div class="metric">
                    <span class="metric-value">99.9%</span>
                    <span class="metric-label">可用性</span>
                  </div>
                  <div class="metric">
                    <span class="metric-value">100ms</span>
                    <span class="metric-label">响应</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="tech-card floating-card card-2">
              <component :is="RobotOutlined" class="floating-icon" />
              <div class="floating-text">AI 驱动</div>
            </div>
            <div class="tech-card floating-card card-3">
              <component :is="SafetyOutlined" class="floating-icon" />
              <div class="floating-text">安全可靠</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="tech-services section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">核心服务</span>
          <h2 class="section-title">专业的数字化解决方案</h2>
          <p class="section-subtitle">我们提供全方位的技术服务，助力企业实现数字化转型</p>
        </div>
        <div class="services-grid">
          <div v-for="service in services" :key="service.id" class="service-card">
            <div class="service-icon">
              <component :is="getIcon(service.icon)" />
            </div>
            <h3 class="service-title">{{ service.title }}</h3>
            <p class="service-description">{{ service.description }}</p>
            <ul class="service-features">
              <li v-for="(feature, idx) in service.features" :key="idx">
                <component :is="CheckOutlined" />
                {{ feature }}
              </li>
            </ul>
            <a class="service-link" @click="navigateTo('/services')">
              了解更多 <component :is="ArrowRightOutlined" />
            </a>
          </div>
        </div>
      </div>
    </section>

    <section class="tech-about section">
      <div class="container">
        <div class="about-content">
          <div class="about-image">
            <div class="image-wrapper">
              <img :src="aboutData.imageUrl" alt="关于我们" />
              <div class="image-overlay"></div>
            </div>
            <div class="experience-badge">
              <span class="badge-number">10+</span>
              <span class="badge-text">年行业经验</span>
            </div>
          </div>
          <div class="about-text">
            <span class="section-tag">关于我们</span>
            <h2 class="section-title">{{ aboutData.subtitle }}</h2>
            <p class="about-description">{{ aboutData.description }}</p>
            <div class="about-features">
              <div class="feature-item">
                <div class="feature-icon">
                  <component :is="BulbOutlined" />
                </div>
                <div class="feature-content">
                  <h4>创新驱动</h4>
                  <p>持续投入研发，引领技术前沿</p>
                </div>
              </div>
              <div class="feature-item">
                <div class="feature-icon">
                  <component :is="TeamOutlined" />
                </div>
                <div class="feature-content">
                  <h4>专业团队</h4>
                  <p>来自顶尖科技公司的专家团队</p>
                </div>
              </div>
            </div>
            <a-button type="primary" size="large" @click="navigateTo('/about')">
              了解更多
              <component :is="ArrowRightOutlined" />
            </a-button>
          </div>
        </div>
      </div>
    </section>

    <section class="tech-cases section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">案例展示</span>
          <h2 class="section-title">成功客户案例</h2>
          <p class="section-subtitle">我们已帮助500+企业实现数字化转型</p>
        </div>
        <div class="cases-grid">
          <div v-for="item in cases" :key="item.id" class="case-card">
            <div class="case-image">
              <img :src="item.imageUrl" :alt="item.title" />
              <div class="case-overlay">
                <a-button type="primary" ghost @click="navigateTo('/cases')">
                  查看详情
                </a-button>
              </div>
            </div>
            <div class="case-content">
              <span class="case-category">{{ item.category }}</span>
              <h3 class="case-title">{{ item.title }}</h3>
              <p class="case-description">{{ item.description }}</p>
              <div class="case-tags">
                <a-tag v-for="tag in item.tags" :key="tag" color="blue">{{ tag }}</a-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="tech-news section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">新闻动态</span>
          <h2 class="section-title">最新资讯</h2>
          <p class="section-subtitle">了解公司最新动态和行业资讯</p>
        </div>
        <div class="news-grid">
          <div v-for="news in newsList" :key="news.id" class="news-card">
            <div class="news-image">
              <img :src="news.coverImage" :alt="news.title" />
              <span class="news-category">{{ news.category }}</span>
            </div>
            <div class="news-content">
              <div class="news-meta">
                <span class="news-date">
                  <component :is="CalendarOutlined" />
                  {{ news.date }}
                </span>
                <span class="news-views">
                  <component :is="EyeOutlined" />
                  {{ news.views }}
                </span>
              </div>
              <h3 class="news-title">{{ news.title }}</h3>
              <p class="news-summary">{{ news.summary }}</p>
              <a class="news-link" @click="navigateTo('/news')">
                阅读全文 <component :is="ArrowRightOutlined" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="tech-clients section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">合作伙伴</span>
          <h2 class="section-title">值得信赖的选择</h2>
          <p class="section-subtitle">众多知名企业的共同选择</p>
        </div>
        <div class="clients-grid">
          <div v-for="client in clientLogos" :key="client.id" class="client-item">
            <div class="client-logo">{{ client.logoUrl }}</div>
            <span class="client-name">{{ client.name }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="tech-contact section">
      <div class="container">
        <div class="contact-wrapper">
          <div class="contact-info">
            <span class="section-tag light">联系我们</span>
            <h2 class="section-title light">{{ contactInfo.title }}</h2>
            <p class="contact-subtitle">{{ contactInfo.subtitle }}</p>
            <div class="contact-details">
              <div class="contact-item">
                <div class="contact-icon">
                  <component :is="EnvironmentOutlined" />
                </div>
                <div class="contact-text">
                  <h4>公司地址</h4>
                  <p>{{ contactInfo.address }}</p>
                </div>
              </div>
              <div class="contact-item">
                <div class="contact-icon">
                  <component :is="PhoneOutlined" />
                </div>
                <div class="contact-text">
                  <h4>联系电话</h4>
                  <p>{{ contactInfo.phone }}</p>
                </div>
              </div>
              <div class="contact-item">
                <div class="contact-icon">
                  <component :is="MailOutlined" />
                </div>
                <div class="contact-text">
                  <h4>电子邮箱</h4>
                  <p>{{ contactInfo.email }}</p>
                </div>
              </div>
              <div class="contact-item">
                <div class="contact-icon">
                  <component :is="ClockCircleOutlined" />
                </div>
                <div class="contact-text">
                  <h4>工作时间</h4>
                  <p>{{ contactInfo.workingHours }}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="contact-form-wrapper">
            <div class="contact-form-card">
              <h3>在线咨询</h3>
              <a-form layout="vertical">
                <a-form-item label="您的姓名">
                  <a-input size="large" placeholder="请输入您的姓名" />
                </a-form-item>
                <a-form-item label="联系电话">
                  <a-input size="large" placeholder="请输入您的电话" />
                </a-form-item>
                <a-form-item label="电子邮箱">
                  <a-input size="large" placeholder="请输入您的邮箱" />
                </a-form-item>
                <a-form-item label="咨询内容">
                  <a-textarea :rows="4" size="large" placeholder="请描述您的需求..." />
                </a-form-item>
                <a-button type="primary" size="large" block>
                  提交咨询
                  <component :is="SendOutlined" />
                </a-button>
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
              <span class="logo-text">{{ companyInfo.name }}</span>
            </div>
            <p class="footer-slogan">{{ companyInfo.slogan }}</p>
            <div class="social-links">
              <a class="social-link" href="#">
                <component :is="GlobalOutlined" />
              </a>
              <a class="social-link" href="#">
                <component :is="WechatOutlined" />
              </a>
              <a class="social-link" href="#">
                <component :is="WeiboOutlined" />
              </a>
            </div>
          </div>
          <div v-for="linkGroup in footerLinks" :key="linkGroup.title" class="footer-column">
            <h4 class="footer-title">{{ linkGroup.title }}</h4>
            <ul class="footer-links">
              <li v-for="link in linkGroup.links" :key="link.label">
                <a @click="navigateTo(link.path)">{{ link.label }}</a>
              </li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p>{{ companyInfo.copyright }}</p>
          <p>{{ companyInfo.icp }}</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ApiOutlined,
  MenuOutlined,
  RocketOutlined,
  ArrowRightOutlined,
  CloudServerOutlined,
  RobotOutlined,
  SafetyOutlined,
  CloudOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  GlobalOutlined,
  CheckOutlined,
  BulbOutlined,
  TeamOutlined,
  CalendarOutlined,
  EyeOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  ClockCircleOutlined,
  SendOutlined,
  WechatOutlined,
  WeiboOutlined
} from '@ant-design/icons-vue'
import {
  navItems,
  heroData,
  services,
  aboutData,
  cases,
  newsList,
  clientLogos,
  contactInfo,
  footerLinks,
  companyInfo
} from '../data/mockData'

const router = useRouter()
const route = useRoute()
const isScrolled = ref(false)
const mobileMenuVisible = ref(false)
const currentPath = ref('/')

const handleScroll = () => {
  isScrolled.value = window.scrollY > 50
}

const navigateTo = (path: string) => {
  currentPath.value = path
  router.push(path)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const getIcon = (iconName: string) => {
  const icons: Record<string, any> = {
    CloudOutlined,
    RobotOutlined,
    SafetyOutlined,
    AppstoreOutlined,
    BarChartOutlined,
    GlobalOutlined
  }
  return icons[iconName] || CloudOutlined
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
  currentPath.value = route.path
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
    grid-template-columns: 1fr 1fr;
    gap: 60px;
    align-items: center;
  }

  .hero-text {
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

      .gradient-text {
        display: block;
        background: linear-gradient(135deg, #6366f1, #a78bfa, #c084fc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
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
      margin-bottom: 48px;

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

    .hero-stats {
      display: flex;
      gap: 40px;

      .stat-item {
        display: flex;
        flex-direction: column;

        .stat-value {
          font-size: 36px;
          font-weight: 700;
          background: linear-gradient(135deg, #6366f1, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .stat-label {
          font-size: 14px;
          color: #64748b;
        }
      }
    }
  }

  .hero-visual {
    position: relative;
    height: 500px;

    .tech-card {
      position: absolute;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      overflow: hidden;

      &.main-card {
        width: 320px;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        .card-glow {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%);
          animation: pulse 4s ease-in-out infinite;
        }

        .card-content {
          position: relative;
          padding: 32px;

          .tech-icon {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 28px;
            margin-bottom: 20px;
          }

          .tech-title {
            font-size: 22px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 8px;
          }

          .tech-desc {
            font-size: 14px;
            color: #94a3b8;
            margin-bottom: 20px;
          }

          .tech-metrics {
            display: flex;
            gap: 20px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);

            .metric {
              .metric-value {
                display: block;
                font-size: 24px;
                font-weight: 700;
                color: #a78bfa;
              }

              .metric-label {
                font-size: 12px;
                color: #64748b;
              }
            }
          }
        }
      }

      &.floating-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 24px;

        .floating-icon {
          font-size: 24px;
          color: #6366f1;
        }

        .floating-text {
          color: #fff;
          font-weight: 500;
        }

        &.card-2 {
          top: 40px;
          right: 20px;
          animation: float 6s ease-in-out infinite;
        }

        &.card-3 {
          bottom: 60px;
          left: 0;
          animation: float 8s ease-in-out infinite reverse;
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
    background: #fff;
    border-radius: 20px;
    padding: 40px 32px;
    border: 1px solid #e2e8f0;
    transition: all 0.4s ease;
    position: relative;
    overflow: hidden;

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

    .service-icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6366f1;
      font-size: 28px;
      margin-bottom: 24px;
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
      margin-bottom: 20px;
    }

    .service-features {
      list-style: none;
      padding: 0;
      margin: 0 0 24px;

      li {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 0;
        font-size: 14px;
        color: #475569;

        svg {
          color: #6366f1;
        }
      }
    }

    .service-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #6366f1;
      font-weight: 500;
      cursor: pointer;
      transition: gap 0.3s ease;

      &:hover {
        gap: 10px;
      }
    }
  }
}

.tech-about {
  .about-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 80px;
    align-items: center;
  }

  .about-image {
    position: relative;

    .image-wrapper {
      position: relative;
      border-radius: 24px;
      overflow: hidden;

      img {
        width: 100%;
        height: 500px;
        object-fit: cover;
      }

      .image-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
      }
    }

    .experience-badge {
      position: absolute;
      bottom: -30px;
      right: 30px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 20px;
      padding: 24px 32px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(99, 102, 241, 0.4);

      .badge-number {
        display: block;
        font-size: 42px;
        font-weight: 800;
        color: #fff;
        line-height: 1;
      }

      .badge-text {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.9);
      }
    }
  }

  .about-text {
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

    .about-features {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-bottom: 32px;

      .feature-item {
        display: flex;
        gap: 16px;

        .feature-icon {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6366f1;
          font-size: 24px;
          flex-shrink: 0;
        }

        .feature-content {
          h4 {
            font-size: 18px;
            font-weight: 600;
            color: #1a1a2e;
            margin-bottom: 4px;
          }

          p {
            font-size: 14px;
            color: #64748b;
            margin: 0;
          }
        }
      }
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
        margin-bottom: 12px;
      }

      .case-description {
        font-size: 14px;
        color: #64748b;
        line-height: 1.7;
        margin-bottom: 16px;
      }

      .case-tags {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
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

      .news-category {
        position: absolute;
        top: 16px;
        left: 16px;
        padding: 4px 12px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #fff;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
      }
    }

    .news-content {
      padding: 24px;

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

.tech-clients {
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);

  .clients-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
  }

  .client-item {
    background: #fff;
    border-radius: 16px;
    padding: 32px;
    text-align: center;
    border: 1px solid #e2e8f0;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      border-color: #6366f1;
    }

    .client-logo {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }

    .client-name {
      font-size: 14px;
      color: #64748b;
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
    grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
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

    .social-links {
      display: flex;
      gap: 12px;

      .social-link {
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        transition: all 0.3s ease;

        &:hover {
          background: #6366f1;
          border-color: #6366f1;
          color: #fff;
          transform: translateY(-2px);
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

@keyframes pulse {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
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

      .hero-stats {
        gap: 24px;
      }
    }

    .hero-visual {
      height: 400px;
    }
  }

  .tech-services .services-grid,
  .tech-news .news-grid,
  .tech-clients .clients-grid {
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
  .tech-clients .clients-grid,
  .tech-footer .footer-content {
    grid-template-columns: 1fr;
  }

  .tech-hero .hero-text .hero-title {
    font-size: 28px;
  }

  .tech-hero .hero-text .hero-buttons {
    flex-direction: column;
  }

  .tech-hero .hero-stats {
    flex-wrap: wrap;
  }
}
</style>
