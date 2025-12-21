(() => {
  window.KalenderApp = window.KalenderApp || {};
  const { CONFIG } = window.KalenderApp;
  const U = window.KalenderApp.UTILS;
  const S = window.KalenderApp.STORAGE;
  const A = window.KalenderApp.APPLY;

  const UI = {};

  UI.clearColorSelection = (state) => {
    state.selectedMarkerId = null;
    if (!state.swatchesEl) return;
    for (const child of state.swatchesEl.querySelectorAll(".swatch")) {
      child.setAttribute("aria-checked", "false");
    }
  };

  UI.renderSwatches = (swatchesEl, state) => {
    swatchesEl.innerHTML = "";

    for (const m of CONFIG.MARKERS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-label", m.label);
      btn.setAttribute("aria-checked", String(m.id === state.selectedMarkerId));

      btn.style.background =
        getComputedStyle(document.documentElement).getPropertyValue(m.cssVar).trim() || "#fff";

      btn.addEventListener("click", () => {
        const isAlreadySelected = state.selectedMarkerId === m.id;

        // Zweiter Klick auf die gleiche Farbe => abwählen (kein aktives Werkzeug)
        if (isAlreadySelected && state.mode === "color") {
          UI.clearColorSelection(state);
          UI.setMode(state, "none");
          return;
        }

        state.selectedMarkerId = m.id;

        for (const child of swatchesEl.querySelectorAll(".swatch")) {
          child.setAttribute("aria-checked", "false");
        }
        btn.setAttribute("aria-checked", "true");

        // Farbauswahl => Farbmodus
        UI.setMode(state, "color");
      });

      swatchesEl.appendChild(btn);
    }
  };

  UI.setMode = (state, mode) => {
    state.mode = mode;
    state.penToolBtn.setAttribute("aria-pressed", String(mode === "pen"));
    state.eraserToolBtn.setAttribute("aria-pressed", String(mode === "erase"));
  };

  // ---------- Notes Modal ----------
  UI.openNoteModal = (state, dateKey, cell) => {
    state.editingDateKey = dateKey;
    state.editingCell = cell;

    state.noteDateEl.textContent = dateKey;
    state.noteTextEl.value = state.noteMap[dateKey] || "";

    state.noteModal.hidden = false;
    state.noteModal.setAttribute("aria-hidden", "false");
    setTimeout(() => state.noteTextEl.focus(), 0);
  };

  UI.closeNoteModal = (state) => {
    state.noteModal.hidden = true;
    state.noteModal.setAttribute("aria-hidden", "true");
    state.editingDateKey = null;
    state.editingCell = null;
  };

  UI.saveNoteFromModal = (state) => {
    const key = state.editingDateKey;
    const cell = state.editingCell;
    if (!key || !cell) return;

    const raw = state.noteTextEl.value ?? "";
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      delete state.noteMap[key];
      S.safeSave(CONFIG.STORAGE_NOTES, state.noteMap);
      A.applyNoteToCell(cell, null);
      UI.closeNoteModal(state);
      return;
    }

    state.noteMap[key] = raw;
    S.safeSave(CONFIG.STORAGE_NOTES, state.noteMap);
    A.applyNoteToCell(cell, raw);
    UI.closeNoteModal(state);
  };

  // ---------- Clear Modal ----------
  UI.openClearModal = (state) => {
    state.clearStepConfirm = false;
    state.clearConfirmText.hidden = true;
    state.clearDoBtn.textContent = "Löschen";
    state.clearModal.hidden = false;
    state.clearModal.setAttribute("aria-hidden", "false");
  };

  UI.closeClearModal = (state) => {
    state.clearModal.hidden = true;
    state.clearModal.setAttribute("aria-hidden", "true");
  };

  UI.getClearChoice = (state) => {
    const el = state.clearModal.querySelector('input[name="clearChoice"]:checked');
    return el ? el.value : "colors";
  };

  UI.doClearAction = (state, choice) => {
    if (choice === "colors") {
      state.markerMap = {};
      S.safeSave(CONFIG.STORAGE_MARKERS, state.markerMap);
      const anyMarked = state.calendarEl.querySelectorAll(".day-cell[data-marker]");
      for (const cell of anyMarked) A.applyMarkerToCell(cell, null);
      return;
    }

    if (choice === "notes") {
      state.noteMap = {};
      S.safeSave(CONFIG.STORAGE_NOTES, state.noteMap);
      const anyNotes = state.calendarEl.querySelectorAll(".day-cell.has-note");
      for (const cell of anyNotes) A.applyNoteToCell(cell, null);
      return;
    }

    // all
    state.markerMap = {};
    state.noteMap = {};
    S.safeSave(CONFIG.STORAGE_MARKERS, state.markerMap);
    S.safeSave(CONFIG.STORAGE_NOTES, state.noteMap);
    A.applyAllFromMapsToRenderedCells(state.calendarEl, state.markerMap, state.noteMap);
  };

  // ---------- Export / Import ----------
  UI.exportData = (state) => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      markers: state.markerMap,
      notes: state.noteMap
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });

    const ts = new Date();
    const defaultName =
      `zeit-raster-backup-${ts.getFullYear()}${U.pad2(ts.getMonth() + 1)}${U.pad2(ts.getDate())}-` +
      `${U.pad2(ts.getHours())}${U.pad2(ts.getMinutes())}${U.pad2(ts.getSeconds())}.json`;

    const inputName = window.prompt("Dateiname für Export:", defaultName);
    if (inputName === null) return;

    const trimmed = String(inputName).trim();
    if (!trimmed) return;

    const name = trimmed.toLowerCase().endsWith(".json") ? trimmed : `${trimmed}.json`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const isValidMarkerId = (id) => CONFIG.MARKERS.some(m => m.id === id);

  UI.importDataFromFile = async (state, file) => {
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

    state.markerMap = nextMarkers;
    state.noteMap = nextNotes;

    S.safeSave(CONFIG.STORAGE_MARKERS, state.markerMap);
    S.safeSave(CONFIG.STORAGE_NOTES, state.noteMap);

    A.applyAllFromMapsToRenderedCells(state.calendarEl, state.markerMap, state.noteMap);
  };

  window.KalenderApp.UI = UI;
})();
