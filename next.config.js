/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  // Tạo bundle standalone để Docker chạy bằng `node server.js` thay vì `npm start`
  output: "standalone"
};
module.exports = nextConfig;
