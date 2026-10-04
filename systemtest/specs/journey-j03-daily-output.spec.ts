import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J03 每日自动产出（判据 G-04「每天 8 点前自动生成 5 篇中文候选」design.md:31、862、§5.5 L296）
 *
 * 档位以 B-2a 为准（2026-10-03 第二次拍板，覆盖 Q-4 的 (b)）：
 *   这一条跑出来的「按需能出 5 篇」**只是「缺的是哪一半」的证据，G-04 仍判未达成，不给它抬档**；
 *   补可开关的日报式调度 = 单独一个小方案，不混进本轮验收面。
 *
 * 所以这一条要交出的是两半各一个实测数：
 *
 * 半 A「按需一次点 5 篇」：限流三档现值（application.yml:108-114 一个都不带覆盖地跑）
 *   requests-per-minute=20 / max-concurrent-per-tenant=3 / concurrent-wait-timeout-seconds=180。
 *   TenantRateLimitService 现在是「公平排队等许可」，等待预算按缺陷 A 的实测改到够排完前面那一队
 *   （一篇生成实测 57~91s，改造前只等 30s，所以一次点 5 篇必有 2 篇被判 FAILED）。
 *   这一半测的不是「模型行不行」，是「点一次到底能落几篇」。
 *
 * 半 B「8 点前自动」：全仓 @Scheduled 命中 11 处（spec §4 那张表），**没有一条 cron 是「生成 5 篇文章」**；
 *   ArticleGenerationService.java:244 的 createBatchTasks（就是调度器该用的那个入口）零调用者。
 *   静态那一半的证据在 scratch/p3-schedulers.txt（grep 原文，不是转述）。
 *   这里跑的是行为那一半：**静置 5.5 分钟（跨过 RetryScheduler 那 300s 一拍、PublishScheduler 与
 *   KeywordExpandScheduler 那两拍每分钟一拍），期间一个接口都不调**，
 *   然后数这一家的 article_generation_task 与 article 新增行数 —— 应当是 0。
 *   0 就是「没有东西替我点生成」的实测，不是推测。
 */

interface TaskRow {
  id: number;
  status: string;
  stage: string | null;
  article_id: number | null;
  error_message: string | null;
  model_name: string | null;
  created_at: string;
}

const TERMINAL = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'CONTENT_REJECTED'];

test('SYS-J03 每日自动产出：一次点 5 篇落几篇 + 静置 5.5 分钟看有没有人替我点', async () => {
  test.info().setTimeout(1_500_000);
  const j = new Journal('SYS-J03');
  const db = new Db(j);

  let A: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  try {
    j.card({
      用例号: 'SYS-J03-01',
      判据: 'G-04（B-2a：这一条只作「缺的是哪一半」的证据，G-04 仍判未达成）',
      层级: 'API',
      前置: `后端 ${env.apiBase}；探针租户现开；限流三档按现值不覆盖（20/分钟、3 并发、公平排队等 180s）；真调模型 5~7 次`,
      步骤: [
        '1 开探针租户 A，导 6 条关键词（选题要有的可选）',
        '2 一次提交 5 个生成任务（紧循环，不给它错开的机会）—— 这就是「客户点一下批量」的那一发',
        '3 轮询到 5 个任务全部终态，逐个数 COMPLETED / FAILED，并记下失败那几发的 stage 与话术',
        '4 补交：等未终态任务数掉到 3 以下再一篇一篇重投（用失败那一发自己的关键词），证明缺的是「没有排队」而不是「模型不行」',
        '5 库里对账：每一篇都有 task 行 + article(draft) + article_version 正文 + ai_model（Q-4(b) 的「每篇有来源与任务状态」）',
        '6 反例：把其中已经成功过的关键词再点一次（进程内缓存命中那条路），看回话与库里各是什么',
        '7 半 B：静置 330s，期间一个接口都不调',
        '8 数这一家在静置窗口里新增的 article_generation_task 行数与 article 行数（0 才是「没有自动产出」）',
      ],
      期望: [
        '步骤 3 报出实测数（一次点 5 篇 → 实际落成几篇），并逐篇给 status 与话术，不许「总之失败了」',
        '步骤 4 补交之后 5 篇候选都在库里 —— 说明 5 篇这个量做得到，做不到的是一次 5 篇',
        '步骤 5 每篇任务行都能追到自己的 article（article_id 非空），每篇都有模型名',
        '步骤 6 重复提交那一发要么给出可轮询的 taskId、要么直接把已存在那篇的 articleId 回出来，并且在任务表里留一行 —— 只回「已提交」而三样都没有就是谎报',
        '步骤 8 静置窗口新增 task = 0、新增 article = 0：这两格绿的就是「没有任何日程在替客户生成」这件事（G-04 判未达成的实测出处）',
      ],
      反例: ['静置期间不许有任何一篇替客户生成出来', '失败的任务必须写明为什么失败（限流/审核/超时三种话术要分得开）',
        '回体说「任务已提交」就必须有一行查得到的任务（否则界面只能对着一个 null taskId 空转）'],
      收尾: 'DELETE /api/admin/tenants/{id} 软删探针租户；5~7 篇候选的残留逐张报数（同一家的 article 是这一轮最贵的残留）',
    });

    const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
    A = await provisionTenant(sa.api, db, j, 'J03');
    const admin = A.admin;

    const tasksOf = async (): Promise<TaskRow[]> => db.rows<TaskRow>(
      `SELECT id, status, stage, article_id, error_message, model_name, created_at
       FROM article_generation_task WHERE tenant_id = ? ORDER BY id`, [A!.tenantId]);

    // ── 1 关键词 ───────────────────────────────────────────────────────────
    const words = [
      '儿童近视防控有哪些方法', '洗牙会不会让牙缝变大', '种植牙能用多少年',
      '隐形眼镜和框架眼镜怎么选', '拔智齿要休息几天', '牙齿矫正的最佳年龄',
    ];
    const imported = await admin.post('/api/workspace/keywords/import', { keywords: words });
    j.expect('导入 6 条关键词回 OK', imported.code, 'OK');
    // Map.of 的键序不稳（J-02 在 1003-172048 就被总/分换个位误红过一次）⇒ 逐字段比
    const importData = (imported.data ?? {}) as Record<string, unknown>;
    j.expect('回体 imported 等于 6', importData.imported, 6);
    j.expect('回体 total 等于 6', importData.total, 6);

    // ── 2 一次点 5 篇（紧循环） ────────────────────────────────────────────
    const submitted: Array<{ taskId: number; keyword: string }> = [];
    for (const w of words.slice(0, 5)) {
      const r = await admin.post('/api/workspace/articles/generate-async', { keyword: w });
      const id = Number((r.data as Record<string, unknown>)?.taskId ?? 0);
      j.check(`紧循环提交「${w}」拿到 taskId（回体 code=${r.code}）`, id, id > 0);
      submitted.push({ taskId: id, keyword: w });
    }
    const rowsAfterSubmit = (await tasksOf()).length;
    j.expect('5 发提交都建了任务行（提交这一层不拦，拦在跑的时候）', rowsAfterSubmit, 5);

    // ── 3 轮询到全部终态 ───────────────────────────────────────────────────
    const deadline = Date.now() + 600_000;
    let rows = await tasksOf();
    while (Date.now() < deadline && rows.some(r => !TERMINAL.includes(r.status))) {
      await new Promise(r => setTimeout(r, 10_000));
      rows = await tasksOf();
      j.note('批量进行中', rows.map(r => ({ id: r.id, s: r.status, stage: r.stage, p: r.article_id })));
    }
    const done = rows.filter(r => r.status === 'COMPLETED');
    const failed = rows.filter(r => r.status !== 'COMPLETED');
    j.note('一次点 5 篇的实测账（G-04 半 A 的本体就是这个数）', {
      提交: 5, 终态数: rows.length, 完成: done.length, 未完成: failed.map(f => ({ id: f.id, status: f.status, stage: f.stage, err: f.error_message })),
    });
    j.expect('5 个任务都到了终态（没有卡在 PENDING/PROCESSING 的）', rows.filter(r => !TERMINAL.includes(r.status)).length, 0);
    // ★ 立项原话是「一次生成 5 篇」这一量的产出口径：这一格按现状判，实测数是几就是几
    //   （缺陷 A 修前这一格实测 3/5——第 4、5 篇在 30s 那一点被判 FAILED；改成公平排队 + 180s 预算后重测）
    j.expect('★一次点 5 篇，5 篇都要落下来（并发闸 3，多出来的两发排队等，等不到才判失败）', done.length, 5);
    j.check('失败的那几发必须写明为什么（话术里点名限流），不许是空 error_message',
      failed.map(f => `${f.status}/${f.stage}/${(f.error_message ?? '').slice(0, 30)}`).join(' | '),
      failed.every(f => (f.error_message ?? '').length > 0));

    // ── 4 补交：等到有空位再一篇一篇投，证明缺的是「没有排队」而不是「模型不行」 ──
    //  重投必须用失败那一发自己的关键词：换成已经完成过的词会命中进程内缓存（ArticleGenerationCacheService），
    //  那是步骤 6 单独测的那条缺陷，混进来这两件事就都说不清了。
    const keywordOfTask = new Map(submitted.map(s => [s.taskId, s.keyword]));
    const retryIds: number[] = [];
    for (const f of failed) {
      const w = keywordOfTask.get(f.id) ?? '';
      const giveUpAt = Date.now() + 300_000;
      for (;;) {
        const live = (await tasksOf()).filter(r => !TERMINAL.includes(r.status)).length;
        if (live < 3 || Date.now() > giveUpAt) break;   // 并发闸 3：等不到空位就还是限流
        await new Promise(r => setTimeout(r, 10_000));
      }
      const r = await admin.post('/api/workspace/articles/generate-async', { keyword: w });
      const id = Number((r.data as Record<string, unknown>)?.taskId ?? 0);
      j.check(`错开补交「${w}」拿到 taskId（code=${r.code}）`, id, id > 0);
      retryIds.push(id);
    }
    const retryDeadline = Date.now() + 600_000;
    let retryRows = await tasksOf();
    while (Date.now() < retryDeadline
      && retryRows.filter(r => retryIds.includes(r.id)).some(r => !TERMINAL.includes(r.status))) {
      await new Promise(r => setTimeout(r, 10_000));
      retryRows = await tasksOf();
    }
    const allDone = retryRows.filter(r => r.status === 'COMPLETED');
    j.expect('补交之后凑够 5 篇候选（做得到的量是「错开点」，不是「一次点」）', allDone.length, 5);

    // ── 5 每篇都能追到来源与任务状态（Q-4(b) 那句） ────────────────────────
    const articleIds = allDone.map(r => Number(r.article_id ?? 0));
    j.expect('5 篇任务各自带出 article_id', [...new Set(articleIds)].length, 5);
    j.expect('任务行都写了模型名（谁写的）', allDone.map(t => t.model_name).filter(m => !!m).length, 5);
    const artAgg = await db.rows<{ n: number; drafted: number; withVersion: number }>(
      `SELECT COUNT(*) AS n,
              SUM(CASE WHEN a.status = 'draft' THEN 1 ELSE 0 END) AS drafted,
              SUM(CASE WHEN (SELECT COUNT(*) FROM article_version v WHERE v.article_id = a.id AND v.del_flag = '0'
                             AND CHAR_LENGTH(v.content_md) > 200) > 0 THEN 1 ELSE 0 END) AS withVersion
       FROM article a WHERE a.id IN (${articleIds.map(() => '?').join(',')})`, articleIds);
    j.expect('库里 5 篇都在', Number(artAgg[0]?.n), 5);
    j.expect('5 篇全是 draft（批量产出不许自己越过审核）', Number(artAgg[0]?.drafted), 5);
    j.expect('5 篇都有 >200 字的正文', Number(artAgg[0]?.withVersion), 5);

    // ── 6 反例：同一个关键词再点一次（进程内缓存命中那一条路） ────────────────
    //  修前现场（Q-P2a 定稿 a 的那三条红）：ArticleGenerationService 命中缓存时返回的是一个**从没 insert 过**的
    //  task 对象（id=null、status=COMPLETED、articleId=缓存里那一篇），WorkspaceController 只读它的 getId()，
    //  然后固定回 status=PENDING +「文章生成任务已提交，正在处理中」，再拿这个 null 去 executeTaskAsync
    //  （selectById 查不到 ⇒ log.error 后 return）——回体、任务表、界面三处各自谎报一层。
    //  现在这一发把复用的那一行落进任务表，回体给 REUSED + 可轮询的 taskId + articleId。
    //  这一发是「客户在批量里点重了」的形状，不是构出来的分支。
    const maxTaskIdBeforeDup = Math.max(...(await tasksOf()).map(r => r.id));
    const dup = await admin.post('/api/workspace/articles/generate-async', { keyword: words[0] });
    const dupData = (dup.data ?? {}) as Record<string, unknown>;
    j.note('重复提交同一关键词的原样回体（N-05 判的就是这段话）',
      { code: dup.code, message: dup.message, 回体: dupData });
    const dupTaskId = Number(dupData.taskId ?? 0);
    // 判据不钉死修法：给一个可轮询的 taskId、或者直接把已存在那篇的 articleId 回出来，两种都算跟上；
    // 只回「已提交」而两样都不给才是这条红。
    j.expect('★重复提交那一发得给出可跟进的东西（可轮询 taskId，或已存在那篇的 articleId）',
      dupTaskId > 0 || typeof dupData.articleId === 'number', true);
    const dupTaskRows = await db.count(
      'SELECT COUNT(*) AS n FROM article_generation_task WHERE tenant_id = ? AND id > ?',
      [A.tenantId, maxTaskIdBeforeDup]);
    j.expect('★回体说「已提交」的那一发必须在任务表里留一行（没留 = 这一发在审计里根本不存在）', dupTaskRows, 1);

    // ── 7/8 半 B：静置，期间一个接口都不调 ─────────────────────────────────
    const beforeTaskMax = Math.max(...(await tasksOf()).map(r => r.id));
    const beforeArticleMax = (await db.rows<{ m: number }>(
      'SELECT COALESCE(MAX(id),0) AS m FROM article WHERE tenant_id = ?', [A.tenantId]))[0]?.m ?? 0;
    const idleStart = Date.now();
    j.note('静置窗口开始（跨过 RetryScheduler 的 300s 一拍 + 两个每分钟一拍的调度器）', {
      beforeTaskMax, beforeArticleMax, idleMs: 330_000,
    });
    await new Promise(r => setTimeout(r, 330_000));
    const newTasks = await db.rows<{ id: number; status: string }>(
      'SELECT id, status FROM article_generation_task WHERE tenant_id = ? AND id > ?', [A.tenantId, beforeTaskMax]);
    const newArticles = await db.count(
      'SELECT COUNT(*) AS n FROM article WHERE tenant_id = ? AND id > ?', [A.tenantId, beforeArticleMax]);
    // 这两格绿 = 「没有任何东西替客户点生成」这件事成立 ⇒ G-04 的「8 点前自动」那一半按现状不成立。
    // 断言写成绿是因为它测的是事实而非愿望：愿望落不落地由档位说（B-2a：G-04 未达成），不由这里说。
    j.expect('★静置 5.5 分钟没有任何东西替客户点生成：新增任务行 = 0（这一格绿正是 G-04 未达成的实测）', newTasks.length, 0);
    j.expect('★静置 5.5 分钟没有自动多出任何一篇稿：新增 article 行 = 0（同上）', newArticles, 0);
    j.note('静置窗口的实测账（G-04 自动化那一半的证据就在这一格）', {
      静置实际毫秒: Date.now() - idleStart, 新增任务: newTasks, 新增文章: newArticles,
    });
  } finally {
    if (A) {
      const api = (await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password)).api;
      await retireTenant(api, j, A);
      j.note('A 家（已注销）本轮留下的行数', {
        article: await db.count('SELECT COUNT(*) AS n FROM article WHERE tenant_id = ?', [A.tenantId]),
        task_by_status: await db.rows<{ status: string; n: number }>(
          'SELECT status, COUNT(*) AS n FROM article_generation_task WHERE tenant_id = ? GROUP BY status', [A.tenantId]),
        ai_call_log_by_purpose: await db.rows<{ purpose: string; n: number }>(
          'SELECT purpose, COUNT(*) AS n FROM ai_call_log WHERE tenant_id = ? GROUP BY purpose ORDER BY purpose', [A.tenantId]),
      });
      const left = await residue(db);
      j.expect('收尾后本轮活租户残留 = 0', left.tenants, 0);
      j.note('残留清点', left);
    }
    await db.close();
  }
  j.assertClean();
});
