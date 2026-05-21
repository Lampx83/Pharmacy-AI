"use client";
/**
 * GppScene v2 — bố cục theo Yêu cầu 2.docx
 *   - 4 tủ lớn sau lưng dược sĩ (2 Rx + 2 OTC)
 *   - 3 tủ bên tay phải (dược liệu / TPCN / mỹ phẩm)
 *   - 1 tủ quầy ngang phía trước, 3 ngăn (nhỏ mắt / nhỏ mũi / dùng ngoài)
 *   - Camera đặt sau vai dược sĩ, lệch ~30–45°
 *   - Tên nhà thuốc "Nhà thuốc thực hành – HMC"
 *
 * Bản scene cũ được giữ ở GppSceneLegacy.tsx để tham khảo.
 */
import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  RoundedBox,
  Environment,
  ContactShadows,
  SoftShadows,
  Billboard
} from "@react-three/drei";
import type * as THREE from "three";
import {
  ALL_DRUGS,
  CABINETS,
  getDrugsByCabinet,
  type CabinetSpec,
  type DrugSpec
} from "@/lib/catalog/gpp";
import { TIMING_LABEL, type HdsdLabel } from "@/lib/labels/hdsd";

interface Props {
  picked: string[];
  labels: Record<string, HdsdLabel>;
  pendingLabel: boolean;
  onPick: (item: { id: string; isAntibiotic?: boolean; isHazardPregnancy?: boolean }) => void;
  onOpenPos: () => void;
  onOpenLabelEditor: () => void;
  patientLine?: string;
  pharmacistLine?: string;
}

/* ----------- Layout constants (m) ----------- */
const ROOM_W = 9.0;
const ROOM_D = 9.0;
const ROOM_H = 3.6;
const BACK_Z = -2.4;
const RIGHT_X = +3.6;

const BACK_CABINETS = CABINETS.filter((c) => c.zone === "back");
const SIDE_CABINETS = CABINETS.filter((c) => c.zone === "side");
const FRONT_SECTIONS = CABINETS.filter((c) => c.zone === "front");

const BACK_CAB_W = 1.7;
const BACK_CAB_H = 2.6;
const BACK_CAB_D = 0.55;
const BACK_CAB_GAP = 0.18;
const BACK_TOTAL_W = BACK_CABINETS.length * BACK_CAB_W + (BACK_CABINETS.length - 1) * BACK_CAB_GAP;

const SIDE_CAB_W = 1.6; // along z
const SIDE_CAB_H = 2.6;
const SIDE_CAB_D = 0.55; // along x (depth into room)
const SIDE_CAB_GAP = 0.18;
const SIDE_TOTAL_W = SIDE_CABINETS.length * SIDE_CAB_W + (SIDE_CABINETS.length - 1) * SIDE_CAB_GAP;

const COUNTER_W = 3.2;
const COUNTER_H = 1.0;
const COUNTER_D = 0.6;
const COUNTER_Z = 1.3; // mặt trước quầy ở z = 1.3
const COUNTER_SECTIONS = FRONT_SECTIONS.length;
const SECTION_W = COUNTER_W / COUNTER_SECTIONS;

const SHELVES_PER_CAB = 5;
const DRUGS_PER_SHELF = 3;

/* ============= Hộp thuốc (clickable + animate vào khay) ============= */
function DrugBox({
  drug,
  shelfPos,
  picked,
  label,
  targetPos,
  onPick
}: {
  drug: DrugSpec;
  shelfPos: [number, number, number];
  picked: boolean;
  label?: HdsdLabel;
  targetPos: [number, number, number];
  onPick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const dst = picked ? targetPos : shelfPos;
    g.position.x += (dst[0] - g.position.x) * 0.15;
    g.position.y += (dst[1] - g.position.y) * 0.15;
    g.position.z += (dst[2] - g.position.z) * 0.15;
  });
  return (
    <group
      ref={ref}
      position={shelfPos}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
    >
      <RoundedBox args={[0.22, 0.32, 0.14]} radius={0.012}>
        <meshStandardMaterial
          color={hovered ? "#fef9c3" : drug.bodyColor}
          roughness={0.55}
        />
      </RoundedBox>
      {/* Dải nhãn nhóm */}
      <mesh position={[0, 0.135, 0.073]}>
        <planeGeometry args={[0.22, 0.05]} />
        <meshStandardMaterial color={drug.groupAccent} />
      </mesh>
      <Text
        position={[0, 0.04, 0.075]}
        fontSize={0.038}
        color="#0f172a"
        anchorX="center"
        maxWidth={0.2}
      >
        {drug.name}
      </Text>
      <Text position={[0, -0.02, 0.075]} fontSize={0.026} color="#334155" anchorX="center">
        {drug.strength}
      </Text>
      <Text position={[0, -0.07, 0.075]} fontSize={0.022} color="#475569" anchorX="center">
        {drug.sku}
      </Text>
      {drug.isRx && (
        <Text position={[-0.08, 0.14, 0.076]} fontSize={0.024} color="#ffffff" anchorX="center">
          Rx
        </Text>
      )}
      {label && (
        <group position={[0, -0.18, 0.075]}>
          <mesh>
            <planeGeometry args={[0.22, 0.08]} />
            <meshStandardMaterial color="#fde68a" />
          </mesh>
          <Text position={[0, 0, 0.001]} fontSize={0.018} color="#78350f" anchorX="center">
            {label.morning > 0 ? `S${label.morning} ` : ""}
            {label.noon > 0 ? `T${label.noon} ` : ""}
            {label.afternoon > 0 ? `C${label.afternoon} ` : ""}
            {label.evening > 0 ? `Tối${label.evening}` : ""}
          </Text>
        </group>
      )}
    </group>
  );
}

/* ============= Tủ thuốc lớn (5 tầng) ============= */
function Cabinet({
  cabinet,
  drugs,
  origin,
  rotationY,
  picked,
  labels,
  onPick,
  pickSlotPos
}: {
  cabinet: CabinetSpec;
  drugs: DrugSpec[];
  origin: [number, number, number];
  rotationY: number;
  picked: string[];
  labels: Record<string, HdsdLabel>;
  onPick: (item: { id: string; isAntibiotic?: boolean; isHazardPregnancy?: boolean }) => void;
  pickSlotPos: (idx: number) => [number, number, number];
}) {
  const W = BACK_CAB_W;
  const H = BACK_CAB_H;
  const D = BACK_CAB_D;
  const SHELF_H = (H - 0.2) / SHELVES_PER_CAB;

  return (
    <group position={origin} rotation={[0, rotationY, 0]}>
      {/* Khung gỗ xanh */}
      <mesh position={[0, H / 2, -D / 2 + 0.02]} castShadow receiveShadow>
        <boxGeometry args={[W, H, 0.04]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>
      {/* viền gỗ xanh */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * W) / 2 - s * 0.04, H / 2, 0]} castShadow>
          <boxGeometry args={[0.08, H, D]} />
          <meshStandardMaterial color="#0f766e" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, H - 0.04, 0]} castShadow>
        <boxGeometry args={[W, 0.08, D]} />
        <meshStandardMaterial color="#0f766e" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[W, 0.08, D]} />
        <meshStandardMaterial color="#0f766e" roughness={0.4} />
      </mesh>
      {/* 4 tầng kệ chia */}
      {Array.from({ length: SHELVES_PER_CAB - 1 }).map((_, i) => (
        <mesh
          key={i}
          position={[0, 0.1 + (i + 1) * SHELF_H, -D / 2 + 0.18]}
          castShadow
        >
          <boxGeometry args={[W - 0.16, 0.02, D - 0.05]} />
          <meshStandardMaterial color="#fde68a" roughness={0.7} />
        </mesh>
      ))}

      {/* Biển hiệu phía trên cùng */}
      <group position={[0, H + 0.22, -D / 2 + 0.02]}>
        <mesh castShadow>
          <boxGeometry args={[W + 0.02, 0.42, 0.06]} />
          <meshStandardMaterial color={cabinet.accent} roughness={0.5} />
        </mesh>
        <Text
          position={[0, 0.02, 0.04]}
          fontSize={0.12}
          color="#ffffff"
          anchorX="center"
          maxWidth={W - 0.05}
          textAlign="center"
        >
          {cabinet.label}
        </Text>
      </group>

      {/* Hộp thuốc trên mỗi tầng */}
      {drugs.map((drug, idx) => {
        const shelf = idx % SHELVES_PER_CAB;
        const slot = Math.floor(idx / SHELVES_PER_CAB) % DRUGS_PER_SHELF;
        const y = 0.1 + shelf * SHELF_H + SHELF_H / 2;
        const x = (slot - (DRUGS_PER_SHELF - 1) / 2) * (W / DRUGS_PER_SHELF);
        const z = -D / 2 + 0.22;
        const isPicked = picked.includes(drug.id);
        // pickSlotPos is in WORLD coords; convert to local
        const wt = pickSlotPos(picked.indexOf(drug.id) === -1 ? 0 : picked.indexOf(drug.id));
        const localTarget: [number, number, number] = [
          (wt[0] - origin[0]) * Math.cos(-rotationY) - (wt[2] - origin[2]) * Math.sin(-rotationY),
          wt[1] - origin[1],
          (wt[0] - origin[0]) * Math.sin(-rotationY) + (wt[2] - origin[2]) * Math.cos(-rotationY)
        ];
        return (
          <DrugBox
            key={drug.id}
            drug={drug}
            shelfPos={[x, y, z]}
            picked={isPicked}
            label={labels[drug.id]}
            targetPos={localTarget}
            onPick={() =>
              onPick({
                id: drug.id,
                isAntibiotic: drug.isAntibiotic,
                isHazardPregnancy: drug.isHazardPregnancy
              })
            }
          />
        );
      })}
    </group>
  );
}

/* ============= Quầy ngang phía trước (3 ngăn) ============= */
function FrontCounter({
  picked,
  labels,
  onPick,
  pickSlotPos
}: {
  picked: string[];
  labels: Record<string, HdsdLabel>;
  onPick: (item: { id: string; isAntibiotic?: boolean; isHazardPregnancy?: boolean }) => void;
  pickSlotPos: (idx: number) => [number, number, number];
}) {
  return (
    <group position={[0, 0, COUNTER_Z]}>
      {/* Mặt quầy */}
      <mesh position={[0, COUNTER_H - 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[COUNTER_W + 0.1, 0.08, COUNTER_D + 0.1]} />
        <meshStandardMaterial color="#0f766e" roughness={0.35} metalness={0.2} />
      </mesh>
      {/* Thân tủ thấp dưới quầy */}
      <mesh position={[0, (COUNTER_H - 0.08) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[COUNTER_W, COUNTER_H - 0.08, COUNTER_D]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>
      {/* 3 ngăn riêng */}
      {FRONT_SECTIONS.map((sec, sIdx) => {
        const cx = (sIdx - (COUNTER_SECTIONS - 1) / 2) * SECTION_W;
        const drugs = getDrugsByCabinet(sec.id).slice(0, 4);
        return (
          <group key={sec.id} position={[cx, 0, 0]}>
            {/* Vách ngăn */}
            {sIdx < COUNTER_SECTIONS - 1 && (
              <mesh position={[SECTION_W / 2, COUNTER_H - 0.2, 0]}>
                <boxGeometry args={[0.02, 0.3, COUNTER_D]} />
                <meshStandardMaterial color={sec.accent} />
              </mesh>
            )}
            {/* Bảng tên */}
            <mesh position={[0, COUNTER_H + 0.12, -COUNTER_D / 2 - 0.02]}>
              <boxGeometry args={[SECTION_W - 0.05, 0.16, 0.04]} />
              <meshStandardMaterial color={sec.accent} />
            </mesh>
            <Text
              position={[0, COUNTER_H + 0.12, -COUNTER_D / 2]}
              fontSize={0.06}
              color="#ffffff"
              anchorX="center"
            >
              {sec.label}
            </Text>
            {/* Hộp thuốc bày trong ngăn */}
            {drugs.map((drug, idx) => {
              const slotIdx = picked.indexOf(drug.id);
              const wt = pickSlotPos(slotIdx === -1 ? 0 : slotIdx);
              return (
                <DrugBox
                  key={drug.id}
                  drug={drug}
                  shelfPos={[
                    (idx - (drugs.length - 1) / 2) * (SECTION_W / drugs.length),
                    COUNTER_H + 0.18,
                    0.02
                  ]}
                  picked={picked.includes(drug.id)}
                  label={labels[drug.id]}
                  targetPos={[wt[0] - 0, wt[1], wt[2] - COUNTER_Z]}
                  onPick={() =>
                    onPick({
                      id: drug.id,
                      isAntibiotic: drug.isAntibiotic,
                      isHazardPregnancy: drug.isHazardPregnancy
                    })
                  }
                />
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

/* ============= Khay đựng thuốc cho khách ============= */
const PICK_TRAY_BASE: [number, number, number] = [-0.5, COUNTER_H + 0.04, COUNTER_Z + 0.7];
function pickSlotPos(idx: number): [number, number, number] {
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  return [PICK_TRAY_BASE[0] + col * 0.28, PICK_TRAY_BASE[1] + 0.15, PICK_TRAY_BASE[2] + row * 0.22];
}
function PickTray({ pickedCount }: { pickedCount: number }) {
  return (
    <group position={[PICK_TRAY_BASE[0] + 0.42, PICK_TRAY_BASE[1] - 0.05, PICK_TRAY_BASE[2] + 0.15]}>
      <mesh receiveShadow>
        <boxGeometry args={[1.3, 0.04, 0.6]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
      </mesh>
      <Text
        position={[0, 0.025, -0.28]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.035}
        color="#475569"
        anchorX="center"
      >
        KHAY BÁN HÀNG · Đã chọn {pickedCount}
      </Text>
    </group>
  );
}

/* ============= POS computer (clickable) ============= */
function PosComputer({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={[1.0, COUNTER_H + 0.05, COUNTER_Z - 0.08]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Đế màn hình */}
      <mesh position={[0, 0.01, 0]} castShadow>
        <boxGeometry args={[0.25, 0.02, 0.18]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.03, 0.18, 0.03]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {/* Màn hình */}
      <mesh position={[0, 0.32, -0.02]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.62, 0.4, 0.04]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 0.32, 0.0]} rotation={[-0.12, 0, 0]}>
        <planeGeometry args={[0.58, 0.36]} />
        <meshStandardMaterial
          color={hovered ? "#1e3a8a" : "#1e293b"}
          emissive={hovered ? "#3b82f6" : "#0ea5e9"}
          emissiveIntensity={0.3}
        />
      </mesh>
      <Text
        position={[0, 0.4, 0.001]}
        rotation={[-0.12, 0, 0]}
        fontSize={0.04}
        color="#bae6fd"
        anchorX="center"
      >
        PHARMA-POS · HMC
      </Text>
      <Text
        position={[0, 0.32, 0.001]}
        rotation={[-0.12, 0, 0]}
        fontSize={0.05}
        color="#fef3c7"
        anchorX="center"
      >
        F2: DANH MỤC
      </Text>
      <Text
        position={[0, 0.24, 0.001]}
        rotation={[-0.12, 0, 0]}
        fontSize={0.03}
        color="#94a3b8"
        anchorX="center"
      >
        Click để mở phần mềm bán hàng
      </Text>
      {/* Bàn phím */}
      <mesh position={[0, 0.06, 0.16]} castShadow>
        <boxGeometry args={[0.4, 0.02, 0.14]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}

/* ============= Tool tray (kéo, bút, bao bì ra lẻ) ============= */
function ToolTray({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={[-1.2, COUNTER_H + 0.04, COUNTER_Z - 0.05]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={onClick}
    >
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.02, 0.35]} />
        <meshStandardMaterial color={hovered ? "#fde68a" : "#e7e5e4"} />
      </mesh>
      <Text position={[0, 0.02, -0.1]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.038} color="#1f2937">
        KHAY RA LẺ + NHÃN HDSD
      </Text>
      <Text position={[0, 0.02, 0.07]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.026} color="#475569">
        click để soạn nhãn
      </Text>
      {/* túi giấy 3 màu */}
      {[
        ["#ffffff", -0.18],
        ["#fde68a", 0.0],
        ["#fbcfe8", 0.18]
      ].map(([c, dx], i) => (
        <mesh key={i} position={[dx as number, 0.035, 0.12]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.12, 0.06, 0.08]} />
          <meshStandardMaterial color={c as string} />
        </mesh>
      ))}
    </group>
  );
}

/* ============= Tủ lạnh nhỏ ============= */
function MiniFridge() {
  return (
    <group position={[-3.6, 0, COUNTER_Z + 0.6]}>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.65, 1.4, 0.6]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.7, 0.31]}>
        <boxGeometry args={[0.6, 1.3, 0.02]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <Billboard position={[0, 1.55, 0.32]}>
        <Text fontSize={0.058} color="#0f766e" anchorX="center">
          TỦ LẠNH 2–8°C
        </Text>
      </Billboard>
    </group>
  );
}

/* ============= Khu vực tư vấn riêng (bàn ghế) ============= */
function ConsultArea() {
  return (
    <group position={[-3.6, 0, 2.4]}>
      {/* Bàn */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[1.2, 0.05, 0.6]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.37, 0]} castShadow>
        <boxGeometry args={[0.05, 0.74, 0.05]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>
      {/* 2 ghế */}
      <mesh position={[-0.45, 0.45, 0.5]} castShadow>
        <boxGeometry args={[0.4, 0.05, 0.4]} />
        <meshStandardMaterial color="#fca5a5" />
      </mesh>
      <mesh position={[0.45, 0.45, 0.5]} castShadow>
        <boxGeometry args={[0.4, 0.05, 0.4]} />
        <meshStandardMaterial color="#fca5a5" />
      </mesh>
      <Billboard position={[0, 1.4, 0]}>
        <Text fontSize={0.085} color="#0f766e" anchorX="center">
          KHU TƯ VẤN RIÊNG
        </Text>
      </Billboard>
    </group>
  );
}

/* ============= Avatar dược sĩ + bệnh nhân (đơn giản) ============= */
function SimpleFigure({
  position,
  rotationY = 0,
  color,
  label
}: {
  position: [number, number, number];
  rotationY?: number;
  color: string;
  label: string;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.9, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      <Billboard position={[0, 1.4, 0]}>
        <Text fontSize={0.075} color="#0f172a" anchorX="center">
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

/* ============= Sàn + tường ============= */
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[ROOM_W, ROOM_D]} />
      <meshStandardMaterial color="#f1f5f9" roughness={0.85} />
    </mesh>
  );
}
function Walls() {
  return (
    <group>
      {/* tường sau */}
      <mesh position={[0, ROOM_H / 2, BACK_Z - 0.05]} receiveShadow>
        <boxGeometry args={[ROOM_W, ROOM_H, 0.1]} />
        <meshStandardMaterial color="#ecfeff" roughness={0.85} />
      </mesh>
      {/* tường trái */}
      <mesh position={[-ROOM_W / 2 - 0.05, ROOM_H / 2, 0]} receiveShadow>
        <boxGeometry args={[0.1, ROOM_H, ROOM_D]} />
        <meshStandardMaterial color="#ecfeff" roughness={0.85} />
      </mesh>
      {/* tường phải */}
      <mesh position={[ROOM_W / 2 + 0.05, ROOM_H / 2, 0]} receiveShadow>
        <boxGeometry args={[0.1, ROOM_H, ROOM_D]} />
        <meshStandardMaterial color="#ecfeff" roughness={0.85} />
      </mesh>
    </group>
  );
}

/* ============= Mảng thuốc đại diện cho từng tủ ============= */
function pickDisplayDrugs(cabinetId: string, n: number): DrugSpec[] {
  return getDrugsByCabinet(cabinetId).slice(0, n);
}

/* ============= Scene chính ============= */
export default function GppScene({
  picked,
  labels,
  pendingLabel,
  onPick,
  onOpenPos,
  onOpenLabelEditor,
  patientLine,
  pharmacistLine
}: Props) {
  const labelCount = Object.keys(labels).length;

  // Drug subset rendered in 3D scene (POS still has all 180)
  const backDrugs = useMemo(
    () => BACK_CABINETS.map((c) => pickDisplayDrugs(c.id, SHELVES_PER_CAB * DRUGS_PER_SHELF)),
    []
  );
  const sideDrugs = useMemo(
    () => SIDE_CABINETS.map((c) => pickDisplayDrugs(c.id, SHELVES_PER_CAB * DRUGS_PER_SHELF)),
    []
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        cursor: pendingLabel ? "crosshair" : "default"
      }}
    >
      <Canvas shadows camera={{ position: [3.4, 4.0, 5.5], fov: 48 }} gl={{ antialias: true }}>
        <color attach="background" args={["#e6efe9"]} />
        <SoftShadows size={24} samples={10} focus={0.6} />

        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#ffffff", "#cbd5e1", 0.4]} />
        <directionalLight
          position={[3, 5, 4]}
          intensity={1.0}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <spotLight position={[0, 3.4, COUNTER_Z + 0.6]} angle={0.55} penumbra={0.7} intensity={0.9} color="#fef9c3" castShadow />
        <Environment preset="city" />

        <Floor />
        <Walls />

        {/* === 4 tủ lớn sau lưng dược sĩ === */}
        {BACK_CABINETS.map((cab, i) => {
          const x = -BACK_TOTAL_W / 2 + BACK_CAB_W / 2 + i * (BACK_CAB_W + BACK_CAB_GAP);
          return (
            <Cabinet
              key={cab.id}
              cabinet={cab}
              drugs={backDrugs[i]}
              origin={[x, 0, BACK_Z + BACK_CAB_D / 2]}
              rotationY={0}
              picked={picked}
              labels={labels}
              onPick={onPick}
              pickSlotPos={pickSlotPos}
            />
          );
        })}

        {/* === 3 tủ bên tay phải dược sĩ (tường phải, quay vào trong) === */}
        {SIDE_CABINETS.map((cab, i) => {
          const z = -SIDE_TOTAL_W / 2 + SIDE_CAB_W / 2 + i * (SIDE_CAB_W + SIDE_CAB_GAP) - 0.2;
          return (
            <Cabinet
              key={cab.id}
              cabinet={cab}
              drugs={sideDrugs[i]}
              origin={[RIGHT_X - SIDE_CAB_D / 2, 0, z]}
              rotationY={-Math.PI / 2}
              picked={picked}
              labels={labels}
              onPick={onPick}
              pickSlotPos={pickSlotPos}
            />
          );
        })}

        {/* === Quầy ngang 3 ngăn === */}
        <FrontCounter
          picked={picked}
          labels={labels}
          onPick={onPick}
          pickSlotPos={pickSlotPos}
        />

        <PickTray pickedCount={picked.length} />
        <ToolTray onClick={onOpenLabelEditor} />
        <PosComputer onClick={onOpenPos} />

        <MiniFridge />
        <ConsultArea />

        {/* Dược sĩ đứng sau quầy, mặt hướng ra phía bệnh nhân */}
        <SimpleFigure
          position={[0, 0, COUNTER_Z - 0.45]}
          rotationY={0}
          color="#ffffff"
          label="DƯỢC SĨ (SV)"
        />
        {/* Bệnh nhân đứng đối diện qua quầy, xoay nhẹ ~20° */}
        <SimpleFigure
          position={[0, 0, COUNTER_Z + 0.95]}
          rotationY={Math.PI + 0.35}
          color="#fca5a5"
          label="BỆNH NHÂN"
        />

        {/* Bubble thoại — Billboard luôn quay về phía camera */}
        {patientLine && (
          <Billboard position={[0.95, 1.55, COUNTER_Z + 0.95]}>
            <mesh>
              <planeGeometry args={[0.95, 0.28]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <Text position={[0, 0, 0.01]} fontSize={0.038} color="#0f172a" anchorX="center" maxWidth={0.9}>
              {patientLine}
            </Text>
          </Billboard>
        )}
        {pharmacistLine && (
          <Billboard position={[-0.95, 1.65, COUNTER_Z - 0.45]}>
            <mesh>
              <planeGeometry args={[0.95, 0.28]} />
              <meshStandardMaterial color="#dcfce7" />
            </mesh>
            <Text position={[0, 0, 0.01]} fontSize={0.038} color="#065f46" anchorX="center" maxWidth={0.9}>
              {pharmacistLine}
            </Text>
          </Billboard>
        )}

        <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={20} blur={2.5} far={4} />

        {/* Camera mặc định đã set sau vai dược sĩ (lệch phải ~30°). */}
        <OrbitControls
          enablePan={false}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={2.5}
          maxDistance={12}
          target={[0, 0.9, -0.4]}
        />
      </Canvas>

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
