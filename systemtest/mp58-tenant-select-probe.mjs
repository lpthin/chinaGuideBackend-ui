import { chromium } from '@playwright/test';
import fs from 'node:fs';
const UI='http://localhost:5190', OUT='E:/qoder/scratch/mp58-nav';
const say=s=>{fs.appendFileSync(`${OUT}/probe2.txt`,s+'\n');console.log(s)};
fs.writeFileSync(`${OUT}/probe2.txt`,'');
const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1440,height:1200}})).newPage();
await p.goto(`${UI}/login`,{waitUntil:'domcontentloaded'});
await p.getByPlaceholder('用户名').fill('admin');await p.getByPlaceholder('密码').fill('admin123');
await p.locator('.login-button').click();await p.waitForURL(/\/workspace/,{timeout:30000});await p.waitForTimeout(2000);
// 录一份新需求单 = 向导第一步的空白单
await p.goto(`${UI}/workspace/portal/wizard?step=intake`,{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.getByText('录一份新需求单').first().click();await p.waitForTimeout(2500);
const prof=p.locator('.brief-intake__profile');
say('PROFILE_TEXT='+JSON.stringify((await prof.innerText()).replace(/\s+/g,' ')));
// 第一颗 = 租户下拉
await prof.locator('.ant-select').first().click();await p.waitForTimeout(1200);
const opts=await p.evaluate(()=>Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')).map(n=>n.innerText.trim()));
say('TENANT_OPTIONS='+JSON.stringify(opts));
await p.screenshot({path:`${OUT}/wizard-tenant-select.png`});
// 有没有任何把手指向「建租户」
const bodyText=await p.locator('body').innerText();
say('HAS_WORD_新建租户='+bodyText.includes('新建租户')+' HAS_WORD_租户管理='+bodyText.includes('租户管理'));
await b.close();say('DONE');
