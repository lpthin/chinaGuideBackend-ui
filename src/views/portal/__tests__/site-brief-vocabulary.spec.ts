import { describe, expect, it } from 'vitest'

/**
 * I-1 词表单源 + 「不许谎报到哪一步」的源码守卫（Spec §4.1 / §5 / §8 P1 验收门槛；P3 起门禁挪到详情页）。
 *
 * 为什么要扫源码而不是只测渲染：这一族的病根是「词表在后端有一份、前端再抄一份」——
 * SitesView 与 CompanyInfoView 曾经各抄过一份行业/市场/用户/商业模式清单（同一值两处可填），
 * 需求单 13 题若再抄一份选项中文或题目 key，超管改词表就只生效一半，界面上什么都不会报错。
 * 判据落在源码上才守得住「以后也不许抄」。
 *
 * P3 改了「哪页许有什么按钮」的边界：出方案的 estimate/generate/progress 是 §5 定死的契约口，
 * 只许出现在适配层与需求单详情（门禁那一格）；录入页/列表页照旧一个花钱按钮都不许有。
 * P4 的口（promote/regenerate/preview-links/public brief）今天全族都不许出现——连函数都不写。
 *
 * 扫描分两圈：
 * - 四份旧抄本的词表中文（行业/市场/用户/商业模式）——六份文件里哪份出现都算复发；
 * - 需求单 13 题的选项中文与题目 key——扫需求单四件套 + 候选画廊
 *   （CompanyInfoView 的「微博/抖音/邮箱」是它自己表单的栏目名，不是抄的词表，别误伤）。
 */

const scanned = import.meta.glob(
  ['../BriefIntakeView.vue', '../SiteBriefsView.vue', '../BriefDetailView.vue', '../CandidateGalleryView.vue',
    '../../../api/siteBriefs.ts', '../../workspace/SitesView.vue', '../CompanyInfoView.vue'],
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

const entries = Object.entries(scanned)

function textOf(path: string): string {
  const found = entries.find(([key]) => key.endsWith(path))
  return found ? String(found[1]) : ''
}

function briefFiles(): Array<[string, string]> {
  return entries.filter(([path]) =>
    /BriefIntakeView\.vue|SiteBriefsView\.vue|BriefDetailView\.vue|CandidateGalleryView\.vue|siteBriefs\.ts$/.test(path)
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
  it('扫到了全部七份文件（glob 写错会让这条用例静默通过）', () => {
    expect(entries.length).toBe(7)
    for (const probe of [
      'BriefIntakeView.vue', 'SiteBriefsView.vue', 'BriefDetailView.vue', 'CandidateGalleryView.vue',
      'api/siteBriefs.ts', 'workspace/SitesView.vue', 'CompanyInfoView.vue'
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

  it('需求单四件套与候选画廊里没有一个选项中文、视图里没有一处题目 key 字面量', () => {
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

  it('P3 边界：花钱三口只许在适配层与详情页；录入页/列表页照旧一个生成按钮都不许有', () => {
    // 行为没变（不摆点了没反应的按钮），变的只是「详情②那一格今天真的有契约口了」
    const intake = textOf('BriefIntakeView.vue')
    expect(intake).not.toMatch(/briefGenerationApi|发起生成|开始生成|一键生成|生成候选|生成方案|预估|估算费/)
    expect(intake).toMatch(/不摆点不动的死链|也不摆一个点了没反应的/)  // 那句原话还在（注释/文案）
    const list = textOf('SiteBriefsView.vue')
    expect(list).not.toMatch(/briefGenerationApi|estimate|generate|发起生成|开始生成/)
    // 适配层按 §5 定死的路径接三个口——这正是「用 exactly these paths, verbs」的落点
    const apiSource = textOf('siteBriefs.ts')
    expect(apiSource).toMatch(/\/admin\/site-briefs\/\$\{id\}\/estimate/)
    expect(apiSource).toMatch(/\/admin\/site-briefs\/\$\{id\}\/generate/)
    expect(apiSource).toMatch(/\/admin\/site-briefs\/\$\{id\}\/progress/)
    // P4 的口今天连函数都不许写：写了就是给「点了没反应」埋源头（§5 preview-links / promote）
    expect(apiSource).not.toMatch(/\/(promote|regenerate|preview-links|regenerate)\b/)
    expect(apiSource).not.toMatch(/public\/brief/)
  })

  it('详情页读回答案只经适配层：题目名一个都不写在页面里', () => {
    const detail = textOf('BriefDetailView.vue')
    // 13 题的读回是 `briefAnswerRows` 一处实现（含级联翻名），页面只列它给的行
    expect(detail).toMatch(/briefAnswerRows\(/)
    expect(detail).toMatch(/:data-source="answerRows"/)
    expect(detail, '页面自己拼答案就等于抄第二份词表').not.toMatch(/readBriefSelections|briefOptionLabel\(/)
    // 摘要一律原话照抄后端那一份，页面不另拼一句、也不调 preview
    expect(detail).toMatch(/\{\{\s*brief\.requirementsSummary\s*\}\}/)
    expect(detail).not.toMatch(/summaryPreview\(/)
  })

  it('详情页四口全经适配层：P3 门禁三口 + P4 三口，预览地址与端点字符串一个都不自己拼', () => {
    const detail = textOf('BriefDetailView.vue')
    // ②的门禁三口按 §5 契约接上（真实调用点）；P4 落地后禁的对象从「不许调用」挪成
    // 「不许绕过适配层」：页面里出现端点字符串或自己拼 token，就等于第二份端点口径（I-1）
    expect(detail).toMatch(/briefGenerationApi\.estimate\(/)
    expect(detail).toMatch(/briefGenerationApi\.generate\(/)
    expect(detail).toMatch(/briefGenerationApi\.progress\(/)
    expect(detail).toMatch(/siteBriefDeliveryApi\.(decisions|promote|regenerate)\(/)
    expect(detail).not.toMatch(/\/admin\/site-briefs\/\$\{[^}]*\}\/(promote|regenerate|decisions)/)
    expect(detail).not.toMatch(/token=|public\/brief/)
    expect(detail).not.toMatch(/一键/)
    // 「不谎报到哪一步」：估算免责那句原话只许引用适配层常量（本地再抄一句就是第二份说法）
    expect(detail).toMatch(/ESTIMATE_UNDERESTIMATE_DISCLAIMER/)
    const sites = textOf('SitesView.vue')
    // 站点管理不给候选/归档摆 status 下拉：那两态归流水线，写了就是会写坏数据的控件
    expect(sites).toMatch(/<template v-if="statusLockedInForm">[\s\S]{0,400}?<a-select v-else/)
    expect(sites).toMatch(/这一站的状态归建站流水线管/)
  })

  it('候选画廊：截图位只许空着配原话，中文全部走适配层常量与后端 label（§6.7 / §9-4 / I-1）', () => {
    const gallery = textOf('CandidateGalleryView.vue')
    // 假缩略图判红：画廊里不许出现任何 <img 标签（口径 = 空槽 + 一句为什么）
    expect(gallery).not.toMatch(/<img\b/)
    expect(gallery).toMatch(/CANDIDATE_SHOT_UNAVAILABLE_TEXT/)
    expect(gallery).toMatch(/DEMO_CONTENT_DISCLAIMER_TEXT/)
    expect(gallery).toMatch(/PREVIEW_LINK_PENDING_TEXT/)
    // 预览地址只转述进度口的 previewUrl，前端不自己拼 token/域名
    expect(gallery).toMatch(/previewUrl/)
    expect(gallery).not.toMatch(/preview-links|token=/)
    // 阶段/子任务状态中文只认后端 label，查不到露原码——不许出现第二份 stage→中文 映射
    expect(gallery).toMatch(/row\.statusLabel \|\| row\.status/)
    expect(gallery).toMatch(/row\.stageLabel \|\| row\.stage/)
    expect(gallery).not.toMatch(/['"`](skeleton|copywriting|seo|demo_content|screenshot)['"`]\s*:\s*['""][\u4e00-\u9fff]/)
  })

  it('两页消费端收编后真的在读接口词表，并带诚实降级的那句话', () => {
    for (const probe of ['SitesView.vue', 'CompanyInfoView.vue']) {
      const source = textOf(probe)
      expect(source, `${probe} 没在读 /portal/vocabulary`).toMatch(/vocabularyApi\.portalVocabulary\(\)/)
      expect(source, `${probe} 取不到词表时没说真话`).toMatch(/词表没取到，刷新重试/)
    }
  })
})
