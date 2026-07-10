# Bước 4: Cấu hình Nginx + HTTPS

Nginx đóng vai trò "cổng vào" của backend: nhận tất cả request từ internet vào cổng 443 (HTTPS), rồi chuyển tiếp vào `api-gateway` đang chạy ở cổng 8080 bên trong Docker.

```
Internet → api.smartcv-chuongpl.io.vn:443 (HTTPS) → Nginx → localhost:8080 (api-gateway)
```

---

## 4.1 Tạo cấu hình Nginx cho API

Trên EC2:

```bash
sudo nano /etc/nginx/sites-available/smartcv-api
```

Dán nội dung sau (thay `api.smartcv-chuongpl.io.vn` bằng domain thật của bạn):

```nginx
server {
    listen 80;
    server_name api.smartcv-chuongpl.io.vn;

    # Certbot sẽ tự thêm cấu hình HTTPS vào đây sau
    # Tạm thời để HTTP để lấy certificate trước

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;

        # Headers quan trọng để Spring Boot biết request đến từ đâu
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout cho các request lâu (ví dụ: AI processing)
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Cho phép upload file lớn (CV, ảnh)
        client_max_body_size 10M;
    }
}
```

---

## 4.2 Kích hoạt cấu hình Nginx

```bash
# Tạo symbolic link để kích hoạt site
sudo ln -s /etc/nginx/sites-available/smartcv-api /etc/nginx/sites-enabled/

# Kiểm tra cú pháp cấu hình (không được có lỗi)
sudo nginx -t
# Kết quả mong đợi:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Tải lại cấu hình Nginx
sudo systemctl reload nginx
```

---

## 4.3 Lấy SSL Certificate với Certbot

> **Điều kiện bắt buộc:** DNS `api.yourdomain.com` đã trỏ về Elastic IP của EC2 (đã làm ở Bước 1.5). Nếu DNS chưa cập nhật (thường mất 5–30 phút), hãy chờ và kiểm tra trước khi chạy Certbot.

Kiểm tra DNS đã trỏ đúng chưa:

```bash
# Thay api.smartcv-chuongpl.io.vn bằng domain của bạn
nslookup api.smartcv-chuongpl.io.vn
# Phải thấy địa chỉ IP là Elastic IP của EC2
```

Nếu DNS đã đúng, chạy Certbot:

```bash
sudo certbot --nginx -d api.smartcv-chuongpl.io.vn
```

Certbot sẽ hỏi một vài câu:
1. Nhập **email** của bạn (để nhận thông báo khi certificate sắp hết hạn)
2. Đồng ý điều khoản: nhập `Y`
3. Có muốn nhận email từ EFF không: nhập `N`
4. Certbot tự động cấu hình HTTPS cho Nginx

Kết quả thành công sẽ có dòng:
```
Successfully received certificate.
...
Congratulations! You have successfully enabled HTTPS on https://api.smartcv-chuongpl.io.vn
```

---

## 4.4 Xem cấu hình Nginx sau khi Certbot chỉnh sửa

```bash
cat /etc/nginx/sites-available/smartcv-api
```

Certbot đã tự động thêm phần HTTPS. File sẽ trông như thế này:

```nginx
server {
    listen 80;
    server_name api.smartcv-chuongpl.io.vn;
    return 301 https://$host$request_uri;  # Certbot thêm: tự redirect HTTP → HTTPS
}

server {
    listen 443 ssl;
    server_name api.smartcv-chuongpl.io.vn;

    ssl_certificate /etc/letsencrypt/live/api.smartcv-chuongpl.io.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.smartcv-chuongpl.io.vn/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        client_max_body_size 10M;
    }
}
```

---

## 4.5 Cấu hình tự động gia hạn certificate

Let's Encrypt certificate có hiệu lực 90 ngày. Certbot đã tự tạo cron job để gia hạn, nhưng hãy kiểm tra:

```bash
# Kiểm tra timer gia hạn tự động
sudo systemctl status certbot.timer
# Phải thấy "active"

# Thử gia hạn (chế độ dry-run — không gia hạn thật, chỉ kiểm tra)
sudo certbot renew --dry-run
# Phải thấy "Congratulations, all simulated renewals succeeded"
```

---

## 4.6 Kiểm tra HTTPS hoạt động

```bash
# Từ máy local của bạn, test API qua HTTPS
curl https://api.smartcv-chuongpl.io.vn/health
# Kết quả: {"status":"UP"}
```

Hoặc mở trình duyệt, truy cập `https://api.smartcv-chuongpl.io.vn/user/swagger-ui.html` — phải thấy Swagger UI và biểu tượng khóa HTTPS trên thanh địa chỉ.

---

## Tóm tắt Bước 4

Sau bước này:
- [x] Nginx đang chạy và chuyển tiếp request vào api-gateway
- [x] HTTPS hoạt động trên `api.yourdomain.com`
- [x] HTTP tự động redirect sang HTTPS
- [x] Certificate tự động gia hạn mỗi 90 ngày

**Tiếp theo:** [Bước 5 — S3 + CloudFront](./05-s3-cloudfront.md)
