(() => {
  const { CONFIG } = window.KalenderApp;
  const U = window.KalenderApp.UTILS;
  const S = window.KalenderApp.STORAGE;
  const A = window.KalenderApp.APPLY;
  const CAL = window.KalenderApp.CALENDAR;
  const UI = window.KalenderApp.UI;

  // DOM Refs
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

    noteModal: document.getElementById("noteModal"),
    noteDateEl: document.getElementById("noteDate"),
    noteTextEl: document.getElementById("noteText"),
    noteSaveBtn: document.getElementById("noteSave"),
    noteCancelBtn: document.getElementById("noteCancel"),

    clearModal: document.getElementById("clearModal"),
    clearCancelBtn: document.getElementById("clearCancel"),
    clearDoBtn: document.getElementById("clearDo"),
    clearConfirmText: document.getElementById("clearConfirmText"),

    // State
    mode: "color",                 // "color" | "pen" | "erase"
    selectedMarkerId: CONFIG.MARKERS[0].id,
    rangeAnchorKey: null,

    editingDateKey: null,
    editingCell: null,

    clearStepConfirm: false,

    markerMap: S.safeLoad(CONFIG.STORAGE_MARKERS),
    noteMap: S.safeLoad(CONFIG.STORAGE_NOTES),

    minYear: null,
    maxYear: null,
    todayKey: null,
    todayYear: null,

    monthFmt: new Intl.DateTimeFormat(undefined, { month: "short" }),
  };

  // CSS cols setzen
  document.documentElement.style.setProperty("--cols", String(CONFIG.COLS));

  // Heute (lokal)
  const now = new Date();
  const today = U.makeLocalNoon(now.getFullYear(), now.getMonth(), now.getDate());
  state.todayKey = U.ymd(today);
  state.todayYear = today.getFullYear();

  // ------- Range actions -------
  const applyColorRange = (fromKey, toKey, markerId) => {
    U.iterateRangeKeys(fromKey, toKey, (key) => {
      state.markerMap[key] = markerId;
      const cell = state.calendarEl.querySelector(`.day-cell[data-date="${key}"]`);
      if (cell) A.applyMarkerToCell(cell, markerId);
    });
    S.safeSave(CONFIG.STORAGE_MARKERS, state.markerMap);
  };

  const eraseColorRange = (fromKey, toKey) => {
    U.iterateRangeKeys(fromKey, toKey, (key) => {
      if (state.markerMap[key] !== undefined) delete state.markerMap[key];
      const cell = state.calendarEl.querySelector(`.day-cell[data-date="${key}"]`);
      if (cell) A.applyMarkerToCell(cell, null);
    });
    S.safeSave(CONFIG.STORAGE_MARKERS, state.markerMap);
  };

  // ------- Calendar click handler -------
  const onCalendarClick = (ev) => {
    const cell = ev.target.closest(".day-cell");
    if (!cell) return;
    if (cell.classList.contains("empty")) return;

    const dateKey = cell.dataset.date;
    if (!dateKey) return;

    if (state.mode === "pen") {
      UI.openNoteModal(state, dateKey, cell);
      return;
    }

    if (state.mode === "erase") {
      if (ev.shiftKey && state.rangeAnchorKey) {
        eraseColorRange(state.rangeAnchorKey, dateKey);
        state.rangeAnchorKey = dateKey;
        return;
      }

      if (state.markerMap[dateKey] !== undefined) delete state.markerMap[dateKey];
      A.applyMarkerToCell(cell, null);
      S.safeSave(CONFIG.STORAGE_MARKERS, state.markerMap);
      state.rangeAnchorKey = dateKey;
      return;
    }

    // color mode
    const selected = state.selectedMarkerId;

    if (ev.shiftKey && state.rangeAnchorKey) {
      applyColorRange(state.rangeAnchorKey, dateKey, selected);
      state.rangeAnchorKey = dateKey;
      return;
    }

    const current = cell.dataset.marker || null;
    if (current === selected) {
      A.applyMarkerToCell(cell, null);
      delete state.markerMap[dateKey];
      S.safeSave(CONFIG.STORAGE_MARKERS, state.markerMap);
    } else {
      A.applyMarkerToCell(cell, selected);
      state.markerMap[dateKey] = selected;
      S.safeSave(CONFIG.STORAGE_MARKERS, state.markerMap);
    }
    state.rangeAnchorKey = dateKey;
  };

  // ------- Render / Infinite Scroll -------
  const buildYearFn = (y) =>
    CAL.buildYear(y, state.todayKey, state.markerMap, state.noteMap, state.monthFmt);

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

    state.penToolBtn.addEventListener("click", () => {
      UI.setMode(state, state.mode === "pen" ? "color" : "pen");
    });

    state.eraserToolBtn.addEventListener("click", () => {
      UI.setMode(state, state.mode === "erase" ? "color" : "erase");
    });

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

    // Calendar click
    state.calendarEl.addEventListener("click", onCalendarClick);

    // Default mode
    UI.setMode(state, "color");
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
