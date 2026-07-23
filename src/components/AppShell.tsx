import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LogOut,
  LayoutDashboard,
  Users,
  ClipboardList,
  ShieldCheck,
  Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Identity = {
  admin_code: string | null;
  full_name: string | null;
  is_super_admin: boolean;
};

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("admin_code, full_name")
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      setIdentity({
        admin_code: profile?.admin_code ?? null,
        full_name: profile?.full_name ?? null,
        is_super_admin: (roles ?? []).some((r) => r.role === "super_admin"),
      });
    })();
  }, []);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const copyCode = () => {
    if (!identity?.admin_code) return;
    navigator.clipboard.writeText(identity.admin_code);
    toast.success(`Copied ${identity.admin_code}`);
  };

  const navLink =
    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";

  const NavLinks = (
    <>
      <Link to="/dashboard" className={navLink}>
        <LayoutDashboard className="h-4 w-4" /> Exams
      </Link>
      <Link to="/students" className={navLink}>
        <Users className="h-4 w-4" /> Students
      </Link>
      <Link to="/results" className={navLink}>
        <ClipboardList className="h-4 w-4" /> Results
      </Link>
      {identity?.is_super_admin && (
        <Link to="/admins" className={navLink}>
          <ShieldCheck className="h-4 w-4" /> Admins
        </Link>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 lg:gap-8">
            <Link to="/dashboard" className="flex shrink-0 items-center gap-2">
              <img src="/logo.png" alt="ExamPrep" width={28} height={28} className="h-7 w-7" />
              <span className="font-semibold tracking-tight">ExamPrep</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">{NavLinks}</nav>
            {title && (
              <span className="hidden truncate text-sm text-muted-foreground lg:inline">
                {title}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {identity?.admin_code && (
              <button
                onClick={copyCode}
                title="Your admin ID"
                className="hidden items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-mono font-semibold tracking-wider hover:bg-muted sm:flex"
              >
                {identity.admin_code}
                <Copy className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            {identity?.is_super_admin && (
              <Badge variant="default" className="hidden gap-1 sm:inline-flex">
                <ShieldCheck className="h-3 w-3" /> Super
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
          {NavLinks}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
