(() => {
  window.KalenderApp = window.KalenderApp || {};
  const S = {};

  S.safeLoad = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === "object") ? obj : {};
    } catch {
      return {};
    }
  };

  S.safeSave = (key, obj) => {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch {
      // ignore
    }
  };

  window.KalenderApp.STORAGE = S;
})();
