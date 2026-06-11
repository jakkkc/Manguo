import { db, ownerCol, getOwnerId } from "./firebase.js";
import {
  addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let sizes     = [];
let colours   = [];
let editingId = null;

// ── POPULATE SUPPLIER SELECT IN PRODUCT FORM ─────────────────────
window.populateProductSupplierSelect = () => {
  const suppliers = window.getSuppliers?.() || [];
  const sel       = document.getElementById("p-supplier");
  if (!sel) return;
  sel.innerHTML = `<option value="">— no supplier assigned —</option>` +
    suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
};

// ── RENDER TABLE ──────────────────────────────────────────────────
window.renderProductsTable = () => {
  const products  = window.getProducts?.()  || [];
  const suppliers = window.getSuppliers?.() || [];
  const tbody     = document.getElementById("products-table");
  if (!tbody) return;
  const role = window.activeStaff?.role || "cashier";

  if (!products.length) {
    tbody.innerHTML = `
      <tr><td colspan="10">
        <div class="empty"><i class="ph ph-t-shirt"></i><div class="empty-text">No products yet</div></div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const margin    = p.cost && p.price ? Math.round(((p.price-p.cost)/p.price)*100) : null;
    const discPrice = p.discount ? Math.round(p.price*(1-p.discount/100)) : null;
    const supplier  = suppliers.find(s => s.id === p.supplierId);
    const actions   = role === "cashier"
      ? `<span style="color:var(--muted);font-size:12px">View only</span>`
      : `<div class="flex gap-2">
           <button class="btn btn-outline btn-sm" onclick="editProduct('${p.id}')">
             <i class="ph ph-pencil"></i>
           </button>
           ${role === "owner"
             ? `<button class="btn-del" onclick="deleteProduct('${p.id}')"><i class="ph ph-trash"></i></button>`
             : ""}
         </div>`;
    return `
      <tr>
        <td>
          <div style="font-weight:500">${p.name}</div>
          ${p.discount ? `<div class="text-muted">Sale: KES ${discPrice?.toLocaleString()} <span style="color:var(--danger)">-${p.discount}%</span></div>` : ""}
        </td>
        <td><span style="color:var(--muted)">${p.category||"—"}</span></td>
        <td>${supplier ? `<span style="color:var(--accent2);font-size:12px">${supplier.name}</span>` : `<span style="color:var(--muted);font-size:12px">—</span>`}</td>
        <td>${p.cost ? `KES ${p.cost.toLocaleString()}` : `<span style="color:var(--muted)">—</span>`}</td>
        <td>KES ${p.price.toLocaleString()}</td>
        <td>${margin !== null ? `<span class="badge badge-ok">${margin}%</span>` : `<span style="color:var(--muted)">—</span>`}</td>
        <td>${p.stock<=5 ? `<span class="badge badge-low"><i class="ph ph-warning"></i>${p.stock}</span>` : `<span class="badge badge-ok">${p.stock}</span>`}</td>
        <td><span style="color:var(--muted);font-size:12px">${(p.sizes||[]).join(", ")||"—"}</span></td>
        <td><span style="color:var(--muted);font-size:12px">${(p.colours||[]).join(", ")||"—"}</span></td>
        <td>${actions}</td>
      </tr>`;
  }).join("");
};

// ── VARIANTS ──────────────────────────────────────────────────────
window.addVariant = (type) => {
  const inp = document.getElementById(type === "size" ? "size-input" : "colour-input");
  const val = inp.value.trim();
  if (!val) return;
  if (type === "size"   && !sizes.includes(val))   sizes.push(val);
  if (type === "colour" && !colours.includes(val)) colours.push(val);
  inp.value = "";
  renderVariantChips();
};

window.removeVariant = (type, val) => {
  if (type === "size")   sizes   = sizes.filter(s => s !== val);
  if (type === "colour") colours = colours.filter(c => c !== val);
  renderVariantChips();
};

function renderVariantChips() {
  document.getElementById("sizes-list").innerHTML = sizes.map(s => `
    <span class="variant-chip"><i class="ph ph-ruler"></i>${s}
      <button onclick="removeVariant('size','${s}')">×</button>
    </span>`).join("");
  document.getElementById("colours-list").innerHTML = colours.map(c => `
    <span class="variant-chip"><i class="ph ph-palette"></i>${c}
      <button onclick="removeVariant('colour','${c}')">×</button>
    </span>`).join("");
}

// ── SAVE PRODUCT ──────────────────────────────────────────────────
window.saveProduct = async () => {
  const name       = document.getElementById("p-name").value.trim();
  const category   = document.getElementById("p-category").value.trim();
  const supplierId = document.getElementById("p-supplier").value;
  const cost       = parseFloat(document.getElementById("p-cost").value)     || 0;
  const price      = parseFloat(document.getElementById("p-price").value);
  const stock      = parseInt(document.getElementById("p-stock").value);
  const discount   = parseFloat(document.getElementById("p-discount").value) || 0;

  if (!name || isNaN(price) || isNaN(stock)) {
    window.showToast("Please fill in name, price and stock.", "error"); return;
  }

  const suppliers    = window.getSuppliers?.() || [];
  const supplier     = suppliers.find(s => s.id === supplierId);
  const supplierName = supplier?.name || "";

  const data = {
    name, category, supplierId, supplierName,
    cost, price, stock, discount,
    sizes: [...sizes], colours: [...colours],
    updatedAt: serverTimestamp()
  };

  if (editingId) {
    await updateDoc(doc(db, "users", getOwnerId(), "products", editingId), data);
    window.showToast("Product updated ✓", "success");
    cancelEdit();
  } else {
    await addDoc(ownerCol("products"), { ...data, createdAt: serverTimestamp() });
    window.showToast("Product added ✓", "success");
  }
  clearProductForm();
};

// ── EDIT ──────────────────────────────────────────────────────────
window.editProduct = (id) => {
  const p = (window.getProducts?.() || []).find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById("p-name").value     = p.name;
  document.getElementById("p-category").value = p.category   || "";
  document.getElementById("p-supplier").value = p.supplierId || "";
  document.getElementById("p-cost").value     = p.cost       || "";
  document.getElementById("p-price").value    = p.price;
  document.getElementById("p-stock").value    = p.stock;
  document.getElementById("p-discount").value = p.discount   || "";
  sizes   = [...(p.sizes   || [])];
  colours = [...(p.colours || [])];
  renderVariantChips();
  document.getElementById("product-form-title").textContent = "Edit Product";
  document.getElementById("cancel-edit-btn").style.display  = "inline-flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.cancelEdit = () => {
  editingId = null;
  document.getElementById("product-form-title").textContent = "Add Product";
  document.getElementById("cancel-edit-btn").style.display  = "none";
  clearProductForm();
};

// ── DELETE ────────────────────────────────────────────────────────
window.deleteProduct = async (id) => {
  if (!confirm("Delete this product?")) return;
  await deleteDoc(doc(db, "users", getOwnerId(), "products", id));
  window.showToast("Product deleted.", "error");
};

// ── CLEAR FORM ────────────────────────────────────────────────────
function clearProductForm() {
  ["p-name","p-category","p-cost","p-price","p-stock","p-discount"]
    .forEach(id => document.getElementById(id).value = "");
  document.getElementById("p-supplier").value = "";
  sizes = []; colours = [];
  renderVariantChips();
}