# Báo Cáo Chi Tiết Triển Khai Worker Node VM Local (Hybrid Node Deployment Report)

Tài liệu này ghi lại toàn bộ quy trình thiết lập, chuẩn hóa hạ tầng, cấu hình mạng lai (Hybrid Networking) qua Tailscale và ghép nối (join) máy ảo cục bộ (`worker-local-1`) vào cụm Kubernetes Production.

---

## 1. Kiến Trúc Mạng Lai (Hybrid Networking Architecture)
Hệ thống K8s chạy dưới mô hình lai (Hybrid Cluster):
* **Master Node (`k8s-prod` - VPS Cloud)**:
  * IP Tailscale: `100.84.131.65`
  * Dải mạng Pod ảo định vị trong cấu hình cụm: `10.200.0.1` (API Server)
* **Worker Node (`worker-local-1` - VM Local)**:
  * IP Tailscale: `100.108.182.86`
  * Nhiệm vụ: Giao tiếp bảo mật với Master Node Cloud thông qua VPN Tailscale.

---

## 2. Các Bước Chuẩn Bị Hệ Điều Hành (OS Preparation)

Trước khi cài đặt K8s, VM local được cấu hình các thông số nhân Kernel và tắt Swap:
1. **Tắt Swap**: Đảm bảo Kubelet hoạt động ổn định không bị lỗi lập lịch tài nguyên.
   ```bash
   swapoff -a
   sed -i.bak '/swap/s/^/#/' /etc/fstab
   ```
2. **Nạp các Module Nhân**: Kích hoạt module `overlay` và `br_netfilter` để phục vụ mạng ảo của container.
   ```bash
   modprobe overlay
   modprobe br_netfilter
   ```
3. **Cấu hình Sysctl**: Cho phép chuyển tiếp lưu lượng mạng IPv4 và lọc gói tin cầu mạng (Bridge).
   ```bash
   net.bridge.bridge-nf-call-iptables  = 1
   net.bridge.bridge-nf-call-ip6tables = 1
   net.ipv4.ip_forward                 = 1
   ```

---

## 3. Cài Đặt Container Runtime & Kubernetes Packages

1. **Containerd Runtime**:
   * Cài đặt phiên bản `containerd.io` từ Docker Repository chính thức.
   * Cấu hình cgroup driver sử dụng **SystemdCgroup** để đồng bộ với cơ chế quản lý tiến trình của OS:
     ```toml
     # /etc/containerd/config.toml
     [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
       SystemdCgroup = true
     ```
2. **Cài đặt kubeadm, kubelet, kubectl**:
   * Sử dụng kho lưu trữ APT chính thức của Kubernetes (`pkgs.k8s.io`).
   * Khóa phiên bản cài đặt ở **v1.31.14** để tương thích hoàn toàn với Master Node:
     ```bash
     apt-get install -y kubelet="1.31.14-1.1" kubeadm="1.31.14-1.1" kubectl="1.31.14-1.1"
     apt-mark hold kubelet kubeadm kubectl
     ```

---

## 4. Định Tuyến Lai Tự Động & Bền Vững (Persistent Wildcard DNAT)

Do API Server chạy trên Master Node nằm ngoài mạng LAN cục bộ, chúng ta xây dựng dịch vụ định tuyến Tailscale tự động trên Worker VM:
* **Tạo Systemd Service**: Dịch vụ `k8s-hybrid-routing.service` tự động chạy sau khi interface mạng `tailscale0` được khởi tạo.
* **Cơ chế hoạt động**:
  1. Thêm luồng định tuyến (ip route) đẩy dải mạng ảo cụm (`10.200.0.0/24` và `10.96.0.0/12`) qua card mạng `tailscale0`.
  2. Sử dụng `iptables` dịch địa chỉ đích (DNAT) toàn bộ gói tin gửi tới API Server ảo `10.200.0.1` về IP Tailscale thật của Master Node `100.84.131.65`.
  3. Dịch địa chỉ cổng dịch vụ Kubernetes Internal `10.96.0.1:443` về cổng API thật `100.84.131.65:6443`.
  4. Thực hiện kỹ thuật ẩn địa chỉ IP nguồn (`MASQUERADE`) trên card mạng `tailscale0` để đảm bảo gói tin phản hồi quay lại Worker Node chính xác.

```ini
# /etc/systemd/system/k8s-hybrid-routing.service
[Unit]
Description=Kubernetes Hybrid Cluster Routing Setup
After=tailscaled.service
BindsTo=sys-devices-virtual-net-tailscale0.device
After=sys-devices-virtual-net-tailscale0.device

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c "ip route add 10.200.0.0/24 dev tailscale0 || true"
ExecStart=/bin/bash -c "ip route add 10.96.0.0/12 dev tailscale0 || true"
ExecStart=/bin/bash -c "iptables -t nat -A OUTPUT -d 10.200.0.1 -j DNAT --to-destination 100.84.131.65"
ExecStart=/bin/bash -c "iptables -t nat -A OUTPUT -d 10.96.0.1 -p tcp --dport 443 -j DNAT --to-destination 100.84.131.65:6443"
ExecStart=/bin/bash -c "iptables -t nat -A PREROUTING -d 10.200.0.1 -j DNAT --to-destination 100.84.131.65"
ExecStart=/bin/bash -c "iptables -t nat -A PREROUTING -d 10.96.0.1 -p tcp --dport 443 -j DNAT --to-destination 100.84.131.65:6443"
ExecStart=/bin/bash -c "iptables -t nat -A POSTROUTING -o tailscale0 -j MASQUERADE"
```

---

## 5. Thực Hiện Ghép Nối Node (Kubeadm Join)

Để đăng ký thành công Worker Node vào Master Node bằng IP bảo mật:
1. **Cấu hình Kubelet ghi đè IP**: Ép Kubelet quảng bá IP Tailscale cục bộ thay vì IP mạng LAN thật của máy ảo:
   ```bash
   # /etc/default/kubelet
   KUBELET_EXTRA_ARGS="--node-ip=100.108.182.86 --address=0.0.0.0"
   ```
2. **Chạy lệnh Join**: Ghép nối thông qua địa chỉ IP ảo và Token xác thực:
   ```bash
   kubeadm join 10.200.0.1:6443 \
     --token tcptee.6x8uhcv08wr0bq2y \
     --discovery-token-ca-cert-hash sha256:76e21d17c2c403293960a7eaee0cec12f424a1f33123fe87ff85ad8982a6a262
   ```

3. **Kiểm tra trạng thái**:
   ```bash
   kubectl get nodes -o wide
   ```
   Kết quả trả về hiển thị Node `worker-local-1` ở trạng thái **Ready** với IP nội bộ chính xác là `100.108.182.86`.
