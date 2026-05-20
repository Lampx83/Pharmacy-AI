"use client";
import { useEffect, useState } from "react";
import { DRUGS } from "@/lib/catalog/gpp";
import {
  TIMING_LABEL,
  type HdsdLabel,
  type MealTiming,
  totalPerDay
} from "@/lib/labels/hdsd";

interface Props {
  open: boolean;
  pickedIds: string[];
  existing: Record<string, HdsdLabel>;
  onClose: () => void;
  onCreate: (label: HdsdLabel) => void;
}

const QUICK_NOTES = [
  "Uống nhiều nước",
  "Tránh lái xe, vận hành máy móc",
  "Không dùng chung với rượu bia",
  "Uống cách kháng sinh ≥ 2 giờ",
  "Bảo quản nơi khô ráo, tránh ánh nắng"
];

export default function LabelEditor({ open, pickedIds, existing, onClose, onCreate }: Props) {
  const [drugId, setDrugId] = useState<string>(pickedIds[0] || "");
  const [patient, setPatient] = useState("Khách vãng lai");
  const [morning, setMorning] = useState(1);
  const [noon, setNoon] = useState(0);
  const [afternoon, setAfternoon] = useState(1);
  const [evening, setEvening] = useState(0);
  const [timing, setTiming] = useState<MealTiming>("after_meal");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!drugId && pickedIds.length) setDrugId(pickedIds[0]);
  }, [open, pickedIds, drugId]);

  if (!open) return null;

  const drug = DRUGS.find((d) => d.id === drugId);
  const totalDay = morning + noon + afternoon + evening;

  function create() {
    if (!drug) return;
    const label: HdsdLabel = {
      drugId: drug.id,
      brand: drug.brand,
      generic: drug.generic,
      strength: drug.strength,
      patient: patient.trim() || "Khách vãng lai",
      morning,
      noon,
      afternoon,
      evening,
      timing,
      notes: notes.trim(),
      issuedAt: Date.now()
    };
    onCreate(label);
  }

  function toggleNote(n: string) {
    setNotes((prev) => {
      const has = prev.split(" · ").map((s) => s.trim()).includes(n);
      if (has) return prev.split(" · ").filter((s) => s.trim() !== n).join(" · ");
      return prev ? `${prev} · ${n}` : n;
    });
  }

  const candidates = pickedIds.length ? pickedIds : DRUGS.map((d) => d.id);

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={title}>
          <span>🏷️ Soạn nhãn HDSD – Hướng dẫn sử dụng thuốc</span>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={body}>
          {/* Cột trái: form */}
          <div style={leftCol}>
            <label style={field}>
              <span>Chọn thuốc</span>
              <select
                value={drugId}
                onChange={(e) => setDrugId(e.target.value)}
                style={selectStyle}
              >
                {candidates.map((id) => {
                  const d = DRUGS.find((x) => x.id === id)!;
                  return (
                    <option key={id} value={id}>
                      {d.brand} – {d.generic} {d.strength}
                      {existing[id] ? "  · (đã có nhãn)" : ""}
                    </option>
                  );
                })}
              </select>
            </label>

            <label style={field}>
              <span>Bệnh nhân</span>
              <input value={patient} onChange={(e) => setPatient(e.target.value)} />
            </label>

            <fieldset style={fieldset}>
              <legend>Số viên mỗi cữ</legend>
              <div style={doseGrid}>
                <DoseBox label="Sáng"   value={morning}   onChange={setMorning} />
                <DoseBox label="Trưa"   value={noon}      onChange={setNoon} />
                <DoseBox label="Chiều"  value={afternoon} onChange={setAfternoon} />
                <DoseBox label="Tối"    value={evening}   onChange={setEvening} />
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                Tổng liều/ngày: <strong>{totalDay} viên</strong>
              </div>
            </fieldset>

            <fieldset style={fieldset}>
              <legend>Thời điểm uống</legend>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(Object.keys(TIMING_LABEL) as MealTiming[]).map((t) => (
                  <label key={t} style={radioStyle(timing === t)}>
                    <input
                      type="radio"
                      checked={timing === t}
                      onChange={() => setTiming(t)}
                      style={{ display: "none" }}
                    />
                    {TIMING_LABEL[t]}
                  </label>
                ))}
              </div>
            </fieldset>

            <label style={field}>
              <span>Ghi chú thêm (chú ý đặc biệt)</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ví dụ: uống nhiều nước, tránh ánh nắng..."
              />
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {QUICK_NOTES.map((n) => (
                <button
                  key={n}
                  onClick={() => toggleNote(n)}
                  style={{ fontSize: 11, padding: "2px 6px" }}
                >
                  + {n}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={onClose} style={{ flex: 1 }}>Huỷ</button>
              <button
                onClick={create}
                disabled={!drug || totalDay === 0}
                style={{
                  flex: 2,
                  background: drug && totalDay > 0 ? "#facc15" : "#334155",
                  color: "#0f172a",
                  borderColor: "#facc15"
                }}
              >
                🏷️ Tạo nhãn → kéo dán lên hộp
              </button>
            </div>
          </div>

          {/* Cột phải: preview nhãn */}
          <div style={rightCol}>
            <h3 style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: 13 }}>
              Xem trước nhãn dán (kích thước thật)
            </h3>
            <StickerPreview
              brand={drug?.brand || "—"}
              generic={drug?.generic || "—"}
              strength={drug?.strength || ""}
              patient={patient}
              morning={morning}
              noon={noon}
              afternoon={afternoon}
              evening={evening}
              timing={timing}
              notes={notes}
            />
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 10 }}>
              Sau khi bấm <strong>Tạo nhãn</strong>, con trỏ chuột sẽ mang theo
              nhãn → di chuyển sang kệ thuốc và <strong>click vào hộp</strong> để
              dán.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DoseBox({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#94a3b8" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
        <button onClick={() => onChange(Math.max(0, value - 1))} style={miniBtn}>–</button>
        <span style={doseValueStyle}>{value}</span>
        <button onClick={() => onChange(value + 1)} style={miniBtn}>+</button>
      </div>
    </div>
  );
}

function StickerPreview(props: {
  brand: string;
  generic: string;
  strength: string;
  patient: string;
  morning: number;
  noon: number;
  afternoon: number;
  evening: number;
  timing: MealTiming;
  notes: string;
}) {
  const total = props.morning + props.noon + props.afternoon + props.evening;
  return (
    <div
      style={{
        background: "#fef3c7",
        color: "#1c1917",
        padding: 12,
        width: 280,
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        borderRadius: 4,
        fontFamily: "ui-monospace, monospace",
        transform: "rotate(-2deg)"
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 13, borderBottom: "1px dashed #92400e", paddingBottom: 4 }}>
        HƯỚNG DẪN SỬ DỤNG
      </div>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        BN: <strong>{props.patient}</strong>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
        {props.brand}
      </div>
      <div style={{ fontSize: 11, color: "#57534e" }}>
        {props.generic} {props.strength}
      </div>
      <div
        style={{
          marginTop: 6,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 4,
          fontSize: 11,
          textAlign: "center"
        }}
      >
        <DoseCell label="Sáng" v={props.morning} />
        <DoseCell label="Trưa" v={props.noon} />
        <DoseCell label="Chiều" v={props.afternoon} />
        <DoseCell label="Tối" v={props.evening} />
      </div>
      <div style={{ marginTop: 6, fontSize: 11 }}>
        🕒 {TIMING_LABEL[props.timing]} · {total} viên/ngày
      </div>
      {props.notes && (
        <div style={{ marginTop: 4, fontSize: 11, fontStyle: "italic" }}>
          ★ {props.notes}
        </div>
      )}
    </div>
  );
}

function DoseCell({ label, v }: { label: string; v: number }) {
  return (
    <div style={{ background: "#fde68a", padding: "2px 0", borderRadius: 3 }}>
      <div style={{ fontSize: 10, color: "#78350f" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{v}</div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 99
};
const panel: React.CSSProperties = {
  width: "min(820px, 96vw)",
  maxHeight: "92vh",
  background: "#0b1220",
  border: "1px solid #1f2937",
  borderRadius: 10,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};
const title: React.CSSProperties = {
  background: "linear-gradient(90deg,#ca8a04,#a16207)",
  color: "white",
  padding: "8px 12px",
  fontWeight: 700,
  display: "flex",
  justifyContent: "space-between"
};
const closeBtn: React.CSSProperties = {
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.3)"
};
const body: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr",
  gap: 14,
  padding: 14,
  overflow: "auto"
};
const leftCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10
};
const rightCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center"
};
const field: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 13,
  color: "#cbd5e1"
};
const fieldset: React.CSSProperties = {
  border: "1px solid #1f2937",
  borderRadius: 6,
  padding: "8px 10px",
  color: "#cbd5e1",
  fontSize: 13
};
const doseGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,1fr)",
  gap: 8
};
const miniBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  padding: 0,
  fontSize: 16,
  lineHeight: "20px"
};
const doseValueStyle: React.CSSProperties = {
  minWidth: 28,
  textAlign: "center",
  fontWeight: 700,
  fontSize: 18,
  color: "white"
};
const selectStyle: React.CSSProperties = {
  background: "#0b1220",
  color: "white",
  border: "1px solid #334155",
  borderRadius: 6,
  padding: 8
};
function radioStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid " + (active ? "#facc15" : "#334155"),
    background: active ? "#facc15" : "transparent",
    color: active ? "#0f172a" : "#cbd5e1",
    cursor: "pointer",
    fontSize: 12
  };
}
