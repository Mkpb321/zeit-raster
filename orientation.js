(() => {
  "use strict";

  const setHidden = (el, hidden) => {
    if (!el) return;
    const h = !!hidden;
    el.hidden = h;
    el.setAttribute("aria-hidden", String(h));
    el.style.display = h ? "none" : "";
  };

  const isSmartphone = () => {
    const ua = String(navigator.userAgent || "");
    const phoneUA = /iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua));
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 600;
    return phoneUA || (coarse && small);
  };

  const isLandscape = () => window.matchMedia("(orientation: landscape)").matches;

  const tryLockLandscape = async () => {
    if (!isSmartphone()) return;
    const o = screen && screen.orientation;
    if (!o || typeof o.lock !== "function") return;
    try { await o.lock("landscape"); } catch { /* Browser/OS blockiert Lock */ }
  };

  const boot = () => {
    const rotateView = document.getElementById("rotateView");
    if (!rotateView) return;

    const update = () => {
      const mustRotate = isSmartphone() && !isLandscape();
      setHidden(rotateView, !mustRotate);
    };

    // Initial + Änderungen
    update();
    tryLockLandscape();

    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(update, 200), { passive: true });

    // Manche Browser erlauben orientation.lock nur nach User-Geste
    const onFirstGesture = () => {
      tryLockLandscape();
      window.removeEventListener("click", onFirstGesture, true);
      window.removeEventListener("touchend", onFirstGesture, true);
    };
    window.addEventListener("click", onFirstGesture, true);
    window.addEventListener("touchend", onFirstGesture, true);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();