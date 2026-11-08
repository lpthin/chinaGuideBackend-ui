#!/usr/bin/env node
// 按本次改动挑出相关 spec 并跑：改哪个页面，就跑提到它的 spec。
// 用法：npm run test:related   （CI 用 npm run test:related -- --base origin/main）
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const baseArgIndex = process.argv.indexOf('--base')
const base = baseArgIndex > -1 ? process.argv[baseArgIndex + 1] : null

function git(args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  return r.status === 0 ? r.stdout : ''
}

function changedFiles() {
  const out = base ? git(['diff', '--name-only', `${base}...HEAD`]) : git(['status', '--porcelain'])
  if (base) return out.split('\n').filter(Boolean)
  return out
    .split('\n')
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3).trim())
    .map((p) => (p.includes(' -> ') ? p.split(' -> ')[1] : p))
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, acc)
    else if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.spec.tsx')) acc.push(p)
  }
  return acc
}

const pascalToKebab = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()

const files = changedFiles().filter((f) => f.startsWith('src/'))
if (files.length === 0) {
  console.log('没有 src/ 下的改动，跳过相关测试。')
  process.exit(0)
}

const specs = walk(join(root, 'src'))
const picked = new Map()

for (const file of files) {
  const baseName = file.split('/').pop().replace(/\.(vue|ts|tsx)$/, '')
  const kebab = pascalToKebab(baseName)
  let hit = false
  for (const spec of specs) {
    const specName = spec.split(/[\\/]/).pop()
    const byName = specName.includes(kebab)
    const byContent = !byName && baseName.length > 4 && readFileSync(spec, 'utf8').includes(baseName)
    if (byName || byContent) {
      picked.set(spec, true)
      hit = true
    }
  }
  if (!hit) console.log(`  · ${file} → 没有对应 spec`)
}

const list = [...picked.keys()].map((p) => relative(root, p))
if (list.length === 0) {
  console.log('所有改动都没有对应 spec，退化为跑全量（npm run test:run）。')
  const full = spawnSync('npx', ['vitest', 'run'], { cwd: root, stdio: 'inherit', shell: true })
  process.exit(full.status ?? 1)
}

console.log(`选中 ${list.length} 个 spec：`)
for (const p of list) console.log(`  - ${p}`)
const run = spawnSync('npx', ['vitest', 'run', ...list], { cwd: root, stdio: 'inherit', shell: true })
process.exit(run.status ?? 1)
