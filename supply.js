import { db, ownerCol, getOwnerId } from "./firebase.js";
import {
  addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let suppliers = [];
let orders    = [];
let unsubs    = [];

// ── INIT ──────────────────────────────────────────────────────────
window.initSupply = () => {
  unsubs.forEach(u => u());
  unsubs = [];

  unsubs.push(onSnapshot(query(ownerCol("suppliers"), orderBy("createdAt","desc")), snap => {
    suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSuppliersList();
    populateSupplierSelect();
    window.populateProductSupplierSelect?.();
  }));

  unsubs.push(onSnapshot(query(ownerCol("purchaseOrders"), orderBy("createdAt","desc")), snap => {
    orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOrdersTable();
    renderPendingOrders();
  }));
};

window.getSuppliers = () => suppliers;

// ── SUPPLY TABS ───────────────────────────────────────────────────
window.showSupplyTab = (tab, btn) => {
  document.querySelectorAll(".supply-tab").forEach(t => t.classList.add("hidden"));
  document.querySelectorAll("#page-supply .nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("supply-" + tab).classList.remove("hidden");
  btn.classList.add("active");
  if (tab === "orders")  populateSupplierSelect();
  if (tab === "receive") renderPendingOrders();
};

// ── SAVE SUPPLIER ─────────────────────────────────────────────────
window.saveSupplier = async () => {
  const name    = document.getElementById("sup-name").value.trim();
  const contact = document.getElementById("sup-contact").value.trim();
  const phone   = document.getElementById("sup-phone").value.trim();
  const email   = document.getElementById("sup-email").value.trim();
  if (!name) { window.showToast("Please enter a supplier name.", "error"); return; }
  await addDoc(ownerCol("suppliers"), { name, contact, phone, email, createdAt: serverTimestamp() });
  window.showToast("Supplier saved ✓", "success");
  clearSupplierForm();
};

function clearSupplierForm() {
  ["sup-name","sup-contact","sup-phone","sup-email"].forEach(id => document.getElementById(id).value = "");
}

function renderSuppliersList() {
  const el = document.getElementById("suppliers-list");
  if (!el) return;
  if (!suppliers.length) {
    el.innerHTML = `<div class="empty"><i class="ph ph-address-book"></i><div class="empty-text">No suppliers yet</div><div class="empty-sub">Add your first supplier above</div></div>`;
    return;
  }
  el.innerHTML = suppliers.map(s => `
    <div class="po-item">
      <div style="flex:1">
        <div class="po-name">${s.name}</div>
        <div class="po-meta">${s.contact ? s.contact+" · " : ""}${s.phone ? s.phone+" · " : ""}${s.email||""}</div>
      </div>
      <button class="btn-del" onclick="deleteSupplier('${s.id}')"><i class="ph ph-trash"></i></button>
    </div>`).join("");
}

window.deleteSupplier = async (id) => {
  if (!confirm("Remove this supplier?")) return;
  await deleteDoc(doc(db, "users", getOwnerId(), "suppliers", id));
  window.showToast("Supplier removed.", "error");
};

function populateSupplierSelect() {
  const sel = document.getElementById("po-supplier");
  if (!sel) return;
  sel.innerHTML = `<option value="">— select supplier —</option>` +
    suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
}

// ── ON SUPPLIER SELECT — filter products ──────────────────────────
window.onSupplierSelect = () => {
  const supplierId = document.getElementById("po-supplier").value;
  const products   = window.getProducts?.() || [];
  const sel        = document.getElementById("po-product");
  if (!sel) return;
  if (!supplierId) {
    sel.innerHTML = `<option value="">— select supplier first —</option>`; return;
  }
  const matched = products.filter(p => p.supplierId === supplierId);
  if (!matched.length) {
    sel.innerHTML = `<option value="">— no products linked to this supplier —</option>`; return;
  }
  sel.innerHTML = `<option value="">— select product —</option>` +
    matched.map(p => `<option value="${p.id}">${p.name} (stock: ${p.stock})</option>`).join("");
};

// ── SAVE PURCHASE ORDER ───────────────────────────────────────────
window.savePurchaseOrder = async () => {
  const supplierId = document.getElementById("po-supplier").value;
  const productId  = document.getElementById("po-product").value;
  const qty        = parseInt(document.getElementById("po-qty").value);
  const cost       = parseFloat(document.getElementById("po-cost").value) || 0;
  const notes      = document.getElementById("po-notes").value.trim();
  if (!supplierId)     { window.showToast("Please select a supplier.", "error");          return; }
  if (!productId)      { window.showToast("Please select a product.", "error");           return; }
  if (!qty || qty < 1) { window.showToast("Please enter a valid quantity.", "error");     return; }

  const supplier = suppliers.find(s => s.id === supplierId);
  const products = window.getProducts?.() || [];
  const product  = products.find(p => p.id === productId);

  await addDoc(ownerCol("purchaseOrders"), {
    supplierId, supplierName: supplier?.name || "",
    productId,  productName:  product?.name  || "",
    qty, cost, notes, status: "pending", createdAt: serverTimestamp()
  });
  window.showToast("Purchase order created ✓", "success");
  clearOrderForm();
};

function clearOrderForm() {
  ["po-qty","po-cost","po-notes"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("po-supplier").value = "";
  document.getElementById("po-product").innerHTML = `<option value="">— select supplier first —</option>`;
}

function renderOrdersTable() {
  const tbody = document.getElementById("po-table");
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><i class="ph ph-file-text"></i><div class="empty-text">No purchase orders yet</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => {
    const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
    const statusBadge = o.status === "received"
      ? `<span class="badge badge-ok"><i class="ph ph-check"></i> Received</span>`
      : `<span class="badge badge-low"><i class="ph ph-clock"></i> Pending</span>`;
    const action = o.status === "pending"
      ? `<button class="btn btn-gold btn-sm" onclick="receiveOrder('${o.id}')"><i class="ph ph-package"></i> Receive</button>`
      : `<span style="color:var(--muted);font-size:12px">Done</span>`;
    return `
      <tr>
        <td style="white-space:nowrap;color:var(--muted);font-size:12px">${d.toLocaleDateString()}</td>
        <td>${o.supplierName||"—"}</td>
        <td>${o.productName||"—"}</td>
        <td>${o.qty}</td>
        <td>${o.cost ? `KES ${o.cost.toLocaleString()}` : `<span style="color:var(--muted)">—</span>`}</td>
        <td>${statusBadge}</td>
        <td>${action}</td>
      </tr>`;
  }).join("");
}

function renderPendingOrders() {
  const el      = document.getElementById("pending-orders-list");
  if (!el) return;
  const pending = orders.filter(o => o.status === "pending");
  if (!pending.length) {
    el.innerHTML = `<div class="empty"><i class="ph ph-package"></i><div class="empty-text">No pending orders</div><div class="empty-sub">All orders have been received</div></div>`;
    return;
  }
  el.innerHTML = pending.map(o => `
    <div class="po-item">
      <div style="flex:1">
        <div class="po-name">${o.productName}</div>
        <div class="po-meta">From: ${o.supplierName||"—"} · Qty: ${o.qty} units${o.cost ? ` · KES ${o.cost.toLocaleString()} per unit` : ""}</div>
        ${o.notes ? `<div class="po-meta" style="margin-top:3px">Note: ${o.notes}</div>` : ""}
      </div>
      <button class="btn btn-gold btn-sm" onclick="receiveOrder('${o.id}')">
        <i class="ph ph-package"></i> Mark Received
      </button>
    </div>`).join("");
}

// ── RECEIVE ORDER ─────────────────────────────────────────────────
window.receiveOrder = async (id) => {
  const order   = orders.find(o => o.id === id);
  if (!order) return;
  const products = window.getProducts?.() || [];
  const product  = products.find(p => p.id === order.productId);
  if (!product) { window.showToast("Product not found. Stock not updated.", "error"); return; }
  await updateDoc(doc(db, "users", getOwnerId(), "purchaseOrders", id), {
    status: "received", receivedAt: serverTimestamp()
  });
  await updateDoc(doc(db, "users", getOwnerId(), "products", order.productId), {
    stock: product.stock + order.qty
  });
  window.showToast(`${order.qty} units of ${product.name} added to stock ✓`, "success");
};