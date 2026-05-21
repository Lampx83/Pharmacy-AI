"use client";
import { useEffect, useMemo, useState } from "react";
import { ALL_DRUGS as DRUGS, PHARMACY_INFO, VAT_RATE, type DrugSpec } from "@/lib/catalog/gpp";

interface LineItem {
  id: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
}

export interface InvoicePayload {
  invoiceNo: string;
  issuedAt: number;
  customer: { name: string; phone: string };
  cashier: string;
  paymentMethod: "cash" | "card" | "transfer";
  items: Array<{
    id: string;
    brand: string;
    generic: string;
    strength: string;
    pack: string;
    isRx: boolean;
    qty: number;
    unitPrice: number;
    discountPct: number;
    lineTotal: number;
  }>;
  subTotal: number;
  vat: number;
  total: number;
  includesAbx: boolean;
  rxItemsWithoutPrescription: string[];
}

interface Props {
  open: boolean;
  pickedIds: string[];
  hasValidPrescription: boolean;
  onClose: () => void;
  onIssue: (invoice: InvoicePayload) => void;
}

function fmt(v: number) {
  return v.toLocaleString("vi-VN") + " ₫";
}

function genInvoiceNo(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `HD-${yyyy}${mm}${dd}-${rand}`;
}

export default function PosTerminal({
  open,
  pickedIds,
  hasValidPrescription,
  onClose,
  onIssue
}: Props) {
  const [lines, setLines] = useState<LineItem[]>([]);
  const [customer, setCustomer] = useState({ name: "Khách vãng lai", phone: "" });
  const [cashier, setCashier] = useState("DS. Sinh viên");
  const [payment, setPayment] = useState<"cash" | "card" | "transfer">("cash");
  const [issuedInvoice, setIssuedInvoice] = useState<InvoicePayload | null>(null);
  const [search, setSearch] = useState("");

  /* Đồng bộ giỏ hàng từ các hộp đã click trên kệ */
  useEffect(() => {
    if (!open) return;
    setLines((prev) => {
      const map = new Map(prev.map((l) => [l.id, l]));
      for (const id of pickedIds) {
        if (!map.has(id)) {
          const drug = DRUGS.find((d) => d.id === id);
          if (drug)
            map.set(id, { id, qty: 1, unitPrice: drug.unitPrice, discountPct: 0 });
        }
      }
      return Array.from(map.values());
    });
  }, [pickedIds, open]);

  const drugById = useMemo(() => {
    const m = new Map<string, DrugSpec>();
    DRUGS.forEach((d) => m.set(d.id, d));
    return m;
  }, []);

  const enriched = lines.map((l) => {
    const d = drugById.get(l.id)!;
    const lineTotal = Math.round(l.qty * l.unitPrice * (1 - l.discountPct / 100));
    return { ...l, drug: d, lineTotal };
  });

  const subTotal = enriched.reduce((s, l) => s + l.lineTotal, 0);
  const vat = Math.round(subTotal * VAT_RATE);
  const total = subTotal + vat;
  const rxWithoutScript = enriched
    .filter((l) => l.drug.isRx && !hasValidPrescription)
    .map((l) => l.drug.brand);
  const includesAbx = enriched.some((l) => l.drug.isAntibiotic);

  function addDrug(id: string) {
    setLines((prev) => {
      if (prev.find((l) => l.id === id)) return prev;
      const d = drugById.get(id);
      if (!d) return prev;
      return [...prev, { id, qty: 1, unitPrice: d.unitPrice, discountPct: 0 }];
    });
  }
  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }
  function updateLine(id: string, patch: Partial<LineItem>) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
    );
  }

  function issue() {
    if (enriched.length === 0) return;
    const invoice: InvoicePayload = {
      invoiceNo: genInvoiceNo(),
      issuedAt: Date.now(),
      customer,
      cashier,
      paymentMethod: payment,
      items: enriched.map((l) => ({
        id: l.id,
        brand: l.drug.brand,
        generic: l.drug.generic,
        strength: l.drug.strength,
        pack: l.drug.pack,
        isRx: l.drug.isRx,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        lineTotal: l.lineTotal
      })),
      subTotal,
      vat,
      total,
      includesAbx,
      rxItemsWithoutPrescription: rxWithoutScript
    };
    setIssuedInvoice(invoice);
    onIssue(invoice);
  }

  function newOrder() {
    setIssuedInvoice(null);
    setLines([]);
  }

  if (!open) return null;

  const filtered = DRUGS.filter((d) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      d.brand.toLowerCase().includes(q) ||
      d.generic.toLowerCase().includes(q) ||
      d.strength.toLowerCase().includes(q)
    );
  });

  return (
    <div style={overlayStyle}>
      <div style={posWindowStyle}>
        {/* Thanh tiêu đề kiểu cửa sổ phần mềm */}
        <div style={titleBarStyle}>
          <span>★ Pharma-POS v1.0 — Phần mềm bán hàng nhà thuốc GPP</span>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {issuedInvoice ? (
          <InvoiceView
            invoice={issuedInvoice}
            onNew={newOrder}
            onClose={onClose}
          />
        ) : (
          <div style={posBodyStyle}>
            {/* Cột trái: tra cứu danh mục */}
            <div style={leftColStyle}>
              <h3 style={h3}>F2 · Danh mục thuốc</h3>
              <input
                placeholder="Tìm theo tên thương mại / hoạt chất..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 6 }}
              />
              <div style={catalogScrollStyle}>
                {filtered.map((d) => {
                  const inCart = !!lines.find((l) => l.id === d.id);
                  return (
                    <div
                      key={d.id}
                      style={{
                        ...catalogRowStyle,
                        borderLeft: `4px solid ${d.groupAccent}`,
                        opacity: inCart ? 0.55 : 1
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>
                          {d.brand}{" "}
                          <span
                            style={{
                              fontSize: 10,
                              padding: "1px 5px",
                              borderRadius: 3,
                              background: d.isRx ? "#7f1d1d" : "#854d0e",
                              color: "white"
                            }}
                          >
                            {d.isRx ? "Rx" : "OTC"}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {d.generic} {d.strength} · {d.pack}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{fmt(d.unitPrice)}</div>
                        <button
                          disabled={inCart}
                          onClick={() => addDrug(d.id)}
                          style={{ marginTop: 2, padding: "2px 8px", fontSize: 11 }}
                        >
                          + Thêm
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cột phải: hoá đơn đang lập */}
            <div style={rightColStyle}>
              <h3 style={h3}>F1 · Giỏ hàng / Lập hoá đơn</h3>
              <div style={customerRowStyle}>
                <label>
                  Khách hàng
                  <input
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  />
                </label>
                <label>
                  SĐT
                  <input
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="(tuỳ chọn)"
                  />
                </label>
              </div>

              {/* Bảng giỏ hàng */}
              <div style={{ overflowY: "auto", maxHeight: "calc(100% - 250px)" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ background: "#1e293b" }}>
                      <th style={th}>#</th>
                      <th style={{ ...th, textAlign: "left" }}>Thuốc</th>
                      <th style={th}>SL</th>
                      <th style={th}>Đơn giá</th>
                      <th style={th}>CK %</th>
                      <th style={{ ...th, textAlign: "right" }}>Thành tiền</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {enriched.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>
                          Chọn thuốc trên kệ 3D hoặc thêm từ danh mục bên trái.
                        </td>
                      </tr>
                    )}
                    {enriched.map((l, idx) => (
                      <tr key={l.id}>
                        <td style={td}>{idx + 1}</td>
                        <td style={{ ...td, textAlign: "left" }}>
                          <div style={{ fontWeight: 600 }}>
                            {l.drug.brand}{" "}
                            {l.drug.isRx && (
                              <span style={{ color: "#f87171", fontSize: 11 }}>[Rx]</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            {l.drug.generic} {l.drug.strength} · {l.drug.pack}
                          </div>
                        </td>
                        <td style={td}>
                          <input
                            type="number"
                            min={1}
                            value={l.qty}
                            onChange={(e) =>
                              updateLine(l.id, {
                                qty: Math.max(1, parseInt(e.target.value || "1", 10))
                              })
                            }
                            style={inputCellStyle}
                          />
                        </td>
                        <td style={td}>
                          <input
                            type="number"
                            min={0}
                            value={l.unitPrice}
                            onChange={(e) =>
                              updateLine(l.id, {
                                unitPrice: Math.max(0, parseInt(e.target.value || "0", 10))
                              })
                            }
                            style={{ ...inputCellStyle, width: 90 }}
                          />
                        </td>
                        <td style={td}>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={l.discountPct}
                            onChange={(e) =>
                              updateLine(l.id, {
                                discountPct: Math.max(0, Math.min(50, parseInt(e.target.value || "0", 10)))
                              })
                            }
                            style={inputCellStyle}
                          />
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                          {fmt(l.lineTotal)}
                        </td>
                        <td style={td}>
                          <button
                            onClick={() => removeLine(l.id)}
                            style={{ padding: "2px 6px", fontSize: 11 }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cảnh báo Rx khi chưa có đơn */}
              {rxWithoutScript.length > 0 && (
                <div style={warningBoxStyle}>
                  ⚠ Trong giỏ có thuốc kê đơn nhưng chưa xác nhận có đơn thuốc hợp lệ:{" "}
                  <strong>{rxWithoutScript.join(", ")}</strong>. Bán không đơn vi phạm quy chế dược!
                </div>
              )}

              {/* Tổng + phương thức TT */}
              <div style={totalsBoxStyle}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <label style={{ flex: 1 }}>
                    Thu ngân
                    <input
                      value={cashier}
                      onChange={(e) => setCashier(e.target.value)}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    Phương thức TT
                    <select
                      value={payment}
                      onChange={(e) => setPayment(e.target.value as any)}
                      style={{
                        width: "100%",
                        padding: 8,
                        background: "#0b1220",
                        color: "white",
                        border: "1px solid #334155",
                        borderRadius: 6
                      }}
                    >
                      <option value="cash">Tiền mặt</option>
                      <option value="card">Thẻ ngân hàng</option>
                      <option value="transfer">Chuyển khoản</option>
                    </select>
                  </label>
                </div>

                <div style={totalsGridStyle}>
                  <span>Tạm tính</span>
                  <span style={{ textAlign: "right" }}>{fmt(subTotal)}</span>
                  <span>VAT ({Math.round(VAT_RATE * 100)}%)</span>
                  <span style={{ textAlign: "right" }}>{fmt(vat)}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#22c55e" }}>TỔNG CỘNG</span>
                  <span style={{ textAlign: "right", fontSize: 18, fontWeight: 700, color: "#22c55e" }}>
                    {fmt(total)}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={onClose} style={{ flex: 1 }}>Tạm đóng (F10)</button>
                  <button
                    onClick={issue}
                    disabled={enriched.length === 0}
                    style={{
                      flex: 2,
                      background: enriched.length === 0 ? "#334155" : "#16a34a",
                      borderColor: "#16a34a"
                    }}
                  >
                    💳 Thanh toán & xuất hoá đơn (F9)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========== Hoá đơn in =========== */
function InvoiceView({
  invoice,
  onNew,
  onClose
}: {
  invoice: InvoicePayload;
  onNew: () => void;
  onClose: () => void;
}) {
  function printInvoice() {
    const html = renderInvoiceHtml(invoice);
    const w = window.open("", "invoice", "width=520,height=720");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 200);
  }

  const d = new Date(invoice.issuedAt);
  const payLabel =
    invoice.paymentMethod === "cash"
      ? "Tiền mặt"
      : invoice.paymentMethod === "card"
      ? "Thẻ ngân hàng"
      : "Chuyển khoản";

  return (
    <div style={{ padding: 16, color: "#0f172a", background: "#f8fafc", overflowY: "auto" }}>
      <div
        style={{
          background: "white",
          maxWidth: 480,
          margin: "0 auto",
          padding: 18,
          borderRadius: 8,
          fontFamily: "ui-monospace, monospace"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{PHARMACY_INFO.name}</div>
          <div style={{ fontSize: 12 }}>{PHARMACY_INFO.address}</div>
          <div style={{ fontSize: 12 }}>
            ĐT: {PHARMACY_INFO.phone} · MST: {PHARMACY_INFO.taxCode} · {PHARMACY_INFO.gpp}
          </div>
        </div>
        <hr />
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 18, margin: "8px 0" }}>
          HOÁ ĐƠN BÁN LẺ
        </div>
        <div style={{ fontSize: 12, marginBottom: 4 }}>
          <div>Số: <strong>{invoice.invoiceNo}</strong></div>
          <div>
            Ngày: {d.toLocaleString("vi-VN")}
          </div>
          <div>Khách hàng: {invoice.customer.name || "Khách vãng lai"}{invoice.customer.phone ? ` · ${invoice.customer.phone}` : ""}</div>
          <div>Thu ngân: {invoice.cashier}</div>
        </div>
        <hr />
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Mặt hàng</th>
              <th>SL</th>
              <th style={{ textAlign: "right" }}>Đơn giá</th>
              <th style={{ textAlign: "right" }}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id}>
                <td>
                  <div>
                    <strong>{it.brand}</strong> {it.isRx ? " [Rx]" : ""}
                  </div>
                  <div style={{ color: "#64748b" }}>{it.generic} {it.strength}</div>
                </td>
                <td style={{ textAlign: "center" }}>{it.qty}</td>
                <td style={{ textAlign: "right" }}>{fmt(it.unitPrice)}</td>
                <td style={{ textAlign: "right" }}>{fmt(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 2, fontSize: 13 }}>
          <span>Tạm tính</span>
          <span style={{ textAlign: "right" }}>{fmt(invoice.subTotal)}</span>
          <span>VAT ({Math.round(VAT_RATE * 100)}%)</span>
          <span style={{ textAlign: "right" }}>{fmt(invoice.vat)}</span>
          <span style={{ fontWeight: 800, fontSize: 16 }}>TỔNG CỘNG</span>
          <span style={{ textAlign: "right", fontWeight: 800, fontSize: 16 }}>{fmt(invoice.total)}</span>
        </div>
        <hr />
        <div style={{ fontSize: 12 }}>
          Hình thức thanh toán: <strong>{payLabel}</strong>
        </div>
        {invoice.rxItemsWithoutPrescription.length > 0 && (
          <div style={{ marginTop: 8, padding: 8, background: "#fee2e2", color: "#7f1d1d", fontSize: 12, borderRadius: 4 }}>
            ⚠ CẢNH BÁO: Đã bán thuốc kê đơn không có đơn hợp lệ:{" "}
            <strong>{invoice.rxItemsWithoutPrescription.join(", ")}</strong>
          </div>
        )}
        <div style={{ textAlign: "center", marginTop: 14, fontStyle: "italic", fontSize: 12 }}>
          Cảm ơn quý khách. Đọc kỹ HDSD trước khi dùng.
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
        <button onClick={printInvoice}>🖨️ In hoá đơn</button>
        <button onClick={onNew}>🔄 Hoá đơn mới</button>
        <button onClick={onClose}>↩ Đóng phần mềm</button>
      </div>
    </div>
  );
}

function renderInvoiceHtml(inv: InvoicePayload): string {
  const d = new Date(inv.issuedAt);
  const payLabel =
    inv.paymentMethod === "cash" ? "Tien mat" : inv.paymentMethod === "card" ? "The ngan hang" : "Chuyen khoan";
  const rows = inv.items
    .map(
      (it) => `<tr>
        <td><strong>${it.brand}</strong> ${it.isRx ? "[Rx]" : ""}<br/><small>${it.generic} ${it.strength}</small></td>
        <td style="text-align:center">${it.qty}</td>
        <td style="text-align:right">${it.unitPrice.toLocaleString("vi-VN")} đ</td>
        <td style="text-align:right">${it.lineTotal.toLocaleString("vi-VN")} đ</td>
      </tr>`
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${inv.invoiceNo}</title>
  <style>
    body { font-family: ui-monospace, monospace; padding: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 4px 2px; border-bottom: 1px dashed #ccc; }
    .center { text-align: center; }
    .right { text-align: right; }
  </style></head><body>
  <div class="center"><strong>${PHARMACY_INFO.name}</strong><br/>
  ${PHARMACY_INFO.address}<br/>
  DT: ${PHARMACY_INFO.phone} · MST: ${PHARMACY_INFO.taxCode}</div>
  <h2 class="center">HOÁ ĐƠN BÁN LẺ</h2>
  <div>So: <strong>${inv.invoiceNo}</strong><br/>
  Ngay: ${d.toLocaleString("vi-VN")}<br/>
  Khach: ${inv.customer.name || "Khach vang lai"}${inv.customer.phone ? " · " + inv.customer.phone : ""}<br/>
  Thu ngan: ${inv.cashier}</div>
  <table><thead><tr><th align="left">Mat hang</th><th>SL</th><th class="right">Don gia</th><th class="right">Thanh tien</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <p>Tam tinh: <span style="float:right">${inv.subTotal.toLocaleString("vi-VN")} d</span></p>
  <p>VAT: <span style="float:right">${inv.vat.toLocaleString("vi-VN")} d</span></p>
  <h3>TONG: <span style="float:right">${inv.total.toLocaleString("vi-VN")} d</span></h3>
  <p>Thanh toan: ${payLabel}</p>
  <p class="center"><i>Cam on quy khach. Doc ky HDSD truoc khi dung.</i></p>
  </body></html>`;
}

/* ===== Styles ===== */
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100
};
const posWindowStyle: React.CSSProperties = {
  width: "min(1200px, 96vw)",
  height: "min(780px, 92vh)",
  background: "#0b1220",
  border: "1px solid #1f2937",
  borderRadius: 10,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
};
const titleBarStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, #0d9488 0%, #0f766e 100%)",
  color: "white",
  padding: "8px 12px",
  fontWeight: 700,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};
const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.3)",
  padding: "2px 8px",
  cursor: "pointer"
};
const posBodyStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  flex: 1,
  overflow: "hidden"
};
const leftColStyle: React.CSSProperties = {
  borderRight: "1px solid #1f2937",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  overflow: "hidden"
};
const rightColStyle: React.CSSProperties = {
  padding: 12,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};
const h3: React.CSSProperties = { margin: "0 0 6px", color: "#94a3b8", fontSize: 13 };
const catalogScrollStyle: React.CSSProperties = {
  overflowY: "auto",
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 4
};
const catalogRowStyle: React.CSSProperties = {
  background: "#111827",
  padding: "6px 8px",
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12
};
const customerRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: 8,
  fontSize: 12,
  marginBottom: 8
};
const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13
};
const th: React.CSSProperties = {
  padding: 6,
  textAlign: "center",
  fontSize: 12,
  color: "#94a3b8"
};
const td: React.CSSProperties = {
  padding: 6,
  borderBottom: "1px solid #1f2937",
  textAlign: "center",
  verticalAlign: "middle"
};
const inputCellStyle: React.CSSProperties = {
  width: 60,
  padding: 4,
  textAlign: "center",
  fontSize: 13
};
const warningBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 8,
  background: "#7f1d1d",
  color: "#fecaca",
  borderRadius: 6,
  fontSize: 12
};
const totalsBoxStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  background: "#0f172a",
  border: "1px solid #1f2937",
  borderRadius: 8
};
const totalsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  rowGap: 4,
  columnGap: 12,
  alignItems: "center"
};
