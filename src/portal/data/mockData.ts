export interface NavItem {
  key: string
  label: string
  path: string
}

export interface HeroData {
  title: string
  subtitle: string
  description: string
  primaryButtonText: string
  secondaryButtonText: string
  backgroundImage?: string
}

export interface ServiceItem {
  id: number
  icon: string
  title: string
  description: string
  features: string[]
}

export interface AboutData {
  title: string
  subtitle: string
  description: string
  highlights: { label: string; value: string }[]
  imageUrl: string
}

export interface CaseItem {
  id: number
  title: string
  category: string
  description: string
  imageUrl: string
  tags: string[]
}

export interface NewsItem {
  id: number
  title: string
  summary: string
  category: string
  date: string
  coverImage: string
  views: number
}

export interface ClientLogo {
  id: number
  name: string
  logoUrl: string
}

export interface TeamMember {
  id: number
  name: string
  position: string
  avatar: string
  bio: string
  socialLinks: { platform: string; url: string }[]
}

export interface Testimonial {
  id: number
  content: string
  author: string
  position: string
  company: string
  avatar: string
  rating: number
}

export interface FAQItem {
  id: number
  question: string
  answer: string
}

export interface ContactInfo {
  title: string
  subtitle: string
  address: string
  phone: string
  email: string
  workingHours: string
  mapLocation?: { lat: number; lng: number }
}

export interface FooterLink {
  title: string
  links: { label: string; path: string }[]
}

export interface WorkItem {
  id: number
  title: string
  category: string
  imageUrl: string
  description?: string
}

export const navItems: NavItem[] = [
  { key: 'home', label: '首页', path: '/' },
  { key: 'about', label: '关于我们', path: '/about' },
  { key: 'services', label: '服务项目', path: '/services' },
  { key: 'cases', label: '案例展示', path: '/cases' },
  { key: 'news', label: '新闻动态', path: '/news' },
  { key: 'contact', label: '联系我们', path: '/contact' }
]

export const heroData: HeroData = {
  title: '赋能数字化转型',
  subtitle: '创新科技驱动未来',
  description: '我们提供专业的数字化解决方案，帮助企业实现业务升级与增长，用技术创造价值。',
  primaryButtonText: '立即咨询',
  secondaryButtonText: '了解更多'
}

export const services: ServiceItem[] = [
  {
    id: 1,
    icon: 'CloudOutlined',
    title: '云计算服务',
    description: '提供弹性、安全、高效的云端解决方案，助力企业快速上云。',
    features: ['弹性伸缩', '高可用性', '安全防护', '成本优化']
  },
  {
    id: 2,
    icon: 'RobotOutlined',
    title: '人工智能',
    description: '基于深度学习的AI解决方案，赋能企业智能化升级。',
    features: ['智能客服', '数据分析', '图像识别', '自然语言处理']
  },
  {
    id: 3,
    icon: 'SafetyOutlined',
    title: '网络安全',
    description: '全方位网络安全防护，保障企业数据资产安全。',
    features: ['漏洞检测', '入侵防御', '数据加密', '安全审计']
  },
  {
    id: 4,
    icon: 'AppstoreOutlined',
    title: '软件开发',
    description: '定制化软件开发服务，从需求到上线全流程支持。',
    features: ['Web应用', '移动应用', '系统集成', '技术咨询']
  },
  {
    id: 5,
    icon: 'BarChartOutlined',
    title: '大数据分析',
    description: '深度挖掘数据价值，驱动业务决策优化。',
    features: ['数据采集', '数据仓库', '可视化分析', '预测建模']
  },
  {
    id: 6,
    icon: 'GlobalOutlined',
    title: '数字化营销',
    description: '全渠道数字化营销解决方案，提升品牌影响力。',
    features: ['SEO优化', '内容营销', '社交媒体', '数据分析']
  }
]

export const aboutData: AboutData = {
  title: '关于我们',
  subtitle: '专注科技创新，引领行业发展',
  description: '我们是一家专注于数字化转型的科技公司，拥有超过10年的行业经验。我们的团队由来自全球顶尖科技公司的专家组成，致力于为客户提供最优质的技术服务和解决方案。我们相信技术的力量可以改变世界，也一直在为此努力。',
  highlights: [
    { label: '年行业经验', value: '10+' },
    { label: '服务客户', value: '500+' },
    { label: '成功案例', value: '1000+' },
    { label: '专业团队', value: '200+' }
  ],
  imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20office%20building%20with%20glass%20facade%20and%20blue%20sky&image_size=landscape_4_3'
}

export const cases: CaseItem[] = [
  {
    id: 1,
    title: '大型电商平台数字化升级',
    category: '电商零售',
    description: '为国内知名电商平台打造全新的数字化运营体系，提升用户体验和转化率。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ecommerce%20platform%20dashboard%20modern%20ui&image_size=landscape_4_3',
    tags: ['电商', '数字化', '用户增长']
  },
  {
    id: 2,
    title: '金融机构智能风控系统',
    category: '金融科技',
    description: '基于AI技术的智能风控系统，帮助金融机构有效降低风险。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=financial%20technology%20dashboard%20charts%20analytics&image_size=landscape_4_3',
    tags: ['金融', 'AI', '风控']
  },
  {
    id: 3,
    title: '制造业智能工厂解决方案',
    category: '智能制造',
    description: '为制造企业打造智能工厂，实现生产全流程数字化管理。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=smart%20factory%20industrial%20automation%20robots&image_size=landscape_4_3',
    tags: ['制造', '物联网', '智能工厂']
  },
  {
    id: 4,
    title: '医疗健康信息化平台',
    category: '医疗健康',
    description: '构建医院信息化平台，提升医疗服务效率和质量。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=healthcare%20technology%20medical%20digital%20platform&image_size=landscape_4_3',
    tags: ['医疗', '信息化', '健康']
  }
]

export const newsList: NewsItem[] = [
  {
    id: 1,
    title: '公司荣获2024年度最佳科技创新企业奖',
    summary: '在近日举办的科技创新峰会上，我公司凭借在AI领域的突出贡献荣获年度最佳科技创新企业奖。',
    category: '公司新闻',
    date: '2024-01-15',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=technology%20award%20ceremony%20stage%20lights&image_size=landscape_4_3',
    views: 1256
  },
  {
    id: 2,
    title: '新一代智能客服系统正式发布',
    summary: '经过半年的研发迭代，我们的新一代智能客服系统正式发布，支持多模态交互。',
    category: '产品动态',
    date: '2024-01-10',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ai%20chatbot%20customer%20service%20interface&image_size=landscape_4_3',
    views: 892
  },
  {
    id: 3,
    title: '与某知名高校达成产学研合作',
    summary: '我公司与国内顶尖高校签署战略合作协议，共同推进人工智能技术研究与人才培养。',
    category: '行业动态',
    date: '2024-01-05',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=university%20partnership%20signing%20ceremony&image_size=landscape_4_3',
    views: 634
  }
]

export const clientLogos: ClientLogo[] = [
  { id: 1, name: '腾讯', logoUrl: 'Tencent' },
  { id: 2, name: '阿里巴巴', logoUrl: 'Alibaba' },
  { id: 3, name: '百度', logoUrl: 'Baidu' },
  { id: 4, name: '华为', logoUrl: 'Huawei' },
  { id: 5, name: '小米', logoUrl: 'Xiaomi' },
  { id: 6, name: '京东', logoUrl: 'JD' },
  { id: 7, name: '美团', logoUrl: 'Meituan' },
  { id: 8, name: '字节跳动', logoUrl: 'ByteDance' }
]

export const teamMembers: TeamMember[] = [
  {
    id: 1,
    name: '张明',
    position: 'CEO & 创始人',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20businessman%20portrait%20headshot%20confident&image_size=square',
    bio: '前Google技术总监，拥有15年科技行业经验，专注于AI和云计算领域。',
    socialLinks: [
      { platform: 'linkedin', url: '#' },
      { platform: 'twitter', url: '#' }
    ]
  },
  {
    id: 2,
    name: '李华',
    position: 'CTO',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20female%20engineer%20portrait%20headshot&image_size=square',
    bio: '前阿里云资深架构师，在分布式系统和大数据领域有深厚造诣。',
    socialLinks: [
      { platform: 'linkedin', url: '#' },
      { platform: 'github', url: '#' }
    ]
  },
  {
    id: 3,
    name: '王强',
    position: '产品总监',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20product%20manager%20portrait%20casual&image_size=square',
    bio: '前腾讯产品经理，主导过多个千万级用户产品的设计与运营。',
    socialLinks: [
      { platform: 'linkedin', url: '#' }
    ]
  },
  {
    id: 4,
    name: '陈静',
    position: '设计总监',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20female%20designer%20portrait%20creative&image_size=square',
    bio: '知名设计公司创意总监，多次获得国际设计大奖。',
    socialLinks: [
      { platform: 'dribbble', url: '#' },
      { platform: 'behance', url: '#' }
    ]
  }
]

export const testimonials: Testimonial[] = [
  {
    id: 1,
    content: '与这家公司合作是我们做过的最明智的决定之一。他们的专业团队帮助我们实现了业务的数字化转型，效率提升了300%。',
    author: '刘伟',
    position: 'CEO',
    company: '某知名电商企业',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=happy%20businessman%20portrait%20smiling&image_size=square',
    rating: 5
  },
  {
    id: 2,
    content: '他们的AI解决方案真的很出色，智能客服系统上线后，我们的客户满意度提升了40%，人力成本下降了50%。',
    author: '赵芳',
    position: '运营总监',
    company: '某金融科技公司',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=happy%20businesswoman%20portrait%20professional&image_size=square',
    rating: 5
  },
  {
    id: 3,
    content: '从需求分析到项目交付，整个过程都非常专业顺畅。他们不仅交付了高质量的产品，还提供了很多有价值的建议。',
    author: '孙磊',
    position: '技术总监',
    company: '某制造企业',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20engineer%20portrait%20confident&image_size=square',
    rating: 5
  }
]

export const faqList: FAQItem[] = [
  {
    id: 1,
    question: '你们提供哪些服务？',
    answer: '我们提供全方位的数字化解决方案，包括云计算、人工智能、网络安全、软件开发、大数据分析和数字化营销等服务。我们会根据客户的具体需求，提供定制化的解决方案。'
  },
  {
    id: 2,
    question: '项目周期一般是多久？',
    answer: '项目周期取决于项目的复杂度和规模。一般来说，小型项目需要2-4周，中型项目需要1-3个月，大型项目可能需要3-6个月甚至更长时间。我们会在项目启动前提供详细的时间规划。'
  },
  {
    id: 3,
    question: '如何保证项目质量？',
    answer: '我们有严格的质量保证体系，包括代码审查、自动化测试、性能测试、安全测试等多个环节。每个项目都配备专门的项目经理和质量保证人员，确保项目按时高质量交付。'
  },
  {
    id: 4,
    question: '项目完成后提供售后支持吗？',
    answer: '是的，我们提供完善的售后支持服务。包括免费的bug修复期、技术支持热线、在线客服、系统维护和升级服务等。我们也提供长期的技术合作方案，确保客户的系统持续稳定运行。'
  },
  {
    id: 5,
    question: '如何开始合作？',
    answer: '您可以通过我们的官网在线咨询、拨打客服热线或发送邮件的方式联系我们。我们的客户经理会在24小时内与您取得联系，了解您的需求并提供专业的解决方案。'
  }
]

export const contactInfo: ContactInfo = {
  title: '联系我们',
  subtitle: '期待与您的合作',
  address: '北京市朝阳区科技园区创新大厦A座18层',
  phone: '400-888-8888',
  email: 'contact@example.com',
  workingHours: '周一至周五 9:00 - 18:00'
}

export const footerLinks: FooterLink[] = [
  {
    title: '产品服务',
    links: [
      { label: '云计算', path: '/services' },
      { label: '人工智能', path: '/services' },
      { label: '网络安全', path: '/services' },
      { label: '软件开发', path: '/services' }
    ]
  },
  {
    title: '关于我们',
    links: [
      { label: '公司简介', path: '/about' },
      { label: '团队介绍', path: '/about' },
      { label: '发展历程', path: '/about' },
      { label: '加入我们', path: '/about' }
    ]
  },
  {
    title: '新闻资讯',
    links: [
      { label: '公司新闻', path: '/news' },
      { label: '行业动态', path: '/news' },
      { label: '技术博客', path: '/news' }
    ]
  },
  {
    title: '联系方式',
    links: [
      { label: '在线咨询', path: '/contact' },
      { label: '商务合作', path: '/contact' },
      { label: '人才招聘', path: '/contact' }
    ]
  }
]

export const workItems: WorkItem[] = [
  {
    id: 1,
    title: '品牌视觉设计',
    category: '设计',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=minimalist%20brand%20design%20logo%20branding&image_size=portrait_4_3',
    description: '为科技公司打造的极简品牌视觉系统'
  },
  {
    id: 2,
    title: '移动应用界面',
    category: 'UI/UX',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=mobile%20app%20ui%20design%20minimal%20clean&image_size=square',
    description: '极简风格的移动应用界面设计'
  },
  {
    id: 3,
    title: '官网设计',
    category: '网页',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=minimal%20website%20design%20clean%20layout&image_size=landscape_4_3',
    description: '简约大气的企业官网设计'
  },
  {
    id: 4,
    title: '产品摄影',
    category: '摄影',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=minimal%20product%20photography%20white%20background&image_size=portrait_4_3',
    description: '极简风格产品摄影作品'
  },
  {
    id: 5,
    title: '插画设计',
    category: '插画',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=minimal%20illustration%20simple%20shapes%20art&image_size=square',
    description: '简约几何风格插画作品'
  },
  {
    id: 6,
    title: '海报设计',
    category: '设计',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=minimal%20poster%20design%20typography%20black%20white&image_size=portrait_4_3',
    description: '极简主义海报设计系列'
  }
]

export const companyInfo = {
  name: '创新科技有限公司',
  slogan: '用技术创造美好未来',
  icp: '京ICP备12345678号',
  copyright: '© 2024 创新科技有限公司 版权所有'
}
