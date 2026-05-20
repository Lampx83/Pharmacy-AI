"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Text } from "@react-three/drei";
import { useState } from "react";

interface Props {
  onScan: () => void;
  onOpenHis: () => void;
  onFlagError: () => void;
  onCallDoctor: () => void;
  scanned: boolean;
  hisOpen: boolean;
  flagged: boolean;
  called: boolean;
}

const ORDER = {
  patient: "Nguyễn Văn A — Mã BA 0451 — 58t",
  diagnosis: "Rung nhĩ, đang dùng warfarin (INR 2.6)",
  newDrug: "Aspirin 300mg x 2 lần/ngày (mới kê hôm nay)",
  conflict: "⚠️ Tương tác warfarin × aspirin → nguy cơ chảy máu nặng"
};

export default function HospitalScene(props: Props) {
  const [view, setView] = useState<"3d" | "his">("3d");
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {view === "3d" ? (
        <Canvas camera={{ position: [0, 1.7, 4.5], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 3]} intensity={0.7} />
          {/* Drug cabinet */}
          <mesh position={[-1.6, 1, -1]}>
            <boxGeometry args={[1.6, 2, 0.6]} />
            <meshStandardMaterial color="#0f766e" />
          </mesh>
          <Text position={[-1.6, 2.2, -1]} fontSize={0.16} color="white">
            KHO DƯỢC
          </Text>
          {/* HIS terminal */}
          <group position={[1.2, 0.7, 0]}>
            <RoundedBox args={[1.4, 0.9, 0.06]} radius={0.04}>
              <meshStandardMaterial color="#1e3a8a" emissive="#1e3a8a" emissiveIntensity={0.4} />
            </RoundedBox>
            <Text position={[0, 0, 0.04]} fontSize={0.08} color="white" maxWidth={1.2}>
              {"HIS — BA 0451\nĐơn mới: Aspirin 300mg"}
            </Text>
          </group>
          {/* Wristband on counter */}
          <mesh position={[0, 0.05, 1]}>
            <torusGeometry args={[0.22, 0.04, 16, 32]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
          <Text position={[0, 0.35, 1]} fontSize={0.1} color="#fbbf24">
            Vòng đeo tay BN
          </Text>
          {/* Counter */}
          <mesh position={[0, -0.2, 1]}>
            <boxGeometry args={[4, 0.1, 1.4]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2} />
        </Canvas>
      ) : (
        <div className="card" style={{ height: "100%", overflow: "auto" }}>
          <h2>HIS — Hồ sơ y lệnh</h2>
          <p><strong>BN:</strong> {ORDER.patient}</p>
          <p><strong>Chẩn đoán:</strong> {ORDER.diagnosis}</p>
          <p><strong>Y lệnh mới:</strong> {ORDER.newDrug}</p>
          <p style={{ color: "#fbbf24" }}>{ORDER.conflict}</p>
          <div className="row" style={{ marginTop: 12 }}>
            <button onClick={props.onFlagError} disabled={props.flagged}>
              🚩 Đánh dấu lỗi y lệnh
            </button>
            <button onClick={props.onCallDoctor} disabled={props.called}>
              ☎️ Gọi bác sĩ
            </button>
          </div>
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
        <button onClick={() => setView(view === "3d" ? "his" : "3d")}>
          {view === "3d" ? "🖥️ Mở HIS" : "🏥 Quay lại 3D"}
        </button>
        <button onClick={props.onScan} disabled={props.scanned}>
          📷 Quét mã vạch vòng tay
        </button>
        <button onClick={props.onOpenHis} disabled={props.hisOpen}>
          📋 Mở y lệnh HIS
        </button>
        <span className={"tag " + (props.scanned ? "green" : "")}>
          Xác minh BN: {props.scanned ? "✓" : "—"}
        </span>
        <span className={"tag " + (props.flagged ? "green" : "")}>
          Cờ lỗi y lệnh: {props.flagged ? "✓" : "—"}
        </span>
      </div>
    </div>
  );
}
