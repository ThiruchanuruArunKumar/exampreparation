/**
 * Deterministic LaTeX repair for AI-generated question text and options.
 *
 * Models frequently emit broken math: unbalanced `$`, `\(...\)` delimiters,
 * or completely bare macros (`\ce{AgCl}`, `\mathrm{2SO_{2}(g)}`,
 * `\rightleftharpoons`, `\sigma`, `K_c`). KaTeX then either renders nothing or
 * swallows an entire sentence into italic math (the classic
 * "ifthenumberofmoles..." bug).
 *
 * This module rebuilds the math delimiters from scratch so every macro sits
 * inside `$...$` and no prose ever ends up inside a math span.
 */

// A single "math atom": a macro (with up to one nested brace level),
// a super/subscript, or a brace group belonging to one.
const ATOM_SOURCE =
  "\\\\[a-zA-Z]+(?:\\s*\\[[^\\]\\n]*\\])?(?:\\s*\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\})*" + // \ce{...}, \frac{a}{b}, \sqrt[3]{x}, \alpha
  "|[A-Za-z0-9\\)\\]]\\s*[\\^_]\\s*(?:\\{[^{}]*\\}|[A-Za-z0-9+\\-]+)"; // x^2, H_2, K_c, 10^{-3}

const ATOM_RE = new RegExp(ATOM_SOURCE, "g");

// Glue allowed between two atoms while still being part of one math run:
// short, no real words (3+ consecutive letters ends the run).
function isMathGlue(gap: string): boolean {
  if (gap.length === 0) return true;
  if (gap.length > 12) return false;
  if (/\n/.test(gap)) return false;
  if (/[A-Za-z]{3,}/.test(gap)) return false;
  return /^[\s0-9A-Za-z+\-=<>(),.:;/*|~'%°]*$/.test(gap);
}

function stripMathRegions(s: string): string {
  return s
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^\n$]*\$/g, " ")
    .replace(/`[^`\n]*`/g, " ");
}

function countUnescapedDollars(s: string): number {
  return (s.match(/(?<!\\)\$/g) ?? []).length;
}

/**
 * Returns true when the text's math delimiters are already sane:
 * balanced `$`, no `\(`/`\[`, and no bare macro outside a math span.
 */
export function isLatexHealthy(input: string): boolean {
  if (!input) return true;
  if (/\\[([]/.test(input)) return false;
  if (countUnescapedDollars(input) % 2 !== 0) return false;
  const outside = stripMathRegions(input);
  if (/\\[a-zA-Z]+/.test(outside)) return false;
  if (/[A-Za-z0-9)\]]\s*[\^_]\s*(?:\{[^{}]*\}|[A-Za-z0-9+\-]+)/.test(outside)) return false;
  return true;
}

/**
 * Rebuilds `$...$` math delimiters around every LaTeX run in the text.
 * Prose is never pulled inside a math span.
 */
export function repairLatex(input: string | null | undefined): string {
  if (input == null) return "";
  let s = String(input);
  if (!s.trim()) return s;

  // Un-double escaped macros ("\\ce{" -> "\ce{") produced by JSON round-trips.
  s = s.replace(/\\\\(?=[a-zA-Z])/g, "\\");

  // Repair ASCII tab character (\t) corruptions before LaTeX keywords: \text, \times, \theta, \tan, \to, \tau, \triangle, \tilde
  s = s.replace(/\t(ext|times|theta|tan|to|tau|triangle|tilde)/g, "\\$1");
  s = s.replace(/\\ext\{/g, "\\text{");

  // Repair corrupted unit strings produced by unescaped \text: e.g. 10extm/s -> 10\text{m/s}, 60extm -> 60\text{m}, 4exts -> 4\text{s}
  s = s.replace(/(\d+)\s*ext\s*(\{([^}]+)\}|([a-zA-Z]+(?:\/[a-zA-Z]+)?(?:\^\d+)?))/g, (_m, num, _rest, unitInsideBraces, rawUnit) => {
    const unit = unitInsideBraces || rawUnit;
    return `${num}\\text{${unit}}`;
  });


  // Fix invalid backslashes before plain chemical formulas like \NH3 -> NH3
  s = s.replace(/\\([A-Z][a-z0-9_+\-^\(\)]+)/g, (_m, inner) => {
    const valid = [
      "Delta",
      "Alpha",
      "Beta",
      "Gamma",
      "Theta",
      "Pi",
      "Sigma",
      "Omega",
      "ce",
      "mathrm",
      "text",
      "frac",
      "sqrt",
      "vec",
      "rightleftharpoons",
      "left",
      "right",
    ];
    return valid.includes(inner) ? `\\${inner}` : inner;
  });

  if (isLatexHealthy(s)) return s;

  // Normalize LaTeX delimiters to dollars first.
  s = s.replace(/\\\[/g, "$$").replace(/\\\]/g, "$$");
  s = s.replace(/\\\(/g, "$").replace(/\\\)/g, "$");

  // Delimiters are untrustworthy at this point — drop them all and rebuild.
  s = s.replace(/\$\$/g, " ").replace(/(?<!\\)\$/g, "");

  // Find math atoms and merge neighbours joined by mathy glue.
  const spans: Array<{ start: number; end: number }> = [];
  ATOM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATOM_RE.exec(s)) !== null) {
    if (!m[0]) {
      ATOM_RE.lastIndex++;
      continue;
    }
    const start = m.index;
    const end = m.index + m[0].length;
    const prev = spans[spans.length - 1];
    if (prev && isMathGlue(s.slice(prev.end, start))) {
      prev.end = end;
    } else {
      spans.push({ start, end });
    }
  }

  if (!spans.length) return s;

  let out = "";
  let cursor = 0;
  for (const span of spans) {
    out += s.slice(cursor, span.start);
    const body = s.slice(span.start, span.end).trim();
    // Trailing punctuation belongs to the prose, not the math.
    const trail = body.match(/[.,;:]+$/)?.[0] ?? "";
    const core = trail ? body.slice(0, body.length - trail.length) : body;
    out += core ? `$${core}$${trail}` : body;
    cursor = span.end;
  }
  out += s.slice(cursor);

  // Tidy spacing artefacts.
  return out.replace(/[ \t]{2,}/g, "  ").replace(/\s+([.,;:])/g, "$1").trim();
}

/** Repairs a question's prompt, options and correct answers in one pass. */
export function repairQuestionLatex<
  T extends { prompt: string; options: string[] | null; correct_answer: string[] },
>(q: T): T {
  return {
    ...q,
    prompt: repairLatex(q.prompt),
    options: q.options ? q.options.map((o) => repairLatex(o)) : null,
    correct_answer: (q.correct_answer ?? []).map((a) => repairLatex(a)),
  };
}
