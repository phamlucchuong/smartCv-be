# Bước 3: Deploy Backend

Trong bước này bạn sẽ tạo file cấu hình môi trường, build Docker images và khởi chạy toàn bộ backend.

---

## 3.1 Tạo file .env

File `.env` chứa tất cả thông tin nhạy cảm như mật khẩu database, JWT secret, API keys. File này **không được** đưa lên GitHub.

```bash
cd ~/apps/smartcv/backend

# Copy file mẫu
cp .env.example .env

# Mở file để chỉnh sửa
nano .env
```

Điền đầy đủ các giá trị sau (thay `THAY_GIÁ_TRỊ_Ở_ĐÂY` bằng thông tin thật):

```env
# ==================== DATABASE — MongoDB ====================

MONGO_DB_HOST=mongodb
MONGO_DB_PORT=27017
MONGO_DB_USERNAME=admin
MONGO_DB_PASSWORD=THAY_MẬT_KHẨU_MẠNH_Ở_ĐÂY

# Tên database cho từng service (có thể giữ giá trị mặc định)
USER_MONGO_DB_NAME=smartcv_user
JOB_MONGO_DB_NAME=job_db
APP_MONGO_DB_NAME=application_db

# ==================== DATABASE — PostgreSQL ====================

# Notification Service dùng DSN (connection string), không dùng các biến riêng lẻ
# Cú pháp: postgres://user:password@host:port/database
PSQL_DSN=postgres://postgres:THAY_MẬT_KHẨU_Ở_ĐÂY@postgresql:5432/notification_db

# Các biến sau dùng cho container PostgreSQL khởi tạo database lần đầu
POSTGRES_DB_USER=postgres
POSTGRES_DB_PASSWORD=THAY_MẬT_KHẨU_MẠNH_Ở_ĐÂY
POSTGRES_DB_NAME=notification_db
POSTGRES_DB_PORT=5432

# ==================== DATABASE — Redis ====================

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# ==================== MESSAGE QUEUE ====================

RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=THAY_MẬT_KHẨU_MẠNH_Ở_ĐÂY

# ==================== SECURITY ====================

# JWT Secret Key — dùng lệnh bên dưới để tạo chuỗi ngẫu nhiên
JWT_SECRET_KEY=THAY_CHUỖI_NGẪU_NHIÊN_DÀI_64_KÝ_TỰ_Ở_ĐÂY

# Internal secret giữa Gateway và các services
GATEWAY_INTERNAL_SECRET=THAY_CHUỖI_NGẪU_NHIÊN_Ở_ĐÂY

# ==================== CORS (API Gateway) ====================

# Liệt kê TẤT CẢ origin frontend được phép gọi API, ngăn cách bằng dấu phẩy
CORS_ORIGINS=https://smartcv-chuongpl.io.vn,https://recruiter.smartcv-chuongpl.io.vn,https://admin.smartcv-chuongpl.io.vn

# Domain frontend chính (dùng cho redirect email xác thực trong user-service)
FE_DOMAIN=https://smartcv-chuongpl.io.vn

# ==================== EMAIL (SMTP) ====================

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email_của_bạn@gmail.com
SMTP_PASSWORD=APP_PASSWORD_GMAIL_CỦA_BẠN
SMTP_FROM=SmartCV <email_của_bạn@gmail.com>
SMTP_NAME=SmartCV

# ==================== TWILIO (SMS) ====================

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1234567890

# ==================== FIREBASE (Push Notification) ====================

# FCM_SERVICE_ACCOUNT_JSON: toàn bộ nội dung file JSON service account Firebase (1 dòng)
# Tải file JSON từ Firebase Console → Project Settings → Service accounts → Generate new private key
FCM_PROJECT_ID=your-firebase-project-id
FCM_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"..."}

# ==================== AI ENGINE SERVICE ====================

# Tên database MongoDB cho AI service
AI_MONGO_DB_NAME=ai_engine_db

# Điền ít nhất 1 provider AI (các provider còn lại để trống nếu không dùng)

# Groq (miễn phí, nhanh — khuyến nghị dùng thử)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_DEFAULT_MODEL=llama-3.3-70b-versatile

# Gemini (Google)
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
GEMINI_DEFAULT_MODEL=gemini-2.0-flash

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_DEFAULT_MODEL=claude-haiku-4-5-20251001

# Azure OpenAI (nếu dùng)
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
```

> **Lưu ý quan trọng:** File `.env.example` đã có trong repo với đúng tên biến. Sau khi `cp .env.example .env`, hãy đọc kỹ từng biến trong `.env.example` và điền vào — ưu tiên file gốc hơn template trên.

### Tạo JWT Secret ngẫu nhiên

```bash
# Tạo chuỗi random 64 ký tự
openssl rand -base64 64 | tr -d '\n'
```

Copy kết quả và dán vào `JWT_SECRET_KEY` trong file `.env`.

Làm tương tự cho `GATEWAY_INTERNAL_SECRET` (dùng lệnh trên thêm 1 lần nữa).

### Lưu và thoát nano

Nhấn `Ctrl + X` → `Y` → `Enter`

---

## 3.2 Tạo AWS ECR Repository (lưu Docker images)

> **ECR (Elastic Container Registry)** là nơi lưu trữ Docker images trên AWS — giống như Docker Hub nhưng của AWS.

Chạy các lệnh sau trên **máy local** (không phải EC2):

```bash
# Tạo ECR repository cho từng service
# Thay 123456789012 bằng AWS Account ID của bạn, ap-southeast-1 là region bạn chọn

aws ecr create-repository --repository-name smartcv/api-gateway --region ap-southeast-1
aws ecr create-repository --repository-name smartcv/user-service --region ap-southeast-1
aws ecr create-repository --repository-name smartcv/job-service --region ap-southeast-1
aws ecr create-repository --repository-name smartcv/application-service --region ap-southeast-1
aws ecr create-repository --repository-name smartcv/notification-service --region ap-southeast-1
aws ecr create-repository --repository-name smartcv/ai-engine-service --region ap-southeast-1
```

Ghi lại địa chỉ ECR hiện ra (dạng `123456789012.dkr.ecr.ap-southeast-1.amazonaws.com`). Đây là **ECR_REGISTRY** dùng ở các bước sau.

---

## 3.3 Build và Push Docker Images (lần đầu — thủ công)

> **Lưu ý:** Từ Bước 7 trở đi, GitHub Actions sẽ làm việc này tự động. Bước này chỉ cần làm **một lần** khi deploy lần đầu.

Chạy trên **máy local** trong thư mục `backend/`:

```bash
cd /đường/dẫn/đến/smartcv/backend

# Lấy AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.ap-southeast-1.amazonaws.com"

echo "ECR Registry: $ECR_REGISTRY"

# Đăng nhập vào ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin $ECR_REGISTRY
# Kết quả: "Login Succeeded"
```

### Build và push từng service

```bash
# API Gateway
cd api-gateway
docker build -t smartcv/api-gateway:latest .
docker tag smartcv/api-gateway:latest $ECR_REGISTRY/smartcv/api-gateway:latest
docker push $ECR_REGISTRY/smartcv/api-gateway:latest
cd ..

# User Service
cd user-service
docker build -t smartcv/user-service:latest .
docker tag smartcv/user-service:latest $ECR_REGISTRY/smartcv/user-service:latest
docker push $ECR_REGISTRY/smartcv/user-service:latest
cd ..

# Job Service
cd job_service
docker build -t smartcv/job-service:latest .
docker tag smartcv/job-service:latest $ECR_REGISTRY/smartcv/job-service:latest
docker push $ECR_REGISTRY/smartcv/job-service:latest
cd ..

# Application Service
cd application_service
docker build -t smartcv/application-service:latest .
docker tag smartcv/application-service:latest $ECR_REGISTRY/smartcv/application-service:latest
docker push $ECR_REGISTRY/smartcv/application-service:latest
cd ..

# Notification Service (Go)
cd notification-service
docker build -t smartcv/notification-service:latest .
docker tag smartcv/notification-service:latest $ECR_REGISTRY/smartcv/notification-service:latest
docker push $ECR_REGISTRY/smartcv/notification-service:latest
cd ..

# AI Engine Service
cd ai_engine_service
docker build -t smartcv/ai-engine-service:latest .
docker tag smartcv/ai-engine-service:latest $ECR_REGISTRY/smartcv/ai-engine-service:latest
docker push $ECR_REGISTRY/smartcv/ai-engine-service:latest
cd ..

# Payment Engine Service
cd payment_service
docker build -t smartcv/payment-service:latest .
docker tag smartcv/payment-service:latest $ECR_REGISTRY/smartcv/payment-service:latest
docker push $ECR_REGISTRY/smartcv/payment-service:latest
cd ..
```

> Mỗi service mất 3–10 phút để build. Tổng cộng khoảng 40–60 phút lần đầu (6 services).

---

## 3.4 Gắn IAM Role vào EC2 (để EC2 có quyền dùng AWS)

> **Làm bước này trước** — bước 3.5 cần AWS CLI trên EC2 chạy được, mà AWS CLI chỉ hoạt động sau khi EC2 có IAM Role.

EC2 cần IAM Role để tự xác thực với AWS (pull images từ ECR, chạy SSM cho CI/CD) — không cần lưu credentials thủ công.

1. Vào AWS Console → **IAM** → **Roles** → **Create role**
2. Chọn **AWS service** → **EC2** → Next
3. Tìm và tick **2 policies** sau:
   - `AmazonEC2ContainerRegistryReadOnly` — để pull Docker images từ ECR
   - `AmazonSSMManagedInstanceCore` — để CI/CD deploy qua SSM (dùng ở Bước 7)
4. Đặt tên role: `EC2-SmartCV-Role` → Create role
5. Quay về **EC2** → Instances → Click instance của bạn → **Actions** → **Security** → **Modify IAM role**
6. Chọn `EC2-SmartCV-Role` → **Update IAM role**

Kiểm tra EC2 đã có credentials chưa (chạy **trên EC2**):

```bash
aws sts get-caller-identity
```

Kết quả mong đợi:
```json
{
    "UserId": "AROAXXXXXXXXXXXXXXXX:i-0abc123...",
    "Account": "123456789012",
    "Arn": "arn:aws:sts::123456789012:assumed-role/EC2-SmartCV-Role/i-0abc123..."
}
```

Nếu thấy `Account` có số là thành công. Nếu vẫn báo lỗi credentials, chờ 30 giây rồi thử lại (IAM Role cần vài giây để propagate).

---

## 3.5 Trỏ Docker Compose vào ECR (tự động qua .env)

> **Không cần sửa `docker-compose.prod.yaml`.** File đó đã dùng cú pháp `${API_GATEWAY_IMAGE:-default}` — nghĩa là Docker Compose tự đọc giá trị từ `.env`. Chỉ cần thêm các biến image vào `.env` là xong.

Chạy lệnh sau **trên EC2** để tự động thêm địa chỉ ECR vào `.env`:

```bash
cd ~/apps/smartcv/backend

# Lấy AWS Account ID từ IAM Role (tự động, không cần nhập tay)
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.ap-southeast-1.amazonaws.com"

# Thêm địa chỉ image vào cuối file .env
cat >> .env << EOF

# ==================== DOCKER IMAGES (ECR) ====================
API_GATEWAY_IMAGE=${ECR_REGISTRY}/smartcv/api-gateway:latest
USER_SERVICE_IMAGE=${ECR_REGISTRY}/smartcv/user-service:latest
JOB_SERVICE_IMAGE=${ECR_REGISTRY}/smartcv/job-service:latest
APPLICATION_SERVICE_IMAGE=${ECR_REGISTRY}/smartcv/application-service:latest
NOTIFICATION_SERVICE_IMAGE=${ECR_REGISTRY}/smartcv/notification-service:latest
AI_SERVICE_IMAGE=${ECR_REGISTRY}/smartcv/ai-engine-service:latest
EOF

echo "Đã thêm ECR image URLs vào .env. Kiểm tra:"
grep "_IMAGE=" .env
```

Kết quả mong đợi:
```
API_GATEWAY_IMAGE=123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/smartcv/api-gateway:latest
USER_SERVICE_IMAGE=123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/smartcv/user-service:latest
...
```

Sau đó đăng nhập ECR để Docker có thể pull images:

```bash
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.ap-southeast-1.amazonaws.com
# Kết quả: Login Succeeded
```

---

## 3.6 Khởi chạy Backend  

Trên EC2:

```bash
cd ~/apps/smartCv/backend

# Pull tất cả images từ ECR
docker compose -f docker-compose.prod.yaml pull

# Khởi chạy tất cả services ở chế độ nền
docker compose -f docker-compose.prod.yaml up -d

# Xem trạng thái các container
docker compose -f docker-compose.prod.yaml ps
```

Kết quả mong đợi — tất cả services phải ở trạng thái `running` hoặc `healthy`:

```
NAME                         STATUS
smartCv-api-gateway          running
smartCv-user-service         running
smartCv-job-service          running
smartCv-application-service  running
smartCv-notification-service running
smartCv-mongodb              healthy
smartCv-postgres             healthy
smartCv-redis                healthy
smartCv-rabbitmq             running
smartCv-elasticsearch        healthy
```

> **Lần đầu chạy Elasticsearch** có thể mất 1–2 phút để khởi động hoàn toàn.

---

## 3.7 Kiểm tra Backend hoạt động

```bash
# Kiểm tra API Gateway có phản hồi không (từ trong EC2)
curl http://localhost:8080/actuator/health
# Kết quả mong đợi: {"status":"UP"}

# Xem logs của một service cụ thể (nếu cần debug)
docker compose -f docker-compose.prod.yaml logs -f user-service
# Nhấn Ctrl+C để thoát
```

---

## 3.8 Cấu hình tự khởi động lại khi EC2 reboot

```bash
# Tạo systemd service để tự động chạy Docker Compose khi khởi động
sudo nano /etc/systemd/system/smartcv-backend.service
```

Dán nội dung sau vào:

```ini
[Unit]
Description=SmartCV Backend Services
Requires=docker.service
After=docker.service network.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/apps/smartcv/backend
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yaml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yaml down
TimeoutStartSec=300
User=ubuntu

[Install]
WantedBy=multi-user.target
```

Lưu file (`Ctrl+X`, `Y`, `Enter`) và kích hoạt:

```bash
sudo systemctl daemon-reload
sudo systemctl enable smartcv-backend.service
sudo systemctl start smartcv-backend.service

# Kiểm tra
sudo systemctl status smartcv-backend.service
```

---

## Tóm tắt Bước 3

Sau bước này:
- [x] File `.env` đã cấu hình đầy đủ
- [x] Docker images đã build và push lên ECR
- [x] Toàn bộ backend đang chạy bên trong Docker Compose
- [x] Backend tự động khởi động lại khi EC2 reboot

**Tiếp theo:** [Bước 4 — Cấu hình Nginx + HTTPS](./04-nginx-ssl.md)
