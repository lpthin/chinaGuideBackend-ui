import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J01 开通一家企业并跑到可交付（判据 G-02、G-13）
 * 跑法见 systemtest/README 段与 docs/SYSTEM_TEST_SPEC.md §7：现网 dev 后端 + 专用测试租户，
 * 真实租户（1 / 15）只读，不写不删。
 */
test('SYS-J01 开通一家企业并跑到可交付', async () => {
  const j = new Journal('SYS-J01');
  const db = new Db(j);
  try {
    j.card({
      用例号: 'SYS-J01-01',
      判据: 'G-02、G-13',
      层级: 'API',
      前置: `现网 dev 后端 ${env.apiBase}；超管登录；库=${env.db.schema}@${env.db.host}`,
      步骤: [
        '1 超管登录',
        '2 POST /api/admin/tenants 开一家 E2E 租户（站点/骨架页/企业信息/管理员由业务代码自己长出来）',
        '3 库里对账：tenant / tenant_subscription / site / portal_company_info / portal_page / admin_user / user_role',
        '4 该家管理员首登：角色=SITE_ADMIN、租户=自己这家、权限码非空',
        '5 读自己的站与栏目（G-13 官网模块读路径）',
        '6 反例：同名重开 / 缺权限码的账号 / 别家 token 声明我家的号 / 无 token',
      ],
      期望: [
        '步骤 2 回 success=true 且有 id 与 adminUsername',
        '步骤 3 每张表都按 tenant_id 命中自己那一家；site.status=enabled；portal_page ≥1 行',
        '步骤 5 站点列表只回自己那一家，栏目状态读得到',
        '步骤 6 四条各回各的错码，不许 200 蒙混',
      ],
      反例: ['TENANT_CODE_EXISTS', 'PERMISSION_DENIED(403)', '跨租户读只回 0 行', '无 token 401/403'],
      收尾: 'DELETE /api/admin/tenants/{id} 软删本轮两家探针租户；残留按前缀清点并落盘',
    });

    // ── 1 超管登录 ─────────────────────────────────────────────────────────
    const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
    const superPrincipal = sa.api.principal(sa.res);
    j.check('超管登录后角色里确有 SUPER_ADMIN', superPrincipal.roles, superPrincipal.roles.includes('SUPER_ADMIN'));

    // ── 2 开两家探针租户（A=被测，B=拿来做跨租户反例的别家） ───────────────
    // tag 带用例号：一次 `playwright test` 会跑多条 journey，它们共用同一个 E2E_RUN_ID，
    // 而租户 code 的唯一索引连软删行一起算（J-01 的反例①测的就是这条）—— 不加前缀，第二条会在建租户时撞死。
    const A = await provisionTenant(sa.api, db, j, 'J01A');
    const B = await provisionTenant(sa.api, db, j, 'J01B');
    j.check('A 家租户 id 是新增的（>0 且不等于任何真实租户）', A.tenantId, A.tenantId > 0 && A.tenantId !== 1 && A.tenantId !== 15);

    // ── 3 库里对账：一次开通到底落了哪些行 ────────────────────────────────
    const subscription = await db.count('SELECT COUNT(*) AS n FROM tenant_subscription WHERE tenant_id = ?', [A.tenantId]);
    j.expect(`开通后 A 家订阅行数（30 天试用那条）= 1`, subscription, 1);
    const site = await db.rows<{ id: number; code: string; status: string; del_flag: string }>(
      'SELECT id, code, status, del_flag FROM site WHERE tenant_id = ? ORDER BY id', [A.tenantId]);
    j.expect('A 家站点行数 = 1', site.length, 1);
    j.expect('默认站的 status 写法是 enabled（V115 起只有一个真相）', site[0]?.status, 'enabled');
    const company = await db.count('SELECT COUNT(*) AS n FROM portal_company_info WHERE tenant_id = ?', [A.tenantId]);
    j.expect('A 家企业信息先占一行空记录 = 1', company, 1);
    const pages = await db.count('SELECT COUNT(*) AS n FROM portal_page WHERE tenant_id = ? AND site_id = ?', [A.tenantId, A.siteId]);
    j.check('A 家内置门户骨架页 ≥1 行（新建租户不许拿到空壳站）', pages, pages >= 1);
    const adminRows = await db.rows<{ id: number; tenant_id: number; status: string }>(
      'SELECT id, tenant_id, status FROM admin_user WHERE username = ?', [A.adminUsername]);
    j.expect('管理员账号落在 A 家名下（一行）', adminRows.length, 1);
    j.expect('管理员账号的 tenant_id 就是 A 家', adminRows[0]?.tenant_id, A.tenantId);
    const roleCodes = await db.rows<{ code: string }>(
      `SELECT r.code FROM user_role ur JOIN role r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND ur.tenant_id = ?`, [adminRows[0]?.id ?? 0, A.tenantId]);
    j.expect('开通时授的角色就是 SITE_ADMIN（与 AdminAuthUtils.TENANT_ADMIN_ROLE 同一份）',
      roleCodes.map(r => r.code), ['SITE_ADMIN']);

    // ── 4 该家管理员首登看到自己的家 ──────────────────────────────────────
    j.expect('A 家管理员登录后的 tenantId 就是 A 家', A.adminPrincipal.tenantId, A.tenantId);
    j.check('A 家管理员角色里确有 SITE_ADMIN', A.adminPrincipal.roles, A.adminPrincipal.roles.includes('SITE_ADMIN'));
    j.check('A 家管理员权限码非空（否则后面每一步都会被闸在门外）',
      A.adminPrincipal.permissions.length, A.adminPrincipal.permissions.length > 0);

    // ── 5 读自己的站与栏目（G-13 读路径） ─────────────────────────────────
    const ownSites = await A.admin.get('/api/portal/sites');
    j.expect('A 家管理员读站点列表 200', ownSites.code, 'OK');
    const ownSiteCodes = (ownSites.data as Array<{ code: string }>).map(s => s.code);
    j.expect('站点列表只回自己那一家（回显的是开通时同码的站）', ownSiteCodes, [A.siteCode]);
    const sections = await A.admin.get('/api/portal/sections');
    j.expect('A 家管理员读栏目状态 = OK（缺码会被 403 挡，这里不该挡）', sections.code, 'OK');
    j.check('栏目状态一格不落列出来了（≥1 项）',
      Array.isArray(sections.data) ? (sections.data as unknown[]).length : 0,
      Array.isArray(sections.data) && (sections.data as unknown[]).length >= 1);

    // ── 6 反例 ────────────────────────────────────────────────────────────
    const dup = await sa.api.post('/api/admin/tenants', {
      name: `E2E-${env.runId}-dup`, code: A.code, adminUsername: A.adminUsername, adminPassword: 'whatever-123',
    });
    j.expect('反例①同名（同 code）重开被拒：TENANT_CODE_EXISTS', dup.code, 'TENANT_CODE_EXISTS');

    // 缺码形态用最干净的一种：一个不挂任何角色的账号（挂了角色的对照在 J-12 的矩阵里逐口给）
    const bareUsername = `e2e_${env.runId.replace(/[^A-Za-z0-9]/g, '')}_bare`;
    const barePassword = 'E2e-bare-pw-1';
    const created = await sa.api.post(`/api/admin/users?tenantId=${A.tenantId}`, {
      username: bareUsername, password: barePassword, nickname: 'E2E 无角色探针', email: `${bareUsername}@e2e.invalid`,
    });
    if (!created.success) throw new Error(`建无角色探针账号失败：${created.code} ${created.message}`);
    const bareLogin = await Api.login(env.apiBase, j, bareUsername, barePassword);
    const barePrincipal = bareLogin.api.principal(bareLogin.res);
    j.expect('无角色探针账号登录后 roles 确实是空的（否则这条反例测的不是「缺码」）', barePrincipal.roles, []);
    const denied = await bareLogin.api.get('/api/portal/sites');
    j.expect('反例②缺权限码的账号读站点列表 = 403', denied.status, 403);
    j.expect('反例②错误体里点名了缺的那个码', denied.code, 'PERMISSION_DENIED');
    j.check('反例②消息里写着缺哪个码（不许只说「加载失败」）',
      denied.message, denied.message.includes('portal:siteinfo:manage'));

    const spoof = await B.admin.withTenant(A.tenantId, A.code).get('/api/portal/sites');
    const spoofCodes = (spoof.data as Array<{ code: string }>).map(s => s.code);
    j.expect('反例③别家 token 声明 A 家的租户头，仍只回自己那一家（参数不予信任）', spoofCodes, [B.siteCode]);
    const spoofInbox = await B.admin.withTenant(A.tenantId, A.code).get(`/api/messages/inbox?tenantId=${A.tenantId}`);
    j.expect('反例③续：跨租户读站内信不回 A 家的数据（按人算，B 的收件箱是空的）',
      (spoofInbox.data as { records?: unknown[] })?.records?.length ?? 0, 0);

    const anon = await Api.anonymous(env.apiBase, j).get('/api/portal/sites');
    j.check('反例④无 token 读租户口 = 401/403（不是 200 空列表）', anon.status, anon.status === 401 || anon.status === 403);

    // ── 收尾 ──────────────────────────────────────────────────────────────
    await retireTenant(sa.api, j, A);
    await retireTenant(sa.api, j, B);
    const left = await residue(db);
    j.expect('收尾后本轮活租户残留 = 0', left.tenants, 0);
    j.note('残留清点（软删行仍在库里占位，逐张表报数）', left);
  } finally {
    await db.close();
  }
  j.assertClean();
});
