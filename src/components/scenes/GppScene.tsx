"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, RoundedBox } from "@react-three/drei";
import { DRUGS, type DrugSpec } from "@/lib/catalog/gpp";
import { TIMING_LABEL, type HdsdLabel } from "@/lib/labels/hdsd";

interface Props {
  picked: string[];
  labels: Record<string, HdsdLabel>;
  pendingLabel: boolean;
  onPick: (item: { id: string; isAntibiotic?: boolean; isHazardPregnancy?: boolean }) => void;
  onOpenPos: () => void;
  onOpenLabelEditor: () => void;
}

const COLS = 3;
const ROWS = 2;
const CELL_W = 1.85;
const CELL_H = 1.25;
const CELL_D = 0.6;
const ORIGIN_X = -((COLS - 1) * CELL_W) / 2;
const ORIGIN_Y = 0.8;

function DrugBox({
  drug,
  picked,
  label,
  onPick,
  position
}: {
  drug: DrugSpec;
  picked: boolean;
  label?: HdsdLabel;
  onPick: () => void;
  position: [number, number, number];
}) {
  const W = 0.42;
  const H = 0.62;
  const D = 0.22;
  const front = D / 2 + 0.001;

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
    >
      <RoundedBox args={[W, H, D]} radius={0.02}>
        <meshStandardMaterial
          color={picked ? "#bbf7d0" : drug.bodyColor}
          emissive={picked ? "#15803d" : "#000000"}
          emissiveIntensity={picked ? 0.25 : 0}
        />
      </RoundedBox>

      <mesh position={[0, H / 2 - 0.05, front]}>
        <planeGeometry args={[W - 0.02, 0.1]} />
        <meshStandardMaterial color={drug.groupAccent} />
      </mesh>
      <Text
        position={[0, H / 2 - 0.05, front + 0.001]}
        fontSize={0.038}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={W - 0.03}
        textAlign="center"
      >
        {drug.groupLabel.split(" ").slice(0, 3).join(" ")}
      </Text>

      <Text
        position={[0, H / 2 - 0.18, front]}
        fontSize={0.07}
        color={drug.textDark ? "#0f172a" : "#ffffff"}
        anchorX="center"
        anchorY="middle"
        maxWidth={W - 0.04}
        textAlign="center"
      >
        {drug.brand}
      </Text>

      <Text
        position={[0, H / 2 - 0.26, front]}
        fontSize={0.038}
        color={drug.textDark ? "#334155" : "#e2e8f0"}
        anchorX="center"
        anchorY="middle"
      >
        {drug.generic}
      </Text>

      <mesh position={[0, H / 2 - 0.34, front]}>
        <planeGeometry args={[W - 0.08, 0.07]} />
        <meshStandardMaterial color={drug.groupAccent} />
      </mesh>
      <Text
        position={[0, H / 2 - 0.34, front + 0.001]}
        fontSize={0.045}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {drug.strength} · {drug.form}
      </Text>

      <Text
        position={[0, H / 2 - 0.42, front]}
        fontSize={0.028}
        color={drug.textDark ? "#475569" : "#cbd5e1"}
        anchorX="center"
        anchorY="middle"
        maxWidth={W - 0.04}
        textAlign="center"
      >
        {drug.pack}
      </Text>

      <Text
        position={[0, H / 2 - 0.47, front]}
        fontSize={0.024}
        color={drug.textDark ? "#64748b" : "#cbd5e1"}
        anchorX="center"
        anchorY="middle"
      >
        SX: {drug.manufacturer}
      </Text>

      <Text
        position={[0, H / 2 - 0.51, front]}
        fontSize={0.022}
        color={drug.textDark ? "#64748b" : "#cbd5e1"}
        anchorX="center"
        anchorY="middle"
      >
        {`SĐK: ${drug.sdk}  ·  Lô: 2410A`}
      </Text>

      <Barcode position={[0, -H / 2 + 0.07, front]} width={W - 0.1} height={0.05} />

      <group position={[W / 2 - 0.06, H / 2 - 0.05, front + 0.002]}>
        <mesh>
          <planeGeometry args={[0.09, 0.07]} />
          <meshStandardMaterial color={drug.isRx ? "#ffffff" : "#fef9c3"} />
        </mesh>
        <Text
          position={[0, 0, 0.001]}
          fontSize={0.035}
          color={drug.isRx ? "#dc2626" : "#854d0e"}
          anchorX="center"
          anchorY="middle"
        >
          {drug.isRx ? "Rx" : "OTC"}
        </Text>
      </group>

      {drug.isHazardPregnancy && (
        <group position={[-W / 2 + 0.07, -H / 2 + 0.16, front + 0.002]}>
          <mesh>
            <circleGeometry args={[0.04, 24]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
          <Text position={[0, 0, 0.001]} fontSize={0.04} color="#7c2d12" anchorX="center" anchorY="middle">
            ⚠
          </Text>
        </group>
      )}

      {/* Nhãn HDSD đã dán */}
      {label && <StickyLabel3D label={label} parentW={W} parentH={H} front={front + 0.005} />}
    </group>
  );
}

function StickyLabel3D({
  label,
  parentW,
  parentH,
  front
}: {
  label: HdsdLabel;
  parentW: number;
  parentH: number;
  front: number;
}) {
  const w = parentW * 0.85;
  const h = parentH * 0.35;
  // dán hơi xéo
  return (
    <group position={[parentW * 0.05, -parentH * 0.05, front]} rotation={[0, 0, -0.06]}>
      {/* shadow */}
      <mesh position={[0.004, -0.004, -0.0005]}>
        <planeGeometry args={[w + 0.01, h + 0.01]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
      {/* paper */}
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#fef3c7" />
      </mesh>
      {/* header bar */}
      <mesh position={[0, h / 2 - 0.025, 0.001]}>
        <planeGeometry args={[w, 0.045]} />
        <meshStandardMaterial color="#ca8a04" />
      </mesh>
      <Text
        position={[0, h / 2 - 0.025, 0.002]}
        fontSize={0.028}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        HDSD
      </Text>
      {/* patient */}
      <Text
        position={[-w / 2 + 0.02, h / 2 - 0.07, 0.002]}
        fontSize={0.025}
        color="#1c1917"
        anchorX="left"
        maxWidth={w - 0.04}
      >
        {`BN: ${label.patient}`}
      </Text>
      {/* dose line */}
      <Text
        position={[-w / 2 + 0.02, 0, 0.002]}
        fontSize={0.032}
        color="#0f172a"
        anchorX="left"
        maxWidth={w - 0.04}
      >
        {`S:${label.morning}  T:${label.noon}  C:${label.afternoon}  T:${label.evening}`}
      </Text>
      {/* timing */}
      <Text
        position={[-w / 2 + 0.02, -h / 2 + 0.06, 0.002]}
        fontSize={0.024}
        color="#7c2d12"
        anchorX="left"
        maxWidth={w - 0.04}
      >
        {TIMING_LABEL[label.timing]}
      </Text>
      {/* note */}
      {label.notes && (
        <Text
          position={[-w / 2 + 0.02, -h / 2 + 0.03, 0.002]}
          fontSize={0.02}
          color="#44403c"
          anchorX="left"
          maxWidth={w - 0.04}
        >
          {`★ ${label.notes.slice(0, 80)}`}
        </Text>
      )}
    </group>
  );
}

function Barcode({
  position,
  width,
  height
}: {
  position: [number, number, number];
  width: number;
  height: number;
}) {
  const bars = 24;
  const widths = Array.from({ length: bars }, (_, i) =>
    [0.4, 1.0, 0.6, 1.2, 0.4, 0.8][(i * 7) % 6]
  );
  const totalUnits = widths.reduce((a, b) => a + b, 0);
  const unit = width / totalUnits;
  let cursor = -width / 2;
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[width + 0.01, height + 0.01]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {widths.map((w, i) => {
        const bw = w * unit;
        const x = cursor + bw / 2;
        cursor += bw;
        const isBlack = i % 2 === 0;
        return (
          <mesh key={i} position={[x, 0, 0.0005]}>
            <planeGeometry args={[bw * 0.55, height]} />
            <meshStandardMaterial color={isBlack ? "#0f172a" : "#ffffff"} />
          </mesh>
        );
      })}
    </group>
  );
}

function Compartment({
  drug,
  col,
  row,
  picked,
  labels,
  onPick
}: {
  drug: DrugSpec;
  col: number;
  row: number;
  picked: string[];
  labels: Record<string, HdsdLabel>;
  onPick: Props["onPick"];
}) {
  const cx = ORIGIN_X + col * CELL_W;
  const cy = ORIGIN_Y + (ROWS - 1 - row) * CELL_H;
  const cz = -0.3;
  const n = drug.boxesPerRow;
  const spacing = 0.48;
  const startX = -((n - 1) * spacing) / 2;
  const label = labels[drug.id];

  return (
    <group position={[cx, cy, cz]}>
      <mesh position={[0, 0, -0.27]}>
        <boxGeometry args={[CELL_W - 0.04, CELL_H - 0.04, 0.05]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[-CELL_W / 2 + 0.02, 0, 0]}>
        <boxGeometry args={[0.04, CELL_H, CELL_D]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[CELL_W / 2 - 0.02, 0, 0]}>
        <boxGeometry args={[0.04, CELL_H, CELL_D]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[0, -CELL_H / 2 + 0.03, 0]}>
        <boxGeometry args={[CELL_W - 0.06, 0.04, CELL_D]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      <mesh position={[0, CELL_H / 2 - 0.1, 0.05]}>
        <boxGeometry args={[CELL_W - 0.06, 0.18, 0.02]} />
        <meshStandardMaterial color={drug.groupAccent} />
      </mesh>
      <Text
        position={[0, CELL_H / 2 - 0.1, 0.07]}
        fontSize={0.1}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={CELL_W - 0.12}
        textAlign="center"
      >
        {drug.groupLabel}
      </Text>

      {Array.from({ length: n }).map((_, i) => (
        <DrugBox
          key={i}
          drug={drug}
          picked={picked.includes(drug.id)}
          label={i === 0 ? label : undefined /* dán nhãn lên hộp đầu */}
          onPick={() =>
            onPick({
              id: drug.id,
              isAntibiotic: drug.isAntibiotic,
              isHazardPregnancy: drug.isHazardPregnancy
            })
          }
          position={[startX + i * spacing, -0.15, 0.1]}
        />
      ))}
    </group>
  );
}

/* =========================
   Máy POS trên quầy
   ========================= */
function PosComputer({ onClick }: { onClick: () => void }) {
  const base: [number, number, number] = [1.95, -0.35, 1.25];
  return (
    <group position={base}>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.35, 0.02, 0.22]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.05, 0.18, 0.05]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.88, 0.52, 0.04]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 0.42, 0.021]} onClick={onClick}>
        <planeGeometry args={[0.82, 0.46]} />
        <meshStandardMaterial color="#0b1220" emissive="#082f49" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.62, 0.022]}>
        <planeGeometry args={[0.82, 0.06]} />
        <meshStandardMaterial color="#0d9488" />
      </mesh>
      <Text position={[-0.36, 0.62, 0.023]} fontSize={0.03} color="#ffffff" anchorX="left">
        ★ Pharma-POS v1.0
      </Text>
      <Text position={[0, 0.25, 0.023]} fontSize={0.055} color="#22c55e" anchorX="center">
        🛒 NHẤN ĐỂ MỞ
      </Text>
      <mesh position={[0, 0.005, 0.32]} rotation={[-0.1, 0, 0]}>
        <boxGeometry args={[0.42, 0.02, 0.16]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      <mesh position={[0.3, 0.01, 0.32]}>
        <boxGeometry args={[0.08, 0.02, 0.12]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <group position={[-0.65, 0.02, 0]}>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.28, 0.18, 0.22]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0, 0.2, 0.05]}>
          <boxGeometry args={[0.22, 0.04, 0.12]} />
          <meshStandardMaterial color="#fafafa" />
        </mesh>
        <Text position={[0, 0.08, 0.112]} fontSize={0.022} color="#a7f3d0" anchorX="center">
          PRINTER
        </Text>
      </group>
    </group>
  );
}

/* =========================
   Khay dụng cụ (kéo, dao cắt vỉ, cuộn giấy dính, túi đựng)
   ========================= */
function ToolTray({ onClick }: { onClick: () => void }) {
  const base: [number, number, number] = [-1.85, -0.3, 1.25];
  return (
    <group position={base} onClick={onClick}>
      {/* khay nền */}
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[1.2, 0.04, 0.55]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <Text position={[0, 0.06, -0.32]} fontSize={0.05} color="#a7f3d0" anchorX="center">
        KHAY DỤNG CỤ – Click để soạn nhãn HDSD
      </Text>

      {/* ✂ Kéo */}
      <group position={[-0.42, 0.03, 0]} rotation={[0, 0, 0.25]}>
        <mesh position={[0, 0.02, -0.08]} rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.04, 0.01, 0.22]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.03, 0.02, -0.08]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[0.04, 0.01, 0.22]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[-0.02, 0.02, 0.06]}>
          <torusGeometry args={[0.04, 0.012, 12, 24]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <mesh position={[0.05, 0.02, 0.08]}>
          <torusGeometry args={[0.04, 0.012, 12, 24]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <Text position={[0, 0.08, 0.05]} fontSize={0.03} color="#cbd5e1" anchorX="center">
          KÉO
        </Text>
      </group>

      {/* 💊 Dao cắt vỉ (pill cutter) */}
      <group position={[-0.13, 0.04, 0]}>
        <mesh>
          <boxGeometry args={[0.16, 0.05, 0.18]} />
          <meshStandardMaterial color="#f1f5f9" />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.01, 24]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.14, 0.005, 0.005]} />
          <meshStandardMaterial color="#475569" metalness={0.7} />
        </mesh>
        <Text position={[0, 0.12, 0.05]} fontSize={0.03} color="#cbd5e1" anchorX="center">
          DAO CẮT VỈ
        </Text>
      </group>

      {/* 📜 Cuộn giấy dính HDSD */}
      <group position={[0.18, 0.04, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.1, 24]} />
          <meshStandardMaterial color="#fef3c7" />
        </mesh>
        <mesh position={[0, 0, 0.051]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.11, 16]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
        {/* tờ giấy đang lòi ra */}
        <mesh position={[0, -0.08, 0.04]} rotation={[0.2, 0, 0]}>
          <planeGeometry args={[0.12, 0.08]} />
          <meshStandardMaterial color="#fef3c7" side={2} />
        </mesh>
        <Text position={[0, 0.13, 0.05]} fontSize={0.03} color="#cbd5e1" anchorX="center">
          GIẤY DÍNH HDSD
        </Text>
      </group>

      {/* ✉ Túi đựng thuốc lẻ */}
      <group position={[0.48, 0.04, 0]}>
        <mesh>
          <boxGeometry args={[0.18, 0.005, 0.22]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.003, 0]}>
          <boxGeometry args={[0.17, 0.001, 0.21]} />
          <meshStandardMaterial color="#f1f5f9" />
        </mesh>
        <Text
          position={[0, 0.005, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.02}
          color="#475569"
          anchorX="center"
        >
          Nhà thuốc GPP
        </Text>
        <Text position={[0, 0.12, 0.05]} fontSize={0.03} color="#cbd5e1" anchorX="center">
          TÚI ĐỰNG THUỐC
        </Text>
      </group>
    </group>
  );
}

export default function GppScene({
  picked,
  labels,
  pendingLabel,
  onPick,
  onOpenPos,
  onOpenLabelEditor
}: Props) {
  const cabinetWidth = COLS * CELL_W + 0.2;
  const cabinetHeight = ROWS * CELL_H + 0.7;
  const labelCount = Object.keys(labels).length;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        cursor: pendingLabel ? "crosshair" : "default"
      }}
    >
      <Canvas camera={{ position: [0, 1.9, 5.2], fov: 50 }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 5, 3]} intensity={0.6} />
        <directionalLight position={[-3, 4, 2]} intensity={0.25} />

        <mesh position={[0, ORIGIN_Y + ((ROWS - 1) * CELL_H) / 2, -0.6]}>
          <boxGeometry args={[cabinetWidth, cabinetHeight, 0.08]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>

        <group position={[0, ORIGIN_Y + (ROWS - 1) * CELL_H + CELL_H / 2 + 0.22, -0.3]}>
          <mesh>
            <boxGeometry args={[cabinetWidth - 0.1, 0.34, 0.05]} />
            <meshStandardMaterial color="#0f766e" />
          </mesh>
          <Text position={[0, 0, 0.03]} fontSize={0.2} color="white" anchorX="center" anchorY="middle">
            TỦ THUỐC GPP – PHÂN LOẠI THEO NHÓM
          </Text>
        </group>

        {DRUGS.map((d, idx) => (
          <Compartment
            key={d.id}
            drug={d}
            col={idx % COLS}
            row={Math.floor(idx / COLS)}
            picked={picked}
            labels={labels}
            onPick={onPick}
          />
        ))}

        <mesh position={[0, ORIGIN_Y + (ROWS - 1) * CELL_H + CELL_H / 2 + 0.46, -0.3]}>
          <boxGeometry args={[cabinetWidth + 0.1, 0.08, 0.6]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0, ORIGIN_Y - CELL_H / 2 - 0.05, -0.3]}>
          <boxGeometry args={[cabinetWidth + 0.1, 0.08, 0.6]} />
          <meshStandardMaterial color="#334155" />
        </mesh>

        {/* Quầy */}
        <mesh position={[0, -0.4, 1.3]}>
          <boxGeometry args={[5, 0.1, 1.2]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        <Text position={[-0.2, -0.3, 1.85]} fontSize={0.1} color="#94a3b8">
          QUẦY GPP
        </Text>

        {/* Khay dụng cụ bên trái quầy */}
        <ToolTray onClick={onOpenLabelEditor} />

        {/* Máy POS bên phải quầy */}
        <PosComputer onClick={onOpenPos} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
          <planeGeometry args={[12, 12]} />
          <meshStandardMaterial color="#0b1220" />
        </mesh>

        <OrbitControls
          enablePan={false}
          maxPolarAngle={Math.PI / 2}
          minDistance={3}
          maxDistance={8}
        />
      </Canvas>

      {/* HUD chỉ dẫn khi đang cầm nhãn */}
      {pendingLabel && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#facc15",
            color: "#0f172a",
            padding: "6px 14px",
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 13,
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
          }}
        >
          🏷️ Đang cầm nhãn HDSD — click vào hộp thuốc cần dán
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          right: 10,
          display: "flex",
          gap: 8,
          flexWrap: "wrap"
        }}
      >
        <button onClick={onOpenLabelEditor}>🏷️ Soạn nhãn HDSD (kéo/dán)</button>
        <button onClick={onOpenPos}>💻 Mở phần mềm POS</button>
        <span className="tag">Đã chọn: {picked.length}</span>
        <span className={"tag " + (labelCount ? "green" : "")}>
          Đã dán nhãn: {labelCount}/{picked.length || "—"}
        </span>
      </div>
    </div>
  );
}
