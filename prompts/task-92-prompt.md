# CODEX PROMPT — Task 92: Phase 4 Firestore Security Rules Update

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**

- Task 89 must have extended `constants/regions.ts` with `Philippines`, `Indonesia`, `Vietnam` entries in `SUPPORTED_COUNTRIES`, `COUNTRY_TIMEZONES`, `SEA_CITIES`, `COUNTRY_CURRENCIES`, `COUNTRY_CALLING_CODES` — verify these exports are present.
- Task 90 must have verified that `createUserProfile()` in `services/firebase/firestore.ts` writes `timezone` (top-level) and `country` (nested under `location`) — no new fields were introduced.
- Task 91 must have modified `functions/src/createStripeCheckout.ts` to read `location.country` server-side and pass the resolved currency to Stripe — verify the file exists and the inlined `COUNTRY_TO_CURRENCY` map is present.
- Task 91 must have modified `functions/src/stripeWebhook.ts` to recognise PHP/IDR/VND Pro price IDs — verify the file reflects this.

> If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your response and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: [describe what is absent]
  Cannot proceed. Re-run the relevant prior task before this one.
-->
```

---

## Context

Task 92 is a **pure audit and documentation task** on `firestore.rules`. No new business logic is introduced. The goal is to:

1. Confirm that Phase 4A (Tasks 89–91) introduced no Firestore writes that are not already covered by existing rules.
2. Confirm `doesNotModifyServerOnlyFields()` still guards all server-only fields.
3. Add an explicit Phase 4 audit comment block at the top of the rules file.
4. Add a rule for any gap found — if none are found, document that outcome.

**What Phase 4A actually touched in Firestore:**
- Task 89 — constants and i18n only; no Firestore writes.
- Task 90 — verified that `timezone` (top-level) and `location.country` (nested) were already written by `createUserProfile()` since Phase 3 Tasks 81/82. No new fields.
- Task 91 — `createStripeCheckout.ts` reads `location.country` server-side (no write). `stripeWebhook.ts` writes `premium` via Admin SDK (already server-only, already in `doesNotModifyServerOnlyFields()`). No new collections, no new client-writable fields.

**The existing rules baseline (Phase 3 Task 87):**
- `doesNotModifyServerOnlyFields()` helper guards: `age`, `banned`, `premium`, `photoVerified`, `verifiedAt`, `boost`, `boostExpiresAt` (legacy alias, harmless), `stripeCustomerId`
- `/admin_queue/{docId}` and `/flags/{docId}` — `allow read, write: if false`
- `/gymCheckins/{checkinId}` — client read/write with ownership checks
- `/events/{eventId}` — client read/write with creator ownership checks
- All other collections from Phase 1/2 — covered

**What this task must NOT do:**
- Do not remove, rename, or reorder any existing rule.
- Do not modify any file other than `firestore.rules`.
- Do not add rules for collections or fields that do not exist.
- Additions only — the Phase 3 ruleset is the floor, not the ceiling.

---

## Task 92 — Phase 4 Firestore Security Rules Update

**Files to modify:**
- `firestore.rules` — add Phase 4 audit comment block; add any rules required by gap findings

---

### `firestore.rules` — Update

**Step 1 — Read the existing file in full before writing anything.**

Before making any change, read the entire current `firestore.rules` file and note:
- The exact text of the `doesNotModifyServerOnlyFields()` function
- All collection `match` blocks currently present
- The current top-of-file comment block (if any)

**Step 2 — Run the Phase 4A gap audit.**

For each item below, verify the existing rules already handle it correctly:

| Item | Expected rule coverage | Action if gap found |
|---|---|---|
| `location.country` (client-writable) | Permitted by the existing `/users/{uid}` `allow update` rule — not in `doesNotModifyServerOnlyFields()` | None expected; if absent, add explicit allowance |
| `timezone` (client-writable, top-level on user doc) | Same as above | None expected |
| `premium` (server-only) | In `doesNotModifyServerOnlyFields()` | None expected; if absent, add it |
| `boost` (server-only) | In `doesNotModifyServerOnlyFields()` | None expected; if absent, add it |
| `stripeCustomerId` (server-only) | In `doesNotModifyServerOnlyFields()` | None expected; if absent, add it |
| PHP/IDR/VND currencies | Not a Firestore field — Stripe-side only | No rule needed |
| No new collections in Phase 4A | Confirm no new `match` blocks are needed | Add `allow read, write: if false` if a collection was missed |

**Step 3 — Add the Phase 4 audit comment block.**

At the top of `firestore.rules`, directly below the existing file-level comment (or as the first comment if none exists), add:

```
// ─── Phase 4A Security Rules Audit — 2026-06-25 ───────────────────────────
// Tasks 89–91 introduced no new Firestore collections or server-only fields.
// Verified:
//   • constants/regions.ts changes (Task 89) — no Firestore writes
//   • createUserProfile() timezone + location.country writes (Task 90) — fields
//     already client-writable under existing /users/{uid} update rule
//   • createStripeCheckout.ts country read (Task 91) — server-side read only
//   • stripeWebhook.ts premium write (Task 91) — server-only, already guarded
//     by doesNotModifyServerOnlyFields()
// No new rules required for Phase 4A. Existing Phase 3 ruleset is current.
// ─────────────────────────────────────────────────────────────────────────────
```

> If Step 2 found a gap, adjust the comment to accurately reflect what was added and why.

**Step 4 — If any gap was found in Step 2, add the remediation rule.**

Show only the specific rule block being added — do not rewrite the entire file. Insert adjacent to the most relevant existing `match` block.

Example format (only if a gap is found — do not add this if Step 2 finds no gaps):

```javascript
// Added Task 92 — [reason]
match /newCollection/{docId} {
  allow read, write: if false;
}
```

**Step 5 — Run the emulator probe.**

```bash
firebase emulators:exec --only firestore "node -e \"process.exit(0)\""
```

If the emulator is not available in this environment, note that in the output and confirm the rules file is valid JSON/syntax by running:

```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('firestore.rules', 'utf8');
// Basic syntax check: ensure the file starts with rules_version
if (!content.includes('rules_version')) {
  console.error('ERROR: rules_version declaration missing');
  process.exit(1);
}
console.log('firestore.rules basic syntax check: OK');
"
```

---

## Important Architecture Notes for Codex

1. **Audit-only task.** The primary deliverable here is confirmation, not code. If the Phase 3 ruleset already covers everything (which the task spec predicts it does), the only change to `firestore.rules` is the audit comment block at the top. A zero-rule-change outcome is a correct and complete outcome.

2. **Never remove existing rules.** The Phase 3 consolidation (Task 87) is the authoritative baseline. Any removal — even of the legacy `boostExpiresAt` entry in `doesNotModifyServerOnlyFields()` — is out of scope for this task. Additions only.

3. **`doesNotModifyServerOnlyFields()` is the critical guard.** Verify its field list matches: `age`, `banned`, `premium`, `photoVerified`, `verifiedAt`, `boost`, `stripeCustomerId` (plus the harmless legacy `boostExpiresAt` entry). If any of these are absent, that is a gap — add it and document in the CHANGELOG.

4. **No client-side file changes.** This task touches `firestore.rules` only. Do not modify any TypeScript, React Native, or Cloud Function file. If a TypeScript fix seems necessary for an unrelated reason, stop and report it in the rollback block — do not fix it here.

5. **Comment block accuracy.** The audit comment must be factually accurate. If Step 2 finds a gap and a rule is added, the comment must state what was added and why. Do not copy the comment template verbatim if the facts differ.

---

## Rollback Protocol

If you encounter a conflict in `firestore.rules` that cannot be resolved without:
- Removing an existing rule, OR
- Making an assumption about a prior task's output that cannot be verified from the file itself

**Then:**
1. Do not commit any partial changes
2. Revert `firestore.rules` to its state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the conflict, the specific line, and what decision is needed
4. Stop. Do not attempt a workaround.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] No TypeScript files were modified — this check is vacuously satisfied; confirm no `.ts` or `.tsx` files appear in the diff

**Conventions**
- [ ] No i18n keys were removed or renamed — this check is vacuously satisfied; no i18n files were touched

**Firebase / Security**
- [ ] `doesNotModifyServerOnlyFields()` still guards: `age`, `banned`, `premium`, `photoVerified`, `verifiedAt`, `boost`, `stripeCustomerId`
- [ ] `/admin_queue` and `/flags` still have `allow read, write: if false`
- [ ] No existing rule was removed or weakened
- [ ] Phase 4A audit comment block is present at the top of the file
- [ ] Emulator probe passed (or basic syntax check passed with emulator unavailable note)

**Architecture**
- [ ] Only `firestore.rules` appears in the diff — no other files modified
- [ ] If no rules were needed: comment block is the only change; this is explicitly documented in the CHANGELOG entry

**Platform**
- [ ] Not applicable — no client code changed

---

## Acceptance Criteria

- [ ] `firestore.rules` contains the Phase 4A audit comment block immediately after any existing file-level comment
- [ ] `doesNotModifyServerOnlyFields()` guard list verified to include all 7 server-only fields: `age`, `banned`, `premium`, `photoVerified`, `verifiedAt`, `boost`, `stripeCustomerId`
- [ ] `/admin_queue` and `/flags` deny rules confirmed present
- [ ] No existing rule removed, weakened, or renamed
- [ ] Emulator probe passes (or basic syntax check passes with an explicit note that emulator was unavailable)
- [ ] If a gap was found: the remediation rule is added, commented, and documented in the CHANGELOG
- [ ] If no gap was found: the CHANGELOG entry explicitly states this outcome (a zero-rule-change audit is a valid, complete result)
- [ ] `npx tsc --noEmit` — zero errors (no TypeScript files were changed, so this should trivially pass)

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `services/firebase/config.ts`, `types/user.ts`, `constants/`, `i18n/`, `functions/`, `firestore.indexes.json`, any `.tsx` or `.ts` file in `app/`, `store/`, `services/`, `hooks/`, `components/`, or `utils/`.

**Only `firestore.rules` may be modified in this task.**

---

## Commit

```
git commit -m "task-92: phase 4a firestore security rules audit — no new rules required"
```

> Adjust the commit message suffix if a gap was found and a rule was added, e.g.:
> `"task-92: phase 4a firestore rules audit — added /newCollection deny rule"`

---

## After This Session

Update `CHANGELOG.md` using this template:

```
## [Phase 4A — Task 92] — YYYY-MM-DD

### Completed

- Task 92: Phase 4 Firestore Security Rules Update
- Audited firestore.rules against Phase 4A changes (Tasks 89–91)
- [Either: "No new rules required — Phase 3 ruleset covers all Phase 4A writes" OR list what was added]

### Files Created

- None

### Files Modified

- firestore.rules: Phase 4A audit comment block added [and: any rule additions if applicable]

### Architecture Decisions

- [If zero rules added: "Phase 4A introduced no new Firestore collections or server-only
  fields. The existing Phase 3 doesNotModifyServerOnlyFields() guard and collection-level
  rules cover all Task 89–91 writes. The audit comment block is the only change."]
- [If rules added: explain what was added and why the prior task missed it]

### Conflict Risks Introduced

- None — Task 93 (indexes audit) reads firestore.indexes.json only; no conflict with this file

### Known Issues / Deferred

- None

### Next Up

- Task 93: Phase 4 Firestore Indexes
```

Then attach the updated CHANGELOG.md and request the Task 93 prompt.

---

## Reasoning Level

Low
