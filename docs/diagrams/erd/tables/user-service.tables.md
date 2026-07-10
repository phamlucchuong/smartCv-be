# User Service Tables

## users

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| full_name | varchar | Họ và tên đầy đủ. |
| email | varchar | Email đăng nhập, có index. |
| password | varchar | Mật khẩu đã mã hóa. |
| phone | varchar | Số điện thoại, có sparse index. |
| avt_image_id | varchar | Id ảnh đại diện. |
| created_at | datetime | Thời điểm tạo. |
| updated_at | datetime | Thời điểm cập nhật. |
| deleted_at | datetime | Thời điểm xóa mềm. |
| verified | boolean | Trạng thái đã xác thực. |
| deleted | boolean | Cờ xóa mềm. |
| locked | boolean | Cờ khóa tài khoản. |
| preferences | json | PreferencesSettings nhúng trong document. |

## role

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| name | varchar | Khóa chính của role. |
| description | varchar | Mô tả role. |
| permissions | json | Tập Permission nhúng trong role. |

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
| bio | text | Giới thiệu bản thân. |
| title | varchar | Tiêu đề nghề nghiệp. |
| avatar_url | varchar | URL ảnh đại diện. |
| skills | json | Danh sách kỹ năng. |
| years_of_experience | int | Số năm kinh nghiệm. |
| experiences | json | Danh sách `WorkExperience`. |
| educations | json | Danh sách `Education`. |
| certifications | json | Danh sách `Certification`. |
| languages | json | Danh sách `Language`. |
| job_type | varchar | Loại công việc mong muốn. |
| preferred_location | varchar | Địa điểm ưu tiên. |
| expected_salary_min | int | Mức lương mong muốn tối thiểu. |
| expected_salary_max | int | Mức lương mong muốn tối đa. |
| portfolio_url | varchar | URL portfolio. |
| github_url | varchar | URL GitHub. |
| linkedin_url | varchar | URL LinkedIn. |
| cv_url | varchar | URL CV hiện tại. |
| cvs | json | Danh sách `CvItem`. |
| settings | json | CandidateSettings nhúng trong document. |
| job_suggestions | json | Cache gợi ý việc làm. |
| suggestions_updated_at | datetime | Thời điểm cập nhật gợi ý. |
| followed_company_ids | json | Danh sách company id đã theo dõi. |
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
| contact_email | varchar | Email liên hệ. |
| contact_phone | varchar | Số điện thoại liên hệ. |
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
| price | bigint | Giá gói. |
| ai_credits | int | Số credit AI. |
| job_limit | int | Hạn mức đăng job. |
| cv_limit | int | Hạn mức xem CV. |
| featured | boolean | Gói nổi bật. |
| features | json | Danh sách tính năng. |
| created_at | datetime | Thời điểm tạo. |
| updated_at | datetime | Thời điểm cập nhật. |

## wishlists

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| candidate_id | varchar | Tham chiếu đến `candidates.id`. |
| job_id | varchar | Tham chiếu đến `jobs.id` ở job service. |
| saved_at | datetime | Thời điểm lưu. |
| deleted | boolean | Cờ xóa mềm. |
