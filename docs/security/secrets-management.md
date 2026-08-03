# 🔐 Secrets Management (Sealed Secrets)

Tài liệu này đặc tả quy trình quản lý thông tin nhạy cảm (Secrets) trong dự án tuân theo triết lý **GitOps**. Chúng tôi sử dụng giải pháp **Bitnami Sealed Secrets** để mã hóa các thông tin nhạy cảm trước khi đẩy lên Git.

---

## 1. Tại sao lại dùng Sealed Secrets?

Trong mô hình GitOps, mọi manifest khai báo tài nguyên (bao gồm Deployments, Services, ConfigMaps, Secrets) bắt buộc phải được lưu trữ trên Git để ArgoCD đồng bộ. 
*   **Vấn đề**: K8s Secret thông thường chỉ được mã hóa dạng **Base64** (rất dễ bị giải mã ngược). Nếu push trực tiếp file này lên Git công khai hoặc nội bộ, các thông tin nhạy cảm (như mật khẩu DB, API keys) sẽ bị lộ.
*   **Giải pháp**: **Sealed Secrets** giải quyết vấn đề này bằng phương pháp mã hóa bất đối xứng (asymmetric encryption). 
    *   Chỉ có Controller chạy bên trong cụm Kubernetes (sở hữu Private Key) mới có thể giải mã được file.
    *   File sau khi mã hóa được gọi là **SealedSecret**, hoàn toàn an toàn khi lưu trữ công khai trên Git.

---

## 2. Luồng hoạt động mã hóa & giải mã

```mermaid
graph TD
    subgraph Developer Laptop
        RawSecret[Raw Secret K8s YAML] -->|kubeseat CLI + Public Key| SealedSecretYAML[SealedSecret YAML]
    end
    
    SealedSecretYAML -->|git push| Git[Infrastructure Repository]
    Git -->|Pull Sync| ArgoCD[ArgoCD Operator]
    
    subgraph K8s Cluster
        ArgoCD -->|Apply| SealedSecretCustomResource[SealedSecret Custom Resource]
        SealedSecretController[Sealed Secrets Controller] -->|Read Private Key| Decrypt[Decrypt Engine]
        SealedSecretCustomResource --> Decrypt
        Decrypt -->|Generate| K8sSecret[Standard Kubernetes Secret]
    end
```

---

## 3. Quy trình làm việc thực tế cho Nhà phát triển

Khi cần thêm mới hoặc cập nhật một Secret (ví dụ: `DATABASE_URL` cho Backend):

### Bước 1: Tạo tệp Secret K8s thô (Local only)
Tạo file `secret-raw.yaml` cục bộ trên máy tính của bạn (đảm bảo file này được thêm vào `.gitignore` để không bị push lên Git):
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: portfolio-backend-secrets
  namespace: production
type: Opaque
stringData:
  DATABASE_URL: "postgresql://portfolio_user:password@postgres-prod:5432/db"
  JWT_SECRET: "my-jwt-secret"
```

### Bước 2: Tiến hành mã hóa (Seal) bằng công cụ `kubeseal`
Chạy lệnh sau để mã hóa file thô thành SealedSecret sử dụng chứng chỉ công khai (Public Key) lấy từ cụm:
```bash
kubeseal --controller-name=sealed-secrets-controller \
         --controller-namespace=kube-system \
         --format yaml < secret-raw.yaml > secret-sealed.yaml
```

### Bước 3: Lưu trữ và Triển khai
*   Đẩy file `secret-sealed.yaml` lên kho lưu trữ `portfolio-infrastructure`.
*   ArgoCD sẽ nhận diện file, đồng bộ lên cụm. Sealed Secrets Controller trong cụm tự động giải mã ngược lại thành tệp Secret K8s thông thường cho ứng dụng sử dụng.

---

## 4. Sao lưu và Khôi phục Khóa giải mã (Secret Keys Backup)

> [!IMPORTANT]
> **Khóa giải mã là tài sản tối mật**:
> Nếu mất Private Key của Sealed Secrets Controller chạy trong cụm, toàn bộ các file `SealedSecret` trên Git sẽ **vĩnh viễn không thể giải mã được nữa** và bạn phải tự tay mã hóa lại tất cả từ đầu.

*   **Sao lưu khóa**:
    ```bash
    kubectl get secret -n kube-system -l sealedsecrets.bitnami.com/sealed-secrets-key -o yaml > sealed-secrets-private-keys.yaml
    ```
    *Cất giữ file `sealed-secrets-private-keys.yaml` này ở nơi tuyệt đối an toàn và ngoại tuyến.*

---

## 5. Ví dụ thực tế: Cấu hình Cloudflare Turnstile CAPTCHA

Tính năng bảo vệ CAPTCHA bằng Cloudflare Turnstile yêu cầu cấu hình các biến môi trường và bí mật sau trên Staging và Production.

### 5.1 Khởi tạo Widget qua Terraform (IaC)
Widget Turnstile được cấu hình tự động thông qua Terraform module `cloudflare-zero-trust` tại tệp `infra/terraform/modules/cloudflare-zero-trust/turnstile.tf`:
```hcl
resource "cloudflare_turnstile_widget" "portfolio_widget" {
  account_id     = var.cloudflare_account_id
  name           = "portfolio-turnstile-widget"
  domains        = ["blog.luumac.io.vn", "staging.luumac.io.vn"]
  mode           = "managed"
}
```
Sau khi chạy `terraform apply`, Terraform sẽ xuất ra (outputs) các giá trị:
*   `turnstile_site_key` (Public Key)
*   `turnstile_secret_key` (Secret Key - Nhạy cảm)

### 5.2 Cấu hình Frontend (Next.js)
Frontend sử dụng Site Key (Public) để hiển thị widget Turnstile. Đặt biến này trong tệp values của frontend:
*   **Staging**: [frontend-values.yaml](file:///d:/DATA/Portfolio/infra/environments/staging/frontend-values.yaml)
*   **Production**: [frontend-values.yaml](file:///d:/DATA/Portfolio/infra/environments/production/frontend-values.yaml)

```yaml
env:
  nextPublicTurnstileSiteKey: "0x4AAAAAAEE7aDdQIdRp6_w4" # Giá trị Site Key từ Terraform output
```

### 5.3 Mã hóa Secret Key cho Backend (NestJS) bằng `kubeseal`
Do `TURNSTILE_SECRET_KEY` là thông tin nhạy cảm, nó bắt buộc phải được mã hóa trước khi đưa vào GitOps values file:

1.  **Lấy Secret Key thô từ Terraform**:
    ```bash
    terraform output -raw turnstile_secret_key
    ```
2.  **Mã hóa thô (Raw sealing)**:
    *   **Production** (namespace `blog-prod`):
        ```powershell
        [System.Text.Encoding]::UTF8.GetBytes("0x4AAAAAAEE7aBA6QoIdO6yRpamnCc8iF6E") | .\kubeseal.exe --cert .\infra\sealed-cert.pem --raw --name portfolio-secrets --namespace blog-prod
        ```
    *   **Staging** (namespace `blog-staging`):
        ```powershell
        [System.Text.Encoding]::UTF8.GetBytes("0x4AAAAAAEE7aBA6QoIdO6yRpamnCc8iF6E") | .\kubeseal.exe --cert .\infra\sealed-cert.pem --raw --name portfolio-secrets --namespace blog-staging
        ```
3.  **Cập nhật giá trị mã hóa** vào trường `TURNSTILE_SECRET_KEY` dưới mục `sealedSecret.encryptedData` trong tệp `backend-values.yaml` của môi trường tương ứng.

### 5.4 Cơ chế Bypass Turnstile trong môi trường Testing/CI
Để phục vụ kịch bản kiểm thử khói tự động (`smoke-test.sh`) chạy trong GitLab CI/CD (không có môi trường trình duyệt để giải CAPTCHA), backend hỗ trợ cấu hình biến `BYPASS_TURNSTILE`:
*   **Staging**: Đặt `bypassTurnstile: "true"` trong [backend-values.yaml](file:///d:/DATA/Portfolio/infra/environments/staging/backend-values.yaml).
*   **Production**: Mặc định là `"false"` để luôn bắt buộc bảo vệ CAPTCHA chống Spam.
