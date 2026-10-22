import { test, type Page } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { env } from '../lib/env';

/**
 * SYS-J14-UI 交付前自检在「页面巡检」那一屏上的两条念法（设计文档 §6 层 2 的界面落点）
 *
 * 判两件事，都必须是浏览器里真读到的字，不是单测里拼出来的字符串：
 * 1. 顶部那一条「交付前自检」念的结论与库里 `site_validation_run` 最新那一行一致
 *    （blocked 就说有几条拦项、pass 就说 0 条拦项，从没跑过就说「还没跑过」）；
 * 2. 「按页面看这一套」那一句归的堆与 `portal_health_finding` 里 open 那批逐页条数一致
 *    ——归堆只改呈现不改计数，屏上每一页的条数加起来必须等于表里 open 的总条数。
 *
 * 全程只读：只有登录、切档、点导航、点下拉，一句写接口都不调。
 * 站点选哪一家不写死：从库里现场挑「有 open 拦项、且已发布的页不少于 2 页」的那一站。
 */

interface GroupRow {
  page_id: number | null;
  n: number;
}

async function bodyText(page: Page): Promise<string> {
  return page.locator('body').innerText().catch(() => '');
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.locator('.ant-spin-spinning').last()
    .waitFor({ state: 'hidden', timeout: 25_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
}

/** 顶栏「平台 / 租户」分段控件：切档必然整页刷新（TenantSwitcher 里那三处 location.reload） */
async function switchScope(page: Page, label: '平台' | '租户'): Promise<void> {
  await page.locator('[data-test="scope-mode"] .ant-segmented-item', { hasText: label }).first().click();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1_500);
}

async function pickTenant(page: Page, tenantName: string): Promise<void> {
  await page.locator('.tenant-switcher').first().click();
  await page.locator('.ant-select-dropdown .ant-select-item-option', { hasText: tenantName }).first().click();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1_500);
}

test('SYS-J14-UI 自检那一条与按页面分组：屏上每个数都对得上库里的账', async ({ page }, testInfo) => {
  testInfo.setTimeout(300_000);
  const j = new Journal('SYS-J14-UI');

  const noise: string[] = [];
  page.on('pageerror', (e) => noise.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') noise.push(`console.error: ${m.text().slice(0, 300)}`);
  });

  const db = new Db(j);

  // ── 0 先只读库：挑一家有 open 拦项的站，屏上要看的就是它 ──────────────────
  const candidates = await db.rows<{ site_id: number; open_rows: number }>(
    `SELECT site_id, COUNT(*) AS open_rows FROM portal_health_finding
      WHERE status = 'open' GROUP BY site_id HAVING open_rows > 0 ORDER BY open_rows DESC LIMIT 8`);
  const named = await db.rows<{ id: number; name: string; tenant_id: number; status: string }>(
    `SELECT s.id, s.name, s.tenant_id, s.status FROM site s WHERE s.del_flag = 0`);
  let target: { siteId: number; siteName: string; tenantId: number; tenantName: string } | null = null;
  for (const row of candidates) {
    const site = named.find(s => s.id === Number(row.site_id));
    if (!site) continue;
    const pages = await db.count(
      `SELECT COUNT(*) AS n FROM portal_page WHERE site_id = ? AND status = 'published' AND del_flag = 0`,
      [site.id]);
    if (pages < 2) continue;
    const tenantRows = await db.rows<{ name: string }>(`SELECT name FROM tenant WHERE id = ?`, [site.tenant_id]);
    target = {
      siteId: site.id, siteName: site.name, tenantId: site.tenant_id,
      tenantName: tenantRows[0]?.name ?? '',
    };
    break;
  }
  j.expect('库里挑得出一家有 open 拦项、且发布页不少于 2 页的站（这一屏要有活样本）', target !== null, true);
  if (!target) {
    j.assertClean();
    return;
  }
  const picked: { siteId: number; siteName: string; tenantId: number; tenantName: string } = target;
  j.note('这一轮浏览器站在哪家租户、哪一站上看自检那一条（只读）', picked);

  const groups = await db.rows<GroupRow>(
    `SELECT page_id, COUNT(*) AS n FROM portal_health_finding
      WHERE site_id = ? AND status = 'open' GROUP BY page_id ORDER BY page_id`, [picked.siteId]);
  const totalOpen = groups.reduce((sum, g) => sum + Number(g.n), 0);
  j.note('库里这一站 open 那批的逐页条数（屏上那一句要与此逐字对上）', {
    归堆: groups.map(g => ({ 页: g.page_id, 条数: Number(g.n) })), 合计: totalOpen,
  });

  const latest = await db.rows<{ verdict: string | null; blocker_count: number | null; round: number | null }>(
    `SELECT verdict, blocker_count, round FROM site_validation_run WHERE site_id = ? ORDER BY id DESC LIMIT 1`,
    [picked.siteId]);
  j.note('库里这一站最新那一跑自检（顶部那一条念的就是它）', latest[0] ?? null);

  // ── 1 走界面：登录（表单）→ 切租户档 → 站到那一家 → 点进「页面巡检」 ──────
  const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
  const principals = sa.api.principal(sa.res);
  j.expect('这一屏用的身份确有 SUPER_ADMIN（候选站只超管看得见）',
    principals.roles.includes('SUPER_ADMIN'), true);

  await page.goto(`${env.uiBase}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('用户名').fill(env.superAdmin.username);
  await page.getByPlaceholder('密码').fill(env.superAdmin.password);
  await page.locator('.login-button').click();
  await page.waitForURL(/\/workspace/, { timeout: 30_000 });
  await settle(page);

  await switchScope(page, '租户');
  await pickTenant(page, picked.tenantName);
  const chosenTenant = await page.evaluate(() => localStorage.getItem('selected_tenant_id'));
  j.expect('顶栏选了租户之后前端记下的租户号就是这一站那一家', Number(chosenTenant), picked.tenantId);

  // 菜单里那一条现读在「平台质量」组（workspaceMenu.ts:103 label、:199 归属），这一轮要的是
  // 「站到这一家、看这一站的账」，所以直接用路由进这一屏（守卫只认 portal:build:health 那一枚码，超管有）。
  const menuLeaf = page.locator('.ant-menu-item', { hasText: '页面巡检' }).first();
  j.note('当前这一档侧栏里「页面巡检」这一项在不在（不在只是入口归到平台那一档，不是这一屏打不开）',
    { 可见: await menuLeaf.isVisible().catch(() => false) });

  await page.goto(`${env.uiBase}/workspace/portal/health`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('交付前自检'), undefined,
    { timeout: 25_000, polling: 500 }).catch(() => undefined);
  await settle(page);
  j.expect('这一屏停在页面巡检那一屏（屏上念得到「交付前自检」那一句）',
    [page.url().includes('/workspace/portal/health'), (await bodyText(page)).includes('交付前自检')], [true, true]);

  // ── 2 站点下拉里选到这一站（候选站只超管可见，所以下拉里得能找到它） ──────
  const siteLabel = page.locator('.portal-health-page__filter-label', { hasText: '站点' }).first();
  const hasSiteSelect = await page.locator('.portal-health-page__filter-label', { hasText: '站点' }).count();
  j.expect('这一屏给了「站点」那颗筛选（多家站可选时才摆，只有一家不给）', hasSiteSelect > 0, true);
  if (hasSiteSelect > 0) {
    // 那颗下拉与「站点」这颗标签是兄弟节点，不嵌在标签里（PortalHealthView.vue:23-24）
    const siteSelect = siteLabel.locator('xpath=following-sibling::div[contains(@class,"ant-select")][1]');
    await siteSelect.click();
    await page.locator('.ant-select-dropdown .ant-select-item-option', { hasText: picked.siteName }).first().click();
    await settle(page);
  }
  const screenText = await bodyText(page);
  j.record('screen-body', '页面巡检', { url: page.url(), 字数: screenText.length, 正文: screenText.slice(0, 1_500) });
  await page.screenshot({ path: `${env.evidenceDir}/screen-portal-health.${env.runId}.png`, fullPage: true });

  // ── 3 顶部那一条自检：念的句子必须与库里最新那一行同档、同数 ──────────────
  const stripText = (await page.locator('.site-validation__text').first().innerText().catch(() => '')).trim();
  j.note('屏上「交付前自检」那一句的原话', stripText);
  const run = latest[0];
  if (run && stripText) {
    if (run.verdict === 'blocked') {
      j.expect('库里那一跑是 blocked ⇒ 屏上照实念有几条拦项，不演成通过',
        [stripText.includes('拦项'), stripText.includes(String(run.blocker_count))], [true, true]);
    } else if (run.verdict === 'pass') {
      j.expect('库里那一跑是 pass ⇒ 屏上念「通过」与 0 条拦项',
        [stripText.includes('通过'), stripText.includes('0 条拦项')], [true, true]);
    } else if (run.verdict === 'error') {
      j.expect('库里那一跑是 error ⇒ 屏上念「没能看全」，不念「没查出问题」',
        stripText.includes('没能看全'), true);
    }
  }

  // ── 4 按页面分组那一句：逐页条数与库里对平，加总等于总条数 ────────────────
  const grouping = page.locator('.portal-health-page__grouping');
  j.expect('屏上有「按页面看这一套」那一句', await grouping.count(), 1);
  const groupItems = await page.locator('.portal-health-page__group-item').allInnerTexts();
  const parsed = groupItems.map(t => {
    const m = /(\d+)\s*条/.exec(t.replace(/\s+/g, ' '));
    return { 原文: t.replace(/\s+/g, ' ').trim(), 条数: m ? Number(m[1]) : null };
  });
  j.note('屏上归堆那几项的原样', parsed);
  j.expect('归堆项的条数加起来等于库里这一站 open 的总条数（归堆不改计数）',
    parsed.reduce((sum, p) => sum + (p.条数 ?? 0), 0), totalOpen);
  j.expect('归堆的项数等于库里不同的页数（含站点级那一堆）',
    parsed.length, groups.length);
  const screenCounts = parsed.map(p => p.条数).sort((a, b) => (a ?? 0) - (b ?? 0));
  const dbCounts = groups.map(g => Number(g.n)).sort((a, b) => a - b);
  j.expect('逐页条数一份不差（屏上那串数与库里 GROUP BY 的结果逐个相等）', screenCounts, dbCounts);

  // 光对条数不够：归堆那句还得把「哪一页」念对。上一跑就是靠这条抓到我把页号截掉了一位
  // （4178 念成 178，条数全对、页号全错，界面照样一片绿）。
  const pageTitles = await db.rows<{ id: number; title: string }>(
    `SELECT id, title FROM portal_page WHERE site_id = ? AND status = 'published' AND del_flag = 0`, [picked.siteId]);
  const labelIds = parsed.map(p => Number(/#(\d+)/.exec(p.原文)?.[1] ?? NaN));
  const dbPageIds = groups.map(g => Number(g.page_id)).sort((a, b) => a - b);
  j.expect('归堆那几项念的页号，与库里 GROUP BY 的那几个 page_id 逐个相等',
    labelIds.filter(n => !Number.isNaN(n)).sort((a, b) => a - b), dbPageIds);
  const namedOk = dbPageIds.every(id => {
    const title = pageTitles.find(p => Number(p.id) === id)?.title ?? '';
    return parsed.some(p => p.原文.includes(`#${id}`) && (!title || p.原文.includes(title)));
  });
  j.expect('每一堆都带得上那一页的名字（不是只念一个裸号）', namedOk, true);

  // ── 5 噪声：这一趟不许有 console error / pageerror ────────────────────────
  j.note('控制台噪声清单', noise);
  j.expect('这一屏全程没有 console error / pageerror', noise, []);

  j.assertClean();
});
