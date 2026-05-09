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
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && helm upgrade --install postgres /home/macld/portfolio-infratructure/helm/postgres --namespace database --create-namespace"
```

### Kiểm tra trạng thái Database
```powershell
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && kubectl get pods -n database"
# Mong đợi: postgres-0   1/1     Running
```

### Triển khai Backend & Frontend (CI/CD)
Quy trình triển khai app được thực hiện tự động qua GitLab CI bằng lệnh:
```bash
helm upgrade --install portfolio-backend ./helm/backend --namespace portfolio --set image.tag=$IMAGE_TAG
```

## 3. Quản lý Secret và SSL

### Môi trường Staging (Dùng Cert có sẵn)
Staging sử dụng chứng chỉ SSL đã được cấp phát trước đó (luumac.io.vn).
**Lệnh tạo Secret (Đã chạy):**
```bash
kubectl create secret tls luumac-tls-staging --cert=fullchain.cer --key=luumac.io.vn.key -n portfolio
```

### Môi trường Production (Dùng Cert-Manager)
Production sẽ tự động cấp phát Cert qua Let's Encrypt. Bạn cần tạo Secret cấu hình ứng dụng trước khi Deploy:
```bash
kubectl create namespace portfolio-prod
kubectl create secret generic portfolio-secrets -n portfolio-prod \
  --from-literal=DATABASE_URL="postgresql://portfolio_user:PASSWORD@postgres.infra-prod.svc.cluster.local:5432/portfolio_production" \
  --from-literal=JWT_SECRET="YOUR_SUPER_SECRET_KEY"
```

## 4. Giải mã mật khẩu (Base64)
Trong Kubernetes, các Secret được lưu trữ dưới dạng mã hóa Base64. 

**Lệnh giải mã nhanh (PowerShell):**
```powershell
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("bWFjbGRAMjAyNg=="))
# Kết quả: macld@2026
```

## 5. Kiểm tra trạng thái
```powershell
# Xem danh sách các bản phát hành Helm
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && helm list -A"

# Kiểm tra Pods
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && kubectl get pods -A"
```

## 6. Cấu hình xác thực (CI/CD)
Để GitLab CI có thể deploy, hãy đảm bảo biến `KUBE_CONFIG_BASE64` đã được thiết lập trong GitLab CI/CD Variables.
