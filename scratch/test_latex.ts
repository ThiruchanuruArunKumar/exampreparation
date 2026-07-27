import { repairLatex } from "../src/lib/latex-repair.ts";
import fs from "fs";

// To test sanitizeRich, we can just copy it here temporarily or export it.
// Let's just run it as it's written in RichContent.tsx.
// Since RichContent.tsx is a TSX file and has imports, we might need to be careful, but we can extract it.
const input = `A particle moves in a circle of radius $r$ with uniform speed $v$. The magnitude of its centripetal acceleration is`;

function cleanChemicalFormulas(input: string): string {
  let s = input;

  s = s.replace(
    /\$([^\$\n]*\b(?:if|the|of|and|or|in|is|are|was|were|then|when|moles|product|equilibrium|constant|increased|decreased|volume|temperature|pressure|number|formed|at|by|decreasing|with|to|for|a|an|only)\b[^\$\n]*)\$/gi,
    (_m, inner) => {
      return inner.replace(
        /(?<!\$)\\(sigma|pi|alpha|beta|gamma|delta|theta|lambda|mu|nu|omega|phi|psi|rho|tau|eta|zeta|kappa|chi|epsilon|Delta|Gamma|Theta|Lambda|Sigma|Omega|frac|sqrt)\b(?!\$)/g,
        (__m: string, g: string) => \`$\\\${g}$\`
      );
    }
  );

  return s;
}

function sanitizeRich(input: string): string {
  let s = input.replace(/\\\\/g, "\\");
  s = cleanChemicalFormulas(s);

  s = s.replace(/\$\$([^\$\n]+)\$/g, (_m, inner) => \`$\${inner.trim()}\$\`);
  s = s.replace(/\$([^\$\n]+)\$\$/g, (_m, inner) => \`$\${inner.trim()}\$\`);

  const parts: Array<{ math: boolean; text: string }> = [];
  const mathRe = /(\$\$[\s\S]+?\$\$|\$[^\n$]+?\$|\`[^\`\n]+\`|\`\`\`[\s\S]*?\`\`\`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = mathRe.exec(s)) !== null) {
    if (m.index > last) parts.push({ math: false, text: s.slice(last, m.index) });
    parts.push({ math: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ math: false, text: s.slice(last) });

  const bareLatexRe =
    /(\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\frac\{[^{}]*\}\{[^{}]*\}|\\sqrt(?:\[[^\]]*\])?\{[^{}]*\}|\\vec\{[^{}]*\}|\\text\{[^{}]*\}|\\(?:right|left|Right|Left)*arrow\b|\\(?:cdot|times|pm|mp|infty|degree|alpha|beta|gamma|delta|theta|pi|mu|lambda|sigma|omega|Delta)\b)/g;

  const fixed = parts.map((p) => {
    if (p.math) return p.text;
    let t = p.text;
    t = t.replace(
      /\\(\s*(\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})\\s*\\)/g,
      (_m, inner: string) => \`$\${inner}\$\`,
    );
    t = t.replace(bareLatexRe, (match) => \`$\${match}\$\`);
    t = t.replace(/\\[,;:!]/g, " ").replace(/\\q?quad\b/g, " ");
    t = t.replace(/\\([%$#&_])/g, "$1");
    t = t.replace(/\\\\(?=\s|$)/g, "  \n");
    t = t.replace(/(?<!  )\n(?!\n)/g, "  \n");
    return t;
  });

  return fixed.join("");
}

console.log("Original:", input);
console.log("Repaired:", repairLatex(input));
console.log("Sanitized:", sanitizeRich(repairLatex(input)));
