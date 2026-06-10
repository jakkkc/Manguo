import { db } from "./firebase.js";
import {
  doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── RENDER CREDITS ────────────────────────────────────────────────
window.renderCredits = () => {
  const credits = window.getCredits?.() || [];
  const el      = document.getElementById("credits-list");
  if (!el) return;

  const open = credits.filter(c => !c.paid);

  if (!open.length) {
    el.innerHTML = `
      <div class="empty">
        <i class="ph ph-check-circle"></i>
        <div class="empty-text">No outstanding credit</div>
        <div class="empty-sub">All balances are cleared</div>
      </div>`;
    return;
  }

  el.innerHTML = open.map(c => {
    const d = c.createdAt?.toDate
      ? c.createdAt.toDate()
      : new Date();

    const items = c.items
      ?.map(i => `${i.name} ×${i.qty}`)
      .join(", ") || "—";

    return `
      <div class="po-item">
        <div style="flex:1">
          <div class="po-name">
            <i class="ph ph-user" style="font-size:13px;margin-right:4px"></i>
            ${c.customerName || "Unknown"}
          </div>
          <div class="po-meta">
            ${c.customerPhone ? c.customerPhone + " · " : ""}
            ${d.toLocaleDateString()}
            ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
          </div>
          <div class="po-meta" style="margin-top:3px">${items}</div>
        </div>
        <div class="flex gap-2" style="align-items:center;flex-shrink:0">
          <div style="text-align:right">
            <div style="font-family:var(--font-d);font-size:20px;font-weight:300;color:var(--accent2)">
              KES ${(c.total || 0).toLocaleString()}
            </div>
            <div style="font-size:11px;color:var(--muted)">
              via ${c.staffName || "—"}
            </div>
          </div>
          <button class="btn btn-gold btn-sm" onclick="markPaid('${c.id}')">
            <i class="ph ph-check"></i> Paid
          </button>
        </div>
      </div>`;
  }).join("");
};

// ── MARK AS PAID ──────────────────────────────────────────────────
window.markPaid = async (id) => {
  await updateDoc(doc(db, "credits", id), { paid: true });
  window.showToast("Marked as paid ✓", "success");
};