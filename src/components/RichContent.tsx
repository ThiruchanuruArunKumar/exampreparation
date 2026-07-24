import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem.js";

import { cn } from "@/lib/utils";

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
    t = t.replace(/\(\s*(\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})\s*\)/g, "$$$1$$");
    t = t.replace(
      /\[\s*((?:\\[a-zA-Z]+\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[,\s]*)+)\s*\]/g,
      (_full, inner: string) => `$${inner.trim()}$`,
    );
    // Wrap any remaining bare LaTeX macros in inline math.
    t = t.replace(bareLatexRe, (match) => `$${match}$`);
    return t;
  });

  return fixed.join("");
}

/**
 * Renders question / option / explanation text with Markdown + KaTeX math.
 * Supports $...$ inline math, $$...$$ display math, powers, fractions,
 * chemistry, greek letters, arrows, tables, code, lists.
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
  const text = sanitizeRich(raw);

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
      >
        {text}
      </ReactMarkdown>
    </Wrapper>
  );
}
