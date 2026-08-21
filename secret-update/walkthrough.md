# Kết quả Triển khai: Chuyển đổi quản lý Secrets sang Doppler (Có dự phòng)

Quá trình tích hợp hệ thống quản lý secrets **Doppler** (Làm chính) và duy trì **Bitnami Sealed Secrets** (Làm dự phòng) đã được hoàn thành xuất sắc.

Dưới đây là tóm tắt các tệp tin cấu hình đã được thay đổi/tạo mới và hướng dẫn vận hành cho bạn.

---

## Các thay đổi đã được thực hiện

### 1. Tự động hóa cài đặt Doppler Operator (ArgoCD Platform)
*   **[NEW]** [`doppler-operator.yaml`](file:///d:/DATA/Portfolio/infra/argocd/applications/platform/doppler-operator.yaml): Tạo file ứng dụng ArgoCD tự động kéo và triển khai Operator từ Helm Chart của Doppler lên namespace `doppler-operator` trong cụm `k8s-prod` của bạn.

### 2. Cấu hình Helm Chart của App (Staging & Production)
*   **[MODIFY]** [`values.yaml (backend)`](file:///d:/DATA/Portfolio/infra/apps/backend/values.yaml): Thêm cấu hình `secretsProvider: "doppler"` và khai báo tên K8s Secret chứa token của Doppler (`doppler-token-secret`).
*   **[NEW]** [`doppler-secret.yaml (backend template)`](file:///d:/DATA/Portfolio/infra/apps/backend/templates/doppler-secret.yaml): Bản thiết kế (template) K8s Custom Resource `DopplerSecret` để Operator tự tạo ra Secret `portfolio-secrets` từ Doppler Cloud.
*   **[MODIFY]** [`sealed-secret.yaml (backend template)`](file:///d:/DATA/Portfolio/infra/apps/backend/templates/sealed-secret.yaml): Giới hạn việc render SealedSecret này chỉ khi cấu hình `secretsProvider` bằng `"sealed-secrets"`.
*   
*   **[MODIFY]** [`values.yaml (postgres)`](file:///d:/DATA/Portfolio/infra/apps/postgres/values.yaml): Cấu hình tương thích `secretsProvider` cho database.
*   **[MODIFY]** [`secret.yaml (postgres template)`](file:///d:/DATA/Portfolio/infra/apps/postgres/templates/secret.yaml): Hỗ trợ sinh `DopplerSecret`, `SealedSecret` hoặc native `Secret` tùy thuộc cấu hình `secretsProvider`.

### 3. Tích hợp Local Development
*   **[MODIFY]** [`package.json (backend)`](file:///d:/DATA/Portfolio/backend/package.json): Thêm lệnh `pnpm dev:doppler` để khởi chạy NestJS cục bộ thông qua `doppler run`.
*   **[MODIFY]** [`package.json (frontend)`](file:///d:/DATA/Portfolio/frontend/package.json): Thêm lệnh `pnpm dev:doppler` để khởi chạy Next.js cục bộ thông qua `doppler run`.

### 4. Tích hợp Deployment VPS (Ansible)
*   **[MODIFY]** [`.env.ansible.example`](file:///d:/DATA/Portfolio/infra/ansible/.env.ansible.example): Thêm hướng dẫn và biến `DOPPLER_TOKEN` phục vụ việc chạy playbook deploy VPS tự động qua Doppler CLI.

---

## Hướng dẫn Vận hành & Xác thực

### 1. Chuẩn bị Token trên Kubernetes (k8s-prod)
Trước khi push các thay đổi này lên Git để ArgoCD đồng bộ:
1. Bạn hãy lấy **Service Token** của môi trường `Staging` trên Doppler Dashboard dự án `blog-portfolio` (đã khởi tạo trong hình chụp của bạn).
2. Tạo Secret chứa token này trên cụm K8s:
   ```bash
   kubectl create secret generic doppler-token-secret \
     --namespace portfolio \
     --from-literal=dopplerToken=dp.pt.xxx
   ```
   *(Tương tự, tạo `doppler-token-secret` trong namespace `database` cho PostgreSQL nếu cần).*

### 2. Kích hoạt luồng chạy chính (Doppler)
Mặc định cấu hình `secretsProvider` đã được gán là `"doppler"`. Khi push code lên Git:
* ArgoCD sẽ tự sync và cài đặt **Doppler Operator**.
* Operator sẽ đọc K8s Secret `doppler-token-secret`, kết nối Doppler Cloud, kéo các biến về và tự động ghi đè/tạo ra Secret `portfolio-secrets` trong namespace `portfolio`.
* Backend và Frontend sẽ tự đọc các secrets này để khởi động.

### 3. Kiểm tra tính năng dự phòng (Fallback to Sealed Secrets)
Nếu Doppler bị gián đoạn hoạt động, bạn chỉ cần thay đổi tệp `values.yaml` của ứng dụng hoặc override values của môi trường trong Git:
```yaml
secretsProvider: "sealed-secrets"
```
Đẩy thay đổi lên Git, ArgoCD sẽ:
1. Xóa tài nguyên `DopplerSecret`.
2. Kích hoạt render tài nguyên `SealedSecret` để giải mã dữ liệu mật mã lưu trên Git và ghi đè lại vào Secret `portfolio-secrets`.
3. Ứng dụng vẫn chạy liên tục bằng dữ liệu dự phòng.
