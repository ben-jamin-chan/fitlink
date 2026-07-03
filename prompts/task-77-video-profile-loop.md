# CODEX PROMPT — Task 77: Video Profile Loop

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3B, Task 77. Task 76 (Voice Message Recording & Playback) is complete. `expo-av` is
installed and in use across `VoiceMessageRecorder.tsx` and `VoiceMessageBubble.tsx`. The chat
pipeline, storage service, and RTDB layer are all proven.

This task adds video profile loops: a user can upload a short (≤15 s, ≤50 MB) video that
appears as a playable tab in `FullProfileModal` and as a `🎥` badge chip on `SwipeCard`. No
video plays automatically in the discovery stack — the badge is the only discovery-layer
indicator. `expo-video` is the playback library; `expo-image-picker` (already installed)
handles the picker.

**Existing files Codex must read before touching anything:**

- `services/firebase/storage.ts` — `uploadProfilePhoto()` and `uploadVoiceMessage()` already
  exported; `uploadVideoProfile()` is the new addition. Read the upload pattern used by
  `uploadVoiceMessage()` (fetch blob → `uploadBytesResumable` → `getDownloadURL`) and mirror
  it exactly.
- `store/profileStore.ts` — `updateProfile()`, `uploadPhoto()`, and `deletePhoto()` already
  exported. The new `updateVideoProfile()` and `removeVideoProfile()` must call the existing
  `updateProfile()` action — never write to Firestore directly from the new actions.
- `app/profile/EditProfileScreen.tsx` — Photos section exists with `PhotoGrid`. The new
  "Video" row must be added **below** the photo grid section without disturbing the existing
  form structure or `isDirty` / `handleSubmit` logic.
- `components/discovery/SwipeCard.tsx` — Activity badge chips rendered in a horizontal row
  near the bottom of the card. The `🎥` chip is appended to that row when
  `user.videoProfileUrl` is truthy. **Do not alter swipe gesture logic, animation values, or
  the gradient overlay.**
- `components/discovery/FullProfileModal.tsx` — Photo gallery section has pagination dots and
  a `currentPhotoIndex` state. A "Video" tab must be added alongside the pagination dots.
  Switching to the Video tab renders `expo-video`'s `VideoView`; switching away pauses it.
  **Do not touch the Like / Pass / Super Like bottom bar, the Report button, or the scroll
  section layout below the gallery.**
- `types/user.ts` — `videoProfileUrl?: string` is already defined (added in Task 70). Do not
  modify `types/user.ts`.
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — `profile.video.*` keys
  must be added to all four files.
- `BUILD.md` — append a one-line note that `expo-video` requires a development build.
- `components/ui/LoadingOverlay.tsx` — already built; import and use for upload progress.

**Critical architectural boundary — no autoplay in discovery:**

**`SwipeCard.tsx` must only render a `🎥` text chip — never import `expo-video` or render a
`VideoView`. Autoplay in the discovery stack would destroy 60fps performance. Any video
rendering belongs exclusively in `FullProfileModal.tsx`.**

---

## Task 77 — Video Profile Loop

**Files to create:**
- `components/profile/VideoProfilePicker.tsx`

**Files to modify:**
- `services/firebase/storage.ts` — add `uploadVideoProfile()`
- `store/profileStore.ts` — add `updateVideoProfile()` and `removeVideoProfile()`
- `app/profile/EditProfileScreen.tsx` — add Video row below photo grid
- `components/discovery/SwipeCard.tsx` — add `🎥` chip when `videoProfileUrl` is set
- `components/discovery/FullProfileModal.tsx` — add Video tab with `expo-video` playback
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `profile.video.*` keys
- `BUILD.md` — document `expo-video` development-build requirement

---

### Install step (run before any code changes)

```bash
npx expo install expo-video expo-file-system
```

Both packages are required. `expo-file-system` is used for the pre-upload size check.
`expo-image-picker` is already installed — do not reinstall it.

---

### `components/profile/VideoProfilePicker.tsx`

Reusable named-export component used only by `EditProfileScreen`. Handles the entire
pick-validate-upload-remove lifecycle. Never reads from or writes to Firestore directly —
all persistence goes through `profileStore`.

```typescript
// 1. React
import React, { useState } from 'react'

// 2. React Native
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native'

// 3. Third-party (alphabetical)
import * as FileSystem from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'

// 4. Internal — stores
import { useProfileStore } from '@/store/profileStore'

// 5. Internal — components
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

// 6. Internal — constants
import { colors, spacing, typography } from '@/constants/theme'

// Max file size: 50 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
// Max duration in seconds enforced by the picker
const MAX_VIDEO_DURATION_SECONDS = 15

interface VideoProfilePickerProps {
  /** Current persisted video URL from the user's profile. Undefined or empty string = no video. */
  currentVideoUrl: string | undefined
}

export const VideoProfilePicker = ({
  currentVideoUrl,
}: VideoProfilePickerProps): React.JSX.Element => {
  const { t } = useTranslation()
  const { updateVideoProfile, removeVideoProfile } = useProfileStore()

  // Local preview URI shown optimistically while upload is in flight.
  // Reverted to null on error so the UI shows the persisted state.
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState<boolean>(false)

  // The URI to display as a thumbnail. Prefer the local preview (upload in progress)
  // over the persisted URL so the UI feels instant.
  const displayUri: string | null = localPreviewUri ?? currentVideoUrl ?? null

  const handlePick = async (): Promise<void> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('profile.video.permissionTitle'), t('profile.video.permissionMessage'))
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
      allowsEditing: false,
      quality: 1,
    })

    if (result.canceled || result.assets.length === 0) return

    const asset = result.assets[0]
    const uri = asset.uri

    // Pre-upload size check using expo-file-system.
    const info = await FileSystem.getInfoAsync(uri, { size: true })
    if (info.exists && 'size' in info && info.size > MAX_VIDEO_BYTES) {
      Alert.alert(t('profile.video.tooLarge'))
      return
    }

    // Optimistic local preview — set before upload so the thumbnail appears immediately.
    setLocalPreviewUri(uri)
    setIsUploading(true)

    try {
      await updateVideoProfile(uri)
      // On success, leave localPreviewUri set. profileStore.profile.videoProfileUrl will
      // update via the Firestore listener and the parent will pass the new URL as currentVideoUrl.
    } catch {
      // Revert optimistic preview on failure.
      setLocalPreviewUri(null)
      Alert.alert(t('profile.video.uploadError'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = (): void => {
    Alert.alert(
      t('profile.video.removeTitle'),
      t('profile.video.removeMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.video.remove'),
          style: 'destructive',
          onPress: async (): Promise<void> => {
            setIsUploading(true)
            setLocalPreviewUri(null)
            try {
              await removeVideoProfile()
            } catch {
              Alert.alert(t('profile.video.removeError'))
            } finally {
              setIsUploading(false)
            }
          },
        },
      ],
    )
  }

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={isUploading} message={t('profile.video.uploading')} />

      {displayUri ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: displayUri }} style={styles.thumbnail} resizeMode="cover" />
          <View style={styles.previewActions}>
            <Text style={styles.videoLabel}>{t('profile.video.added')}</Text>
            <Pressable onPress={handlePick} style={styles.changeButton}>
              <Text style={styles.changeButtonText}>{t('profile.video.change')}</Text>
            </Pressable>
            <Pressable onPress={handleRemove} style={styles.removeButton}>
              <Text style={styles.removeButtonText}>{t('profile.video.remove')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={handlePick} style={styles.addButton}>
          <Text style={styles.addIcon}>🎥</Text>
          <Text style={styles.addLabel}>{t('profile.video.add')}</Text>
          <Text style={styles.addHint}>{t('profile.video.hint')}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
  } as ViewStyle,

  // Empty / add state
  addButton: {
    alignItems: 'center',
    borderColor: colors.gray[400],
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    paddingVertical: spacing.lg,
  } as ViewStyle,
  addIcon: {
    fontSize: typography.sizes.xxl,
    marginBottom: spacing.xs,
  } as TextStyle,
  addLabel: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
  addHint: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  } as TextStyle,

  // Preview state
  previewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  } as ViewStyle,
  thumbnail: {
    borderRadius: 8,
    height: 80,
    width: 80,
  } as ImageStyle,
  previewActions: {
    flex: 1,
    gap: spacing.xs,
  } as ViewStyle,
  videoLabel: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
  changeButton: {
    alignSelf: 'flex-start',
  } as ViewStyle,
  changeButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  removeButton: {
    alignSelf: 'flex-start',
  } as ViewStyle,
  removeButtonText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  } as TextStyle,
})
```

---

### `services/firebase/storage.ts` — Update

Add one new named export. Do not modify any existing function or the import block at the top
of the file. Read the existing `uploadVoiceMessage()` for the exact fetch-blob-upload pattern
to mirror.

```typescript
// ADD these imports only if they are not already present — they are used by uploadVoiceMessage:
// import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
// import { storage } from '@/services/firebase/config'

// ADD this export after the existing uploadVoiceMessage() function:

/**
 * Uploads a local video URI to the user's video profile slot.
 * Path: users/{uid}/video/profile.mp4
 * Returns the Firebase Storage download URL.
 *
 * The path is fixed — each new upload silently overwrites the previous video file
 * in Storage. Orphaned blob cleanup is deferred to Phase 4.
 */
export const uploadVideoProfile = async (uid: string, localUri: string): Promise<string> => {
  const storagePath = `users/${uid}/video/profile.mp4`
  const storageRef = ref(storage, storagePath)

  const response = await fetch(localUri)
  const blob = await response.blob()

  const uploadTask = uploadBytesResumable(storageRef, blob, {
    contentType: 'video/mp4',
  })

  return new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      // Progress events not tracked here — VideoProfilePicker shows a LoadingOverlay
      // for the full duration of the upload.
      () => undefined,
      (error) => reject(error),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(downloadUrl)
      },
    )
  })
}
```

---

### `store/profileStore.ts` — Update

Add two new action implementations. Do not modify any existing actions, state shape, the
`partialize` persist configuration, or any existing import.

```typescript
// ADD this import if uploadVideoProfile is not already imported:
import { uploadVideoProfile } from '@/services/firebase/storage'

// ADD these two actions inside the Zustand store's action map,
// after the existing deletePhoto() action:

/**
 * Uploads the video at localUri to Storage then persists the returned URL
 * to the user's Firestore profile via the existing updateProfile() action.
 * Never writes to Firestore directly.
 */
updateVideoProfile: async (localUri: string): Promise<void> => {
  const uid = get().profile?.uid
  if (!uid) throw new Error('No authenticated user')

  const videoProfileUrl = await uploadVideoProfile(uid, localUri)
  await get().updateProfile({ videoProfileUrl })
},

/**
 * Clears the video profile URL from Firestore.
 * The Storage blob at users/{uid}/video/profile.mp4 is NOT deleted here —
 * orphaned Storage cleanup is a Phase 4 concern.
 */
removeVideoProfile: async (): Promise<void> => {
  await get().updateProfile({ videoProfileUrl: '' })
},
```

> **Type note:** If `updateProfile()` accepts a partial type that omits `videoProfileUrl`
> due to an overly broad server-field omit list, add `videoProfileUrl` back to the allowed
> input set. `videoProfileUrl` is a client-writable field per architecture — do not cast
> with `as`, fix the type directly.

---

### `app/profile/EditProfileScreen.tsx` — Update

Add the Video row below the existing photo grid section. Read the file first to identify the
exact closing tag of the photo grid container. Do not touch the form schema, Zod validation,
`handleSubmit`, `isDirty` logic, unsaved-changes guard, or the StyleSheet.

```typescript
// ADD import in the Internal — components block:
import { VideoProfilePicker } from '@/components/profile/VideoProfilePicker'

// ADD this block immediately after the closing </View> of the photo grid section,
// before the next form section begins. It sits outside the React Hook Form Controller
// tree because video upload is handled independently by profileStore:

{/* Video profile */}
<View style={styles.sectionContainer}>
  <Text style={styles.sectionLabel}>{t('profile.video.sectionTitle')}</Text>
  <VideoProfilePicker currentVideoUrl={profile?.videoProfileUrl} />
</View>

// If sectionContainer / sectionLabel do not exist under those exact keys, reuse
// whichever style names the photo grid section uses for its label and container.
// Do not add duplicate StyleSheet keys.
```

> Do not touch the `handleSubmit`, `onClose`, Zod schema, or any other section of the form.

---

### `components/discovery/SwipeCard.tsx` — Update

Append a `🎥` chip to the activity badges row when `user.videoProfileUrl` is truthy. No new
imports. `expo-video` must NOT appear anywhere in this file.

```typescript
// LOCATE the JSX that renders activity badge chips — it looks approximately like:
//
//   {user.activities.slice(0, 2).map((activity) => (
//     <View key={activity} style={styles.badge}>
//       <Text style={styles.badgeText}>{activity}</Text>
//     </View>
//   ))}
//
// ADD the video chip immediately after that mapped block, before the closing tag
// of the badges row container:

{!!user.videoProfileUrl && (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>🎥</Text>
  </View>
)}

// No StyleSheet changes needed — reuse the existing styles.badge and styles.badgeText
// that the activity chips already use.
```

> **Do not touch:** swipe gesture handlers, `useSharedValue` declarations,
> `useAnimatedStyle`, the gradient overlay, photo pagination dots, or any other section
> of this file.

---

### `components/discovery/FullProfileModal.tsx` — Update

Add a Photo / Video tab selector to the gallery section and render `expo-video`'s `VideoView`
when the Video tab is active. Pause the player on tab switch and on modal close.

```typescript
// ADD imports — in the Third-party block, alphabetically alongside existing imports:
import { useVideoPlayer, VideoView } from 'expo-video'

// ADD new state variable alongside existing state (e.g. currentPhotoIndex):
const [isVideoTabActive, setIsVideoTabActive] = useState<boolean>(false)

// Create the expo-video player unconditionally (React hook rules).
// Pass an empty string when videoProfileUrl is absent so the hook call is always reached.
// loop and muted are configured via the initializer callback.
const videoPlayer = useVideoPlayer(profile.videoProfileUrl ?? '', (player) => {
  player.loop = true
  player.muted = false
})

// Pause the player on unmount to release the media session and prevent audio bleed.
useEffect(() => {
  return () => {
    videoPlayer.pause()
  }
}, [videoPlayer])

// Tab switch handlers:
const handleSwitchToPhotoTab = (): void => {
  videoPlayer.pause()
  setIsVideoTabActive(false)
}

const handleSwitchToVideoTab = (): void => {
  setIsVideoTabActive(true)
  videoPlayer.play()
}

// -----------------------------------------------------------------------
// GALLERY SECTION — replace only the photo gallery container JSX.
// Everything below the gallery (bio, fitness profile, lifestyle, about,
// shared interests, bottom action bar) must remain completely unchanged.
// -----------------------------------------------------------------------

// REPLACE the existing gallery <View> with the conditional below.
// The no-video branch must be an exact copy of the original gallery JSX
// so existing behaviour is fully preserved when videoProfileUrl is absent.

{profile.videoProfileUrl ? (
  <View style={styles.galleryContainer}>
    {/* Tab selector */}
    <View style={styles.mediaTabs}>
      <Pressable
        onPress={handleSwitchToPhotoTab}
        style={[styles.mediaTab, !isVideoTabActive && styles.mediaTabActive]}
      >
        <Text style={[styles.mediaTabText, !isVideoTabActive && styles.mediaTabTextActive]}>
          {t('profile.video.photoTab')}
        </Text>
      </Pressable>
      <Pressable
        onPress={handleSwitchToVideoTab}
        style={[styles.mediaTab, isVideoTabActive && styles.mediaTabActive]}
      >
        <Text style={[styles.mediaTabText, isVideoTabActive && styles.mediaTabTextActive]}>
          {t('profile.video.tab')}
        </Text>
      </Pressable>
    </View>

    {isVideoTabActive ? (
      <VideoView
        player={videoPlayer}
        style={styles.galleryImage}
        contentFit="cover"
        nativeControls={false}
      />
    ) : (
      <>
        <Image
          source={{ uri: profile.photos[currentPhotoIndex] }}
          style={styles.galleryImage}
          resizeMode="cover"
        />
        <View style={styles.paginationDots}>
          {profile.photos.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentPhotoIndex && styles.dotActive]}
            />
          ))}
        </View>
      </>
    )}
  </View>
) : (
  // No video — original gallery unchanged.
  <View style={styles.galleryContainer}>
    <Image
      source={{ uri: profile.photos[currentPhotoIndex] }}
      style={styles.galleryImage}
      resizeMode="cover"
    />
    <View style={styles.paginationDots}>
      {profile.photos.map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === currentPhotoIndex && styles.dotActive]}
        />
      ))}
    </View>
  </View>
)}

// ADD these new style keys to the existing StyleSheet.create({}) at the bottom.
// Do not modify or remove any existing style key.

mediaTabs: {
  flexDirection: 'row',
  justifyContent: 'center',
  gap: spacing.sm,
  paddingVertical: spacing.xs,
} as ViewStyle,
mediaTab: {
  borderColor: colors.gray[400],
  borderRadius: 16,
  borderWidth: 1,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.xs,
} as ViewStyle,
mediaTabActive: {
  backgroundColor: colors.primary,
  borderColor: colors.primary,
} as ViewStyle,
mediaTabText: {
  color: colors.gray[600],
  fontSize: typography.sizes.sm,
  fontWeight: typography.weights.medium,
} as TextStyle,
mediaTabTextActive: {
  color: colors.white,
} as TextStyle,
```

> **Do not touch:** Like / Pass / Super Like bottom bar, Report and Close buttons, all
> ScrollView sections below the gallery (bio, fitness profile, lifestyle, about, shared
> interests), and all existing StyleSheet keys.

---

### `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Merge the following keys into the existing `profile` object in each file. Do not replace the
entire `profile` object. Use the English values as placeholders in `my.json`, `zh.json`, and
`ta.json` (per CONVENTIONS.md Section 8). Validate JSON syntax after editing each file.

```json
"profile": {
  "video": {
    "sectionTitle": "Profile Video",
    "add": "Add a Video",
    "hint": "Up to 15 seconds · Max 50 MB",
    "added": "Video added",
    "change": "Change Video",
    "remove": "Remove Video",
    "removeTitle": "Remove Video?",
    "removeMessage": "This will remove your profile video.",
    "removeError": "Failed to remove video. Please try again.",
    "uploading": "Uploading video...",
    "uploadError": "Video upload failed. Please try again.",
    "tooLarge": "Video must be under 50 MB. Please choose a shorter clip.",
    "permissionTitle": "Media Access Required",
    "permissionMessage": "Please allow access to your media library in Settings.",
    "tab": "🎥 Video",
    "photoTab": "Photos"
  }
}
```

---

### `BUILD.md` — Update

Append the following line to the existing development-build requirements section (which already
documents `expo-av` for voice messages):

```markdown
- `expo-video` (video profile playback) requires a development build — not supported in Expo Go.
```

---

## Important Architecture Notes for Codex

1. **No `expo-video` in `SwipeCard.tsx`.** The 60fps swipe stack cannot tolerate video player
   instances mounted per visible card. The `🎥` chip is a plain `<Text>` node inside an
   existing `<View style={styles.badge}>`. Any `expo-video` import in `SwipeCard` is
   architectural drift and must be removed before the task is considered complete.

2. **`useVideoPlayer` must be called unconditionally.** React hook rules prohibit conditional
   hook calls. Pass `profile.videoProfileUrl ?? ''` as the source so the hook is always
   invoked. Only call `player.play()` inside the `handleSwitchToVideoTab` handler — never
   in an unconditional `useEffect` or at module scope.

3. **Pause on all three exit paths.** The player must be paused:
   (a) in the `useEffect` cleanup (modal unmount / close),
   (b) in `handleSwitchToPhotoTab` (user taps the Photos tab),
   and — automatically — when the modal closes because path (a) fires.
   Missing any of these paths causes audio bleed into the next screen.

4. **File size check before any state mutation.** In `VideoProfilePicker.handlePick()`, the
   `FileSystem.getInfoAsync()` call and the size comparison must execute — and if oversized
   must call `Alert.alert` and `return` — **before** `setLocalPreviewUri(uri)` is called.
   An oversized video must never touch component state.

5. **Storage path is a fixed overwrite.** `users/{uid}/video/profile.mp4` is intentionally
   constant. Each new upload overwrites the previous blob. `removeVideoProfile()` writes an
   empty string to Firestore but does not delete the Storage blob. Both behaviours must be
   documented with JSDoc comments on the respective functions.

6. **`expo-image-picker` `mediaTypes` array form.** Expo SDK 52 requires
   `mediaTypes: ['videos']` (string array literal). Do not use the deprecated
   `MediaTypeOptions.Videos` enum — it was removed in recent SDK versions.

7. **Do not modify `types/user.ts`.** The `videoProfileUrl?: string` field was added in
   Task 70 and is already present. If a compile error arises from `videoProfileUrl` not
   being accepted by `updateProfile()`'s input type, fix the store's partial type — do not
   touch `types/user.ts`.

8. **`noUnusedLocals` and `noUnusedParameters` are enabled.** Every imported symbol must be
   used. Do not import `useEffect` if it is already imported; do not import `useState` twice.
   After edits, run `npx tsc --noEmit` and resolve every diagnostic before declaring done.

---

## Acceptance Criteria

- [ ] `npx expo install expo-video expo-file-system` completes without peer-dependency errors
- [ ] `components/profile/VideoProfilePicker.tsx` created and exported as a named export
- [ ] `VideoProfilePicker` accepts `currentVideoUrl: string | undefined` prop and renders empty-state or preview-state correctly
- [ ] File size check (`> 50 MB`) executes before `setLocalPreviewUri` and aborts with `Alert` if over limit
- [ ] `expo-image-picker` uses `mediaTypes: ['videos']` array form — not deprecated enum
- [ ] `services/firebase/storage.ts` exports `uploadVideoProfile(uid, localUri): Promise<string>` uploading to `users/{uid}/video/profile.mp4`
- [ ] `store/profileStore.ts` exports `updateVideoProfile(localUri): Promise<void>` and `removeVideoProfile(): Promise<void>`; both call `updateProfile()` — no direct Firestore writes
- [ ] `app/profile/EditProfileScreen.tsx` renders `<VideoProfilePicker>` below the photo grid; form logic, Zod schema, and StyleSheet are untouched
- [ ] `components/discovery/SwipeCard.tsx` renders a `🎥` chip using existing `styles.badge` / `styles.badgeText` when `user.videoProfileUrl` is truthy; `expo-video` is NOT imported in this file
- [ ] `components/discovery/FullProfileModal.tsx` renders Photo / Video tab selector when `profile.videoProfileUrl` is set
- [ ] `useVideoPlayer` called unconditionally with `profile.videoProfileUrl ?? ''` fallback
- [ ] `player.play()` called only in `handleSwitchToVideoTab`; `player.pause()` called in `handleSwitchToPhotoTab` and in `useEffect` cleanup
- [ ] `VideoView` renders with `contentFit="cover"` and `nativeControls={false}`
- [ ] No-video path in `FullProfileModal` is an exact copy of the original gallery JSX — behaviour unchanged when `videoProfileUrl` is absent
- [ ] All user-facing strings routed through `t()` — zero hardcoded English text in JSX
- [ ] `profile.video.*` keys present and valid JSON in `en.json`, `my.json`, `zh.json`, `ta.json`
- [ ] `BUILD.md` documents `expo-video` development-build requirement
- [ ] All styles in `StyleSheet.create({})` — zero `style={{ }}` in JSX across all touched files
- [ ] All colors, spacing, and typography from `constants/theme` — no hardcoded values
- [ ] All imports use `@/` alias — no relative paths
- [ ] Zero `any` in any touched file
- [ ] Zero `console.*` in any touched file
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `services/firebase/config.ts`, `services/firebase/realtime.ts`,
`store/chatStore.ts`, `store/discoveryStore.ts`, `store/matchStore.ts`,
`types/user.ts`, `types/match.ts`, `types/message.ts`, `types/event.ts`, `types/checkin.ts`,
`components/chat/VoiceMessageRecorder.tsx`, `components/chat/VoiceMessageBubble.tsx`,
`components/chat/ChatInput.tsx`, `app/chat/ChatScreen.tsx`,
`functions/src/`, `firestore.rules`, `firestore.indexes.json`,
`constants/`, `hooks/`

---

## Commit

```
git commit -m "task-77: video profile loop — picker, storage upload, swipe badge, full profile modal playback"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3B — Task 77] — YYYY-MM-DD

### Completed

- Task 77: Video Profile Loop
- expo-video and expo-file-system installed
- uploadVideoProfile: Firebase Storage upload to users/{uid}/video/profile.mp4; fixed path overwrites previous video; returns download URL
- updateVideoProfile / removeVideoProfile: profileStore actions; both delegate to updateProfile(); Storage blob not deleted on remove (Phase 4)
- VideoProfilePicker: named-export component with pick → size-check (≤50 MB) → optimistic preview → upload → remove lifecycle; LoadingOverlay during upload; error reverts local state
- EditProfileScreen: Video row added below photo grid; form logic and StyleSheet untouched
- SwipeCard: 🎥 chip appended to activity badges row using existing badge styles; expo-video not imported
- FullProfileModal: Photo/Video tab selector; useVideoPlayer called unconditionally; VideoView plays on tab activate; player.pause() on tab switch and useEffect cleanup; no-video branch preserves original gallery JSX unchanged
- profile.video.* i18n keys added to all 4 language files
- BUILD.md: expo-video development-build requirement documented

### Files Created / Modified

- components/profile/VideoProfilePicker.tsx: created — pick, size-validate, optimistic-upload, remove lifecycle
- services/firebase/storage.ts: uploadVideoProfile() added
- store/profileStore.ts: updateVideoProfile() and removeVideoProfile() actions added
- app/profile/EditProfileScreen.tsx: VideoProfilePicker row added below photo grid
- components/discovery/SwipeCard.tsx: 🎥 chip added to badge row; no expo-video import
- components/discovery/FullProfileModal.tsx: Photo/Video tabs with expo-video VideoView; play/pause lifecycle
- i18n/en.json, my.json, zh.json, ta.json: profile.video.* keys added
- BUILD.md: expo-video development-build note appended
- package.json, package-lock.json: expo-video and expo-file-system added

### Architecture Decisions

- Storage path users/{uid}/video/profile.mp4 is intentionally fixed — each upload silently overwrites; Storage blob not deleted on remove; documented with JSDoc
- useVideoPlayer called unconditionally with '' fallback to satisfy React hook rules; play() only called in tab-switch handler
- expo-video imported only in FullProfileModal — never in SwipeCard — to preserve 60fps discovery stack performance
- expo-image-picker uses mediaTypes: ['videos'] array form (SDK 52 API); deprecated MediaTypeOptions enum avoided

### Known Issues / Deferred

- Video profile playback requires a development build; cannot be tested in Expo Go
- Storage blob at users/{uid}/video/profile.mp4 is not deleted when removeVideoProfile() is called — orphaned blob cleanup deferred to Phase 4

### Next Up

- Task 78: Google Places Gym Search Service
```

Then return to claude.ai with the updated CHANGELOG.md to request the Task 78 prompt.

---

## Reasoning Level

High — involves a new third-party playback library (`expo-video`) with imperative lifecycle
management (`useVideoPlayer`, `player.play()`, `player.pause()`), an unconditional-hook
constraint requiring a non-obvious empty-string fallback, coordinated changes across five
existing files each with explicit do-not-touch sub-sections, and a three-path pause
requirement (unmount, tab switch, and implicitly on modal close via unmount) that is easy
to implement partially and hard to catch in a type-check pass alone.
