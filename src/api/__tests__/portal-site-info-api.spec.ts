import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 租户侧「网站信息」的路径契约（Spec-C §5 那一行 `GET/PUT /api/portal/site-info` + 词表/爬虫/重写/逐页 SEO 读口）。
 *
 * 钉的是「端点长得对」：路径与动词逐字对齐 SiteInfoController，全部走 /portal/site-info（租户门口，
 * portal:siteinfo:manage），不是 /admin。适配层是「后端契约 ↔ 界面模型」的唯一收敛点——契约变了只改这里。
 */

const calls: Array<[string, unknown[]]> = [];

vi.mock('../http', () => ({
  default: {
    get: (...args: unknown[]) => (calls.push(['get', args])),
    post: (...args: unknown[]) => (calls.push(['post', args])),
    put: (...args: unknown[]) => (calls.push(['put', args]))
  }
}));

import {
  ROBOTS_MODE_RAW_OVERRIDE,
  ROBOTS_MODE_STRUCTURED,
  changeSourceColor,
  siteInfoApi,
  siteInfoFieldRows,
  type SiteInfoView
} from '../portalSiteInfo';

function lastCall(): { method: string; url: string; rest: unknown[] } {
  const entry = calls[calls.length - 1];
  return { method: entry[0], url: String(entry[1][0]), rest: entry[1].slice(1) };
}

beforeEach(() => {
  calls.length = 0;
});

describe('网站信息端点形状（对齐 SiteInfoController）', () => {
  it('读回整页：GET /portal/site-info，siteId 为空不往 query 里塞', async () => {
    await siteInfoApi.read(3);
    expect(lastCall()).toEqual({ method: 'get', url: '/portal/site-info', rest: [{ params: { siteId: 3 } }] });

    await siteInfoApi.read();
    expect(lastCall()).toEqual({ method: 'get', url: '/portal/site-info', rest: [{ params: { siteId: undefined } }] });
  });

  it('三份词表读口各自的路径', async () => {
    await siteInfoApi.fields();
    expect(lastCall()).toEqual({ method: 'get', url: '/portal/site-info/fields', rest: [] });

    await siteInfoApi.changeSources();
    expect(lastCall()).toEqual({ method: 'get', url: '/portal/site-info/change-sources', rest: [] });

    await siteInfoApi.crawlerOptions();
    expect(lastCall()).toEqual({ method: 'get', url: '/portal/site-info/crawler-options', rest: [] });
  });

  it('保存：PUT /portal/site-info，body 是 { siteId, fields:{key:patch} }，一次只发一项', async () => {
    await siteInfoApi.update({ siteId: 3, fields: { robots: { crawlers: ['gpt-bot'] } } });
    expect(lastCall()).toEqual({
      method: 'put',
      url: '/portal/site-info',
      rest: [{ siteId: 3, fields: { robots: { crawlers: ['gpt-bot'] } } }]
    });

    await siteInfoApi.update({ siteId: 3, fields: { llms_summary: { text: '摘要' } } });
    expect(lastCall()).toEqual({
      method: 'put',
      url: '/portal/site-info',
      rest: [{ siteId: 3, fields: { llms_summary: { text: '摘要' } } }]
    });
  });

  it('「让 AI 重写」：POST /portal/site-info/ai-rewrite（真实登记口，不假装已生成）', async () => {
    await siteInfoApi.aiRewrite({ siteId: 3, fields: ['robots', 'llms_summary'], instruction: '语气更专业' });
    expect(lastCall()).toEqual({
      method: 'post',
      url: '/portal/site-info/ai-rewrite',
      rest: [{ siteId: 3, fields: ['robots', 'llms_summary'], instruction: '语气更专业' }]
    });
  });

  it('逐页 SEO 只读镜像：GET /portal/site-info/pages/seo', async () => {
    await siteInfoApi.pagesSeo(3);
    expect(lastCall()).toEqual({ method: 'get', url: '/portal/site-info/pages/seo', rest: [{ params: { siteId: 3 } }] });
  });
});

describe('siteInfoFieldRows：字段顺序 = 后端词表顺序，未知字段附尾不丢', () => {
  const view: SiteInfoView = {
    tenantId: 3,
    siteId: 5,
    siteName: '示例',
    siteStatus: 'enabled',
    configId: 9,
    fields: {
      // 故意乱序塞进对象，验证排序靠词表不靠 Object.keys 顺序
      llms_txt_template: { key: 'llms_txt_template', label: 't', editable: false, changeSource: null, changeSourceLabel: '未记录', text: null },
      llms_summary: { key: 'llms_summary', label: 's', editable: true, changeSource: 'ai_brief_seo', changeSourceLabel: 'AI 生成', text: 'x' },
      robots: { key: 'robots', label: 'r', editable: true, changeSource: 'tenant_edit', changeSourceLabel: '人工修改', text: 'y', structured: { mode: ROBOTS_MODE_STRUCTURED, crawlers: [], overrideText: null, exportedText: 'y' } },
      geo_citation_summary: { key: 'geo_citation_summary', label: 'g', editable: true, changeSource: null, changeSourceLabel: '未记录', text: 'z' },
      brand_new_field: { key: 'brand_new_field', label: 'n', editable: false, changeSource: null, changeSourceLabel: '未记录', text: 'w' }
    }
  };

  it('前四项按词表顺序，第五项（后端新增、前端不认得）附在尾部而不是被丢弃', () => {
    const rows = siteInfoFieldRows(view);
    expect(rows.map(r => r.key)).toEqual([
      'robots', 'llms_summary', 'geo_citation_summary', 'llms_txt_template', 'brand_new_field'
    ]);
  });

  it('空读回不炸', () => {
    expect(siteInfoFieldRows(null)).toEqual([]);
  });

  it('raw_override 档位常量与后端 RobotsTxtPolicy 对齐', () => {
    expect(ROBOTS_MODE_STRUCTURED).toBe('structured');
    expect(ROBOTS_MODE_RAW_OVERRIDE).toBe('raw_override');
  });
});

describe('changeSourceColor 只认后端那两码，认不出走默认', () => {
  it('ai_brief_seo / tenant_edit / 其它', () => {
    expect(changeSourceColor('ai_brief_seo')).toBe('blue');
    expect(changeSourceColor('tenant_edit')).toBe('orange');
    expect(changeSourceColor(null)).toBe('default');
    expect(changeSourceColor('rollback')).toBe('default');
  });
});

describe('axios 实例 baseURL 已是 /api，这里不写第二遍前缀', () => {
  it('源码里没有一个请求路径以 /api 开头', () => {
    const raw = import.meta.glob('../portalSiteInfo.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
    const source = Object.values(raw).join('');
    const offenders = [...source.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0]);
    expect(offenders).toEqual([]);
  });
});
