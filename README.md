# Portfolio Infrastructure (GitOps Mode)

Dự án quản lý hạ tầng Kubernetes cho hệ thống Portfolio sử dụng mô hình **GitOps** với **ArgoCD**.

## 1. Khởi tạo Cluster (Ansible)
Sử dụng Ansible node (`192.168.157.50`) để cài đặt K8s, Cilium, Traefik, Cert-Manager và ArgoCD.

```powershell
# Chạy playbook từ Ansible node
ssh macld@192.168.157.50 "cd /home/macld/portfolio-infratructure/ansible && ansible-playbook -i inventory.ini playbooks/setup_cluster.yml --extra-vars 'ansible_become_pass=admin'"
```

## 2. Quản lý Hạ tầng với ArgoCD

### Truy cập Dashboard
*   **URL**: [https://argocd.luumac.io.vn](https://argocd.luumac.io.vn)
*   **Username**: `admin`
*   **Lấy mật khẩu**:
    ```bash
    kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
    ```

### Kích hoạt GitOps (Bootstrap)
Nếu chưa thấy các ứng dụng hiện trên Dashboard, chạy lệnh sau:
```bash
kubectl apply -f argocd/applications/
```

## 3. Quy trình Triển khai (Workflow)

Hệ thống được chia làm 2 môi trường chính trong thư mục `environments/`:

### Môi trường Staging (Tự động)
*   **Cấu hình**: `environments/staging/`
*   **Cách cập nhật**: CI/CD của Backend/Frontend sẽ thực hiện **Direct Git Push** để sửa trực tiếp file `values-app.yaml` trong thư mục này. ArgoCD sẽ tự động Sync ngay khi thấy commit mới.

### Môi trường Production (Manual/Approval)
*   **Cấu hình**: `environments/production/`
*   **Cách cập nhật**: Đánh Git Tag (`v*`) ở repo App. CI sẽ build image và dừng lại ở bước chờ xác nhận (Manual). Khi nhấn nút Deploy, CI sẽ thực hiện **Direct Git Push** vào thư mục này để cập nhật Tag.

## 4. Các lệnh hữu ích

### Kiểm tra Pods
```bash
kubectl get pods -n portfolio      # App Staging
kubectl get pods -n database       # DB Staging
kubectl get pods -n argocd         # ArgoCD System
```

### Truy cập Database (psql)
```bash
kubectl exec -it postgres-0 -n database -- psql -U portfolio_user -d portfolio_staging
```

## 5. Xử lý sự cố (Troubleshooting)

### Lỗi ArgoCD Redirect quá nhiều lần (Too many redirects)
Nếu gặp lỗi này khi vào Dashboard, chạy lệnh sau để chạy ArgoCD ở chế độ insecure (do Traefik đã lo phần TLS):
```bash
kubectl patch deployment argocd-server -n argocd --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--insecure"}]'
```

### Lỗi SSL "Not Secure" trên trình duyệt
Đảm bảo đã tạo Secret từ chứng chỉ Wildcard của bạn trong namespace `argocd`:
```bash
kubectl create secret tls luumac-wildcard-tls --cert=path/to/fullchain.pem --key=path/to/privkey.pem -n argocd
```

### Lỗi Divergent Branches khi Git Pull trên Ansible Node
Nếu máy Ansible bị lệch code và không thể pull, dùng lệnh reset:
```bash
git fetch origin && git reset --hard origin/feature/k8s-staging-setup
```

### Lỗi `Init:CreateContainerConfigError` (Thiếu Secret)
Thường do chưa tạo Secret `portfolio-secrets`. Cần tạo thủ công:
```bash
kubectl create secret generic portfolio-secrets -n portfolio \
  --from-literal=DATABASE_URL="postgresql://user:pass@host:5432/db" \
  --from-literal=JWT_SECRET="your_secret"
```

### Lỗi `P1001: Can't reach database` (Kết nối DB thất bại)
1.  **Kiểm tra Hostname**: Đảm bảo dùng đúng tên Service (ví dụ: `postgres-staging.database`).
2.  **Ký tự đặc biệt**: Nếu mật khẩu có dấu `@`, phải mã hóa thành `%40` trong chuỗi URL.

### Lỗi `The table public.User does not exist` (Chưa chạy Migration)
Nếu Docker Image không chứa thư mục `migrations`, lệnh `migrate deploy` sẽ không làm gì.
**Cách fix nhanh cho Staging**: Chạy lệnh `db push` thủ công:
```bash
kubectl exec -it <pod-backend> -n portfolio -- npx prisma db push
```

---

## 6. Quy trình chuẩn về Database Migration (Prisma)

Để hệ thống tự động cập nhật Database một cách an toàn khi có thay đổi code, hãy tuân thủ quy trình sau:

1.  **Tại máy Local**: Sau khi thay đổi file `schema.prisma`, bạn cần tạo file migration bằng lệnh:
    ```bash
    npx prisma migrate dev --name <ten_migration_goi_nho>
    ```
2.  **Commit lên Git**: Bạn **PHẢI** commit thư mục `prisma/migrations` vào Repo App (Backend).
3.  **Deploy**: Khi Docker Image được build, nó sẽ mang theo các file SQL này. Khi Pod khởi chạy trên K8s, Init Container sẽ chạy lệnh `prisma migrate deploy` để cập nhật Database mà không làm mất dữ liệu hiện có.

*Lưu ý: Chỉ dùng `db push` cho môi trường Staging/Dev khi muốn thử nghiệm nhanh và không quan tâm đến lịch sử thay đổi của Database.*

---

## 7. Cấu hình GitLab CI/CD Variables

Để các pipeline chạy thông suốt, bạn cần cấu hình các biến sau trên GitLab (**Settings > CI/CD > Variables**):

### Tại Repo Infrastructure (Quản lý chung)
*   **`KUBECONFIG`** (Type: File): Chứa nội dung file cấu hình truy cập Cluster.
*   **`STAGING_DATABASE_URL`**: URL kết nối Postgres Staging.
*   **`STAGING_JWT_SECRET`**: Khóa bí mật dùng cho Staging.
*   **`PROD_DATABASE_URL`**: URL kết nối Postgres Production.
*   **`PROD_JWT_SECRET`**: Khóa bí mật dùng cho Production.

### Tại Repo Backend & Frontend (Ứng dụng)
*   **`GITLAB_API_TOKEN`**: Personal Access Token hoặc Project Access Token của repo **Infra** (cần quyền `write_repository`) để CI của App có thể tự động `clone`, `commit` và `push` cập nhật Tag vào Infra.
*   **`CI_REGISTRY_USER`** / **`CI_REGISTRY_PASSWORD`**: Tài khoản Docker Hub để push/pull image.

---
*Lưu ý: Luôn đảm bảo repo Infra trên máy Ansible node được cập nhật mới nhất bằng lệnh `git pull` trước khi chạy Ansible.*
