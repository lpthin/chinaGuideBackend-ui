import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { env } from '../lib/env';

/**
 * SYS-J09b 水位闸：通用池打满当场拒、GEO 池分得开、水位可设可撤（N-02 的反面 + G-02 的边界）
 *
 * 为什么单独一条文件：这一档要改**后端进程的环境变量**才触发得起来
 * （`AI_DEFAULT_MONTHLY_QUOTA=1`；租户 15 名下没有 ACTIVE 套餐，通用池的水位就落在这个全局默认上，
 * 起跑前 preflight.md 已把这一条查实：billing_package 里 tenant_id=15 零行）。
 * J-09 那条金径跑的是「额度够 ⇒ 真扣钱」，这一条跑的是「额度不够 ⇒ 当场拒，并且一笔都不留」。
 *
 * 读代码定下来的判据形状（三处与直觉不同，所以每条都改成现场读回来的键）：
 *  - 通用池那一路的拒走 {@code QuotaExceededException} ⇒ **HTTP 429** + code=QUOTA_EXCEEDED
 *    （ArticleGenerationService:102 的 checkQuota 排在 new ArticleGenerationTask() 之前 ⇒ 拒干净是有依据的）。
 *  - GEO 那一路的拒**先撞 GeoCampaignService:573 的 gateNotice**（GATE_DENIED 是个 BusinessException，
 *    GlobalExceptionHandler:36 不给它加 @ResponseStatus ⇒ HTTP 200 + body.code=GEO_CAMPAIGN_GATE_DENIED），
 *    {@code checkQuota} 那句 429 在这个端点上排在后面，根本轮不到。这里按现场真回的形断，
 *    「同一个『钱不够』在两路上 HTTP 面不同形」记成产品缺陷候选，不替它圆。
 *  - 同一计划有在册轮次（PENDING/RUNNING）时先抛 GEO_CAMPAIGN_RUN_IN_FLIGHT，也轮不到钱。
 *    所以拦与放两步用同一个计划、并把「受理那一发」放在最后：起跑前库里全平台零在册轮次（preflight2.md）。
 *  - 水位「留空 = 不限制」，读口给 null 而不是 0（V158/N2）；剩余一律夹到 0，不念负数。
 *    2026-10-06 Q-P6a 拍板 (a) 之后这一条覆盖到<b>门禁那句拒词</b>：拒词、读口、超管页三处同一个数
 *    （旧形拒词念原值负数，实测见 evidence/system-2026-10-04/p6）；判定仍按原值比，夹 0 只改话术。
 *  - 鉴权排在钱前面：{@code POST /api/geo/campaign/{id}/run} 要 geo:campaign:run（V147 起只授
 *    SITE_ADMIN/SUPER_ADMIN），而 tenant15_admin 是 CONTENT_EDITOR —— 上一轮拿它发这一发收到的是
 *    403 PERMISSION_DENIED，看着像「没拦住」其实是压根没走到门禁。诊断那两步改用 jingtian_admin。
 *
 * 分账这件事要拿数字证明，不能只拿话术：第 3 步把 GEO 池水位设成「GEO 本月已用 + 50000」，
 * 读口念出的剩余就必须正好是 50000——这一个是 GEO 池自己的账算出来的，而同一屏上通用池的剩余还是 0
 * （它的水位还是 1）。两份数各自独立，才叫分账；只看拒词里提没提池子名，是拿文案当判据。
 */

interface PoolItem {
  usageType: string;
  poolLabel: string;
  monthTokenAmount: number | string;
  monthCount: number;
  monthlyQuota: number | null;
  usedTokens: number;
  quotaUnlimited: boolean;
  remainingTokens: number | null;
}

/** 现网唯一 delivered 的租户；它名下这个月通用池已用 14 万+，水位设成 1 一定打满 */
const TENANT = 15;
const MONTH_START = '2026-10-01';
/** 通用池没配套餐时读的全局默认，本次启动就把它压成了 1 */
const GATE_QUOTA = 1;

function poolsOf(res: { data: unknown }): PoolItem[] {
  return ((res.data ?? {}) as Record<string, unknown>).pools as PoolItem[] ?? [];
}

test('SYS-J09b 水位闸：通用池拒得干净、GEO 池分得开、水位可设可撤', async () => {
  test.info().setTimeout(600_000);
  const j = new Journal('SYS-J09b');
  const db = new Db(j);

  try {
    j.card({
      用例号: 'SYS-J09b-01',
      判据: 'N-02「水位设了才限、留空不限」+ G-02「能计费」的反面（额度不够当场拒）+ Spec-G G4「两池分账」',
      层级: 'API',
      前置: `后端 ${env.apiBase} 以 AI_DEFAULT_MONTHLY_QUOTA=1 启动；租户 ${TENANT} 是 delivered 且名下无 ACTIVE 套餐；`
        + 'GEO 池水位现网为 NULL=不限制（跑完还原成这一档）；起跑前全平台零在册轮次、租户 15 当日 0 轮（日闸 30 撞不上）；'
        + '文章那一路用 tenant15_admin（CONTENT_EDITOR），诊断那一路换成 jingtian_admin（SITE_ADMIN）——'
        + 'geo:campaign:run 只授 SITE_ADMIN/SUPER_ADMIN，用前者发这一发只会拿到 403，钱那一层轮不到',
      步骤: [
        '1 读口证明这一档生效：/api/billing/stats/overview?tenantId=15 的 pools 里通用池 monthlyQuota=1、剩余夹到 0，GEO 池念「不限制」',
        '2 通用池打满时提交一次真生成 ⇒ 期望 HTTP 429 + QUOTA_EXCEEDED + 历史那句「Token配额不足…月度配额: 1」',
        '3 拒后清点：billing_consume_log / tenant_usage / article_generation_task / article 一行都不许多',
        '4 分账·数字：超管把 GEO 池水位设成「GEO 本月已用 + 50000」⇒ 读口剩余正好 50000，同一屏通用池仍是 1/0',
        '5 设低了真会拦：GEO 水位改成 1 ⇒ 同一发诊断起跑被拒（现场形：HTTP 200 + GEO_CAMPAIGN_GATE_DENIED），轮次表零留痕',
        '6 撤回去就放行：水位留空 ⇒ 读口回到 true/null/null，同一发起跑受理（真调模型，轮次留在库里）',
        '7 反向不泄漏：GEO 放开之后，通用池那一路仍按它自己的水位拒；那一发 GEO 的钱只落 GEO 池，通用池流水行数不变',
      ],
      期望: [
        '步骤 2 是 429，不是 200「已提交」',
        '步骤 3 四张表前后行数与数值一字不变（拒干净）',
        '步骤 4 剩余那一个 50000 由 GEO 池自己的已用算出，与通用池的 0 同屏并存',
        '步骤 5 拒词点名「GEO 诊断专用额度池」并给出「让超管留空即放开」的出路；轮次表不多一行',
        '步骤 6 「不限制」念成 null 而不是 0',
        '步骤 7 两池各自的水位互不越界',
      ],
      反例: [
        '额度不够还放行 = 水位是摆设',
        '拒了但多出任务行/草稿/流水 = 客户看到「配额不足」的同时还被扣了钱',
        '通用池=1 把 GEO 一起拦死 = 两池共用一个分母（G4 要避免的事原地复发）',
        '「不限制」兜成 0 = 读的人以为钱花光了（V158/N2 原话）',
        '设了水位却拦不住 = 界面那个数是摆设，超管改完还以为管住了',
      ],
      收尾: 'GEO 水位撤销回 NULL（= 现网原状）；第 6 步那一发诊断轮次真调模型、留在库里逐行点名（删除属破坏性数据动作，等拍板）',
    });

    const sa = (await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password)).api;
    const t15 = (await Api.login(env.apiBase, j, 'tenant15_admin', 'admin123')).api;
    // 起跑诊断要 geo:campaign:run，这一码 V147 起只授给 SITE_ADMIN 与 SUPER_ADMIN；
    // tenant15_admin 是 CONTENT_EDITOR，上一轮用它发这一发拿到的是 403 PERMISSION_DENIED——
    // 钱那一层根本没轮到，测的是「鉴权」不是「水位」。租户 15 的 SITE_ADMIN 是 jingtian_admin。
    const geoRunner = (await Api.login(env.apiBase, j, 'jingtian_admin', 'admin123')).api;
    const me = (await geoRunner.get('/api/auth/me')).data as Record<string, unknown>;
    j.expect('★起跑诊断的那个身份确实带 geo:campaign:run（不然第 5、6 步测的是鉴权不是钱）',
      `${(me.roles as string[]).join('|')}/${(me.permissions as string[]).includes('geo:campaign:run')}`, 'SITE_ADMIN/true');

    // ── 1 前置：这一档到底生效没有 ───────────────────────────────────────
    // pools 那一组数在 /stats/overview 上（BillingStatsController:81），/stats 回的是金额那一份、没有池子
    const stats = await sa.get(`/api/billing/stats/overview?tenantId=${TENANT}`);
    const tokenPool = poolsOf(stats).find(p => p.usageType === 'AI_TOKEN');
    const geoPool = poolsOf(stats).find(p => p.usageType === 'AI_GEO');
    j.expect('★这一档生效了：通用池水位读出来就是 1（念不出 1 = 后端不是带 AI_DEFAULT_MONTHLY_QUOTA=1 起的，下面全部作废）',
      `${tokenPool?.monthlyQuota}/${tokenPool?.quotaUnlimited}`, `${GATE_QUOTA}/false`);
    j.expect('通用池已打满：剩余夹到 0，不许念负数', `${tokenPool?.remainingTokens}`, '0');
    j.expect('GEO 池这一档没设水位 ⇒ 读口给「不限制」，额度与剩余都不许兜成 0（V158/N2）',
      `${geoPool?.quotaUnlimited}/${geoPool?.monthlyQuota}/${geoPool?.remainingTokens}`, 'true/null/null');
    const ledgerUsed = await db.count(
      `SELECT COALESCE(SUM(used_tokens),0) n FROM tenant_usage WHERE tenant_id=? AND usage_type='AI_TOKEN'
         AND del_flag='0' AND period_start >= ?`, [TENANT, MONTH_START]);
    j.expect('读口念的「本月已用」与库里额度账那一行同一个数', Number(tokenPool?.usedTokens ?? -1), ledgerUsed);
    const tokenFlow = await db.count(
      `SELECT COALESCE(SUM(token_amount),0) n FROM billing_consume_log WHERE tenant_id=? AND del_flag='0'
         AND COALESCE(usage_type,'AI_TOKEN')='AI_TOKEN' AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 MONTH)`,
      [TENANT, MONTH_START, MONTH_START]);
    j.expect('读口念的「本月流水相加」与本月流水真相加同一个数（NULL 归通用池，不串池）',
      Number(tokenPool?.monthTokenAmount ?? -1), tokenFlow);

    // ── 2/3 通用池打满：拒得干净 ─────────────────────────────────────────
    const beforeLog = await db.rows<{ n: number, m: number }>(
      `SELECT COUNT(*) n, COALESCE(MAX(id),0) m FROM billing_consume_log WHERE tenant_id=? AND del_flag='0'`, [TENANT]);
    const beforeTask = await db.count(`SELECT COUNT(*) n FROM article_generation_task WHERE tenant_id=?`, [TENANT]);
    const beforeArticle = await db.count(
      `SELECT COUNT(*) n FROM article WHERE tenant_id=? AND del_flag='0'`, [TENANT]);

    const keyword = `E2E-${env.runId.replace(/[^A-Za-z0-9]/g, '')}-quota-gate-${Date.now()}`;
    const denied = await t15.post('/api/workspace/articles/generate-async', { keyword });
    j.expect('★水位打满时提交被当场拒（HTTP 429，不是 200「已提交」）', denied.status, 429);
    j.expect('拒的机器码是 QUOTA_EXCEEDED', denied.code, 'QUOTA_EXCEEDED');
    j.expect('拒的是通用池那一路的历史原文（G4 只给 GEO 那一路加池子名与前缀，这一句一个字不许改）',
      `${denied.message.startsWith('Token配额不足')}/${denied.message.endsWith(`月度配额: ${GATE_QUOTA}`)}`, 'true/true');
    // Q-P6a（2026-10-06 拍板 (a)「夹到 0，三处同一个数」）：这一条原来是「缺陷候选 J09b-1，只报不改」。
    // 现场实测过的旧形在 docs/evidence/system-2026-10-04/p6/SYS-J09b.1004-112834.jsonl 里，那一轮拒词念的是
    // 「剩余: -142352」，而同一轮同一屏的读口与超管页念 0 —— 客户看着同一个动作拿到两个数。
    // 现在三处必须同一个数；判定仍按原值（负数）比，所以夹 0 不会把「不够」夹成「够」。
    const refusedRemaining = denied.message.match(/剩余: (-?\d+)/)?.[1];
    j.expect('★三处同一个「剩余」：门禁拒词与读口都是 0（夹过，不许念负数）',
      `${refusedRemaining}/${tokenPool?.remainingTokens}`, '0/0');
    j.expect('拒词里出现负号 = 闸那一处退回原值、界面与拒词又各说一套',
      /剩余: -\d/.test(denied.message), false);
    j.expect(`夹 0 只改话术没改判定：水位 ${GATE_QUOTA}、本月已用 ${ledgerUsed}，这一发仍被当场拒`,
      denied.status, 429);
    j.note('Q-P6a 落地位置：TokenQuotaService.checkQuota 给 deniedMessage 传 Math.max(0, remaining)，'
      + '比较那一句仍用原值（单测里那条「已超支 + 预计 0 token 照样拦」钉的就是这一条）',
      `拒词原文=${denied.message}　水位=${GATE_QUOTA}　本月已用=${ledgerUsed}`);



    const afterLog = await db.rows<{ n: number, m: number }>(
      `SELECT COUNT(*) n, COALESCE(MAX(id),0) m FROM billing_consume_log WHERE tenant_id=? AND del_flag='0'`, [TENANT]);
    j.expect('拒完 billing_consume_log 一笔都没多（行数）', Number(afterLog[0]?.n ?? -1), Number(beforeLog[0]?.n ?? -2));
    j.expect('拒完连最大 id 都没动（不是「多一行又软删」）', Number(afterLog[0]?.m ?? -1), Number(beforeLog[0]?.m ?? -2));
    j.expect('拒完额度账的「本月已用」没被推高',
      await db.count(`SELECT COALESCE(SUM(used_tokens),0) n FROM tenant_usage WHERE tenant_id=? AND usage_type='AI_TOKEN'
        AND del_flag='0' AND period_start >= ?`, [TENANT, MONTH_START]), ledgerUsed);
    j.expect('拒完任务表没多行（checkQuota 排在 new ArticleGenerationTask() 之前，不该留下跟不上的发号）',
      await db.count(`SELECT COUNT(*) n FROM article_generation_task WHERE tenant_id=?`, [TENANT]), beforeTask);
    j.expect('拒完草稿表没多行',
      await db.count(`SELECT COUNT(*) n FROM article WHERE tenant_id=? AND del_flag='0'`, [TENANT]), beforeArticle);

    // ── 4 分账·数字：GEO 池的水位算的是 GEO 池自己的账 ────────────────────
    const campaign = (await db.rows<{ id: number; name: string; calls: number }>(
      `SELECT c.id, c.name, c.question_count*c.platform_count*c.repeat_times calls FROM geo_campaign c
        WHERE c.tenant_id=? AND c.del_flag='0'
          AND NOT EXISTS (SELECT 1 FROM geo_campaign_run x WHERE x.campaign_id=c.id AND x.status IN ('PENDING','RUNNING'))
        ORDER BY calls ASC, c.id DESC LIMIT 1`, [TENANT]))[0];
    j.check('库里有一张「没有在册轮次」的计划，第 5、6 步的拒与放才测得到钱那一层（否则先撞在飞闸）',
      `campaign=${campaign?.id} ${campaign?.name} 规模=${campaign?.calls} 次调用`, !!campaign?.id);

    const geoLedgerUsed = await db.count(
      `SELECT COALESCE(SUM(used_tokens),0) n FROM tenant_usage WHERE tenant_id=? AND usage_type='AI_GEO'
         AND del_flag='0' AND period_start >= ?`, [TENANT, MONTH_START]);
    const HEADROOM = 50_000;
    const setHigh = await sa.put('/api/admin/geo-quota', { tenantId: TENANT, monthlyTokenQuota: geoLedgerUsed + HEADROOM });
    const highView = (setHigh.data ?? {}) as Record<string, unknown>;
    j.expect('★超管给 GEO 池设的水位读得回来，且出处点名「本租户单独设置」',
      `${highView.monthlyQuota}/${highView.quotaSource}/${highView.quotaUnlimited}`,
      `${geoLedgerUsed + HEADROOM}/TENANT/false`);
    j.expect('★剩余那一个数由 GEO 池自己的已用算出（设「已用+5万」⇒ 剩余正好 5 万，不是通用池那份 0）',
      `${highView.usedTokens}/${highView.remainingTokens}`, `${geoLedgerUsed}/${HEADROOM}`);
    const statsAfterHigh = poolsOf(await sa.get(`/api/billing/stats/overview?tenantId=${TENANT}`));
    const tokenAfterHigh = statsAfterHigh.find(p => p.usageType === 'AI_TOKEN');
    const geoAfterHigh = statsAfterHigh.find(p => p.usageType === 'AI_GEO');
    j.expect('同一屏上通用池的水位与剩余一个字没动（两池各有各的分母）',
      `${tokenAfterHigh?.monthlyQuota}/${tokenAfterHigh?.remainingTokens}`, `${GATE_QUOTA}/0`);
    j.expect('同一屏上 GEO 池念出的就是刚设的那一档（用量页与超管页读同一份判据）',
      `${geoAfterHigh?.monthlyQuota}/${geoAfterHigh?.remainingTokens}`, `${geoLedgerUsed + HEADROOM}/${HEADROOM}`);

    // ── 5 设低了真会拦（零留痕） ─────────────────────────────────────────
    const setLow = await sa.put('/api/admin/geo-quota', { tenantId: TENANT, monthlyTokenQuota: GATE_QUOTA });
    const lowView = (setLow.data ?? {}) as Record<string, unknown>;
    j.expect('★水位设成 1 之后剩余夹到 0（已用 2 万+ 远超，不许念负数）',
      `${lowView.monthlyQuota}/${lowView.remainingTokens}/${lowView.usedPercent}`, '1/0/100');

    const beforeRun = await db.count(
      `SELECT COUNT(*) n FROM geo_campaign_run WHERE tenant_id=?`, [TENANT]);
    const beforeGeoFlow = await db.count(
      `SELECT COUNT(*) n FROM billing_consume_log WHERE tenant_id=? AND del_flag='0' AND usage_type='AI_GEO'`, [TENANT]);
    const geoDenied = await geoRunner.post(`/api/geo/campaign/${campaign.id}/run`, { confirm: true });
    j.expect('★设了水位之后同一发起跑被拦下来（不是受理）', geoDenied.success, false);
    j.expect('★拦下来的是钱那一层，不是在飞闸、不是日闸（现场回体：HTTP 200 + 业务码，与通用池那一路的 429 不同形）',
      `${geoDenied.status}/${geoDenied.code}`, '200/GEO_CAMPAIGN_GATE_DENIED');
    j.check('拒词点名「GEO 诊断专用额度池」、说清与写文章分账、并给出「让超管留空即放开」的出路',
      geoDenied.message,
      geoDenied.message.includes('GEO 诊断专用额度池')
      && geoDenied.message.includes('分账')
      && geoDenied.message.includes('超级管理员'));
    j.expect('拒完轮次表没多行（gateNotice 排在 runMapper.insert 之前，一分钱没花也就不该起一轮）',
      await db.count(`SELECT COUNT(*) n FROM geo_campaign_run WHERE tenant_id=?`, [TENANT]), beforeRun);
    j.expect('拒完 GEO 池的流水一笔都没多',
      await db.count(`SELECT COUNT(*) n FROM billing_consume_log WHERE tenant_id=? AND del_flag='0' AND usage_type='AI_GEO'`,
        [TENANT]), beforeGeoFlow);

    // ── 6 撤回去就放行（这一发真调模型） ──────────────────────────────────
    const cleared = await sa.put('/api/admin/geo-quota', { tenantId: TENANT, monthlyTokenQuota: null });
    const clearView = (cleared.data ?? {}) as Record<string, unknown>;
    j.expect('★撤销（留空）之后回到「不限制」：额度与剩余都是 null，不是 0',
      `${clearView.quotaUnlimited}/${clearView.monthlyQuota}/${clearView.remainingTokens}/${clearView.quotaSource}`,
      'true/null/null/UNLIMITED');

    const beforeAcceptTokenRows = await db.count(
      `SELECT COUNT(*) n FROM billing_consume_log WHERE tenant_id=? AND del_flag='0'
         AND COALESCE(usage_type,'AI_TOKEN')='AI_TOKEN'`, [TENANT]);
    const runOk = await geoRunner.post(`/api/geo/campaign/${campaign.id}/run`, { confirm: true });
    j.check('★通用池水位仍是 1、GEO 池不限制 ⇒ 同一租户同一时刻的另一种消耗照常受理（分账成立）',
      `http ${runOk.status} code=${runOk.code} message=${runOk.message} runId=${JSON.stringify((runOk.data as Record<string, unknown>)?.id ?? null)}`,
      runOk.status === 200 && runOk.code === 'OK');
    const runId = Number((runOk.data as Record<string, unknown>)?.id ?? 0);
    j.expect('受理那一发真的起了一轮（轮次表 +1 行）',
      await db.count(`SELECT COUNT(*) n FROM geo_campaign_run WHERE tenant_id=?`, [TENANT]), beforeRun + 1);
    j.note('这一发诊断轮次真调模型（钱跑完才记在 GEO 池上）；收尾点名，删除属破坏性数据动作等拍板',
      { campaignId: campaign.id, runId, 回体状态: (runOk.data as Record<string, unknown>)?.status ?? null });

    // ── 7 反向不泄漏 ────────────────────────────────────────────────────
    const deniedAgain = await t15.post('/api/workspace/articles/generate-async', { keyword: `${keyword}-again` });
    j.expect('GEO 池放开之后，通用池那一路仍按它自己的水位拒（429 与原文一字没变）',
      `${deniedAgain.status}/${deniedAgain.code}/${deniedAgain.message}`,
      `429/QUOTA_EXCEEDED/${denied.message}`);
    j.expect('那一发 GEO 的钱不许写进通用池的流水（受理前后通用池行数相等）',
      await db.count(`SELECT COUNT(*) n FROM billing_consume_log WHERE tenant_id=? AND del_flag='0'
        AND COALESCE(usage_type,'AI_TOKEN')='AI_TOKEN'`, [TENANT]), beforeAcceptTokenRows);
    j.expect('GEO 池的水位撤完就留在不限制（库里那一行回到现网原状）',
      JSON.stringify(await db.rows<{ quota: number | null }>(
        `SELECT geo_monthly_token_quota quota FROM geo_quota_config WHERE tenant_id=?`, [TENANT])),
      JSON.stringify([{ quota: null }]));

    j.expect('★P6 水位闸：拒干净、分得开、设得上、撤得回，失败断言数', 0, 0);
  } finally {
    await db.close();
  }

  j.assertClean();
});
