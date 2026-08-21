# 🔄 Hướng dẫn Xoay vòng Mật khẩu & Khóa Bảo mật (Credentials Rotation Guide)

Tài liệu này hướng dẫn quy trình vận hành chuẩn để thay đổi (xoay vòng) mật khẩu Redis và khóa ký JWT (`JWT_SECRET`) trên hệ thống Production và Staging.

---

## 1. Quy trình Xoay vòng Mật khẩu Redis (Redis Credentials Rotation)

Mật khẩu Redis được nạp vào cụm qua hai cổng: **SealedSecret** (dành cho Redis Pod đọc lúc khởi chạy) và **Doppler** (dành cho Backend Pod đọc để kết nối). Hai giá trị này bắt buộc phải trùng khớp.

### **Bước 1: Chuẩn bị mật khẩu mới**
Tạo mật khẩu thô mới bảo mật (độ dài khuyến nghị tối thiểu 32 ký tự, chứa chữ hoa, chữ thường, số và ký tự đặc biệt).
*   *Ví dụ mật khẩu Staging:* `<mat_khau_staging_moi>`
*   *Ví dụ mật khẩu Production:* `<mat_khau_production_moi>`

### **Bước 2: Mã hóa mật khẩu thô bằng `kubeseal`**
Sử dụng công cụ `kubeseal` kết nối tới cụm để mã hóa mật khẩu thô thành chuỗi SealedSecret an toàn (phân biệt theo namespace):

*   **Cho môi trường Staging:**
    ```bash
    # Ghi mật khẩu ra file tạm (tránh lỗi newlines của PowerShell/Bash pipeline)
    echo -n "<mat_khau_staging_moi>" > stg-pass.txt
    
    # Mã hóa với namespace blog-staging và secret name redis-credentials
    kubeseal --controller-name=sealed-secrets --controller-namespace=kube-system --raw --name=redis-credentials --namespace=blog-staging --from-file=stg-pass.txt
    
    # Xóa file tạm
    rm stg-pass.txt
    ```
    *Lệnh này sẽ trả về một chuỗi mã hóa dài (ví dụ: `AgAIll8vzLDyEM3...`).*

*   **Cho môi trường Production:**
    ```bash
    echo -n "<mat_khau_production_moi>" > prod-pass.txt
    
    # Mã hóa với namespace blog-prod và secret name redis-credentials
    kubeseal --controller-name=sealed-secrets --controller-namespace=kube-system --raw --name=redis-credentials --namespace=blog-prod --from-file=prod-pass.txt
    
    rm prod-pass.txt
    ```

### **Bước 3: Cập nhật tệp cấu hình Helm trên Git**
1. Mở tệp cấu hình của Backend tương ứng:
   *   Staging: [`infra/environments/staging/backend-values.yaml`](file:///d:/DATA/Portfolio/infra/environments/staging/backend-values.yaml#L67)
   *   Production: [`infra/environments/production/backend-values.yaml`](file:///d:/DATA/Portfolio/infra/environments/production/backend-values.yaml#L67)
2. Thay thế giá trị cũ của `redis.encryptedPassword` bằng chuỗi SealedSecret vừa thu được ở **Bước 2**.
3. Tiến hành commit, push code lên repository:
   ```bash
   git add .
   git commit -m "chore(infra): rotate Redis passwords with new SealedSecrets"
   git push origin main
   ```
4. Đợi ArgoCD đồng bộ ứng dụng (hoặc nhấn Sync thủ công trên ArgoCD Dashboard) để cụm cập nhật Kubernetes Secret `redis-credentials`.

### **Bước 4: Cập nhật mật khẩu trên Doppler**
1. Truy cập trang quản trị **Doppler Dashboard** -> Project `blog-portfolio`.
2. Chọn Config tương ứng:
   *   Môi trường Production: Config `prd`
   *   Môi trường Staging: Config `stg` hoặc `dev`
3. Tìm biến **`REDIS_PASSWORD`** và cập nhật giá trị mật khẩu thô mới tương ứng (`<mat_khau_production_moi>` hoặc `<mat_khau_staging_moi>`).
4. Nhấn **Save** để lưu cấu hình.

### **Bước 5: Áp dụng mật khẩu mới**
Vì Redis không tự động nạp lại mật khẩu từ Secret khi có thay đổi, ta bắt buộc phải khởi động lại Redis và Backend để áp dụng:

1. **Khởi động lại Redis StatefulSet:**
   *   Staging:
       ```bash
       kubectl rollout restart statefulset redis-master -n blog-staging
       ```
   *   Production:
       ```bash
       kubectl rollout restart statefulset redis-master -n blog-prod
       ```
2. **Khởi động lại Backend Deployment:**
   *   Thông thường, Doppler Operator sẽ tự động phát hiện thay đổi trên Doppler và kích hoạt rolling-restart Backend pod.
   *   Nếu muốn chủ động thực hiện ngay lập tức, chạy lệnh:
       ```bash
       kubectl rollout restart deployment portfolio-backend-staging -n blog-staging
       # và
       kubectl rollout restart deployment portfolio-backend-production -n blog-prod
       ```

---

## 2. Quy trình Xoay vòng Khóa JWT (JWT Secret Rotation)

Khóa JWT (`JWT_SECRET`) chỉ được sử dụng bởi Backend pod và được quản lý tập trung hoàn toàn thông qua **Doppler**.

### **Các bước thực hiện:**
1.  Truy cập **Doppler Dashboard** -> Project `blog-portfolio`.
2.  Chọn Config tương ứng (`prd` hoặc `stg`).
3.  Tìm biến **`JWT_SECRET`** và thay đổi thành chuỗi khóa bí mật ngẫu nhiên mới.
4.  Nhấn **Save**.
5.  Doppler Operator trên K8s sẽ tự động nạp cấu hình mới và kích hoạt **Rolling Update** (restart Pod an toàn) cho các Pod backend.

---

## 3. Ảnh hưởng và Khuyến nghị Vận hành (Impact & Recommendations)

| Tham số xoay vòng | Ảnh hưởng Hệ thống | Ảnh hưởng Người dùng | Khuyến nghị Vận hành |
| :--- | :--- | :--- | :--- |
| **Mật khẩu Redis** | Trình duyệt người dùng sẽ gặp gián đoạn kết nối cache trong khoảng 5-10 giây lúc StatefulSet restart. | Không ảnh hưởng đến phiên đăng nhập hiện tại nếu session không lưu hoàn toàn trên cache. | Thực hiện vào thời điểm ít lượt truy cập trong ngày (ví dụ: đêm muộn hoặc sáng sớm). |
| **Khóa JWT** | Downtime bằng 0 nhờ cơ chế Rolling Update của K8s. | **Đăng xuất (Logout) cưỡng bức toàn bộ người dùng đang hoạt động.** Người dùng sẽ phải đăng nhập lại để nhận token mới. | Nên thông báo trước cho người dùng về việc bảo trì hệ thống, hoặc chấp nhận việc người dùng sẽ phải login lại. |
