# 📝 Báo Cáo Sự Cố: Lỗi Job Bảo Trì Kopia Velero (blog-staging)

Tài liệu này ghi nhận chi tiết sự cố lỗi Job bảo trì (`maintain-job`) của Velero Kopia đối với namespace `blog-staging`, quy trình kiểm tra xác định lỗi, và các bước cấu hình khắc phục.

---

## 1. Thông Tin Sự Cố
* **Hiện tượng**: Các job bảo trì của Kopia trong namespace `velero` liên tục báo lỗi `Error` sau mỗi 5 phút hoặc khi đến chu kỳ bảo trì:
  ```text
  blog-staging-default-kopia-7gkpr-maintain-job-1785565609935rksl   0/1     Error       0              12m
  blog-staging-default-kopia-7gkpr-maintain-job-1785565909937zqk5   0/1     Error       0              7m25s
  blog-staging-default-kopia-7gkpr-maintain-job-17855662099446hc5   0/1     Error       0              2m25s
  ```

---

## 2. Quy Trình Kiểm Tra & Phân Tích Lỗi

### Bước 2.1: Kiểm tra log của Pod bảo trì bị lỗi
Chạy lệnh lấy log của một pod bảo trì bị lỗi:
```powershell
kubectl logs -n velero blog-staging-default-kopia-7gkpr-maintain-job-17855662099446hc5
```
* **Output nhận được**:
  ```text
  time="2026-08-01T06:36:54Z" level=error msg="An error occurred when running repo prune" error="failed to boost repo connect: error to connect backup repo: error to connect repo with storage: error to connect to repository: repository not initialized in the provided storage" error.file="/go/pkg/mod/github.com/project-velero/kopia@v0.0.0-20240417031915-e07d5b7de567/repo/connect.go:25" error.function=github.com/kopia/kopia/repo.init logSource="pkg/cmd/cli/repomantenance/maintenance.go:72"
  ```
* **Dấu hiệu xác định vấn đề**: Lỗi chỉ ra rằng kho lưu trữ Kopia của `blog-staging` **chưa được khởi tạo** trong Cloudflare R2 storage (`repository not initialized in the provided storage`).

### Bước 2.2: Kiểm tra BackupRepository CR trong cụm
Lấy thông tin tài nguyên `BackupRepository` của staging trong Kubernetes:
```powershell
kubectl get backuprepositories -n velero
```
* **Output nhận được**:
  ```text
  NAME                               VOLUME-NAMESPACE  STATUS
  argocd-default-kopia-2xd8m         argocd            Ready
  blog-prod-default-kopia-wq9hw      blog-prod         Ready
  blog-staging-default-kopia-7gkpr   blog-staging      Ready (message: Maintenance job blog-staging-default-kopia-7gkpr-maintain-job-1785566209942 failed: An error occurred: <nil>)
  infra-default-kopia-62w4r          infra             Ready
  ```
* **Dấu hiệu xác định vấn đề**: `BackupRepository` của staging vẫn tồn tại trong cụm Kubernetes nhưng trạng thái ghi nhận có lỗi từ job bảo trì gần nhất. Khi CR này tồn tại, Velero hiểu rằng repo đã được khởi tạo thành công ở lần chạy đầu tiên.

### Bước 2.3: Kiểm tra tệp tin thực tế trên R2 Bucket
Sử dụng AWS CLI để quét toàn bộ các file `kopia.repository` trên Cloudflare R2 bucket:
```powershell
aws s3 ls s3://velero-k8s-prod/ --recursive --profile r2 | Select-String "kopia.repository"
```
* **Output nhận được**:
  ```text
  2026-07-25 23:01:05       1075 kopia/argocd/kopia.repository
  2026-07-27 13:11:09       1075 kopia/blog-prod/kopia.repository
  2026-07-25 23:01:12       1075 kopia/infra/kopia.repository
  ```
* **Dấu hiệu xác định vấn đề**: **Hoàn toàn không có file `kopia.repository`** trong thư mục `kopia/blog-staging/` trên R2. File này chứa metadata mã hóa và cấu hình tối quan trọng để kết nối với repo Kopia. Việc mất file này khiến repo không thể sử dụng hay bảo trì.

> [!NOTE]
> **Giải thích cơ chế lỗi:**
> Do `BackupRepository` CR vẫn tồn tại trong cụm Kubernetes, Velero mặc định bỏ qua bước khởi tạo (`repository create`) trong các phiên backup tiếp theo. `node-agent` (chạy dạng DaemonSet liên tục) có lưu cache kết nối cục bộ nên các bản backup hàng ngày vẫn chạy thành công bình thường. Tuy nhiên, các job bảo trì (`maintain-job`) chạy bằng pod tạm thời, không có cache nên bắt buộc phải tải file `kopia.repository` từ R2. Sự biến mất của file này trên R2 khiến job bảo trì liên tục thất bại.

---

## 3. Quy Trình Sửa Lỗi (Fix)

### Bước 3.1: Xóa BackupRepository CR lỗi trong Kubernetes
Xóa CR này để Velero biết cần phải khởi tạo mới hoàn toàn repo ở lần chạy kế tiếp:
```powershell
kubectl delete backuprepository -n velero blog-staging-default-kopia-7gkpr
```
* **Output kết quả**:
  ```text
  backuprepository.velero.io "blog-staging-default-kopia-7gkpr" deleted from velero namespace
  ```

### Bước 3.2: Dọn dẹp thư mục lỗi trên R2 Bucket
Di chuyển dữ liệu cũ sang thư mục lưu trữ tạm thời `blog-staging-corrupted` để phân tích (hoặc xóa sau):
```powershell
aws s3 mv s3://velero-k8s-prod/kopia/blog-staging/ s3://velero-k8s-prod/kopia/blog-staging-corrupted/ --recursive --profile r2
```
*Đối với các file dung lượng lớn còn kẹt lại, chạy lệnh force delete để dọn sạch hoàn toàn thư mục cũ:*
```powershell
aws s3 rm s3://velero-k8s-prod/kopia/blog-staging/ --recursive --profile r2
```
* **Output kết quả**:
  ```text
  delete: s3://velero-k8s-prod/kopia/blog-staging/pde463681c66086b111eb6b69e35b3d74-sc7f9420fed4a64e9143
  delete: s3://velero-k8s-prod/kopia/blog-staging/p3d554cbac0d42191d3fd7cc83ea27526-sf6c82b587896a167143
  ```

### Bước 3.3: Xóa các Job bảo trì bị lỗi trước đó
Dọn dẹp các job/pod ở trạng thái lỗi khỏi namespace `velero`:
```powershell
kubectl delete jobs -n velero -l velero.io/repo-name=blog-staging-default-kopia-7gkpr
```
* **Output kết quả**:
  ```text
  job.batch "blog-staging-default-kopia-7gkpr-maintain-job-1785565909935" deleted from velero namespace
  job.batch "blog-staging-default-kopia-7gkpr-maintain-job-1785566209942" deleted from velero namespace
  job.batch "blog-staging-default-kopia-7gkpr-maintain-job-1785566509944" deleted from velero namespace
  ```

### Bước 3.4: Kích hoạt bản backup mới từ lịch trình
Dùng lệnh bên trong pod Velero để chạy một bản backup thủ công từ lịch trình `staging-backup` nhằm khởi tạo lại repo sạch:
```powershell
kubectl exec -n velero velero-6ccdcdf75d-jxfjs -c velero -- /velero backup create --from-schedule staging-backup
```
* **Output kết quả**:
  ```text
  Creating backup from schedule, all other filters are ignored.
  Backup request "staging-backup-20260801064300" submitted successfully.
  ```

---

## 4. Xác Thực Kết Quả Sau Khi Fix (Verification)

### Bước 4.1: Kiểm tra tệp tin trên R2 Bucket
Quét lại thư mục `kopia/blog-staging/` xem file cấu hình mới đã được tạo chưa:
```powershell
aws s3 ls s3://velero-k8s-prod/kopia/blog-staging/ --profile r2
```
* **Output kết quả**:
  ```text
  2026-08-01 13:43:08        790 _log_20260801064306_61ea_1785566586_1785566588_1_f3072866f39b63ff3b566e04deb89797
  2026-08-01 13:43:04         30 kopia.blobcfg
  2026-08-01 13:43:04       1075 kopia.repository
  2026-08-01 13:43:07       4298 q8a366f02f7fbe241558512272f5a46a2-sf513005cf6a8d0f8143
  2026-08-01 13:43:12        194 s7b7d7b67b26553a00984745125c8b0ac-s1589824c4514f38e143
  2026-08-01 13:43:07        143 xn0_dd191fee4128f85e81e432a7a8b7c301-sf513005cf6a8d0f8143-c1
  ```
* **Nhận xét**: File `kopia.repository` và `kopia.blobcfg` đã được khởi tạo thành công.

### Bước 4.2: Kiểm tra trạng thái BackupRepository mới
```powershell
kubectl get backuprepositories.velero.io -n velero -l velero.io/volume-namespace=blog-staging -o yaml
```
* **Output kết quả**:
  ```yaml
  status:
    lastMaintenanceTime: "2026-08-01T06:43:08Z"
    phase: Ready
  ```
* **Nhận xét**: BackupRepository mới của staging (`blog-staging-default-kopia-5f69f`) đã chuyển sang trạng thái **`Ready`**.

### Bước 4.3: Kiểm tra trạng thái hoàn thành Backup
```powershell
# Xem danh sách Pod Volume Backups của bản backup mới tạo
kubectl get podvolumebackups.velero.io -n velero -l velero.io/backup-name=staging-backup-20260801064300

# Xem trạng thái cuối cùng của bản Backup
kubectl get backups.velero.io -n velero staging-backup-20260801064300 -o jsonpath="{.status.phase}"
```
* **Output kết quả**:
  - Toàn bộ 4 volume (`uploads-storage`, `postgres-data`, `redis-data`, `empty-dir`) đều báo trạng thái `Completed`.
  - Trạng thái cuối cùng của Backup: `Completed`.

### Bước 4.4: Kiểm tra trạng thái Pods trong namespace velero
```powershell
kubectl get pods -n velero
```
* **Output kết quả**:
  - Không còn bất cứ Pod hay Job nào ở trạng thái `Error` hay `Failed`. Hệ thống chạy sạch sẽ và ổn định.
