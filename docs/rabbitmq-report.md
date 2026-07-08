# RabbitMQ In SmartCV

Tài liệu này mô tả chi tiết RabbitMQ trong SmartCV, gồm:
- phần lý thuyết RabbitMQ
- cách RabbitMQ được cấu hình trong codebase
- topology exchange / queue / routing key
- các luồng business event đang chạy trong hệ thống
- nhận xét kiến trúc, ưu điểm, rủi ro và hướng cải thiện

Phạm vi khảo sát dựa trên code hiện tại trong:
- `backend/user-service`
- `backend/application_service`
- `backend/job_service`
- `backend/ai_engine_service`
- `backend/payment-service`
- `backend/notification-service`
- `backend/docker-compose*.yaml`

## 1. RabbitMQ là gì

RabbitMQ là một message broker, tức là một thành phần trung gian dùng để truyền message bất đồng bộ giữa các service.

Thay vì service A gọi trực tiếp service B và phải chờ phản hồi ngay, service A có thể:
- tạo message
- gửi message vào RabbitMQ
- tiếp tục xử lý công việc khác

Service B hoặc nhiều service khác sẽ đọc message đó sau.

Trong kiến trúc microservices, RabbitMQ thường được dùng để:
- tách rời producer và consumer
- giảm coupling giữa service
- xử lý bất đồng bộ
- tăng khả năng scale consumer độc lập
- hỗ trợ retry, dead-letter queue, buffering khi consumer chậm

## 2. Các khái niệm lý thuyết quan trọng

### 2.1. Producer

Producer là service phát sinh message và gửi vào broker.

Ví dụ trong SmartCV:
- `user-service` publish event trích xuất skill từ CV
- `application_service` publish event chấm CV hoặc notify trạng thái application
- `payment-service` publish event `payment.completed`

### 2.2. Consumer

Consumer là service lắng nghe queue và xử lý message nhận được.

Ví dụ trong SmartCV:
- `ai_engine_service` consume event chấm CV và extract skill
- `user-service` consume `payment.completed`
- `notification-service` consume nhiều loại event để gửi email / push / in-app

### 2.3. Exchange

Exchange là nơi RabbitMQ nhận message từ producer và quyết định message sẽ đi đến queue nào.

Exchange không lưu trữ message lâu dài. Nó chỉ làm nhiệm vụ định tuyến.

Các loại exchange phổ biến:
- `direct`: route theo routing key chính xác
- `topic`: route theo pattern như `user.*`, `order.#`
- `fanout`: broadcast tới tất cả queue bind vào exchange
- `headers`: route theo header

SmartCV hiện chủ yếu dùng `direct exchange`.

### 2.4. Queue

Queue là nơi message được giữ lại để consumer đọc.

Một queue có thể:
- durable: tồn tại sau khi broker restart
- non-durable: mất khi broker restart

Trong SmartCV, phần lớn queue business quan trọng được tạo dạng durable.

### 2.5. Routing key

Routing key là chuỗi producer gửi kèm message để exchange định tuyến.

Ví dụ:
- `application.submitted`
- `payment.completed`
- `candidate.skill.extract`

Với `direct exchange`, queue chỉ nhận message nếu routing key khớp đúng binding key.

### 2.6. Binding

Binding là quan hệ giữa exchange và queue.

Ví dụ:
- exchange `application.exchange`
- queue `application.submitted.queue`
- binding key `application.submitted`

Khi producer gửi message tới exchange với routing key `application.submitted`, message sẽ đi vào queue đó.

### 2.7. Acknowledge

Ack là cơ chế xác nhận message đã được consumer xử lý thành công.

Hai kiểu thường gặp:
- auto-ack: nhận message là coi như đã xử lý xong
- manual ack: chỉ ack khi business logic hoàn tất

Nếu không ack đúng, message có thể:
- bị mất
- bị requeue
- đi vào dead-letter queue

Trong SmartCV:
- `notification-service` Go consumer đang dùng `autoAck = true`
- phía Spring AMQP có nhiều listener dùng cấu hình mặc định của framework

### 2.8. Dead-letter queue

DLQ là queue nhận các message xử lý thất bại hoặc bị reject sau nhiều lần retry.

DLQ giúp:
- không làm kẹt queue chính
- giữ lại message lỗi để điều tra
- tránh mất dữ liệu business quan trọng

Trong SmartCV, payment flow có cấu hình DLQ rõ ràng:
- main queue: `payment.completed.queue`
- DLQ queue: `payment.completed.dlq`

## 3. Vai trò RabbitMQ trong SmartCV

RabbitMQ là lớp truyền event bất đồng bộ giữa các microservice.

Các nhóm use case chính:
- OTP notification
- application lifecycle notification
- recruiter approval / moderation notification
- job moderation notification
- CV skill extraction
- CV scoring cho application
- job suggestion sau phân tích CV
- assessment submission notification
- package expiry / billing notification
- payment completed activation

RabbitMQ không thay thế REST hoàn toàn.

Trong SmartCV:
- REST dùng cho request/response đồng bộ cần kết quả ngay
- RabbitMQ dùng cho event bất đồng bộ, tác vụ nền, side effect và notify

## 4. Hạ tầng RabbitMQ trong hệ thống

Theo `backend/docker-compose.yaml` và `backend/docker-compose.prod.yaml`, hệ thống có container RabbitMQ riêng:
- image: `rabbitmq:4-management-alpine`
- có management UI
- được các service backend kết nối qua host `rabbitmq`

Các Spring service đều đọc cấu hình từ:
- `RABBITMQ_HOST`
- `RABBITMQ_PORT`
- `RABBITMQ_USER`
- `RABBITMQ_PASSWORD`

Các file cấu hình xác nhận điều này:
- [backend/user-service/src/main/resources/application.yaml](/home/chuongpl/projects/smartCv/backend/user-service/src/main/resources/application.yaml)
- [backend/application_service/src/main/resources/application.yaml](/home/chuongpl/projects/smartCv/backend/application_service/src/main/resources/application.yaml)
- [backend/job_service/src/main/resources/application.yaml](/home/chuongpl/projects/smartCv/backend/job_service/src/main/resources/application.yaml)
- [backend/ai_engine_service/src/main/resources/application.yaml](/home/chuongpl/projects/smartCv/backend/ai_engine_service/src/main/resources/application.yaml)
- [backend/payment-service/src/main/resources/application.yaml](/home/chuongpl/projects/smartCv/backend/payment-service/src/main/resources/application.yaml)

## 5. Exchange và queue hiện có

### 5.1. `notification.exchange`

Mục đích:
- gửi OTP

Topology:
- exchange: `notification.exchange`
- queue: `otp.queue`
- routing key: `otp.routing.key`

Producer:
- `user-service` qua `NotificationClient`

Consumer:
- `notification-service`

### 5.2. `candidate.skill.exchange`

Mục đích:
- gửi yêu cầu trích xuất skill từ CV

Topology:
- exchange: `candidate.skill.exchange`
- queue: `candidate.skill.extract.queue`
- routing key: `candidate.skill.extract`

Producer:
- `user-service` qua `SkillExtractPublisher`

Consumer:
- `ai_engine_service` qua `SkillExtractionConsumer`

### 5.3. `job.suggestions.exchange`

Mục đích:
- gửi danh sách job suggestion sau khi AI recommend xong

Topology:
- exchange: `job.suggestions.exchange`
- queue: `job.suggestions.queue`
- routing key: `job.suggestions`

Producer:
- `ai_engine_service` qua `JobSuggestionsPublisher`

Consumer:
- `user-service` qua `JobSuggestionsConsumer`

### 5.4. `cv.scoring.exchange`

Mục đích:
- gửi yêu cầu chấm CV cho application

Topology:
- exchange: `cv.scoring.exchange`
- queue: `cv.scoring.queue`
- routing key: `cv.scoring`

Producer:
- `application_service` qua `AiScoringPublisher`

Consumer:
- `ai_engine_service` qua `CvScoringConsumer`

### 5.5. `application.exchange`

Mục đích:
- phát event liên quan tới application

Topology:
- exchange: `application.exchange`
- queues:
  - `application.submitted.queue`
  - `application.accepted.queue`
  - `application.rejected.queue`
  - `application.withdrawn.queue`
- routing keys:
  - `application.submitted`
  - `application.accepted`
  - `application.rejected`
  - `application.withdrawn`

Producer:
- `application_service` qua `NotificationPublisher`

Consumer:
- `notification-service`

### 5.6. `assessment.exchange`

Mục đích:
- gửi event nộp assessment

Topology:
- exchange: `assessment.exchange`
- queue: `assessment.submitted.queue`
- routing key: `assessment.submitted`

Producer:
- `application_service` qua `AssessmentNotificationPublisher`

Consumer:
- `notification-service`

### 5.7. `recruiter.notification.exchange`

Mục đích:
- các event liên quan đến recruiter onboarding, billing và package lifecycle

Queues chính:
- `recruiter.approved.queue`
- `recruiter.rejected.queue`
- `recruiter.pending.queue`
- `recruiter.billing.queue`
- `package.expired.queue`
- `package.expiring.soon.queue`
- `ai.credit.exhausted.queue`

Routing keys:
- `recruiter.approved`
- `recruiter.rejected`
- `recruiter.pending`
- `recruiter.billing`
- `package.expired`
- `package.expiring.soon`
- `ai.credit.exhausted`

Producers:
- `user-service`:
  - `RecruiterService`
  - `PlatformFeeScheduler`
  - `SubscriptionExpiryScheduler`
  - `AiCreditExhaustedPublisher`

Consumer:
- `notification-service`

### 5.8. `job.exchange`

Mục đích:
- event về job moderation và lifecycle

Queues:
- `job.created.queue`
- `job.updated.queue`
- `job.closed.queue`
- `job.approved.queue`
- `job.rejected.queue`

Routing keys:
- `job.created`
- `job.updated`
- `job.closed`
- `job.approved`
- `job.rejected`

Producer:
- `job_service` qua `JobService.publishEvent()` và `publishModerationEvent()`

Consumer chính quan sát được:
- `notification-service` consume `job.approved.queue` và `job.rejected.queue`

Lưu ý:
- code hiện có queue `job.created` và `job.updated`, nhưng trong khảo sát này chưa thấy consumer business rõ ràng ở service khác cho 2 queue này

### 5.9. `cv.analysis.exchange`

Mục đích:
- thông báo CV analysis hoàn thành

Topology:
- exchange: `cv.analysis.exchange`
- queue: `cv.analysis.done.queue`
- routing key: `cv.analysis.done`

Producer:
- `user-service` qua `CvAnalysisDonePublisher`

Consumer:
- `notification-service`

### 5.10. `payment.exchange` và `payment.dlq.exchange`

Mục đích:
- phát event thanh toán hoàn tất
- tách message lỗi sang DLQ

Topology:
- main exchange: `payment.exchange`
- main queue: `payment.completed.queue`
- routing key: `payment.completed`
- DLQ exchange: `payment.dlq.exchange`
- DLQ queue: `payment.completed.dlq`
- DLQ routing key: `payment.completed.dead`

Producer:
- `payment-service` qua `PaymentOrderService`

Consumer:
- `user-service` qua `PaymentEventConsumer`

## 6. Các luồng nghiệp vụ RabbitMQ chính

### 6.1. OTP flow

Luồng:
1. Người dùng đăng ký / yêu cầu OTP
2. `user-service` publish message OTP vào `notification.exchange`
3. `notification-service` consume từ `otp.queue`
4. Notification service sinh/gửi OTP qua email hoặc SMS

Ý nghĩa:
- tách logic auth khỏi logic gửi OTP
- giảm coupling giữa user-service và notification-service

### 6.2. CV skill extraction flow

Luồng:
1. Candidate upload CV
2. `user-service` gọi `SkillExtractPublisher.publish(userId, cvUrl)`
3. message đi vào `candidate.skill.exchange`
4. `ai_engine_service` consume ở `candidate.skill.extract.queue`
5. `AnalysisService.extractSkills` gọi AI để trích xuất skill
6. `user-service` được gọi lại bằng REST để merge skill vào profile

Ý nghĩa:
- tác vụ AI không block request upload CV
- profile có thể được enrich sau

### 6.3. CV scoring for application flow

Luồng:
1. Candidate apply job
2. `application_service` publish `CvScoringMessage`
3. message đi vào `cv.scoring.exchange`
4. `ai_engine_service` consume ở `cv.scoring.queue`
5. AI service chấm CV theo job
6. AI service callback lại `application_service` để cập nhật `ai_score`, `matchedSkills`, `missingSkills`, `ai_status`

Ý nghĩa:
- tránh để luồng apply phải chờ AI scoring hoàn tất
- application vẫn lưu được trước, scoring chạy nền

### 6.4. Job suggestion flow

Luồng:
1. Candidate phân tích CV hoặc hệ thống chạy recommend
2. `ai_engine_service` tạo danh sách gợi ý job
3. publish `job.suggestions`
4. `user-service` consume và cập nhật `jobSuggestions` vào hồ sơ candidate

Ý nghĩa:
- AI service không cần ghi trực tiếp vào database của user-service
- tuân thủ boundary microservice

### 6.5. Application notification flow

Luồng:
1. `application_service` publish:
   - `application.submitted`
   - `application.accepted`
   - `application.rejected`
   - `application.withdrawn`
2. `notification-service` consume
3. notification-service gửi email / push / in-app cho candidate hoặc recruiter

Ý nghĩa:
- business event và notification side effect được tách riêng

### 6.6. Recruiter approval flow

Luồng:
1. Recruiter submit hồ sơ xác minh
2. `user-service` publish `recruiter.pending`
3. notification-service báo admin có yêu cầu mới
4. Khi admin duyệt/từ chối:
   - `user-service` publish `recruiter.approved` hoặc `recruiter.rejected`
5. notification-service gửi thông báo tương ứng cho recruiter

### 6.7. Job moderation flow

Luồng:
1. Admin approve/reject job
2. `job_service` publish `job.approved` hoặc `job.rejected`
3. notification-service consume và gửi thông báo cho recruiter

### 6.8. Assessment submitted flow

Luồng:
1. Candidate nộp assessment
2. `application_service` publish `assessment.submitted`
3. notification-service consume
4. gửi thông báo cho recruiter về kết quả nộp bài

### 6.9. Payment completed flow

Luồng:
1. User thanh toán qua PayOS
2. `payment-service` xác thực webhook
3. payment-service cập nhật order thành `PAID`
4. payment-service publish `payment.completed`
5. `user-service` consume
6. kích hoạt package cho candidate hoặc recruiter
7. nếu xử lý lỗi, consumer ném exception để message có thể bị NACK và đi về DLQ theo policy

Đây là một luồng quan trọng vì liên quan trực tiếp đến quyền lợi đã mua.

### 6.10. Package expiry / billing / AI credit exhausted flow

Nguồn phát:
- `SubscriptionExpiryScheduler`
- `PlatformFeeScheduler`
- `AiCreditExhaustedPublisher`

Các event chính:
- `package.expired`
- `package.expiring.soon`
- `recruiter.billing`
- `ai.credit.exhausted`

Consumer:
- `notification-service`

Ý nghĩa:
- gom các side effect về notification về một đầu mối

## 7. Cách các service tích hợp RabbitMQ

### 7.1. Spring services

Các service Java/Spring dùng:
- `RabbitTemplate` hoặc `AmqpTemplate` để publish
- `@RabbitListener` để consume
- `DirectExchange`, `Queue`, `BindingBuilder` để khai báo topology
- `Jackson2JsonMessageConverter` để serialize/deserialize JSON

Ưu điểm:
- code rõ, ít boilerplate
- message object được map thẳng sang DTO Java

### 7.2. Go notification-service

Notification service dùng thư viện:
- `github.com/rabbitmq/amqp091-go`

Phong cách tích hợp:
- tự `ExchangeDeclare`
- tự `QueueDeclare`
- tự `QueueBind`
- `Consume(...)`
- spin goroutine để xử lý message

Ưu điểm:
- kiểm soát chi tiết
- không phụ thuộc Spring ecosystem

Hạn chế:
- nhiều queue được khai báo lặp bằng code
- hiện dùng `autoAck = true`, nên nếu business logic lỗi sau khi nhận message thì message đã được xem là xử lý xong

## 8. Nhận xét kỹ thuật về topology hiện tại

### 8.1. Điểm tốt

1. Hệ thống tách khá đúng giữa synchronous REST và asynchronous event.

2. Các domain event đã được chia exchange tương đối rõ:
- notification
- application
- assessment
- job
- recruiter
- CV scoring
- skill extraction
- payment

3. Payment flow có DLQ riêng, đây là phần quan trọng nhất về mặt độ tin cậy và đã được quan tâm đúng mức.

4. AI use cases bất đồng bộ được thiết kế hợp lý:
- CV scoring
- skill extraction
- job suggestion

5. User-service và notification-service được dùng như 2 “hub” nghiệp vụ:
- user-service quản lý profile, package, recruiter lifecycle
- notification-service quản lý side effect gửi thông báo

### 8.2. Điểm cần chú ý

1. Queue durability chưa hoàn toàn đồng nhất.
- Có queue tạo `new Queue(name)` không ghi rõ durable
- Có queue tạo `new Queue(name, true)`

Trong Spring AMQP, `new Queue(name)` mặc định là durable, nhưng codebase nên thống nhất rõ ràng để tránh hiểu nhầm.

2. Notification service dùng `autoAck = true`.
- Nếu consumer unmarshal xong nhưng xử lý business lỗi, message không được retry
- phù hợp với notification “best effort”, nhưng không phù hợp với event cần độ tin cậy cao

3. Chỉ payment flow có DLQ rõ ràng.
- Các luồng khác chưa có DLQ riêng trong code quan sát được
- nếu cần đảm bảo cao hơn, có thể bổ sung DLQ cho:
  - `cv.scoring`
  - `candidate.skill.extract`
  - `application.submitted`
  - `recruiter.pending`

4. Một số queue được khai báo ở nhiều service.
Ví dụ:
- `payment.completed.queue` được định nghĩa ở cả payment-service và user-service

Việc này không sai, nhưng cần quản lý version contract cẩn thận.

5. Có queue được bind nhưng chưa thấy consumer rõ ở khảo sát này:
- `job.created.queue`
- `job.updated.queue`
- `job.closed.queue`

Nên xác minh các queue này có thực sự dùng trong runtime hay chỉ là phần mở rộng chưa hoàn tất.

## 9. Đánh giá kiến trúc theo lý thuyết RabbitMQ

Về mặt lý thuyết, SmartCV đang dùng RabbitMQ theo mô hình event-driven integration:
- service phát event khi domain state đổi
- service khác subscribe để xử lý side effect hoặc workflow nền

Mô hình này phù hợp với RabbitMQ vì:
- event volume trung bình
- nhiều tác vụ I/O ngoài như email, AI, payment
- cần tách notification khỏi transaction chính

RabbitMQ trong SmartCV hiện giống:
- broker cho domain events
- task queue cho AI workload nền
- integration bus cho notification và payment activation

Không thấy hệ thống dùng RabbitMQ cho:
- stream analytics
- event sourcing
- replay event
- complex saga orchestration chính thức

Nghĩa là RabbitMQ ở đây đang đóng vai trò practical message bus, không phải event store.

## 10. Đề xuất cải thiện

### 10.1. Chuẩn hóa contract message

Nên có thư mục tài liệu chung mô tả:
- exchange
- queue
- routing key
- payload schema
- producer
- consumer

Hiện có thể suy ra từ code, nhưng chưa có một source-of-truth tập trung.

### 10.2. Bổ sung DLQ cho AI và notification-critical events

Ưu tiên:
- `cv.scoring.queue`
- `candidate.skill.extract.queue`
- `application.submitted.queue`

Lý do:
- AI fail hoặc downstream fail cần trace và replay dễ hơn

### 10.3. Xem xét manual ack cho notification-service

Đặc biệt với các event quan trọng như:
- `payment.completed` nếu một ngày consumer được tách sang notification side effect riêng
- `application.submitted`
- `recruiter.pending`

Nếu tiếp tục dùng `autoAck`, cần chấp nhận rõ ràng semantics best-effort.

### 10.4. Tách command queue và domain event queue rõ hơn

Ví dụ:
- `cv.scoring` thực chất giống command/task hơn là domain event
- `payment.completed` là domain event

Việc phân loại này sẽ giúp thiết kế retry, DLQ và SLA hợp lý hơn.

### 10.5. Quan sát và tracing

Nên log hoặc metric tối thiểu:
- số message publish / consume
- số lỗi deserialize
- số lần retry
- số message vào DLQ
- queue lag / depth

Với AI queue, metric này rất quan trọng để phát hiện backlog.

## 11. Kết luận

RabbitMQ là một thành phần trung tâm trong SmartCV để hiện thực kiến trúc microservice bất đồng bộ.

Vai trò chính của nó trong hệ thống:
- làm message bus cho domain event
- làm task queue cho AI processing
- làm lớp tích hợp cho notification và payment activation

Về mặt thiết kế, hệ thống đang sử dụng RabbitMQ khá đúng mục đích:
- giảm coupling
- tăng khả năng mở rộng
- tránh block request chính bởi các tác vụ nền

Điểm mạnh nổi bật:
- luồng AI và notification được tách hợp lý
- payment flow có DLQ
- event topology theo domain tương đối rõ

Điểm cần cải thiện:
- thống nhất ack/retry semantics
- mở rộng DLQ cho nhiều queue hơn
- chuẩn hóa tài liệu message contract
- tăng observability cho message flow

## 12. Phụ lục: bảng topology tóm tắt

| Exchange | Queue | Routing key | Producer | Consumer |
|---|---|---|---|---|
| `notification.exchange` | `otp.queue` | `otp.routing.key` | user-service | notification-service |
| `candidate.skill.exchange` | `candidate.skill.extract.queue` | `candidate.skill.extract` | user-service | ai_engine_service |
| `job.suggestions.exchange` | `job.suggestions.queue` | `job.suggestions` | ai_engine_service | user-service |
| `cv.scoring.exchange` | `cv.scoring.queue` | `cv.scoring` | application_service | ai_engine_service |
| `application.exchange` | `application.submitted.queue` | `application.submitted` | application_service | notification-service |
| `application.exchange` | `application.accepted.queue` | `application.accepted` | application_service | notification-service |
| `application.exchange` | `application.rejected.queue` | `application.rejected` | application_service | notification-service |
| `application.exchange` | `application.withdrawn.queue` | `application.withdrawn` | application_service | notification-service |
| `assessment.exchange` | `assessment.submitted.queue` | `assessment.submitted` | application_service | notification-service |
| `recruiter.notification.exchange` | `recruiter.pending.queue` | `recruiter.pending` | user-service | notification-service |
| `recruiter.notification.exchange` | `recruiter.approved.queue` | `recruiter.approved` | user-service | notification-service |
| `recruiter.notification.exchange` | `recruiter.rejected.queue` | `recruiter.rejected` | user-service | notification-service |
| `recruiter.notification.exchange` | `recruiter.billing.queue` | `recruiter.billing` | user-service | notification-service |
| `recruiter.notification.exchange` | `package.expired.queue` | `package.expired` | user-service | notification-service |
| `recruiter.notification.exchange` | `package.expiring.soon.queue` | `package.expiring.soon` | user-service | notification-service |
| `recruiter.notification.exchange` | `ai.credit.exhausted.queue` | `ai.credit.exhausted` | user-service | notification-service |
| `job.exchange` | `job.approved.queue` | `job.approved` | job_service | notification-service |
| `job.exchange` | `job.rejected.queue` | `job.rejected` | job_service | notification-service |
| `cv.analysis.exchange` | `cv.analysis.done.queue` | `cv.analysis.done` | user-service | notification-service |
| `payment.exchange` | `payment.completed.queue` | `payment.completed` | payment-service | user-service |
| `payment.dlq.exchange` | `payment.completed.dlq` | `payment.completed.dead` | RabbitMQ dead-letter | operator / future consumer |
