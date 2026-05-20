export interface DrugSpec {
  id: string;
  brand: string;
  generic: string;
  strength: string;
  form: string;
  pack: string;
  manufacturer: string;
  sdk: string;
  isRx: boolean;
  isAntibiotic?: boolean;
  isHazardPregnancy?: boolean;
  groupId: string;
  groupLabel: string;
  groupAccent: string;
  bodyColor: string;
  textDark?: boolean;
  boxesPerRow: number;
  /** VND / hộp */
  unitPrice: number;
}

/* Sáu loại thuốc đại diện, đã có giá bán lẻ tham khảo (VND/hộp).
   Tên thương mại + nhà SX + SĐK là PLACEHOLDER. */
export const DRUGS: DrugSpec[] = [
  {
    id: "paracetamol",
    brand: "PARA-VN",
    generic: "Paracetamol",
    strength: "500 mg",
    form: "Viên nén",
    pack: "Hộp 10 vỉ x 10 viên",
    manufacturer: "Cty Dược Thăng Long",
    sdk: "VD-21345-19",
    isRx: false,
    groupId: "analgesic",
    groupLabel: "HẠ SỐT – GIẢM ĐAU",
    groupAccent: "#2563eb",
    bodyColor: "#f8fafc",
    textDark: true,
    boxesPerRow: 3,
    unitPrice: 18000
  },
  {
    id: "amoxicillin",
    brand: "AMOXI-VN",
    generic: "Amoxicillin",
    strength: "500 mg",
    form: "Viên nang",
    pack: "Hộp 10 vỉ x 10 viên",
    manufacturer: "Cty CP Dược Hà Nội",
    sdk: "VD-30217-21",
    isRx: true,
    isAntibiotic: true,
    groupId: "antibiotic",
    groupLabel: "KHÁNG SINH (KÊ ĐƠN)",
    groupAccent: "#dc2626",
    bodyColor: "#fef2f2",
    textDark: true,
    boxesPerRow: 3,
    unitPrice: 45000
  },
  {
    id: "loratadin",
    brand: "LORA-FAST",
    generic: "Loratadin",
    strength: "10 mg",
    form: "Viên nén",
    pack: "Hộp 2 vỉ x 10 viên",
    manufacturer: "Cty Dược Phương Nam",
    sdk: "VD-19987-18",
    isRx: false,
    groupId: "allergy",
    groupLabel: "DỊ ỨNG – HO",
    groupAccent: "#7c3aed",
    bodyColor: "#f5f3ff",
    textDark: true,
    boxesPerRow: 3,
    unitPrice: 28000
  },
  {
    id: "omeprazol",
    brand: "OMEP-VN",
    generic: "Omeprazol",
    strength: "20 mg",
    form: "Viên nang",
    pack: "Hộp 3 vỉ x 10 viên",
    manufacturer: "Cty Dược Minh Hải",
    sdk: "VD-25510-20",
    isRx: false,
    groupId: "digestive",
    groupLabel: "TIÊU HOÁ",
    groupAccent: "#0d9488",
    bodyColor: "#ecfdf5",
    textDark: true,
    boxesPerRow: 3,
    unitPrice: 35000
  },
  {
    id: "amlodipin",
    brand: "AMLO-CARD",
    generic: "Amlodipin",
    strength: "5 mg",
    form: "Viên nén",
    pack: "Hộp 3 vỉ x 10 viên",
    manufacturer: "Cty Dược Đồng Tâm",
    sdk: "VD-28891-20",
    isRx: true,
    groupId: "cardio",
    groupLabel: "TIM MẠCH (KÊ ĐƠN)",
    groupAccent: "#ea580c",
    bodyColor: "#fff7ed",
    textDark: true,
    boxesPerRow: 3,
    unitPrice: 32000
  },
  {
    id: "isotretinoin",
    brand: "ISO-DERM",
    generic: "Isotretinoin",
    strength: "10 mg",
    form: "Viên nang mềm",
    pack: "Hộp 3 vỉ x 10 viên",
    manufacturer: "Cty Dược Saigon-Pharma",
    sdk: "VD-32104-22",
    isRx: true,
    isHazardPregnancy: true,
    groupId: "special",
    groupLabel: "DA LIỄU – ĐẶC BIỆT (⚠ THAI KỲ)",
    groupAccent: "#be123c",
    bodyColor: "#fff1f2",
    textDark: true,
    boxesPerRow: 3,
    unitPrice: 85000
  }
];

export function getDrug(id: string): DrugSpec | undefined {
  return DRUGS.find((d) => d.id === id);
}

export const PHARMACY_INFO = {
  name: "NHÀ THUỐC GPP – MÔ PHỎNG ĐÀO TẠO",
  address: "Số 207, Giải Phóng, Hai Bà Trưng, Hà Nội",
  phone: "024 1234 5678",
  taxCode: "0101010101",
  gpp: "GPP-HN-2024-0001"
};

export const VAT_RATE = 0.08;
