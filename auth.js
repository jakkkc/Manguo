import { auth, db, setOwnerId, getOwnerId, ownerCol } from "./firebase.js";
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
let ownerUser  = null;
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
    setOwnerId(user.uid);          // scope all data to this owner
    window.getOwnerId = getOwnerId;
    await ensureOwnerDoc(user);
    initTheme();
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
      createdAt: serverTimestamp()
    });
  }
}

// ── AUTH TABS ─────────────────────────────────────────────────────
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
  if (!email || !pass) { errEl.textContent = "Please enter email and password."; return; }
  try {
    if (currentTab === "login") await signInWithEmailAndPassword(auth, email, pass);
    else await createUserWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    const msgs = {
      "auth/user-not-found":       "No account with this email.",
      "auth/wrong-password":       "Wrong password.",
      "auth/email-already-in-use": "Email already registered. Sign in instead.",
      "auth/weak-password":        "Password needs at least 6 characters.",
      "auth/invalid-credential":   "Incorrect email or password.",
      "auth/invalid-email":        "Invalid email address.",
    };
    errEl.textContent = msgs[e.code] || "Something went wrong.";
  }
};

// ── GOOGLE AUTH ───────────────────────────────────────────────────
window.handleGoogleAuth = async () => {
  try { await signInWithPopup(auth, provider); }
  catch(e) { document.getElementById("auth-error").textContent = "Google sign-in failed. Try again."; }
};

// ── SIGN OUT ──────────────────────────────────────────────────────
window.signOutOwner = async () => {
  window.activeStaff = null;
  await signOut(auth);
};

// ── SWITCH STAFF ──────────────────────────────────────────────────
window.switchStaff = async () => {
  window.activeStaff = null;
  await loadStaffForPin();
  showScreen("pin");
};

// ── ENTER APP ─────────────────────────────────────────────────────
window.enterApp = (staffMember) => {
  window.activeStaff = staffMember;
  document.getElementById("user-chip").textContent =
    staffMember.name + " · " + staffMember.role;
  applyRoleNav(staffMember.role);
  showScreen("app");
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
  const all     = ["dashboard","products","sale","history","credits","supply","staff"];
  all.forEach(page => {
    const btn = document.getElementById("nav-" + page);
    if (!btn) return;
    btn.classList.toggle("hidden", !allowed.includes(page));
  });
  const defaultBtn = document.getElementById("nav-" + allowed[0]);
  if (defaultBtn) showPage(allowed[0], defaultBtn);
}

// ── SHOW PAGE ─────────────────────────────────────────────────────
window.showPage = (page, btn) => {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  if (btn) btn.classList.add("active");
  if (page === "sale")   window.populateSaleSelect?.();
  if (page === "supply") window.initSupply?.();
};

// ── EXPOSE applyTheme GLOBALLY ────────────────────────────────────
window.applyTheme = applyTheme;

// ── ENTER KEY ─────────────────────────────────────────────────────
document.getElementById("auth-password")
  .addEventListener("keydown", e => {
    if (e.key === "Enter") window.handleEmailAuth();
  });