# Infrastructure Management

This repository contains the infrastructure code for the Portfolio project, including Ansible playbooks for server provisioning and Kubernetes manifests.

## Kubernetes Installation (Staging)

### 1. Chuẩn bị (GitOps Flow)
Sau khi push code từ máy local lên GitLab, thực hiện kéo code mới nhất về Ansible node (192.168.157.50):
```powershell
# Trên máy local hoặc truy cập vào ansible node để pull
ssh macld@192.168.157.50 "cd /home/macld/portfolio-infratructure && git pull origin feature/k8s-staging-setup"
```

### 2. Execution
Run the playbook from the Ansible node:
```powershell
# Run playbook (sudo password: admin)
ssh macld@192.168.157.50 "cd /home/macld/portfolio-infratructure/ansible && ansible-playbook -i inventory.ini playbooks/setup_cluster.yml --extra-vars 'ansible_become_pass=admin'"
```

### 3. Triển khai Database (PostgreSQL)
Chuẩn bị thư mục dữ liệu trên node staging và triển khai manifests:
```powershell
# Tạo thư mục hostPath trên staging node
ssh macld@192.168.157.50 "ssh -i /home/macld/.ssh/id_ed25519_ansible macld@192.168.157.110 'echo admin | sudo -S mkdir -p /data/k8s/postgres-infra && echo admin | sudo -S chmod 777 /data/k8s/postgres-infra'"

# Deploy Postgres từ Ansible node
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && /usr/local/bin/kubectl apply -k /home/macld/portfolio-infratructure/k8s/base/postgres"
```

### 4. Kiểm tra trạng thái (Verification)
Verify the cluster and database status from the Ansible node:
```powershell
# Kiểm tra Node Status
ssh macld@192.168.157.50 "ssh -i /home/macld/.ssh/id_ed25519_ansible macld@192.168.157.110 'kubectl get nodes -o wide'"

# Kiểm tra tài nguyên trong namespace infra (Traefik, Postgres)
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && kubectl get all -n infra"

# Kiểm tra tất cả các Pod trên Cluster
ssh macld@192.168.157.50 "export KUBECONFIG=/home/macld/staging-k8s.conf && kubectl get pods -A"
```
