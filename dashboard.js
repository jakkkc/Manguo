import { db } from "./firebase.js";
import {
  collection, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const productsRef = collection(db, "products");
const salesRef    = collection(db, "sales");
const creditsRef  = collection(db, "credits");

let allProducts = [];
let allSales    = [];
let allCredits  = [];
let unsubs      = [];

// Chart instances — kept so we can destroy and rebuild on filter change
let chartRevenue  = null;
let chartProducts = null;
let chartPayments = null;

// ── INIT ──────────────────────────────────────────────────────────
export function initApp() {
  // Clean up previous listeners
  unsubs.forEach(u => u());
  unsubs = [];

  // Set default date filter — last 30 days
  const today = new Date();
  const from  = new Date();
  from.setDate(today.getDate() - 30);
  document.getElementById("filter-from").value = formatDate(from);
  document.getElementById("filter-to").value   = formatDate(today);

  // Start listeners
  unsubs.push(onSnapshot(query(productsRef, orderBy("createdAt","desc")), snap => {
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refreshDashboard();
    window.renderProductsTable?.();
  }));

  unsubs.push(onSnapshot(query(salesRef, orderBy("createdAt","desc")), snap => {
    allSales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refreshDashboard();
    window.renderHistory?.();
  }));

  unsubs.push(onSnapshot(query(creditsRef, orderBy("createdAt","desc")), snap => {
    allCredits = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refreshDashboard();
    window.renderCredits?.();
  }));

  // Expose data globally for other modules
  window.getProducts = () => allProducts;
  window.getSales    = () => allSales;
  window.getCredits  = () => allCredits;
}

// ── DATE FILTER ───────────────────────────────────────────────────
window.applyDateFilter = () => refreshDashboard();

window.resetDateFilter = () => {
  const today = new Date();
  const from  = new Date();
  from.setDate(today.getDate() - 30);
  document.getElementById("filter-from").value = formatDate(from);
  document.getElementById("filter-to").value   = formatDate(today);
  refreshDashboard();
};

function getFilteredSales() {
  const fromVal = document.getElementById("filter-from")?.value;
  const toVal   = document.getElementById("filter-to")?.value;
  if (!fromVal || !toVal) return allSales;

  const from = new Date(fromVal);
  const to   = new Date(toVal);
  to.setHours(23, 59, 59, 999);

  return allSales.filter(s => {
    const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date();
    return d >= from && d <= to;
  });
}

// ── REFRESH ───────────────────────────────────────────────────────
function refreshDashboard() {
  const filtered = getFilteredSales();
  renderStats(filtered);
  renderCharts(filtered);
  renderLowStock();
  renderRecentSales(filtered);
}

// ── STATS ─────────────────────────────────────────────────────────
function renderStats(filtered) {
  const revenue     = filtered.reduce((a, s) => a + (s.total || 0), 0);
  const openCredit  = allCredits
    .filter(c => !c.paid)
    .reduce((a, c) => a + (c.total || 0), 0);
  const margins     = allProducts
    .filter(p => p.cost && p.price)
    .map(p => ((p.price - p.cost) / p.price) * 100);
  const avgMargin   = margins.length
    ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length)
    : 0;
  const lowCount    = allProducts.filter(p => p.stock <= 5).length;

  document.getElementById("stat-count").textContent    = filtered.length;
  document.getElementById("stat-rev").textContent      = revenue.toLocaleString();
  document.getElementById("stat-credit").textContent   = openCredit.toLocaleString();
  document.getElementById("stat-margin").textContent   = avgMargin;
  document.getElementById("stat-products").textContent = allProducts.length;
  document.getElementById("stat-lowstock").textContent = lowCount;
}

// ── CHARTS ────────────────────────────────────────────────────────
function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    accent:  style.getPropertyValue("--accent").trim()  || "#c9973a",
    accent2: style.getPropertyValue("--accent2").trim() || "#e4bf7a",
    muted:   style.getPropertyValue("--muted").trim()   || "rgba(245,230,200,0.45)",
    text:    style.getPropertyValue("--text").trim()    || "#f5e6c8",
    bg2:     style.getPropertyValue("--bg2").trim()     || "#2c1f0e",
  };
}

function chartDefaults() {
  const c = getChartColors();
  return {
    color: c.text,
    plugins: {
      legend: {
        labels: { color: c.text, font: { family: "Jost", size: 12 } }
      }
    },
    scales: {
      x: {
        ticks: { color: c.muted, font: { family: "Jost", size: 11 } },
        grid:  { color: "rgba(255,255,255,0.05)" }
      },
      y: {
        ticks: { color: c.muted, font: { family: "Jost", size: 11 } },
        grid:  { color: "rgba(255,255,255,0.05)" }
      }
    }
  };
}

function renderCharts(filtered) {
  renderRevenueChart(filtered);
  renderProductsChart(filtered);
  renderPaymentsChart(filtered);
}

// Revenue line chart — daily totals
function renderRevenueChart(filtered) {
  const canvas = document.getElementById("chart-revenue");
  if (!canvas) return;
  const c = getChartColors();

  // Group by date
  const byDate = {};
  filtered.forEach(s => {
    const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date();
    const key = d.toLocaleDateString("en-KE", { day:"2-digit", month:"short" });
    byDate[key] = (byDate[key] || 0) + (s.total || 0);
  });

  const labels = Object.keys(byDate);
  const data   = Object.values(byDate);

  if (chartRevenue) chartRevenue.destroy();
  chartRevenue = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Revenue (KES)",
        data,
        borderColor:     c.accent,
        backgroundColor: c.accent + "22",
        borderWidth:     2,
        pointBackgroundColor: c.accent2,
        pointRadius:     4,
        tension:         0.4,
        fill:            true,
      }]
    },
    options: {
      ...chartDefaults(),
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        ...chartDefaults().plugins,
        legend: { display: false }
      }
    }
  });
}

// Top products bar chart
function renderProductsChart(filtered) {
  const canvas = document.getElementById("chart-products");
  if (!canvas) return;
  const c = getChartColors();

  // Count units sold per product
  const counts = {};
  filtered.forEach(s => {
    (s.items || []).forEach(item => {
      counts[item.name] = (counts[item.name] || 0) + (item.qty || 1);
    });
  });

  // Sort and take top 5
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const labels = sorted.map(x => x[0]);
  const data   = sorted.map(x => x[1]);

  if (chartProducts) chartProducts.destroy();
  chartProducts = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Units sold",
        data,
        backgroundColor: [
          c.accent  + "cc",
          c.accent2 + "cc",
          c.accent  + "99",
          c.accent2 + "99",
          c.accent  + "66",
        ],
        borderRadius: 6,
        borderWidth:  0,
      }]
    },
    options: {
      ...chartDefaults(),
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        ...chartDefaults().plugins,
        legend: { display: false }
      },
      scales: {
        x: { ticks: { color: getChartColors().muted, font: { family:"Jost", size:11 } }, grid: { display: false } },
        y: { ticks: { color: getChartColors().muted, font: { family:"Jost", size:11 } }, grid: { color:"rgba(255,255,255,0.05)" } }
      }
    }
  });
}

// Payment method pie chart
function renderPaymentsChart(filtered) {
  const canvas = document.getElementById("chart-payments");
  if (!canvas) return;
  const c = getChartColors();

  const counts = { cash: 0, mpesa: 0, credit: 0 };
  filtered.forEach(s => {
    if (counts[s.payment] !== undefined) counts[s.payment]++;
  });

  if (chartPayments) chartPayments.destroy();
  chartPayments = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Cash", "M-Pesa", "Credit"],
      datasets: [{
        data: [counts.cash, counts.mpesa, counts.credit],
        backgroundColor: [
          c.accent  + "dd",
          c.accent2 + "dd",
          c.muted,
        ],
        borderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color:   c.text,
            font:    { family: "Jost", size: 12 },
            padding: 16,
          }
        }
      }
    }
  });
}

// ── LOW STOCK ─────────────────────────────────────────────────────
function renderLowStock() {
  const el  = document.getElementById("low-stock-list");
  if (!el) return;
  const low = allProducts.filter(p => p.stock <= 5);

  if (!low.length) {
    el.innerHTML = `
      <div class="empty">
        <i class="ph ph-check-circle"></i>
        <div class="empty-text">All stocked up</div>
      </div>`;
    return;
  }

  el.innerHTML = low.map(p => `
    <div class="po-item">
      <div>
        <div class="po-name">${p.name}</div>
        <div class="po-meta">${p.category || "—"}</div>
      </div>
      <span class="badge badge-low">
        <i class="ph ph-warning"></i> ${p.stock} left
      </span>
    </div>`).join("");
}

// ── RECENT SALES ──────────────────────────────────────────────────
function renderRecentSales(filtered) {
  const el = document.getElementById("recent-sales-list");
  if (!el) return;

  if (!filtered.length) {
    el.innerHTML = `
      <div class="empty">
        <i class="ph ph-shopping-bag"></i>
        <div class="empty-text">No sales in this period</div>
      </div>`;
    return;
  }

  el.innerHTML = filtered.slice(0, 5).map(s => {
    const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date();
    return `
      <div class="po-item">
        <div>
          <div class="po-name">${s.items?.map(i => i.name).join(", ") || "Sale"}</div>
          <div class="po-meta">
            ${d.toLocaleDateString()} 
            ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
            ${s.staffName ? " · " + s.staffName : ""}
          </div>
        </div>
        <div class="flex gap-2" style="align-items:center">
          <span class="badge badge-${s.payment}">${s.payment}</span>
          <span style="font-weight:500">KES ${(s.total||0).toLocaleString()}</span>
        </div>
      </div>`;
  }).join("");
}

// ── HELPERS ───────────────────────────────────────────────────────
function formatDate(date) {
  return date.toISOString().split("T")[0];
}