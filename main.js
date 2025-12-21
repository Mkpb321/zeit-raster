(() => {
  const { CONFIG } = window.KalenderApp;
  const U = window.KalenderApp.UTILS;
  const S = window.KalenderApp.STORAGE;
  const A = window.KalenderApp.APPLY;
  const CAL = window.KalenderApp.CALENDAR;
  const UI = window.KalenderApp.UI;

  const isHexColor = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim());
  const normHex = (v) => (isHexColor(v) ? v.trim().toLowerCase() : null);

  const loadCustomMarkers = () => {
    const raw = S.safeLoad(CONFIG.STORAGE_CUSTOM_MARKERS, []);
    if (!Array.isArray(raw)) return [];

    const out = [];
    const seen = new Set();

    for (const m of raw) {
      if (!m || typeof m !== "object") continue;
      const id = typeof m.id === "string" ? m.id.trim() : "";
      const color = normHex(m.color);
      if (!id || !color) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        color,
        label: (typeof m.label === "string" && m.label.trim()) ? m.label : color.toUpperCase(),
        isCustom: true,
      });
    }

    return out;
  };

  const builtInIdToColor = (id) => {
    if (typeof id !== "string") return null;
    const def = CONFIG.MARKERS.find(m => m.id === id);
    return def ? normHex(def.color) : null;
  };

  const loadColorMap = (customMarkers) => {
    // Neu (V4): date -> "#rrggbb"
    const current = S.safeLoad(CONFIG.STORAGE_MARKERS, {});
    const hasAny = current && typeof current === "object" && Object.keys(current).length > 0;

    // Wenn bereits V4 vorhanden, nur validieren
    if (hasAny) {
      const out = {};
      for (const [k, v] of Object.entries(current)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
        const c = normHex(v);
        if (!c) continue;
        out[k] = c;
      }
      // Optional: zurückspeichern, falls bereinigt
      S.safeSave(CONFIG.STORAGE_MARKERS, out);
      return out;
    }

    // Legacy (V3): date -> markerId (built-in) oder customId
    const legacy = S.safeLoad(CONFIG.STORAGE_MARKERS_LEGACY, {});
    if (!legacy || typeof legacy !== "object" || Object.keys(legacy).length === 0) {
      return {};
    }

    const customIdToColor = new Map(
      (Array.isArray(customMarkers) ? customMarkers : []).map(m => [m.id, normHex(m.color)])
    );

    const migrated = {};
    for (const [k, v] of Object.entries(legacy)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
      if (typeof v !== "string") continue;

      let c = normHex(v);
      if (!c) c = builtInIdToColor(v);
      if (!c && customIdToColor.has(v)) c = customIdToColor.get(v) || null;
      if (!c) continue;

      migrated[k] = c;
    }

    // In neues Format speichern (Farbcodes)
    S.safeSave(CONFIG.STORAGE_MARKERS, migrated);
    return migrated;
  };

  // DOM Refs / App-State
  const state = {
    scroller: document.getElementById("scroller"),
    calendarEl: document.getElementById("calendar"),
    sentinelTop: document.getElementById("sentinel-top"),
    sentinelBottom: document.getElementById("sentinel-bottom"),
    swatchesEl: document.getElementById("swatches"),

    penToolBtn: document.getElementById("penTool"),
    eraserToolBtn: document.getElementById("eraserTool"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    clearBtn: document.getElementById("clearBtn"),

    // Info
    infoBtn: document.getElementById("infoBtn"),
    infoModal: document.getElementById("infoModal"),
    infoCloseBtn: document.getElementById("infoClose"),

    // Notiz
    noteModal: document.getElementById("noteModal"),
    noteDateEl: document.getElementById("noteDate"),
    noteTextEl: document.getElementById("noteText"),
    noteSaveBtn: document.getElementById("noteSave"),
    noteCancelBtn: document.getElementById("noteCancel"),

    // Clear
    clearModal: document.getElementById("clearModal"),
    clearCancelBtn: document.getElementById("clearCancel"),
    clearDoBtn: document.getElementById("clearDo"),
    clearConfirmText: document.getElementById("clearConfirmText"),

    // Custom Color Modal
    colorModal: document.getElementById("colorModal"),
    colorPickerEl: document.getElementById("colorPicker"),
    colorCancelBtn: document.getElementById("colorCancel"),
    colorAddBtn: document.getElementById("colorAdd"),

    // State
    mode: "none",           // "none" | "color" | "pen" | "erase"
    selectedColor: null,    // "#rrggbb" oder null

    customMarkers: loadCustomMarkers(),
    customColorPickerValue: "#ffd0d0",

    editingDateKey: null,
    editingCell: null,

    clearStepConfirm: false,

    colorMap: {},                   // date -> "#rrggbb"
    noteMap: S.safeLoad(CONFIG.STORAGE_NOTES, {}),

    minYear: null,
    maxYear: null,
    todayKey: null,
    todayYear: null,

    monthFmt: new Intl.DateTimeFormat(undefined, { month: "short" }),

    // Drag state
    dragActive: false,
    dragStarted: false,
    dragPointerId: null,
    dragMode: null,   // "color" | "erase" | "pen"
    dragColor: null,
    dragStartKey: null,
    dragLastKey: null,
  };

  // Farben laden (inkl. Migration)
  state.colorMap = loadColorMap(state.customMarkers);

  // CSS cols setzen
  document.documentElement.style.setProperty("--cols", String(CONFIG.COLS));

  // Heute (lokal)
  const now = new Date();
  const today = U.makeLocalNoon(now.getFullYear(), now.getMonth(), now.getDate());
  state.todayKey = U.ymd(today);
  state.todayYear = today.getFullYear();

  // ------- Helpers -------
  const getDayCellFromEventTarget = (t) => {
    const cell = t && t.closest ? t.closest(".day-cell") : null;
    if (!cell) return null;
    if (cell.classList.contains("empty")) return null;
    if (!cell.dataset.date) return null;
    return cell;
  };

  const getDayCellFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return getDayCellFromEventTarget(el);
  };

  const applyColorOnKey = (key, hexColor) => {
    const c = normHex(hexColor);
    if (!c) return;
    state.colorMap[key] = c;
    const cell = state.calendarEl.querySelector(`.day-cell[data-date="${key}"]`);
    if (cell) A.applyMarkerToCell(cell, c);
  };

  const eraseColorOnKey = (key) => {
    if (state.colorMap[key] !== undefined) delete state.colorMap[key];
    const cell = state.calendarEl.querySelector(`.day-cell[data-date="${key}"]`);
    if (cell) A.applyMarkerToCell(cell, null);
  };

  const saveColors = () => {
    S.safeSave(CONFIG.STORAGE_MARKERS, state.colorMap);
  };

  // Während Drag: Lücken füllen (Range zwischen lastKey und newKey)
  const applyDragRangeStep = (fromKey, toKey) => {
    if (!fromKey || !toKey) return;

    if (state.dragMode === "color") {
      U.iterateRangeKeys(fromKey, toKey, (k) => applyColorOnKey(k, state.dragColor));
      return;
    }

    if (state.dragMode === "erase") {
      U.iterateRangeKeys(fromKey, toKey, (k) => eraseColorOnKey(k));
    }
  };

  // Single click behavior (ohne Drag):
  // - color: toggle (gleiche Farbe -> entfernen)
  // - erase: entfernen
  // - pen: modal
  const handleSingleClick = (dateKey, cell) => {
    if (state.mode === "none") return;

    if (state.mode === "pen") {
      UI.openNoteModal(state, dateKey, cell);
      return;
    }

    if (state.mode === "erase") {
      eraseColorOnKey(dateKey);
      saveColors();
      return;
    }

    // color
    const selected = normHex(state.selectedColor);
    if (!selected) return;

    const current = normHex(cell.dataset.marker) || null;

    if (current === selected) {
      eraseColorOnKey(dateKey);
    } else {
      applyColorOnKey(dateKey, selected);
    }
    saveColors();
  };

  // ------- Pointer Drag Painting / Erasing -------
  const onPointerDown = (ev) => {
    if (ev.button !== 0) return;

    if (state.mode === "none") return;
    if (state.mode === "color" && !normHex(state.selectedColor)) return;

    const cell = getDayCellFromEventTarget(ev.target);
    if (!cell) return;

    const dateKey = cell.dataset.date;

    // Pen: kein Drag – normaler Klick (wir handeln in pointerup)
    if (state.mode === "pen") {
      ev.preventDefault();
      state.dragActive = true;
      state.dragStarted = false;
      state.dragPointerId = ev.pointerId;
      state.dragMode = "pen";
      state.dragStartKey = dateKey;
      state.dragLastKey = dateKey;

      try { state.calendarEl.setPointerCapture(ev.pointerId); } catch {}
      return;
    }

    // color/erase: Drag möglich
    ev.preventDefault();

    state.dragActive = true;
    state.dragStarted = false;
    state.dragPointerId = ev.pointerId;
    state.dragMode = (state.mode === "erase") ? "erase" : "color";
    state.dragColor = normHex(state.selectedColor);

    state.dragStartKey = dateKey;
    state.dragLastKey = dateKey;

    try { state.calendarEl.setPointerCapture(ev.pointerId); } catch {}
  };

  const onPointerMove = (ev) => {
    if (!state.dragActive) return;
    if (state.dragPointerId !== ev.pointerId) return;

    if (state.dragMode === "pen") return;
    if ((ev.buttons & 1) !== 1) return;

    const cell = getDayCellFromPoint(ev.clientX, ev.clientY);
    if (!cell) return;

    const key = cell.dataset.date;
    if (!key) return;
    if (key === state.dragLastKey) return;

    state.dragStarted = true;

    applyDragRangeStep(state.dragLastKey, key);

    state.dragLastKey = key;
    saveColors();
  };

  const onPointerUpOrCancel = (ev) => {
    if (!state.dragActive) return;
    if (state.dragPointerId !== ev.pointerId) return;

    const endCell = getDayCellFromPoint(ev.clientX, ev.clientY);
    const endKey = endCell ? endCell.dataset.date : state.dragLastKey;

    // Wenn kein echtes Drag stattgefunden hat => Single Click ausführen
    if (!state.dragStarted) {
      const startCell = state.calendarEl.querySelector(`.day-cell[data-date="${state.dragStartKey}"]`);
      if (startCell && state.dragStartKey) {
        handleSingleClick(state.dragStartKey, startCell);
      }
    } else {
      // Bei Drag: letzter Schritt (falls Up auf neuem Feld)
      if (state.dragMode !== "pen" && endKey && endKey !== state.dragLastKey) {
        applyDragRangeStep(state.dragLastKey, endKey);
        saveColors();
      }
    }

    state.dragActive = false;
    state.dragStarted = false;
    state.dragPointerId = null;
    state.dragMode = null;
    state.dragColor = null;
    state.dragStartKey = null;
    state.dragLastKey = null;

    try { state.calendarEl.releasePointerCapture(ev.pointerId); } catch {}
  };

  // ------- Info Modal -------
  const openInfoModal = () => {
    state.infoModal.hidden = false;
    state.infoModal.setAttribute("aria-hidden", "false");
    setTimeout(() => state.infoCloseBtn.focus(), 0);
  };

  const closeInfoModal = () => {
    state.infoModal.hidden = true;
    state.infoModal.setAttribute("aria-hidden", "true");
  };

  // ------- Render / Infinite Scroll -------
  const buildYearFn = (y) =>
    CAL.buildYear(y, state.todayKey, state.colorMap, state.noteMap, state.monthFmt);

  const renderInitial = () => {
    state.minYear = state.todayYear - CONFIG.INITIAL_YEARS_BEFORE;
    state.maxYear = state.todayYear + CONFIG.INITIAL_YEARS_AFTER;

    CAL.renderYears(state.calendarEl, state.minYear, state.maxYear, buildYearFn, { prepend: false });
    requestAnimationFrame(() => CAL.centerToday(state.scroller, state.calendarEl, state.todayKey));
  };

  const prependYears = () => {
    const oldHeight = state.scroller.scrollHeight;

    const newStart = state.minYear - CONFIG.CHUNK_YEARS;
    const newEnd = state.minYear - 1;

    CAL.renderYears(state.calendarEl, newStart, newEnd, buildYearFn, { prepend: true });
    state.minYear = newStart;

    const newHeight = state.scroller.scrollHeight;
    state.scroller.scrollTop += (newHeight - oldHeight);
  };

  const appendYears = () => {
    const newStart = state.maxYear + 1;
    const newEnd = state.maxYear + CONFIG.CHUNK_YEARS;

    CAL.renderYears(state.calendarEl, newStart, newEnd, buildYearFn, { prepend: false });
    state.maxYear = newEnd;
  };

  // ------- Wire UI -------
  const wireUI = () => {
    UI.renderSwatches(state.swatchesEl, state);

    // Stift: zweiter Klick deaktiviert; beim Aktivieren darf keine Farbe aktiv sein
    state.penToolBtn.addEventListener("click", () => {
      if (state.mode === "pen") {
        UI.setMode(state, "none");
        return;
      }
      UI.clearColorSelection(state);
      UI.setMode(state, "pen");
    });

    // Radierer: zweiter Klick deaktiviert
    state.eraserToolBtn.addEventListener("click", () => {
      UI.setMode(state, state.mode === "erase" ? "none" : "erase");
    });

    // Color Modal
    state.colorCancelBtn.addEventListener("click", () => UI.closeColorModal(state));
    state.colorAddBtn.addEventListener("click", () => UI.addCustomColorFromModal(state));

    // Note modal: nur Buttons schließen
    state.noteCancelBtn.addEventListener("click", () => UI.closeNoteModal(state));
    state.noteSaveBtn.addEventListener("click", () => UI.saveNoteFromModal(state));

    // Clear modal
    state.clearBtn.addEventListener("click", () => UI.openClearModal(state));
    state.clearCancelBtn.addEventListener("click", () => UI.closeClearModal(state));

    state.clearModal.addEventListener("change", (e) => {
      if (e.target && e.target.name === "clearChoice") {
        state.clearStepConfirm = false;
        state.clearConfirmText.hidden = true;
        state.clearDoBtn.textContent = "Löschen";
      }
    });

    state.clearDoBtn.addEventListener("click", () => {
      if (!state.clearStepConfirm) {
        state.clearStepConfirm = true;
        state.clearConfirmText.hidden = false;
        state.clearDoBtn.textContent = "Ja, löschen";
        return;
      }
      const choice = UI.getClearChoice(state);
      UI.doClearAction(state, choice);
      UI.closeClearModal(state);
    });

    // Export / Import
    state.exportBtn.addEventListener("click", () => UI.exportData(state));
    state.importBtn.addEventListener("click", () => state.importFile.click());
    state.importFile.addEventListener("change", async () => {
      const file = state.importFile.files && state.importFile.files[0];
      state.importFile.value = "";
      if (!file) return;
      await UI.importDataFromFile(state, file);
    });

    // Info
    state.infoBtn.addEventListener("click", openInfoModal);
    state.infoCloseBtn.addEventListener("click", closeInfoModal);

    // Pointer-based drag interaction
    state.calendarEl.addEventListener("pointerdown", onPointerDown);
    state.calendarEl.addEventListener("pointermove", onPointerMove);
    state.calendarEl.addEventListener("pointerup", onPointerUpOrCancel);
    state.calendarEl.addEventListener("pointercancel", onPointerUpOrCancel);

    // Beim Laden: bewusst kein aktiver Modus / keine Farbe aktiv
    UI.clearColorSelection(state);
    UI.setMode(state, "none");
  };

  // ------- Init -------
  wireUI();
  renderInitial();

  CAL.setupInfiniteScroll({
    scroller: state.scroller,
    sentinelTop: state.sentinelTop,
    sentinelBottom: state.sentinelBottom,
    onNeedPrepend: prependYears,
    onNeedAppend: appendYears
  });
})();
