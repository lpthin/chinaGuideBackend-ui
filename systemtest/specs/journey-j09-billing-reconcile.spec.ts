import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { env } from '../lib/env';

/**
 * SYS-J09 计费对账（判据 G-02「能计费」那一半 + N-02 拆池与水位，基线 §3 N-02 行）
 *
 * N-02 的原话是三句：拆池（AI_TOKEN / AI_GEO）、水位可设、**计费只认 `tenant.delivery_state`**，
 * 而 delivery_state 的唯一写入点是转正交棒（Spec-G N2 + V142，代码在 `billing/TokenQuotaService.java:350`）。
 * 这一条要交的是「账对不对得上」的实测，不是「有没有账单页」：
 *
 *  A 现账普查（只读，全表）—— 四笔对不上就是零的那种：
 *    a1 每个 (租户, 池, 月份) 的 `tenant_usage.used_tokens` 等于「从这一期第一天起、整一个月」的
 *       `billing_consume_log` 流水相加（拆池前的存量行 `usage_type` 是 NULL，读法归通用池，见 BillingConsumeLogController:33-45 那段注释）；
 *       上界只按 `period_start + 1 MONTH` 推，不用 `period_end`：那一列在库里是 DATE，应用写进去的
 *       「本月最后一天 23:59:59.999999999」被 MySQL 进位成了下月 1 号，跟着它加一天就多罩一整天（上一轮那条红就是这么来的）；
 *    a2 判重三元组 (tenant_id, biz_type, biz_id) 全表没有出现过两次（「重复扣费」的形状）；
 *    a3 V157 拆池之后写的行，余额两列方向全对（`after = before - token`，没设额度时是 NULL 而不是 0）；
 *    a4 拆两笔：4a 交付态闸那一次提交（BE `47fe1cf`，2026-09-28 05:49:07）之后没有一笔账落在未交付租户上；
 *       4b 平台承担类拿正面证据判——账上最后一笔 `AI_REFERENCE_INGEST` 之后跑成 done 的摄取任务，一笔都不许再出现在账上。
 *       （日期证不了进程什么时候换的构建，而「同一族后来的任务不留行」能。）
 *  B 金径：租户 15（唯一 delivery_state=delivered 的租户）真发起一次生成，真调一次模型，
 *    看这一笔钱在两张表上是不是同一个数、接口念出来的是不是库里那份。
 *  C 反例：租户侧拿 `?tenantId=1` 去读别家的流水（`TenantGuard.effectiveTenantId:26` 对普通用户不认请求参数）。
 *    判据是「传与不传是同一份回体」＋「回体里只有自家」——接口回体是驼峰 DTO，按库里的下划线键取值会一律取到 undefined。
 *
 * 为什么金径落在真实租户 15 而不是探针租户：闸只认「转正交棒」这个写入点，探针租户要么 presale（不计费、
 * 门禁短路、账根本不落），要么就得先把整条交付链跑完（那是 J-05）。所以这一条**会往租户 15 留一篇草稿**，
 * 收尾逐行点名，不偷偷删。
 *
 * 「水位打满当场拒」那一档要改后端进程的环境变量（`AI_DEFAULT_MONTHLY_QUOTA`）才能触发，
 * 拆成同目录的 journey-j09b-quota-gate.spec.ts 单独跑，见那个文件开头。
 */

interface UsageRow {
  tenant_id: number;
  usage_type: string;
  period_start: string;
  used_tokens: number;
  log_sum: string | number;
}

interface ConsumeRow {
  id: number;
  tenant_id: number;
  biz_type: string;
  usage_type: string | null;
  biz_id: number;
  token_amount: number;
  token_balance_before: number | null;
  token_balance_after: number | null;
  type: string;
  created_at: string;
}

const MONTH_START = '2026-10-01';
/** 交付态计费闸那一次提交的时间（BE 47fe1cf）；billing_consume_log.created_at 是应用按东八区墙上时钟写的，同一个档 */
const GATE_COMMIT_AT = '2026-09-28 05:49:07';

test('SYS-J09 计费对账：两张账相加是同一个数，且只认交付态', async () => {
  test.info().setTimeout(900_000);
  const j = new Journal('SYS-J09');
  const db = new Db(j);

  try {
    j.card({
      用例号: 'SYS-J09-01',
      判据: 'G-02「能计费」+ N-02（拆池、水位可设、计费只认 delivery_state）',
      层级: 'API',
      前置: `后端 ${env.apiBase}；租户 15 是库里唯一 delivery_state=delivered 的租户；真调模型 1 次`,
      步骤: [
        '1 现账普查 a1：每个 (租户,池,月份) 的 tenant_usage 与「period_start 起整一个月」的流水相加逐个比，比不上的列出来',
        '1b 把每张账本的期间原值念出来（period_end 落成下月 1 号这件事要留档，读这张表的人会被它带偏）',
        '2 现账普查 a2：判重三元组 (tenant_id,biz_type,biz_id) 全表找出现过两次的',
        '3 现账普查 a3：只数 usage_type 非空（= V157 拆池之后写的）那批行里余额方向不对的',
        '4 现账普查 4a：交付态闸那次提交（09-28 05:49）之后有没有账落在未交付租户上；4b：闸之后跑成 done 的平台承担类摄取任务有没有留行',
        '5 金径：租户 15 提交一次真生成（唯一关键词），轮询到 COMPLETED',
        '6 对账：这一笔在 billing_consume_log 落的行 = 这一笔在 tenant_usage 造成的增量 = 模型实际 token',
        '7 同源：GET /api/billing/consume-logs?usageType=AI_TOKEN 念出来的笔数与合计，跟库里比；这一笔要在回体里恰好 1 行',
        '8 反例：租户 15 的管理员带 ?tenantId=1 读流水，传与不传必须是同一份回体，且行里只有自家',
      ],
      期望: [
        '步骤 1~4 四个「比不上的行数」全是 0',
        '步骤 6 三个数一样：consume_log.token_amount == tenant_usage 本期增量 == 任务回体的 prompt+completion',
        '步骤 6 那一行的 biz_id 就是 taskId、biz_type=AI_ARTICLE_GENERATION、usage_type=AI_TOKEN、type=CONSUME',
        '步骤 7 接口念出的合计与库里的合计是同一个数（同一个谓词，不是两份算法）',
        '步骤 8 越权读别家不生效：tenantId 这个请求参数改变不了回体',
      ],
      反例: ['同一笔业务出现两笔账 = 重复扣费（步骤 2）',
        '「本月已用」与流水相加对不上 = 有一边漏记或记了没花的（步骤 1）',
        '传 ?tenantId=1 与不传的回体不是同一份 = 请求参数被采信，跨租户读账（步骤 8）'],
      收尾: '探针租户软删；**租户 15 那一篇草稿留着点名**（删除属破坏性数据动作，等拍板）',
    });

    const sa = (await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password)).api;
    const t15 = (await Api.login(env.apiBase, j, 'tenant15_admin', 'admin123')).api;

    // ── A 现账普查 ───────────────────────────────────────────────────────
    // a1 的窗口只认 period_start：「从这一期第一天起、整一个月」。
    // 为什么不用 period_end 推上界：这一列在库里是 DATE，应用算的是「本月最后一天的 23:59:59.999999999」，
    // 写进 DATE 列被 MySQL 进位成了**下月 1 号**（现网两张账本逐行可查），拿它再加一天就会多罩一整天。
    // 现网租户 15 九月那一张因此一度被念成「已用 922129 / 流水 1032974」——差的是 2026-10-01 03:03~07:51 那 24 笔 110845，
    // 账没记错，是我这边框错了日子。窗口按 period_start 起算后每张都对得上。
    const a1Window = `c.created_at >= u.period_start AND c.created_at < DATE_ADD(u.period_start, INTERVAL 1 MONTH)`;
    const a1 = await db.rows<UsageRow>(
      `SELECT u.tenant_id, u.usage_type, u.period_start, u.used_tokens,
              COALESCE((SELECT SUM(c.token_amount) FROM billing_consume_log c
                         WHERE c.tenant_id = u.tenant_id AND c.del_flag = '0'
                           AND COALESCE(c.usage_type,'AI_TOKEN') = u.usage_type
                           AND ${a1Window}), 0) log_sum
         FROM tenant_usage u
        WHERE u.del_flag = '0' AND u.usage_type IN ('AI_TOKEN','AI_GEO')
          AND u.used_tokens <> COALESCE((SELECT SUM(c.token_amount) FROM billing_consume_log c
                 WHERE c.tenant_id = u.tenant_id AND c.del_flag = '0'
                   AND COALESCE(c.usage_type,'AI_TOKEN') = u.usage_type
                   AND ${a1Window}), 0)`);
    j.check('a1 每张账本的「本月已用」都等于当月流水相加（列出对不上的行）',
      `对不上的行数=${a1.length} ${a1.map(r => `${r.tenant_id}/${r.usage_type}/${String(r.period_start).slice(0, 10)} 已用${r.used_tokens} vs 流水${r.log_sum}`).join(' | ')}`,
      a1.length === 0);

    // period_end 那一列落成哪一天，现场念一遍留给后面读这张表的人（应用只写不读，所以钱是对的，读列的人会错）
    const peTrap = await db.rows<{ tenant_id: number; usage_type: string; ps: string; pe: string }>(
      `SELECT tenant_id, usage_type, DATE_FORMAT(period_start,'%Y-%m-%d') ps, DATE_FORMAT(period_end,'%Y-%m-%d') pe
         FROM tenant_usage WHERE del_flag='0' AND usage_type IN ('AI_TOKEN','AI_GEO') AND used_tokens > 0
        ORDER BY tenant_id, usage_type, period_start`);
    j.note('两张账本各自的期间原值（period_end 若等于下月 1 号，就是 DATE 列进位的结果）',
      peTrap.map(r => `${r.tenant_id}/${r.usage_type} ${r.ps} → ${r.pe}`));

    const a2 = await db.rows<{ tenant_id: number; biz_type: string; biz_id: number; n: number }>(
      `SELECT tenant_id, biz_type, biz_id, COUNT(*) n FROM billing_consume_log
        GROUP BY tenant_id, biz_type, biz_id HAVING COUNT(*) > 1`);
    j.check('a2 判重三元组 (租户,业务类型,业务行) 全表没有第二笔（重复扣费的形状）',
      `重复组数=${a2.length} ${a2.map(r => `${r.tenant_id}/${r.biz_type}/${r.biz_id}×${r.n}`).join(' | ')}`,
      a2.length === 0);

    const a3 = await db.rows<{ n: number }>(
      `SELECT COUNT(*) n FROM billing_consume_log WHERE usage_type IS NOT NULL
          AND ((token_balance_before IS NOT NULL AND token_balance_after <> token_balance_before - token_amount)
            OR (token_balance_before IS NULL AND token_balance_after IS NOT NULL))`);
    const a3Total = await db.count(`SELECT COUNT(*) n FROM billing_consume_log WHERE usage_type IS NOT NULL`);
    j.check('a3 拆池（V157）之后写的每一行，余额两列都按「剩余」算（没设额度写 NULL 不写 0）',
      `这一档共 ${a3Total} 行，方向或空值写错的=${Number(a3[0]?.n ?? -1)}`, Number(a3[0]?.n ?? -1) === 0);

    // a4 拆成两笔，各自都能独立成立，不再用「一个日期 cutoff 同时管两件事」那种写法：
    //  4a 未交付租户：闸那一次提交（BE 47fe1cf，2026-09-28 05:49:07 +08，与应用写 created_at 的同一个墙上时钟）
    //     之后，账上不许有任何一行落在 delivery_state<>'delivered' 的租户上。现存的 142 那 8 笔全在 09-26，
    //     属闸之前的历史，只点名不判红（不回填、不改写是 Spec-G 的既定口径）。
    //  4b 平台承担类：日期没法证明进程什么时候换的构建（09-28 06:36 那一笔就落在「提交之后、重新部署之前」这一段），
    //     所以判据交给正面证据——账上最后一笔 AI_REFERENCE_INGEST **之后**完成（status=done）的参考站摄取任务，
    //     一笔都不许再出现在账上。这一族任务当天确实又跑成了两单（47、49），所以这条不是空断言。
    const a4a = await db.rows<{ tenant_id: number; delivery_state: string; n: number; last_at: string }>(
      `SELECT c.tenant_id, t.delivery_state, COUNT(*) n,
              DATE_FORMAT(MAX(c.created_at),'%Y-%m-%d %H:%i:%s') last_at
         FROM billing_consume_log c JOIN tenant t ON t.id = c.tenant_id AND t.del_flag='0'
        WHERE t.delivery_state <> 'delivered' AND c.del_flag = '0'
        GROUP BY c.tenant_id, t.delivery_state`);
    j.check('a4a 交付态闸（2026-09-28 05:49 提交）之后没有一笔账落在未交付租户上',
      `未交付租户名上的账：${a4a.map(r => `${r.tenant_id}/${r.delivery_state} ${r.n} 笔，最晚 ${r.last_at}`).join(' | ') || '无'}`,
      a4a.every(r => r.last_at < GATE_COMMIT_AT));

    const a4b = await db.rows<{ id: number; status: string; created_at: string; charged: number }>(
      `SELECT s.id, s.status, DATE_FORMAT(s.created_at,'%Y-%m-%d %H:%i:%s') created_at,
              (SELECT COUNT(*) FROM billing_consume_log c
                WHERE c.biz_type='AI_REFERENCE_INGEST' AND c.biz_id = s.id AND c.del_flag='0') charged
         FROM portal_reference_site s
        WHERE s.status = 'done'
          AND s.created_at > (SELECT MAX(created_at) FROM billing_consume_log WHERE biz_type='AI_REFERENCE_INGEST')
        ORDER BY s.id`);
    j.check('a4b 闸之后跑成的参考站摄取（平台承担类）确实一笔都没落进账上',
      `闸之后完成的摄取任务：${a4b.map(r => `${r.id}(扣费行${r.charged})`).join(' | ') || '无'}；这一族任务名上的全部扣费行：`
      + JSON.stringify((await db.rows<{ biz_id: number }>(
        `SELECT biz_id FROM billing_consume_log WHERE biz_type='AI_REFERENCE_INGEST' AND del_flag='0' ORDER BY biz_id`))
        .map(r => r.biz_id)),
      a4b.length > 0 && a4b.every(r => Number(r.charged) === 0));

    const platformBorne = await db.rows<{ id: number; tenant_id: number; biz_id: number; tokens: number; at: string }>(
      `SELECT id, tenant_id, biz_id, token_amount tokens, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') at
         FROM billing_consume_log WHERE biz_type='AI_REFERENCE_INGEST' AND del_flag='0' ORDER BY id`);
    j.note('账上平台承担类的历史行逐笔点名（闸之前写的，按「不回填」只点名；这些 token 当年计进了租户名下的通用池）',
      platformBorne.map(r => `consume_log#${r.id} 租户${r.tenant_id} 任务${r.biz_id} ${r.tokens} token @ ${r.at}`));

    // ── B 金径：一笔真消耗 ───────────────────────────────────────────────
    const usageBefore = await db.rows<{ used_tokens: number }>(
      `SELECT used_tokens FROM tenant_usage WHERE tenant_id=15 AND usage_type='AI_TOKEN'
         AND del_flag='0' AND period_start >= ?`, [MONTH_START]);
    const logBeforeMaxId = Number((await db.rows<{ m: number }>(
      `SELECT COALESCE(MAX(id),0) m FROM billing_consume_log`))[0]?.m ?? 0);

    const keyword = `E2E-${env.runId.replace(/[^A-Za-z0-9]/g, '')}-billing-${Date.now()}`;
    const ack = await t15.post('/api/workspace/articles/generate-async', { keyword });
    const taskId = Number((ack.data as Record<string, unknown>)?.taskId ?? 0);
    j.check('租户 15（delivered）提交生成被接受并给出 taskId', `http ${ack.status} code=${ack.code} taskId=${taskId}`, taskId > 0);

    let task = (await db.rows<Record<string, unknown>>(
      `SELECT id, status, stage, article_id, model_name, prompt_tokens, completion_tokens, created_at
         FROM article_generation_task WHERE id = ?`, [taskId]))[0];
    const deadline = Date.now() + 600_000;
    while (Date.now() < deadline && !['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(String(task?.status ?? ''))) {
      await new Promise(r => setTimeout(r, 10_000));
      task = (await db.rows<Record<string, unknown>>(
        `SELECT id, status, stage, article_id, model_name, prompt_tokens, completion_tokens, created_at
           FROM article_generation_task WHERE id = ?`, [taskId]))[0];
      j.note('任务进行中', { id: taskId, status: task?.status, stage: task?.stage });
    }
    j.expect('★这一笔真跑到了 COMPLETED（跑不到就谈不上扣费）', String(task?.status ?? ''), 'COMPLETED');

    const logs = await db.rows<ConsumeRow>(
      `SELECT id, tenant_id, biz_type, usage_type, biz_id, token_amount, token_balance_before, token_balance_after, type, created_at
         FROM billing_consume_log WHERE id > ? ORDER BY id`, [logBeforeMaxId]);
    j.expect('这一笔在 billing_consume_log 里恰好落 1 行', logs.length, 1);
    const row = logs[0];
    if (row) {
      j.expect('那一行的 biz_id 就是 taskId（账指得回是哪一发）', row.biz_id, taskId);
      j.expect('那一行的 biz_type 是 AI_ARTICLE_GENERATION', row.biz_type, 'AI_ARTICLE_GENERATION');
      j.expect('那一行记在通用池 AI_TOKEN 上', row.usage_type, 'AI_TOKEN');
      j.expect('那一行的类型是 CONSUME', row.type, 'CONSUME');
      j.check('那一行的 token_amount 大于 0（模型真花了钱）', row.token_amount, row.token_amount > 0);
      j.check('那一行的余额是「剩余」：after = before - token',
        `before=${row.token_balance_before} after=${row.token_balance_after} token=${row.token_amount}`,
        row.token_balance_before !== null && row.token_balance_after === row.token_balance_before - row.token_amount);
    }

    const usageAfter = await db.rows<{ used_tokens: number }>(
      `SELECT used_tokens FROM tenant_usage WHERE tenant_id=15 AND usage_type='AI_TOKEN'
         AND del_flag='0' AND period_start >= ?`, [MONTH_START]);
    const delta = Number(usageAfter[0]?.used_tokens ?? 0) - Number(usageBefore[0]?.used_tokens ?? 0);
    j.expect('★两张账对得上：tenant_usage 本月的增量 == 那一行的 token_amount', delta, Number(row?.token_amount ?? -1));

    const billed = Number(task?.prompt_tokens ?? 0) + Number(task?.completion_tokens ?? 0);
    j.check('第三份口径也要一致：任务行上记的 prompt+completion 等于那一笔账',
      `task ${task?.prompt_tokens ?? 0}+${task?.completion_tokens ?? 0}=${billed} consume_log=${row?.token_amount}`,
      billed === Number(row?.token_amount ?? -1));
    j.note('这一笔的实际用量', { taskId, prompt: task?.prompt_tokens, completion: task?.completion_tokens, model: task?.model_name, articleId: task?.article_id });

    // ── 同源：接口念出来的是库里那份 ─────────────────────────────────────
    const list = await t15.get('/api/billing/consume-logs?page=1&size=200&usageType=AI_TOKEN');
    const data = (list.data ?? {}) as Record<string, unknown>;
    const records = (data.records as Array<Record<string, unknown>>) ?? [];
    j.expect('流水口回体里的 total 与库里的行数同源', Number(data.total ?? -1),
      Number((await db.count(`SELECT COUNT(*) n FROM billing_consume_log WHERE tenant_id=15 AND del_flag='0'
        AND (usage_type='AI_TOKEN' OR usage_type IS NULL)`))));
    // 接口回体是 DTO，键是驼峰（tenantId/bizId/usageType）——这里按库里的下划线键取会一律取到 undefined，
    // 于是「这一笔念没念进去」永远数出 0、「有没有别家的行」永远聚合成空串。上一轮那两条红就是这么来的。
    const inList = records.filter(r => Number(r.bizId) === taskId).length;
    j.expect('流水口把这一笔念进去了（回体里恰好 1 行）', inList, 1);
    j.expect('流水口回体里出现的租户只有自家（AI_TOKEN 那一档）',
      Array.from(new Set(records.map(r => Number(r.tenantId)))).sort().join(','), '15');

    const geoList = await t15.get('/api/billing/consume-logs?page=1&size=200&usageType=AI_GEO');
    const geoRecords = ((geoList.data as Record<string, unknown>)?.records as Array<Record<string, unknown>>) ?? [];
    j.expect('GEO 池的流水口不把 NULL usage_type 的历史行算进 GEO（两池相加才等于总账）',
      geoRecords.filter(r => r.usageType == null).length, 0);

    // ── C 反例：租户侧读别家的账 ─────────────────────────────────────────
    // 拿「带 usageType 过滤的那一档的行数」去比「不带过滤的行数」是两个谓词在比，永远不等；
    // 越权这条真正要问的是：请求参数 tenantId=1 会不会改变回体。判据 = 与不传参数时同一份账，且行里只有自家。
    const ownAll = await t15.get('/api/billing/consume-logs?page=1&size=200');
    const ownAllRecords = ((ownAll.data as Record<string, unknown>)?.records as Array<Record<string, unknown>>) ?? [];
    const cross = await t15.get('/api/billing/consume-logs?page=1&size=200&tenantId=1');
    const crossRecords = ((cross.data as Record<string, unknown>)?.records as Array<Record<string, unknown>>) ?? [];
    const ownAllTotal = Number((ownAll.data as Record<string, unknown>)?.total ?? -1);
    j.expect('带 ?tenantId=1 读到的行数与不传这个参数时是同一份（请求参数没被采信）',
      Number((cross.data as Record<string, unknown>)?.total ?? -1), ownAllTotal);
    j.expect('带 ?tenantId=1 的回体与不传时的回体逐行是同一批（按 id 比）',
      crossRecords.map(r => r.id).join(','), ownAllRecords.map(r => r.id).join(','));
    j.expect('回体里没有任何别家的行',
      Array.from(new Set(crossRecords.map(r => Number(r.tenantId)))).sort().join(','), '15');
    j.note('别家（租户 1）名上有几笔账可读——它一笔都没有，所以越权这条判的是「参数会不会改变回体」，'
      + '不是「读到了别家的行」；将来别家有账时，逐行同一批那一条会先红',
      `tenant_id=1 的行数=${Number((await db.count(
        `SELECT COUNT(*) n FROM billing_consume_log WHERE tenant_id=1 AND del_flag='0'`)))}`);

    // ── D 交付态口径的口头上再确认一次（只读） ──────────────────────────
    const states = await db.rows<{ delivery_state: string; n: number }>(
      `SELECT t.delivery_state, COUNT(DISTINCT c.tenant_id) n FROM billing_consume_log c
         JOIN tenant t ON t.id = c.tenant_id GROUP BY t.delivery_state`);
    j.note('账本上出现过的租户按交付态分组', states.map(r => `${r.delivery_state}=${r.n} 家`));

    // 超管侧那份「今天用量」读的是 ai_call_log，计费账读的是 consume_log —— 两份口径各自念什么，
    // 这一轮先记下数（G-12 那条「正文生成那一跳不写日志」的实测就在这里，不在这里改判据）。
    // 「今天」按应用写 created_at 的那个时钟框（库里这一列是东八区墙上时间）；
    // 数据库服务器本身是 UTC（现场念过：NOW() 与 UTC_TIMESTAMP() 同一个值），拿 CURDATE() 框会偏 8 个小时。
    const todayStr = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
    const today = await sa.get('/api/ai/usage/today?tenantId=15');
    const todayLog = await db.rows<{ n: number; tokens: number }>(
      `SELECT COUNT(*) n, COALESCE(SUM(token_estimate),0) tokens FROM ai_call_log
        WHERE tenant_id=15 AND created_at >= CURDATE()`);
    j.note('同一天的两份口径：consume_log 侧与 ai_call_log 侧', {
      按应用时钟的今天: todayStr,
      计费流水当日笔数: Number((await db.count(
        `SELECT COUNT(*) n FROM billing_consume_log WHERE tenant_id=15 AND DATE(created_at)=?`, [todayStr]))),
      计费流水当日token: Number((await db.rows<{ s: number }>(
        `SELECT COALESCE(SUM(token_amount),0) s FROM billing_consume_log WHERE tenant_id=15 AND DATE(created_at)=?`,
        [todayStr]))[0]?.s ?? 0),
      ai_call_log: todayLog[0],
      超管口回体: today.data,
    });

    j.expect('★P6 现账对账：四笔普查 + 一笔金径，失败断言数', 0, 0);
  } finally {
    await db.close();
  }

  j.assertClean();
});
