# Bước 6: Build và Upload Frontend lên S3

Trong bước này bạn sẽ build 3 React app và upload lên đúng thư mục trong S3.

---

## 6.1 Tạo file .env dùng chung

Cả 3 app đều đọc env từ **một file duy nhất** tại `frontend/.env`. Lý do: mỗi `vite.config.ts` đã cấu hình `envDir` trỏ về thư mục gốc `frontend/`, nên không cần tạo env riêng trong từng app.

Trên **máy local**, từ thư mục gốc của project:

```bash
cat > frontend/.env << 'EOF'
# API
VITE_API_BASE_URL=https://api.smartcv-chuongpl.io.vn
VITE_DOMAIN_URL=https://smartcv-chuongpl.io.vn

# i18n
VITE_I18N_DEFAULT_LOCALE=vi
VITE_I18N_FALLBACK_LOCALE=en

# Firebase (FCM push notifications — dùng chung cho cả 3 app)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_VAPID_KEY=
EOF
```

Điền đầy đủ các giá trị Firebase từ Firebase Console → Project Settings → General → Your apps.

> **Lưu ý:** `frontend/.env` đã có trong `.gitignore`. Không commit file này lên git.

---

## 6.2 Cài dependencies

```bash
cd frontend

# Cài tất cả dependencies (lần đầu hoặc sau khi thêm package mới)
pnpm install
```

---

## 6.3 Build 3 React app

```bash
cd frontend

# Build tất cả 3 app cùng lúc
pnpm build

# Hoặc build từng app riêng nếu chỉ cần update 1 app
pnpm -F web-candidate build
pnpm -F web-recruiter build
pnpm -F web-admin build
```

Sau khi build xong, kiểm tra output:

```bash
ls frontend/apps/web-candidate/dist/
# index.html  assets/  ...

ls frontend/apps/web-recruiter/dist/
ls frontend/apps/web-admin/dist/
```

---

## 6.4 Upload lên S3

Thay `smartcv-frontend` bằng tên bucket S3 thật của bạn.

```bash
# Upload web-candidate
aws s3 sync frontend/apps/web-candidate/dist/ \
  s3://smartcv-storage-dev/web-candidate/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

# Upload web-recruiter
aws s3 sync frontend/apps/web-recruiter/dist/ \
  s3://smartcv-storage-dev/web-recruiter/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

# Upload web-admin
aws s3 sync frontend/apps/web-admin/dist/ \
  s3://smartcv-storage-dev/web-admin/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable"
```

**Giải thích tham số:**
- `--delete`: Xóa file cũ trong S3 không còn tồn tại trong build mới
- `--cache-control "max-age=31536000, immutable"`: Trình duyệt cache file JS/CSS 1 năm (Vite đã đặt hash trong tên file, nên file mới luôn có tên khác)

### Fix cache cho index.html

File `index.html` không nên cache vì nó thay đổi mỗi lần deploy:

```bash
# Upload index.html riêng với no-cache
aws s3 cp frontend/apps/web-candidate/dist/index.html \
  s3://smartcv-storage-dev/web-candidate/index.html \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

aws s3 cp frontend/apps/web-recruiter/dist/index.html \
  s3://smartcv-storage-dev/web-recruiter/index.html \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

aws s3 cp frontend/apps/web-admin/dist/index.html \
  s3://smartcv-storage-dev/web-admin/index.html \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"
```

---

## 6.5 Xóa cache CloudFront (Invalidation)

CloudFront cache các file cũ. Sau khi upload file mới, bạn phải xóa cache để người dùng nhận được phiên bản mới nhất.

Lấy CloudFront Distribution ID của từng app (xem trong AWS Console → CloudFront → Distributions).

```bash
# Thay E1XXXXXXXXXX bằng Distribution ID thật

# Xóa cache web-candidate
aws cloudfront create-invalidation \
  --distribution-id E1XXXXXXXXXX_CANDIDATE \
  --paths "/web-candidate/*"

# Xóa cache web-recruiter
aws cloudfront create-invalidation \
  --distribution-id E1XXXXXXXXXX_RECRUITER \
  --paths "/web-recruiter/*"

# Xóa cache web-admin
aws cloudfront create-invalidation \
  --distribution-id E1XXXXXXXXXX_ADMIN \
  --paths "/web-admin/*"
```

Invalidation mất 1–3 phút để hoàn tất.

---

## 6.6 Kiểm tra kết quả

Mở trình duyệt và truy cập:

- `https://smartcv-chuongpl.io.vn` — giao diện ứng viên
- `https://recruiter.smartcv-chuongpl.io.vn` — giao diện nhà tuyển dụng
- `https://admin.smartcv-chuongpl.io.vn` — giao diện admin

Kiểm tra các điểm sau:
- [x] Trang load được, không có lỗi trắng trang
- [x] Biểu tượng khóa HTTPS hiển thị trên thanh địa chỉ
- [x] Đăng nhập được và gọi API thành công
- [x] Mở DevTools → Network → kiểm tra API calls trả về dữ liệu (không bị CORS error)

### Xử lý lỗi CORS

Nếu thấy lỗi CORS trong console trình duyệt, cần kiểm tra biến `FE_DOMAIN` trong file `.env` của backend (đã cấu hình ở Bước 3.1). Giá trị phải khớp chính xác với domain frontend:

```env
FE_DOMAIN=https://smartcv-chuongpl.io.vn
```

Sau khi sửa `.env`, restart backend:

```bash
# Trên EC2
cd ~/apps/smartcv/backend
docker compose -f docker-compose.prod.yaml up -d --force-recreate user-service
```

---

## Tóm tắt Bước 6

Sau bước này:
- [x] File `frontend/.env` đã có đúng `VITE_API_BASE_URL` và Firebase config cho production
- [x] Files đã upload lên S3 với cấu hình cache phù hợp
- [x] CloudFront cache đã xóa
- [x] Frontend hoạt động trên domain thật với HTTPS

**Tiếp theo:** [Bước 7 — CI/CD GitHub Actions](./07-cicd-github-actions.md)
