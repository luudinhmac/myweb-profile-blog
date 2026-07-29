# Hướng dẫn Tích hợp GitLab CI/CD với ArgoCD & Bỏ qua Cloudflare Access (Zero Trust)

Tài liệu này ghi chép chi tiết toàn bộ quá trình khảo sát, các lệnh đã thực hiện, cấu hình hệ thống và mã nguồn được cập nhật để giải quyết bài toán: **Đảm bảo Pipeline GitLab CI/CD chỉ báo deploy thành công khi ArgoCD đã đồng bộ và rollout thành công lên cụm Kubernetes**.

---

## 1. Vấn đề của quy trình cũ
* **Deploy ảo (False Success)**: Pipeline đẩy manifest lên repository `infra` và lập tức báo deploy thành công. Thực tế ứng dụng vẫn phải chờ ArgoCD polling (mặc định 3 phút) mới được đồng bộ lên Kubernetes.
* **Thời gian chờ cứng không tối ưu**: Job smoke test sử dụng `sleep 150` giây để ước lượng thời gian sync của ArgoCD, gây lãng phí thời gian và không phản ánh đúng trạng thái pod mới.
* **Rào cản Cloudflare Access**: Trang quản trị `argocd.luumac.io.vn` được bảo vệ bởi Cloudflare Access OTP khiến việc kết nối của ArgoCD CLI từ ngoài internet bị chặn hoàn toàn.
* **Chặn IP Allowlist**: Traefik Ingress sử dụng IP Allowlist (`admin-allowlist`) chặn toàn bộ IP nằm ngoài mạng LAN, VPN và IP modem cũ của quản trị viên.

---

## 2. Nhật ký thao tác & Các lệnh đã thực hiện

### BƯỚC 1: Cấu hình Tài khoản cục bộ trên ArgoCD (Local Account)
Tạo tài khoản chuyên dụng `gitlab-ci` để chạy các tác vụ CI/CD tự động.

1. **Thêm tài khoản `gitlab-ci` vào ConfigMap quản trị của ArgoCD (`argocd-cm`)**:
   ```bash
   kubectl patch configmap argocd-cm -n argocd --type=merge -p '{"data":{"accounts.gitlab-ci":"apiKey"}}'
   ```
2. **Cấu hình RBAC phân quyền tối thiểu (Get & Sync các app trong project `apps-project`)**:
   Áp dụng file patch cấu hình vào ConfigMap `argocd-rbac-cm` để cấp quyền cho user `gitlab-ci`:
   ```bash
   kubectl patch configmap argocd-rbac-cm -n argocd --type=merge -p '{"data":{"policy.csv":"p, role:gitlab-ci-role, applications, get, apps-project/*, allow\np, role:gitlab-ci-role, applications, sync, apps-project/*, allow\ng, gitlab-ci, role:gitlab-ci-role\n"}}'
   ```
3. **Sinh Token API vĩnh viễn (ARGOCD_TOKEN) cho `gitlab-ci`**:
   Vì máy local chưa cài ArgoCD CLI, chúng ta truy cập trực tiếp vào pod `argocd-server` để thực hiện:
   * **Tìm tên pod**:
     ```bash
     kubectl get pods -n argocd | grep argocd-server
     # Kết quả: argocd-server-586f84646f-vbqc8
     ```
   * **Lấy mật khẩu admin ban đầu của ArgoCD**:
     ```powershell
     [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String((kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}')))

     ```
   * **Đăng nhập vào CLI bên trong container**:
     ```bash
     kubectl exec argocd-server-586f84646f-vbqc8 -n argocd -- argocd login localhost:8080 --username admin --password <admin-password> --insecure --plaintext
     ```
   * **Sinh token không thời hạn cho account `gitlab-ci`**:
     ```bash
     kubectl exec argocd-server-586f84646f-vbqc8 -n argocd -- argocd account generate-token --account gitlab-ci
     ```
     *Lưu lại chuỗi Token JWT sinh ra để cấu hình lên GitLab.*

---

### BƯỚC 2: Gỡ bỏ IP Allowlist trên Ingress của ArgoCD Server
Vì ArgoCD đã được bảo vệ bởi Cloudflare Access (Zero Trust), chúng ta gỡ bỏ bộ lọc IP của Traefik để các request đi qua Cloudflare không bị block.

1. **Gỡ bỏ IP Allowlist trên Ingress Staging (`argocd-server-ingress`)**:
   Thay đổi annotation `traefik.ingress.kubernetes.io/router.middlewares` để chỉ giữ lại middleware nén (`infra-infra-compress@kubernetescrd`):
   ```bash
   kubectl patch ingress argocd-server-ingress -n argocd --type=merge -p '{"metadata":{"annotations":{"traefik.ingress.kubernetes.io/router.middlewares":"infra-infra-compress@kubernetescrd"}}}'
   ```
2. **Gỡ bỏ IP Allowlist trên Ingress Production (`platform-argocd-ingress-production`)**:
   Xóa bỏ hoàn toàn annotation middleware chặn IP:
   ```bash
   kubectl patch ingress platform-argocd-ingress-production -n argocd --type=merge -p '{"metadata":{"annotations":{"traefik.ingress.kubernetes.io/router.middlewares":null}}}'
   ```

---

### BƯỚC 3: Cấu hình Cloudflare Access Service Token
Để GitLab Runner bypass màn hình đăng nhập OTP Gmail của Cloudflare Access khi gọi API ArgoCD qua Internet.

1. **Tạo Service Token trên Cloudflare Zero Trust**:
   * Dashboard $\rightarrow$ **Access** $\rightarrow$ **Service Tokens** $\rightarrow$ **Create Service Token** (Tên: `gitlab-ci`).
   * Lưu lại: `CF-Access-Client-Id` và `CF-Access-Client-Secret`.
2. **Cấu hình Application Policy**:
   * Thêm Policy mới trong ứng dụng `argocd.luumac.io.vn` với Action là **`Bypass`** và điều kiện là **`Service Token`** (chọn token `gitlab-ci`).

---

### BƯỚC 4: Cấu hình biến môi trường trên GitLab
Truy cập **GitLab Repository** $\rightarrow$ **Settings** $\rightarrow$ **CI/CD** $\rightarrow$ **Variables**, cấu hình 4 biến môi trường dưới đây (Tất cả đều **BỎ** tích chọn `Protect` và **BẬT** tích chọn `Masked` để bảo mật):

| Tên biến | Giá trị | Ý nghĩa |
| :--- | :--- | :--- |
| `ARGOCD_SERVER` | `argocd.luumac.io.vn` | Địa chỉ domain ArgoCD (không chứa `https://`) |
| `ARGOCD_TOKEN` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Token API của account `gitlab-ci` tạo ở Bước 1 |
| `CF_ACCESS_CLIENT_ID` | `xxxx.access` | Client ID của Cloudflare Service Token |
| `CF_ACCESS_CLIENT_SECRET` | `xxxx` | Client Secret của Cloudflare Service Token |

---

### BƯỚC 5: Cấu hình CI/CD Pipelines trong dự án

Cập nhật các file cấu hình `.gitlab-ci.yml` của **Backend** và **Frontend** để sử dụng ArgoCD CLI đồng bộ trực tiếp.

#### Các thay đổi chính:
1. **Đăng nhập và Xác thực Stateless**:
   Thay vì chạy lệnh `argocd login` ghi file cấu hình local (dễ lỗi permission/filesystem read-only trong container), chúng ta chỉ cần export token vào biến môi trường:
   ```bash
   export ARGOCD_AUTH_TOKEN="$ARGOCD_TOKEN"
   ```
2. **Đồng bộ hóa & Chờ Rollout**:
   Sử dụng lệnh `argocd app sync` để trigger đồng bộ ngay lập tức và `argocd app wait` để block job chờ cho đến khi tất cả các Pod mới chạy Healthy. Cần truyền thêm các headers Cloudflare Service Token qua flag `-H`:
   ```bash
   argocd app sync <app-name> --insecure --grpc-web \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
     
   argocd app wait <app-name> --sync --health --timeout 300 --insecure --grpc-web \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
   ```
3. **Loại bỏ Sleep cứng**:
   Vì job `deploy` đã chờ rollout xong thực tế, ở job `smoke_test` tiếp theo, chúng ta loại bỏ hoàn toàn khối `sleep 150` (hoặc `sleep 180`) giây.
4. **Kiểm tra phiên bản thực tế (Backend)**:
   Truyền thêm tham số thứ 3 vào script `smoke_test.sh` để so sánh chính xác phiên bản pod mới chạy so với commit hash:
   ```bash
   sh .gitlab-ci/smoke_test.sh https://api-staging.luumac.io.vn staging dev-$CI_COMMIT_SHORT_SHA
   ```

---

## 3. Bản đồ File sửa đổi cụ thể

### [MODIFY] [backend/.gitlab-ci.yml](file:///d:/DATA/Portfolio/backend/.gitlab-ci.yml)
* **Job `deploy_staging` & `deploy_production`**: Bổ sung logic tự động tải `argocd` CLI, cấu hình biến `ARGOCD_AUTH_TOKEN` và chạy sync/wait qua Cloudflare Access.
* **Job `smoke_test_staging` & `smoke_test_production`**: Loại bỏ `sleep 150`, truyền thêm tham số version (`dev-$CI_COMMIT_SHORT_SHA` và `$CI_COMMIT_TAG`).

### [MODIFY] [frontend/.gitlab-ci.yml](file:///d:/DATA/Portfolio/frontend/.gitlab-ci.yml)
* **Job `deploy_staging` & `deploy_production`**: Bổ sung logic tải ArgoCD CLI, đồng bộ sync/wait kèm header Cloudflare tương tự Backend.
* **Job `smoke_test_staging` & `smoke_test_production`**: Loại bỏ `sleep 150` / `sleep 180`, thực hiện curl test trực tiếp ngay khi pod mới rollout xong.

---

## 4. Hướng dẫn vận hành & Xử lý sự cố tương lai

### Lỗi 1: Cloudflare Access thu hồi Token
* **Hiện tượng**: Log job deploy báo `unexpected EOF` hoặc `403 Forbidden` khi gọi `argocd` CLI.
* **Xử lý**: Kiểm tra lại hạn dùng (Expiration) của Service Token trên Cloudflare Zero Trust. Nếu đã hết hạn, tạo Service Token mới, cập nhật lại biến `CF_ACCESS_CLIENT_ID` và `CF_ACCESS_CLIENT_SECRET` trên GitLab.

### Lỗi 2: Trùng lặp hoặc xung đột push git trong Deploy job
* **Hiện tượng**: Job deploy bị đứng hoặc push git bị conflict quá 5 lần dẫn đến thất bại.
* **Xử lý**: Điều này là bình thường nếu có nhiều pipeline chạy deploy staging đồng thời (Race condition). Job deploy được cấu hình thử lại (retry) 2 lần tự động trên GitLab. Nếu vẫn lỗi, hãy chạy lại (Retry) thủ công job deploy bị lỗi.
