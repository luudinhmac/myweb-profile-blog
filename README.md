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

## 3. Kiểm tra trạng thái
```powershell
# Xem danh sách các bản phát hành Helm
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && helm list -A"

# Kiểm tra Pods
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && kubectl get pods -A"
```

## 4. Cấu hình xác thực (CI/CD)
Để GitLab CI có thể deploy, hãy đảm bảo biến `KUBE_CONFIG_BASE64` đã được thiết lập trong GitLab CI/CD Variables.
