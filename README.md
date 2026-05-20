# Pharmacy AI — Hệ thống mô phỏng SEGUE

MVP web 3D (Next.js + React Three Fiber + OpenAI) hiện thực hoá **Bản yêu cầu phát triển hệ thống mô phỏng tích hợp AI** dành cho đào tạo và đánh giá năng lực giao tiếp sinh viên Dược theo khung **SEGUE**.

## Bao gồm 3 phân hệ

| # | Phân hệ | Bối cảnh 3D | NPC AI |
|---|---|---|---|
| 1 | **Nhà thuốc Cộng đồng (GPP)** | Quầy GPP, kệ thuốc, POS | Khách hàng nữ mang thai 12 tuần đòi mua kháng sinh |
| 2 | **Khoa Dược Bệnh viện** | Kho cấp phát, HIS, vòng tay BN | Bác sĩ tim mạch kê aspirin trên BN dùng warfarin |
| 3 | **Trình dược viên** | Phòng họp + slide 3D | Trưởng khoa Nội chất vấn QALY / chi phí |

## Cài đặt & chạy

```bash
npm install
cp .env.local.example .env.local   # rồi điền OPENAI_API_KEY
npm run dev
# mở http://localhost:3000
```

Nếu chưa có `OPENAI_API_KEY`, hệ thống vẫn chạy được — NPC sẽ dùng stub rule-based để demo các luồng.

## Cơ chế chấm điểm

* `src/lib/segue/rubric.ts` — trọng số 100 điểm, điều chỉnh theo từng phân hệ (GPP nhấn E+G, Bệnh viện nhấn S+U, MedRep nhấn G+U).
* `src/lib/segue/scenarios.ts` — bộ từ khoá theo giai đoạn + bonus theo phân hệ.
* `src/lib/segue/score.ts` — quy đổi 0/1/2 cho mỗi stage, cộng bonus, cấn đối với thao tác UI bắt buộc (Stage G).
* `src/lib/segue/fatal.ts` — phát hiện **lỗi điểm liệt (Auto-Fail)**:
  * Tư vấn thuốc gây quái thai cho BN có thai (isotretinoin, methotrexate, warfarin, ...).
  * Liều paracetamol > 4 g/ngày.
  * Bán kháng sinh / thuốc kê đơn không có đơn hợp lệ.
  * Cấp phát mà không sàng lọc tương tác (Bệnh viện).
  * Ngôn từ xúc phạm (sentiment heuristic đơn giản).

Khi Auto-Fail → tổng điểm = 0 bất kể các stage SEGUE khác.

## Kiến trúc thư mục

```
src/
├─ app/
│  ├─ page.tsx              # Trang chọn phân hệ
│  ├─ sim/[moduleId]/page.tsx
│  ├─ api/session/route.ts  # Tạo / lấy session
│  ├─ api/chat/route.ts     # Gửi câu thoại → NPC trả lời
│  ├─ api/action/route.ts   # Ghi nhận thao tác UI (pick_box, scan...)
│  └─ api/score/route.ts    # Chấm điểm cuối phiên
├─ components/
│  ├─ SimulationClient.tsx  # UI chính: scene + chat + điểm
│  ├─ ScorePanel.tsx
│  └─ scenes/               # GppScene / HospitalScene / MedRepScene
└─ lib/
   ├─ segue/                # rubric, scenarios, scoring, fatal-error
   ├─ session/store.ts      # in-memory store (globalThis singleton)
   └─ llm/                  # openai.ts + stub.ts
```

## API tóm tắt

| Endpoint | Method | Body | Trả về |
|---|---|---|---|
| `/api/session` | POST | `{ moduleId }` | `{ session, scenario }` |
| `/api/chat` | POST | `{ sessionId, message }` | `{ session }` |
| `/api/action` | POST | `{ sessionId, type, payload? }` | `{ session }` |
| `/api/score` | POST | `{ sessionId }` | `{ score, session }` |

## Mở rộng

* **Thoại bằng giọng nói**: thêm Web Speech API (SpeechRecognition + speechSynthesis) ở `SimulationClient`. Backend đã sẵn sàng nhận text.
* **Nhận diện biểu cảm**: tích hợp `face-api.js` vào `<Canvas>` overlay; bổ sung tín hiệu vào `session.context` rồi mở rộng `fatal.ts` / `score.ts`.
* **Lưu trữ phiên thật**: thay `lib/session/store.ts` bằng Redis hoặc Postgres (Prisma).
* **Thêm kịch bản**: bổ sung `ScenarioSpec` mới vào `lib/segue/scenarios.ts`, không cần đụng tới UI.

## Ghi chú

* Phiên bản này là **MVP mỏng** đúng phạm vi đã thống nhất: cả 3 phân hệ, mỗi phân hệ 1 kịch bản mẫu, 3D đơn giản (React Three Fiber), chấm điểm SEGUE đầy đủ + Auto-Fail.
* Stub LLM trả lời ngắn theo từ khoá. Khi đã có `OPENAI_API_KEY`, NPC sẽ trò chuyện tự nhiên bằng `gpt-4o-mini` (đổi qua `OPENAI_MODEL`).
