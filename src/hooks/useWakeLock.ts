import { useEffect } from "react";

/**
 * Keeps the device screen awake for as long as the component is mounted.
 * Silently no-ops on browsers without the Wake Lock API.
 */
export function useWakeLock(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    let wakeLock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        if ("wakeLock" in navigator && !document.hidden && !cancelled) {
          wakeLock = await (navigator as Navigator & {
            wakeLock: { request: (t: "screen") => Promise<WakeLockSentinel> };
          }).wakeLock.request("screen");
          wakeLock?.addEventListener?.("release", () => {
            wakeLock = null;
          });
        }
      } catch {
        /* wake lock unavailable — ignore */
      }
    };

    void request();
    const onVisibility = () => {
      if (!document.hidden && !wakeLock) void request();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (wakeLock) {
        void wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    };
  }, [enabled]);
}
