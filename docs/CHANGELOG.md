# CHANGELOG.md — [APP_NAME]

> Update this file at the end of every completed phase or significant implementation session. The Architect reads the latest entry to restore context at the start of each new session.

---

## Format

```
## [Phase X.Y] — YYYY-MM-DD
### Completed
- List of what was built

### Files Created / Modified
- path/to/file.ts: description

### Schema Changes
- Any Firestore collection or field additions/changes

### Known Issues / Deferred
- Anything skipped or flagged for later

### Next Up
- What Phase X.Y+1 should tackle
```

---

## [Phase 0.1] — April 2026

### Completed
- Full document audit and revision session (claude.ai)
- ARCHITECT.md revised: fixed swipe schema conflict (subcollection structure), added missing user fields (`paused`, `banned`, `expoPushToken`, `reportedBy`), updated workflow section for Codex-specific flow, added `AGENTS.md` to file structure
- TASKS.md revised: fixed Expo init command, added Firebase manual pre-flight section, added AGENTS.md creation to Task 03, added `app/navigation/` to folder structure, fixed Task 08 to require `GestureHandlerRootView` at root from the start, corrected task count to 46
- CHANGELOG.md revised: updated format
- PRD.md: pending surgical fixes (see Known Issues below) — not regenerated due to length

### Files Created / Modified
- `ARCHITECT.md`: Schema fix, missing fields, workflow update, AGENTS.md reference
- `TASKS.md`: Pre-flight section, Task 01 command fix, Task 03 AGENTS.md creation, Task 08 provider order fix, task numbering corrected to 46
- `CHANGELOG.md`: This entry

### Schema Changes
- Swipe schema clarified: subcollection structure `/swipes/{userId}/likes/{targetId}` is canonical (not flat `/swipes/{swipeId}`)
- Added to `/users/{userId}` schema: `paused: boolean`, `banned: boolean`, `expoPushToken?: string`
- Added `/reports/{reportId}` collection to schema

<!-- ### Known Issues / Deferred 
- **PRD.md needs these surgical edits (apply manually or in next Architect session):**
  1. Section 7.1: Replace "Full schema already detailed in Epic 2, 3, 4 requirements above" with the actual canonical schema from ARCHITECT.md
  2. Section 5.5 FR-2.3.1: Swipe path in example code is already correct (`/swipes/{userId}/likes/{targetUserId}`) — ARCHITECT.md was the one that was wrong (now fixed)
  3. Section 10.2: Remove references to "Fitafy research document (provided)" and "TeamUp research document (provided)" — these files don't exist
  4. Add `paused`, `banned`, `expoPushToken` fields to wherever user schema appears in PRD
- **App name not yet decided** — `[APP_NAME]` placeholder used throughout all docs. Do a global find-and-replace when name is locked.
- **AGENTS.md** is created by Task 03 in TASKS.md — it does not exist until then. -->

### Next Up
- Pre-flight: Firebase project setup (manual — browser steps in TASKS.md)
- Task 01: Initialize Expo project
- Task 02: Install Phase 1 dependencies
- Task 03: Create folder structure + AGENTS.md
