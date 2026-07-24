import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type Ctx = { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void };

const ThemeContext = createContext<Ctx | null>(null);

function readInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("theme") as Theme | null;
  if (saved === "light" || saved === "dark") return saved;
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const t = readInitial();
    setThemeState(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.classList.toggle("dark", t === "dark");
    try { window.localStorage.setItem("theme", t); } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme(theme === "dark" ? "light" : "dark"), setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { theme: "light" as Theme, toggle: () => {}, setTheme: () => {} };
  return ctx;
}
