/**
 * M-P80 拍板④「拦归档、放候选」的现场取证（真打后端 :8080，零 mock）。
 *
 * 六道判据：
 *  A1 归档站的栏目读得到（GET 200 + success:true）
 *  A2 归档站整批保存被当面拒（success:false + code=SECTION_SITE_ARCHIVED + 那句中文原话）
 *  A3 归档站单行保存也被拒，同一个 code
 *  A4 拒完之后库里那几行一个字没动（对照 mysql 直读的整表 132 行，逐列比 30/31 两份快照）
 *  C1 候选站整批保存照旧改得动（只动目标那一栏的 nav_sort，回包里看得见新数字）
 *  C2 改完再把数字改回去（读回来的六栏与最初快照逐字相等；库里只余 updated_at 被盖过）
 *
 * 站点是「挑现成的」：没有归档站或没有候选站就报错停手，不为了凑样本去改任何一站的状态。
 * 口令只从环境变量读（ADMIN_USER / ADMIN_PASS），token 绝不打印。
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8080';
const OUT = process.env.MP80_OUT || 'E:/qoder/chinaGuideBackend-ui/scratch/mp80-nav/live';
fs.mkdirSync(OUT, { recursive: true });

let token = '';
const log = [];
function say(line) {
  log.push(line);
  console.log(line);
}
function dump(name, value) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2), 'utf8');
  return path.join(OUT, name);
}

async function call(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { http: res.status, json };
}

/**
 * 只改「看得见的这一格的这一个字段」，其余字段一律送 null。
 *
 * 后端 {@code SectionAccess#update} 对 null 是「跳过不动」，对非 null 是真写。如果把读回来的
 * 生效值原样送回去（显示名、开关、顺序全送），NULL 的列会被写成词表默认值 —— 探针自己造出一堆
 * 「改了又改回来但字面上不一样」的痕，A4/C2 就没法判了。
 */
function sectionPayload(states, target) {
  return states.map(s => ({
    key: s.key,
    displayName: null,
    enabled: null,
    navVisible: null,
    navSort: null,
    ...(target && s.key === target.key
      ? { displayName: target.displayName ?? null, navSort: target.navSort ?? null }
      : {})
  }));
}

const steps = [];
function record(name, ok, detail) {
  steps.push({ name, ok, detail });
  say(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
}

async function main() {
  const login = await call('POST', '/api/auth/login', {
    username: process.env.ADMIN_USER,
    password: process.env.ADMIN_PASS
  });
  if (!login.json?.data?.token) {
    throw new Error(`登录没拿到令牌：code=${login.json?.code} message=${login.json?.message}`);
  }
  token = login.json.data.token;
  say(`登录成功（用户名 ${process.env.ADMIN_USER}，令牌不落盘）`);

  const sites = await call('GET', '/api/admin/sites');
  if (!sites.json?.success) {
    throw new Error(`站点清单没读到：${JSON.stringify(sites.json).slice(0, 200)}`);
  }
  const all = sites.json.data;
  const histogram = all.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});
  say(`站点状态分布：${JSON.stringify(histogram)}（活站总数 ${all.length}，含软删读口不回的）`);
  dump('00-sites.json', all);

  const archived = all.find(s => s.status === 'archived');
  const candidate = all.find(s => s.status === 'candidate');
  if (!archived || !candidate) {
    throw new Error(`现场缺样本：archived=${archived?.id ?? '无'} candidate=${candidate?.id ?? '无'}；脚本不动任何站的状态`);
  }
  say(`取样：归档站 #${archived.id}「${archived.name}」，候选站 #${candidate.id}「${candidate.name}」`);

  /* ---- A1 归档站读得到 ---- */
  const aRead = await call('GET', `/api/admin/sites/${archived.id}/sections`);
  dump('10-archived-read.json', aRead);
  record('A1 归档站栏目读得到', aRead.json?.success === true && Array.isArray(aRead.json?.data),
    `http=${aRead.http} success=${aRead.json?.success} 栏数=${aRead.json?.data?.length}`);
  const aStates = aRead.json?.data || [];
  const aKey = aStates[0]?.key;

  /* ---- A2 归档站整批被拒（送一个假名字，证明它本来会落地） ---- */
  const aBulk = await call('PUT', `/api/admin/sites/${archived.id}/sections/bulk`,
    sectionPayload(aStates, { key: aKey, displayName: 'MP80-PROBE-SHOULD-NOT-LAND' }));
  dump('11-archived-bulk.json', aBulk);
  record('A2 归档站整批保存被拒', aBulk.json?.success === false && aBulk.json?.code === 'SECTION_SITE_ARCHIVED',
    `http=${aBulk.http} code=${aBulk.json?.code} 原话=${String(aBulk.json?.message).slice(0, 60)}…`);

  /* ---- A3 归档站单行被拒 ---- */
  const aOne = await call('PUT', `/api/admin/sites/${archived.id}/sections/${aKey}`,
    { displayName: 'MP80-PROBE-SHOULD-NOT-LAND', enabled: true, navVisible: true, navSort: 1 });
  dump('12-archived-single.json', aOne);
  record('A3 归档站单行保存被拒', aOne.json?.success === false && aOne.json?.code === 'SECTION_SITE_ARCHIVED',
    `http=${aOne.http} code=${aOne.json?.code}`);

  /* ---- A4 再读一次：一个字没动 ---- */
  const aRead2 = await call('GET', `/api/admin/sites/${archived.id}/sections`);
  dump('13-archived-read-after.json', aRead2);
  const unchanged = JSON.stringify(aRead2.json?.data) === JSON.stringify(aStates);
  record('A4 拒后重读与拒前逐字相等', unchanged,
    `两读同口；库侧独立对照见 30/31-db-*.txt（整表 132 行逐列比）`);

  /* ---- C1 候选站改得动：只动目标那一栏的 navSort，改的是可逆的数字 ---- */
  const cRead = await call('GET', `/api/admin/sites/${candidate.id}/sections`);
  dump('30-candidate-read.json', cRead);
  const cStates = cRead.json?.data || [];
  const cKey = cStates[0]?.key;
  const cNavSortOriginal = cStates[0]?.navSort;
  const cNavSortProbe = cNavSortOriginal + 7;
  const cPut = await call('PUT', `/api/admin/sites/${candidate.id}/sections/bulk`,
    sectionPayload(cStates, { key: cKey, navSort: cNavSortProbe }));
  dump('31-candidate-bulk.json', cPut);
  const landed = (cPut.json?.data || []).find(s => s.key === cKey)?.navSort === cNavSortProbe;
  record('C1 候选站整批保存照旧改得动', cPut.json?.success === true && landed,
    `http=${cPut.http} success=${cPut.json?.success} ${cKey}.navSort ${cNavSortOriginal}→` +
      `${(cPut.json?.data || []).find(s => s.key === cKey)?.navSort}`);

  /* ---- C2 改回原数：这一趟不留痕 ---- */
  const restored = await call('PUT', `/api/admin/sites/${candidate.id}/sections/bulk`,
    sectionPayload(cStates, { key: cKey, navSort: cNavSortOriginal }));
  dump('32-candidate-restore.json', restored);
  const cReadBack = await call('GET', `/api/admin/sites/${candidate.id}/sections`);
  dump('33-candidate-read-after.json', cReadBack);
  const backToStart = JSON.stringify(cReadBack.json?.data) === JSON.stringify(cStates);
  record('C2 候选站改完能改回原样', restored.json?.success === true && backToStart,
    `重读与最初快照逐字相等=${backToStart}`);

  say(`取样站点：归档站 #${archived.id} 候选站 #${candidate.id}（候选站被动过的只有 #${cKey} 的 nav_sort，已改回 ${cNavSortOriginal}）`);
  dump('99-steps.json', steps);
  const failed = steps.filter(s => !s.ok);
  say(`结论：${steps.length - failed.length}/${steps.length} 条判据过` + (failed.length ? `，失败：${failed.map(f => f.name).join('、')}` : ''));
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  say(`脚本中断：${error.message}`);
  fs.writeFileSync(path.join(OUT, 'zz-error.txt'), String(error.stack || error), 'utf8');
  process.exitCode = 2;
}).finally(() => {
  fs.writeFileSync(path.join(OUT, 'run-log.txt'), log.join('\n') + '\n', 'utf8');
});
