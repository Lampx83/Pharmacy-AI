# Triển khai Pharmacy AI lên server qua Portainer

Image final: **~157 MB** (Next.js standalone trên `node:20-alpine`), chạy non-root,
có `HEALTHCHECK` sẵn vào `GET /api/health`.

## Cấu hình hệ thống yêu cầu trên server

- Docker Engine ≥ 24
- Portainer CE/BE ≥ 2.19
- RAM khả dụng cho container: **512 MB** là đủ; khuyến nghị 1 GB
- Port `8040` mở (hoặc dùng reverse-proxy + tên miền — xem mục cuối)
- (Tùy chọn) `OPENAI_API_KEY` nếu muốn NPC dùng LLM thật

---

## 3 phương án triển khai trong Portainer

### Phương án A — Portainer kéo source từ Git và build trên server (đề xuất)

1. Đẩy repo này lên Git (GitHub/GitLab/Gitea/Bitbucket). Branch `main`.
2. Trong Portainer: **Stacks → Add stack**.
3. Đặt tên stack: `pharmacy-ai`.
4. Chọn **Build method: Repository**.
   - Repository URL: `https://github.com/<your-org>/pharmacy-ai`
   - Reference: `refs/heads/main`
   - Compose path: `docker-compose.yml`
   - Authentication: bật nếu repo private (PAT của Git).
5. **Environment variables** (block bên dưới Compose):
   - `OPENAI_API_KEY = sk-...` *(bỏ trống nếu chưa có — vẫn chạy được, NPC dùng stub)*
   - `OPENAI_MODEL = gpt-4o-mini` *(tùy chọn)*
6. Nhấn **Deploy the stack**. Portainer sẽ:
   - clone repo,
   - chạy `docker build` theo `Dockerfile`,
   - khởi động container.
7. Đợi ~2–3 phút lần đầu. Kiểm tra **Containers** → `pharmacy-ai`: cột Status hiện `healthy`.
8. Truy cập `http://<server-ip>:8040`.

> Khi push code mới lên Git: vào stack `pharmacy-ai` → **Pull and redeploy** → Portainer rebuild lại image.

### Phương án B — Build local rồi push image lên registry, server chỉ pull

Dùng nếu server không có Internet ra Git, hoặc muốn build nhanh.

```bash
# Trên máy dev:
docker build -t ghcr.io/<your-org>/pharmacy-ai:1.0.0 .
docker push  ghcr.io/<your-org>/pharmacy-ai:1.0.0
```

Trong `docker-compose.yml`: comment block `build:` và bỏ comment dòng `image: ghcr.io/...`.

Trong Portainer: **Stacks → Add stack → Web editor**, paste compose, deploy.
Server chỉ cần đăng nhập registry: **Registries → Add registry**.

### Phương án C — Upload code thủ công + build trên server

1. SCP thư mục project lên `/opt/pharmacy-ai/` trên server.
2. Portainer **Stacks → Add stack → Upload** (chọn `docker-compose.yml`)
   hoặc **Web editor** rồi đổi `context: /opt/pharmacy-ai`.
3. Deploy.

---

## Biến môi trường

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `OPENAI_API_KEY` | Không | (trống) | Có → NPC dùng OpenAI; trống → stub rule-based |
| `OPENAI_MODEL` | Không | `gpt-4o-mini` | Đổi sang `gpt-4o`, `gpt-4.1-mini`… nếu cần |
| `NODE_ENV` | – | `production` | Đã set sẵn trong Dockerfile |
| `PORT` | – | `3000` | Port lắng nghe **bên trong container**. Đổi cũng cần sửa `EXPOSE` & vế phải `ports:`. Vế trái `8040` là port host. |

Trong Portainer: ở phần Environment variables của Stack, dán dạng `KEY=VALUE`,
mỗi dòng một biến. Compose đã có `${OPENAI_API_KEY:-}` nên trống cũng OK.

---

## Đặt sau reverse-proxy có HTTPS (khuyến nghị)

### Traefik
Trong `docker-compose.yml` đã có sẵn các label mẫu — bỏ comment:

```yaml
networks:
  - web
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.pharmacy.rule=Host(`pharmacy.example.com`)"
  - "traefik.http.routers.pharmacy.entrypoints=websecure"
  - "traefik.http.routers.pharmacy.tls.certresolver=le"
  - "traefik.http.services.pharmacy.loadbalancer.server.port=3000"
```

Và bỏ ánh xạ `ports: - "8040:3000"` (chỉ Traefik cần thấy).

### Caddy (đơn giản hơn)
Tạo file `Caddyfile` trên server:
```
pharmacy.example.com {
  reverse_proxy pharmacy-ai:3000
}
```

### Nginx
```nginx
server {
  listen 443 ssl http2;
  server_name pharmacy.example.com;
  ssl_certificate     /etc/letsencrypt/live/pharmacy.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/pharmacy.example.com/privkey.pem;

  location / {
    proxy_pass         http://127.0.0.1:8040;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        "upgrade";
  }
}
```

---

## Vận hành

| Việc cần làm | Cách thực hiện trong Portainer |
|---|---|
| Cập nhật code | Stacks → `pharmacy-ai` → **Pull and redeploy** |
| Xem log live  | Containers → `pharmacy-ai` → **Logs** (bật Auto-refresh) |
| Mở shell | Containers → `pharmacy-ai` → **Console** (`/bin/sh`) |
| Restart | Containers → `pharmacy-ai` → **Restart** |
| Đổi key OpenAI | Stack → **Editor** → sửa env → **Update the stack** |

Healthcheck nội bộ chạy mỗi 30 s; nếu fail 3 lần Portainer sẽ đánh dấu `unhealthy`.

---

## Lưu ý kiến trúc (giới hạn của MVP)

- **Session ở RAM**: phiên thực hành lưu trong bộ nhớ tiến trình. Khi container
  restart, phiên đang dở **bị mất**. Hợp lý cho lớp học demo; nếu cần persistence,
  thay `src/lib/session/store.ts` bằng Redis.
- **Đơn tiến trình**: Next.js standalone chạy 1 process. Nếu cần > 100 phiên song song,
  nhân lên qua replica (Portainer Service hoặc `docker compose --scale`)
  và dùng store ngoài (Redis).
- **OpenAI tốn token**: mỗi turn ~1 k token vào + 200 token ra. Nếu chạy nhiều lớp,
  cân nhắc dùng model nhỏ (`gpt-4o-mini`) hoặc tự host (Ollama).
- **CSP / HTTPS**: nếu nhúng micro/cam sau này, cần HTTPS thật và CSP cho phép
  `media-src`, `mediastream`. Khi đó dùng reverse-proxy đã hướng dẫn.

---

## Lệnh kiểm thử nhanh trên server (không cần Portainer)

```bash
git clone https://github.com/<your-org>/pharmacy-ai && cd pharmacy-ai
docker compose build
docker compose up -d
docker compose ps
curl -fsS http://localhost:8040/api/health
```

Output mong đợi:
```json
{"status":"ok","service":"pharmacy-ai-sim","time":"…"}
```

---

## Troubleshooting nhanh

| Triệu chứng | Khả năng cao | Cách xử lý |
|---|---|---|
| `pull access denied for pharmacy-ai, repository does not exist or may require 'docker login'` | Compose có top-level `image: pharmacy-ai:latest`, Portainer chạy `docker compose pull` trước khi build → tìm registry không thấy | Đảm bảo `docker-compose.yml` KHÔNG có dòng `image: pharmacy-ai:latest` ở top-level. Tag để vào `build.tags:` (đã có trong file). Sau đó Portainer → Stack → **Pull and redeploy** (compose pull sẽ skip service vì không có `image:`) |
| `unhealthy` trong Portainer | App chưa lên kịp | Tăng `start_period` lên `40s` trong compose |
| 502 từ Traefik | Container chưa join network `web` | Bỏ comment `networks: [web]` và đảm bảo network external đã tồn tại |
| `npm ci` fail khi build | Lệch `package-lock.json` | Trên máy dev chạy `npm install` rồi commit lại `package-lock.json` |
| NPC luôn dùng stub | Không có `OPENAI_API_KEY` | Thêm env trong Stack → redeploy |
| Port 8040 conflict | Đã có service khác chiếm | Đổi vế trái: `ports: "9040:3000"` rồi truy cập qua `:9040` |
