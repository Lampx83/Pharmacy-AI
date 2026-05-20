import type { ModuleId, SegueStage } from "./types";

export interface StageRule {
  stage: SegueStage;
  /** Lowercase keywords; at least `required` must match for score 2 */
  keywords: string[];
  required: number;
  /** Minimum to reach score 1 (partial) */
  partial: number;
  hint: string;
}

export interface ScenarioSpec {
  id: ModuleId;
  title: string;
  setting: string;
  npcRole: string;
  npcOpening: string;
  /** System prompt for OpenAI persona */
  npcPersona: string;
  stageRules: StageRule[];
  /** Bonus keyword bag */
  bonusKeywords: string[];
  /** Required UI actions to fully pass stage G */
  requiredActions: string[];
}

/* ------------------------ Module 1: Community Pharmacy (GPP) ------------------------ */
const GPP: ScenarioSpec = {
  id: "gpp",
  title: "Nhà thuốc Cộng đồng (GPP)",
  setting:
    "Quầy thuốc GPP, tủ phân loại thuốc, máy POS, khu vực chờ. Khách hàng nữ ~28t bước vào hỏi mua thuốc cảm cúm và xin kháng sinh.",
  npcRole: "Khách hàng",
  npcOpening:
    "Chào dược sĩ, em bị ho và sổ mũi 2 ngày rồi, cho em xin ít kháng sinh uống cho nhanh khỏi nhé.",
  npcPersona: `Bạn đóng vai một khách hàng nữ 28 tuổi tên Lan, đang mang thai 12 tuần (chỉ tiết lộ khi dược sĩ HỎI tiền sử/đang dùng thuốc/có thai). Bạn bị ho, sổ mũi 2 ngày. Bạn muốn mua kháng sinh nhanh, sẽ phàn nàn nếu dược sĩ từ chối. Giữ giọng đời thường, KHÔNG tự khai tiền sử nếu không được hỏi. Trả lời ngắn 1-2 câu tiếng Việt.`,
  stageRules: [
    {
      stage: "S",
      keywords: ["chào", "dược sĩ", "em là", "tôi là", "giúp", "hỗ trợ", "tư vấn"],
      required: 2,
      partial: 1,
      hint: "Chào hỏi, giới thiệu tên/vai trò, hỏi có thể giúp gì."
    },
    {
      stage: "E1",
      keywords: [
        "triệu chứng",
        "bao lâu",
        "mấy ngày",
        "dị ứng",
        "tiền sử",
        "đang dùng",
        "có thai",
        "mang thai",
        "cho con bú",
        "sốt",
        "ho",
        "đờm"
      ],
      required: 4,
      partial: 2,
      hint: "Khai thác triệu chứng, thời gian, dị ứng, thai kỳ, thuốc đang dùng."
    },
    {
      stage: "G",
      keywords: [
        "paracetamol",
        "liều",
        "mg",
        "lần",
        "ngày",
        "sau ăn",
        "sáng",
        "trưa",
        "chiều",
        "tối",
        "không",
        "kháng sinh"
      ],
      required: 4,
      partial: 2,
      hint: "Tư vấn thuốc đúng (không kháng sinh khi không có đơn), liều, cách dùng, dán nhãn HDSD."
    },
    {
      stage: "U",
      keywords: [
        "hiểu",
        "thông cảm",
        "quy chế",
        "kê đơn",
        "không có đơn",
        "nguy hiểm",
        "an toàn",
        "thai",
        "lặp lại",
        "anh chị có thể"
      ],
      required: 3,
      partial: 1,
      hint: "Từ chối bán kháng sinh có lý do; đồng cảm; teach-back."
    },
    {
      stage: "E2",
      keywords: ["tóm tắt", "dặn", "tái khám", "quay lại", "cảm ơn", "chào", "uống nhiều nước"],
      required: 2,
      partial: 1,
      hint: "Tóm tắt, dặn dò, hẹn quay lại nếu không đỡ, chào."
    }
  ],
  bonusKeywords: [
    "uống nhiều nước",
    "nghỉ ngơi",
    "súc miệng nước muối",
    "ăn cháo",
    "vitamin c",
    "tránh lạnh",
    "đeo khẩu trang"
  ],
  requiredActions: ["pick_box", "label_dose", "pos_checkout"]
};

/* ------------------------ Module 2: Hospital Pharmacy ------------------------ */
const HOSPITAL: ScenarioSpec = {
  id: "hospital",
  title: "Khoa Dược Bệnh viện",
  setting:
    "Kho cấp phát, màn hình HIS, khu lâm sàng. Bệnh nhân Nguyễn Văn A, mã BA 0451, đang dùng warfarin; bác sĩ kê thêm aspirin liều cao.",
  npcRole: "Bác sĩ điều trị",
  npcOpening:
    "Dược sĩ, có vấn đề gì với đơn của tôi không? Tôi đang bận, nói nhanh.",
  npcPersona: `Bạn đóng vai BS Trần, điều trị nội tim mạch, hơi gắt gỏng và bận. Bạn vừa kê aspirin 300mg cho BN đang dùng warfarin. Khi dược sĩ phản biện, ban đầu bạn KHÓ CHỊU, chỉ chấp nhận đổi thuốc khi dược sĩ nêu được nguy cơ chảy máu và dẫn chứng Dược thư. Trả lời ngắn, tiếng Việt.`,
  stageRules: [
    {
      stage: "S",
      keywords: [
        "xin chào",
        "dược sĩ",
        "xác minh",
        "mã bệnh án",
        "vòng tay",
        "họ tên",
        "ngày sinh",
        "quét"
      ],
      required: 3,
      partial: 1,
      hint: "Xác minh danh tính bệnh nhân (mã BA, họ tên, ngày sinh) trước khi trao đổi."
    },
    {
      stage: "E1",
      keywords: [
        "đơn thuốc",
        "y lệnh",
        "chẩn đoán",
        "tiền sử",
        "đang dùng",
        "warfarin",
        "inr",
        "dị ứng",
        "chức năng thận"
      ],
      required: 3,
      partial: 1,
      hint: "Khai thác đơn, tiền sử, thuốc đang dùng, xét nghiệm liên quan."
    },
    {
      stage: "G",
      keywords: [
        "tương tác",
        "chảy máu",
        "warfarin",
        "aspirin",
        "chống chỉ định",
        "dược thư",
        "đổi thuốc",
        "paracetamol",
        "liều"
      ],
      required: 3,
      partial: 1,
      hint: "Nêu tương tác warfarin–aspirin, dẫn chứng Dược thư, đề xuất thay thế."
    },
    {
      stage: "U",
      keywords: [
        "thưa bác sĩ",
        "tôi hiểu",
        "an toàn",
        "đề xuất",
        "phối hợp",
        "theo dõi inr",
        "chuyên môn",
        "ghi nhận"
      ],
      required: 3,
      partial: 1,
      hint: "Giữ thái độ chuyên nghiệp khi bác sĩ phản ứng, đề xuất giải pháp."
    },
    {
      stage: "E2",
      keywords: ["ký", "bàn giao", "điều dưỡng", "theo dõi", "cảm ơn", "xác nhận", "ghi chú"],
      required: 2,
      partial: 1,
      hint: "Ký xác nhận, dặn dò điều dưỡng theo dõi chỉ số."
    }
  ],
  bonusKeywords: [
    "phát hiện sai sót y lệnh",
    "prescription screening",
    "tương tác chống chỉ định",
    "báo cáo adr"
  ],
  requiredActions: ["scan_barcode", "open_his", "flag_prescription_error", "call_doctor"]
};

/* ------------------------ Module 3: Medical Rep ------------------------ */
const MEDREP: ScenarioSpec = {
  id: "medrep",
  title: "Trình dược viên",
  setting:
    "Phòng làm việc Trưởng khoa Nội. Bạn giới thiệu thuốc mới NovaCard giảm tái nhập viện 30% so với phác đồ chuẩn, giá nhập cao hơn.",
  npcRole: "Trưởng khoa",
  npcOpening:
    "Tôi có 10 phút. Thuốc của em có gì khác biệt? Giá cao như vậy bệnh viện chúng tôi lấy đâu ra ngân sách?",
  npcPersona: `Bạn đóng vai TS.BS Hùng - Trưởng khoa Nội, lý trí, hoài nghi, hỏi về bằng chứng. Bạn sẽ liên tục chất vấn về độ tin cậy QALY, so sánh với biệt dược đối thủ, và lo về ngân sách. Chỉ "ký biên bản dùng thử" khi trình dược viên đã trả lời thuyết phục ít nhất 2 phản biện. Trả lời ngắn tiếng Việt.`,
  stageRules: [
    {
      stage: "S",
      keywords: ["xin chào", "cảm ơn", "lịch hẹn", "giới thiệu", "công ty", "mục tiêu", "thời gian"],
      required: 2,
      partial: 1,
      hint: "Chào, cảm ơn vì lịch hẹn, nêu mục tiêu cuộc gặp."
    },
    {
      stage: "E1",
      keywords: [
        "phác đồ",
        "khó khăn",
        "chi phí",
        "hiệu quả",
        "ngân sách",
        "tái nhập viện",
        "tỉ lệ",
        "bệnh nhân",
        "anh đang dùng"
      ],
      required: 3,
      partial: 1,
      hint: "Đặt câu hỏi chiến lược về phác đồ hiện tại, khó khăn về chi phí/hiệu quả."
    },
    {
      stage: "G",
      keywords: [
        "fab",
        "feature",
        "advantage",
        "benefit",
        "qaly",
        "icer",
        "chi phí - hiệu quả",
        "chi phí hiệu quả",
        "cua",
        "ngày nằm viện",
        "rct",
        "p <",
        "nghiên cứu"
      ],
      required: 4,
      partial: 2,
      hint: "Trình bày FAB + dữ liệu kinh tế dược (QALY/ICER/CUA), số liệu RCT."
    },
    {
      stage: "U",
      keywords: [
        "tôi hiểu",
        "lắng nghe",
        "phản hồi",
        "đúng vậy",
        "ý anh là",
        "vâng",
        "ngoài ra",
        "bằng chứng",
        "so sánh",
        "đối thủ"
      ],
      required: 3,
      partial: 1,
      hint: "Lắng nghe-phản hồi vòng lặp, xử lý phản bác về QALY/đối thủ."
    },
    {
      stage: "E2",
      keywords: [
        "biên bản",
        "ghi nhớ",
        "dùng thử",
        "danh mục",
        "lịch tiếp theo",
        "chăm sóc",
        "cảm ơn"
      ],
      required: 2,
      partial: 1,
      hint: "Chốt biên bản ghi nhớ / dùng thử, hẹn chăm sóc đối tác."
    }
  ],
  bonusKeywords: ["qaly", "icer", "cua", "chi phí - hiệu quả", "chi phí hiệu quả"],
  requiredActions: ["present_slide", "sign_mou"]
};

export const SCENARIOS: Record<ModuleId, ScenarioSpec> = {
  gpp: GPP,
  hospital: HOSPITAL,
  medrep: MEDREP
};
