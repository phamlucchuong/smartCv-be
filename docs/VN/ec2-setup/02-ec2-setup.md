# Bước 2: Cấu hình EC2 Server

Trong bước này, bạn sẽ SSH vào EC2 và cài đặt tất cả phần mềm cần thiết để chạy backend.

---

## 2.1 Cấu hình Security Group (Mở cổng mạng)

Security Group là "tường lửa" của EC2. Bạn cần mở các cổng sau để hệ thống hoạt động.

### Trên AWS Console

1. Vào **EC2** → **Instances** → Click vào instance của bạn
2. Ở tab **Security** → Click vào tên Security Group (ví dụ: `launch-wizard-1`)
3. Click **Edit inbound rules** → **Add rule** và thêm lần lượt:

| Type | Protocol | Port range | Source | Mục đích |
|------|----------|-----------|--------|----------|
| SSH | TCP | 22 | My IP | SSH vào server (chỉ IP của bạn) |
| HTTP | TCP | 80 | 0.0.0.0/0 | HTTP (Nginx redirect sang HTTPS) |
| HTTPS | TCP | 443 | 0.0.0.0/0 | HTTPS (API endpoint) |

> **Lưu ý bảo mật:** Cổng 22 (SSH) chỉ nên mở cho IP của bạn, không mở `0.0.0.0/0` (toàn internet).  
> Các cổng nội bộ (8080, 8081...) **không** cần mở ra ngoài vì Nginx sẽ làm cầu nối.

4. Click **Save rules**

---

## 2.2 SSH vào EC2

```bash
ssh -i /đường/dẫn/đến/key.pem ubuntu@<ELASTIC_IP>
```

Tất cả các lệnh từ đây trở đi đều **chạy trên EC2** (không phải máy local), trừ khi có ghi chú khác.

---

## 2.3 Cập nhật hệ thống và cài công cụ cơ bản

```bash
sudo apt update && sudo apt upgrade -y

# Cài các công cụ hay dùng (unzip cần cho một số script cài đặt)
sudo apt install -y unzip curl git nano
```

Quá trình này mất 2–5 phút. Nếu có hỏi về cấu hình (ví dụ kernel restart), nhấn Enter để chọn mặc định.

---

## 2.4 Cài AWS CLI

EC2 cần AWS CLI để đăng nhập ECR (kéo Docker images) và để CI/CD deploy qua SSM.

```bash
# Cài qua snap — không cần unzip, nhanh nhất trên Ubuntu
sudo snap install aws-cli --classic

# Kiểm tra
aws --version
# aws-cli/2.x.x
```

> **Lưu ý:** Sau khi cài xong, AWS CLI trên EC2 **không cần cấu hình credentials thủ công** (`aws configure`). EC2 sẽ tự dùng IAM Role được gắn vào instance (cấu hình ở Bước 3.5). Nếu chạy `aws sts get-caller-identity` ngay lúc này sẽ báo lỗi — đó là bình thường, vì IAM Role chưa được gắn.

---

## 2.6 Cài Docker

```bash
# Cài các gói phụ thuộc
sudo apt install -y ca-certificates curl gnupg lsb-release

# Thêm GPG key của Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Thêm repository Docker
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Cài Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Cho phép user ubuntu dùng Docker mà không cần sudo
sudo usermod -aG docker ubuntu

# Kích hoạt thay đổi group (quan trọng!)
newgrp docker

# Kiểm tra Docker hoạt động
docker --version
# Docker version 24.x.x

docker compose version
# Docker Compose version v2.x.x
```

---

## 2.7 Cài Nginx

Nginx sẽ đóng vai trò reverse proxy: nhận request từ internet vào cổng 443, rồi chuyển tiếp vào `api-gateway` đang chạy ở cổng 8080 bên trong Docker.

```bash
sudo apt install -y nginx

# Kiểm tra Nginx đang chạy
sudo systemctl status nginx
# Phải thấy "active (running)"

# Đảm bảo Nginx tự khởi động khi server reboot
sudo systemctl enable nginx
```

---

## 2.8 Cài Certbot (để lấy SSL certificate HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx

# Kiểm tra
certbot --version
```

---

## 2.9 Cài Git và clone repository

```bash
# Git đã được cài ở bước 2.3, kiểm tra lại
git --version
```

### Tạo SSH key trên EC2 để kết nối GitHub

```bash
# Tạo SSH key mới trên EC2
ssh-keygen -t ed25519 -C "ec2-smartcv-deploy"
# Nhấn Enter 3 lần để dùng đường dẫn và passphrase mặc định

# Hiển thị public key
cat ~/.ssh/id_ed25519.pub
```

Copy toàn bộ nội dung hiện ra (bắt đầu bằng `ssh-ed25519 ...`).

Sau đó:
1. Vào GitHub → **Settings** (góc phải) → **SSH and GPG keys** → **New SSH key**
2. Đặt Title: `EC2 SmartCV`
3. Dán public key vào ô Key
4. Click **Add SSH key**

### Clone repository

```bash
# Tạo thư mục cho app
mkdir -p ~/apps
cd ~/apps

# Clone repo (thay bằng URL repo thật của bạn)
git clone git@github.com:your-username/smartcv.git

# Vào thư mục backend
cd smartcv/backend

# Kiểm tra cấu trúc
ls
# Phải thấy: api-gateway, user-service, job_service, ...
```

---

## 2.8 Cài Java (để build service nếu cần)

> **Nếu bạn dùng CI/CD (Bước 7):** GitHub Actions sẽ build Docker images tự động, bạn không cần cài Java trên EC2. Bỏ qua phần này.  
> **Nếu bạn muốn build thủ công trên EC2:** Cài Java theo hướng dẫn dưới.

```bash
# Cài Java 21 (tương thích với Spring Boot 3.x)
sudo apt install -y openjdk-21-jdk

# Kiểm tra
java --version
# openjdk 21.x.x
```

---

## Tóm tắt Bước 2

Sau bước này EC2 đã có:
- [x] Security Group mở cổng 80, 443
- [x] `unzip`, `curl`, `git`, `nano` đã cài
- [x] AWS CLI đã cài (qua snap)
- [x] Docker + Docker Compose đã cài
- [x] Nginx đã cài và đang chạy
- [x] Certbot đã cài
- [x] Repository đã clone vào `~/apps/smartcv/`

**Tiếp theo:** [Bước 3 — Deploy Backend](./03-backend-deploy.md)
