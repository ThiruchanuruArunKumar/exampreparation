import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Brain, LogOut, LayoutDashboard, Users, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [role, setRole] = useState<"admin" | "student" | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .maybeSingle();
      setRole((data?.role as "admin" | "student") ?? "student");
    })();
  }, []);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const navLink = "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <Link to="/dashboard" className="flex shrink-0 items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <span className="font-semibold">ExamPrep</span>
            </Link>
            {role === "admin" && (
              <nav className="hidden items-center gap-1 text-sm md:flex">
                <Link to="/dashboard" className={navLink}><LayoutDashboard className="h-4 w-4" /> Exams</Link>
                <Link to="/students" className={navLink}><Users className="h-4 w-4" /> Students</Link>
                <Link to="/results" className={navLink}><ClipboardList className="h-4 w-4" /> Results</Link>
              </nav>
            )}
            {title && <span className="hidden truncate text-sm text-muted-foreground sm:inline">{title}</span>}
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="shrink-0">
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
        {role === "admin" && (
          <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 text-sm md:hidden">
            <Link to="/dashboard" className={navLink}><LayoutDashboard className="h-4 w-4" /> Exams</Link>
            <Link to="/students" className={navLink}><Users className="h-4 w-4" /> Students</Link>
            <Link to="/results" className={navLink}><ClipboardList className="h-4 w-4" /> Results</Link>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
