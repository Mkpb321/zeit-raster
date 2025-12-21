(() => {
  window.KalenderApp = window.KalenderApp || {};
  const { CONFIG } = window.KalenderApp;
  const U = window.KalenderApp.UTILS;

  const A = {};

  const getCustomMarkers = () => {
    const list = window.KalenderApp.CUSTOM_MARKERS;
    return Array.isArray(list) ? list : [];
  };

  const findMarkerDef = (id) => {
    if (!id) return null;

    const builtIn = CONFIG.MARKERS.find(m => m.id === id);
    if (builtIn) return { ...builtIn, __type: "builtin" };

    const custom = getCustomMarkers().find(m => m && m.id === id && typeof m.color === "string");
    if (custom) return { ...custom, __type: "custom" };

    return null;
  };

  A.isValidMarkerId = (id) => !!findMarkerDef(id);

  A.applyMarkerToCell = (cell, markerIdOrNull) => {
    // Built-in Klassen entfernen
    for (const m of CONFIG.MARKERS) cell.classList.remove(m.className);

    // Custom Marker entfernen
    cell.classList.remove("marker-custom");
    cell.style.removeProperty("--m-custom");

    delete cell.dataset.marker;

    if (!markerIdOrNull) return;

    const def = findMarkerDef(markerIdOrNull);
    if (!def) return;

    if (def.__type === "builtin") {
      cell.classList.add(def.className);
      cell.dataset.marker = def.id;
      return;
    }

    // Custom
    const color = String(def.color).trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;

    cell.classList.add("marker-custom");
    cell.style.setProperty("--m-custom", color);
    cell.dataset.marker = def.id;
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

  A.applyNoteToCell = (cell, noteTextOrNull) => {
    cell.classList.remove("has-note");
    delete cell.dataset.note;

    if (!noteTextOrNull) {
      cell.removeAttribute("title");
      setNotePreviewElement(cell, null);
      return;
    }

    cell.classList.add("has-note");
    cell.dataset.note = noteTextOrNull;

    cell.setAttribute("title", U.tooltipText(noteTextOrNull));
    setNotePreviewElement(cell, U.notePreview(noteTextOrNull));
  };

  A.applyAllFromMapsToRenderedCells = (calendarEl, markerMap, noteMap) => {
    const cells = calendarEl.querySelectorAll(".day-cell[data-date]");
    for (const cell of cells) {
      const key = cell.dataset.date;

      const m = markerMap[key];
      if (m && A.isValidMarkerId(m)) A.applyMarkerToCell(cell, m);
      else A.applyMarkerToCell(cell, null);

      const n = noteMap[key];
      if (typeof n === "string" && n.trim().length > 0) A.applyNoteToCell(cell, n);
      else A.applyNoteToCell(cell, null);
    }
  };

  window.KalenderApp.APPLY = A;
})();
