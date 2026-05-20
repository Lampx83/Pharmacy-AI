import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pharmacy AI – Mô phỏng SEGUE",
  description:
    "Hệ thống mô phỏng 3D tích hợp AI để đào tạo & đánh giá năng lực giao tiếp sinh viên Dược theo khung SEGUE."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
