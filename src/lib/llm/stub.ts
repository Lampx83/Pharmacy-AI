import type { ChatMessage, ModuleId } from "../segue/types";

/**
 * Rule-of-thumb fallback when no OPENAI_API_KEY is configured.
 * Keeps the app usable for demo. Triggers off keywords in the latest user msg.
 */
export function stubNpcReply(opts: {
  moduleId: ModuleId;
  history: ChatMessage[];
  userMessage: string;
}): string {
  const t = opts.userMessage.toLowerCase();
  if (opts.moduleId === "gpp") {
    if (/(có thai|mang thai|cho con bú)/.test(t))
      return "Dạ em đang mang thai khoảng 12 tuần, có sao không dược sĩ?";
    if (/(kháng sinh|amoxicillin|augmentin)/.test(t) && /(không|cần đơn|kê đơn)/.test(t))
      return "Sao phải có đơn vậy ạ? Lần trước em mua được mà...";
    if (/(triệu chứng|bao lâu|mấy ngày)/.test(t))
      return "Em ho, sổ mũi 2 ngày nay, không sốt cao, chỉ hơi mệt.";
    if (/(dị ứng)/.test(t)) return "Em không bị dị ứng thuốc gì cả.";
    if (/(paracetamol|hạ sốt)/.test(t))
      return "Vâng, dược sĩ chỉ giúp em liều dùng nhé.";
    return "Vậy dược sĩ tư vấn giúp em với ạ.";
  }
  if (opts.moduleId === "hospital") {
    if (/(warfarin|tương tác|chảy máu|chống chỉ định)/.test(t))
      return "Hmm... cô/cậu nói có lý. Vậy đề xuất đổi sang gì? Nói nhanh.";
    if (/(dược thư|dẫn chứng|bằng chứng)/.test(t))
      return "Được, ghi nhận. Tôi sẽ đổi y lệnh sang paracetamol.";
    if (/(xác minh|mã bệnh án|vòng tay)/.test(t))
      return "BN Nguyễn Văn A, mã 0451, đúng rồi.";
    return "Có vấn đề gì thì nói thẳng đi.";
  }
  // medrep
  if (/(qaly|icer|cua|chi phí.{0,3}hiệu quả)/.test(t))
    return "Số liệu QALY của em lấy từ nghiên cứu nào? Cỡ mẫu bao nhiêu?";
  if (/(rct|nghiên cứu|p\s*<|nghiên cứu)/.test(t))
    return "OK, vậy so với biệt dược X của hãng đối thủ thì sao?";
  if (/(biên bản|dùng thử|ghi nhớ)/.test(t))
    return "Được, tôi đồng ý ký biên bản dùng thử 3 tháng.";
  return "Em có gì thuyết phục hơn không? Giá cao thế cơ mà.";
}
