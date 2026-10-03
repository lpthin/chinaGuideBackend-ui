import mysql from 'mysql2/promise';
import { env } from './env';
import type { Journal } from './journal';

/** 只做读断言与收尾清点。写一律走业务接口 —— 直改库等于把「接口放不放人」这件事测成假的。 */
export class Db {
  private pool: mysql.Pool | null = null;

  constructor(private readonly journal: Journal) {}

  private get connection(): mysql.Pool {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: env.db.host,
        port: env.db.port,
        user: env.db.user,
        password: env.db.password,
        database: env.db.schema,
        connectionLimit: 2,
        charset: 'utf8mb4',
      });
    }
    return this.pool;
  }

  async rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.connection.query(sql, params);
    this.journal.record('db', sql.replace(/\s+/g, ' ').trim(), { params, rowCount: Array.isArray(rows) ? rows.length : null, rows });
    return rows as T[];
  }

  async count(sql: string, params: unknown[] = []): Promise<number> {
    const rows = await this.rows<{ n: number | string }>(sql, params);
    return Number(rows[0]?.n ?? -1);
  }

  async close(): Promise<void> {
    if (this.pool) await this.pool.end();
    this.pool = null;
  }
}
