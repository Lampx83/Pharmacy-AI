"use client";
import { useState } from "react";

/**
 * Bộ công cụ phụ trợ cho dược sĩ tại quầy GPP — đáp ứng Yêu cầu 2 mục 8:
 *   - Modal xem đơn thuốc theo Thông tư 26/2025/TT-BYT
 *   - Điện thoại + chatbox với bác sĩ kê đơn (khi phát hiện sai sót)
 *   - Mời dược sĩ phụ trách chuyên môn (DS đại học) ra tư vấn / thay thuốc
 *
 * Toàn bộ nội dung mặc định là PLACEHOLDER để giảng viên/khoá học có thể
 * thay bằng kịch bản thật khi up lên.
 */

/* ---------------- 1. Đơn thuốc TT 26/2025/TT-BYT ---------------- */
export interface RxItem {
  name: string;
  strength: string;
  qty: string;
  usage: string;
}
export interface Prescription {
  facility: string;
  facilityAddress: string;
  facilityPhone: string;
  patientName: string;
  patientDob: string;
  patientGender: "Nam" | "Nữ";
  patientAddress: string;
  patientId?: string;
  weight?: string;
  diagnosis: string;
  items: RxItem[];
  doctorName: string;
  doctorPhone: string;
  signedAt: string;
  rxNumber: string;
}

export const DEMO_PRESCRIPTION: Prescription = {
  facility: "Bệnh viện Đa khoa Mô phỏng",
  facilityAddress: "207 Giải Phóng, Hai Bà Trưng, Hà Nội",
  facilityPhone: "024 3869 1234",
  patientName: "Nguyễn Thị Lan",
  patientDob: "12/03/1996",
  patientGender: "Nữ",
  patientAddress: "Số 12, Ngõ 100, Tây Sơn, Đống Đa, Hà Nội",
  patientId: "001196012345",
  weight: "52 kg",
  diagnosis: "Viêm họng cấp / theo dõi mang thai 12 tuần",
  items: [
    {
      name: "Amoxicillin 500 mg (KHÁ-001)",
      strength: "500 mg",
      qty: "21 viên",
      usage: "Uống 1 viên × 3 lần/ngày, sau ăn, trong 7 ngày"
    },
    {
      name: "Paracetamol 500 mg (GIẢ-116)",
      strength: "500 mg",
      qty: "12 viên",
      usage: "Uống 1 viên khi sốt > 38.5°C, cách ≥ 4 giờ"
    }
  ],
  doctorName: "BS. Trần Văn Minh",
  doctorPhone: "0912 345 678",
  signedAt: "Ngày 21 tháng 5 năm 2026",
  rxNumber: "ĐT-MP-2026-001234"
};

export function PrescriptionModal({
  open,
  rx,
  onClose
}: {
  open: boolean;
  rx: Prescription;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <Backdrop onClose={onClose}>
      <div
        style={{
          background: "#ffffff",
          color: "#0f172a",
          width: "min(640px, 92vw)",
          maxHeight: "92vh",
          overflow: "auto",
          borderRadius: 8,
          padding: 24,
          fontFamily: "'Times New Roman', Times, serif"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 11 }}>
            <strong>{rx.facility.toUpperCase()}</strong>
            <br />
            {rx.facilityAddress}
            <br />
            ĐT: {rx.facilityPhone}
          </div>
          <div style={{ fontSize: 11, textAlign: "right" }}>
            Mẫu đơn theo
            <br />
            <strong>Thông tư 26/2025/TT-BYT</strong>
          </div>
        </div>

        <h2 style={{ textAlign: "center", margin: "12px 0 4px", fontSize: 22, letterSpacing: 2 }}>
          ĐƠN THUỐC
        </h2>
        <div style={{ textAlign: "center", fontSize: 12, marginBottom: 14 }}>
          Số: <strong>{rx.rxNumber}</strong>
        </div>

        <Row label="Họ và tên" value={`${rx.patientName} (${rx.patientGender})`} />
        <Row label="Ngày sinh" value={rx.patientDob} />
        <Row label="Cân nặng" value={rx.weight || "—"} />
        <Row label="Số CCCD/Định danh" value={rx.patientId || "—"} />
        <Row label="Địa chỉ" value={rx.patientAddress} />
        <Row label="Chẩn đoán" value={rx.diagnosis} />

        <h3 style={{ borderTop: "1px solid #94a3b8", paddingTop: 10, margin: "14px 0 8px", fontSize: 14 }}>
          Thuốc kê
        </h3>
        <ol style={{ paddingLeft: 22, fontSize: 13, lineHeight: 1.55 }}>
          {rx.items.map((it, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              <strong>{it.name}</strong> · {it.qty}
              <br />
              <em>{it.usage}</em>
            </li>
          ))}
        </ol>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontSize: 12 }}>
          <div>
            <div style={{ fontStyle: "italic" }}>{rx.signedAt}</div>
            <div style={{ marginTop: 32 }}>
              <strong>Bác sĩ kê đơn:</strong> {rx.doctorName}
              <br />
              ĐT liên hệ: <strong>{rx.doctorPhone}</strong>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ marginTop: 4, fontStyle: "italic" }}>(Ký, ghi rõ họ tên)</div>
          </div>
        </div>

        <div style={{ textAlign: "right", marginTop: 18 }}>
          <button onClick={onClose}>✕ Đóng</button>
        </div>
      </div>
    </Backdrop>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", fontSize: 13, lineHeight: 1.5, gap: 8 }}>
      <div style={{ minWidth: 150, color: "#475569" }}>{label}:</div>
      <div style={{ flex: 1 }}>{value}</div>
    </div>
  );
}

/* ---------------- 2. Điện thoại + chat với bác sĩ ---------------- */
export interface DoctorChatMessage {
  who: "student" | "doctor";
  content: string;
}

export function DoctorPhoneModal({
  open,
  doctorPhone,
  doctorName,
  onClose,
  onLog
}: {
  open: boolean;
  doctorPhone: string;
  doctorName: string;
  onClose: () => void;
  onLog?: (info: { dialed: string; messages: DoctorChatMessage[] }) => void;
}) {
  const [dialing, setDialing] = useState("");
  const [connected, setConnected] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<DoctorChatMessage[]>([]);

  if (!open) return null;

  const correctPhone = doctorPhone.replace(/\s+/g, "");
  const typedPhone = dialing.replace(/\s+/g, "");
  const phoneMatch = typedPhone === correctPhone;

  function call() {
    if (!phoneMatch) return;
    setConnected(true);
    setMessages([
      {
        who: "doctor",
        content: `Alo, ${doctorName} nghe. Có gì khẩn không dược sĩ?`
      }
    ]);
  }

  function send() {
    if (!draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    const next: DoctorChatMessage[] = [...messages, { who: "student", content: text }];
    // simple mocked reply
    const t = text.toLowerCase();
    let reply = "Tôi đã ghi nhận, dược sĩ cứ xử lý theo hướng an toàn cho bệnh nhân.";
    if (/(thai|mang thai|pregnan)/.test(t)) {
      reply =
        "Ồ, đúng rồi — bệnh nhân đang theo dõi thai kỳ. Dược sĩ đổi sang loại an toàn cho thai phụ giúp tôi.";
    } else if (/(tương tác|inr|chảy máu|warfarin|aspirin)/.test(t)) {
      reply = "Cảm ơn dược sĩ, đổi sang paracetamol đường uống nhé, ngừng aspirin.";
    } else if (/(liều|quá liều|trẻ em|nhi)/.test(t)) {
      reply = "Anh chỉnh lại liều theo Dược thư giúp tôi, ghi nhận trong bệnh án.";
    } else if (/(dị ứng)/.test(t)) {
      reply = "Vậy đổi sang nhóm khác không cùng cấu trúc giúp tôi nhé.";
    }
    next.push({ who: "doctor", content: reply });
    setMessages(next);
  }

  return (
    <Backdrop onClose={onClose}>
      <div
        style={{
          width: "min(380px, 92vw)",
          background: "#0f172a",
          color: "#e2e8f0",
          borderRadius: 28,
          padding: 14,
          border: "4px solid #334155",
          boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
        }}
      >
        <div
          style={{
            background: "#1e293b",
            borderRadius: 16,
            padding: 12,
            minHeight: 460,
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 11, marginBottom: 8 }}>
            ☎️ ĐIỆN THOẠI – LIÊN HỆ BÁC SĨ KÊ ĐƠN
          </div>

          {!connected ? (
            <div style={{ textAlign: "center", padding: "30px 6px" }}>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Nhập số điện thoại của bác sĩ ghi trên đơn:
              </div>
              <input
                value={dialing}
                onChange={(e) => setDialing(e.target.value)}
                placeholder="0xxx xxx xxx"
                style={{
                  marginTop: 12,
                  width: "70%",
                  textAlign: "center",
                  fontSize: 22,
                  letterSpacing: 2,
                  background: "#0f172a",
                  border: "1px solid #475569",
                  color: "#e2e8f0",
                  padding: 10,
                  borderRadius: 8
                }}
              />
              <Keypad onPress={(d) => setDialing((p) => (d === "x" ? p.slice(0, -1) : p + d))} />
              <button
                onClick={call}
                disabled={!phoneMatch}
                style={{
                  marginTop: 16,
                  background: phoneMatch ? "#22c55e" : "#334155",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 24px",
                  fontSize: 14,
                  fontWeight: 700,
                  borderRadius: 999,
                  cursor: phoneMatch ? "pointer" : "not-allowed"
                }}
              >
                📞 Gọi
              </button>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 10 }}>
                Mẹo: số đúng là <strong>{doctorPhone}</strong> (in trên đơn thuốc).
              </div>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "6px 4px", fontSize: 13 }}>
                {messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: m.who === "student" ? "flex-end" : "flex-start",
                      margin: "6px 0"
                    }}
                  >
                    <div
                      style={{
                        background: m.who === "student" ? "#0ea5e9" : "#334155",
                        color: "#ffffff",
                        padding: "6px 10px",
                        borderRadius: 10,
                        maxWidth: "76%",
                        fontSize: 12
                      }}
                    >
                      {m.who === "doctor" && (
                        <div style={{ fontSize: 10, opacity: 0.7 }}>{doctorName}</div>
                      )}
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Trao đổi với bác sĩ..."
                  style={{
                    flex: 1,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    border: "1px solid #475569",
                    padding: 8,
                    borderRadius: 8,
                    fontSize: 12
                  }}
                />
                <button onClick={send}>Gửi</button>
              </div>
            </>
          )}
        </div>
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <button
            onClick={() => {
              onLog?.({ dialed: dialing, messages });
              onClose();
            }}
          >
            ✕ Cúp máy
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function Keypad({ onPress }: { onPress: (d: string) => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "x"];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 6,
        marginTop: 14,
        width: "70%",
        marginLeft: "auto",
        marginRight: "auto"
      }}
    >
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => onPress(k)}
          style={{
            padding: "10px 0",
            background: "#0f172a",
            color: "#e2e8f0",
            border: "1px solid #475569",
            borderRadius: 8,
            fontSize: 16,
            cursor: "pointer"
          }}
        >
          {k === "x" ? "⌫" : k}
        </button>
      ))}
    </div>
  );
}

/* ---------------- 3. DS đại học (dược sĩ phụ trách chuyên môn) ---------------- */
export function SeniorPharmacistModal({
  open,
  active,
  onActivate,
  onClose
}: {
  open: boolean;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <Backdrop onClose={onClose}>
      <div
        style={{
          background: "#ffffff",
          color: "#0f172a",
          width: "min(480px, 92vw)",
          borderRadius: 10,
          padding: 22
        }}
      >
        <h2 style={{ marginTop: 0 }}>🧑‍🏫 Mời Dược sĩ Đại học (phụ trách chuyên môn)</h2>
        <p style={{ fontSize: 13, lineHeight: 1.55 }}>
          Trong tình huống cần thay thế thuốc, tư vấn vượt thẩm quyền của dược sĩ trung học,
          sinh viên có thể mời <strong>DS đại học</strong> ra hỗ trợ.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            background: "#f1f5f9",
            padding: 12,
            borderRadius: 8,
            marginTop: 10
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#a7f3d0",
              display: "grid",
              placeItems: "center",
              fontSize: 30
            }}
          >
            👩‍⚕️
          </div>
          <div style={{ fontSize: 13 }}>
            <strong>DS. ĐH Phạm Thị Hà</strong>
            <br />
            <span style={{ color: "#475569" }}>
              Dược sĩ Đại học · Phụ trách chuyên môn
              <br />
              Nhà thuốc GPP – Mô phỏng đào tạo
            </span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "#475569", marginTop: 14 }}>
          Khi bật chế độ này, sinh viên tiếp tục đóng vai <strong>DS đại học</strong>; có thể:
          quyết định thay thế thuốc, tư vấn các nhóm Rx có cảnh báo, hoặc xử lý ca tế nhị ở khu vực
          tư vấn riêng.
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onClose}>Đóng</button>
          {active ? (
            <button
              onClick={() => {
                onActivate();
                onClose();
              }}
              style={{ background: "#94a3b8" }}
            >
              ↩️ Trở lại vai DS trung học
            </button>
          ) : (
            <button
              onClick={() => {
                onActivate();
                onClose();
              }}
              style={{ background: "#0f766e", color: "#fff", fontWeight: 700 }}
            >
              ✅ Bật chế độ DS đại học
            </button>
          )}
        </div>
      </div>
    </Backdrop>
  );
}

/* ---------------- Backdrop shared ---------------- */
function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.65)",
        zIndex: 500,
        display: "grid",
        placeItems: "center"
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
