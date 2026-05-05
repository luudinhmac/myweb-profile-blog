# Infrastructure Management

This repository contains the infrastructure code for the Portfolio project, including Ansible playbooks for server provisioning and Kubernetes manifests.

## Kubernetes Installation (Staging)

### 1. Connection & Preparation
Sync updated roles from local to Ansible node:
```powershell
# Sync roles to Ansible node (192.168.157.50)
scp d:\DATA\Portfolio\infra\ansible\roles\common\tasks\main.yml macld@192.168.157.50:/home/macld/portfolio-infratructure/ansible/roles/common/tasks/main.yml
scp d:\DATA\Portfolio\infra\ansible\roles\k8s-cluster\tasks\init.yml macld@192.168.157.50:/home/macld/portfolio-infratructure/ansible/roles/k8s-cluster/tasks/init.yml
```

### 2. Execution
Run the playbook from the Ansible node:
```powershell
# Run playbook (sudo password: admin)
ssh macld@192.168.157.50 "cd /home/macld/portfolio-infratructure/ansible && ansible-playbook -i inventory.ini playbooks/setup_cluster.yml --extra-vars 'ansible_become_pass=admin'"
```

### 3. Verification
Verify the cluster status from the Ansible node:
```powershell
# Check Node Status
ssh macld@192.168.157.50 "ssh -i /home/macld/.ssh/id_ed25519_ansible macld@192.168.157.110 'kubectl get nodes -o wide'"

# Check All Pods
ssh macld@192.168.157.50 "ssh -i /home/macld/.ssh/id_ed25519_ansible macld@192.168.157.110 'kubectl get pods -A'"
```
