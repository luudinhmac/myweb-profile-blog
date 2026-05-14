# 🚀 Infrastructure & GitOps Management Guide

This repository manages the foundational infrastructure, platform services, and application deployments for the Portfolio project using an Enterprise-grade GitOps architecture.

## 🏗️ Architecture Overview (Mature V2)

```
infra/
├── ansible/       # Infrastructure as Code (OS, K8s, Docker)
├── argocd/        # GitOps Orchestration (App-of-Apps)
├── platform/      # Shared Cluster Services (Traefik, Cert-Manager)
├── monitoring/    # Observability Stack (Prometheus, Grafana)
├── apps/          # Application Helm Charts
└── environments/  # Environment-specific Overrides
```

---

## 🛠️ Step 1: Infrastructure Bootstrapping (Ansible)

Before deploying applications, the base OS and Kubernetes cluster must be configured.

### Prerequisites
- SSH access to target nodes.
- Ansible installed on the control node (.50).
- Inventory configured in `ansible/inventory/staging.ini`.

### Deployment Commands
Run these playbooks in order from the `infra/ansible` directory:

1. **System Preparation**:
   ```bash
   ansible-playbook -i inventory/staging.ini playbooks/setup_cluster.yml --tags prerequisites
   ```
2. **Install Docker & Kubernetes**:
   ```bash
   ansible-playbook -i inventory/staging.ini playbooks/setup_cluster.yml --tags install
   ```
3. **Security Hardening**:
   ```bash
   ansible-playbook -i inventory/staging.ini playbooks/setup_security.yml
   ```
4. **Deploy VPN (Tailscale)**:
   ```bash
   ansible-playbook -i inventory/staging.ini playbooks/setup_cluster.yml --tags vpn
   ```

---

## 🎡 Step 2: GitOps Initialization (ArgoCD)

Once K8s is ready, we initialize the GitOps engine.

### 1. Install ArgoCD (via Ansible)
```bash
ansible-playbook -i inventory/staging.ini playbooks/setup_cluster.yml --tags infra-services
```

### 2. Bootstrap the Root Application
Apply the master application to enable automated management of all other components:
```bash
kubectl apply -f argocd/root/app-of-apps.yaml
```
*Note: This will automatically discover all manifests in `argocd/projects/` and `argocd/applications/`.*

---

## 📦 Step 3: Application Deployment

Applications are managed via Helm charts in the `apps/` directory.

### Environment Overrides
Specific configurations for Staging or Production are located in `environments/`.
- `environments/staging/backend-values.yaml`
- `environments/production/backend-values.yaml`

### How to Deploy a New Version
ArgoCD watches the `main` branch. To update an image version manually:
1. Edit the tag in `environments/[env]/[app]-values.yaml`.
2. Commit and Push to Git.
3. ArgoCD will detect the change and perform a Rolling Update.

---

## 📊 Step 4: Observability (Monitoring)

### Database Monitoring
The system automatically deploys:
- **Postgres Exporter**: Collects database metrics.
- **ServiceMonitor**: Configures Prometheus to scrape the exporter.
- **Grafana Ingress**: Provides access at `https://grafana.luumac.io.vn`.

### Maintenance
To add a new dashboard, place the JSON file in `monitoring/grafana/dashboards/`.

---

## 🤖 Step 5: CI/CD Pipeline Automation

The `.gitlab-ci.yml` file automates the handshake between App repos and this Infra repo.

1. **Trigger**: A successful build in the Frontend/Backend repo.
2. **Action**: CI Bot updates the `tag:` field in `environments/staging/*.yaml`.
3. **Reconciliation**: ArgoCD syncs the cluster to match the new Git state.

---

## 🔐 Security Standards
- **IP Allowlist**: Administrative panels are restricted via Traefik Middleware.
- **Compression**: Global Gzip compression is enabled for all public Ingresses.
- **SSL/TLS**: Automated certificate management via Cert-Manager (Let's Encrypt).

---
*Last Updated: 2026-05-14 by Antigravity AI*
