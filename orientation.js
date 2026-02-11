(() => {
  "use strict";

  const isSmartphone = () => {
    const ua = String(navigator.userAgent || "");
    const phoneUA = /iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua));
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 600;
    return phoneUA || (coarse && small);
  };

  const tryLockLandscape = async () => {
    if (!isSmartphone()) return;
    const o = screen && screen.orientation;
    if (!o || typeof o.lock !== "function") return;

    try {
      await o.lock("landscape");
    } catch {
      // iOS/Safari blockiert das meist – wir zeigen bewusst keine Maske.
    }
  };

  const boot = () => {
    // Initialer Versuch
    tryLockLandscape();

    // Einige Browser erlauben lock() nur nach User-Geste
    const onFirstGesture = () => {
      tryLockLandscape();
      window.removeEventListener("click", onFirstGesture, true);
      window.removeEventListener("touchend", onFirstGesture, true);
    };
    window.addEventListener("click", onFirstGesture, true);
    window.addEventListener("touchend", onFirstGesture, true);

    // Bei Rotation/Resize nochmal versuchen (debounced via setTimeout)
    const retry = () => setTimeout(tryLockLandscape, 250);
    window.addEventListener("orientationchange", retry, { passive: true });
    window.addEventListener("resize", retry, { passive: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();