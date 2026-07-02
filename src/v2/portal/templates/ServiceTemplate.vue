<template>
  <div class="service-template">
    <header class="service-header" :class="{ scrolled: isScrolled }">
      <div class="container">
        <div class="header-content">
          <div class="logo">
            <div class="logo-icon">
              <component :is="HeartOutlined" />
            </div>
            <span class="logo-text">暖心服务</span>
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
            免费咨询
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

    <section class="service-hero">
      <div class="hero-bg">
        <div class="warm-gradient"></div>
        <div class="hero-shape shape-1"></div>
        <div class="hero-shape shape-2"></div>
      </div>
      <div class="container">
        <div class="hero-content">
          <div class="hero-text">
            <div class="hero-badge">
              <component :is="StarOutlined" />
              <span>10年专业服务经验</span>
            </div>
            <h1 class="hero-title">
              专业服务
              <span class="highlight">温暖相伴</span>
            </h1>
            <p class="hero-subtitle">
              我们致力于为每一位客户提供贴心、专业、高效的服务体验
              <br />用真心换信任，用专业创价值
            </p>
            <div class="hero-buttons">
              <a-button type="primary" size="large" @click="navigateTo('/contact')">
                立即预约
                <component :is="ArrowRightOutlined" />
              </a-button>
              <a-button size="large" @click="navigateTo('/services')">
                了解服务
              </a-button>
            </div>
            <div class="hero-features">
              <div class="feature">
                <component :is="CheckCircleOutlined" />
                <span>专业团队</span>
              </div>
              <div class="feature">
                <component :is="CheckCircleOutlined" />
                <span>24小时服务</span>
              </div>
              <div class="feature">
                <component :is="CheckCircleOutlined" />
                <span>品质保证</span>
              </div>
            </div>
          </div>
          <div class="hero-image">
            <div class="image-card">
              <div class="card-decoration"></div>
              <img
                src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20business%20team%20meeting%20warm%20lighting%20office&image_size=landscape_4_3"
                alt="专业服务团队"
              />
              <div class="floating-badge badge-top">
                <component :is="TrophyOutlined" />
                <div>
                  <strong>500+</strong>
                  <span>满意客户</span>
                </div>
              </div>
              <div class="floating-badge badge-bottom">
                <div class="rating-stars">
                  <component :is="StarFilled" v-for="i in 5" :key="i" />
                </div>
                <span>客户好评率 99%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="service-list section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">服务项目</span>
          <h2 class="section-title">我们提供的专业服务</h2>
          <p class="section-subtitle">全方位的服务体系，满足您的各种需求</p>
        </div>
        <div class="services-grid">
          <div v-for="service in services" :key="service.id" class="service-item">
            <div class="service-icon">
              <component :is="getIcon(service.icon)" />
            </div>
            <h3 class="service-name">{{ service.title }}</h3>
            <p class="service-desc">{{ service.description }}</p>
            <ul class="service-detail">
              <li v-for="(feature, idx) in service.features" :key="idx">
                {{ feature }}
              </li>
            </ul>
            <a-button type="link" class="service-link" @click="navigateTo('/services')">
              了解详情
              <component :is="ArrowRightOutlined" />
            </a-button>
          </div>
        </div>
      </div>
    </section>

    <section class="service-team section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">团队介绍</span>
          <h2 class="section-title">专业的服务团队</h2>
          <p class="section-subtitle">经验丰富的专业团队，为您提供优质服务</p>
        </div>
        <div class="team-grid">
          <div v-for="member in teamMembers" :key="member.id" class="team-card">
            <div class="member-avatar">
              <img :src="member.avatar" :alt="member.name" />
            </div>
            <div class="member-info">
              <h3 class="member-name">{{ member.name }}</h3>
              <p class="member-position">{{ member.position }}</p>
              <p class="member-bio">{{ member.bio }}</p>
              <div class="member-social">
                <a v-for="social in member.socialLinks" :key="social.platform" href="#" class="social-link">
                  <component :is="getSocialIcon(social.platform)" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="service-testimonials section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">客户评价</span>
          <h2 class="section-title">听听客户怎么说</h2>
          <p class="section-subtitle">客户的满意是我们最大的动力</p>
        </div>
        <div class="testimonials-grid">
          <div v-for="item in testimonials" :key="item.id" class="testimonial-card">
            <div class="testimonial-quote">
              <component :is="MessageOutlined" />
            </div>
            <p class="testimonial-content">"{{ item.content }}"</p>
            <div class="testimonial-author">
              <img :src="item.avatar" :alt="item.author" class="author-avatar" />
              <div class="author-info">
                <h4 class="author-name">{{ item.author }}</h4>
                <p class="author-position">{{ item.position }} · {{ item.company }}</p>
              </div>
            </div>
            <div class="testimonial-rating">
              <component :is="StarFilled" v-for="i in item.rating" :key="i" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="service-faq section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">常见问题</span>
          <h2 class="section-title">您可能想了解的问题</h2>
          <p class="section-subtitle">如果您有其他问题，欢迎随时联系我们</p>
        </div>
        <div class="faq-container">
          <a-collapse accordion :bordered="false">
            <a-collapse-panel v-for="item in faqList" :key="item.id" :header="item.question">
              <p class="faq-answer">{{ item.answer }}</p>
            </a-collapse-panel>
          </a-collapse>
        </div>
      </div>
    </section>

    <section class="service-booking section">
      <div class="container">
        <div class="booking-wrapper">
          <div class="booking-info">
            <span class="section-tag light">预约服务</span>
            <h2 class="section-title light">立即预约专业服务</h2>
            <p class="booking-desc">
              填写以下表单，我们的专业顾问将在24小时内与您联系，
              为您提供一对一的专属服务咨询。
            </p>
            <div class="booking-benefits">
              <div class="benefit-item">
                <div class="benefit-icon">
                  <component :is="ClockCircleOutlined" />
                </div>
                <div>
                  <h4>快速响应</h4>
                  <p>24小时内专人联系</p>
                </div>
              </div>
              <div class="benefit-item">
                <div class="benefit-icon">
                  <component :is="GiftOutlined" />
                </div>
                <div>
                  <h4>免费咨询</h4>
                  <p>首次咨询完全免费</p>
                </div>
              </div>
              <div class="benefit-item">
                <div class="benefit-icon">
                  <component :is="SafetyOutlined" />
                </div>
                <div>
                  <h4>隐私保护</h4>
                  <p>您的信息严格保密</p>
                </div>
              </div>
            </div>
          </div>
          <div class="booking-form-wrapper">
            <div class="booking-form-card">
              <h3>预约咨询</h3>
              <a-form layout="vertical">
                <a-row :gutter="16">
                  <a-col :span="12">
                    <a-form-item label="您的姓名">
                      <a-input size="large" placeholder="请输入姓名" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="联系电话">
                      <a-input size="large" placeholder="请输入电话" />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-form-item label="电子邮箱">
                  <a-input size="large" placeholder="请输入邮箱" />
                </a-form-item>
                <a-form-item label="服务类型">
                  <a-select size="large" placeholder="请选择服务类型">
                    <a-select-option value="1">云计算服务</a-select-option>
                    <a-select-option value="2">人工智能</a-select-option>
                    <a-select-option value="3">网络安全</a-select-option>
                    <a-select-option value="4">软件开发</a-select-option>
                    <a-select-option value="5">大数据分析</a-select-option>
                    <a-select-option value="6">数字化营销</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item label="留言内容">
                  <a-textarea :rows="4" size="large" placeholder="请简单描述您的需求..." />
                </a-form-item>
                <a-button type="primary" size="large" block class="submit-btn">
                  提交预约
                  <component :is="SendOutlined" />
                </a-button>
              </a-form>
            </div>
          </div>
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
              <span class="logo-text">暖心服务</span>
            </div>
            <p class="footer-slogan">专业服务，温暖相伴</p>
            <div class="footer-contact">
              <div class="contact-item">
                <component :is="PhoneOutlined" />
                <span>{{ contactInfo.phone }}</span>
              </div>
              <div class="contact-item">
                <component :is="MailOutlined" />
                <span>{{ contactInfo.email }}</span>
              </div>
              <div class="contact-item">
                <component :is="EnvironmentOutlined" />
                <span>{{ contactInfo.address }}</span>
              </div>
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
          <p>© 2024 暖心服务 版权所有</p>
          <p>京ICP备12345678号</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  HeartOutlined,
  MenuOutlined,
  StarOutlined,
  StarFilled,
  ArrowRightOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  CloudOutlined,
  RobotOutlined,
  SafetyOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  GlobalOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  GiftOutlined,
  SendOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined
} from '@ant-design/icons-vue'
import {
  navItems,
  services,
  teamMembers,
  testimonials,
  faqList,
  contactInfo,
  footerLinks
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
  return icons[iconName] || HeartOutlined
}

const getSocialIcon = (platform: string) => {
  const icons: Record<string, any> = {
    linkedin: GlobalOutlined,
    twitter: MessageOutlined,
    github: GlobalOutlined,
    dribbble: GlobalOutlined,
    behance: GlobalOutlined
  }
  return icons[platform] || GlobalOutlined
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
    grid-template-columns: 1fr 1fr;
    gap: 60px;
    align-items: center;
  }

  .hero-text {
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 24px;
      background: rgba(255, 255, 255, 0.8);
      border: 2px solid #ffd4a3;
      border-radius: 30px;
      color: #ff6b6b;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 24px;

      svg {
        color: #ffb347;
      }
    }

    .hero-title {
      font-size: 56px;
      font-weight: 800;
      line-height: 1.2;
      color: #2d2a26;
      margin-bottom: 20px;

      .highlight {
        display: block;
        background: linear-gradient(135deg, #ff8a4c, #ff6b6b);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
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

    .hero-features {
      display: flex;
      gap: 32px;

      .feature {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        color: #5c544b;

        svg {
          color: #ff6b6b;
          font-size: 18px;
        }
      }
    }
  }

  .hero-image {
    position: relative;

    .image-card {
      position: relative;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 30px 60px rgba(255, 107, 107, 0.2);

      .card-decoration {
        position: absolute;
        top: -20px;
        right: -20px;
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #ff8a4c, #ff6b6b);
        border-radius: 50%;
        opacity: 0.3;
        z-index: 1;
      }

      img {
        width: 100%;
        height: 500px;
        object-fit: cover;
        display: block;
      }

      .floating-badge {
        position: absolute;
        background: #fff;
        border-radius: 16px;
        padding: 16px 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 12px;

        &.badge-top {
          top: 30px;
          left: -20px;

          svg {
            font-size: 32px;
            color: #ffd700;
          }

          strong {
            display: block;
            font-size: 24px;
            color: #2d2a26;
          }

          span {
            font-size: 13px;
            color: #8b7d6b;
          }
        }

        &.badge-bottom {
          bottom: 30px;
          right: -10px;
          flex-direction: column;
          gap: 4px;
          align-items: flex-start;

          .rating-stars {
            display: flex;
            gap: 2px;

            svg {
              color: #ffd700;
              font-size: 16px;
            }
          }

          span {
            font-size: 13px;
            color: #5c544b;
            font-weight: 500;
          }
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

    .service-icon {
      width: 70px;
      height: 70px;
      background: linear-gradient(135deg, #fff0e0, #ffe0d0);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ff6b6b;
      font-size: 32px;
      margin-bottom: 24px;
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

    .service-detail {
      list-style: none;
      padding: 0;
      margin: 0 0 20px;

      li {
        padding: 6px 0;
        font-size: 14px;
        color: #5c544b;
        position: relative;
        padding-left: 20px;

        &::before {
          content: '✓';
          position: absolute;
          left: 0;
          color: #ff6b6b;
          font-weight: bold;
        }
      }
    }

    .service-link {
      color: #ff6b6b;
      font-weight: 500;
      padding: 0;
      display: inline-flex;
      align-items: center;
      gap: 6px;

      &:hover {
        gap: 10px;
      }
    }
  }
}

.service-team {
  background: #fff8f0;

  .team-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
  }

  .team-card {
    background: #fff;
    border-radius: 20px;
    overflow: hidden;
    transition: all 0.4s ease;

    &:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 50px rgba(255, 107, 107, 0.15);

      .member-avatar img {
        transform: scale(1.05);
      }
    }

    .member-avatar {
      width: 100%;
      height: 280px;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.5s ease;
      }
    }

    .member-info {
      padding: 24px;
      text-align: center;

      .member-name {
        font-size: 20px;
        font-weight: 700;
        color: #2d2a26;
        margin-bottom: 4px;
      }

      .member-position {
        font-size: 14px;
        color: #ff6b6b;
        margin-bottom: 12px;
        font-weight: 500;
      }

      .member-bio {
        font-size: 13px;
        color: #8b7d6b;
        line-height: 1.6;
        margin-bottom: 16px;
      }

      .member-social {
        display: flex;
        justify-content: center;
        gap: 12px;

        .social-link {
          width: 36px;
          height: 36px;
          background: #fff8f0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ff6b6b;
          transition: all 0.3s ease;

          &:hover {
            background: linear-gradient(135deg, #ff8a4c, #ff6b6b);
            color: #fff;
            transform: translateY(-2px);
          }
        }
      }
    }
  }
}

.service-testimonials {
  .testimonials-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }

  .testimonial-card {
    background: #fff;
    border-radius: 20px;
    padding: 32px;
    border: 2px solid #ffece0;
    position: relative;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 15px 40px rgba(255, 107, 107, 0.12);
    }

    .testimonial-quote {
      font-size: 40px;
      color: #ffd4a3;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .testimonial-content {
      font-size: 15px;
      color: #5c544b;
      line-height: 1.8;
      margin-bottom: 24px;
      font-style: italic;
    }

    .testimonial-author {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;

      .author-avatar {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid #ffd4a3;
      }

      .author-info {
        .author-name {
          font-size: 16px;
          font-weight: 600;
          color: #2d2a26;
          margin: 0 0 2px;
        }

        .author-position {
          font-size: 13px;
          color: #8b7d6b;
          margin: 0;
        }
      }
    }

    .testimonial-rating {
      display: flex;
      gap: 4px;

      svg {
        color: #ffd700;
        font-size: 18px;
      }
    }
  }
}

.service-faq {
  background: #fff8f0;

  .faq-container {
    max-width: 800px;
    margin: 0 auto;
  }

  :deep(.ant-collapse) {
    background: transparent;
  }

  :deep(.ant-collapse-item) {
    background: #fff;
    border-radius: 16px !important;
    margin-bottom: 16px;
    border: none !important;
    overflow: hidden;

    .ant-collapse-header {
      padding: 20px 24px !important;
      font-size: 16px;
      font-weight: 600;
      color: #2d2a26;
    }

    .ant-collapse-content {
      border-top: 1px solid #ffece0 !important;
    }

    .ant-collapse-content-box {
      padding: 0 24px 20px !important;
    }
  }

  .faq-answer {
    font-size: 15px;
    color: #6b5d4f;
    line-height: 1.8;
    margin: 0;
  }
}

.service-booking {
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #ff8a4c 0%, #ff6b6b 100%);
    z-index: 0;
  }

  .container {
    position: relative;
    z-index: 1;
  }

  .booking-wrapper {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 80px;
    align-items: center;
  }

  .booking-info {
    .section-title {
      text-align: left;
      margin-bottom: 20px;
    }

    .booking-desc {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.9);
      line-height: 1.8;
      margin-bottom: 40px;
    }

    .booking-benefits {
      display: flex;
      flex-direction: column;
      gap: 24px;

      .benefit-item {
        display: flex;
        gap: 16px;
        align-items: center;

        .benefit-icon {
          width: 56px;
          height: 56px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 24px;
          flex-shrink: 0;
        }

        h4 {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 4px;
        }

        p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
        }
      }
    }
  }

  .booking-form-wrapper {
    .booking-form-card {
      background: #fff;
      border-radius: 24px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);

      h3 {
        font-size: 24px;
        font-weight: 700;
        color: #2d2a26;
        margin-bottom: 24px;
        text-align: center;
      }

      :deep(.ant-form-item-label > label) {
        color: #5c544b;
        font-weight: 500;
      }

      :deep(.ant-input),
      :deep(.ant-select-selector) {
        border-color: #ffd4a3;
        border-radius: 12px;

        &:hover {
          border-color: #ff8a4c;
        }

        &:focus,
        &.ant-select-focused .ant-select-selector {
          border-color: #ff6b6b;
          box-shadow: 0 0 0 3px rgba(255, 107, 107, 0.1);
        }
      }

      .submit-btn {
        background: linear-gradient(135deg, #ff8a4c, #ff6b6b);
        border: none;
        height: 52px;
        border-radius: 26px;
        font-size: 16px;
        margin-top: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-shadow: 0 8px 24px rgba(255, 107, 107, 0.4);

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 32px rgba(255, 107, 107, 0.5);
        }
      }
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
    .hero-content {
      grid-template-columns: 1fr;
      gap: 40px;
    }

    .hero-text .hero-title {
      font-size: 36px;
    }

    .hero-image .image-card img {
      height: 350px;
    }
  }

  .service-list .services-grid,
  .service-testimonials .testimonials-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .service-team .team-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .service-booking .booking-wrapper {
    grid-template-columns: 1fr;
    gap: 40px;
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
  .service-testimonials .testimonials-grid,
  .service-team .team-grid,
  .service-footer .footer-content {
    grid-template-columns: 1fr;
  }

  .service-hero .hero-text .hero-title {
    font-size: 28px;
  }

  .service-hero .hero-text .hero-buttons {
    flex-direction: column;
  }

  .service-hero .hero-text .hero-features {
    flex-wrap: wrap;
    gap: 16px;
  }

  .booking-form-card {
    padding: 24px;
  }
}
</style>
