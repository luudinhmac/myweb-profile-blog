# Kế hoạch chuyển đổi quản lý Secrets sang Doppler (Dự phòng bằng Sealed Secrets)

Kế hoạch này mô tả các bước chi tiết để chuyển đổi cơ chế quản lý biến môi trường và secrets của dự án sang **Doppler** làm hệ thống chính (Primary), đồng thời giữ nguyên **Bitnami Sealed Secrets** làm phương án dự phòng (Backup/Fallback) khi Doppler gặp sự cố hoặc offline.

---

## User Review Required

> [!IMPORTANT]
> **Yêu cầu cài đặt Doppler Operator:**
> Trước khi áp dụng cấu hình GitOps này, cụm Kubernetes `k8s-prod` của bạn cần cài đặt **Doppler Kubernetes Operator** bằng Helm:
> ```bash
> helm repo add doppler-helm-charts https://helm.doppler.com
> helm repo update
> helm install doppler-operator doppler-helm-charts/doppler-operator --namespace doppler-operator --create-namespace
> ```

> [!WARNING]
> **Quản lý Token của Doppler:**
> Doppler Operator yêu cầu một Service Token (`DOPPLER_TOKEN`) để xác thực và tải secrets. Để tuân thủ GitOps an toàn, chúng tôi khuyến nghị mã hóa Token này bằng chính Sealed Secrets và deploy nó dưới dạng một Secret phụ tên là `doppler-token-secret` trước khi chạy Helm deploy.

---

## Open Questions

> [!NOTE]
> 1. Bạn muốn chúng tôi tạo sẵn file mã hóa Sealed Secret cho `DOPPLER_TOKEN` (để bạn nạp mật mã vào) hay bạn sẽ tự tạo thủ công K8s Secret `doppler-token-secret` chứa key `dopplerToken` trên cụm?
> 2. Đối với môi trường Local, bạn muốn chạy trực tiếp qua `doppler run` hay muốn Doppler tự động kết xuất ra tệp `.env` tạm thời để tránh sửa đổi lệnh khởi động hiện tại?

---

## Proposed Changes

### Component: Helm Charts (Kubernetes & GitOps)

Sửa đổi Helm Charts của backend và postgres để hỗ trợ lựa chọn nguồn cấp secrets động qua biến `secretsProvider` (`"doppler"` hoặc `"sealed-secrets"`).

***

#### [MODIFY] [values.yaml](file:///d:/DATA/Portfolio/infra/apps/backend/values.yaml)
*   Thêm biến cấu hình `secretsProvider` mặc định là `"doppler"`.
*   Thêm block cấu hình cho Doppler (tokenSecretName).

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
   * Cài đặt `doppler-operator` lên cụm.
   * Tạo K8s Secret `doppler-token-secret` chứa Service Token từ Doppler.
   * Đẩy cấu hình Helm với `secretsProvider: "doppler"`.
   * Chạy lệnh: `kubectl get secrets portfolio-secrets -o yaml` để kiểm tra secrets có được kéo từ Doppler về đầy đủ hay không.
2. **Kiểm tra luồng dự phòng (Fallback):**
   * Đẩy cấu hình Helm với `secretsProvider: "sealed-secrets"`.
   * Xác nhận tài nguyên `DopplerSecret` biến mất và tệp `SealedSecret` được kích hoạt giải mã.
   * Xác nhận native Secret `portfolio-secrets` vẫn tồn tại và chứa các giá trị dự phòng được mã hóa trên Git.
