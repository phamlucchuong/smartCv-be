# Application Service Tables

## applications

| Tên cột | Kiểu dữ liệu | Mô tả |
| --- | --- | --- |
| id | varchar | MongoDB document id. |
| candidate_id | varchar | Tham chiếu đến candidate user id. |
| job_id | varchar | Tham chiếu đến `jobs.id`. |
| recruiter_id | varchar | Tham chiếu đến recruiter user id. |
| candidate_email | varchar | Email ứng tuyển. |
| job_title | varchar | Tiêu đề job snapshot. |
| company_name | varchar | Tên công ty snapshot. |
| job_location | varchar | Địa điểm job snapshot. |
| salary_min | float | Lương tối thiểu snapshot. |
| salary_max | float | Lương tối đa snapshot. |
| job_skills | json | Kỹ năng job snapshot. |
| job_type | varchar | Loại job snapshot. |
| status | varchar | Trạng thái application. |
| cover_letter | text | Cover letter. |
| cv_url | text | URL CV. |
| ai_score | int | Điểm AI đánh giá. |
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
| questions | json | Danh sách `Question`. |
| time_limit_minutes | int | Giới hạn thời gian làm bài. |
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
| answers | json | Danh sách `AttemptAnswer`. |
| started_at | datetime | Thời điểm bắt đầu. |
| submitted_at | datetime | Thời điểm nộp bài. |
| score | float | Điểm số. |
| result | varchar | Kết quả bài làm. |
