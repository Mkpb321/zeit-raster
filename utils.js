(() => {
  window.KalenderApp = window.KalenderApp || {};
  const U = {};

  // DST-robust: Lokalzeit mittags
  U.makeLocalNoon = (y, m, d) => new Date(y, m, d, 12, 0, 0, 0);

  // ISO: Mo=0..So=6
  U.isoWeekdayIndex = (date) => (date.getDay() + 6) % 7;

  U.pad2 = (n) => String(n).padStart(2, "0");

  U.ymd = (date) =>
    `${date.getFullYear()}-${U.pad2(date.getMonth() + 1)}-${U.pad2(date.getDate())}`;

  U.daysInMonth = (year, month0) => new Date(year, month0 + 1, 0).getDate();

  U.parseYMDToNoon = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return U.makeLocalNoon(y, m - 1, d);
  };

  U.addDaysNoon = (date, days) => {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return U.makeLocalNoon(d.getFullYear(), d.getMonth(), d.getDate());
  };

  // Weekend-Spalten: Sa/So
  U.isWeekendColumn = (colIndex) => {
    const wd = colIndex % 7; // 0=Mo ... 5=Sa 6=So
    return (wd === 5 || wd === 6);
  };

  // Tooltip-Text: echte Newlines beibehalten
  U.tooltipText = (text) => String(text).replace(/\r\n/g, "\n");

  // Notiz-Preview: erstes Wort (bis Space oder Newline)
  U.notePreview = (text) => {
    const t = String(text).replace(/\r\n/g, "\n").trim();
    if (!t) return "";
    const nl = t.indexOf("\n");
    const firstLine = (nl >= 0) ? t.slice(0, nl) : t;
    const m = firstLine.trim().match(/^\S+/);
    return m ? m[0] : "";
  };

  // Range-Iteration inclusive
  U.iterateRangeKeys = (fromKey, toKey, fn) => {
    const a = U.parseYMDToNoon(fromKey);
    const b = U.parseYMDToNoon(toKey);

    const forward = a.getTime() <= b.getTime();
    let cur = forward ? a : b;
    const last = forward ? b : a;

    while (cur.getTime() <= last.getTime()) {
      fn(U.ymd(cur));
      cur = U.addDaysNoon(cur, 1);
    }
  };

  window.KalenderApp.UTILS = U;
})();
