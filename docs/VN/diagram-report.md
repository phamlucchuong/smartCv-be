# Báo cáo Sơ đồ Hệ thống SmartCV

> **Mục đích:** Tài liệu này mô tả chi tiết từng sơ đồ để dùng làm prompt cho ChatGPT / công cụ vẽ sơ đồ (PlantUML, Draw.io, Mermaid...).  
> **Hệ thống:** SmartCV — nền tảng kết nối ứng viên và nhà tuyển dụng.  
> **Vai trò chính:** Ứng viên (Candidate), Nhà tuyển dụng (Recruiter), Quản trị viên (Admin).

---

## TỔNG QUAN HỆ THỐNG

SmartCV là nền tảng tuyển dụng thông minh gồm các thành phần:

| Thành phần | Công nghệ | Chức năng |
|---|---|---|
| API Gateway | Spring Cloud Gateway | Xác thực JWT, định tuyến, rate-limit |
| User Service | Spring Boot + MongoDB | Auth, OTP, profile Candidate/Recruiter |
| Job Service | Spring Boot + MongoDB + Elasticsearch | Đăng tin, tìm kiếm việc làm |
| Application Service | Spring Boot + MongoDB | Vòng đời đơn ứng tuyển, bài kiểm tra |
| AI Engine Service | Spring Boot + Claude API | Phân tích CV, gợi ý việc làm, cải thiện CV |
| Notification Service | Go + Echo + PostgreSQL | Email/SMS/Push qua RabbitMQ |

---

## ═══════════════════════════════════════
## SƠ ĐỒ 1 — USE CASE DIAGRAM: TOÀN HỆ THỐNG
## ═══════════════════════════════════════

**Loại sơ đồ:** Use Case Diagram (UML)  
**Công cụ gợi ý:** PlantUML `@startuml ... @enduml` hoặc Draw.io

### Mô tả prompt cho ChatGPT:

```
Vẽ UML Use Case Diagram cho hệ thống SmartCV với các tác nhân và use case sau:

Actors:
- Ứng viên (Candidate)
- Nhà tuyển dụng (Recruiter)
- Quản trị viên (Admin)
- Hệ thống AI (AI Engine) [actor phụ]
- Hệ thống thông báo (Notification System) [actor phụ]

Use Cases của Ứng viên:
- UC-01: Đăng ký tài khoản
- UC-02: Đăng nhập
- UC-03: Tải lên CV (PDF)
- UC-04: Tìm kiếm việc làm
- UC-05: Nộp đơn ứng tuyển
- UC-06: Rút đơn ứng tuyển
- UC-07: Làm bài kiểm tra năng lực
- UC-08: Xem gợi ý việc làm (AI)
- UC-09: Phân tích CV (AI)
- UC-10: Cải thiện CV (AI)
- UC-11: Thêm việc làm vào danh sách yêu thích

Use Cases của Nhà tuyển dụng:
- UC-12: Đăng tin tuyển dụng
- UC-13: Quản lý tin tuyển dụng (sửa, đóng, đăng lại)
- UC-14: Xem danh sách ứng viên
- UC-15: Cập nhật trạng thái đơn ứng tuyển
- UC-16: Tạo bài kiểm tra năng lực
- UC-17: Giao bài kiểm tra cho ứng viên
- UC-18: Tạo câu hỏi phỏng vấn (AI)

Use Cases của Admin:
- UC-19: Quản lý người dùng
- UC-20: Quản lý tất cả tin tuyển dụng
- UC-21: Quản lý tất cả đơn ứng tuyển
- UC-22: Xem báo cáo hệ thống

Relationships:
- UC-01 <<include>> "Xác thực OTP"
- UC-03 <<include>> "Trích xuất kỹ năng (AI)" [trigger sang AI Engine]
- UC-08 <<extend>> UC-03
- UC-09 <<include>> UC-03
```

---

## ═══════════════════════════════════════
## SƠ ĐỒ 2 — SEQUENCE DIAGRAM: ĐĂNG KÝ VÀ XÁC THỰC OTP
## ═══════════════════════════════════════

**Loại sơ đồ:** Sequence Diagram (UML)  
**Luồng mô tả:** Người dùng đăng ký → OTP gửi qua Email/SMS → Xác thực → Cấp JWT

### Mô tả prompt cho ChatGPT:

```
Vẽ UML Sequence Diagram cho luồng Đăng ký tài khoản và Xác thực OTP trong hệ thống SmartCV.

Participants (theo thứ tự từ trái sang phải):
1. Browser/Client
2. API Gateway (port 8080)
3. User Service (port 8081)
4. Redis
5. RabbitMQ
6. Notification Service (port 8084)
7. Email/SMS Provider

Sequence:
1. Browser → API Gateway: POST /user/api/auth/register {email, password, phone, preferredVerification}
2. API Gateway → User Service: forward request (public route, no JWT check)
3. User Service → User Service: Kiểm tra email/phone không trùng, hash password
4. User Service → MongoDB: Lưu user với trạng thái UNVERIFIED
5. User Service → User Service: Sinh OTP 6 số, đặt TTL 5 phút
6. User Service → Redis: SET otp:{userId} = {otp_code} (TTL 300s)
7. User Service → RabbitMQ: Publish event OTP_CREATED {userId, email/phone, otpCode, channel}
8. RabbitMQ → Notification Service: Consume event
9. Notification Service → Email/SMS Provider: Gửi OTP
10. User Service → API Gateway → Browser: Response 200 {message: "OTP sent"}
11. Browser → API Gateway: POST /user/api/auth/verify-registration {email, otpCode}
12. API Gateway → User Service: forward request
13. User Service → Redis: GET otp:{userId}, kiểm tra khớp
14. User Service → MongoDB: Cập nhật trạng thái ACTIVE
15. User Service → Redis: DELETE otp:{userId}
16. User Service → User Service: Tạo Access Token (JWT, 1h) + Refresh Token (30d)
17. User Service → API Gateway → Browser: Response {accessToken, refreshToken}

Ghi chú:
- Nếu OTP sai quá 3 lần → khóa tài khoản tạm thời
- Nếu OTP hết hạn → gọi POST /resend-otp
```

---

## ═══════════════════════════════════════
## SƠ ĐỒ 3 — SEQUENCE DIAGRAM: ĐĂNG NHẬP VÀ XÁC THỰC JWT
## ═══════════════════════════════════════

**Loại sơ đồ:** Sequence Diagram (UML)

### Mô tả prompt cho ChatGPT:

```
Vẽ UML Sequence Diagram cho luồng Đăng nhập và xác thực JWT trong SmartCV.

Participants:
1. Browser/Client
2. API Gateway (Spring Cloud Gateway)
3. User Service
4. Redis (blacklist + rate limit)

Sequence - Đăng nhập:
1. Browser → API Gateway: POST /user/api/auth/login {email, password}
2. API Gateway: Route đến User Service (public route)
3. User Service: Kiểm tra email tồn tại, verify password hash
4. User Service: Tạo Access Token (JWT, 1h) + Refresh Token (30 ngày)
5. User Service → Browser: {accessToken, refreshToken, authenticated: true}

Sequence - Gọi API có bảo vệ:
1. Browser → API Gateway: GET /job/api/jobs/my (Header: Authorization: Bearer {token})
2. API Gateway → AuthenticationFilter: Kiểm tra header Authorization
3. AuthenticationFilter → User Service: POST /user/api/auth/introspect {token}
4. User Service → Redis: Kiểm tra token có trong blacklist không
5. User Service: Verify JWT signature + expiry
6. User Service → AuthenticationFilter: {valid: true, userId, roles}
7. AuthenticationFilter: Thêm header X-User-Id, X-User-Roles vào request
8. API Gateway → Job Service: GET /api/jobs/my (với headers đã thêm)
9. Job Service → Browser: Danh sách việc làm của recruiter

Sequence - Đăng xuất:
1. Browser → API Gateway: POST /user/api/auth/logout (Header: Bearer token)
2. User Service → Redis: SET blacklist:{token_jti} = "1" (TTL = thời gian còn lại của token)
3. User Service → Browser: {message: "Logout successfully"}
```

---

## ═══════════════════════════════════════
## SƠ ĐỒ 4 — SEQUENCE DIAGRAM: UPLOAD CV VÀ TRÍCH XUẤT KỸ NĂNG AI
## ═══════════════════════════════════════

**Loại sơ đồ:** Sequence Diagram (UML)  
**Luồng:** Ứng viên upload CV PDF → S3 → AI trích xuất kỹ năng tự động

### Mô tả prompt cho ChatGPT:

```
Vẽ UML Sequence Diagram cho luồng Ứng viên upload CV trong SmartCV.

Participants:
1. Browser (Ứng viên)
2. API Gateway
3. User Service (CandidateController)
4. S3 (AWS)
5. RabbitMQ
6. AI Engine Service

Sequence:
1. Browser → API Gateway: POST /user/api/candidates/cv/upload (multipart/form-data: file=cv.pdf)
2. API Gateway: Verify JWT, extract userId
3. API Gateway → User Service: Forward request + X-User-Id header
4. User Service (S3Service): Upload file lên S3, tạo pre-signed URL (TTL 7 ngày)
5. S3 → User Service: {s3Key, presignedUrl}
6. User Service (CandidateService): Lưu CV vào danh sách cvs[] của candidate profile (status: PENDING_ANALYSIS)
7. User Service → RabbitMQ: Publish event SKILL_EXTRACT {userId, s3Url, cvId}
8. User Service → Browser: {url: presignedUrl, message: "CV uploaded"}
   [async - xử lý nền]
9. RabbitMQ → AI Engine Service: Consume SKILL_EXTRACT event
10. AI Engine Service: Tải PDF từ S3 URL
11. AI Engine Service → Claude API: Prompt "Trích xuất kỹ năng từ CV này..."
12. Claude API → AI Engine Service: {skills: [...], experience: ..., education: ...}
13. AI Engine Service → User Service (Internal API): PATCH /internal/candidates/{userId}/cv-analysis {cvId, skills, analysisResult}
14. User Service → MongoDB: Cập nhật cvs[].status = ANALYZED, lưu skills

Ghi chú:
- Pre-signed URL hết hạn sau 7 ngày → gọi GET /cvs/{cvId}/url để refresh
- Ứng viên có thể trigger lại phân tích: POST /cvs/{cvId}/reanalyze
```

---

## ═══════════════════════════════════════
## SƠ ĐỒ 5 — SEQUENCE DIAGRAM: NỘP ĐƠN ỨNG TUYỂN
## ═══════════════════════════════════════

**Loại sơ đồ:** Sequence Diagram (UML)  
**Luồng:** Ứng viên tìm việc → xem chi tiết → nộp đơn

### Mô tả prompt cho ChatGPT:

```
Vẽ UML Sequence Diagram cho luồng Nộp đơn ứng tuyển trong SmartCV.

Participants:
1. Browser (Ứng viên)
2. API Gateway
3. Job Service
4. Application Service
5. RabbitMQ
6. Notification Service
7. Browser (Recruiter) [nhận thông báo]

Sequence - Tìm kiếm việc:
1. Browser → API Gateway: GET /job/api/jobs/search?keyword=java&location=HCM&page=1
2. API Gateway: Route (public route, không cần token)
3. Job Service → Elasticsearch: Full-text search với filters
4. Job Service → Browser: PageResponse<JobResponse> {jobs: [...], total, page}

Sequence - Nộp đơn:
1. Browser → API Gateway: POST /app/api/applications {jobId, cvId, coverLetter} (Bearer token)
2. API Gateway: Verify JWT → extract userId, role=CANDIDATE
3. API Gateway → Application Service: Forward request
4. Application Service → Job Service (HTTP): GET /internal/jobs/{jobId} — kiểm tra job còn active không
5. Application Service → MongoDB: Kiểm tra ứng viên chưa nộp đơn cho job này
6. Application Service → MongoDB: Lưu application {status: SUBMITTED, candidateId, jobId, cvId}
7. Application Service → RabbitMQ: Publish APPLICATION_SUBMITTED {applicationId, recruiterId, candidateId, jobTitle}
8. RabbitMQ → Notification Service: Email/Push thông báo đến Recruiter
9. Application Service → Browser: {applicationId, status: SUBMITTED}

Sequence - Recruiter duyệt đơn:
1. Browser(Recruiter) → API Gateway: PATCH /app/api/applications/{id}/status {status: REVIEWING}
2. Application Service: Kiểm tra recruiter sở hữu job này
3. Application Service → MongoDB: Cập nhật status
4. Application Service → RabbitMQ: Publish APPLICATION_STATUS_CHANGED {candidateId, newStatus}
5. Notification Service → Ứng viên: Email thông báo thay đổi trạng thái

Trạng thái đơn: SUBMITTED → REVIEWING → INTERVIEWING → OFFERED / REJECTED
```

---

## ═══════════════════════════════════════
## SƠ ĐỒ 6 — SEQUENCE DIAGRAM: LÀM BÀI KIỂM TRA NĂNG LỰC
## ═══════════════════════════════════════

**Loại sơ đồ:** Sequence Diagram (UML)  
**Luồng:** Recruiter tạo bài test → giao cho ứng viên → ứng viên làm → nộp kết quả

### Mô tả prompt cho ChatGPT:

```
Vẽ UML Sequence Diagram cho luồng Kiểm tra năng lực (Assessment) trong SmartCV.

Participants:
1. Browser (Recruiter)
2. Browser (Candidate)
3. API Gateway
4. Application Service (AssessmentController)
5. MongoDB

Sequence - Recruiter tạo và giao bài:
1. Browser(Recruiter) → API Gateway: POST /app/api/assessments {title, questions[{content, options, correctAnswer}], timeLimit, passingScore}
2. Application Service → MongoDB: Lưu Assessment {status: DRAFT, recruiterId}
3. Browser(Recruiter) → API Gateway: PATCH /app/api/assessments/{id}/assign {candidateId}
4. Application Service → MongoDB: Tạo AttemptState {assessmentId, candidateId, status: ASSIGNED}
5. API Gateway → Browser(Recruiter): {message: "Assessment assigned"}

Sequence - Ứng viên làm bài:
1. Browser(Candidate) → API Gateway: GET /app/api/assessments/my
2. Application Service → MongoDB: Lấy danh sách AttemptState của candidateId
3. Browser(Candidate) → API Gateway: POST /app/api/assessments/{id}/start
4. Application Service → MongoDB: Cập nhật AttemptState {status: IN_PROGRESS, startedAt}
5. Application Service → Browser(Candidate): {attemptId}
6. Browser(Candidate) → API Gateway: GET /app/api/assessments/{id} — lấy đề bài
7. [Ứng viên làm bài]
8. Browser(Candidate) → API Gateway: POST /app/api/attempts/{attemptId}/answers {answers: [...]}
9. Application Service → MongoDB: Lưu answers tạm (draft save)
10. Browser(Candidate) → API Gateway: POST /app/api/attempts/{attemptId}/submit
11. Application Service: Chấm điểm tự động (so sánh với correctAnswer)
12. Application Service → MongoDB: Lưu {score, passed, completedAt, status: COMPLETED}
13. Application Service → Browser(Candidate): {message: "Submitted"}

Sequence - Xem kết quả:
1. Browser(Candidate) → API Gateway: GET /app/api/attempts/{attemptId}/result
2. Application Service → MongoDB: Lấy kết quả
3. Application Service → Browser: {score, passed, totalQuestions, correctCount}
```

---

## ═══════════════════════════════════════
## SƠ ĐỒ 7 — SEQUENCE DIAGRAM: AI GỢI Ý VIỆC LÀM
## ═══════════════════════════════════════

**Loại sơ đồ:** Sequence Diagram (UML)  
**Luồng:** Ứng viên yêu cầu AI gợi ý việc phù hợp dựa trên CV

### Mô tả prompt cho ChatGPT:

```
Vẽ UML Sequence Diagram cho luồng AI gợi ý việc làm trong SmartCV.

Participants:
1. Browser (Ứng viên)
2. API Gateway
3. AI Engine Service
4. User Service (Internal)
5. Job Service (Internal)
6. Claude API (LLM)

Sequence:
1. Browser → API Gateway: POST /ai/api/ai/recommend {cvText} (Bearer token - ROLE_CANDIDATE)
2. API Gateway → AI Engine Service: forward + userId header
3. AI Engine Service → User Service (Internal): GET /internal/candidates/{userId} — lấy profile + kỹ năng đã trích xuất
4. AI Engine Service → Job Service (Internal): GET /internal/jobs/active — lấy danh sách việc làm đang tuyển
5. AI Engine Service → Claude API: Prompt "Dựa vào kỹ năng [skills], kinh nghiệm [exp], gợi ý TOP 5 việc phù hợp từ danh sách [jobs]"
6. Claude API → AI Engine Service: {recommendations: [{jobId, matchScore, reasons}]}
7. AI Engine Service → Job Service: GET /api/jobs/batch?ids=... — lấy chi tiết job
8. AI Engine Service → Browser: {jobs: [{...jobDetails, matchScore, reasons}]}

Luồng tương tự cho:
- POST /ai/api/ai/analyze: Phân tích CV theo job description cụ thể
- POST /ai/api/ai/improve: Đề xuất cách cải thiện CV
- POST /ai/api/ai/interview-questions: Tạo câu hỏi phỏng vấn (dành cho Recruiter)
```

---

## ═══════════════════════════════════════
## SƠ ĐỒ 8 — BFD (BUSINESS FLOW DIAGRAM): VÒNG ĐỜI ĐƠN ỨNG TUYỂN
## ═══════════════════════════════════════

**Loại sơ đồ:** Business Flow Diagram / State Machine Diagram  
**Mô tả:** Toàn bộ vòng đời của một đơn ứng tuyển từ khi nộp đến khi kết thúc

### Mô tả prompt cho ChatGPT:

```
Vẽ State Machine Diagram (hoặc Business Flow Diagram) cho vòng đời đơn ứng tuyển trong SmartCV.

States:
- [START] Ứng viên nộp đơn
- SUBMITTED (Đã nộp)
- REVIEWING (Đang xét duyệt)
- INTERVIEWING (Đang phỏng vấn)
- OFFERED (Đề xuất nhận)
- REJECTED (Từ chối)
- WITHDRAWN (Ứng viên rút đơn)
- [END]

Transitions:
- [START] → SUBMITTED: Ứng viên POST /applications
- SUBMITTED → REVIEWING: Recruiter cập nhật status (PATCH /applications/{id}/status)
- SUBMITTED → WITHDRAWN: Ứng viên rút đơn (PATCH /applications/{id}/withdraw)
- REVIEWING → INTERVIEWING: Recruiter cập nhật status
- REVIEWING → REJECTED: Recruiter từ chối
- REVIEWING → WITHDRAWN: Ứng viên rút đơn
- INTERVIEWING → OFFERED: Recruiter đề xuất nhận việc
- INTERVIEWING → REJECTED: Recruiter từ chối sau phỏng vấn
- INTERVIEWING → WITHDRAWN: Ứng viên rút đơn
- OFFERED → [END]: Kết thúc tích cực
- REJECTED → [END]: Kết thúc tiêu cực
- WITHDRAWN → [END]: Ứng viên chủ động rút

Actions/Events tại mỗi chuyển trạng thái:
- Mỗi thay đổi status → Notification Service gửi email/push cho bên liên quan
- SUBMITTED → REVIEWING: Recruiter nhận email thông báo đơn mới
- Thay đổi → Ứng viên nhận email thông báo cập nhật

Ghi chú thêm:
- AI có thể tự động gán AI Score khi đơn ở trạng thái SUBMITTED (PATCH /applications/{id}/ai-score)
- Admin có thể thao tác ở mọi trạng thái
```

---

## ═══════════════════════════════════════
## SƠ ĐỒ 9 — BFD: KIẾN TRÚC MICROSERVICES VÀ LUỒNG DỮ LIỆU
## ═══════════════════════════════════════

**Loại sơ đồ:** Architecture / Data Flow Diagram (DFD Level 1)  
**Mô tả:** Tổng quan kiến trúc hệ thống và luồng dữ liệu giữa các service

### Mô tả prompt cho ChatGPT:

```
Vẽ System Architecture Diagram / Data Flow Diagram cho hệ thống SmartCV.

Layers (từ trái sang phải hoặc từ trên xuống dưới):

[Layer 1 - Clients]
- Web Browser (Candidate App - React, port 3000)
- Web Browser (Recruiter App - React, port 3001)
- Web Browser (Admin App - React, port 3003)

[Layer 2 - API Gateway (port 8080)]
- JWT Authentication Filter
- Route: /user/** → User Service :8081
- Route: /job/** → Job Service :8082
- Route: /app/** → Application Service :8083
- Route: /ai/** → AI Engine Service :8085
- Route: /notification/** → Notification Service :8084

[Layer 3 - Microservices]
Box 1: User Service (8081)
  - Auth (Login/Register/OTP)
  - Candidate Profile + CV
  - Recruiter Profile
  - Company Info
  Database: MongoDB (users, candidates, recruiters)
  Cache: Redis (OTP, JWT blacklist)

Box 2: Job Service (8082)
  - Job CRUD
  - Job Search
  Database: MongoDB (jobs)
  Search: Elasticsearch (job index)

Box 3: Application Service (8083)
  - Job Applications
  - Assessments & Attempts
  Database: MongoDB (applications, assessments)

Box 4: AI Engine Service (8085)
  - CV Analysis
  - Job Recommendation
  - CV Improvement
  - Interview Questions
  External: Claude API (Anthropic)

Box 5: Notification Service (8084)
  - Email (SMTP)
  - SMS (Twilio)
  - Push (Firebase)
  Database: PostgreSQL (notification logs)

[Layer 4 - Message Broker]
RabbitMQ:
  - Queue: otp.created → Notification Service
  - Queue: skill.extract → AI Engine Service
  - Queue: application.events → Notification Service

[Layer 5 - Storage]
- AWS S3 (CV files, avatars)
- MongoDB (documents)
- PostgreSQL (notification logs)
- Redis (cache, sessions)
- Elasticsearch (job search index)

Mũi tên đồng bộ (→): HTTP/REST calls
Mũi tên bất đồng bộ (⇢): RabbitMQ events
```

---

## ═══════════════════════════════════════
## SƠ ĐỒ 10 — BFD: QUY TRÌNH TUYỂN DỤNG ĐẦY ĐỦ (END-TO-END)
## ═══════════════════════════════════════

**Loại sơ đồ:** Business Flow Diagram / Cross-functional Flowchart (Swimlane)  
**Mô tả:** Toàn bộ quy trình tuyển dụng từ góc nhìn nghiệp vụ

### Mô tả prompt cho ChatGPT:

```
Vẽ Cross-functional Flowchart (Swimlane Diagram) mô tả quy trình tuyển dụng đầy đủ trong SmartCV.

Swimlanes (các làn bơi):
1. Ứng viên (Candidate)
2. Nền tảng SmartCV (Platform/System)
3. Nhà tuyển dụng (Recruiter)
4. AI Engine

Các bước theo từng làn:

[Recruiter Lane]
- Đăng ký tài khoản Recruiter
- Tạo hồ sơ công ty
- Đăng tin tuyển dụng (title, mô tả, yêu cầu, mức lương)
- Publish tin → Tin xuất hiện trên nền tảng

[Platform Lane]
- Lưu tin vào MongoDB + index vào Elasticsearch
- Hiển thị tin cho ứng viên tìm kiếm

[Candidate Lane]
- Đăng ký tài khoản Ứng viên
- Upload CV (PDF)
- Tìm kiếm việc làm (full-text search)
- Xem chi tiết tin tuyển dụng
- Nộp đơn ứng tuyển (chọn CV + viết cover letter)

[AI Lane - song song]
- Nhận sự kiện CV mới → Trích xuất kỹ năng
- Cập nhật candidate profile với extracted skills
- Gợi ý việc làm phù hợp cho ứng viên

[Recruiter Lane - tiếp theo]
- Nhận thông báo có đơn mới
- Xem danh sách ứng viên (có AI score)
- Tạo bài kiểm tra năng lực (optional)
- Giao bài kiểm tra cho ứng viên

[Candidate Lane - tiếp theo]
- Nhận thông báo được giao bài kiểm tra
- Làm bài kiểm tra trong thời gian giới hạn
- Nộp bài

[Recruiter Lane - kết thúc]
- Xem kết quả bài kiểm tra
- Cập nhật trạng thái: INTERVIEWING / REJECTED / OFFERED

[Platform Lane - kết thúc]
- Gửi thông báo đến ứng viên về kết quả
```

---

## ═══════════════════════════════════════
## SƠ ĐỒ 11 — SEQUENCE DIAGRAM: QUÊN MẬT KHẨU
## ═══════════════════════════════════════

**Loại sơ đồ:** Sequence Diagram (UML)

### Mô tả prompt cho ChatGPT:

```
Vẽ UML Sequence Diagram cho luồng Quên mật khẩu trong SmartCV.

Participants:
1. Browser
2. API Gateway
3. User Service
4. Redis
5. RabbitMQ
6. Notification Service
7. Email Provider

Sequence:
1. Browser → API Gateway: POST /user/api/auth/forgot-password {email}
2. User Service → MongoDB: Tìm user theo email
3. User Service → User Service: Sinh OTP 6 số
4. User Service → Redis: SET reset_otp:{userId} = otp (TTL 300s)
5. User Service → RabbitMQ: Publish PASSWORD_RESET_OTP {email, otpCode}
6. Notification Service → Email Provider: Gửi email với OTP
7. User Service → Browser: {message: "OTP sent to email"}
8. Browser → API Gateway: POST /user/api/auth/reset-password {email, otpCode, newPassword}
9. User Service → Redis: GET reset_otp:{userId}, xác thực OTP
10. User Service → MongoDB: Cập nhật password hash mới
11. User Service → Redis: DELETE reset_otp:{userId}
12. User Service → Browser: {message: "Password reset successfully"}
```

---

## ═══════════════════════════════════════
## GHI CHÚ CHUNG
## ═══════════════════════════════════════

### Công nghệ stack tham khảo khi vẽ:
- **Frontend:** React 19, TanStack Router, TanStack Query, Zustand, Tailwind CSS
- **Backend:** Spring Boot 3.x (Java), Echo v5 (Go)
- **Message broker:** RabbitMQ (async events)
- **Databases:** MongoDB (main), PostgreSQL (notifications), Redis (cache/session), Elasticsearch (search)
- **Storage:** AWS S3 (files)
- **AI:** Claude API (Anthropic)
- **Auth:** JWT (Access Token 1h + Refresh Token 30 ngày)

### Màu sắc gợi ý cho sơ đồ kiến trúc:
- Client apps: **xanh dương nhạt**
- API Gateway: **cam**
- Microservices: **xanh lá**
- Databases: **tím nhạt**
- Message Broker (RabbitMQ): **vàng**
- External APIs (S3, Claude, Twilio): **xám**
- Luồng đồng bộ (HTTP): mũi tên đặc `→`
- Luồng bất đồng bộ (MQ): mũi tên đứt `⇢`
