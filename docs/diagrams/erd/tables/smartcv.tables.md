# SmartCV Combined Tables

## users

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| full_name | varchar | Họ và tên đầy đủ. |
| email | varchar | Email đăng nhập. |
| password | varchar | Mật khẩu đã mã hóa. |
| phone | varchar | Số điện thoại. |
| avt_image_id | varchar | Id ảnh đại diện. |
| created_at | datetime | Thời điểm tạo. |
| updated_at | datetime | Thời điểm cập nhật. |
| deleted_at | datetime | Thời điểm xóa mềm. |
| verified | boolean | Trạng thái xác thực. |
| deleted | boolean | Cờ xóa mềm. |
| locked | boolean | Cờ khóa tài khoản. |
| preferences | json | PreferencesSettings nhúng. |

## role

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| name | varchar | Khóa chính của role. |
| description | varchar | Mô tả role. |
| permissions | json | Danh sách quyền nhúng. |

## user_roles

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| user_id | varchar | Tham chiếu đến `users.id`. |
| role_name | varchar | Tham chiếu đến `role.name`. |

## candidates

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| user_id | varchar | Tham chiếu đến `users.id`. |
| dob | date | Ngày sinh. |
| gender | varchar | Giới tính. |
| address | text | Địa chỉ. |
| bio | text | Giới thiệu. |
| title | varchar | Tiêu đề nghề nghiệp. |
| avatar_url | varchar | URL avatar. |
| skills | json | Danh sách kỹ năng. |
| years_of_experience | int | Số năm kinh nghiệm. |
| experiences | json | Danh sách kinh nghiệm. |
| educations | json | Danh sách học vấn. |
| certifications | json | Danh sách chứng chỉ. |
| languages | json | Danh sách ngôn ngữ. |
| job_type | varchar | Loại công việc mong muốn. |
| preferred_location | varchar | Địa điểm ưu tiên. |
| expected_salary_min | int | Lương mong muốn tối thiểu. |
| expected_salary_max | int | Lương mong muốn tối đa. |
| portfolio_url | varchar | URL portfolio. |
| github_url | varchar | URL GitHub. |
| linkedin_url | varchar | URL LinkedIn. |
| cv_url | varchar | URL CV. |
| cvs | json | Danh sách CV. |
| settings | json | CandidateSettings nhúng. |
| job_suggestions | json | Cache gợi ý việc làm. |
| suggestions_updated_at | datetime | Thời điểm cập nhật gợi ý. |
| followed_company_ids | json | Danh sách company id theo dõi. |
| created_at | datetime | Thời điểm tạo. |
| updated_at | datetime | Thời điểm cập nhật. |
| deleted | boolean | Cờ xóa mềm. |
| deleted_at | datetime | Thời điểm xóa mềm. |

## recruiters

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| user_id | varchar | Tham chiếu đến `users.id`. |
| company_name | varchar | Tên công ty. |
| company_website | varchar | Website công ty. |
| company_address | text | Địa chỉ công ty. |
| company_city | varchar | Thành phố. |
| company_description | text | Mô tả công ty. |
| company_phone | varchar | Số điện thoại công ty. |
| company_size | varchar | Quy mô công ty. |
| company_type | varchar | Loại hình công ty. |
| founded_year | int | Năm thành lập. |
| industry | varchar | Ngành nghề. |
| benefits | json | Danh sách quyền lợi. |
| rating | float | Điểm đánh giá. |
| review_count | int | Số lượng đánh giá. |
| logo_url | varchar | URL logo. |
| cover_image_url | varchar | URL ảnh bìa. |
| tax_code | varchar | Mã số thuế. |
| business_license_url | varchar | URL giấy phép kinh doanh. |
| linkedin_url | varchar | URL LinkedIn. |
| facebook_url | varchar | URL Facebook. |
| contact_name | varchar | Tên người liên hệ. |
| contact_email | varchar | Email người liên hệ. |
| contact_phone | varchar | Số điện thoại người liên hệ. |
| status | varchar | Trạng thái recruiter. |
| rejection_note | text | Ghi chú từ chối. |
| quota_job_post | int | Hạn mức đăng job. |
| quota_cv_views | int | Hạn mức xem CV. |
| created_at | datetime | Thời điểm tạo. |
| updated_at | datetime | Thời điểm cập nhật. |
| deleted | boolean | Cờ xóa mềm. |
| deleted_at | datetime | Thời điểm xóa mềm. |

## service_packages

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| name | varchar | Tên gói dịch vụ. |
| price | bigint | Giá. |
| ai_credits | int | Credit AI. |
| job_limit | int | Hạn mức job. |
| cv_limit | int | Hạn mức CV. |
| featured | boolean | Gói nổi bật. |
| features | json | Danh sách tính năng. |
| created_at | datetime | Thời điểm tạo. |
| updated_at | datetime | Thời điểm cập nhật. |

## payment_orders

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| order_code | bigint | Mã đơn thanh toán duy nhất, có unique index. |
| user_id | varchar | Tham chiếu đến `users.id`. |
| user_role | varchar | Vai trò của người thanh toán tại thời điểm tạo đơn. |
| package_id | varchar | Tham chiếu đến `service_packages.id`. |
| package_name | varchar | Snapshot tên gói dịch vụ. |
| package_ai_credits | int | Snapshot số credit AI của gói. |
| package_job_limit | int | Snapshot hạn mức đăng job. |
| package_cv_limit | int | Snapshot hạn mức xem CV. |
| package_duration_days | int | Snapshot số ngày hiệu lực của gói. |
| amount | bigint | Số tiền thanh toán. |
| status | varchar | Trạng thái đơn `PENDING`, `PAID`, `FAILED`, `CANCELLED`. |
| payment_url | text | URL thanh toán PayOS. |
| qr_code | text | Dữ liệu QR code thanh toán. |
| created_at | datetime | Thời điểm tạo đơn. |
| updated_at | datetime | Thời điểm cập nhật. |
| paid_at | datetime | Thời điểm thanh toán thành công. |

## wishlists

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| candidate_id | varchar | Tham chiếu đến `candidates.id`. |
| job_id | varchar | Tham chiếu đến `jobs.id`. |
| saved_at | datetime | Thời điểm lưu. |
| deleted | boolean | Cờ xóa mềm. |

## jobs

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id từ job service. |
| recruiter_id | varchar | Id recruiter user từ gateway. |
| title | varchar | Tiêu đề job. |
| normalized_title | varchar | Tiêu đề chuẩn hóa. |
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
| moderation_status | varchar | Trạng thái kiểm duyệt. |
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

## applications

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| candidate_id | varchar | Tham chiếu đến candidate user id. |
| job_id | varchar | Tham chiếu đến `jobs.id`. |
| recruiter_id | varchar | Tham chiếu đến recruiter user id. |
| candidate_email | varchar | Email ứng tuyển. |
| job_title | varchar | Snapshot tiêu đề job. |
| company_name | varchar | Snapshot tên công ty. |
| job_location | varchar | Snapshot địa điểm job. |
| salary_min | float | Snapshot lương tối thiểu. |
| salary_max | float | Snapshot lương tối đa. |
| job_skills | json | Snapshot kỹ năng job. |
| job_type | varchar | Snapshot loại job. |
| status | varchar | Trạng thái ứng tuyển. |
| cover_letter | text | Cover letter. |
| cv_url | text | URL CV. |
| ai_score | int | Điểm AI. |
| matched_skills | json | Kỹ năng khớp. |
| missing_skills | json | Kỹ năng thiếu. |
| ai_status | varchar | Trạng thái chấm AI. |
| recruiter_notes | text | Ghi chú recruiter. |
| rejection_reason | text | Lý do từ chối. |
| applied_at | datetime | Thời điểm ứng tuyển. |
| updated_at | datetime | Thời điểm cập nhật. |
| deleted | boolean | Cờ xóa mềm. |
| deleted_at | datetime | Thời điểm xóa mềm. |

## assessments

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| job_id | varchar | Tham chiếu đến `jobs.id`. |
| recruiter_id | varchar | Tham chiếu đến recruiter user id. |
| title | varchar | Tiêu đề assessment. |
| description | text | Mô tả assessment. |
| questions | json | Danh sách câu hỏi. |
| time_limit_minutes | int | Giới hạn thời gian. |
| status | varchar | Trạng thái assessment. |
| created_at | datetime | Thời điểm tạo. |

## assessment_attempts

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| assessment_id | varchar | Tham chiếu đến `assessments.id`. |
| candidate_id | varchar | Tham chiếu đến candidate user id. |
| application_id | varchar | Tham chiếu đến `applications.id`. |
| status | varchar | Trạng thái lượt làm bài. |
| answers | json | Danh sách câu trả lời. |
| started_at | datetime | Thời điểm bắt đầu. |
| submitted_at | datetime | Thời điểm nộp bài. |
| score | float | Điểm số. |
| result | varchar | Kết quả. |

## notifications

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | uuid | Khóa chính notification. |
| user_id | text | Id người nhận. |
| recipient_role | varchar | Vai trò người nhận. |
| type | varchar | Loại thông báo. |
| title | varchar | Tiêu đề. |
| body | text | Nội dung. |
| data | json | Payload bổ sung. |
| is_read | boolean | Đã đọc hay chưa. |
| read_at | timestamptz | Thời điểm đọc. |
| created_at | timestamptz | Thời điểm tạo. |

## notification_fcm_tokens

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | uuid | Khóa chính token. |
| user_id | text | Id người dùng sở hữu token. |
| audience | varchar | Nhóm client. |
| token | text | FCM token. |
| created_at | timestamptz | Thời điểm tạo. |
| updated_at | timestamptz | Thời điểm cập nhật. |
