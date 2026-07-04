# Quy Trình Bảo Trì & Tắt Node VM Local (Worker Node Maintenance Guide)

Tài liệu này hướng dẫn quy trình chuẩn để tắt hoặc khởi động lại Worker Node cục bộ (`worker-local-1`) phục vụ mục đích bảo trì, nâng cấp phần cứng/hệ điều hành mà không làm ảnh hưởng xấu đến trạng thái của cụm Kubernetes.

---

## Quy Trình 3 Bước: Trước - Trong - Sau Bảo Trì

### BƯỚC 1: TRƯỚC KHI TẮT MÁY (PRE-MAINTENANCE)

#### 1. Đánh dấu chặn tiếp nhận Pod mới (Cordon)
Chạy lệnh sau trên Master Node hoặc máy cấu trị viên để cấu hình Node ở trạng thái chặn lập lịch:
```bash
kubectl cordon worker-local-1
```
* **Ý nghĩa**: Báo cho Kubernetes Scheduler không điều phối bất kỳ Pod mới nào vào node này nữa. Node sẽ hiển thị trạng thái `Ready,SchedulingDisabled`.

#### 2. Trục xuất các Pod đang chạy trên Node (Drain)
Di tản toàn bộ Pod của ứng dụng ra khỏi node một cách an toàn:
```bash
kubectl drain worker-local-1 --ignore-daemonsets --delete-emptydir-data --force
```
* **Giải thích tham số**:
  * `--ignore-daemonsets`: Bỏ qua các Pod hệ thống chạy dưới dạng DaemonSet (như `kube-proxy`, `cilium`, `node-exporter`). Các Pod này không thể di tản sang node khác nên sẽ tự động tắt khi VM tắt.
  * `--delete-emptydir-data`: Cho phép xóa dữ liệu lưu tạm trong ổ đĩa ảo `emptyDir` của Pod khi bị trục xuất.
  * `--force`: Cưỡng chế trục xuất các Pod độc lập (không được quản lý bởi Deployment/StatefulSet).

#### 3. Bật chế độ im lặng (Silence) trên Alertmanager
1. Truy cập vào trang quản trị Alertmanager UI.
2. Tạo một lệnh **Silence** tạm thời cho nhãn `node="worker-local-1"` hoặc `instance="worker-local-1"`.
3. Thiết lập thời gian im lặng tương ứng với thời gian dự kiến bảo trì để tránh nhận hàng loạt tin nhắn spam trên Telegram.

---

### BƯỚC 2: TIẾN HÀNH BẢO TRÌ (DURING MAINTENANCE)

#### 1. Tắt máy ảo VM local an toàn
Đăng nhập SSH vào máy ảo `worker-local-1` và thực hiện tắt máy:
```bash
sudo poweroff
# Hoặc
sudo shutdown -h now
```

#### 2. Thực hiện các thao tác bảo trì
* Nâng cấp RAM/CPU của máy ảo.
* Cập nhật hệ điều hành (Kernel, OS packages).
* Bảo trì hệ thống mạng nội bộ.

---

### BƯỚC 3: ĐƯA NODE TRỞ LẠI CỤM (POST-MAINTENANCE)

#### 1. Bật máy ảo và kiểm tra mạng lai Tailscale
1. Khởi động lại VM `worker-local-1`.
2. Kiểm tra xem Tailscale đã kết nối và dịch vụ định tuyến lai tự động đã chạy thành công chưa:
   ```bash
   systemctl status k8s-hybrid-routing.service
   ```
3. Đảm bảo Kubelet đã khởi động và lắng nghe đúng địa chỉ IP Tailscale:
   ```bash
   systemctl status kubelet
   ```

#### 2. Xác minh trạng thái Node trên Master
Trên Master Node, kiểm tra xem node đã nhận lại kết nối chưa:
```bash
kubectl get nodes
```
Node phải chuyển sang trạng thái **`Ready,SchedulingDisabled`**.

#### 3. Cho phép tiếp nhận Pod trở lại (Uncordon)
Chạy lệnh sau để mở khóa lập lịch cho Node:
```bash
kubectl uncordon worker-local-1
```
* **Ý nghĩa**: Node chuyển lại trạng thái **`Ready`** hoàn toàn, sẵn sàng tiếp nhận các Pod mới và khôi phục hoạt động bình thường.
