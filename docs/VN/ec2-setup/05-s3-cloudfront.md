# Bước 5: Cấu hình S3 + CloudFront

S3 lưu trữ các file tĩnh (HTML, JS, CSS) của 3 React app. CloudFront phân phối các file này đến người dùng nhanh hơn thông qua mạng CDN toàn cầu và cung cấp HTTPS miễn phí.

---

## 5.1 Cấu hình S3 Bucket

Bạn đã có S3 bucket. Bây giờ cần cấu hình nó để CloudFront có thể đọc file từ đó.

### Tạo cấu trúc thư mục trong S3

Trên **máy local**:

```bash
# Tạo 3 thư mục (prefix) trong bucket
# Thay "smartcv-frontend" bằng tên bucket thật của bạn

aws s3api put-object --bucket smartcv-frontend --key web-candidate/
aws s3api put-object --bucket smartcv-frontend --key web-recruiter/
aws s3api put-object --bucket smartcv-frontend --key web-admin/
```

### Tắt Block Public Access (để CloudFront có thể đọc)

> S3 sẽ **không** mở public trực tiếp — chỉ CloudFront mới có quyền đọc. Đây là cách làm đúng và an toàn nhất.

1. Vào AWS Console → **S3** → Click vào bucket của bạn
2. Chọn tab **Permissions**
3. Click **Edit** ở phần **Block public access**
4. **Bỏ tick** ô `Block all public access` → Save changes → Confirm

> **Lưu ý:** Bước này cho phép tạo bucket policy — bucket vẫn chưa public cho đến khi bạn thêm policy ở bước sau.

---

## 5.2 Tạo SSL Certificate cho CloudFront (bắt buộc ở us-east-1)

> **Quan trọng:** CloudFront **chỉ chấp nhận** certificate từ region `us-east-1` (N. Virginia). Dù bucket và EC2 của bạn ở `ap-southeast-1`, certificate này **phải** tạo ở `us-east-1`.

Trên máy local:

```bash
# Yêu cầu certificate (thay domain thật vào)
aws acm request-certificate \
  --domain-name "smartcv-chuongpl.io.vn" \
  --subject-alternative-names "*.smartcv-chuongpl.io.vn" \
  --validation-method DNS \
  --region us-east-1
```

Lệnh này trả về `CertificateArn` — lưu lại giá trị này.

### Xác thực domain ownership qua DNS

AWS cần bạn chứng minh bạn sở hữu domain bằng cách thêm một CNAME record đặc biệt vào DNS.

> **Lưu ý về ZoneDNS (Nhân Hòa):** ZoneDNS từ chối CNAME record có giá trị bắt đầu bằng dấu gạch dưới `_` (ví dụ: `_abc.acm-validations.aws`) với lỗi "Tên miền không hợp lệ". Giải pháp là **chuyển DNS sang Cloudflare** (miễn phí) rồi thêm record ở đó.

---

#### Bước 1 — Lấy CNAME values từ ACM Console

1. Vào [AWS Console](https://console.aws.amazon.com) → tìm kiếm **Certificate Manager**
2. **Quan trọng:** Ở góc trên phải, đổi region sang **US East (N. Virginia) / us-east-1**

   > Nếu không đổi region, bạn sẽ không thấy certificate vừa tạo.

3. Click vào certificate có domain `smartcv-chuongpl.io.vn`
4. Tại phần **Domains**, bạn thấy bảng như sau (giá trị thật sẽ khác):

   | Domain | CNAME name | CNAME value |
   |--------|-----------|-------------|
   | `smartcv-chuongpl.io.vn` | `_a1b2c3d4e5f6.smartcv-chuongpl.io.vn` | `_g7h8i9j0k1l2.acm-validations.aws.` |
   | `*.smartcv-chuongpl.io.vn` | _(giống record trên — chỉ cần tạo 1 record)_ | _(giống record trên)_ |

5. Click nút **Copy** bên cạnh từng giá trị để copy chính xác — **không gõ tay**, dễ sai.

   > `*.smartcv-chuongpl.io.vn` và apex domain dùng chung 1 CNAME record — chỉ cần tạo **1 record duy nhất**.

---

#### Bước 2 — Chuyển DNS sang Cloudflare

ZoneDNS không hỗ trợ loại CNAME record này. Cloudflare miễn phí và xử lý tốt hơn.

**2a. Thêm domain vào Cloudflare:**

1. Tạo tài khoản tại [cloudflare.com](https://cloudflare.com) (nếu chưa có)
2. Vào dashboard → **Add a site** → nhập `smartcv-chuongpl.io.vn` → chọn plan **Free**
3. Cloudflare tự đọc và import DNS records hiện tại từ ZoneDNS
4. Cloudflare cấp cho bạn 2 nameserver riêng, ví dụ:
   ```
   dawn.ns.cloudflare.com
   duke.ns.cloudflare.com
   ```
   *(giá trị thật nằm ở trang Overview của domain trong Cloudflare dashboard)*

**2b. Đổi nameserver tại Nhân Hòa:**

1. Đăng nhập [my.nhanhoa.com](https://my.nhanhoa.com)
2. **Tên miền** → **Danh sách tên miền** → click vào `smartcv-chuongpl.io.vn`
3. Tìm mục **Nameserver** → **Cập nhật**
4. Xóa nameserver cũ, điền 2 nameserver Cloudflare vừa lấy ở trên
5. Lưu lại

   > Nếu Nhân Hòa không cho tự đổi, liên hệ support của họ qua chat/hotline và yêu cầu đổi nameserver sang Cloudflare.

Chờ 10–30 phút để nameserver lan truyền.

---

#### Bước 3 — Thêm CNAME record trong Cloudflare

1. Vào [dash.cloudflare.com](https://dash.cloudflare.com) → chọn domain → **DNS** → **Records**
2. Click **Add record**
3. Điền thông tin:

   | Trường | Giá trị cần điền |
   |--------|-----------------|
   | **Type** | `CNAME` |
   | **Name** | Phần trước `.smartcv-chuongpl.io.vn` — ví dụ: `_a1b2c3d4e5f6` |
   | **Target** | CNAME value từ ACM, **bỏ dấu chấm cuối** — ví dụ: `_g7h8i9j0k1l2.acm-validations.aws` |
   | **Proxy status** | **DNS only** (mây xám) — bắt buộc, không được để Proxied |
   | **TTL** | Auto |

4. Click **Save**

   > **Lỗi "not allowed for a proxied record":** Cloudflare mặc định bật Proxy (mây cam). ACM validation không thể đi qua proxy — phải chuyển sang **DNS only** (mây xám).

---

#### Bước 4 — Kiểm tra DNS đã lan truyền chưa

```bash
# Thay _a1b2c3d4e5f6 bằng giá trị thật từ ACM Console
nslookup -type=CNAME _a1b2c3d4e5f6.smartcv-chuongpl.io.vn 8.8.8.8
```

Kết quả thành công:

```
Non-authoritative answer:
_a1b2c3d4e5f6.smartcv-chuongpl.io.vn  canonical name = _g7h8i9j0k1l2.acm-validations.aws.
```

Nếu chưa có kết quả → chờ thêm (5–30 phút), DNS cần thời gian lan truyền.

---

#### Bước 5 — Chờ ACM cấp certificate

Quay lại ACM Console (region `us-east-1`), refresh trang. Trạng thái chuyển từ `Pending validation` → **`Issued`** sau khi DNS xác thực xong (thường 5–30 phút).

> Nếu sau 1 giờ vẫn `Pending validation`: kiểm tra nameserver đã trỏ về Cloudflare chưa (`nslookup -type=NS smartcv-chuongpl.io.vn`), và CNAME record có đang là **DNS only** không.

---

## 5.3 Tạo CloudFront Distributions (3 apps)

Bạn sẽ tạo **3 CloudFront distributions** — một cho mỗi app. Hướng dẫn đầy đủ cho `web-candidate` trước, rồi lặp lại với các thay đổi nhỏ cho 2 app còn lại.

---

### A. Tạo distribution cho web-candidate

#### A1. Mở form tạo distribution

Vào [CloudFront Console](https://console.aws.amazon.com/cloudfront) → Click **Create distribution**.

---

#### A2. Phần Origin

**S3 origin:**
- Click nút **Browse S3** bên phải ô → chọn bucket của bạn (ví dụ: `smartcv-frontend`).
- Ô sẽ tự điền thành `smartcv-frontend.s3.ap-southeast-1.amazonaws.com`.
- Hoặc gõ thẳng vào ô nếu biết tên bucket.

**Origin path:**
- Điền `/web-candidate` (bắt buộc có dấu `/` ở đầu).

---

#### A3. Phần Settings (ngay bên dưới Origin)

**Allow private S3 bucket access to CloudFront:**
- **Tick vào checkbox** "Allow private S3 bucket access to CloudFront — *Recommended*".
- Đây là cách hiện đại thay thế cho OAC cũ — CloudFront tự tạo OAC và tự cập nhật bucket policy. Không cần tạo OAC thủ công.

**Origin settings:**
- Chọn **Use recommended origin settings**.

**Cache settings:**
- Chọn **Customize cache settings** để cấu hình thêm ở bước sau.
- Hoặc giữ **Use recommended cache settings** nếu chỉ muốn dùng mặc định.

---

#### A4. Phần Cache behavior (nếu chọn Customize)

| Trường | Giá trị |
|--------|---------|
| **Viewer protocol policy** | Redirect HTTP to HTTPS |
| **Allowed HTTP methods** | GET, HEAD |
| **Cache policy** | `CachingDisabled` (để test; đổi sang `CachingOptimized` sau khi ổn định) |

---

#### A5. Phần WAF (nếu có)

Nếu thấy phần **Web Application Firewall**, chọn **Do not enable security protections** — tránh phát sinh chi phí.

---

#### A6. Phần Distribution settings

Kéo xuống tìm phần cấu hình domain và SSL:

| Trường | Giá trị |
|--------|---------|
| **Alternate domain names (CNAME)** | Click **Add item**, thêm 2 dòng: `smartcv-chuongpl.io.vn` và `www.smartcv-chuongpl.io.vn` |
| **Custom SSL certificate** | Chọn `*.smartcv-chuongpl.io.vn` từ dropdown — **chỉ hiện nếu certificate đã `Issued`** |
| **Default root object** | `index.html` |

> **Certificate không hiện trong dropdown?** Vào ACM Console (region `us-east-1`) kiểm tra trạng thái — phải là `Issued` thì mới chọn được ở đây.

---

#### A7. Tạo distribution

Click **Create distribution**.

CloudFront hiện status **In Progress** — mất 5–15 phút để chuyển **Deployed**. Tiếp tục tạo 2 distributions còn lại trong lúc chờ.

**Lưu lại địa chỉ distribution** (dạng `d1abc123.cloudfront.net`) — cần dùng ở bước 5.4.

---

#### A8. Thêm Custom error responses (bắt buộc cho React SPA)

Giao diện mới **không có mục này trong form tạo distribution**. Phải làm sau khi tạo xong:

1. Vào CloudFront → click vào distribution vừa tạo
2. Chọn tab **Error pages**
3. Click **Create custom error response** — làm 2 lần:

**Response 1 — lỗi 403:**

| Trường | Giá trị |
|--------|---------|
| HTTP error code | `403` |
| Error caching minimum TTL | `10` |
| Customize error response | Yes |
| Response page path | `/index.html` |
| HTTP response code | `200` |

**Response 2 — lỗi 404:**

| Trường | Giá trị |
|--------|---------|
| HTTP error code | `404` |
| Error caching minimum TTL | `10` |
| Customize error response | Yes |
| Response page path | `/index.html` |
| HTTP response code | `200` |

> **Tại sao cần?** React dùng client-side routing. Khi user truy cập `smartcv-chuongpl.io.vn/jobs/123` trực tiếp, S3 không có file `jobs/123` → trả 403/404. CloudFront phải redirect về `index.html` để React tự xử lý route.

---

### B. Tạo distribution cho web-recruiter

Lặp lại toàn bộ bước A với các thay đổi sau:

| Trường | Giá trị |
|--------|---------|
| **Origin path** | `/web-recruiter` |
| **Alternate domain names (CNAME)** | `recruiter.smartcv-chuongpl.io.vn` (chỉ 1 dòng) |
| **OAC** | Chọn `smartcv-oac` đã tạo (không cần tạo mới) |

---

### C. Tạo distribution cho web-admin

Lặp lại toàn bộ bước A với các thay đổi sau:

| Trường | Giá trị |
|--------|---------|
| **Origin path** | `/web-admin` |
| **Alternate domain names (CNAME)** | `admin.smartcv-chuongpl.io.vn` (chỉ 1 dòng) |
| **OAC** | Chọn `smartcv-oac` đã tạo (không cần tạo mới) |

---

### D. Kiểm tra S3 Bucket Policy

Khi bạn tick **"Allow private S3 bucket access to CloudFront"** lúc tạo distribution, CloudFront **tự động cập nhật bucket policy** cho bạn — không cần làm thủ công.

Tuy nhiên, vì bạn tạo **3 distributions** lần lượt, mỗi lần CloudFront tự cập nhật policy có thể **ghi đè** lần trước, khiến distributions đầu bị mất quyền.

**Kiểm tra sau khi tạo xong cả 3:**

1. Vào [S3 Console](https://s3.console.aws.amazon.com) → bucket `smartcv-storage-dev` → tab **Permissions** → **Bucket policy**
2. Policy hiện tại có thể là:
   - `1 Statement` duy nhất với `AWS:SourceArn` là một mảng chứa 3 distribution IDs, hoặc
   - `3 Statement` riêng nếu CloudFront/S3 cập nhật theo kiểu cũ.

Miễn là cả 3 distribution IDs đều có trong policy thì cấu hình là đúng. Nếu policy chỉ còn 1 distribution hoặc thiếu ID nào đó, thay thế toàn bộ policy bằng nội dung sau.

**Lấy thông tin cần thiết trước:**

```bash
# Account ID
aws sts get-caller-identity --query Account --output text

# Distribution IDs (chạy lệnh này để xem)
aws cloudfront list-distributions --query "DistributionList.Items[*].{ID:Id,Domain:DomainName,CNAME:Aliases.Items[0]}" --output table
```

**Policy tổng hợp cho 3 distributions** (thay `ACCOUNT_ID`, `CANDIDATE_DIST_ID`, `RECRUITER_DIST_ID`, `ADMIN_DIST_ID` bằng giá trị thật):

```json
{
  "Version": "2008-10-17",
  "Id": "PolicyForCloudFrontPrivateContent",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::smartcv-storage-dev/*",
      "Condition": {
        "ArnLike": {
          "AWS:SourceArn": [
            "arn:aws:cloudfront::ACCOUNT_ID:distribution/CANDIDATE_DIST_ID",
            "arn:aws:cloudfront::ACCOUNT_ID:distribution/RECRUITER_DIST_ID",
            "arn:aws:cloudfront::ACCOUNT_ID:distribution/ADMIN_DIST_ID"
          ]
        }
      }
    }
  ]
}
```

Click **Save changes**.

---

## 5.4 Cấu hình DNS trỏ về CloudFront

Sau khi tạo xong 3 CloudFront distributions, mỗi cái sẽ có một địa chỉ như `d1abc123.cloudfront.net`.

Vào **Cloudflare dashboard** → **DNS** → **Records**.

**Lưu ý quan trọng:** nếu bạn đang có `A` record rồi mà Cloudflare không cho đổi thẳng sang `CNAME`, hãy **xóa record cũ rồi tạo record mới**. Cách này đơn giản nhất và tránh lỗi UI.

Chỉ thay các record frontend đang trỏ về EC2 bằng `CNAME` trỏ về CloudFront:

| Subdomain | Loại cũ → mới | Giá trị mới | Proxy status |
|-----------|--------------|-------------|-------------|
| `@` (apex) | A → CNAME | địa chỉ CloudFront của web-candidate | DNS only |
| `www` | A → CNAME | địa chỉ CloudFront của web-candidate | DNS only |
| `recruiter` | A → CNAME | địa chỉ CloudFront của web-recruiter | DNS only |
| `admin` | A → CNAME | địa chỉ CloudFront của web-admin | DNS only |

> **Giữ nguyên** record `api` (A → EC2) — backend vẫn chạy trực tiếp trên EC2.

> **Proxy status phải là DNS only:** CloudFront tự xử lý HTTPS và CDN, không cần Cloudflare proxy. Để Proxied có thể gây lỗi SSL hoặc routing.

> **Apex domain với CNAME:** Cloudflare hỗ trợ CNAME ở apex (`@`) thông qua tính năng **CNAME Flattening** — không cần làm gì thêm, Cloudflare tự xử lý.

### Cách làm từng record

1. Với `smartcv-chuongpl.io.vn`:
   - Xóa record `A` hiện tại.
   - Tạo `CNAME` mới với `Name` là `@`.
   - `Target` là CloudFront distribution của `web-candidate`.
   - `Proxy status`: `DNS only`.

2. Với `www.smartcv-chuongpl.io.vn`:
   - Xóa record `A` hiện tại.
   - Tạo `CNAME` mới với `Name` là `www`.
   - `Target` là CloudFront distribution của `web-candidate`.
   - `Proxy status`: `DNS only`.

3. Với `recruiter.smartcv-chuongpl.io.vn`:
   - Xóa record `A` hiện tại.
   - Tạo `CNAME` mới với `Name` là `recruiter`.
   - `Target` là CloudFront distribution của `web-recruiter`.
   - `Proxy status`: `DNS only`.

4. Với `admin.smartcv-chuongpl.io.vn`:
   - Xóa record `A` hiện tại.
   - Tạo `CNAME` mới với `Name` là `admin`.
   - `Target` là CloudFront distribution của `web-admin`.
   - `Proxy status`: `DNS only`.

5. Không chạm vào `api.smartcv-chuongpl.io.vn`.

---

## 5.5 Kiểm tra CloudFront hoạt động

Chờ CloudFront deploy xong (status chuyển từ `In Progress` sang `Deployed` — mất 5–15 phút).

```bash
# Test CloudFront distribution (dùng địa chỉ d1abc123.cloudfront.net trước)
curl -I https://d1abc123.cloudfront.net
# Phải thấy: HTTP/2 200

# Sau khi DNS cập nhật, test bằng domain thật
curl -I https://smartcv-chuongpl.io.vn
```

---

## Tóm tắt Bước 5

Sau bước này:
- [x] SSL certificate `*.smartcv-chuongpl.io.vn` đã cấp ở us-east-1
- [x] 3 CloudFront distributions đã tạo, mỗi cái trỏ vào đúng thư mục S3
- [x] React SPA routing đã cấu hình (custom error pages)
- [x] DNS đã trỏ subdomain về CloudFront

**Tiếp theo:** [Bước 6 — Build và Upload Frontend](./06-frontend-build.md)
