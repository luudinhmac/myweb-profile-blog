# 🚨 Common Issues & Operations Runbook

Tài liệu này ghi lại các lỗi vận hành thường gặp trên cụm Kubernetes, cơ sở dữ liệu và hạ tầng mạng, kèm theo hướng dẫn khắc phục chi tiết từng bước.

---

## 1. Lỗi kẹt Database Migrations (Prisma Migration Lock)

### Triệu chứng:
Khi deploy phiên bản mới, Pod Backend liên tục báo lỗi crash/restart ở container khởi tạo `prisma-migrate`. Log báo lỗi:
`Database migration is locked` hoặc `Database is already up to date but local schemas differ`.

### Cách khắc phục:
1.  **Hạ số lượng Pod Backend về 0** để giải phóng tất cả connection đang lock DB:
    ```bash
    kubectl scale deployment/portfolio-backend-production -n production --replicas=0
    ```
2.  **Đăng nhập trực tiếp vào Pod Database PostgreSQL** và thực hiện xóa bản ghi lock trong bảng prisma migrations (hoặc drop/recreate DB nếu ở Staging):
    ```bash
    kubectl exec -it postgres-production-0 -n database-production -- psql -U portfolio_user -d portfolio_production
    ```
    *Trong psql CLI, thực thi lệnh:*
    ```sql
    DELETE FROM _prisma_migrations WHERE logs LIKE '%lock%';
    ```
3.  **Tăng số lượng Pod Backend trở lại**:
    ```bash
    kubectl scale deployment/portfolio-backend-production -n production --replicas=2
    ```
4.  Theo dõi logs để xác nhận migration đã chạy thành công:
    ```bash
    kubectl logs deployment/portfolio-backend-production -n production -c prisma-migrate
    ```

---

## 2. Bị chặn truy cập trang Quản trị (403 Forbidden / IP Lockout)

### Triệu chứng:
Khi truy cập các trang quản trị như ArgoCD, Grafana hay Kubernetes Dashboard, trình duyệt hiển thị lỗi **403 Forbidden**. Lỗi xảy ra do IP Public của Quản trị viên thay đổi, khiến Ingress Controller (Traefik) chặn truy cập theo quy định của Middleware `admin-allowlist`.

### Cách khắc phục:
1.  **Lấy IP Public hiện tại** của bạn:
    *   Trình duyệt: Truy cập trang [ifconfig.me](https://ifconfig.me) hoặc run lệnh PowerShell:
        ```powershell
        (Invoke-WebRequest ifconfig.me).Content.Trim()
        ```
2.  **Mở SSH Tunnel vượt rào bảo mật**:
    ```powershell
    Start-Process ssh -ArgumentList "-L 6443:10.200.0.1:6443 -N k8s-prod" -WindowStyle Hidden
    ```
3.  **Sửa cấu hình Middleware trực tiếp trên cụm K8s**:
    ```bash
    kubectl edit middleware admin-allowlist -n infra
    ```
    *Tìm đến phần `sourceRange` và cập nhật địa chỉ IP mới:*
    ```yaml
    spec:
      ipWhiteList:
        sourceRange:
          - <NEW_IP_PUBLIC>/32
    ```
4.  Cập nhật file cấu hình Ansible tại `infra/ansible/roles/infra-services/tasks/main.yml` để lưu lại IP mới này, tránh bị hoàn tác ở lần chạy tiếp theo.

---

## 3. Lỗi kết nối Cloudflare Tunnel (Tunnel Offline)

### Triệu chứng:
Toàn bộ hệ thống tên miền (blog.luumac.io.vn, api.luumac.io.vn) báo lỗi **502 Bad Gateway** hoặc **1033 Tunnel Connection Error** trên màn hình Cloudflare.

### Cách khắc phục:
1.  Kiểm tra trạng thái hoạt động của Pod đại diện tunnel:
    ```bash
    kubectl get pods -n infra | grep cloudflared
    ```
2.  Nếu Pod đang ở trạng thái `CrashLoopBackOff`, kiểm tra log:
    ```bash
    kubectl logs deployment/cloudflared -n infra
    ```
3.  **Lỗi thường gặp**: Token xác thực của Cloudflare Tunnel hết hạn hoặc bị thu hồi.
    *   Truy cập Cloudflare Zero Trust Dashboard > Networks > Tunnels.
    *   Lấy token mới của Tunnel.
    *   Cập nhật Secret của `cloudflared` trong K8s:
        ```bash
        kubectl create secret generic tunnel-credentials --from-literal=credentials.json=<NEW_TOKEN> -n infra --dry-run=client -o yaml | kubectl apply -f -
        ```
    *   Khởi động lại Deployment:
        ```bash
        kubectl rollout restart deployment/cloudflared -n infra
        ```

---

## 4. Các lỗi hạ tầng Kubernetes và định tuyến Ingress (Traefik/PVC)

### 4.1. Lỗi PVC không Bind được PV (Persistent Volume Pending)
*   **Nguyên nhân**: Các PV thiếu `storageClassName` cụ thể dẫn đến xung đột với trình provisioner mặc định hoặc không tự động ghép cặp (bound).
*   **Cách khắc phục**: Ép cứng `storageClassName` (ví dụ: `manual` hoặc `longhorn`) và chỉ định rõ thuộc tính `volumeName` trong khai báo của từng PVC.

### 4.2. Lỗi thứ tự Deploy khiến Pod treo trạng thái `Pending`
*   **Nguyên nhân**: Service/App được triển khai trước khi Persistent Volume (PV) hoặc lưu trữ vật lý sẵn sàng, khiến Pod không thể mount ổ đĩa.
*   **Cách khắc phục**: Điều chỉnh quy trình triển khai (Ansible / GitOps) để nạp các tài nguyên lưu trữ (Storage/PV/PVC) trước, đồng thời bổ sung task/job chờ đợi (`Wait for PV`) trước khi deploy ứng dụng.

### 4.3. Ingress Traefik không mở cổng hoặc bị chặn 80/443
*   **Nguyên nhân**: Sử dụng `NodePort` mặc định của Helm chart hoặc `hostPort` bị xung đột/chặn bởi CNI (như Cilium).
*   **Cách khắc phục**: Chuyển cấu hình DaemonSet của Traefik sang chế độ mạng máy chủ (`hostNetwork: true`).

### 4.4. Traefik bị lỗi Permission Denied khi Bind cổng mạng
*   **Nguyên nhân**: Các cổng dưới 1024 (bao gồm 80/443) là cổng đặc quyền trên Linux, trong khi container Traefik mặc định chạy với user thường không thể tự bind.
*   **Cách khắc phục**: Cấu hình `securityContext` trong Helm values của Traefik để chạy dưới quyền `root` (UID 0) hoặc cấp thêm quyền `NET_BIND_SERVICE` trong Linux capabilities.

### 4.5. Lỗi định tuyến Ingress trả về 404 Not Found
*   **Nguyên nhân**: Ingress nằm khác namespace với Service cần trỏ tới, hoặc Traefik chặn chuyển tiếp `ExternalName` theo mặc định.
*   **Cách khắc phục**: Đảm bảo Ingress được đặt cùng namespace với Pod/Service ứng dụng (`blog-prod` hoặc `blog-staging`), đồng thời kích hoạt thuộc tính cấu hình `allowExternalNameServices` trong Traefik nếu cần chuyển tiếp liên namespace.
