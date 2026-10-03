import type { Journal } from './journal';

export interface Envelope<T = unknown> {
  status: number;
  success: boolean;
  code: string;
  message: string;
  data: T;
  raw: string;
}

export interface Principal {
  token: string;
  userId: number;
  username: string;
  tenantId: number;
  tenantCode: string;
  roles: string[];
  permissions: string[];
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** 证据文件里不许出现口令：登录请求体和建号/建租户请求体都带 password 字段 */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = /password|token|secret/i.test(k) ? '<redacted>' : redact(v);
    }
    return out;
  }
  return value;
}

/** 一个登录身份 + 它自己那份租户声明头。反例用例靠「换一份 headers」构造，不共享。 */
export class Api {
  private constructor(
    private readonly base: string,
    private readonly token: string | null,
    private readonly tenantHeaders: Record<string, string>,
    private readonly journal: Journal,
  ) {}

  static anonymous(base: string, journal: Journal): Api {
    return new Api(base, null, {}, journal);
  }

  static async login(base: string, journal: Journal, username: string, password: string): Promise<{ api: Api; res: Envelope<Record<string, unknown>> }> {
    const anon = new Api(base, null, {}, journal);
    const res = await anon.call<Record<string, unknown>>('POST', '/api/auth/login', { username, password });
    if (!res.success) throw new Error(`登录失败 ${username}: ${res.status} ${res.code} ${res.message}`);
    const d = res.data as Record<string, unknown>;
    const api = new Api(base, String(d.token), { 'X-Tenant-Id': String(d.tenantId), 'X-Tenant-Code': String(d.tenantCode) }, journal);
    return { api, res };
  }

  /** 复制一份自己但改掉租户声明头 —— 「超管切进别家」与「伪造别家的号」两类反例用 */
  withTenant(tenantId: number | null, tenantCode?: string | null): Api {
    const headers: Record<string, string> = {};
    if (tenantId !== null) headers['X-Tenant-Id'] = String(tenantId);
    if (tenantCode !== null && tenantCode !== undefined) headers['X-Tenant-Code'] = tenantCode;
    return new Api(this.base, this.token, headers, this.journal);
  }

  /** 不带任何租户声明：超管未选租户 = 平台档，用于 TENANT_REQUIRED 那条反例 */
  noTenant(): Api {
    return new Api(this.base, this.token, {}, this.journal);
  }

  principal(res: Envelope<Record<string, unknown>>): Principal {
    const d = res.data as Record<string, unknown>;
    return {
      token: String(d.token),
      userId: Number(d.userId),
      username: String(d.username),
      tenantId: Number(d.tenantId),
      tenantCode: String(d.tenantCode),
      roles: (d.roles as string[]) ?? [],
      permissions: (d.permissions as string[]) ?? [],
    };
  }

  async call<T = unknown>(method: Method, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<Envelope<T>> {
    const headers: Record<string, string> = { ...extraHeaders, ...this.tenantHeaders };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const started = Date.now();
    const resp = await fetch(this.base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await resp.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { success: false, code: `HTTP_${resp.status}_NON_JSON`, message: text.slice(0, 300), data: null };
    }
    const env: Envelope<T> = {
      status: resp.status,
      success: Boolean(parsed.success),
      code: String(parsed.code ?? 'UNKNOWN'),
      message: String(parsed.message ?? ''),
      data: parsed.data as T,
      raw: text.slice(0, 4000),
    };
    this.journal.record('http', `${method} ${path}`, {
      reqHeaders: { ...(redact(headers) as Record<string, string>), Authorization: headers.Authorization ? 'Bearer <redacted>' : undefined },
      reqBody: redact(body ?? null),
      ms: Date.now() - started,
      status: env.status,
      code: env.code,
      message: env.message,
      data: redact(env.data),
    });
    return env;
  }

  get(path: string) { return this.call('GET', path); }
  post(path: string, body?: unknown) { return this.call('POST', path, body ?? {}); }
  put(path: string, body?: unknown) { return this.call('PUT', path, body ?? {}); }
  del(path: string) { return this.call('DELETE', path); }
}
