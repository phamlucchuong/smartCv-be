# AI CV Analysis Fails: `AuthorizationQueryParametersError` When Fetching CV from S3

## Overview

When `ai_engine_service` analyzes a CV by ID, it fetches the PDF from S3 using a presigned URL. The fetch
always fails with HTTP 400 `AuthorizationQueryParametersError: the Credential is mal-formed`.

Root cause: `CvTextExtractor.resolveCvText()` passes the presigned URL as a raw `String` to
`restTemplate.getForObject(cvUrl, byte[].class)`. Spring's `RestTemplate.getForObject(String, ...)`
routes through `DefaultUriBuilderFactory` (EncodingMode=`TEMPLATE_AND_VALUES`), which parses the string
as a URI template and applies normalization/re-encoding. The exact transformation that corrupts the
`X-Amz-Credential` query parameter (e.g. unencoded `/` separators, double-encoded `%25`, or query string
re-parsing) is a Spring URI-handling implementation detail — but the symptom is consistent and the fix is
unambiguous. The `URI` version of `getForObject` bypasses this pipeline entirely.

## Reproduction steps

1. Upload a CV (PDF) via web-candidate.
2. Trigger AI analysis (candidate dashboard → "Phân tích CV").
3. `ai_engine_service` calls `user-service GET /api/internal/candidates/cvs/{cvId}`.
4. `user-service` returns a fresh presigned S3 URL (confirmed correct format, `isPresigned=true`).
5. `CvTextExtractor.resolveCvText(null, cvUrl)` calls `restTemplate.getForObject(cvUrl, byte[].class)`.
6. Spring re-encodes `%2F` → `%252F` inside `X-Amz-Credential`.
7. S3 returns 400 `AuthorizationQueryParametersError`.
8. `AI_PROCESSING_FAILED` exception propagates to the client.

## Expected behavior

CV file is fetched from S3 successfully, text is extracted with PDFBox, AI analysis proceeds normally.

## Current behavior

```
ERROR Failed to extract CV text: 400 Bad Request on GET request for
"https://smartcv-bucket-….amazonaws.com/cvs/…/file.pdf?X-Amz-Credential=AKID%2F…":
AuthorizationQueryParametersError: the Credential is mal-formed; expecting
"<YOUR-AKID>/YYYYMMDD/REGION/SERVICE/aws4_request"
WARN  Resolved [AppException: AI processing failed]
```

Every AI CV analysis triggered by cvId fails. Analysis via direct `cvText` upload (which bypasses S3)
still works.

## Impact scope

Backend:
- [ ] api-gateway
- [x] user-service — prerequisite patch already applied (`CandidateService.getCvInfo()`)
- [ ] job_service
- [ ] application_service
- [x] ai_engine_service — `CvTextExtractor.resolveCvText()` is the root fix
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

### Fix (1 line)

**`backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/integration/cv/CvTextExtractor.java:30`**

```java
// Before (broken — Spring re-encodes %2F → %252F in presigned URL params)
byte[] fileBytes = restTemplate.getForObject(cvUrl, byte[].class);

// After (correct — URI.create() skips DefaultUriBuilderFactory entirely)
byte[] fileBytes = restTemplate.getForObject(URI.create(cvUrl), byte[].class);
```

Add import: `java.net.URI`

`URI.create(cvUrl)` treats the string as an already-valid URI (RFC 3986), bypassing Spring's template
expansion and re-encoding entirely. `RestTemplate.getForObject(URI, Class)` goes directly to
`doExecute()` with no transformation. This fix covers all callers of `resolveCvText()` (`analyzeCv`,
`autoScore`, `extractSkills`, RabbitMQ consumers, etc.) since the encoding happens inside this method.

If `cvUrl` is malformed (e.g. a legacy non-URL value), `URI.create()` throws `IllegalArgumentException`
which is caught by the existing `catch (Exception e)` block and surfaces as `AI_PROCESSING_FAILED` —
acceptable fail-fast behavior, do not add a try-catch around it.

### Prerequisite patch (already applied, do not revert)

**`backend/user-service/.../features/candidate/CandidateService.java:392`**

```java
// getCvInfo() now generates a fresh presigned URL at query time instead of returning the stored (expired) URL
String url = cv.getS3Key() != null ? s3Service.generateFreshUrl(cv.getS3Key()) : cv.getUrl();
```

### Diagnostic code to remove (cleanup task)

These were added during debugging and must be removed after the fix is verified:

1. **`CandidateService.java`**
   - Remove `@Slf4j` annotation
   - Remove `import lombok.extern.slf4j.Slf4j;`
   - Remove `log.info("[getCvInfo] cvId={} s3Key={} isPresigned={} url={}", ...)` line

2. **`S3Config.java`** — the `@PostConstruct validateCredentials()` logs a WARN at startup if
   `AWS_ACCESS_KEY_ID` is blank. This has ongoing operational value for catching misconfiguration early.
   **Decision for implementer**: keep it as a permanent startup validator (remove the "debugging" framing)
   OR remove it and rely on the first failed S3 operation to surface the misconfiguration.
   - If removing: delete `@Slf4j` annotation, `import lombok.extern.slf4j.Slf4j;`,
     `import jakarta.annotation.PostConstruct;`, and the entire `validateCredentials()` method.
   - If keeping: no changes needed in this file.

## Verification

After applying the fix, trigger AI analysis again and confirm:
- No `AuthorizationQueryParametersError` in `backend/logs/ai-engine-service.log`
- No `AI_PROCESSING_FAILED` WARN log
- CV analysis result appears in the candidate dashboard

## Notes

- IAM key confirmed active. Credentials load correctly at startup (`key=AKIA***`).
- The presigned URL generated by user-service is confirmed correct format: `isPresigned=true`,
  `X-Amz-Credential=AKIAV7Q6UIEQXX65NOGI%2F20260618%2Fap-southeast-2%2Fs3%2Faws4_request`.
- **Known limitation — legacy CVs**: For CVs without an `s3Key` (uploaded before this field was added),
  `getCvInfo()` falls back to `cv.getUrl()` (stored URL, potentially expired). AI analysis for these CVs
  will fail with `403 RequestExpired` even after this fix. Fix: user must re-upload the CV.
- **RabbitMQ consumer paths** (`SkillExtractionConsumer`, `CvScoringConsumer`): these publish the
  upload-time presigned URL via RabbitMQ and call `resolveCvText()`. They hit the same encoding bug
  (fixed by this change) AND separately may have a URL expiry issue if the message is delayed beyond
  60 min TTL. The expiry issue is out of scope for this fix.
- Spring best practice: always use `URI.create(url)` (or `URI url` overloads) with `RestTemplate` for
  pre-encoded URLs such as OAuth tokens, presigned URLs, and URLs with percent-encoded query values.
- Audit other `getForObject(String, ...)` / `exchange(String, ...)` callers in `ai_engine_service` for
  the same pattern if they ever pass presigned URLs.
