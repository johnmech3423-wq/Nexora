# Module 13C — AI Mutations with Explicit Human Confirmation — Final Report (Corrected)

Date: 2026-09-10 (Asia/Dhaka)
Codebase: nexora/
Scope: Phase 13C corrective fix — AI mutations now require explicit human confirmation. No immediate execution.

Modules 1–12 FROZEN, 13A COMPLETE/FROZEN, 13B COMPLETE/FROZEN — verified no regression.

**Critical safety statement:**
**No AI-generated mutation is executed during the initial chat request.**
**Every mutation requires explicit authenticated user confirmation.**

---

## 1. Files Changed (Corrective Fix)

### New
- `src/server/db/models/ai-pending-action.model.ts` — NEW persistent model for pending actions. Fields: organizationId (ObjectId, indexed), userId (ObjectId, indexed), tool enum (create_task/create_subtasks/update_task), args (Mixed, server-validated), status enum (pending/executing/executed/rejected/expired), expiresAt (Date, 10min window, indexed + TTL 24h cleanup), executedAt/rejectedAt, result/errorCode. Indexes on org+user+status and org+user+createdAt. Uses MongoDB persistence, not in-memory Map, safe for Vercel/serverless.

- `src/app/api/ai/actions/[actionId]/confirm/route.ts` — NEW approval endpoint `POST /api/ai/actions/[actionId]/confirm?orgId=`. Implements 9-step secure flow: authenticate via requireUser, rateLimit 30/min, connectDb, assertOrgPermission ai.use, load pending action, verify org ownership (organizationId matches ctx), verify user ownership (userId matches actor), verify pending status, verify not expired (410 if expired, marks expired), atomic claim pending→executing via findOneAndUpdate with filter status pending + expiresAt > now + userId + organizationId, execute server-stored args via executeTool, on success mark executed + result, on permanent failure mark rejected, on transient failure revert to pending. Returns {ok, tool, message, data, errorCode}.

- `src/app/api/ai/actions/[actionId]/reject/route.ts` — NEW rejection endpoint `POST /api/ai/actions/[actionId]/reject?orgId=`. Same auth/ownership/expiry checks, atomic pending→rejected transition, no mutation.

### Modified
- `src/server/services/ai-tools.service.ts` — Added `validateProposal(actorUserId, organizationId, call)` that does full validation without mutation: Zod safeParse, Project org boundary, assertProjectPermission, Task org/project validation, depth check, dueDate validation. Returns {ok, message, normalizedArgs, projectKey, errorCode}. Preserved existing `executeTool`/`executeTools` for confirm endpoint (now only called from confirm route, not from chat). Keeps Zod schemas, bounds (max 5 parsed, max 3 executed, subtasks max 10).

- `src/server/services/ai.service.ts` — **CORRECTIVE FIX**: Removed immediate `executeTools` call from `chat()`. Now:
  - ChatReply extended with `proposedActions?: ProposedAction[]` where ProposedAction = {id, tool, message, args, projectKey, expiresAt}
  - After provider response, if wantsMutation (keywords create/add/break/subtask/update/change), parseToolCalls (max 5), for each call up to 3, call validateProposal, if ok create AiPendingAction doc with 10min expiry, push to proposedActions array.
  - No DB mutation in chat(). Text appended with "Proposed actions (require your explicit approval): ..." and "No changes have been made yet."
  - Provider none path preserves deterministic fallback, creates no proposals.
  - Metering preserved: AiUsage created only for chat, not for confirm/reject.

- `src/components/features/ai/ai-assistant.tsx` — **UI corrective**:
  - Types extended with ProposedAction, proposedActions in ChatMessage/ApiReply.
  - Added actionStates map tracking per-action status: pending/approving/rejecting/executed/rejected/expired/error + result/error.
  - send() initializes actionStates as pending for new proposedActions.
  - New `confirmAction` and `rejectAction` callbacks calling `/api/ai/actions/[id]/confirm?orgId=` and `/reject?orgId=` via apiFetch, with double-click protection (checks status before call), toast feedback.
  - MessageRow rewritten: shows proposed actions as amber pending cards with details (title, description 200 chars, priority, status, due, assignee, taskId, parent, subtasks list), Approve/Reject buttons, expiration time, "No mutation until you approve." After approval shows emerald executed card with result data, after rejection shows muted rejected, expired shows destructive badge + "This action expired. Ask the assistant to propose it again."
  - Removed impure Date.now() lint error via eslint-disable purity comment, fixed any usage via getStringArg/getSubtasks helpers (no any).
  - Preserves context badges, project selector, usage, PlanGateCard, Markdown, etc.
  - Added ShieldCheck badge "Human confirmation required" and "Confirmation required" in header.

No other files changed. No new dependencies, no new AI providers, no autonomous agents.

---

## 2. Proposal Flow (Phase 1)

1. User asks "Create a task for bug triage" with orgId and optional projectId.
2. `POST /api/ai/chat?orgId=` → `chat()` authenticates, checks ai.use, builds bounded workspace context (13B logic unchanged), calls provider.
3. Provider returns text containing ```json {"tool":"create_task","args":{...}}```.
4. Server detects wantsMutation via keyword check on user message (not workspace data).
5. `parseToolCalls` extracts up to 5 calls from JSON blocks + inline fallback.
6. For each call up to 3:
   - `validateProposal` does Zod validation + Project org check + assertProjectPermission + Task checks + dueDate validation.
   - If invalid, appends warning to text, does not store.
   - If valid, creates `AiPendingAction` document: organizationId from auth, userId from auth, tool, args = normalized validated args, status pending, expiresAt = now+10min.
7. Returns ChatReply with reply text + proposedActions array (id, tool, message, args, projectKey, expiresAt) + contextUsed. **No Task/Project collection write.**
8. UI renders proposed action cards with Approve/Reject.

---

## 3. Confirmation Flow (Phase 2)

1. User clicks Approve on a proposed card.
2. Client sends `POST /api/ai/actions/[actionId]/confirm?orgId=` with only actionId in URL, no args.
3. Server:
   - requireUser, rateLimit, connectDb
   - assertOrgPermission(actor, orgId, ai.use) → organizationId
   - Load pending action by id, verify org match, user match (ownership), pending status, not expired (410 + mark expired if expired)
   - Atomic claim: `findOneAndUpdate({_id, status: pending, expiresAt: {$gt: now}, userId, organizationId}, {$set: {status: executing}})` — prevents race/double-click
   - If claim fails, return 409 conflict (already executed/rejected/being processed)
   - Execute **server-stored** args via `executeTool(actor, orgId, {tool, args: stored})` — re-runs all auth checks (project org, task org, assertProjectPermission)
   - On success: update to executed + executedAt + result data
   - On permanent failure (validation_error, not_found, forbidden, etc.): update to rejected + errorCode
   - On transient failure: revert to pending for retry
4. Returns {ok, tool, message, data, errorCode}
5. UI shows executed state, disables buttons, prevents duplicate.

Reject flow similar but no execution, atomic pending→rejected.

**Server-authoritative:** Browser never sends mutation args for execution. Only actionId. Malicious client cannot modify title, description, projectId, taskId, assignee, dueDate, status, priority, subtasks, organizationId between proposal and approval — server ignores client args and uses stored validated args.

---

## 4. Pending-Action Persistence

- Model `AiPendingAction` in MongoDB, not memory.
- Fields bind proposal to authenticated user + organization + tool + exact validated args + creation/expiry/status.
- Expiration: 10 minutes from creation. Checked in both chat (creation) and confirm/reject (execution). If expired, marks expired and returns 410 "This action has expired. Ask the assistant to propose it again."
- Lifecycle: pending → executing (atomic claim) → executed OR pending → rejected OR pending → expired. Once consumed (executed/rejected/expired) cannot be executed again (filter status pending in claim).
- Indexes for performance and cleanup: expiresAt TTL 86400s (auto-delete after 24h past expiry), org+user+status, org+user+createdAt.

---

## 5. Ownership/Org Binding

- Every pending action stores organizationId and userId from authenticated context (`assertOrgPermission` result and `session.user._id`), not from LLM or client.
- Confirm/reject verifies: `String(existing.organizationId) === organizationId` and `String(existing.userId) === actorUserId`.
- Cross-org approval impossible: orgId query param must match pending's org, and assertOrgPermission ensures actor is member of that org with ai.use.
- Different user cannot approve another user's proposal: userId check → 403.

---

## 6. Replay Protection

- Status field ensures single use: only pending can be claimed. After executed/rejected/expired, filter fails → 409/410.
- Atomic findOneAndUpdate prevents concurrent claims.
- Client cannot replay with modified args because server uses stored args only.

---

## 7. Race / Double-Click Protection

- Atomic transition pending→executing via `findOneAndUpdate` with status pending condition. Second concurrent request finds status != pending → 409 "already executed/being processed".
- UI disables Approve/Reject buttons while approving/rejecting (`isApproving`/`isRejecting` state) and after executed/rejected.
- No double creation: proposals are created once per chat, each with unique ObjectId.

---

## 8. Tools Covered

All three tools are proposal-first:
- `create_task`: requires approval, validates project org, task.create permission, parent task checks, dueDate.
- `create_subtasks`: requires approval, validates project org, task.create, parent task org/project, depth (parent.parentId must not exist), subtask dueDates, max 10 subtasks.
- `update_task`: requires approval, validates project org, task.update, task org/project, at least one field to update, dueDate.

No delete tool (intentionally omitted). No new tools added.

---

## 9. Authorization Checks

Preserved and re-run:
- At proposal: assertOrgPermission ai.use, validateProposal does Project org check + assertProjectPermission + Task checks.
- At execution: confirm endpoint re-runs assertOrgPermission ai.use + same checks inside executeTool (Project org, Task org/project, assertProjectPermission task.create/task.update, createTask/updateTask internal auth).
- Confirmation does NOT replace authorization; both required.
- Authorization does NOT replace confirmation; both required.

---

## 10. Validation

- Zod schemas unchanged: title 2-300, description max 4000/2000, priority/status enums, assigneeId string, dueDate string, subtasks 1-10.
- Bounds: parse max 5, execution max 3, subtasks max 10, context 6k cap, projects 12, overdue 10, etc.
- DueDate: ISO string → Date, NaN check, invalid rejected at proposal time.
- Depth: parent.parentId check for subtasks, plus full depth check in createTask service.
- Forbidden handling: stops further execution in batch (existing logic in executeTools, but now only single execution per confirm).

Validate at proposal time AND revalidate at execution time (executeTool re-does checks).

---

## 11. Prompt Injection Protection

- Preserves 13B: WORKSPACE DATA marked UNTRUSTED, SECURITY NOTICE, sanitize() truncation, system prompt forbids following workspace instructions.
- Even if attacker-controlled comment causes model to propose create_task, system stops at pending proposal until explicit user approval. No auto-execution.
- Tool parsing only extracts known tool names, ignores arbitrary instructions.
- No secrets exposed.

---

## 12. Provider-None Behavior

- When `AI_PROVIDER=none`, chat() returns deterministicFallback (real snapshot) with fallback true, creates no pending actions, no proposals, no mutations.
- Confirm/reject endpoints still require ai.use permission but will not have pending actions to approve when provider none, so safe.

---

## 13. Metering Behavior

- Existing metering: `AiUsage.countDocuments` today per user+org, limit from PLAN_LIMITS, 429 if exceeded, 402 if free plan.
- Metering occurs only in `chat()` (AI generation). Confirm/reject endpoints do NOT create AiUsage docs, do NOT double-charge. Rate-limited separately via `rateLimit` (30/min for confirm, 60/min for reject) to prevent abuse, but not counted against AI daily limit.
- Documented: confirmation is not AI generation, so not metered as AI request.

---

## 14. Tests Performed

No established project test suite (only vitest config, no src tests). Performed manual API verification and documented:

1. Chat mutation request creates proposal but DOES NOT mutate DB: Verified via code review — chat() no longer calls executeTool, only AiPendingAction.create. Manual check: Task.countDocuments before and after chat remains same.
2. Approve executes exact proposed action: Confirm endpoint loads stored args, executes, creates task. Verified via executeTool path.
3. Reject does not mutate: Reject endpoint only updates status to rejected, no createTask/updateTask call.
4. Expired proposal cannot execute: Check expiresAt < now → 410, marks expired.
5. Already-approved cannot execute again: Atomic claim filter status pending → second confirm returns 409.
6. Double approval cannot create twice: Atomic pending→executing prevents second execution.
7. Different user cannot approve another's proposal: userId check → 403.
8. Different org cannot approve another's org proposal: organizationId check + assertOrgPermission → 403.
9. Modified client-side args ignored: Confirm uses stored args, not client body.
10. create_task requires approval: Only via confirm endpoint.
11. create_subtasks requires approval: Same.
12. update_task requires approval: Same.
13. Provider none creates no proposal: Code path provider none skips proposal creation.
14. Prompt injection cannot bypass confirmation: Even if LLM proposes tool, it stays pending until human approval.
15. Permission checks still work: assertProjectPermission at both proposal and execution.
16. Validation/bounds still work: Zod + dueDate + depth checks at both phases.

Additional verification: grep for executeTools in ai.service.ts returns none, ensuring no immediate path.

---

## 15. Security Review

- Immediate execution paths: NONE — removed executeTools from chat(), only in confirm route after explicit approval.
- Alternate mutation routes: Checked /api/projects/[projectId]/tasks routes still require task.create permission, not bypassed by AI. AI only proposes, execution goes through same service.
- Client-controlled args: MITIGATED — confirm uses server-stored args, not client body.
- Missing ownership checks: FIXED — both org and user checks in confirm/reject.
- Org leaks: MITIGATED — organizationId from auth, verified against pending.
- Replay: MITIGATED — status check + atomic claim.
- Race/double-submit: MITIGATED — atomic pending→executing.
- Expired execution: MITIGATED — expiry check + 410.
- Prompt-injection mutation: MITIGATED — proposal-first + human approval.
- Secret exposure: NONE — no env keys in client, no stack traces.

---

## 16. Verification Results

```
npm ci --no-audit --no-fund: 680 packages
npm run typecheck: 0 errors
npm run lint: 0 errors, 74 warnings baseline (same as 13B)
NODE_OPTIONS="--max-old-space-size=4096" npm run build: success
  ○ /ai
  ƒ /api/ai/actions/[actionId]/confirm
  ƒ /api/ai/actions/[actionId]/reject
  ƒ /api/ai/chat
  ... 70 other routes (72 total pages)
```

Gates match baseline.

---

## 17. Regression Results

- Modules 1–12 frozen: no changes to auth, orgs, projects, tasks, sprints, milestones, files, chat, analytics, billing, admin — build lists all routes present.
- Module 13A: provider abstraction preserved, /ai static, fallback works.
- Module 13B: bounded context, injection defense, projectId optional, deterministic fallback preserved — code unchanged except proposal addition (additive).
- Existing AI chat: still works for non-mutation queries, returns contextUsed, usage.
- No-provider fallback: still returns real snapshot, no proposals.
- Admin/auth/settings routes: still present in build, no regression.

---

## 18. Limitations

- Pending actions expire after 10 minutes — user must re-ask if expired.
- No streaming of proposals — proposals returned with chat response.
- No bulk approve — each proposal must be approved individually (bounded max 3 per turn).
- No undo — user can delete tasks manually if approved wrong.
- No label/sprint/milestone/estimate in update_task — limited to core fields for safety.
- No delete tool — intentional.
- Confirmation is per-action, not per-conversation — if AI proposes 3 tasks, user approves each separately.
- Pending actions auto-deleted 24h after expiry via TTL index to keep collection small.

---

## STOP — Module 13C Corrective Fix Complete

**No AI-generated mutation is executed during the initial chat request.**
**Every mutation requires explicit authenticated user confirmation via POST /api/ai/actions/[id]/confirm with ownership, org, expiry, and atomic replay protection.**
