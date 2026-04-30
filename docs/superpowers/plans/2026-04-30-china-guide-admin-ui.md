# China Guide Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vue 3 admin UI that connects to the completed GeoCMS Phase 1 backend and supports the full content flow from login to dry-run publish.

**Architecture:** Use a classic admin shell with route-level pages. Keep API calls in domain-specific modules, auth/site state in Pinia, and business pages as thin orchestrators around Element Plus forms/tables.

**Tech Stack:** Vue 3, Vite, TypeScript, Element Plus, Pinia, Vue Router, Axios.

---

## File Structure

- `package.json` — npm scripts and dependencies.
- `vite.config.ts` — Vite config with dev server proxy to backend.
- `src/main.ts` — app bootstrap, Element Plus, Pinia, Router.
- `src/App.vue` — router outlet root.
- `src/router/index.ts` — route definitions and login guard.
- `src/stores/auth.ts` — token/user login state.
- `src/stores/site.ts` — site list/current site state.
- `src/api/http.ts` — Axios instance and ApiResponse unwrapping.
- `src/api/*.ts` — domain API wrappers.
- `src/layouts/AdminLayout.vue` — sidebar/topbar shell.
- `src/views/*.vue` — page components.
- `src/types/api.ts` — shared API/domain types.

---

## Task 1: Initialize Vue project skeleton

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/main.ts`
- Create: `src/App.vue`

- [ ] **Step 1: Create project files**

Use Vite Vue TypeScript with scripts:

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview --host 0.0.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install vue@latest vite@latest typescript@latest vue-tsc@latest @vitejs/plugin-vue@latest element-plus@latest @element-plus/icons-vue@latest pinia@latest vue-router@latest axios@latest
```

- [ ] **Step 3: Build verification**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "初始化Vue后台管理项目"
```

---

## Task 2: Add API client, auth store, and router guard

**Files:**
- Create: `src/types/api.ts`
- Create: `src/api/http.ts`
- Create: `src/api/auth.ts`
- Create: `src/stores/auth.ts`
- Create: `src/router/index.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Implement shared response types**

```ts
export interface ApiResponse<T> {
  success: boolean
  code: string
  message: string
  data: T
}

export interface LoginResult {
  token: string
  username?: string
  userId?: number
}
```

- [ ] **Step 2: Implement Axios client**

`http.ts` should set `baseURL` from `VITE_API_BASE_URL || '/api'`, attach bearer token, unwrap `ApiResponse<T>`, and reject `success=false` with `message`.

- [ ] **Step 3: Implement login API/store/router guard**

`authStore.login(username,password)` calls `POST /admin/auth/login`; protected routes redirect to `/login` when token is missing.

- [ ] **Step 4: Build verification**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "实现登录状态和路由守卫"
```

---

## Task 3: Build admin shell and login page

**Files:**
- Create: `src/layouts/AdminLayout.vue`
- Create: `src/views/LoginView.vue`
- Create: `src/views/DashboardView.vue`
- Modify: `src/router/index.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: Create classic admin layout**

Left sidebar routes: dashboard, sites, categories, keywords, articles, reviews, publishing. Topbar contains current site selector placeholder and logout button.

- [ ] **Step 2: Create login page**

Element Plus form with username/password, default placeholders `admin` / `admin123456`, submit button, error message handling.

- [ ] **Step 3: Create dashboard placeholder**

Show four metric cards and quick action cards for Phase 1 workflow.

- [ ] **Step 4: Build verification**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "实现后台布局和登录页"
```

---

## Task 4: Sites and categories pages

**Files:**
- Create: `src/api/sites.ts`
- Create: `src/api/categories.ts`
- Create: `src/stores/site.ts`
- Create: `src/views/SitesView.vue`
- Create: `src/views/CategoriesView.vue`
- Modify: `src/layouts/AdminLayout.vue`
- Modify: `src/router/index.ts`

- [ ] **Step 1: Implement site APIs and store**

Wrap `GET/POST/PUT /admin/sites` and persist current site id to localStorage.

- [ ] **Step 2: Implement sites page**

Element Plus table + dialog form for create/edit.

- [ ] **Step 3: Implement categories page**

Use current site id, table + dialog form for create/edit categories.

- [ ] **Step 4: Build verification**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "实现站点和栏目管理页面"
```

---

## Task 5: Keywords and clusters page

**Files:**
- Create: `src/api/keywords.ts`
- Create: `src/views/KeywordsView.vue`
- Modify: `src/router/index.ts`

- [ ] **Step 1: Implement keyword APIs**

Wrap list/import/distill/clusters endpoints.

- [ ] **Step 2: Implement keyword page**

Show keyword table, import textarea dialog, distill button, cluster table, generate-draft action entry.

- [ ] **Step 3: Build verification**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "实现关键词导入和聚类页面"
```

---

## Task 6: Articles and versions page

**Files:**
- Create: `src/api/articles.ts`
- Create: `src/views/ArticlesView.vue`
- Modify: `src/router/index.ts`

- [ ] **Step 1: Implement article APIs**

Wrap generate/generate-daily/list/versions endpoints.

- [ ] **Step 2: Implement articles page**

Show article table, generate form with keywordClusterId, version detail drawer with SEO/GEO fields.

- [ ] **Step 3: Build verification**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "实现文章草稿和版本查看页面"
```

---

## Task 7: Review and publishing pages

**Files:**
- Create: `src/api/reviews.ts`
- Create: `src/api/publishing.ts`
- Create: `src/views/ReviewsView.vue`
- Create: `src/views/PublishingView.vue`
- Modify: `src/router/index.ts`

- [ ] **Step 1: Implement review/publish APIs**

Wrap human-review, ai-review, review-pending-before-nine, dry-run, publish.

- [ ] **Step 2: Implement review page**

Filter pending articles, approve/reject with opinion, trigger AI review.

- [ ] **Step 3: Implement publishing page**

Show approved/published articles, dry-run button, formal publish with confirmation, result panel.

- [ ] **Step 4: Build verification**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "实现审核和发布页面"
```

---

## Task 8: README and local smoke verification

**Files:**
- Create/Modify: `README.md`

- [ ] **Step 1: Document setup**

Include install, dev, build, backend proxy/base URL, and manual flow.

- [ ] **Step 2: Final build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "补充前端本地开发说明"
```

---

## Self-Review

- Spec coverage: login, layout, site/category, keywords, articles, review, publishing, README are covered.
- Deferred scope remains excluded: RBAC CRUD, media, form designer, comments/likes, analytics/ad management, mobile.
- Verification gate: each implementation task requires `npm run build` before commit.
