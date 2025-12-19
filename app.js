(() => {
  /**
   * Monats-Zeilen Kalender:
   * - Spalten sind fortlaufende Wochentage (Mo..So), Anzahl = lead (0..6) + max 31 Tage = 37
   * - Zeilen sind Monate
   * - Kein horizontales Scrollen (Spalten sind fr)
   * - Marker: Farbe wählen, Feld klicken => einfärben; gleiches nochmal => zurücksetzen
   * - Persistenz via localStorage
   * - Clear all: löscht alle Marker
   */

  const COLS = 37;               // lead + max 31 Tage
  const CHUNK_YEARS = 2;
  const INITIAL_YEARS_BEFORE = 2;
  const INITIAL_YEARS_AFTER = 2;

  const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  const MARKERS = [
    { id: "yellow",  label: "Gelb",   className: "marker-yellow",  cssVar: "--m-yellow"  },
    { id: "green",   label: "Grün",   className: "marker-green",   cssVar: "--m-green"   },
    { id: "blue",    label: "Blau",   className: "marker-blue",    cssVar: "--m-blue"    },
    { id: "red",     label: "Rot",    className: "marker-red",     cssVar: "--m-red"     },
    { id: "purple",  label: "Lila",   className: "marker-purple",  cssVar: "--m-purple"  },
  ];

  const STORAGE_KEY = "calendarMarkersV1";

  // Weekend-Spalten: Sa/So
  const isWeekendColumn = (colIndex) => {
    const wd = colIndex % 7;   // 0=Mo ... 5=Sa 6=So
    return (wd === 5 || wd === 6);
  };

  // DST-robust: Lokalzeit mittags
  const makeLocalNoon = (y, m, d) => new Date(y, m, d, 12, 0, 0, 0);
  const isoWeekdayIndex = (date) => (date.getDay() + 6) % 7; // Mo=0..So=6

  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const daysInMonth = (year, month0) => new Date(year, month0 + 1, 0).getDate();

  const scroller = document.getElementById("scroller");
  const calendarEl = document.getElementById("calendar");
  const sentinelTop = document.getElementById("sentinel-top");
  const sentinelBottom = document.getElementById("sentinel-bottom");
  const swatchesEl = document.getElementById("swatches");

  // Heute (lokal)
  const now = new Date();
  const today = makeLocalNoon(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = ymd(today);
  const todayYear = today.getFullYear();

  const monthFmt = new Intl.DateTimeFormat(undefined, { month: "short" });

  // CSS cols setzen
  document.documentElement.style.setProperty("--cols", String(COLS));

  // --------- Marker State / Storage ----------
  const loadMarkerMap = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") return obj;
      return {};
    } catch {
      return {};
    }
  };

  const saveMarkerMap = (map) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // falls Storage blockiert ist: ohne Persistenz weiter
    }
  };

  let markerMap = loadMarkerMap(); // { "YYYY-MM-DD": "yellow" | ... }

  // Aktuell ausgewählte Farbe
  let selectedMarkerId = MARKERS[0].id;

  const markerById = (id) => MARKERS.find(m => m.id === id) || null;

  const applyMarkerToCell = (cell, markerIdOrNull) => {
    for (const m of MARKERS) cell.classList.remove(m.className);
    cell.classList.remove("has-marker");
    delete cell.dataset.marker;

    if (!markerIdOrNull) return;

    const m = markerById(markerIdOrNull);
    if (!m) return;

    cell.classList.add("has-marker");
    cell.classList.add(m.className);
    cell.dataset.marker = markerIdOrNull;
  };

  // --------- Swatches UI + Clear all ----------
  const renderSwatchesAndClear = () => {
    swatchesEl.innerHTML = "";

    for (const m of MARKERS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-label", m.label);
      btn.setAttribute("aria-checked", String(m.id === selectedMarkerId));

      btn.style.background =
        getComputedStyle(document.documentElement).getPropertyValue(m.cssVar).trim() || "#fff";

      btn.addEventListener("click", () => {
        selectedMarkerId = m.id;
        for (const child of swatchesEl.querySelectorAll(".swatch")) {
          child.setAttribute("aria-checked", "false");
        }
        btn.setAttribute("aria-checked", "true");
      });

      swatchesEl.appendChild(btn);
    }

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "clear-all";
    clearBtn.textContent = "Clear all";
    clearBtn.addEventListener("click", () => clearAllMarkers());
    swatchesEl.parentElement.appendChild(clearBtn);
  };

  const clearAllMarkers = () => {
    markerMap = {};
    saveMarkerMap(markerMap);

    // Alle sichtbaren Marker entfernen
    const marked = calendarEl.querySelectorAll(".day-cell.has-marker");
    for (const cell of marked) applyMarkerToCell(cell, null);
  };

  // --------- Kalender Rendering ----------
  let minYear = null;
  let maxYear = null;

  const buildYear = (year) => {
    const wrap = document.createElement("div");
    wrap.className = "year";
    wrap.dataset.year = String(year);

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

    for (let m = 0; m < 12; m++) {
      const row = document.createElement("div");
      row.className = "month-row";

      const label = document.createElement("div");
      label.className = "label-cell";
      label.textContent = monthFmt.format(makeLocalNoon(year, m, 1));
      row.appendChild(label);

      const first = makeLocalNoon(year, m, 1);
      const lead = isoWeekdayIndex(first); // 0..6
      const dim = daysInMonth(year, m);

      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "day-cell";
        if (isWeekendColumn(c)) cell.classList.add("weekend-col");

        const dayNum = (c - lead) + 1;

        if (dayNum < 1 || dayNum > dim) {
          cell.classList.add("empty");
          cell.textContent = "0";
        } else {
          cell.textContent = String(dayNum);

          const d = makeLocalNoon(year, m, dayNum);
          const key = ymd(d);
          cell.dataset.date = key;

          if (key === todayKey) cell.classList.add("today");

          const stored = markerMap[key];
          if (stored) applyMarkerToCell(cell, stored);
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

        if (e.target === sentinelTop) prependYears(CHUNK_YEARS);
        else if (e.target === sentinelBottom) appendYears(CHUNK_YEARS);
      }
    }, { root: scroller, threshold: 0.01 });

    io.observe(sentinelTop);
    io.observe(sentinelBottom);
  };

  // --------- Interaktion: Klick zum Markieren ----------
  const onCalendarClick = (ev) => {
    const cell = ev.target.closest(".day-cell");
    if (!cell) return;
    if (cell.classList.contains("empty")) return;

    const dateKey = cell.dataset.date;
    if (!dateKey) return;

    const current = cell.dataset.marker || null;
    const selected = selectedMarkerId;

    if (current === selected) {
      applyMarkerToCell(cell, null);
      delete markerMap[dateKey];
      saveMarkerMap(markerMap);
      return;
    }

    applyMarkerToCell(cell, selected);
    markerMap[dateKey] = selected;
    saveMarkerMap(markerMap);
  };

  // --------- Start ----------
  const init = () => {
    // Toolbar: Swatches + Clear all Button
    renderSwatchesAndClear();

    minYear = todayYear - INITIAL_YEARS_BEFORE;
    maxYear = todayYear + INITIAL_YEARS_AFTER;

    renderYears(minYear, maxYear, { prepend: false });

    requestAnimationFrame(() => centerToday());

    calendarEl.addEventListener("click", onCalendarClick);
  };

  init();
  setupObservers();
})();
