# Bước 1: Chuẩn bị công cụ

Trước khi bắt đầu deploy, bạn cần cài đặt một số công cụ trên **máy tính cá nhân** (không phải trên EC2).

---

## 1.1 Cài AWS CLI

AWS CLI là công cụ dòng lệnh để tương tác với các dịch vụ AWS từ máy tính của bạn (upload file lên S3, tạo CloudFront invalidation, v.v.).

### Trên Windows (WSL Ubuntu)

Mở terminal WSL và chạy:

```bash
# Tải bộ cài
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

# Giải nén
unzip awscliv2.zip

# Cài đặt
sudo ./aws/install

# Kiểm tra cài đặt thành công
aws --version
# Kết quả mong đợi: aws-cli/2.x.x Python/3.x.x ...
```

---

## 1.2 Tạo IAM User và cấp quyền AWS CLI

> **Tại sao không dùng root account?**  
> Root account có toàn quyền với AWS — nếu lộ credentials thì mất toàn bộ tài khoản. Luôn tạo IAM User riêng cho từng mục đích.

### Tạo IAM User trên AWS Console

1. Đăng nhập AWS Console tại [console.aws.amazon.com](https://console.aws.amazon.com)
2. Tìm kiếm **IAM** trong thanh tìm kiếm → Click vào IAM
3. Ở menu trái, chọn **Users** → Click **Create user**
4. Điền tên user: `smartcv-deploy` → Click Next
5. Chọn **Attach policies directly**
6. Tìm và tick chọn các policies sau:
   - `AmazonS3FullAccess` — để upload frontend lên S3
   - `CloudFrontFullAccess` — để tạo CloudFront invalidation
   - `AWSCertificateManagerFullAccess` — để request SSL certificate (bước 5.2)
   - `AmazonEC2ContainerRegistryFullAccess` — để push Docker images (dùng ở bước CI/CD)
7. Click **Next** → **Create user**

### Tạo Access Key cho IAM User

1. Sau khi tạo xong, click vào user `smartcv-deploy`
2. Chọn tab **Security credentials**
3. Kéo xuống phần **Access keys** → Click **Create access key**
4. Chọn **Command Line Interface (CLI)** → Tick xác nhận → Next → Create
5. **QUAN TRỌNG:** Copy và lưu lại 2 giá trị này ngay bây giờ — chỉ hiển thị 1 lần:
   - **Access key ID** (ví dụ: `AKIAIOSFODNN7EXAMPLE`)
   - **Secret access key** (ví dụ: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)

### Cấu hình AWS CLI trên máy local

```bash
aws configure
```

Điền thông tin khi được hỏi:

```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE        ← Access key ID vừa copy
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG...  ← Secret key vừa copy
Default region name [None]: ap-southeast-1              ← Region Singapore (gần Việt Nam)
Default output format [None]: json
```

Kiểm tra cấu hình đúng chưa:

```bash
aws sts get-caller-identity
```

Kết quả mong đợi (có thấy tên user là thành công):

```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/smartcv-deploy"
}
```

---

## 1.3 Cài Node.js và pnpm (để build frontend)

```bash
# Cài Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Kiểm tra
node --version   # v20.x.x
npm --version    # 10.x.x

# Cài pnpm
npm install -g pnpm

# Kiểm tra
pnpm --version   # 9.x.x
```

---

## 1.4 Kiểm tra SSH vào EC2

Bạn đã có key `.pem` để SSH vào EC2. Hãy đảm bảo SSH hoạt động:

```bash
# Đặt quyền đúng cho file key (bắt buộc, SSH sẽ từ chối nếu quyền quá thoáng)
chmod 400 /đường/dẫn/đến/key.pem

# SSH vào EC2
ssh -i /đường/dẫn/đến/key.pem ubuntu@<ELASTIC_IP_CỦA_BẠN>
```

Thay `<ELASTIC_IP_CỦA_BẠN>` bằng địa chỉ Elastic IP thật (ví dụ: `13.212.xx.xx`).

Nếu thấy dòng chào `ubuntu@ip-xxx-xxx:~$` là SSH thành công.

---

## 1.5 Cấu hình DNS cho domain

Bạn cần tạo các DNS record trỏ domain về đúng địa chỉ. Làm việc này trên trang quản lý domain của bạn (Namecheap, GoDaddy, Cloudflare...).

### Record cho Backend (EC2)

Tạo **A record**:

| Tên | Loại | Giá trị |
|-----|------|---------|
| `api` | A | `<ELASTIC_IP_EC2>` |

Ví dụ: `api.smartcv-chuongpl.io.vn` → `13.212.xx.xx`

### Record cho Frontend (CloudFront)

Phần này sẽ làm ở **Bước 5** sau khi có địa chỉ CloudFront. Tạm thời bỏ qua.

---

## Tóm tắt Bước 1

Sau bước này bạn đã có:
- [x] AWS CLI đã cài và cấu hình với IAM User `smartcv-deploy`
- [x] Node.js + pnpm đã cài
- [x] SSH vào EC2 hoạt động
- [x] DNS `api.yourdomain.com` đã trỏ về Elastic IP của EC2

**Tiếp theo:** [Bước 2 — Cấu hình EC2](./02-ec2-setup.md)
