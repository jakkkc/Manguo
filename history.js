// ── RENDER HISTORY ────────────────────────────────────────────────
window.renderHistory = () => {
  const sales  = window.getSales?.() || [];
  const role   = window.activeStaff?.role  || "cashier";
  const staffId= window.activeStaff?.id    || "";
  const tbody  = document.getElementById("history-table");
  if (!tbody) return;

  // Cashier sees only their own sales
  const filtered = role === "cashier"
    ? sales.filter(s => s.staffId === staffId)
    : sales;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty">
          <i class="ph ph-receipt"></i>
          <div class="empty-text">No sales yet</div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const d = s.createdAt?.toDate
      ? s.createdAt.toDate()
      : new Date();

    const items = s.items
      ?.map(i =>
        `${i.name}${i.size ? ` (${i.size})` : ""}${i.colour ? ` / ${i.colour}` : ""} ×${i.qty}`
      ).join(", ") || "—";

    return `
      <tr>
        <td style="white-space:nowrap">
          ${d.toLocaleDateString()}
          <span style="color:var(--muted)">
            ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
          </span>
        </td>
        <td>
          <span style="color:var(--muted);font-size:12px">
            ${s.staffName || "—"}
          </span>
        </td>
        <td style="color:var(--muted);font-size:12px;max-width:220px">
          ${items}
        </td>
        <td style="font-weight:500">
          KES ${(s.total || 0).toLocaleString()}
        </td>
        <td>
          <span class="badge badge-${s.payment}">${s.payment}</span>
          ${s.customerName
            ? `<div style="font-size:11px;color:var(--muted);margin-top:3px">
                <i class="ph ph-user" style="font-size:11px"></i>
                ${s.customerName}
               </div>`
            : ""}
        </td>
      </tr>`;
  }).join("");
};