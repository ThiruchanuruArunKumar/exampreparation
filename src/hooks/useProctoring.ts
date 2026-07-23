import { useEffect, useRef, useState } from "react";

type Options = {
  enabled: boolean;
  maxWarnings?: number;
  onWarning: (count: number, reason: string) => void;
  onLimit: () => void;
};

export function useProctoring({ enabled, maxWarnings = 3, onWarning, onLimit }: Options) {
  const [warnings, setWarnings] = useState(0);
  const warnRef = useRef(0);
  const cbRef = useRef({ onWarning, onLimit });
  cbRef.current = { onWarning, onLimit };

  const trigger = (reason: string) => {
    warnRef.current += 1;
    setWarnings(warnRef.current);
    cbRef.current.onWarning(warnRef.current, reason);
    if (warnRef.current >= maxWarnings) cbRef.current.onLimit();
  };

  useEffect(() => {
    if (!enabled) return;

    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      } catch {
        /* user gesture required — will re-attempt on interaction */
      }
    };
    void enterFullscreen();

    // Keep the screen awake for the duration of the exam.
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator && !document.hidden) {
          wakeLock = await (navigator as Navigator & {
            wakeLock: { request: (t: "screen") => Promise<WakeLockSentinel> };
          }).wakeLock.request("screen");
          wakeLock?.addEventListener?.("release", () => { wakeLock = null; });
        }
      } catch {
        /* wake lock unavailable — silently ignore */
      }
    };
    void requestWakeLock();
    const onVisibilityWake = () => { if (!document.hidden && !wakeLock) void requestWakeLock(); };
    document.addEventListener("visibilitychange", onVisibilityWake);


    const onVisibility = () => {
      if (document.hidden) trigger("Tab switched or window minimized");
    };
    const onBlur = () => trigger("Window lost focus");
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        trigger("Exited fullscreen");
        void enterFullscreen();
      }
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      trigger("Right-click blocked");
    };
    const onCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      trigger("Copy/paste blocked");
    };
    const onKey = (e: KeyboardEvent) => {
      const bad =
        e.key === "F12" ||
        (e.ctrlKey && ["c", "v", "x", "t", "w", "n", "u", "p", "s"].includes(e.key.toLowerCase())) ||
        (e.metaKey && ["c", "v", "x", "t", "w", "n"].includes(e.key.toLowerCase())) ||
        (e.altKey && e.key === "Tab");
      if (bad) {
        e.preventDefault();
        trigger(`Blocked shortcut: ${e.key}`);
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopyPaste);
    document.addEventListener("paste", onCopyPaste);
    document.addEventListener("cut", onCopyPaste);
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopyPaste);
      document.removeEventListener("paste", onCopyPaste);
      document.removeEventListener("cut", onCopyPaste);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { warnings };
}
