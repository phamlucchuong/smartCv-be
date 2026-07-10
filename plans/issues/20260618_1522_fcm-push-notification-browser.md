# FCM Browser Push Notifications for Candidate / Recruiter / Admin

**Updated:** 2026-06-21 — reflects current code state; items already implemented are marked ✅.

## Overview

Implement end-to-end Firebase Cloud Messaging (FCM) push notifications across all three web apps (candidate, recruiter, admin). The backend service and frontend packages are partially scaffolded; this issue covers the remaining wiring and a pre-existing audience-string mismatch that silently prevents recruiter pushes from reaching their targets.

Remaining work falls into four groups:
1. **Backend: wire FCM credentials from env** — `notification-service` passes empty strings; `s.fcmClient` is always nil.
2. **Backend: fix recruiter audience mismatch** — `audienceFromScope` stores recruiter tokens under `"web-vendor"` but `audienceForRecipientRole` queries for `"web-recruiter"`; recruiter push is silently dropped.
3. **Frontend: install Firebase SDK + service workers** — web-recruiter and web-admin have no Firebase; no app has a service worker.
4. **Frontend: push permission flow + real notifications pages** — candidate/recruiter notifications pages redirect instead of showing data; admin popover uses fake seed data; no app auto-resubscribes on load.

---

## Current state

| Layer | What exists | What is still missing |
|---|---|---|
| `notification-service` config | SMTP, Twilio, RabbitMQ fields | No `FCM_PROJECT_ID` or `FCM_SERVICE_ACCOUNT_JSON` fields |
| `notification-service` server | `NewService(repo, log, "", "", ...)` | Wire credentials from config |
| `notification-service` auth middleware | ✅ `middleware.go` fully written; `authMiddleware()` applied at `/notifications` route group in `routes.go` | — |
| `notification-service` audience mapping | `audienceFromScope` uses `"web-vendor"` for recruiters | `audienceForRecipientRole` uses `"web-recruiter"` — mismatch silently breaks recruiter push |
| `notification-service` FCM handler | Handler reads `req.Audience` first, falling back to middleware context | Should always use context audience (set by middleware from `X-User-Scope`); client must not send audience |
| `notification-service` subscribe/unsubscribe | ✅ Both fully implemented; BOLA fix (`DeleteFCMTokenByTokenAudienceAndUser`) in place | — |
| `notification-service` consumer | `handleApplicationEvent` sends email only | No FCM push for application accepted/rejected |
| Firebase SDK (go) | ✅ `firebase.google.com/go/v4` in `go.mod` | Not usable until credentials are wired |
| Firebase SDK (web-candidate) | ✅ `firebase ^12.15.0` in `package.json`; `src/lib/firebase.ts` initializes `FirebaseApp` + `Messaging` | No `public/firebase-messaging-sw.js` |
| Firebase SDK (web-recruiter) | Not installed | Install + create `src/lib/firebase.ts` + service worker |
| Firebase SDK (web-admin) | Not installed | Install + create `src/lib/firebase.ts` + service worker |
| `notification-hooks.ts` | ✅ `useNotificationsList`, `useMarkNotificationRead`, `useMarkAllNotificationsRead` — auto re-exported via `export * from './notification-hooks'` in `index.ts` | No FCM subscribe/unsubscribe helpers |
| Settings push toggle (candidate) | `_account.settings.tsx` "New Messages" row calls `handleNotifToggle` | Never calls `Notification.requestPermission()` or FCM `getToken()`; no auto-resubscribe on load |
| Settings push section (recruiter) | `employer.settings.tsx` has no push section | Add push notification section |
| Notifications page (candidate) | `_account.notifications.tsx` redirects to `/profile` | Replace with real API using `useNotificationsList` |
| Notifications page (recruiter) | `employer.notifications.tsx` redirects to `/employer` | Replace with real API |
| Notifications popover (admin) | `AdminLayout.tsx` `NotificationPopover` reads from `useNotificationsStore` (Zustand, fake seed) | Wire API data while keeping UI-only state (`filter`, optimistic dismiss) |

---

## Reproduction steps

1. Enable "New Messages" toggle in Settings (web-candidate) — observe: DB preference updates but browser `Notification.permission` is never requested, no FCM token registered.
2. Accept or reject an application from the recruiter side — observe: candidate gets email, no browser push.
3. Open `/employer/notifications` — observe: immediate redirect to `/employer`.
4. Subscribe to push from web-recruiter (future) — observe: token saved under `"web-vendor"` but `HandleRecruiterApproved` queries `"web-recruiter"` → push silently dropped.

---

## Expected behavior

1. Candidate/recruiter "Push Notifications" toggle in Settings calls `Notification.requestPermission()`; if granted, Firebase SDK obtains an FCM token and `POST /notification/api/notifications/fcm/subscribe` is called.
2. On app mount, if `Notification.permission === 'granted'` but no local token is stored, the app silently re-registers without showing a dialog.
3. When an application is accepted or rejected, the candidate receives a browser push even with the tab closed.
4. `/employer/notifications` and `/_account/notifications` show real notification history from `GET /notification/api/notifications`.
5. The admin `NotificationPopover` shows real notifications from the same endpoint.
6. Toggling push off or revoking permission calls `DELETE /notification/api/notifications/fcm/unsubscribe` and removes the token.

---

## Impact scope

Backend:
- [x] api-gateway — already forwards `X-User-Id` and `X-User-Scope`
- [ ] notification-service — credentials, audience fix, consumer FCM push

Frontend:
- [x] web-candidate — Firebase SDK installed, `firebase.ts` exists
- [ ] web-recruiter — Firebase not installed
- [ ] web-admin — Firebase not installed
- [ ] packages/api — FCM subscribe/unsubscribe helpers missing

---

## Related code

| Location | Status | Relevance |
|---|---|---|
| `backend/notification-service/internal/config/config.go` | ❌ | Add `FCM_PROJECT_ID` + `FCM_SERVICE_ACCOUNT_JSON` fields |
| `backend/notification-service/internal/server/server.go:69-77` | ❌ | Replace `""` with `cfg.FCMProjectID` / `cfg.FCMServiceAccountJSON` |
| `backend/notification-service/internal/server/middleware.go` | ✅ | `authMiddleware` + `audienceFromScope` — fully implemented |
| `backend/notification-service/internal/server/routes.go:20` | ✅ | `Group("/notifications", authMiddleware())` applied |
| `backend/notification-service/internal/notification/service.go:audienceForRecipientRole` | ❌ | Returns `"web-recruiter"` for `"RECRUITER"` — must be changed to `"web-vendor"` |
| `backend/notification-service/internal/notification/handler.go:SubscribeFCMToken` | ❌ | Currently reads `req.Audience` before context; must always use context audience |
| `backend/notification-service/internal/notification/service.go:SubscribeFCMToken` | ✅ | Properly saves token with derived audience |
| `backend/notification-service/internal/notification/service.go:UnsubscribeFCMToken` | ✅ | Scoped delete (user_id + audience + token) |
| `backend/notification-service/internal/notification/consumer.go:handleApplicationEvent` | ❌ | Add FCM push after email send |
| `frontend/apps/web-candidate/src/lib/firebase.ts` | ✅ | `FirebaseApp` + `Messaging` initialized |
| `frontend/apps/web-candidate/public/` | ❌ | No `firebase-messaging-sw.js` |
| `frontend/apps/web-recruiter/src/lib/firebase.ts` | ❌ | Absent |
| `frontend/apps/web-recruiter/public/` | ❌ | No service worker |
| `frontend/apps/web-admin/src/lib/firebase.ts` | ❌ | Absent |
| `frontend/apps/web-admin/public/` | ❌ | No service worker |
| `frontend/packages/api/src/notification-hooks.ts` | ✅ | List / mark-read hooks done; add FCM helpers here |
| `frontend/apps/web-candidate/src/routes/_account.settings.tsx` | ❌ | "New Messages" toggle does not call permission API |
| `frontend/apps/web-candidate/src/routes/_account.notifications.tsx` | ❌ | Redirects to `/profile` |
| `frontend/apps/web-recruiter/src/routes/employer.settings.tsx` | ❌ | No push section |
| `frontend/apps/web-recruiter/src/routes/employer.notifications.tsx` | ❌ | Redirects to `/employer` |
| `frontend/apps/web-admin/src/components/layouts/AdminLayout.tsx` | ❌ | Wire `NotificationPopover` to real API |
| `frontend/apps/web-admin/src/store/useNotificationsStore.ts` | ❌ | Replace fake seed with API; keep UI-only `filter` + optimistic dismiss |

---

## Fix spec

### 1. Backend — wire FCM credentials

**`config/config.go`** — add two fields:
```go
FCMProjectID          string `mapstructure:"FCM_PROJECT_ID"`
FCMServiceAccountJSON string `mapstructure:"FCM_SERVICE_ACCOUNT_JSON"`
```

**`server/server.go`** — replace hardcoded empty strings:
```go
s.notiSvc = notification.NewService(
    repo, log,
    cfg.FCMProjectID,
    cfg.FCMServiceAccountJSON,
    otpSvc, emailSvc, smsSvc,
)
```

**`.env.example`** (backend root) — add:
```
FCM_PROJECT_ID=your-firebase-project-id
# Inline the service account JSON as a single-line string (no newlines).
# Never commit the actual credentials. Add .env to .gitignore if not already there.
FCM_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

> **Security note:** The service account JSON grants Firebase project-wide access. Use a dedicated key with only `firebase.messaging` and `cloudmessaging.messages.create` IAM roles (not the default editor key). In production, prefer Workload Identity Federation / `GOOGLE_APPLICATION_CREDENTIALS` pointing to a file rather than inlining JSON.

---

### 2. Backend — fix recruiter audience mismatch

There are two functions in the service that map roles to audience strings, and they disagree on the recruiter value:

| Function | Location | Current recruiter value |
|---|---|---|
| `audienceFromScope` | `server/middleware.go:34` | `"web-vendor"` (correct — used for token storage) |
| `audienceForRecipientRole` | `service.go` | `"web-recruiter"` (wrong — used for token lookup) |

Because tokens are stored with `"web-vendor"` but queried with `"web-recruiter"`, no recruiter FCM push is ever delivered.

**Fix:** Change `audienceForRecipientRole("RECRUITER")` to return `"web-vendor"`. Also update `isSupportedAudience` to replace `"web-recruiter"` with `"web-vendor"`.

```go
func audienceForRecipientRole(role string) string {
    switch strings.ToUpper(role) {
    case "RECRUITER":
        return "web-vendor"   // was "web-recruiter"
    case "ADMIN":
        return "web-admin"
    default:
        return "web-user"
    }
}

func isSupportedAudience(audience string) bool {
    switch audience {
    case "web-user", "web-vendor", "web-admin":   // was "web-recruiter"
        return true
    }
    return false
}
```

---

### 3. Backend — fix SubscribeFCMToken handler to always use context audience

The current handler reads `req.Audience` from the request body, falling back to the middleware context only if `req.Audience` is empty. This lets the client override the server-derived audience, which breaks the audience guarantee.

**Fix in `handler.go:SubscribeFCMToken`** — ignore `req.Audience`; always use the context audience:
```go
func (h *Handler) SubscribeFCMToken(c *echo.Context) error {
    userID, _ := c.Get("user_id").(string)
    audience, _ := c.Get("audience").(string)
    if userID == "" || audience == "" {
        return pkg.JSONError(c, http.StatusUnauthorized, pkg.CodeUnauthorized, "unauthorized")
    }
    var req FCMSubscribeRequest
    if err := c.Bind(&req); err != nil || req.Token == "" {
        return pkg.JSONError(c, http.StatusBadRequest, pkg.CodeBadRequest, "token required")
    }
    if err := h.notifSvc.SubscribeFCMToken(c.Request().Context(), userID, req.Token, audience); err != nil {
        h.logger.Error("failed to save fcm token", "userID", userID, "err", err)
        return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "subscribe failed")
    }
    return pkg.JSONOK(c, nil)
}
```

---

### 4. Backend — send FCM push for application events

**Add a private helper in `consumer.go`** (or a shared file):
```go
func applicationPushContent(status, jobTitle, rejectionReason string) (title, body string) {
    switch strings.ToUpper(status) {
    case "ACCEPTED":
        title = "Application Accepted 🎉"
        body = fmt.Sprintf("Your application for \"%s\" has been accepted!", jobTitle)
    case "REJECTED":
        title = "Application Update"
        body = fmt.Sprintf("Your application for \"%s\" was not selected.", jobTitle)
        if rejectionReason != "" {
            body += " Reason: " + rejectionReason
        }
    default:
        title = "Application Status Changed"
        body = fmt.Sprintf("Your application for \"%s\" is now %s.", jobTitle, status)
    }
    return
}
```

**Add to `ServiceInterface` in `service.go`:**
```go
NotifyApplicationStatusChanged(ctx context.Context, candidateID, title, body string, data map[string]string)
```

**Add implementation in `service.go`:**
```go
func (s *Service) NotifyApplicationStatusChanged(ctx context.Context, candidateID, title, body string, data map[string]string) {
    _ = s.repo.CreateNotification(ctx, candidateID, "USER", title, body, "APPLICATION_STATUS", dataToJSON(data))
    s.sendWebpushToUser(ctx, candidateID, "/applications", data, "web-user")
}
```

**Update `handleApplicationEvent` in `consumer.go`:**
```go
func (c *Consumer) handleApplicationEvent(msg ApplicationEventMessage) {
    if msg.CandidateEmail == "" {
        c.logger.Warn("application event missing candidateEmail, skipping", "applicationId", msg.ApplicationID)
        return
    }
    ctx := context.Background()

    if err := c.notiSvc.SendApplicationResultEmail(ctx, msg); err != nil {
        c.logger.Error("failed to send application result email", "applicationId", msg.ApplicationID, "error", err)
    }

    title, body := applicationPushContent(msg.NewStatus, msg.JobTitle, msg.RejectionReason)
    data := map[string]string{
        "applicationId": msg.ApplicationID,
        "jobId":         msg.JobID,
        "jobTitle":      msg.JobTitle,
        "status":        msg.NewStatus,
    }
    c.notiSvc.NotifyApplicationStatusChanged(ctx, msg.CandidateID, title, body, data)
}
```

> **Known limitation:** `ch.Consume` uses `autoAck: true` — if the push or email call panics, the message is lost. Switching to manual ack + dead-letter queue is a separate infrastructure task and out of scope here.

---

### 5. Frontend — add FCM helpers to `packages/api`

Add to **`notification-hooks.ts`** (new functions at the end of the file; no change to `index.ts` needed — `export * from './notification-hooks'` already re-exports everything):

```ts
export const subscribeFcmToken = (token: string): Promise<unknown> =>
  customInstance({
    url: '/notification/api/notifications/fcm/subscribe',
    method: 'POST',
    data: { token },
    // audience is derived server-side from X-User-Scope — do NOT send it from the client
  });

export const unsubscribeFcmToken = (token: string): Promise<unknown> =>
  customInstance({
    url: '/notification/api/notifications/fcm/unsubscribe',
    method: 'DELETE',
    data: { token },
  });
```

---

### 6. Frontend — install Firebase and create `firebase.ts` for web-recruiter and web-admin

```bash
pnpm --filter web-recruiter add firebase
pnpm --filter web-admin add firebase
```

Create `src/lib/firebase.ts` in **web-recruiter** and **web-admin** — identical copy of `web-candidate/src/lib/firebase.ts`.

Add to `.env.example` of **each of the three apps** (web-candidate may be missing `VITE_FIREBASE_VAPID_KEY` and `VITE_FIREBASE_MEASUREMENT_ID` — verify):
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_VAPID_KEY=
```

---

### 7. Frontend — service workers (all 3 apps)

Create `public/firebase-messaging-sw.js` in **each of the three apps**. Do **not** use `importScripts` from a CDN — bundle the Firebase compat scripts locally to avoid CDN dependency and version skew. After building the app, copy the compat scripts from `node_modules/firebase/`:

```
public/
  firebase-messaging-sw.js         ← the worker
  firebase/
    firebase-app-compat.js         ← copied from node_modules/firebase/compat/app/index.js (or UMD build)
    firebase-messaging-compat.js   ← copied from node_modules/firebase/compat/messaging/index.js
```

Alternatively, use a Vite plugin (e.g. `vite-plugin-pwa`) to generate the service worker. The simplest manual approach:

**`public/firebase-messaging-sw.js`:**
```js
// Config is sent via postMessage from the main thread after the SW activates.
// The SW listens for FIREBASE_CONFIG before initializing Firebase.
let firebaseApp;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG' && !firebaseApp) {
    importScripts('/firebase/firebase-app-compat.js');
    importScripts('/firebase/firebase-messaging-compat.js');
    firebaseApp = firebase.initializeApp(event.data.config);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const { title = 'SmartCV', body = '', url } = payload.data ?? {};
      self.registration.showNotification(title, {
        body,
        icon: '/favicon.svg',
        data: { url },
      });
    });
    event.source?.postMessage({ type: 'FIREBASE_CONFIG_ACK' });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) event.waitUntil(clients.openWindow(url));
});
```

Add a `postbuild` script (or Vite plugin) to copy the compat scripts from `node_modules` into `public/firebase/`.

---

### 8. Frontend — `usePushNotifications` hook (per app)

Create `src/hooks/usePushNotifications.ts` in each of the three apps.

The hook must handle:
- First-install race: wait for the service worker to activate and acknowledge the config before calling `getToken`.
- Token recovery: if permission is already `'granted'` but no token in localStorage, silently re-register.

```ts
import { getToken, deleteToken } from 'firebase/messaging';
import { messaging, firebaseConfig } from '@/lib/firebase';
import { subscribeFcmToken, unsubscribeFcmToken } from '@smart-cv/api';

const FCM_TOKEN_KEY = 'smartcv_fcm_token';

async function activateServiceWorker(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

  // Wait for the SW to reach the active state (handles first-install case).
  if (reg.installing || reg.waiting) {
    await new Promise<void>((resolve) => {
      const sw = reg.installing ?? reg.waiting!;
      sw.addEventListener('statechange', function handler() {
        if (sw.state === 'activated') {
          sw.removeEventListener('statechange', handler);
          resolve();
        }
      });
    });
  }

  // Send config and wait for ACK before proceeding.
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('SW config timeout')), 5000);
    navigator.serviceWorker.addEventListener('message', function handler(event) {
      if (event.data?.type === 'FIREBASE_CONFIG_ACK') {
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener('message', handler);
        resolve();
      }
    });
    reg.active!.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
  });

  return reg;
}

export function usePushNotifications() {
  const subscribe = async (): Promise<void> => {
    if (!messaging) throw new Error('Messaging unavailable');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permission denied');

    const reg = await activateServiceWorker();
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    await subscribeFcmToken(token);
    localStorage.setItem(FCM_TOKEN_KEY, token);
  };

  const unsubscribe = async (): Promise<void> => {
    const token = localStorage.getItem(FCM_TOKEN_KEY);
    if (!token || !messaging) return;
    await deleteToken(messaging);
    await unsubscribeFcmToken(token);
    localStorage.removeItem(FCM_TOKEN_KEY);
  };

  // Call on app mount: silently re-registers if permission was granted but token is missing.
  const initPushSubscription = async (): Promise<void> => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (localStorage.getItem(FCM_TOKEN_KEY)) return; // token already registered
    if (!messaging) return;
    try {
      const reg = await activateServiceWorker();
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: reg,
      });
      await subscribeFcmToken(token);
      localStorage.setItem(FCM_TOKEN_KEY, token);
    } catch {
      // Silently ignore — push works on next explicit subscribe
    }
  };

  const currentPermission = (): NotificationPermission =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default';

  return { subscribe, unsubscribe, initPushSubscription, currentPermission };
}
```

---

### 9. Frontend — wire candidate Settings push toggle

**`_account.settings.tsx`** — add auto-init on mount and replace "New Messages" toggle handler:

```tsx
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Inside the component:
const { subscribe, unsubscribe, initPushSubscription, currentPermission } = usePushNotifications();

React.useEffect(() => { initPushSubscription(); }, []);

const handlePushToggle = async () => {
  if (!notifications.newMessages) {
    if (currentPermission() === 'denied') {
      toast.error('Browser notifications are blocked. Allow them in your browser settings and try again.');
      return;
    }
    try {
      await subscribe();
      handleNotifToggle('newMessages'); // persist DB preference after FCM token registered
    } catch {
      toast.error('Could not enable push notifications.');
    }
  } else {
    await unsubscribe();
    handleNotifToggle('newMessages');
  }
};
```

Replace `onToggle={() => handleNotifToggle('newMessages')}` on the "New Messages" `ToggleRow` with `onToggle={handlePushToggle}`.

Optionally show permission state as sub-label: `"Allowed"` / `"Blocked"` / `"Not set"`.

---

### 10. Frontend — add push notification section to recruiter Settings

**`employer.settings.tsx`** — add imports and a push card after the existing sections:

```tsx
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Inside the component:
const { subscribe, unsubscribe, initPushSubscription, currentPermission } = usePushNotifications();
const [pushEnabled, setPushEnabled] = React.useState(
  () => localStorage.getItem('smartcv_fcm_token') !== null
);

React.useEffect(() => {
  initPushSubscription().then(() => {
    setPushEnabled(localStorage.getItem('smartcv_fcm_token') !== null);
  });
}, []);

const handlePushToggle = async () => {
  if (!pushEnabled) {
    if (currentPermission() === 'denied') {
      toast.error('Browser notifications are blocked.');
      return;
    }
    try {
      await subscribe();
      setPushEnabled(true);
      toast.success('Push notifications enabled.');
    } catch {
      toast.error('Could not enable push notifications.');
    }
  } else {
    await unsubscribe();
    setPushEnabled(false);
    toast.success('Push notifications disabled.');
  }
};
```

Add a "Push Notifications" card (same `ToggleRow` pattern as candidate settings) that uses `pushEnabled` / `handlePushToggle`.

---

### 11. Frontend — candidate and recruiter notifications pages

Both pages currently redirect. Replace with a real implementation using the hooks from `@smart-cv/api`.

**Common page structure:**
```tsx
function NotificationsPage() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useNotificationsList({ page, pageSize: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.data?.items ?? [];
  const meta = data?.data?.meta;
  const unreadCount = data?.data?.unreadCount ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1>Notifications {unreadCount > 0 && <span>({unreadCount} unread)</span>}</h1>
        <Button disabled={unreadCount === 0} onClick={() => markAllRead.mutate()}>
          Mark all as read
        </Button>
      </div>
      {isLoading && <Spinner />}
      {!isLoading && items.length === 0 && <EmptyState message="No notifications yet." />}
      {items.map((item) => (
        <NotificationCard
          key={item.id}
          item={item}
          onClick={() => !item.isRead && markRead.mutate(item.id)}
        />
      ))}
      {meta && meta.page < meta.totalPages && (
        <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Load more</Button>
      )}
    </div>
  );
}
```

Apply this to `_account.notifications.tsx` (web-candidate) and `employer.notifications.tsx` (web-recruiter).

---

### 12. Frontend — wire web-admin notification popover to real API

**`AdminLayout.tsx`** — replace `useNotificationsStore` reads with API hooks. Keep local `filter` and dismissal state since the API has no delete endpoint:

```tsx
import { useNotificationsList, useMarkNotificationRead, useMarkAllNotificationsRead } from '@smart-cv/api';
import type { NotificationItem } from '@smart-cv/ui';

// Keep only UI-only state in local state, not in a persisted store:
const [filter, setFilter] = React.useState<NotificationFilter>('all');
const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

const { data } = useNotificationsList({ pageSize: 20 });
const markRead = useMarkNotificationRead();
const markAllRead = useMarkAllNotificationsRead();

const apiItems: NotificationItem[] = (data?.data?.items ?? [])
  .filter((item) => !dismissed.has(item.id))
  .map((item) => ({
    id: item.id,
    title: item.title,
    message: item.body,
    createdAt: item.createdAt,
    read: item.isRead,
    tone: 'info' as const,  // API has no tone field; default to 'info'
  }));

const unreadCount = data?.data?.unreadCount ?? 0;
```

Pass `apiItems` to `NotificationPopover` in place of the previous store data. The `deleteNotification` action becomes `(id) => setDismissed((prev) => new Set(prev).add(id))` — optimistic local hide until next query refetch.

**`useNotificationsStore.ts`** — delete the file after migrating all usages in `AdminLayout.tsx`.

---

### 13. Frontend — admin push notifications (simple enable button)

Without a subscription UI, admin users will never receive push notifications. Add a minimal "Enable push notifications" button in the `AdminLayout` header (next to the bell icon):

```tsx
const { subscribe, initPushSubscription, currentPermission } = usePushNotifications();
const [pushEnabled, setPushEnabled] = React.useState(
  () => localStorage.getItem('smartcv_fcm_token') !== null
);

React.useEffect(() => {
  initPushSubscription().then(() => {
    setPushEnabled(localStorage.getItem('smartcv_fcm_token') !== null);
  });
}, []);

// In the header JSX — only show if not already enabled:
{!pushEnabled && currentPermission() !== 'denied' && (
  <Button size="sm" variant="ghost" onClick={() => subscribe().then(() => setPushEnabled(true)).catch(() => {})}>
    Enable notifications
  </Button>
)}
```

---

## Implementation order

| # | Task | Parallel with |
|---|---|---|
| 1 | `config.go` + `server.go`: wire FCM credentials | 2, 5 |
| 2 | `service.go`: fix `audienceForRecipientRole` + `isSupportedAudience` | 1, 5 |
| 3 | `handler.go`: fix `SubscribeFCMToken` to use context audience | after 2 |
| 4 | `service.go` + `consumer.go`: add `NotifyApplicationStatusChanged` | after 2 |
| 5 | `notification-hooks.ts`: add `subscribeFcmToken` / `unsubscribeFcmToken` | 1, 2 |
| 6 | Install firebase in web-recruiter + web-admin; create `firebase.ts` in both | 5 |
| 7 | Add `firebase-messaging-sw.js` + local compat scripts to all 3 `public/` dirs | 6 |
| 8 | Create `usePushNotifications` hook in all 3 apps | after 5, 7 |
| 9 | Wire candidate Settings push toggle (`_account.settings.tsx`) | after 8 |
| 10 | Add recruiter push section (`employer.settings.tsx`) | after 8 |
| 11 | Implement notifications page (`_account.notifications.tsx`) | after 5 |
| 12 | Implement notifications page (`employer.notifications.tsx`) | after 5 |
| 13 | Wire admin popover to real API + delete fake store | after 5 |
| 14 | Add admin "Enable notifications" button | after 8 |

---

## Notes

- **Firebase project setup:** Go to `console.firebase.google.com`, enable Cloud Messaging, download the service account JSON (restricted key — see security note in step 1), and copy the VAPID key from Project Settings → Cloud Messaging → Web configuration.
- **Audience consistency:** After this fix, the canonical audience strings are `"web-user"` (candidate), `"web-vendor"` (recruiter), `"web-admin"` (admin). These match `audienceFromScope` in `middleware.go`. Any new push call must use these values or the `audienceForRecipientRole` helper after it is fixed.
- **Token stale cleanup:** Tokens are cleaned up lazily — when FCM returns `not-registered`, `DeleteFCMTokenByTokenAndAudience` removes the row. Multi-device support (a user subscribed from multiple browsers) works correctly; there is no per-user token cap.
- **Background push requires HTTPS** in production. Localhost works in Chrome during development.
- **`autoAck: true` in consumer:** Application event messages are auto-acknowledged before the handler completes. If SMTP or FCM fails, the event is silently lost. Switching to manual ack + dead-letter queue is a separate task and out of scope here.
