---
name: issue
description: Start an issue and drive it end-to-end through investigation → planning → TDD implementation → close-out
argument-hint: <start|close> [issue-filename]
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Agent
---

# Issue Workflow

Operation: $0

## When $0 = "start"

### Phase 1: Investigation

1. **Read the issue**: read the file path provided in `$1` and understand its contents
   - Issues live under `plans/issues/`
2. **Evaluate existing context**: if the current conversation already contains enough investigation results, skip to Phase 2
3. **Supplementary investigation**:
   - Backend: review `docs/EN/` for architecture decisions; grep code under:
     - `backend/api-gateway/src/`
     - `backend/user-service/src/`
     - `backend/job_service/src/`
     - `backend/application_service/src/`
     - `backend/ai_engine_service/src/`
     - `backend/notification-service/`
     - Tests: `backend/<service>/src/test/` (Java), `backend/notification-service/**/*_test.go` (Go)
   - Frontend: grep code under:
     - `frontend/apps/web-candidate/src/`
     - `frontend/apps/web-recruiter/src/`
     - `frontend/apps/web-admin/src/`
     - `frontend/packages/`

### Phase 2: Requirements confirmation

Report and ask via AskUserQuestion if unclear:
- **Summary of the problem**: 1-2 sentences
- **Impact scope**: list of related files
- **Hypothesis for the cause**: current best guess
- **Candidate approaches**: 2-3 options (with pros and cons)

Always ask before moving on if: wording is ambiguous, scope is large, business logic intent is unclear, or the change could be breaking.

**Obtain the user's approval** before moving to the next Phase.

### Phase 3: Create the branch

```bash
git checkout dev && git pull && git checkout -b fix/[issue-name]
```

### Phase 4: TDD implementation

**Do not write code before writing the test.**

**Red → Green → Refactor → Verify**

Backend (Java service):
```bash
cd backend/<service-dir> && ./mvnw test -Dtest=<TargetTest>
cd backend/<service-dir> && ./mvnw clean install -DskipTests
```

Backend (Go notification):
```bash
cd backend/notification-service && go test ./... -v -run <TestName>
cd backend/notification-service && go build ./cmd/server
```

Frontend:
```bash
cd frontend && pnpm -F <app> lint
cd frontend && pnpm -F <app> build
```

After refactoring, re-confirm all tests pass. Invoke the code-reviewer agent. Address findings and loop back from Verify.

### Phase 5: API smoke test (backend endpoint changes only)

1. `make compose-up`
2. `make run-<service>`
3. Hit the endpoint via Postman (`backend/postman/`) or curl
4. Confirm response matches expected behavior

---

## When $0 = "close"

### Step 1: Learning feedback (required)

1. **What was changed**: files and key points
2. **Code walkthrough**: quote changed code, explain line by line, explain language features used
3. **Rationale**: why this approach vs alternatives
4. **Patterns to learn**: design principles involved
5. **Pitfalls**: things easy to get wrong
6. **Tips for the next instruction**: how to phrase it better next time

### Step 2: Knowledge promotion

Use AskUserQuestion to decide:
- **Recurring pitfall** → add one line to the Important section of the relevant `CLAUDE.md`
- **Architecture decision** → add to `docs/EN/architecture-decisions.md`
- **No promotion needed** → skip

### Step 3: Design decision log

Append to `docs/EN/architecture-decisions.md` when: a library/tool was selected, architecture was changed, a choice was made after considering alternatives.

```markdown
## YYYY/MM/DD: [the decision]
- **Background**: why this decision was needed
- **Rejected options**: alternatives and why rejected
- **Decision**: what was chosen
- **Impact**: the impact of this decision
```

### Step 4: Update the plan (if applicable)

Update relevant task status in `docs/`.

### Step 5: Move the issue file

```bash
mv "plans/issues/$1" "plans/issues/✅/✅$(basename $1)"
```

### Step 6: Commit & open PR into dev

```bash
git add -A && git commit -m "docs: [issue name] close-out"
gh pr create --base dev --title "fix: [issue name]" --body "..."
```

Ask the user before pushing or creating the PR.

### Step 7: Completion check

Report the results of every step.
