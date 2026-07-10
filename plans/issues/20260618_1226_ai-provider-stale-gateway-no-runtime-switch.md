# AI Provider: Stale In-Memory Gateway and Non-Configurable Seed Priority

## Overview

Two related problems in `ai_engine_service` that together make it impossible to switch AI providers without code changes or restarting with the right DB state:

**Problem A — Stale in-memory gateway after direct DB change.**
`AiModelGatewayRouter.activeGateway` is set once at startup by `@PostConstruct init()`. If the active provider is changed directly in MongoDB (via mongosh, Compass, or any DB tool) the running service never picks it up — it continues routing to the gateway that was loaded at startup. The only safe runtime switch is via the admin API (`PUT /ai/api/ai/admin/providers/{provider}/activate`), which calls `router.activate()` and updates both MongoDB and the in-memory field atomically. This invariant is invisible; there is no log message and no comment on `activeGateway` explaining it.

**Problem B — Auto-seeder hardcodes GROQ as first priority; no env-var override.**
`autoSeedFromEnv()` iterates a hard-coded `List.of(GROQ, GEMINI, ANTHROPIC, AZURE_OPENAI)`. When `GROQ_API_KEY` is set in `.env` and MongoDB is empty (first run, fresh DB), GROQ is always seeded as the active provider. If GROQ is network-blocked (403 "Access denied. Please check your network settings." — common on WSL2, behind corporate proxies, or in certain regions) there is no fallback: the service seeds GROQ, every AI call fails, and the developer cannot switch to GEMINI without either calling the admin API (which requires an admin JWT) or manually editing MongoDB.

## Reproduction steps

**Problem A:**
1. Service starts with GROQ active in MongoDB. Log shows `AI gateway initialized with provider: GROQ`.
2. Developer updates MongoDB directly: `db.ai_provider_configs.updateOne({provider:"GROQ"},{$set:{active:false}}); db.ai_provider_configs.insertOne({provider:"GEMINI",...,active:true})`.
3. Developer triggers CV analysis without restarting the service.
4. `GroqModelGateway.call()` is invoked — the old in-memory gateway is used. The DB change is silently ignored.

**Problem B:**
1. Fresh DB (or after `db.ai_provider_configs.deleteMany({})`). `GROQ_API_KEY` is set in `.env`. `GEMINI_API_KEY` is also set.
2. Service starts. `autoSeedFromEnv()` picks GROQ because it is first in the hard-coded list.
3. GROQ is network-blocked in the developer's environment. Every AI call returns 403.
4. Developer cannot switch to GEMINI without: (a) obtaining an admin JWT and calling the admin API, or (b) manually inserting a GEMINI document into MongoDB AND restarting the service.

## Expected behavior

- **Problem A:** When `init()` sets `activeGateway`, it logs a clear INFO message: `"AI gateway in-memory state: provider=GROQ (restart or use admin API to switch)"`. The `activeGateway` field carries a comment explaining the invariant. On startup, when a DB document is found, the log message is explicit enough that a developer immediately knows what provider the running service is using.
- **Problem B:** Developers can set `AI_DEFAULT_PROVIDER=gemini` in `.env`. The auto-seeder respects this to determine which provider to try first. No code change or JWT is needed to prefer GEMINI over GROQ at seed time.

## Current behavior

- Problem A: `init()` logs `"AI gateway initialized with provider: GROQ"` (one line, no hint that direct DB changes won't take effect). There is no warning that the in-memory state must be updated via the admin API for a live switch.
- Problem B: `autoSeedFromEnv()` always prefers GROQ. `GEMINI_API_KEY` in `.env` is ignored if `GROQ_API_KEY` is also set.

## Impact scope

Backend:
- [ ] api-gateway
- [ ] user-service
- [ ] job_service
- [ ] application_service
- [x] ai_engine_service
- [ ] notification-service
- [ ] Infrastructure (Docker / RabbitMQ / MongoDB / Elasticsearch)

Frontend:
- [ ] web-candidate
- [ ] web-recruiter
- [ ] web-admin
- [ ] packages/ui
- [ ] packages/api
- [ ] packages/i18n

## Related code

| Location | Relevance |
|---|---|
| `backend/ai_engine_service/.../model/AiModelGatewayRouter.java:26` | `private volatile AiModelGateway activeGateway` — the in-memory field that is NOT refreshed by direct DB changes |
| `AiModelGatewayRouter.java:30-36` | `init()` — sets `activeGateway` from MongoDB once at startup |
| `AiModelGatewayRouter.java:39-54` | `autoSeedFromEnv()` — hardcoded GROQ-first list |
| `AiModelGatewayRouter.java:85-97` | `activate()` — the ONLY correct runtime-switch path; updates both DB and in-memory |
| `backend/ai_engine_service/.../features/admin/AiAdminController.java:13` | `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` — all admin endpoints require admin JWT |
| `backend/ai_engine_service/.../config/AiProviderProperties.java` | `@ConfigurationProperties(prefix = "app.ai.providers")` — already binds per-provider keys but has no `defaultProvider` field |
| `backend/ai_engine_service/src/main/resources/application.yaml:51-66` | `app.ai.providers.*` env var bindings; `AI_DEFAULT_PROVIDER` does not yet exist |

## Fix spec

### 1. Add `AI_DEFAULT_PROVIDER` env var (Problem B)

**`application.yaml`** — add under `app.ai:`:
```yaml
app:
  ai:
    default-provider: ${AI_DEFAULT_PROVIDER:groq}
    providers:
      ...
```

**`AiModelGatewayRouter.java`** — inject `defaultProvider` via `@Value` (NOT via `AiProviderProperties`, which is `prefix = "app.ai.providers"` — adding a field there would bind to `app.ai.providers.default-provider`, not `app.ai.default-provider`):
```java
@Value("${app.ai.default-provider:groq}")
private String defaultProvider;
```

**`AiModelGatewayRouter.autoSeedFromEnv()`** — put the preferred provider first using `Stream.concat`, then append the rest in their current fallback order:
```java
AiProvider preferred = AiProvider.from(defaultProvider);
Map<AiProvider, AiProviderProperties.ProviderProps> all = Map.of(
    AiProvider.GROQ,         providerProperties.getGroq(),
    AiProvider.GEMINI,       providerProperties.getGemini(),
    AiProvider.ANTHROPIC,    providerProperties.getAnthropic(),
    AiProvider.AZURE_OPENAI, providerProperties.getAzureOpenai()
);
List<AiProvider> order = Stream.concat(
    Stream.of(preferred),
    Stream.of(AiProvider.GROQ, AiProvider.GEMINI, AiProvider.ANTHROPIC, AiProvider.AZURE_OPENAI)
          .filter(p -> p != preferred)
).collect(Collectors.toList());

order.stream()
    .map(p -> Map.entry(p, all.get(p)))
    .filter(e -> e.getValue().isConfigured())
    .findFirst()
    ...
```

`.env` example usage: `AI_DEFAULT_PROVIDER=gemini` → seeds GEMINI first when DB is empty.

> **Prerequisite**: `autoSeedFromEnv()` is only called when `repository.findByActiveTrue()` returns empty. If GROQ is already active in MongoDB (the current default state after first startup), setting `AI_DEFAULT_PROVIDER` alone has no effect. To force a re-seed: delete the existing record first (`db.getSiblingDB('smartcv_ai').ai_provider_configs.deleteMany({})`) then restart. Implementers must add this prerequisite to the `.env.example` comment for `AI_DEFAULT_PROVIDER`.

`AiProvider.from()` throws `IllegalArgumentException` on unknown input. Add a guard so a typo in `AI_DEFAULT_PROVIDER` is visible:
```java
AiProvider preferred;
try {
    preferred = AiProvider.from(defaultProvider);
} catch (IllegalArgumentException e) {
    log.warn("Unknown AI_DEFAULT_PROVIDER='{}', falling back to GROQ-first order. Valid values: groq, gemini, anthropic, azure_openai", defaultProvider);
    preferred = AiProvider.GROQ;
}
```

### 2. Improve startup log and add field comment (Problem A)

**`AiModelGatewayRouter.java:26`** — add comment:
```java
// In-memory gateway: updated only at startup (init()) or via admin API activate().
// Direct MongoDB changes do NOT update this field — restart the service or call
// PUT /ai/api/ai/admin/providers/{provider}/activate for a live switch.
private volatile AiModelGateway activeGateway;
```

**`init()` — improve log message** (line 33):
```java
log.info("AI gateway in-memory state loaded: provider={} — to switch live, call PUT /ai/api/ai/admin/providers/{{provider}}/activate",
    config.getProvider());
```

### 3. Tests

- `AiModelGatewayRouterTest`: add test `init_respects_AI_DEFAULT_PROVIDER_for_seed_order()` — pass props with `defaultProvider=gemini`, GROQ key and GEMINI key both set, assert GEMINI is seeded.

## Notes

- **Correct runtime switch path** (no restart needed): call `PUT /ai/api/ai/admin/providers/{provider}/activate` with an admin-role JWT. This calls `AiAdminService.activate()` → `router.activate()` which deactivates the current provider in MongoDB and sets `activeGateway` atomically.
- **Immediate workaround for network-blocked GROQ**: set `AI_DEFAULT_PROVIDER=gemini` in `backend/.env`, delete the GROQ record from MongoDB (`db.getSiblingDB('smartcv_ai').ai_provider_configs.deleteMany({})`), restart `ai_engine_service`. The auto-seeder will pick GEMINI.
- The admin API requires `ROLE_ADMIN` authority. There is no lower-privilege or unauthenticated override endpoint for dev environments; this is intentional (API keys stored in DB). The `AI_DEFAULT_PROVIDER` env var approach solves the problem at the level where it hurts (first run / fresh DB) without weakening security.
