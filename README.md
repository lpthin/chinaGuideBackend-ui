# China Guide Backend UI

GeoCMS / China Guide 后台管理前端，连接 Phase 1 后端，实现内容生产最小闭环：登录、站点/栏目、关键词、文章草稿、审核、dry-run/发布。

## 技术栈

- Vue 3
- Vite
- TypeScript
- Ant Design Vue
- Pinia
- Vue Router
- Axios

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

默认 Vite 地址：

```text
http://localhost:5175
```

## 后端地址

开发环境由 Vite proxy 转发（`vite.config.ts`，端口 `5190` 是规定死的，`--port` 不要覆盖）：

```text
/api     -> http://localhost:8080
/uploads -> http://localhost:8080
```

生产没有这一层：`src/api/http.ts` 的 baseURL 就是相对路径 `/api`，所以那两条转发要由
部署它的那台 nginx 补上（见下面「生产构建与托管」）。

另有一个 `VITE_BACKEND_ORIGIN`：只有「建站交付」那一页需要它才能给出**可点击**的后端链接，
不配时界面退化成只显示路径。它不参与任何请求的地址拼接。

## 构建

```bash
npm run build
```

产物在 `dist/`。这一份构建同时是**管理后台**和**公开门户**的前端：门户那边不是另一个站，
而是后端把 `dist/index.html` 当 HTML 壳、注入服务端算好的 head 片段再吐出去。

## 生产构建与托管

三步，顺序不能换：

```bash
npm run build                                    # 产出 dist/
# 后端侧：PORTAL_SHELL_ENABLED=true + PORTAL_SHELL_INDEX_PATH 指到这台机器上的 dist/index.html
```

1. **先构建，再打开 `PORTAL_SHELL_ENABLED`。** 反过来的表现是门户页面全 503——
   后端读不到那个文件时是明确拒绝，不是给一个空壳；这一条闸在设计上就不允许「先开着等构建」。
2. **nginx 只把 `/api`、`/uploads` 以及门户路径的反向代理交给后端（8080），并把后端那张口
   只留给 nginx**（`127.0.0.1` 或安全组）。留资与工单的限流键取的是 `X-Forwarded-For` 的第一段，
   那是请求头不是事实：谁能直连 8080，谁就能自己填一个 IP 出来绕过限流。
3. **SPA 用的是 `createWebHistory`**，所以任何前端路由的深链都要能回落到 `index.html`
   （nginx 那句 `try_files $uri $uri/ /index.html;`）。少了这一句的表现是：首页能开，
   刷新 `/workspace/portal/content` 变 404。

素材目录（`APP_MEDIA_STORAGE_PATH` / `APP_MEDIA_PRIVATE_STORAGE_PATH`）要给绝对路径，
并且**在部署机上备份**：私有那一份装的是参考站截图，是本系统对外唯一「看过别人网站长什么样」的留痕。

## 默认本地账号

后端种子数据（`V31__init_test_data.sql`）默认管理员：

- 用户名：`admin`
- 密码：`admin123`

这一份只在 dev 库里有。生产库不要拿它当入口，转正交棒出去的账号走
`POST /api/admin/tenants` 的开通流程。

## 手动冒烟流程

1. 启动后端：

```bash
cd /Users/lpthin/openclaw/portalWebsite/chinaGuideBackend
SERVER_PORT=18087 /Users/lpthin/java/maven/apache-maven-3.8.4/bin/mvn spring-boot:run
```

2. 启动前端：

```bash
cd /Users/lpthin/openclaw/portalWebsite/chinaGuideBackend-ui/.worktrees/feature-admin-ui
npm run dev
```

3. 打开：

```text
http://localhost:5175
```

4. 登录后台。
5. 在顶部选择当前站点。
6. 进入「关键词库」，导入关键词。
7. 点击「AI 蒸馏」，查看关键词聚类。
8. 进入「内容草稿」，按聚类生成文章。
9. 进入「审核中心」，人工通过文章。
10. 进入「发布任务」，先 dry-run，再按需正式发布。

## 首版页面

- 登录
- 仪表盘
- 站点管理
- 栏目管理
- 关键词库
- 内容草稿
- 审核中心
- 发布任务

## 暂缓功能

- 用户/角色/权限 CRUD
- 媒体库
- 表单设计器
- 评论、点赞、前台用户登录
- 统计分析与广告管理
- 移动端适配
