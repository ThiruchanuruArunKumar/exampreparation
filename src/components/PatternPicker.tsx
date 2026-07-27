import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NumberField } from "@/components/NumberField";
import { Trash2, Plus, Check, Clock, BookOpen } from "lucide-react";
import {
  type ExamPattern,
  type PatternConfig,
  PATTERN_PRESETS,
  presetToConfig,
  totalMarks,
  totalQuestions,
} from "@/lib/exam-patterns";
import { cn } from "@/lib/utils";

type Props = {
  pattern: ExamPattern;
  config: PatternConfig | null;
  onChange: (p: ExamPattern, cfg: PatternConfig | null) => void;
};

const OPTIONS: { id: ExamPattern; label: string; tag: string; desc: string }[] = [
  { id: "neet", label: "NEET", tag: "200 Qs · 200 min", desc: PATTERN_PRESETS.neet.description },
  { id: "eamcet", label: "AP/TS EAMCET (Engg)", tag: "160 Qs · 180 min", desc: PATTERN_PRESETS.eamcet.description },
  { id: "ts_eamcet_bipc", label: "TS EAMCET (BiPC)", tag: "160 Qs · 180 min", desc: PATTERN_PRESETS.ts_eamcet_bipc.description },
  { id: "mains", label: "JEE Main", tag: "75 Qs · 180 min", desc: PATTERN_PRESETS.mains.description },
  { id: "custom", label: "Custom Pattern", tag: "Editable", desc: "Set your own subjects, question counts, timing, and negative marking." },
];

export function PatternPicker({ pattern, config, onChange }: Props) {
  const setPattern = (p: ExamPattern) => {
    if (p === "custom") {
      onChange(p, config ?? { sections: [{ name: "Section 1", count: 10, marks_per_q: 1 }], negative_mark_per_wrong: 0, duration_minutes: 60 });
    } else {
      onChange(p, presetToConfig(p));
    }
  };

  const patchCfg = (p: Partial<PatternConfig>) => {
    onChange(pattern, { ...(config as PatternConfig), ...p });
  };
  const patchSection = (i: number, s: Partial<PatternConfig["sections"][number]>) => {
    if (!config) return;
    const next = config.sections.map((x, j) => (j === i ? { ...x, ...s } : x));
    patchCfg({ sections: next });
  };
  const addSection = () => {
    if (!config) return;
    patchCfg({ sections: [...config.sections, { name: `Section ${config.sections.length + 1}`, count: 10, marks_per_q: 1 }] });
  };
  const removeSection = (i: number) => {
    if (!config) return;
    patchCfg({ sections: config.sections.filter((_, j) => j !== i) });
  };

  const readonly = pattern !== "custom";

  return (
    <div className="space-y-4">
      {/* Grid of Exam Patterns */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const isActive = pattern === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setPattern(o.id)}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-200",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40"
                  : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30"
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                    {o.label}
                  </span>
                  {isActive && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  {o.desc}
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-1.5">
                <Badge variant={isActive ? "default" : "outline"} className="text-[10px] font-mono font-medium">
                  {o.tag}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>

      {/* Config Details Header */}
      {config && (
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {pattern === "custom" ? "Custom Pattern Config" : `${PATTERN_PRESETS[pattern as Exclude<ExamPattern, "custom">].label} Breakdown`}
              </span>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {totalQuestions(config)} Qs · {totalMarks(config)} Marks
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Duration (minutes)
              </Label>
              <NumberField
                value={config.duration_minutes}
                onChange={(n) => patchCfg({ duration_minutes: n })}
                min={1}
                fallback={60}
                disabled={readonly}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Negative marking per wrong</Label>
              <NumberField
                value={config.negative_mark_per_wrong}
                onChange={(n) => patchCfg({ negative_mark_per_wrong: n })}
                min={0}
                step={0.25}
                fallback={0}
                disabled={readonly}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs font-medium">Subject Sections</Label>
              {!readonly && (
                <Button type="button" variant="outline" size="sm" onClick={addSection} className="h-7 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Add Section
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {config.sections.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_75px_75px_auto] items-center gap-2 rounded-lg border border-border/60 bg-background p-2 text-xs">
                  <Input value={s.name} onChange={(e) => patchSection(i, { name: e.target.value })} disabled={readonly} className="h-8 text-xs font-medium" />
                  <NumberField value={s.count} onChange={(n) => patchSection(i, { count: n })} min={0} fallback={0} disabled={readonly} className="h-8 text-xs" />
                  <NumberField value={s.marks_per_q} onChange={(n) => patchSection(i, { marks_per_q: n })} min={0} step={0.25} fallback={1} disabled={readonly} className="h-8 text-xs" />
                  {!readonly ? (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSection(i)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span className="text-[10px] font-mono text-muted-foreground px-1">{s.count} Qs</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
