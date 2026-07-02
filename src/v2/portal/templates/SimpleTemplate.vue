<template>
  <div class="simple-template">
    <header class="simple-header" :class="{ scrolled: isScrolled }">
      <div class="container">
        <div class="header-content">
          <a class="logo" @click="navigateTo('/')">
            <span class="logo-mark">S</span>
            <span class="logo-text">STUDIO</span>
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

    <section class="simple-hero">
      <div class="container">
        <div class="hero-content">
          <span class="hero-label">创意工作室</span>
          <h1 class="hero-title">
            简约之美
            <br />
            源于匠心
          </h1>
          <p class="hero-desc">
            我们相信，真正优秀的设计
            <br />
            是删繁就简后的纯粹表达
          </p>
          <div class="hero-meta">
            <span class="meta-item">EST. 2015</span>
            <span class="meta-divider">—</span>
            <span class="meta-item">北京 / 上海 / 深圳</span>
          </div>
          <a class="scroll-indicator" @click="scrollToWorks">
            <span>探索作品</span>
            <component :is="DownOutlined" />
          </a>
        </div>
      </div>
    </section>

    <section class="simple-works section" id="works">
      <div class="container">
        <div class="section-header">
          <span class="section-number">01</span>
          <h2 class="section-title">精选作品</h2>
        </div>
        <div class="works-masonry">
          <div
            v-for="(work, index) in workItems"
            :key="work.id"
            class="work-item"
            :class="`work-${index + 1}`"
          >
            <div class="work-image">
              <img :src="work.imageUrl" :alt="work.title" />
              <div class="work-overlay">
                <div class="work-info">
                  <span class="work-category">{{ work.category }}</span>
                  <h3 class="work-title">{{ work.title }}</h3>
                  <p v-if="work.description" class="work-desc">{{ work.description }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="simple-about section">
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
              <p class="lead">
                我们是一家专注于极简设计的创意工作室，
                致力于用最简洁的方式传达最有力的信息。
              </p>
              <p>
                自2015年成立以来，我们已为超过200家企业提供品牌设计、
                视觉传达、数字产品等服务。我们相信，好的设计不是做加法，
                而是做减法——去掉一切不必要的元素，留下最本质的美。
              </p>
            </div>
            <div class="about-stats">
              <div class="stat-item">
                <span class="stat-number">200+</span>
                <span class="stat-label">合作客户</span>
              </div>
              <div class="stat-item">
                <span class="stat-number">500+</span>
                <span class="stat-label">完成项目</span>
              </div>
              <div class="stat-item">
                <span class="stat-number">9</span>
                <span class="stat-label">年行业经验</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="simple-contact section">
      <div class="container">
        <div class="contact-content">
          <span class="section-number">03</span>
          <h2 class="contact-title">
            有项目想法？
            <br />
            让我们聊聊
          </h2>
          <p class="contact-desc">
            无论是品牌设计、网站开发还是创意咨询，
            <br />
            我们都期待与您的合作。
          </p>
          <div class="contact-info">
            <a href="mailto:hello@studio.com" class="contact-email">
              hello@studio.com
              <component :is="ArrowRightOutlined" />
            </a>
            <div class="contact-details">
              <span>北京市朝阳区建国路88号</span>
              <span>+86 10 8888 8888</span>
            </div>
          </div>
          <div class="social-links">
            <a href="#" class="social-link">Instagram</a>
            <span class="dot">·</span>
            <a href="#" class="social-link">Behance</a>
            <span class="dot">·</span>
            <a href="#" class="social-link">Dribbble</a>
            <span class="dot">·</span>
            <a href="#" class="social-link">WeChat</a>
          </div>
        </div>
      </div>
    </section>

    <footer class="simple-footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-left">
            <span class="logo-mark">S</span>
            <span>STUDIO</span>
          </div>
          <div class="footer-right">
            <span>© 2024 Studio. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  MenuOutlined,
  CloseOutlined,
  DownOutlined,
  ArrowRightOutlined
} from '@ant-design/icons-vue'
import { workItems } from '../data/mockData'

const router = useRouter()
const route = useRoute()
const isScrolled = ref(false)
const mobileMenuVisible = ref(false)
const currentPath = ref('/')

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

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
  currentPath.value = route.path
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

  .hero-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 80px;
    font-size: 13px;
    color: #999;
    letter-spacing: 0.1em;

    .meta-divider {
      color: #ddd;
    }
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
      margin-bottom: 60px;

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

    .about-stats {
      display: flex;
      gap: 60px;
      padding-top: 40px;
      border-top: 1px solid #eee;

      .stat-item {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .stat-number {
          font-size: 48px;
          font-weight: 300;
          letter-spacing: -0.02em;
          color: #1a1a1a;
        }

        .stat-label {
          font-size: 13px;
          color: #999;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
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

    .social-links {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      .social-link {
        color: rgba(255, 255, 255, 0.6);
        text-decoration: none;
        font-size: 14px;
        transition: color 0.3s ease;

        &:hover {
          color: #fff;
        }
      }

      .dot {
        color: rgba(255, 255, 255, 0.3);
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

    .about-right {
      .about-stats {
        gap: 40px;

        .stat-item .stat-number {
          font-size: 36px;
        }
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

    .hero-meta {
      flex-wrap: wrap;
      gap: 8px;
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

      .about-stats {
        flex-wrap: wrap;
        gap: 32px;

        .stat-item .stat-number {
          font-size: 28px;
        }
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

    .social-links {
      gap: 6px;

      .social-link {
        font-size: 13px;
      }
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
