import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Shield, GraduationCap, Check, X, Clock } from "lucide-react";
import {
  listAllStudents,
  inviteStudent,
  setUserRole,
  deleteStudent,
  setStudentStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students — ExamPrep" },
      { name: "description", content: "Manage students, invite new members, and assign roles." },
      { property: "og:title", content: "Students — ExamPrep" },
      { property: "og:description", content: "Manage students, invite new members, and assign roles." },
    ],
  }),
  component: StudentsPage,
});

type Row = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "student";
  status: "pending" | "approved" | "rejected";
  attemptCount: number;
  averagePercent: number;
  created_at: string;
};

function StudentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = (await listAllStudents()) as Row[];
      setRows(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const invite = async () => {
    if (!email) return toast.error("Enter an email");
    setBusy(true);
    try {
      await inviteStudent({ data: { email, fullName: name || undefined } });
      toast.success("Invitation sent");
      setEmail("");
      setName("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleRole = async (r: Row) => {
    const newRole = r.role === "admin" ? "student" : "admin";
    if (!confirm(`Change ${r.email} to ${newRole}?`)) return;
    try {
      await setUserRole({ data: { userId: r.id, role: newRole } });
      toast.success("Role updated");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete ${r.email}? This cannot be undone.`)) return;
    try {
      await deleteStudent({ data: { userId: r.id } });
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title="Students">
      <h1 className="mb-6 text-2xl font-semibold">Members</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite new student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" />
            </div>
            <div>
              <Label>Full name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button onClick={invite} disabled={busy} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              {busy ? "Sending…" : "Send invitation"}
            </Button>
            <p className="text-xs text-muted-foreground">
              An email invite is sent. On first sign-in they join as a student.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roster ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="truncate">{r.full_name || r.email}</span>
                        {r.role === "admin" ? (
                          <Badge><Shield className="mr-1 h-3 w-3" />Admin</Badge>
                        ) : (
                          <Badge variant="secondary"><GraduationCap className="mr-1 h-3 w-3" />Student</Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.email} · {r.attemptCount} attempt{r.attemptCount === 1 ? "" : "s"}
                        {r.attemptCount > 0 && ` · avg ${r.averagePercent}%`}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleRole(r)}>
                        {r.role === "admin" ? "Make student" : "Make admin"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(r)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
