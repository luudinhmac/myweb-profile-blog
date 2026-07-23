# 🛠️ Hướng Dẫn Quản Trị Cloudflare R2 Bằng Terraform (IaC)

Tài liệu này hướng dẫn chi tiết cách quản lý cấu hình các Cloudflare R2 Buckets dưới dạng Infrastructure as Code (IaC) sử dụng Terraform.

---

## 1. Cấu Trúc Thư Mục Cấu Hình
Toàn bộ mã nguồn Terraform được lưu trữ tại thư mục [infra/terraform/](../terraform/):

*   `providers.tf`: Định nghĩa provider Cloudflare và phiên bản Terraform tối thiểu (`>= 1.5.0`).
*   `variables.tf`: Khai báo các biến đầu vào (`cloudflare_api_token`, `cloudflare_account_id`).
*   `r2.tf`: Khai báo 5 tài nguyên R2 Buckets và cấu hình `import` block tương ứng.
*   `zero_trust.tf`: Khai báo tài nguyên Cloudflare Tunnel, Access Applications, Access Policies, và các `import` block tương ứng.
*   `backend.tf`: Khai báo cấu hình Remote Backend lưu trữ state tập trung (dùng cơ chế Partial Backend).
*   `terraform.tfvars.example`: File mẫu chứa các biến cấu hình tài khoản Cloudflare (Local).
*   `backend.tfvars.example`: File mẫu chứa các thông số kết nối Remote Backend (Local).

*Lưu ý:* Các tệp tin cấu hình thực tế chứa thông tin nhạy cảm (`terraform.tfvars`, `backend.tfvars`, `*.tfstate`) đều được thêm vào `.gitignore` để tránh bị đẩy lên Git.

---

## 2. Chuẩn Bị Trước Khi Chạy
Để thực thi Terraform, bạn cần chuẩn bị các thông tin sau:

1.  **Cài đặt Terraform**: Đảm bảo máy cá nhân đã cài đặt Terraform CLI (Phiên bản gợi ý `>= 1.5.0`).
2.  **Tạo Cloudflare API Token**:
    *   Truy cập **My Profile** > **API Tokens** > **Create Token** > **Create Custom Token**.
    *   Đặt tên gợi nhớ (ví dụ: `terraform-token`).
    *   Phần **Permissions**: Chọn `Account` -> `Cloudflare R2` -> `Edit`.
    *   Copy token nhận được (Token này dùng cho file `terraform.tfvars`).
3.  **Tạo Cloudflare R2 Credentials (S3-compatible)**:
    *   Truy cập **R2** > **Manage R2 API Tokens** > **Create API Token**.
    *   Đặt tên (ví dụ: `terraform-backend-token`).
    *   Phần **Permissions**: Chọn **Object Read & Write** (giới hạn quyền chỉ trên bucket `terraform-state-blog` để bảo mật tối đa).
    *   Lấy cặp key `Access Key ID` và `Secret Access Key` (Key này dùng cho biến môi trường lưu State).
4.  **Lấy Cloudflare Account ID**: Copy mã **Account ID** xuất hiện trên trang quản trị hoặc từ endpoint R2 của bạn.

---

## 3. Cấu Hinh Tệp Tin Cục Bộ (Local Settings)

Từ thư mục `infra/terraform/`, tiến hành sao chép các tệp tin cấu hình mẫu và điền thông tin tượng trưng của bạn:

```bash
# Tạo cấu hình biến tài khoản
cp terraform.tfvars.example terraform.tfvars

# Tạo cấu hình kết nối Backend
cp backend.tfvars.example backend.tfvars
```

### Tệp `terraform.tfvars` (Ví dụ tượng trưng)
```hcl
cloudflare_account_id = "your_cloudflare_account_id_here"
cloudflare_api_token  = "your_cloudflare_api_token_here"
```

### Tệp `backend.tfvars` (Ví dụ tượng trưng)
```hcl
bucket    = "terraform-state-blog"
endpoints = {
  s3 = "https://your_cloudflare_account_id_here.r2.cloudflarestorage.com"
}
```

---

## 4. Các Lệnh Vận Hành Cơ Bản

Hãy di chuyển vào thư mục Terraform trước khi thực hiện:
```bash
cd infra/terraform
```

### 4.1. Khởi tạo Dự án (Initialize)
Tải các plugins provider và chuẩn bị thư mục làm việc:
```bash
terraform init
```

### 4.2. Kiểm tra lỗi cú pháp (Validate)
```bash
terraform validate
```

### 4.3. Lập kế hoạch thay đổi (Plan)
So sánh cấu hình code với tài nguyên thực tế để đưa ra kế hoạch thay đổi (Dry Run):
```bash
terraform plan
```

### 4.4. Áp dụng thay đổi (Apply)
Thực thi thay đổi lên Cloudflare (Tạo mới, cập nhật hoặc xóa tài nguyên):
```bash
terraform apply
```

---

## 5. Quy Trình Cấu Hình Remote Backend (Di chuyển State)

Khi di chuyển từ local state (`terraform.tfstate`) sang remote backend trên Cloudflare R2, thực hiện theo các bước sau:

### Bước 5.1: Tạo bucket chứa State trước
Chạy lệnh apply để Terraform khởi tạo bucket `terraform-state-blog` trên Cloudflare:
```bash
# Đảm bảo chưa kích hoạt backend block hoặc chạy ở local state trước
terraform apply
```

### Bước 5.2: Khai báo biến môi trường xác thực (AWS-style)
Do R2 tương thích chuẩn S3 API, chúng ta cần nạp key của R2 API Token vào biến môi trường của Shell hiện tại:

*   **Trên Windows (PowerShell)**:
    ```powershell
    $env:AWS_ACCESS_KEY_ID="your_r2_access_key_id"
    $env:AWS_SECRET_ACCESS_KEY="your_r2_secret_access_key"
    ```
*   **Trên Linux / macOS (Bash/Zsh)**:
    ```bash
    export AWS_ACCESS_KEY_ID="your_r2_access_key_id"
    export AWS_SECRET_ACCESS_KEY="your_r2_secret_access_key"
    ```

### Bước 5.3: Chạy lệnh di chuyển State
Khởi tạo lại backend và di chuyển dữ liệu state từ máy local lên Cloudflare R2:
```bash
terraform init -backend-config="backend.tfvars" -migrate-state
```
Khi hệ thống hiển thị thông báo hỏi:
> Do you want to copy existing state to the new backend?

Gõ **`yes`** và nhấn **Enter**. Trạng thái sẽ được tải lên Cloudflare R2 thành công. Bạn có thể xóa file `terraform.tfstate` và `terraform.tfstate.backup` cục bộ một cách an sau khi hoàn thành.

---

## 6. Hướng Dẫn Quản Lý Zero Trust & Tunnel Bằng Terraform

Hệ thống cho phép quản trị toàn bộ Cloudflare Tunnel và Zero Trust Access Applications/Policies thông qua file cấu hình `zero_trust.tf`.

### Bước 6.1: Bổ sung quyền cho API Token
Trước khi chạy, hãy truy cập **My Profile** > **API Tokens** trên Cloudflare Dashboard, tìm token tương ứng với biến `cloudflare_api_token` trong `terraform.tfvars` và bổ sung 3 quyền sau:
1.  **Account** -> **Cloudflare Tunnel** -> **Edit**
2.  **Account** -> **Access: Apps and Policies** -> **Edit**
3.  **Zone** -> **DNS** -> **Edit** (Nếu muốn quản lý bản ghi DNS CNAME trỏ vào Tunnel).

### Bước 6.2: Thu thập UUID của tài nguyên hiện có
Bạn cần điền các UUID thực tế của các ứng dụng Zero Trust hiện có trên tài khoản của bạn vào các `import` block trong file `zero_trust.tf`:
*   **Tunnel UUID**: Đã được tự động điền sẵn (`b703e46c-b30c-4fa2-840d-649d370a8fc8`).
*   **Application UUID**: Lấy từ Zero Trust Dashboard > **Access** > **Applications** > Click vào ứng dụng `argocd`, `grafana`, `k8s` để copy UUID của chúng.
*   **Zone ID**: Lấy từ trang quản trị domain `luumac.io.vn` trên Cloudflare Dashboard.

Điền các giá trị trên vào tệp `terraform.tfvars` hoặc gán trực tiếp vào defaults trong `zero_trust.tf` (hoặc truyền qua biến dòng lệnh).

### Bước 6.3: Thực hiện Import tài nguyên Zero Trust
Chạy lệnh lập kế hoạch để kiểm tra xem Terraform có nhận diện đúng import block không:
```bash
terraform plan
```
*Kết quả mong đợi:* Báo cáo hiển thị có **4 tài nguyên cần import** (bao gồm Tunnel, và 3 ứng dụng Access), **0 tài nguyên cần thêm mới** và **0 tài nguyên cần hủy**.

Thực thi import tài nguyên vào file remote state:
```bash
terraform apply
```

Sau khi hoàn thành, mọi chỉnh sửa liên quan đến Ingress Route của Tunnel hay chính sách phân quyền email truy cập (Access Policy) đều có thể được cập nhật trực tiếp qua mã nguồn tại `zero_trust.tf`.

---

## 7. Lưu ý Quan Trọng & Best Practices

1.  **Tuyệt đối không commit các file nhạy cảm**: Không bao giờ bỏ ghi chú hoặc xóa `.tfvars` và `*.tfstate` khỏi `.gitignore`.
2.  **Khóa State (State Locking)**: Cloudflare R2 hiện tại tương thích với chuẩn S3 API nhưng không hỗ trợ cơ chế khóa trạng thái (State Locking) của DynamoDB. Do đó, **tránh chạy đồng thời các lệnh `terraform apply`** từ nhiều máy khác nhau để ngăn ngừa xung đột ghi đè dữ liệu.

