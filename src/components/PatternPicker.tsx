import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/NumberField";
import { Trash2, Plus } from "lucide-react";
import {
  type ExamPattern,
  type PatternConfig,
  PATTERN_PRESETS,
  presetToConfig,
  totalMarks,
  totalQuestions,
} from "@/lib/exam-patterns";

type Props = {
  pattern: ExamPattern;
  config: PatternConfig | null;
  onChange: (p: ExamPattern, cfg: PatternConfig | null) => void;
};

const OPTIONS: { id: ExamPattern; label: string; desc: string }[] = [
  { id: "neet", label: "NEET", desc: PATTERN_PRESETS.neet.description },
  { id: "eamcet", label: "AP/TS EAMCET (Engg)", desc: PATTERN_PRESETS.eamcet.description },
  { id: "ts_eamcet_bipc", label: "TS EAMCET (BIPC)", desc: PATTERN_PRESETS.ts_eamcet_bipc.description },
  { id: "mains", label: "JEE Main", desc: PATTERN_PRESETS.mains.description },
  { id: "custom", label: "Custom", desc: "Set your own subjects, marks, timing, negatives." },
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
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setPattern(o.id)}
            className={`rounded-lg border p-3 text-left transition ${pattern === o.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
          >
            <div className="font-semibold">{o.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{o.desc}</div>
          </button>
        ))}
      </div>

      {config && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {pattern === "custom" ? "Custom configuration" : `${PATTERN_PRESETS[pattern as "neet" | "eamcet" | "mains"].label} configuration`}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {totalQuestions(config)} questions · {totalMarks(config)} marks
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Duration (minutes)</Label>
                <NumberField
                  value={config.duration_minutes}
                  onChange={(n) => patchCfg({ duration_minutes: n })}
                  min={1}
                  fallback={60}
                  disabled={readonly}
                />
              </div>
              <div>
                <Label>Negative marks per wrong answer</Label>
                <NumberField
                  value={config.negative_mark_per_wrong}
                  onChange={(n) => patchCfg({ negative_mark_per_wrong: n })}
                  min={0}
                  step={0.25}
                  fallback={0}
                  disabled={readonly}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Subjects / sections</Label>
                {!readonly && (
                  <Button type="button" variant="outline" size="sm" onClick={addSection}>
                    <Plus className="mr-1 h-3 w-3" /> Add
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {config.sections.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_90px_90px_auto] items-end gap-2">
                    <div>
                      {i === 0 && <Label className="text-xs">Name</Label>}
                      <Input value={s.name} onChange={(e) => patchSection(i, { name: e.target.value })} disabled={readonly} />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs">Questions</Label>}
                      <NumberField value={s.count} onChange={(n) => patchSection(i, { count: n })} min={0} fallback={0} disabled={readonly} />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs">Marks/Q</Label>}
                      <NumberField value={s.marks_per_q} onChange={(n) => patchSection(i, { marks_per_q: n })} min={0} step={0.25} fallback={1} disabled={readonly} />
                    </div>
                    {!readonly && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeSection(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {readonly && <div />}
                  </div>
                ))}
              </div>
            </div>
            {readonly && (
              <p className="text-xs text-muted-foreground">
                Preset locked to match the real {PATTERN_PRESETS[pattern as "neet" | "eamcet" | "mains"].label} environment. Switch to Custom to edit.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
