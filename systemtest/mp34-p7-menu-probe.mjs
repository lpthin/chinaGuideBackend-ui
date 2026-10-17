// M-P34 p7 前置探针：侧栏这一族菜单在真实 DOM 里到底长什么样（组名、项名、有没有折叠）。
// 上一版 p7 把「建站」当成组名去点，超时了——这一支先把 DOM 里的名字全打出来，不猜。
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const UI = 'http://localhost:5190';
const OUT = 'E:/qoder/scratch/mp34-live/p7-evidence';
fs.mkdirSync(OUT, { recursive: true });
const lines = [];
const say = s => { lines.push(s); console.log(s); };

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('console', m => { if (m.type() === 'error') say('CONSOLE.ERROR ' + m.text().slice(0, 200)); });

await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded' });
await page.getByPlaceholder('用户名').fill('admin');
await page.getByPlaceholder('密码').fill('admin123');
await page.locator('.login-button').click();
await page.waitForURL(/\/workspace/, { timeout: 30000 });

async function dumpMenus(path) {
  await page.goto(`${UI}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const q = s => Array.from(document.querySelectorAll(s));
    return {
      menuRoots: q('.ant-menu').map(n => ({ cls: n.className, items: n.querySelectorAll('li').length })),
      submenuTitles: q('.ant-menu-submenu-title').map(n => n.innerText.trim().replace(/\s+/g, ' ')),
      itemTexts: q('.ant-menu-item').map(n => n.innerText.trim().replace(/\s+/g, ' ')),
      siderCls: q('.ant-layout-sider').map(n => n.className),
      collapsed: !!document.querySelector('.ant-menu-inline-collapsed'),
      overflow: q('.ant-menu-overflow-item').length,
      hiddenByDisplay: q('.ant-menu-item, .ant-menu-submenu-title').filter(n => getComputedStyle(n).display === 'none').length
    };
  });
  say('PATH ' + path + ' ' + JSON.stringify(info, null, 1));
  return info;
}

for (const p of ['/workspace/dashboard', '/workspace/portal/briefs', '/workspace/portal/proposal-overview']) {
  await dumpMenus(p);
}

// PROBE_SWITCH=1：先看「切到某一家租户」之后侧栏还剩哪几组。
// 这一支存在的理由：上一版 p7 在切过租户的那台上下文里找「建站」那一组，30 秒超时——
// 到底是这一组在租户档整个消失（那是界面的真话，得写进报告），还是我只是没等它渲染完。
const sw = process.env.PROBE_SWITCH;
if (sw) {
  await page.goto(`${UI}/workspace/portal/briefs`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const seg = page.locator('[data-test="scope-mode"]');
  await seg.locator('.ant-segmented-item', { hasText: '租户' }).first().click();
  await page.waitForTimeout(3000);
  await page.locator('.tenant-switcher').click();
  await page.waitForTimeout(900);
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
    { hasText: sw }).first().click();
  await page.waitForTimeout(3500);
  say('SWITCHED to ' + sw + ' url=' + page.url());
  say('SWITCH_CHIP ' + JSON.stringify(await page.locator('.tenant-switcher').innerText().catch(() => '<none>')));
  for (const p of ['/workspace/dashboard', '/workspace/portal/briefs', '/workspace/portal/brief/537',
    '/workspace/portal/proposal-overview', '/workspace/portal/wizard?step=generate&briefId=537']) {
    const info = await dumpMenus(p);
    const body = await page.locator('body').innerText();
    fs.writeFileSync(`${OUT}/switched-${p.replace(/[^a-z0-9]+/gi, '_')}.txt`, body);
    say('PATH ' + p + ' has_overview_leaf=' + info.itemTexts.includes('建站任务总览') +
        ' has_brief_title=' + info.submenuTitles.includes('建站') +
        ' body_has_建站任务总览=' + body.includes('建站任务总览') +
        ' body_len=' + body.length);
  }
}
fs.writeFileSync(`${OUT}/menu-probe.json`, JSON.stringify(lines, null, 1) + '\n');
await browser.close();
say('WROTE probe');
