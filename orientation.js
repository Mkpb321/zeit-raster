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

  // Fallback: Wenn Landscape-Lock nicht möglich ist (typisch iOS/Safari),
  // rotieren wir die komplette App per CSS/Transform in Landscape-Ansicht.
  // Hinweis: Das ist ein reines Darstellungs-Transform (kein echtes OS-Rotate).
  const applyCssRotateLandscape = () => {
    const html = document.documentElement;
    const body = document.body;
    if (!body) return;

    const phone = isSmartphone();
    const portrait = (window.matchMedia && window.matchMedia("(orientation: portrait)").matches)
      || (window.innerHeight > window.innerWidth);

    // VisualViewport ist auf Mobile genauer (Browser-UI/Adressleiste).
    const vv = window.visualViewport;
    const vw = Math.round((vv && vv.width) || window.innerWidth || 0);
    const vh = Math.round((vv && vv.height) || window.innerHeight || 0);

    const enable = phone && portrait && vw > 0 && vh > 0;

    if (!enable) {
      html.classList.remove("css-rotate-landscape");
      body.style.transform = "";
      body.style.transformOrigin = "";
      body.style.width = "";
      body.style.height = "";
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.overflow = "";
      return;
    }

    html.classList.add("css-rotate-landscape");

    // Body in "Landscape"-Dimensionen festlegen (swap), dann um 90° im Uhrzeigersinn drehen.
    // Wichtig: Die Translation muss so gewählt werden, dass der gesamte Inhalt
    // im sichtbaren Viewport liegt (sonst "schwarz"/leer).
    body.style.position = "fixed";
    body.style.top = "0";
    body.style.left = "0";
    body.style.width = `${vh}px`;
    body.style.height = `${vw}px`;
    body.style.transformOrigin = "top left";
    // matrix(0,-1,1,0,0,vh) entspricht rotate(90deg) (clockwise) + translateY(vh)
    body.style.transform = `matrix(0,-1,1,0,0,${vh})`;
    body.style.overflow = "hidden";
  };

  const boot = () => {
    // Initialer Versuch
    tryLockLandscape();
    applyCssRotateLandscape();

    // Einige Browser erlauben lock() nur nach User-Geste
    const onFirstGesture = () => {
      tryLockLandscape();
      applyCssRotateLandscape();
      window.removeEventListener("click", onFirstGesture, true);
      window.removeEventListener("touchend", onFirstGesture, true);
    };
    window.addEventListener("click", onFirstGesture, true);
    window.addEventListener("touchend", onFirstGesture, true);

    // Bei Rotation/Resize nochmal versuchen (debounced via setTimeout)
    const retry = () => setTimeout(() => {
      tryLockLandscape();
      applyCssRotateLandscape();
    }, 250);
    window.addEventListener("orientationchange", retry, { passive: true });
    window.addEventListener("resize", retry, { passive: true });

    // VisualViewport verändert sich bei iOS dynamisch (Adressleiste/Zoom)
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", retry, { passive: true });
      window.visualViewport.addEventListener("scroll", retry, { passive: true });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();