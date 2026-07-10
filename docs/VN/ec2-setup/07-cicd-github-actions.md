# Bước 7: CI/CD với GitHub Actions

Hệ thống CI/CD gồm **2 nhóm workflow** hoạt động độc lập:

| Nhóm | Trigger | Mục đích |
|------|---------|----------|
| **CI — Quality Gate** | Push lên `dev`, PR vào `main`/`dev` | Lint → Compile → Test. Chặn code lỗi trước khi merge |
| **CD — Deploy** | Merge vào `main` | Build Docker image → ECR → EC2 (backend) hoặc S3 + CloudFront (frontend) |

---

## 7.1 Cấp thêm quyền cho IAM User

IAM User `smartcv-deploy` (tạo ở Bước 1) cần thêm quyền SSH vào EC2 thông qua SSM (không cần mở port 22 ra internet):

1. Vào **IAM** → **Users** → `smartcv-deploy` → **Add permissions**
2. Attach policy: `AmazonSSMManagedInstanceCore`

Ngoài ra, đảm bảo EC2 instance cũng được gắn policy này qua IAM Role (đã làm ở Bước 3.5, thêm policy `AmazonSSMManagedInstanceCore` vào role `EC2-ECR-ReadOnly`).

---

## 7.2 Lưu Secrets vào GitHub

GitHub Secrets là nơi lưu thông tin nhạy cảm (credentials, keys) — chúng được mã hóa và chỉ GitHub Actions mới đọc được.

### Cách thêm Secret

1. Vào repository GitHub của bạn
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Thêm từng secret theo bảng dưới

### Danh sách Secrets cần tạo

| Secret Name | Giá trị | Lấy từ đâu |
|-------------|---------|------------|
| `AWS_ACCESS_KEY_ID` | Access Key ID của IAM User | Bước 1.2 |
| `AWS_SECRET_ACCESS_KEY` | Secret Access Key của IAM User | Bước 1.2 |
| `AWS_REGION` | `ap-southeast-1` | Region của bạn |
| `AWS_ACCOUNT_ID` | ID tài khoản AWS | Chạy `aws sts get-caller-identity --query Account --output text` |
| `EC2_INSTANCE_ID` | ID của EC2 instance | Trong EC2 Console (dạng `i-0abc123...`) |
| `S3_BUCKET_NAME` | Tên bucket S3 | Bước 5 |
| `CF_DIST_ID_CANDIDATE` | Distribution ID CloudFront candidate | CloudFront Console |
| `CF_DIST_ID_RECRUITER` | Distribution ID CloudFront recruiter | CloudFront Console |
| `CF_DIST_ID_ADMIN` | Distribution ID CloudFront admin | CloudFront Console |
| `VITE_FIREBASE_API_KEY` | Firebase API Key | Firebase Console → Project Settings |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | Firebase Console |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | Firebase Console |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | Firebase Console |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | Firebase Console |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | Firebase Console |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Measurement ID | Firebase Console |
| `VITE_FIREBASE_VAPID_KEY` | Firebase VAPID Key | Firebase Console → Cloud Messaging |

---

## 7.3 CI — Quality Gate Workflows

Các workflow này **đã có sẵn** trong repo. Chúng chạy tự động khi push lên `dev` hoặc mở PR vào `main`/`dev`. Mục đích: ngăn code lỗi được merge.

### 7.3.1 Backend Java Services (`java-services-ci.yml`)

Chạy **song song** cho 5 Java services: `api-gateway`, `user-service`, `job_service`, `application_service`, `ai_engine_service`.

Mỗi service thực hiện 3 bước theo thứ tự:

**Bước 1 — Lint (Checkstyle)**

Kiểm tra 2 quy tắc:
- `RedundantImport` — import trùng lặp
- `UnusedImports` — import không dùng

Config tại `backend/tools/checkstyle/checkstyle.xml`.

Chạy thủ công ở local:
```bash
cd backend/<service-name>
./mvnw checkstyle:check \
  -Dcheckstyle.config.location=../tools/checkstyle/checkstyle.xml \
  -Dcheckstyle.includeTestSourceDirectory=true \
  -Dcheckstyle.consoleOutput=true
```

**Bước 2 — Compile**
```bash
./mvnw -DskipTests compile
```

**Bước 3 — Test**
```bash
./mvnw test
# Riêng ai_engine_service:
./mvnw test -Dspring.ai.ollama.chat.enabled=false
```

**Sửa lỗi Checkstyle thường gặp:**

```java
// ❌ UnusedImports — import không dùng ở bất kỳ đâu trong file
import java.util.List;

// ❌ RedundantImport — import cùng class 2 lần
import java.util.Map;
import java.util.Map;

// ✅ Xóa các import thừa. IDE hỗ trợ: IntelliJ → Code → Optimize Imports (Ctrl+Alt+O)
```

---

### 7.3.2 Notification Service Go (`noti-ci.yml`)

Chạy 4 bước:

| Bước | Lệnh | Mục đích |
|------|------|----------|
| Format check | `gofmt -l .` | Kiểm tra format code — phải trả về empty |
| Vet | `go vet ./...` | Phát hiện lỗi logic Go phổ biến |
| Test | `go test ./... -v` | Chạy toàn bộ unit test |
| Build | `go build -v ./cmd/server` | Xác nhận binary compile được |

Chạy thủ công ở local:
```bash
cd backend/notification-service

# Kiểm tra format (phải không có output)
gofmt -l .

# Tự động format lại (nếu có lỗi)
gofmt -w .

# Vet + test + build
go vet ./...
go test ./... -v
go build -v ./cmd/server
```

---

### 7.3.3 Frontend Quality (`frontend-quality.yml`)

Chạy **song song** cho 3 React apps: `web-candidate`, `web-recruiter`, `web-admin`.

Mỗi app thực hiện 4 bước:

| Bước | Lệnh | Mục đích |
|------|------|----------|
| Lint | `pnpm -F <app> lint` | ESLint — lỗi là hard failure |
| Typecheck | `pnpm -F <app> typecheck` | TypeScript strict mode |
| Test | `pnpm -F <app> test:coverage` | Vitest với coverage |
| Build | `pnpm -F <app> build` | Vite production build |

Chạy thủ công ở local:
```bash
cd frontend

pnpm -F web-candidate lint
pnpm -F web-recruiter lint
pnpm -F web-admin lint

pnpm -F web-candidate typecheck
# ...
```

> **Lưu ý:** ESLint errors (2 errors) là **hard failure** — CI fail ngay. Warnings không fail CI nhưng nên fix vì thường là correctness bugs (stale closure, broken memoization).

---

## 7.4 CD — Tạo Workflow Deploy Backend

Tạo file `.github/workflows/backend-deploy.yml`:

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/backend-deploy.yml'

jobs:
  deploy:
    name: Build, Push to ECR, Deploy to EC2
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: maven

      - name: Build and push API Gateway
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        run: |
          cd backend/api-gateway
          docker build -t $ECR_REGISTRY/smartcv/api-gateway:latest .
          docker push $ECR_REGISTRY/smartcv/api-gateway:latest

      - name: Build and push User Service
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        run: |
          cd backend/user-service
          docker build -t $ECR_REGISTRY/smartcv/user-service:latest .
          docker push $ECR_REGISTRY/smartcv/user-service:latest

      - name: Build and push Job Service
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        run: |
          cd backend/job_service
          docker build -t $ECR_REGISTRY/smartcv/job-service:latest .
          docker push $ECR_REGISTRY/smartcv/job-service:latest

      - name: Build and push Application Service
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        run: |
          cd backend/application_service
          docker build -t $ECR_REGISTRY/smartcv/application-service:latest .
          docker push $ECR_REGISTRY/smartcv/application-service:latest

      - name: Build and push Notification Service
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        run: |
          cd backend/notification-service
          docker build -t $ECR_REGISTRY/smartcv/notification-service:latest .
          docker push $ECR_REGISTRY/smartcv/notification-service:latest

      - name: Build and push AI Engine Service
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        run: |
          cd backend/ai_engine_service
          docker build -t $ECR_REGISTRY/smartcv/ai-engine-service:latest .
          docker push $ECR_REGISTRY/smartcv/ai-engine-service:latest

      - name: Deploy to EC2 via SSM
        run: |
          aws ssm send-command \
            --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
            --document-name "AWS-RunShellScript" \
            --parameters 'commands=[
              "cd /home/ubuntu/apps/smartCv/backend",
              "git pull origin main",
              "aws ecr get-login-password --region ${{ secrets.AWS_REGION }} | docker login --username AWS --password-stdin ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.${{ secrets.AWS_REGION }}.amazonaws.com",
              "docker compose -f docker-compose.prod.yaml pull",
              "docker compose -f docker-compose.prod.yaml up -d --remove-orphans",
              "docker image prune -f"
            ]' \
            --comment "Deploy SmartCV Backend" \
            --output text
```

---

## 7.5 CD — Tạo Workflow Deploy Frontend

Tạo file `.github/workflows/frontend-deploy.yml`:

```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
      - '.github/workflows/frontend-deploy.yml'

jobs:
  deploy:
    name: Build and Deploy to S3 + CloudFront
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install dependencies
        run: |
          cd frontend
          pnpm install --frozen-lockfile

      - name: Build all apps
        env:
          VITE_API_BASE_URL: https://api.smartcv-chuongpl.io.vn
          VITE_DOMAIN_URL: https://smartcv-chuongpl.io.vn
          VITE_I18N_DEFAULT_LOCALE: vi
          VITE_I18N_FALLBACK_LOCALE: en
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
          VITE_FIREBASE_VAPID_KEY: ${{ secrets.VITE_FIREBASE_VAPID_KEY }}
        run: |
          cd frontend
          pnpm build

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Upload web-candidate to S3
        run: |
          aws s3 sync frontend/apps/web-candidate/dist/ \
            s3://${{ secrets.S3_BUCKET_NAME }}/web-candidate/ \
            --delete --exclude "index.html" \
            --cache-control "public, max-age=31536000, immutable"
          aws s3 cp frontend/apps/web-candidate/dist/index.html \
            s3://${{ secrets.S3_BUCKET_NAME }}/web-candidate/index.html \
            --cache-control "no-cache, no-store, must-revalidate" \
            --content-type "text/html"

      - name: Upload web-recruiter to S3
        run: |
          aws s3 sync frontend/apps/web-recruiter/dist/ \
            s3://${{ secrets.S3_BUCKET_NAME }}/web-recruiter/ \
            --delete --exclude "index.html" \
            --cache-control "public, max-age=31536000, immutable"
          aws s3 cp frontend/apps/web-recruiter/dist/index.html \
            s3://${{ secrets.S3_BUCKET_NAME }}/web-recruiter/index.html \
            --cache-control "no-cache, no-store, must-revalidate" \
            --content-type "text/html"

      - name: Upload web-admin to S3
        run: |
          aws s3 sync frontend/apps/web-admin/dist/ \
            s3://${{ secrets.S3_BUCKET_NAME }}/web-admin/ \
            --delete --exclude "index.html" \
            --cache-control "public, max-age=31536000, immutable"
          aws s3 cp frontend/apps/web-admin/dist/index.html \
            s3://${{ secrets.S3_BUCKET_NAME }}/web-admin/index.html \
            --cache-control "no-cache, no-store, must-revalidate" \
            --content-type "text/html"

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DIST_ID_CANDIDATE }} --paths "/*"
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DIST_ID_RECRUITER }} --paths "/*"
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DIST_ID_ADMIN }} --paths "/*"
```

---

## 7.6 Commit và Push workflows

```bash
git add .github/workflows/
git commit -m "chore(ci): add backend and frontend deploy workflows"
git push origin main
```

Vào GitHub → tab **Actions** để xem workflow đang chạy. Lần đầu build backend mất ~20–30 phút do build 6 Java services.

---

## 7.7 Kiểm tra CI/CD hoạt động

**Test CI** — push lên nhánh `dev`:
```bash
git checkout dev
# Sửa bất kỳ file nào trong backend/ hoặc frontend/
git push origin dev
# Vào GitHub Actions → xem Java Services CI / Notification Service CI / Frontend Quality chạy
```

**Test CD** — merge vào `main`:
```bash
git checkout main
git merge dev
git push origin main
# Vào GitHub Actions → xem Deploy Backend / Deploy Frontend chạy
```

---

## 7.8 Chạy CI locally trước khi push

Để tránh CI fail sau khi push, chạy kiểm tra ở local trước:

### Backend Java
```bash
# Chạy cho từng service (thay <service> bằng tên thư mục)
cd backend/<service>
./mvnw checkstyle:check \
  -Dcheckstyle.config.location=../tools/checkstyle/checkstyle.xml \
  -Dcheckstyle.consoleOutput=true && \
./mvnw -DskipTests compile && \
./mvnw test
```

### Notification Service (Go)
```bash
cd backend/notification-service
gofmt -w .          # auto-format
go vet ./...
go test ./... -v
```

### Frontend
```bash
cd frontend
pnpm -F web-candidate lint && pnpm -F web-candidate typecheck
pnpm -F web-recruiter lint && pnpm -F web-recruiter typecheck
pnpm -F web-admin lint && pnpm -F web-admin typecheck
```

---

## Tóm tắt Bước 7

Sau bước này:
- [x] GitHub Secrets đã cấu hình đầy đủ
- [x] CI tự động kiểm tra lint, compile, test khi push lên `dev` hoặc mở PR
- [x] CD tự động build Docker image → ECR → deploy EC2 khi merge vào `main`
- [x] CD tự động build frontend → S3 → CloudFront khi merge vào `main`
- [x] Biết cách chạy CI locally để phát hiện lỗi trước khi push

**Tiếp theo:** [Bước 8 — Xử lý lỗi thường gặp](./08-troubleshooting.md)
