(() => {
  "use strict";

  // Firestore-Persistenz für Farben + Notizen
  // Struktur (wie gewünscht):
  //   /zeit-raster/{uid}/years/{YYYY}
  // pro Jahr ein Dokument, das Farben UND Notizen enthält.

  window.KalenderApp = window.KalenderApp || {};

  const ROOT = "zeit-raster";
  const YEARS = "years";

  const isHexColor = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim());
  const normHex = (v) => (isHexColor(v) ? v.trim().toLowerCase() : null);
  const isDateKey = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);

  const getCtx = () => {
    const ctx = window.KalenderApp.AUTH_CTX;
    if (!ctx || !ctx.db || !ctx.uid) return null;
    return ctx;
  };

  const yearFromKey = (dateKey) => {
    if (!isDateKey(dateKey)) return null;
    return dateKey.slice(0, 4);
  };

  const filterMapsForYear = (yearStr, colors, notes) => {
    const prefix = `${yearStr}-`;

    const outColors = {};
    for (const [k, v] of Object.entries(colors || {})) {
      if (!isDateKey(k) || !k.startsWith(prefix)) continue;
      const c = normHex(v);
      if (!c) continue;
      outColors[k] = c;
    }

    const outNotes = {};
    for (const [k, v] of Object.entries(notes || {})) {
      if (!isDateKey(k) || !k.startsWith(prefix)) continue;
      if (typeof v !== "string") continue;
      if (v.trim().length === 0) continue;
      outNotes[k] = v;
    }

    return { colors: outColors, notes: outNotes };
  };

  const Cloud = {};

  Cloud.isReady = () => {
    const ctx = getCtx();
    return !!ctx;
  };

  Cloud.yearFromKey = yearFromKey;

  Cloud.loadAll = async () => {
    const ctx = getCtx();
    if (!ctx) return { colors: {}, notes: {} };

    const snap = await ctx.db
      .collection(ROOT)
      .doc(ctx.uid)
      .collection(YEARS)
      .get();

    const colors = {};
    const notes = {};

    snap.forEach((doc) => {
      const data = doc.data() || {};
      const cMap = data.colors && typeof data.colors === "object" ? data.colors : {};
      const nMap = data.notes && typeof data.notes === "object" ? data.notes : {};

      for (const [k, v] of Object.entries(cMap)) {
        if (!isDateKey(k)) continue;
        const c = normHex(v);
        if (!c) continue;
        colors[k] = c;
      }

      for (const [k, v] of Object.entries(nMap)) {
        if (!isDateKey(k)) continue;
        if (typeof v !== "string") continue;
        if (v.trim().length === 0) continue;
        notes[k] = v;
      }
    });

    return { colors, notes };
  };

  Cloud.saveYear = async (yearStr, colors, notes) => {
    const ctx = getCtx();
    if (!ctx) return;
    if (!/^\d{4}$/.test(String(yearStr))) return;

    const year = String(yearStr);
    const filtered = filterMapsForYear(year, colors, notes);

    const hasAny =
      Object.keys(filtered.colors).length > 0 || Object.keys(filtered.notes).length > 0;

    const ref = ctx.db.collection(ROOT).doc(ctx.uid).collection(YEARS).doc(year);

    if (!hasAny) {
      await ref.delete().catch(() => {});
      return;
    }

    await ref.set(
      {
        year: Number(year),
        colors: filtered.colors,
        notes: filtered.notes,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: false }
    );
  };

  Cloud.replaceAll = async (colors, notes) => {
    const ctx = getCtx();
    if (!ctx) return;

    // bestehende year-docs löschen
    const existing = await ctx.db
      .collection(ROOT)
      .doc(ctx.uid)
      .collection(YEARS)
      .get();

    const yearSet = new Set();

    for (const k of Object.keys(colors || {})) {
      const y = yearFromKey(k);
      if (y) yearSet.add(y);
    }
    for (const k of Object.keys(notes || {})) {
      const y = yearFromKey(k);
      if (y) yearSet.add(y);
    }

    const years = Array.from(yearSet).sort();

    // Batched commits (max 500 ops)
    const runBatches = async (ops) => {
      let batch = ctx.db.batch();
      let n = 0;

      const commitIfNeeded = async () => {
        if (n === 0) return;
        await batch.commit();
        batch = ctx.db.batch();
        n = 0;
      };

      for (const op of ops) {
        if (n >= 450) await commitIfNeeded();
        op(batch);
        n += 1;
      }
      await commitIfNeeded();
    };

    const deleteOps = [];
    existing.forEach((doc) => {
      deleteOps.push((b) => b.delete(doc.ref));
    });
    await runBatches(deleteOps);

    const writeOps = [];
    for (const y of years) {
      const filtered = filterMapsForYear(y, colors, notes);
      const hasAny =
        Object.keys(filtered.colors).length > 0 || Object.keys(filtered.notes).length > 0;
      if (!hasAny) continue;
      const ref = ctx.db.collection(ROOT).doc(ctx.uid).collection(YEARS).doc(String(y));
      writeOps.push((b) =>
        b.set(
          ref,
          {
            year: Number(y),
            colors: filtered.colors,
            notes: filtered.notes,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: false }
        )
      );
    }
    await runBatches(writeOps);
  };

  window.KalenderApp.CLOUD = Cloud;
})();
