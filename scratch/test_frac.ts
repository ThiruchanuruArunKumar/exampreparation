import { repairLatex } from "../src/lib/latex-repair.ts";
import fs from "fs";

function cleanChemicalFormulas(input: string): string {
  let s = input;

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

  // 3. Fix misplaced/unbalanced closing braces in \ce{...}
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

  // 5. Transform bare \ce without braces
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
      /\b(if|the|of|and|or|in|is|are|was|were|then|when|moles|product|equilibrium|constant|increased|decreased|volume|temperature|pressure|number|formed|at|by|decreasing|with|to|for|a|an|only)\b/i.test(
        inner
      )
    ) {
      return inner.replace(
        /(?<!\$)\\(sigma|pi|alpha|beta|gamma|delta|theta|lambda|mu|nu|omega|phi|psi|rho|tau|eta|zeta|kappa|chi|epsilon|Delta|Gamma|Theta|Lambda|Sigma|Omega|frac|sqrt)\b(?!\$)/g,
        (__m: string, g: string) => `$\\${g}$`
      );
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
    if ((/\\(?:right|left|Right|Left)*arrow\b/.test(t) || /\\ce\{/.test(t) || /\\frac\{/.test(t) || /\\sqrt\{/.test(t)) && !t.includes("$")) {
      t = `$${t.trim()}$`;
    }
    t = t.replace(
      /\(\s*(\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})\s*\)/g,
      (_m, inner: string) => `$${inner}$`,
    );
    t = t.replace(
      /\[\s*((?:\\[a-zA-Z]+\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[,\s]*)+)\s*\]/g,
      (_m, inner: string) => `$${inner.trim()}$`,
    );
    t = t.replace(bareLatexRe, (match) => `$${match}$`);
    t = t.replace(/\\[,;:!]/g, " ").replace(/\\q?quad\b/g, " ");
    t = t.replace(/\\([%$#&_])/g, "$1");
    t = t.replace(/\\\\(?=\s|$)/g, "  \n");
    t = t.replace(/(?<!  )\n(?!\n)/g, "  \n");
    return t;
  });

  return fixed.join("");
}

console.log(sanitizeRich(repairLatex("\\frac{h}{\\lambda}{c}")));
