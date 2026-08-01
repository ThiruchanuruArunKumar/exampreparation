/**
 * Official TS Board (Telangana Intermediate Public Examination) paper blueprints.
 *
 * Science subjects (Physics, Chemistry, Botany, Zoology) — 3 hours, 60 marks
 *   Section A : 10 VSAQ x 2 marks  (answer ALL)          = 20
 *   Section B :  8 SAQ  x 4 marks  (answer ANY 6)        = 24
 *   Section C :  3 LAQ  x 8 marks  (answer ANY 2)        = 16
 *
 * Mathematics (1A, 1B, 2A, 2B) — 3 hours, 75 marks
 *   Section A : 10 VSAQ x 2 marks  (answer ALL)          = 20
 *   Section B :  7 SAQ  x 4 marks  (answer ANY 5)        = 20
 *   Section C :  7 LAQ  x 7 marks  (answer ANY 5)        = 35
 */

export type IpeQuestionType = "very_short_answer" | "short_answer" | "long_answer";

export type IpeBlueprintSection = {
  key: IpeQuestionType;
  /** Display name shown in the question palette and paper header */
  name: string;
  /** How many questions are PRINTED on the paper */
  count: number;
  /** Marks per question */
  marks_per_q: number;
  /** How many the student must answer (choice) */
  attempt_limit: number;
};

export type IpeBlueprint = {
  id: "science" | "maths";
  label: string;
  duration_minutes: number;
  total_marks: number;
  sections: IpeBlueprintSection[];
};

export const IPE_BLUEPRINTS: Record<IpeBlueprint["id"], IpeBlueprint> = {
  science: {
    id: "science",
    label: "Science (Physics / Chemistry / Botany / Zoology)",
    duration_minutes: 180,
    total_marks: 60,
    sections: [
      { key: "very_short_answer", name: "Section A — Very Short Answer (VSAQ)", count: 10, marks_per_q: 2, attempt_limit: 10 },
      { key: "short_answer", name: "Section B — Short Answer (SAQ)", count: 8, marks_per_q: 4, attempt_limit: 6 },
      { key: "long_answer", name: "Section C — Long Answer (LAQ)", count: 3, marks_per_q: 8, attempt_limit: 2 },
    ],
  },
  maths: {
    id: "maths",
    label: "Mathematics (1A / 1B / 2A / 2B)",
    duration_minutes: 180,
    total_marks: 75,
    sections: [
      { key: "very_short_answer", name: "Section A — Very Short Answer (VSAQ)", count: 10, marks_per_q: 2, attempt_limit: 10 },
      { key: "short_answer", name: "Section B — Short Answer (SAQ)", count: 7, marks_per_q: 4, attempt_limit: 5 },
      { key: "long_answer", name: "Section C — Long Answer (LAQ)", count: 7, marks_per_q: 7, attempt_limit: 5 },
    ],
  },
};

/** Pick the official blueprint that applies to a TS Inter subject name. */
export function blueprintForSubject(subjectName: string | null | undefined): IpeBlueprint {
  const n = (subjectName ?? "").toLowerCase();
  if (n.includes("math")) return IPE_BLUEPRINTS.maths;
  return IPE_BLUEPRINTS.science;
}

export function blueprintMaxMarks(bp: IpeBlueprint): number {
  return bp.sections.reduce((n, s) => n + s.attempt_limit * s.marks_per_q, 0);
}

export function sectionLabel(type: IpeQuestionType): string {
  if (type === "very_short_answer") return "VSAQ";
  if (type === "short_answer") return "SAQ";
  return "LAQ";
}
