# 🎨 Portfolio Frontend (GitOps Production Edition)

Ứng dụng Frontend cho trang tin tức và danh mục hồ sơ năng lực cá nhân, được xây dựng trên nền tảng **Next.js 16 (App Router)** mới nhất, kết hợp với **React 19** và **Tailwind CSS v4**. Dự án được đóng gói và vận hành dưới mô hình GitOps hướng môi trường (Environment-Driven).

Trải nghiệm người dùng được ưu tiên hàng đầu thông qua ngôn ngữ thiết kế tối giản, hiện đại và chuyển động mượt mà.

---

## 💎 Điểm Nổi Bật & Tính Năng Cốt Lõi

*   **🕶️ Stealth UI Aesthetics**: Giao diện thiết kế theo phong cách tối giản, sử dụng các dải màu tối được tuyển chọn kỹ lưỡng, kết hợp hiệu ứng kính mờ (glassmorphism) sang trọng và các viền bo tinh tế.
*   **🎓 Integrated LMS & Waitlist**: Hệ thống giới thiệu khóa học tích hợp, cho phép học viên theo dõi lộ trình học tập trực quan và đăng ký tham gia danh sách chờ (waitlist).
*   **⏳ Dynamic Resume Timeline**: Trình diễn tiểu sử, kinh nghiệm làm việc và các dự án cá nhân dưới dạng dòng thời gian (Timeline) động có tương tác, mang lại ấn tượng chuyên nghiệp cao.
*   **⚡ Next.js Standalone Optimization**: Cấu hình Next.js biên dịch ở chế độ Standalone Mode, giúp giảm thiểu đáng kể dung lượng Docker Image (chỉ chứa các node_modules chạy runtime cần thiết) để triển khai cực nhanh trên cụm Kubernetes.
*   **🔗 Contract-First Type-Safety**: Đồng bộ hóa trực tiếp đặc tả Swagger JSON của Backend thành TypeScript Types thông qua `openapi-typescript`. Lập trình viên luôn có Type kiểm chứng tĩnh khi tương tác với API.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

*   **Core:** Next.js 16 (App Router) & React 19
*   **Styling:** Tailwind CSS v4 & PostCSS
*   **Animations:** Framer Motion (chuyển động mượt mà)
*   **Icons:** Lucide React
*   **API Client:** Axios
*   **API Type Sync:** openapi-typescript 7

---

## 📁 Cấu Trúc Thư Mục Chính

```text
frontend/
├── src/
│   ├── app/                     # Next.js App Router (Pages, Layouts, API Routes)
│   ├── components/              # Các UI Components tái sử dụng (Common & Feature-based)
│   ├── types/                   # Định nghĩa types, bao gồm api.generated.ts từ Swagger
│   ├── styles/                  # Cấu hình CSS toàn cục (index.css) và Tailwind v4 import
│   ├── hooks/                   # Các React Hooks tùy chỉnh
│   └── utils/                   # Hàm tiện ích trợ giúp (Axios client, formatters)
├── public/                      # Tài nguyên tĩnh (Fonts, Icons, Images)
├── next.config.js               # Cấu hình Next.js (chế độ standalone, headers)
└── eslint.config.mjs            # Cấu hình linter Next.js/React mới nhất
```

---

## ⚙️ Biến Môi Trường (Environment Variables)

Tạo file `.env` tại thư mục gốc của frontend dựa trên mẫu [.env.example](.env.example):

| Tên Biến | Chức Năng | Môi Trường local | Môi Trường Staging/Prod |
| :--- | :--- | :--- | :--- |
| `INTERNAL_API_URL` | Địa chỉ gọi API phía Server (SSR) | `http://localhost:3001` | `http://portfolio-backend:3001/api/v1` (K8s Service) |
| `NEXT_PUBLIC_API_URL` | Địa chỉ gọi API phía Trình duyệt (Client-side) | `http://localhost:3001/api` | `https://api.luumac.io.vn/api/v1` |
| `NEXT_PUBLIC_SITE_NAME`| Tên hiển thị của trang web | `LƯU ĐÌNH MÁC | Blog` | `LƯU ĐÌNH MÁC | Portfolio & Blog` |
| `NEXT_PUBLIC_SITE_URL` | URL gốc của trang web | `http://localhost:3000` | `https://luumac.io.vn` |

---

## 🚀 Hướng Dẫn Phát Triển (Local Development)

### Yêu Cầu Hệ Thống
- **Node.js**: Phiên bản LTS (v20 hoặc v22 khuyến nghị)
- **pnpm**: Trình quản lý gói khuyên dùng

### Các Bước Khởi Chạy

1.  **Cài đặt các thư viện:**
    ```bash
    pnpm install
    ```

2.  **Đồng bộ API Types từ Backend:**
    Đảm bảo file `swagger-spec.json` đã được cập nhật (hoặc copy từ backend sang). Sau đó chạy:
    ```bash
    pnpm run api:sync
    ```
    *Types sẽ tự động được tạo ra tại thư mục `src/types/api.generated.ts`.*

3.  **Khởi động Development Server:**
    ```bash
    pnpm run dev
    ```
    *Truy cập ứng dụng tại địa chỉ: `http://localhost:3000`*

4.  **Kiểm tra lỗi Lint:**
    ```bash
    pnpm run lint
    ```

5.  **Build sản phẩm thử nghiệm (Production build):**
    ```bash
    pnpm run build
    ```

---

## 🐳 Containerization & Deployment

*   **Dockerfile (Standalone mode):**
    Dockerfile sử dụng cơ chế multi-stage build để tối ưu hóa caching. Ở giai đoạn cuối, file config `output: 'standalone'` của Next.js chỉ copy các file nhị phân NodeJS tối thiểu và thư mục `.next/standalone`, giúp Docker image nhẹ hơn và khởi chạy nhanh hơn gấp nhiều lần.
*   **GitOps Workflow:**
    *   Mọi thay đổi trên nhánh `dev` được GitLab CI đóng gói image tự động, cập nhật mã SHA vào repository **Infrastructure** và ArgoCD tự động áp dụng lên môi trường Staging.
    *   Triển khai Production được quản lý bằng việc gắn tag git `v*` kết hợp duyệt thủ công, kích hoạt smoke testing sau khi quá trình đồng bộ hoàn tất.

---
*Cập nhật lần cuối: 11/08/2026*
