import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount, VueWrapper } from '@vue/test-utils'
import MediaStorageView from '../MediaStorageView.vue'
import { mediaStorageApi } from '../../../api/mediaStorage'
import { router } from '../../../router'

/**
 * 超管「素材存储」这一屏（任务 #30 状态与搬迁、#32 可配的存储参数）。
 *
 * 这一页的风险和待办页同一类：把「我不知道」说成「没事」，以及把「没测过」说成「测过了」。
 * 状态没取到却渲染出一张 pendingRows=0 的表，超管读到的是「全站素材都在 OSS 了」，
 * 而真实情况可能是后端刚重启、OSS 配置压根没生效。所以钉这几件：
 * 1. 取不到状态 → 整块账目不出现，出现的是后端那句错，且「搬一批」点不动；
 * 2. 「已经搬完」只跟后端 drained 走，不由界面比数字猜；
 * 3. 一次搬迁的结果九个格子全按后端返回渲染，含「本地文件一个都没删」；
 * 4. 配置读不到时整张表单不出现、三颗按钮点不动——看不见库里那份就让人保存，
 *    等于让一张空表单把别人的参数清掉；
 * 5. 写入目标选成 OSS 必须「后端记过一次通过 + 框里还是那组参数」，两者缺一就保存不了；
 * 6. 路由真的挂着且只认超管（问题八的裁决：进不去的界面等于没有界面）。
 */

vi.mock('../../../api/mediaStorage', () => ({
  mediaStorageApi: {
    status: vi.fn(),
    migrateToOss: vi.fn(),
    config: vi.fn(),
    saveConfig: vi.fn(),
    testConfig: vi.fn()
  },
  MIGRATE_TIMEOUT: 600000,
  TEST_TIMEOUT: 60000
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['message', 'description', 'title', 'label', 'type', 'showIcon', 'column', 'bordered', 'size', 'span'],
  template: `<div class="${name}-stub"><span class="${name}-stub__message">{{ message || title || label }}</span><slot /></div>`
})

const BUTTON_STUB = {
  name: 'AButton',
  props: ['disabled', 'loading', 'type'],
  template: '<button class="btn-stub" :disabled="disabled"><slot /></button>'
}

const INPUT_STUB = {
  name: 'AInput',
  props: ['value', 'disabled'],
  emits: ['update:value'],
  template: '<input class="input-stub" :value="value" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" />'
}

/** 密钥那一栏用另一个类名，免得和「只搬这个租户」那格串味 */
const PASSWORD_STUB = {
  name: 'AInputPassword',
  props: ['value', 'disabled'],
  emits: ['update:value'],
  template: '<input class="password-stub" type="password" :value="value" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" />'
}

const SELECT_STUB = {
  name: 'ASelect',
  props: ['disabled'],
  emits: ['update:value'],
  template: `<select class="select-stub" :disabled="disabled"
             @change="$emit('update:value', $event.target.value)"><slot /></select>`
}

const SELECT_OPTION_STUB = {
  name: 'ASelectOption',
  props: ['value'],
  template: '<option :value="value"><slot /></option>'
}

const NUMBER_INPUT_STUB = {
  name: 'AInputNumber',
  props: ['value'],
  emits: ['update:value'],
  template: '<input class="number-stub" :value="value" @input="$emit(\'update:value\', Number($event.target.value))" />'
}

/** 真实的 Popconfirm 要点两下（按钮 → 弹层里确认）；这里把这一步摊平成一个「确认」按钮，仍然只跑 @confirm */
const POPCONFIRM_STUB = {
  name: 'APopconfirm',
  props: ['disabled', 'title', 'okText', 'cancelText'],
  emits: ['confirm'],
  template: `<div class="popconfirm-stub">
    <span class="popconfirm-stub__title">{{ title }}</span>
    <slot name="description" /><slot />
    <button class="confirm-stub" @click="$emit('confirm')">{{ okText }}</button>
  </div>`
}

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] }
  },
  template: `
    <div class="table-stub">
      <div v-for="(row, index) in dataSource" :key="index" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot name="bodyCell" :column="column" :record="row" :text="row" />
        </template>
      </div>
    </div>`
}

/** 真 ACard 的 #extra 里放着头部右侧那三颗按钮，桩件必须把这个槽位渲出来，否则测试连按钮都找不到 */
const CARD_STUB = {
  name: 'ACard',
  props: ['title', 'size'],
  template: `<div class="card-stub">
    <span class="card-stub__title">{{ title }}</span><slot name="title" />
    <slot name="extra" /><slot />
  </div>`
}

const ROW_COL_STUB = (name: string) => ({ name, template: `<div class="${name}-stub"><slot /></div>` })

function state(overrides: Record<string, unknown> = {}) {
  return {
    activeStorage: 'oss',
    availableStorages: ['local', 'oss'],
    totalRows: 66,
    pendingRows: 66,
    retainedLocalRows: 0,
    configSource: 'database',
    note: null,
    usable: true,
    drained: false,
    ...overrides
  }
}

/** 库里那份配置（密钥永远是掩码）。默认：四个参数齐、刚测通、参数就是这一组 */
function config(overrides: Record<string, unknown> = {}) {
  return {
    configured: true,
    storage: 'local',
    endpoint: 'oss-cn-hangzhou.aliyuncs.com',
    bucket: 'aiwebsites',
    accessKeyId: 'LTAI****EDB',
    accessKeySecret: '已保存（不显示）',
    publicBaseUrl: '',
    keyPrefix: '',
    privatePrefix: '',
    lastTestStatus: 'ok',
    lastTestMessage: '写入、读回、删除三段都通了：桶 aiwebsites（耗时 412 ms）',
    lastTestedAt: '2026-09-26T03:00:00',
    lastTestMatchesCurrent: true,
    updatedBy: 'admin',
    updatedAt: '2026-09-26T03:00:00',
    ...overrides
  }
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    targetStorage: 'oss',
    scanned: 66,
    migrated: 60,
    skippedAlreadyOnTarget: 4,
    missingSource: 2,
    failed: 0,
    bytesMoved: 12345678,
    errors: [],
    clean: true,
    localFilesDeleted: false,
    ...overrides
  }
}

interface Options {
  status?: ReturnType<typeof state>
  statusError?: string
  run?: ReturnType<typeof report>
  runError?: string
  cfg?: ReturnType<typeof config>
  configError?: string
  test?: Record<string, unknown>
  testError?: string
  saved?: Record<string, unknown>
  saveError?: string
}

async function mountView(options: Options = {}): Promise<VueWrapper> {
  if (options.statusError) {
    vi.mocked(mediaStorageApi.status).mockRejectedValue(new Error(options.statusError))
  } else {
    vi.mocked(mediaStorageApi.status).mockResolvedValue((options.status ?? state()) as any)
  }
  if (options.configError) {
    vi.mocked(mediaStorageApi.config).mockRejectedValue(new Error(options.configError))
  } else {
    vi.mocked(mediaStorageApi.config).mockResolvedValue((options.cfg ?? config()) as any)
  }
  if (options.runError) {
    vi.mocked(mediaStorageApi.migrateToOss).mockRejectedValue(new Error(options.runError))
  } else {
    vi.mocked(mediaStorageApi.migrateToOss).mockResolvedValue((options.run ?? report()) as any)
  }
  if (options.testError) {
    vi.mocked(mediaStorageApi.testConfig).mockRejectedValue(new Error(options.testError))
  } else {
    vi.mocked(mediaStorageApi.testConfig).mockResolvedValue((options.test ??
      { success: true, status: 'ok', message: '写入、读回、删除三段都通了', elapsedMs: 412, bucket: 'aiwebsites', endpoint: 'oss-cn-hangzhou.aliyuncs.com' }) as any)
  }
  if (options.saveError) {
    vi.mocked(mediaStorageApi.saveConfig).mockRejectedValue(new Error(options.saveError))
  } else {
    vi.mocked(mediaStorageApi.saveConfig).mockResolvedValue((options.saved ?? config({ storage: 'oss' })) as any)
  }

  const wrapper = mount(MediaStorageView, {
    global: {
      stubs: {
        'a-alert': PASS_THROUGH('a-alert'),
        'a-card': CARD_STUB,
        'a-descriptions': PASS_THROUGH('a-descriptions'),
        'a-descriptions-item': PASS_THROUGH('a-descriptions-item'),
        'a-form': PASS_THROUGH('a-form'),
        'a-form-item': PASS_THROUGH('a-form-item'),
        'a-row': ROW_COL_STUB('a-row'),
        'a-col': ROW_COL_STUB('a-col'),
        'a-space': PASS_THROUGH('a-space'),
        'a-popconfirm': POPCONFIRM_STUB,
        'a-button': BUTTON_STUB,
        'a-input': INPUT_STUB,
        'a-input-password': PASSWORD_STUB,
        'a-select': SELECT_STUB,
        'a-select-option': SELECT_OPTION_STUB,
        'a-input-number': NUMBER_INPUT_STUB,
        'a-table': TABLE_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

function button(wrapper: VueWrapper, selector: string) {
  return wrapper.find(`${selector}.btn-stub`)
}

function isDisabled(wrapper: VueWrapper, selector: string) {
  return button(wrapper, selector).attributes('disabled') !== undefined
}

/** 页面上有两处确认（保存配置、搬一批），必须按各自 popconfirm 的类找到那一颗 */
async function confirmIn(wrapper: VueWrapper, popSelector: string) {
  await wrapper.find(`${popSelector} .confirm-stub`).trigger('click')
  await flushPromises()
}

async function confirmMigrate(wrapper: VueWrapper) {
  await confirmIn(wrapper, '.js-migrate-pop')
}

function field(wrapper: VueWrapper, selector: string) {
  return wrapper.find(`${selector}.input-stub, ${selector}.password-stub, ${selector}.select-stub, ${selector}.number-stub`)
}

describe('MediaStorageView · 状态与搬迁', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('状态取不到时不说「已搬完」，也点不动搬迁', async () => {
    const wrapper = await mountView({ statusError: '无法连接服务器，请确认后端已启动' })

    expect(wrapper.text()).not.toContain('已经搬完')
    expect(wrapper.text()).toContain('无法连接服务器')
    expect(wrapper.findAll('.a-descriptions-stub')).toHaveLength(0)
    expect(isDisabled(wrapper, '.js-migrate')).toBe(true)
    expect(mediaStorageApi.migrateToOss).not.toHaveBeenCalled()
  })

  it('还差多少行是后端给的数，一个字都不自己算', async () => {
    const wrapper = await mountView({ status: state({ pendingRows: 66, totalRows: 66 }) })

    expect(wrapper.text()).toContain('66')
    expect(wrapper.text()).not.toContain('已经搬完')
    expect(isDisabled(wrapper, '.js-migrate')).toBe(false)
  })

  it('「已经搬完」只跟后端 drained 走', async () => {
    const wrapper = await mountView({ status: state({ pendingRows: 0, drained: true }) })

    expect(wrapper.text()).toContain('已经搬完')
    // 没东西可搬时不给一颗点了只会拿到后端拒绝的按钮
    expect(isDisabled(wrapper, '.js-migrate')).toBe(true)
  })

  it('只配了一种存储时说清楚「无处可搬」，而不是让人点一次看报错', async () => {
    const wrapper = await mountView({ status: state({ activeStorage: 'local', availableStorages: ['local'] }) })

    expect(wrapper.text()).toContain('没有可搬去的地方')
    expect(isDisabled(wrapper, '.js-migrate')).toBe(true)
  })

  it('后端说选定后端不可用时，用那句原话禁用搬迁，不自己编原因', async () => {
    const wrapper = await mountView({
      status: state({ usable: false, note: '写入目标选的是 OSS，但这几项还是空的：AccessKey Secret' })
    })

    expect(wrapper.text()).toContain('写入目标选的是 OSS，但这几项还是空的：AccessKey Secret')
    expect(isDisabled(wrapper, '.js-migrate')).toBe(true)
  })

  it('配置从哪来是后端说的，界面上要能看见（两处都能配就必须说谁生效）', async () => {
    const wrapper = await mountView({ status: state({ configSource: 'env' }) })

    expect(wrapper.text()).toContain('YAML / 环境变量')
  })

  it('租户号填了一半（非正整数）时不让跑：半截输入不能变成「搬全平台」', async () => {
    const wrapper = await mountView()
    await field(wrapper, '.js-tenant').setValue('abc')

    expect(isDisabled(wrapper, '.js-migrate')).toBe(true)
  })

  it('确认之后才发请求，带上填的租户与批次，跑完重新拉状态', async () => {
    const wrapper = await mountView()
    await field(wrapper, '.js-tenant').setValue('15')

    // 光渲染出这一屏不会动任何东西：这屏唯一会改数据的是那一次确认
    expect(mediaStorageApi.migrateToOss).not.toHaveBeenCalled()

    await confirmMigrate(wrapper)

    expect(mediaStorageApi.migrateToOss).toHaveBeenCalledWith({ tenantId: 15, limit: 500 })
    // 第一次是挂载时拉的，这一次是搬完复核
    expect(mediaStorageApi.status).toHaveBeenCalledTimes(2)
  })

  it('确认框上说的是这次要动多少行、往哪儿去', async () => {
    const wrapper = await mountView()
    await field(wrapper, '.js-tenant').setValue('15')

    expect(wrapper.find('.js-migrate-pop .popconfirm-stub__title').text()).toContain('租户 15')
    expect(wrapper.find('.js-migrate-pop .popconfirm-stub__title').text()).toContain('500')
  })

  it('结果账目原样呈现，并明说本地文件一个都没删', async () => {
    const wrapper = await mountView({ run: report({ bytesMoved: 12345678 }) })
    await confirmMigrate(wrapper)

    const text = wrapper.text()
    expect(text).toContain('12345678')
    expect(text).toContain('一个都没删')
    expect(text).not.toContain('已清理本地')
  })

  it('失败的每一条为什么，按后端给的明细列出来', async () => {
    const wrapper = await mountView({
      run: report({ migrated: 1, failed: 2, clean: false, errors: ['46: 源文件不在磁盘上', '47: AccessDenied'] })
    })
    await confirmMigrate(wrapper)

    const rows = wrapper.findAll('.table-stub .row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('46: 源文件不在磁盘上')
    expect(wrapper.text()).toContain('有失败，见下面明细')
  })

  it('搬迁失败时说的是后端那句，不是一次成功的账', async () => {
    const wrapper = await mountView({ runError: '当前素材存储后端是 local，没有可搬去的第二个存储' })
    await confirmMigrate(wrapper)

    expect(wrapper.text()).toContain('没有可搬去的第二个存储')
    // 只有状态那一块账目，没有结果那一块
    expect(wrapper.findAll('.a-descriptions-stub')).toHaveLength(1)
  })

  it('批次默认 500 行，且改多少就发多少', async () => {
    const wrapper = await mountView()
    await field(wrapper, '.js-limit').setValue('20')
    await confirmMigrate(wrapper)

    expect(mediaStorageApi.migrateToOss).toHaveBeenCalledWith({ tenantId: null, limit: 20 })
  })
})

describe('MediaStorageView · 存储配置（问题六：OSS 参数存进库、界面上能改）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('配置读不到时整张表单不出现，三颗按钮都点不动', async () => {
    const wrapper = await mountView({ configError: '权限不足，只有超级管理员可以访问该功能' })

    expect(wrapper.text()).toContain('权限不足')
    // 空表单 PUT 出去 = 把库里那份真配置清成空值，所以宁可一颗按钮都给不了
    expect(field(wrapper, '.js-field-endpoint').exists()).toBe(false)
    expect(isDisabled(wrapper, '.js-test')).toBe(true)
    expect(isDisabled(wrapper, '.js-save')).toBe(true)
    expect(mediaStorageApi.saveConfig).not.toHaveBeenCalled()
    expect(mediaStorageApi.testConfig).not.toHaveBeenCalled()
  })

  it('库里的值回填进表单，密钥回的是掩码：原样发回去就代表「这一项不改」', async () => {
    const wrapper = await mountView()

    expect((field(wrapper, '.js-field-endpoint').element as HTMLInputElement).value).toBe('oss-cn-hangzhou.aliyuncs.com')
    expect((field(wrapper, '.js-field-ak').element as HTMLInputElement).value).toBe('LTAI****EDB')

    await confirmIn(wrapper, '.js-save-pop')

    const sent = vi.mocked(mediaStorageApi.saveConfig).mock.calls[0][0]
    expect(sent?.accessKeyId).toBe('LTAI****EDB')
    expect(sent?.accessKeySecret).toBe('已保存（不显示）')
    // 界面上没让人重新键一遍桶，就不该把它变成空
    expect(sent?.bucket).toBe('aiwebsites')
  })

  it('测连接测的是框里这一组（还没保存也算），测完重新读一遍配置', async () => {
    const wrapper = await mountView()
    await field(wrapper, '.js-field-bucket').setValue('other-bucket')
    await wrapper.find('.js-test.btn-stub').trigger('click')
    await flushPromises()

    const sent = vi.mocked(mediaStorageApi.testConfig).mock.calls[0][0]
    expect(sent?.bucket).toBe('other-bucket')
    // 挂载读过一次，测完再读一次：掩码与「上次测试」都是后端记的
    expect(mediaStorageApi.config).toHaveBeenCalledTimes(2)
  })

  it('四项连接参数缺一项就不给测（缺项在后端算「这次测试没发生」）', async () => {
    const wrapper = await mountView()
    await field(wrapper, '.js-field-endpoint').setValue('')

    expect(isDisabled(wrapper, '.js-test')).toBe(true)
    expect(mediaStorageApi.testConfig).not.toHaveBeenCalled()
  })

  it('库里参数后来被改过时说「那次通过不再算数」，并且存不下去', async () => {
    const wrapper = await mountView({ cfg: config({ lastTestStatus: 'ok', lastTestMatchesCurrent: false }) })

    await field(wrapper, '.js-field-storage').setValue('oss')
    expect(wrapper.text()).toContain('那次通过不再算数')
    expect(isDisabled(wrapper, '.js-save')).toBe(true)
  })

  it('框里参数与测过的那组不一样时要求重测，别把没验证过的桶设成全站落点', async () => {
    const wrapper = await mountView()
    await field(wrapper, '.js-field-bucket').setValue('typo-bucket')
    await field(wrapper, '.js-field-storage').setValue('oss')

    expect(wrapper.text()).toContain('请重新测一次')
    expect(isDisabled(wrapper, '.js-save')).toBe(true)
    expect(mediaStorageApi.saveConfig).not.toHaveBeenCalled()
  })

  it('写入目标只改 storage、连接参数没动，那次通过仍然算数（指纹里本来就不含 storage）', async () => {
    const wrapper = await mountView()
    await field(wrapper, '.js-field-storage').setValue('oss')

    expect(isDisabled(wrapper, '.js-save')).toBe(false)
  })

  it('从没测过时说的是「还没测过」，不是「测过了」', async () => {
    const wrapper = await mountView({
      cfg: config({ lastTestStatus: null, lastTestMessage: null, lastTestedAt: null, lastTestMatchesCurrent: false })
    })

    expect(wrapper.text()).toContain('这组参数还没测过')
    expect(wrapper.text()).not.toContain('上次测试通过')
  })

  it('存成 OSS 之后立刻复核状态：写入目标变了，「还差多少行」也跟着变', async () => {
    const wrapper = await mountView()
    await field(wrapper, '.js-field-storage').setValue('oss')
    await confirmIn(wrapper, '.js-save-pop')

    expect(mediaStorageApi.saveConfig).toHaveBeenCalledTimes(1)
    expect(mediaStorageApi.status).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('新素材从现在起写往 OSS')
    // 已搬走的行不在这次保存的范围里，界面不许替它说「都迁好了」
    expect(wrapper.text()).not.toContain('全部素材已迁移完成')
  })

  it('保存被后端拒了就说后端那句，不假装已经存上', async () => {
    const wrapper = await mountView({ saveError: '这组 OSS 参数还没通过连通性测试，不能直接设为全站写入目标' })
    await field(wrapper, '.js-field-storage').setValue('oss')
    await confirmIn(wrapper, '.js-save-pop')

    expect(wrapper.text()).toContain('还没通过连通性测试')
    expect(wrapper.text()).not.toContain('已保存，新素材从现在起写往 OSS')
  })

  it('测试失败时把后端原因显示出来，且不出现一次成功的账', async () => {
    const wrapper = await mountView({ testError: 'OSS 返回 403 AccessDenied：桶 aiwebsites 不属于这把 AccessKey' })
    await wrapper.find('.js-test.btn-stub').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('AccessDenied')
    expect(wrapper.text()).not.toContain('三段都通了')
  })

  it('光是进这一屏不会改任何东西：保存与测试都得等人点', async () => {
    await mountView()

    expect(mediaStorageApi.saveConfig).not.toHaveBeenCalled()
    expect(mediaStorageApi.testConfig).not.toHaveBeenCalled()
    expect(mediaStorageApi.migrateToOss).not.toHaveBeenCalled()
  })
})

describe('素材存储入口挂在路由上（问题八）', () => {
  const matched = router.getRoutes().filter(route => route.name === 'workspace-media-storage')

  it('有且只有一条：路径就是菜单 key，进不去的界面等于没有界面', () => {
    expect(matched).toHaveLength(1)
    expect(matched[0].path).toBe('/workspace/media-storage')
  })

  it('超管口：少了 requiresSuperAdmin 就等于把改所有租户 media 行的按钮交给租户', () => {
    expect(matched[0].meta.requiresSuperAdmin).toBe(true)
    // 这一族端点只认超管身份，库里没有「素材迁移」这种权限码，界面也不许自己编一个
    expect(matched[0].meta.requiredPermission).toBeUndefined()
  })

  it('租户侧那个图片库入口没有被顺手改成超管口（两码事：一个看素材，一个搬存储）', () => {
    const library = router.getRoutes().find(route => route.name === 'workspace-media-library')
    expect(library?.meta.requiresSuperAdmin).toBeUndefined()
    expect(library?.meta.requiredPermission).toBe('media:manage')
  })
})
