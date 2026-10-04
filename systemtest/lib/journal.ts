import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { env } from './env';
/** spec §5 那条统一字段的表头：一条旅程的第一行证据就是它自己的用例卡 */
export interface CaseCard {
  用例号: string;
  判据: string;
  层级: 'API' | 'BROWSER' | 'SCHEDULER' | 'DB' | 'PY';
  前置: string;
  步骤: string[];
  期望: string[];
  反例: string[];
  收尾: string;
  /** 这一格的口径出处（阈值/顺序这类「为什么这样判」的话），报告里要跟用例卡一起抄 */
  口径?: string;
}

export class Journal {
  private readonly file: string;
  failures: string[] = [];
  private passed = 0;

  constructor(readonly caseId: string) {
    mkdirSync(env.evidenceDir, { recursive: true });
    this.file = join(env.evidenceDir, `${caseId}.jsonl`);
    writeFileSync(this.file, '', 'utf8');
  }

  get path(): string {
    return this.file;
  }

  record(kind: string, desc: string, payload: unknown): void {
    if (kind === 'assert-pass') this.passed += 1;
    appendFileSync(
      this.file,
      JSON.stringify({ at: new Date().toISOString(), runId: env.runId, kind, desc, payload }) + '\n',
      'utf8',
    );
  }

  card(card: CaseCard): void {
    this.record('case-card', card.用例号, card);
  }

  /** 断言之后立刻落盘：报告里每个「达成」都要能指回这一行（§4 打分规则第 1 条） */
  check(desc: string, actual: unknown, pass: boolean): void {
    this.record(pass ? 'assert-pass' : 'assert-fail', desc, { actual });
    if (!pass) this.failures.push(`${desc}　实际=${JSON.stringify(actual)}`);
  }

  expect(desc: string, actual: unknown, expected: unknown): void {
    this.check(desc, actual, JSON.stringify(actual) === JSON.stringify(expected));
  }

  note(desc: string, payload: unknown): void {
    this.record('note', desc, payload);
  }

  /**
   * 门禁（Q-8=8a）说的是「可重放」，所以每一次跑都得留下一份不覆盖的档：
   * 用例日志按 runId 另存一份，runs.log 再记一行总账（第 2 次跑绿了才算重放成立，只留最后一次等于没证明）。
   */
  assertClean(): void {
    const archive = join(env.evidenceDir, `${this.caseId}.${env.runId}.jsonl`);
    writeFileSync(archive, readFileSync(this.file, 'utf8'), 'utf8');
    appendFileSync(join(env.evidenceDir, 'runs.log'),
      `${new Date().toISOString()}  run=${env.runId}  case=${this.caseId}  通过断言=${this.passed}  失败=${this.failures.length}  ` +
      `日志=${basename(archive)}\n`, 'utf8');
    if (this.failures.length > 0) {
      throw new Error(`${this.caseId} 失败 ${this.failures.length} 条：\n - ${this.failures.join('\n - ')}\n证据：${this.path}`);
    }
  }
}
