@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from Task 94:**
- `admin/src/firebase.ts` must exist and export named `auth`, `db`, and `functions` — verify all three are present
- `admin/src/pages/DashboardPage.tsx` must exist as a stub with three tab buttons ("Reports", "Flags", "Users") — verify it renders without errors
- `admin/src/components/AdminRoute.tsx` must exist and guard `/dashboard` — verify it is imported in `admin/src/App.tsx`
- `admin/package.json` must exist and `npm --prefix admin run build` must pass before this task begins

If any of the above is absent, output a DEPENDENCY ERROR block and stop:

```
<!-- DEPENDENCY ERROR
  Missing: [describe what is absent]
  Cannot proceed. Re-run Task 94 before this task.
-->
```

---

## Context

This is the admin web app living in `/admin/` — a standalone React + TypeScript + Vite app. It is NOT a React Native app. The following rules apply for the entire task:

- No Expo imports, no React Native imports, no Zustand, no React Navigation, no `@/` path alias, no i18next
- All admin imports must use relative paths (e.g. `../firebase`, `./ReportsPanel`)
- Styling uses plain CSS-in-JS via `style` prop objects or inline `<style>` tags — no React Native `StyleSheet`
- All Firebase access uses the Firebase **client SDK** (already initialised in `admin/src/firebase.ts`)
- **No direct destructive Firestore writes from the admin client** — ban/warn/dismiss/unban all go through the `adminAction` Cloud Function. The client calls the CF; the CF uses the Admin SDK. This is the security boundary.

**Existing files relevant to this task:**
- `admin/src/firebase.ts` — exports `auth` (Firebase Auth), `db` (Firestore client), `functions` (Functions client, pinned to `asia-southeast1`)
- `admin/src/pages/DashboardPage.tsx` — stub with three tab buttons; this task fills it in
- `admin/src/components/AdminRoute.tsx` — wraps protected routes; already wired in `App.tsx`
- `functions/src/index.ts` — exports all Cloud Functions; this task adds `adminAction` to it
- `firestore.rules` — last modified in Task 92 (Phase 4A audit comment block only); this task appends two new collection blocks

**`firestore.rules` was last modified in Task 92. When editing it, append the new blocks only — do not touch any existing rule blocks or the `doesNotModifyServerOnlyFields()` function.**

**`functions/src/index.ts` was last modified when Phase 3 CFs were added. When editing it, add the `adminAction` export only — do not touch any existing exports.**

---

## Task 95 — Admin Moderation Queue & Actions

**Files to create:**
- `functions/src/adminAction.ts`
- `admin/src/components/ReportsPanel.tsx`
- `admin/src/components/FlagsPanel.tsx`
- `admin/src/components/UsersPanel.tsx`
- `admin/src/components/UserProfileModal.tsx`

**Files to modify:**
- `functions/src/index.ts` — append `adminAction` export
- `firestore.rules` — append `/admin_audit` and `/users/{uid}/warnings` rule blocks
- `admin/src/pages/DashboardPage.tsx` — wire the four panel components into the tab shell and add badge counts

---

### `functions/src/adminAction.ts`

A 2nd gen callable Cloud Function that executes admin moderation actions. This is the only path through which ban, warn, dismiss, and unban writes reach Firestore. The Admin SDK is used for all writes so Firestore security rules do not apply to them — but the auth and admin-claim checks are still mandatory to prevent abuse.

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// <!-- ARCHITECT NOTE: Admin claim is checked via request.auth.token.admin rather than
// admin.auth().getUser() to avoid an extra Admin SDK round-trip. Firebase propagates
// custom claims into the ID token, so this check is zero-cost and equally secure.
// The custom claim must be set with admin.auth().setCustomUserClaims(uid, { admin: true })
// before the dashboard can be used — see Pre-flight Step C in TASKS_PHASE4.md. -->

type AdminActionPayload = {
  action: 'ban' | 'unban' | 'warn' | 'dismiss'
  targetId: string
  reason: string
  sourceCollection: 'admin_queue' | 'flags' | 'reports'
  sourceDocId: string
}

export const adminAction = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    // 1. Auth check — must be first
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in')
    }

    // 2. Admin claim check — authenticated but not admin is a different error
    // <!-- ARCHITECT NOTE: request.auth.token is the decoded ID token. The `admin`
    // field is set by setCustomUserClaims and propagated into subsequent tokens.
    // A user who just had their claim set must sign out and back in (or force
    // token refresh) before this check passes. -->
    if (request.auth.token['admin'] !== true) {
      throw new HttpsError('permission-denied', 'admin-only')
    }

    const payload = request.data as AdminActionPayload
    const { action, targetId, reason, sourceCollection, sourceDocId } = payload

    // 3. Input validation
    if (!['ban', 'unban', 'warn', 'dismiss'].includes(action)) {
      throw new HttpsError('invalid-argument', 'Invalid action')
    }
    if (!targetId || !sourceCollection || !sourceDocId) {
      throw new HttpsError('invalid-argument', 'Missing required fields')
    }
    if (!['admin_queue', 'flags', 'reports'].includes(sourceCollection)) {
      throw new HttpsError('invalid-argument', 'Invalid sourceCollection')
    }

    const db = admin.firestore()
    const adminUid = request.auth.uid
    const now = FieldValue.serverTimestamp()

    try {
      switch (action) {
        case 'ban': {
          // Set banned: true on the target user
          await db.doc(`users/${targetId}`).update({ banned: true })
          // Mark source document as actioned
          await db.doc(`${sourceCollection}/${sourceDocId}`).update({
            status: 'actioned',
          })
          break
        }

        case 'unban': {
          // <!-- ARCHITECT NOTE: 'unban' is not in the original task spec union but is
          // required by UserProfileModal per the spec body text. Documented here and
          // in CHANGELOG Architecture Decisions. -->
          await db.doc(`users/${targetId}`).update({ banned: false })
          // unban does not update a source document — it is initiated from the
          // UserProfileModal directly, not from a queue item
          break
        }

        case 'warn': {
          // Write a warning to the user's subcollection
          await db.collection(`users/${targetId}/warnings`).add({
            reason,
            createdAt: now,
            adminUid,
          })
          // Mark source document as actioned
          await db.doc(`${sourceCollection}/${sourceDocId}`).update({
            status: 'actioned',
          })
          break
        }

        case 'dismiss': {
          // Mark source document as actioned only — no user-facing write
          await db.doc(`${sourceCollection}/${sourceDocId}`).update({
            status: 'actioned',
          })
          break
        }
      }

      // Write audit log for all actions
      await db.collection('admin_audit').add({
        action,
        targetId,
        sourceCollection,
        sourceDocId,
        reason: reason ?? '',
        adminUid,
        createdAt: now,
      })

      return { success: true }
    } catch (err) {
      // Surface unexpected errors as internal — do not leak raw Firebase errors
      throw new HttpsError('internal', 'Action failed — check admin audit log')
    }
  }
)
```

---

### `functions/src/index.ts` — Update

Add a single export for `adminAction`. Do not touch any other exports or the existing import block structure.

```typescript
// Add this line alongside the other CF exports:
export { adminAction } from './adminAction'
```

---

### `firestore.rules` — Update

Append the following two `match` blocks inside the existing `match /databases/{database}/documents` block, after all existing collection rules. Do not modify any existing rule or function.

```
    // Task 95: Admin audit log — Admin SDK write-only. No client access.
    match /admin_audit/{docId} {
      allow read, write: if false;
    }

    // Task 95: Per-user admin warnings — user can read their own; CF writes only.
    match /users/{uid}/warnings/{warningId} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }
```

---

### `admin/src/components/ReportsPanel.tsx`

Reads `/reports` where `status == 'pending'`, renders a table, and calls `adminAction` for ban/warn/dismiss. Uses the Firebase client SDK `db` and `functions` from `../firebase`.

```tsx
import React, { useEffect, useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  startAfter,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'

interface ReportDoc {
  id: string
  reportedUserId: string
  reporterId: string
  reason: string
  details?: string
  status: string
  createdAt: { seconds: number } | null
}

// <!-- ARCHITECT NOTE: adminAction is the sole write path for moderation actions.
// The client never writes to /reports, /users, or /admin_audit directly. -->
const adminActionFn = httpsCallable<unknown, { success: boolean }>(
  functions,
  'adminAction'
)

const PAGE_SIZE = 50

export const ReportsPanel: React.FC = () => {
  const [reports, setReports] = useState<ReportDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchReports = async (after?: QueryDocumentSnapshot<DocumentData>) => {
    setLoading(true)
    setError(null)
    try {
      const baseQuery = query(
        collection(db, 'reports'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      )
      const q = after ? query(baseQuery, startAfter(after)) : baseQuery
      const snap = await getDocs(q)
      const docs: ReportDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ReportDoc, 'id'>),
      }))
      setReports((prev) => (after ? [...prev, ...docs] : docs))
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHasMore(snap.docs.length === PAGE_SIZE)
    } catch (e) {
      setError('Failed to load reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchReports()
  }, [])

  const handleAction = async (
    report: ReportDoc,
    action: 'ban' | 'warn' | 'dismiss'
  ) => {
    setActionLoading(report.id)
    try {
      await adminActionFn({
        action,
        targetId: report.reportedUserId,
        reason: report.reason,
        sourceCollection: 'reports',
        sourceDocId: report.id,
      })
      // Optimistically remove from pending list
      setReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch {
      alert('Action failed. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading && reports.length === 0) {
    return <p style={{ padding: 16 }}>Loading reports…</p>
  }
  if (error) {
    return <p style={{ padding: 16, color: '#c0392b' }}>{error}</p>
  }
  if (reports.length === 0) {
    return <p style={{ padding: 16 }}>No pending reports.</p>
  }

  return (
    <div style={{ padding: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '8px 12px' }}>Reported User ID</th>
            <th style={{ padding: '8px 12px' }}>Reason</th>
            <th style={{ padding: '8px 12px' }}>Date</th>
            <th style={{ padding: '8px 12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                {r.reportedUserId}
              </td>
              <td style={{ padding: '8px 12px' }}>{r.reason}</td>
              <td style={{ padding: '8px 12px' }}>
                {r.createdAt
                  ? new Date(r.createdAt.seconds * 1000).toLocaleDateString()
                  : '—'}
              </td>
              <td style={{ padding: '8px 12px', display: 'flex', gap: 8 }}>
                <button
                  disabled={actionLoading === r.id}
                  onClick={() => void handleAction(r, 'ban')}
                  style={actionButtonStyle('#c0392b')}
                >
                  Ban
                </button>
                <button
                  disabled={actionLoading === r.id}
                  onClick={() => void handleAction(r, 'warn')}
                  style={actionButtonStyle('#e67e22')}
                >
                  Warn
                </button>
                <button
                  disabled={actionLoading === r.id}
                  onClick={() => void handleAction(r, 'dismiss')}
                  style={actionButtonStyle('#7f8c8d')}
                >
                  Dismiss
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button
          onClick={() => void fetchReports(lastDoc ?? undefined)}
          style={{ marginTop: 12, padding: '8px 16px', cursor: 'pointer' }}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}

function actionButtonStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 13,
  }
}
```

---

### `admin/src/components/FlagsPanel.tsx`

Same pattern as `ReportsPanel` but queries `/flags`. Adds a photo thumbnail column.

```tsx
import React, { useEffect, useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  startAfter,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'

interface FlagDoc {
  id: string
  reportedUserId: string
  photoUrl?: string
  reason: string
  status: string
  createdAt: { seconds: number } | null
}

const adminActionFn = httpsCallable<unknown, { success: boolean }>(
  functions,
  'adminAction'
)

const PAGE_SIZE = 50

export const FlagsPanel: React.FC = () => {
  const [flags, setFlags] = useState<FlagDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)

  const fetchFlags = async (after?: QueryDocumentSnapshot<DocumentData>) => {
    setLoading(true)
    setError(null)
    try {
      const baseQuery = query(
        collection(db, 'flags'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      )
      const q = after ? query(baseQuery, startAfter(after)) : baseQuery
      const snap = await getDocs(q)
      const docs: FlagDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FlagDoc, 'id'>),
      }))
      setFlags((prev) => (after ? [...prev, ...docs] : docs))
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHasMore(snap.docs.length === PAGE_SIZE)
    } catch {
      setError('Failed to load flags.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchFlags()
  }, [])

  const handleAction = async (
    flag: FlagDoc,
    action: 'ban' | 'warn' | 'dismiss'
  ) => {
    setActionLoading(flag.id)
    try {
      await adminActionFn({
        action,
        targetId: flag.reportedUserId,
        reason: flag.reason,
        sourceCollection: 'flags',
        sourceDocId: flag.id,
      })
      setFlags((prev) => prev.filter((f) => f.id !== flag.id))
    } catch {
      alert('Action failed. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading && flags.length === 0) {
    return <p style={{ padding: 16 }}>Loading flags…</p>
  }
  if (error) {
    return <p style={{ padding: 16, color: '#c0392b' }}>{error}</p>
  }
  if (flags.length === 0) {
    return <p style={{ padding: 16 }}>No pending flags.</p>
  }

  return (
    <div style={{ padding: 16 }}>
      {expandedPhoto && (
        <div
          onClick={() => setExpandedPhoto(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer',
          }}
        >
          <img
            src={expandedPhoto}
            alt="Flagged content"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }}
          />
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '8px 12px' }}>Photo</th>
            <th style={{ padding: '8px 12px' }}>Flagged User ID</th>
            <th style={{ padding: '8px 12px' }}>Reason</th>
            <th style={{ padding: '8px 12px' }}>Date</th>
            <th style={{ padding: '8px 12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((f) => (
            <tr key={f.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px 12px' }}>
                {f.photoUrl ? (
                  <img
                    src={f.photoUrl}
                    alt="Flagged"
                    onClick={() => setExpandedPhoto(f.photoUrl ?? null)}
                    style={{
                      width: 48,
                      height: 48,
                      objectFit: 'cover',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  />
                ) : (
                  '—'
                )}
              </td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                {f.reportedUserId}
              </td>
              <td style={{ padding: '8px 12px' }}>{f.reason}</td>
              <td style={{ padding: '8px 12px' }}>
                {f.createdAt
                  ? new Date(f.createdAt.seconds * 1000).toLocaleDateString()
                  : '—'}
              </td>
              <td style={{ padding: '8px 12px', display: 'flex', gap: 8 }}>
                <button
                  disabled={actionLoading === f.id}
                  onClick={() => void handleAction(f, 'ban')}
                  style={actionButtonStyle('#c0392b')}
                >
                  Ban
                </button>
                <button
                  disabled={actionLoading === f.id}
                  onClick={() => void handleAction(f, 'warn')}
                  style={actionButtonStyle('#e67e22')}
                >
                  Warn
                </button>
                <button
                  disabled={actionLoading === f.id}
                  onClick={() => void handleAction(f, 'dismiss')}
                  style={actionButtonStyle('#7f8c8d')}
                >
                  Dismiss
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button
          onClick={() => void fetchFlags(lastDoc ?? undefined)}
          style={{ marginTop: 12, padding: '8px 16px', cursor: 'pointer' }}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}

function actionButtonStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 13,
  }
}
```

---

### `admin/src/components/UsersPanel.tsx`

Fetches 20 users ordered by `createdAt DESC`, supports client-side `firstName` prefix filtering, and opens `UserProfileModal` on row click. Ban is available inline for unbanned users.

```tsx
import React, { useEffect, useState } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  startAfter,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { UserProfileModal } from './UserProfileModal'

interface UserRow {
  id: string
  firstName: string
  banned: boolean
  premium?: { tier: string; active: boolean }
  createdAt: { seconds: number } | null
}

const adminActionFn = httpsCallable<unknown, { success: boolean }>(
  functions,
  'adminAction'
)

// <!-- ARCHITECT NOTE: Client-side firstName filtering on a fetched page of 20 is
// a known limitation — it will not find users outside the current page. Full-text
// search is deferred to Phase 5 (see TASKS_PHASE4.md Deferred section). A comment
// in the UI informs the admin of this constraint. -->
const PAGE_SIZE = 20

export const UsersPanel: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([])
  const [filtered, setFiltered] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = async (after?: QueryDocumentSnapshot<DocumentData>) => {
    setLoading(true)
    setError(null)
    try {
      const baseQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      )
      const q = after ? query(baseQuery, startAfter(after)) : baseQuery
      const snap = await getDocs(q)
      const docs: UserRow[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<UserRow, 'id'>),
      }))
      const next = after ? [...users, ...docs] : docs
      setUsers(next)
      setFiltered(next)
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHasMore(snap.docs.length === PAGE_SIZE)
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers()
  }, [])

  useEffect(() => {
    const term = search.toLowerCase().trim()
    setFiltered(
      term
        ? users.filter((u) => u.firstName.toLowerCase().startsWith(term))
        : users
    )
  }, [search, users])

  const handleBan = async (user: UserRow) => {
    if (!confirm(`Ban ${user.firstName}? This will hide them from discovery.`)) return
    setActionLoading(user.id)
    try {
      await adminActionFn({
        action: 'ban',
        targetId: user.id,
        reason: 'Admin panel direct ban',
        sourceCollection: 'reports',
        sourceDocId: 'direct',
      })
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, banned: true } : u))
      )
    } catch {
      alert('Ban failed. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading && users.length === 0) {
    return <p style={{ padding: 16 }}>Loading users…</p>
  }
  if (error) {
    return <p style={{ padding: 16, color: '#c0392b' }}>{error}</p>
  }

  return (
    <div style={{ padding: 16 }}>
      {selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onBanToggle={(id, banned) => {
            setUsers((prev) =>
              prev.map((u) => (u.id === id ? { ...u, banned } : u))
            )
          }}
        />
      )}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="text"
          placeholder="Filter by first name (current page only)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc', width: 280 }}
        />
        <span style={{ fontSize: 12, color: '#888' }}>
          Showing {PAGE_SIZE} most recent — full search in Phase 5
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '8px 12px' }}>Name</th>
            <th style={{ padding: '8px 12px' }}>Premium</th>
            <th style={{ padding: '8px 12px' }}>Banned</th>
            <th style={{ padding: '8px 12px' }}>Joined</th>
            <th style={{ padding: '8px 12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <tr
              key={u.id}
              style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
              onClick={() => setSelectedUserId(u.id)}
            >
              <td style={{ padding: '8px 12px' }}>{u.firstName}</td>
              <td style={{ padding: '8px 12px' }}>
                {u.premium?.active ? u.premium.tier : 'free'}
              </td>
              <td style={{ padding: '8px 12px' }}>
                {u.banned ? (
                  <span style={{ color: '#c0392b', fontWeight: 600 }}>Yes</span>
                ) : (
                  'No'
                )}
              </td>
              <td style={{ padding: '8px 12px' }}>
                {u.createdAt
                  ? new Date(u.createdAt.seconds * 1000).toLocaleDateString()
                  : '—'}
              </td>
              <td
                style={{ padding: '8px 12px' }}
                onClick={(e) => e.stopPropagation()}
              >
                {!u.banned && (
                  <button
                    disabled={actionLoading === u.id}
                    onClick={() => void handleBan(u)}
                    style={{
                      backgroundColor: '#c0392b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Ban
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button
          onClick={() => void fetchUsers(lastDoc ?? undefined)}
          style={{ marginTop: 12, padding: '8px 16px', cursor: 'pointer' }}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
```

---

### `admin/src/components/UserProfileModal.tsx`

Full-screen modal overlay that reads a single `/users/{uid}` document and displays photos, bio, status, and ban/unban controls.

```tsx
import React, { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'

interface UserProfile {
  firstName: string
  bio?: string
  photos: string[]
  banned: boolean
  premium?: { tier: string; active: boolean }
  activities?: string[]
  fitnessLevel?: string
  createdAt: { seconds: number } | null
}

interface UserProfileModalProps {
  userId: string
  onClose: () => void
  onBanToggle: (userId: string, banned: boolean) => void
}

const adminActionFn = httpsCallable<unknown, { success: boolean }>(
  functions,
  'adminAction'
)

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  userId,
  onClose,
  onBanToggle,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      setError(null)
      try {
        const snap = await getDoc(doc(db, 'users', userId))
        if (!snap.exists()) {
          setError('User not found.')
        } else {
          setProfile(snap.data() as UserProfile)
        }
      } catch {
        setError('Failed to load profile.')
      } finally {
        setLoading(false)
      }
    }
    void fetchProfile()
  }, [userId])

  const handleBanToggle = async () => {
    if (!profile) return
    const action = profile.banned ? 'unban' : 'ban'
    const confirmMsg = profile.banned
      ? `Unban ${profile.firstName}?`
      : `Ban ${profile.firstName}? This will hide them from discovery.`
    if (!confirm(confirmMsg)) return

    setActionLoading(true)
    try {
      await adminActionFn({
        action,
        targetId: userId,
        reason: `Admin panel ${action}`,
        sourceCollection: 'reports',
        sourceDocId: 'direct',
      })
      const newBanned = !profile.banned
      setProfile((prev) => (prev ? { ...prev, banned: newBanned } : prev))
      onBanToggle(userId, newBanned)
    } catch {
      alert(`${action === 'ban' ? 'Ban' : 'Unban'} failed. Please try again.`)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 8,
          width: 560,
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        {loading && <p>Loading profile…</p>}
        {error && <p style={{ color: '#c0392b' }}>{error}</p>}

        {profile && (
          <>
            <h2 style={{ margin: '0 0 4px' }}>{profile.firstName}</h2>
            <p style={{ margin: '0 0 12px', color: '#888', fontSize: 13 }}>
              ID: {userId}
            </p>

            {/* Status badges */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 12,
                  background: profile.banned ? '#fdecea' : '#e8f5e9',
                  color: profile.banned ? '#c0392b' : '#2e7d32',
                  fontWeight: 600,
                }}
              >
                {profile.banned ? 'Banned' : 'Active'}
              </span>
              {profile.premium?.active && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 12,
                    background: '#fff3e0',
                    color: '#e65100',
                    fontWeight: 600,
                  }}
                >
                  {profile.premium.tier.toUpperCase()}
                </span>
              )}
            </div>

            {/* Photo grid */}
            {profile.photos.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                {profile.photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Photo ${i + 1}`}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      borderRadius: 4,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 13 }}>Bio</strong>
                <p style={{ margin: '4px 0 0', fontSize: 14 }}>{profile.bio}</p>
              </div>
            )}

            {/* Activities */}
            {profile.activities && profile.activities.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 13 }}>Activities</strong>
                <p style={{ margin: '4px 0 0', fontSize: 14 }}>
                  {profile.activities.join(', ')}
                </p>
              </div>
            )}

            {/* Fitness level */}
            {profile.fitnessLevel && (
              <div style={{ marginBottom: 16 }}>
                <strong style={{ fontSize: 13 }}>Fitness Level</strong>
                <p style={{ margin: '4px 0 0', fontSize: 14 }}>{profile.fitnessLevel}</p>
              </div>
            )}

            {/* Ban / Unban */}
            <button
              onClick={() => void handleBanToggle()}
              disabled={actionLoading}
              style={{
                backgroundColor: profile.banned ? '#2e7d32' : '#c0392b',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                width: '100%',
              }}
            >
              {actionLoading
                ? 'Processing…'
                : profile.banned
                ? 'Unban User'
                : 'Ban User'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

---

### `admin/src/pages/DashboardPage.tsx` — Update

Wire the three panels into their tab slots and add badge counts. The stub currently has three tab buttons and empty panels — replace the entire file content. Preserve the header (fitlink Admin + signed-in email + Sign Out) from the Task 94 implementation.

```tsx
import React, { useEffect, useState } from 'react'
import { collection, query, where, getCountFromServer } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { ReportsPanel } from '../components/ReportsPanel'
import { FlagsPanel } from '../components/FlagsPanel'
import { UsersPanel } from '../components/UsersPanel'

type Tab = 'reports' | 'flags' | 'users'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('reports')
  const [badgeCounts, setBadgeCounts] = useState({ reports: 0, flags: 0 })
  const userEmail = auth.currentUser?.email ?? '—'

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [reportsSnap, flagsSnap] = await Promise.all([
          getCountFromServer(
            query(collection(db, 'reports'), where('status', '==', 'pending'))
          ),
          getCountFromServer(
            query(collection(db, 'flags'), where('status', '==', 'pending'))
          ),
        ])
        setBadgeCounts({
          reports: reportsSnap.data().count,
          flags: flagsSnap.data().count,
        })
      } catch {
        // Badge counts are non-critical — silently fail
      }
    }
    void fetchCounts()
  }, [])

  const handleSignOut = () => {
    void signOut(auth)
  }

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: '10px 20px',
    cursor: 'pointer',
    border: 'none',
    borderBottom: activeTab === tab ? '3px solid #2c3e50' : '3px solid transparent',
    background: 'none',
    fontSize: 14,
    fontWeight: activeTab === tab ? 700 : 400,
    color: activeTab === tab ? '#2c3e50' : '#666',
  })

  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    background: '#c0392b',
    color: '#fff',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    padding: '1px 6px',
    marginLeft: 6,
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: '#2c3e50',
          color: '#fff',
        }}
      >
        <strong style={{ fontSize: 18 }}>fitlink Admin</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>{userEmail}</span>
          <button
            onClick={handleSignOut}
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #ddd',
          background: '#fff',
          paddingLeft: 8,
        }}
      >
        <button style={tabStyle('reports')} onClick={() => setActiveTab('reports')}>
          Reports
          {badgeCounts.reports > 0 && (
            <span style={badgeStyle}>{badgeCounts.reports}</span>
          )}
        </button>
        <button style={tabStyle('flags')} onClick={() => setActiveTab('flags')}>
          Flags
          {badgeCounts.flags > 0 && (
            <span style={badgeStyle}>{badgeCounts.flags}</span>
          )}
        </button>
        <button style={tabStyle('users')} onClick={() => setActiveTab('users')}>
          Users
        </button>
      </div>

      {/* Panel content */}
      <div style={{ background: '#f9f9f9', minHeight: 'calc(100vh - 100px)' }}>
        {activeTab === 'reports' && <ReportsPanel />}
        {activeTab === 'flags' && <FlagsPanel />}
        {activeTab === 'users' && <UsersPanel />}
      </div>
    </div>
  )
}
```

---

## Important Architecture Notes for Codex

1. **Admin claim check uses the ID token, not a separate Admin SDK call.** Check `request.auth.token['admin'] === true` in `adminAction.ts` — not `admin.auth().getUser(uid)`. Firebase propagates custom claims into the ID token on every auth event, making this check zero-cost and equally secure. Add an `<!-- ARCHITECT NOTE -->` comment explaining this if it is not already present in the scaffold above.

2. **`unban` is a valid action in the CF union.** The TASKS_PHASE4.md spec body says to add `'unban'` even though the action list header only shows `'ban' | 'warn' | 'dismiss'`. Both `UserProfileModal` and the CF must agree on this union. The TypeScript type for `AdminActionPayload` must include `'unban'`.

3. **The admin client never writes to Firestore directly.** All ban/warn/dismiss/unban calls go through the `adminAction` Cloud Function via `httpsCallable`. The admin panels read Firestore freely (read-only), but all writes are CF-mediated. This is the security boundary — the CF verifies both auth and admin claim server-side.

4. **`firestore.rules` edit is append-only.** The two new `match` blocks (`/admin_audit` and `/users/{uid}/warnings`) go inside the existing `match /databases/{database}/documents` block, after all existing rules. Do not modify the `doesNotModifyServerOnlyFields()` function or any existing collection rule. If unsure of the exact insertion point, read the file first and insert before the closing `}` of the `documents` block.

5. **`functions/src/index.ts` edit is append-only.** Add only `export { adminAction } from './adminAction'`. Do not remove, reorder, or rewrite any existing exports.

6. **Admin SDK writes bypass Firestore security rules.** The `adminAction` CF uses `admin.firestore()` (Admin SDK), so the `/admin_audit` rule `allow read, write: if false` does not block CF writes — it only blocks client SDK calls. This is intentional and correct. Do not add a client SDK fallback path.

7. **`getCountFromServer` requires Firestore SDK v9.13.0+.** This is available in Firebase JS SDK 9.x and 10.x which the admin app uses. If a TypeScript error is thrown on this import, verify the firebase version in `admin/package.json` — if below 9.13, replace with a `getDocs(...).size` count, which is less efficient but always available.

8. **No i18n in the admin app.** The admin dashboard is English-only. Do not add `useTranslation`, `t()`, or any i18next import. All text is hardcoded English strings in JSX — this is correct for an internal admin tool.

9. **No `@/` alias in the admin app.** All admin imports must use relative paths (`../firebase`, `./ReportsPanel`, etc.). The mobile app's `tsconfig.json` path alias does not apply to `admin/tsconfig.json`.

10. **Direct ban from UsersPanel uses `sourceDocId: 'direct'`.** When banning from the Users panel (no associated report/flag), pass `sourceDocId: 'direct'` and `sourceCollection: 'reports'` as sentinel values. The audit log still records the action correctly. This is a known simplification — full queue-independent ban audit is Phase 5.

---

## Rollback Protocol

If `npm --prefix functions run build` or `npm --prefix admin run build` produces errors that cannot be resolved without:
- Modifying a file in the "Do Not Touch" list, OR
- Changing the `adminAction` CF signature in a way that breaks the panel callers, OR
- Editing existing `firestore.rules` blocks (not appending)

**Then:**
1. Do not commit any partial changes
2. Revert all files touched in this session to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the file, the error, and what decision is needed
4. Stop. Do not attempt a workaround. Bring the report to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript / Build**
- [ ] `npm --prefix functions run build` — zero errors
- [ ] `npm --prefix admin run build` — zero errors
- [ ] `npx tsc --noEmit` (root) — zero errors
- [ ] Zero `any` types in `adminAction.ts` and all admin panel components
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Security**
- [ ] `adminAction.ts` — `if (!request.auth)` is the **first** line inside the handler
- [ ] `adminAction.ts` — `request.auth.token['admin'] !== true` check is the **second** check, immediately after auth
- [ ] `adminAction.ts` — region is `'asia-southeast1'`
- [ ] `adminAction.ts` — all Firestore writes use `admin.firestore()` (Admin SDK), not the client SDK
- [ ] `adminAction.ts` — all timestamp writes use `FieldValue.serverTimestamp()`, not `new Date()`
- [ ] `firestore.rules` — `/admin_audit` block added with `allow read, write: if false`
- [ ] `firestore.rules` — `/users/{uid}/warnings` block added with correct read rule
- [ ] `firestore.rules` — no existing rule blocks were modified

**Admin App**
- [ ] `DashboardPage.tsx` imports `ReportsPanel`, `FlagsPanel`, `UsersPanel` — all three panels render
- [ ] Badge counts appear on Reports and Flags tabs when `> 0`
- [ ] `UserProfileModal` opens on row click in `UsersPanel`
- [ ] Sign Out button calls `signOut(auth)` and returns user to `LoginPage`
- [ ] No `@/` alias used anywhere in `/admin/src/`
- [ ] No React Native imports in any admin file
- [ ] No Zustand imports in any admin file
- [ ] No `useTranslation` / i18next imports in any admin file

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in `adminAction.ts`
- [ ] Files in the "Do Not Touch" list were not modified

---

## Acceptance Criteria

- [ ] `adminAction` CF created at `functions/src/adminAction.ts` and exported from `functions/src/index.ts`
- [ ] `adminAction` rejects unauthenticated calls with `HttpsError('unauthenticated', ...)`
- [ ] `adminAction` rejects authenticated non-admin calls with `HttpsError('permission-denied', 'admin-only')`
- [ ] `adminAction` supports all four actions: `ban`, `unban`, `warn`, `dismiss`
- [ ] `ban` writes `banned: true` to `users/{targetId}` and `status: 'actioned'` to the source doc
- [ ] `unban` writes `banned: false` to `users/{targetId}` (no source doc update)
- [ ] `warn` writes to `users/{targetId}/warnings/{auto-id}` and `status: 'actioned'` to the source doc
- [ ] `dismiss` writes only `status: 'actioned'` to the source doc
- [ ] All four actions write an entry to `/admin_audit/{auto-id}` with `action`, `targetId`, `sourceDocId`, `reason`, `adminUid`, `createdAt`
- [ ] `firestore.rules` has `/admin_audit` block: `allow read, write: if false`
- [ ] `firestore.rules` has `/users/{uid}/warnings` block: user can read own; write denied to client
- [ ] `ReportsPanel` queries `/reports` where `status == 'pending'`, renders a table, supports Ban/Warn/Dismiss per row, and optimistically removes rows on action
- [ ] `FlagsPanel` queries `/flags` where `status == 'pending'`, renders photo thumbnails, supports the same three actions, click-to-expand photo works
- [ ] `UsersPanel` fetches 20 users by `createdAt DESC`, supports client-side first-name filter, inline Ban for unbanned users, row click opens `UserProfileModal`
- [ ] `UserProfileModal` displays photos grid, bio, activities, status badges, and Ban/Unban button; updates parent list state via `onBanToggle`
- [ ] `DashboardPage` tab bar shows badge counts for Reports and Flags when pending items exist
- [ ] `npm --prefix admin run build` — zero errors
- [ ] `npm --prefix functions run build` — zero errors
- [ ] `npx tsc --noEmit` — zero errors

---

## Do Not Touch

- `admin/src/firebase.ts` — exports must remain unchanged; panels import from this file
- `admin/src/components/AdminRoute.tsx` — auth guard is complete; do not modify
- `admin/src/pages/LoginPage.tsx` — auth flow is complete; do not modify
- `admin/src/App.tsx` — routing is complete; do not modify
- `admin/vite.config.ts`, `admin/tsconfig.json`, `admin/package.json` — build config is stable
- All mobile app files under the project root (`store/`, `app/`, `components/`, `services/`, `hooks/`, `types/`, `constants/`, `i18n/`) — this task is admin-dashboard and CF only
- `firestore.rules` existing blocks — append only; no modifications to existing rules or the `doesNotModifyServerOnlyFields()` function
- `functions/src/index.ts` existing exports — append `adminAction` only

---

## Commit

```
git commit -m "task-95: admin moderation queue, actions CF, and firestore rules"
```

---

## After This Session

Update `CHANGELOG.md` using this template:

```
## [Phase 4B — Task 95] — YYYY-MM-DD

### Completed

- Task 95: Admin moderation queue & actions
- adminAction CF: ban, unban, warn, dismiss with auth + admin-claim double-check
- ReportsPanel: pending /reports queue with ban/warn/dismiss actions
- FlagsPanel: pending /flags queue with photo thumbnail expand
- UsersPanel: 20-user page with client-side name filter and profile modal
- UserProfileModal: full profile view with ban/unban toggle
- DashboardPage: wired all panels into tab shell with badge counts
- firestore.rules: /admin_audit and /users/{uid}/warnings blocks appended

### Files Created

- functions/src/adminAction.ts: callable CF — auth + admin-claim check, four action types, audit log
- admin/src/components/ReportsPanel.tsx: reports queue panel
- admin/src/components/FlagsPanel.tsx: flags queue panel with photo thumbnails
- admin/src/components/UsersPanel.tsx: user search and ban panel
- admin/src/components/UserProfileModal.tsx: full profile modal with ban/unban

### Files Modified

- functions/src/index.ts: added adminAction export
- firestore.rules: appended /admin_audit and /users/{uid}/warnings blocks
- admin/src/pages/DashboardPage.tsx: wired panels, badge counts, sign-out

### Architecture Decisions

- Admin claim verified via request.auth.token['admin'] (ID token) rather than admin.auth().getUser()
  — zero extra round-trip; equally secure; documented with ARCHITECT NOTE comment in CF
- 'unban' action added to CF union per spec body text despite not appearing in the action header
  — required by UserProfileModal; documented here
- Direct ban from UsersPanel uses sourceDocId: 'direct' sentinel — queue-independent ban audit
  deferred to Phase 5
- Badge counts use getCountFromServer() (Firestore Aggregation Query) — requires Firebase JS SDK >= 9.13

### Conflict Risks Introduced

- firestore.rules modified — Task 106 also touches this file; review before generating Task 106 prompt
- functions/src/index.ts modified — no upcoming Phase 4 task conflicts with this file

### Known Issues / Deferred

- UsersPanel first-name filter is client-side only (current page of 20) — full-text search deferred to Phase 5
- Admin dashboard chunk-size Vite warning may still be present — non-blocking; Vite code-splitting deferred to Phase 5

### Next Up

- Task 96: restoreStripeSubscription Cloud Function
```

---

## Reasoning Level

Extra High
