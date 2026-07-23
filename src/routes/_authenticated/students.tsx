import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Copy, Pencil, X, Save } from "lucide-react";
import {
  listAllStudents,
  createStudent,
  updateStudent,
  deleteStudentRecord,
} from "@/lib/admin.functions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students — ExamPrep" },
      { name: "description", content: "Create student IDs. Students don't need to log in." },
      { property: "og:title", content: "Students — ExamPrep" },
      { property: "og:description", content: "Create student IDs. Students don't need to log in." },
    ],
  }),
  component: StudentsPage,
});

type Row = {
  id: string;
  student_code: string;
  name: string;
  email: string | null;
  class_name: string | null;
  notes: string | null;
  attemptCount: number;
  averagePercent: number;
  created_at: string;
};

function StudentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cls, setCls] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Record<string, Partial<Row>>>({});

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
  useRealtimeSync(["students", "attempts"], load);

  const create = async () => {
    if (!name.trim()) return toast.error("Name required");
    setBusy(true);
    try {
      const r = await createStudent({
        data: { name: name.trim(), email: email.trim(), class_name: cls.trim(), notes: notes.trim() },
      });
      toast.success(`Created ${r.student_code}`);
      setName("");
      setEmail("");
      setCls("");
      setNotes("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete ${r.name} (${r.student_code})? All their attempts will be removed.`)) return;
    try {
      await deleteStudentRecord({ data: { id: r.id } });
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success(`Copied ${v}`);
  };

  const saveEdit = async (r: Row) => {
    const patch = editing[r.id] ?? {};
    try {
      await updateStudent({
        data: {
          id: r.id,
          name: (patch.name ?? r.name) as string,
          email: (patch.email ?? r.email ?? "") as string,
          class_name: (patch.class_name ?? r.class_name ?? "") as string,
          notes: (patch.notes ?? r.notes ?? "") as string,
        },
      });
      toast.success("Saved");
      setEditing((e) => {
        const n = { ...e };
        delete n[r.id];
        return n;
      });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title="Students">
      <h1 className="mb-6 text-2xl font-semibold">Students</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Class / Group</Label>
              <Input value={cls} onChange={(e) => setCls(e.target.value)} placeholder="e.g. Grade 10-A" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <Button onClick={create} disabled={busy} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              {busy ? "Creating…" : "Create student"}
            </Button>
            <p className="text-xs text-muted-foreground">
              A unique student ID is generated. Share it plus the exam password with the student — no login needed.
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
              <p className="text-sm text-muted-foreground">No students yet.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => {
                  const isEdit = !!editing[r.id];
                  const patch = editing[r.id] ?? {};
                  return (
                    <div key={r.id} className="rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {isEdit ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Input
                                value={(patch.name ?? r.name) as string}
                                onChange={(e) => setEditing((s) => ({ ...s, [r.id]: { ...s[r.id], name: e.target.value } }))}
                                placeholder="Name"
                              />
                              <Input
                                value={(patch.email ?? r.email ?? "") as string}
                                onChange={(e) => setEditing((s) => ({ ...s, [r.id]: { ...s[r.id], email: e.target.value } }))}
                                placeholder="Email"
                              />
                              <Input
                                value={(patch.class_name ?? r.class_name ?? "") as string}
                                onChange={(e) => setEditing((s) => ({ ...s, [r.id]: { ...s[r.id], class_name: e.target.value } }))}
                                placeholder="Class"
                              />
                              <Input
                                value={(patch.notes ?? r.notes ?? "") as string}
                                onChange={(e) => setEditing((s) => ({ ...s, [r.id]: { ...s[r.id], notes: e.target.value } }))}
                                placeholder="Notes"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                <span>{r.name}</span>
                                {r.class_name && <Badge variant="secondary">{r.class_name}</Badge>}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {r.email ?? "no email"} · {r.attemptCount} attempt{r.attemptCount === 1 ? "" : "s"}
                                {r.attemptCount > 0 && ` · avg ${r.averagePercent}%`}
                              </div>
                              {r.notes && <div className="mt-1 text-xs text-muted-foreground">{r.notes}</div>}
                            </>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          {isEdit ? (
                            <>
                              <Button size="sm" onClick={() => saveEdit(r)}>
                                <Save className="mr-1 h-4 w-4" />Save
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() =>
                                setEditing((s) => { const n = { ...s }; delete n[r.id]; return n; })
                              }>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => setEditing((s) => ({ ...s, [r.id]: {} }))}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => remove(r)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">Student ID</div>
                          <div className="font-mono text-sm font-bold tracking-wider">{r.student_code}</div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => copy(r.student_code)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
