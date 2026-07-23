# 💾 Hướng Dẫn Vận Hành Backup & Restore Với Velero & Cloudflare R2

Hệ thống sử dụng **Velero** để tự động sao lưu cấu hình toàn bộ cụm Kubernetes và dữ liệu Database (PostgreSQL) lưu trên Persistent Volume (Local Path) lên Cloudflare R2 (S3-compatible Object Storage).

---

## 1. Chuẩn Bị Tài Khoản Cloudflare R2
Để kết nối Velero với Cloudflare R2, bạn cần chuẩn bị các thông tin sau:
1. **Tạo Bucket**: Tạo một bucket trên Cloudflare R2 (ví dụ: `k8s-portfolio-backup`).
2. **Tạo R2 API Token**:
   * Truy cập **R2** > **Manage R2 API Tokens** > **Create API Token**.
   * Chọn quyền **Edit** (Read & Write).
   * Copy lại **Access Key ID** và **Secret Access Key**.
3. **Lấy Account ID**: Copy mã **Account ID** xuất hiện trên trang quản trị R2.

---

## 2. Các Bước Cấu Hình Hệ Thống

### Bước 2.1: Cập nhật Credentials vào Ansible
1. Điền các giá trị nhận được vào file [secrets.yml](file:///d:/DATA/Portfolio/infra/ansible/vars/secrets.yml):
   ```yaml
   r2_access_key_id: "mã_access_key_id_của_bạn"
   r2_secret_access_key: "mã_secret_access_key_của_bạn"
   r2_account_id: "mã_account_id_của_bạn"
   r2_bucket_name: "k8s-portfolio-backup"
   ```
2. Mã hóa file bằng Ansible Vault trước khi chạy:
   ```bash
   ansible-vault encrypt vars/secrets.yml
   ```

### Bước 2.2: Đồng bộ cấu hình lên K8s Cluster
1. **Chạy lại Ansible Playbook**:
   ```bash
   ansible-playbook -i ansible/inventory/hosts.ini ansible/playbooks/setup_cluster.yml --tags infra
   ```
   *Ansible sẽ tự động thực hiện:*
   * Tạo namespace `velero` và secret `cloud-credentials` chứa thông tin đăng nhập R2.
   * Tạo tệp cấu hình `/tmp/velero-values.yaml` chứa thông tin Bucket và Account ID từ `secrets.yml`.
   * Cài đặt và cập nhật Velero Helm Chart lên cluster.
2. **Đồng bộ lịch backup qua ArgoCD**:
   ArgoCD sẽ tự động nhận diện và sync ứng dụng:
   * `platform-velero-configs`: Áp dụng lịch backup tự động (`Schedule`).

---

## 3. Hướng Dẫn Sử Dụng Velero CLI

### Cài đặt Velero CLI trên máy Local / VPS Master:
* **Linux (Master Node)**:
  ```bash
  wget https://github.com/vmware-tanzu/velero/releases/download/v1.14.0/velero-v1.14.0-linux-amd64.tar.gz
  tar -xvf velero-v1.14.0-linux-amd64.tar.gz
  sudo mv velero-v1.14.0-linux-amd64/velero /usr/local/bin/
  ```
* **Windows (Local)**:
  ```powershell
  choco install velero
  ```

---

## 4. Các Lệnh Vận Hành Cơ Bản

### 4.1. Tạo bản Backup thủ công khẩn cấp
Trước khi thực hiện các nâng cấp lớn hoặc thay đổi cơ sở dữ liệu:
```bash
# Backup toàn bộ cụm
velero backup create manual-backup-$(date +%F)

# Chỉ backup namespace production và database-production
velero backup create app-backup-$(date +%F) --include-namespaces production,database-production
```

### 4.2. Kiểm tra trạng thái Backups
```bash
# Xem danh sách các bản backup
velero backup get

# Xem chi tiết một bản backup cụ thể (để kiểm tra lỗi nếu có)
velero backup describe manual-backup-xxxx

# Xem log quá trình backup
velero backup logs manual-backup-xxxx
```

### 4.3. Quản lý Lịch Trình (Schedules)
Lịch trình mặc định chạy tự động vào **02:00 AM giờ Việt Nam** (tức 19:00 giờ UTC) hàng ngày và lưu trữ trong **7 ngày**.
```bash
# Xem danh sách lịch backup tự động
velero schedule get
```

---

## 5. Quy Trình Khôi Phục Từ Thảm Họa (Disaster Recovery)

Khi VPS bị hỏng hoàn toàn hoặc mất dữ liệu và bạn đã dựng lại cụm K8s trống bằng Ansible:

### Bước 5.1: Kiểm tra kết nối với Cloudflare R2
Sau khi cài đặt lại Velero trên cụm mới, Velero sẽ tự động kết nối với R2 Bucket và quét các bản backup hiện có. Hãy kiểm tra xem các bản backup cũ đã hiển thị chưa:
```bash
velero backup get
```

### Bước 5.2: Thực hiện khôi phục (Restore)
Bạn có thể khôi phục toàn bộ cụm hoặc chỉ khôi phục các namespace cụ thể:
```bash
# Khôi phục từ bản backup gần nhất
velero restore create --from-backup manual-backup-xxxx

# Theo dõi tiến trình restore
velero restore get
velero restore describe <restore-name>
```

> [!WARNING]
> **Lưu ý quan trọng khi restore Database Stateful (PostgreSQL)**:
> Do sử dụng Local Path Provisioner, Node Agent của Velero sẽ khôi phục trực tiếp các tệp dữ liệu vào thư mục volume của Pod mới.
> 1. Tránh chạy ghi đè khi Pod database đang hoạt động tích cực để ngăn ngừa lỗi bất đồng bộ file.
> 2. Khuyên dùng: Scale Down các Deployment liên quan (`replicas=0`), thực hiện Restore, sau đó Scale Up trở lại.

---

## 6. Hướng Dẫn Sử Dụng AWS CLI Để Quản Lý Cloudflare R2 Bucket

Bạn có thể sử dụng **AWS CLI** tương thích với chuẩn S3 API để kiểm tra, tải về hoặc dọn dẹp trực tiếp dữ liệu trên Cloudflare R2.

### Bước 6.1: Cấu hình AWS CLI Profile cho Cloudflare R2
Tạo hoặc cập nhật cấu hình profile `r2` trong máy cá nhân (Local):

* **File `%USERPROFILE%\.aws\config` (hoặc `~/.aws/config`)** *(Dành cho AWS CLI > v2.13)*:
  ```ini
  [default]
  region = auto
  output = json

  [profile r2]
  region = auto
  output = json
  services = r2

  [services r2]
  s3 =
    endpoint_url = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
    addressing_style = path
  ```

* **File `%USERPROFILE%\.aws\credentials` (hoặc `~/.aws/credentials`)**:
  ```ini
  [r2]
  aws_access_key_id = <YOUR_R2_ACCESS_KEY_ID>
  aws_secret_access_key = <YOUR_R2_SECRET_ACCESS_KEY>
  ```

---

### Bước 6.2: Các Lệnh Quản Lý S3 Thường Dùng

#### 1. Kiểm tra cấu trúc thư mục gốc trong Bucket
```bash
aws s3 ls s3://velero-k8s-prod --profile r2
```
*Kết quả:*
```text
                           PRE backups/
                           PRE kopia/
```

#### 2. Liệt kê danh sách bản Backup Velero
```bash
aws s3 ls s3://velero-k8s-prod/backups/ --profile r2
```

#### 3. Liệt kê các Snapshot Kopia
```bash
aws s3 ls s3://velero-k8s-prod/kopia/ --profile r2
```

#### 4. Thống kê tổng dung lượng toàn bộ Bucket
```bash
aws s3 ls s3://velero-k8s-prod --recursive --human-readable --summarize --profile r2
```

#### 5. Thống kê dung lượng của từng Folder trong Bucket
* **Xem dung lượng thư mục Velero Backups (`backups/`)**:
  ```bash
  aws s3 ls s3://velero-k8s-prod/backups/ --recursive --human-readable --summarize --profile r2
  ```

* **Xem dung lượng thư mục Kopia Volume Snapshots (`kopia/`)**:
  ```bash
  aws s3 ls s3://velero-k8s-prod/kopia/ --recursive --human-readable --summarize --profile r2
  ```

* **Xem dung lượng của 1 bản backup cụ thể**:
  ```bash
  aws s3 ls s3://velero-k8s-prod/backups/prod-backup-20260718190054/ --recursive --human-readable --summarize --profile r2
  ```

#### 6. Tải một bản backup về máy local (Download)
```bash
aws s3 cp s3://velero-k8s-prod/backups/prod-backup-20260718190054/ C:\local_backups\prod-backup\ --recursive --profile r2
```

#### 7. Xóa thủ công một thư mục bản backup cũ (Manual Cleanup)
```bash
aws s3 rm s3://velero-k8s-prod/backups/test-prod-backup-1/ --recursive --profile r2
```


