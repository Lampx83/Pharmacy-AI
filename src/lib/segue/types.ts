export type ModuleId = "gpp" | "hospital" | "medrep";

export type SegueStage = "S" | "E1" | "G" | "U" | "E2";

export const STAGE_LABEL: Record<SegueStage, string> = {
  S: "Set the stage",
  E1: "Elicit info",
  G: "Give info",
  U: "Understand",
  E2: "End"
};

export interface StageWeights {
  S: number;
  E1: number;
  G: number;
  U: number;
  E2: number;
}

export interface StageScore {
  stage: SegueStage;
  score: 0 | 1 | 2;
  matchedKeywords: string[];
  missingKeywords: string[];
  comment: string;
}

export interface FatalError {
  code: string;
  label: string;
  evidence: string;
}

export interface SessionScore {
  moduleId: ModuleId;
  stages: StageScore[];
  weights: StageWeights;
  weighted: number;
  bonus: number;
  total: number;
  autoFail: boolean;
  fatalErrors: FatalError[];
  feedback: string;
}

export interface ChatMessage {
  role: "user" | "npc" | "system";
  content: string;
  ts: number;
  stage?: SegueStage;
}

export interface UiAction {
  type:
    | "pick_box"
    | "label_dose"
    | "pos_checkout"
    | "scan_barcode"
    | "open_his"
    | "flag_prescription_error"
    | "call_doctor"
    | "present_slide"
    | "sign_mou";
  payload?: Record<string, unknown>;
  ts: number;
}

export interface SessionState {
  id: string;
  moduleId: ModuleId;
  startedAt: number;
  endedAt?: number;
  messages: ChatMessage[];
  actions: UiAction[];
  context: Record<string, unknown>;
}
