"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type {
  ChatMessage,
  ModuleId,
  SessionScore,
  SessionState,
  UiAction
} from "@/lib/segue/types";
import type { ScenarioSpec } from "@/lib/segue/scenarios";
import ScorePanel from "./ScorePanel";
import PosTerminal, { type InvoicePayload } from "./pos/PosTerminal";
import LabelEditor from "./pos/LabelEditor";
import type { HdsdLabel } from "@/lib/labels/hdsd";
import { DRUGS } from "@/lib/catalog/gpp";

const GppScene = dynamic(() => import("./scenes/GppScene"), { ssr: false });
const HospitalScene = dynamic(() => import("./scenes/HospitalScene"), { ssr: false });
const MedRepScene = dynamic(() => import("./scenes/MedRepScene"), { ssr: false });

export default function SimulationClient({ moduleId }: { moduleId: ModuleId }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [scenario, setScenario] = useState<ScenarioSpec | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [score, setScore] = useState<SessionScore | null>(null);
  const chatBottom = useRef<HTMLDivElement>(null);

  // GPP scene state
  const [picked, setPicked] = useState<string[]>([]);
  const [posOpen, setPosOpen] = useState(false);
  const [hasValidPrescription, setHasValidPrescription] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<InvoicePayload | null>(null);
  const [labels, setLabels] = useState<Record<string, HdsdLabel>>({});
  const [labelEditorOpen, setLabelEditorOpen] = useState(false);
  const [pendingLabel, setPendingLabel] = useState<HdsdLabel | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Hospital scene state
  const [scanned, setScanned] = useState(false);
  const [hisOpen, setHisOpen] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [called, setCalled] = useState(false);
  // MedRep scene state
  const [presented, setPresented] = useState<number[]>([]);
  const [signed, setSigned] = useState(false);

  // Layout
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ moduleId })
      });
      const data = await r.json();
      setSession(data.session);
      setScenario(data.scenario);
    })();
  }, [moduleId]);

  useEffect(() => {
    chatBottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  async function send() {
    if (!session || !input.trim() || sending) return;
    setSending(true);
    const msg = input.trim();
    setInput("");
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, message: msg })
    });
    const data = await r.json();
    if (data.session) setSession(data.session);
    setSending(false);
  }

  async function postAction(type: UiAction["type"], payload?: Record<string, unknown>) {
    if (!session) return;
    const r = await fetch("/api/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, type, payload })
    });
    const data = await r.json();
    if (data.session) setSession(data.session);
  }

  async function finish() {
    if (!session) return;
    const r = await fetch("/api/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id })
    });
    const data = await r.json();
    setScore(data.score);
  }

  if (!session || !scenario) {
    return <div style={{ padding: 20 }}>Đang khởi tạo phiên...</div>;
  }

  return (
    <div
      className="app-shell"
      style={{ gridTemplateColumns: panelOpen ? "1fr 340px" : "1fr 0px" }}
      onMouseMove={(e) => {
        if (pendingLabel) setMouse({ x: e.clientX, y: e.clientY });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && pendingLabel) setPendingLabel(null);
      }}
      tabIndex={0}
    >
      {/* Nút thu gọn / mở rộng panel — gắn nổi trên góc phải scene */}
      <button
        onClick={() => setPanelOpen((o) => !o)}
        title={panelOpen ? "Thu gọn panel" : "Mở panel"}
        style={{
          position: "fixed",
          top: 14,
          right: 14,
          zIndex: 100,
          padding: "6px 12px",
          fontSize: 13,
          fontWeight: 600,
          background: "#0f766e",
          borderColor: "#14b8a6",
          color: "#ecfeff"
        }}
      >
        {panelOpen ? "→ Thu gọn" : "← Mở panel"}
      </button>

      <div className="scene">
        {moduleId === "gpp" && (
          <GppScene
            picked={picked}
            labels={labels}
            pendingLabel={!!pendingLabel}
            patientLine={[...session.messages].reverse().find((m) => m.role === "npc")?.content}
            pharmacistLine={[...session.messages].reverse().find((m) => m.role === "user")?.content}
            onPick={(item) => {
              // Khi đang cầm nhãn HDSD → click hộp thuốc = dán nhãn cho loại đó
              if (pendingLabel) {
                const attached: HdsdLabel = { ...pendingLabel, drugId: item.id };
                const drug = DRUGS.find((d) => d.id === item.id);
                if (drug) {
                  attached.brand = drug.brand;
                  attached.generic = drug.generic;
                  attached.strength = drug.strength;
                }
                setLabels((prev) => ({ ...prev, [item.id]: attached }));
                setPendingLabel(null);
                postAction("label_dose", {
                  drug: attached.drugId,
                  brand: attached.brand,
                  patient: attached.patient,
                  morning: attached.morning,
                  noon: attached.noon,
                  afternoon: attached.afternoon,
                  evening: attached.evening,
                  timing: attached.timing,
                  notes: attached.notes
                });
                if (!picked.includes(item.id)) {
                  setPicked([...picked, item.id]);
                  postAction("pick_box", {
                    drug: item.id,
                    isAntibiotic: !!item.isAntibiotic,
                    isHazardPregnancy: !!item.isHazardPregnancy
                  });
                }
                return;
              }
              if (picked.includes(item.id)) return;
              const next = [...picked, item.id];
              setPicked(next);
              postAction("pick_box", {
                drug: item.id,
                isAntibiotic: !!item.isAntibiotic,
                isHazardPregnancy: !!item.isHazardPregnancy
              });
            }}
            onOpenPos={() => setPosOpen(true)}
            onOpenLabelEditor={() => setLabelEditorOpen(true)}
          />
        )}
        {moduleId === "hospital" && (
          <HospitalScene
            scanned={scanned}
            hisOpen={hisOpen}
            flagged={flagged}
            called={called}
            onScan={() => {
              setScanned(true);
              postAction("scan_barcode", { patient: "0451" });
            }}
            onOpenHis={() => {
              setHisOpen(true);
              postAction("open_his", { patient: "0451" });
            }}
            onFlagError={() => {
              setFlagged(true);
              postAction("flag_prescription_error", {
                interaction: "warfarin_aspirin"
              });
            }}
            onCallDoctor={() => {
              setCalled(true);
              postAction("call_doctor", {});
            }}
          />
        )}
        {moduleId === "medrep" && (
          <MedRepScene
            presented={presented}
            signed={signed}
            onPresentSlide={(idx) => {
              if (presented.includes(idx)) return;
              const next = [...presented, idx];
              setPresented(next);
              postAction("present_slide", { slide: idx });
            }}
            onSignMou={() => {
              setSigned(true);
              postAction("sign_mou", {});
            }}
          />
        )}

        {moduleId === "gpp" && (
          <PosTerminal
            open={posOpen}
            pickedIds={picked}
            hasValidPrescription={hasValidPrescription}
            onClose={() => setPosOpen(false)}
            onIssue={(invoice) => {
              setLastInvoice(invoice);
              postAction("pos_checkout", {
                invoice_no: invoice.invoiceNo,
                items: invoice.items.map((it) => ({
                  id: it.id,
                  qty: it.qty,
                  unit_price: it.unitPrice
                })),
                sub_total: invoice.subTotal,
                vat: invoice.vat,
                total: invoice.total,
                includes_abx: invoice.includesAbx,
                rx_without_prescription: invoice.rxItemsWithoutPrescription,
                payment_method: invoice.paymentMethod
              });
            }}
          />
        )}
        {moduleId === "gpp" && (
          <LabelEditor
            open={labelEditorOpen}
            pickedIds={picked}
            existing={labels}
            onClose={() => setLabelEditorOpen(false)}
            onCreate={(label) => {
              setPendingLabel(label);
              setLabelEditorOpen(false);
            }}
          />
        )}
      </div>

      <div className="sidepanel" style={{ display: panelOpen ? "flex" : "none", fontSize: 12 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1>{scenario.title}</h1>
            <Link href="/">← Về trang chính</Link>
          </div>
          <p style={{ color: "#94a3b8", fontSize: 13 }}>{scenario.setting}</p>
          <p style={{ fontSize: 12 }}>
            <span className="tag">NPC: {scenario.npcRole}</span>{" "}
            <span className="tag">Phiên: {session.id.slice(0, 14)}</span>
          </p>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 280 }}>
          <h2>Hội thoại</h2>
          <div className="chat">
            {session.messages.map((m, i) => (
              <ChatBubble key={i} m={m} npcRole={scenario.npcRole} />
            ))}
            <div ref={chatBottom} />
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Gõ câu thoại của bạn (vai dược sĩ / trình dược viên)..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
          </div>
          <div className="row">
            <button onClick={send} disabled={sending || !input.trim()}>
              {sending ? "Đang gửi..." : "Gửi"} <span className="kbd">Enter</span>
            </button>
            <button onClick={finish}>🏁 Kết phiên & chấm điểm</button>
          </div>
        </div>

        {moduleId === "gpp" && (
          <div className="card" style={{ fontSize: 13 }}>
            <h3>Khay dụng cụ & nhãn HDSD</h3>
            <div className="row" style={{ alignItems: "center" }}>
              <button onClick={() => setLabelEditorOpen(true)}>🏷️ Soạn nhãn mới</button>
              {pendingLabel && (
                <button
                  onClick={() => setPendingLabel(null)}
                  style={{ background: "#7f1d1d", borderColor: "#dc2626" }}
                >
                  ✕ Huỷ nhãn đang cầm (ESC)
                </button>
              )}
            </div>
            {Object.keys(labels).length === 0 ? (
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                Chưa có nhãn nào được dán. Mở khay dụng cụ trên quầy hoặc nút "Soạn nhãn mới".
              </p>
            ) : (
              <ul style={{ paddingLeft: 18, margin: "6px 0 0", fontSize: 12 }}>
                {Object.values(labels).map((l) => (
                  <li key={l.drugId}>
                    <strong>{l.brand}</strong> ({l.generic} {l.strength}) — S:{l.morning} T:{l.noon}{" "}
                    C:{l.afternoon} T:{l.evening}{" "}
                    <span style={{ color: "#94a3b8" }}>
                      · {l.timing === "after_meal" ? "sau ăn" : l.timing === "before_meal" ? "trước ăn" : l.timing === "with_meal" ? "cùng bữa" : "bất kỳ"}
                      {l.notes ? ` · ${l.notes.slice(0, 30)}` : ""}
                    </span>
                    <button
                      onClick={() =>
                        setLabels((prev) => {
                          const n = { ...prev };
                          delete n[l.drugId];
                          return n;
                        })
                      }
                      style={{ marginLeft: 6, padding: "0 6px", fontSize: 11 }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {moduleId === "gpp" && (
          <div className="card" style={{ fontSize: 13 }}>
            <h3>Phần mềm POS</h3>
            <div className="row" style={{ alignItems: "center" }}>
              <button onClick={() => setPosOpen(true)}>💻 Mở phần mềm bán hàng</button>
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={hasValidPrescription}
                  onChange={(e) => setHasValidPrescription(e.target.checked)}
                  style={{ width: "auto" }}
                />
                Khách có đơn thuốc hợp lệ
              </label>
            </div>
            {lastInvoice && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
                Hoá đơn gần nhất: <strong>{lastInvoice.invoiceNo}</strong> ·{" "}
                {lastInvoice.total.toLocaleString("vi-VN")} ₫
                {lastInvoice.rxItemsWithoutPrescription.length > 0 && (
                  <span className="tag red" style={{ marginLeft: 6 }}>
                    Bán Rx không đơn
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {score && <ScorePanel score={score} />}

        {!score && (
          <div className="card" style={{ fontSize: 12, color: "#94a3b8" }}>
            <h3>Gợi ý theo SEGUE</h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {scenario.stageRules.map((r) => (
                <li key={r.stage}>
                  <strong>{r.stage}</strong>: {r.hint}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Nhãn HDSD bay theo chuột khi đang cầm */}
      {pendingLabel && (
        <div
          style={{
            position: "fixed",
            left: mouse.x + 18,
            top: mouse.y + 18,
            zIndex: 200,
            pointerEvents: "none",
            transform: "rotate(-4deg)",
            background: "#fef3c7",
            color: "#1c1917",
            padding: 8,
            borderRadius: 4,
            boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
            fontFamily: "ui-monospace, monospace",
            width: 200
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 11, borderBottom: "1px dashed #92400e", paddingBottom: 2 }}>
            HDSD · {pendingLabel.brand}
          </div>
          <div style={{ fontSize: 11, marginTop: 2 }}>BN: {pendingLabel.patient}</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
            S:{pendingLabel.morning} T:{pendingLabel.noon} C:{pendingLabel.afternoon} T:{pendingLabel.evening}
          </div>
          <div style={{ fontSize: 10, color: "#7c2d12" }}>
            {pendingLabel.timing === "after_meal"
              ? "Sau ăn"
              : pendingLabel.timing === "before_meal"
              ? "Trước ăn"
              : pendingLabel.timing === "with_meal"
              ? "Cùng bữa"
              : "Bất kỳ"}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatBubble({ m, npcRole }: { m: ChatMessage; npcRole: string }) {
  const who = m.role === "user" ? "Bạn" : m.role === "npc" ? npcRole : "Hệ thống";
  return (
    <div className={`bubble ${m.role}`}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>{who}</div>
      <div>{m.content}</div>
    </div>
  );
}
