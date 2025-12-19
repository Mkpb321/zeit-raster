(() => {
  /**
   * Monats-Zeilen Kalender:
   * - Spalten sind fortlaufende Wochentage (Mo..So), 6 Wochen => 42 Spalten
   * - Zeilen sind Monate
   * - Keine horizontale Scrollbar: Spalten sind per CSS "fr" und passen sich der Breite an
   */

  const COLS = 42;               // 6 Wochen * 7 Tage
  const CHUNK_YEARS = 2;         // beim Nachladen
  const INITIAL_YEARS_BEFORE = 2;
  const INITIAL_YEARS_AFTER = 2;

  // Montag ist Spalte 1
  const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  // Weekend-Spalten anhand Spaltenindex (0..41), wiederholt alle 7
  const isWeekendColumn = (colIndex) => {
    const wd = colIndex % 7;     // 0=Mo ... 5=Sa 6=So
    return (wd === 5 || wd === 6);
  };

  // DST-robust: Lokalzeit mittags
  const makeLocalNoon = (y, m, d) => new Date(y, m, d, 12, 0, 0, 0);

  // ISO-Wochentagindex: Mo=0 ... So=6
  const isoWeekdayIndex = (date) => (date.getDay() + 6) % 7;

  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

  const daysInMonth = (year, month0) => new Date(year, month0 + 1, 0).getDate();

  const scroller = document.getElementById("scroller");
  const calendarEl = document.getElementById("calendar");
  const sentinelTop = document.getElementById("sentinel-top");
  const sentinelBottom = document.getElementById("sentinel-bottom");

  // Heute (lokale Zeit)
  const now = new Date();
  const today = makeLocalNoon(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = ymd(today);
  const todayYear = today.getFullYear();

  const monthFmt = new Intl.DateTimeFormat(undefined, { month: "short" });

  let minYear = null;
  let maxYear = null;

  // Set CSS cols (einmalig, da konstant)
  document.documentElement.style.setProperty("--cols", String(COLS));

  const buildYear = (year) => {
    const wrap = document.createElement("div");
    wrap.className = "year";
    wrap.dataset.year = String(year);

    // Header: Jahr + Wochentage (über 42 Spalten wiederholt)
    const header = document.createElement("div");
    header.className = "year-header";

    const yearCell = document.createElement("div");
    yearCell.className = "label-cell";
    yearCell.textContent = String(year);
    header.appendChild(yearCell);

    for (let c = 0; c < COLS; c++) {
      const hc = document.createElement("div");
      hc.className = "header-cell";
      hc.textContent = WEEKDAYS[c % 7];
      if (isWeekendColumn(c)) hc.classList.add("weekend-col");
      header.appendChild(hc);
    }

    wrap.appendChild(header);

    // 12 Monatszeilen
    for (let m = 0; m < 12; m++) {
      const row = document.createElement("div");
      row.className = "month-row";

      const label = document.createElement("div");
      label.className = "label-cell";
      label.textContent = monthFmt.format(makeLocalNoon(year, m, 1));
      row.appendChild(label);

      const first = makeLocalNoon(year, m, 1);
      const lead = isoWeekdayIndex(first);  // 0..6, Mo..So
      const dim = daysInMonth(year, m);

      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "day-cell";
        if (isWeekendColumn(c)) cell.classList.add("weekend-col");

        // Position des Tages im Grid: lead + (day-1)
        const dayNum = (c - lead) + 1;

        if (dayNum < 1 || dayNum > dim) {
          cell.classList.add("empty");
          cell.textContent = "0"; // wird via CSS unsichtbar
        } else {
          cell.textContent = String(dayNum);
          const d = makeLocalNoon(year, m, dayNum);
          const key = ymd(d);
          cell.dataset.date = key;
          if (key === todayKey) cell.classList.add("today");
        }

        row.appendChild(cell);
      }

      wrap.appendChild(row);
    }

    return wrap;
  };

  const renderYears = (startYear, endYear, { prepend = false } = {}) => {
    const frag = document.createDocumentFragment();
    for (let y = startYear; y <= endYear; y++) {
      frag.appendChild(buildYear(y));
    }
    if (prepend) calendarEl.prepend(frag);
    else calendarEl.appendChild(frag);
  };

  const centerToday = () => {
    const el = calendarEl.querySelector(`[data-date="${todayKey}"]`);
    if (!el) return;

    // Nur vertikal scrollen (kein horizontaler Scroll)
    const scRect = scroller.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const elTopInScroller = (elRect.top - scRect.top) + scroller.scrollTop;
    const target = elTopInScroller + (el.offsetHeight / 2) - (scroller.clientHeight / 2);

    scroller.scrollTop = Math.max(0, target);
  };

  const prependYears = (count) => {
    const oldHeight = scroller.scrollHeight;

    const newStart = minYear - count;
    const newEnd = minYear - 1;

    renderYears(newStart, newEnd, { prepend: true });
    minYear = newStart;

    // Scroll-Position stabil halten
    const newHeight = scroller.scrollHeight;
    scroller.scrollTop += (newHeight - oldHeight);
  };

  const appendYears = (count) => {
    const newStart = maxYear + 1;
    const newEnd = maxYear + count;

    renderYears(newStart, newEnd, { prepend: false });
    maxYear = newEnd;
  };

  const setupObservers = () => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;

        if (e.target === sentinelTop) {
          prependYears(CHUNK_YEARS);
        } else if (e.target === sentinelBottom) {
          appendYears(CHUNK_YEARS);
        }
      }
    }, { root: scroller, threshold: 0.01 });

    io.observe(sentinelTop);
    io.observe(sentinelBottom);
  };

  const init = () => {
    minYear = todayYear - INITIAL_YEARS_BEFORE;
    maxYear = todayYear + INITIAL_YEARS_AFTER;

    renderYears(minYear, maxYear, { prepend: false });

    // Sicherstellen, dass keine horizontale Scrollbar entsteht
    scroller.scrollLeft = 0;

    requestAnimationFrame(() => centerToday());
  };

  init();
  setupObservers();
})();
