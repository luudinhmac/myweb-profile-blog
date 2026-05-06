# Portfolio Infrastructure

Dự án quản lý hạ tầng Kubernetes cho hệ thống Portfolio sử dụng **Ansible** để khởi tạo cụm và **Helm** để quản lý ứng dụng.

## 1. Khởi tạo Cluster (Ansible)
Sử dụng Ansible node (`192.168.157.50`) để cài đặt K8s v1.31, Cilium CNI và Traefik Ingress.

```powershell
# Chạy playbook từ Ansible node
ssh macld@192.168.157.50 "cd /home/macld/portfolio-infratructure/ansible && ansible-playbook -i inventory.ini playbooks/setup_cluster.yml --extra-vars 'ansible_become_pass=admin'"
```

## 2. Quản lý Ứng dụng (Helm)

### Triển khai Database (PostgreSQL)
```powershell
# Từ Ansible node
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && helm upgrade --install postgres /home/macld/portfolio-infratructure/helm/postgres --namespace infra --create-namespace"
```

### Triển khai Backend & Frontend (CI/CD)
Quy trình triển khai app được thực hiện tự động qua GitLab CI bằng lệnh:
```bash
helm upgrade --install portfolio-backend ./helm/backend --namespace portfolio --set image.tag=$IMAGE_TAG
```

## 3. Quản lý Secret và Bảo mật

### Giải mã mật khẩu (Base64)
Trong Kubernetes, các Secret được lưu trữ dưới dạng mã hóa Base64. Nếu bạn thấy một chuỗi như `bWFjbGRAMjAyNg==`, đó không phải là mật khẩu ngẫu nhiên mà là chuỗi mã hóa.

**Lệnh giải mã nhanh (PowerShell):**
```powershell
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("bWFjbGRAMjAyNg=="))
# Kết quả: macld@2026
```

### Lưu ý về ký tự đặc biệt trong Mật khẩu
Nếu mật khẩu chứa ký tự `@` (ví dụ: `macld@2026`), nó có thể gây lỗi khi nhập vào giao diện cài đặt (Installer) vì dấu `@` được hiểu là ký tự ngăn cách trong URL:
- **Lỗi**: `postgresql://user:macld@2026@host` -> Khiến phần `2026@` bị dính vào tên Host.
- **Khắc phục**: Khi sử dụng trong chuỗi kết nối (`DATABASE_URL`), hãy mã hóa dấu `@` thành `%40`.
  - Ví dụ: `postgresql://user:macld%402026@host`

## 4. Kiểm tra trạng thái
```powershell
# Xem danh sách các bản phát hành Helm
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && helm list -A"

# Kiểm tra Pods
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && kubectl get pods -A"
```

## 5. Cấu hình xác thực (CI/CD)
Để GitLab CI có thể deploy, hãy đảm bảo biến `KUBE_CONFIG_BASE64` đã được thiết lập trong GitLab CI/CD Variables.
