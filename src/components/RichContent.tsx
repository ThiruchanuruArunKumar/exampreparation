import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem.js";

import { cn } from "@/lib/utils";

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
  const text = (children ?? "").toString();
  if (!text.trim()) return null;

  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper
      className={cn(
        "prose prose-sm max-w-none break-words dark:prose-invert",
        "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        "prose-pre:my-2 prose-code:before:content-none prose-code:after:content-none",
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
