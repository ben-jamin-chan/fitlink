# CODEX PROMPT — Task 35
# Profile Store — fetchProfile, updateProfile, uploadPhoto, deletePhoto

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1D is complete. Task 34 (MatchCelebrationModal) shipped. A minimal version of `profileStore.ts` was stubbed during Task 34 to provide `profile.activities` and `profile.photos` to the celebration modal. Task 35 owns the full, production-ready profile store — it replaces or expands that stub with all required state and actions.

Relevant existing files:
- `store/profileStore.ts` — **exists as a stub** from Task 34. Hydrates `profile` read-only from Firestore. Task 35 must expand this with `updateProfile`, `uploadPhoto`, `deletePhoto`, and proper error/loading handling. Do not delete the file — expand it in place.
- `store/authStore.ts` — exposes `user` (FirebaseUser) and `isAuthenticated`. Profile store should use `authStore.getState().user?.uid` to determine the current user ID.
- `services/firebase/firestore.ts` — has `getUserProfile(userId)`. Task 35 may add `updateUserProfile` and `deleteUserPhoto` helpers here.
- `services/firebase/storage.ts` — has `uploadProfilePhoto(uid, index, uri): Promise<string>`. Confirm this is implemented; if missing, implement it here.
- `utils/imageUtils.ts` — has `compressImage(uri): Promise<string>` (1080px, 80% quality). Use it before every photo upload.
- `types/user.ts` — `UserProfile` interface. All profile data shapes live here. Do not redefine types inline.
- `constants/theme.ts` — all spacing, color, and typography tokens.
- `i18n/en.json` (and my/zh/ta) — add any new i18n keys under `profile.*` namespace.

**What Task 34 already did (do not redo):**
- Minimal `profileStore` reads `profile` from Firestore on mount using `fetchProfile(userId)`
- `profile.activities` and `profile.photos` are already accessible in `DiscoveryScreen`

**What Task 35 must add:**
- `updateProfile(partial)` — writes partial updates to Firestore, syncs local state
- `uploadPhoto(uri, index)` — compress → upload to Storage → get URL → update `photos` array in Firestore and local state
- `deletePhoto(index)` — remove URL from `photos` array in Firestore, delete file from Storage, update local state
- Proper `isLoading` and `error` state transitions on all async actions
- Auto-fetch own profile when auth state changes (i.e. on login)

---

## Task 35 — Profile Store

**Files to create:**
- *(none — all changes are modifications)*

**Files to modify:**
- `store/profileStore.ts` — full implementation replacing the Task 34 stub
- `services/firebase/firestore.ts` — add `updateUserProfile` and `deleteUserPhoto` helpers
- `services/firebase/storage.ts` — add `deleteProfilePhoto` helper (if not already present)
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `profile.errors.*` keys

---

### `services/firebase/firestore.ts` — Additions

Add these two functions. Do not touch any existing function.

```typescript
import { doc, updateDoc, arrayRemove } from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import type { UserProfile } from '@/types/user'

/**
 * Writes a partial update to /users/{userId}.
 * Only the provided fields are written — Firestore merge is not used here,
 * updateDoc with explicit fields is the correct pattern.
 * Never call this with server-controlled fields: age, banned, verified, stats.matches.
 */
export const updateUserProfile = async (
  userId: string,
  partial: Partial<Omit<UserProfile, 'uid' | 'age' | 'banned' | 'verified' | 'createdAt'>>
): Promise<void> => {
  const ref = doc(db, 'users', userId)
  // updateDoc accepts any plain object subset — cast is safe here because
  // we constrain the input type via Omit above.
  await updateDoc(ref, partial as Record<string, unknown>)
}

/**
 * Removes a photo URL from the /users/{userId} photos array.
 * Uses Firestore arrayRemove — atomic, no read-modify-write needed.
 */
export const removePhotoFromProfile = async (
  userId: string,
  photoUrl: string
): Promise<void> => {
  const ref = doc(db, 'users', userId)
  await updateDoc(ref, {
    photos: arrayRemove(photoUrl),
  })
}
```

---

### `services/firebase/storage.ts` — Addition

Confirm `uploadProfilePhoto` exists. If it does not, implement it now. Then add `deleteProfilePhoto`.

```typescript
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { storage } from '@/services/firebase/config'

/**
 * Uploads a local URI to Firebase Storage at users/{userId}/photos/{index}.jpg.
 * Returns the public download URL.
 * Assumes the URI has already been compressed by utils/imageUtils.compressImage.
 */
export const uploadProfilePhoto = async (
  userId: string,
  index: number,
  uri: string
): Promise<string> => {
  const path = `users/${userId}/photos/photo_${index}_${Date.now()}.jpg`
  const storageRef = ref(storage, path)

  const response = await fetch(uri)
  const blob = await response.blob()

  return new Promise<string>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob)
    task.on(
      'state_changed',
      () => {}, // progress — not tracked at this layer; store layer tracks isLoading
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      }
    )
  })
}

/**
 * Deletes a photo file from Firebase Storage given its full download URL.
 * Extracts the storage path from the URL using the Firebase SDK ref-from-URL helper.
 * Silently succeeds if the file is already gone (404 is not an error in this context).
 */
export const deleteProfilePhoto = async (photoUrl: string): Promise<void> => {
  try {
    const fileRef = ref(storage, photoUrl)
    await deleteObject(fileRef)
  } catch (error: unknown) {
    // code 'storage/object-not-found' — file already deleted; not a fatal error
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'storage/object-not-found'
    ) {
      return
    }
    throw error
  }
}
```

---

### `store/profileStore.ts` — Full Implementation

Replace the Task 34 stub entirely with this. The public API surface must be backward-compatible with what Task 34 already wired (`profile`, `fetchProfile`).

```typescript
import { create } from 'zustand'
import { serverTimestamp } from 'firebase/firestore'
import { getUserProfile, updateUserProfile, removePhotoFromProfile } from '@/services/firebase/firestore'
import { uploadProfilePhoto, deleteProfilePhoto } from '@/services/firebase/storage'
import { compressImage } from '@/utils/imageUtils'
import { useAuthStore } from '@/store/authStore'
import type { UserProfile } from '@/types/user'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileState {
  profile: UserProfile | null
  isLoading: boolean
  error: string | null
}

interface ProfileActions {
  /**
   * Fetches /users/{userId} from Firestore and hydrates local state.
   * Called on auth state change (login) and manually when profile data must refresh.
   */
  fetchProfile: (userId: string) => Promise<void>

  /**
   * Writes a partial update to Firestore and optimistically updates local state.
   * Never pass server-controlled fields: age, banned, verified, stats, createdAt.
   * On failure, rolls back local state to the pre-update snapshot.
   */
  updateProfile: (
    partial: Partial<Omit<UserProfile, 'uid' | 'age' | 'banned' | 'verified' | 'createdAt'>>
  ) => Promise<void>

  /**
   * Compresses a local image URI, uploads to Firebase Storage,
   * gets the download URL, then writes the updated photos array to Firestore.
   * @param uri   — local image URI (from expo-image-picker)
   * @param index — slot index (0–5). Replaces existing photo at that index if present.
   */
  uploadPhoto: (uri: string, index: number) => Promise<void>

  /**
   * Removes a photo at `index` from the Firestore photos array and deletes
   * the file from Firebase Storage. Validates minimum 1 photo remains.
   * @param index — index in profile.photos to remove
   */
  deletePhoto: (index: number) => Promise<void>

  /** Clears any error string from state. */
  clearError: () => void

  /** Resets the store (called on logout). */
  reset: () => void
}

type ProfileStore = ProfileState & ProfileActions

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: ProfileState = {
  profile: null,
  isLoading: false,
  error: null,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useProfileStore = create<ProfileStore>((set, get) => ({
  ...initialState,

  // ── fetchProfile ──────────────────────────────────────────────────────────

  fetchProfile: async (userId: string): Promise<void> => {
    set({ isLoading: true, error: null })
    try {
      const profile = await getUserProfile(userId)
      set({ profile, isLoading: false })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'profile.errors.fetchFailed'
      set({ error: message, isLoading: false })
    }
  },

  // ── updateProfile ─────────────────────────────────────────────────────────

  updateProfile: async (partial): Promise<void> => {
    const { profile } = get()
    const userId = useAuthStore.getState().user?.uid

    if (profile === null || userId === undefined) {
      set({ error: 'profile.errors.notAuthenticated' })
      return
    }

    // Optimistic update — capture snapshot for rollback
    const snapshot = profile
    set({ profile: { ...profile, ...partial }, isLoading: true, error: null })

    try {
      await updateUserProfile(userId, {
        ...partial,
        lastActive: serverTimestamp() as unknown as import('firebase/firestore').Timestamp,
      })
      set({ isLoading: false })
    } catch (err: unknown) {
      // Rollback on failure
      const message =
        err instanceof Error ? err.message : 'profile.errors.updateFailed'
      set({ profile: snapshot, error: message, isLoading: false })
    }
  },

  // ── uploadPhoto ───────────────────────────────────────────────────────────

  uploadPhoto: async (uri: string, index: number): Promise<void> => {
    const { profile } = get()
    const userId = useAuthStore.getState().user?.uid

    if (profile === null || userId === undefined) {
      set({ error: 'profile.errors.notAuthenticated' })
      return
    }

    set({ isLoading: true, error: null })

    try {
      // 1. Compress
      const compressedUri = await compressImage(uri)

      // 2. Upload — returns public download URL
      const downloadUrl = await uploadProfilePhoto(userId, index, compressedUri)

      // 3. Build updated photos array
      const updatedPhotos = [...profile.photos]
      updatedPhotos[index] = downloadUrl

      // 4. Write to Firestore
      await updateUserProfile(userId, { photos: updatedPhotos })

      // 5. Update local state
      set({ profile: { ...profile, photos: updatedPhotos }, isLoading: false })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'profile.errors.uploadFailed'
      set({ error: message, isLoading: false })
    }
  },

  // ── deletePhoto ───────────────────────────────────────────────────────────

  deletePhoto: async (index: number): Promise<void> => {
    const { profile } = get()
    const userId = useAuthStore.getState().user?.uid

    if (profile === null || userId === undefined) {
      set({ error: 'profile.errors.notAuthenticated' })
      return
    }

    // Enforce minimum 1 photo at all times (onboarding requires 2,
    // but in-app we allow dropping to 1 to avoid locking the user out)
    if (profile.photos.length <= 1) {
      set({ error: 'profile.errors.minPhotos' })
      return
    }

    const photoUrl = profile.photos[index]
    if (photoUrl === undefined) {
      set({ error: 'profile.errors.photoNotFound' })
      return
    }

    // Optimistic update
    const snapshot = profile
    const updatedPhotos = profile.photos.filter((_, i) => i !== index)
    set({ profile: { ...profile, photos: updatedPhotos }, isLoading: true, error: null })

    try {
      // 1. Remove URL from Firestore array (atomic)
      await removePhotoFromProfile(userId, photoUrl)

      // 2. Delete file from Storage (best-effort — already handles 404)
      await deleteProfilePhoto(photoUrl)

      set({ isLoading: false })
    } catch (err: unknown) {
      // Rollback
      const message =
        err instanceof Error ? err.message : 'profile.errors.deleteFailed'
      set({ profile: snapshot, error: message, isLoading: false })
    }
  },

  // ── clearError ────────────────────────────────────────────────────────────

  clearError: (): void => {
    set({ error: null })
  },

  // ── reset ─────────────────────────────────────────────────────────────────

  reset: (): void => {
    set(initialState)
  },
}))
```

---

### `i18n/en.json` — Additions

Add these keys inside the existing `profile` namespace. Create the `profile` key if it does not yet exist.

```json
"profile": {
  "errors": {
    "fetchFailed": "Could not load profile. Please try again.",
    "updateFailed": "Could not save changes. Please try again.",
    "uploadFailed": "Photo upload failed. Please try again.",
    "deleteFailed": "Could not remove photo. Please try again.",
    "notAuthenticated": "You must be signed in to update your profile.",
    "minPhotos": "You must have at least one photo.",
    "photoNotFound": "Photo not found."
  }
}
```

Apply the same keys (same English values as placeholders) to `i18n/my.json`, `i18n/zh.json`, and `i18n/ta.json`.

---

### Auto-fetch on Auth State Change

`authStore.ts` currently calls `initialise()` which sets up `onAuthStateChanged`. When the user is confirmed authenticated, `profileStore.fetchProfile` should be called.

Add this to `store/authStore.ts` inside the `onAuthStateChanged` callback, after `setUser` is called:

```typescript
import { useProfileStore } from '@/store/profileStore'

// Inside onAuthStateChanged callback, after setUser(firebaseUser):
if (firebaseUser !== null) {
  useProfileStore.getState().fetchProfile(firebaseUser.uid)
}

// Inside logout(), after Firebase signOut:
useProfileStore.getState().reset()
```

> **Important:** Import `useProfileStore` at the top of `authStore.ts` only if it does not cause a circular dependency. If it does (because profileStore imports authStore), use `useProfileStore.getState()` lazily inside the callback body rather than at module load time — this pattern avoids circular import issues at module evaluation time.

---

## Architecture Notes for Codex

1. **Backward compatibility is required.** `DiscoveryScreen` and `MatchCelebrationModal` already use `useProfileStore().profile` and `useProfileStore().fetchProfile`. The public interface must remain compatible — do not rename these.

2. **No `any`.** The `updateDoc` call requires a `Record<string, unknown>` cast on the `Partial<UserProfile>` — this is explicitly commented and is the only permitted cast in this file. Every other type must be explicit.

3. **Optimistic updates with rollback.** `updateProfile` and `deletePhoto` both capture a snapshot before mutating local state, and restore it if the Firestore write fails. `uploadPhoto` does not optimistically update the URL (the URL is unknown until upload completes) — it shows loading instead.

4. **`serverTimestamp()` on every write.** Every call to `updateUserProfile` must include `lastActive: serverTimestamp()`. This is already included in `updateProfile`. Do not include it in `removePhotoFromProfile` (that's a targeted arrayRemove operation).

5. **Storage URL format.** `deleteObject(ref(storage, photoUrl))` requires that `photoUrl` be a `gs://` URI or a full `https://firebasestorage.googleapis.com` URL. The `ref()` function from the Firebase SDK handles both. Do not attempt to parse the URL manually.

6. **Minimum photo enforcement.** The minimum enforced in `deletePhoto` is 1 (not 2). Onboarding enforces 2 via the `MIN_PHOTOS` constant in `PhotoGrid`, but after onboarding the user should be able to drop to 1 without being blocked. EditProfileScreen (Task 37) may enforce 2 at the form-validation level separately.

7. **Circular import risk.** `profileStore` imports `useAuthStore` for `user.uid`. `authStore` calls `useProfileStore.getState().fetchProfile`. This is a module-level circular dependency only if the imports are evaluated at the same time. Using `.getState()` inside the callback (lazy evaluation) avoids this — the import itself is fine.

8. **Do not add persistence to profileStore.** Profile data is always fetched fresh from Firestore on auth. Persisting it to AsyncStorage would risk serving stale data and conflicts with server truth. The store is intentionally non-persisted.

---

## Acceptance Criteria

- [ ] `store/profileStore.ts` has `profile`, `isLoading`, `error` state with full TypeScript types
- [ ] `fetchProfile(userId)` reads `/users/{userId}` from Firestore, sets `profile` in state
- [ ] `updateProfile(partial)` writes to Firestore with `updateDoc`, optimistically updates local state, rolls back on error
- [ ] `updateProfile` always includes `lastActive: serverTimestamp()` in the Firestore write
- [ ] `uploadPhoto(uri, index)` compresses with `compressImage`, uploads via `uploadProfilePhoto`, updates Firestore `photos` array, updates local state — only on successful upload
- [ ] `deletePhoto(index)` removes URL from Firestore `photos` array via `arrayRemove`, deletes Storage file, updates local state — with rollback on error
- [ ] `deletePhoto` returns early with `error` if profile has only 1 photo remaining
- [ ] `authStore.initialise()` calls `profileStore.fetchProfile(uid)` when user logs in
- [ ] `authStore.logout()` calls `profileStore.reset()` to clear profile state
- [ ] All `profile.errors.*` i18n keys added to all 4 locale files
- [ ] Existing uses of `useProfileStore().profile` in `DiscoveryScreen` and `MatchCelebrationModal` continue to work without changes
- [ ] `services/firebase/firestore.ts` exports `updateUserProfile` and `removePhotoFromProfile`
- [ ] `services/firebase/storage.ts` exports `uploadProfilePhoto` and `deleteProfilePhoto`
- [ ] Zero `any` types (the one `Record<string, unknown>` cast in `updateUserProfile` is explicitly commented)
- [ ] Zero inline styles (store file — not applicable, but service files must have no UI)
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`app/discovery/DiscoveryScreen.tsx`, `components/discovery/MatchCelebrationModal.tsx`, `store/discoveryStore.ts`, `store/matchStore.ts`, `store/chatStore.ts`, `services/firebase/realtime.ts`, `utils/imageUtils.ts`, `types/user.ts`, `components/ui/`, `app/navigation/`, `functions/`, `App.tsx`

## Commit
`git commit -m "task-35: profile store with fetchProfile, updateProfile, uploadPhoto, deletePhoto"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 1E — Task 35] — YYYY-MM-DD

### Completed

- Task 35: profileStore fully implemented — fetchProfile, updateProfile, uploadPhoto, deletePhoto
- Optimistic updates with rollback for updateProfile and deletePhoto
- uploadPhoto: compress → upload → Firestore array write → local state sync
- deletePhoto: Firestore arrayRemove + Storage deleteObject + rollback
- authStore.initialise() now calls profileStore.fetchProfile on login
- authStore.logout() now calls profileStore.reset()
- profile.errors.* i18n keys added to all 4 locale files

### Files Created / Modified

- store/profileStore.ts: full implementation replacing Task 34 stub
- store/authStore.ts: fetchProfile on login, reset on logout wired
- services/firebase/firestore.ts: updateUserProfile, removePhotoFromProfile added
- services/firebase/storage.ts: uploadProfilePhoto confirmed/added, deleteProfilePhoto added
- i18n/en.json, my.json, zh.json, ta.json: profile.errors.* keys added

### Architecture Decisions

- profileStore is intentionally non-persisted — always fetched fresh from Firestore on auth
- Circular import avoided: authStore calls useProfileStore.getState() lazily inside callback
- Minimum photo enforcement at store level is 1; form-level (EditProfileScreen) enforces 2
- serverTimestamp() included in every updateProfile write for lastActive
- deleteProfilePhoto handles storage/object-not-found silently (file already gone is not an error)

### Known Issues / Deferred

- Profile photo reorder (drag-to-reorder) deferred to Phase 2
- Upload progress percentage not surfaced to UI — isLoading is binary for now; progress bar deferred to Task 37 (EditProfileScreen)

### Next Up

- Task 36: ProfileScreen — own profile view, stats row, verified badge, photo grid, edit/settings navigation
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 36 prompt.

---

## Reasoning Level
Medium
