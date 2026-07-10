# FCM Push Notifications — New Applicant, Recruiter Request, and Click-Through Navigation

## Overview

Three notification flows are missing or incomplete:

1. **Recruiter is never notified when a candidate submits a new application.** `ApplicationService.submit()` calls only the AI scoring publisher — no event is published to the notification exchange.
2. **Admins are never notified when a recruiter submits their profile for approval.** `RecruiterService.submitForApproval()` transitions status to PENDING and saves, but publishes nothing.
3. **Clicking a notification in the bell popover or the full notifications page never navigates to the relevant resource.** The backend stores `data` (jsonb), but the `url` key is absent from most data maps; `NotificationApiItem` in `@smart-cv/api` does not expose the `data` field; and `NotificationPopover` in `@smart-cv/ui` has no click-navigation callback.

The fourth flow — **candidate notified when application status changes** — is already fully implemented (email + FCM + DB record) for ACCEPTED, REJECTED, and WITHDRAWN statuses. This issue does not modify that flow except to add the missing `url` key to its data payload.

---

## Current behavior

| Trigger | Who should be notified | Email | FCM push | DB record | Click navigates |
|---|---|---|---|---|---|
| Candidate submits application | Recruiter | ❌ | ❌ | ❌ | N/A |
| Recruiter submits for approval | All admins | ❌ | ❌ | ❌ | N/A |
| Application status → ACCEPTED / REJECTED / WITHDRAWN | Candidate | ✅ | ✅ | ✅ | ❌ (url key missing) |
| Recruiter account approved / rejected | Recruiter | ✅ | ✅ | ✅ | ❌ (url key missing) |
| Job approved / rejected | Recruiter | ✅ | ✅ | ✅ | ❌ (url key missing) |

---

## Expected behavior

1. **New applicant → recruiter**: immediately after `ApplicationService.submit()` saves, the recruiter receives an FCM push ("New application for {jobTitle}") and a persistent DB notification with `data.url = "/employer/applicants/{applicationId}"`.
2. **Recruiter submits for approval → all admins**: immediately after `RecruiterService.submitForApproval()` saves, every admin user receives an FCM push ("New recruiter registration request") and a DB notification with `data.url = "/admin/employer-verification"`.
3. **All notifications**: clicking a notification item in the bell popover or the full notifications page navigates the user to `data.url` (if present) and marks the notification as read.

---

## Reproduction steps

### Missing recruiter notification
1. As a candidate, submit an application to any active job.
2. Log in as the recruiter who owns the job.
3. Observe: no FCM push arrives; the bell popover shows no new notification.

### Missing admin notification
1. As a recruiter with DRAFT or REJECTED status, complete all required profile fields and click "Submit for Approval".
2. Log in as an admin.
3. Observe: no FCM push arrives; the bell popover shows no new notification.

### Missing click navigation
1. Trigger any working notification (e.g. approve a recruiter account from the admin panel).
2. Log in as the recruiter; open the bell popover.
3. Click the notification.
4. Observe: clicking marks it read but does not navigate anywhere.

---

## Impact scope

Backend:
- [x] application_service — `ApplicationService.submit()`, `NotificationPublisher`, `RabbitMQConfig`
- [x] user-service — `RecruiterService.submitForApproval()`, new DTO, `RabbitMQConfig`
- [x] notification-service — two new consumers, two new service methods, `url` key added to existing data maps
- [ ] api-gateway — no change
- [ ] job_service — no change
- [ ] ai_engine_service — no change
- [ ] Infrastructure (Docker / RabbitMQ / MongoDB / Elasticsearch) — no change

Frontend:
- [x] packages/api — add `data` field to `NotificationApiItem`
- [x] packages/ui — add `url` to `NotificationItem`, add `onClickNotification` callback to `NotificationPopover`
- [x] web-candidate — map `data.url`, handle click navigation in layout popover and `/notifications` page
- [x] web-recruiter — map `data.url`, handle click navigation in layout popover and `/employer/notifications` page
- [x] web-admin — map `data.url`, handle click navigation in `AdminLayout` popover
- [ ] packages/i18n — no change

---

## Related code

### application_service

| File | Line | Note |
|---|---|---|
| `features/application/ApplicationService.java` | ~52 | `submit()` — calls `aiScoringPublisher.publishScoringRequest(saved)` but no notification event |
| `integration/notification/NotificationPublisher.java` | — | Only `publishStatusChanged()` exists; no `publishNewApplication()` |
| `config/RabbitMQConfig.java` | — | Routing keys: `application.accepted`, `application.rejected`, `application.withdrawn` — no `application.submitted` |

### user-service

| File | Line | Note |
|---|---|---|
| `features/recruiter/RecruiterService.java` | ~234 | `submitForApproval()` — sets status PENDING, saves, returns — publishes nothing |
| `configuration/RabbitMQConfig.java` | — | Has `recruiter.notification.exchange` with `recruiter.approved`/`recruiter.rejected` — no `recruiter.pending` |
| `features/user/UserRepository.java` | — | `findByRolesIn(List<String> roles, Pageable pageable)` — used for admin lookup, but Spring Data MongoDB may not match embedded Role documents by plain string; see Step 2 |

### notification-service

| File | Line | Note |
|---|---|---|
| `internal/notification/consumer.go` | ~175 | `ListenApplicationEvents()` — only handles `accepted`/`rejected`/`withdrawn`; no `submitted` |
| `internal/notification/consumer.go` | ~221 | `handleApplicationEvent()` — data map has no `url` key; persisted notification has no navigation target |
| `internal/notification/service.go` | ~292 | `NotifyApplicationStatusChanged()` — passes `"/applications"` as FCM link URL but does NOT add `"url"` to data; DB record has no click URL |
| `internal/notification/service.go` | ~310–350 | `HandleRecruiterApproved/Rejected`, `HandleJobApproved/Rejected` — data maps missing `"url"` key |
| `internal/notification/service.go` | `audienceForRecipientRole` | Already correctly maps RECRUITER → `"web-vendor"`, ADMIN → `"web-admin"` |

### frontend

| File | Note |
|---|---|
| `packages/api/src/notification-hooks.ts` | `NotificationApiItem` has no `data` field — backend already returns it |
| `packages/ui/src/components/ui/notification-popover.tsx` | `NotificationItem` has no `url` field; `NotificationPopover` has no `onClickNotification` prop |
| `apps/web-candidate/src/routes/_account.notifications.tsx` | Item `onClick` only calls `markRead.mutate(item.id)` — no navigation |
| `apps/web-recruiter/src/routes/employer.notifications.tsx` | Same: onClick marks read, no navigation |
| `apps/web-admin/src/components/layouts/AdminLayout.tsx` | Popover has no `onClickNotification` handler |
| `apps/web-candidate/src/components/layouts/CandidateDashboardLayout.tsx` | Popover reads from Zustand store with hardcoded seed data — must be rewired to `useNotificationsList`; then add click navigation |
| `apps/web-recruiter/src/components/layouts/DashboardLayout.tsx` | Popover already wired to `useNotificationsList` but missing `url` mapping and click navigation |

---

## Implementation plan

### Step 1 — application_service: publish new-application event

**`config/RabbitMQConfig.java`** — add:
```java
public static final String APPLICATION_SUBMITTED_KEY = "application.submitted";
public static final String APPLICATION_SUBMITTED_QUEUE = "application.submitted.queue";

@Bean Queue applicationSubmittedQueue() { return new Queue(APPLICATION_SUBMITTED_QUEUE, true); }

@Bean Binding applicationSubmittedBinding(@Qualifier("applicationExchange") DirectExchange e) {
    return BindingBuilder.bind(applicationSubmittedQueue()).to(e).with(APPLICATION_SUBMITTED_KEY);
}
```

**`integration/notification/NotificationPublisher.java`** — add:
```java
public void publishNewApplication(Application application) {
    ApplicationEventMessage message = ApplicationEventMessage.builder()
        .applicationId(application.getId())
        .candidateId(application.getCandidateId())
        .candidateEmail(application.getCandidateEmail())
        .recruiterId(application.getRecruiterId())
        .jobId(application.getJobId())
        .jobTitle(application.getJobTitle())
        .newStatus("SUBMITTED")
        .occurredAt(LocalDateTime.now())
        .build();
    rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.APPLICATION_SUBMITTED_KEY, message);
}
```

**`features/application/ApplicationService.java:submit()`** — after `aiScoringPublisher.publishScoringRequest(saved)`:
```java
notificationPublisher.publishNewApplication(saved);
```

---

### Step 2 — user-service: publish recruiter-pending event

**`configuration/RabbitMQConfig.java`** — add (reuse existing `recruiter.notification.exchange`):
```java
public static final String RECRUITER_PENDING_QUEUE = "recruiter.pending.queue";
public static final String RECRUITER_PENDING_KEY = "recruiter.pending";

@Bean
public Queue recruiterPendingQueue() {
    return new Queue(RECRUITER_PENDING_QUEUE, true);
}

@Bean
public Binding recruiterPendingBinding() {
    return BindingBuilder.bind(recruiterPendingQueue()).to(recruiterExchange()).with(RECRUITER_PENDING_KEY);
}
```

**New DTO `dtos/message/RecruiterPendingEventMessage.java`**:
```java
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RecruiterPendingEventMessage implements Serializable {
    String recruiterId;
    String recruiterEmail;
    String companyName;
    List<String> adminUserIds;  // all admin MongoDB user IDs at time of submission
    LocalDateTime occurredAt;
}
```

**`features/recruiter/RecruiterService.java:submitForApproval()`** — after saving, before returning:
```java
// Collect all admin user IDs to notify.
// Use findByRoles_NameIn to match on the Role document's @MongoId (name field),
// NOT findByRolesIn which matches against the whole embedded object.
List<String> adminIds = userRepository
    .findByRoles_NameIn(List.of("ADMIN"), Pageable.unpaged())
    .stream().map(User::getId).toList();

rabbitTemplate.convertAndSend(
    RabbitMQConfig.RECRUITER_EXCHANGE,
    RabbitMQConfig.RECRUITER_PENDING_KEY,
    RecruiterPendingEventMessage.builder()
        .recruiterId(recruiter.getId())
        .recruiterEmail(user.getEmail())
        .companyName(recruiter.getCompanyName())
        .adminUserIds(adminIds)
        .occurredAt(LocalDateTime.now())
        .build()
);
```

**`features/user/UserRepository.java`** — add derived method (Spring Data MongoDB generates `{roles.name: {$in: ?0}}`):
```java
Page<User> findByRoles_NameIn(List<String> roleNames, Pageable pageable);
```
Do NOT use the existing `findByRolesIn(List<String>, Pageable)` — it compares the `roles` array against plain strings rather than the embedded Role document's `name` field, and will return zero results even when admins exist.

In practice the admin count is very small (≤ 5), so `Pageable.unpaged()` is safe.

---

### Step 3 — notification-service: new message types and consumers

**`internal/notification/consumer.go`** — add two new structs and two new listener methods:

```go
type RecruiterPendingEventMessage struct {
    RecruiterID    string   `json:"recruiterId"`
    RecruiterEmail string   `json:"recruiterEmail"`
    CompanyName    string   `json:"companyName"`
    AdminUserIDs   []string `json:"adminUserIds"`
    OccurredAt     string   `json:"occurredAt"`
}

// ListenApplicationSubmittedEvents — queue: application.submitted.queue
// Notifies the recruiter when a new candidate applies.
func (c *Consumer) ListenApplicationSubmittedEvents() error {
    ch, err := c.conn.Channel()
    if err != nil { return err }

    if err = ch.ExchangeDeclare("application.exchange", "direct", true, false, false, false, nil); err != nil {
        return err
    }
    queue, err := ch.QueueDeclare("application.submitted.queue", true, false, false, false, nil)
    if err != nil { return err }
    if err = ch.QueueBind(queue.Name, "application.submitted", "application.exchange", false, nil); err != nil {
        return err
    }
    msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
    if err != nil { return err }

    go func() {
        for d := range msgs {
            var msg ApplicationEventMessage
            if err := json.Unmarshal(d.Body, &msg); err != nil {
                c.logger.Error("failed to unmarshal application submitted event", "error", err)
                continue
            }
            c.logger.Info("processing new application event", "applicationId", msg.ApplicationID, "recruiterId", msg.RecruiterID)
            c.notiSvc.NotifyNewApplicant(context.Background(), msg.RecruiterID, msg.ApplicationID, msg.JobTitle, msg.JobID)
        }
    }()

    c.logger.Info("RabbitMQ consumer listening on application.submitted.queue")
    return nil
}

// ListenRecruiterPendingEvents — queue: recruiter.pending.queue
// Notifies all admins when a recruiter submits their profile for approval.
func (c *Consumer) ListenRecruiterPendingEvents() error {
    ch, err := c.conn.Channel()
    if err != nil { return err }

    if err = ch.ExchangeDeclare("recruiter.notification.exchange", "direct", true, false, false, false, nil); err != nil {
        return err
    }
    queue, err := ch.QueueDeclare("recruiter.pending.queue", true, false, false, false, nil)
    if err != nil { return err }
    if err = ch.QueueBind(queue.Name, "recruiter.pending", "recruiter.notification.exchange", false, nil); err != nil {
        return err
    }
    msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
    if err != nil { return err }

    go func() {
        for d := range msgs {
            var msg RecruiterPendingEventMessage
            if err := json.Unmarshal(d.Body, &msg); err != nil {
                c.logger.Error("failed to unmarshal recruiter pending event", "error", err)
                continue
            }
            c.logger.Info("processing recruiter pending event", "recruiterId", msg.RecruiterID)
            c.notiSvc.NotifyAdminNewRecruiterRequest(context.Background(), msg)
        }
    }()

    c.logger.Info("RabbitMQ consumer listening on recruiter.pending.queue")
    return nil
}
```

**`internal/notification/service.go`** — add two new methods to `ServiceInterface` and implement them:

```go
// ServiceInterface additions:
NotifyNewApplicant(ctx context.Context, recruiterID, applicationID, jobTitle, jobID string)
NotifyAdminNewRecruiterRequest(ctx context.Context, msg RecruiterPendingEventMessage)

// Implementation:

func (s *Service) NotifyNewApplicant(ctx context.Context, recruiterID, applicationID, jobTitle, jobID string) {
    if recruiterID == "" { return }
    title := "New Application Received"
    body := fmt.Sprintf("A candidate has applied for \"%s\".", jobTitle)
    url := fmt.Sprintf("/employer/applicants/%s", applicationID)
    data := map[string]string{
        "type":          "NEW_APPLICANT",
        "applicationId": applicationID,
        "jobId":         jobID,
        "jobTitle":      jobTitle,
        "url":           url,
    }
    jsonData, _ := json.Marshal(data)
    if err := s.CreateNotification(ctx, recruiterID, "RECRUITER", title, body, "NEW_APPLICANT", jsonData); err != nil {
        s.logger.Error("failed to persist new applicant notification", "recruiterID", recruiterID, "err", err)
    }
    s.sendWebpushToUser(ctx, recruiterID, url, data, audienceForRecipientRole("RECRUITER"))
    s.syncFirestoreUnreadCount(recruiterID, "RECRUITER")
}

func (s *Service) NotifyAdminNewRecruiterRequest(ctx context.Context, msg RecruiterPendingEventMessage) {
    if len(msg.AdminUserIDs) == 0 { return }
    title := "New Recruiter Registration Request"
    body := fmt.Sprintf("Company \"%s\" has submitted a registration request for review.", msg.CompanyName)
    url := "/admin/employer-verification"
    data := map[string]string{
        "type":        "RECRUITER_PENDING",
        "recruiterId": msg.RecruiterID,
        "companyName": msg.CompanyName,
        "url":         url,
    }
    jsonData, _ := json.Marshal(data)
    for _, adminID := range msg.AdminUserIDs {
        if err := s.CreateNotification(ctx, adminID, "ADMIN", title, body, "RECRUITER_PENDING", jsonData); err != nil {
            s.logger.Error("failed to persist admin recruiter-pending notification", "adminID", adminID, "err", err)
        }
        s.sendWebpushToUser(ctx, adminID, url, data, audienceForRecipientRole("ADMIN"))
        s.syncFirestoreUnreadCount(adminID, "ADMIN")
    }
}
```

**Fix `url` key in existing notification data maps** — three places in `consumer.go` and `service.go`:

1. `handleApplicationEvent()` (`consumer.go`) — add to `data` map:
   ```go
   "url": "/applications",
   ```
   (The candidate navigates to their application list. A deep-link to the specific application requires exposing application ID on the candidate-facing route, which is not yet implemented — use list URL for now.)

2. `HandleRecruiterApproved()` and `HandleRecruiterRejected()` (`service.go`) — two bugs to fix simultaneously:
   - The `data` map marshalled into `CreateNotification` has no `url` key.
   - The existing `sendWebpushToUser` call hardcodes `"/recruiter/profile"` — this path does not exist; the recruiter frontend uses `/employer/profile`.

   Replace the `json.Marshal(map[string]string{...})` and the `sendWebpushToUser` third-argument URL with `/employer/profile`:
   ```go
   // Before (two separate maps — one marshalled for DB, one inline for FCM):
   data, _ := json.Marshal(map[string]string{"recruiterId": msg.RecruiterID, "companyName": msg.CompanyName})
   // ...
   s.sendWebpushToUser(ctx, ..., "/recruiter/profile", map[string]string{...}, ...)

   // After (single source-of-truth map, marshalled once):
   dataMap := map[string]string{
       "recruiterId": msg.RecruiterID,
       "companyName": msg.CompanyName,
       "type":        "RECRUITER_APPROVED", // or "RECRUITER_REJECTED"
       "url":         "/employer/profile",
   }
   data, _ := json.Marshal(dataMap)
   // ...
   s.sendWebpushToUser(ctx, msg.RecruiterID, "/employer/profile", dataMap, audienceForRecipientRole("RECRUITER"))
   ```

3. `HandleJobApproved()` and `HandleJobRejected()` (`service.go`) — the `data` variable is `datatypes.JSON` (marshaled `[]byte`) immediately after `json.Marshal`; you cannot assign `data["url"] = jobURL` on a byte slice. The fix is to include `"url"` in the `map[string]string` literal *before* marshaling:
   ```go
   // Before:
   data, _ := json.Marshal(map[string]string{"jobId": msg.JobID, "title": msg.Title, "company": msg.Company})

   // After:
   jobURL := fmt.Sprintf("/jobs/%s", msg.JobID)   // already computed below; move it up
   dataMap := map[string]string{
       "jobId":   msg.JobID,
       "title":   msg.Title,
       "company": msg.Company,
       "type":    "JOB_APPROVED", // or "JOB_REJECTED"
       "url":     jobURL,
   }
   data, _ := json.Marshal(dataMap)
   ```
   The `sendWebpushToUser` inline data map already contains `"url": jobURL` — update it to use `dataMap` so there is a single source of truth.

**Wire new consumers in `internal/server/server.go`** — add inside the `if s.consumer != nil` block in `Start()`, following the pattern of existing listener goroutines:
```go
go func() {
    if err := s.consumer.ListenApplicationSubmittedEvents(); err != nil {
        s.log.Error("failed to start application submitted event consumer", slog.Any("error", err))
    }
}()
go func() {
    if err := s.consumer.ListenRecruiterPendingEvents(); err != nil {
        s.log.Error("failed to start recruiter pending event consumer", slog.Any("error", err))
    }
}()
```
Note: consumers are started in `server.go` (`server.Start()`), not in `cmd/server/main.go`.

---

### Step 4 — packages/api: expose `data` field

**`packages/api/src/notification-hooks.ts`** — add field to `NotificationApiItem`:
```typescript
export interface NotificationApiItem {
  id: string;
  receiverId: string;
  receiverType: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;  // add this
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}
```

---

### Step 5 — packages/ui: add URL and click callback to NotificationPopover

**`packages/ui/src/components/ui/notification-popover.tsx`** — two changes:

```typescript
// Add url to NotificationItem:
export interface NotificationItem {
  id: string
  title: string
  message: string
  createdAt: string
  read: boolean
  tone?: NotificationTone
  url?: string        // add this
}

// Add callback to NotificationPopoverProps:
interface NotificationPopoverProps {
  // ... existing props ...
  onClickNotification?: (id: string, url?: string) => void  // add this
}
```

In the item render, wrap the card with a click handler that calls `onClickNotification?.(item.id, item.url)`. The callback is optional — apps that do not pass it retain existing behaviour.

---

### Step 6 — web-candidate: rewire layout to real API, then add navigation

`CandidateDashboardLayout.tsx` currently reads notifications from `useNotificationsStore` (a Zustand store seeded with hardcoded fake data). Before click navigation can be wired, the layout must be switched to the real API — following the same pattern as `web-recruiter/src/components/layouts/DashboardLayout.tsx`.

**`apps/web-candidate/src/components/layouts/CandidateDashboardLayout.tsx`**:
```typescript
// 1. Remove Zustand store reads:
//    const notifications = useNotificationsStore((s) => s.notifications)
//    const markAsRead = useNotificationsStore(...)
//    etc.

// 2. Add real API hooks (same imports as web-recruiter DashboardLayout):
import { useNotificationsList, useMarkNotificationRead, useMarkAllNotificationsRead } from '@smart-cv/api'
import { useNavigate } from '@tanstack/react-router'

// 3. Inside the component:
const navigate = useNavigate()
const { data: notifData } = useNotificationsList({ page: 1, pageSize: 30 })
const markReadMutation = useMarkNotificationRead()
const markAllReadMutation = useMarkAllNotificationsRead()
const unreadCount = notifData?.data?.unreadCount ?? 0

// 4. Build NotificationItem[] from API data, including url:
const notifications: NotificationItem[] = (notifData?.data?.items ?? []).map((item) => ({
  id: item.id,
  title: item.title,
  message: item.body,
  createdAt: item.createdAt,
  read: item.isRead,
  url: item.data?.url,
}))

// 5. Wire popover callbacks:
onClickNotification={(id, url) => {
  markReadMutation.mutate(id)
  if (url) window.location.href = url   // use window.location.href for dynamic strings
}}
onMarkRead={(id) => markReadMutation.mutate(id)}
onMarkAllRead={() => markAllReadMutation.mutate()}
```

Note: use `window.location.href = url` rather than `navigate({ to: url })`. TanStack Router's `navigate` requires a statically-typed route path, not an arbitrary `string`, and will produce a TypeScript error. `window.location.href` accepts any string and is appropriate for server-supplied URLs.

**`apps/web-candidate/src/routes/_account.notifications.tsx`** — update item `onClick` (no new imports needed):
```typescript
// Inside map:
onClick={() => {
  if (!item.isRead) markRead.mutate(item.id)
  if (item.data?.url) window.location.href = item.data.url
}}
```

Tone mapping for candidate notifications:
- `APPLICATION_STATUS` (ACCEPTED) → `success`
- `APPLICATION_STATUS` (REJECTED) → `danger`
- Default → `info`

Since `type` alone does not distinguish the new status, tone is derived from `item.data?.status` (already present in the data payload).

---

### Step 7 — web-recruiter: map data.url and handle navigation

**`apps/web-recruiter/src/components/layouts/DashboardLayout.tsx`** — already uses `useNotificationsList`. Add `url` to the item mapping and wire `onClickNotification`:
```typescript
// In the notifications mapping (after item.isRead):
url: item.data?.url,

// Add to NotificationPopover:
onClickNotification={(id, url) => {
  // mark read via existing mutation
  if (url) window.location.href = url
}}
```

**`apps/web-recruiter/src/routes/employer.notifications.tsx`** — update item `onClick` (no new imports needed):
```typescript
// Inside map:
onClick={() => {
  if (!item.isRead) markRead.mutate(item.id)
  if (item.data?.url) window.location.href = item.data.url
}}
```

Tone mapping for recruiter:
- `JOB_APPROVED`, `RECRUITER_APPROVED` → `success`
- `JOB_REJECTED`, `RECRUITER_REJECTED` → `danger`
- `NEW_APPLICANT` → `info`

---

### Step 8 — web-admin: map data.url and handle navigation

In `AdminLayout.tsx`, the popover mapping already maps from `notifData?.data?.items`. Add `url`:
```typescript
const notifications: NotificationItem[] = (notifData?.data?.items ?? [])
  .filter((item) => !dismissed.has(item.id))
  .map((item) => ({
    id: item.id,
    title: item.title,
    message: item.body,
    createdAt: item.createdAt,
    read: item.isRead,
    tone: 'info' as const,
    url: item.data?.url,       // add this
  }))
```

Add `onClickNotification` to `NotificationPopover`:
```typescript
onClickNotification={(id, url) => {
  markAsRead(id)
  if (url) window.location.href = url   // dynamic string — use href, not navigate({ to })
}}
```

Tone mapping for admin:
- `RECRUITER_PENDING` → `warning`
- Default → `info`

---

## Notification type catalogue (complete after this issue)

| Type | Trigger | Recipient | `recipient_role` | `data.url` |
|---|---|---|---|---|
| `NEW_APPLICANT` | Candidate submits application | Recruiter | `RECRUITER` | `/employer/applicants/{applicationId}` |
| `RECRUITER_PENDING` | Recruiter submits for approval | All admins | `ADMIN` | `/admin/employer-verification` |
| `APPLICATION_STATUS` | Application status → ACCEPTED/REJECTED/WITHDRAWN | Candidate | `USER` | `/applications` |
| `RECRUITER_APPROVED` | Admin approves recruiter | Recruiter | `RECRUITER` | `/employer/profile` |
| `RECRUITER_REJECTED` | Admin rejects recruiter | Recruiter | `RECRUITER` | `/employer/profile` |
| `JOB_APPROVED` | Admin approves job | Recruiter | `RECRUITER` | `/jobs/{jobId}` |
| `JOB_REJECTED` | Admin rejects job | Recruiter | `RECRUITER` | `/jobs/{jobId}` |
| `CV_ANALYSIS_DONE` | AI finishes CV analysis | Candidate | `USER` | `/cv` |

---

## Notes

- `NotificationApiItem` returned from the existing handler already includes `data` as `datatypes.JSON` (go-gorm jsonb) — the backend change is zero. Only the TypeScript interface needs updating.
- `findByRoles_NameIn` generates `{roles.name: {$in: ?0}}` which correctly matches Spring Data MongoDB's traversal of embedded/referenced Role documents by their `@MongoId` field. Do NOT use the existing `findByRolesIn(List<String>, Pageable)` — it cannot match embedded Role objects against plain strings.
- The recruiter exchange `recruiter.notification.exchange` is already declared as a durable DirectExchange in both user-service's `RabbitMQConfig` and the notification-service's Go consumers — the new `recruiter.pending` binding is idempotent and does not conflict with existing `recruiter.approved`/`recruiter.rejected` queues.
- Navigation uses `window.location.href = url` (not `navigate({ to: url })`) for all notification click-through. TanStack Router's `navigate` expects statically-typed route paths; server-supplied `data.url` strings do not satisfy this constraint. `window.location.href` also handles cross-app navigation if a notification from one app context ever links to another.
- `web-candidate` layout (`CandidateDashboardLayout.tsx`) currently reads from a Zustand store seeded with hardcoded data. Step 6 replaces this entirely with `useNotificationsList` — the store file `store/useNotificationsStore.ts` can be deleted or left unused after the migration.
- Pre-existing omission: `NotifyApplicationStatusChanged` (`service.go`) does not call `syncFirestoreUnreadCount`, unlike every other notification creation path. Fix it in the same commit as the `url` key addition to be consistent.
- The existing `middleware.go` derives `audience` from the `X-User-Scope` header set by the API Gateway — admin tokens arrive with scope `ROLE_ADMIN`, which maps to `web-admin`. FCM push to admins therefore works via `sendWebpushToUser(ctx, adminID, url, data, "web-admin")` once tokens are registered.
- `audienceForRecipientRole("RECRUITER")` returns `"web-vendor"` (not `"web-recruiter"`) — this is the stored token audience for recruiter browsers. `NotifyNewApplicant` inherits this correctly by calling `audienceForRecipientRole("RECRUITER")`.
- Related: `20260618_1522_fcm-push-notification-browser.md` — covers FCM credential wiring and service-worker setup (prerequisite for push to work end-to-end).
