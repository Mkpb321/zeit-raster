(() => {
  window.KalenderApp = window.KalenderApp || {};

  window.KalenderApp.CONFIG = {
    COLS: 37,
    CHUNK_YEARS: 2,
    INITIAL_YEARS_BEFORE: 2,
    INITIAL_YEARS_AFTER: 2,

    WEEKDAYS: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],

    // Built-in Markerpalette (immer vorhanden)
    MARKERS: [
      { id: "yellow", label: "Gelb",   className: "marker-yellow",  cssVar: "--m-yellow",  color: "#fff3b0" },
      { id: "green",  label: "Grün",   className: "marker-green",   cssVar: "--m-green",   color: "#c9f7d5" },
      { id: "blue",   label: "Blau",   className: "marker-blue",    cssVar: "--m-blue",    color: "#cfe7ff" },
      { id: "red",    label: "Rot",    className: "marker-red",     cssVar: "--m-red",     color: "#ffd0d0" },
      { id: "purple", label: "Lila",   className: "marker-purple",  cssVar: "--m-purple",  color: "#ead7ff" },
    ],

    // Ab hier: Speicherung
    // Wichtig: Für eingefärbte Tage speichern wir den HEX-Farbcode (z.B. "#ffd0d0"), nicht mehr eine Marker-ID.
    STORAGE_MARKERS: "calendarMarkersV4",          // date -> "#rrggbb"
    STORAGE_MARKERS_LEGACY: "calendarMarkersV3",   // legacy: date -> "yellow"/...
    STORAGE_NOTES: "calendarNotesV2",
    STORAGE_CUSTOM_MARKERS: "calendarCustomMarkersV1", // Palette: [{id,color,label}]
  };
})();
