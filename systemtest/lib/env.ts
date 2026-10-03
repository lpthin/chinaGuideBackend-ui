/** 环境变量只在这里读一次；缺一个就当场停，不许退化成「用一份提交进仓库的默认口令」。 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}（系统测试拒绝用硬编码默认值跑）`);
  return value;
}

export const env = {
  apiBase: process.env.E2E_API_BASE ?? 'http://127.0.0.1:8080',
  uiBase: process.env.E2E_UI_BASE ?? 'http://127.0.0.1:5190',
  runId: required('E2E_RUN_ID'),
  evidenceDir: required('E2E_EVIDENCE_DIR'),
  superAdmin: {
    username: process.env.E2E_ADMIN_USER ?? 'admin',
    password: required('E2E_ADMIN_PASSWORD'),
  },
  db: {
    host: process.env.E2E_DB_HOST ?? '192.168.31.82',
    port: Number(process.env.E2E_DB_PORT ?? 3306),
    user: process.env.E2E_DB_USER ?? 'root',
    password: required('DB_PASSWORD'),
    schema: process.env.E2E_DB_SCHEMA ?? 'geocms',
  },
};

/** §7.2 的命名纪律：本轮造的东西一律带 E2E-<runId> 前缀，收尾时按前缀清点残留 */
export function seedName(suffix: string): string {
  const runTag = env.runId.replace(/[^A-Za-z0-9]/g, '');
  return `E2E-${runTag}-${suffix}`;
}

export function seedUsername(suffix: string): string {
  const runTag = env.runId.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  return `e2e_${runTag}_${suffix}`;
}
