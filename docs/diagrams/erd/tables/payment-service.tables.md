# Payment Service Tables

## payment_orders

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| order_code | bigint | Mã đơn thanh toán duy nhất, có unique index. |
| user_id | varchar | Tham chiếu đến `users.id` ở user service. |
| user_role | varchar | Vai trò của người thanh toán tại thời điểm tạo đơn. |
| package_id | varchar | Tham chiếu đến `service_packages.id` ở user service. |
| package_name | varchar | Snapshot tên gói dịch vụ. |
| package_ai_credits | int | Snapshot số credit AI. |
| package_job_limit | int | Snapshot hạn mức đăng job. |
| package_cv_limit | int | Snapshot hạn mức xem CV. |
| package_duration_days | int | Snapshot số ngày hiệu lực của gói. |
| amount | bigint | Số tiền thanh toán. |
| status | varchar | Trạng thái đơn thanh toán. |
| payment_url | text | URL thanh toán PayOS. |
| qr_code | text | Dữ liệu QR code thanh toán. |
| created_at | datetime | Thời điểm tạo đơn. |
| updated_at | datetime | Thời điểm cập nhật. |
| paid_at | datetime | Thời điểm thanh toán thành công. |
