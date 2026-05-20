"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, RoundedBox } from "@react-three/drei";
import { useState } from "react";

const SLIDES = [
  {
    title: "NovaCard — Tóm tắt",
    bullets: [
      "Thuốc mới cho suy tim mạn",
      "Mục tiêu: giảm tái nhập viện 30%",
      "So với phác đồ chuẩn (RCT n=2,400)"
    ]
  },
  {
    title: "FAB — Feature / Advantage / Benefit",
    bullets: [
      "F: SGLT2-i thế hệ mới + liều ngày 1 lần",
      "A: Giảm rehospitalization 30%, tử vong tim mạch 18%",
      "B: Giảm gánh nặng giường bệnh, tăng QoL"
    ]
  },
  {
    title: "Phân tích Chi phí — Thoả dụng (CUA)",
    bullets: [
      "ICER ≈ 18,000 USD / QALY",
      "Dưới ngưỡng WHO (3× GDP/đầu người)",
      "Giảm 1.8 ngày nằm viện trung bình"
    ]
  },
  {
    title: "Đề xuất",
    bullets: [
      "Dùng thử 3 tháng cho khoa Nội",
      "Theo dõi tái nhập viện theo quý",
      "Báo cáo HĐ Thuốc & Điều trị"
    ]
  }
];

interface Props {
  onPresentSlide: (slideIdx: number) => void;
  onSignMou: () => void;
  signed: boolean;
  presented: number[];
}

export default function MedRepScene({ onPresentSlide, onSignMou, signed, presented }: Props) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isPresented = presented.includes(idx);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas camera={{ position: [0, 1.5, 4], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 2]} intensity={0.6} />
        {/* Meeting table */}
        <mesh position={[0, -0.3, 1]}>
          <boxGeometry args={[3.5, 0.1, 1.2]} />
          <meshStandardMaterial color="#7c2d12" />
        </mesh>
        {/* Slide screen */}
        <group position={[0, 1.2, -1]}>
          <RoundedBox args={[3.2, 1.8, 0.05]} radius={0.04}>
            <meshStandardMaterial color="#0b1220" />
          </RoundedBox>
          <Text
            position={[0, 0.7, 0.04]}
            fontSize={0.14}
            color="#38bdf8"
            anchorX="center"
            maxWidth={3}
          >
            {slide.title}
          </Text>
          {slide.bullets.map((b, i) => (
            <Text
              key={i}
              position={[-1.4, 0.3 - i * 0.28, 0.04]}
              fontSize={0.11}
              color="white"
              anchorX="left"
              maxWidth={2.8}
            >
              {`• ${b}`}
            </Text>
          ))}
        </group>
        {/* Decorative chairs */}
        <mesh position={[-1.3, 0, 1.6]}>
          <boxGeometry args={[0.5, 0.6, 0.5]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[1.3, 0, 1.6]}>
          <boxGeometry args={[0.5, 0.6, 0.5]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2} />
      </Canvas>
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
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          ◀ Slide
        </button>
        <span className="tag">
          Slide {idx + 1}/{SLIDES.length}
        </span>
        <button
          onClick={() => setIdx((i) => Math.min(SLIDES.length - 1, i + 1))}
          disabled={idx === SLIDES.length - 1}
        >
          Slide ▶
        </button>
        <button
          onClick={() => onPresentSlide(idx)}
          disabled={isPresented}
          title="Ghi nhận đã trình bày slide hiện tại"
        >
          🎤 Trình bày slide này {isPresented ? "✓" : ""}
        </button>
        <button onClick={onSignMou} disabled={signed || presented.length < 2}>
          ✍️ Ký biên bản dùng thử {signed ? "✓" : ""}
        </button>
      </div>
    </div>
  );
}
