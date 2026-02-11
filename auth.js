(() => {
  "use strict";

  // Firebase-Konfiguration (Web-App)
  const firebaseConfig = {
    apiKey: "AIzaSyDVzf54RilCJO3JD4a5Lm7KsJ7Xo1XQJME",
    authDomain: "my-hobby-apps.firebaseapp.com",
    projectId: "my-hobby-apps",
    storageBucket: "my-hobby-apps.firebasestorage.app",
    messagingSenderId: "894079667150",
    appId: "1:894079667150:web:ea31691290941a3a7ef99f"
  };

  const setHidden = (el, hidden) => {
    if (!el) return;
    const h = !!hidden;
    el.hidden = h;
    el.setAttribute("aria-hidden", String(h));
    // Robust: manche Umgebungen verlassen sich nicht zuverlässig auf das hidden-Default-CSS
    el.style.display = h ? "none" : "";
  };

  const initAuth = () => {
    if (!window.firebase || typeof firebase.initializeApp !== "function") return null;

    try {
      // Mehrfaches Initialisieren vermeiden (z.B. bei Hot-Reload)
      if (!firebase.apps || firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
    } catch {
      // ignore (already initialized)
    }

    if (!firebase.auth || typeof firebase.auth !== "function") return null;
    return firebase.auth();
  };

  const initFirestore = () => {
    if (!window.firebase || !firebase.firestore || typeof firebase.firestore !== "function") return null;
    try {
      return firebase.firestore();
    } catch {
      return null;
    }
  };

  const boot = () => {
    const loginView = document.getElementById("loginView");
    const appRoot = document.getElementById("appRoot");

    const form = document.getElementById("loginForm");
    const emailEl = document.getElementById("loginEmail");
    const passEl = document.getElementById("loginPassword");
    const errEl = document.getElementById("loginError");
    const loginBtn = document.getElementById("loginBtn");

    const logoutBtn = document.getElementById("logoutBtn");

    const showError = (msg) => {
      if (!errEl) return;
      if (!msg) {
        errEl.textContent = "";
        errEl.hidden = true;
        return;
      }
      errEl.textContent = msg;
      errEl.hidden = false;
    };

    const setBusy = (busy) => {
      const b = !!busy;
      if (emailEl) emailEl.disabled = b;
      if (passEl) passEl.disabled = b;
      if (loginBtn) loginBtn.disabled = b;
    };

    // Initial: alles ausblenden, bis Auth-Status bekannt ist
    setHidden(loginView, true);
    setHidden(appRoot, true);
    if (logoutBtn) logoutBtn.hidden = true;

    const auth = initAuth();
    const db = initFirestore();
    if (!auth) {
      setHidden(loginView, false);
      setHidden(appRoot, true);
      if (logoutBtn) logoutBtn.hidden = true;
      showError("Firebase SDK konnte nicht geladen werden. Bitte Internetverbindung prüfen.");
      return;
    }

    if (!db) {
      // Ohne Firestore ist die App nicht sinnvoll nutzbar (Persistenz für Farben/Notizen)
      setHidden(loginView, false);
      setHidden(appRoot, true);
      if (logoutBtn) logoutBtn.hidden = true;
      showError("Firestore SDK konnte nicht geladen werden. Bitte Internetverbindung prüfen.");
      return;
    }

    auth.onAuthStateChanged((user) => {
      if (user) {
        // Auth-Kontext für die restliche App bereitstellen
        window.KalenderApp = window.KalenderApp || {};
        window.KalenderApp.AUTH_CTX = { auth, db, uid: user.uid, user };

        setHidden(loginView, true);
        setHidden(appRoot, false);
        if (logoutBtn) logoutBtn.hidden = false;

        // App (einmalig) starten
        const K = window.KalenderApp || {};
        if (typeof K.startApp === "function") K.startApp();

        showError(null);
        setBusy(false);
      } else {
        // Auth-Kontext entfernen
        window.KalenderApp = window.KalenderApp || {};
        window.KalenderApp.AUTH_CTX = null;

        setHidden(appRoot, true);
        setHidden(loginView, false);
        if (logoutBtn) logoutBtn.hidden = true;
        setBusy(false);
        showError(null);
        if (emailEl) emailEl.focus();
      }
    });

    if (form) {
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        showError(null);

        if (form && typeof form.checkValidity === "function" && !form.checkValidity()) {
          try { form.reportValidity(); } catch {}
          return;
        }

        const email = String(emailEl?.value || "").trim();
        const password = String(passEl?.value || "");

        setBusy(true);

        try {
          await auth.signInWithEmailAndPassword(email, password);
          // onAuthStateChanged übernimmt die UI
        } catch (e) {
          showError("Login fehlgeschlagen.");
          setBusy(false);
          try { passEl && passEl.focus(); } catch {}
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await auth.signOut();
        } finally {
          // Vollständiger Reset (State/Event-Listener) – danach wieder Login-Maske
          window.location.reload();
        }
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
