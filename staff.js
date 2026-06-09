import { db } from "./firebase.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const staffRef = collection(db, "staff");

let staffList    = [];
let selectedStaff = null;
let pinEntry      = "";
let editingStaffId = null;

// ── LOAD STAFF FOR PIN SCREEN ─────────────────────────────────────
export async function loadStaffForPin() {
  return new Promise(resolve => {
    onSnapshot(query(staffRef, orderBy("createdAt", "asc")), snap => {
      staffList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderStaffPinList();
      renderStaffManageList();
      resolve();
    });
  });
}

// ── RENDER PIN SCREEN STAFF LIST ──────────────────────────────────
function renderStaffPinList() {
  const el = document.getElementById("staff-list");
  if (!el) return;

  // Always include the owner as first option
  const ownerBtn = `
    <button class="staff-btn" data-id="__owner__" onclick="selectStaff(this, '__owner__')">
      <div class="staff-avatar"><i class="ph ph-crown"></i></div>
      <div class="staff-info">
        <div class="staff-name">Owner</div>
        <div class="staff-role">Full access</div>
      </div>
    </button>`;

  const staffBtns = staffList.map(s => `
    <button class="staff-btn" data-id="${s.id}" onclick="selectStaff(this, '${s.id}')">
      <div class="staff-avatar"><i class="ph ph-user"></i></div>
      <div class="staff-info">
        <div class="staff-name">${s.name}</div>
        <div class="staff-role">${s.role}</div>
      </div>
    </button>`).join("");

  el.innerHTML = ownerBtn + staffBtns;
}

// ── SELECT STAFF ──────────────────────────────────────────────────
window.selectStaff = (btn, id) => {
  document.querySelectorAll(".staff-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  selectedStaff = id;
  pinEntry = "";
  updatePinDots();
  document.getElementById("pin-error").textContent = "";
};

// ── PIN KEYPAD ────────────────────────────────────────────────────
window.pinKey = (digit) => {
  if (!selectedStaff) {
    document.getElementById("pin-error").textContent = "Please select a name first.";
    return;
  }
  if (pinEntry.length >= 4) return;
  pinEntry += digit;
  updatePinDots();
  if (pinEntry.length === 4) verifyPin();
};

window.pinBackspace = () => {
  pinEntry = pinEntry.slice(0, -1);
  updatePinDots();
};

window.pinClear = () => {
  pinEntry = "";
  updatePinDots();
};

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById("dot-" + i);
    if (dot) dot.classList.toggle("filled", i < pinEntry.length);
  }
}

// ── VERIFY PIN ────────────────────────────────────────────────────
async function verifyPin() {
  const errEl = document.getElementById("pin-error");
  errEl.textContent = "";

  // Owner — no PIN needed, just select and enter 0000
  if (selectedStaff === "__owner__") {
    if (pinEntry === "0000") {
      window.enterApp({
        id:   "__owner__",
        name: "Owner",
        role: "owner",
        pin:  "0000"
      });
      return;
    } else {
      errEl.textContent = "Incorrect PIN.";
      pinEntry = "";
      updatePinDots();
      return;
    }
  }

  // Staff member
  const member = staffList.find(s => s.id === selectedStaff);
  if (!member) return;

  if (pinEntry === member.pin) {
    window.enterApp({
      id:   member.id,
      name: member.name,
      role: member.role,
      pin:  member.pin
    });
  } else {
    errEl.textContent = "Incorrect PIN. Try again.";
    pinEntry = "";
    updatePinDots();
  }
}

// ── RENDER STAFF MANAGE LIST (owner only) ────────────────────────
function renderStaffManageList() {
  const el = document.getElementById("staff-list-manage");
  if (!el) return;

  if (!staffList.length) {
    el.innerHTML = `
      <div class="empty">
        <i class="ph ph-users"></i>
        <div class="empty-text">No staff added yet</div>
        <div class="empty-sub">Add your first team member above</div>
      </div>`;
    return;
  }

  el.innerHTML = staffList.map(s => `
    <div class="staff-card">
      <div class="staff-card-left">
        <div class="staff-card-avatar"><i class="ph ph-user"></i></div>
        <div>
          <div class="staff-card-name">${s.name}</div>
          <div class="staff-card-role">${s.role}</div>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" onclick="editStaff('${s.id}')">
          <i class="ph ph-pencil"></i>
        </button>
        <button class="btn-del" onclick="deleteStaff('${s.id}')">
          <i class="ph ph-trash"></i>
        </button>
      </div>
    </div>`).join("");
}

// ── SAVE STAFF ────────────────────────────────────────────────────
window.saveStaff = async () => {
  const name = document.getElementById("staff-name").value.trim();
  const role = document.getElementById("staff-role").value;
  const pin  = document.getElementById("staff-pin").value.trim();

  if (!name)           { showToast("Please enter a name.", "error");          return; }
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    showToast("PIN must be exactly 4 digits.", "error"); return;
  }

  const data = { name, role, pin, updatedAt: serverTimestamp() };

  if (editingStaffId) {
    await updateDoc(doc(db, "staff", editingStaffId), data);
    showToast("Staff member updated ✓", "success");
    cancelStaffEdit();
  } else {
    await addDoc(staffRef, { ...data, createdAt: serverTimestamp() });
    showToast("Staff member added ✓", "success");
  }

  clearStaffForm();
};

// ── EDIT STAFF ────────────────────────────────────────────────────
window.editStaff = (id) => {
  const s = staffList.find(x => x.id === id);
  if (!s) return;
  editingStaffId = id;
  document.getElementById("staff-name").value  = s.name;
  document.getElementById("staff-role").value  = s.role;
  document.getElementById("staff-pin").value   = s.pin;
  document.getElementById("staff-form-title").textContent = "Edit Staff Member";
  document.getElementById("cancel-staff-btn").style.display = "inline-flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ── CANCEL EDIT ───────────────────────────────────────────────────
window.cancelStaffEdit = () => {
  editingStaffId = null;
  document.getElementById("staff-form-title").textContent = "Add Staff Member";
  document.getElementById("cancel-staff-btn").style.display = "none";
  clearStaffForm();
};

// ── DELETE STAFF ──────────────────────────────────────────────────
window.deleteStaff = async (id) => {
  if (!confirm("Remove this staff member?")) return;
  await deleteDoc(doc(db, "staff", id));
  showToast("Staff member removed.", "error");
};

// ── CLEAR FORM ────────────────────────────────────────────────────
function clearStaffForm() {
  ["staff-name", "staff-pin"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("staff-role").value = "manager";
}

// ── TOAST (shared utility) ────────────────────────────────────────
let toastTimer;
function showToast(msg, type = "success") {
  const el   = document.getElementById("toast");
  const icon = document.getElementById("toast-icon");
  document.getElementById("toast-msg").textContent = msg;
  icon.className = type === "success"
    ? "ph ph-check-circle"
    : "ph ph-warning-circle";
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = "", 3200);
}

// Expose toast globally so all modules can use it
window.showToast = showToast;