import type { CompanyInfoForm } from '@/types/portal'
import type { SettingsField, SettingsGroup } from '@/components/settingsPageModel'

/**
 * 企业信息这一屏「要人填哪几格」的唯一清单（Spec-Q P3，Q6 拍的「顶部锚点分组 + 完成度读数」）。
 *
 * 为什么收在文件里而不是视图里：完成度读数的分母必须是**真的**那一串格子。
 * 抄一个好看的数（改之前浏览器实测「33 个表单项」）会漂——加一格忘加分母，
 * 读数就说「共 33 项」而表单其实有 34 格。这里声明，`company-info-view-completion.spec.ts`
 * 拿它和 `defaultCompanyForm()` 的键逐一对账：多一格、少一格、重复一格都红。
 *
 * `label` 同一个字符串也是表单项上那句 label（同一个文件里再钉一条「这句在视图里出现」），
 * 所以「缺项清单里点的那一格」和「跳过去看到的标题」是同一句话。
 */

/** 这一屏的初始值；键的集合就是「这一页要人填的格子」的集合 */
export const COMPANY_FORM_DEFAULT: CompanyInfoForm = {
  companyName: '',
  englishName: '',
  shortName: '',
  foundedDate: '',
  creditCode: '',
  legalRepresentative: '',
  address: '',
  provinceName: '',
  cityName: '',
  postalCode: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
  serviceHotline: '',
  introduction: '',
  business: '',
  culture: '',
  industry: '',
  subIndustry: '',
  targetRegions: '',
  targetAudience: '',
  businessModel: '',
  coreProducts: '',
  competitorDomains: '',
  seedKeywords: '',
  excludedKeywords: '',
  searchLocales: '',
  wechat: '',
  weibo: '',
  douyin: '',
  linkedin: '',
  github: '',
  logoUrl: '',
  faviconUrl: '',
  certificateUrls: '',
  icpNumber: ''
}

/** 每次取值都要一份新对象，不能把这份常量当可变默认值往外发 */
export function defaultCompanyForm(): CompanyInfoForm {
  return { ...COMPANY_FORM_DEFAULT }
}

export interface CompanyFieldSpec {
  key: string
  label: string
  required?: boolean
}

export interface CompanyGroupSpec {
  key: string
  label: string
  side?: boolean
  fields: CompanyFieldSpec[]
}

/**
 * 8 组 / 37 格。`side` 那三组在宽屏挂右列，窄屏折回一栏。
 *
 * `required` 只有公司名称一格：这是保存闸真会拒的那一句
 * （`CompanyInfoView.handleSave` 里 `if (!form.companyName?.trim())`），
 * 其余 36 格是可填可不填——把它们也算进「必填没填」就是界面谎报。
 */
export const COMPANY_GROUPS: CompanyGroupSpec[] = [
  {
    key: 'basic',
    label: '基础信息',
    fields: [
      { key: 'companyName', label: '公司名称', required: true },
      { key: 'englishName', label: '英文名称' },
      { key: 'shortName', label: '公司简称' },
      { key: 'foundedDate', label: '成立日期' },
      { key: 'creditCode', label: '统一社会信用代码' },
      { key: 'legalRepresentative', label: '法人代表' },
      { key: 'address', label: '公司地址' },
      { key: 'provinceName', label: '所在省份' },
      { key: 'cityName', label: '所在城市' },
      { key: 'postalCode', label: '邮政编码' },
      { key: 'icpNumber', label: 'ICP备案号' }
    ]
  },
  {
    key: 'contact',
    label: '联系方式',
    fields: [
      { key: 'phone', label: '联系电话' },
      { key: 'fax', label: '传真号码' },
      { key: 'email', label: '电子邮箱' },
      { key: 'website', label: '官方网站' },
      { key: 'serviceHotline', label: '客服热线' }
    ]
  },
  {
    key: 'intro',
    label: '公司简介',
    fields: [
      { key: 'introduction', label: '公司简介' },
      { key: 'business', label: '主营业务' },
      { key: 'culture', label: '企业文化' }
    ]
  },
  {
    key: 'profile',
    label: '行业与画像',
    fields: [
      { key: 'industry', label: '行业分类' },
      { key: 'subIndustry', label: '细分行业' },
      { key: 'targetRegions', label: '目标市场' },
      { key: 'targetAudience', label: '目标用户' },
      { key: 'businessModel', label: '商业模式' },
      { key: 'searchLocales', label: '搜索语言' },
      { key: 'coreProducts', label: '核心产品/栏目' }
    ]
  },
  {
    key: 'keywords',
    label: '竞品与关键词',
    fields: [
      { key: 'competitorDomains', label: '竞品域名' },
      { key: 'seedKeywords', label: '种子关键词' },
      { key: 'excludedKeywords', label: '排除关键词' }
    ]
  },
  {
    key: 'brand',
    label: '品牌标识',
    side: true,
    fields: [
      { key: 'logoUrl', label: '公司Logo' },
      { key: 'faviconUrl', label: '站点图标（Favicon）' }
    ]
  },
  {
    key: 'social',
    label: '社交媒体',
    side: true,
    fields: [
      { key: 'wechat', label: '微信公众号' },
      { key: 'weibo', label: '微博' },
      { key: 'douyin', label: '抖音' },
      { key: 'linkedin', label: 'LinkedIn' },
      { key: 'github', label: 'GitHub' }
    ]
  },
  {
    key: 'qualification',
    label: '公司资质',
    side: true,
    fields: [{ key: 'certificateUrls', label: '资质文件' }]
  }
]

/** 由多值控件（级联 / 多选 / 逐行编辑）折算成一格读数用不用得上 */
export const COMPANY_MULTI_VALUE_KEYS = [
  'targetRegions',
  'targetAudience',
  'businessModel',
  'searchLocales',
  'competitorDomains',
  'seedKeywords',
  'excludedKeywords'
] as const

/**
 * 把「每格现在的值」摊成完成度读数能用的分组结构。
 *
 * 判「填了没」只看一件事：这一格折算出来的字符串去掉空白还剩不剩东西。
 * 逐行编辑器里那一行空输入框不算填过（改之前 `parseList` 会留一个 `''` 占位，
 * 拿它当「有值」会让读数一路报满）。
 */
export function buildCompanyGroups(values: Record<string, string>): SettingsGroup[] {
  return COMPANY_GROUPS.map(group => ({
    key: group.key,
    label: group.label,
    side: group.side,
    fields: group.fields.map<SettingsField>(field => ({
      key: field.key,
      label: field.label,
      required: field.required,
      done: (values[field.key] ?? '').trim() !== ''
    }))
  }))
}
