(() => {
  window.KalenderApp = window.KalenderApp || {};
  const { CONFIG } = window.KalenderApp;
  const U = window.KalenderApp.UTILS;
  const S = window.KalenderApp.STORAGE;
  const A = window.KalenderApp.APPLY;

  const UI = {};

  const isHexColor = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim());
  const normHex = (v) => (isHexColor(v) ? v.trim().toLowerCase() : null);

  const builtInColors = () =>
    CONFIG.MARKERS.map(m => ({ id: m.id, label: m.label, color: m.color }));

  const allPaletteColors = (state) => {
    const custom = Array.isArray(state.customMarkers) ? state.customMarkers : [];
    return [
      ...builtInColors().map(x => ({ ...x, isCustom: false })),
      ...custom.map(x => ({ ...x, isCustom: true })),
    ];
  };

  const saveCustomMarkers = (state) => {
    const list = Array.isArray(state.customMarkers) ? state.customMarkers : [];
    S.safeSave(CONFIG.STORAGE_CUSTOM_MARKERS, list);
  };

  const updateSwatchSelectionUI = (swatchesEl, selectedColorOrNull) => {
    for (const el of swatchesEl.querySelectorAll('.swatch[data-color]')) {
      const c = el.getAttribute("data-color");
      el.setAttribute("aria-checked", String(!!selectedColorOrNull && c === selectedColorOrNull));
    }
  };

  UI.clearColorSelection = (state) => {
    state.selectedColor = null;
    if (state.swatchesEl) updateSwatchSelectionUI(state.swatchesEl, null);
  };

  UI.setMode = (state, mode) => {
    state.mode = mode;
    state.penToolBtn.setAttribute("aria-pressed", String(mode === "pen"));
    state.eraserToolBtn.setAttribute("aria-pressed", String(mode === "erase"));

    if (state.swatchesEl) {
      updateSwatchSelectionUI(state.swatchesEl, mode === "color" ? state.selectedColor : null);
    }
  };

  // ---------- Custom Color Modal ----------
  UI.openColorModal = (state) => {
    state.colorPickerEl.value = normHex(state.customColorPickerValue) || "#ffd0d0";
    state.colorModal.hidden = false;
    state.colorModal.setAttribute("aria-hidden", "false");
    setTimeout(() => state.colorAddBtn.focus(), 0);
  };

  UI.closeColorModal = (state) => {
    state.colorModal.hidden = true;
    state.colorModal.setAttribute("aria-hidden", "true");
  };

  const ensureSelectColor = (state, hex) => {
    state.selectedColor = hex;
    UI.setMode(state, "color");
    if (state.swatchesEl) updateSwatchSelectionUI(state.swatchesEl, hex);
  };

  UI.addCustomColorFromModal = (state) => {
    const hex = normHex(state.colorPickerEl.value);
    if (!hex) return;

    state.customColorPickerValue = hex;

    state.customMarkers = Array.isArray(state.customMarkers) ? state.customMarkers : [];

    // Duplikate vermeiden: wenn Farbe schon existiert -> nur auswählen
    const existing = state.customMarkers.find(m => m && normHex(m.color) === hex);
    if (existing) {
      ensureSelectColor(state, hex);
      UI.closeColorModal(state);
      return;
    }

    const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    state.customMarkers.push({
      id,
      color: hex,
      label: hex.toUpperCase(),
      isCustom: true,
    });

    saveCustomMarkers(state);
    UI.renderSwatches(state.swatchesEl, state);
    ensureSelectColor(state, hex);
    UI.closeColorModal(state);
  };

  UI.deleteCustomMarker = (state, id) => {
    state.customMarkers = (Array.isArray(state.customMarkers) ? state.customMarkers : [])
      .filter(m => !(m && m.id === id));

    saveCustomMarkers(state);
    UI.renderSwatches(state.swatchesEl, state);

    // Wenn die aktuell gewählte Farbe nicht mehr in der Palette existiert -> abwählen
    const selected = normHex(state.selectedColor);
    if (selected) {
      const stillExists = allPaletteColors(state).some(m => normHex(m.color) === selected);
      if (!stillExists && state.mode === "color") {
        UI.clearColorSelection(state);
        UI.setMode(state, "none");
      }
    }
  };

  // ---------- Swatches ----------
  UI.renderSwatches = (swatchesEl, state) => {
    swatchesEl.innerHTML = "";

    const defs = allPaletteColors(state);

    for (const m of defs) {
      const wrap = document.createElement("div");
      wrap.className = "swatch-wrap";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-label", m.label || "Farbe");
      btn.setAttribute("data-color", normHex(m.color) || "");
      btn.setAttribute(
        "aria-checked",
        String(state.mode === "color" && normHex(m.color) === normHex(state.selectedColor))
      );
      btn.style.background = m.color;

      btn.addEventListener("click", () => {
        const c = normHex(m.color);
        if (!c) return;

        const isAlreadySelected = normHex(state.selectedColor) === c;

        // Zweiter Klick auf die gleiche Farbe => abwählen (kein aktives Werkzeug)
        if (isAlreadySelected && state.mode === "color") {
          UI.clearColorSelection(state);
          UI.setMode(state, "none");
          return;
        }

        ensureSelectColor(state, c);
      });

      wrap.appendChild(btn);

      if (m.isCustom) {
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

    // Plus (öffnet Modal) – ohne zusätzliches Farbfeld
    const addWrap = document.createElement("div");
    addWrap.className = "swatch-wrap";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "swatch swatch-add";
    addBtn.setAttribute("aria-label", "Neue Custom-Farbe hinzufügen");
    addBtn.title = "Neue Farbe hinzufügen";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => UI.openColorModal(state));

    addWrap.appendChild(addBtn);
    swatchesEl.appendChild(addWrap);

    // Falls kein Farbmodus aktiv ist, darf auch nichts als "checked" erscheinen
    if (state.mode !== "color") updateSwatchSelectionUI(swatchesEl, null);
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
      state.colorMap = {};
      S.safeSave(CONFIG.STORAGE_MARKERS, state.colorMap);
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
    state.colorMap = {};
    state.noteMap = {};
    S.safeSave(CONFIG.STORAGE_MARKERS, state.colorMap);
    S.safeSave(CONFIG.STORAGE_NOTES, state.noteMap);
    A.applyAllFromMapsToRenderedCells(state.calendarEl, state.colorMap, state.noteMap);
  };

  // ---------- Export / Import ----------
  UI.exportData = (state) => {
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      colors: state.colorMap, // date -> "#rrggbb"
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

  const validateCustomMarkers = (value) => {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();

    for (const m of value) {
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

  UI.importDataFromFile = async (state, file) => {
    const text = await file.text();
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      alert("Import fehlgeschlagen: Datei ist kein gültiges JSON.");
      return;
    }

    // Erwartet: { colors, notes, customMarkers }
    const colors = obj && obj.colors;
    const notes = obj && obj.notes;

    if (!colors || typeof colors !== "object" || !notes || typeof notes !== "object") {
      alert("Import fehlgeschlagen: Datei-Format ungültig (colors/notes fehlen).");
      return;
    }

    const nextCustom = validateCustomMarkers(obj.customMarkers);

    const nextColors = {};
    for (const [k, v] of Object.entries(colors)) {
      if (typeof k !== "string") continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;

      if (typeof v !== "string") continue;
      const c = normHex(v);
      if (!c) continue;
      nextColors[k] = c;
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

    state.colorMap = nextColors;
    state.noteMap = nextNotes;

    S.safeSave(CONFIG.STORAGE_MARKERS, state.colorMap);
    S.safeSave(CONFIG.STORAGE_NOTES, state.noteMap);

    // Import ändert nicht automatisch den aktiven Modus: wir lassen es bewusst auf "none"
    UI.clearColorSelection(state);
    UI.setMode(state, "none");

    A.applyAllFromMapsToRenderedCells(state.calendarEl, state.colorMap, state.noteMap);
    UI.renderSwatches(state.swatchesEl, state);
  };

  window.KalenderApp.UI = UI;
})();
