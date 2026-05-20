"use client";
import type { SessionScore } from "@/lib/segue/types";
import { STAGE_LABEL } from "@/lib/segue/types";

const STAGE_DISPLAY = (s: string) =>
  s === "E1" ? "E (Elicit)" : s === "E2" ? "E (End)" : `${s} (${STAGE_LABEL[s as keyof typeof STAGE_LABEL]})`;

export default function ScorePanel({ score }: { score: SessionScore }) {
  return (
    <div className="card">
      <h2>
        Điểm tổng: <span style={{ color: score.autoFail ? "#f87171" : "#22c55e" }}>{score.total}/100</span>{" "}
        {score.autoFail && <span className="tag red">AUTO-FAIL</span>}
      </h2>
      <p style={{ fontSize: 12, color: "#94a3b8" }}>
        Trọng số: {Object.entries(score.weights).map(([k, v]) => `${k}=${v}%`).join(" · ")} ·
        Bonus: {score.bonus}
      </p>

      {score.autoFail && (
        <div className="card" style={{ background: "#7f1d1d", borderColor: "#b91c1c" }}>
          <h3 style={{ color: "white" }}>LỖI ĐIỂM LIỆT (Auto-Fail)</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {score.fatalErrors.map((e) => (
              <li key={e.code}>
                <strong>{e.label}</strong>: <em>{e.evidence}</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3>Chi tiết SEGUE</h3>
      <div className="score-grid">
        <strong>Giai đoạn</strong>
        <strong>Trọng số</strong>
        <strong>0-2</strong>
        <strong>Điểm</strong>
        {score.stages.map((st) => {
          const w = (score.weights as any)[st.stage] as number;
          const earned = (st.score / 2) * w;
          return (
            <div key={st.stage} style={{ display: "contents" }}>
              <span>{STAGE_DISPLAY(st.stage)}</span>
              <span>{w}%</span>
              <span>
                <span
                  className={"tag " + (st.score === 2 ? "green" : st.score === 1 ? "amber" : "red")}
                >
                  {st.score}
                </span>
              </span>
              <span>{earned.toFixed(1)}</span>
            </div>
          );
        })}
      </div>

      <h3 style={{ marginTop: 12 }}>Nhận xét</h3>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#0b1220",
          padding: 10,
          borderRadius: 6,
          fontSize: 12,
          color: "#cbd5e1"
        }}
      >
        {score.feedback}
      </pre>
    </div>
  );
}
