/// <reference types="vite/client" />

declare module '*.css'

/**
 * 测试侧「按磁盘扫源码」的最小口子（唯一消费者：header-scroll-state.spec——
 * vite 的 CSS 插件会把 `.less?raw` 变成空串，那份证据读不得，只能从盘上读，见该文件的说明）。
 * 这一档不引 @types/node：不为一个源码扫描用例挂整棵依赖树（I 系列的老纪律同样管工具链）。
 * 应用运行时代码一个都不许用这三个——浏览器里没有它们。
 */
declare module 'node:fs' {
  export function readFileSync(file: string, encoding?: string): string
}
declare module 'node:path' {
  export function join(...parts: string[]): string
}
declare const process: { cwd(): string }

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
