# Báo Cáo Chi Tiết Sự Cố & Phương Án Xử Lý (Incident & Resolution Report)

Tài liệu này ghi nhận toàn bộ các sự cố kỹ thuật xảy ra trong phiên làm việc, nguyên nhân gốc rễ và quy trình xử lý chi tiết.

---

## 🚨 Sự cố 1: Metrics-Server Lỗi Kết Nối Đến Kubelet (Cổng 10250)

### 1. Hiện tượng sự cố
* Khi chạy lệnh kiểm tra tài nguyên hệ thống:
  ```bash
  kubectl top nodes
  kubectl top pods -A
  ```
  Hệ thống trả về thông báo lỗi không lấy được chỉ số đo lường (metrics).
* Kiểm tra log của pod `metrics-server` ghi nhận thông báo lỗi liên tục:
  ```
  Error: connection refused to 10.0.1.58:10250 (or tailscale IP)
  ```

### 2. Nguyên nhân gốc rễ (Root Cause)
* `metrics-server` cố gắng kết nối trực tiếp với API của Kubelet thông qua cổng `10250` trên địa chỉ IP của Node.
* Do các chính sách bảo mật mạng (cấu hình mạng Tailscale và bộ định tuyến Cilium CNI) trên máy chủ Single-Node VPS (`k8s-prod`), các kết nối trực tiếp từ Pod network vào cổng nhạy cảm của máy chủ host bị từ chối kết nối (`connection refused`).

### 3. Quy trình xử lý chi tiết (Resolution)
* **Bước 1**: Thiết lập dịch vụ chuyển tiếp cổng cục bộ trên node `k8s-prod` bằng cách tạo một systemd user service tên là `k8s-kubelet-forwarder`.
* **Bước 2**: File cấu hình dịch vụ `/home/macld/.config/systemd/user/k8s-kubelet-forwarder.service` thực hiện chuyển tiếp an toàn lưu lượng từ cổng `10250` trên IP Tailscale về loopback (`127.0.0.1:10250`) nơi Kubelet đang lắng nghe:
  ```ini
  [Unit]
  Description=Kubelet Port 10250 Forwarder
  After=network.target

  [Service]
  ExecStart=/usr/bin/socat TCP-LISTEN:10250,fork,bind=100.95.4.150 TCP:127.0.0.1:10250
  Restart=always

  [Install]
  WantedBy=default.target
  ```
* **Bước 3**: Kích hoạt và cho phép dịch vụ tự động chạy khi khởi động máy chủ:
  ```bash
  systemctl --user daemon-reload
  systemctl --user enable --now k8s-kubelet-forwarder.service
  loginctl enable-linger macld
  ```
* **Kết quả**: Đường truyền mạng được thông suốt. `metrics-server` giao tiếp thành công với Kubelet và khôi phục hiển thị dữ liệu `kubectl top nodes` / `kubectl top pods -A`.

---

## 🚨 Sự cố 2: Xung Đột Đồng Bộ GitOps (Git Conflict)

### 1. Hiện tượng sự cố
* Khi đẩy cấu hình Alertmanager mới lên Gitlab để ArgoCD tự động áp dụng, lệnh `git push` bị từ chối (`rejected`) do có sự sai lệch lịch sử commit giữa máy local của nhà phát triển và VM triển khai proxy (`ansible-node`).

### 2. Nguyên nhân gốc rễ (Root Cause)
* Cấu hình được thay đổi đồng thời trên cả máy cục bộ và VM proxy nhưng chưa được kéo gộp đúng cách trước khi tạo commit mới, dẫn đến phân nhánh lịch sử Git (non-fast-forward).

### 3. Quy trình xử lý chi tiết (Resolution)
* **Bước 1**: Truy cập vào VM triển khai proxy `ansible-node`.
* **Bước 2**: Thực hiện đồng bộ hóa nhánh và giải quyết xung đột bằng cách tích hợp trực tiếp thay đổi từ xa:
  ```bash
  git checkout main
  git pull origin main --rebase
  ```
* **Bước 3**: Đồng bộ hóa repository local tại đường dẫn `d:\DATA\Portfolio\infra` bằng cách kéo mã nguồn mới nhất về và gộp tự động (`git pull origin main`), sau đó thực hiện đẩy nhánh (`git push origin main`) để đảm bảo tất cả các môi trường có chung lịch sử commit.
* **Kết quả**: Kho lưu trữ Git đồng nhất, ArgoCD kích hoạt cơ chế tự động đồng bộ (Auto-Sync) và áp dụng cấu hình chính xác lên cluster.

---

## 🚨 Sự cố 3: Tràn Tin Nhắn Cảnh Báo Giả Trên Telegram (Alert Noise)

### 1. Hiện tượng sự cố
* Kênh Telegram liên tục nhận được tin nhắn cảnh báo đỏ `🚨 [CẢNH BÁO HẠ TẦNG]` về các lỗi:
  * `KubeControllerManagerInstanceUnreachable`
  * `KubeSchedulerInstanceUnreachable`
  * `etcdInsufficientMembers` / `etcdMembersDown`
  * `TargetDown` (cho etcd, scheduler, controller-manager)
  * `InfoInhibitor` & `Watchdog`
  * `KubeCPUOvercommit`

### 2. Nguyên nhân gốc rễ (Root Cause)
* Hệ thống đang chạy ở dạng VPS đơn lẻ (Single-Node), do đó các dịch vụ giám sát Control-Plane của cụm (như Etcd, Scheduler, Controller Manager) chủ động được cấu hình tắt thu thập metric (`enabled: false`) để tiết kiệm tài nguyên.
* Tuy nhiên, các bộ luật cảnh báo (`PrometheusRule`) mặc định của Helm Chart vẫn cố gắng quét dữ liệu. Khi thấy thiếu hụt metric hoặc endpoint trống, Prometheus hiểu nhầm là các dịch vụ này đã bị sập và kích hoạt báo động.
* Cảnh báo `InfoInhibitor` và `Watchdog` là các cảnh báo hệ thống nội bộ luôn luôn chạy và không cần gửi về Telegram.
* Cảnh báo `KubeCPUOvercommit` là cảnh báo dung lượng của môi trường thử nghiệm (CPU request vượt quá CPU thực tế của Node), không phải lỗi hệ thống bị sập.

### 3. Quy trình xử lý chi tiết (Resolution)
* **Bước 1**: Chỉnh sửa cấu hình định tuyến của Alertmanager trong file Helm values `kube-prometheus-stack.yaml`.
* **Bước 2**: Gom các cảnh báo hệ thống rác chuyển hướng về đầu thu `null` (đầu thu bỏ qua thông tin):
  ```yaml
              routes:
                - matchers:
                    - alertname =~ "Watchdog|InfoInhibitor|KubeControllerManagerInstanceUnreachable|KubeSchedulerInstanceUnreachable|KubeProxyInstanceUnreachable|KubeControllerManagerDown|KubeSchedulerDown|KubeProxyDown|etcdInsufficientMembers|etcdMembersDown|KubeCPUOvercommit"
                  receiver: 'null'
  ```
* **Bước 3**: Thiết lập bộ lọc thông minh cho cảnh báo `TargetDown` để chỉ bỏ qua lỗi của 3 dịch vụ Control-Plane bị tắt, bảo toàn tính năng cảnh báo `TargetDown` đối với các ứng dụng thực tế khác (Backend, DB, v.v.):
  ```yaml
                - matchers:
                    - alertname = TargetDown
                    - job =~ "kube-etcd|kube-controller-manager|kube-scheduler"
                  receiver: 'null'
  ```
* **Bước 4**: Đẩy thay đổi lên Git, ArgoCD tiến hành tự động đồng bộ và thực hiện lệnh khởi động lại Alertmanager StatefulSet:
  ```bash
  kubectl rollout restart statefulset/alertmanager-monitoring-kube-prometheus-alertmanager -n monitoring
  ```
* **Kết quả**: Các cảnh báo giả đã được loại bỏ hoàn toàn khỏi kênh Telegram, chỉ giữ lại các cảnh báo sự cố thực tế của hệ thống.
