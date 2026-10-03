import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { probeUser, provisionTenant, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

interface Row {
  接口: string;
  角色: string;
  期望: string;
  实际码: string;
  实际状态: number;
  判定: '该拒的拒' | '该给的给';
}

/**
 * SYS-J12 底座：隔离、鉴权、留痕（判据 G-02 的「被隔离」那一半 + 基线 N-05 的诚实态纪律）
 * 12 个高危口逐口打，每口都要出一条「该拒的拒」和一条「该给的给」。
 */
test('SYS-J12 底座：隔离、鉴权、留痕（12 个高危口）', async () => {
  const j = new Journal('SYS-J12');
  const db = new Db(j);
  const matrix: Row[] = [];
  const row = (r: Row) => { matrix.push(r); j.record('matrix-row', `${r.接口} × ${r.角色}`, r); };

  try {
    j.card({
      用例号: 'SYS-J12-01',
      判据: 'G-02（隔离）+ N-05（诚实态）',
      层级: 'API',
      前置: `现网 dev 后端 ${env.apiBase}；探针租户 A/B + 探针账号（A 家 CONTENT_EDITOR、B 家 SITE_ADMIN）；真实租户 1/15 只读`,
      步骤: [
        '1 超管登录 + 开两家探针租户',
        '2 逐口打：租户开通 / 租户删除 / 审计日志 / GEO 水位 / 平台模型 / 裸 send / 标已读 / 删信 / 素材 system 组 / 工单平台列表 / 跨租户用户列表 / 群发口',
        '3 每口两向：无权限角色必须真被拒，有权限角色必须真能读',
        '4 留痕：本轮超管写动作要能在审计日志里查到行',
        '5 登录失败锁定：探针账号连错到上限（dev 档 10 次）后，正确密码也被拒',
      ],
      期望: ['12 行矩阵每行都有码可指', '审计日志查到本轮 create 行', 'ACCOUNT_LOCKED 成立且 login_log 有上限次数的 failed 行'],
      反例: ['SITE_ADMIN/CONTENT_EDITOR 打平台口一律拒', '别家 token 声明 A 家的号仍只看见自己'],
      收尾: '探针租户软删；被锁定的探针账号随租户一起下线（锁是内存态，15 分钟自动解），残留按前缀清点',
    });

    const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
    // 同 J-01：tag 前缀开用例号，否则跟别的 journey 撞租户 code 的唯一索引（软删也算）
    const A = await provisionTenant(sa.api, db, j, 'J12A');
    const B = await provisionTenant(sa.api, db, j, 'J12B');
    const editor = await probeUser(sa.api, db, A, 'CONTENT_EDITOR', 'j12ed', j);
    j.expect('探针编辑岗登录成功且角色是 CONTENT_EDITOR', editor.principal.roles, ['CONTENT_EDITOR']);
    j.note('探针编辑岗实际拿到的权限码（缺码反例判它缺什么就缺什么）', editor.principal.permissions);

    const FORBIDDEN = 'FORBIDDEN';

    // 1 租户开通：非超管不许开下一家
    const tryOpen = await A.admin.post('/api/admin/tenants', {
      name: `E2E-${env.runId}-rogue`, code: `${A.code}-rogue`, adminUsername: `e2e_rogue_${Date.now()}`, adminPassword: 'Rogue-123456',
    });
    row({ 接口: 'POST /api/admin/tenants', 角色: 'SITE_ADMIN(A 家)', 期望: '拒', 实际码: tryOpen.code, 实际状态: tryOpen.status, 判定: '该拒的拒' });
    j.expect('#1 租户开通：A 家管理员开下一家被拒', tryOpen.code, FORBIDDEN);

    // 2 租户删除：别家管理员删不动
    const tryDelete = await A.admin.del(`/api/admin/tenants/${B.tenantId}`);
    row({ 接口: 'DELETE /api/admin/tenants/{id}', 角色: 'SITE_ADMIN(A 家)', 期望: '拒', 实际码: tryDelete.code, 实际状态: tryDelete.status, 判定: '该拒的拒' });
    j.expect('#2 删档：A 家管理员删 B 家被拒', tryDelete.code, FORBIDDEN);
    const superDeletes = await sa.api.del(`/api/admin/tenants/${B.tenantId}`);
    row({ 接口: 'DELETE /api/admin/tenants/{id}', 角色: 'SUPER_ADMIN', 期望: '放行', 实际码: superDeletes.code, 实际状态: superDeletes.status, 判定: '该给的给' });
    j.expect('#2 续：超管删得动探针租户（超管不是被排除的人）', superDeletes.code, 'OK');

    // 3 审计日志：平台口
    const editorAudit = await editor.api.get('/api/admin/audit-logs?page=1&size=5');
    row({ 接口: 'GET /api/admin/audit-logs', 角色: 'CONTENT_EDITOR', 期望: '拒', 实际码: editorAudit.code, 实际状态: editorAudit.status, 判定: '该拒的拒' });
    j.expect('#3 审计日志：编辑岗被拒', editorAudit.code, FORBIDDEN);
    const superAudit = await sa.api.get(`/api/admin/audit-logs?page=1&size=50&action=create&username=${env.superAdmin.username}`);
    const auditRecords = (superAudit.data as { records?: Array<{ resource?: string; method?: string }> })?.records ?? [];
    row({ 接口: 'GET /api/admin/audit-logs', 角色: 'SUPER_ADMIN', 期望: '放行 + 查到本轮行', 实际码: superAudit.code, 实际状态: superAudit.status, 判定: '该给的给' });
    j.expect('#3 续：超管读审计日志 200', superAudit.code, 'OK');
    j.check('#4 留痕：本轮「POST /api/admin/tenants」在审计日志里有行（不是只写在注释里）',
      auditRecords.some(r => (r.resource ?? '').includes('admin/tenants')), true);

    // 5 GEO 额度水位：改别人的水位是平台职能
    const editorQuota = await editor.api.get(`/api/admin/geo-quota?tenantId=${A.tenantId}`);
    row({ 接口: 'GET/PUT /api/admin/geo-quota', 角色: 'CONTENT_EDITOR', 期望: '拒', 实际码: editorQuota.code, 实际状态: editorQuota.status, 判定: '该拒的拒' });
    j.expect('#5 水位读口：编辑岗被拒', editorQuota.code, FORBIDDEN);
    const setQuota = await sa.api.put('/api/admin/geo-quota', { tenantId: A.tenantId, monthlyTokenQuota: 123456 });
    j.expect('#5 续：超管给探针租户设水位放行', setQuota.code, 'OK');
    const back = await sa.api.get(`/api/admin/geo-quota?tenantId=${A.tenantId}`);
    j.expect('#5 续：水位写进去就读得回来（单源，不是两份真相）',
      (back.data as { tenantQuota?: number })?.tenantQuota, 123456);
    row({ 接口: 'GET/PUT /api/admin/geo-quota', 角色: 'SUPER_ADMIN', 期望: '放行', 实际码: setQuota.code, 实际状态: setQuota.status, 判定: '该给的给' });

    // 6 平台模型配置：钥匙串不许租户翻
    const editorModels = await editor.api.get('/api/ai/model-configs');
    row({ 接口: 'GET /api/ai/model-configs', 角色: 'CONTENT_EDITOR', 期望: '拒', 实际码: editorModels.code, 实际状态: editorModels.status, 判定: '该拒的拒' });
    j.expect('#6 平台模型列表：编辑岗被拒', editorModels.code, FORBIDDEN);
    const superModels = await sa.api.get('/api/ai/model-configs');
    row({ 接口: 'GET /api/ai/model-configs', 角色: 'SUPER_ADMIN', 期望: '放行', 实际码: superModels.code, 实际状态: superModels.status, 判定: '该给的给' });
    j.expect('#6 续：超管读得到模型配置', superModels.code, 'OK');

    // 7 裸 send 口：往别人收件箱写东西 = 平台职能（拍板 3c）
    const editorSend = await editor.api.post('/api/messages/send', {
      tenantId: A.tenantId, receiverId: A.adminPrincipal.userId, title: `E2E-${env.runId}-应拒`, content: '不该发出去',
    });
    row({ 接口: 'POST /api/messages/send', 角色: 'CONTENT_EDITOR', 期望: '拒', 实际码: editorSend.code, 实际状态: editorSend.status, 判定: '该拒的拒' });
    j.expect('#7 裸 send：编辑岗被拒', editorSend.code, FORBIDDEN);
    const editorBroadcast = await editor.api.post('/api/messages/broadcast', {
      title: `E2E-${env.runId}-应拒`, content: '不该群发', type: 'system',
    });
    row({ 接口: 'POST /api/messages/broadcast', 角色: 'CONTENT_EDITOR', 期望: '拒', 实际码: editorBroadcast.code, 实际状态: editorBroadcast.status, 判定: '该拒的拒' });
    j.expect('#8 群发口：编辑岗被拒', editorBroadcast.code, FORBIDDEN);

    const superSend = await sa.api.withTenant(A.tenantId, A.code).post('/api/messages/send', {
      tenantId: A.tenantId, receiverId: editor.userId, receiverName: 'E2E 编辑岗',
      title: `E2E-${env.runId}-探针信`, content: '系统测试探针信，跑完删', type: 'system',
    });
    j.expect('#9 超管定向发给探针收件人放行', superSend.code, 'OK');
    const msgId = Number((superSend.data as Record<string, unknown>)?.id);
    const msgRows = await db.rows<{ tenant_id: number; receiver_id: number; title: string }>(
      'SELECT tenant_id, receiver_id, title FROM portal_message WHERE id = ?', [msgId]);
    j.expect('#9 续：库里真落了一行，且归属 A 家', msgRows.length, 1);
    j.expect('#9 续：这一行的 tenant_id 就是 A 家（不是超管自己那一家）', msgRows[0]?.tenant_id, A.tenantId);
    row({ 接口: 'POST /api/messages/send', 角色: 'SUPER_ADMIN', 期望: '放行 + 落库', 实际码: superSend.code, 实际状态: superSend.status, 判定: '该给的给' });

    // 10 标已读：只有收件人本人
    const foreignRead = await B.admin.put(`/api/messages/${msgId}/read`);
    row({ 接口: 'PUT /api/messages/{id}/read', 角色: 'SITE_ADMIN(B 家)', 期望: '拒', 实际码: foreignRead.code, 实际状态: foreignRead.status, 判定: '该拒的拒' });
    j.expect('#10 别家管理员标别人收的信为已读被拒', foreignRead.code, FORBIDDEN);
    const selfRead = await editor.api.put(`/api/messages/${msgId}/read`);
    row({ 接口: 'PUT /api/messages/{id}/read', 角色: '收件人本人(CONTENT_EDITOR)', 期望: '放行', 实际码: selfRead.code, 实际状态: selfRead.status, 判定: '该给的给' });
    j.expect('#10 续：收件人本人标已读放行', selfRead.code, 'OK');

    // 11 删除：本人那一格可删（拍板 1a 复核），别人那一格仍要这一家的管理员
    const foreignDelete = await B.admin.del(`/api/messages/${msgId}`);
    row({ 接口: 'DELETE /api/messages/{id}', 角色: 'SITE_ADMIN(B 家)', 期望: '拒', 实际码: foreignDelete.code, 实际状态: foreignDelete.status, 判定: '该拒的拒' });
    j.expect('#11 别家管理员删 A 家那一格被拒', foreignDelete.code, FORBIDDEN);
    const selfDelete = await editor.api.del(`/api/messages/${msgId}?tenantId=${A.tenantId}`);
    row({ 接口: 'DELETE /api/messages/{id}', 角色: '收件人本人(CONTENT_EDITOR)', 期望: '放行', 实际码: selfDelete.code, 实际状态: selfDelete.status, 判定: '该给的给' });
    j.expect('#11 续：收件人本人删掉自己那一格放行', selfDelete.code, 'OK');
    // 站内信这一族有两列软删：业务读路径认的是 is_deleted（MessageService.deleteMessage 写的就是它），
    // del_flag 是给 MyBatis-Plus @TableLogic 的另一列。断言必须落在实际生效的那一列上。
    const stillAlive = await db.count('SELECT COUNT(*) AS n FROM portal_message WHERE id = ? AND is_deleted = ?', [msgId, 0]);
    j.expect('#11 续：删完那一格在业务读路径里不再是活行（is_deleted=1）', stillAlive, 0);
    const stillFlagged = await db.count('SELECT COUNT(*) AS n FROM portal_message WHERE id = ? AND del_flag = ?', [msgId, '0']);
    j.note('两列软删此刻不同值（is_deleted 已置 1、del_flag 仍 0）—— 报告里要点名的一处形状', { del_flag_alive_rows: stillFlagged });

    // 12 素材 system 组：只对平台档开放
    const editorSystemMedia = await editor.api.get('/api/media?group=system');
    row({ 接口: 'GET /api/media?group=system', 角色: 'CONTENT_EDITOR', 期望: '拒', 实际码: editorSystemMedia.code, 实际状态: editorSystemMedia.status, 判定: '该拒的拒' });
    j.expect('#12 系统素材组对编辑岗关闭', editorSystemMedia.code, 'MEDIA_GROUP_FORBIDDEN');
    const superSystemMedia = await sa.api.withTenant(A.tenantId, A.code).get('/api/media?group=system');
    row({ 接口: 'GET /api/media?group=system', 角色: 'SUPER_ADMIN', 期望: '放行', 实际码: superSystemMedia.code, 实际状态: superSystemMedia.status, 判定: '该给的给' });
    j.expect('#12 续：超管列得出系统素材组', superSystemMedia.code, 'OK');

    // 13 工单平台列表：认码不认人
    const editorTickets = await editor.api.get('/api/portal/support-tickets/admin/list');
    row({ 接口: 'GET /api/portal/support-tickets/admin/list', 角色: 'CONTENT_EDITOR(缺 portal:build:review)', 期望: '拒(403)', 实际码: editorTickets.code, 实际状态: editorTickets.status, 判定: '该拒的拒' });
    j.expect('#13 缺 portal:build:review 的账号打平台工单列表 = 403', editorTickets.status, 403);
    j.expect('#13 续：错误体点名缺的码', editorTickets.code, 'PERMISSION_DENIED');
    const superTickets = await sa.api.get('/api/portal/support-tickets/admin/list');
    row({ 接口: 'GET /api/portal/support-tickets/admin/list', 角色: 'SUPER_ADMIN', 期望: '放行', 实际码: superTickets.code, 实际状态: superTickets.status, 判定: '该给的给' });
    j.expect('#13 续：超管读得到平台工单列表', superTickets.code, 'OK');

    // 14 跨租户读用户列表：声明别人的号不等于看得见别人
    const crossUsers = await editor.api.withTenant(B.tenantId, B.code).get(`/api/admin/users?page=1&size=50&tenantId=${B.tenantId}`);
    const foreign = (crossUsers.data as { records?: Array<{ tenantId?: number }> })?.records ?? [];
    row({ 接口: 'GET /api/admin/users?tenantId=别家', 角色: 'CONTENT_EDITOR(A 家)', 期望: '只回自己家', 实际码: crossUsers.code, 实际状态: crossUsers.status, 判定: '该拒的拒' });
    j.check('#14 A 家编辑岗声明 B 家的租户号，回的行里不许有 B 家的人',
      foreign.map(u => u.tenantId), foreign.every(u => u.tenantId === A.tenantId));

    // 15 登录失败锁定（探针账号自己承担锁定，真实账号一律不碰）
    // 阈值属于 profile：dev 是 10（application-dev.yml:61），prod 是 5（application.yml:356）。
    // 这里不猜数，按 env 给的阈值打，并把「用的是哪一档」写进证据。
    const maxFailures = Number(process.env.E2E_LOGIN_MAX_FAILURES ?? 10);
    j.note('本轮按登录失败上限打点', { maxFailures, source: 'dev 档 = application-dev.yml:61；prod 档 = application.yml:356' });
    const lockUser = await probeUser(sa.api, db, A, 'CONTENT_EDITOR', 'j12lock', j);
    let lastFail = '';
    for (let i = 0; i < maxFailures; i += 1) {
      const bad = await Api.anonymous(env.apiBase, j).call('POST', '/api/auth/login', { username: lockUser.username, password: 'wrong-password' });
      lastFail = bad.code;
    }
    j.expect(`#15 前 ${maxFailures} 次错密码每次都是 LOGIN_FAILED`, lastFail, 'LOGIN_FAILED');
    const afterLock = await Api.anonymous(env.apiBase, j).call('POST', '/api/auth/login', { username: lockUser.username, password: lockUser.password });
    row({ 接口: 'POST /api/auth/login（连错上限次后）', 角色: '探针账号本人', 期望: 'ACCOUNT_LOCKED', 实际码: afterLock.code, 实际状态: afterLock.status, 判定: '该拒的拒' });
    j.expect('#15 续：到上限之后拿正确密码也被拒（锁定生效，不是提示）', afterLock.code, 'ACCOUNT_LOCKED');
    const failedLogins = await db.count(
      'SELECT COUNT(*) AS n FROM login_log WHERE username = ? AND status = ?', [lockUser.username, 'failed']);
    j.check(`#15 续：登录失败留痕 ≥${maxFailures + 1} 条（含锁定那一次）`, failedLogins, failedLogins >= maxFailures + 1);

    // 收尾
    await retireTenant(sa.api, j, A);
    const left = await residue(db);
    j.expect('收尾后本轮活租户残留 = 0', left.tenants, 0);
    j.expect('收尾后本轮活账号残留 = 0', left.users, 0);
    j.expect('收尾后探针信在业务读路径里活行 = 0（messages 那一格是本轮软删的墓碑，不是残留）', left.messages_live, 0);
    j.check('全量口径：库里没有任何一轮遗留的活 e2e 账号', left.users_all_runs, left.users_all_runs === 0);
    j.note('残留清点（软删行仍占唯一索引，报告里逐张表报数）', left);
    j.note('矩阵全量（12+ 行，每行都有码可指）', matrix);
  } finally {
    await db.close();
  }
  j.assertClean();
});
