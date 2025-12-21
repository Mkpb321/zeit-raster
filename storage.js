(() => {
  window.KalenderApp = window.KalenderApp || {};
  const S = {};

  // safeLoad kann Objekte ODER Arrays zurückgeben. Fallback kann angegeben werden.
  S.safeLoad = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback !== undefined ? fallback : {};
      const val = JSON.parse(raw);
      if (Array.isArray(val)) return val;
      if (val && typeof val === "object") return val;
      return fallback !== undefined ? fallback : {};
    } catch {
      return fallback !== undefined ? fallback : {};
    }
  };

  S.safeSave = (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      // ignore
    }
  };

  window.KalenderApp.STORAGE = S;
})();
