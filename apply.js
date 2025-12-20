(() => {
  window.KalenderApp = window.KalenderApp || {};
  const { CONFIG } = window.KalenderApp;
  const U = window.KalenderApp.UTILS;

  const A = {};

  A.isValidMarkerId = (id) => CONFIG.MARKERS.some(m => m.id === id);

  A.applyMarkerToCell = (cell, markerIdOrNull) => {
    for (const m of CONFIG.MARKERS) cell.classList.remove(m.className);
    delete cell.dataset.marker;

    if (!markerIdOrNull) return;
    if (!A.isValidMarkerId(markerIdOrNull)) return;

    const m = CONFIG.MARKERS.find(x => x.id === markerIdOrNull);
    cell.classList.add(m.className);
    cell.dataset.marker = markerIdOrNull;
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
