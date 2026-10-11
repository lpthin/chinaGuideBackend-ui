/**
 * 「人话一句话」那一句是怎么从后端原文里取出来的（Spec-M §10.16，他拍板的那条排版口径）。
 *
 * 只此一处：三处文字墙（画廊单卡、需求单详情卡、说明书段）与向导的四步都从这里取判据，
 * 免得同一个「截第一句」在四个模板里写出四种切法。
 *
 * 两条纪律：
 * 1. 这里只做**显示**的裁剪，原文永远由 `FoldedText` 的展开区逐字带着 ⇒ 数据不丢、可追溯。
 * 2. 截出来的那句不许补任何后端没说的意思：截断就加省略号，取不到就回空串由调用方说「没填」。
 */

/** 一行默认摆多少字：超过就截到这一格并加省略号（原文在展开里） */
export const SENTENCE_MAX_CHARS = 60;

const LINE_BREAK = /\r?\n/;
const SENTENCE_ENDINGS = ['。', '！', '？', '；', '!', '?', ';'];

/** 后端错误体那一族的常见字段：命中任何一个就用它的值当那一句人话 */
const JSON_MESSAGE_KEYS = ['message', 'error', 'msg', 'detail', 'errorMsg'];

/**
 * 取后端原文里的第一句：先取第一个非空行，再在第一个句读处收口。
 *
 * @param raw      后端原话（逐字），null/空给空串
 * @param maxChars 那一句最多摆多少字
 */
export function firstSentence(raw: string | null | undefined, maxChars: number = SENTENCE_MAX_CHARS): string {
  if (raw === null || raw === undefined) return '';
  const lines = String(raw).split(LINE_BREAK).map(line => line.trim()).filter(line => line.length > 0);
  if (!lines.length) return '';
  const line = lines[0];
  const cut = earliestSentenceEnd(line);
  // 收口在句读之前：那一行要读的是一句话，不是一个孤零零的标点收尾（整份原文在展开里，一个字没丢）
  const sentence = cut > 0 ? line.slice(0, cut - 1) : line;
  if (sentence.length <= maxChars) return sentence;
  return `${sentence.slice(0, maxChars).replace(/\s+$/, '')}…`;
}

/** 句读出现在第几个字符后（0 表示这一行没有句读，整行就是一句） */
function earliestSentenceEnd(line: string): number {
  let best = 0;
  for (const mark of SENTENCE_ENDINGS) {
    const index = line.indexOf(mark);
    if (index > 0 && (best === 0 || index < best)) best = index + 1;
  }
  return best;
}

/**
 * 后端原话看着像 JSON 时，把那一句人话从错误字段里取出来。
 *
 * <p>为什么要有这一支：画廊那一档 2037 字的墙上挂着的是接口原样回的 JSON 体，
 * 拿 `firstSentence` 切它只会得到一行 `{"code":...`——那是把机器话当人话摆。</p>
 *
 * @returns 命中的中文消息；不是 JSON、解析失败或没有那些键时回 null（调用方退回按行取句）
 */
export function jsonMessageSentence(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const value = pickMessage(parsed);
  if (!value) return null;
  return firstSentence(value);
}

function pickMessage(node: unknown): string | null {
  if (node === null || node === undefined) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = pickMessage(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const record = node as Record<string, unknown>;
  for (const key of JSON_MESSAGE_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  for (const value of Object.values(record)) {
    const found = pickMessage(value);
    if (found) return found;
  }
  return null;
}

/**
 * 那一行要不要摆展开：判据是「展开里还有没有没说出口的字」，不是长度比大小。
 *
 * <p>为什么按内容判：调用方常把那句人话自己拼过（「这一套有 1 条降级说明要对你说的话」），
 * 那种句子里一个后端的字都没有——按长度判会判成「没什么可折」，于是后端原话在界面上直接消失。
 * 只有当那一行已经逐字念完了整份原话（只差结尾句读）时，展开里才真的没有新内容，才不摆那一栏。</p>
 */
export function hasFoldableRaw(raw: string | null | undefined, summary: string): boolean {
  const text = (raw ?? '').trim();
  if (!text) return false;
  const spoken = summary.trim();
  if (!spoken) return true;
  return !spoken.includes(stripTrailingMark(text));
}

/** 结尾那一个句读不算内容：`firstSentence` 收口时把它丢了，比对时要一样丢掉 */
function stripTrailingMark(text: string): string {
  const last = text.slice(-1);
  return SENTENCE_ENDINGS.includes(last) ? text.slice(0, -1) : text;
}
