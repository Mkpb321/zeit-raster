(() => {
  window.KalenderApp = window.KalenderApp || {};
  const { CONFIG } = window.KalenderApp;
  const U = window.KalenderApp.UTILS;

  const A = {};

  const isHexColor = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim());
  const normHex = (v) => (isHexColor(v) ? v.trim().toLowerCase() : null);

  A.isValidColor = (v) => !!normHex(v);
  // Backwards-compat alias (alte Stellen im Code)
  A.isValidMarkerId = A.isValidColor;

  A.applyMarkerToCell = (cell, colorOrNull) => {
    // Built-in Klassen entfernen (falls vorhanden)
    for (const m of CONFIG.MARKERS) cell.classList.remove(m.className);

    // Custom/inline Marker entfernen
    cell.classList.remove("marker-custom");
    cell.style.removeProperty("--m-custom");

    delete cell.dataset.marker;

    if (!colorOrNull) return;

    const hex = normHex(colorOrNull);
    if (!hex) return;

    // Wir benutzen für ALLE Farben (auch built-in) die Custom-Variante,
    // damit die Speicherung immer nur den Farbcode benötigt.
    cell.classList.add("marker-custom");
    cell.style.setProperty("--m-custom", hex);
    cell.dataset.marker = hex;
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

  A.applyAllFromMapsToRenderedCells = (calendarEl, colorMap, noteMap) => {
    const cells = calendarEl.querySelectorAll(".day-cell[data-date]");
    for (const cell of cells) {
      const key = cell.dataset.date;

      const c = colorMap[key];
      if (A.isValidColor(c)) A.applyMarkerToCell(cell, c);
      else A.applyMarkerToCell(cell, null);

      const n = noteMap[key];
      if (typeof n === "string" && n.trim().length > 0) A.applyNoteToCell(cell, n);
      else A.applyNoteToCell(cell, null);
    }
  };

  window.KalenderApp.APPLY = A;
})();
