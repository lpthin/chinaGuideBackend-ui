# China Guide Backend UI

GeoCMS / China Guide 后台管理前端，连接 Phase 1 后端，实现内容生产最小闭环：登录、站点/栏目、关键词、文章草稿、审核、dry-run/发布。

## 技术栈

- Vue 3
- Vite
- TypeScript
- Element Plus
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
http://localhost:5173
```

## 后端地址

开发环境默认通过 Vite proxy 转发：

```text
/api -> http://localhost:18080
```

如果需要指定后端地址，可设置：

```bash
VITE_API_BASE_URL=http://localhost:18080/api npm run dev
```

## 构建

```bash
npm run build
```

## 默认本地账号

后端种子数据默认管理员：

- 用户名：`admin`
- 密码：`admin123456`

## 手动冒烟流程

1. 启动后端：

```bash
cd /Users/lpthin/openclaw/portalWebsite/chinaGuideBackend
SERVER_PORT=18080 /Users/lpthin/java/maven/apache-maven-3.8.4/bin/mvn spring-boot:run
```

2. 启动前端：

```bash
cd /Users/lpthin/openclaw/portalWebsite/chinaGuideBackend-ui/.worktrees/feature-admin-ui
npm run dev
```

3. 打开：

```text
http://localhost:5173
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
