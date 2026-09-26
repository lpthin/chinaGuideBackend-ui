import { describe, expect, it } from 'vitest'

/**
 * I-1 词表单源：前采需求单这一族文件里不许出现第二份词表（Spec §4.1 / §5 / §8 P1 验收门槛）。
 *
 * 为什么要扫源码而不是只测渲染：这一族的病根是「词表在后端有一份、前端再抄一份」——
 * SitesView 与 CompanyInfoView 曾经各抄过一份行业/市场/用户/商业模式清单（同一值两处可填），
 * 需求单 13 题若再抄一份选项中文或题目 key，超管改词表就只生效一半，界面上什么都不会报错。
 * 判据落在源码上才守得住「以后也不许抄」。
 *
 * 扫描分两圈：
 * - 四份旧抄本的词表中文（行业/市场/用户/商业模式）——五份文件里哪份出现都算复发；
 * - 需求单 13 题的选项中文与题目 key——只扫需求单三件套
 *   （CompanyInfoView 的「微博/抖音/邮箱」是它自己表单的栏目名，不是抄的词表，别误伤）。
 */

const scanned = import.meta.glob(
  ['../BriefIntakeView.vue', '../SiteBriefsView.vue', '../../../api/siteBriefs.ts',
    '../../workspace/SitesView.vue', '../CompanyInfoView.vue'],
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

const entries = Object.entries(scanned)

function textOf(path: string): string {
  const found = entries.find(([key]) => key.endsWith(path))
  return found ? String(found[1]) : ''
}

function briefFiles(): Array<[string, string]> {
  return entries.filter(([path]) =>
    /BriefIntakeView\.vue|SiteBriefsView\.vue|siteBriefs\.ts$/.test(path)
  ).map(([path, source]) => [path, String(source)])
}

/** 收编前两页各抄一份的四组词表中文（行业树/市场/用户/商业模式） */
const SITE_PROFILE_OPTIONS =
  /入境旅游|中国自由行|支付指南|住宿与酒店|签证与入境|营销自动化|数据分析|独立站|亚马逊|物流与支付|到店服务|首次来华游客|背包客|商务旅客|留学生|外籍工作者|家庭亲子游客|高端定制游客|数字游民|采购商|企业决策者|SaaS授权|品牌赞助|咨询服务|中国大陆|澳大利亚|新加坡|马来西亚|泰国|越南|澳门|台湾/

/** 收编前两页各抄的一份「站点主语言」清单（Spec §4.1 第 9 题）：值虽是英文码，标签是中文 */
const LOCALE_COPY = /简体中文|日本語|한국어|Русский|Tiếng Việt/

/** 需求单 13 题的选项中文（Spec §4.1 定稿里那批）：出现在需求单三件套 = 有人把词表抄进了代码 */
const BRIEF_QUESTION_OPTIONS =
  /专业严谨|亲和可信|年轻活力|高端克制|留下联系方式|电话咨询|加微信|看案例与实力|了解产品与服务|投递岗位|到店或来厂|经营数据成绩|合作客户|轮播图|招聘信息|新闻动态|留资表单|企业客户|个人消费者|海外买家|政府事业单位|渠道代理|线索型|内容资讯型|品牌展示型|订阅会员型|电商型|大段文字|数据条|精简（|团队介绍/

/** 13 题的题目 key：只许来自接口循环，不许作为字符串字面量写死进视图 */
const BRIEF_QUESTION_KEYS =
  /['"`](industry|sub_industry|audiences|primary_goal|must_have|tone|reference_urls|brand_color|scale|languages|channels|business_form|avoid)['"`]/

describe('I-1：需求单这一族文件没有第二份词表', () => {
  it('扫到了全部五份文件（glob 写错会让这条用例静默通过）', () => {
    expect(entries.length).toBe(5)
    for (const probe of [
      'BriefIntakeView.vue', 'SiteBriefsView.vue', 'api/siteBriefs.ts',
      'workspace/SitesView.vue', 'CompanyInfoView.vue'
    ]) {
      expect(entries.some(([path]) => path.endsWith(probe)), `没扫到 ${probe}`).toBe(true)
    }
  })

  /** 拿旧写法自验正则：写歪的「零命中」断言和真干净长得一模一样，必须先用病体证明药有效 */
  it('正则认得出被收编前的旧抄本与旧抄词表（自验，防的是扫了个空）', () => {
    const legacyProfile = "const industryOptions = [{ value: '入境旅游', label: '入境旅游', children: [{ value: '中国自由行' }] }]\n"
      + "const regionOptions = ['中国大陆', '澳大利亚'].map(v => ({ value: v, label: v }))\n"
      + "const audienceOptions = ['首次来华游客', '数字游民'].map(v => ({ value: v, label: v }))\n"
      + "const businessModelOptions = ['SaaS授权', '品牌赞助'].map(v => ({ value: v, label: v }))"
    expect(SITE_PROFILE_OPTIONS.test(legacyProfile)).toBe(true)

    // 语言清单那一份抄本（以前 SitesView:80 与 CompanyInfoView:499 逐字相同）：
    // 值是 ASCII，所以 SITE_PROFILE_OPTIONS 抓不到它，必须单独一条
    const legacyLocales = "const localeOptions = [{ value: 'zh-CN', label: '简体中文' }, { value: 'ja', label: '日本語' }]"
    expect(LOCALE_COPY.test(legacyLocales)).toBe(true)
    expect(SITE_PROFILE_OPTIONS.test(legacyLocales)).toBe(false)

    const legacyBrief = "<a-radio value=\"tone_pro\">专业严谨</a-radio>\n"
      + "<a-checkbox value='must_cases'>客户案例与经营数据成绩</a-checkbox>\n"
      + "const v = selections['primary_goal']"
    expect(BRIEF_QUESTION_OPTIONS.test(legacyBrief)).toBe(true)
    expect(BRIEF_QUESTION_KEYS.test(legacyBrief)).toBe(true)

    // 反向自验：新代码里的英文码与哨兵值不许被这三条误伤
    expect(SITE_PROFILE_OPTIONS.test("value: 'full', mode.code === 'auto'")).toBe(false)
    expect(BRIEF_QUESTION_OPTIONS.test('候选套数、演示内容档位、补充说明')).toBe(false)
    expect(BRIEF_QUESTION_KEYS.test('selections[q.key], PROFILE_QUESTION_KEYS.industry')).toBe(false)
  })

  it('站点画像那五份旧抄本已从两页源码里绝迹（收编完成，不是还留一份）', () => {
    const offenders = entries
      .filter(([, source]) => SITE_PROFILE_OPTIONS.test(String(source)) || LOCALE_COPY.test(String(source)))
      .map(([path]) => path)
    expect(offenders, `还留着抄来的词表中文：${offenders.join(', ')}`).toEqual([])
  })

  it('需求单三件套里没有一个选项中文、没有一处题目 key 字面量', () => {
    for (const [path, source] of briefFiles()) {
      expect(BRIEF_QUESTION_OPTIONS.test(source), `${path} 抄了选项中文`).toBe(false)
      if (!path.endsWith('siteBriefs.ts')) {
        expect(BRIEF_QUESTION_KEYS.test(source), `${path} 写死了题目 key`).toBe(false)
      }
    }
  })

  it('录入页按词表循环渲染：v-for 走 questions，题目名/选项名都取自 q.label/opt.label', () => {
    const intake = textOf('BriefIntakeView.vue')
    expect(intake).toMatch(/v-for="q in questions"/)
    expect(intake).toMatch(/\{\{\s*q\.label\s*\}\}/)
    expect(intake).toMatch(/v-for="opt in q\.options"/)
    expect(intake).toMatch(/\{\{\s*opt\.label\s*\}\}/)
    // 形态分支只许判 q.select 的英文取值，不许按题目 key 特判
    for (const kind of ['single', 'multi', 'cascade', 'color']) {
      expect(intake, `少了 ${kind} 形态的分支`).toMatch(new RegExp(`q\\.select === '${kind}'`))
    }
  })

  it('requirements_summary 只从 summary-preview 取，前端不拼句', () => {
    const intake = textOf('BriefIntakeView.vue')
    expect(intake).toMatch(/siteBriefsApi\.summaryPreview\(/)
    expect(intake).toMatch(/requirementsSummary/)
    // 300ms debounce 的节流口径
    expect(intake).toMatch(/300/)
    // 右侧标题就是用户点名的那句原话；失败时原话标注
    expect(intake).toMatch(/AI 将理解的这段话/)
    expect(intake).toMatch(/这段话还没刷新/)
  })

  it('录入页不摆任何调用生成/估算的按钮（那是 P3 的事，今天点了没反应就别挂）', () => {
    const intake = textOf('BriefIntakeView.vue')
    // 只钉「调用点与 CTA」：英文方法名一个都不许出现；中文只禁按钮说法，
    // 页脚那句解释「不提供出方案/预览，那是生成链路接通后的事」里的字不算违规。
    expect(intake).not.toMatch(/generate|estimate/i)
    expect(intake).not.toMatch(/发起生成|开始生成|一键生成|生成候选|生成方案|预估|估算费/)
    const list = textOf('SiteBriefsView.vue')
    expect(list).not.toMatch(/estimate|generate|发起生成|开始生成/)
    const apiSource = textOf('siteBriefs.ts')
    expect(apiSource).not.toMatch(/site-briefs\/[^'"`]*\/(estimate|generate)/)
  })

  it('两页消费端收编后真的在读接口词表，并带诚实降级的那句话', () => {
    for (const probe of ['SitesView.vue', 'CompanyInfoView.vue']) {
      const source = textOf(probe)
      expect(source, `${probe} 没在读 /portal/vocabulary`).toMatch(/vocabularyApi\.portalVocabulary\(\)/)
      expect(source, `${probe} 取不到词表时没说真话`).toMatch(/词表没取到，刷新重试/)
    }
  })
})
