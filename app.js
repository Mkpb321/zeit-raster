(() => {
  /**
   * Monats-Zeilen Kalender:
   * - Spalten: fortlaufende Wochentage (Mo..So), Anzahl = lead (0..6) + max 31 Tage = 37
   * - Zeilen: Monate
   * - Markerfarben per Klick (toggle)
   * - Shift+Klick (Farbmodus): Range einfärben
   * - Radierer-Tool: Klick löscht Farbe; Shift+Klick löscht Range (inkl. Endpunkte)
   * - Stift-Tool: Notiz hinzufügen/bearbeiten; leer speichern => löschen
   * - Notiz: Tooltip (mit Newlines) + Preview (erstes Wort) unten rechts
   * - Export/Import: JSON Backup (Farben + Notizen)
   * - Clear: Menü + zweite Bestätigung (Farben / Notizen / Alles)
   * - Notiz-Modal schließt nur über Buttons (kein Outside-Click, kein Esc)
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

  const STORAGE_MARKERS = "calendarMarkersV3";
  const STORAGE_NOTES = "calendarNotesV2";

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

  // DOM
  const scroller = document.getElementById("scroller");
  const calendarEl = document.getElementById("calendar");
  const sentinelTop = document.getElementById("sentinel-top");
  const sentinelBottom = document.getElementById("sentinel-bottom");
  const swatchesEl = document.getElementById("swatches");

  const clearBtn = document.getElementById("clearBtn");
  const penToolBtn = document.getElementById("penTool");
  const eraserToolBtn = document.getElementById("eraserTool");

  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");

  // Note modal
  const noteModal = document.getElementById("noteModal");
  const noteDateEl = document.getElementById("noteDate");
  const noteTextEl = document.getElementById("noteText");
  const noteSaveBtn = document.getElementById("noteSave");
  const noteCancelBtn = document.getElementById("noteCancel");

  // Clear modal
  const clearModal = document.getElementById("clearModal");
  const clearCancelBtn = document.getElementById("clearCancel");
  const clearDoBtn = document.getElementById("clearDo");
  const clearConfirmText = document.getElementById("clearConfirmText");

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
  const isValidMarkerId = (id) => MARKERS.some(m => m.id === id);

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

  // Notiz-Preview: erstes Wort bis Space oder Newline
  const notePreview = (text) => {
    const t = String(text).replace(/\r\n/g, "\n").trim();
    if (!t) return "";
    const nl = t.indexOf("\n");
    const firstLine = (nl >= 0) ? t.slice(0, nl) : t;
    const m = firstLine.trim().match(/^\S+/);
    return m ? m[0] : "";
  };

  const setNotePreviewElement = (cell, previewOrNull) => {
    let el = cell.querySelector(".note-preview");
    if (!previewOrNull) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("span");
      el.className = "note-preview";
      cell.appendChild(el);
    }
    el.textContent = previewOrNull;
  };

  const applyNoteToCell = (cell, noteTextOrNull) => {
    cell.classList.remove("has-note");
    delete cell.dataset.note;

    if (!noteTextOrNull) {
      cell.removeAttribute("title");
      setNotePreviewElement(cell, null);
      return;
    }

    cell.classList.add("has-note");
    cell.dataset.note = noteTextOrNull;

    cell.setAttribute("title", tooltipText(noteTextOrNull));
    setNotePreviewElement(cell, notePreview(noteTextOrNull));
  };

  const applyAllFromMapsToRenderedCells = () => {
    const cells = calendarEl.querySelectorAll(".day-cell[data-date]");
    for (const cell of cells) {
      const key = cell.dataset.date;

      // Marker
      const m = markerMap[key];
      if (m && isValidMarkerId(m)) applyMarkerToCell(cell, m);
      else applyMarkerToCell(cell, null);

      // Note
      const n = noteMap[key];
      if (typeof n === "string" && n.trim().length > 0) applyNoteToCell(cell, n);
      else applyNoteToCell(cell, null);
    }
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
        setMode("color");
      });

      swatchesEl.appendChild(btn);
    }
  };

  // ---------- Export / Import ----------
  const exportData = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      markers: markerMap,
      notes: noteMap
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });

    const ts = new Date();
    const name =
      `calendar-backup-${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}-` +
      `${pad2(ts.getHours())}${pad2(ts.getMinutes())}${pad2(ts.getSeconds())}.json`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const importDataFromFile = async (file) => {
    const text = await file.text();
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      alert("Import fehlgeschlagen: Datei ist kein gültiges JSON.");
      return;
    }

    const markers = obj && obj.markers;
    const notes = obj && obj.notes;

    if (!markers || typeof markers !== "object" || !notes || typeof notes !== "object") {
      alert("Import fehlgeschlagen: Datei-Format ungültig (markers/notes fehlen).");
      return;
    }

    // Sanitizen/Validieren
    const nextMarkers = {};
    for (const [k, v] of Object.entries(markers)) {
      if (typeof k !== "string") continue;
      if (typeof v !== "string") continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
      if (!isValidMarkerId(v)) continue;
      nextMarkers[k] = v;
    }

    const nextNotes = {};
    for (const [k, v] of Object.entries(notes)) {
      if (typeof k !== "string") continue;
      if (typeof v !== "string") continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
      if (v.trim().length === 0) continue;
      nextNotes[k] = v;
    }

    // Alles ersetzen
    markerMap = nextMarkers;
    noteMap = nextNotes;

    safeSave(STORAGE_MARKERS, markerMap);
    safeSave(STORAGE_NOTES, noteMap);

    // UI aktualisieren
    applyAllFromMapsToRenderedCells();
  };

  // ---------- Clear Menü ----------
  let clearStepConfirm = false;

  const openClearModal = () => {
    clearStepConfirm = false;
    clearConfirmText.hidden = true;
    clearDoBtn.textContent = "Löschen";

    clearModal.hidden = false;
    clearModal.setAttribute("aria-hidden", "false");
  };

  const closeClearModal = () => {
    clearModal.hidden = true;
    clearModal.setAttribute("aria-hidden", "true");
  };

  const getClearChoice = () => {
    const el = clearModal.querySelector('input[name="clearChoice"]:checked');
    return el ? el.value : "colors";
  };

  const doClearAction = (choice) => {
    if (choice === "colors") {
      markerMap = {};
      safeSave(STORAGE_MARKERS, markerMap);
      const anyMarked = calendarEl.querySelectorAll(".day-cell[data-marker]");
      for (const cell of anyMarked) applyMarkerToCell(cell, null);
      return;
    }

    if (choice === "notes") {
      noteMap = {};
      safeSave(STORAGE_NOTES, noteMap);
      const anyNotes = calendarEl.querySelectorAll(".day-cell.has-note");
      for (const cell of anyNotes) applyNoteToCell(cell, null);
      return;
    }

    // all
    markerMap = {};
    noteMap = {};
    safeSave(STORAGE_MARKERS, markerMap);
    safeSave(STORAGE_NOTES, noteMap);
    applyAllFromMapsToRenderedCells();
  };

  // Wenn Auswahl geändert wird, Bestätigung zurücksetzen
  clearModal.addEventListener("change", (e) => {
    if (e.target && e.target.name === "clearChoice") {
      clearStepConfirm = false;
      clearConfirmText.hidden = true;
      clearDoBtn.textContent = "Löschen";
    }
  });

  clearCancelBtn.addEventListener("click", closeClearModal);
  clearDoBtn.addEventListener("click", () => {
    if (!clearStepConfirm) {
      clearStepConfirm = true;
      clearConfirmText.hidden = false;
      clearDoBtn.textContent = "Ja, löschen";
      return;
    }

    const choice = getClearChoice();
    doClearAction(choice);
    closeClearModal();
  });

  // ---------- Notes Modal ----------
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

  // WICHTIG: kein Outside-Click-Schließen, kein ESC-Schließen
  noteCancelBtn.addEventListener("click", closeNoteModal);
  noteSaveBtn.addEventListener("click", saveNoteFromModal);

  // ---------- Rendering ----------
  let minYear = null;
  let maxYear = null;

  const buildYear = (year) => {
    const wrap = document.createElement("div");
    wrap.className = "year";
    wrap.dataset.year = String(year);

    // Header
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

    // Monate
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
          cell.textContent = "";
        } else {
          cell.textContent = String(dayNum);

          const d = makeLocalNoon(year, m, dayNum);
          const key = ymd(d);
          cell.dataset.date = key;

          if (key === todayKey) cell.classList.add("today");

          const storedMarker = markerMap[key];
          if (storedMarker && isValidMarkerId(storedMarker)) applyMarkerToCell(cell, storedMarker);

          const storedNote = noteMap[key];
          if (typeof storedNote === "string" && storedNote.trim().length > 0) {
            applyNoteToCell(cell, storedNote);
          }
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

    // Tools
    penToolBtn.addEventListener("click", () => setMode(mode === "pen" ? "color" : "pen"));
    eraserToolBtn.addEventListener("click", () => setMode(mode === "erase" ? "color" : "erase"));

    // Clear menu
    clearBtn.addEventListener("click", openClearModal);

    // Export / Import
    exportBtn.addEventListener("click", exportData);
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", async () => {
      const file = importFile.files && importFile.files[0];
      importFile.value = "";
      if (!file) return;
      await importDataFromFile(file);
    });

    setMode("color");

    // Initial render
    minYear = todayYear - INITIAL_YEARS_BEFORE;
    maxYear = todayYear + INITIAL_YEARS_AFTER;
    renderYears(minYear, maxYear, { prepend: false });

    requestAnimationFrame(() => centerToday());

    calendarEl.addEventListener("click", onCalendarClick);

    setupObservers();
  };

  init();
})();
