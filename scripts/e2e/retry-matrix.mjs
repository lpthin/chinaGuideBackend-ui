// SPEC-UI-6 M4：重试「接对函数」的真测矩阵（5 页 × 3 种失败模式）。
//
// 静态闸门只能查「绑没绑 :retry」，查不出「点完没反应」或「绑到了别人那一发」：
// 这里真的打开页面、真的把列表那一口打断，看错误面是否出现、重试是否把数据读回来。
//
// 三种模式：断网（abort）/ 500 / 403。每一例的失败输出都带「哪一页、哪种模式、哪一步」，
// 夜间任务红灯时直接照着这三段定位，不用再猜。
//
// 依赖本机（或 CI）有跑着的前后端与一个超管账号。缺环境时默认跳过（可选任务），
// 只有 E2E_REQUIRED=1 时才把「跳过」当成失败——夜间任务把这一支打开，白天本机跑不受影响。
//
// 离线 mock 模式（--mock 或 E2E_MOCK=1）：不依赖 8080 后端，脚本在浏览器层把 /api/**
// 全部用桩应答（登录、当前用户、五页读口各给一行）。断言的仍是「错误面出现、点重试、
// 数据回来」这条 UI 链路，只是数据来自桩——常态化跑矩阵不再要求起后端与数据库。

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = (process.env.E2E_BASE_URL || 'http://localhost:5190').replace(/\/$/, '')
const USERNAME = process.env.E2E_USERNAME || 'admin'
const PASSWORD = process.env.E2E_PASSWORD || 'admin123'
const REQUIRED = process.env.E2E_REQUIRED === '1'
const REPORT_DIR = process.env.E2E_REPORT_DIR || 'e2e-out'
const CASE_TIMEOUT_MS = Number(process.env.E2E_CASE_TIMEOUT_MS || 45000)
/** 离线 mock：/api/** 由脚本桩应答，只要前端 5190 活着就能跑（SPEC-UI-10 G-8） */
const MOCK = process.argv.includes('--mock') || process.env.E2E_MOCK === '1'

/** 五页各选「一进页面就会读」的那一口；重试按钮必须能把这口读回来 */
const PAGES = [
  { name: '参考站摄取', path: '/workspace/portal/reference-sites', api: '/api/portal/reference-sites' },
  { name: '审计日志', path: '/workspace/audit-log', api: '/api/admin/audit-logs' },
  { name: '订单管理', path: '/workspace/billing/orders', api: '/api/billing/orders' },
  { name: '账单管理', path: '/workspace/billing/manage', api: '/api/billing/invoices' },
  { name: '权限管理', path: '/workspace/permissions', api: '/api/admin/permissions/tree' }
]

const MODES = [
  { name: '断网', kind: 'abort' },
  { name: '500', kind: '500' },
  { name: '403', kind: '403' }
]

const ERROR_BLOCK = '.admin-state-block[data-state="error"]'
const STALE_ALERT = '.admin-data-table__stale'

function fulfillBody(kind) {
  if (kind === '500') return { code: 500, message: '回归注入：服务端故障' }
  return { code: 403, message: '没有权限执行该操作' }
}

/** mock 模式的统一用户：超管角色放行 requiresSuperAdmin 路由，租户 1 号进分母 */
const MOCK_USER = {
  userId: 1,
  username: 'admin',
  nickname: '重试矩阵管理员',
  tenantId: 1,
  tenantCode: 'demo',
  roles: ['SUPER_ADMIN'],
  permissions: []
}

/** 通用一行：字段宁多勿缺，列表页拿去渲染不挑食 */
const MOCK_ROW = {
  id: 1,
  name: '重试矩阵样例',
  title: '重试矩阵样例',
  nickname: '重试矩阵样例',
  username: 'admin',
  status: 'ENABLED',
  enabled: true,
  amount: 100,
  orderNo: 'MOCK-0001',
  paymentMethod: 'WECHAT',
  createdAt: '2026-01-01 00:00:00'
}

/** 确认走分页形状的列表口（其余 GET 一律回空数组：选项/字典类接口拿分页对象会渲染崩；
 * 注意参考站 list 口回的是纯数组，给分页对象反而崩进错误边界） */
const PAGED_APIS = ['/api/admin/audit-logs', '/api/billing/orders', '/api/billing/invoices']

/** mock 读口应答：确认分页的口给一行，其余一律空数组（页面落到空态也算恢复） */
function mockApiBody(url, method) {
  const path = new URL(url, BASE).pathname
  if (path.endsWith('/api/auth/login')) {
    return { code: 0, data: { token: 'mock-token', ...MOCK_USER } }
  }
  if (path.endsWith('/api/auth/me')) {
    return { code: 0, data: { id: 1, avatar: '', email: '', phone: '', status: 'enabled', ...MOCK_USER } }
  }
  if (path.endsWith('/api/admin/tenants')) {
    return { code: 0, data: [{ id: 1, name: '样例客户', code: 'demo' }] }
  }
  if (path.endsWith('/api/admin/permissions/tree')) {
    return { code: 0, data: [{ id: 1, name: '根权限', title: '根权限', children: [] }] }
  }
  if (method.toUpperCase() === 'GET') {
    if (PAGED_APIS.some((api) => path.endsWith(api))) {
      return { code: 0, data: { records: [MOCK_ROW], total: 1 } }
    }
    return { code: 0, data: [] }
  }
  return { code: 0, data: null }
}

/** 在 context 层挂桩：page.route 的失败注入优先级更高，互不干扰。
 *  正则锚定「/api/ 在 pathname 开头」——不能用双星号 glob 匹配 api 路径，
 *  否则 vite 的源码模块 /src/api/http.ts 也会被 JSON 应答顶掉，整个应用起不来。 */
async function installMockApi(context) {
  await context.route(/^https?:\/\/[^/]+\/api\//, (route) => {
    const request = route.request()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockApiBody(request.url(), request.method()))
    })
  })
}

async function routeHandler(kind) {
  if (kind === 'abort') return (route) => route.abort('failed')
  return (route) =>
    route.fulfill({
      status: kind === '500' ? 500 : 403,
      contentType: 'application/json',
      body: JSON.stringify(fulfillBody(kind))
    })
}

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    return await import('@playwright/test')
  }
}

async function launchBrowser(chromium) {
  // 本机只用真实 Chrome（Playwright 自带浏览器不一定装过）；CI 里装了 chromium 就退回去
  const channel = process.env.E2E_CHANNEL
  if (channel !== 'none') {
    try {
      return await chromium.launch({ channel: channel || 'chrome' })
    } catch {
      if (channel) throw new Error(`指定的浏览器通道 ${channel} 起不来`)
    }
  }
  return chromium.launch()
}

async function probe() {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(5000) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('用户名').fill(USERNAME)
  await page.getByPlaceholder('密码').fill(PASSWORD)
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForFunction(() => !!localStorage.getItem('access_token'), { timeout: 20000 })
  // 超管要在「哪一家客户」下看数据，否则多数列表读口会按空的客户号拒绝
  const tenantId = await page.evaluate(async () => {
    const token = localStorage.getItem('access_token')
    const res = await fetch('/api/admin/tenants', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    const body = await res.json()
    const list = Array.isArray(body) ? body : body?.data || body?.records || []
    return list.length ? list[0].id : null
  })
  if (tenantId != null) {
    await page.evaluate((id) => localStorage.setItem('selected_tenant_id', String(id)), tenantId)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitUntilHidden(locator, timeout) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if ((await locator.count()) === 0) return true
    await sleep(250)
  }
  return false
}

/** 恢复判据：错误面退场，且屏幕上真的有东西（行或空态） */
async function recovered(page, timeout) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const errorVisible = (await page.locator(`${ERROR_BLOCK}:visible`).count()) > 0
    const staleVisible = (await page.locator(`${STALE_ALERT}:visible`).count()) > 0
    if (!errorVisible && !staleVisible) {
      const rows = await page.locator('tbody tr').count()
      const empty =
        (await page.locator('.admin-state-block[data-state="empty"]:visible').count()) > 0 ||
        (await page.locator('.ant-empty:visible').count()) > 0
      if (rows > 0 || empty) return { ok: true, rows }
    }
    await sleep(250)
  }
  return { ok: false, rows: await page.locator('tbody tr').count() }
}

/**
 * 机器人两例（SPEC-UI-11 §17.3）：首次进入说一次；本页静音后刷新不再说。
 * 待办页有 A 类页面卡（P5 迁入），进页就会开口，且不需要额外权限码。
 */
const ROBOT_BUBBLE = '[data-testid="robot-bubble"]'
const ROBOT_PAGE_PATH = '/workspace/notifications'

async function openRobotPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  if (MOCK) await installMockApi(context)
  await login(page)
  await page.goto(`${BASE}${ROBOT_PAGE_PATH}`, { waitUntil: 'domcontentloaded' })
  return { context, page }
}

async function runRobotFirstVisit(browser) {
  const started = Date.now()
  const step = { name: '进入待办页' }
  const session = await openRobotPage(browser)
  try {
    step.name = '等机器人开口'
    const bubble = session.page.locator(ROBOT_BUBBLE)
    await bubble.waitFor({ state: 'visible', timeout: 20000 })
    if (!(await bubble.innerText()).trim()) throw new Error('气泡出现但没有文案')
    return { status: 'PASS', ms: Date.now() - started, step: step.name }
  } catch (error) {
    return { status: 'FAIL', ms: Date.now() - started, step: step.name, error: String(error?.message || error).split('\n')[0] }
  } finally {
    await session.context.close().catch(() => {})
  }
}

async function runRobotMutePage(browser) {
  const started = Date.now()
  const step = { name: '进入待办页' }
  const session = await openRobotPage(browser)
  try {
    step.name = '等机器人开口'
    const bubble = session.page.locator(ROBOT_BUBBLE)
    await bubble.waitFor({ state: 'visible', timeout: 20000 })

    step.name = '点「本页不再提示」'
    await session.page.getByRole('button', { name: '本页不再提示' }).click()
    await bubble.waitFor({ state: 'detached', timeout: 5000 })

    step.name = '刷新后不再说'
    await session.page.reload({ waitUntil: 'domcontentloaded' })
    await sleep(4000)
    if ((await session.page.locator(`${ROBOT_BUBBLE}:visible`).count()) > 0) {
      throw new Error('本页已静音，刷新后仍开口')
    }
    return { status: 'PASS', ms: Date.now() - started, step: step.name }
  } catch (error) {
    return { status: 'FAIL', ms: Date.now() - started, step: step.name, error: String(error?.message || error).split('\n')[0] }
  } finally {
    await session.context.close().catch(() => {})
  }
}

const ROBOT_CASES = [
  { name: '机器人 / 首次进入说一次', run: runRobotFirstVisit },
  { name: '机器人 / 本页静音后不再说', run: runRobotMutePage }
]

async function runCase(browser, pageConfig, mode) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const step = { name: '打开页面' }
  const started = Date.now()
  try {
    if (MOCK) await installMockApi(context)
    await login(page)
    await page.goto(`${BASE}${pageConfig.path}`, { waitUntil: 'domcontentloaded' })
    // 页面壳渲染完：表格 / 空态 / 错误面任意一个出现就算进来了
    await page.waitForSelector(`tbody, .admin-state-block, .ant-empty`, { timeout: 20000 })

    step.name = '注入失败'
    const pattern = `**${pageConfig.api}**`
    await page.route(pattern, await routeHandler(mode.kind))
    await page.reload({ waitUntil: 'domcontentloaded' })

    step.name = '看见读失败面与重试'
    // antd 会在两个字之间插空格（「重 试」），所以按正则认；取最后一块，
    // 页顶若有统计格自己的读失败提示，列表这一块的错误面在它下面
    const retry = page
      .locator(`${ERROR_BLOCK}:visible`)
      .last()
      .getByRole('button', { name: /重\s*试/ })
    await retry.waitFor({ state: 'visible', timeout: 20000 })

    step.name = '点重试（先撤掉注入）'
    await page.unroute(pattern)
    await retry.click()

    step.name = '恢复'
    const result = await recovered(page, 20000)
    if (!result.ok) {
      throw new Error(`点重试后 20 秒内没恢复（错误面仍在或屏幕上既没有行也没有空态；当前行数 ${result.rows}）`)
    }
    return { status: 'PASS', ms: Date.now() - started, step: step.name }
  } catch (error) {
    return { status: 'FAIL', ms: Date.now() - started, step: step.name, error: String(error?.message || error).split('\n')[0] }
  } finally {
    await context.close().catch(() => {})
  }
}

async function main() {
  if (MOCK) console.log('离线 mock 模式：/api/** 由脚本内桩应答，不依赖 8080 后端')
  if (!(await probe())) {
    const line = `SKIP 前端 ${BASE} 没有响应：真测矩阵要本机（或 CI）跑着前后端与服务账号，环境缺了就跳过`
    console.log(line)
    if (REQUIRED) {
      console.error('E2E_REQUIRED=1：环境缺失按失败处理')
      process.exit(1)
    }
    return
  }

  const { chromium } = await loadPlaywright()
  const browser = await launchBrowser(chromium)
  const results = []

  try {
    for (const pageConfig of PAGES) {
      for (const mode of MODES) {
        const result = await withTimeout(runCase(browser, pageConfig, mode), CASE_TIMEOUT_MS)
        const caseName = `${pageConfig.name} / ${mode.name}`
        if (result.status === 'PASS') {
          console.log(`PASS ${caseName}（${(result.ms / 1000).toFixed(1)}s）`)
        } else {
          console.error(`FAIL ${caseName} :: 步骤「${result.step}」:: ${result.error}`)
        }
        results.push({ page: pageConfig.name, mode: mode.name, ...result })
      }
    }

    for (const robotCase of ROBOT_CASES) {
      const result = await withTimeout(robotCase.run(browser), CASE_TIMEOUT_MS)
      if (result.status === 'PASS') {
        console.log(`PASS ${robotCase.name}（${(result.ms / 1000).toFixed(1)}s）`)
      } else {
        console.error(`FAIL ${robotCase.name} :: 步骤「${result.step}」:: ${result.error}`)
      }
      results.push({ page: '机器人', mode: robotCase.name, ...result })
    }
  } finally {
    await browser.close().catch(() => {})
  }

  const failed = results.filter((item) => item.status !== 'PASS')
  mkdirSync(REPORT_DIR, { recursive: true })
  const reportPath = join(REPORT_DIR, 'retry-matrix.json')
  writeFileSync(
    reportPath,
    JSON.stringify({ base: BASE, mock: MOCK, startedAt: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2)
  )
  console.log(`报告：${reportPath}`)

  if (failed.length) {
    console.error(`重试矩阵有 ${failed.length}/${results.length} 例没通过，按上面的「页 / 模式 / 步骤」定位`)
    process.exit(1)
  }
  console.log(`重试矩阵全部通过：${results.length} 例（5 页 × 断网 / 500 / 403 + 2 例机器人）`)
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) =>
      setTimeout(() => resolve({ status: 'FAIL', ms, step: '超时', error: `单例超过 ${ms}ms 未结束` }), ms)
    )
  ])
}

main().catch((error) => {
  console.error(`重试矩阵没跑起来：${error?.message || error}`)
  if (REQUIRED) process.exit(1)
})
