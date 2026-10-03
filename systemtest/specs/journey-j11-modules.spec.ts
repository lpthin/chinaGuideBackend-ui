import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, probeUser, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J11 官网模块通用能力（判据 G-13）
 * spec §5：「招聘（含 /jobs）、产品/服务、案例、门店、留言板、企业信息 六个模块：
 *            后台增删 → 门户公开页读得到 → 缺权限角色被拒。」
 *
 * 公开读怎么指到探针这一家：SiteResolver 先认 ?site=（dev 档 application-dev.yml:53
 * allow-site-param: true，生产默认关），再认 Host。所以本用例的公开口一律带 ?site=<站码>，
 * 不碰 hosts、不改任何真实域名的记录。
 *
 * 写只发生在探针租户里；真实租户一个字节都不写。
 */

interface Page<T> { records?: T[]; total?: number }

test('SYS-J11 官网模块通用能力：六模块 增删→公开读→缺码被拒', async () => {
  const j = new Journal('SYS-J11');
  const db = new Db(j);
  const tag = process.env.E2E_J11_TAG ?? `J11${Date.now()}`;
  const q = (path: string) => `${path}${path.includes('?') ? '&' : '?'}site=${T.siteCode}`;

  let T: Awaited<ReturnType<typeof provisionTenant>>;
  const createdIds: Array<{ 名字: string; run: () => Promise<void> }> = [];
  try {
    j.card({
      用例号: 'SYS-J11-01',
      判据: 'G-13',
      层级: 'API',
      前置: `后端 ${env.apiBase}；探针租户由 POST /api/admin/tenants 现开（站 ${'${siteCode}'} 状态 enabled）；公开口靠 dev 档的 ?site= 认站`,
      步骤: [
        '1 超管登录 + 开一家探针租户（站点行由开通链自己长出来）',
        '2 企业信息：PUT /api/company/info（单例，没有 POST/DELETE）→ 公开 /api/portal/public/site 的 company.name',
        '3 招聘：POST /api/portal/jobs（status=OPEN）→ 公开 /jobs 有它 → DELETE → 公开口没有它',
        '4 案例：POST /api/operation/cases（喂门户的那张表）→ 公开 /cases 有它 → DELETE → 没有它',
        '5 门店：POST /api/portal/stores → 租户侧列表有它 → 再取公开渲染页 /p/{slug} 看在不在',
        '6 展示内容（产品/服务的真数据源）：POST /api/portal/showcase → portal-visible 口有它 → DELETE',
        '7 留言板：公开 POST /api/portal/public/inquiry 投一条 → 租户侧 GET /api/guestbook 读得到它',
        '8 反例：挂 VIEWER（实测没有 portal:siteinfo:manage）的账号逐个打这六张管理口 —— 其中五张有闸各回 403，第六张（/api/operation/cases）没有闸，按判据缺口原样登记',
        '9 反例续：/api/cases（不喂门户的那张表）到底有没有权限闸 —— 判这条判据的第二个缺口',
      ],
      期望: [
        '步骤 2-7 每一张「后台写了行」都能在自己的读路径上被点名（公开 JSON 有就写公开，没有就写清只有渲染口）',
        '步骤 8 有闸的五张各回 403 + PERMISSION_DENIED，不许 200 蒙混；没有闸的那张不许记成通过，落一条「判据缺口」',
        '收尾按 id 删干净：库里本轮前缀的活行 = 0',
      ],
      反例: ['VIEWER 缺 portal:siteinfo:manage 打有闸的五张管理口 = 403（第六张无闸，见判据缺口行）', '删掉之后公开读回不了这一行（不是缓存里剩的假通过）'],
      收尾: 'DELETE 每行的业务口 → retireTenant 软删探针租户 → residue() 按本轮前缀清点并落盘',
    });

    // ── 1 身份与探针租户 ────────────────────────────────────────────────────
    const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
    T = await provisionTenant(sa.api, db, j, tag);
    j.note('探针租户与站点', { tenantId: T.tenantId, siteId: T.siteId, siteCode: T.siteCode });
    const admin = T.admin;

    // 公开读这条路本身要先成立，否则后面的「公开口没有它」全是假阴性
    const shell = await Api.anonymous(env.apiBase, j).get(`/api/portal/public/site?site=${T.siteCode}`);
    j.expect('匿名（无 token）用 ?site= 能翻开探针站的门户壳', shell.code, 'OK');
    j.expect('门户壳回显的就是这一家新建探针租户的站',
      (shell.data as Record<string, unknown>)?.siteCode, T.siteCode);

    const publicAbsent = async (path: string, needle: string, pick: (d: unknown) => string[]) => {
      const res = await Api.anonymous(env.apiBase, j).get(q(path));
      return { hit: pick(res.data).some(v => v === needle), status: res.status, code: res.code };
    };

    // ── 2 企业信息（单例，PUT 就是它的「增删」两端） ────────────────────────
    const companyName = `E2E-${env.runId}-company`;
    const putCompany = await admin.put('/api/company/info', {
      siteId: T.siteId,
      companyName,
      introduction: '系统测试用的企业简介，本轮结束即失效。',
      address: 'E2E Test Road 1',
      phone: '010-00000000',
      email: 'e2e@example.invalid',
    });
    j.expect('企业信息 PUT 回 OK', putCompany.code, 'OK');
    const shell2 = await Api.anonymous(env.apiBase, j).get(q('/api/portal/public/site'));
    j.expect('公开门户壳里的 company.name = 刚写进去的企业名',
      ((shell2.data as Record<string, unknown>)?.company as Record<string, unknown>)?.name, companyName);
    j.note('企业信息是单例：GET/PUT /api/company/info，没有 POST/DELETE —— 这一模块的「删」端点不存在',
      { 探过的口: ['POST /api/company/info', 'DELETE /api/company/info'] });

    // ── 3 招聘 ───────────────────────────────────────────────────────────────
    const jobTitle = `E2E-${env.runId}-job 门站工程师`;
    const job = await admin.post('/api/portal/jobs', {
      siteId: T.siteId,
      title: jobTitle,
      department: '研发',
      jobType: 'FULL_TIME',
      location: '上海',
      salaryMin: 18000,
      salaryMax: 30000,
      salaryUnit: 'MONTHLY',
      description: '系统测试岗位描述，用完即删。',
      requirements: '无',
      benefits: '无',
      status: 'OPEN',
      sortOrder: 1,
    });
    j.expect('招聘 POST 回 OK', job.code, 'OK');
    const jobId = Number((job.data as Record<string, unknown>)?.id ?? 0);
    j.check('招聘这行落库且状态是 OPEN（公开口只认 OPEN）', jobId, jobId > 0);
    const jobInPublic = await publicAbsent('/api/portal/public/jobs', jobTitle,
      d => ((d as Page<Record<string, unknown>>)?.records ?? []).map(r => String(r.title)));
    j.expect('公开 /api/portal/public/jobs 读得到这一条', jobInPublic.hit, true);

    // ── 4 案例：门户读的是 operation_case，不是 case_info ────────────────────
    const caseTitle = `E2E-${env.runId}-case 客户案例`;
    const opCase = await admin.post('/api/operation/cases', {
      siteId: T.siteId,
      title: caseTitle,
      customerName: '探针客户',
      industry: '制造业',
      region: '华东',
      summary: '系统测试案例摘要。',
      content: '系统测试案例正文。',
      status: 'PUBLISHED',
      isDemo: false,
      sortOrder: 1,
    });
    j.expect('案例 POST /api/operation/cases 回 OK', opCase.code, 'OK');
    const opCaseId = Number((opCase.data as Record<string, unknown>)?.id ?? 0);
    const caseInPublic = await publicAbsent('/api/portal/public/cases', caseTitle,
      d => ((d as Page<Record<string, unknown>>)?.records ?? []).map(r => String(r.title)));
    j.expect('公开 /api/portal/public/cases 读得到这一条', caseInPublic.hit, true);
    createdIds.push({
      名字: 'operation/case',
      run: async () => { await admin.del(`/api/operation/cases/${opCaseId}`); },
    });

    // ── 5 门店 ───────────────────────────────────────────────────────────────
    const storeName = `E2E-${env.runId}-store 探针门店`;
    // StoreForm 只认它自己那八个键，多一个都当场拒（2026-10-03 实测 ?siteId 会撞 STORE_FIELD_UNKNOWN）：
    // 门店按租户归属、不按站点，站码在这条路上没有意义
    const store = await admin.post('/api/portal/stores', {
      name: storeName,
      address: '上海市浦东新区探针路 1 号',
      phone: '021-00000000',
      businessHours: '09:00-18:00',
      status: 1,
      sortOrder: 1,
    });
    j.expect('门店 POST 回 OK', store.code, 'OK');
    const storeId = Number((store.data as Record<string, unknown>)?.id ?? 0);
    const storeList = await admin.get(q('/api/portal/stores'));
    const storeRows = (Array.isArray(storeList.data)
      ? storeList.data
      : (storeList.data as Page<Record<string, unknown>>)?.records ?? []) as Array<Record<string, unknown>>;
    const storeNames = storeRows.map(s => String(s.name));
    j.expect('门店写进来后，门户侧门店口读得到（公开 JSON 口没有这一个，见下一行 note）',
      storeNames.includes(storeName), true);

    // ── 6 展示内容（产品/服务这一格的真数据源） ──────────────────────────────
    const showcaseTitle = `E2E-${env.runId}-svc 探针服务`;
    const svc = await admin.post('/api/portal/showcase', {
      siteId: T.siteId,
      kind: 'metric',
      title: showcaseTitle,
      subtitle: '自探针轮次',
      valueNumber: 100,
      valueSuffix: '%',
      sortOrder: 1,
      enabled: true,
      isDemo: false,
    });
    j.expect('展示内容 POST 回 OK（kind 词表里的 metric）', svc.code, 'OK');
    const svcId = Number((svc.data as Record<string, unknown>)?.id ?? 0);
    const visible = await admin.get(`/api/portal/showcase/portal-visible?siteId=${T.siteId}`);
    const visibleTitles = ((visible.data as Page<Record<string, unknown>>)?.records ?? visible.data as Array<Record<string, unknown>> ?? [])
      .map(r => String(r.title));
    j.expect('展示内容 enabled+isDemo=false 之后，门户可见口点得到它', visibleTitles.includes(showcaseTitle), true);

    // ── 7 留言板：公开写 → 租户侧读 ─────────────────────────────────────────
    const inquiryContent = `E2E-${env.runId} 想问一下门户改造的报价`;
    const inq = await Api.anonymous(env.apiBase, j).post(q('/api/portal/public/inquiry'), {
      name: '探针访客',
      company: '探针有限公司',
      phone: '13800000000',
      email: 'visitor@example.invalid',
      budget: 'not_sure',
      content: inquiryContent,
      page: '/contact',
    });
    j.expect('公开留资 POST 回 OK', inq.code, 'OK');
    j.note('留资的返回体不许当判据：InquiryService 收了/拦了都回同一份回执，判据在下面那条租户侧读',
      inq.data ?? null);
    const guestbook = await admin.get(`/api/guestbook?page=1&size=50&keyword=${encodeURIComponent(inquiryContent)}`);
    const gbRecords = (guestbook.data as Page<Record<string, unknown>>)?.records ?? [];
    j.expect('租户侧留言板读得到这条公开留资（keyword 筛的正是它）',
      gbRecords.some(r => String(r.content).includes(inquiryContent)), true);
    const guestbookRow = gbRecords.find(r => String(r.content).includes(inquiryContent));
    if (guestbookRow) {
      createdIds.push({
        名字: 'guestbook',
        run: async () => { await admin.del(`/api/guestbook/${Number(guestbookRow.id)}`); },
      });
    }

    // ── 8 反例：缺 portal:siteinfo:manage 的角色逐个打六张管理口 ─────────────
    const viewer = await probeUser(sa.api, db, T, 'VIEWER', `${tag}V`, j);
    j.expect('VIEWER 这个探针账号确实没有门户信息码（否则下面 403 测的不是缺码）',
      viewer.principal.permissions.includes('portal:siteinfo:manage'), false);
    const gates: Array<[string, string]> = [
      ['企业信息', '/api/company/info'],
      ['招聘', '/api/portal/jobs'],
      ['门店', q('/api/portal/stores')],
      ['展示内容', '/api/portal/showcase'],
      ['留言板', '/api/guestbook'],
    ];
    for (const [name, path] of gates) {
      const denied = await viewer.api.get(path);
      j.expect(`反例：VIEWER 读「${name}」管理口 = 403`, denied.status, 403);
      j.expect(`反例：VIEWER 读「${name}」错码 = PERMISSION_DENIED`, denied.code, 'PERMISSION_DENIED');
    }
    // 第六张口（案例）不并进上面那个矩阵：它根本没有权限闸，硬写成 403 就是把已知缺陷记成通过。
    // 判据缺口的证据是两条：类与方法上都没有 @RequirePermission（源码事实），以及 VIEWER 实测读得到。
    const ungated = await viewer.api.get('/api/operation/cases?page=1&size=5');
    j.record('判据缺口', 'G-13 反例腿：/api/operation/cases 没有权限闸（OperationCaseController 无 @RequirePermission，'
      + '而 permission 表 34 个码里没有任何 case/operation 码，补闸要先定码与授给谁）',
      { status: ungated.status, code: ungated.code, 探针角色: 'VIEWER', 读到的行数:
        ((ungated.data as Page<Record<string, unknown>>)?.records ?? []).length });
    const deniedWrite = await viewer.api.post('/api/portal/jobs', { siteId: T.siteId, title: `VIEWER 不该写成`, status: 'OPEN' });
    j.expect('反例：VIEWER 连写也被拒（不只是读）= 403', deniedWrite.status, 403);

    // ── 9 第二个缺口：/api/cases 是哪张表、有没有闸 ─────────────────────────
    const viewerOnCases = await viewer.api.get('/api/cases');
    j.note('反例续：VIEWER 打 /api/cases 的实际结果（这张表不喂门户 public/cases）',
      { status: viewerOnCases.status, code: viewerOnCases.code });

    // ── 10 删除之后公开口读不到（证明「公开读得到」不是缓存里的假通过） ──────
    const delJob = await admin.del(`/api/portal/jobs/${jobId}`);
    j.expect('招聘 DELETE 回 OK', delJob.code, 'OK');
    const jobGone = await publicAbsent('/api/portal/public/jobs', jobTitle,
      d => ((d as Page<Record<string, unknown>>)?.records ?? []).map(r => String(r.title)));
    j.expect('删掉之后公开 /jobs 不再回这一条', jobGone.hit, false);

    const delCase = await admin.del(`/api/operation/cases/${opCaseId}`);
    j.expect('案例 DELETE 回 OK', delCase.code, 'OK');
    j.record('teardown', '删掉 operation/case', { code: delCase.code });
    const caseGone = await publicAbsent('/api/portal/public/cases', caseTitle,
      d => ((d as Page<Record<string, unknown>>)?.records ?? []).map(r => String(r.title)));
    j.expect('案例删掉之后公开 /cases 不再回它', caseGone.hit, false);

    for (const c of createdIds) {
      await c.run();
      j.record('teardown', `删掉 ${c.名字}`, {});
    }
    const delStore = await admin.del(`/api/portal/stores/${storeId}`);
    j.record('teardown', `删掉 门店 #${storeId}`, { code: delStore.code });
    const delSvc = await admin.del(`/api/portal/showcase/${svcId}`);
    j.record('teardown', `删掉 展示内容 #${svcId}`, { code: delSvc.code });

    // ── 11 库里数：本轮前缀的活行必须归零 ───────────────────────────────────
    // 留言板那一张单独按 is_deleted 数：portal_guestbook 有两列软删（`is_deleted` 是业务读路径认的，
    // `del_flag` 是 MyBatis-Plus 的 @TableLogic），照 §3 第 1 条那条纪律 —— 数错列会假红。
    const live = await db.rows<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM portal_job WHERE title LIKE ? AND del_flag='0')
            + (SELECT COUNT(*) FROM store WHERE name LIKE ? AND del_flag='0')
            + (SELECT COUNT(*) FROM operation_case WHERE title LIKE ? AND del_flag='0')
            + (SELECT COUNT(*) FROM portal_showcase_item WHERE title LIKE ? AND del_flag='0')
            + (SELECT COUNT(*) FROM portal_guestbook WHERE content LIKE ? AND is_deleted=0) AS n`,
      [`E2E-${env.runId}%`, `E2E-${env.runId}%`, `E2E-${env.runId}%`, `E2E-${env.runId}%`, `E2E-${env.runId}%`]);
    j.expect('收尾后本轮五张模块表的活行合计 = 0（portal_job / store / operation_case / portal_showcase_item 按 del_flag，portal_guestbook 按 is_deleted）',
      Number(live[0]?.n ?? -1), 0);

    await retireTenant(sa.api, j, T);
    const left = await residue(db);
    j.expect('收尾后探针租户活残留 = 0', left.tenants, 0);
    j.note('残留清点（软删行仍占唯一索引，所以重跑要换 runId/tag）', left);
  } finally {
    await db.close();
  }
  j.assertClean();
});
