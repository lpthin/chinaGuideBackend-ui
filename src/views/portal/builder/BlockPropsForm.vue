<template>
  <div class="block-props-form">
    <a-alert
      v-if="!schema || !propertyNames.length"
      type="info"
      show-icon
      :message="schema ? '这个区块的内容全部来自门户数据绑定，没有可填写的字面内容。' : '区块元数据里没有可识别的 props 结构，只能查看不能编辑。'"
    />

    <div v-for="name in propertyNames" :key="name" class="block-props-form__row">
      <div class="block-props-form__label">
        <span>{{ name }}</span>
        <code v-if="hintOf(name)" class="block-props-form__hint">{{ hintOf(name) }}</code>
      </div>

      <!-- 字面值 / 数据绑定 二选一：区块的列表型槽位只允许绑定，
           把内容抄进 layout_json 就等于在页面里养第二份真相，内容改了页面不会跟着变 -->
      <template v-if="kindOf(name) === 'text'">
        <a-radio-group
          size="small"
          :value="modeOf(name)"
          @update:value="switchMode(name, $event)"
        >
          <a-radio-button value="literal">写字面内容</a-radio-button>
          <a-radio-button value="binding">绑定门户数据</a-radio-button>
        </a-radio-group>
        <a-textarea
          v-if="modeOf(name) === 'literal'"
          :value="literalOf(name) as string | undefined"
          :rows="2"
          :maxlength="maxLengthOf(name)"
          show-count
          @update:value="write(name, $event)"
        />
        <a-select
          v-else
          :value="bindingOf(name)"
          style="width: 100%"
          show-search
          allow-clear
          placeholder="选择门户数据字段"
          :options="sourceOptions"
          @update:value="writeBinding(name, $event)"
        />
      </template>

      <a-select
        v-else-if="kindOf(name) === 'binding'"
        :value="bindingOf(name)"
        style="width: 100%"
        show-search
        :options="sourceOptions"
        @update:value="writeBinding(name, $event)"
      />

      <a-select
        v-else-if="kindOf(name) === 'enum'"
        :value="literalOf(name)"
        style="width: 100%"
        :options="enumOptions(name)"
        @update:value="write(name, $event)"
      />

      <a-input-number
        v-else-if="kindOf(name) === 'integer'"
        :value="literalOf(name) as number | null"
        :min="minOf(name)"
        :max="maxOf(name)"
        style="width: 100%"
        @update:value="write(name, $event)"
      />

      <a-switch
        v-else-if="kindOf(name) === 'boolean'"
        :checked="literalOf(name) === true"
        @update:checked="write(name, $event)"
      />

      <a-input
        v-else
        disabled
        :value="JSON.stringify(model[name] ?? null)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 由区块 data_schema_json 生成的 props 表单。
 *
 * 为什么不在前端手写「hero 有哪些字段」的表单：区块白名单的唯一真相在后端代码里
 * （PortalBlockCatalogue → portal_block_def → /api/portal/blocks），
 * 前端再维护一份字段清单的话，加一个槽位就要改两处，漏改的那处会让保存直接报「未知的 props 键」。
 *
 * 认不出的 schema 一律退化成只读：宁可编辑不了，也不要在前端猜一套规则写出后端不认的结构。
 */
const props = defineProps<{
  schema: Record<string, unknown> | null
  model: Record<string, unknown>
  /** bindingSchema.allowedSources，与后端 DataSources 同源 */
  allowedSources: string[]
}>()

const emit = defineEmits<{ (e: 'update:model', value: Record<string, unknown>): void }>()

type SlotKind = 'text' | 'binding' | 'integer' | 'enum' | 'boolean' | 'unknown'

interface PropertySchema {
  oneOf?: unknown[]
  type?: string
  enum?: unknown[]
  minimum?: number
  maximum?: number
  maxLength?: number
  properties?: Record<string, unknown>
}

const propertyNames = computed(() => Object.keys(props.schema?.properties as Record<string, unknown> | undefined || {}))

const sourceOptions = computed(() => (props.allowedSources || []).map(value => ({ value, label: value })))

function schemaOf(name: string): PropertySchema | null {
  const properties = props.schema?.properties as Record<string, PropertySchema> | undefined
  const raw = properties?.[name]
  return raw ? (raw as PropertySchema) : null
}

/**
 * 槽位形状判读：
 * - oneOf[字符串, {$data}] → 字面内容或绑定二选一（区块白名单里的 SHORT/TEXT/URL 槽）
 * - 只有 $data → 必须绑定（列表槽 items/links，后端 additionalProperties=false 会拒绝字面值）
 */
function kindOf(name: string): SlotKind {
  const schema = schemaOf(name)
  if (!schema) return 'unknown'
  if (Array.isArray(schema.oneOf)) {
    const literal = schema.oneOf.some(item => (item as PropertySchema)?.type === 'string')
    const binding = schema.oneOf.some(item => JSON.stringify(item).includes('$data'))
    return literal && binding ? 'text' : 'unknown'
  }
  if (schema.properties && '$data' in schema.properties) return 'binding'
  if (Array.isArray(schema.enum)) return 'enum'
  if (schema.type === 'integer') return 'integer'
  if (schema.type === 'boolean') return 'boolean'
  return 'unknown'
}

function isBinding(name: string): boolean {
  const value = props.model[name]
  return !!value && typeof value === 'object' && '$data' in (value as Record<string, unknown>)
}

function modeOf(name: string): 'literal' | 'binding' {
  return isBinding(name) ? 'binding' : 'literal'
}

function literalOf(name: string): unknown {
  return isBinding(name) ? undefined : props.model[name]
}

function bindingOf(name: string): string | undefined {
  const value = props.model[name] as { $data?: string } | undefined
  return value?.$data
}

/**
 * 槽位模式切换：a-radio-group 的 update:value 载荷就是 'literal' / 'binding' 本身。
 * 切回字面内容时写空串而不是保留旧绑定：留着会保存出「既有 $data 又有文本」的结构。
 */
function switchMode(name: string, to: unknown) {
  write(name, to === 'binding' ? { $data: '' } : '')
}

/**
 * 模板里必须写成 `handler(name, $event)` 而不是 `handler(name)`：
 * Vue 的事件值是「内联语句」，写成后者只会在事件到来时调用一次工厂函数、把返回的处理函数丢掉，
 * 于是表单看着能输入、实际一次都不写入（这里曾经整张 props 表单静默失效过）。
 */
function writeBinding(name: string, value: unknown) {
  write(name, { $data: value ?? '' })
}

function write(name: string, value: unknown) {
  emit('update:model', { ...props.model, [name]: value })
}

function maxLengthOf(name: string): number | undefined {
  const schema = schemaOf(name)
  const stringItem = schema?.oneOf?.find(item => (item as PropertySchema)?.type === 'string') as PropertySchema | undefined
  return stringItem?.maxLength
}

function minOf(name: string): number | undefined {
  return schemaOf(name)?.minimum
}

function maxOf(name: string): number | undefined {
  return schemaOf(name)?.maximum
}

function enumOptions(name: string) {
  return (schemaOf(name)?.enum ?? []).map(value => ({ value, label: `${value}` }))
}

function hintOf(name: string): string {
  const kind = kindOf(name)
  if (kind === 'binding') return '只能绑定门户数据'
  if (kind === 'text') return '可写字面内容，或绑定门户数据'
  if (kind === 'unknown') return '无法识别的结构，只读'
  return ''
}
</script>

<style scoped lang="less">
.block-props-form {
  &__row {
    margin-bottom: 14px;
  }

  &__label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.65);
  }

  &__hint {
    color: rgba(0, 0, 0, 0.45);
    font-weight: normal;
  }
}
</style>
