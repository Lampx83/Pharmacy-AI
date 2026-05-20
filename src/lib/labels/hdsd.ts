export type MealTiming = "before_meal" | "after_meal" | "with_meal" | "any";

export const TIMING_LABEL: Record<MealTiming, string> = {
  before_meal: "Trước ăn",
  after_meal: "Sau ăn",
  with_meal: "Cùng bữa ăn",
  any: "Bất kỳ thời điểm"
};

export interface HdsdLabel {
  drugId: string;
  brand: string;
  generic: string;
  strength: string;
  patient: string;
  morning: number;
  noon: number;
  afternoon: number;
  evening: number;
  timing: MealTiming;
  notes: string;
  issuedAt: number;
}

export function labelShortLine(l: HdsdLabel): string {
  return `S:${l.morning} T:${l.noon} C:${l.afternoon} T:${l.evening}`;
}

export function totalPerDay(l: HdsdLabel): number {
  return l.morning + l.noon + l.afternoon + l.evening;
}
