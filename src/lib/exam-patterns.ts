export type ExamPattern = "neet" | "eamcet" | "ts_eamcet_bipc" | "mains" | "custom";

export type PatternSection = {
  name: string;
  count: number;
  marks_per_q: number;
  subsections?: {
    name: string;
    count: number;
    attempt_limit?: number;
  }[];
};

export type PatternConfig = {
  sections: PatternSection[];
  negative_mark_per_wrong: number;
  duration_minutes: number;
  notes?: string;
};

export const PATTERN_PRESETS: Record<Exclude<ExamPattern, "custom">, PatternConfig & { label: string; description: string }> = {
  neet: {
    label: "NEET",
    description: "200 min · 200 questions (attempt 180) · +4 / −1 · Physics, Chemistry, Botany, Zoology",
    duration_minutes: 200,
    negative_mark_per_wrong: 1,
    sections: [
      {
        name: "Physics",
        count: 50,
        marks_per_q: 4,
        subsections: [
          { name: "Section A", count: 35, attempt_limit: 35 },
          { name: "Section B", count: 15, attempt_limit: 10 }
        ]
      },
      {
        name: "Chemistry",
        count: 50,
        marks_per_q: 4,
        subsections: [
          { name: "Section A", count: 35, attempt_limit: 35 },
          { name: "Section B", count: 15, attempt_limit: 10 }
        ]
      },
      {
        name: "Botany",
        count: 50,
        marks_per_q: 4,
        subsections: [
          { name: "Section A", count: 35, attempt_limit: 35 },
          { name: "Section B", count: 15, attempt_limit: 10 }
        ]
      },
      {
        name: "Zoology",
        count: 50,
        marks_per_q: 4,
        subsections: [
          { name: "Section A", count: 35, attempt_limit: 35 },
          { name: "Section B", count: 15, attempt_limit: 10 }
        ]
      },
    ],
    notes: "NEET UG official 200 questions paper. Section A (35 questions) + Section B (15 questions, attempt 10). 4 options each.",
  },
  eamcet: {
    label: "AP/TS EAMCET",
    description: "180 min · 160 questions · +1 / 0 · Maths 80, Physics 40, Chemistry 40",
    duration_minutes: 180,
    negative_mark_per_wrong: 0,
    sections: [
      { name: "Mathematics", count: 80, marks_per_q: 1 },
      { name: "Physics", count: 40, marks_per_q: 1 },
      { name: "Chemistry", count: 40, marks_per_q: 1 },
    ],
    notes: "EAMCET (Engineering) single-correct MCQs. Intermediate 1st & 2nd year syllabus. 4 options each.",
  },
  ts_eamcet_bipc: {
    label: "TS EAMCET (BIPC)",
    description: "180 min · 160 questions · +1 / 0 · Botany 40, Zoology 40, Physics 40, Chemistry 40",
    duration_minutes: 180,
    negative_mark_per_wrong: 0,
    sections: [
      { name: "Botany", count: 40, marks_per_q: 1 },
      { name: "Zoology", count: 40, marks_per_q: 1 },
      { name: "Physics", count: 40, marks_per_q: 1 },
      { name: "Chemistry", count: 40, marks_per_q: 1 },
    ],
    notes: "TS EAMCET (Agriculture & Medical / BIPC stream) single-correct MCQs. Intermediate 1st & 2nd year syllabus. 4 options each.",
  },
  mains: {
    label: "JEE Main",
    description: "180 min · 75 questions · +4 / −1 · Physics, Chemistry, Maths",
    duration_minutes: 180,
    negative_mark_per_wrong: 1,
    sections: [
      { name: "Physics", count: 25, marks_per_q: 4 },
      { name: "Chemistry", count: 25, marks_per_q: 4 },
      { name: "Mathematics", count: 25, marks_per_q: 4 },
    ],
    notes: "JEE Main-style single-correct MCQs (numerical items rendered as short answers). Class 11 & 12 CBSE syllabus.",
  },
};

export function presetToConfig(pattern: ExamPattern): PatternConfig | null {
  if (pattern === "custom") return null;
  const p = PATTERN_PRESETS[pattern];
  return {
    duration_minutes: p.duration_minutes,
    negative_mark_per_wrong: p.negative_mark_per_wrong,
    sections: p.sections.map((s) => ({ ...s, subsections: s.subsections ? s.subsections.map(sub => ({ ...sub })) : undefined })),
    notes: p.notes,
  };
}

export function totalQuestions(cfg: PatternConfig | null | undefined): number {
  if (!cfg) return 0;
  return cfg.sections.reduce((n, s) => {
    if (s.subsections) {
      return n + s.subsections.reduce((subN, sub) => subN + (Number(sub.count) || 0), 0);
    }
    return n + (Number(s.count) || 0);
  }, 0);
}
export function totalMarks(cfg: PatternConfig | null | undefined): number {
  if (!cfg) return 0;
  return cfg.sections.reduce((n, s) => {
    if (s.subsections) {
      const qsToAttempt = s.subsections.reduce((subN, sub) => subN + Math.min(Number(sub.count) || 0, Number(sub.attempt_limit) || Number(sub.count) || 0), 0);
      return n + (qsToAttempt * (Number(s.marks_per_q) || 0));
    }
    return n + ((Number(s.count) || 0) * (Number(s.marks_per_q) || 0));
  }, 0);
}

export function patternLabel(p: ExamPattern): string {
  if (p === "custom") return "Custom";
  return PATTERN_PRESETS[p].label;
}
