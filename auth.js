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
    el.hidden = !!hidden;
    el.setAttribute("aria-hidden", String(!!hidden));
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
    if (!auth) {
      setHidden(loginView, false);
      setHidden(appRoot, true);
      if (logoutBtn) logoutBtn.hidden = true;
      showError("Firebase SDK konnte nicht geladen werden. Bitte Internetverbindung prüfen.");
      return;
    }

    auth.onAuthStateChanged((user) => {
      if (user) {
        setHidden(loginView, true);
        setHidden(appRoot, false);
        if (logoutBtn) logoutBtn.hidden = false;

        // App (einmalig) starten
        const K = window.KalenderApp || {};
        if (typeof K.startApp === "function") K.startApp();

        showError(null);
        setBusy(false);
      } else {
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

        const email = String(emailEl?.value || "").trim();
        const password = String(passEl?.value || "");

        if (!email || !password) {
          showError("Bitte E-Mail und Passwort eingeben.");
          return;
        }

        setBusy(true);

        try {
          await auth.signInWithEmailAndPassword(email, password);
          // onAuthStateChanged übernimmt die UI
        } catch (e) {
          const code = e && e.code ? String(e.code) : "";
          let msg = "Login fehlgeschlagen.";

          if (code.includes("auth/invalid-email")) msg = "E-Mail-Adresse ungültig.";
          else if (code.includes("auth/user-not-found") || code.includes("auth/wrong-password")) msg = "E-Mail oder Passwort falsch.";
          else if (code.includes("auth/too-many-requests")) msg = "Zu viele Versuche. Bitte später erneut versuchen.";
          else if (code.includes("auth/network-request-failed")) msg = "Netzwerkfehler. Bitte Verbindung prüfen.";

          showError(msg);
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
