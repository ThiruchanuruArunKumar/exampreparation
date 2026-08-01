import { useEffect, useRef, useState } from "react";

type Options = {
  enabled: boolean;
  maxWarnings?: number;
  onWarning: (count: number, reason: string) => void;
  onLimit: () => void;
};

export function useProctoring({ enabled, maxWarnings = 3, onWarning, onLimit }: Options) {
  const [warnings, setWarnings] = useState(0);
  const [isFullscreenExited, setIsFullscreenExited] = useState(false);
  const warnRef = useRef(0);
  const lastTriggerRef = useRef(0);
  const cbRef = useRef({ onWarning, onLimit });
  cbRef.current = { onWarning, onLimit };

  const trigger = (reason: string) => {
    // Debounce: a single tab-switch fires visibilitychange + blur + fullscreenchange
    // in quick succession. Coalesce anything within 1200ms into a single warning.
    const now = Date.now();
    if (now - lastTriggerRef.current < 1200) return;
    lastTriggerRef.current = now;
    warnRef.current += 1;
    setWarnings(warnRef.current);
    cbRef.current.onWarning(warnRef.current, reason);
    if (warnRef.current >= maxWarnings) cbRef.current.onLimit();
  };

  const requestFullscreenMode = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreenExited(false);
      }
    } catch {
      /* user gesture required */
    }
  };

  useEffect(() => {
    if (!enabled) {
      setIsFullscreenExited(false);
      return;
    }

    void requestFullscreenMode();

    // Push state to trap back button
    window.history.pushState({ exam: true }, "", window.location.href);

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
        setIsFullscreenExited(true);
        trigger("Exited fullscreen mode");
      } else {
        setIsFullscreenExited(false);
      }
    };
    const onPopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState({ exam: true }, "", window.location.href);
      trigger("Attempted to navigate back / exit exam");
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      trigger("Right-click blocked");
    };
    const onCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      trigger("Copy/paste blocked");
    };

    const clearClipboard = () => {
      try {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText("");
        }
      } catch {
        /* ignore */
      }
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const code = e.code ? e.code.toLowerCase() : "";

      // Screenshot keys — PrintScreen, macOS Cmd+Shift+3/4/5, Win+Shift+S
      const isScreenshot =
        e.key === "PrintScreen" ||
        code === "printscreen" ||
        k === "printscreen" ||
        (e.shiftKey && (e.metaKey || e.ctrlKey) && (k === "s" || code === "keys")) ||
        (e.metaKey && e.shiftKey && ["3", "4", "5", "6"].includes(e.key));

      if (isScreenshot) {
        e.preventDefault();
        e.stopPropagation();
        clearClipboard();
        trigger("Screenshot attempt detected");
        return;
      }

      // DevTools and prohibited shortcuts
      const isDevTools =
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(k)) ||
        (e.metaKey && e.altKey && ["i", "j", "c"].includes(k));

      const isForbiddenShortcut =
        isDevTools ||
        (e.ctrlKey && ["c", "v", "x", "t", "w", "n", "u", "p", "s", "r"].includes(k)) ||
        (e.metaKey && ["c", "v", "x", "t", "w", "n", "u", "p", "s", "r"].includes(k)) ||
        (e.altKey && e.key === "Tab") ||
        (e.altKey && e.key === "F4");

      if (isForbiddenShortcut) {
        e.preventDefault();
        e.stopPropagation();
        trigger(isDevTools ? "Developer Tools shortcut blocked" : `Blocked shortcut: ${e.key}`);
      }
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopyPaste);
    document.addEventListener("paste", onCopyPaste);
    document.addEventListener("cut", onCopyPaste);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKey, true);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("visibilitychange", onVisibilityWake);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopyPaste);
      document.removeEventListener("paste", onCopyPaste);
      document.removeEventListener("cut", onCopyPaste);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keyup", onKey, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (wakeLock) { void wakeLock.release().catch(() => {}); wakeLock = null; }
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { warnings, isFullscreenExited, requestFullscreenMode };
}
