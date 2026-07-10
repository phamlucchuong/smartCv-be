# Bước 8: Xử lý lỗi thường gặp

Tài liệu này ghi lại các lỗi phổ biến khi deploy SmartCV lên AWS và cách khắc phục từng bước.

---

## Lỗi Frontend

### 1. Trang trắng hoàn toàn khi truy cập website

**Triệu chứng:** Truy cập `smartcv-chuongpl.io.vn` nhưng chỉ thấy trang trắng, không có nội dung.

**Nguyên nhân thường gặp:**

**A. index.html chưa upload hoặc upload sai thư mục**
```bash
# Kiểm tra file có trong S3 không
aws s3 ls s3://smartcv-frontend/web-candidate/
# Phải thấy index.html trong kết quả

# Nếu không có, upload lại
aws s3 cp frontend/apps/web-candidate/dist/index.html \
  s3://smartcv-frontend/web-candidate/index.html
```

**B. CloudFront chưa cấu hình Default root object**
- Vào CloudFront → Distribution của web-candidate → **Edit** → **Default root object**: điền `index.html`

**C. Lỗi JavaScript — kiểm tra DevTools**
- Mở trình duyệt → F12 → tab **Console** → xem có lỗi đỏ không
- Lỗi `Failed to fetch` hoặc `Network Error` → xem mục CORS bên dưới

---

### 2. Lỗi 403/404 khi F5 (refresh) hoặc truy cập link trực tiếp

**Triệu chứng:** Vào `smartcv-chuongpl.io.vn` được, nhưng F5 ở trang `smartcv-chuongpl.io.vn/jobs/123` thì báo 403/404.

**Nguyên nhân:** Chưa cấu hình custom error pages trong CloudFront.

**Cách fix:**
1. Vào CloudFront → Distribution → tab **Error pages**
2. Click **Create custom error response**
3. Thêm 2 rules:
   - `403` → `/index.html` → response code `200`
   - `404` → `/index.html` → response code `200`

---

### 3. Lỗi CORS (Cross-Origin Resource Sharing)

**Triệu chứng:** Console trình duyệt hiển thị:
```
Access to fetch at 'https://api.smartcv-chuongpl.io.vn/...' from origin 'https://smartcv-chuongpl.io.vn' 
has been blocked by CORS policy
```

**Cách fix:**

Kiểm tra biến `FE_DOMAIN` trong file `.env` trên EC2:
```bash
# Trên EC2
grep FE_DOMAIN ~/apps/smartcv/backend/.env
# Phải thấy: FE_DOMAIN=https://smartcv-chuongpl.io.vn (domain frontend thật)
```

Nếu sai, sửa lại và restart service:
```bash
nano ~/apps/smartcv/backend/.env
# Sửa FE_DOMAIN

# Restart user-service (service xử lý CORS)
cd ~/apps/smartcv/backend
docker compose -f docker-compose.prod.yaml restart user-service api-gateway
```

---

## Lỗi Backend (EC2)

### 4. Container không khởi động được

**Triệu chứng:** `docker compose ps` hiển thị service ở trạng thái `exited` hoặc `restarting`.

```bash
# Xem logs của service bị lỗi (ví dụ user-service)
docker compose -f docker-compose.prod.yaml logs --tail=50 user-service
```

**Nguyên nhân thường gặp:**

**A. Thiếu biến môi trường trong .env**
- Đọc log kỹ, tìm dòng như `Environment variable XXX is required`
- Thêm biến vào file `.env` rồi restart

**B. Database chưa khởi động xong khi service start**
```bash
# Kiểm tra database có healthy không
docker compose -f docker-compose.prod.yaml ps mongodb
# Phải thấy "(healthy)"

# Chờ database healthy rồi restart service
docker compose -f docker-compose.prod.yaml restart user-service
```

**C. Hết RAM**
```bash
# Kiểm tra RAM còn bao nhiêu
free -h
# Nếu "available" dưới 500MB thì cần tăng RAM hoặc thêm swap
```

---

### 5. Hết RAM — thêm Swap

EC2 t3.large có 8GB RAM, đủ dùng cho SmartCV. Nhưng nếu cần dự phòng:

```bash
# Tạo swap file 4GB
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Tự động mount swap khi reboot
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Kiểm tra
free -h
# Phải thấy dòng Swap: 4.0G
```

---

### 6. Không kết nối được đến API (`connection refused` hoặc timeout)

**A. Kiểm tra api-gateway có chạy không**
```bash
docker compose -f docker-compose.prod.yaml ps api-gateway
curl http://localhost:8080/actuator/health
```

**B. Kiểm tra Nginx có chạy không**
```bash
sudo systemctl status nginx
# Nếu không chạy:
sudo systemctl start nginx
```

**C. Kiểm tra Security Group có mở port 443 không**
- Vào EC2 → Security Groups → Inbound rules
- Phải có rule: Port 443 từ `0.0.0.0/0`

---

### 7. Elasticsearch không khởi động — lỗi max virtual memory

**Triệu chứng:** Log Elasticsearch có dòng:
```
max virtual memory areas vm.max_map_count [65530] is too low
```

**Cách fix:**
```bash
# Tăng giới hạn (trên EC2)
sudo sysctl -w vm.max_map_count=262144

# Để tồn tại sau reboot
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf

# Restart Elasticsearch
docker compose -f docker-compose.prod.yaml restart elasticsearch
```

---

## Lỗi CI/CD (GitHub Actions)

### 8. Workflow thất bại ở bước "Deploy to EC2 via SSM"

**Triệu chứng:** Lỗi `An error occurred (InvalidInstanceId) when calling the SendCommand operation`

**Nguyên nhân:** EC2 instance chưa cài SSM Agent hoặc không có IAM role phù hợp.

**Cách fix:**
```bash
# Trên EC2, kiểm tra SSM Agent
sudo systemctl status snap.amazon-ssm-agent.amazon-ssm-agent.service

# Nếu không chạy, cài lại
sudo snap install amazon-ssm-agent --classic
sudo systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service
sudo systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service
```

Đảm bảo IAM Role của EC2 có policy `AmazonSSMManagedInstanceCore`.

---

### 9. Build Docker image thất bại do thiếu bộ nhớ (GitHub Actions)

**Triệu chứng:** Lỗi `Killed` hoặc `Out of memory` trong quá trình build Java.

**Cách fix** — giảm memory cho Maven trong Dockerfile:

```dockerfile
# Trong Dockerfile của Java service, thêm tham số memory
RUN mvn clean package -DskipTests -Xmx512m
```

---

## Kiểm tra tổng thể hệ thống

Chạy danh sách kiểm tra này bất cứ khi nào bạn nghi ngờ có sự cố:

```bash
# === Trên EC2 ===

# 1. Tất cả container có chạy không?
docker compose -f ~/apps/smartcv/backend/docker-compose.prod.yaml ps

# 2. API Gateway phản hồi không?
curl http://localhost:8080/actuator/health

# 3. Nginx hoạt động không?
sudo systemctl status nginx
curl -I http://localhost

# 4. Certificate SSL còn hiệu lực không?
sudo certbot certificates

# 5. Dung lượng ổ đĩa còn bao nhiêu?
df -h /
# Cần ít nhất 20% còn trống

# 6. RAM còn bao nhiêu?
free -h

# === Từ máy local ===

# 7. HTTPS API hoạt động không?
curl https://api.smartcv-chuongpl.io.vn/actuator/health

# 8. Frontend load được không?
curl -I https://smartcv-chuongpl.io.vn
```

---

## Lệnh hữu ích

```bash
# Xem logs realtime của tất cả services
docker compose -f docker-compose.prod.yaml logs -f

# Restart một service cụ thể
docker compose -f docker-compose.prod.yaml restart <tên-service>

# Restart toàn bộ backend
docker compose -f docker-compose.prod.yaml down
docker compose -f docker-compose.prod.yaml up -d

# Xóa containers và volumes (NGUY HIỂM: mất dữ liệu database!)
# Chỉ dùng khi muốn reset hoàn toàn
docker compose -f docker-compose.prod.yaml down -v

# Dọn dẹp Docker (xóa images không dùng)
docker system prune -f
docker image prune -a -f
```
