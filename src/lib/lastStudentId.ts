export const LAST_STUDENT_ID_KEY = "examprep:studentCode";

export function getLastStudentId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(LAST_STUDENT_ID_KEY);
    return v ? v.toUpperCase() : null;
  } catch {
    return null;
  }
}

export function setLastStudentId(code: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_STUDENT_ID_KEY, code.toUpperCase());
  } catch {
    /* ignore */
  }
}

export function clearLastStudentId() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LAST_STUDENT_ID_KEY);
  } catch {
    /* ignore */
  }
}
