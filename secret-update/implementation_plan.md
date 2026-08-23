# Kế hoạch chuyển đổi quản lý Secrets sang Doppler (Dự phòng bằng Sealed Secrets)

Kế hoạch này mô tả các bước chi tiết để chuyển đổi cơ chế quản lý biến môi trường và secrets của dự án sang **Doppler** làm hệ thống chính (Primary), đồng thời giữ nguyên **Bitnami Sealed Secrets** làm phương án dự phòng (Backup/Fallback) khi Doppler gặp sự cố hoặc offline.

---

## Doppler Dashboard Setup Steps (Các bước thiết lập trên Doppler)

Để chuẩn bị môi trường chạy dự án, bạn hãy thực hiện theo các bước thủ công sau trên trang quản trị Doppler:

### Bước 1: Khởi tạo tài khoản và Dự án
1. Truy cập [Doppler Dashboard](https://dashboard.doppler.com/) và đăng nhập/đăng ký tài khoản.
2. Nhấp vào **Create Project** và đặt tên dự án là: `portfolio`.
3. Dự án mặc định sẽ tạo ra 3 môi trường: `Development`, `Staging`, và `Production`.

### Bước 2: Import danh sách biến môi trường

Chọn môi trường tương ứng, nhấp vào **Add Secret** hoặc nút **Import Secrets** để nhập danh sách biến môi trường bên dưới:

#### 1. Môi trường Local (Development)
Sử dụng các biến từ tệp [backend/.env](file:///d:/DATA/Portfolio/backend/.env) và [frontend/.env](file:///d:/DATA/Portfolio/frontend/.env):

**Danh sách biến Backend:**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://portfolio_user:macld%402026@localhost:5432/portfolio_db
JWT_SECRET=super_secret_jwt_key_2026
ALLOWED_ORIGINS=http://localhost:3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin_secret_password
STORAGE_TYPE=local
UPLOAD_DIR=uploads
```

**Danh sách biến Frontend:**
```env
NODE_ENV=development
PORT=3000
HOSTNAME=0.0.0.0
INTERNAL_API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SITE_NAME="LƯU ĐÌNH MÁC | Blog"
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
NEXT_TELEMETRY_DISABLED=1
```

#### 2. Môi trường Staging (Kubernetes Staging)
Giải mã từ các SealedSecrets hiện có trong [backend-values.yaml](file:///d:/DATA/Portfolio/infra/environments/staging/backend-values.yaml):

**Danh sách biến Backend (Staging):**
```env
NODE_ENV=production
PORT=3001
BYPASS_TURNSTILE=true
DATABASE_URL=postgresql://portfolio_user:macld%402026@postgres.blog-staging:5432/portfolio_staging
JWT_SECRET=5Ttv+p4uNMkFFnM2N/1jY86/XpsjZv8v8EZKaU120BA=
STORAGE_TYPE=minio
MINIO_ENDPOINT=a8823974263cfbb734616640f1b9dd55.r2.cloudflarestorage.com
MINIO_ACCESS_KEY=<cloudflare_r2_access_key_id_staging>
MINIO_SECRET_KEY=<cloudflare_r2_secret_access_key_staging>
MINIO_BUCKET=blog-k8s-backups
MINIO_USE_SSL=true
MINIO_CDN_URL=https://cdn-staging.yourdomain.com
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
REDIS_HOST=redis-master.blog-staging.svc.cluster.local
REDIS_PORT=6379
REDIS_PASSWORD=<redis_password_staging>
```

**Danh sách biến Frontend (Staging):**
```env
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
INTERNAL_API_URL=http://portfolio-backend-staging:3001/api/v1
NEXT_PUBLIC_API_URL=https://api-staging.luumac.io.vn/api/v1
NEXT_PUBLIC_SITE_NAME="LƯU ĐÌNH MÁC | Blog (Staging)"
NEXT_PUBLIC_SITE_URL=https://staging.luumac.io.vn
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAEE7aDdQIdRp6_w4
NEXT_TELEMETRY_DISABLED=1
```

> [!TIP]
> **Sử dụng Secrets Referencing:**
> Bạn có thể rút gọn chuỗi kết nối bằng cách định nghĩa các biến thành phần rồi tham chiếu chéo trên Doppler:
> * `DB_USER` = `portfolio_user`
> * `DB_PASSWORD` = `macld@2026`
> * `DB_HOST` = `postgres.blog-staging:5432`
> * `DB_NAME` = `portfolio_staging`
> * `DATABASE_URL` = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}`

### Bước 3: Tạo Service Token cho Kubernetes Operator
1. Trên giao diện Doppler Project, chọn môi trường `Staging` (hoặc `Production`).
2. Vào tab **Access** > **Service Tokens** > nhấp vào **Generate**.
3. Đặt tên token là `k8s-staging-token`, chọn quyền truy cập phù hợp.
4. Copy token nhận được (có dạng `dp.pt.xxx`).
5. *Lưu ý:* Lưu token này lại để dùng cho bước mã hóa K8s Secret dưới đây.

---

## User Review Required

> [!IMPORTANT]
> **Quy trình đóng gói token Doppler bằng Sealed Secrets:**
> * Bạn cung cấp Service Token `dp.pt.xxx` vừa tạo ở bước trên.
> * Tôi sẽ tạo cấu hình YAML cho `Secret` K8s chứa token này và dùng `kubeseal` trên máy để mã hóa nó thành file `doppler-token-sealed-secret.yaml` để commit lên Git. Điều này đảm bảo an toàn tuyệt đối cho token Doppler của bạn.

---

## Open Questions & Chỉnh sửa phản hồi

> [!NOTE]
> * **Hỏi: Việc cài đặt Doppler Operator có tự động không?**
> * **Đáp:** CÓ. Chúng ta sẽ cấu hình tự động thông qua ArgoCD Application `platform-doppler-operator` trong thư mục [infra/argocd/applications/platform/](file:///d:/DATA/Portfolio/infra/argocd/applications/platform/). Nó sẽ tự cài Operator lên cụm mà bạn không cần gõ lệnh.

---

## Proposed Changes

### Component: ArgoCD Platform Configurations (Tự động hóa Operator)

Khai báo tài nguyên để ArgoCD tự động cài đặt Doppler Operator.

***

#### [NEW] [doppler-operator.yaml](file:///d:/DATA/Portfolio/infra/argocd/applications/platform/doppler-operator.yaml)
*   Khai báo ArgoCD Application kéo Chart từ `https://helm.doppler.com` với namespace đích `doppler-operator`.

---

### Component: Helm Charts (Kubernetes & GitOps App)

Sửa đổi Helm Charts của backend và postgres để hỗ trợ lựa chọn nguồn cấp secrets động qua biến `secretsProvider` (`"doppler"` hoặc `"sealed-secrets"`).

***

#### [MODIFY] [values.yaml](file:///d:/DATA/Portfolio/infra/apps/backend/values.yaml)
*   Thêm biến cấu hình `secretsProvider` mặc định là `"doppler"`.
*   Thêm block cấu hình cho Doppler (`tokenSecretName`).

#### [NEW] [doppler-secret.yaml](file:///d:/DATA/Portfolio/infra/apps/backend/templates/doppler-secret.yaml)
*   Tạo Custom Resource `DopplerSecret` để đồng bộ hóa từ Doppler Cloud vào native Secret `portfolio-secrets`.
*   Chỉ khởi tạo khi `secretsProvider == "doppler"`.

#### [MODIFY] [sealed-secret.yaml](file:///d:/DATA/Portfolio/infra/apps/backend/templates/sealed-secret.yaml)
*   Bọc toàn bộ file trong điều kiện `{{- if eq .Values.secretsProvider "sealed-secrets" }}` để tránh xung đột tài nguyên.

#### [MODIFY] [secret.yaml](file:///d:/DATA/Portfolio/infra/apps/postgres/templates/secret.yaml)
*   Chỉnh sửa điều kiện để chỉ tạo SealedSecret của PostgreSQL khi `secretsProvider` được cấu hình là `"sealed-secrets"`.

---

### Component: Local Development

Tích hợp Doppler CLI vào tiến trình phát triển local của lập trình viên.

***

#### [MODIFY] [package.json](file:///d:/DATA/Portfolio/backend/package.json)
*   Cập nhật scripts khởi chạy (ví dụ: `dev`) chạy thông qua `doppler run`.

#### [MODIFY] [package.json](file:///d:/DATA/Portfolio/frontend/package.json)
*   Cập nhật scripts khởi chạy chạy thông qua `doppler run`.

---

### Component: Ansible / VM Deployment

Tích hợp lấy biến môi trường tự động khi deploy VPS bằng Ansible.

***

#### [MODIFY] [.env.ansible.example](file:///d:/DATA/Portfolio/infra/ansible/.env.ansible.example)
*   Bổ sung hướng dẫn cài đặt Doppler CLI trên VPS và xuất biến tự động thông qua Service Token của Ansible.

---

## Verification Plan

### Automated Tests
Không áp dụng test tự động trực tiếp trên mã nguồn vì đây là thay đổi cấu hình hạ tầng.

### Manual Verification
1. **Kiểm tra luồng chính (Doppler):**
   * Đẩy file `doppler-operator.yaml` lên Git để ArgoCD tự động cài đặt Operator.
   * Tạo K8s Secret `doppler-token-secret` chứa Service Token giải mã được bằng SealedSecrets.
   * Đẩy cấu hình Helm với `secretsProvider: "doppler"`.
   * Chạy lệnh: `kubectl get secrets portfolio-secrets -o yaml` để kiểm tra secrets có được kéo từ Doppler về đầy đủ hay không.
2. **Kiểm tra luồng dự phòng (Fallback):**
   * Đẩy cấu hình Helm với `secretsProvider: "sealed-secrets"`.
   * Xác nhận tài nguyên `DopplerSecret` biến mất và tệp `SealedSecret` được kích hoạt giải mã.
   * Xác nhận native Secret `portfolio-secrets` vẫn tồn tại và chứa các giá trị dự phòng được mã hóa trên Git.
