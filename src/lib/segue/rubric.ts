import type { ModuleId, StageWeights, SegueStage } from "./types";

/**
 * Base SEGUE rubric (100-point scale).
 * Each stage has a weight; raw score 0-2 per stage maps to (raw/2) * weight.
 */
export const BASE_WEIGHTS: StageWeights = {
  S: 10,
  E1: 25,
  G: 25,
  U: 30,
  E2: 10
};

export const MODULE_WEIGHTS: Record<ModuleId, StageWeights> = {
  // GPP focuses on Elicit (symptom triage) + Give info (safe use)
  gpp: { S: 10, E1: 30, G: 30, U: 20, E2: 10 },
  // Hospital focuses on Set the stage (patient ID) + Understand (interprofessional)
  hospital: { S: 20, E1: 20, G: 20, U: 30, E2: 10 },
  // Medical rep focuses on Give info (FAB / economic value) + Understand (objections)
  medrep: { S: 10, E1: 15, G: 30, U: 35, E2: 10 }
};

export const STAGE_ORDER: SegueStage[] = ["S", "E1", "G", "U", "E2"];

export const BONUS_RULES: Record<
  ModuleId,
  { code: string; label: string; max: number }
> = {
  gpp: {
    code: "non_drug_advice",
    label: "Bonus: tư vấn dinh dưỡng/sinh hoạt (non-drug advice)",
    max: 5
  },
  hospital: {
    code: "prescription_screening",
    label: "Bonus: phát hiện lỗi y lệnh (prescription screening)",
    max: 5
  },
  medrep: {
    code: "pharmacoecon_terms",
    label: "Bonus: dùng đúng QALY / ICER / chi phí-hiệu quả",
    max: 5
  }
};
