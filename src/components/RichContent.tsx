import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem.js";

import { cn } from "@/lib/utils";
import { repairLatex } from "@/lib/latex-repair";


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
function cleanChemicalFormulas(input: string): string {
  let s = input;

  // 1. Un-wrap English prose sentences/options that were mistakenly wrapped in $...$ e.g. "$3 \sigma and 2 \pi$" -> "3 $\sigma$ and 2 $\pi$"
  s = s.replace(
    /\$([^\$\n]*\b(?:if|the|of|and|or|in|is|are|was|were|then|when|moles|product|equilibrium|constant|increased|decreased|volume|temperature|pressure|number|formed|at|by|decreasing|with|to|for|a|an|only)\b[^\$\n]*)\$/gi,
    (_m, inner) => {
      return inner.replace(
        /(?<!\$)\\(sigma|pi|alpha|beta|gamma|delta|theta|lambda|mu|nu|omega|phi|psi|rho|tau|eta|zeta|kappa|chi|epsilon|Delta|Gamma|Theta|Lambda|Sigma|Omega|frac|sqrt)\b(?!\$)/g,
        (__m: string, g: string) => `$\\${g}$`
      );
    }
  );

  // 2. Fix bare \mathrm{...} without $...$ (supporting nested braces like _{2})
  s = s.replace(/(?<!\$)\\mathrm\s*\{([\s\S]+)/g, (fullMatch) => {
    let depth = 1;
    let endIdx = -1;
    const fullText = fullMatch.slice(fullMatch.indexOf("{") + 1);
    for (let i = 0; i < fullText.length; i++) {
      if (fullText[i] === "{") depth++;
      else if (fullText[i] === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx !== -1) {
      let content = fullText.slice(0, endIdx);
      content = content.replace(/<=>|<==>|<->/g, "\\rightleftharpoons ");
      const remaining = fullText.slice(endIdx + 1);
      return `$\\mathrm{${content.trim()}}$${remaining}`;
    }
    return fullMatch;
  });

  // 3. Fix misplaced/unbalanced closing braces in \ce{...} e.g. \ce{CH3-CH}=CH-CHO} -> \ce{CH3-CH=CH-CHO}
  s = s.replace(/\\ce\s*\{([^{}\n]+)\}([^$\s\n]*\})/g, (_m, inner1, inner2) => {
    const clean2 = inner2.replace(/\}$/, "");
    return `\\ce{${inner1}${clean2}}`;
  });

  // 4. Transform \ce{content} -> $\mathrm{content}$ (with automatic number subscripts)
  s = s.replace(/\\ce\s*\{([^{}\n]+)\}/g, (_m, rawFormula) => {
    let formula = rawFormula.trim();
    formula = formula.replace(/<=>|<==>|<->/g, "\\rightleftharpoons ");
    formula = formula.replace(/([A-Za-z])([0-9]+)/g, "$1_{$2}");
    formula = formula.replace(/\^?([0-9]*[\+\-])/g, "^{$1}");
    return `$\\mathrm{${formula}}$`;
  });

  // 5. Transform bare \ce without braces e.g. \ceO2^- -> $\mathrm{O_2^-}$
  s = s.replace(/\\ce\s*([A-Za-z0-9_+\-^\(\)]+)/g, (_m, rawFormula) => {
    let formula = rawFormula.trim();
    formula = formula.replace(/([A-Za-z])([0-9]+)/g, "$1_{$2}");
    formula = formula.replace(/\^?([0-9]*[\+\-])/g, "^{$1}");
    return `$\\mathrm{${formula}}$`;
  });

  // 6. Wrap bare Greek letters in inline math e.g. "3 \sigma and 2 \pi" -> "3 $\sigma$ and 2 $\pi$"
  s = s.replace(
    /(?<!\$)\\(sigma|pi|alpha|beta|gamma|delta|theta|lambda|mu|nu|omega|phi|psi|rho|tau|eta|zeta|kappa|chi|epsilon|Delta|Gamma|Theta|Lambda|Sigma|Omega)\b(?!\$)/g,
    (_m, g) => `$\\${g}$`
  );

  // 7. Clean stray dollar at end of symbol e.g. "K_c$:" -> "$K_c$:"
  s = s.replace(/([A-Za-z0-9_]+)\$:/g, "$$$1$:");

  return s;
}

function formatChemistryMath(mathText: string): string {
  if (/^\$[^$]+\$$/.test(mathText)) {
    const inner = mathText.slice(1, -1).trim();

    // Safeguard: Never format English prose sentences containing common words as math
    if (
      /\b(if|the|of|and|or|in|is|are|was|were|then|when|moles|product|equilibrium|constant|increased|decreased|volume|temperature|pressure)\b/i.test(
        inner
      )
    ) {
      return inner;
    }

    if (
      /\b[A-Z][a-z]?(?:_\{?[0-9]+\}?|[0-9]+)?(?:\^{?[\+\-0-9]*\}?)?\b/.test(inner) &&
      !/\\(frac|sqrt|sin|cos|tan|log|int|lim)\b/.test(inner) &&
      !inner.startsWith("\\mathrm{")
    ) {
      let cleanInner = inner.replace(/([A-Z][a-z]?)([0-9]+)(?![\}\_])/g, "$1_{$2}");
      cleanInner = cleanInner.replace(/\^?([0-9]+[\+\-])/g, "^{$1}");
      return `$\\mathrm{${cleanInner}}$`;
    }
  }
  return mathText;
}

function sanitizeRich(input: string): string {
  let s = input.replace(/\\\\/g, "\\");
  s = cleanChemicalFormulas(s);

  // 1. Fix mismatched dollar wrappers e.g. "$$\frac{u}{g}$" or "$\frac{u}{g}$$" -> "$\frac{u}{g}$"
  s = s.replace(/\$\$([^\$\n]+)\$/g, (_m, inner) => `$${inner.trim()}$`);
  s = s.replace(/\$([^\$\n]+)\$\$/g, (_m, inner) => `$${inner.trim()}$`);

  // 2. Fix invalid backslashes before plain formulas like \NH3 -> NH3
  s = s.replace(/\\([A-Z][a-z0-9_+\-^\(\)]+)/g, (_m, inner) => {
    const valid = ["Delta", "Alpha", "Beta", "Gamma", "Theta", "Pi", "Sigma", "Omega"];
    return valid.includes(inner) ? `\\${inner}` : inner;
  });

  // 3. Normalize LaTeX-style delimiters to Markdown-math dollars.
  s = s.replace(/\\\[/g, () => "$$").replace(/\\\]/g, () => "$$");
  s = s.replace(/\\\(/g, () => "$").replace(/\\\)/g, () => "$");

  // 4. Split into math vs non-math regions so we only touch prose.
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

  // 5. In non-math regions, wrap bare LaTeX/chemistry in $...$
  const bareLatexRe =
    /(\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\frac\{[^{}]*\}\{[^{}]*\}|\\sqrt(?:\[[^\]]*\])?\{[^{}]*\}|\\vec\{[^{}]*\}|\\text\{[^{}]*\}|\\(?:right|left|Right|Left)*arrow\b|\\(?:cdot|times|pm|mp|infty|degree|alpha|beta|gamma|delta|theta|pi|mu|lambda|sigma|omega|Delta)\b)/g;

  const fixed = parts.map((p) => {
    if (p.math) return formatChemistryMath(p.text);
    let t = p.text;
    // Auto-wrap un-wrapped LaTeX arrow/chemistry/math sequences ONLY if no dollar sign exists
    if ((/\\(?:right|left|Right|Left)*arrow\b/.test(t) || /\\ce\{/.test(t) || /\\frac\{/.test(t) || /\\sqrt\{/.test(t)) && !t.includes("$")) {
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
    // Wrap all bare LaTeX macros in inline math mode
    t = t.replace(bareLatexRe, (match) => `$${match}$`);
    // Strip LaTeX spacing macros that leak into prose: \, \; \: \! \quad \qquad
    t = t.replace(/\\[,;:!]/g, " ").replace(/\\q?quad\b/g, " ");
    // Unescape common LaTeX-escaped punctuation in prose (\% \$ \# \& \_)
    t = t.replace(/\\([%$#&_])/g, "$1");
    // Collapse literal double-backslash line breaks used by LaTeX (\\ at EOL)
    t = t.replace(/\\\\(?=\s|$)/g, "  \n");
    // Convert single newlines to Markdown hard-breaks
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
