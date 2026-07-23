import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Brain, Loader2 } from "lucide-react";
import { resolveLoginEmail } from "@/lib/super-admin.functions";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next:
      typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
        ? s.next
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Admin sign in — ExamPrep" },
      { name: "description", content: "Sign in to your ExamPrep admin workspace." },
      { property: "og:title", content: "Admin sign in — ExamPrep" },
      { property: "og:description", content: "Sign in to your ExamPrep admin workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const goNext = () => {
    if (next) window.location.replace(next);
    else navigate({ to: "/dashboard", replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { email } = await resolveLoginEmail({ data: { identifier } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      goNext();
    } catch (err) {
      toast.error((err as Error).message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) toast.error(res.error.message ?? "Google sign-in failed");
    else if (!res.redirected) goNext();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">ExamPrep</span>
          </div>
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
        </div>

        <h1 className="text-xl font-semibold">Admin sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your admin ID (e.g. <span className="font-mono">ADM-XXXXXX</span>) or email.
        </p>

        <form onSubmit={handleSignIn} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="id">Admin ID or email</Label>
            <Input
              id="id"
              required
              autoComplete="username"
              placeholder="ADM-XXXXXX or you@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogle}>
          Continue with Google
        </Button>

        <p className="mt-6 text-xs text-muted-foreground">
          New admin accounts can only be created by the super admin from the Admins page.
        </p>
      </div>
    </div>
  );
}
