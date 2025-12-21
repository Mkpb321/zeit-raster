(() => {
  window.KalenderApp = window.KalenderApp || {};
  const { CONFIG } = window.KalenderApp;
  const U = window.KalenderApp.UTILS;
  const S = window.KalenderApp.STORAGE;
  const A = window.KalenderApp.APPLY;

  const UI = {};

  const isHexColor = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim());

  const normalizeHex = (v) => {
    if (!isHexColor(v)) return null;
    return v.trim().toLowerCase();
  };

  const getBuiltInMarkerColor = (markerDef) => {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(markerDef.cssVar)
      .trim();
    return v || "#fff";
  };

  const getAllMarkerDefs = (state) => {
    const custom = Array.isArray(state.customMarkers) ? state.customMarkers : [];
    return [...CONFIG.MARKERS, ...custom];
  };

  const setGlobalCustomMarkers = (state) => {
    window.KalenderApp.CUSTOM_MARKERS = Array.isArray(state.customMarkers) ? state.customMarkers : [];
  };

  const saveCustomMarkers = (state) => {
    setGlobalCustomMarkers(state);
    S.safeSave(CONFIG.STORAGE_CUSTOM_MARKERS, state.customMarkers);
  };

  UI.clearColorSelection = (state) => {
    state.selectedMarkerId = null;
    if (!state.swatchesEl) return;
    for (const child of state.swatchesEl.querySelectorAll('.swatch[data-marker-id]')) {
      child.setAttribute("aria-checked", "false");
    }
  };

  const updateSwatchSelectionUI = (swatchesEl, selectedIdOrNull) => {
    for (const el of swatchesEl.querySelectorAll('.swatch[data-marker-id]')) {
      const id = el.getAttribute("data-marker-id");
      el.setAttribute("aria-checked", String(!!selectedIdOrNull && id === selectedIdOrNull));
    }
  };

  UI.addCustomMarker = (state, color) => {
    const hex = normalizeHex(color);
    if (!hex) return;

    const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const def = {
      id,
      label: hex.toUpperCase(),
      color: hex,
      isCustom: true,
    };

    state.customMarkers = Array.isArray(state.customMarkers) ? state.customMarkers : [];
    state.customMarkers.push(def);
    saveCustomMarkers(state);

    // Neu hinzugefügte Farbe direkt auswählen
    state.selectedMarkerId = id;
    UI.setMode(state, "color");

    UI.renderSwatches(state.swatchesEl, state);
  };

  UI.deleteCustomMarker = (state, markerId) => {
    const before = Array.isArray(state.customMarkers) ? state.customMarkers : [];
    const after = before.filter(m => !(m && m.id === markerId));

    state.customMarkers = after;
    saveCustomMarkers(state);

    // MarkerMap bereinigen (sonst bleiben "tote" MarkerIds gespeichert)
    let changed = false;
    for (const [k, v] of Object.entries(state.markerMap || {})) {
      if (v === markerId) {
        delete state.markerMap[k];
        changed = true;
      }
    }
    if (changed) S.safeSave(CONFIG.STORAGE_MARKERS, state.markerMap);

    // Wenn gerade ausgewählt: abwählen (kein aktives Werkzeug)
    if (state.selectedMarkerId === markerId) {
      UI.clearColorSelection(state);
      UI.setMode(state, "none");
    }

    A.applyAllFromMapsToRenderedCells(state.calendarEl, state.markerMap, state.noteMap);
    UI.renderSwatches(state.swatchesEl, state);
  };

  UI.renderSwatches = (swatchesEl, state) => {
    swatchesEl.innerHTML = "";

    const defs = getAllMarkerDefs(state);

    for (const m of defs) {
      const wrap = document.createElement("div");
      wrap.className = "swatch-wrap";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.setAttribute("role", "radio");
      btn.setAttribute("data-marker-id", m.id);
      btn.setAttribute("aria-label", m.label || "Farbe");
      btn.setAttribute(
        "aria-checked",
        String(state.mode === "color" && m.id === state.selectedMarkerId)
      );

      if (m.cssVar) {
        btn.style.background = getBuiltInMarkerColor(m);
      } else if (typeof m.color === "string") {
        btn.style.background = m.color;
      }

      btn.addEventListener("click", () => {
        const isAlreadySelected = state.selectedMarkerId === m.id;

        // Zweiter Klick auf die gleiche Farbe => abwählen (kein aktives Werkzeug)
        if (isAlreadySelected && state.mode === "color") {
          UI.clearColorSelection(state);
          UI.setMode(state, "none");
          return;
        }

        state.selectedMarkerId = m.id;
        UI.setMode(state, "color");
      });

      wrap.appendChild(btn);

      // Custom Marker: löschbar
      if (m && m.isCustom) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "swatch-del";
        del.setAttribute("aria-label", "Custom-Farbe entfernen");
        del.title = "Farbe entfernen";
        del.textContent = "×";

        del.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          UI.deleteCustomMarker(state, m.id);
        });

        wrap.appendChild(del);
      }

      swatchesEl.appendChild(wrap);
    }

    // --- Add Controls (Plus + Color Picker) ---
    const addWrap = document.createElement("div");
    addWrap.className = "swatch-wrap";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "swatch swatch-add";
    addBtn.setAttribute("aria-label", "Neue Custom-Farbe hinzufügen");
    addBtn.title = "Neue Farbe hinzufügen";
    addBtn.textContent = "+";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "swatch-color";
    colorInput.setAttribute("aria-label", "Farbe wählen");
    colorInput.title = "Farbe wählen";
    colorInput.value = normalizeHex(state.customColorPickerValue) || "#ffd0d0";

    addBtn.addEventListener("click", () => colorInput.click());
    colorInput.addEventListener("change", () => {
      state.customColorPickerValue = colorInput.value;
      UI.addCustomMarker(state, colorInput.value);
    });

    addWrap.appendChild(addBtn);
    swatchesEl.appendChild(addWrap);
    swatchesEl.appendChild(colorInput);
  };

  UI.setMode = (state, mode) => {
    state.mode = mode;
    state.penToolBtn.setAttribute("aria-pressed", String(mode === "pen"));
    state.eraserToolBtn.setAttribute("aria-pressed", String(mode === "erase"));

    // Farben sind nur im Farbmodus "aktiv"/markiert
    if (state.swatchesEl) {
      updateSwatchSelectionUI(
        state.swatchesEl,
        mode === "color" ? state.selectedMarkerId : null
      );
    }
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
      version: 2,
      exportedAt: new Date().toISOString(),
      markers: state.markerMap,
      notes: state.noteMap,
      customMarkers: Array.isArray(state.customMarkers) ? state.customMarkers : [],
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

  const isValidMarkerIdWithCustom = (id, customMarkers) => {
    if (CONFIG.MARKERS.some(m => m.id === id)) return true;
    if (!Array.isArray(customMarkers)) return false;
    return customMarkers.some(m => m && m.id === id && isHexColor(m.color));
  };

  const validateCustomMarkers = (value) => {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();

    for (const m of value) {
      if (!m || typeof m !== "object") continue;
      const id = typeof m.id === "string" ? m.id.trim() : "";
      const color = normalizeHex(m.color);
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
      alert("Import fehlgeschlagen: Datei-Format ungültig (markers/notes fehlen). ");
      return;
    }

    const nextCustom = validateCustomMarkers(obj.customMarkers);

    const nextMarkers = {};
    for (const [k, v] of Object.entries(markers)) {
      if (typeof k !== "string") continue;
      if (typeof v !== "string") continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
      if (!isValidMarkerIdWithCustom(v, nextCustom)) continue;
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

    state.customMarkers = nextCustom;
    saveCustomMarkers(state);

    state.markerMap = nextMarkers;
    state.noteMap = nextNotes;

    S.safeSave(CONFIG.STORAGE_MARKERS, state.markerMap);
    S.safeSave(CONFIG.STORAGE_NOTES, state.noteMap);

    // Auswahl ggf. ungültig machen
    const allDefs = getAllMarkerDefs(state);
    const validSelected = allDefs.some(m => m.id === state.selectedMarkerId);
    if (!validSelected) {
      UI.clearColorSelection(state);
      UI.setMode(state, "none");
    }

    A.applyAllFromMapsToRenderedCells(state.calendarEl, state.markerMap, state.noteMap);
    UI.renderSwatches(state.swatchesEl, state);
  };

  window.KalenderApp.UI = UI;
})();
