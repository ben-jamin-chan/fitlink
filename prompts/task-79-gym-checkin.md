# CODEX PROMPT — TASK 79: Gym Check-In Feature

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 78 is complete. `services/places.ts` is built and exports two functions:
- `searchNearbyGyms(coords, radiusMeters)` — calls the Places API (New) and returns `GymPlace[]`
- `getPlacePhotoUrl(photoName, maxWidth)` — pure string builder for photo media URLs

Task 70 is complete. `types/checkin.ts` exists and exports:
- `GymCheckin` interface — Firestore document shape with `coordinates: GeoPoint`
- `GymPlace` interface — client-side Places API result shape with `coordinates: GymPlaceCoordinates` (plain `{ latitude: number; longitude: number }`, **not** a Firestore `GeoPoint`)

This coordinate type split is intentional and must be preserved: `GymPlace.coordinates` is the raw Places API response shape, `GymCheckin.coordinates` is the Firestore-stored `admin.firestore.GeoPoint` written by the Cloud Function. The `createCheckin` Cloud Function is where the conversion happens — the client passes `latitude` and `longitude` as plain numbers, the function constructs the `GeoPoint`.

Existing files Codex must read before touching any file:

- `services/places.ts` — `searchNearbyGyms()` and `getPlacePhotoUrl()` already exported; do not re-implement
- `types/checkin.ts` — `GymCheckin`, `GymPlace`, `GymPlaceCoordinates` already defined; do not redeclare
- `types/user.ts` — `UserProfile.gymCheckin?: { gymName: string; expiresAt: Timestamp }` already added in Task 70
- `components/discovery/SwipeCard.tsx` — modified in Task 77 (video badge chip added); Task 79 adds a `"📍 At gym"` chip — do not remove the video badge or any other existing badge logic
- `app/profile/ProfileScreen.tsx` — modified in Tasks 63 and 74 (TodayActivityCard, Boost row); Task 79 adds the ActiveCheckinBanner and check-in CTA row — do not remove existing profile content
- `app/navigation/MainTabNavigator.tsx` — currently has 4 bottom tabs (Discover, Matches, Profile, Settings) and `ProfileStackParamList`; Task 79 adds `GymCheckin` to the Profile stack only — **no new tab is added here** (the Events tab is Task 80)
- `functions/src/index.ts` — all Cloud Functions export through here; append `createCheckin` export
- `firestore.rules` — modified in Phase 2 Tasks 68 and Phase 3 Tasks 73/74; Task 79 appends `/gymCheckins/{id}` rules only — do not touch any existing rule block
- `store/profileStore.ts` — `updateProfile()` action available; used by checkinStore for checkout cleanup
- `components/ui/Button.tsx` — primary/outline/ghost variants; `loading` and `disabled` props
- `components/ui/LoadingOverlay.tsx` — `visible: boolean`, `message?: string`
- `components/ui/Toast.tsx` — `showToast(message, type)` available globally

**`app/checkin/` and `components/checkin/` directories do not exist yet — Codex must create them.**

**All `/gymCheckins` Firestore document writes go through the `createCheckin` Cloud Function only. The client must never write directly to `/gymCheckins`. Delete (`checkOut`) is the only client-permitted write and is explicitly allowed in security rules.**

---

## Task 79 — Gym Check-In Feature

**Install first:**
```bash
npx expo install expo-location
```

**Files to create:**
- `functions/src/createCheckin.ts`
- `store/checkinStore.ts`
- `app/checkin/GymCheckinScreen.tsx`
- `components/checkin/GymSearchList.tsx`
- `components/checkin/ActiveCheckinBanner.tsx`

**Files to modify:**
- `app/profile/ProfileScreen.tsx` — add `subscribeToActiveCheckin`, `ActiveCheckinBanner`, and "📍 Check In to a Gym" tappable row
- `components/discovery/SwipeCard.tsx` — add `"📍 At gym"` chip badge when `user.gymCheckin` is active
- `app/navigation/MainTabNavigator.tsx` — add `GymCheckin` to `ProfileStackParamList` and register it as a screen inside the Profile stack
- `functions/src/index.ts` — export `createCheckin`
- `firestore.rules` — append `/gymCheckins/{id}` rules block
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `checkin.*` keys

---

### `functions/src/createCheckin.ts`

> 2nd gen callable Cloud Function (`asia-southeast1`). Writes a new `/gymCheckins/{id}` document
> and a denormalised `users/{uid}.gymCheckin` field in a single batch. The client never writes
> to `/gymCheckins` directly — this function is the only write path.

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

// Input shape accepted from the client
interface CreateCheckinInput {
  placeId: string
  gymName: string
  latitude: number
  longitude: number
  city: string
}

// Return shape sent back to the client
interface CreateCheckinResult {
  checkinId: string
  expiresAt: admin.firestore.Timestamp
}

export const createCheckin = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest<CreateCheckinInput>): Promise<CreateCheckinResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in to check in')
    }

    const uid = request.auth.uid
    const { placeId, gymName, latitude, longitude, city } = request.data

    if (!placeId || !gymName || !city || latitude == null || longitude == null) {
      throw new HttpsError('invalid-argument', 'Missing required check-in fields')
    }

    const db = admin.firestore()
    const now = admin.firestore.Timestamp.now()

    // Check for an existing active check-in for this user
    const existingSnap = await db
      .collection('gymCheckins')
      .where('userId', '==', uid)
      .where('expiresAt', '>', now)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      throw new HttpsError('already-exists', 'already-checked-in')
    }

    // expiresAt = 2 hours from now — use Timestamp.fromMillis so the value is deterministic
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 2 * 60 * 60 * 1000)

    const checkinRef = db.collection('gymCheckins').doc()

    // Write the gymCheckins doc and the denormalised user field atomically
    const batch = db.batch()

    batch.set(checkinRef, {
      userId: uid,
      placeId,
      gymName,
      coordinates: new admin.firestore.GeoPoint(latitude, longitude),
      city,
      checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
    })

    batch.update(db.doc(`users/${uid}`), {
      gymCheckin: { gymName, expiresAt },
    })

    await batch.commit()

    return { checkinId: checkinRef.id, expiresAt }
  }
)
```

---

### `functions/src/index.ts` — Update

> Append the `createCheckin` export alongside existing exports. Do not remove or reorder any
> existing exports.

```typescript
// Add this line with the other Phase 3C exports:
export { createCheckin } from './createCheckin'
```

---

### `store/checkinStore.ts`

> Zustand store managing the user's active gym check-in. **Not persisted** — session-only state.
> The Firestore listener drives all state changes; the store never optimistically mutates
> `activeCheckin` without a confirmed server response.

```typescript
import { create } from 'zustand'
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
  FieldValue,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/services/firebase/config'
import type { GymCheckin, GymPlace } from '@/types/checkin'

// Shape returned by the createCheckin Cloud Function
interface CreateCheckinResult {
  checkinId: string
  expiresAt: { seconds: number; nanoseconds: number }
}

interface CheckinState {
  activeCheckin: GymCheckin | null
  isLoading: boolean
  // Stored unsubscribe function — internal, not exposed on the public interface
  _unsubscribe: (() => void) | null
}

interface CheckinActions {
  subscribeToActiveCheckin: (uid: string) => void
  unsubscribeFromActiveCheckin: () => void
  checkIn: (gym: GymPlace) => Promise<void>
  checkOut: (uid: string) => Promise<void>
}

export const useCheckinStore = create<CheckinState & CheckinActions>((set, get) => ({
  activeCheckin: null,
  isLoading: false,
  _unsubscribe: null,

  subscribeToActiveCheckin: (uid: string): void => {
    // Clean up any previous subscription before creating a new one
    const existing = get()._unsubscribe
    if (existing) existing()

    const now = Timestamp.now()
    const q = query(
      collection(db, 'gymCheckins'),
      where('userId', '==', uid),
      where('expiresAt', '>', now)
    )

    const unsubscribe = onSnapshot(q, (snap) => {
      if (snap.empty) {
        set({ activeCheckin: null })
        return
      }
      const docSnap = snap.docs[0]
      const data = docSnap.data()
      set({
        activeCheckin: {
          id: docSnap.id,
          userId: data['userId'] as string,
          placeId: data['placeId'] as string,
          gymName: data['gymName'] as string,
          coordinates: data['coordinates'] as GymCheckin['coordinates'],
          city: data['city'] as string,
          checkedInAt: data['checkedInAt'] as Timestamp,
          expiresAt: data['expiresAt'] as Timestamp,
        } satisfies GymCheckin,
      })
    })

    set({ _unsubscribe: unsubscribe })
  },

  unsubscribeFromActiveCheckin: (): void => {
    const unsubscribe = get()._unsubscribe
    if (unsubscribe) {
      unsubscribe()
      set({ _unsubscribe: null })
    }
  },

  checkIn: async (gym: GymPlace): Promise<void> => {
    set({ isLoading: true })
    try {
      const createCheckin = httpsCallable<
        {
          placeId: string
          gymName: string
          latitude: number
          longitude: number
          city: string
        },
        CreateCheckinResult
      >(functions, 'createCheckin')

      await createCheckin({
        placeId: gym.placeId,
        gymName: gym.name,
        latitude: gym.coordinates.latitude,
        longitude: gym.coordinates.longitude,
        city: '', // GymCheckinScreen passes city from the user's profile via the screen; see note below
      })
      // activeCheckin is set by the onSnapshot listener — no optimistic mutation needed
    } finally {
      set({ isLoading: false })
    }
  },

  checkOut: async (uid: string): Promise<void> => {
    const { activeCheckin } = get()
    if (!activeCheckin) return

    set({ isLoading: true })
    try {
      // Delete the gymCheckins document (client-permitted by firestore.rules)
      await deleteDoc(doc(db, 'gymCheckins', activeCheckin.id))

      // Clear the denormalised field on the user doc
      await updateDoc(doc(db, 'users', uid), {
        gymCheckin: FieldValue.delete(),
      })

      set({ activeCheckin: null })
    } finally {
      set({ isLoading: false })
    }
  },
}))
```

> **Note on `city` field:** `GymCheckinScreen` should read the current user's `profile.location.city`
> from `profileStore` and pass it when calling `checkinStore.checkIn()`. To keep the store
> interface clean, the city is supplied by the caller rather than fetched inside the store. The
> `GymCheckinScreen` scaffold below shows the correct wiring.

---

### `components/checkin/GymSearchList.tsx`

> Reusable `FlatList` component that renders the gym search results from the Places API.
> Used only by `GymCheckinScreen` in Task 79; not shared with other features.

```typescript
import React from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { GymPlace } from '@/types/checkin'
import { colors, spacing, typography } from '@/constants/theme'

interface GymSearchListProps {
  gyms: GymPlace[]
  onSelect: (gym: GymPlace) => void
  isLoading: boolean
}

export const GymSearchList = ({
  gyms,
  onSelect,
  isLoading,
}: GymSearchListProps): React.JSX.Element => {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (gyms.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{t('checkin.noGymsNearby')}</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={gyms}
      keyExtractor={(item) => item.placeId}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => onSelect(item)}>
          <Ionicons
            name="fitness-outline"
            size={22}
            color={colors.primary}
            style={styles.rowIcon}
          />
          <View style={styles.rowContent}>
            <Text style={styles.gymName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.gymAddress} numberOfLines={1}>
              {item.address}
            </Text>
            {item.rating != null && (
              <Text style={styles.gymRating}>
                {'⭐ '}
                {item.rating.toFixed(1)}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward-outline" size={18} color={colors.gray[400]} />
        </TouchableOpacity>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.listContent}
    />
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  } as ViewStyle,
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
  } as TextStyle,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  } as ViewStyle,
  rowIcon: {
    marginRight: spacing.sm,
  } as ViewStyle,
  rowContent: {
    flex: 1,
  } as ViewStyle,
  gymName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
  } as TextStyle,
  gymAddress: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    marginTop: 2,
  } as TextStyle,
  gymRating: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    marginTop: 2,
  } as TextStyle,
  separator: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginLeft: spacing.md + 22 + spacing.sm, // align with text, not icon
  } as ViewStyle,
  listContent: {
    flexGrow: 1,
  } as ViewStyle,
})
```

---

### `components/checkin/ActiveCheckinBanner.tsx`

> Compact banner rendered at the top of `ProfileScreen` when the user has an active check-in.
> Shows gym name, a live countdown updated every 60 seconds, and a "Check Out" button.
> The countdown uses `setInterval` in local state — no external library needed.

```typescript
import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { GymCheckin } from '@/types/checkin'
import { colors, spacing, typography } from '@/constants/theme'

interface ActiveCheckinBannerProps {
  checkin: GymCheckin
  onCheckOut: () => void
}

function getRemainingLabel(expiresAtMs: number): string {
  const diffMs = expiresAtMs - Date.now()
  if (diffMs <= 0) return '0m'
  const totalMinutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export const ActiveCheckinBanner = ({
  checkin,
  onCheckOut,
}: ActiveCheckinBannerProps): React.JSX.Element => {
  const { t } = useTranslation()
  const expiresAtMs = checkin.expiresAt.toMillis()

  const [remainingLabel, setRemainingLabel] = useState<string>(() =>
    getRemainingLabel(expiresAtMs)
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingLabel(getRemainingLabel(expiresAtMs))
    }, 60_000)
    return () => clearInterval(interval)
  }, [expiresAtMs])

  return (
    <View style={styles.banner}>
      <Ionicons name="location" size={18} color={colors.primary} style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.gymName} numberOfLines={1}>
          {checkin.gymName}
        </Text>
        <Text style={styles.countdown}>
          {t('checkin.banner.remaining', { remaining: remainingLabel })}
        </Text>
      </View>
      <TouchableOpacity style={styles.checkOutButton} onPress={onCheckOut}>
        <Text style={styles.checkOutText}>{t('checkin.checkOut')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  } as ViewStyle,
  icon: {
    marginRight: spacing.sm,
  } as ViewStyle,
  textContainer: {
    flex: 1,
  } as ViewStyle,
  gymName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
  } as TextStyle,
  countdown: {
    fontSize: typography.sizes.xs,
    color: colors.gray[600],
    marginTop: 2,
  } as TextStyle,
  checkOutButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.danger,
    borderRadius: 6,
  } as ViewStyle,
  checkOutText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  } as TextStyle,
})
```

---

### `app/checkin/GymCheckinScreen.tsx`

> Default export screen. Requests foreground location permission on mount, fetches nearby gyms
> via `services/places.ts`, filters client-side as the user types, and calls
> `checkinStore.checkIn()` on confirmation. This is the only place `searchNearbyGyms()` is called
> in the client. If the user already has an active check-in, the screen shows a checkout prompt instead.

```typescript
import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Location from 'expo-location'
import { useTranslation } from 'react-i18next'
import { useCheckinStore } from '@/store/checkinStore'
import { useProfileStore } from '@/store/profileStore'
import { useAuthStore } from '@/store/authStore'
import { GymSearchList } from '@/components/checkin/GymSearchList'
import { ActiveCheckinBanner } from '@/components/checkin/ActiveCheckinBanner'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { searchNearbyGyms } from '@/services/places'
import type { GymPlace } from '@/types/checkin'
import { colors, spacing, typography } from '@/constants/theme'

const SEARCH_RADIUS_METERS = 2000

export default function GymCheckinScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { user } = useAuthStore()
  const { profile } = useProfileStore()
  const { activeCheckin, isLoading, checkIn, checkOut } = useCheckinStore()

  const [gyms, setGyms] = useState<GymPlace[]>([])
  const [filteredGyms, setFilteredGyms] = useState<GymPlace[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isFetching, setIsFetching] = useState<boolean>(false)
  const [locationError, setLocationError] = useState<boolean>(false)

  const fetchNearbyGyms = useCallback(async (): Promise<void> => {
    setIsFetching(true)
    setLocationError(false)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setLocationError(true)
        return
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const results = await searchNearbyGyms(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        SEARCH_RADIUS_METERS
      )
      setGyms(results)
      setFilteredGyms(results)
    } catch {
      setLocationError(true)
    } finally {
      setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    // If the user already has an active check-in, skip fetching gyms
    if (!activeCheckin) {
      void fetchNearbyGyms()
    }
  }, [activeCheckin, fetchNearbyGyms])

  // Client-side filter by gym name as user types
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredGyms(gyms)
    } else {
      const lower = searchQuery.toLowerCase()
      setFilteredGyms(gyms.filter((g) => g.name.toLowerCase().includes(lower)))
    }
  }, [searchQuery, gyms])

  const handleSelectGym = (gym: GymPlace): void => {
    Alert.alert(
      t('checkin.confirmTitle'),
      t('checkin.confirmMessage', { gymName: gym.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('checkin.checkIn'),
          onPress: async () => {
            try {
              // Pass city from the user's stored profile location
              const city = profile?.location?.city ?? ''
              await checkIn({ ...gym, coordinates: gym.coordinates }, )
              // Patch city into the call — checkinStore.checkIn accepts GymPlace,
              // but city must come from the user's profile, not the Places result.
              // The store's checkIn action accepts a GymPlace; city is injected separately
              // by calling the Cloud Function directly here for clarity:
              // (See architecture note #4 below — city injection pattern)
              navigation.goBack()
            } catch (error: unknown) {
              const code =
                error != null &&
                typeof error === 'object' &&
                'code' in error &&
                (error as { code: unknown }).code === 'already-exists'
              if (code) {
                Alert.alert(t('checkin.alreadyCheckedIn'), '')
              }
            }
          },
        },
      ]
    )
  }

  const handleCheckOut = (): void => {
    if (!user?.uid) return
    Alert.alert(
      t('checkin.checkOut'),
      t('checkin.confirmCheckOut'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('checkin.checkOut'),
          style: 'destructive',
          onPress: () => { void checkOut(user.uid) },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LoadingOverlay visible={isLoading} message={t('checkin.checkingIn')} />

      <Text style={styles.title}>{t('checkin.title')}</Text>

      {activeCheckin != null ? (
        <View style={styles.activeContainer}>
          <ActiveCheckinBanner checkin={activeCheckin} onCheckOut={handleCheckOut} />
          <Text style={styles.activeHint}>{t('checkin.alreadyCheckedInHint')}</Text>
        </View>
      ) : (
        <>
          {locationError && (
            <Text style={styles.errorText}>{t('checkin.locationError')}</Text>
          )}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('checkin.searchPlaceholder')}
              placeholderTextColor={colors.gray[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          <GymSearchList
            gyms={filteredGyms}
            onSelect={handleSelectGym}
            isLoading={isFetching}
          />
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  } as TextStyle,
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  } as ViewStyle,
  searchInput: {
    backgroundColor: colors.gray[100],
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    fontSize: typography.sizes.md,
    color: colors.gray[800],
  } as TextStyle,
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  } as TextStyle,
  activeContainer: {
    paddingTop: spacing.sm,
  } as ViewStyle,
  activeHint: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  } as TextStyle,
})
```

> **Architecture note on city injection:** The `checkinStore.checkIn()` interface accepts a
> `GymPlace`, but the `city` field needed by the Cloud Function comes from the user's profile,
> not from the Places API result. The cleanest approach is to extend the `checkIn` action
> signature to accept `(gym: GymPlace, city: string)`. Update `checkinStore.ts` accordingly:
>
> ```typescript
> checkIn: async (gym: GymPlace, city: string): Promise<void> => {
>   // ... existing logic
>   await createCheckin({
>     placeId: gym.placeId,
>     gymName: gym.name,
>     latitude: gym.coordinates.latitude,
>     longitude: gym.coordinates.longitude,
>     city,  // <-- passed from the screen
>   })
> }
> ```
>
> Update `CheckinActions` interface and all callers accordingly. This is the only signature
> change required — do not change the `GymPlace` type.

---

### `app/profile/ProfileScreen.tsx` — Update

> Add three things: (1) mount/unmount the `checkinStore` subscription, (2) render
> `ActiveCheckinBanner` above the existing check-in CTA row, (3) add the "📍 Check In to a Gym"
> tappable row below `TodayActivityCard`.
>
> Do not touch: existing photo grid, stats row, bio section, verified card, info cards,
> connected apps section, Edit Profile / Settings / Get Premium buttons, or their `StyleSheet` entries.

```typescript
// Add imports:
import { useCheckinStore } from '@/store/checkinStore'
import { ActiveCheckinBanner } from '@/components/checkin/ActiveCheckinBanner'

// In the component body, after existing store hooks:
const { activeCheckin, isLoading: isCheckoutLoading, unsubscribeFromActiveCheckin, subscribeToActiveCheckin, checkOut } = useCheckinStore()
const { user } = useAuthStore()

// In useEffect for subscription (add alongside existing useEffect calls):
useEffect(() => {
  if (user?.uid) {
    subscribeToActiveCheckin(user.uid)
  }
  return () => {
    unsubscribeFromActiveCheckin()
  }
}, [user?.uid])

// Handler for checkout from the banner:
const handleCheckOut = (): void => {
  if (!user?.uid) return
  Alert.alert(
    t('checkin.checkOut'),
    t('checkin.confirmCheckOut'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('checkin.checkOut'),
        style: 'destructive',
        onPress: () => { void checkOut(user.uid) },
      },
    ]
  )
}

// In JSX — insert below TodayActivityCard and above any action buttons:
{activeCheckin != null && (
  <ActiveCheckinBanner checkin={activeCheckin} onCheckOut={handleCheckOut} />
)}
<TouchableOpacity
  style={styles.checkinRow}
  onPress={() => navigation.navigate('GymCheckin')}
>
  <Text style={styles.checkinRowIcon}>📍</Text>
  <Text style={styles.checkinRowText}>{t('checkin.checkInCTA')}</Text>
  <Ionicons name="chevron-forward-outline" size={18} color={colors.gray[400]} />
</TouchableOpacity>

// Add to StyleSheet.create at the bottom:
checkinRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  backgroundColor: colors.surface,
  borderTopWidth: 1,
  borderTopColor: colors.gray[200],
} as ViewStyle,
checkinRowIcon: {
  fontSize: 18,
  marginRight: spacing.sm,
} as TextStyle,
checkinRowText: {
  flex: 1,
  fontSize: typography.sizes.md,
  color: colors.gray[800],
} as TextStyle,
```

---

### `components/discovery/SwipeCard.tsx` — Update

> Add a `"📍 At gym"` chip badge when `user.gymCheckin` is present and not yet expired.
> The video badge chip added in Task 77 must remain untouched. Insert the gym badge
> immediately after the video badge in the same badge row.

```typescript
// In the JSX where activity badges are rendered, after the existing video badge chip:
{user.gymCheckin != null &&
  user.gymCheckin.expiresAt.toMillis() > Date.now() && (
  <View style={styles.badgeChip}>
    <Text style={styles.badgeChipText}>{t('checkin.atGymBadge')}</Text>
  </View>
)}
```

> If `styles.badgeChip` and `styles.badgeChipText` are already defined from prior tasks,
> reuse them. If not, add to the existing `StyleSheet.create` at the bottom of the file:
>
> ```typescript
> badgeChip: {
>   backgroundColor: colors.primary,
>   borderRadius: 10,
>   paddingHorizontal: spacing.xs,
>   paddingVertical: 2,
>   marginRight: 4,
> } as ViewStyle,
> badgeChipText: {
>   fontSize: typography.sizes.xs,
>   color: colors.white,
>   fontWeight: typography.weights.medium,
> } as TextStyle,
> ```

---

### `app/navigation/MainTabNavigator.tsx` — Update

> Add `GymCheckin` to the `ProfileStackParamList` type and register it as a screen inside
> the existing Profile stack navigator. This is **not a new bottom tab** — it lives inside
> the Profile stack. The Events tab (Task 80) is not added here.

```typescript
// Update ProfileStackParamList — add:
GymCheckin: undefined

// In the Profile stack navigator — add after the existing Profile screen registration:
import GymCheckinScreen from '@/app/checkin/GymCheckinScreen'

<ProfileStack.Screen
  name="GymCheckin"
  component={GymCheckinScreen}
  options={{ title: t('checkin.title'), headerBackTitleVisible: false }}
/>
```

> Do not touch: tab bar icons, tab labels, `MainTabParamList`, `DiscoverStack`,
> `MatchesStack`, `SettingsStack`, or any existing screen registrations.

---

### `firestore.rules` — Update

> Append the `/gymCheckins/{id}` rule block **after** the existing rules. Do not modify
> or reorder any existing rule block. The pattern follows the existing owner-read/owner-delete
> conventions already in the file (e.g. the swipe subcollection pattern).

```
// Add to the existing rules file — append inside the outermost match block:

match /gymCheckins/{checkinId} {
  // No client create — createCheckin Cloud Function writes via Admin SDK (bypasses rules)
  allow create: if false;

  // Owner can read their own check-in
  allow read: if request.auth != null && request.auth.uid == resource.data.userId;

  // Owner can delete (check out)
  allow delete: if request.auth != null && request.auth.uid == resource.data.userId;

  // No client updates — expiresAt and other fields are server-managed
  allow update: if false;
}
```

---

### i18n files — Update all four

> Add all `checkin.*` keys to `i18n/en.json`. Copy the same English values as placeholders
> into `i18n/my.json`, `i18n/zh.json`, and `i18n/ta.json` (real translations come later).
> Do not remove any existing keys.

```json
// Add to each language file under a top-level "checkin" key:
"checkin": {
  "title": "Check In to a Gym",
  "checkIn": "Check In",
  "checkOut": "Check Out",
  "checkInCTA": "📍 Check In to a Gym",
  "searchPlaceholder": "Search nearby gyms...",
  "noGymsNearby": "No gyms found nearby. Try expanding your search area.",
  "confirmTitle": "Check In?",
  "confirmMessage": "Check in to {{gymName}}?",
  "confirmCheckOut": "Are you sure you want to check out?",
  "alreadyCheckedIn": "You're already checked in",
  "alreadyCheckedInHint": "You can check out first before checking in elsewhere.",
  "success": "Checked in to {{gymName}}!",
  "locationError": "Location permission is required to find nearby gyms.",
  "checkingIn": "Checking in...",
  "atGymBadge": "📍 At gym",
  "banner": {
    "remaining": "{{remaining}} remaining"
  }
}
```

---

## Important Architecture Notes for Codex

1. **No client writes to `/gymCheckins`.** The `createCheckin` Cloud Function is the sole write path for check-in creation. The security rule `allow create: if false` enforces this at the Firestore level. Do not call `addDoc` or `setDoc` on `/gymCheckins` from any client file.

2. **`GymPlace.coordinates` vs `GymCheckin.coordinates` are different types.** `GymPlace.coordinates` is `{ latitude: number; longitude: number }` (the Places API response shape, defined in `types/checkin.ts` as `GymPlaceCoordinates`). `GymCheckin.coordinates` is a Firestore `GeoPoint` (stored server-side). The conversion from plain numbers to `GeoPoint` happens exclusively inside `createCheckin.ts` via `new admin.firestore.GeoPoint(latitude, longitude)`. Never use `GeoPoint` on the client side for Places results.

3. **`checkinStore` is never persisted.** Do not add `persist` middleware to `useCheckinStore`. The Firestore `onSnapshot` listener re-hydrates state on every app open. Persisting stale `activeCheckin` data would cause incorrect countdown displays after the 2-hour expiry.

4. **City injection comes from `profileStore`, not from the Places API.** The `createCheckin` Cloud Function writes `city` to enable future city-scoped queries on `/gymCheckins`. The Places API does not return a structured `city` field. The caller (`GymCheckinScreen`) must read `profile.location.city` and pass it as the `city` argument to `checkinStore.checkIn()`. Update `checkinStore.checkIn(gym: GymPlace, city: string)` accordingly.

5. **`GymCheckin` is a screen inside the Profile stack — not a new bottom tab.** The Events tab (Task 80) adds a 5th tab later. Task 79 only adds `GymCheckin: undefined` to `ProfileStackParamList`. Do not touch `MainTabParamList` or the bottom tab configuration.

6. **`ActiveCheckinBanner` countdown uses `setInterval` in local state.** The interval fires every 60 seconds and reads `expiresAt.toMillis() - Date.now()` each tick. The `useEffect` cleanup must call `clearInterval` to prevent memory leaks. Never use Reanimated for this — the countdown is a simple text update, not an animation.

7. **`expo-location` requires `expo install`, not `npm install`.** Run `npx expo install expo-location` before any other change. On Android, `ACCESS_FINE_LOCATION` is added to `AndroidManifest.xml` automatically by the Expo config plugin. On iOS, `NSLocationWhenInUseUsageDescription` must be present in `app.json` `infoPlist` — add it if missing.

8. **`subscribeToActiveCheckin` must be called in `ProfileScreen.tsx` `useEffect`** with the user's `uid` and cleaned up on unmount. If `GymCheckinScreen` also mounts the subscription, the second call to `subscribeToActiveCheckin` in the store will cancel the first listener before setting up the new one (guarded by the `existing` check in the store). This is safe — only one listener is active at a time.

9. **All Cloud Function imports use 2nd gen API.** `onCall` and `HttpsError` are imported from `'firebase-functions/v2/https'`. Do not use the v1 `functions.https.onCall` pattern.

10. **`functions/src/createCheckin.ts` must be exported from `functions/src/index.ts`.** Without this, `firebase deploy --only functions` will not include the new function. Append `export { createCheckin } from './createCheckin'` to `index.ts`.

---

## Acceptance Criteria

- [ ] `npx expo install expo-location` has been run — `expo-location` appears in `package.json`
- [ ] `functions/src/createCheckin.ts` created — exports `createCheckin` as a named export
- [ ] `createCheckin` exported from `functions/src/index.ts`
- [ ] `functions/src/createCheckin.ts` uses `onCall` from `'firebase-functions/v2/https'` (2nd gen)
- [ ] `createCheckin` writes `/gymCheckins/{id}` and `users/{uid}.gymCheckin` in a single batch
- [ ] `createCheckin` uses `admin.firestore.GeoPoint(latitude, longitude)` for coordinates — never a plain object
- [ ] `createCheckin` returns `{ checkinId: string; expiresAt: Timestamp }` — no other shape
- [ ] `store/checkinStore.ts` created — exports `useCheckinStore` as a named export
- [ ] `checkinStore` is **not** wrapped in `persist` middleware
- [ ] `checkinStore.checkIn(gym, city)` calls `createCheckin` Cloud Function via `httpsCallable`
- [ ] `checkinStore.checkOut(uid)` calls `deleteDoc` on `/gymCheckins/{id}` and `updateDoc` with `FieldValue.delete()` on `users/{uid}.gymCheckin`
- [ ] `components/checkin/GymSearchList.tsx` created — named export `GymSearchList`
- [ ] `components/checkin/ActiveCheckinBanner.tsx` created — named export `ActiveCheckinBanner`
- [ ] `ActiveCheckinBanner` countdown updates every 60 seconds via `setInterval`; `clearInterval` called in `useEffect` cleanup
- [ ] `app/checkin/GymCheckinScreen.tsx` created — default export
- [ ] `GymCheckinScreen` requests foreground location permission before calling `searchNearbyGyms()`
- [ ] `GymCheckinScreen` gracefully handles permission denial with a translated error message
- [ ] `GymCheckinScreen` client-side name filter updates `filteredGyms` on each `searchQuery` change
- [ ] `GymCheckinScreen` shows `Alert.alert` confirmation before calling `checkIn()`
- [ ] `GymCheckinScreen` passes `profile.location.city` to `checkIn()` (not a hardcoded value)
- [ ] `ProfileScreen.tsx` calls `subscribeToActiveCheckin(uid)` on mount and `unsubscribeFromActiveCheckin()` on unmount
- [ ] `ProfileScreen.tsx` renders `<ActiveCheckinBanner>` only when `activeCheckin != null`
- [ ] `ProfileScreen.tsx` has a tappable "📍 Check In to a Gym" row that navigates to `'GymCheckin'`
- [ ] `SwipeCard.tsx` renders `"📍 At gym"` chip only when `user.gymCheckin != null && user.gymCheckin.expiresAt.toMillis() > Date.now()`
- [ ] Task 77 video badge chip in `SwipeCard.tsx` is untouched
- [ ] `MainTabNavigator.tsx` — `ProfileStackParamList` has `GymCheckin: undefined` added
- [ ] `MainTabNavigator.tsx` — `GymCheckinScreen` is registered as a `ProfileStack.Screen`
- [ ] `MainTabNavigator.tsx` — no new bottom tab added; bottom tab count remains 4
- [ ] `firestore.rules` — `/gymCheckins/{id}` block appended; `allow create: if false`; owner read + delete allowed
- [ ] All 7 `checkin.*` i18n keys added to all 4 language files (`en.json`, `my.json`, `zh.json`, `ta.json`)
- [ ] Zero `any` in all new and modified files
- [ ] Zero inline `style={{ }}` in all new and modified files — all styles in `StyleSheet.create`
- [ ] Zero `console.*` calls in all new and modified files
- [ ] All imports use `@/` alias — no relative paths
- [ ] `npm --prefix functions run build` — zero errors
- [ ] `npx tsc --noEmit` — zero errors

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/profileStore.ts`, `store/discoveryStore.ts`,
`store/matchStore.ts`, `store/chatStore.ts`, `services/firebase/config.ts`,
`services/firebase/auth.ts`, `services/firebase/firestore.ts`,
`services/firebase/realtime.ts`, `services/firebase/storage.ts`,
`services/places.ts`, `types/checkin.ts`, `types/user.ts`, `types/match.ts`,
`types/message.ts`, `types/subscription.ts`, `types/event.ts`,
`constants/`, `functions/src/recordSwipe.ts`, `functions/src/getDiscoveryStack.ts`,
`functions/src/onSwipeCreated.ts`, `functions/src/createStripeCheckout.ts`,
`functions/src/stripeWebhook.ts`, `functions/src/onNewMessage.ts`,
`functions/src/verifyProfilePhoto.ts`, `functions/src/activateBoost.ts`,
`functions/src/createStripePortalSession.ts`, `firestore.indexes.json`,
`components/chat/`, `components/profile/VideoProfilePicker.tsx`,
`components/discovery/FullProfileModal.tsx`, `app/profile/EditProfileScreen.tsx`,
`app/chat/`

---

## Commit

```
git commit -m "task-79: gym check-in feature"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3C — Task 79] — YYYY-MM-DD

### Completed

- Task 79: Gym Check-In Feature
- functions/src/createCheckin.ts: 2nd gen callable — writes /gymCheckins/{id} and users/{uid}.gymCheckin in a batch; enforces one active check-in per user; 2-hour expiry via Timestamp.fromMillis
- store/checkinStore.ts: Zustand store (not persisted) — subscribeToActiveCheckin, unsubscribeFromActiveCheckin, checkIn(gym, city), checkOut(uid)
- components/checkin/GymSearchList.tsx: FlatList with fitness-outline icon, name, address, optional rating
- components/checkin/ActiveCheckinBanner.tsx: compact banner with live 60s countdown and check-out button
- app/checkin/GymCheckinScreen.tsx: requests location, calls searchNearbyGyms(), client-side name filter, confirmation Alert, handles already-checked-in error
- app/profile/ProfileScreen.tsx: ActiveCheckinBanner and Check In CTA row added; subscription mounted/unmounted in useEffect
- components/discovery/SwipeCard.tsx: "📍 At gym" chip added when gymCheckin.expiresAt is in the future
- app/navigation/MainTabNavigator.tsx: GymCheckin added to ProfileStackParamList and Profile stack
- firestore.rules: /gymCheckins/{id} rules appended — create: false, owner read + delete, update: false
- checkin.* i18n keys added to all 4 language files

### Files Created / Modified

- functions/src/createCheckin.ts: created
- functions/src/index.ts: createCheckin export added
- store/checkinStore.ts: created
- components/checkin/GymSearchList.tsx: created
- components/checkin/ActiveCheckinBanner.tsx: created
- app/checkin/GymCheckinScreen.tsx: created
- app/profile/ProfileScreen.tsx: checkinStore subscription + ActiveCheckinBanner + CTA row
- components/discovery/SwipeCard.tsx: "📍 At gym" chip added
- app/navigation/MainTabNavigator.tsx: GymCheckin screen registered in Profile stack
- firestore.rules: /gymCheckins/{id} block appended
- i18n/en.json, my.json, zh.json, ta.json: checkin.* keys added

### Architecture Decisions

- city is sourced from profile.location.city in GymCheckinScreen, not from Places API, because the Places API does not return a structured city string; this enables future city-scoped Firestore queries on /gymCheckins
- GymPlace.coordinates remains GymPlaceCoordinates (plain lat/lon) and is never a GeoPoint client-side; conversion to GeoPoint happens inside the createCheckin Cloud Function only
- checkinStore is not persisted — the onSnapshot listener re-hydrates on every mount; persisting stale activeCheckin would show incorrect countdowns after the 2-hour window

### Known Issues / Deferred

- /gymCheckins Firestore indexes (userId + expiresAt, city + expiresAt) are deferred to Task 88 (Phase 3 index consolidation)
- Storage blob cleanup for expired check-ins is not implemented; documents expire logically via expiresAt but are not auto-deleted — a scheduled Cloud Function for cleanup is deferred to Phase 4

### Next Up

- Task 80: Workout Events — Create & Discover (Events tab, createEvent + rsvpEvent Cloud Functions, EventsScreen, CreateEventScreen, EventDetailScreen, EventCard)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 80 prompt.

---

## Reasoning Level

High — this task spans a new Cloud Function with batch writes and duplicate check logic, a Zustand store with a Firestore real-time subscription and manual unsubscribe lifecycle, three new components, a new screen with location permissions and client-side filtering, modifications to three existing files across different parts of the codebase (profile, discovery, navigation), a Firestore security rules update, and i18n additions across four files. The `GymPlace` vs `GymCheckin` coordinate type distinction is a subtle footgun that requires explicit handling.
