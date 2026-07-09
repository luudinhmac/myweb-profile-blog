Trên Local đảm bảo cài thành công helm và kubectl
Mở Powershell và chạy lệnh sau:
```sh
scoop install helm
```
2. Cấu hình quyền truy cập kubeconfig
kiểm tra xem máy tính đã kết nối tới cụm k8s chưa
kubectl cluster-info

```sh 
C:\Users\Mac>kubectl cluster-info
Kubernetes control plane is running at https://127.0.0.1:6443
CoreDNS is running at https://127.0.0.1:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
```
Thêm và cập nhật Helm repository
```sh
helm repo add aqua https://aquasecurity.github.io/helm-charts/
helm repo update
```

```sh
C:\Users\Mac>helm repo add aqua https://aquasecurity.github.io/helm-charts/
"aqua" has been added to your repositories

C:\Users\Mac>helm repo update
Hang tight while we grab the latest from your chart repositories...
...Successfully got an update from the "aqua" chart repository
Update Complete. ⎈Happy Helming!⎈

```
# Triển khai vào cụm k8s
Từ máy tính local chạy lệnh để triển khai vào cụm
```sh
helm upgrade --install trivy-operator aqua/trivy-operator \
  --namespace trivy-system \
  --create-namespace \
  -f custom-values.yaml
```

K8s sẽ tự động khởi tạo các thành phần ngầm. Diễn ra tự động bên trong cluster.
Lúc này bên trong k8s sẽ diễn ra các hoạt động sau:
- Tạo ra các CRDs (Custom Resource Definitions) để định nghĩa các loại báo cáo bảo mật
- Tạo ra ServiceAcount, ClusterRole, ClusterRoleBinding để cấp quyền cho trivy operator giám sát cụm
- Tạo 1 deployment (chạy pod trivy-operation....) đóng vai trò bộ não điều khiển.

# Kiểm tra trạng thái của operator
kubectl get pods -n trivy-system