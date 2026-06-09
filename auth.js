import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initTheme, applyTheme } from "./themes.js";
import { initApp } from "./dashboard.js";
import { loadStaffForPin } from "./staff.js";

const provider = new GoogleAuthProvider();

// ── CURRENT SESSION ───────────────────────────────────────────────
// Who is the Firebase owner (logged in via email/Google)
let ownerUser = null;

// Who is the active staff member (selected via PIN)
window.activeStaff = null;

// ── SCREENS ───────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(name + "-screen").classList.add("active");
}

// ── AUTH STATE ────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (user) {
    ownerUser = user;
    // Ensure owner exists in Firestore users collection
    await ensureOwnerDoc(user);
    // Load theme
    initTheme();
    // Go to PIN screen
    await loadStaffForPin();
    showScreen("pin");
  } else {
    ownerUser = null;
    window.activeStaff = null;
    showScreen("auth");
  }
});

// ── ENSURE OWNER DOC ──────────────────────────────────────────────
async function ensureOwnerDoc(user) {
  const ref  = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      name:      user.displayName || user.email.split("@")[0],
      email:     user.email,
      role:      "owner",
      pin:       null,
      createdAt: serverTimestamp()
    });
  }
}

// ── AUTH TAB ──────────────────────────────────────────────────────
let currentTab = "login";

window.switchAuthTab = (tab) => {
  currentTab = tab;
  document.getElementById("tab-login").classList.toggle("active",  tab === "login");
  document.getElementById("tab-signup").classList.toggle("active", tab === "signup");
  document.getElementById("auth-btn-text").textContent =
    tab === "login" ? "Sign In" : "Create Account";
  document.getElementById("auth-error").textContent = "";
};

// ── EMAIL AUTH ────────────────────────────────────────────────────
window.handleEmailAuth = async () => {
  const email = document.getElementById("auth-email").value.trim();
  const pass  = document.getElementById("auth-password").value;
  const errEl = document.getElementById("auth-error");
  errEl.textContent = "";

  if (!email || !pass) {
    errEl.textContent = "Please enter email and password."; return;
  }

  try {
    if (currentTab === "login") {
      await signInWithEmailAndPassword(auth, email, pass);
    } else {
      await createUserWithEmailAndPassword(auth, email, pass);
    }
  } catch(e) {
    const msgs = {
      "auth/user-not-found":      "No account with this email.",
      "auth/wrong-password":      "Wrong password.",
      "auth/email-already-in-use":"Email already registered. Sign in instead.",
      "auth/weak-password":       "Password needs at least 6 characters.",
      "auth/invalid-credential":  "Incorrect email or password.",
      "auth/invalid-email":       "Invalid email address.",
    };
    errEl.textContent = msgs[e.code] || "Something went wrong.";
  }
};

// ── GOOGLE AUTH ───────────────────────────────────────────────────
window.handleGoogleAuth = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch(e) {
    document.getElementById("auth-error").textContent = "Google sign-in failed. Try again.";
  }
};

// ── SIGN OUT ──────────────────────────────────────────────────────
window.signOutOwner = async () => {
  window.activeStaff = null;
  await signOut(auth);
};

// ── SWITCH STAFF (go back to PIN screen) ─────────────────────────
window.switchStaff = async () => {
  window.activeStaff = null;
  await loadStaffForPin();
  showScreen("pin");
};

// ── ENTER APP (called after PIN verified) ────────────────────────
window.enterApp = (staffMember) => {
  window.activeStaff = staffMember;

  // Update topbar chip
  document.getElementById("user-chip").textContent =
    staffMember.name + " · " + staffMember.role;

  // Apply role-based nav visibility
  applyRoleNav(staffMember.role);

  // Show app
  showScreen("app");

  // Init app data
  initApp();
};

// ── ROLE NAV ──────────────────────────────────────────────────────
function applyRoleNav(role) {
  const rules = {
    owner:   ["dashboard","products","sale","history","credits","supply","staff"],
    manager: ["dashboard","products","sale","history","credits","supply"],
    cashier: ["sale","history"],
  };

  const allowed = rules[role] || rules.cashier;
  const allNav  = ["dashboard","products","sale","history","credits","supply","staff"];

  allNav.forEach(page => {
    const btn = document.getElementById("nav-" + page);
    if (!btn) return;
    if (allowed.includes(page)) {
      btn.classList.remove("hidden");
    } else {
      btn.classList.add("hidden");
    }
  });

  // Default page for role
  const defaultPage = allowed[0];
  const defaultBtn  = document.getElementById("nav-" + defaultPage);
  if (defaultBtn) showPage(defaultPage, defaultBtn);
}

// ── SHOW PAGE ─────────────────────────────────────────────────────
window.showPage = (page, btn) => {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  if (btn) btn.classList.add("active");
  if (page === "sale") window.populateSaleSelect?.();
  if (page === "supply") window.initSupply?.();
};

// ── ENTER KEY ON PASSWORD ─────────────────────────────────────────
document.getElementById("auth-password")
  .addEventListener("keydown", e => {
    if (e.key === "Enter") window.handleEmailAuth();
  });

// ── EXPOSE applyTheme GLOBALLY ────────────────────────────────────
window.applyTheme = applyTheme;