# Spec-K 系统测试 runner（P0 骨架，2026-10-03 已过门禁）

`docs/SYSTEM_TEST_SPEC.md` §8 的 P0 出口：runner + 种子 + §5 用例格式 + 矩阵模板，跑通 J-01 与 J-12。
**门禁结果与打分矩阵**在 `E:\qoder\docs\SYSTEM_TEST_REPORT.md`（B-5a 那张表）；证据目录 `E:\qoder\docs\evidence\system-2026-10-03\p0\`。
这套东西**不是** `src/**` 的组件测试，走 `@playwright/test`。
两个 runner 的分界是**显式**的，不是靠文件名猜的：`vitest.config.ts` 里 `exclude: ['systemtest/**']`。
（原先写的是「vitest 只吃 `src/**/*.spec.ts`，所以互不污染」—— 实测是假的：vitest 默认 include 会把
`systemtest/specs/journey-*.spec.ts` 捡走，2 档因缺 `E2E_RUN_ID` 直接收集失败。加了 exclude 之后 `npx vitest run` = 110 档 1440 例全绿。）

## 跑法（现网 dev 后端 + 专用探针租户）

```sh
export JAVA_HOME="D:/tools/jdk-21.0.12.1+1"          # 后端要起着（scratch/start-backend-p5g1.sh）
export PATH="/d/tools/nodejs:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="D:\\tools\\playwright-browsers"   # 浏览器二进制在 D 盘，不进 C 盘
export E2E_RUN_ID="$(date +%m%d-%H%M%S)"             # 数据前缀 E2E-<runId>，一轮一个，不跟上一轮撞唯一索引
export E2E_EVIDENCE_DIR="E:/qoder/docs/evidence/system-2026-10-03/p0"
export DB_PASSWORD='<开发库口令>' E2E_ADMIN_PASSWORD='<超管口令>'   # 缺任何一个 env 直接停，仓库里不留口令
cd /e/qoder/chinaGuideBackend-ui/systemtest
npx playwright test specs/journey-j01-provision.spec.ts   # 或一把跑：npx playwright test
```

## 目录

| 路径 | 干什么 |
|---|---|
| `playwright.config.ts` | 两个 project：`journey-*.spec.ts` 走 API（不开浏览器），`screen-*.spec.ts` 走 chromium（Q-3=3b 那 6 屏） |
| `lib/env.ts` | 唯一读 env 的地方；口令类一律 required()，缺就停 |
| `lib/api.ts` | 带租户声明头的 HTTP 客户端；每条请求/响应落进证据 JSONL；`password/token/secret` 字段进文件前打码 |
| `lib/db.ts` | **只读** SQL 断言与残留清点。写一律走业务接口 —— 直改库等于把「接口放不放人」测成假的 |
| `lib/journal.ts` | §5 那张统一用例卡（`card()`）+ 断言即落盘（`check()`/`expect()`），失败清单在 `assertClean()` 抛出 |
| `lib/seed.ts` | 探针租户/探针账号按业务接口开通与下线；角色 id 现场按 code 查，不写死 |
| `specs/journey-j01-provision.spec.ts` | SYS-J01 开通一家企业并跑到可交付（G-02、G-13） |
| `specs/journey-j12-isolation.spec.ts` | SYS-J12 隔离/鉴权/留痕 12 个高危口矩阵 |
| `specs/journey-j02-content-loop.spec.ts` | SYS-J02 内容生产闭环：关键词→蒸馏→AI 候选→人改→审核→门户读得到（G-03） |
| `specs/journey-j03-daily-output.spec.ts` | SYS-J03 每日产出：一次点 5 篇能不能都成 + 完全不动它会不会自己长出稿子（G-04） |
| `specs/journey-j04-review-i18n.spec.ts` | SYS-J04 两级审核与多语言：AI 预审不越权推状态、翻译按参数出稿、门户那一篇是谁（G-05、G-06） |
| `specs/journey-j10-ai-trace.spec.ts` | SYS-J10 AI 留痕与失败面：四要素、坏模型不吞错、生成那一跳的留痕缺口（G-12） |
| `specs/journey-j11-modules.spec.ts` | SYS-J11 官网六模块通用能力：后台写一行→自己的读口点得到→删了就读不到（G-13） |
| `specs/screen-j13-screens.spec.ts` | SYS-J13 后台六屏浏览器重放：真实控件点到底、控制台不许报错（N-04、N-05） |

## 数据纪律（spec §7）

真实租户（1、15 等）只读；本轮所有写都在 `E2E-<runId>` 前缀的探针租户与探针账号里。
收尾用业务口 `DELETE /api/admin/tenants/{id}` 软删 —— 软删行继续占 `code`/`username` 唯一索引，
所以**重跑必须换 `E2E_RUN_ID`**；每轮结尾会报一次逐表残留数，那个数进报告不进沉默。

三条用一把跑法跑出来的规矩（违反的代价都实测过，别改回去）：

1. **一条 journey 的种子 tag 要带用例号**（`J01A` / `J12A`，不是 `A`）。一次 `playwright test` 里多条旅程共用同一个
   `E2E_RUN_ID`，而 `TENANT_CODE_EXISTS` 连软删行一起算 —— 共用 `A` 时第二条会在建租户那步撞死（run 1003-111011 实测）。
2. **逐轮留档，别只留最后一次**。`assertClean()` 会把本轮日志另存成 `SYS-J<nn>.<runId>.jsonl` 并往 `runs.log` 加一行；
   「可重放」是门禁（Q-8=8a）的原话，只留最后一轮等于没证明重放过。
3. **超管动别家的账号要先站到那一家**：`AdminUserController.requireUser` 比的是行归属，平台档身份直接 `?tenantId=` 指过去，
   创建能过、授角色会被判「无权限操作该用户」（J-12 run 3 就是这么红的）。`lib/seed.ts` 里那两处 `withTenant()` 就是界面右上角切租户做的事。

证据文件里不落明文：`lib/api.ts` 的 `reqHeaders` / `reqBody` / `data` 三处都过 `redact()`（键名命中 `password|token|secret` 即遮）。
这两条都曾实测打穿过一次 —— 接线前 run 111632/111743 的证据里有过口令与 JWT，`docs/SYSTEM_TEST_REPORT.md` §0 与 §3 第 8 条留了痕迹。
