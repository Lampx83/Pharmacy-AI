import type { FatalError, ModuleId, SessionState } from "./types";

/**
 * Detect "auto-fail" errors per the requirements doc.
 * - Serious drug error (e.g. teratogenic drug to a pregnant patient)
 * - Toxic dose / overdose
 * - Selling prescription-only / narcotic / psychotropic without prescription
 * - Verbal abuse / insults (basic sentiment heuristic)
 */
export function detectFatalErrors(state: SessionState): FatalError[] {
  const out: FatalError[] = [];
  const userTurns = state.messages.filter((m) => m.role === "user");
  const transcript = userTurns.map((m) => m.content.toLowerCase()).join("\n");

  // 1. Teratogenic drug to pregnant patient (GPP scenario context)
  if (state.moduleId === "gpp") {
    const pregnantContext =
      transcript.includes("có thai") ||
      transcript.includes("mang thai") ||
      JSON.stringify(state.context).toLowerCase().includes("pregnan");

    const teratogenic = [
      "isotretinoin",
      "warfarin",
      "misoprostol",
      "methotrexate",
      "thalidomide",
      "valproat",
      "ribavirin",
      "tetracyclin",
      "doxycyclin"
    ];
    for (const drug of teratogenic) {
      if (transcript.includes(drug)) {
        out.push({
          code: "teratogenic_to_pregnant",
          label: "Tư vấn thuốc có nguy cơ gây quái thai",
          evidence: `Đề cập "${drug}" trong khi bệnh nhân đang/đã có thai (context).`
        });
        if (pregnantContext) break;
      }
    }

    // 2. Antibiotic without prescription (GPP scenario context)
    const antibiotics = ["amoxicillin", "azithromycin", "cefixim", "cefuroxim", "augmentin"];
    const refusedSoldFlag = state.actions.some(
      (a) => a.type === "pos_checkout" && (a.payload as any)?.includes_abx === true
    );
    const userSoldByText =
      /(bán|cấp|đưa|kê).{0,30}(kháng sinh|amoxicillin|augmentin|azithromycin)/.test(
        transcript
      );
    if (refusedSoldFlag || userSoldByText) {
      out.push({
        code: "abx_without_rx",
        label: "Bán kháng sinh không có đơn",
        evidence: "Thao tác POS có cờ kháng sinh, hoặc transcript đồng ý bán kháng sinh."
      });
    }
    // explicit antibiotic name + agree
    if (
      antibiotics.some((a) => transcript.includes(a)) &&
      /(đồng ý|được|bán cho|tôi sẽ bán|đây|gửi)/.test(transcript)
    ) {
      out.push({
        code: "abx_without_rx_named",
        label: "Bán kháng sinh không có đơn (đề cập tên hoạt chất)",
        evidence: "Đồng ý bán khi không có đơn hợp lệ."
      });
    }
  }

  // 3. Hospital: dispensing a contraindicated combo after noting it (auto-fail if proceed)
  if (state.moduleId === "hospital") {
    const usedFlag = state.actions.some(
      (a) => a.type === "flag_prescription_error"
    );
    const dispatched = state.actions.some(
      (a) => a.type === "open_his" && (a.payload as any)?.dispensed === true
    );
    if (!usedFlag && dispatched) {
      out.push({
        code: "dispensed_unscreened",
        label: "Cấp phát mà không sàng lọc / phát hiện tương tác",
        evidence: "Có thao tác cấp phát nhưng không cờ phát hiện lỗi y lệnh."
      });
    }
  }

  // 4. Toxic dose heuristic — paracetamol > 4g/day for adult or any obvious overdose phrasing
  const doseMatch = transcript.match(/paracetamol[^.\n]{0,40}(\d+)\s?(mg|g)/);
  if (doseMatch) {
    const amount = parseInt(doseMatch[1], 10);
    const unit = doseMatch[2];
    const mg = unit === "g" ? amount * 1000 : amount;
    const perDoseMatch = transcript.match(/(\d+)\s?(lần|viên)/);
    const times = perDoseMatch ? parseInt(perDoseMatch[1], 10) : 1;
    if (mg * times > 4000) {
      out.push({
        code: "toxic_dose_paracetamol",
        label: "Liều paracetamol vượt quá 4 g / ngày",
        evidence: `${mg} mg x ${times} = ${mg * times} mg/ngày`
      });
    }
  }

  // 5. Verbal abuse / unprofessional language (very rough heuristic)
  const insults = [
    "đồ ngu",
    "câm",
    "biến đi",
    "khốn",
    "đần",
    "ngu ngốc",
    "im đi",
    "vớ vẩn"
  ];
  for (const w of insults) {
    if (transcript.includes(w)) {
      out.push({
        code: "abusive_language",
        label: "Ngôn từ thiếu chuẩn mực với khách/đồng nghiệp",
        evidence: `Phát hiện cụm "${w}".`
      });
      break;
    }
  }

  // dedupe by code
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.code) ? false : (seen.add(e.code), true)));
}
