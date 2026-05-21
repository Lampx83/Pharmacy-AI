"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  RoundedBox,
  Environment,
  ContactShadows,
  SoftShadows,
  MeshReflectorMaterial,
  Html,
  useGLTF,
  useAnimations
} from "@react-three/drei";
import type * as THREE from "three";
import { DRUGS, type DrugSpec } from "@/lib/catalog/gpp";
import { TIMING_LABEL, type HdsdLabel } from "@/lib/labels/hdsd";

const NULL_RAYCAST = () => null as unknown as void;

useGLTF.preload("/models/patient.glb");
useGLTF.preload("/models/pharmacist.glb");
useGLTF.preload("/models/plant.glb");
useGLTF.preload("/models/fridge.glb");

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

/* ===================== Tủ thuốc =====================
   Đã hạ thấp + giãn ngang để dược sĩ với được tới ngăn trên cùng */
const COLS = 3;
const ROWS = 2;
const CELL_W = 2.30; // rộng hơn (1.95 → 2.30)
const CELL_H = 0.95; // thấp hơn (1.30 → 0.95)
const CELL_D = 0.62;
const ORIGIN_X = -((COLS - 1) * CELL_W) / 2;
const ORIGIN_Y = 0.55; // hạ thấp cả tủ (1.05 → 0.55) để ngăn trên ~2.4m

/* Khay đựng thuốc trên quầy cho khách – 3×2 ô */
const PICK_TRAY_BASE: [number, number, number] = [-0.55, -0.02, 2.50];
const PICK_TRAY_DX = 0.55;
const PICK_TRAY_DZ = 0.32;
function pickSlotPos(idx: number): [number, number, number] {
  const col = idx % 3;
  const row = Math.floor(idx / 3);
  return [
    PICK_TRAY_BASE[0] + col * PICK_TRAY_DX,
    PICK_TRAY_BASE[1] + 0.32, // hộp đứng cao hơn mặt khay
    PICK_TRAY_BASE[2] - row * PICK_TRAY_DZ
  ];
}

/* ===================== Hộp thuốc (cầm nắm được) ===================== */
function DrugBox({
  drug,
  picked,
  isPrimary,
  label,
  onPick,
  shelfPos,
  targetPos
}: {
  drug: DrugSpec;
  picked: boolean;
  isPrimary: boolean;
  label?: HdsdLabel;
  onPick: () => void;
  shelfPos: [number, number, number];
  targetPos: [number, number, number];
}) {
  const W = 0.44;
  const H = 0.64;
  const D = 0.24;
  const front = D / 2 + 0.001;

  const groupRef = useRef<THREE.Group>(null);
  const tRef = useRef(0); // 0 = ở kệ, 1 = trên khay
  const hoverRef = useRef(0); // 0..1 — lerp mượt để KHÔNG nhảy khi vào/ra hover
  const [hover, setHover] = useState(false);

  // chỉ hộp đại diện (primary) mới bay ra khi picked; các hộp khác là "tồn kho" trên kệ
  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const target = picked && isPrimary ? 1 : 0;
    tRef.current += (target - tRef.current) * Math.min(1, dt * 3.0);
    const t = tRef.current;

    // lerp mượt hover: enter/leave KHÔNG còn nhảy box
    hoverRef.current += ((hover ? 1 : 0) - hoverRef.current) * Math.min(1, dt * 12);
    const h = hoverRef.current;

    const arcY = Math.sin(t * Math.PI) * 0.55; // bay theo cung parabol
    const hoverLift = 0.09 * h * (1 - 0.55 * t);
    const hoverTilt = 0.04 * h * (1 - 0.55 * t);

    g.position.x = shelfPos[0] + (targetPos[0] - shelfPos[0]) * t;
    g.position.y = shelfPos[1] + (targetPos[1] - shelfPos[1]) * t + arcY + hoverLift;
    g.position.z = shelfPos[2] + (targetPos[2] - shelfPos[2]) * t;

    // xoay nhẹ khi đang bay
    g.rotation.x = t * 0.15 + hoverTilt;
    g.rotation.z = -Math.sin(t * Math.PI) * 0.10;
  });

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "grab";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHover(false);
        document.body.style.cursor = "default";
      }}
    >
      {/* thân hộp */}
      <RoundedBox args={[W, H, D]} radius={0.02} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={drug.bodyColor}
          emissive={hover ? "#fde68a" : "#000000"}
          emissiveIntensity={hover ? 0.18 : 0}
          roughness={0.45}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
        />
      </RoundedBox>

      {/* dải tiêu đề nhóm */}
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
        fontSize={0.072}
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

      {/* tem Rx/OTC */}
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
  return (
    <group position={[parentW * 0.05, -parentH * 0.05, front]} rotation={[0, 0, -0.06]}>
      <mesh position={[0.004, -0.004, -0.0005]}>
        <planeGeometry args={[w + 0.01, h + 0.01]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#fef3c7" />
      </mesh>
      <mesh position={[0, h / 2 - 0.025, 0.001]}>
        <planeGeometry args={[w, 0.045]} />
        <meshStandardMaterial color="#ca8a04" />
      </mesh>
      <Text position={[0, h / 2 - 0.025, 0.002]} fontSize={0.028} color="#ffffff" anchorX="center" anchorY="middle">
        HDSD
      </Text>
      <Text
        position={[-w / 2 + 0.02, h / 2 - 0.07, 0.002]}
        fontSize={0.025}
        color="#1c1917"
        anchorX="left"
        maxWidth={w - 0.04}
      >
        {`BN: ${label.patient}`}
      </Text>
      <Text
        position={[-w / 2 + 0.02, 0, 0.002]}
        fontSize={0.032}
        color="#0f172a"
        anchorX="left"
        maxWidth={w - 0.04}
      >
        {`S:${label.morning}  T:${label.noon}  C:${label.afternoon}  T:${label.evening}`}
      </Text>
      <Text
        position={[-w / 2 + 0.02, -h / 2 + 0.06, 0.002]}
        fontSize={0.024}
        color="#7c2d12"
        anchorX="left"
        maxWidth={w - 0.04}
      >
        {TIMING_LABEL[label.timing]}
      </Text>
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
  const widths = Array.from({ length: bars }, (_, i) => [0.4, 1.0, 0.6, 1.2, 0.4, 0.8][(i * 7) % 6]);
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

/* ===================== Ngăn tủ – chỉ phần khung ===================== */
function Compartment({ drug, col, row }: { drug: DrugSpec; col: number; row: number }) {
  const cx = ORIGIN_X + col * CELL_W;
  const cy = ORIGIN_Y + (ROWS - 1 - row) * CELL_H;
  const cz = -0.18;

  return (
    <group position={[cx, cy, cz]}>
      <mesh position={[0, 0, -0.27]} receiveShadow>
        <boxGeometry args={[CELL_W - 0.04, CELL_H - 0.04, 0.04]} />
        <meshStandardMaterial color="#f5f5f4" roughness={0.85} />
      </mesh>
      <mesh position={[-CELL_W / 2 + 0.015, 0, 0]} receiveShadow>
        <boxGeometry args={[0.03, CELL_H, CELL_D]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.6} />
      </mesh>
      <mesh position={[CELL_W / 2 - 0.015, 0, 0]} receiveShadow>
        <boxGeometry args={[0.03, CELL_H, CELL_D]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.6} />
      </mesh>
      <mesh position={[0, -CELL_H / 2 + 0.02, 0]} receiveShadow>
        <boxGeometry args={[CELL_W - 0.04, 0.03, CELL_D]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.7} />
      </mesh>
      <mesh position={[0, CELL_H / 2 - 0.02, CELL_D / 2 - 0.02]}>
        <boxGeometry args={[CELL_W - 0.08, 0.012, 0.02]} />
        <meshStandardMaterial color="#fef9c3" emissive="#fde68a" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, -CELL_H / 2 + 0.07, CELL_D / 2 + 0.005]}>
        <planeGeometry args={[CELL_W - 0.18, 0.09]} />
        <meshStandardMaterial color={drug.groupAccent} />
      </mesh>
      <Text
        position={[0, -CELL_H / 2 + 0.07, CELL_D / 2 + 0.008]}
        fontSize={0.058}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={CELL_W - 0.2}
        textAlign="center"
      >
        {drug.groupLabel}
      </Text>
    </group>
  );
}

/* ===================== Khay đựng thuốc trên quầy ===================== */
function PickTray({ pickedCount }: { pickedCount: number }) {
  const W = 3 * PICK_TRAY_DX + 0.2;
  const D = 2 * PICK_TRAY_DZ + 0.25;
  return (
    <group position={[PICK_TRAY_BASE[0] + PICK_TRAY_DX, PICK_TRAY_BASE[1] - 0.02, PICK_TRAY_BASE[2] - PICK_TRAY_DZ / 2]}>
      {/* đế khay */}
      <mesh receiveShadow castShadow>
        <boxGeometry args={[W, 0.03, D]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.7} />
      </mesh>
      {/* viền 4 cạnh */}
      <mesh position={[0, 0.025, D / 2 - 0.01]}>
        <boxGeometry args={[W, 0.05, 0.02]} />
        <meshStandardMaterial color="#92400e" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.025, -D / 2 + 0.01]}>
        <boxGeometry args={[W, 0.05, 0.02]} />
        <meshStandardMaterial color="#92400e" roughness={0.6} />
      </mesh>
      <mesh position={[-W / 2 + 0.01, 0.025, 0]}>
        <boxGeometry args={[0.02, 0.05, D]} />
        <meshStandardMaterial color="#92400e" roughness={0.6} />
      </mesh>
      <mesh position={[W / 2 - 0.01, 0.025, 0]}>
        <boxGeometry args={[0.02, 0.05, D]} />
        <meshStandardMaterial color="#92400e" roughness={0.6} />
      </mesh>
      {/* nhãn khay */}
      <Text
        position={[0, 0.018, -D / 2 + 0.08]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.06}
        color="#7c2d12"
        anchorX="center"
      >
        KHAY THUỐC CHO KHÁCH
      </Text>
      <Text
        position={[0, 0.018, -D / 2 + 0.16]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.04}
        color="#92400e"
        anchorX="center"
      >
        {pickedCount > 0
          ? `Đã có ${pickedCount} mặt hàng · click hộp để trả lại kệ`
          : "Click hộp thuốc trên kệ để gắp ra đây"}
      </Text>
      {/* 6 ô gợi ý vị trí */}
      {Array.from({ length: 6 }).map((_, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = -PICK_TRAY_DX + col * PICK_TRAY_DX;
        const z = PICK_TRAY_DZ / 2 - row * PICK_TRAY_DZ;
        return (
          <mesh key={i} position={[x, 0.017, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[PICK_TRAY_DX - 0.06, PICK_TRAY_DZ - 0.06]} />
            <meshStandardMaterial color="#fed7aa" transparent opacity={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ===================== Tủ kính ===================== */
function Cabinet({ children }: { children: React.ReactNode }) {
  const cabinetWidth = COLS * CELL_W + 0.4;
  const cabinetHeight = ROWS * CELL_H + 0.85;
  const cy = ORIGIN_Y + ((ROWS - 1) * CELL_H) / 2;

  return (
    <group>
      {/* mặt sau (panel sáng) */}
      <mesh position={[0, cy, -0.55]} receiveShadow>
        <boxGeometry args={[cabinetWidth, cabinetHeight, 0.06]} />
        <meshStandardMaterial color="#fafaf9" roughness={0.7} />
      </mesh>

      {/* khung tủ – viền trắng */}
      {/* dọc trái */}
      <mesh position={[-cabinetWidth / 2 + 0.05, cy, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[0.1, cabinetHeight, 0.85]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      {/* dọc phải */}
      <mesh position={[cabinetWidth / 2 - 0.05, cy, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[0.1, cabinetHeight, 0.85]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      {/* ngang trên */}
      <mesh position={[0, cy + cabinetHeight / 2 - 0.05, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[cabinetWidth, 0.1, 0.85]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      {/* ngang giữa (giữa 2 hàng) */}
      <mesh position={[0, ORIGIN_Y - CELL_H / 2 + 0.0, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[cabinetWidth - 0.2, 0.04, 0.85]} />
        <meshStandardMaterial color="#f5f5f4" roughness={0.5} />
      </mesh>
      {/* ngang dưới */}
      <mesh position={[0, cy - cabinetHeight / 2 + 0.05, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[cabinetWidth, 0.1, 0.85]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>

      {/* biển tên trên tủ – nền xanh dược */}
      <group position={[0, cy + cabinetHeight / 2 + 0.28, 0.2]}>
        <mesh castShadow>
          <boxGeometry args={[cabinetWidth - 0.05, 0.5, 0.1]} />
          <meshStandardMaterial color="#047857" roughness={0.5} />
        </mesh>
        {/* chữ thập trắng */}
        <group position={[-cabinetWidth / 2 + 0.45, 0, 0.06]}>
          <mesh>
            <circleGeometry args={[0.2, 32]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[0.22, 0.07]} />
            <meshStandardMaterial color="#047857" />
          </mesh>
          <mesh position={[0, 0, 0.002]}>
            <planeGeometry args={[0.07, 0.22]} />
            <meshStandardMaterial color="#047857" />
          </mesh>
        </group>
        <Text
          position={[0.15, 0.02, 0.06]}
          fontSize={0.18}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.04}
        >
          NHÀ THUỐC THỰC HÀNH – HMC
        </Text>
        <Text
          position={[0.15, -0.16, 0.06]}
          fontSize={0.072}
          color="#a7f3d0"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.06}
        >
          TRƯỜNG CÔNG NGHỆ – ĐH KINH TẾ QUỐC DÂN · GPP MÔ PHỎNG
        </Text>
      </group>

      {/* Ray trượt nhôm trên/dưới */}
      <SlidingTracks cabinetWidth={cabinetWidth} cy={cy} cabinetHeight={cabinetHeight} />

      {/* 2 cánh cửa kính trượt – click để mở/đóng (cánh trượt sang nửa bên kia) */}
      <CabinetDoor side="left" cy={cy} cabinetWidth={cabinetWidth} cabinetHeight={cabinetHeight} />
      <CabinetDoor side="right" cy={cy} cabinetWidth={cabinetWidth} cabinetHeight={cabinetHeight} />

      {children}
    </group>
  );
}

/* Cánh cửa kính TRƯỢT — kiểu cửa lùa Việt Nam.
   - 2 cánh trên 2 ray song song (cánh trái track trước, cánh phải track sau)
   - Đóng: mỗi cánh phủ nửa tủ
   - Mở: trượt sang nửa bên kia (chui sau cánh kia) — đúng giống cabinet thuốc thật
   - Khi đóng, kính raycast → ép user phải click mở cửa rồi mới gắp được thuốc bên trong */
function CabinetDoor({
  side,
  cy,
  cabinetWidth,
  cabinetHeight
}: {
  side: "left" | "right";
  cy: number;
  cabinetWidth: number;
  cabinetHeight: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  // doorW lớn hơn nửa tủ ~0.05 để 2 cánh CHỒNG NHAU ở giữa khi đóng → kín hoàn toàn
  const doorW = cabinetWidth / 2 - 0.05;
  const doorH = cabinetHeight - 0.2;
  // tâm cánh đặt sao cho mép trong vượt qua tâm tủ 0.04 → 2 cánh phủ lấp nhau ở giữa
  const overlap = 0.04;
  const closedX = side === "left" ? -doorW / 2 + overlap : doorW / 2 - overlap;
  const openX = -closedX;
  // hai cánh ở 2 mức z khác nhau để có thể trượt chui qua nhau (cánh trái trước)
  const baseZ = side === "left" ? 0.555 : 0.515;

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const target = open ? 1 : 0;
    tRef.current += (target - tRef.current) * Math.min(1, dt * 4.5);
    g.position.x = closedX + (openX - closedX) * tRef.current;
  });

  // tay nắm âm ở mép giữa của cánh (mép quay vào trong cabinet khi đóng)
  const handleX = side === "left" ? doorW / 2 - 0.08 : -doorW / 2 + 0.08;

  const toggle = (e: any) => {
    e.stopPropagation();
    setOpen((o) => !o);
  };
  const onOver = (e: any) => {
    e.stopPropagation();
    setHover(true);
    document.body.style.cursor = "pointer";
  };
  const onOut = (e: any) => {
    e.stopPropagation();
    setHover(false);
    document.body.style.cursor = "default";
  };

  return (
    <group ref={groupRef} position={[closedX, cy, baseZ]}>
      {/* tấm kính — click ANYWHERE = trượt mở; raycast tự nhiên chặn drug click khi đóng */}
      <mesh onPointerOver={onOver} onPointerOut={onOut} onClick={toggle}>
        <boxGeometry args={[doorW, doorH, 0.02]} />
        <meshPhysicalMaterial
          color={hover ? "#bae6fd" : "#e0f2fe"}
          transparent
          opacity={hover ? 0.30 : 0.20}
          roughness={0.05}
          transmission={0.88}
          thickness={0.05}
          ior={1.45}
          metalness={0}
        />
      </mesh>

      {/* khung nhôm 4 cạnh */}
      <mesh position={[0, doorH / 2 - 0.015, 0]}>
        <boxGeometry args={[doorW, 0.03, 0.05]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, -doorH / 2 + 0.015, 0]}>
        <boxGeometry args={[doorW, 0.03, 0.05]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[-doorW / 2 + 0.015, 0, 0]}>
        <boxGeometry args={[0.03, doorH, 0.05]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[doorW / 2 - 0.015, 0, 0]}>
        <boxGeometry args={[0.03, doorH, 0.05]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* tay nắm âm — kiểu cửa lùa Việt Nam */}
      <mesh position={[handleX, 0, 0.027]} onClick={toggle} onPointerOver={onOver} onPointerOut={onOut}>
        <boxGeometry args={[0.06, 0.22, 0.03]} />
        <meshStandardMaterial
          color={hover ? "#fbbf24" : "#cbd5e1"}
          metalness={0.95}
          roughness={0.1}
          emissive={hover ? "#f59e0b" : "#000000"}
          emissiveIntensity={hover ? 0.4 : 0}
        />
      </mesh>
      <mesh position={[handleX, 0, 0.04]}>
        <boxGeometry args={[0.04, 0.18, 0.005]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* hint chỉ hiện khi cửa còn đóng */}
      {!open && (
        <Text
          position={[handleX, -0.32, 0.05]}
          fontSize={0.045}
          color="#0f766e"
          anchorX="center"
          outlineColor="#ffffff"
          outlineWidth={0.005}
        >
          {side === "left" ? "→ trượt mở" : "← trượt mở"}
        </Text>
      )}
    </group>
  );
}

/* Ray dẫn hướng cửa trượt — chi tiết kim loại trên/dưới khung */
function SlidingTracks({ cabinetWidth, cy, cabinetHeight }: { cabinetWidth: number; cy: number; cabinetHeight: number }) {
  const w = cabinetWidth - 0.25;
  const y1 = cy + cabinetHeight / 2 - 0.105;
  const y2 = cy - cabinetHeight / 2 + 0.105;
  return (
    <group>
      {[y1, y2].map((y, i) => (
        <group key={i} position={[0, y, 0]}>
          <mesh position={[0, 0, 0.515]}>
            <boxGeometry args={[w, 0.012, 0.025]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.555]}>
            <boxGeometry args={[w, 0.012, 0.025]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ===================== Quầy + mặt đá ===================== */
/* Quầy đã được đẩy ra xa tủ (z=2.20) để dược sĩ có chỗ đứng phía sau */
const COUNTER_Z = 2.20;
function Counter() {
  return (
    <group>
      {/* thân quầy gỗ óc chó */}
      <mesh position={[0, -0.55, COUNTER_Z]} castShadow receiveShadow>
        <boxGeometry args={[5.4, 0.9, 1.2]} />
        <meshStandardMaterial color="#7c5234" roughness={0.7} />
      </mesh>
      {/* viền chỉ vàng đồng */}
      <mesh position={[0, -0.1, COUNTER_Z + 0.61]}>
        <boxGeometry args={[5.42, 0.02, 0.02]} />
        <meshStandardMaterial color="#d4a373" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.99, COUNTER_Z + 0.61]}>
        <boxGeometry args={[5.42, 0.02, 0.02]} />
        <meshStandardMaterial color="#d4a373" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* mặt đá hoa cương */}
      <mesh position={[0, -0.08, COUNTER_Z]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 0.06, 1.3]} />
        <meshPhysicalMaterial
          color="#f8fafc"
          roughness={0.18}
          clearcoat={0.9}
          clearcoatRoughness={0.1}
          metalness={0.05}
        />
      </mesh>
      {/* gờ trước mặt đá */}
      <mesh position={[0, -0.11, COUNTER_Z + 0.65]}>
        <boxGeometry args={[5.5, 0.04, 0.04]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} />
      </mesh>
    </group>
  );
}

/* ===================== Máy POS – kiểu all-in-one Dual Display =====================
   Giống ảnh user gửi: thân máy đen, 1 màn hình lớn (15") cho dược sĩ + 1 màn
   nhỏ hơn (10") gắn ở mặt sau, lệch sang một bên, cho khách. Chung 1 trụ + đế.
   Có thêm bàn phím rời trước mặt dược sĩ. */
function PosComputer({ onClick }: { onClick: () => void }) {
  const base: [number, number, number] = [1.95, -0.05, COUNTER_Z - 0.12];
  return (
    <group position={base}>
      {/* === ĐẾ chữ T === */}
      <mesh position={[0, 0.025, 0]} castShadow>
        <boxGeometry args={[0.50, 0.04, 0.42]} />
        <meshStandardMaterial color="#0f172a" metalness={0.35} roughness={0.45} />
      </mesh>
      {/* viền dưới đế */}
      <mesh position={[0, 0.005, 0]} castShadow>
        <boxGeometry args={[0.52, 0.012, 0.44]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* === TRỤ trung tâm === */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.08, 0.32, 0.08]} />
        <meshStandardMaterial color="#0f172a" metalness={0.35} roughness={0.45} />
      </mesh>
      {/* khớp xoay trụ */}
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.07, 24]} />
        <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* === MÀN HÌNH CHÍNH (15") cho DƯỢC SĨ === – mặt -z, hơi nghiêng ngửa */}
      <group position={[0, 0.58, -0.08]} rotation={[0.05, Math.PI, 0]}>
        {/* viền monitor */}
        <mesh castShadow>
          <boxGeometry args={[0.92, 0.62, 0.06]} />
          <meshStandardMaterial color="#0a0f1c" metalness={0.55} roughness={0.4} />
        </mesh>
        {/* dải viền dày dưới (bezel logo) */}
        <mesh position={[0, -0.27, 0.001]}>
          <boxGeometry args={[0.92, 0.06, 0.061]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {/* logo nhỏ */}
        <Text position={[0, -0.27, 0.034]} fontSize={0.025} color="#94a3b8" anchorX="center">
          PHARMA POS · 15.6"
        </Text>
        {/* màn hình – clickable */}
        <mesh position={[0, 0.025, 0.032]} onClick={onClick}>
          <planeGeometry args={[0.86, 0.50]} />
          <meshStandardMaterial color="#0b1220" emissive="#082f49" emissiveIntensity={0.6} />
        </mesh>
        {/* taskbar dưới (Windows-style) */}
        <mesh position={[0, -0.21, 0.033]}>
          <planeGeometry args={[0.86, 0.035]} />
          <meshStandardMaterial color="#1e3a8a" />
        </mesh>
        <Text position={[-0.42, -0.21, 0.034]} fontSize={0.022} color="#ffffff" anchorX="left">
          ⊞ Pharma POS
        </Text>
        <Text position={[0.42, -0.21, 0.034]} fontSize={0.022} color="#cbd5e1" anchorX="right">
          14:35 · 20/11
        </Text>
        {/* thanh tiêu đề chương trình */}
        <mesh position={[0, 0.225, 0.033]}>
          <planeGeometry args={[0.86, 0.05]} />
          <meshStandardMaterial color="#0d9488" />
        </mesh>
        <Text position={[-0.4, 0.225, 0.034]} fontSize={0.026} color="#ffffff" anchorX="left">
          ★ Pharma-POS v1.0
        </Text>
        <Text position={[0.4, 0.225, 0.034]} fontSize={0.022} color="#a7f3d0" anchorX="right">
          ● online · DS001
        </Text>
        {/* nội dung hoá đơn */}
        <Text position={[0, 0.16, 0.034]} fontSize={0.028} color="#e2e8f0" anchorX="center">
          Hoá đơn #20251120-007
        </Text>
        <mesh position={[0, 0.11, 0.034]}>
          <planeGeometry args={[0.78, 0.004]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <Text position={[-0.4, 0.06, 0.034]} fontSize={0.024} color="#94a3b8" anchorX="left">
          Paracetamol 500mg × 1
        </Text>
        <Text position={[0.4, 0.06, 0.034]} fontSize={0.024} color="#e2e8f0" anchorX="right">
          18.000
        </Text>
        <Text position={[-0.4, 0.015, 0.034]} fontSize={0.024} color="#94a3b8" anchorX="left">
          Loratadin 10mg × 1
        </Text>
        <Text position={[0.4, 0.015, 0.034]} fontSize={0.024} color="#e2e8f0" anchorX="right">
          28.000
        </Text>
        <Text position={[-0.4, -0.04, 0.034]} fontSize={0.022} color="#64748b" anchorX="left">
          Tạm tính · 8% VAT
        </Text>
        <Text position={[0.4, -0.04, 0.034]} fontSize={0.022} color="#cbd5e1" anchorX="right">
          49.680
        </Text>
        <Text position={[0, -0.13, 0.034]} fontSize={0.048} color="#22c55e" anchorX="center">
          🛒 NHẤN ĐỂ MỞ POS
        </Text>
      </group>

      {/* === MÀN HÌNH PHỤ cho KHÁCH (CFD ~10") === – gắn ở mặt sau, LỆCH SANG PHẢI (x=+),
          xoay 180° quanh Y để text mặt ra ngoài (+z) */}
      <group position={[0.32, 0.50, 0.10]} rotation={[0.02, 0, 0]}>
        {/* trụ phụ ngắn nối lên màn khách */}
        <mesh position={[-0.18, -0.10, 0]} castShadow>
          <boxGeometry args={[0.04, 0.18, 0.04]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {/* viền monitor CFD */}
        <mesh castShadow>
          <boxGeometry args={[0.56, 0.40, 0.05]} />
          <meshStandardMaterial color="#0a0f1c" metalness={0.55} roughness={0.4} />
        </mesh>
        {/* bezel dưới */}
        <mesh position={[0, -0.17, 0.001]}>
          <boxGeometry args={[0.56, 0.045, 0.051]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {/* màn hình khách – cũng clickable */}
        <mesh position={[0, 0.02, 0.026]} onClick={onClick}>
          <planeGeometry args={[0.52, 0.32]} />
          <meshStandardMaterial color="#0c4a6e" emissive="#0ea5e9" emissiveIntensity={0.5} />
        </mesh>
        {/* tiêu đề */}
        <mesh position={[0, 0.15, 0.027]}>
          <planeGeometry args={[0.52, 0.04]} />
          <meshStandardMaterial color="#0e7490" />
        </mesh>
        <Text position={[0, 0.15, 0.028]} fontSize={0.022} color="#ecfeff" anchorX="center">
          NT THỰC HÀNH – HMC · KHÁCH HÀNG
        </Text>
        <Text position={[0, 0.07, 0.028]} fontSize={0.026} color="#bae6fd" anchorX="center">
          TỔNG TIỀN PHẢI THANH TOÁN
        </Text>
        <Text position={[0, -0.02, 0.028]} fontSize={0.08} color="#fef3c7" anchorX="center">
          49.680 ₫
        </Text>
        <Text position={[0, -0.11, 0.028]} fontSize={0.018} color="#cbd5e1" anchorX="center">
          (đã gồm 8% VAT) — Cảm ơn quý khách!
        </Text>
      </group>

      {/* === BÀN PHÍM của DƯỢC SĨ === – nằm trước máy, phía -z */}
      <group position={[0, 0, -0.32]}>
        <mesh position={[0, 0.015, 0]} rotation={[0.08, 0, 0]} castShadow>
          <boxGeometry args={[0.55, 0.025, 0.20]} />
          <meshStandardMaterial color="#1f2937" roughness={0.55} />
        </mesh>
        {/* mảng phím trắng */}
        <mesh position={[0, 0.029, 0]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.51, 0.005, 0.17]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        {/* lưới phím gợi ý */}
        {Array.from({ length: 5 }).map((_, r) =>
          Array.from({ length: 14 }).map((_, c) => (
            <mesh
              key={`${r}-${c}`}
              position={[-0.235 + c * 0.036, 0.034, -0.062 + r * 0.031]}
              rotation={[0.08, 0, 0]}
              raycast={NULL_RAYCAST as any}
            >
              <boxGeometry args={[0.028, 0.004, 0.022]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
            </mesh>
          ))
        )}
        {/* phím SPACE rộng dưới */}
        <mesh position={[0, 0.034, 0.077]} rotation={[0.08, 0, 0]} raycast={NULL_RAYCAST as any}>
          <boxGeometry args={[0.24, 0.004, 0.022]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
        </mesh>
      </group>
      {/* chuột bên phải (phía dược sĩ) */}
      <mesh position={[0.35, 0.018, -0.32]} castShadow>
        <boxGeometry args={[0.08, 0.028, 0.13]} />
        <meshStandardMaterial color="#1f2937" roughness={0.55} />
      </mesh>
      {/* dây chuột */}
      <mesh position={[0.35, 0.022, -0.25]} rotation={[Math.PI / 2, 0, 0]} raycast={NULL_RAYCAST as any}>
        <cylinderGeometry args={[0.002, 0.002, 0.13, 8]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* máy in nhãn nhiệt – cạnh dược sĩ */}
      <group position={[-0.70, 0.02, -0.16]}>
        <mesh position={[0, 0.10, 0]} castShadow>
          <boxGeometry args={[0.30, 0.20, 0.24]} />
          <meshStandardMaterial color="#1f2937" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.22, -0.06]}>
          <boxGeometry args={[0.24, 0.02, 0.12]} />
          <meshStandardMaterial color="#fafafa" />
        </mesh>
        <mesh position={[0, 0.205, -0.121]}>
          <boxGeometry args={[0.22, 0.005, 0.005]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        <mesh position={[0, 0.05, -0.121]}>
          <circleGeometry args={[0.012, 24]} />
          <meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={0.8} />
        </mesh>
        <Text
          position={[0.03, 0.05, -0.121]}
          rotation={[0, Math.PI, 0]}
          fontSize={0.022}
          color="#a7f3d0"
          anchorX="left"
        >
          PRINTER
        </Text>
      </group>
    </group>
  );
}

/* ===================== Khay dụng cụ ===================== */
function ToolTray({ onClick }: { onClick: () => void }) {
  const base: [number, number, number] = [-1.95, 0.0, COUNTER_Z - 0.10];
  return (
    <group position={base} onClick={onClick}>
      {/* khay nền inox */}
      <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.25, 0.05, 0.6]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.21, 0.005, 0.56]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.5} />
      </mesh>
      <Text
        position={[0, 0.06, -0.35]}
        fontSize={0.055}
        color="#0f766e"
        anchorX="center"
        anchorY="middle"
      >
        KHAY DỤNG CỤ – click để soạn nhãn HDSD
      </Text>

      {/* Kéo */}
      <group position={[-0.45, 0.05, 0.05]} rotation={[0, 0, 0.25]}>
        <mesh position={[0, 0.005, -0.08]} rotation={[0, 0, 0.1]} castShadow>
          <boxGeometry args={[0.04, 0.012, 0.22]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0.03, 0.005, -0.08]} rotation={[0, 0, -0.1]} castShadow>
          <boxGeometry args={[0.04, 0.012, 0.22]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[-0.02, 0.005, 0.06]} castShadow>
          <torusGeometry args={[0.04, 0.012, 12, 24]} />
          <meshStandardMaterial color="#dc2626" roughness={0.4} />
        </mesh>
        <mesh position={[0.05, 0.005, 0.08]} castShadow>
          <torusGeometry args={[0.04, 0.012, 12, 24]} />
          <meshStandardMaterial color="#dc2626" roughness={0.4} />
        </mesh>
      </group>

      {/* Dao cắt vỉ */}
      <group position={[-0.13, 0.06, 0.05]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.05, 0.18]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.04, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.01, 24]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.14, 0.005, 0.005]} />
          <meshStandardMaterial color="#475569" metalness={0.7} />
        </mesh>
      </group>

      {/* Cuộn giấy dính HDSD */}
      <group position={[0.2, 0.07, 0.05]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.1, 32]} />
          <meshStandardMaterial color="#fef3c7" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.051]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.11, 16]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
        <mesh position={[0, -0.09, 0.04]} rotation={[0.2, 0, 0]}>
          <planeGeometry args={[0.14, 0.1]} />
          <meshStandardMaterial color="#fef3c7" side={2} />
        </mesh>
      </group>

      {/* Túi đựng thuốc */}
      <group position={[0.5, 0.05, 0.05]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.008, 0.25]} />
          <meshStandardMaterial color="#ffffff" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.005, 0]}>
          <boxGeometry args={[0.19, 0.001, 0.24]} />
          <meshStandardMaterial color="#f1f5f9" />
        </mesh>
        <Text
          position={[0, 0.007, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.022}
          color="#0f766e"
          anchorX="center"
        >
          NT THỰC HÀNH – HMC
        </Text>
        <Text
          position={[0, 0.007, 0.04]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.012}
          color="#475569"
          anchorX="center"
        >
          Trường Công nghệ – ĐH Kinh tế Quốc dân
        </Text>
      </group>
    </group>
  );
}

/* ===================== Vật trang trí ===================== */
function HandSanitizer({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* thân chai */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.16, 24]} />
        <meshPhysicalMaterial
          color="#bae6fd"
          transparent
          opacity={0.65}
          roughness={0.05}
          transmission={0.9}
          thickness={0.1}
        />
      </mesh>
      {/* dung dịch */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.1, 24]} />
        <meshStandardMaterial color="#0ea5e9" transparent opacity={0.7} />
      </mesh>
      {/* nhãn */}
      <mesh position={[0, 0.08, 0.046]}>
        <planeGeometry args={[0.08, 0.06]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <Text position={[0, 0.09, 0.047]} fontSize={0.015} color="#0c4a6e" anchorX="center">
        SÁT KHUẨN
      </Text>
      <Text position={[0, 0.075, 0.047]} fontSize={0.012} color="#0369a1" anchorX="center">
        Cồn 70°
      </Text>
      {/* vòi bơm */}
      <mesh position={[0, 0.19, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.04, 16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.03, 0.21, 0]} castShadow>
        <boxGeometry args={[0.05, 0.012, 0.02]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* chậu */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.12, 0.2, 24]} />
        <meshStandardMaterial color="#a16207" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.005, 24]} />
        <meshStandardMaterial color="#451a03" roughness={0.9} />
      </mesh>
      {/* lá đơn giản – tán cầu */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial color="#166534" roughness={0.9} />
      </mesh>
      <mesh position={[0.12, 0.55, 0.05]} castShadow>
        <sphereGeometry args={[0.14, 16, 12]} />
        <meshStandardMaterial color="#15803d" roughness={0.9} />
      </mesh>
      <mesh position={[-0.1, 0.58, -0.04]} castShadow>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color="#16a34a" roughness={0.9} />
      </mesh>
    </group>
  );
}

function VaccineFridge({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* thân tủ */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.85, 1.8, 0.7]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* cửa kính */}
      <mesh position={[0, 0.9, 0.36]}>
        <planeGeometry args={[0.78, 1.7]} />
        <meshPhysicalMaterial
          color="#0ea5e9"
          transparent
          opacity={0.25}
          roughness={0.1}
          transmission={0.8}
          thickness={0.05}
        />
      </mesh>
      {/* khung cửa */}
      <mesh position={[0, 0.9, 0.37]}>
        <boxGeometry args={[0.8, 1.74, 0.005]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} transparent opacity={0.0} />
      </mesh>
      {/* tay nắm */}
      <mesh position={[0.35, 0.9, 0.38]} castShadow>
        <boxGeometry args={[0.03, 0.6, 0.04]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* các kệ bên trong */}
      {[0.3, 0.7, 1.1, 1.5].map((y, i) => (
        <group key={i} position={[0, y, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.75, 0.02, 0.55]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          {/* vài hộp/chai vắc-xin */}
          <mesh position={[-0.2, 0.07, 0]} castShadow>
            <boxGeometry args={[0.12, 0.12, 0.08]} />
            <meshStandardMaterial color="#fef3c7" />
          </mesh>
          <mesh position={[0, 0.06, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.1, 16]} />
            <meshStandardMaterial color="#fee2e2" />
          </mesh>
          <mesh position={[0.2, 0.07, 0]} castShadow>
            <boxGeometry args={[0.12, 0.12, 0.08]} />
            <meshStandardMaterial color="#dbeafe" />
          </mesh>
        </group>
      ))}
      {/* bảng điều khiển */}
      <mesh position={[0, 1.7, 0.36]}>
        <boxGeometry args={[0.3, 0.08, 0.01]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <Text position={[0, 1.7, 0.37]} fontSize={0.04} color="#22d3ee" anchorX="center">
        2 – 8 °C
      </Text>
      <Text position={[0, 0.05, 0.36]} fontSize={0.04} color="#0f766e" anchorX="center">
        TỦ LẠNH VẮC-XIN
      </Text>
    </group>
  );
}

function ACUnit({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 0.4, 0.32]} />
        <meshStandardMaterial color="#fafafa" roughness={0.4} />
      </mesh>
      {/* lưới gió */}
      <mesh position={[0, -0.18, 0.16]}>
        <boxGeometry args={[1.4, 0.06, 0.02]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      {/* logo */}
      <Text position={[0.6, -0.05, 0.165]} fontSize={0.05} color="#64748b" anchorX="right">
        AIR · INVERTER
      </Text>
      <mesh position={[-0.6, 0.12, 0.165]}>
        <circleGeometry args={[0.018, 16]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function CrossSign({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* chân giá */}
      <mesh position={[0, -0.05, -0.04]} castShadow>
        <boxGeometry args={[0.05, 0.1, 0.05]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* hộp đèn chữ thập */}
      <mesh>
        <boxGeometry args={[0.6, 0.6, 0.08]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[0.55, 0.16]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.046]}>
        <planeGeometry args={[0.16, 0.55]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

function Poster({
  position,
  rotationY = 0,
  title,
  subtitle,
  bg
}: {
  position: [number, number, number];
  rotationY?: number;
  title: string;
  subtitle: string;
  bg: string;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* khung */}
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.84, 0.03]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.6} />
      </mesh>
      {/* nội dung */}
      <mesh position={[0, 0, 0.016]}>
        <planeGeometry args={[1.1, 0.74]} />
        <meshStandardMaterial color={bg} />
      </mesh>
      <Text
        position={[0, 0.22, 0.018]}
        fontSize={0.09}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.0}
        textAlign="center"
      >
        {title}
      </Text>
      <Text
        position={[0, 0.0, 0.018]}
        fontSize={0.045}
        color="#fef3c7"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.0}
        textAlign="center"
      >
        {subtitle}
      </Text>
      {/* icon viên thuốc */}
      <group position={[0, -0.22, 0.018]}>
        <mesh>
          <capsuleGeometry args={[0.06, 0.16, 8, 16]} />
          <meshStandardMaterial color="#fee2e2" />
        </mesh>
      </group>
    </group>
  );
}

function WaitingChair({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* khung 3 ghế */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.8, 0.05, 0.45]} />
        <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* ngồi */}
      {[-0.6, 0, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.48, 0]} castShadow>
          <boxGeometry args={[0.55, 0.03, 0.4]} />
          <meshStandardMaterial color="#0ea5e9" roughness={0.7} />
        </mesh>
      ))}
      {/* tựa */}
      {[-0.6, 0, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.78, -0.2]} castShadow>
          <boxGeometry args={[0.55, 0.4, 0.04]} />
          <meshStandardMaterial color="#0ea5e9" roughness={0.7} />
        </mesh>
      ))}
      {/* chân */}
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 0.22, 0]} castShadow>
          <boxGeometry args={[0.05, 0.45, 0.45]} />
          <meshStandardMaterial color="#334155" metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/* Quạt trần XOAY – animation thật (useFrame) cho sinh động */
function CeilingFan({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 4.5;
  });
  return (
    <group position={position}>
      {/* thanh treo từ trần xuống */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.36, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* hub động cơ */}
      <mesh>
        <cylinderGeometry args={[0.13, 0.16, 0.10, 24]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.14, 0.13, 0.04, 24]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* 4 cánh quạt – group xoay */}
      <group ref={ref}>
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((a, i) => (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[0.55, -0.02, 0]} rotation={[0.18, 0, 0]} castShadow>
              <boxGeometry args={[0.85, 0.018, 0.20]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.6} />
            </mesh>
            {/* gân cánh */}
            <mesh position={[0.55, -0.025, 0]} rotation={[0.18, 0, 0]}>
              <boxGeometry args={[0.85, 0.002, 0.015]} />
              <meshStandardMaterial color="#cbd5e1" />
            </mesh>
          </group>
        ))}
      </group>
      {/* chao đèn dưới hub */}
      <mesh position={[0, -0.12, 0]}>
        <sphereGeometry args={[0.09, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#fef9c3"
          emissive="#fde68a"
          emissiveIntensity={0.55}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}

function CeilingLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.2, 0.03, 0.4]} />
        <meshStandardMaterial color="#ffffff" emissive="#fef9c3" emissiveIntensity={1.3} />
      </mesh>
    </group>
  );
}

/* ===================== Sàn – gạch lát ===================== */
function TileFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.0, 0]} receiveShadow>
      <planeGeometry args={[26, 22]} />
      <MeshReflectorMaterial
        color="#e7e5e4"
        roughness={0.65}
        metalness={0.1}
        blur={[400, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={1.2}
        mirror={0.35}
        depthScale={0.6}
        minDepthThreshold={0.4}
        maxDepthThreshold={1}
      />
    </mesh>
  );
}

/* ===================== Tường ===================== */
function Walls() {
  return (
    <group>
      {/* tường sau */}
      <mesh position={[0, 2.6, -1.4]} receiveShadow>
        <boxGeometry args={[18, 7.2, 0.1]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.95} />
      </mesh>
      {/* nẹp chân tường */}
      <mesh position={[0, -0.85, -1.34]}>
        <boxGeometry args={[18, 0.2, 0.04]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      {/* tường trái */}
      <mesh position={[-7, 2.6, 3]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[10, 7.2, 0.1]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.95} />
      </mesh>
      {/* tường phải */}
      <mesh position={[7, 2.6, 3]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[10, 7.2, 0.1]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.95} />
      </mesh>
      {/* trần */}
      <mesh position={[0, 6.2, 3]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
    </group>
  );
}

/* ===================== Nhân vật ===================== */
function Person({
  position,
  rotationY = 0,
  shirtColor,
  pantsColor,
  hairColor = "#1c1917",
  skinColor = "#fde68a",
  label,
  labelColor = "#0f172a",
  speech,
  bubbleColor = "#ffffff",
  bubbleAccent = "#fbbf24",
  hasCoat = false,
  ponytail = false,
  glasses = false,
  bobSpeed = 1.2,
  bobAmount = 0.015
}: {
  position: [number, number, number];
  rotationY?: number;
  shirtColor: string;
  pantsColor: string;
  hairColor?: string;
  skinColor?: string;
  label: string;
  labelColor?: string;
  speech?: string;
  bubbleColor?: string;
  bubbleAccent?: string;
  hasCoat?: boolean;
  ponytail?: boolean;
  glasses?: boolean;
  bobSpeed?: number;
  bobAmount?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(t * bobSpeed) * bobAmount;
    }
    // đầu lắc nhẹ
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.7) * 0.08;
      headRef.current.rotation.z = Math.sin(t * 0.5) * 0.02;
    }
  });

  const skinDark = "#d97706"; // bóng da
  const lipColor = "#be185d";

  return (
    <group ref={ref} position={position} rotation={[0, rotationY, 0]} scale={1.18}>
      {/* === CHÂN === */}
      <mesh position={[-0.085, 0.35, 0]} castShadow raycast={NULL_RAYCAST as any}>
        <cylinderGeometry args={[0.062, 0.055, 0.7, 14]} />
        <meshStandardMaterial color={pantsColor} roughness={0.85} />
      </mesh>
      <mesh position={[0.085, 0.35, 0]} castShadow raycast={NULL_RAYCAST as any}>
        <cylinderGeometry args={[0.062, 0.055, 0.7, 14]} />
        <meshStandardMaterial color={pantsColor} roughness={0.85} />
      </mesh>
      {/* giày da */}
      <mesh position={[-0.085, 0.025, 0.04]} castShadow raycast={NULL_RAYCAST as any}>
        <boxGeometry args={[0.12, 0.055, 0.22]} />
        <meshStandardMaterial color="#1c1917" roughness={0.45} metalness={0.15} />
      </mesh>
      <mesh position={[0.085, 0.025, 0.04]} castShadow raycast={NULL_RAYCAST as any}>
        <boxGeometry args={[0.12, 0.055, 0.22]} />
        <meshStandardMaterial color="#1c1917" roughness={0.45} metalness={0.15} />
      </mesh>

      {/* === THÂN ÁO === (capsule cho mềm hơn) */}
      <mesh position={[0, 0.95, 0]} castShadow raycast={NULL_RAYCAST as any}>
        <capsuleGeometry args={[0.19, 0.4, 10, 18]} />
        <meshStandardMaterial color={shirtColor} roughness={0.78} />
      </mesh>
      {/* vai (hơi rộng hơn) */}
      <mesh position={[0, 1.18, 0]} castShadow raycast={NULL_RAYCAST as any}>
        <sphereGeometry args={[0.22, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={shirtColor} roughness={0.78} />
      </mesh>
      {/* viền cổ áo */}
      <mesh position={[0, 1.18, 0.07]} raycast={NULL_RAYCAST as any}>
        <torusGeometry args={[0.08, 0.012, 8, 24, Math.PI]} />
        <meshStandardMaterial color="#1f2937" roughness={0.6} />
      </mesh>

      {/* === ÁO BLU DƯỢC SĨ === – dài quá hông, V-cổ với 2 lapel, hàng nút bạc */}
      {hasCoat && (
        <>
          {/* vạt áo thân dài hơn (knee-length blouse) */}
          <mesh position={[0, 0.6, 0.001]} castShadow raycast={NULL_RAYCAST as any}>
            <cylinderGeometry args={[0.235, 0.225, 1.30, 24, 1, true, -Math.PI / 2 - 0.42, Math.PI + 0.84]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} metalness={0.02} side={2} />
          </mesh>
          {/* mặt sau áo blu (mảng kín phía sau) – cho cảm giác đầy đặn */}
          <mesh position={[0, 0.6, -0.06]} castShadow raycast={NULL_RAYCAST as any}>
            <cylinderGeometry args={[0.232, 0.222, 1.30, 22, 1, true, Math.PI / 2 + 0.42, Math.PI - 0.84]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.6} side={2} />
          </mesh>
          {/* lapel trái – tam giác trắng nhô ra V-cổ */}
          <mesh
            position={[-0.075, 1.0, 0.205]}
            rotation={[0, 0, -0.55]}
            raycast={NULL_RAYCAST as any}
          >
            <planeGeometry args={[0.13, 0.32]} />
            <meshStandardMaterial color="#ffffff" roughness={0.55} side={2} />
          </mesh>
          {/* lapel phải */}
          <mesh
            position={[0.075, 1.0, 0.205]}
            rotation={[0, 0, 0.55]}
            raycast={NULL_RAYCAST as any}
          >
            <planeGeometry args={[0.13, 0.32]} />
            <meshStandardMaterial color="#ffffff" roughness={0.55} side={2} />
          </mesh>
          {/* viền cổ chữ V đen */}
          <mesh position={[-0.05, 1.10, 0.21]} rotation={[0, 0, -0.55]} raycast={NULL_RAYCAST as any}>
            <planeGeometry args={[0.008, 0.32]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[0.05, 1.10, 0.21]} rotation={[0, 0, 0.55]} raycast={NULL_RAYCAST as any}>
            <planeGeometry args={[0.008, 0.32]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* hàng nút áo (5 nút bạc dọc) */}
          {[0.95, 0.78, 0.61, 0.44, 0.27, 0.10].map((y, i) => (
            <mesh key={i} position={[0, y, 0.22]} raycast={NULL_RAYCAST as any}>
              <cylinderGeometry args={[0.013, 0.013, 0.006, 16]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.25} />
            </mesh>
          ))}
          {/* túi áo ngực trái */}
          <mesh position={[-0.135, 0.78, 0.225]} raycast={NULL_RAYCAST as any}>
            <planeGeometry args={[0.15, 0.14]} />
            <meshStandardMaterial color="#f1f5f9" />
          </mesh>
          {/* viền túi */}
          <mesh position={[-0.135, 0.85, 0.226]} raycast={NULL_RAYCAST as any}>
            <planeGeometry args={[0.15, 0.006]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          {/* bút trong túi */}
          <mesh position={[-0.165, 0.81, 0.227]} rotation={[0, 0, -0.05]} raycast={NULL_RAYCAST as any}>
            <cylinderGeometry args={[0.008, 0.008, 0.10, 12]} />
            <meshStandardMaterial color="#0f766e" />
          </mesh>
          {/* túi dưới to – bên trái */}
          <mesh position={[-0.13, 0.38, 0.222]} raycast={NULL_RAYCAST as any}>
            <planeGeometry args={[0.17, 0.18]} />
            <meshStandardMaterial color="#f1f5f9" />
          </mesh>
          <mesh position={[-0.13, 0.47, 0.223]} raycast={NULL_RAYCAST as any}>
            <planeGeometry args={[0.17, 0.005]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          {/* túi dưới to – bên phải */}
          <mesh position={[0.13, 0.38, 0.222]} raycast={NULL_RAYCAST as any}>
            <planeGeometry args={[0.17, 0.18]} />
            <meshStandardMaterial color="#f1f5f9" />
          </mesh>
          <mesh position={[0.13, 0.47, 0.223]} raycast={NULL_RAYCAST as any}>
            <planeGeometry args={[0.17, 0.005]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          {/* thẻ tên */}
          <mesh position={[0.13, 1.08, 0.225]} raycast={NULL_RAYCAST as any}>
            <planeGeometry args={[0.16, 0.09]} />
            <meshStandardMaterial color="#fef3c7" />
          </mesh>
          <mesh position={[0.13, 1.11, 0.226]} raycast={NULL_RAYCAST as any}>
            <planeGeometry args={[0.16, 0.022]} />
            <meshStandardMaterial color="#0f766e" />
          </mesh>
          <Text
            position={[0.13, 1.11, 0.228]}
            fontSize={0.014}
            color="#ffffff"
            anchorX="center"
          >
            DƯỢC SĨ
          </Text>
          <Text
            position={[0.13, 1.075, 0.228]}
            fontSize={0.014}
            color="#7c2d12"
            anchorX="center"
          >
            Pharm.D
          </Text>
          {/* ống nghe quanh cổ – 2 nhánh xuống */}
          <mesh position={[0, 1.18, 0.18]} rotation={[Math.PI / 2, 0, 0]} raycast={NULL_RAYCAST as any}>
            <torusGeometry args={[0.095, 0.013, 8, 24, Math.PI]} />
            <meshStandardMaterial color="#0f172a" roughness={0.6} />
          </mesh>
          <mesh position={[-0.085, 1.08, 0.18]} raycast={NULL_RAYCAST as any}>
            <cylinderGeometry args={[0.012, 0.012, 0.18, 8]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0.085, 1.08, 0.18]} raycast={NULL_RAYCAST as any}>
            <cylinderGeometry args={[0.012, 0.012, 0.18, 8]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          {/* đầu chuông ống nghe */}
          <mesh position={[0, 0.93, 0.21]} rotation={[Math.PI / 2, 0, 0]} raycast={NULL_RAYCAST as any}>
            <cylinderGeometry args={[0.035, 0.035, 0.012, 24]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
          </mesh>
        </>
      )}

      {/* === TAY === */}
      <mesh
        position={[-0.255, 0.95, 0]}
        rotation={[0, 0, 0.14]}
        castShadow
        raycast={NULL_RAYCAST as any}
      >
        <capsuleGeometry args={[0.052, 0.42, 8, 14]} />
        <meshStandardMaterial color={hasCoat ? "#ffffff" : shirtColor} roughness={0.75} />
      </mesh>
      <mesh
        position={[0.255, 0.95, 0]}
        rotation={[0, 0, -0.14]}
        castShadow
        raycast={NULL_RAYCAST as any}
      >
        <capsuleGeometry args={[0.052, 0.42, 8, 14]} />
        <meshStandardMaterial color={hasCoat ? "#ffffff" : shirtColor} roughness={0.75} />
      </mesh>
      {/* bàn tay */}
      <mesh position={[-0.295, 0.65, 0]} castShadow raycast={NULL_RAYCAST as any}>
        <sphereGeometry args={[0.06, 14, 12]} />
        <meshStandardMaterial color={skinColor} roughness={0.85} />
      </mesh>
      <mesh position={[0.295, 0.65, 0]} castShadow raycast={NULL_RAYCAST as any}>
        <sphereGeometry args={[0.06, 14, 12]} />
        <meshStandardMaterial color={skinColor} roughness={0.85} />
      </mesh>
      {/* ngón cái */}
      <mesh position={[-0.255, 0.685, 0.04]} castShadow raycast={NULL_RAYCAST as any}>
        <sphereGeometry args={[0.022, 10, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.85} />
      </mesh>
      <mesh position={[0.255, 0.685, 0.04]} castShadow raycast={NULL_RAYCAST as any}>
        <sphereGeometry args={[0.022, 10, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.85} />
      </mesh>

      {/* === CỔ === */}
      <mesh position={[0, 1.26, 0]} castShadow raycast={NULL_RAYCAST as any}>
        <cylinderGeometry args={[0.055, 0.07, 0.1, 14]} />
        <meshStandardMaterial color={skinColor} roughness={0.85} />
      </mesh>

      {/* === ĐẦU === */}
      <group ref={headRef} position={[0, 1.42, 0]}>
        {/* khuôn mặt (hơi oval) */}
        <mesh castShadow raycast={NULL_RAYCAST as any} scale={[1, 1.1, 0.95]}>
          <sphereGeometry args={[0.145, 26, 24]} />
          <meshStandardMaterial color={skinColor} roughness={0.75} />
        </mesh>
        {/* tai trái */}
        <mesh position={[-0.142, -0.01, 0]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.034, 14, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.85} />
        </mesh>
        <mesh position={[-0.149, -0.012, 0]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.018, 10, 8]} />
          <meshStandardMaterial color={skinDark} roughness={0.9} />
        </mesh>
        {/* tai phải */}
        <mesh position={[0.142, -0.01, 0]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.034, 14, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.85} />
        </mesh>
        <mesh position={[0.149, -0.012, 0]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.018, 10, 8]} />
          <meshStandardMaterial color={skinDark} roughness={0.9} />
        </mesh>

        {/* tóc — phần trên đầu */}
        <mesh position={[0, 0.035, -0.005]} raycast={NULL_RAYCAST as any} scale={[1.02, 1.0, 1.05]}>
          <sphereGeometry
            args={[0.152, 26, 24, 0, Math.PI * 2, 0, Math.PI / 1.65]}
          />
          <meshStandardMaterial color={hairColor} roughness={0.95} />
        </mesh>
        {/* mái trước (fringe) — chếch sang một bên */}
        <mesh position={[-0.025, 0.085, 0.118]} rotation={[0.15, 0, -0.2]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.082, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
          <meshStandardMaterial color={hairColor} roughness={0.95} />
        </mesh>

        {/* tóc ngang vai (cho bệnh nhân nữ) */}
        {ponytail && (
          <>
            <mesh position={[-0.115, -0.07, -0.005]} raycast={NULL_RAYCAST as any}>
              <capsuleGeometry args={[0.05, 0.16, 8, 14]} />
              <meshStandardMaterial color={hairColor} roughness={0.95} />
            </mesh>
            <mesh position={[0.115, -0.07, -0.005]} raycast={NULL_RAYCAST as any}>
              <capsuleGeometry args={[0.05, 0.16, 8, 14]} />
              <meshStandardMaterial color={hairColor} roughness={0.95} />
            </mesh>
            <mesh position={[0, -0.06, -0.105]} raycast={NULL_RAYCAST as any}>
              <sphereGeometry args={[0.115, 18, 14, 0, Math.PI * 2, 0, Math.PI / 1.5]} />
              <meshStandardMaterial color={hairColor} roughness={0.95} />
            </mesh>
          </>
        )}

        {/* lông mày */}
        <mesh position={[-0.055, 0.04, 0.13]} rotation={[0, 0, 0.15]} raycast={NULL_RAYCAST as any}>
          <boxGeometry args={[0.05, 0.011, 0.005]} />
          <meshStandardMaterial color={hairColor} />
        </mesh>
        <mesh position={[0.055, 0.04, 0.13]} rotation={[0, 0, -0.15]} raycast={NULL_RAYCAST as any}>
          <boxGeometry args={[0.05, 0.011, 0.005]} />
          <meshStandardMaterial color={hairColor} />
        </mesh>

        {/* tròng trắng */}
        <mesh position={[-0.05, 0.01, 0.13]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.022, 14, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.05, 0.01, 0.13]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.022, 14, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        {/* con ngươi */}
        <mesh position={[-0.05, 0.01, 0.148]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.012, 10, 10]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0.05, 0.01, 0.148]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.012, 10, 10]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {/* hi-light mắt */}
        <mesh position={[-0.046, 0.014, 0.156]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.004, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.054, 0.014, 0.156]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.004, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>

        {/* kính (cho dược sĩ) */}
        {glasses && (
          <>
            <mesh position={[-0.05, 0.01, 0.16]} rotation={[Math.PI / 2, 0, 0]} raycast={NULL_RAYCAST as any}>
              <torusGeometry args={[0.032, 0.005, 8, 24]} />
              <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0.05, 0.01, 0.16]} rotation={[Math.PI / 2, 0, 0]} raycast={NULL_RAYCAST as any}>
              <torusGeometry args={[0.032, 0.005, 8, 24]} />
              <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.01, 0.16]} raycast={NULL_RAYCAST as any}>
              <boxGeometry args={[0.04, 0.005, 0.005]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          </>
        )}

        {/* mũi */}
        <mesh position={[0, -0.015, 0.148]} rotation={[Math.PI / 2, 0, 0]} raycast={NULL_RAYCAST as any}>
          <coneGeometry args={[0.018, 0.05, 12]} />
          <meshStandardMaterial color={skinDark} roughness={0.85} />
        </mesh>

        {/* môi trên */}
        <mesh position={[0, -0.058, 0.138]} raycast={NULL_RAYCAST as any}>
          <boxGeometry args={[0.055, 0.008, 0.005]} />
          <meshStandardMaterial color={lipColor} />
        </mesh>
        {/* cười nhẹ – môi dưới hơi cong */}
        <mesh position={[0, -0.07, 0.138]} rotation={[0, 0, 0]} raycast={NULL_RAYCAST as any}>
          <torusGeometry args={[0.022, 0.005, 8, 16, Math.PI]} />
          <meshStandardMaterial color={lipColor} />
        </mesh>

        {/* má hồng */}
        <mesh position={[-0.085, -0.04, 0.115]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.025, 10, 10]} />
          <meshStandardMaterial color="#fda4af" transparent opacity={0.45} />
        </mesh>
        <mesh position={[0.085, -0.04, 0.115]} raycast={NULL_RAYCAST as any}>
          <sphereGeometry args={[0.025, 10, 10]} />
          <meshStandardMaterial color="#fda4af" transparent opacity={0.45} />
        </mesh>
      </group>

      {/* tên dưới chân */}
      <Text
        position={[0, -0.05, 0.3]}
        fontSize={0.085}
        color={labelColor}
        outlineColor="#ffffff"
        outlineWidth={0.01}
        anchorX="center"
      >
        {label}
      </Text>

      {/* === BUBBLE THOẠI – ANCHOR TỪ ĐÁY ===
          KHÔNG dùng `center`. Đặt position y=1.62 (ngay trên đỉnh đầu) và div
          dùng `translate(-50%, -100%)` để mép DƯỚI của BUBBLE BODY luôn ở Y này.
          Tail nhô xuống 18px → tail tip vừa chạm đỉnh đầu nhân vật bất kể text dài/ngắn. */}
      {speech && (
        <Html
          position={[0, 1.62, 0]}
          distanceFactor={5}
          zIndexRange={[20, 0]}
          pointerEvents="none"
          style={{ pointerEvents: "none" }}
        >
          <div style={{ transform: "translate(-50%, -100%)" }}>
            <ComicBubble text={speech} fill={bubbleColor} accent={bubbleAccent} />
          </div>
        </Html>
      )}
    </group>
  );
}

/* ===================== ModelObject (GLB tĩnh) =====================
   Cho cây cảnh, ghế chờ, tủ lạnh, v.v. Load GLB qua useGLTF + clone scene
   để có thể đặt nhiều instance cùng URL mà không conflict. */
function ModelObject({
  url,
  position,
  rotationY = 0,
  scale = 1,
  raycast = false
}: {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number | [number, number, number];
  raycast?: boolean;
}) {
  const { scene } = useGLTF(url) as any;
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (!raycast) o.raycast = NULL_RAYCAST;
      }
    });
  }, [cloned, raycast]);

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={typeof scale === "number" ? [scale, scale, scale] : scale}
    >
      <primitive object={cloned} />
    </group>
  );
}

/* ===================== ModelCharacter (GLB) =====================
   Tải model GLB người Việt thật từ public/models/* (rigged, có thể có animation).
   Có nhãn tên + bubble truyện tranh anchor đúng đỉnh đầu. */
function ModelCharacter({
  url,
  position,
  rotationY = 0,
  scale = 1,
  label,
  labelColor = "#0f172a",
  speech,
  bubbleColor = "#ffffff",
  bubbleAccent = "#fbbf24",
  bubbleY = 1.95,
  wearCoat = false
}: {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  label: string;
  labelColor?: string;
  speech?: string;
  bubbleColor?: string;
  bubbleAccent?: string;
  bubbleY?: number;
  wearCoat?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url) as any;
  const { actions } = useAnimations(animations || [], groupRef);

  useEffect(() => {
    if (!actions) return;
    const keys = Object.keys(actions);
    if (!keys.length) return;
    // Ưu tiên clip Idle/Stand thay vì clip đầu tiên (tránh chọn nhầm Walking/Dance)
    const idleKey =
      keys.find((k) => /idle|stand/i.test(k)) ||
      keys.find((k) => !/walk|run|dance|jump|jog|fall/i.test(k)) ||
      keys[0];
    const idle = actions[idleKey];
    if (!idle) return;
    // Idle nên chạy chậm và mượt, không bay nhảy
    idle.timeScale = 0.7;
    idle.reset().fadeIn(0.4).play();
    return () => {
      idle?.fadeOut(0.2).stop();
    };
  }, [actions]);

  // bóng đổ trên các mesh
  useEffect(() => {
    if (!scene) return;
    scene.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.raycast = NULL_RAYCAST;
      }
    });
  }, [scene]);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={scene} />

      {/* Áo blu trắng đắp lên model dược sĩ – kiểu vest dài, thẻ tên, ống nghe */}
      {wearCoat && (
        <group>
          {/* thân áo blu (cylinder ôm thân, dài tới đùi) */}
          <mesh position={[0, 1.05, 0.05]} castShadow>
            <cylinderGeometry args={[0.32, 0.34, 1.10, 20, 1, true, -Math.PI / 2 - 0.4, Math.PI + 0.8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} side={2} />
          </mesh>
          {/* mặt lưng áo */}
          <mesh position={[0, 1.05, -0.05]} castShadow>
            <cylinderGeometry args={[0.32, 0.34, 1.10, 20, 1, true, Math.PI / 2 + 0.4, Math.PI - 0.8]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.55} side={2} />
          </mesh>
          {/* hàng nút áo */}
          {[1.40, 1.20, 1.00, 0.80, 0.60].map((y, i) => (
            <mesh key={i} position={[0, y, 0.32]}>
              <sphereGeometry args={[0.018, 12, 12]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.25} />
            </mesh>
          ))}
          {/* lapel V-cổ trái */}
          <mesh position={[-0.10, 1.50, 0.31]} rotation={[0, 0, -0.55]}>
            <planeGeometry args={[0.16, 0.28]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} side={2} />
          </mesh>
          {/* lapel V-cổ phải */}
          <mesh position={[0.10, 1.50, 0.31]} rotation={[0, 0, 0.55]}>
            <planeGeometry args={[0.16, 0.28]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} side={2} />
          </mesh>
          {/* túi ngực trái */}
          <mesh position={[-0.16, 1.18, 0.33]}>
            <planeGeometry args={[0.16, 0.14]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          {/* bút trong túi */}
          <mesh position={[-0.20, 1.22, 0.34]} rotation={[0, 0, -0.1]}>
            <cylinderGeometry args={[0.01, 0.01, 0.10, 12]} />
            <meshStandardMaterial color="#0d9488" />
          </mesh>
          {/* thẻ tên DƯỢC SĨ */}
          <mesh position={[0.18, 1.46, 0.33]}>
            <planeGeometry args={[0.18, 0.09]} />
            <meshStandardMaterial color="#fef3c7" />
          </mesh>
          <mesh position={[0.18, 1.49, 0.331]}>
            <planeGeometry args={[0.18, 0.025]} />
            <meshStandardMaterial color="#0f766e" />
          </mesh>
          <Text
            position={[0.18, 1.49, 0.333]}
            fontSize={0.018}
            color="#ffffff"
            anchorX="center"
          >
            DƯỢC SĨ
          </Text>
          <Text
            position={[0.18, 1.455, 0.333]}
            fontSize={0.018}
            color="#7c2d12"
            anchorX="center"
          >
            Pharm.D
          </Text>
          {/* ống nghe quanh cổ */}
          <mesh position={[0, 1.62, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.12, 0.014, 8, 24, Math.PI]} />
            <meshStandardMaterial color="#0f172a" roughness={0.55} />
          </mesh>
          <mesh position={[-0.10, 1.50, 0.27]}>
            <cylinderGeometry args={[0.012, 0.012, 0.20, 8]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0.10, 1.50, 0.27]}>
            <cylinderGeometry args={[0.012, 0.012, 0.20, 8]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, 1.35, 0.30]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.015, 24]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      )}

      <Text
        position={[0, -0.05, 0.45]}
        fontSize={0.085}
        color={labelColor}
        outlineColor="#ffffff"
        outlineWidth={0.01}
        anchorX="center"
      >
        {label}
      </Text>
      {speech && (
        <Html
          position={[0, bubbleY, 0]}
          distanceFactor={5}
          zIndexRange={[20, 0]}
          pointerEvents="none"
          style={{ pointerEvents: "none" }}
        >
          <div style={{ transform: "translate(-50%, -100%)" }}>
            <ComicBubble text={speech} fill={bubbleColor} accent={bubbleAccent} />
          </div>
        </Html>
      )}
    </group>
  );
}

/* Bubble truyện tranh:
   - Rộng ngang (maxWidth 380), font comic, viền đen 3px, đổ bóng hard 6px
   - Đuôi NGẮN (~18-22px) — mép dưới div được anchor cách đỉnh đầu chỉ vài pixel
     nhờ translate(-50%, -100%) ở wrapper, nên tail tip vừa CHẠM đỉnh đầu */
function ComicBubble({ text, fill, accent }: { text: string; fill: string; accent: string }) {
  return (
    <div
      style={{
        position: "relative",
        background: fill,
        border: "3px solid #0f172a",
        borderRadius: "32px / 38px",
        padding: "12px 22px 14px",
        fontFamily:
          "'Bangers','Comic Sans MS','Marker Felt','Chalkboard SE',cursive,sans-serif",
        fontWeight: 700,
        fontSize: 15,
        lineHeight: 1.32,
        color: "#0f172a",
        maxWidth: 380,
        minWidth: 160,
        width: "max-content",
        textAlign: "center",
        letterSpacing: 0.3,
        boxShadow: "6px 6px 0 #0f172a",
        transform: "rotate(-1.5deg)",
        userSelect: "none"
      }}
    >
      {/* dải accent ở mép trên */}
      <div
        style={{
          position: "absolute",
          top: -3,
          left: 18,
          right: 18,
          height: 5,
          background: accent,
          borderRadius: 4,
          opacity: 0.9
        }}
      />
      {text}
      {/* đuôi đen – lớp ngoài (ngắn, ~22px) */}
      <div
        style={{
          position: "absolute",
          bottom: -20,
          left: "50%",
          transform: "translateX(-50%) rotate(-6deg)",
          width: 0,
          height: 0,
          borderLeft: "12px solid transparent",
          borderRight: "9px solid transparent",
          borderTop: "22px solid #0f172a"
        }}
      />
      {/* đuôi màu – lớp trong (lệch để lộ viền) */}
      <div
        style={{
          position: "absolute",
          bottom: -14,
          left: "50%",
          transform: "translateX(-50%) rotate(-6deg)",
          width: 0,
          height: 0,
          borderLeft: "9px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: `16px solid ${fill}`
        }}
      />
    </div>
  );
}

/* ===================== Scene chính ===================== */
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

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        cursor: pendingLabel ? "crosshair" : "default"
      }}
    >
      <Canvas
        shadows
        camera={{ position: [0, 2.8, 9.0], fov: 48 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#e6efe9"]} />
        <fog attach="fog" args={["#e6efe9", 12, 22]} />

        <SoftShadows size={28} samples={12} focus={0.6} />

        {/* Ánh sáng tổng + nắng giả qua cửa sổ */}
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#ffffff", "#cbd5e1", 0.45]} />
        <directionalLight
          position={[6, 8, 5]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0002}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <directionalLight position={[-5, 4, 3]} intensity={0.35} color="#bae6fd" />

        {/* Đèn trần spotlight phía trên tủ */}
        <spotLight
          position={[0, 5.5, 2]}
          angle={0.6}
          penumbra={0.7}
          intensity={1.0}
          color="#fff7ed"
          castShadow
        />

        <Environment preset="city" />

        {/* Room */}
        <Walls />
        <TileFloor />

        {/* đèn LED trên trần */}
        <CeilingLight position={[-2.5, 5.95, 1.5]} />
        <CeilingLight position={[2.5, 5.95, 1.5]} />

        {/* Quạt trần xoay – chính giữa */}
        <CeilingFan position={[0, 5.55, 2.5]} />

        {/* Biển chữ thập xanh trên đầu cabinet (đã hạ thấp theo tủ mới) */}
        <CrossSign position={[-4.0, 3.4, -1.25]} />
        <CrossSign position={[4.0, 3.4, -1.25]} />

        {/* Poster */}
        <Poster
          position={[-5.6, 2.2, -1.3]}
          title="DÙNG KHÁNG SINH"
          subtitle="ĐÚNG – ĐỦ – AN TOÀN"
          bg="#dc2626"
        />
        <Poster
          position={[5.6, 2.2, -1.3]}
          title="ĐO HUYẾT ÁP"
          subtitle="MIỄN PHÍ – TẠI QUẦY"
          bg="#0d9488"
        />

        {/* Cabinet + khung kệ */}
        <Cabinet>
          {DRUGS.map((d, idx) => (
            <Compartment key={d.id} drug={d} col={idx % COLS} row={Math.floor(idx / COLS)} />
          ))}
        </Cabinet>

        {/* Quầy + thiết bị */}
        <Counter />
        <PickTray pickedCount={picked.length} />
        <ToolTray onClick={onOpenLabelEditor} />
        <PosComputer onClick={onOpenPos} />
        <HandSanitizer position={[2.7, -0.05, 2.60]} />

        {/* Các hộp thuốc – nằm ở world coords, có thể cầm/bay ra khay */}
        {DRUGS.map((drug, drugIdx) => {
          const col = drugIdx % COLS;
          const row = Math.floor(drugIdx / COLS);
          const cx = ORIGIN_X + col * CELL_W;
          const cy = ORIGIN_Y + (ROWS - 1 - row) * CELL_H;
          const cz = -0.18;
          const n = drug.boxesPerRow;
          const spacing = 0.5;
          const startX = -((n - 1) * spacing) / 2;
          const isPicked = picked.includes(drug.id);
          const label = labels[drug.id];
          const target = pickSlotPos(drugIdx);
          return Array.from({ length: n }).map((_, i) => {
            const shelf: [number, number, number] = [
              cx + startX + i * spacing,
              cy - 0.05,
              cz + 0.12
            ];
            const isPrimary = i === 0;
            return (
              <DrugBox
                key={`${drug.id}-${i}`}
                drug={drug}
                picked={isPicked}
                isPrimary={isPrimary}
                label={isPrimary ? label : undefined}
                shelfPos={shelf}
                targetPos={target}
                onPick={() =>
                  onPick({
                    id: drug.id,
                    isAntibiotic: drug.isAntibiotic,
                    isHazardPregnancy: drug.isHazardPregnancy
                  })
                }
              />
            );
          });
        })}

        {/* 2 nhân vật bệnh nhân + dược sĩ đã được gỡ theo yêu cầu.
            Component ModelCharacter và file GLB vẫn giữ trong repo
            (public/models/patient.glb, pharmacist.glb) để có thể bật lại
            khi tìm được model phù hợp hơn. */}

        {/* Tủ lạnh vắc-xin (model commercial fridge của Khronos) */}
        <ModelObject url="/models/fridge.glb" position={[5.5, -1.0, -0.5]} rotationY={-Math.PI / 2} scale={1.5} />
        <Text position={[5.5, 1.1, -0.2]} fontSize={0.08} color="#0f766e" anchorX="center">
          TỦ LẠNH VẮC-XIN 2–8°C
        </Text>
        {/* Cây xanh trang trí */}
        {/* Cây cảnh PBR (Khronos DiffuseTransmissionPlant) */}
        <ModelObject url="/models/plant.glb" position={[-5.8, -1.0, 0.5]} scale={1.6} />
        <ModelObject url="/models/plant.glb" position={[5.0, -1.0, 2.45]} scale={1.4} rotationY={0.7} />
        {/* Ghế chờ khách hàng */}
        {/* Ghế chờ kiểu bệnh viện – khung kim loại + đệm vinyl xanh */}
        <WaitingChair position={[-3.0, -1.0, 4.45]} />
        <WaitingChair position={[3.0, -1.0, 4.45]} />
        {/* Điều hoà */}
        <ACUnit position={[0, 4.9, -1.3]} />

        {/* Bóng tiếp xúc dưới quầy + tủ */}
        <ContactShadows position={[0, -0.99, 0]} opacity={0.45} scale={20} blur={2.5} far={4} />

        <OrbitControls
          enablePan={false}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={4}
          maxDistance={14}
          target={[0, 1.4, 0]}
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
