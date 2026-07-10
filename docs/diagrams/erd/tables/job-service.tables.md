# Job Service Tables

## jobs

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| recruiter_id | varchar | Id recruiter user từ gateway. |
| title | varchar | Tiêu đề job. |
| normalized_title | varchar | Tiêu đề đã chuẩn hóa. |
| description | text | Mô tả công việc. |
| company | varchar | Tên công ty. |
| location | varchar | Địa điểm làm việc. |
| salary_min | float | Lương tối thiểu. |
| salary_max | float | Lương tối đa. |
| job_type | varchar | Loại công việc. |
| experience_level | varchar | Cấp độ kinh nghiệm. |
| skills | json | Danh sách kỹ năng. |
| requirements | json | Danh sách yêu cầu. |
| benefits | json | Danh sách quyền lợi. |
| moderation_status | varchar | Trạng thái duyệt bài. |
| visibility_status | varchar | Trạng thái hiển thị. |
| moderation_note | text | Ghi chú kiểm duyệt. |
| reviewed_by | varchar | Người duyệt. |
| reviewed_at | datetime | Thời điểm duyệt. |
| deadline | date | Hạn ứng tuyển. |
| openings | int | Số lượng tuyển. |
| qualified_threshold | int | Ngưỡng đạt. |
| reject_threshold | int | Ngưỡng loại. |
| auto_reject_enabled | boolean | Bật tự động loại. |
| required_test | varchar | Bài test bắt buộc. |
| deleted | boolean | Cờ xóa mềm. |
| deleted_at | datetime | Thời điểm xóa mềm. |
| created_at | datetime | Thời điểm tạo. |
| updated_at | datetime | Thời điểm cập nhật. |
