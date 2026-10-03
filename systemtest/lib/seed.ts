import { Api } from './api';
import { Db } from './db';
import { Journal } from './journal';
import { env, seedName, seedUsername } from './env';

/** 角色码 → sys 里的 role.id 不写死，现场按 code 查（V93 那批码是数据，不是常量） */
export async function roleIdByCode(db: Db, code: string): Promise<number> {
  const rows = await db.rows<{ id: number }>('SELECT id FROM role WHERE code = ? LIMIT 1', [code]);
  if (rows.length !== 1) throw new Error(`角色 ${code} 在库里查不到唯一行（命中 ${rows.length} 行）`);
  return Number(rows[0].id);
}

function throwawayPassword(): string {
  return `E2e!${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
}

export interface SeededTenant {
  tenantId: number;
  code: string;
  name: string;
  siteId: number;
  siteCode: string;
  adminUsername: string;
  adminPassword: string;
  admin: Api;
  adminPrincipal: ReturnType<Api['principal']>;
}

/** §7.2：一家专用测试租户，站点/栏目/骨架页/管理员账号都由业务接口自己长出来，不手改库 */
export async function provisionTenant(superAdmin: Api, db: Db, journal: Journal, tag: string): Promise<SeededTenant> {
  const code = seedName(tag).toLowerCase();
  const name = `E2E-${env.runId}-${tag}`;
  const adminUsername = seedUsername(`t${tag}`);
  const adminPassword = throwawayPassword();

  const created = await superAdmin.post('/api/admin/tenants', {
    name, code, adminUsername, adminPassword,
    contactEmail: `${adminUsername}@e2e.invalid`,
    description: '系统测试专用租户（Spec-K P0）',
  });
  if (!created.success) throw new Error(`建租户 ${code} 失败：${created.status} ${created.code} ${created.message}`);
  const data = created.data as Record<string, unknown>;
  const tenantId = Number(data.id);

  const site = await db.rows<{ id: number; code: string; status: string }>(
    'SELECT id, code, status FROM site WHERE tenant_id = ? ORDER BY id LIMIT 1', [tenantId],
  );
  if (site.length === 0) throw new Error(`租户 ${tenantId} 建出来了但没有站点行 —— 开通链自己断了`);

  const login = await Api.login(env.apiBase, journal, adminUsername, adminPassword);
  return {
    tenantId, code, name,
    siteId: Number(site[0].id),
    siteCode: site[0].code,
    adminUsername, adminPassword,
    admin: login.api,
    adminPrincipal: login.api.principal(login.res),
  };
}

/** 造一个指定角色的探针账号（跑完随租户一起清，绝不碰真实账号） */
export async function probeUser(
  superAdmin: Api, db: Db, tenant: SeededTenant, roleCode: string, tag: string, journal: Journal,
): Promise<{ username: string; password: string; api: Api; userId: number; principal: ReturnType<Api['principal']> }> {
  const username = seedUsername(`${tag}`);
  const password = throwawayPassword();
  // 超管动别家的人之前必须先「站到那一家」：读写用户都过 TenantGuard 的归属比对（AdminUserController.requireUser），
  // 站在平台档直接 ?tenantId= 指过去，创建能过、授角色会被「无权限操作该用户」拒 —— 界面右上角切租户做的就是这件事
  const inTenant = superAdmin.withTenant(tenant.tenantId, tenant.code);
  const created = await inTenant.post(`/api/admin/users?tenantId=${tenant.tenantId}`, {
    username, password, nickname: `E2E ${tag} ${roleCode}`, email: `${username}@e2e.invalid`,
  });
  if (!created.success) throw new Error(`建探针账号 ${username} 失败：${created.status} ${created.code} ${created.message}`);
  const userId = Number((created.data as Record<string, unknown>).id);
  const rid = await roleIdByCode(db, roleCode);
  // 挂角色同样要站到那一家里去：requireUser(id, tenantId) 比的是「这一行属于哪家」，
  // 平台档身份直接 ?tenantId= 指过去也会被判「无权限操作该用户」（J-12 首轮就是这么红的）
  const assigned = await inTenant.post(`/api/admin/users/${userId}/roles?tenantId=${tenant.tenantId}`, { roleIds: [rid] });
  if (!assigned.success) throw new Error(`给 ${username} 挂角色 ${roleCode} 失败：${assigned.code} ${assigned.message}`);
  const login = await Api.login(env.apiBase, journal, username, password);
  return { username, password, api: login.api, userId, principal: login.api.principal(login.res) };
}

/** 收尾：软删本轮建的租户（业务口），账号与站点随它一起失去归属 */
export async function retireTenant(superAdmin: Api, journal: Journal, tenant: SeededTenant): Promise<void> {
  const res = await superAdmin.del(`/api/admin/tenants/${tenant.tenantId}`);
  journal.record('teardown', `DELETE /api/admin/tenants/${tenant.tenantId}`, {
    code: res.code, success: res.success, message: res.message,
  });
}

/**
 * 残留清点：本轮造的东西还剩几行活着的 —— 报告里必须出现的数。
 * 两个口径分开报：只看本轮 runId 前缀的，和不带 runId 的全量 e2e 前缀（历史上每一轮跑过的都算），
 * 以及「行存在」与「行还活着」两档 —— 探针信是本轮自己软删的，标题仍带前缀，混成一个数就是谎报。
 */
export async function residue(db: Db): Promise<Record<string, number>> {
  const runTag = env.runId.replace(/[^A-Za-z0-9]/g, '');
  const prefix = `E2E-${env.runId}`;
  return {
    tenants: await db.count('SELECT COUNT(*) AS n FROM tenant WHERE code LIKE ? AND del_flag = ?', [`%${runTag}%`, '0']),
    sites: await db.count('SELECT COUNT(*) AS n FROM site WHERE code LIKE ? AND del_flag = ?', [`%${runTag.toLowerCase()}%`, '0']),
    users: await db.count('SELECT COUNT(*) AS n FROM admin_user WHERE username LIKE ? AND del_flag = ?', [`e2e_${runTag}_%`, '0']),
    // 全量口径：不限本轮，只要有 e2e 前缀的活账号活着就是上一轮没收干净
    users_all_runs: await db.count('SELECT COUNT(*) AS n FROM admin_user WHERE username LIKE ? AND del_flag = ?', ['e2e_%', '0']),
    messages: await db.count('SELECT COUNT(*) AS n FROM portal_message WHERE title LIKE ?', [`${prefix}%`]),
    messages_live: await db.count('SELECT COUNT(*) AS n FROM portal_message WHERE title LIKE ? AND is_deleted = 0', [`${prefix}%`]),
  };
}
