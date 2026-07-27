export const LAST_STUDENT_ID_KEY = "examprep:studentCode";

export function getRecentStudentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = localStorage.getItem(LAST_STUDENT_ID_KEY);
    if (!v) return [];
    if (v.startsWith("[")) {
      return JSON.parse(v).filter((x: unknown) => typeof x === "string");
    }
    return [v.toUpperCase()];
  } catch {
    return [];
  }
}

export function getLastStudentId(): string | null {
  const recent = getRecentStudentIds();
  return recent.length > 0 ? recent[0] : null;
}

export function setLastStudentId(code: string) {
  if (typeof window === "undefined" || !code.trim()) return;
  try {
    const codeUp = code.toUpperCase().trim();
    let recent = getRecentStudentIds();
    recent = recent.filter(x => x !== codeUp);
    recent.unshift(codeUp);
    if (recent.length > 5) recent = recent.slice(0, 5);
    localStorage.setItem(LAST_STUDENT_ID_KEY, JSON.stringify(recent));
  } catch {
    /* ignore */
  }
}

export function removeRecentStudentId(code: string) {
  if (typeof window === "undefined") return;
  try {
    const codeUp = code.toUpperCase().trim();
    let recent = getRecentStudentIds();
    recent = recent.filter(x => x !== codeUp);
    if (recent.length === 0) {
      localStorage.removeItem(LAST_STUDENT_ID_KEY);
    } else {
      localStorage.setItem(LAST_STUDENT_ID_KEY, JSON.stringify(recent));
    }
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
