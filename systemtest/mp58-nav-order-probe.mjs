// M-P58 现读：超管左侧导航从上到下真实的排法（组名 + 组内项名，按 DOM 顺序），
// 以及「新建网站」向导第一步在没有任何入口指过去的情况下长什么样。
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const UI = 'http://localhost:5190';
const OUT = 'E:/qoder/scratch/mp58-nav';
fs.mkdirSync(OUT, { recursive: true });
const say = s => { fs.appendFileSync(`${OUT}/menu-order.txt`, s + '\n'); console.log(s); };
fs.writeFileSync(`${OUT}/menu-order.txt`, '');

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();

await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded' });
await page.getByPlaceholder('用户名').fill('admin');
await page.getByPlaceholder('密码').fill('admin123');
await page.locator('.login-button').click();
await page.waitForURL(/\/workspace/, { timeout: 30000 });
await page.waitForTimeout(2500);

// 逐组展开，按 DOM 顺序把「组名 → 组内项名」打出来
const titles = page.locator('.ant-menu-inline > .ant-menu-submenu > .ant-menu-submenu-title');
const groupCount = await titles.count();
say('GROUP_COUNT(top-level)=' + groupCount);
for (let i = 0; i < groupCount; i++) {
  const t = titles.nth(i);
  const label = (await t.innerText()).replace(/\s+/g, ' ').trim();
  const cls = await t.getAttribute('class');
  const open = /ant-menu-submenu-open/.test(cls || '');
  if (!open) { await t.click(); await page.waitForTimeout(600); }
  const items = await page.evaluate(idx => {
    const g = document.querySelectorAll('.ant-menu-inline > .ant-menu-submenu')[idx];
    return Array.from(g.querySelectorAll(':scope > .ant-menu-submenu-popup, :scope ul.ant-menu > li.ant-menu-item'))
      .map(n => n.innerText.trim().replace(/\s+/g, ' '));
  }, i);
  say(`GROUP[${i}] ${label} :: ` + JSON.stringify(items));
}
await page.screenshot({ path: `${OUT}/nav-all-expanded.png`, fullPage: false });

// 向导第一步：租户下拉里有什么、有没有任何一颗「去建租户」的把手
await page.goto(`${UI}/workspace/portal/wizard?step=intake`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const step1 = await page.evaluate(() => {
  const bodyText = document.body.innerText;
  return {
    hasTenantLabel: bodyText.includes('租户'),
    links: Array.from(document.querySelectorAll('a,button')).map(n => n.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean),
    selectPlaceholder: Array.from(document.querySelectorAll('.ant-select-selection-placeholder')).map(n => n.innerText.trim())
  };
});
say('WIZARD_STEP1 ' + JSON.stringify(step1, null, 1));
// 点开那颗租户下拉，看面板里的真实选项数与第一条
await page.locator('.ant-select').first().click();
await page.waitForTimeout(1200);
const opts = await page.evaluate(() => Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')).map(n => n.innerText.trim()));
say('TENANT_OPTIONS ' + JSON.stringify(opts));
await page.screenshot({ path: `${OUT}/wizard-step1.png`, fullPage: false });

// 栏目开通页：站点下拉的真实条目数与头几条（是不是把归档/候选站混在一起）
await page.goto(`${UI}/workspace/portal/sections`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.locator('.section-admin-page__filter .ant-select').first().click();
await page.waitForTimeout(1500);
const siteOpts = await page.evaluate(() => {
  const list = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'));
  return { total: list.length, first8: list.slice(0, 8).map(n => n.innerText.trim()), last3: list.slice(-3).map(n => n.innerText.trim()) };
});
say('SECTION_SITE_OPTIONS ' + JSON.stringify(siteOpts, null, 1));
const selText = await page.locator('.section-admin-page__filter .ant-select-selection-item').innerText().catch(() => '<none>');
say('SECTION_DEFAULT_SELECTED_SITE = ' + selText);
const cards = await page.evaluate(() => Array.from(document.querySelectorAll('.section-card__title')).map(n => n.innerText.trim().replace(/\s+/g, ' ')));
say('SECTION_CARDS ' + JSON.stringify(cards));
await page.screenshot({ path: `${OUT}/sections-page.png`, fullPage: false });

await browser.close();
say('DONE');
