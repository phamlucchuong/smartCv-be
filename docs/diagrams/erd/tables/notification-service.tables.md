# Notification Service Tables

## notifications

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | uuid | Khóa chính của notification. |
| user_id | text | Id người nhận. |
| recipient_role | varchar | Vai trò người nhận. |
| type | varchar | Loại thông báo. |
| title | varchar | Tiêu đề thông báo. |
| body | text | Nội dung thông báo. |
| data | json | Payload bổ sung. |
| is_read | boolean | Đã đọc hay chưa. |
| read_at | timestamptz | Thời điểm đọc. |
| created_at | timestamptz | Thời điểm tạo. |

## notification_fcm_tokens

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | uuid | Khóa chính của token. |
| user_id | text | Id người dùng sở hữu token. |
| audience | varchar | Nhóm client, ví dụ `web-user`. |
| token | text | FCM registration token. |
| created_at | timestamptz | Thời điểm tạo. |
| updated_at | timestamptz | Thời điểm cập nhật. |
