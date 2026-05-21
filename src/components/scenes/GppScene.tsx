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
import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
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
useGLTF.preload("/models/pen.glb");
useGLTF.preload("/models/barcode_scanner.glb");
useGLTF.preload("/models/receipt_printer.glb");
useGLTF.preload("/models/book.glb");

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

/* ============= Camera presets — bấm "mắt" ở mỗi điểm trong scene để zoom cận cảnh ============= */
type CameraPresetKey = "default" | "fridge" | "counter" | "back_cabinets" | "side_cabinets" | "consult";
type CameraPreset = {
  label: string;
  pos: [number, number, number];
  target: [number, number, number];
  minDist: number;
  maxDist: number;
};
const CAMERA_PRESETS: Record<CameraPresetKey, CameraPreset> = {
  default:       { label: "Toàn cảnh",          pos: [3.4, 4.0, 5.5],   target: [0, 0.9, -0.4],     minDist: 2.5, maxDist: 14 },
  fridge:        { label: "Tủ lạnh 2-8°C",      pos: [-1.6, 1.6, 1.5],  target: [-3.6, 1.0, 1.45],  minDist: 0.8, maxDist: 5  },
  counter:       { label: "Quầy giao dịch",     pos: [0.0, 1.9, 3.4],   target: [0.0, 1.05, 1.0],   minDist: 1.5, maxDist: 8  },
  back_cabinets: { label: "Tủ thuốc sau",       pos: [0.0, 2.4, 1.8],   target: [0.0, 1.4, -1.6],   minDist: 1.5, maxDist: 9  },
  side_cabinets: { label: "Tủ thuốc bên",       pos: [1.3, 1.8, 0.6],   target: [3.6, 1.3, 0.6],    minDist: 1.0, maxDist: 7  },
  consult:       { label: "Khu tư vấn",         pos: [-1.6, 2.0, 1.2],  target: [-3.4, 0.8, -0.4],  minDist: 1.0, maxDist: 7  }
};

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
const DISPLAY_RIGHT_X = -0.8;                      // mép phải — gọn lại, chừa chỗ cho khay tools
const DISPLAY_TOTAL_W = DISPLAY_RIGHT_X - DISPLAY_LEFT_X;
const SECTION_W = DISPLAY_TOTAL_W / COUNTER_SECTIONS;
const TOOLTRAY_X = 0.2;
const POS_X = 1.45;

const SHELVES_PER_CAB = 5;

/* ============= CameraRig — chỉ lerp trong ~700ms ngay sau khi preset đổi.
   Sau khoảng thời gian đó dừng hẳn để OrbitControls trả lại toàn quyền cho user
   (không bị "snap về" vị trí mặc định khi user xoay/zoom). ============= */
function CameraRig({
  presetKey,
  controlsRef,
  firstMount
}: {
  presetKey: CameraPresetKey;
  controlsRef: MutableRefObject<any>;
  firstMount: MutableRefObject<boolean>;
}) {
  const startedAt = useRef<number | null>(null);
  // Trigger lerp khi presetKey đổi.
  // Bỏ qua lần render đầu để camera giữ nguyên vị trí Canvas init (đỡ giật).
  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    startedAt.current = performance.now();
  }, [presetKey, firstMount]);
  useFrame(() => {
    if (startedAt.current == null) return;
    const elapsed = performance.now() - startedAt.current;
    if (elapsed > 700) {
      startedAt.current = null;
      return;
    }
    const c = controlsRef.current;
    if (!c) return;
    const preset = CAMERA_PRESETS[presetKey];
    const tgt = new THREE_VECTOR3(preset.target[0], preset.target[1], preset.target[2]);
    const pos = new THREE_VECTOR3(preset.pos[0], preset.pos[1], preset.pos[2]);
    c.target.lerp(tgt, 0.12);
    c.object.position.lerp(pos, 0.12);
    c.minDistance = preset.minDist;
    c.maxDistance = preset.maxDist;
    c.update();
  });
  return null;
}

/* ============= Hộp thuốc — kích thước & nhãn động ============= */
type BoxVariant = "banner" | "panel" | "stripe" | "twotone" | "classic" | "flag";
type BoxStyle = { w: number; h: number; d: number; variant: BoxVariant; copies: number };

function hashSku(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

const TABLET_DIMS: ReadonlyArray<{ w: number; h: number; d: number }> = [
  { w: 0.090, h: 0.135, d: 0.050 },
  { w: 0.100, h: 0.150, d: 0.055 },
  { w: 0.110, h: 0.140, d: 0.055 },
  { w: 0.105, h: 0.165, d: 0.060 },
  { w: 0.095, h: 0.155, d: 0.050 },
  { w: 0.115, h: 0.130, d: 0.060 },
  { w: 0.085, h: 0.145, d: 0.050 },
];
const SYRUP_DIMS = [
  { w: 0.085, h: 0.205, d: 0.072 },
  { w: 0.080, h: 0.220, d: 0.068 },
  { w: 0.090, h: 0.185, d: 0.075 }
];
const SPRAY_DIMS = [
  { w: 0.072, h: 0.225, d: 0.058 },
  { w: 0.065, h: 0.205, d: 0.055 },
  { w: 0.078, h: 0.215, d: 0.062 }
];
const DROP_DIMS = [
  { w: 0.055, h: 0.110, d: 0.040 },
  { w: 0.060, h: 0.120, d: 0.045 },
  { w: 0.050, h: 0.100, d: 0.038 }
];
const BOTTLE_DIMS = [
  { w: 0.078, h: 0.160, d: 0.058 },
  { w: 0.083, h: 0.150, d: 0.062 },
  { w: 0.072, h: 0.175, d: 0.055 }
];
const TUBE_DIMS = [
  { w: 0.088, h: 0.115, d: 0.048 },
  { w: 0.078, h: 0.130, d: 0.045 },
  { w: 0.082, h: 0.105, d: 0.050 }
];
const AMPOULE_DIMS = [
  { w: 0.065, h: 0.125, d: 0.045 },
  { w: 0.070, h: 0.130, d: 0.045 }
];
const SACHET_DIMS = [
  { w: 0.108, h: 0.092, d: 0.042 },
  { w: 0.115, h: 0.105, d: 0.048 }
];
const DEVICE_DIMS = [
  { w: 0.085, h: 0.160, d: 0.055 },
  { w: 0.090, h: 0.150, d: 0.060 }
];

function getBoxStyle(drug: DrugSpec): BoxStyle {
  const h = hashSku(drug.sku);
  const f = drug.form || "";
  let dim: { w: number; h: number; d: number };
  if (/siro|hỗn dịch|nước uống/i.test(f)) dim = SYRUP_DIMS[h % SYRUP_DIMS.length];
  else if (/bình xịt|xịt mũi|dung dịch xịt/i.test(f)) dim = SPRAY_DIMS[h % SPRAY_DIMS.length];
  else if (/nhỏ mắt|nhỏ giọt|ống nhỏ/i.test(f) || /^dung dịch nhỏ$/i.test(f)) dim = DROP_DIMS[h % DROP_DIMS.length];
  else if (/^lọ$|dung dịch$/i.test(f)) dim = BOTTLE_DIMS[h % BOTTLE_DIMS.length];
  else if (/kem bôi|gel bôi|cao xoa|mỡ/i.test(f)) dim = TUBE_DIMS[h % TUBE_DIMS.length];
  else if (/ống khí dung|ống uống|ống/i.test(f)) dim = AMPOULE_DIMS[h % AMPOULE_DIMS.length];
  else if (/gói|bột/i.test(f)) dim = SACHET_DIMS[h % SACHET_DIMS.length];
  else if (/miếng dán/i.test(f)) dim = { w: 0.115, h: 0.085, d: 0.035 };
  else if (/bút|que thử|thiết bị/i.test(f)) dim = DEVICE_DIMS[h % DEVICE_DIMS.length];
  else dim = TABLET_DIMS[h % TABLET_DIMS.length];
  const VARIANTS: BoxVariant[] = ["banner", "panel", "stripe", "twotone", "classic", "flag"];
  const variant = VARIANTS[h % VARIANTS.length];
  const copies = (h & 3) === 0 ? 3 : 2;
  return { ...dim, variant, copies };
}

/* mix màu rất nhẹ để variant "twotone" có lớp tương phản */
function lightenHex(hex: string, amount = 0.18): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/* ============= Hộp thuốc clickable ============= */
function DrugBox({
  drug,
  shelfPos,
  picked,
  label,
  targetPos,
  onPick,
  scale = 1,
  style,
  interactive = true
}: {
  drug: DrugSpec;
  shelfPos: [number, number, number];
  picked: boolean;
  label?: HdsdLabel;
  targetPos: [number, number, number];
  onPick: () => void;
  scale?: number;
  style: BoxStyle;
  interactive?: boolean;
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

  const { w, h, d, variant } = style;
  const faceZ = d / 2 + 0.001;
  const nameSize   = Math.min(0.022, w * 0.20);
  const strSize    = Math.min(0.018, w * 0.16);
  const skuSize    = Math.min(0.014, w * 0.13);
  const accent = drug.groupAccent;
  const accentLight = lightenHex(accent, 0.35);
  const bodyColor = hovered ? "#fef9c3" : drug.bodyColor;
  const textDark = "#0f172a";

  // Build face decoration depending on variant.
  const face = (() => {
    switch (variant) {
      case "banner": {
        // dải màu ngang trên đỉnh
        return (
          <mesh position={[0, h / 2 - h * 0.12, faceZ]}>
            <planeGeometry args={[w, h * 0.22]} />
            <meshStandardMaterial color={accent} />
          </mesh>
        );
      }
      case "panel": {
        // toàn mặt là accent, ô trắng nhỏ giữa
        return (
          <>
            <mesh position={[0, 0, faceZ - 0.0005]}>
              <planeGeometry args={[w * 0.98, h * 0.96]} />
              <meshStandardMaterial color={accent} />
            </mesh>
            <mesh position={[0, -h * 0.05, faceZ]}>
              <planeGeometry args={[w * 0.82, h * 0.55]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          </>
        );
      }
      case "stripe": {
        // 3 dải ngang xen kẽ
        return (
          <>
            <mesh position={[0, h * 0.32, faceZ]}>
              <planeGeometry args={[w, h * 0.10]} />
              <meshStandardMaterial color={accent} />
            </mesh>
            <mesh position={[0, 0, faceZ]}>
              <planeGeometry args={[w, h * 0.10]} />
              <meshStandardMaterial color={accentLight} />
            </mesh>
            <mesh position={[0, -h * 0.32, faceZ]}>
              <planeGeometry args={[w, h * 0.10]} />
              <meshStandardMaterial color={accent} />
            </mesh>
          </>
        );
      }
      case "twotone": {
        // chia đôi: trên = accent, dưới = bodyColor
        return (
          <mesh position={[0, h * 0.22, faceZ]}>
            <planeGeometry args={[w, h * 0.50]} />
            <meshStandardMaterial color={accent} />
          </mesh>
        );
      }
      case "classic": {
        // dải trên + dải dưới
        return (
          <>
            <mesh position={[0, h * 0.36, faceZ]}>
              <planeGeometry args={[w, h * 0.16]} />
              <meshStandardMaterial color={accent} />
            </mesh>
            <mesh position={[0, -h * 0.40, faceZ]}>
              <planeGeometry args={[w, h * 0.10]} />
              <meshStandardMaterial color={accent} />
            </mesh>
          </>
        );
      }
      case "flag": {
        // góc trên trái có tam giác/chữ nhật nhỏ
        return (
          <>
            <mesh position={[-w * 0.30, h * 0.34, faceZ]}>
              <planeGeometry args={[w * 0.34, h * 0.18]} />
              <meshStandardMaterial color={accent} />
            </mesh>
            <mesh position={[0, -h * 0.36, faceZ]}>
              <planeGeometry args={[w * 0.85, 0.004]} />
              <meshStandardMaterial color={accent} />
            </mesh>
          </>
        );
      }
    }
  })();

  // vị trí chữ phù hợp variant (panel có ô trắng giữa)
  const nameY  = variant === "panel" ? -h * 0.02 : h * 0.13;
  const strY   = variant === "panel" ? -h * 0.14 : -h * 0.02;
  const skuY   = variant === "panel" ? -h * 0.25 : -h * 0.18;
  const nameColor = variant === "panel" ? textDark : textDark;

  return (
    <group
      ref={ref}
      position={shelfPos}
      scale={scale}
      onPointerOver={interactive ? (e) => { e.stopPropagation(); setHovered(true); } : undefined}
      onPointerOut={interactive ? () => setHovered(false) : undefined}
      onClick={interactive ? (e) => { e.stopPropagation(); onPick(); } : undefined}
      raycast={interactive ? undefined : (NULL_RAYCAST as unknown as never)}
    >
      <RoundedBox args={[w, h, d]} radius={Math.min(0.008, w * 0.07)}>
        <meshStandardMaterial color={bodyColor} roughness={0.6} />
      </RoundedBox>
      {face}
      <Text
        position={[0, nameY, faceZ + 0.001]}
        fontSize={nameSize}
        color={nameColor}
        anchorX="center"
        maxWidth={w * 0.92}
      >
        {drug.brand || drug.name}
      </Text>
      <Text
        position={[0, strY, faceZ + 0.001]}
        fontSize={strSize}
        color="#334155"
        anchorX="center"
        maxWidth={w * 0.92}
      >
        {drug.strength}
      </Text>
      <Text
        position={[0, skuY, faceZ + 0.001]}
        fontSize={skuSize}
        color="#475569"
        anchorX="center"
      >
        {drug.sku}
      </Text>
      {drug.isRx && (
        <Text
          position={[-w * 0.35, h * 0.42, faceZ + 0.002]}
          fontSize={Math.min(0.016, w * 0.14)}
          color="#dc2626"
          anchorX="center"
        >
          Rx
        </Text>
      )}
      {label && (
        <group position={[0, -h / 2 - 0.04, faceZ]}>
          <mesh>
            <planeGeometry args={[w, 0.04]} />
            <meshStandardMaterial color="#fde68a" />
          </mesh>
          <Text position={[0, 0, 0.001]} fontSize={Math.min(0.012, w * 0.10)} color="#78350f" anchorX="center">
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

/* Stack hộp giống nhau xếp từ ngoài vào trong cùng SKU */
function DrugStack({
  drug,
  shelfPos,
  picked,
  label,
  targetPos,
  onPick,
  scale = 1,
  style
}: {
  drug: DrugSpec;
  shelfPos: [number, number, number];
  picked: boolean;
  label?: HdsdLabel;
  targetPos: [number, number, number];
  onPick: () => void;
  scale?: number;
  style: BoxStyle;
}) {
  const n = style.copies;
  const stepZ = style.d + 0.005;
  // primary copy = phía ngoài (gần khán giả) — index 0 thì z lớn nhất (đẩy ra trước)
  const items: JSX.Element[] = [];
  for (let i = 0; i < n; i++) {
    const zOff = -i * stepZ * scale;
    const pos: [number, number, number] = [shelfPos[0], shelfPos[1], shelfPos[2] + zOff];
    items.push(
      <DrugBox
        key={`${drug.id}-${i}`}
        drug={drug}
        shelfPos={pos}
        picked={i === 0 ? picked : false}
        label={i === 0 ? label : undefined}
        targetPos={targetPos}
        onPick={onPick}
        scale={scale}
        style={style}
        interactive={i === 0}
      />
    );
  }
  return <>{items}</>;
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

      {(() => {
        /* Chia đều thuốc qua 5 tầng theo modulo, sau đó DÀN ĐỀU mỗi tầng theo
           "cell" cùng độ rộng (usableW/n), từng hộp đứng giữa cell của mình.
           Nhờ vậy không còn dồn về 1 phía khi tầng chưa kín. */
        const shelves: DrugSpec[][] = Array.from({ length: SHELVES_PER_CAB }, () => []);
        drugs.forEach((d, i) => shelves[i % SHELVES_PER_CAB].push(d));
        const usableW = W - 0.16; // trừ 2 vách bên (0.08 mỗi vách)
        const zFront = -D / 2 + 0.20;
        const out: JSX.Element[] = [];
        shelves.forEach((shelfDrugs, shelfIdx) => {
          if (shelfDrugs.length === 0) return;
          const styles = shelfDrugs.map(getBoxStyle);
          const n = shelfDrugs.length;
          // mỗi hộp 1 cell bằng nhau; nếu cell hẹp hơn box rộng nhất, co bộ box theo tỉ lệ
          const cellW = usableW / n;
          const maxBoxW = Math.max(...styles.map((s) => s.w));
          const fit = cellW < maxBoxW + 0.012 ? cellW / (maxBoxW + 0.012) : 1;
          const shelfTopY = shelfIdx === 0 ? 0.08 : 0.11 + shelfIdx * SHELF_H;
          shelfDrugs.forEach((drug, j) => {
            const st = styles[j];
            const bh = st.h * fit;
            // tâm box đặt giữa cell j: cell j tọa độ x từ -usableW/2 + j*cellW đến đó+cellW
            const cx = -usableW / 2 + (j + 0.5) * cellW;
            const cy = shelfTopY + bh / 2;
            const cz = zFront - st.d * fit * 0.5;
            const isPicked = picked.includes(drug.id);
            const slotIdx = picked.indexOf(drug.id);
            const wt = pickSlotPos(slotIdx === -1 ? 0 : slotIdx);
            const dx = wt[0] - origin[0];
            const dz = wt[2] - origin[2];
            const localTarget: [number, number, number] = [
              dx * Math.cos(rotationY) - dz * Math.sin(rotationY),
              wt[1] - origin[1],
              dx * Math.sin(rotationY) + dz * Math.cos(rotationY)
            ];
            out.push(
              <DrugStack
                key={drug.id}
                drug={drug}
                shelfPos={[cx, cy, cz]}
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
                scale={fit}
                style={st}
              />
            );
          });
        });
        return out;
      })()}
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

      {/* === Khu trưng bày: 3 ngăn chỉ chiếm nửa trái quầy.
              Mỗi ngăn chỉ trưng 50% thuốc của nhóm (đại diện) để mặt bàn thoáng. === */}
      {FRONT_SECTIONS.map((sec, sIdx) => {
        const sectionCx = DISPLAY_LEFT_X + SECTION_W / 2 + sIdx * SECTION_W;
        const allDrugs = getDrugsByCabinet(sec.id);
        const drugs = allDrugs.slice(0, Math.ceil(allDrugs.length / 2));
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
            {/* Quầy ngang: pack 2 cột × n hàng; mỗi SKU stack 2-3 hộp;
                box scale 0.65 cho vừa kích thước ngăn nhỏ. */}
            {(() => {
              const CTR_SCALE = 0.65;
              const COLS = 2;
              const rows = Math.max(1, Math.ceil(drugs.length / COLS));
              const colPitch = SECTION_W * 0.50; // 2 cột cách nhau ~nửa section width
              const dzStep = Math.min(0.12, Math.max(0.085, (COUNTER_D * 0.82) / Math.max(rows, 1)));
              return drugs.map((drug, idx) => {
                const slotIdx = picked.indexOf(drug.id);
                const wt = pickSlotPos(slotIdx === -1 ? 0 : slotIdx);
                const col = idx % COLS;
                const row = Math.floor(idx / COLS);
                const dx = (col - (COLS - 1) / 2) * colPitch;
                const dz = (row - (rows - 1) / 2) * dzStep;
                const st = getBoxStyle(drug);
                const baseY = COUNTER_H + (st.h * CTR_SCALE) / 2;
                return (
                  <DrugStack
                    key={drug.id}
                    drug={drug}
                    shelfPos={[dx, baseY, dz]}
                    scale={CTR_SCALE}
                    style={st}
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
              });
            })()}
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

      {/* ===== Màn phụ CFD cho KHÁCH — đặt sát phía sau màn chính, cùng trục x=0
              & cùng y với màn chính để 2 màn ăn khớp lưng-vào-lưng ===== */}
      <group position={[0, 0.6, 0.08]} rotation={[0.05, 0, 0]}>
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

/* ============= Khay dụng cụ + ra lẻ thuốc ============= */
function ToolTray({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const TW = 0.95; // tray width
  const TD = 0.42; // tray depth
  return (
    <group position={[TOOLTRAY_X, COUNTER_H + 0.04, COUNTER_Z - 0.05]}>
      {/* === Khay nền — click vào để soạn nhãn HDSD === */}
      <group
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={onClick}
      >
        <mesh castShadow>
          <boxGeometry args={[TW, 0.02, TD]} />
          <meshStandardMaterial color={hovered ? "#fde68a" : "#e7e5e4"} />
        </mesh>
        <Text position={[0, 0.02, -0.18]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.034} color="#1f2937">
          KHAY DỤNG CỤ + RA LẺ + NHÃN HDSD
        </Text>
        <Text position={[0, 0.02, -0.14]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.022} color="#475569">
          click để soạn nhãn
        </Text>
      </group>

      {/* === Hộp RA LẺ thuốc (pill counter) với gạt chia === */}
      <group position={[-0.36, 0.012, 0.05]}>
        {/* khay ra lẻ — đáy lõm */}
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.025, 0.16]} />
          <meshStandardMaterial color="#fef3c7" roughness={0.5} />
        </mesh>
        {/* viền khay */}
        {[
          [0, 0.02, -0.08, 0.2, 0.04, 0.01],
          [0, 0.02, 0.08, 0.2, 0.04, 0.01],
          [-0.1, 0.02, 0, 0.01, 0.04, 0.16],
          [0.1, 0.02, 0, 0.01, 0.04, 0.16]
        ].map((p, i) => (
          <mesh key={i} position={[p[0], p[1], p[2]]}>
            <boxGeometry args={[p[3], p[4], p[5]]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
        ))}
        {/* gạt chia (slide divider) — tách khay làm 2 nửa */}
        <mesh position={[0, 0.025, 0]} castShadow>
          <boxGeometry args={[0.005, 0.04, 0.14]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {/* vài viên thuốc giả */}
        {[
          [-0.05, -0.04],
          [-0.03, 0.02],
          [0.04, -0.03],
          [0.06, 0.05]
        ].map(([dx, dz], i) => (
          <mesh key={i} position={[dx, 0.022, dz]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.006, 14]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#ffffff" : "#fbbf24"} />
          </mesh>
        ))}
        <Text position={[0, 0.045, -0.105]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.018} color="#7c2d12">
          HỘP RA LẺ
        </Text>
      </group>

      {/* === Bao bì ra lẻ: 3 túi giấy màu trắng / vàng / hồng === */}
      {[
        { color: "#ffffff", outline: "#cbd5e1", label: "Sáng", dx: -0.13 },
        { color: "#fde68a", outline: "#d97706", label: "Trưa", dx: -0.02 },
        { color: "#fbcfe8", outline: "#be185d", label: "Tối", dx: 0.09 }
      ].map((bag, i) => (
        <group key={i} position={[bag.dx, 0.012, -0.05]} rotation={[0, i * 0.08 - 0.1, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.08, 0.022, 0.11]} />
            <meshStandardMaterial color={bag.color} roughness={0.7} />
          </mesh>
          {/* viền dán mép trên */}
          <mesh position={[0, 0.013, -0.05]}>
            <boxGeometry args={[0.08, 0.004, 0.012]} />
            <meshStandardMaterial color={bag.outline} />
          </mesh>
          <Text position={[0, 0.024, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.018} color="#0f172a">
            {bag.label}
          </Text>
        </group>
      ))}

      {/* === Túi zip kín khí (sealed plastic bag) === */}
      <group position={[0.18, 0.012, -0.05]} rotation={[0, 0.15, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.09, 0.014, 0.11]} />
          <meshStandardMaterial color="#cffafe" roughness={0.25} metalness={0.1} transparent opacity={0.78} />
        </mesh>
        {/* phần zip kẻ sọc */}
        <mesh position={[0, 0.009, -0.05]}>
          <boxGeometry args={[0.085, 0.004, 0.008]} />
          <meshStandardMaterial color="#0891b2" />
        </mesh>
        <Text position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.016} color="#0e7490">
          ZIP-LOCK
        </Text>
      </group>

      {/* === Kéo / Băng keo / Bút / Notepad — model GLB từ poly.pizza (CC0) === */}
      <Suspense fallback={null}>
        <TrayTool url="/models/scissors.glb" position={[0.05, 0.012, 0.12]} rotationY={Math.PI / 4} targetSize={0.16} />
        <TrayTool url="/models/tape.glb" position={[0.22, 0.012, 0.12]} rotationY={-Math.PI / 6} targetSize={0.11} />
        <TrayTool url="/models/pen.glb" position={[-0.1, 0.012, 0.13]} rotationY={Math.PI / 2.5} targetSize={0.14} />
        <TrayTool url="/models/notepad.glb" position={[0.38, 0.012, 0.05]} rotationY={Math.PI / 12} targetSize={0.16} />
      </Suspense>

      {/* === Giấy dính ghi HDSD — xấp nhãn dán dùng ngay === */}
      <group position={[0.38, 0.012, -0.08]} rotation={[0, 0.1, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, 0.003 + i * 0.0035, 0]} castShadow>
            <boxGeometry args={[0.09, 0.003, 0.06]} />
            <meshStandardMaterial color={i === 3 ? "#fef9c3" : "#ffffff"} />
          </mesh>
        ))}
        <Text position={[0, 0.024, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.013} color="#0f172a">
          HDSD
        </Text>
      </group>
    </group>
  );
}

/* ============= Helper: load GLB và tự scale về kích thước mong muốn ============= */
function TrayTool({
  url,
  position,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
  targetSize
}: {
  url: string;
  position: [number, number, number];
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  targetSize: number;
}) {
  const { scene } = useGLTF(url) as any;
  // Apply rotation INSIDE the clone before measuring bbox, so vật thể nằm/đứng đúng
  // và y-offset luôn ground sát mặt bàn dù xoay theo trục bất kỳ.
  const cloned = useMemo(() => {
    const s = scene.clone(true);
    s.rotation.set(rotationX, rotationY, rotationZ);
    s.updateMatrixWorld(true);
    return s;
  }, [scene, rotationX, rotationY, rotationZ]);
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
    <group position={[position[0], position[1] + yOffset, position[2]]} scale={scale}>
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
    // bản lề ở mép phải → mở ra ngoài (về phía +z, khán giả) bằng cách quay +π/2.2
    const target = isOpen ? Math.PI / 2.2 : 0;
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

/* ============= Một mặt hàng bên trong tủ lạnh — click để bay ra khay ============= */
type FridgeStock = {
  id: string;
  label: string;
  color: string;
  compartment: "top" | "bottom";
  localPos: [number, number, number]; // local của fridge group
};
function FridgeItem({
  stock,
  picked,
  targetPos,
  onPick
}: {
  stock: FridgeStock;
  picked: boolean;
  targetPos: [number, number, number];
  onPick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const dst = picked ? targetPos : stock.localPos;
    g.position.x += (dst[0] - g.position.x) * 0.15;
    g.position.y += (dst[1] - g.position.y) * 0.15;
    g.position.z += (dst[2] - g.position.z) * 0.15;
  });
  return (
    <group
      ref={ref}
      position={stock.localPos}
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
      <mesh castShadow>
        <boxGeometry args={[0.08, 0.11, 0.06]} />
        <meshStandardMaterial color={hovered ? "#fef9c3" : stock.color} roughness={0.5} />
      </mesh>
      {/* nhãn nhỏ phía trước */}
      <mesh position={[0, 0.01, 0.031]}>
        <planeGeometry args={[0.075, 0.04]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <Text
        position={[0, 0.01, 0.0321]}
        fontSize={0.014}
        color="#0f172a"
        anchorX="center"
        maxWidth={0.07}
      >
        {stock.label}
      </Text>
    </group>
  );
}

/* ============= Tủ lạnh rỗng (có lòng) — cửa mở thấy hàng bên trong ============= */
function ClosedFridge({
  position,
  rotationY = 0,
  picked,
  onPick,
  pickSlotPos
}: {
  position: [number, number, number];
  rotationY?: number;
  picked: string[];
  onPick: (item: { id: string; isAntibiotic?: boolean; isHazardPregnancy?: boolean }) => void;
  pickSlotPos: (idx: number) => [number, number, number];
}) {
  const [topOpen, setTopOpen] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(false);
  // Thân tủ spans Y ∈ [0, 1.7]; chia: dưới [0.05, 1.05] (h=1.0), viền 1.05, trên [1.05, 1.65] (h=0.6)
  const BOTTOM_H = 1.0;
  const BOTTOM_Y = 0.05 + BOTTOM_H / 2; // 0.55
  const TOP_H = 0.6;
  const TOP_Y = 1.05 + TOP_H / 2; // 1.35

  /* Tủ chia 5 ngăn (3 dưới + 2 trên), thuốc đặt thẳng trên mặt mỗi ngăn.
     Item box cao 0.11 → tâm Y = mặt ngăn + 0.055. */
  const FRIDGE_SHELF_Y = {
    bottomFloor:   0.07,   // đáy lòng (mặt trên đáy)
    bottomMid1:    0.42,   // ngăn dưới — giữa thấp
    bottomMid2:    0.74,   // ngăn dưới — giữa cao
    midDivider:    1.06,   // mặt trên giá ngăn giữa
    topShelf:      1.34    // ngăn trên — kệ phụ
  } as const;
  const stocks: FridgeStock[] = useMemo(
    () => [
      // === Ngăn trên (đông) — vaccine ===
      // Trên kệ phụ
      { id: "frg_vaccine_bcg", label: "Vaccine BCG",     color: "#bae6fd", compartment: "top",
        localPos: [-0.20, FRIDGE_SHELF_Y.topShelf + 0.055, 0.05] },
      { id: "frg_vaccine_flu", label: "Cúm mùa",         color: "#a7f3d0", compartment: "top",
        localPos: [ 0.00, FRIDGE_SHELF_Y.topShelf + 0.055, 0.05] },
      { id: "frg_vaccine_hpv", label: "HPV Gardasil",    color: "#fbcfe8", compartment: "top",
        localPos: [ 0.20, FRIDGE_SHELF_Y.topShelf + 0.055, 0.05] },
      // Trên giá ngăn giữa (đáy ngăn trên)
      { id: "frg_vaccine_td",  label: "Td uốn ván",      color: "#c7d2fe", compartment: "top",
        localPos: [-0.20, FRIDGE_SHELF_Y.midDivider + 0.055, 0.05] },
      { id: "frg_vaccine_var", label: "Thuỷ đậu",        color: "#fef08a", compartment: "top",
        localPos: [ 0.20, FRIDGE_SHELF_Y.midDivider + 0.055, 0.05] },
      // === Ngăn dưới — insulin / nhỏ mắt / men vi sinh ===
      // Kệ trên ngăn dưới
      { id: "frg_insulin",     label: "Insulin glargine", color: "#fde68a", compartment: "bottom",
        localPos: [-0.22, FRIDGE_SHELF_Y.bottomMid2 + 0.055, 0.05] },
      { id: "frg_eyedrop",     label: "Tobradex 5ml",     color: "#ddd6fe", compartment: "bottom",
        localPos: [ 0.02, FRIDGE_SHELF_Y.bottomMid2 + 0.055, 0.05] },
      { id: "frg_insulin_apr", label: "Insulin aspart",   color: "#fed7aa", compartment: "bottom",
        localPos: [ 0.22, FRIDGE_SHELF_Y.bottomMid2 + 0.055, 0.05] },
      // Kệ giữa ngăn dưới
      { id: "frg_probiotic",   label: "Enterogermina",    color: "#fecaca", compartment: "bottom",
        localPos: [-0.20, FRIDGE_SHELF_Y.bottomMid1 + 0.055, 0.05] },
      { id: "frg_eyedrop_2",   label: "Cravit 5ml",       color: "#ccfbf1", compartment: "bottom",
        localPos: [ 0.20, FRIDGE_SHELF_Y.bottomMid1 + 0.055, 0.05] },
      // Đáy lòng ngăn dưới
      { id: "frg_humanal",     label: "Albumin HSA",      color: "#e9d5ff", compartment: "bottom",
        localPos: [-0.20, FRIDGE_SHELF_Y.bottomFloor + 0.055, 0.05] },
      { id: "frg_gonal",       label: "Gonal-F",          color: "#bbf7d0", compartment: "bottom",
        localPos: [ 0.20, FRIDGE_SHELF_Y.bottomFloor + 0.055, 0.05] }
    ],
    []
  );

  // World → local conversion với rotation hiện tại của fridge group
  const cosR = Math.cos(rotationY);
  const sinR = Math.sin(rotationY);
  const localTargetFor = (idx: number): [number, number, number] => {
    const wt = pickSlotPos(idx);
    const dx = wt[0] - position[0];
    const dz = wt[2] - position[2];
    return [dx * cosR - dz * sinR, wt[1] - position[1], dx * sinR + dz * cosR];
  };

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* ====== Thân tủ rỗng — dùng 5 vách + giá giữa thay vì khối đặc ====== */}
      {/* vách trái */}
      <mesh position={[-0.37, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.04, 1.7, 0.7]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} metalness={0.05} />
      </mesh>
      {/* vách phải */}
      <mesh position={[0.37, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.04, 1.7, 0.7]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} metalness={0.05} />
      </mesh>
      {/* vách sau (lòng tủ — tối, phản chiếu nhẹ) */}
      <mesh position={[0, 0.85, -0.33]} receiveShadow>
        <boxGeometry args={[0.78, 1.7, 0.04]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>
      {/* nóc */}
      <mesh position={[0, 1.68, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.78, 0.04, 0.7]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>
      {/* đáy lòng */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[0.74, 0.02, 0.66]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
      </mesh>
      {/* giá ngăn giữa (chia ngăn trên/dưới) */}
      <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.74, 0.02, 0.66]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
      </mesh>
      {/* Kệ phụ trong ngăn trên */}
      <mesh position={[0, FRIDGE_SHELF_Y.topShelf, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.74, 0.015, 0.62]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.55} transparent opacity={0.92} />
      </mesh>
      {/* Kệ giữa ngăn dưới */}
      <mesh position={[0, FRIDGE_SHELF_Y.bottomMid2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.74, 0.015, 0.62]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.55} transparent opacity={0.92} />
      </mesh>
      {/* Kệ dưới ngăn dưới */}
      <mesh position={[0, FRIDGE_SHELF_Y.bottomMid1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.74, 0.015, 0.62]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.55} transparent opacity={0.92} />
      </mesh>

      {/* Đèn LED bên trong khi cửa mở (chỉ là 1 ô sáng nhẹ trên trần lòng tủ) */}
      <mesh position={[0, 1.66, 0]}>
        <boxGeometry args={[0.5, 0.02, 0.05]} />
        <meshStandardMaterial color="#fef9c3" emissive="#fde68a" emissiveIntensity={topOpen || bottomOpen ? 1.4 : 0.2} />
      </mesh>

      {/* Cửa trên + cửa dưới */}
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

      {/* Hàng bên trong — click để bay ra khay ra lẻ */}
      {stocks.map((s) => {
        const idx = picked.indexOf(s.id);
        const isPicked = idx !== -1;
        return (
          <FridgeItem
            key={s.id}
            stock={s}
            picked={isPicked}
            targetPos={localTargetFor(isPicked ? idx : 0)}
            onPick={() => onPick({ id: s.id })}
          />
        );
      })}

      {/* đèn báo ngoài */}
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
  const sideDepth = ROOM_D / 2 - BACK_Z;
  const sideCenterZ = (BACK_Z + ROOM_D / 2) / 2;
  return (
    <group>
      <mesh position={[0, ROOM_H / 2, BACK_Z - 0.05]} receiveShadow>
        <boxGeometry args={[ROOM_W, ROOM_H, 0.1]} />
        <meshStandardMaterial color="#ecfeff" roughness={0.85} />
      </mesh>
      <mesh position={[-ROOM_W / 2 - 0.05, ROOM_H / 2, sideCenterZ]} receiveShadow>
        <boxGeometry args={[0.1, ROOM_H, sideDepth]} />
        <meshStandardMaterial color="#ecfeff" roughness={0.85} />
      </mesh>
      <mesh position={[ROOM_W / 2 + 0.05, ROOM_H / 2, sideCenterZ]} receiveShadow>
        <boxGeometry args={[0.1, ROOM_H, sideDepth]} />
        <meshStandardMaterial color="#ecfeff" roughness={0.85} />
      </mesh>
    </group>
  );
}

/* ============= Subset thuốc trong scene ============= */
function pickDisplayDrugs(cabinetId: string): DrugSpec[] {
  return getDrugsByCabinet(cabinetId);
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
    () => BACK_CABINETS.map((c) => pickDisplayDrugs(c.id)),
    []
  );
  const sideDrugs = useMemo(
    () => SIDE_CABINETS.map((c) => pickDisplayDrugs(c.id)),
    []
  );

  /* === Camera view switching === */
  const [cameraPreset, setCameraPreset] = useState<CameraPresetKey>("default");
  const controlsRef = useRef<any>(null);
  const firstMount = useRef<boolean>(true);
  const currentPreset = CAMERA_PRESETS[cameraPreset];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        cursor: pendingLabel ? "crosshair" : "default"
      }}
    >
      <Canvas shadows camera={{ position: CAMERA_PRESETS.default.pos, fov: 48 }} gl={{ antialias: true }}>
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

        {/* === Máy quét barcode + máy in hoá đơn cạnh POS — đặt sát mặt bàn === */}
        <Suspense fallback={null}>
          <TrayTool
            url="/models/barcode_scanner.glb"
            position={[0.85, COUNTER_H, COUNTER_Z - 0.15]}
            rotationY={-Math.PI / 5}
            targetSize={0.22}
          />
          <TrayTool
            url="/models/receipt_printer.glb"
            position={[1.0, COUNTER_H, COUNTER_Z + 0.18]}
            rotationY={Math.PI}
            targetSize={0.24}
          />
        </Suspense>

        {/* === Tài liệu tra cứu (Dược thư 2018) — nằm ngang trên mặt bàn === */}
        <Suspense fallback={null}>
          <TrayTool
            url="/models/book.glb"
            position={[-0.58, COUNTER_H, COUNTER_Z - 0.08]}
            rotationX={-Math.PI / 2}
            rotationY={Math.PI / 8}
            targetSize={0.26}
          />
        </Suspense>

        {/* === Tủ lạnh — kê sát tường trái, mở cửa thấy hàng bên trong, click để lấy ra khay === */}
        <ClosedFridge
          position={[-ROOM_W / 2 + 0.36, 0, COUNTER_Z + 0.1]}
          rotationY={Math.PI / 2}
          picked={picked}
          onPick={onPick}
          pickSlotPos={pickSlotPos}
        />

        {/* === Khu tư vấn riêng: 1 bàn tròn + 2 ghế đối diện === */}
        <ConsultDesk position={[-3.4, 0, -0.4]} />

        {/* === Dược sĩ + Bệnh nhân: tạm ẩn, chờ model mới === */}

        {/* === Ghế chờ — chỉ giữ hàng bên TỦ LẠNH (trái) ===
            Hàng bên phải nằm cạnh dãy tủ thuốc nên bỏ theo yêu cầu. */}
        <WaitingChair position={[-ROOM_W / 2 + 0.4, 0, 2.8]} rotationY={Math.PI / 2} />

        {/* === 2 cây cảnh — đặt phía SAU ghế chờ, cách ghế ~0.55m, scale 1.26 (giảm 10%) === */}
        <AnimatedPlant position={[-ROOM_W / 2 + 0.4, 0, 4.20]} scale={1.26} phase={0} />
        <AnimatedPlant position={[ROOM_W / 2 - 0.4, 0, 4.20]} scale={1.26} phase={1.2} />

        {/* === Bubble thoại: tạm ẩn cùng nhân vật === */}

        <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={20} blur={2.5} far={4} />

        <CameraRig presetKey={cameraPreset} controlsRef={controlsRef} firstMount={firstMount} />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={CAMERA_PRESETS.default.minDist}
          maxDistance={CAMERA_PRESETS.default.maxDist}
          target={CAMERA_PRESETS.default.target}
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
          flexWrap: "wrap",
          alignItems: "center"
        }}
      >
        <button onClick={onOpenLabelEditor}>🏷️ Soạn nhãn HDSD (kéo/dán)</button>
        <button onClick={onOpenPos}>💻 Mở phần mềm POS</button>

        {/* === Group nút chuyển view camera === */}
        <span
          style={{
            display: "inline-flex",
            gap: 6,
            alignItems: "center",
            padding: "4px 10px",
            background: "rgba(15,23,42,0.65)",
            borderRadius: 8,
            border: "1px solid rgba(56,189,248,0.35)"
          }}
        >
          <span style={{ fontSize: 11, color: "#94a3b8", marginRight: 4 }}>📷 Góc nhìn:</span>
          {(Object.keys(CAMERA_PRESETS) as CameraPresetKey[]).map((k) => {
            const p = CAMERA_PRESETS[k];
            const active = cameraPreset === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setCameraPreset(k)}
                style={{
                  padding: "5px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: active ? "1px solid #38bdf8" : "1px solid rgba(148,163,184,0.4)",
                  background: active ? "#0ea5e9" : "rgba(30,41,59,0.85)",
                  color: active ? "#0f172a" : "#e2e8f0",
                  cursor: active ? "default" : "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {p.label}
              </button>
            );
          })}
        </span>

        <span className="tag">Đã chọn: {picked.length}</span>
        <span className={"tag " + (labelCount ? "green" : "")}>
          Đã dán nhãn: {labelCount}/{picked.length || "—"}
        </span>
      </div>
    </div>
  );
}
