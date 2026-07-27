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
  // Require both List-I (or Column-I) and List-II (or Column-II) to be present
  const hasListI = /(?:List|Column)[\s\-–—]*(?:I|1)\b/i.test(input);
  const hasListII = /(?:List|Column)[\s\-–—]*(?:II|2)\b/i.test(input);
  if (!hasListI || !hasListII) return input;

  const lines = input.split("\n").map((l) => l.trim()).filter(Boolean);

  const introLines: string[] = [];
  let listILines: string[] = [];
  let listIILines: string[] = [];
  const footerLines: string[] = [];

  let state: "intro" | "listI" | "listII" | "footer" = "intro";

  const listIHeaderRe = /^(?:List|Column)[\s\-–—]*(?:I|1)[:\s]*$/i;
  const listIIHeaderRe = /^(?:List|Column)[\s\-–—]*(?:II|2)[:\s]*$/i;
  const footerStartRe = /^(?:Choose|Select|Which|Options|Match the|Where)\b/i;

  const itemAtoDRe = /^(?:\(?\s*[A-Da-d]\s*[\.\):]|\b[A-Da-d]\b[\.\):]?)\s+/;
  const itemItoIVRe = /^(?:\(?\s*(?:i{1,3}|iv|vi{0,3}|ix|x|[1-9]\d*|[I|V|X]+)\s*[\.\):])\s+/;

  for (const line of lines) {
    if (listIHeaderRe.test(line)) {
      state = "listI";
      continue;
    }
    if (listIIHeaderRe.test(line)) {
      state = "listII";
      continue;
    }

    if (state === "listII" && footerStartRe.test(line)) {
      state = "footer";
      footerLines.push(line);
      continue;
    }

    if (state === "intro") {
      if (itemAtoDRe.test(line)) {
        state = "listI";
        listILines.push(line);
      } else {
        introLines.push(line);
      }
    } else if (state === "listI") {
      if (itemItoIVRe.test(line) && listILines.length > 0) {
        state = "listII";
        listIILines.push(line);
      } else {
        listILines.push(line);
      }
    } else if (state === "listII") {
      listIILines.push(line);
    } else {
      footerLines.push(line);
    }
  }

  // Filter out any leftover header text lines inside item lists
  listILines = listILines.filter((l) => !listIHeaderRe.test(l) && !listIIHeaderRe.test(l));
  listIILines = listIILines.filter((l) => !listIHeaderRe.test(l) && !listIIHeaderRe.test(l));

  if (!listILines.length || !listIILines.length) return input;

  const introText = introLines.join("  \n").trim();
  const footerText = footerLines.join("  \n").trim();

  // Build markdown two-column table
  const rows: string[] = [
    "| **List-I** | **List-II** |",
    "|:-----------|:------------|",
  ];

  const maxLen = Math.max(listILines.length, listIILines.length);
  for (let i = 0; i < maxLen; i++) {
    const left = (listILines[i] ?? "").replace(/\|/g, "\\|");
    const right = (listIILines[i] ?? "").replace(/\|/g, "\\|");
    rows.push(`| ${left} | ${right} |`);
  }

  let result = "";
  if (introText) result += introText + "\n\n";
  result += rows.join("\n");
  if (footerText) result += "\n\n" + footerText;

  return result;
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
    /(\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\frac\{[^{}]*\}\{[^{}]*\}|\\sqrt(?:\[[^\]]*\])?\{[^{}]*\}|\\vec\{[^{}]*\}|\\text\{[^{}]*\}|\\(?:right|left|Right|Left|up|down|long)*arrow\b|\\(?:cdot|times|pm|mp|infty|degree|alpha|beta|gamma|delta|theta|pi|mu|lambda|sigma|omega|Delta)\b)/g;

  const fixed = parts.map((p) => {
    if (p.math) return p.text;
    let t = p.text;
    // Auto-wrap un-wrapped LaTeX arrow sequences e.g. "1 \rightarrow 2 \rightarrow 3"
    if (/\\(?:right|left|Right|Left)*arrow\b/.test(t) && !t.includes("$")) {
      t = `$${t.trim()}$`;
    }
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
  // Repair broken/unbalanced LaTeX first, then match-table formatting, then sanitize.
  const text = sanitizeRich(formatMatchQuestion(repairLatex(raw)));


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
