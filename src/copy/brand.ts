/**
 * 全站产品名唯一出处（Spec-UI-1 §3.1）。
 *
 * 之前同一件东西有四个写法：`index.html` 的「内容管理工作台」、顶栏的「内容管理系统」、
 * 登录页的「AI 门户管理系统」、后端启动脚本的「AI 门户网站 2.0」。改一处名字要人肉找四处，
 * 找漏一处就是「同一个产品两个名字」。这里收成一份，界面与构建期注入都读它。
 *
 * `index.html` 读不到 TS，改由 `vite.config.ts` 的 `transformIndexHtml` 在构建期把
 * `<title>%APP_NAME%</title>` 换成 `APP_NAME`——这也是「唯一出处」的一部分，别在 html 里再写一遍字面量。
 */
export const APP_NAME = '内容管理工作台'

/** 顶栏、面包屑这类横向空间紧的地方用短名；与 APP_NAME 同源，不另起一个名字 */
export const APP_SHORT_NAME = '内容工作台'
