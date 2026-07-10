# Hướng dẫn Deploy SmartCV lên AWS

Tài liệu này hướng dẫn bạn deploy toàn bộ hệ thống SmartCV lên AWS từ đầu đến cuối, bao gồm backend trên EC2 và frontend trên S3 + CloudFront.

---

## Kiến trúc tổng thể

```
Internet
   │
   ├── smartcv-chuongpl.io.vn           ──► CloudFront ──► S3/web-candidate/
   ├── recruiter.smartcv-chuongpl.io.vn ──► CloudFront ──► S3/web-recruiter/
   ├── admin.smartcv-chuongpl.io.vn     ──► CloudFront ──► S3/web-admin/
   │
   └── api.smartcv-chuongpl.io.vn ──────► EC2 (Elastic IP)
                                   │
                                Nginx (port 443/80)
                                   │
                          Docker Compose (internal)
                          ├── api-gateway     :8080
                          ├── user-service    :8081
                          ├── job-service     :8082
                          ├── application-service :8083
                          ├── notification-service :8084
                          ├── MongoDB
                          ├── PostgreSQL
                          ├── Redis
                          ├── RabbitMQ
                          └── Elasticsearch
```

> **Thay `smartcv-chuongpl.io.vn` bằng domain thật của bạn** trong tất cả các bước bên dưới.

---

## Thứ tự đọc và thực hiện

| Bước | File | Nội dung | Thời gian ước tính |
|------|------|----------|--------------------|
| 1 | [01-prerequisites.md](./01-prerequisites.md) | Cài đặt công cụ cần thiết (AWS CLI, Docker...) | 20–30 phút |
| 2 | [02-ec2-setup.md](./02-ec2-setup.md) | Cấu hình EC2: cài Docker, Nginx, clone repo | 30–45 phút |
| 3 | [03-backend-deploy.md](./03-backend-deploy.md) | Cấu hình .env, build và chạy backend | 45–60 phút |
| 4 | [04-nginx-ssl.md](./04-nginx-ssl.md) | Cấu hình Nginx reverse proxy + HTTPS | 20–30 phút |
| 5 | [05-s3-cloudfront.md](./05-s3-cloudfront.md) | Tạo S3 bucket + CloudFront distribution | 30–45 phút |
| 6 | [06-frontend-build.md](./06-frontend-build.md) | Build 3 React app và upload lên S3 | 20–30 phút |
| 7 | [07-cicd-github-actions.md](./07-cicd-github-actions.md) | CI/CD tự động với GitHub Actions | 45–60 phút |
| 8 | [08-troubleshooting.md](./08-troubleshooting.md) | Xử lý lỗi thường gặp | Tham khảo khi cần |

**Tổng thời gian:** khoảng 3–4 giờ nếu làm lần đầu.

---

## Những thứ bạn cần chuẩn bị trước

- [x] Tài khoản AWS đã tạo
- [x] EC2 instance (t3.large trở lên) đã chạy, có Elastic IP
- [x] Có thể SSH vào EC2
- [x] S3 bucket đã tạo
- [x] Có domain riêng
- [ ] Máy tính local cài AWS CLI (hướng dẫn ở bước 1)
- [x] Máy tính local cài Node.js + pnpm (để build frontend)
- [x] Tài khoản GitHub (để dùng CI/CD)

---

## Lưu ý quan trọng

> **Bảo mật:** Không bao giờ commit file `.env` lên GitHub. File này chứa mật khẩu database, JWT secret, API keys.

> **Chi phí AWS:** EC2 t3.large (~$60/tháng), CloudFront (trả theo lượng traffic, thường rất rẻ với project nhỏ), S3 (vài cent/tháng). Tổng khoảng $60–80/tháng tùy lưu lượng.

> **Region:** Chọn 1 region duy nhất cho EC2 và S3 (ví dụ: `ap-southeast-1` — Singapore). **Riêng SSL certificate cho CloudFront phải tạo ở `us-east-1`** (sẽ nhắc lại ở bước 5).
