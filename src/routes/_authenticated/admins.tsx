import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, KeyRound, ShieldCheck, UserPlus, Loader2 } from "lucide-react";
import {
  createAdminAccount,
  deleteAdminAccount,
  listAdminAccounts,
  resetAdminPassword,
  getMyAdminIdentity,
} from "@/lib/super-admin.functions";

export const Route = createFileRoute("/_authenticated/admins")({
  head: () => ({
    meta: [
      { title: "Admins — ExamPrep" },
      { name: "description", content: "Manage admin accounts for your workspace." },
      { property: "og:title", content: "Admins — ExamPrep" },
      { property: "og:description", content: "Manage admin accounts for your workspace." },
    ],
  }),
  component: AdminsPage,
});

type Admin = {
  id: string;
  email: string | null;
  full_name: string | null;
  admin_code: string | null;
  is_super_admin: boolean;
};

function AdminsPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Awaited<ReturnType<typeof getMyAdminIdentity>> | null>(null);
  const [rows, setRows] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const identity = await getMyAdminIdentity();
      setMe(identity);
      if (!identity.is_super_admin) {
        toast.error("Super admin only");
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      const list = (await listAdminAccounts()) as Admin[];
      setRows(list);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    if (!name.trim() || !email.trim() || !password) return toast.error("All fields required");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    try {
      const created = await createAdminAccount({
        data: { full_name: name.trim(), email: email.trim(), password },
      });
      toast.success(`Admin created — ID ${created?.admin_code}`);
      setName("");
      setEmail("");
      setPassword("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success(`Copied ${v}`);
  };

  const remove = async (a: Admin) => {
    if (!confirm(`Delete admin ${a.full_name} (${a.admin_code})? Their data will be removed.`))
      return;
    try {
      await deleteAdminAccount({ data: { userId: a.id } });
      toast.success("Admin deleted");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doReset = async (a: Admin) => {
    const pw = resetting[a.id];
    if (!pw || pw.length < 6) return toast.error("New password must be at least 6 characters");
    try {
      await resetAdminPassword({ data: { userId: a.id, password: pw } });
      toast.success(`Password reset for ${a.full_name}`);
      setResetting((r) => ({ ...r, [a.id]: "" }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading) {
    return (
      <AppShell title="Admins">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admins">
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Admin accounts</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
              />
            </div>
            <Button onClick={create} disabled={busy} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              {busy ? "Creating…" : "Create admin"}
            </Button>
            <p className="text-xs text-muted-foreground">
              A unique admin ID (ADM-XXXXXX) is generated. They can sign in with the ID or
              their email. Each admin's data is fully isolated from every other admin.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All admins ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-border p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{a.full_name}</span>
                      {a.is_super_admin && (
                        <Badge variant="default" className="gap-1">
                          <ShieldCheck className="h-3 w-3" /> Super admin
                        </Badge>
                      )}
                      {a.id === me?.id && <Badge variant="secondary">You</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.email}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => a.admin_code && copy(a.admin_code)}
                      className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 font-mono text-sm font-semibold tracking-wider"
                    >
                      {a.admin_code} <Copy className="h-3.5 w-3.5" />
                    </button>
                    {!a.is_super_admin && a.id !== me?.id && (
                      <Button variant="ghost" size="sm" onClick={() => remove(a)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {!a.is_super_admin && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Label className="text-xs">Set new password</Label>
                      <Input
                        type="password"
                        placeholder="New password"
                        value={resetting[a.id] ?? ""}
                        onChange={(e) =>
                          setResetting((r) => ({ ...r, [a.id]: e.target.value }))
                        }
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => doReset(a)}>
                      <KeyRound className="mr-1 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
