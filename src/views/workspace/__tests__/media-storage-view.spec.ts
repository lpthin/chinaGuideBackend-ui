import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount, VueWrapper } from '@vue/test-utils'
import MediaStorageView from '../MediaStorageView.vue'
import { mediaStorageApi } from '../../../api/mediaStorage'
import { router } from '../../../router'

/**
 * 超管「素材存储」这一屏（任务 #30，问题六 + 问题八）。
 *
 * 这一页的风险和待办页同一类：把「我不知道」说成「没事」。
 * 状态没取到却渲染出一张 pendingRows=0 的表，超管读到的是「全站素材都在 OSS 了」，
 * 而真实情况可能是后端刚重启、OSS 配置压根没生效。所以钉四件：
 * 1. 取不到状态 → 整块账目不出现，出现的是后端那句错，且「搬一批」点不动；
 * 2. 「已经搬完」只跟后端 drained 走，不由界面比数字猜；
 * 3. 一次搬迁的结果九个格子全按后端返回渲染，含「本地文件一个都没删」；
 * 4. 路由真的挂着且只认超管（问题八的裁决：进不去的界面等于没有界面）。
 */

vi.mock('../../../api/mediaStorage', () => ({
  mediaStorageApi: {
    status: vi.fn(),
    migrateToOss: vi.fn()
  },
  MIGRATE_TIMEOUT: 600000
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['message', 'description', 'title', 'label', 'type', 'showIcon', 'column', 'bordered', 'size'],
  template: `<div class="${name}-stub"><span class="${name}-stub__message">{{ message || title }}</span><slot /></div>`
})

const BUTTON_STUB = {
  name: 'AButton',
  props: ['disabled', 'loading', 'type'],
  template: '<button class="btn-stub" :disabled="disabled"><slot /></button>'
}

const INPUT_STUB = {
  name: 'AInput',
  props: ['value'],
  emits: ['update:value'],
  template: '<input class="input-stub" :value="value" @input="$emit(\'update:value\', $event.target.value)" />'
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
    <button class="confirm-stub" @click="$emit('confirm')">开始搬</button>
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

function state(overrides: Record<string, unknown> = {}) {
  return {
    activeStorage: 'oss',
    availableStorages: ['local', 'oss'],
    totalRows: 66,
    pendingRows: 66,
    retainedLocalRows: 0,
    drained: false,
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
}

async function mountView(options: Options = {}): Promise<VueWrapper> {
  if (options.statusError) {
    vi.mocked(mediaStorageApi.status).mockRejectedValue(new Error(options.statusError))
  } else {
    vi.mocked(mediaStorageApi.status).mockResolvedValue((options.status ?? state()) as any)
  }
  if (options.runError) {
    vi.mocked(mediaStorageApi.migrateToOss).mockRejectedValue(new Error(options.runError))
  } else {
    vi.mocked(mediaStorageApi.migrateToOss).mockResolvedValue((options.run ?? report()) as any)
  }

  const wrapper = mount(MediaStorageView, {
    global: {
      stubs: {
        'a-alert': PASS_THROUGH('a-alert'),
        'a-descriptions': PASS_THROUGH('a-descriptions'),
        'a-descriptions-item': PASS_THROUGH('a-descriptions-item'),
        'a-form': PASS_THROUGH('a-form'),
        'a-form-item': PASS_THROUGH('a-form-item'),
        'a-space': PASS_THROUGH('a-space'),
        'a-popconfirm': POPCONFIRM_STUB,
        'a-button': BUTTON_STUB,
        'a-input': INPUT_STUB,
        'a-input-number': NUMBER_INPUT_STUB,
        'a-table': TABLE_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 页面上第一颗按钮是「刷新状态」，第二颗才是「搬一批」 */
function migrateButton(wrapper: VueWrapper) {
  return wrapper.findAll('.btn-stub')[1]
}

function isDisabled(wrapper: VueWrapper) {
  return migrateButton(wrapper).attributes('disabled') !== undefined
}

async function confirmMigrate(wrapper: VueWrapper) {
  await wrapper.find('.confirm-stub').trigger('click')
  await flushPromises()
}

describe('MediaStorageView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('状态取不到时不说「已搬完」，也点不动搬迁', async () => {
    const wrapper = await mountView({ statusError: '无法连接服务器，请确认后端已启动' })

    expect(wrapper.text()).not.toContain('已经搬完')
    expect(wrapper.text()).toContain('无法连接服务器')
    expect(wrapper.findAll('.a-descriptions-stub')).toHaveLength(0)
    expect(isDisabled(wrapper)).toBe(true)
    expect(mediaStorageApi.migrateToOss).not.toHaveBeenCalled()
  })

  it('还差多少行是后端给的数，一个字都不自己算', async () => {
    const wrapper = await mountView({ status: state({ pendingRows: 66, totalRows: 66 }) })

    expect(wrapper.text()).toContain('66')
    expect(wrapper.text()).not.toContain('已经搬完')
    expect(isDisabled(wrapper)).toBe(false)
  })

  it('「已经搬完」只跟后端 drained 走', async () => {
    const wrapper = await mountView({ status: state({ pendingRows: 0, drained: true }) })

    expect(wrapper.text()).toContain('已经搬完')
    // 没东西可搬时不给一颗点了只会拿到后端拒绝的按钮
    expect(isDisabled(wrapper)).toBe(true)
  })

  it('只配了一种存储时说清楚「无处可搬」，而不是让人点一次看报错', async () => {
    const wrapper = await mountView({ status: state({ activeStorage: 'local', availableStorages: ['local'] }) })

    expect(wrapper.text()).toContain('没有可搬去的地方')
    expect(isDisabled(wrapper)).toBe(true)
  })

  it('租户号填了一半（非正整数）时不让跑：半截输入不能变成「搬全平台」', async () => {
    const wrapper = await mountView()
    await wrapper.find('.input-stub').setValue('abc')

    expect(isDisabled(wrapper)).toBe(true)
  })

  it('确认之后才发请求，带上填的租户与批次，跑完重新拉状态', async () => {
    const wrapper = await mountView()
    await wrapper.find('.input-stub').setValue('15')

    // 光渲染出这一屏不会动任何东西：这屏唯一会改数据的是那一次确认
    expect(mediaStorageApi.migrateToOss).not.toHaveBeenCalled()

    await confirmMigrate(wrapper)

    expect(mediaStorageApi.migrateToOss).toHaveBeenCalledWith({ tenantId: 15, limit: 500 })
    // 第一次是挂载时拉的，这一次是搬完复核
    expect(mediaStorageApi.status).toHaveBeenCalledTimes(2)
  })

  it('确认框上说的是这次要动多少行、往哪儿去', async () => {
    const wrapper = await mountView()
    await wrapper.find('.input-stub').setValue('15')

    expect(wrapper.find('.popconfirm-stub__title').text()).toContain('租户 15')
    expect(wrapper.find('.popconfirm-stub__title').text()).toContain('500')
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
    const wrapper = await mountView({ runError: '当前 app.media.storage=local，没有可搬去的第二个存储' })
    await confirmMigrate(wrapper)

    expect(wrapper.text()).toContain('没有可搬去的第二个存储')
    // 只有状态那一块账目，没有结果那一块
    expect(wrapper.findAll('.a-descriptions-stub')).toHaveLength(1)
  })

  it('批次默认 500 行，且改多少就发多少', async () => {
    const wrapper = await mountView()
    await wrapper.find('.number-stub').setValue('20')
    await confirmMigrate(wrapper)

    expect(mediaStorageApi.migrateToOss).toHaveBeenCalledWith({ tenantId: null, limit: 20 })
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
