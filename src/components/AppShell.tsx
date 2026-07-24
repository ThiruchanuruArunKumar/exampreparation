import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LogOut,
  LayoutDashboard,
  Users,
  ClipboardList,
  ShieldCheck,
  Copy,
  GraduationCap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

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

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const navItem = (to: string, icon: ReactNode, label: string) => (
    <Link
      to={to}
      className={`group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
        isActive(to)
          ? "bg-primary/10 text-primary shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
      {isActive(to) && (
        <span className="absolute inset-x-3 -bottom-[9px] hidden h-0.5 rounded-full bg-gradient-primary md:block" />
      )}
    </Link>
  );

  const NavLinks = (
    <>
      {navItem("/dashboard", <LayoutDashboard className="h-4 w-4" />, "Exams")}
      {navItem("/students", <Users className="h-4 w-4" />, "Students")}
      {navItem("/results", <ClipboardList className="h-4 w-4" />, "Results")}
      {identity?.is_super_admin && navItem("/admins", <ShieldCheck className="h-4 w-4" />, "Admins")}
    </>
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Ambient gradient background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-hero"
      />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 lg:gap-8">
            <Link to="/dashboard" className="group flex shrink-0 items-center gap-2.5">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant transition-transform group-hover:scale-105">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
                <span className="absolute inset-0 rounded-xl bg-gradient-primary opacity-0 blur-lg transition-opacity group-hover:opacity-70" />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">
                Exam<span className="text-gradient">Prep</span>
              </span>
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
                className="hidden items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-mono font-semibold tracking-wider transition-colors hover:bg-muted hover:text-primary sm:flex"
              >
                {identity.admin_code}
                <Copy className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            {identity?.is_super_admin && (
              <Badge className="hidden gap-1 border-0 bg-gradient-primary text-primary-foreground shadow-sm sm:inline-flex">
                <ShieldCheck className="h-3 w-3" /> Super
              </Badge>
            )}
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-3 py-2 md:hidden">
          {NavLinks}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl animate-fade-in-up px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
