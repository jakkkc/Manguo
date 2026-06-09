import { db } from "./firebase.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let sizes      = [];
let colours    = [];
let editingId  = null;

// ── RENDER TABLE ──────────────────────────────────────────────────
window.renderProductsTable = () => {
  const products = window.getProducts?.() || [];
  const tbody    = document.getElementById("products-table");
  if (!tbody) return;

  // Check role — cashier sees view-only, no edit/delete
  const role = window.activeStaff?.role || "cashier";

  if (!products.length) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty">
          <i class="ph ph-t-shirt"></i>
          <div class="empty-text">No products yet</div>
          <div class="empty-sub">Add your first product above</div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const margin   = p.cost && p.price
      ? Math.round(((p.price - p.cost) / p.price) * 100)
      : null;
    const discPrice = p.discount
      ? Math.round(p.price * (1 - p.discount / 100))
      : null;

    const actions = role === "cashier"
      ? `<span style="color:var(--muted);font-size:12px">View only</span>`
      : `<div class="flex gap-2">
           <button class="btn btn-outline btn-sm" onclick="editProduct('${p.id}')">
             <i class="ph ph-pencil"></i>
           </button>
           ${role === "owner"
             ? `<button class="btn-del" onclick="deleteProduct('${p.id}')">
                  <i class="ph ph-trash"></i>
                </button>`
             : ""}
         </div>`;

    return `
      <tr>
        <td>
          <div style="font-weight:500">${p.name}</div>
          ${p.discount
            ? `<div class="text-muted">
                Sale: KES ${discPrice?.toLocaleString()}
                <span style="color:var(--danger)"> -${p.discount}%</span>
               </div>`
            : ""}
        </td>
        <td><span style="color:var(--muted)">${p.category || "—"}</span></td>
        <td>${p.cost
          ? `KES ${p.cost.toLocaleString()}`
          : `<span style="color:var(--muted)">—</span>`}
        </td>
        <td>KES ${p.price.toLocaleString()}</td>
        <td>${margin !== null
          ? `<span class="badge badge-ok">${margin}%</span>`
          : `<span style="color:var(--muted)">—</span>`}
        </td>
        <td>${p.stock <= 5
          ? `<span class="badge badge-low">
               <i class="ph ph-warning"></i>${p.stock}
             </span>`
          : `<span class="badge badge-ok">${p.stock}</span>`}
        </td>
        <td>
          <span style="color:var(--muted);font-size:12px">
            ${(p.sizes || []).join(", ") || "—"}
          </span>
        </td>
        <td>
          <span style="color:var(--muted);font-size:12px">
            ${(p.colours || []).join(", ") || "—"}
          </span>
        </td>
        <td>${actions}</td>
      </tr>`;
  }).join("");
};

// ── VARIANTS ──────────────────────────────────────────────────────
window.addVariant = (type) => {
  const inputId = type === "size" ? "size-input" : "colour-input";
  const inp     = document.getElementById(inputId);
  const val     = inp.value.trim();
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
    <span class="variant-chip">
      <i class="ph ph-ruler"></i>${s}
      <button onclick="removeVariant('size','${s}')">×</button>
    </span>`).join("");

  document.getElementById("colours-list").innerHTML = colours.map(c => `
    <span class="variant-chip">
      <i class="ph ph-palette"></i>${c}
      <button onclick="removeVariant('colour','${c}')">×</button>
    </span>`).join("");
}

// ── SAVE PRODUCT ──────────────────────────────────────────────────
window.saveProduct = async () => {
  const name     = document.getElementById("p-name").value.trim();
  const category = document.getElementById("p-category").value.trim();
  const cost     = parseFloat(document.getElementById("p-cost").value)     || 0;
  const price    = parseFloat(document.getElementById("p-price").value);
  const stock    = parseInt(document.getElementById("p-stock").value);
  const discount = parseFloat(document.getElementById("p-discount").value) || 0;

  if (!name || isNaN(price) || isNaN(stock)) {
    window.showToast("Please fill in name, price and stock.", "error");
    return;
  }

  const data = {
    name, category, cost, price, stock, discount,
    sizes:   [...sizes],
    colours: [...colours],
    updatedAt: serverTimestamp()
  };

  if (editingId) {
    await updateDoc(doc(db, "products", editingId), data);
    window.showToast("Product updated ✓", "success");
    cancelEdit();
  } else {
    await addDoc(collection(db, "products"), {
      ...data,
      createdAt: serverTimestamp()
    });
    window.showToast("Product added ✓", "success");
  }

  clearProductForm();
};

// ── EDIT PRODUCT ──────────────────────────────────────────────────
window.editProduct = (id) => {
  const products = window.getProducts?.() || [];
  const p = products.find(x => x.id === id);
  if (!p) return;

  editingId = id;
  document.getElementById("p-name").value     = p.name;
  document.getElementById("p-category").value = p.category || "";
  document.getElementById("p-cost").value     = p.cost     || "";
  document.getElementById("p-price").value    = p.price;
  document.getElementById("p-stock").value    = p.stock;
  document.getElementById("p-discount").value = p.discount || "";

  sizes   = [...(p.sizes   || [])];
  colours = [...(p.colours || [])];
  renderVariantChips();

  document.getElementById("product-form-title").textContent     = "Edit Product";
  document.getElementById("cancel-edit-btn").style.display = "inline-flex";

  // Scroll to form
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ── CANCEL EDIT ───────────────────────────────────────────────────
window.cancelEdit = () => {
  editingId = null;
  document.getElementById("product-form-title").textContent     = "Add Product";
  document.getElementById("cancel-edit-btn").style.display = "none";
  clearProductForm();
};

// ── DELETE PRODUCT ────────────────────────────────────────────────
window.deleteProduct = async (id) => {
  if (!confirm("Delete this product?")) return;
  await deleteDoc(doc(db, "products", id));
  window.showToast("Product deleted.", "error");
};

// ── CLEAR FORM ────────────────────────────────────────────────────
function clearProductForm() {
  ["p-name","p-category","p-cost","p-price","p-stock","p-discount"]
    .forEach(id => document.getElementById(id).value = "");
  sizes   = [];
  colours = [];
  renderVariantChips();
}