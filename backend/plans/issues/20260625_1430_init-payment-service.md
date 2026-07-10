# Init Payment Service with PayOS Integration

## Overview

Initialize a new standalone `payment-service` (port 8086) using Spring Boot 3.4.4 / Java 21 / Maven — identical stack to `user-service` and `application_service`. The service handles purchasing of service packages (defined in `user-service`) for both RECRUITER and CANDIDATE roles, integrates with the PayOS payment gateway, stores a full transaction history, and publishes async events to activate the purchased package on the user account immediately after successful payment.

## Reproduction steps

N/A — this is a greenfield feature. The current gap is:

1. `user-service` has a `ServicePackage` entity (MongoDB `service_packages`) with price, aiCredits, jobLimit, cvLimit fields — but no `durationDays` field (must be added).
2. No service exists that can create a PayOS payment link for a given package.
3. No service exists to receive PayOS webhook callbacks and act on them.
4. No payment transaction history is stored anywhere.
5. There is no user-to-package activation flow triggered by a payment event.

## Expected behavior

1. An authenticated user (RECRUITER or CANDIDATE) calls `POST /payment/api/orders` with `{ packageId: "@NotBlank" }`. The service fetches the `ServicePackage` from `user-service` via internal HTTP (snapshots name, price, aiCredits, jobLimit, cvLimit, durationDays), creates a `PENDING` order in MongoDB, calls PayOS to generate a payment link, and returns `{ orderId, orderCode, paymentUrl, qrCode }`.
2. **Duplicate-order policy**: Before creating, query for an existing `PENDING` order with the same `userId + packageId`. If one exists and `createdAt > now − 15 minutes` → return it as-is (no new PayOS call). If one exists but `createdAt ≤ now − 15 minutes` (stale link, PayOS default TTL is 30 min) → call `cancelPaymentLink(orderCode)` on PayOS, mark it `CANCELLED`, then create a new order.
3. The user completes payment on the PayOS checkout page.
4. PayOS calls `POST /payment/api/webhook/payos?token=${PAYOS_WEBHOOK_TOKEN}`:
   - **Layer 1 — token check**: compare `token` query param against `payos.webhook-token` config value. Missing or mismatched token → log WARN, return HTTP 200 immediately (do not reveal the check result).
   - **Layer 2 — signature check**: call `PayOS.verifyPaymentWebhookData()`. On invalid signature: log WARN with masked payload, return HTTP 200.
   - Extract `orderCode`. If order not found or already `PAID`: log WARN, return 200 (idempotent).
   - If PayOS `code == "00"` (success): transition order to `PAID`, set `paidAt = now`, publish `payment.completed` event to RabbitMQ, return 200.
   - If PayOS sends a non-success code (payment failed/cancelled by user): transition order to `FAILED`, return 200.
   - On DB or MQ write failure (transient): return HTTP 500 so PayOS retries.
5. `user-service` consumes the `payment.completed` event and activates the package on the user's account immediately (see user-service changes section). Consumer exceptions are caught-and-logged (message acknowledged and dropped to DLQ, not infinitely redelivered).
6. A user can cancel a pending order via `POST /payment/api/orders/{orderId}/cancel`:
   - 404 + `PAYMENT_ORDER_NOT_FOUND` if orderId does not exist.
   - 403 + `FORBIDDEN` if the order belongs to a different userId.
   - 400 + `PAYMENT_ORDER_NOT_CANCELLABLE` if order status ≠ `PENDING`.
   - Call `cancelPaymentLink(orderCode)` from PayOS SDK. If PayOS SDK throws (network error or already expired on PayOS side): log WARN but still mark order `CANCELLED` locally (best-effort cancel — the link is effectively dead anyway).
7. A user retrieves their order history via `GET /payment/api/orders?page=0&size=10` returning `ApiResponse<PageResponse<OrderResponse>>` (same `PageResponse` wrapper as user-service).

## Current behavior

None of the above exists. Purchasing a service package has no supported flow.

## Impact scope

Backend:
- [x] api-gateway — add `/payment/**` route + public-routes entry for webhook + `PAYMENT_SERVICE_URI` env var
- [x] user-service — (1) add `durationDays` to `ServicePackage` + Mongock changeset; (2) add `activePackageId`, `packageActivatedAt`, `packageExpiresAt` to `Recruiter` + `Candidate` + Mongock changeset; (3) expose `GET /user/internal/packages/{packageId}`; (4) add `payment.completed` RabbitMQ consumer; (5) register `JavaTimeModule` in Jackson config if not present
- [x] payment-service — **new service to create**
- [ ] application_service
- [ ] ai_engine_service
- [ ] notification-service — optionally consume `payment.completed` for confirmation email (separate issue)
- [x] Infrastructure — add `payment-service` to `docker-compose.yaml`; add the following to `.env.example`:
  ```
  PAYMENT_SERVICE_PORT=8086
  PAYMENT_SERVICE_URI=http://payment-service:8086
  PAYOS_CLIENT_ID=
  PAYOS_API_KEY=
  PAYOS_CHECKSUM_KEY=
  PAYMENT_RETURN_URL=http://localhost:3000/payment/success
  PAYMENT_CANCEL_URL=http://localhost:3000/payment/cancel
  USER_SERVICE_URL=http://localhost:8081/user
  PAYOS_WEBHOOK_TOKEN=
  ```

Frontend:
- [ ] web-candidate — payment flow UI (separate issue)
- [ ] web-recruiter — payment flow UI (separate issue)
- [ ] web-admin
- [ ] packages/ui
- [ ] packages/api
- [ ] packages/i18n

## Service specification

### Stack
| Property | Value |
|---|---|
| Language | Java 21 |
| Framework | Spring Boot 3.4.4 |
| Build | Maven (spring-boot-starter-parent 3.4.4) |
| GroupId | vn.chuongpl |
| ArtifactId | payment-service |
| Port | 8086 |
| Context path | /payment |
| Database | MongoDB (`smartcv_payment`) |
| Messaging | RabbitMQ (Spring AMQP) |
| PayOS SDK | `vn.payos:payos-java` (latest stable) |

### Dependencies (pom.xml)
- `spring-boot-starter-web`
- `spring-boot-starter-data-mongodb`
- `spring-boot-starter-security`
- `spring-boot-starter-amqp`
- `spring-boot-starter-validation`
- `spring-boot-starter-actuator`
- `spring-boot-devtools` (runtime/optional)
- `spring-boot-starter-test` (test)
- `org.mapstruct:mapstruct:1.5.5.Final`
- `org.projectlombok:lombok`
- `io.github.cdimascio:dotenv-java:3.0.0`
- `org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.3`
- `vn.payos:payos-java` (latest stable)
- `com.fasterxml.jackson.datatype:jackson-datatype-jsr310`

### Package structure
```
payment-service/src/main/java/vn/chuongpl/payment_service/
  PaymentServiceApplication.java
  features/
    order/
      PaymentOrder.java
      PaymentOrderRepository.java
      PaymentOrderService.java
      PaymentOrderController.java
      PaymentOrderMapper.java
    webhook/
      PayOSWebhookController.java
      PayOSWebhookService.java
  dtos/
    ApiResponse.java                  # same pattern as other services
    PageResponse.java                 # same pattern as other services
    request/
      CreateOrderRequest.java
    response/
      OrderResponse.java
      CreateOrderResponse.java
  enums/
    OrderStatus.java                  # PENDING | PAID | FAILED | CANCELLED
    ErrorCode.java
  exception/
    AppException.java
    GlobalExceptionHandler.java
  config/
    SecurityConfig.java
    InternalAuthFilter.java
    RabbitMQConfig.java
    PayOSConfig.java
    JacksonConfig.java
    OpenApiConfig.java
```

### application.yaml structure
```yaml
server:
  port: ${PAYMENT_SERVICE_PORT:8086}
  servlet:
    context-path: /payment

spring:
  autoconfigure:
    exclude:
      - org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration
  config:
    import: optional:file:../.env[.properties]
  application:
    name: payment-service
  data:
    mongodb:
      uri: mongodb://${MONGO_DB_USERNAME}:${MONGO_DB_PASSWORD}@${MONGO_DB_HOST:localhost}:${MONGO_DB_PORT:27017}/smartcv_payment?authSource=admin
      auto-index-creation: true
  rabbitmq:
    host: ${RABBITMQ_HOST:localhost}
    port: ${RABBITMQ_PORT:5672}
    username: ${RABBITMQ_USER:admin}
    password: ${RABBITMQ_PASSWORD:admin123}
  main:
    banner-mode: "off"
    log-startup-info: false
  output:
    ansi:
      enabled: ALWAYS

management:
  endpoints:
    web:
      exposure:
        include: health
  endpoint:
    health:
      show-details: never

app:
  gateway:
    internal-secret: ${GATEWAY_INTERNAL_SECRET:changeme}

integration:
  user-service-url: ${USER_SERVICE_URL:http://localhost:8081/user}

payos:
  client-id: ${PAYOS_CLIENT_ID}
  api-key: ${PAYOS_API_KEY}
  checksum-key: ${PAYOS_CHECKSUM_KEY}
  webhook-token: ${PAYOS_WEBHOOK_TOKEN}
  return-url: ${PAYMENT_RETURN_URL:http://localhost:3000/payment/success}
  cancel-url: ${PAYMENT_CANCEL_URL:http://localhost:3000/payment/cancel}

springdoc:
  api-docs:
    path: /v3/api-docs
  swagger-ui:
    path: /swagger-ui.html

logging:
  level:
    root: WARN
    org.springframework: WARN
    "vn.chuongpl.payment_service": INFO
  pattern:
    console: "%d{HH:mm:ss.SSS} %-5level %msg%n"
```

### MongoDB document — `payment_orders`
```
{
  _id:                  String (UUID v4)
  orderCode:            Long              @Indexed(unique = true)
  userId:               String            @Indexed
  userRole:             String            "RECRUITER" | "CANDIDATE"
  packageId:            String
  packageName:          String            snapshot at order creation
  packageAiCredits:     Integer           snapshot
  packageJobLimit:      Integer           snapshot
  packageCvLimit:       Integer           snapshot
  packageDurationDays:  Integer           snapshot, null = no expiry
  amount:               Long              VND
  status:               OrderStatus       @Indexed
  paymentUrl:           String
  qrCode:               String
  createdAt:            LocalDateTime
  updatedAt:            LocalDateTime
  paidAt:               LocalDateTime     null until PAID
}
```

**Indexes:**
- `orderCode` — unique index (declared via `@Indexed(unique = true)`)
- `{ userId, packageId, status }` — compound index for duplicate-order check (declared programmatically via `@CompoundIndex(def = "{'userId': 1, 'packageId': 1, 'status': 1}")` on the document class)
- `{ userId, status }` — compound index for listing user's orders by status

### orderCode generation strategy
```java
long orderCode = (System.currentTimeMillis() % 1_000_000_000_000L) * 1000
               + ThreadLocalRandom.current().nextInt(1000);
```
`orderCode` has `@Indexed(unique = true)`. On `DuplicateKeyException` during `save()`, retry up to 3 times before throwing `PAYMENT_ORDER_CREATION_FAILED`. This is safe for MVP traffic; revisit with an atomic MongoDB sequence counter if volume exceeds ~1000 concurrent orders/sec.

### Request / Response DTOs

**CreateOrderRequest**
```java
@NotBlank
String packageId;
```

**CreateOrderResponse** (returned from `POST /payment/api/orders`)
```json
{
  "orderId": "string",
  "orderCode": 1234567890,
  "paymentUrl": "https://pay.payos.vn/...",
  "qrCode": "data:image/png;base64,..."
}
```

**OrderResponse** (returned from GET endpoints)
```json
{
  "orderId": "string",
  "orderCode": 1234567890,
  "userRole": "RECRUITER",
  "packageId": "string",
  "packageName": "string",
  "packageAiCredits": 10,
  "packageJobLimit": 5,
  "packageCvLimit": -1,
  "packageDurationDays": 30,
  "amount": 99000,
  "status": "PENDING",
  "paymentUrl": "string",
  "qrCode": "string",
  "createdAt": "2026-06-25T14:30:00",
  "updatedAt": "2026-06-25T14:30:00",
  "paidAt": null
}
```

**GET /payment/api/orders** response:
```json
{
  "message": "...",
  "data": {
    "content": [ /* OrderResponse[] */ ],
    "page": 0,
    "size": 10,
    "totalElements": 25,
    "totalPages": 3
  }
}
```
Use the same `PageResponse<T>` wrapper as `user-service`.

### REST API
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /payment/api/orders | RECRUITER or CANDIDATE | Create order (or return existing PENDING); returns `CreateOrderResponse` |
| GET | /payment/api/orders | RECRUITER or CANDIDATE | List own orders, paginated (`page`/`size` params) |
| GET | /payment/api/orders/{orderId} | RECRUITER or CANDIDATE | Get single order by internal id |
| POST | /payment/api/orders/{orderId}/cancel | RECRUITER or CANDIDATE | Cancel PENDING order |
| POST | /payment/api/webhook/payos?token={token} | Public (token-guarded) | PayOS payment result webhook |

### Authentication (InternalAuthFilter)
Follows `application_service` exactly:
1. Override `shouldNotFilter(HttpServletRequest request)` to return `true` when `request.getRequestURI().equals("/payment/api/webhook/payos")` (full URI including context path). This bypasses the filter entirely for the PayOS callback.
2. For all other requests: check `X-Gateway-Secret` header against `app.gateway.internal-secret`; reject with 401 if missing or wrong.
3. Read `X-User-Id` and `X-User-Scope` (gateway does **not** forward `X-User-Email`).
4. Populate `SecurityContext` with a `UsernamePasswordAuthenticationToken`.

`SecurityConfig`: mark `/api/webhook/payos` as `permitAll()`; all other `/api/**` routes require authentication.

### Jackson configuration (JacksonConfig)
Register `JavaTimeModule` with `WRITE_DATES_AS_TIMESTAMPS = false` on the primary `ObjectMapper` bean. The `Jackson2JsonMessageConverter` in `RabbitMQConfig` must use this same `ObjectMapper`. This produces ISO-8601 strings like `"2026-06-25T14:30:00"` (no timezone offset, matching `LocalDateTime`).

**user-service** must also add a `JacksonConfig` bean with the same setup if not already present. Check `user-service/src/main/java/.../configuration/` — if no `JacksonConfig.java` exists, create one. The existing `Jackson2JsonMessageConverter` bean in `user-service/RabbitMQConfig` must be updated to use this configured `ObjectMapper`.

### PayOS webhook handling
The webhook URL registered in PayOS dashboard must include the token:
`https://<host>/payment/api/webhook/payos?token=${PAYOS_WEBHOOK_TOKEN}`

```
POST /payment/api/webhook/payos?token={token}  (public, skipped by InternalAuthFilter)

1. Token check: compare @RequestParam("token") against @Value("${payos.webhook-token}")
   → Mismatch or blank: log WARN "PayOS webhook invalid token", return HTTP 200

2. Call PayOS.verifyPaymentWebhookData(webhookBody) — throws on invalid signature
   → On exception: log WARN "PayOS webhook signature invalid", return HTTP 200
2. Extract orderCode and payOS result code from verified payload
3. Fetch order by orderCode
   → Not found: log WARN, return 200
   → Already PAID or FAILED or CANCELLED: return 200 (idempotent)
4a. If payOS code == "00" (success):
    - Set status = PAID, paidAt = now, updatedAt = now; save
    - Publish payment.completed event
    - Return 200
    → On DB/MQ failure: return 500 (PayOS retries)
4b. If payOS code != "00" (failure):
    - Set status = FAILED, updatedAt = now; save
    - Return 200
```

### RabbitMQ configuration (payment-service `RabbitMQConfig`)

```java
// Constants
PAYMENT_EXCHANGE            = "payment.exchange"
PAYMENT_COMPLETED_QUEUE     = "payment.completed.queue"
PAYMENT_COMPLETED_KEY       = "payment.completed"
PAYMENT_DLQ_EXCHANGE        = "payment.dlq.exchange"
PAYMENT_DLQ_QUEUE           = "payment.completed.dlq"
PAYMENT_DLQ_ROUTING_KEY     = "payment.completed.dead"

// Beans to declare
DirectExchange("payment.exchange")
DirectExchange("payment.dlq.exchange")

// Main queue with DLQ args
Queue paymentCompletedQueue = QueueBuilder.durable(PAYMENT_COMPLETED_QUEUE)
    .withArgument("x-dead-letter-exchange", PAYMENT_DLQ_EXCHANGE)
    .withArgument("x-dead-letter-routing-key", PAYMENT_DLQ_ROUTING_KEY)
    .build();

Queue paymentDlq = new Queue(PAYMENT_DLQ_QUEUE, true);

Binding (paymentCompletedQueue → payment.exchange, key: payment.completed)
Binding (paymentDlq → payment.dlq.exchange, key: payment.completed.dead)

MessageConverter  → Jackson2JsonMessageConverter(objectMapper)  // use JacksonConfig ObjectMapper
AmqpTemplate      → same pattern as user-service RabbitMQConfig
```

**Retry policy**: configure `SimpleRetryPolicy(3)` on the `SimpleRabbitListenerContainerFactory` (if not already globally configured). After 3 failed attempts the message is nacked and routed to `payment.dlq.exchange` → `payment.completed.dlq` by the broker.

**user-service** adds the same exchange/queue/binding declarations to its `RabbitMQConfig` (idempotent — Spring AMQP will not re-create existing resources). The `@RabbitListener` consumer catches all exceptions internally and logs them (does not rethrow) to avoid infinite redelivery:

```java
@RabbitListener(queues = "payment.completed.queue")
public void handlePaymentCompleted(PaymentCompletedEvent event) {
    try {
        // compute packageExpiresAt = event.paidAt + event.packageDurationDays days (or null)
        // if event.userRole == "RECRUITER" → update Recruiter document by userId
        // if event.userRole == "CANDIDATE" → update Candidate document by userId
        // overwrite activePackageId, packageActivatedAt, packageExpiresAt
        // if userId not found → log WARN and return (drop silently)
    } catch (Exception e) {
        log.error("Failed to activate package for userId={}: {}", event.getUserId(), e.getMessage());
        // do NOT rethrow — message is acknowledged and dropped to DLQ via broker policy
    }
}
```

### payment.completed event payload
```json
{
  "userId":              "string",
  "userRole":            "RECRUITER",
  "packageId":           "string",
  "packageName":         "string",
  "packageAiCredits":    10,
  "packageJobLimit":     5,
  "packageCvLimit":      -1,
  "packageDurationDays": 30,
  "orderId":             "string",
  "paidAt":              "2026-06-25T14:30:00"
}
```
`paidAt` serialized as ISO-8601 string (no timezone offset) via JavaTimeModule with `WRITE_DATES_AS_TIMESTAMPS=false`.

### API Gateway changes

Add to `spring.cloud.gateway.routes`:
```yaml
- id: payment-service
  uri: ${PAYMENT_SERVICE_URI:http://localhost:8086}
  predicates:
    - Path=/payment/**
```

Add to `app.public-routes`:
```yaml
- method: POST
  path: /payment/api/webhook/payos
```

### user-service changes

**1. Add `durationDays` to `ServicePackage` entity:**
```java
@Field(name = "duration_days")
Integer durationDays;   // null = no expiry
```
Add Mongock changeset (use next sequence number after the highest existing file in `changelog/`, e.g., `V1_007__Add_duration_days_to_service_packages.java`). The changeset sets `durationDays = null` on all existing documents (forward-compatible no-op).

**2. Add activation fields to `Recruiter` and `Candidate` documents:**
```java
@Field(name = "active_package_id")     String activePackageId;      // null if no active package
@Field(name = "package_activated_at")  LocalDateTime packageActivatedAt;
@Field(name = "package_expires_at")    LocalDateTime packageExpiresAt;  // null = no expiry
```
Add a second Mongock changeset (next sequence, e.g., `V1_008__Add_package_activation_fields.java`) that no-ops on existing documents.

**3. Internal endpoint:**
```
GET /user/internal/packages/{packageId}
Auth: X-Gateway-Secret only (no user context)
Response 200: ServicePackageResponse (existing DTO)
Response 404: ApiResponse with ErrorCode.SERVICE_PACKAGE_NOT_FOUND
```
Secured via `InternalAuthFilter` — the gateway forwards the secret on all routed requests, including those from `payment-service`. Accessible at path `/user/internal/packages/{packageId}` (within user-service context path `/user`).

### Docker Compose addition
```yaml
payment-service:
  build: ./payment-service
  container_name: smartCv-payment-service
  restart: unless-stopped
  ports:
    - "${PAYMENT_SERVICE_PORT:-8086}:8086"
  environment:
    - MONGO_DB_HOST=mongodb
    - MONGO_DB_PORT=27017
    - MONGO_DB_USERNAME=${MONGO_DB_USERNAME}
    - MONGO_DB_PASSWORD=${MONGO_DB_PASSWORD}
    - RABBITMQ_HOST=rabbitmq
    - RABBITMQ_PORT=5672
    - RABBITMQ_USER=${RABBITMQ_USER}
    - RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}
    - GATEWAY_INTERNAL_SECRET=${GATEWAY_INTERNAL_SECRET}
    - USER_SERVICE_URL=http://user-service:8081/user
    - PAYOS_CLIENT_ID=${PAYOS_CLIENT_ID}
    - PAYOS_API_KEY=${PAYOS_API_KEY}
    - PAYOS_CHECKSUM_KEY=${PAYOS_CHECKSUM_KEY}
    - PAYOS_WEBHOOK_TOKEN=${PAYOS_WEBHOOK_TOKEN}
    - PAYMENT_RETURN_URL=${PAYMENT_RETURN_URL}
    - PAYMENT_CANCEL_URL=${PAYMENT_CANCEL_URL}
    - PAYMENT_SERVICE_PORT=8086
  depends_on:
    mongodb:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
  networks:
    - smartCv-net
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8086/payment/actuator/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

### CI/CD

Create a new file `.github/workflows/payment-ci.yml` following the pattern of `user-ci.yml` (or the equivalent existing CI workflow name):
- Trigger: push/PR to `dev` branch with `paths: ['backend/payment-service/**']`
- Steps: checkout → Java 21 setup → `./mvnw test` (from `backend/payment-service/`)

## Related code

- `backend/user-service/src/main/java/vn/chuongpl/user_service/features/servicepackage/ServicePackage.java` — entity being purchased; `price` (Long, VND); needs `durationDays` added
- `backend/user-service/src/main/java/vn/chuongpl/user_service/configuration/RabbitMQConfig.java` — pattern for exchange/queue/binding/MessageConverter beans
- `backend/user-service/src/main/java/vn/chuongpl/user_service/configuration/changelog/` — Mongock changeset pattern; find highest `V1_00N__` number to determine next sequence
- `backend/application_service/src/main/java/vn/chuongpl/application_service/` — reference for InternalAuthFilter (X-Gateway-Secret + shouldNotFilter), SecurityConfig, package layout
- `backend/api-gateway/src/main/resources/application.yaml` — where new route and public-route entry go
- `backend/user-service/src/main/java/vn/chuongpl/user_service/dtos/PageResponse.java` — reuse this pattern in payment-service

## Notes

- `ServicePackage.price` is Long (VND integer). PayOS `amount` is also VND integer — no conversion needed.
- `shouldNotFilter()` must match the full request URI `/payment/api/webhook/payos` (includes context path prefix `/payment`).
- `LocalDateTime` is consistent with the rest of the monorepo. All services run with JVM timezone = UTC in Docker. Do not change this.
- Frontend payment UI (checkout page, order history page) is a separate issue.
- Notification email on payment success can be added later by having `notification-service` consume `payment.completed` from `payment.completed.queue`.
