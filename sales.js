import { db, ownerCol, getOwnerId } from "./firebase.js";
import {
  addDoc, updateDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let cart = [];

// ── POPULATE PRODUCT SELECT ───────────────────────────────────────
window.populateSaleSelect = () => {
  const products = window.getProducts?.() || [];
  const sel      = document.getElementById("sale-product-select");
  if (!sel) return;
  sel.innerHTML = `<option value="">— select product —</option>` +
    products.map(p => {
      const dp = p.discount ? Math.round(p.price*(1-p.discount/100)) : p.price;
      return `<option value="${p.id}">${p.name} — KES ${dp.toLocaleString()} (${p.stock} left)</option>`;
    }).join("");
};

// ── ON PRODUCT SELECT ─────────────────────────────────────────────
window.onProductSelect = () => {
  const products = window.getProducts?.() || [];
  const id       = document.getElementById("sale-product-select").value;
  const p        = products.find(x => x.id === id);
  document.getElementById("sale-size").innerHTML   = `<option value="">— any —</option>` + (p?.sizes||[]).map(s=>`<option>${s}</option>`).join("");
  document.getElementById("sale-colour").innerHTML = `<option value="">— any —</option>` + (p?.colours||[]).map(c=>`<option>${c}</option>`).join("");
};

// ── ADD TO CART ───────────────────────────────────────────────────
window.addToCart = () => {
  const products = window.getProducts?.() || [];
  const id       = document.getElementById("sale-product-select").value;
  const qty      = parseInt(document.getElementById("sale-qty").value) || 1;
  const size     = document.getElementById("sale-size").value;
  const colour   = document.getElementById("sale-colour").value;

  if (!id) { window.showToast("Please select a product.", "error"); return; }
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (qty > p.stock) { window.showToast(`Only ${p.stock} in stock.`, "error"); return; }

  const finalPrice = p.discount ? Math.round(p.price*(1-p.discount/100)) : p.price;
  const key        = id + (size||"") + (colour||"");
  const ex         = cart.find(i => i.key === key);

  if (ex) {
    if (ex.qty+qty > p.stock) { window.showToast(`Only ${p.stock} available total.`,"error"); return; }
    ex.qty += qty;
  } else {
    cart.push({ key, id, name:p.name, price:finalPrice, originalPrice:p.price,
      discount:p.discount||0, qty, size, colour, stock:p.stock });
  }
  renderCart();
  document.getElementById("sale-qty").value = 1;
};

// ── RENDER CART ───────────────────────────────────────────────────
function renderCart() {
  const el = document.getElementById("cart-items");
  const tb = document.getElementById("total-bar");
  if (!el) return;

  if (!cart.length) {
    el.innerHTML = `<div class="empty"><i class="ph ph-shopping-cart"></i><div class="empty-text">Cart is empty</div><div class="empty-sub">Add products above</div></div>`;
    if (tb) tb.style.display = "none";
    return;
  }

  el.innerHTML = cart.map((item,i) => `
    <div class="cart-item">
      <div class="cart-item-left">
        <div class="cart-item-icon"><i class="ph ph-t-shirt"></i></div>
        <div>
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-meta">
            ${item.size   ? `Size: ${item.size}`   : ""}
            ${item.colour ? ` · ${item.colour}`    : ""}
            ${item.discount ? ` · <span style="color:var(--danger)">-${item.discount}%</span>` : ""}
            · KES ${item.price.toLocaleString()} each
          </div>
        </div>
      </div>
      <div class="cart-item-right">
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty(${i},-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${i},+1)">+</button>
        </div>
        <div class="cart-item-total">KES ${(item.price*item.qty).toLocaleString()}</div>
        <button class="btn-del" onclick="removeFromCart(${i})"><i class="ph ph-x"></i></button>
      </div>
    </div>`).join("");

  const total = cart.reduce((a,i) => a+i.price*i.qty, 0);
  document.getElementById("cart-total").textContent = total.toLocaleString();
  if (tb) tb.style.display = "block";
}

// ── QTY CONTROLS ─────────────────────────────────────────────────
window.changeQty = (idx, delta) => {
  const item = cart[idx]; const nq = item.qty+delta;
  if (nq < 1) { removeFromCart(idx); return; }
  if (nq > item.stock) { window.showToast(`Only ${item.stock} in stock.`,"error"); return; }
  item.qty = nq; renderCart();
};
window.removeFromCart = (idx) => { cart.splice(idx,1); renderCart(); };
window.clearCart      = ()    => { cart = []; renderCart(); };

// ── COMPLETE SALE ─────────────────────────────────────────────────
window.completeSale = async () => {
  if (!cart.length) { window.showToast("Cart is empty.","error"); return; }
  const payment = document.getElementById("payment-method").value;
  if (payment === "credit") {
    document.getElementById("credit-modal").classList.add("show"); return;
  }
  await recordSale(payment, null, null);
};

window.closeCreditModal = () => {
  document.getElementById("credit-modal").classList.remove("show");
  document.getElementById("credit-name").value  = "";
  document.getElementById("credit-phone").value = "";
};

window.confirmCreditSale = async () => {
  const name  = document.getElementById("credit-name").value.trim();
  const phone = document.getElementById("credit-phone").value.trim();
  if (!name) { window.showToast("Please enter the customer name.","error"); return; }
  window.closeCreditModal();
  await recordSale("credit", name, phone);
};

// ── RECORD SALE ───────────────────────────────────────────────────
async function recordSale(payment, customerName, customerPhone) {
  const products = window.getProducts?.() || [];
  const total    = cart.reduce((a,i) => a+i.price*i.qty, 0);
  const staff    = window.activeStaff;

  const saleData = {
    items: cart.map(i => ({ id:i.id, name:i.name, price:i.price, qty:i.qty, size:i.size||"", colour:i.colour||"" })),
    total, payment,
    staffId:   staff?.id   || "",
    staffName: staff?.name || "Owner",
    createdAt: serverTimestamp()
  };

  if (payment === "credit") {
    saleData.customerName  = customerName;
    saleData.customerPhone = customerPhone;
    await addDoc(ownerCol("credits"), { ...saleData, paid: false });
  }

  await addDoc(ownerCol("sales"), saleData);

  for (const item of cart) {
    const p = products.find(x => x.id === item.id);
    if (p) {
      await updateDoc(doc(db, "users", getOwnerId(), "products", item.id), {
        stock: p.stock - item.qty
      });
    }
  }

  window.showToast(`Sale of KES ${total.toLocaleString()} recorded ✓`, "success");
  cart = []; renderCart();
}