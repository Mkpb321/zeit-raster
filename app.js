(() => {
  /**
   * Monats-Zeilen Kalender:
   * - Spalten: fortlaufende Wochentage (Mo..So), Anzahl = lead (0..6) + max 31 Tage = 37
   * - Zeilen: Monate
   * - Markerfarben per Klick (toggle)
   * - Shift+Klick (Farbmodus): Range einfärben
   * - Radierer-Tool: Klick löscht Farbe; Shift+Klick löscht Range (inkl. Endpunkte)
   * - Stift-Tool: Notiz hinzufügen/bearbeiten; leer speichern => löschen
   * - Notiz: Tooltip (mit Newlines) + Punkt unten rechts
   * - Clear all löscht nur Farben (Notizen bleiben)
   */

  const COLS = 37;
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

  const STORAGE_MARKERS = "calendarMarkersV2";
  const STORAGE_NOTES = "calendarNotesV1";

  // Tools / Mode
  let mode = "color"; // "color" | "pen" | "erase"
  let selectedMarkerId = MARKERS[0].id;

  // Anker für Shift-Range (Farbmodus + Radierer)
  let rangeAnchorKey = null;

  // Weekend-Spalten: Sa/So
  const isWeekendColumn = (colIndex) => {
    const wd = colIndex % 7; // 0=Mo ... 5=Sa 6=So
    return (wd === 5 || wd === 6);
  };

  // DST-robust: Lokalzeit mittags
  const makeLocalNoon = (y, m, d) => new Date(y, m, d, 12, 0, 0, 0);
  const isoWeekdayIndex = (date) => (date.getDay() + 6) % 7; // Mo=0..So=6

  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const daysInMonth = (year, month0) => new Date(year, month0 + 1, 0).getDate();

  const parseYMDToNoon = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return makeLocalNoon(y, m - 1, d);
  };

  const addDaysNoon = (date, days) => {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return makeLocalNoon(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const scroller = document.getElementById("scroller");
  const calendarEl = document.getElementById("calendar");
  const sentinelTop = document.getElementById("sentinel-top");
  const sentinelBottom = document.getElementById("sentinel-bottom");
  const swatchesEl = document.getElementById("swatches");
  const clearAllBtn = document.getElementById("clearAll");
  const penToolBtn = document.getElementById("penTool");
  const eraserToolBtn = document.getElementById("eraserTool");

  // Modal elements
  const noteModal = document.getElementById("noteModal");
  const noteDateEl = document.getElementById("noteDate");
  const noteTextEl = document.getElementById("noteText");
  const noteSaveBtn = document.getElementById("noteSave");
  const noteCancelBtn = document.getElementById("noteCancel");

  // Heute (lokal)
  const now = new Date();
  const today = makeLocalNoon(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = ymd(today);
  const todayYear = today.getFullYear();

  const monthFmt = new Intl.DateTimeFormat(undefined, { month: "short" });

  // CSS cols setzen
  document.documentElement.style.setProperty("--cols", String(COLS));

  // ---------- Storage ----------
  const safeLoad = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === "object") ? obj : {};
    } catch {
      return {};
    }
  };

  const safeSave = (key, obj) => {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch {
      // ignore
    }
  };

  let markerMap = safeLoad(STORAGE_MARKERS); // { "YYYY-MM-DD": "yellow" | ... }
  let noteMap = safeLoad(STORAGE_NOTES);     // { "YYYY-MM-DD": "text..." }

  const markerById = (id) => MARKERS.find(m => m.id === id) || null;

  // ---------- Apply helpers ----------
  const applyMarkerToCell = (cell, markerIdOrNull) => {
    for (const m of MARKERS) cell.classList.remove(m.className);
    delete cell.dataset.marker;

    if (!markerIdOrNull) return;

    const m = markerById(markerIdOrNull);
    if (!m) return;

    cell.classList.add(m.className);
    cell.dataset.marker = markerIdOrNull;
  };

  // Tooltip: Newlines beibehalten (normalize Windows \r\n => \n)
  const tooltipText = (text) => String(text).replace(/\r\n/g, "\n");

  const applyNoteToCell = (cell, noteTextOrNull) => {
    cell.classList.remove("has-note");
    delete cell.dataset.note;

    if (!noteTextOrNull) {
      cell.removeAttribute("title");
      return;
    }

    cell.classList.add("has-note");
    cell.dataset.note = noteTextOrNull;

    // Native title-Tooltip soll Zeilenumbrüche wie im Textfeld anzeigen
    cell.setAttribute("title", tooltipText(noteTextOrNull));
  };

  // ---------- Mode ----------
  const setMode = (newMode) => {
    mode = newMode;
    penToolBtn.setAttribute("aria-pressed", String(mode === "pen"));
    eraserToolBtn.setAttribute("aria-pressed", String(mode === "erase"));
  };

  // ---------- Swatches ----------
  const renderSwatches = () => {
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

        // Farbauswahl => Farbmodus
        setMode("color");
      });

      swatchesEl.appendChild(btn);
    }
  };

  // ---------- Clear all (nur Farben) ----------
  const clearAllColors = () => {
    markerMap = {};
    safeSave(STORAGE_MARKERS, markerMap);

    const anyMarked = calendarEl.querySelectorAll(".day-cell[data-marker]");
    for (const cell of anyMarked) {
      applyMarkerToCell(cell, null);
    }
  };

  // ---------- Modal (Notes) ----------
  let editingDateKey = null;
  let editingCell = null;

  const openNoteModal = (dateKey, cell) => {
    editingDateKey = dateKey;
    editingCell = cell;

    noteDateEl.textContent = dateKey;
    noteTextEl.value = noteMap[dateKey] || "";

    noteModal.hidden = false;
    noteModal.setAttribute("aria-hidden", "false");
    setTimeout(() => noteTextEl.focus(), 0);
  };

  const closeNoteModal = () => {
    noteModal.hidden = true;
    noteModal.setAttribute("aria-hidden", "true");
    editingDateKey = null;
    editingCell = null;
  };

  const saveNoteFromModal = () => {
    if (!editingDateKey || !editingCell) return;

    const raw = noteTextEl.value ?? "";
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      delete noteMap[editingDateKey];
      safeSave(STORAGE_NOTES, noteMap);
      applyNoteToCell(editingCell, null);
      closeNoteModal();
      return;
    }

    noteMap[editingDateKey] = raw;
    safeSave(STORAGE_NOTES, noteMap);
    applyNoteToCell(editingCell, raw);
    closeNoteModal();
  };

  noteModal.addEventListener("click", (e) => {
    if (e.target === noteModal) closeNoteModal();
  });
  noteCancelBtn.addEventListener("click", closeNoteModal);
  noteSaveBtn.addEventListener("click", saveNoteFromModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !noteModal.hidden) closeNoteModal();
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !noteModal.hidden) saveNoteFromModal();
  });

  // ---------- Rendering ----------
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

          const storedMarker = markerMap[key];
          if (storedMarker) applyMarkerToCell(cell, storedMarker);

          const storedNote = noteMap[key];
          if (storedNote) applyNoteToCell(cell, storedNote);
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

  // ---------- Range Apply ----------
  const iterateRange = (fromKey, toKey, fn) => {
    const a = parseYMDToNoon(fromKey);
    const b = parseYMDToNoon(toKey);

    const forward = a.getTime() <= b.getTime();
    let cur = forward ? a : b;
    const last = forward ? b : a;

    while (cur.getTime() <= last.getTime()) {
      fn(ymd(cur));
      cur = addDaysNoon(cur, 1);
    }
  };

  const applyColorRange = (fromKey, toKey, markerId) => {
    iterateRange(fromKey, toKey, (key) => {
      markerMap[key] = markerId;
      const cell = calendarEl.querySelector(`.day-cell[data-date="${key}"]`);
      if (cell) applyMarkerToCell(cell, markerId);
    });
    safeSave(STORAGE_MARKERS, markerMap);
  };

  const eraseColorRange = (fromKey, toKey) => {
    iterateRange(fromKey, toKey, (key) => {
      if (markerMap[key] !== undefined) delete markerMap[key];
      const cell = calendarEl.querySelector(`.day-cell[data-date="${key}"]`);
      if (cell) applyMarkerToCell(cell, null);
    });
    safeSave(STORAGE_MARKERS, markerMap);
  };

  // ---------- Interaktion: Klick auf Kalender ----------
  const onCalendarClick = (ev) => {
    const cell = ev.target.closest(".day-cell");
    if (!cell) return;
    if (cell.classList.contains("empty")) return;

    const dateKey = cell.dataset.date;
    if (!dateKey) return;

    // Pen: Notiz bearbeiten
    if (mode === "pen") {
      openNoteModal(dateKey, cell);
      return;
    }

    // Eraser: Farben löschen (Range möglich)
    if (mode === "erase") {
      if (ev.shiftKey && rangeAnchorKey) {
        eraseColorRange(rangeAnchorKey, dateKey);
        rangeAnchorKey = dateKey;
        return;
      }

      if (markerMap[dateKey] !== undefined) delete markerMap[dateKey];
      applyMarkerToCell(cell, null);
      safeSave(STORAGE_MARKERS, markerMap);

      rangeAnchorKey = dateKey;
      return;
    }

    // Color mode
    const selected = selectedMarkerId;

    if (ev.shiftKey && rangeAnchorKey) {
      applyColorRange(rangeAnchorKey, dateKey, selected);
      rangeAnchorKey = dateKey;
      return;
    }

    // Normaler Click: Toggle einzelnes Feld
    const current = cell.dataset.marker || null;

    if (current === selected) {
      applyMarkerToCell(cell, null);
      delete markerMap[dateKey];
      safeSave(STORAGE_MARKERS, markerMap);
    } else {
      applyMarkerToCell(cell, selected);
      markerMap[dateKey] = selected;
      safeSave(STORAGE_MARKERS, markerMap);
    }

    rangeAnchorKey = dateKey;
  };

  // ---------- Start ----------
  const init = () => {
    renderSwatches();

    clearAllBtn.addEventListener("click", clearAllColors);

    penToolBtn.addEventListener("click", () => {
      setMode(mode === "pen" ? "color" : "pen");
    });

    eraserToolBtn.addEventListener("click", () => {
      setMode(mode === "erase" ? "color" : "erase");
    });

    setMode("color");

    minYear = todayYear - INITIAL_YEARS_BEFORE;
    maxYear = todayYear + INITIAL_YEARS_AFTER;

    renderYears(minYear, maxYear, { prepend: false });

    requestAnimationFrame(() => centerToday());

    calendarEl.addEventListener("click", onCalendarClick);
  };

  init();
  setupObservers();
})();
