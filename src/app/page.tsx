import Link from "next/link";

const MODULES = [
  {
    id: "gpp",
    title: "Phân hệ 1 — Nhà thuốc Cộng đồng (GPP)",
    desc: "Mô phỏng quy trình bán lẻ, tư vấn sử dụng thuốc, xử lý tình huống khách hàng. Trọng tâm: khai thác triệu chứng & hướng dẫn an toàn."
  },
  {
    id: "hospital",
    title: "Phân hệ 2 — Khoa Dược Bệnh viện",
    desc: "Kho cấp phát + HIS. Sàng lọc y lệnh, đối thoại chuyên môn với bác sĩ, đảm bảo an toàn người bệnh."
  },
  {
    id: "medrep",
    title: "Phân hệ 3 — Trình dược viên",
    desc: "Đàm phán với Trưởng khoa / Hội đồng Thuốc. Trình bày FAB, dữ liệu QALY/ICER, xử lý phản bác."
  }
];

export default function HomePage() {
  return (
    <main>
      <div className="home-hero">
        <h1>Pharmacy AI — Hệ thống mô phỏng SEGUE</h1>
        <p>
          Môi trường giả lập 3D + AI dành cho sinh viên Dược. Mỗi phiên thực hành sẽ được
          chấm điểm theo khung <strong>SEGUE 100 điểm</strong> và phát hiện{" "}
          <strong>lỗi điểm liệt</strong> (Auto-Fail) theo Bản yêu cầu.
        </p>
      </div>
      <div className="modules">
        {MODULES.map((m) => (
          <div key={m.id} className="module-card">
            <h2>{m.title}</h2>
            <p>{m.desc}</p>
            <div>
              <Link href={`/sim/${m.id}`}>
                <button>Bắt đầu phiên thực hành →</button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
