import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  fallback?: number; // used when field is empty and blurred
  className?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * Number input that lets the user clear the value while typing.
 * onChange fires only for valid numbers; empty commits `fallback` on blur.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  fallback,
  className,
  id,
  placeholder,
  disabled,
}: Props) {
  const [raw, setRaw] = useState<string>(Number.isFinite(value) ? String(value) : "");

  useEffect(() => {
    // keep in sync when parent updates (e.g. preset applied)
    setRaw(Number.isFinite(value) ? String(value) : "");
  }, [value]);

  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      value={raw}
      onChange={(e) => {
        const v = e.target.value;
        setRaw(v);
        if (v === "" || v === "-") return;
        const n = Number(v);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => {
        if (raw === "" || raw === "-" || !Number.isFinite(Number(raw))) {
          const f = fallback ?? min ?? 0;
          setRaw(String(f));
          onChange(f);
        }
      }}
    />
  );
}
