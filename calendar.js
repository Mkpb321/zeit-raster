(() => {
  window.KalenderApp = window.KalenderApp || {};
  const { CONFIG } = window.KalenderApp;
  const U = window.KalenderApp.UTILS;
  const A = window.KalenderApp.APPLY;

  const C = {};

  C.buildYear = (year, todayKey, markerMap, noteMap, monthFmt) => {
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

    for (let c = 0; c < CONFIG.COLS; c++) {
      const hc = document.createElement("div");
      hc.className = "header-cell";
      hc.textContent = CONFIG.WEEKDAYS[c % 7];
      if (U.isWeekendColumn(c)) hc.classList.add("weekend-col");
      header.appendChild(hc);
    }
    wrap.appendChild(header);

    // Monate
    for (let m = 0; m < 12; m++) {
      const row = document.createElement("div");
      row.className = "month-row";

      const label = document.createElement("div");
      label.className = "label-cell";
      label.textContent = monthFmt.format(U.makeLocalNoon(year, m, 1));
      row.appendChild(label);

      const first = U.makeLocalNoon(year, m, 1);
      const lead = U.isoWeekdayIndex(first); // 0..6
      const dim = U.daysInMonth(year, m);

      for (let c = 0; c < CONFIG.COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "day-cell";
        if (U.isWeekendColumn(c)) cell.classList.add("weekend-col");

        const dayNum = (c - lead) + 1;

        if (dayNum < 1 || dayNum > dim) {
          cell.classList.add("empty");
          cell.textContent = "";
        } else {
          cell.textContent = String(dayNum);
          const d = U.makeLocalNoon(year, m, dayNum);
          const key = U.ymd(d);
          cell.dataset.date = key;

          if (key === todayKey) cell.classList.add("today");

          const storedMarker = markerMap[key];
          if (storedMarker) A.applyMarkerToCell(cell, storedMarker);

          const storedNote = noteMap[key];
          if (typeof storedNote === "string" && storedNote.trim().length > 0) {
            A.applyNoteToCell(cell, storedNote);
          }
        }

        row.appendChild(cell);
      }

      wrap.appendChild(row);
    }

    return wrap;
  };

  C.renderYears = (calendarEl, startYear, endYear, buildYearFn, { prepend = false } = {}) => {
    const frag = document.createDocumentFragment();
    for (let y = startYear; y <= endYear; y++) {
      frag.appendChild(buildYearFn(y));
    }
    if (prepend) calendarEl.prepend(frag);
    else calendarEl.appendChild(frag);
  };

  C.centerToday = (scroller, calendarEl, todayKey) => {
    const el = calendarEl.querySelector(`[data-date="${todayKey}"]`);
    if (!el) return;

    const scRect = scroller.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elTopInScroller = (elRect.top - scRect.top) + scroller.scrollTop;
    const target = elTopInScroller + (el.offsetHeight / 2) - (scroller.clientHeight / 2);

    scroller.scrollTop = Math.max(0, target);
  };

  C.setupInfiniteScroll = ({
    scroller,
    sentinelTop,
    sentinelBottom,
    onNeedPrepend,
    onNeedAppend
  }) => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (e.target === sentinelTop) onNeedPrepend();
        else if (e.target === sentinelBottom) onNeedAppend();
      }
    }, { root: scroller, threshold: 0.01 });

    io.observe(sentinelTop);
    io.observe(sentinelBottom);

    return io;
  };

  window.KalenderApp.CALENDAR = C;
})();
