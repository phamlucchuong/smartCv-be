# Recruiter & Job Approval Notifications — Email + System Notification

## Overview

When an admin approves or rejects a recruiter account, or approves/rejects a job posting, the affected recruiter must be notified immediately through two channels: a transactional **email** and a **persistent system notification** that appears in the in-app bell popover. Currently, both admin actions (`RecruiterService.updateStatus`, `JobService.approveJob` / `rejectJob`) are silent — they change the status and return without publishing any event or sending any notification.

A secondary question is whether an **audit log** should capture these actions. The codebase has no audit log at all. This issue covers notifications first; audit log is explicitly called out as optional/out-of-scope below.

---

## Current behavior

| Action | Event published? | Email sent? | System notification created? |
|---|---|---|---|
| Recruiter approved | ❌ None | ❌ No | ❌ No |
| Recruiter rejected | ❌ None | ❌ No | ❌ No |
| Job approved | ⚠️ `job.created` (for Elasticsearch indexing only) | ❌ No | ❌ No |
| Job rejected | ❌ None | ❌ No | ❌ No |

The notification-service already has a complete persistent notification system (`CreateNotification`, `MarkAsRead`, FCM push, Firestore realtime signals). It is not wired to recruiter or job moderation events.

---

## Expected behavior

1. **Recruiter approved**: recruiter receives an email ("Your account has been approved — you can now post jobs") AND a system notification in the bell popover.
2. **Recruiter rejected**: recruiter receives an email with the rejection note AND a system notification.
3. **Job approved**: recruiter who posted the job receives an email ("Your job '<title>' has been published") AND a system notification.
4. **Job rejected**: recruiter receives an email with the rejection note AND a system notification.
5. Each system notification is persisted to the notification DB and appears in the `NotificationPopover` that is already wired into `web-recruiter`.

---

## Audit log

The codebase has **no audit log**. Persistent system notifications stored in the notification-service DB serve as a partial audit trail for these approval events. A dedicated audit log (recording actor, action, target, timestamp for all admin operations) is **out of scope** for this issue — file a separate issue if needed.

---

## Reproduction steps

1. Admin navigates to `/admin/employer-verification` and approves or rejects a recruiter.
2. Admin navigates to `/admin/job-moderation` and approves or rejects a job posting.
3. Observe: the recruiter's email inbox receives nothing; the bell popover shows no notification.

---

## Impact scope

Backend:
- [x] user-service — `RecruiterService.updateStatus` + `RabbitMQConfig`
- [x] job_service — `JobService.approveJob` / `rejectJob` + `RabbitMQConfig`
- [x] notification-service — new consumer, new email methods, new `Service` handlers
- [ ] api-gateway — no change
- [ ] application_service — no change
- [ ] ai_engine_service — no change

Frontend:
- [ ] web-candidate — no change (already has NotificationPopover wired)
- [x] web-recruiter — wire `useNotificationsStore` to real API; FCM subscribe audience update
- [ ] web-admin — no change
- [ ] packages/ui — no change
- [ ] packages/api — no change
- [ ] packages/i18n — no change

---

## Related code

### user-service

| File | Relevant line(s) |
|---|---|
| `features/recruiter/RecruiterService.java:193` | `updateStatus` — both recruiter and user (with email) are already in scope here; perfect place to publish |
| `configuration/RabbitMQConfig.java` | Only defines `notification.exchange/otp.queue`, `candidate.skill.exchange`, `job.suggestions.exchange` — no recruiter exchange |
| `features/recruiter/Recruiter.java:89` | `@Field("contact_email") contactEmail` — recruiter has direct contact email; `User.email` is the account email |

### job_service

| File | Relevant line(s) |
|---|---|
| `features/job/JobService.java:200` | `approveJob` — publishes `JOB_CREATED_ROUTING_KEY` (Elasticsearch), no approval event |
| `features/job/JobService.java:226` | `rejectJob` — publishes nothing |
| `features/job/JobEventMessage.java` | Fields: `jobId`, `recruiterId`, `title`, `company`, `eventType`, `occurredAt` — **no recruiter email** |
| `config/RabbitMQConfig.java` | Exchanges: `job.exchange`; queues: `job.created`, `job.updated`, `job.closed` — no `job.approved`, `job.rejected` |
| `integration/userservice/UserServiceClient.java` | Already exists; call `getRecruiterStatus(recruiterId)` — extend to `getRecruiterEmail(recruiterId)` to avoid denormalizing email into the job document |

### notification-service

| File | Relevant line(s) |
|---|---|
| `internal/notification/consumer.go:42` | `Listen()` — only `otp.queue`; `ListenApplicationEvents()` — only `application.exchange` |
| `internal/notification/service.go:122` | `CreateNotification` — fully implemented, ready to call |
| `internal/notification/service.go:308` | `sendWebpushToUser` — sends FCM; audience hardcoded as `"web-user"` for subscriber; needs `"web-recruiter"` audience for recruiter tokens |
| `internal/notification/service.go:228` | `SubscribeFCMToken` — hardcodes `"web-user"` audience; needs to accept audience from caller |
| `internal/email/service.go` | Only `SendOTP` and `SendApplicationResult` — no recruiter/job templates |

---

## Implementation plan

### Step 0 — notification-service: fix UUID mismatch (prerequisite)

**Problem**: `Notification.UserID` is `uuid.UUID` with `gorm:"type:uuid"`, and `FCMToken.UserID` is `string` but also `gorm:"type:uuid"` — both columns are `uuid` type in PostgreSQL. MongoDB user IDs from user-service are ObjectId strings (24-char hex, e.g., `"507f1f77bcf86cd799439011"`) — not valid UUIDs. The following locations all fail silently for real users:

| File | Line | Problem |
|---|---|---|
| `service.go` | 123 | `CreateNotification` — `uuid.Parse(receiverID)` returns error |
| `service.go` | 149 | `GetNotificationsHistory` — `uuid.Parse(userID)` returns error |
| `service.go` | 181 | `MarkAsReadForUser` — `uuid.Parse(userID)` returns error |
| `model.go` | 12 | `Notification.UserID uuid.UUID` — `uuid` PostgreSQL column |
| `model.go` | 31 | `FCMToken.UserID string` with `gorm:"type:uuid"` — `uuid` PostgreSQL column |

This is a pre-existing bug: `CreateNotification` has never been called from any consumer (the existing `handleApplicationEvent` only sends email). The frontend notification stores use hardcoded seed data. Neither path has been tested against real user IDs.

**Fix 1 — `internal/notification/model.go`**: Change `Notification.UserID` from `uuid.UUID` to `string` and change both column types to `text`:
```go
// Notification
UserID string `gorm:"column:user_id;type:text;not null;index:idx_notifications_user_role"`

// FCMToken (Go type already string; only GORM tag changes)
UserID string `gorm:"type:text;not null;index:idx_notification_fcm_tokens_user_id_audience;..."`
```

**Fix 2 — `internal/notification/repository.go`**: Update the `Repository` interface — all methods that accept `uuid.UUID` for user/receiver ID must change to `string`:
```go
GetNotifications(ctx context.Context, receiverID string, receiverType string, limit, offset int) ([]Notification, int64, error)
MarkAsReadForUser(ctx context.Context, id uuid.UUID, userID string) error   // id stays uuid (notification ID)
MarkAllAsRead(ctx context.Context, receiverID string, receiverType string) error
GetUnreadCount(ctx context.Context, receiverID string, receiverType string) (int64, error)
```
Update the `repository` struct implementations to match. `GetFCMTokensByUserIDAndAudience` already uses `string` — no change there.

**Fix 3 — `internal/notification/service.go`**: Remove `uuid.Parse` calls for user/receiver IDs:
```go
// CreateNotification — before
rid, err := uuid.Parse(receiverID)
if err != nil { return err }
n := Notification{ ID: uuid.New(), UserID: rid, ... }
// after
n := Notification{ ID: uuid.New(), UserID: receiverID, ... }
```
Apply the same removal to `GetNotificationsHistory` (line 149) and `MarkAsReadForUser` (line 181). Notification `ID` stays as `uuid.UUID` (generated by the service, not user-supplied).

**Fix 4 — Database migration**: The service uses **golang-migrate** (not GORM AutoMigrate) — schema changes require a new SQL migration file. The existing convention is `V{number}-{name}.{up|down}.sql` (e.g., `V001-create-notifications-table.up.sql`). Add `migrations/V002-user-id-to-text.up.sql`:
```sql
ALTER TABLE notifications ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE notification_fcm_tokens ALTER COLUMN user_id TYPE text USING user_id::text;
```
And `migrations/V002-user-id-to-text.down.sql`:
```sql
ALTER TABLE notifications ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE notification_fcm_tokens ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
```

---

### Step 1 — user-service: publish recruiter approval events

**`RabbitMQConfig.java`** — add:
```java
public static final String RECRUITER_EXCHANGE = "recruiter.notification.exchange";
public static final String RECRUITER_APPROVED_QUEUE = "recruiter.approved.queue";
public static final String RECRUITER_REJECTED_QUEUE = "recruiter.rejected.queue";
public static final String RECRUITER_APPROVED_KEY = "recruiter.approved";
public static final String RECRUITER_REJECTED_KEY = "recruiter.rejected";
```

**New DTO** `dtos/event/RecruiterStatusEventMessage.java`:
```java
String recruiterId;
String recruiterEmail;    // User.email (account login email)
String contactEmail;      // Recruiter.contactEmail (optional, prefer recruiterEmail)
String companyName;
RecruiterStatus status;   // APPROVED | REJECTED
String rejectionNote;     // nullable
LocalDateTime occurredAt;
```

**`RecruiterService.java:updateStatus`** — after saving, build and publish the event:
```java
// inject RabbitTemplate via @RequiredArgsConstructor
rabbitTemplate.convertAndSend(
    RabbitMQConfig.RECRUITER_EXCHANGE,
    status == APPROVED ? RabbitMQConfig.RECRUITER_APPROVED_KEY : RabbitMQConfig.RECRUITER_REJECTED_KEY,
    RecruiterStatusEventMessage.builder()
        .recruiterId(recruiter.getId())
        .recruiterEmail(user.getEmail())
        .contactEmail(recruiter.getContactEmail())
        .companyName(recruiter.getCompanyName())
        .status(request.getStatus())
        .rejectionNote(recruiter.getRejectionNote())
        .occurredAt(LocalDateTime.now())
        .build()
);
```

### Step 2 — job_service: publish job moderation events

**`RabbitMQConfig.java`** — add:
```java
public static final String JOB_APPROVED_QUEUE = "job.approved.queue";
public static final String JOB_REJECTED_QUEUE = "job.rejected.queue";
public static final String JOB_APPROVED_KEY = "job.approved";
public static final String JOB_REJECTED_KEY = "job.rejected";
```

**`UserServiceClient.java`** — add method using the **exact same RestTemplate + `X-Gateway-Secret` pattern** as `getRecruiterStatus`. The existing endpoint `GET /user/api/internal/recruiters/by-user/{userId}` already returns the full `RecruiterResponse` including `email` — no new user-service endpoint needed. Note: `Job.recruiterId` stores the user's MongoDB ID (same value passed to `getRecruiterStatus`):
```java
public String getRecruiterEmail(String userId) {
    String url = userServiceUrl + "/user/api/internal/recruiters/by-user/" + userId;
    try {
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.set("X-Gateway-Secret", internalSecret);
        org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);
        ResponseEntity<Map> response = restTemplate.exchange(
            url, org.springframework.http.HttpMethod.GET, entity, Map.class);
        if (response.getBody() != null) {
            Object data = response.getBody().get("data");
            if (data instanceof Map<?, ?> dataMap) {
                Object email = dataMap.get("email");
                return email != null ? email.toString() : null;
            }
        }
    } catch (Exception e) {
        log.warn("Failed to fetch recruiter email for userId={}: {}", userId, e.getMessage());
    }
    return null;
}
```

**`JobService.java:approveJob`** — after saving:
```java
publishModerationEvent(saved, "APPROVED", RabbitMQConfig.JOB_APPROVED_KEY, null, recruiterEmail);
```

**`JobService.java:rejectJob`** — after saving:
```java
publishModerationEvent(saved, "REJECTED", RabbitMQConfig.JOB_REJECTED_KEY, request.note(), recruiterEmail);
```

New `publishModerationEvent` builds a richer `JobEventMessage` (add `recruiterEmail` and `moderationNote` fields).

### Step 3 — notification-service: consumers + email + DB notification

**New consumer methods** in `consumer.go`:

```go
func (c *Consumer) ListenRecruiterEvents() error { ... }  // recruiter.approved.queue + recruiter.rejected.queue
func (c *Consumer) ListenJobModerationEvents() error { ... } // job.approved.queue + job.rejected.queue
```

**New email methods** in `email.Service` interface:
```go
SendRecruiterApprovalEmail(ctx, to, companyName string) error
SendRecruiterRejectionEmail(ctx, to, companyName, rejectionNote string) error
SendJobApprovalEmail(ctx, to, jobTitle, company string) error
SendJobRejectionEmail(ctx, to, jobTitle, moderationNote string) error
```

**New service handlers** (follow `NotifyNewOrder` pattern — persist + Firestore signal + FCM push):
```go
func (s *Service) HandleRecruiterApproved(ctx, recruiterId, recruiterEmail, companyName string) error
func (s *Service) HandleRecruiterRejected(ctx, recruiterId, recruiterEmail, companyName, rejectionNote string) error
func (s *Service) HandleJobApproved(ctx, recruiterId, recruiterEmail, jobTitle, company string) error
func (s *Service) HandleJobRejected(ctx, recruiterId, recruiterEmail, jobTitle, moderationNote string) error
```

Each handler:
1. Calls `s.emailService.Send*Email(...)` — sends transactional email
2. Calls `s.CreateNotification(ctx, recruiterId, "RECRUITER", title, body, type, data)` — persists to DB
3. Calls `s.sendWebpushToUser(ctx, recruiterId, url, data, "web-recruiter")` — FCM push (if configured)
4. Calls `s.updateFirestoreSignal(recruiterId, signalType, data)` — realtime Firestore signal

**FCM audience fixes** (all in `service.go`) — three related changes:
1. `audienceForRecipientRole` (line 444): add `case "RECRUITER": return "web-recruiter"`.
2. `isSupportedAudience` (line 455): add `"web-recruiter"` to the allow-list. Currently the function silently returns `false` for unsolicited audiences with no log line — FCM pushes to recruiters will be silently dropped until this is added.
3. `SubscribeFCMToken` (line 228): change signature to `SubscribeFCMToken(ctx, userID, token, audience string)` and pass `audience` through. Update the HTTP handler (`internal/server/routes.go`) to read `Audience` from the `FCMSubscribeRequest` body (add `Audience string` field to `model.go`) or derive it from the JWT `scope` header.

**`handler.go:mapAudienceToRole` fix**: Add `case "web-recruiter": return "RECRUITER"` to `mapAudienceToRole`. Without this, `GET /notification/history` for recruiters queries `recipient_role = 'USER'` (the default fallback) and returns zero results even after notifications are created with `recipient_role = 'RECRUITER'`.

**Email templates**: Four new methods are added to the `EmailService` interface. Every struct that implements this interface (the SMTP provider in `internal/platform/email/email.go`) must also implement the new methods with real HTML/text templates — otherwise the service will not compile. Add the templates following the `SendApplicationResult` pattern.

### Step 4 — Wire consumers in `main.go`

```go
go consumer.ListenRecruiterEvents()
go consumer.ListenJobModerationEvents()
```

### Step 5 — web-recruiter: wire notification store to real API

`apps/web-recruiter/src/store/useNotificationsStore.ts` currently uses hardcoded seed data. Replace with a call to `GET /notification/api/notifications` using the generated hook (or a custom hook). Without this, recruiter notifications appear in the DB and via FCM but never in the bell popover via polling.

Minimum change: replace the initial seed items with a TanStack Query call to the notification history endpoint, using the pattern already in place in `web-candidate` (if wired there) or following the hook pattern in `@smart-cv/api`.

---

## Notes

- The notification-service `notification.exchange` is declared by the user-service (Spring). The new `recruiter.notification.exchange` should follow the same pattern: declare in user-service's `RabbitMQConfig.java` and re-declare (idempotent) in the notification-service Go consumer's new `Listen*` method.
- The existing `job.exchange` in job_service is a `DirectExchange`. The new `job.approved.queue` and `job.rejected.queue` bind to it using new routing keys — no new exchange needed.
- `CreateNotification` and `sendWebpushToUser` call paths are now sequenced correctly: `HandleRecruiter*` and `HandleJob*` methods persist, push FCM, then sync Firestore — consistent with the `NotifyNewOrder` pattern.
- No frontend changes required beyond wiring the notification store to the real API. `NotificationPopover` is already wired in `web-recruiter/src/components/layouts/DashboardLayout.tsx` and polls `GET /api/notification/history` — once the store is wired to the real endpoint instead of seed data, recruiter notifications will appear automatically.
