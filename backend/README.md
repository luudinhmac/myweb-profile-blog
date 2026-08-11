# 🖥️ Portfolio Backend (GitOps Production Edition)

Dịch vụ Backend (API) cho dự án Portfolio, được phát triển bằng framework **NestJS 11** và cấu trúc theo mô hình hướng môi trường (Environment-Driven), sẵn sàng tích hợp và triển khai tự động qua hạ tầng GitOps.

Dự án áp dụng các nguyên tắc thiết kế phân tách rõ ràng (Clean Architecture / Domain Isolation) giúp hệ thống có khả năng mở rộng cao, bảo mật nghiêm ngặt và tối ưu hóa hiệu năng tối đa.

---

## 💎 Điểm Nổi Bật & Tính Năng Cốt Lõi

*   **⚡ High Performance Caching**: Tích hợp `@nestjs/cache-manager` phối hợp với **Redis** thông qua `@keyv/redis` để giảm tải truy vấn SQL và tăng tốc độ phản hồi API.
*   **🖼️ Dynamic Image Processing**: Sử dụng thư viện **Sharp** hiệu năng cao để tự động nén, thay đổi kích thước và tối ưu hóa hình ảnh trước khi lưu trữ.
*   **📦 Hybrid Storage Engine**: Linh hoạt chuyển đổi giữa lưu trữ cục bộ (**Local Storage**) khi chạy dev và lưu trữ đối tượng đám mây (**MinIO / Cloudflare R2**) trên môi trường staging/production.
*   **🛡️ Security Hardening**:
    *   **Helmet**: Thiết lập các HTTP header bảo mật để chống lại các lỗ hổng web phổ biến.
    *   **Throttler**: Cơ chế Rate Limiting chống tấn công brute-force và DDoS.
    *   **Sanitize-HTML**: Làm sạch các đầu vào HTML để ngăn chặn tấn công XSS.
*   **🔗 Contract-First Swagger**: Tự động tạo và xuất tài liệu OpenAPI/Swagger tại route `/api/docs` và xuất file JSON giúp Frontend tự động đồng bộ hóa các TypeScript Types.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

*   **Framework:** NestJS 11 (Node.js LTS)
*   **Database:** PostgreSQL
*   **ORM:** Prisma 6 (với cơ chế tự động migrate và sinh client type-safe)
*   **Cache:** Redis (qua Keyv)
*   **Storage:** Local / MinIO / Cloudflare R2
*   **Testing:** Jest & Supertest (Unit và E2E)
*   **API Spec:** Swagger / OpenAPI 3

---

## 📁 Cấu Trúc Thư Mục Chính

```text
backend/
├── src/
│   ├── app.module.ts            # Module gốc của ứng dụng
│   ├── main.ts                  # Điểm khởi đầu (Entrypoint) cấu hình CORS, Helmet, Global Pipes
│   ├── domain/                  # Các thực thể nghiệp vụ cốt lõi (Domain Entities)
│   ├── application/             # Logic nghiệp vụ (Use Cases, Services, DTOs)
│   └── infrastructure/          # Chi tiết kỹ thuật (Database, Cache, Storage, Config)
│       ├── config/              # Quản lý và kiểm chứng biến môi trường
│       ├── database/            # Prisma service và repositories
│       ├── storage/             # local.storage.ts và minio.storage.ts
│       └── security/            # Chiến lược xác thực (Passport, JWT)
├── prisma/
│   ├── schema.prisma            # Định nghĩa database schema
│   └── seed.ts                  # Script khởi tạo dữ liệu mẫu
├── test/                        # Môi trường chạy E2E testing
└── scripts/                     # Các helper scripts (ví dụ: generate-swagger.ts)
```

---

## ⚙️ Biến Môi Trường (Environment Variables)

Hãy tạo file `.env` tại thư mục gốc của backend dựa trên mẫu [.env.example](.env.example):

| Tên Biến | Mô Tả | Giá Trị Mặc Định / Ví Dụ |
| :--- | :--- | :--- |
| `NODE_ENV` | Môi trường hoạt động | `development` \| `production` |
| `PORT` | Cổng HTTP của backend | `3001` |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL (Prisma) | `postgresql://user:pass@host:port/db?schema=public` |
| `JWT_SECRET` | Khóa bí mật dùng để ký token JWT | *Chuỗi ngẫu nhiên dài tối thiểu 32 ký tự* |
| `ALLOWED_ORIGINS` | Danh sách tên miền được phép CORS | `http://localhost:3000,https://yourdomain.com` |
| `STORAGE_TYPE` | Bộ máy lưu trữ upload files | `local` \| `minio` (mặc định: `local`) |
| `UPLOAD_DIR` | Thư mục lưu upload nếu dùng local | `uploads` |
| `MINIO_ENDPOINT` | Địa chỉ máy chủ MinIO / R2 | `localhost` |
| `MINIO_PORT` | Cổng API của MinIO | `9000` |
| `MINIO_ACCESS_KEY` | Access Key của MinIO / Cloudflare R2 | *Nhập Access Key* |
| `MINIO_SECRET_KEY` | Secret Key của MinIO / Cloudflare R2 | *Nhập Secret Key* |
| `MINIO_BUCKET` | Tên Bucket để lưu trữ file | `portfolio` |
| `MINIO_USE_SSL` | Sử dụng HTTPS cho cổng storage | `true` \| `false` |
| `MINIO_CDN_URL` | Đường dẫn CDN công khai để xem ảnh | `https://cdn.yourdomain.com` |
| `REDIS_HOST` | Địa chỉ máy chủ Redis (Bắt buộc ở Staging/Prod) | `localhost` |
| `REDIS_PORT` | Cổng kết nối Redis | `6379` |
| `REDIS_PASSWORD` | Mật khẩu truy cập Redis | *Nhập mật khẩu (nếu có)* |

---

## 🚀 Hướng Dẫn Phát Triển (Local Development)

### Yêu Cầu Hệ Thống
- **Node.js**: Phiên bản LTS (v20 hoặc v22 khuyến nghị)
- **pnpm**: Trình quản lý gói hiệu năng cao (Khuyến nghị sử dụng pnpm thay vị npm)

### Các Bước Cài Đặt

1.  **Cài đặt các gói phụ thuộc:**
    ```bash
    pnpm install
    ```

2.  **Khởi động các dịch vụ phụ trợ (PostgreSQL, Redis):**
    Bạn có thể dùng Docker Compose hoặc kết nối tới dịch vụ local/VM đang chạy.

3.  **Cấu hình Database (Prisma):**
    Chạy migration để cập nhật schema lên DB và tự động sinh Prisma Client:
    ```bash
    pnpm prisma migrate dev
    ```

4.  **Khởi tạo dữ liệu mẫu (Seeding):**
    Chạy script seed để tạo tài khoản Admin mặc định và dữ liệu ban đầu:
    ```bash
    pnpm prisma db seed
    ```

5.  **Chạy ứng dụng ở chế độ Watch (Hot reload):**
    ```bash
    pnpm run start:dev
    ```

6.  **Truy cập Swagger UI:**
    Mở trình duyệt truy cập: `http://localhost:3001/api/docs`

---

## 🧪 Kiểm Thử (Testing)

Môi trường kiểm thử được thiết lập bằng Jest:

*   **Chạy Unit Tests:**
    ```bash
    pnpm test
    ```
*   **Chạy Integration/E2E Tests:**
    ```bash
    pnpm run test:e2e
    ```
*   **Kiểm tra độ phủ code (Code Coverage):**
    ```bash
    pnpm run test:cov
    ```

---

## 🔄 Xuất Swagger & Đồng Bộ Hóa Types sang Frontend

Để cập nhật schema API mới nhất cho Frontend mà không cần chạy server thủ công, bạn có thể xuất trực tiếp file JSON đặc tả Swagger:

```bash
pnpm run swagger:export
```
Lệnh này sẽ tạo ra file `swagger-spec.json` tại thư mục gốc backend, sau đó có thể được sử dụng bởi Frontend thông qua lệnh `pnpm run api:sync`.

---

## 🐳 Containerization & CI/CD GitOps Flow

*   **Multi-Stage Dockerfile:** Dockerfile được tối ưu hóa chia thành nhiều giai đoạn build giúp giảm dung lượng image và bảo mật môi trường chạy runtime (sử dụng base image Alpine nhẹ và chạy pod dưới quyền non-root).
*   **GitOps Delivery:**
    1. Nhánh `dev` tự động build và deploy lên môi trường **Staging** qua ArgoCD.
    2. Gắn thẻ tag dạng `v*` (ví dụ `v1.0.0`) sẽ kích hoạt job GitLab CI để tự động lấy (promote) docker image trực tiếp từ Staging sang **Production** mà không cần build lại, tăng tốc độ triển khai và đảm bảo tính nhất quán. Quá trình deploy lên Production yêu cầu **phê duyệt thủ công** (`manual_approval`) và tự động kích hoạt smoke tests để đảm bảo an toàn.

---
*Cập nhật lần cuối: 11/08/2026*
