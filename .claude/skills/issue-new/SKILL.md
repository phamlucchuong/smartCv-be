---
name: issue-new
description: File a new issue through discussion
argument-hint: <summary description>
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Write, Edit, Agent
---

# File an Issue (investigate → discuss → confirm → create)

File an issue about "$ARGUMENTS".

**Important: This skill may only create or edit issue files. It must not edit source code, configuration files, or anything else.**

## Step 1: Deep investigation

Thoroughly investigate the related information:
- **Check existing issues**: `plans/issues/`
- **Investigate related code**:
  - Backend: `backend/api-gateway/src/`, `backend/user-service/src/`, `backend/job_service/src/`, `backend/application_service/src/`, `backend/ai_engine_service/src/`, `backend/notification-service/`
  - Frontend: `frontend/apps/web-candidate/src/`, `frontend/apps/web-recruiter/src/`, `frontend/apps/web-admin/src/`, `frontend/packages/`
- **Check docs**: `docs/EN/` for backend architecture decisions

Do not conclude based on docs alone; always confirm with the code.

## Step 2: Hearing

Use AskUserQuestion to clarify:
- **What is the problem**: concrete description of the phenomenon/symptom
- **Stack**: backend service or frontend app?
- **Reproduction conditions**: which service/endpoint/page, and what triggers it
- **Expected behavior**: how it should behave

## Step 3: Create the issue file

- Issue: `plans/issues/YYYYMMDD_HHmm_[summary].md`

```markdown
# [Title]

## Overview
[Description of the problem]

## Reproduction steps
1.
2.
3.

## Expected behavior
[How it should be]

## Current behavior
[How it actually behaves]

## Impact scope
Backend:
- [ ] api-gateway
- [ ] user-service
- [ ] job_service
- [ ] application_service
- [ ] ai_engine_service
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
[Files / functions identified during the investigation]

## Notes
[References to related issues or docs]
```

Write thoroughly to eliminate ambiguity; bring it to a level where it can be implemented without hesitation.

## Step 3.5: Verification with plan-reviewer (required)

Invoke three plan-reviewer agents before asking the user to confirm. Fix any findings and re-run until zero findings.

## Step 4: Confirmation

Share the plan-reviewer-verified issue file with the user and apply any revisions. Re-run plan-reviewer after revisions.
