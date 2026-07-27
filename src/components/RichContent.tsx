import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem.js";

import { cn } from "@/lib/utils";

/**
 * Detects "Match the following" questions that contain List-I and List-II
 * sections and converts them into a two-column Markdown table so List-I
 * appears on the left and List-II appears on the right.
 *
 * Handles common AI output variants:
 *   - "List-I" / "List I" / "List – I"
 *   - Items labelled A. B. C. / (A) (B) / A) B)  on the left
 *   - Items labelled i. ii. / (i) (ii) / 1. 2.    on the right
 */
function formatMatchQuestion(input: string): string {
  // Require both List-I and List-II to be present
  const listISep = /List[\s\-–—]*I(?!\s*I)/i;
  const listIISep = /List[\s\-–—]*II/i;
  if (!listISep.test(input) || !listIISep.test(input)) return input;

  // Split on List-II first (rightmost occurrence wins)
  const listIIIdx = input.search(listIISep);
  const listIIdx = input.search(listISep);
  if (listIIdx === -1 || listIIIdx === -1 || listIIdx >= listIIIdx) return input;

  // Text before List-I (intro / stem)
  const intro = input.slice(0, listIIdx).trim();

  // Text between List-I header and List-II header
  const listIRaw = input
    .slice(listIIdx, listIIIdx)
    .replace(listISep, "") // strip the "List-I" header itself
    .trim();

  // Text from List-II header to end
  const afterListII = input.slice(listIIIdx);
  const listIIBody = afterListII.replace(listIISep, "").trim(); // strip "List-II" header

  // Extract non-empty lines from each list
  const listIItems = listIRaw.split("\n").map((l) => l.trim()).filter(Boolean);
  const listIIItems = listIIBody.split("\n").map((l) => l.trim()).filter(Boolean);

  if (!listIItems.length || !listIIItems.length) return input;

  // Build a GFM markdown table
  const rows: string[] = [
    "| **List-I** | **List-II** |",
    "|:-----------|:------------|",
  ];
  const maxLen = Math.max(listIItems.length, listIIItems.length);
  for (let i = 0; i < maxLen; i++) {
    // Escape pipe characters inside cell content
    const left = (listIItems[i] ?? "").replace(/\|/g, "\\|");
    const right = (listIIItems[i] ?? "").replace(/\|/g, "\\|");
    rows.push(`| ${left} | ${right} |`);
  }

  return (intro ? intro + "\n\n" : "") + rows.join("\n");
}

/**
 * Normalizes AI output so math/chemistry always renders cleanly.
 * Handles cases where the model wrote \( \) / \[ \] delimiters, forgot
 * to wrap \ce{...} / \frac{...}{...} in $...$, or wrapped LaTeX in
 * plain parentheses/brackets.
 */
function sanitizeRich(input: string): string {
  let s = input;

  // 1. Normalize LaTeX-style delimiters to Markdown-math dollars.
  s = s.replace(/\\\[/g, () => "$$").replace(/\\\]/g, () => "$$");
  s = s.replace(/\\\(/g, () => "$").replace(/\\\)/g, () => "$");

  // 2. Split into math vs non-math regions so we only touch prose.
  const parts: Array<{ math: boolean; text: string }> = [];
  const mathRe = /(\$\$[\s\S]+?\$\$|\$[^\n$]+?\$|`[^`\n]+`|```[\s\S]*?```)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = mathRe.exec(s)) !== null) {
    if (m.index > last) parts.push({ math: false, text: s.slice(last, m.index) });
    parts.push({ math: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ math: false, text: s.slice(last) });

  // 3. In non-math regions, wrap bare LaTeX/chemistry in $...$ and
  //    strip redundant () / [] the model added around them.
  const bareLatexRe =
    /(\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\frac\{[^{}]*\}\{[^{}]*\}|\\sqrt(?:\[[^\]]*\])?\{[^{}]*\}|\\vec\{[^{}]*\}|\\text\{[^{}]*\})/g;

  const fixed = parts.map((p) => {
    if (p.math) return p.text;
    let t = p.text;
    // Remove wrapping parens/brackets the model added around lone LaTeX
    t = t.replace(
      /\(\s*(\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})\s*\)/g,
      (_m, inner: string) => `$${inner}$`,
    );
    t = t.replace(
      /\[\s*((?:\\[a-zA-Z]+\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[,\s]*)+)\s*\]/g,
      (_m, inner: string) => `$${inner.trim()}$`,
    );
    // Wrap any remaining bare LaTeX macros in inline math.
    t = t.replace(bareLatexRe, (match) => `$${match}$`);
    // Strip LaTeX spacing macros that leak into prose: \, \; \: \! \quad \qquad
    t = t.replace(/\\[,;:!]/g, " ").replace(/\\q?quad\b/g, " ");
    // Unescape common LaTeX-escaped punctuation in prose (\% \$ \# \& \_)
    t = t.replace(/\\([%$#&_])/g, "$1");
    // Collapse literal double-backslash line breaks used by LaTeX (\\ at EOL)
    t = t.replace(/\\\\(?=\s|$)/g, "  \n");
    // Convert single newlines to Markdown hard-breaks (two spaces + newline)
    // so structured question text (List-I, List-II, etc.) renders line-by-line.
    // Skip blank lines (already paragraph separators) and lines already ending in "  ".
    t = t.replace(/(?<!  )\n(?!\n)/g, "  \n");
    return t;
  });

  return fixed.join("");
}

/**
 * Renders question / option / explanation text with Markdown + KaTeX math.
 * Supports $...$ inline math, $$...$$ display math, powers, fractions,
 * chemistry, greek letters, arrows, tables, code, lists.
 *
 * "Match the following" questions with List-I / List-II are automatically
 * rendered as a two-column side-by-side table.
 */
export function RichContent({
  children,
  className,
  inline = false,
}: {
  children: string | null | undefined;
  className?: string;
  inline?: boolean;
}) {
  const raw = (children ?? "").toString();
  if (!raw.trim()) return null;
  // Run match-question formatter first, then general sanitizer
  const text = sanitizeRich(formatMatchQuestion(raw));

  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper
      className={cn(
        "prose prose-sm max-w-none break-words dark:prose-invert",
        "prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold",
        "prose-h1:text-lg prose-h2:text-base prose-h3:text-base prose-h4:text-sm",
        "prose-p:my-2 prose-p:leading-relaxed",
        "prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:leading-relaxed",
        "prose-strong:font-semibold prose-strong:text-foreground",
        "prose-pre:my-2 prose-code:before:content-none prose-code:after:content-none",
        "prose-hr:my-3",
        inline && "prose-p:inline",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false, output: "html" }]]}
        components={{
          // Custom table rendering for match-the-following two-column layout
          table: ({ children }) => (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                margin: "0.75rem 0",
                fontSize: "0.875rem",
              }}
            >
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th
              style={{
                border: "1px solid var(--border, #e5e7eb)",
                backgroundColor: "var(--muted, #f3f4f6)",
                padding: "8px 14px",
                textAlign: "left",
                fontWeight: 600,
                fontSize: "0.85rem",
                whiteSpace: "nowrap",
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              style={{
                border: "1px solid var(--border, #e5e7eb)",
                padding: "8px 14px",
                verticalAlign: "top",
                lineHeight: "1.5",
                minWidth: "160px",
              }}
            >
              {children}
            </td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </Wrapper>
  );
}
