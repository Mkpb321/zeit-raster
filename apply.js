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

  const clampByte = (n) => Math.max(0, Math.min(255, Math.round(n)));

  const darkenHex = (hex, amount = 0.18) => {
    const c = normHex(hex);
    if (!c) return null;

    const ratio = Math.max(0, Math.min(1, Number(amount) || 0));
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);

    const toHex = (v) => clampByte(v).toString(16).padStart(2, "0");
    return `#${toHex(r * (1 - ratio))}${toHex(g * (1 - ratio))}${toHex(b * (1 - ratio))}`;
  };

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
    // An Wochenenden wird nur die Darstellung leicht dunkler gemacht;
    // gespeichert bleibt weiterhin immer die Originalfarbe.
    const renderHex = cell.classList.contains("weekend-col") ? darkenHex(hex, 0.18) || hex : hex;

    cell.classList.add("marker-custom");
    cell.style.setProperty("--m-custom", renderHex);
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
