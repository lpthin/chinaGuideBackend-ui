import { describe, expect, it } from 'vitest';

/**
 * 「网站信息」这一页的产品纪律源码守卫（Spec-C §6.4 R-4 / §7 / §8 P5；手法照 site-brief-vocabulary.spec.ts）。
 *
 * 要钉死的三件事：
 * 1. I-1：字段中文名、来源角标中文（AI 生成 / 人工修改 / 未记录）一律来自后端词表，视图里不许抄第二份；
 * 2. 界面不许谎报：「让 AI 重写」只是登记，结果只如实回显后端 message，绝不当成「已经重写成功」；
 * 3. 形态不许回到「让用户从零填」：robots 是勾选哪些 AI 爬虫（真相是集合、文本后端推导），
 *    覆写原文是折叠在后面的高级动作，不是页面上第一颗要人填的空。
 */

const scanned = import.meta.glob(
  ['../PortalSiteInfoView.vue', '../../../api/portalSiteInfo.ts'],
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>;

const view = Object.entries(scanned).find(([path]) => path.endsWith('PortalSiteInfoView.vue'))?.[1] ?? '';
const adapter = Object.entries(scanned).find(([path]) => path.endsWith('portalSiteInfo.ts'))?.[1] ?? '';

function textOf(path: string): string {
  const found = Object.entries(scanned).find(([key]) => key.endsWith(path));
  return found ? String(found[1]) : '';
}

describe('I-1：这一页不抄第二份中文词表', () => {
  it('扫到了视图与适配层两份文件（glob 写错会让这条静默通过）', () => {
    expect(view, '没扫到 PortalSiteInfoView.vue').not.toBe('');
    expect(adapter, '没扫到 portalSiteInfo.ts').not.toBe('');
  });

  it('后端那四个字段中文名没有一个是作为字面量写死在视图里（只显示 field.label）', () => {
    for (const label of ['AI 爬虫授权', '站点摘要（llms.txt 抬头）', 'AI 引用摘要', 'llms.txt 模板']) {
      expect(view, `视图抄了字段名「${label}」`).not.toContain(label);
    }
    expect(view).toMatch(/\{\{\s*field\.label\s*\}\}/);
  });

  it('来源角标中文（AI 生成 / 人工修改 / 未记录）只认后端，视图里一个都不出现', () => {
    for (const source of ['AI 生成', '人工修改', '未记录']) {
      expect(view, `视图抄了来源角标「${source}」`).not.toContain(source);
    }
    expect(view).toMatch(/\{\{\s*field\.changeSourceLabel\s*\}\}/);
  });

  it('爬虫项的中文显示来自后端 crawler.label，不自己列厂商名', () => {
    expect(view).toMatch(/\{\{\s*c\.label\s*\}\}/);
  });
});

describe('不许谎报：AI 重写只是登记', () => {
  it('重写结果原样回显后端 message，并按 generated 决定是成功还是警示色（本期恒 false）', () => {
    expect(textOf('PortalSiteInfoView.vue')).toMatch(/rewriteResult\.value = await siteInfoApi\.aiRewrite\(/);
    expect(view).toMatch(/rewriteResult\.generated \? 'success' : 'warning'/);
    expect(view).toMatch(/:message="rewriteResult\.message"/);
  });

  it('重写这条路径里没有 message.success / 没有「已重写完成」这种假成功', () => {
    expect(view).not.toMatch(/message\.success\([^)]*(重写|已重写)/);
    expect(view).not.toMatch(/重写完成|已重新生成/);
  });

  it('那句「不产生新内容」的口径只在适配层定义一份，视图引用常量而不是再抄一遍', () => {
    expect(adapter).toMatch(/REWRITE_NOT_GENERATED_YET_TEXT/);
  });
});

describe('形态：AI 先填好、租户只在不同意时改，robots 是勾选不是从零填', () => {
  it('页面顶部原话挂「AI 先填好、这一页没有必须你从零填的项」——文案在适配层一份', () => {
    expect(adapter).toMatch(/SITE_INFO_AI_FIRST_TEXT/);
    expect(view).toMatch(/SITE_INFO_AI_FIRST_TEXT/);
  });

  it('robots 主形态是勾选 AI 爬虫（v-for 走 structured.crawlers），覆写原文是折叠的高级动作', () => {
    expect(view).toMatch(/v-for="c in robotsCrawlers"/);
    expect(view).toMatch(/a-checkbox v-model:checked="crawlerChecked\[c\.id\]"/);
    // 覆写原文输入框只在点「直接覆写原文」后才出现，不是页面第一顺位要人填的空
    expect(view).toMatch(/v-if="overrideEditing"/);
    expect(view).toMatch(/保存爬虫勾选/);
  });

  it('可改文本项默认只读展示 AI 的值，点「改」才变输入框（改的是产物不是空白格）', () => {
    expect(view).toMatch(/v-if="editingKey !== field\.key"/);
    expect(view).toMatch(/v-else-if="field\.editable"/);
    expect(view).toMatch(/startEdit\(field\)">改</);
  });

  it('逐页 SEO 是只读镜像：写口不在这页，页面明说改它要经超管', () => {
    expect(view).toMatch(/siteInfoApi\.pagesSeo\(/);
    expect(view).toMatch(/逐页 SEO（只读）/);
    expect(view).toMatch(/写入这一层的口在超管侧/);
  });
});
