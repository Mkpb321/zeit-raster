(() => {
  window.KalenderApp = window.KalenderApp || {};

  window.KalenderApp.CONFIG = {
    COLS: 37,
    CHUNK_YEARS: 2,
    INITIAL_YEARS_BEFORE: 2,
    INITIAL_YEARS_AFTER: 2,

    WEEKDAYS: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],

    MARKERS: [
      { id: "yellow",  label: "Gelb",  className: "marker-yellow",  cssVar: "--m-yellow"  },
      { id: "green",   label: "Grün",  className: "marker-green",   cssVar: "--m-green"   },
      { id: "blue",    label: "Blau",  className: "marker-blue",    cssVar: "--m-blue"    },
      { id: "red",     label: "Rot",   className: "marker-red",     cssVar: "--m-red"     },
      { id: "purple",  label: "Lila",  className: "marker-purple",  cssVar: "--m-purple"  },
    ],

    STORAGE_MARKERS: "calendarMarkersV3",
    STORAGE_NOTES: "calendarNotesV2",
  };
})();
