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
      {/* Grid of Exam Patterns — single column on mobile, 2 on sm+ */}
      <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const isActive = pattern === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setPattern(o.id)}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl border p-3 sm:p-3.5 sm:flex-col sm:items-stretch text-left transition-all duration-200",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40"
                  : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30"
              )}
            >
              <div className="flex-1 min-w-0">
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
                <div className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-none">
                  {o.desc}
                </div>
                <div className="mt-1.5 sm:mt-2.5 flex items-center gap-1.5">
                  <Badge variant={isActive ? "default" : "outline"} className="text-[10px] font-mono font-medium">
                    {o.tag}
                  </Badge>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Config Details */}
      {config && (
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3 sm:p-3.5 space-y-3.5">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {pattern === "custom" ? "Custom Config" : `${PATTERN_PRESETS[pattern as Exclude<ExamPattern, "custom">].label} Breakdown`}
              </span>
            </div>
            <Badge variant="secondary" className="font-mono text-xs w-fit">
              {totalQuestions(config)} Qs · {totalMarks(config)} Marks
            </Badge>
          </div>

          <div className="grid gap-3 grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Duration (min)
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
              <Label className="text-xs text-muted-foreground">−ve marking</Label>
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
              <Label className="text-xs font-medium">Subjects</Label>
              {!readonly && (
                <Button type="button" variant="outline" size="sm" onClick={addSection} className="h-7 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {config.sections.map((s, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border border-border/60 bg-background p-2.5 text-xs",
                    "flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_75px_75px_auto] sm:items-center sm:gap-2"
                  )}
                >
                  <Input
                    value={s.name}
                    onChange={(e) => patchSection(i, { name: e.target.value })}
                    disabled={readonly}
                    className="h-9 text-sm font-medium sm:h-8 sm:text-xs"
                    placeholder="Subject name"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex-1 sm:flex-none">
                      <span className="text-[10px] text-muted-foreground mb-0.5 block sm:hidden">Questions</span>
                      <NumberField value={s.count} onChange={(n) => patchSection(i, { count: n })} min={0} fallback={0} disabled={readonly} className="h-9 text-sm sm:h-8 sm:text-xs" />
                    </div>
                    <div className="flex-1 sm:flex-none">
                      <span className="text-[10px] text-muted-foreground mb-0.5 block sm:hidden">Marks/Q</span>
                      <NumberField value={s.marks_per_q} onChange={(n) => patchSection(i, { marks_per_q: n })} min={0} step={0.25} fallback={1} disabled={readonly} className="h-9 text-sm sm:h-8 sm:text-xs" />
                    </div>
                    {!readonly ? (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeSection(i)} className="h-9 w-9 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <span className="text-[11px] font-mono text-muted-foreground px-1 shrink-0">{s.count} Qs</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
