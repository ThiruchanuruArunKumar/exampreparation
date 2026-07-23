import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to postgres_changes on a set of tables and invoke `onChange`
 * (debounced) whenever any row changes. Designed for silent background
 * refreshes — do NOT toggle loading state in the callback or the UI will flicker.
 */
export function useRealtimeSync(
  tables: string[],
  onChange: () => void,
  opts: { enabled?: boolean; debounceMs?: number } = {},
) {
  const { enabled = true, debounceMs = 250 } = opts;
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!enabled || tables.length === 0) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), debounceMs);
    };

    let channel = supabase.channel(`sync:${tables.join(",")}:${Math.random().toString(36).slice(2, 8)}`);
    for (const table of tables) {
      channel = (channel as unknown as {
        on: (t: string, f: Record<string, string>, cb: () => void) => typeof channel;
      }).on("postgres_changes", { event: "*", schema: "public", table }, fire);
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debounceMs, tables.join(",")]);
}
