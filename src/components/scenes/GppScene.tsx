"use client";
/**
 * GppScene v3 — bố cục Yêu cầu 2 + giữ lại trang trí v1
 *
 *   - 4 tủ lớn sau lưng dược sĩ (2 Rx + 2 OTC)
 *   - 3 tủ bên tay phải (dược liệu / TPCN / mỹ phẩm)
 *   - 1 tủ quầy ngang phía trước, 3 ngăn (nhỏ mắt / nhỏ mũi / dùng ngoài)
 *   - POS computer hai màn hình (cho dược sĩ + CFD cho khách)
 *   - Quạt trần xoay, điều hoà, đèn LED trần, cây cảnh lay nhẹ
 *   - Khu tư vấn riêng dùng sofa.glb + bàn
 *   - Tủ lạnh fridge.glb, dược sĩ pharmacist.glb, bệnh nhân patient.glb
 *   - Hàng ghế chờ quay vào trong
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Box3 as THREE_BOX3, Vector3 as THREE_VECTOR3 } from "three";
import {
  OrbitControls,
  Text,
  RoundedBox,
  Environment,
  ContactShadows,
  SoftShadows,
  Billboard,
  useGLTF,
  useAnimations
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

const NULL_RAYCAST = () => null as unknown as void;

useGLTF.preload("/models/patient.glb");
useGLTF.preload("/models/pharmacist.glb");
useGLTF.preload("/models/plant.glb");
useGLTF.preload("/models/fridge.glb");
useGLTF.preload("/models/sofa.glb");
useGLTF.preload("/models/scissors.glb");
useGLTF.preload("/models/tape.glb");
useGLTF.preload("/models/notepad.glb");

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
// RIGHT_X = mép ngoài dãy tủ bên — đặt sát tường phải (origin = RIGHT_X - D/2)
const RIGHT_X = ROOM_W / 2;

const BACK_CABINETS = CABINETS.filter((c) => c.zone === "back");
const SIDE_CABINETS = CABINETS.filter((c) => c.zone === "side");
const FRONT_SECTIONS = CABINETS.filter((c) => c.zone === "front");

const BACK_CAB_W = 1.7;
const BACK_CAB_H = 2.05;
const BACK_CAB_D = 0.55;
const BACK_CAB_GAP = 0.18;
const BACK_TOTAL_W = BACK_CABINETS.length * BACK_CAB_W + (BACK_CABINETS.length - 1) * BACK_CAB_GAP;

const SIDE_CAB_W = 1.6;
const SIDE_CAB_H = 2.05;
const SIDE_CAB_D = 0.55;
const SIDE_CAB_GAP = 0.18;
const SIDE_TOTAL_W = SIDE_CABINETS.length * SIDE_CAB_W + (SIDE_CABINETS.length - 1) * SIDE_CAB_GAP;

const COUNTER_W = 4.2;
const COUNTER_H = 1.0;
const COUNTER_D = 0.7;
const COUNTER_Z = 1.3;
const COUNTER_SECTIONS = FRONT_SECTIONS.length;
/* Khu trưng bày thuốc chỉ chiếm NỬA TRÁI của quầy.
   - bên trái  ⇢ 3 ngăn (nhỏ mắt / nhỏ mũi / dùng ngoài), mỗi ngăn 2 hàng × 2 hộp
   - giữa      ⇢ khay ra lẻ + nhãn HDSD
   - bên phải  ⇢ máy POS hai màn hình */
const DISPLAY_LEFT_X = -COUNTER_W / 2 + 0.25;     // mép trái khu trưng bày
const DISPLAY_RIGHT_X = -0.4;                      // mép phải khu trưng bày
const DISPLAY_TOTAL_W = DISPLAY_RIGHT_X - DISPLAY_LEFT_X;
const SECTION_W = DISPLAY_TOTAL_W / COUNTER_SECTIONS;
const TOOLTRAY_X = 0.1;
const POS_X = 1.45;

const SHELVES_PER_CAB = 5;
const DRUGS_PER_SHELF = 3;

/* ============= Hộp thuốc clickable ============= */
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
      <RoundedBox args={[0.17, 0.24, 0.11]} radius={0.01}>
        <meshStandardMaterial
          color={hovered ? "#fef9c3" : drug.bodyColor}
          roughness={0.55}
        />
      </RoundedBox>
      <mesh position={[0, 0.1, 0.058]}>
        <planeGeometry args={[0.17, 0.038]} />
        <meshStandardMaterial color={drug.groupAccent} />
      </mesh>
      <Text
        position={[0, 0.03, 0.06]}
        fontSize={0.03}
        color="#0f172a"
        anchorX="center"
        maxWidth={0.16}
      >
        {drug.name}
      </Text>
      <Text position={[0, -0.018, 0.06]} fontSize={0.022} color="#334155" anchorX="center">
        {drug.strength}
      </Text>
      <Text position={[0, -0.058, 0.06]} fontSize={0.018} color="#475569" anchorX="center">
        {drug.sku}
      </Text>
      {drug.isRx && (
        <Text position={[-0.06, 0.105, 0.061]} fontSize={0.02} color="#ffffff" anchorX="center">
          Rx
        </Text>
      )}
      {label && (
        <group position={[0, -0.14, 0.06]}>
          <mesh>
            <planeGeometry args={[0.17, 0.06]} />
            <meshStandardMaterial color="#fde68a" />
          </mesh>
          <Text position={[0, 0, 0.001]} fontSize={0.015} color="#78350f" anchorX="center">
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

/* ============= Tủ thuốc lớn ============= */
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
      <mesh position={[0, H / 2, -D / 2 + 0.02]} castShadow receiveShadow>
        <boxGeometry args={[W, H, 0.04]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>
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

      {drugs.map((drug, idx) => {
        const shelf = idx % SHELVES_PER_CAB;
        const slot = Math.floor(idx / SHELVES_PER_CAB) % DRUGS_PER_SHELF;
        const y = 0.1 + shelf * SHELF_H + SHELF_H / 2;
        const x = (slot - (DRUGS_PER_SHELF - 1) / 2) * (W / DRUGS_PER_SHELF);
        const z = -D / 2 + 0.22;
        const isPicked = picked.includes(drug.id);
        const wt = pickSlotPos(picked.indexOf(drug.id) === -1 ? 0 : picked.indexOf(drug.id));
        // world → local cho group rotated by rotationY quanh trục Y
        const dx = wt[0] - origin[0];
        const dz = wt[2] - origin[2];
        const localTarget: [number, number, number] = [
          dx * Math.cos(rotationY) - dz * Math.sin(rotationY),
          wt[1] - origin[1],
          dx * Math.sin(rotationY) + dz * Math.cos(rotationY)
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

/* ============= Quầy ngang 3 ngăn ============= */
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
      {/* Thân quầy */}
      <mesh position={[0, (COUNTER_H - 0.08) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[COUNTER_W, COUNTER_H - 0.08, COUNTER_D]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>

      {/* === Khu trưng bày: 3 ngăn chỉ chiếm nửa trái quầy === */}
      {FRONT_SECTIONS.map((sec, sIdx) => {
        const sectionCx = DISPLAY_LEFT_X + SECTION_W / 2 + sIdx * SECTION_W;
        const drugs = getDrugsByCabinet(sec.id).slice(0, 4);
        return (
          <group key={sec.id} position={[sectionCx, 0, 0]}>
            {/* Vách ngăn giữa các section */}
            {sIdx < COUNTER_SECTIONS - 1 && (
              <mesh position={[SECTION_W / 2, COUNTER_H - 0.18, 0]}>
                <boxGeometry args={[0.015, 0.28, COUNTER_D - 0.04]} />
                <meshStandardMaterial color={sec.accent} />
              </mesh>
            )}
            {/* Bảng tên ở mép sau quầy (phía dược sĩ) */}
            <mesh position={[0, COUNTER_H + 0.1, -COUNTER_D / 2 - 0.01]}>
              <boxGeometry args={[SECTION_W - 0.04, 0.13, 0.03]} />
              <meshStandardMaterial color={sec.accent} />
            </mesh>
            <Text
              position={[0, COUNTER_H + 0.1, -COUNTER_D / 2 + 0.005]}
              fontSize={0.045}
              color="#ffffff"
              anchorX="center"
              maxWidth={SECTION_W - 0.05}
              textAlign="center"
            >
              {sec.label}
            </Text>
            {/* 4 hộp thuốc xếp 2 hàng × 2 cột */}
            {drugs.map((drug, idx) => {
              const slotIdx = picked.indexOf(drug.id);
              const wt = pickSlotPos(slotIdx === -1 ? 0 : slotIdx);
              const col = idx % 2;
              const row = Math.floor(idx / 2);
              const dx = (col - 0.5) * (SECTION_W * 0.45);
              const dz = (row - 0.5) * (COUNTER_D * 0.42);
              return (
                <DrugBox
                  key={drug.id}
                  drug={drug}
                  shelfPos={[dx, COUNTER_H + 0.15, dz]}
                  picked={picked.includes(drug.id)}
                  label={labels[drug.id]}
                  targetPos={[wt[0] - sectionCx, wt[1], wt[2] - COUNTER_Z]}
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

/* ============= Khay đựng thuốc ============= */
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

/* ============= POS hai màn hình ============= */
function PosComputer({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={[POS_X, COUNTER_H + 0.05, COUNTER_Z - 0.05]}
      scale={0.72}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Đế chữ T */}
      <mesh position={[0, 0.025, 0]} castShadow>
        <boxGeometry args={[0.5, 0.04, 0.42]} />
        <meshStandardMaterial color="#0f172a" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.005, 0]} castShadow>
        <boxGeometry args={[0.52, 0.012, 0.44]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* trụ */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.08, 0.32, 0.08]} />
        <meshStandardMaterial color="#0f172a" metalness={0.35} roughness={0.45} />
      </mesh>
      {/* khớp xoay */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.07, 24]} />
        <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* ===== Màn chính DƯỢC SĨ — mặt hướng vào pharmacist (-z) ===== */}
      <group position={[0, 0.6, -0.08]} rotation={[0.05, Math.PI, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.92, 0.62, 0.06]} />
          <meshStandardMaterial color="#0a0f1c" metalness={0.55} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.27, 0.001]}>
          <boxGeometry args={[0.92, 0.06, 0.061]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <Text position={[0, -0.27, 0.034]} fontSize={0.025} color="#94a3b8" anchorX="center">
          PHARMA POS · 15.6"
        </Text>
        <mesh position={[0, 0.025, 0.032]} onClick={onClick}>
          <planeGeometry args={[0.86, 0.5]} />
          <meshStandardMaterial
            color={hovered ? "#0f1f3a" : "#0b1220"}
            emissive="#082f49"
            emissiveIntensity={0.55}
          />
        </mesh>
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
        <Text position={[0, 0.13, 0.034]} fontSize={0.04} color="#bae6fd" anchorX="center">
          F2: DANH MỤC · F9: THANH TOÁN
        </Text>
        <Text position={[0, 0.04, 0.034]} fontSize={0.028} color="#e2e8f0" anchorX="center">
          {`Danh mục: 180 SKU`}
        </Text>
        <Text position={[0, -0.05, 0.034]} fontSize={0.048} color="#22c55e" anchorX="center">
          🛒 NHẤN ĐỂ MỞ POS
        </Text>
      </group>

      {/* ===== Màn phụ CFD cho KHÁCH — mặt hướng ra ngoài (+z) ===== */}
      <group position={[0.32, 0.5, 0.1]}>
        <mesh position={[-0.18, -0.1, 0]} castShadow>
          <boxGeometry args={[0.04, 0.18, 0.04]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[0.56, 0.4, 0.05]} />
          <meshStandardMaterial color="#0a0f1c" metalness={0.55} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.02, 0.026]}>
          <planeGeometry args={[0.52, 0.32]} />
          <meshStandardMaterial color="#0c4a6e" emissive="#0ea5e9" emissiveIntensity={0.5} />
        </mesh>
        <Text position={[0, 0.15, 0.028]} fontSize={0.022} color="#ecfeff" anchorX="center">
          NHÀ THUỐC GPP · KHÁCH HÀNG
        </Text>
        <Text position={[0, 0.07, 0.028]} fontSize={0.026} color="#bae6fd" anchorX="center">
          TỔNG TIỀN PHẢI THANH TOÁN
        </Text>
        <Text position={[0, -0.02, 0.028]} fontSize={0.075} color="#fef3c7" anchorX="center">
          — ₫
        </Text>
        <Text position={[0, -0.11, 0.028]} fontSize={0.018} color="#cbd5e1" anchorX="center">
          (đã gồm 8% VAT) — Cảm ơn quý khách!
        </Text>
      </group>

      {/* Bàn phím + chuột */}
      <group position={[0, 0, -0.32]}>
        <mesh position={[0, 0.015, 0]} rotation={[0.08, 0, 0]} castShadow>
          <boxGeometry args={[0.55, 0.025, 0.2]} />
          <meshStandardMaterial color="#1f2937" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.029, 0]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.51, 0.005, 0.17]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      </group>
      {/* Chuột — đặt bên PHẢI bàn phím nhìn từ phía dược sĩ (dược sĩ đứng ở -z nhìn về +z → phải = -x) */}
      <mesh position={[-0.35, 0.018, -0.32]} castShadow>
        <boxGeometry args={[0.08, 0.028, 0.13]} />
        <meshStandardMaterial color="#1f2937" roughness={0.55} />
      </mesh>
      {/* dây chuột nhỏ nối lên CPU */}
      <mesh position={[-0.28, 0.018, -0.32]}>
        <boxGeometry args={[0.06, 0.005, 0.01]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
}

/* ============= Khay nhãn HDSD ============= */
function ToolTray({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={[TOOLTRAY_X, COUNTER_H + 0.04, COUNTER_Z - 0.05]}
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
      {/* Kéo / băng keo / xấp nhãn — model GLB từ poly.pizza (CC0) */}
      <Suspense fallback={null}>
        <TrayTool url="/models/scissors.glb" position={[-0.17, 0.012, 0.1]} rotationY={Math.PI / 5} targetSize={0.18} />
        <TrayTool url="/models/tape.glb" position={[0.0, 0.012, 0.1]} rotationY={-Math.PI / 6} targetSize={0.14} />
        <TrayTool url="/models/notepad.glb" position={[0.17, 0.012, 0.1]} rotationY={Math.PI / 12} targetSize={0.14} />
      </Suspense>
    </group>
  );
}

/* ============= Helper: load GLB và tự scale về kích thước mong muốn ============= */
function TrayTool({
  url,
  position,
  rotationY = 0,
  targetSize
}: {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  targetSize: number;
}) {
  const { scene } = useGLTF(url) as any;
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const [scale, yOffset] = useMemo(() => {
    const box = new THREE_BOX3();
    box.setFromObject(cloned);
    const size = new THREE_VECTOR3();
    box.getSize(size);
    const max = Math.max(size.x, size.y, size.z) || 1;
    const s = targetSize / max;
    return [s, -box.min.y * s];
  }, [cloned, targetSize]);
  useEffect(() => {
    cloned.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, [cloned]);
  return (
    <group position={[position[0], position[1] + yOffset, position[2]]} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={cloned} />
    </group>
  );
}

/* ============= GLB object loader ============= */
function ModelObject({
  url,
  position,
  rotationY = 0,
  scale = 1
}: {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number | [number, number, number];
}) {
  const { scene } = useGLTF(url) as any;
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => {
    cloned.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.raycast = NULL_RAYCAST;
      }
    });
  }, [cloned]);
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

/* ============= GLB character (rigged, có animation idle) ============= */
function ModelCharacter({
  url,
  position,
  rotationY = 0,
  scale = 1,
  label
}: {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  label: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url) as any;
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { actions } = useAnimations(animations || [], groupRef);

  useEffect(() => {
    if (!actions) return;
    const keys = Object.keys(actions);
    if (!keys.length) return;
    const idleKey =
      keys.find((k) => /idle|stand/i.test(k)) ||
      keys.find((k) => !/walk|run|dance|jump|jog|fall/i.test(k)) ||
      keys[0];
    const idle = actions[idleKey];
    if (!idle) return;
    idle.timeScale = 0.7;
    idle.reset().fadeIn(0.4).play();
    return () => {
      idle.fadeOut(0.2).stop();
    };
  }, [actions]);

  useEffect(() => {
    cloned.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.raycast = NULL_RAYCAST;
      }
    });
  }, [cloned]);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={cloned} />
      <Billboard position={[0, 1.95, 0]}>
        <Text fontSize={0.08} color="#0f172a" anchorX="center" outlineColor="#ffffff" outlineWidth={0.005}>
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

/* ============= Khu tư vấn: 1 bàn + 2 ghế đối diện ============= */
function ConsultDesk({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Bàn tròn */}
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.04, 32]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.45} />
      </mesh>
      {/* Chân bàn */}
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.72, 16]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 24]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>
      {/* Ghế đối diện nhau: 1 quay mặt +z, 1 quay -z */}
      <ConsultChair position={[0, 0, -0.8]} rotationY={0} />
      <ConsultChair position={[0, 0, 0.8]} rotationY={Math.PI} />
    </group>
  );
}
function ConsultChair({
  position,
  rotationY
}: {
  position: [number, number, number];
  rotationY: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* mặt ghế */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.5, 0.05, 0.5]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.6} />
      </mesh>
      {/* tựa lưng */}
      <mesh position={[0, 0.78, -0.22]} castShadow>
        <boxGeometry args={[0.5, 0.55, 0.05]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.6} />
      </mesh>
      {/* 4 chân ghế */}
      {[
        [-0.2, 0, -0.2],
        [0.2, 0, -0.2],
        [-0.2, 0, 0.2],
        [0.2, 0, 0.2]
      ].map((p, i) => (
        <mesh key={i} position={[p[0], 0.22, p[2]]} castShadow>
          <boxGeometry args={[0.04, 0.45, 0.04]} />
          <meshStandardMaterial color="#1e293b" metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/* ============= Cánh tủ lạnh xoay quanh bản lề phải, click để mở/đóng ============= */
function FridgeDoor({
  centerY,
  width,
  height,
  isOpen,
  onToggle,
  handleHeight,
  labelTop
}: {
  centerY: number;
  width: number;
  height: number;
  isOpen: boolean;
  onToggle: () => void;
  handleHeight: number;
  labelTop?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const hingeX = width / 2; // bản lề ở mép phải
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const target = isOpen ? -Math.PI / 2.2 : 0;
    g.rotation.y += (target - g.rotation.y) * 0.18;
  });
  return (
    <group ref={groupRef} position={[hingeX, centerY, 0.36]}>
      {/* cánh cửa */}
      <mesh
        position={[-width / 2, 0, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <boxGeometry args={[width, height, 0.025]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.45} metalness={0.1} />
      </mesh>
      {/* tay nắm — ở mép trái cánh (đối diện bản lề) */}
      <mesh
        position={[-width + 0.05, 0, 0.018]}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <boxGeometry args={[0.04, handleHeight, 0.02]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* tem nhãn (chỉ cánh trên) */}
      {labelTop && (
        <>
          <mesh position={[-width / 2, height / 2 - 0.08, 0.018]}>
            <planeGeometry args={[0.36, 0.12]} />
            <meshStandardMaterial color="#0f766e" />
          </mesh>
          <Text
            position={[-width / 2, height / 2 - 0.08, 0.02]}
            fontSize={0.04}
            color="#ecfeff"
            anchorX="center"
          >
            TỦ LẠNH 2–8°C
          </Text>
        </>
      )}
    </group>
  );
}

/* ============= Tủ lạnh cửa kín (closed-door, không xuyên thấu) ============= */
function ClosedFridge({
  position,
  rotationY = 0
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  const [topOpen, setTopOpen] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(false);
  // Thân tủ spans Y ∈ [0, 1.7]; chia: dưới [0.05, 1.05] (h=1.0), viền 1.05, trên [1.05, 1.65] (h=0.6)
  const BOTTOM_H = 1.0;
  const BOTTOM_Y = 0.05 + BOTTOM_H / 2; // 0.55
  const TOP_H = 0.6;
  const TOP_Y = 1.05 + TOP_H / 2; // 1.35
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* thân tủ */}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.78, 1.7, 0.7]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} metalness={0.05} />
      </mesh>
      {/* lòng tủ tối (để khi cửa mở thấy bên trong) */}
      <mesh position={[0, 0.85, 0.355]} receiveShadow>
        <boxGeometry args={[0.74, 1.6, 0.005]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      {/* viền ngang giữa 2 cửa */}
      <mesh position={[0, 1.05, 0.355]}>
        <boxGeometry args={[0.74, 0.02, 0.01]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      {/* Cửa trên + cửa dưới — có thể click mở/đóng */}
      <FridgeDoor
        centerY={TOP_Y}
        width={0.74}
        height={TOP_H}
        isOpen={topOpen}
        onToggle={() => setTopOpen((o) => !o)}
        handleHeight={0.28}
        labelTop
      />
      <FridgeDoor
        centerY={BOTTOM_Y}
        width={0.74}
        height={BOTTOM_H}
        isOpen={bottomOpen}
        onToggle={() => setBottomOpen((o) => !o)}
        handleHeight={0.45}
      />
      {/* đèn báo */}
      <mesh position={[0.3, 1.66, 0.36]}>
        <circleGeometry args={[0.014, 16]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.7} />
      </mesh>
      {/* đế tủ */}
      <mesh position={[0, 0.025, 0]} castShadow>
        <boxGeometry args={[0.8, 0.05, 0.72]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
    </group>
  );
}

/* ============= Cây cảnh lay nhẹ (sway animation) ============= */
function AnimatedPlant({
  position,
  scale = 1.4,
  phase = 0
}: {
  position: [number, number, number];
  scale?: number;
  phase?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime + phase;
    g.rotation.z = Math.sin(t * 0.9) * 0.04;
    g.rotation.x = Math.cos(t * 0.7) * 0.025;
  });
  return (
    <group ref={ref} position={position}>
      <ModelObject url="/models/plant.glb" position={[0, 0, 0]} scale={scale} />
    </group>
  );
}

/* ============= Quạt trần xoay ============= */
function CeilingFan({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 4.5;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.36, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.13, 0.16, 0.1, 24]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.14, 0.13, 0.04, 24]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
      </mesh>
      <group ref={ref}>
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((a, i) => (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[0.55, -0.02, 0]} rotation={[0.18, 0, 0]} castShadow>
              <boxGeometry args={[0.85, 0.018, 0.2]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
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

/* ============= Điều hoà ============= */
function ACUnit({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 0.4, 0.32]} />
        <meshStandardMaterial color="#fafafa" roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.18, 0.16]}>
        <boxGeometry args={[1.4, 0.06, 0.02]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
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

/* ============= Đèn LED trần ============= */
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

/* ============= Biển chữ thập GPP ============= */
function CrossSign({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, -0.05, -0.04]} castShadow>
        <boxGeometry args={[0.05, 0.1, 0.05]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
      </mesh>
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

/* ============= Hàng ghế chờ (quay vào trong) ============= */
function WaitingChair({
  position,
  rotationY = 0
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.8, 0.05, 0.45]} />
        <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.5} />
      </mesh>
      {[-0.6, 0, 0.6].map((x) => (
        <mesh key={`s${x}`} position={[x, 0.48, 0]} castShadow>
          <boxGeometry args={[0.55, 0.03, 0.4]} />
          <meshStandardMaterial color="#0ea5e9" roughness={0.7} />
        </mesh>
      ))}
      {[-0.6, 0, 0.6].map((x) => (
        <mesh key={`b${x}`} position={[x, 0.78, -0.2]} castShadow>
          <boxGeometry args={[0.55, 0.4, 0.04]} />
          <meshStandardMaterial color="#0ea5e9" roughness={0.7} />
        </mesh>
      ))}
      {[-0.85, 0.85].map((x) => (
        <mesh key={`l${x}`} position={[x, 0.22, 0]} castShadow>
          <boxGeometry args={[0.05, 0.45, 0.45]} />
          <meshStandardMaterial color="#334155" metalness={0.5} />
        </mesh>
      ))}
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
      <mesh position={[0, ROOM_H / 2, BACK_Z - 0.05]} receiveShadow>
        <boxGeometry args={[ROOM_W, ROOM_H, 0.1]} />
        <meshStandardMaterial color="#ecfeff" roughness={0.85} />
      </mesh>
      <mesh position={[-ROOM_W / 2 - 0.05, ROOM_H / 2, 0]} receiveShadow>
        <boxGeometry args={[0.1, ROOM_H, ROOM_D]} />
        <meshStandardMaterial color="#ecfeff" roughness={0.85} />
      </mesh>
      <mesh position={[ROOM_W / 2 + 0.05, ROOM_H / 2, 0]} receiveShadow>
        <boxGeometry args={[0.1, ROOM_H, ROOM_D]} />
        <meshStandardMaterial color="#ecfeff" roughness={0.85} />
      </mesh>
    </group>
  );
}

/* ============= Subset thuốc trong scene ============= */
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
        <fog attach="fog" args={["#e6efe9", 14, 26]} />
        <SoftShadows size={24} samples={10} focus={0.6} />

        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#ffffff", "#cbd5e1", 0.4]} />
        <directionalLight
          position={[4, 6, 5]}
          intensity={1.0}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <spotLight position={[0, 3.4, COUNTER_Z + 0.6]} angle={0.55} penumbra={0.7} intensity={0.9} color="#fef9c3" castShadow />
        <Environment preset="city" />

        <Floor />
        <Walls />

        {/* Quạt trần xoay (bỏ đèn trần + chữ thập theo yêu cầu) */}
        <CeilingFan position={[0, ROOM_H - 0.45, 0.4]} />

        {/* Điều hoà trên tường sau */}
        <ACUnit position={[-1.5, ROOM_H - 0.5, BACK_Z + 0.04]} />
        <ACUnit position={[1.5, ROOM_H - 0.5, BACK_Z + 0.04]} />

        {/* === 4 tủ lớn sau lưng === */}
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

        {/* === 3 tủ bên phải — dịch ra xa dãy tủ sau để không sát nhau === */}
        {SIDE_CABINETS.map((cab, i) => {
          const z = -SIDE_TOTAL_W / 2 + SIDE_CAB_W / 2 + i * (SIDE_CAB_W + SIDE_CAB_GAP) + 0.6;
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

        {/* === Tủ lạnh cửa kín — kê sát tường trái, mặt cửa quay vào trong (+x) === */}
        <ClosedFridge position={[-ROOM_W / 2 + 0.36, 0, COUNTER_Z + 0.1]} rotationY={Math.PI / 2} />

        {/* === Khu tư vấn riêng: 1 bàn tròn + 2 ghế đối diện === */}
        <ConsultDesk position={[-3.4, 0, -0.4]} />

        {/* === Dược sĩ + Bệnh nhân: tạm ẩn, chờ model mới === */}

        {/* === 2 hàng ghế chờ — quay vào trong === */}
        {/* Hàng trái sát tường trái, lưng dựa vào tường (-x), mặt ghế quay sang phải (+x) → rotationY = +π/2 */}
        <WaitingChair position={[-ROOM_W / 2 + 0.4, 0, 2.8]} rotationY={Math.PI / 2} />
        {/* Hàng phải sát tường phải, lưng dựa vào tường (+x), mặt quay sang trái (-x) → rotationY = -π/2 */}
        <WaitingChair position={[ROOM_W / 2 - 0.4, 0, 2.8]} rotationY={-Math.PI / 2} />

        {/* === 2 cây cảnh — đặt phía SAU ghế chờ (xa quầy), không cản đường vào === */}
        <AnimatedPlant position={[-ROOM_W / 2 + 0.4, 0, 3.85]} scale={1.4} phase={0} />
        <AnimatedPlant position={[ROOM_W / 2 - 0.4, 0, 3.85]} scale={1.4} phase={1.2} />

        {/* === Bubble thoại: tạm ẩn cùng nhân vật === */}

        <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={20} blur={2.5} far={4} />

        <OrbitControls
          enablePan={false}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={2.5}
          maxDistance={14}
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
