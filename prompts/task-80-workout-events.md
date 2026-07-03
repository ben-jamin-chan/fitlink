# CODEX PROMPT — Task 80: Workout Events: Create & Discover

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3C continues. Task 79 (Gym Check-In) is complete. The following files exist and must be
treated as read-only unless explicitly listed under "Files to modify":

- `types/event.ts` — `EventLocation`, `FitlinkEvent`, `EventRSVPStatus`,
  `EventWithAttendeeProfiles` fully defined; `Timestamp` and `GeoPoint` from Firebase JS SDK.
  These types are the source of truth for all event-related data shapes — do not redefine them.
- `types/checkin.ts` — `GymCheckin` and `GymPlace` defined; `GymPlace.coordinates` is a
  plain `{ latitude: number; longitude: number }` object (not a Firestore `GeoPoint`).
- `types/user.ts` — `UserProfile.gymCheckin?: { gymName: string; expiresAt: Timestamp }`
  is present from Task 70.
- `store/checkinStore.ts` — `GymCheckin | null` active check-in state; not persisted.
- `services/places.ts` — `searchNearbyGyms()` and `getPlacePhotoUrl()` exported;
  `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is already wired.
- `services/firebase/firestore.ts` — `getUserProfile(uid)` already exported; use it to
  fetch attendee profiles in `EventDetailScreen`.
- `functions/src/index.ts` — `createCheckin` is already exported; append new exports,
  do not overwrite the file.
- `firestore.rules` — `/gymCheckins/{id}` block is already appended (Task 79). Append the
  `/events/{id}` block — do not touch the `/gymCheckins` block or any earlier rules.
- `firestore.indexes.json` — all Phase 1 and Phase 2 indexes are present. The
  `/gymCheckins` compound indexes are intentionally deferred to Task 88 — do not add
  them here. Only add the two new `/events` indexes specified in this task.
- `app/navigation/MainTabNavigator.tsx` — `ProfileStackParamList` already includes
  `GymCheckin`. The bottom tab navigator currently has 4 tabs. This task adds `Events` as
  the 5th tab between Matches and Profile.
- `components/ui/` — `Button`, `Input`, `Toast`, `LoadingOverlay`, `SingleSelect`,
  `MultiSelect` are available as named exports; reuse them — do not create duplicates.
- `constants/theme.ts` — re-exports `colors`, `spacing`, `typography`; import only from here.

**`EventDetailScreen` must never write directly to the `attendees` array client-side.
All attendee mutations go through the `rsvpEvent` Cloud Function. Direct client writes to
`events/{id}` are blocked by Firestore rules (except `cancelled`, `title`, `description`,
and `maxAttendees` by the event creator).**

**`createEvent` is a Cloud Function–only operation. There is no client-side `addDoc` to
`/events` anywhere. Firestore rules deny all client creates on `/events`.**

**The `EventsStackNavigator` is a new nested stack inside `MainTabNavigator`. Do not add
Events screens to the existing `ProfileStack` or `RootStack`.**

---

## Task 80 — Workout Events: Create & Discover

**Files to create:**
- `functions/src/createEvent.ts`
- `functions/src/rsvpEvent.ts`
- `store/eventsStore.ts`
- `components/events/EventCard.tsx`
- `app/events/EventsScreen.tsx`
- `app/events/CreateEventScreen.tsx`
- `app/events/EventDetailScreen.tsx`

**Files to modify:**
- `functions/src/index.ts` — append `createEvent` and `rsvpEvent` exports
- `app/navigation/MainTabNavigator.tsx` — add Events 5th tab and `EventsStackNavigator`
- `firestore.rules` — append `/events/{id}` security block
- `firestore.indexes.json` — append two new `/events` composite indexes
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — append `events.*` keys

---

### `functions/src/createEvent.ts`

2nd-gen callable Cloud Function (`asia-southeast1`). Accepts all `FitlinkEvent` input fields
except the server-owned fields (`creatorId`, `attendees`, `createdAt`, `cancelled`).
Validates the input, writes the event document, and returns the new `eventId`.

All Cloud Function rules apply: `firebase-functions/v2/https`, `onCall`, `CallableRequest`,
`admin.firestore.FieldValue.serverTimestamp()` for `createdAt`, never `new Date()`.

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

interface CreateEventData {
  title: string
  description: string
  activityType: string
  locationName: string
  locationAddress: string
  locationPlaceId: string
  locationLatitude: number
  locationLongitude: number
  startAt: number        // Unix milliseconds from client
  endAt: number          // Unix milliseconds from client
  maxAttendees: number | null
  city: string
  country: string
}

interface CreateEventResult {
  eventId: string
}

export const createEvent = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest<CreateEventData>): Promise<CreateEventResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in')
    }

    const uid = request.auth.uid
    const data = request.data

    // Validate required fields
    if (!data.title || data.title.trim().length < 5) {
      throw new HttpsError('invalid-argument', 'title-too-short')
    }
    if (!data.description || data.description.trim().length === 0) {
      throw new HttpsError('invalid-argument', 'description-required')
    }
    if (!data.activityType || data.activityType.trim().length === 0) {
      throw new HttpsError('invalid-argument', 'activity-type-required')
    }
    if (!data.city || !data.country) {
      throw new HttpsError('invalid-argument', 'location-required')
    }

    const now = Date.now()
    if (data.startAt <= now) {
      throw new HttpsError('invalid-argument', 'start-must-be-future')
    }
    if (data.endAt <= data.startAt) {
      throw new HttpsError('invalid-argument', 'end-must-be-after-start')
    }

    const db = admin.firestore()
    const eventRef = db.collection('events').doc()

    await eventRef.set({
      creatorId: uid,
      title: data.title.trim(),
      description: data.description.trim(),
      activityType: data.activityType,
      location: {
        name: data.locationName,
        address: data.locationAddress,
        coordinates: new admin.firestore.GeoPoint(
          data.locationLatitude,
          data.locationLongitude,
        ),
        placeId: data.locationPlaceId,
      },
      startAt: admin.firestore.Timestamp.fromMillis(data.startAt),
      endAt: admin.firestore.Timestamp.fromMillis(data.endAt),
      maxAttendees: data.maxAttendees,
      attendees: [uid],
      city: data.city,
      country: data.country,
      cancelled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return { eventId: eventRef.id }
  },
)
```

---

### `functions/src/rsvpEvent.ts`

2nd-gen callable Cloud Function (`asia-southeast1`). Accepts `{ eventId, action }` and
atomically mutates the `attendees` array using `FieldValue.arrayUnion` / `arrayRemove`.
Returns the updated `attendees` array so the client can optimistically confirm the mutation.

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

interface RsvpEventData {
  eventId: string
  action: 'join' | 'leave'
}

interface RsvpEventResult {
  attendees: string[]
}

export const rsvpEvent = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest<RsvpEventData>): Promise<RsvpEventResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in')
    }

    const uid = request.auth.uid
    const { eventId, action } = request.data

    if (!eventId || typeof eventId !== 'string') {
      throw new HttpsError('invalid-argument', 'event-id-required')
    }
    if (action !== 'join' && action !== 'leave') {
      throw new HttpsError('invalid-argument', 'invalid-action')
    }

    const db = admin.firestore()
    const eventRef = db.collection('events').doc(eventId)
    const eventSnap = await eventRef.get()

    if (!eventSnap.exists) {
      throw new HttpsError('not-found', 'event-not-found')
    }

    const eventData = eventSnap.data()

    if (!eventData) {
      throw new HttpsError('not-found', 'event-not-found')
    }

    if (eventData['cancelled'] === true) {
      throw new HttpsError('failed-precondition', 'event-cancelled')
    }

    if (action === 'join') {
      const currentAttendees: string[] = eventData['attendees'] ?? []
      const maxAttendees: number | null = eventData['maxAttendees'] ?? null
      if (maxAttendees !== null && currentAttendees.length >= maxAttendees) {
        throw new HttpsError('failed-precondition', 'event-full')
      }
      await eventRef.update({
        attendees: admin.firestore.FieldValue.arrayUnion(uid),
      })
    } else {
      await eventRef.update({
        attendees: admin.firestore.FieldValue.arrayRemove(uid),
      })
    }

    const updatedSnap = await eventRef.get()
    const updatedData = updatedSnap.data()
    const updatedAttendees: string[] = updatedData?.['attendees'] ?? []

    return { attendees: updatedAttendees }
  },
)
```

---

### `store/eventsStore.ts`

Zustand store — **not persisted**. Manages the upcoming events list (discover tab) and the
current user's joined/created events (my events tab). All Firestore queries run from this
store; no Firestore reads happen inside screen components directly.

```typescript
import { create } from 'zustand'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/services/firebase/config'
import type { FitlinkEvent } from '@/types/event'

// ─── Helper: map a Firestore document snapshot to FitlinkEvent ──────────────

function docToEvent(id: string, data: Record<string, unknown>): FitlinkEvent {
  return {
    id,
    creatorId: data['creatorId'] as string,
    title: data['title'] as string,
    description: data['description'] as string,
    activityType: data['activityType'] as string,
    location: data['location'] as FitlinkEvent['location'],
    startAt: data['startAt'] as Timestamp,
    endAt: data['endAt'] as Timestamp,
    maxAttendees: (data['maxAttendees'] as number | null) ?? null,
    attendees: (data['attendees'] as string[]) ?? [],
    city: data['city'] as string,
    country: data['country'] as string,
    createdAt: data['createdAt'] as Timestamp,
    cancelled: (data['cancelled'] as boolean) ?? false,
  }
}

// ─── Callable references ─────────────────────────────────────────────────────

interface CreateEventData {
  title: string
  description: string
  activityType: string
  locationName: string
  locationAddress: string
  locationPlaceId: string
  locationLatitude: number
  locationLongitude: number
  startAt: number
  endAt: number
  maxAttendees: number | null
  city: string
  country: string
}

interface CreateEventResult {
  eventId: string
}

interface RsvpEventData {
  eventId: string
  action: 'join' | 'leave'
}

interface RsvpEventResult {
  attendees: string[]
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface EventsState {
  upcomingEvents: FitlinkEvent[]
  myEvents: FitlinkEvent[]
  isLoading: boolean

  fetchUpcomingEvents: (city: string) => Promise<void>
  fetchMyEvents: (uid: string) => Promise<void>
  createEvent: (data: CreateEventData) => Promise<string>
  rsvp: (eventId: string, action: 'join' | 'leave') => Promise<void>
}

export const useEventsStore = create<EventsState>()((set, get) => ({
  upcomingEvents: [],
  myEvents: [],
  isLoading: false,

  fetchUpcomingEvents: async (city: string): Promise<void> => {
    set({ isLoading: true })
    try {
      const q = query(
        collection(db, 'events'),
        where('city', '==', city),
        where('cancelled', '==', false),
        where('startAt', '>', Timestamp.now()),
        orderBy('startAt', 'asc'),
        limit(20),
      )
      const snap = await getDocs(q)
      const events = snap.docs.map((d) => docToEvent(d.id, d.data()))
      set({ upcomingEvents: events })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchMyEvents: async (uid: string): Promise<void> => {
    set({ isLoading: true })
    try {
      const q = query(
        collection(db, 'events'),
        where('attendees', 'array-contains', uid),
        orderBy('startAt', 'asc'),
      )
      const snap = await getDocs(q)
      const events = snap.docs.map((d) => docToEvent(d.id, d.data()))
      set({ myEvents: events })
    } finally {
      set({ isLoading: false })
    }
  },

  createEvent: async (data: CreateEventData): Promise<string> => {
    const callable = httpsCallable<CreateEventData, CreateEventResult>(
      functions,
      'createEvent',
    )
    const result = await callable(data)
    return result.data.eventId
  },

  rsvp: async (eventId: string, action: 'join' | 'leave'): Promise<void> => {
    const callable = httpsCallable<RsvpEventData, RsvpEventResult>(
      functions,
      'rsvpEvent',
    )
    const result = await callable({ eventId, action })
    const updatedAttendees = result.data.attendees

    // Optimistically update both local lists
    const patch = (list: FitlinkEvent[]): FitlinkEvent[] =>
      list.map((e) =>
        e.id === eventId ? { ...e, attendees: updatedAttendees } : e,
      )

    set((state) => ({
      upcomingEvents: patch(state.upcomingEvents),
      myEvents: patch(state.myEvents),
    }))
  },
}))
```

> **Note on `FitlinkEvent.id`:** The `FitlinkEvent` interface in `types/event.ts` uses Firestore
> document IDs as the client-facing identifier. If `id` is not yet on the interface, add it as
> `id: string` — the Firestore document ID. Do not add an `id` field to the Firestore document
> itself; it comes from `doc.id` at read time.

---

### `components/events/EventCard.tsx`

Reusable card component rendered in the `EventsScreen` FlatList. Tapping navigates to
`EventDetail`. Used by both the Discover and My Events tabs.

```typescript
import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { colors, spacing, typography } from '@/constants/theme'
import type { FitlinkEvent } from '@/types/event'

// ─── Activity → Ionicons icon mapping ────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  gym: 'barbell-outline',
  running: 'walk-outline',
  cycling: 'bicycle-outline',
  swimming: 'water-outline',
  yoga: 'body-outline',
  hiking: 'trail-sign-outline',
  basketball: 'basketball-outline',
  football: 'football-outline',
  tennis: 'tennisball-outline',
  badminton: 'disc-outline',
  climbing: 'flag-outline',
  crossfit: 'barbell-outline',
  muaythai: 'hand-right-outline',
  boxing: 'hand-right-outline',
  pilates: 'body-outline',
  dancing: 'musical-notes-outline',
}

function getActivityIcon(activityType: string): keyof typeof Ionicons.glyphMap {
  const key = activityType.toLowerCase().replace(/\s+/g, '')
  return ACTIVITY_ICONS[key] ?? 'fitness-outline'
}

// ─── Date formatting helper ───────────────────────────────────────────────────

function formatEventDate(timestamp: { toMillis: () => number }): string {
  const date = new Date(timestamp.toMillis())
  const day = date.getDate().toString().padStart(2, '0')
  const month = date.toLocaleString('en-GB', { month: 'short' })
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${day} ${month}, ${hours}:${minutes}`
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EventCardProps {
  event: FitlinkEvent
  currentUserId: string
  onPress: (eventId: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EventCard = ({
  event,
  currentUserId,
  onPress,
}: EventCardProps): React.JSX.Element => {
  const { t } = useTranslation()
  const isAttending = event.attendees.includes(currentUserId)
  const isFull =
    event.maxAttendees !== null &&
    event.attendees.length >= event.maxAttendees
  const icon = getActivityIcon(event.activityType)

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(event.id)}
      activeOpacity={0.85}
    >
      {/* Header row: icon + activity type */}
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={colors.white} />
        </View>
        <Text style={styles.activityLabel} numberOfLines={1}>
          {event.activityType}
        </Text>
        {/* RSVP status pill */}
        {isAttending ? (
          <View style={styles.pillAttending}>
            <Text style={styles.pillText}>{t('events.card.attending')}</Text>
          </View>
        ) : (
          <View style={[styles.pillAttending, isFull ? styles.pillFull : styles.pillJoin]}>
            <Text style={styles.pillText}>
              {isFull ? t('events.card.full') : t('events.card.join')}
            </Text>
          </View>
        )}
      </View>

      {/* Event title */}
      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>

      {/* Meta row: date + location + attendees */}
      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={13} color={colors.gray[500]} />
        <Text style={styles.metaText}>{formatEventDate(event.startAt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={13} color={colors.gray[500]} />
        <Text style={styles.metaText} numberOfLines={1}>
          {event.location.name}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="people-outline" size={13} color={colors.gray[500]} />
        <Text style={styles.metaText}>
          {event.maxAttendees !== null
            ? t('events.card.attendeesOf', {
                count: event.attendees.length,
                max: event.maxAttendees,
              })
            : t('events.card.attendeesUnlimited', {
                count: event.attendees.length,
              })}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  } as ViewStyle,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  } as ViewStyle,
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  } as ViewStyle,
  activityLabel: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    fontWeight: typography.weights.medium,
  } as TextStyle,
  pillAttending: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
  } as ViewStyle,
  pillJoin: {
    backgroundColor: colors.primary,
  } as ViewStyle,
  pillFull: {
    backgroundColor: colors.gray[300],
  } as ViewStyle,
  pillText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    fontWeight: typography.weights.semiBold,
  } as TextStyle,
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: spacing.xs,
  } as TextStyle,
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  } as ViewStyle,
  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.gray[500],
    flex: 1,
  } as TextStyle,
})
```

---

### `app/events/EventsScreen.tsx`

Default export screen — the root of the Events stack. Two horizontal tabs: "Discover" and
"My Events". Fetches from `eventsStore` using the current user's city and uid. Includes a
floating action button (FAB) to navigate to `CreateEvent`.

```typescript
import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useEventsStore } from '@/store/eventsStore'
import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
import { EventCard } from '@/components/events/EventCard'
import { colors, spacing, typography } from '@/constants/theme'
import type { FitlinkEvent } from '@/types/event'
import type { MainTabParamList, EventsStackParamList } from '@/app/navigation/MainTabNavigator'

type EventsScreenNavProp = CompositeNavigationProp<
  StackNavigationProp<EventsStackParamList, 'Events'>,
  BottomTabNavigationProp<MainTabParamList>
>

interface EventsScreenProps {
  navigation: EventsScreenNavProp
}

type TabKey = 'discover' | 'my'

export default function EventsScreen({ navigation }: EventsScreenProps): React.JSX.Element {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabKey>('discover')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const uid = useAuthStore((s) => s.uid)
  const profile = useProfileStore((s) => s.profile)
  const { upcomingEvents, myEvents, isLoading, fetchUpcomingEvents, fetchMyEvents } =
    useEventsStore()

  const city = profile?.location?.city ?? ''

  const loadDiscover = useCallback(async (): Promise<void> => {
    if (city) await fetchUpcomingEvents(city)
  }, [city, fetchUpcomingEvents])

  const loadMyEvents = useCallback(async (): Promise<void> => {
    if (uid) await fetchMyEvents(uid)
  }, [uid, fetchMyEvents])

  useEffect(() => {
    void loadDiscover()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeTab === 'discover') void loadDiscover()
    else void loadMyEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true)
    if (activeTab === 'discover') await loadDiscover()
    else await loadMyEvents()
    setIsRefreshing(false)
  }, [activeTab, loadDiscover, loadMyEvents])

  const handleCardPress = useCallback(
    (eventId: string): void => {
      navigation.navigate('EventDetail', { eventId })
    },
    [navigation],
  )

  const renderEvent = useCallback(
    ({ item }: { item: FitlinkEvent }) => (
      <EventCard
        event={item}
        currentUserId={uid ?? ''}
        onPress={handleCardPress}
      />
    ),
    [uid, handleCardPress],
  )

  const listData = activeTab === 'discover' ? upcomingEvents : myEvents

  const emptyText =
    activeTab === 'discover'
      ? t('events.discover.empty')
      : t('events.myEvents.empty')

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>{t('events.title')}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['discover', 'my'] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}
            >
              {tab === 'discover' ? t('events.tabs.discover') : t('events.tabs.myEvents')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={
          listData.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="calendar-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyText}>{emptyText}</Text>
              {activeTab === 'discover' && (
                <TouchableOpacity
                  style={styles.emptyAction}
                  onPress={() => navigation.navigate('CreateEvent')}
                >
                  <Text style={styles.emptyActionText}>
                    {t('events.discover.createCta')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateEvent')}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={56} color={colors.primary} />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  } as ViewStyle,
  screenTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
  } as TextStyle,
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  } as ViewStyle,
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.gray[100],
  } as ViewStyle,
  tabActive: {
    backgroundColor: colors.primary,
  } as ViewStyle,
  tabLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray[600],
  } as TextStyle,
  tabLabelActive: {
    color: colors.white,
    fontWeight: typography.weights.semiBold,
  } as TextStyle,
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  } as ViewStyle,
  emptyContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  } as ViewStyle,
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.md,
  } as ViewStyle,
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.gray[400],
    textAlign: 'center',
  } as TextStyle,
  emptyAction: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 12,
  } as ViewStyle,
  emptyActionText: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    fontWeight: typography.weights.semiBold,
  } as TextStyle,
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
  } as ViewStyle,
})
```

---

### `app/events/CreateEventScreen.tsx`

Default export screen for creating a new workout event. Uses React Hook Form + Zod for
validation. All form state is managed by React Hook Form — no `useState` for form fields.
Submits via `eventsStore.createEvent()` then navigates back.

```typescript
import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Alert,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useTranslation } from 'react-i18next'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useEventsStore } from '@/store/eventsStore'
import { useProfileStore } from '@/store/profileStore'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { Button } from '@/components/ui/Button'
import { colors, spacing, typography } from '@/constants/theme'
import type { EventsStackParamList } from '@/app/navigation/MainTabNavigator'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_TYPES = [
  'Gym', 'Running', 'Cycling', 'Swimming', 'Yoga', 'Hiking',
  'Basketball', 'Football', 'Tennis', 'Badminton', 'Climbing',
  'CrossFit', 'Muay Thai', 'Boxing', 'Pilates', 'Dancing',
] as const

// ─── Zod schema ───────────────────────────────────────────────────────────────

const createEventSchema = z
  .object({
    title: z.string().min(5, 'events.create.errors.titleMin'),
    description: z.string().min(1, 'events.create.errors.descriptionRequired'),
    activityType: z.string().min(1, 'events.create.errors.activityRequired'),
    locationName: z.string().min(1, 'events.create.errors.locationRequired'),
    locationAddress: z.string().min(1, 'events.create.errors.locationRequired'),
    locationPlaceId: z.string().default(''),
    locationLatitude: z.number().default(0),
    locationLongitude: z.number().default(0),
    startAt: z.date().refine((d) => d > new Date(), 'events.create.errors.startFuture'),
    endAt: z.date(),
    maxAttendeesRaw: z.string().optional(),
    city: z.string().min(1),
    country: z.string().min(1),
  })
  .refine((data) => data.endAt > data.startAt, {
    message: 'events.create.errors.endAfterStart',
    path: ['endAt'],
  })

type CreateEventFormData = z.infer<typeof createEventSchema>

// ─── Navigation prop ──────────────────────────────────────────────────────────

interface CreateEventScreenProps {
  navigation: StackNavigationProp<EventsStackParamList, 'CreateEvent'>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateEventScreen({
  navigation,
}: CreateEventScreenProps): React.JSX.Element {
  const { t } = useTranslation()
  const profile = useProfileStore((s) => s.profile)
  const createEvent = useEventsStore((s) => s.createEvent)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)

  const defaultStart = new Date(Date.now() + 24 * 60 * 60 * 1000) // tomorrow
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000) // +1 hour

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: '',
      description: '',
      activityType: '',
      locationName: '',
      locationAddress: '',
      locationPlaceId: '',
      locationLatitude: 0,
      locationLongitude: 0,
      startAt: defaultStart,
      endAt: defaultEnd,
      maxAttendeesRaw: '',
      city: profile?.location?.city ?? '',
      country: profile?.location?.country ?? 'Malaysia',
    },
  })

  const selectedActivity = watch('activityType')
  const startAt = watch('startAt')
  const endAt = watch('endAt')

  const onSubmit = async (data: CreateEventFormData): Promise<void> => {
    setIsSubmitting(true)
    try {
      const maxAttendees =
        data.maxAttendeesRaw && data.maxAttendeesRaw.trim() !== ''
          ? parseInt(data.maxAttendeesRaw, 10)
          : null

      await createEvent({
        title: data.title,
        description: data.description,
        activityType: data.activityType,
        locationName: data.locationName,
        locationAddress: data.locationAddress,
        locationPlaceId: data.locationPlaceId,
        locationLatitude: data.locationLatitude,
        locationLongitude: data.locationLongitude,
        startAt: data.startAt.getTime(),
        endAt: data.endAt.getTime(),
        maxAttendees,
        city: data.city,
        country: data.country,
      })
      navigation.goBack()
    } catch {
      Alert.alert(t('events.create.errorTitle'), t('events.create.errorMessage'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {isSubmitting && <LoadingOverlay />}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>{t('events.create.title')}</Text>

        {/* Title */}
        <Text style={styles.label}>{t('events.create.titleLabel')}</Text>
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              placeholder={t('events.create.titlePlaceholder')}
              placeholderTextColor={colors.gray[400]}
              maxLength={80}
            />
          )}
        />
        {errors.title && (
          <Text style={styles.errorText}>{t(errors.title.message ?? '')}</Text>
        )}

        {/* Description */}
        <Text style={styles.label}>{t('events.create.descriptionLabel')}</Text>
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={value}
              onChangeText={onChange}
              placeholder={t('events.create.descriptionPlaceholder')}
              placeholderTextColor={colors.gray[400]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          )}
        />
        {errors.description && (
          <Text style={styles.errorText}>{t(errors.description.message ?? '')}</Text>
        )}

        {/* Activity Type chips */}
        <Text style={styles.label}>{t('events.create.activityLabel')}</Text>
        <View style={styles.chipGrid}>
          {ACTIVITY_TYPES.map((activity) => (
            <TouchableOpacity
              key={activity}
              style={[
                styles.chip,
                selectedActivity === activity && styles.chipSelected,
              ]}
              onPress={() => setValue('activityType', activity)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedActivity === activity && styles.chipTextSelected,
                ]}
              >
                {activity}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.activityType && (
          <Text style={styles.errorText}>{t(errors.activityType.message ?? '')}</Text>
        )}

        {/* Location name (free text; Google Places autocomplete is a Phase 4 enhancement) */}
        <Text style={styles.label}>{t('events.create.locationLabel')}</Text>
        <Controller
          control={control}
          name="locationName"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={(text) => {
                onChange(text)
                // Mirror into locationAddress for display; placeId left as ''
                setValue('locationAddress', text)
              }}
              placeholder={t('events.create.locationPlaceholder')}
              placeholderTextColor={colors.gray[400]}
            />
          )}
        />
        {errors.locationName && (
          <Text style={styles.errorText}>{t(errors.locationName.message ?? '')}</Text>
        )}

        {/* Start date/time */}
        <Text style={styles.label}>{t('events.create.startLabel')}</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowStartPicker(true)}
        >
          <Text style={styles.dateButtonText}>
            {startAt.toLocaleString('en-GB')}
          </Text>
        </TouchableOpacity>
        {showStartPicker && (
          <DateTimePicker
            value={startAt}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={(_, date) => {
              setShowStartPicker(false)
              if (date) setValue('startAt', date)
            }}
          />
        )}
        {errors.startAt && (
          <Text style={styles.errorText}>{t(errors.startAt.message ?? '')}</Text>
        )}

        {/* End date/time */}
        <Text style={styles.label}>{t('events.create.endLabel')}</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowEndPicker(true)}
        >
          <Text style={styles.dateButtonText}>
            {endAt.toLocaleString('en-GB')}
          </Text>
        </TouchableOpacity>
        {showEndPicker && (
          <DateTimePicker
            value={endAt}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={startAt}
            onChange={(_, date) => {
              setShowEndPicker(false)
              if (date) setValue('endAt', date)
            }}
          />
        )}
        {errors.endAt && (
          <Text style={styles.errorText}>{t(errors.endAt.message ?? '')}</Text>
        )}

        {/* Max attendees (optional) */}
        <Text style={styles.label}>{t('events.create.maxAttendeesLabel')}</Text>
        <Controller
          control={control}
          name="maxAttendeesRaw"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              placeholder={t('events.create.maxAttendeesPlaceholder')}
              placeholderTextColor={colors.gray[400]}
              keyboardType="number-pad"
            />
          )}
        />

        <Button
          label={t('events.create.submit')}
          onPress={handleSubmit(onSubmit)}
          variant="primary"
          loading={isSubmitting}
          style={styles.submitButton}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  scroll: {
    flex: 1,
  } as ViewStyle,
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  } as ViewStyle,
  screenTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  } as TextStyle,
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semiBold,
    color: colors.gray[700],
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  } as TextStyle,
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.gray[900],
    backgroundColor: colors.white,
  } as TextStyle,
  textArea: {
    height: 100,
  } as ViewStyle,
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  } as ViewStyle,
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    backgroundColor: colors.white,
  } as ViewStyle,
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  } as ViewStyle,
  chipText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[700],
  } as TextStyle,
  chipTextSelected: {
    color: colors.white,
    fontWeight: typography.weights.semiBold,
  } as TextStyle,
  dateButton: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  } as ViewStyle,
  dateButtonText: {
    fontSize: typography.sizes.md,
    color: colors.gray[800],
  } as TextStyle,
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    marginTop: 4,
  } as TextStyle,
  submitButton: {
    marginTop: spacing.xl,
  } as ViewStyle,
})
```

> **Note on Google Places autocomplete:** The `locationName` field uses free-text input. Full
> Google Places autocomplete UI is a Phase 4 enhancement — the `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
> is available if Codex wants to add a basic autocomplete, but it is **not required** for this
> task to pass acceptance criteria. The Cloud Function accepts any `locationName` string.

---

### `app/events/EventDetailScreen.tsx`

Default export screen showing full event details. Fetches attendee profiles for the avatar row
(first 5). Allows RSVP (join/leave) for all authenticated users. Creator-only "Cancel Event"
button. Share via `Share.share`.

```typescript
import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  Image,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { doc, updateDoc } from 'firebase/firestore'
import { useTranslation } from 'react-i18next'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'
import { db } from '@/services/firebase/config'
import { getUserProfile } from '@/services/firebase/firestore'
import { useEventsStore } from '@/store/eventsStore'
import { useAuthStore } from '@/store/authStore'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { Button } from '@/components/ui/Button'
import { colors, spacing, typography } from '@/constants/theme'
import type { UserProfile } from '@/types/user'
import type { FitlinkEvent } from '@/types/event'
import type { EventsStackParamList } from '@/app/navigation/MainTabNavigator'

interface EventDetailScreenProps {
  navigation: StackNavigationProp<EventsStackParamList, 'EventDetail'>
  route: RouteProp<EventsStackParamList, 'EventDetail'>
}

// ─── Date formatting helper ───────────────────────────────────────────────────

function formatEventDateFull(timestamp: { toMillis: () => number }): string {
  const date = new Date(timestamp.toMillis())
  return date.toLocaleString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventDetailScreen({
  navigation,
  route,
}: EventDetailScreenProps): React.JSX.Element {
  const { t } = useTranslation()
  const { eventId } = route.params
  const uid = useAuthStore((s) => s.uid)
  const { upcomingEvents, myEvents, rsvp, fetchUpcomingEvents, fetchMyEvents } =
    useEventsStore()

  const [event, setEvent] = useState<FitlinkEvent | null>(null)
  const [attendeeProfiles, setAttendeeProfiles] = useState<UserProfile[]>([])
  const [isRsvpLoading, setIsRsvpLoading] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // Resolve event from store — avoids an extra Firestore read if already fetched
  useEffect(() => {
    const found =
      upcomingEvents.find((e) => e.id === eventId) ??
      myEvents.find((e) => e.id === eventId) ??
      null
    setEvent(found)
  }, [eventId, upcomingEvents, myEvents])

  // Fetch first 5 attendee profiles
  useEffect(() => {
    if (!event) return
    const topFive = event.attendees.slice(0, 5)
    let cancelled = false

    const fetchProfiles = async (): Promise<void> => {
      const profiles = await Promise.all(
        topFive.map((id) => getUserProfile(id).catch(() => null)),
      )
      if (!cancelled) {
        setAttendeeProfiles(
          profiles.filter((p): p is UserProfile => p !== null),
        )
      }
    }

    void fetchProfiles()
    return () => {
      cancelled = true
    }
  }, [event])

  const isAttending = uid ? event?.attendees.includes(uid) ?? false : false
  const isCreator = uid === event?.creatorId
  const isFull =
    event?.maxAttendees !== null &&
    event !== null &&
    event.attendees.length >= (event.maxAttendees ?? Infinity)

  const handleRsvp = useCallback(async (): Promise<void> => {
    if (!uid || !event) return
    setIsRsvpLoading(true)
    try {
      await rsvp(event.id, isAttending ? 'leave' : 'join')
      // Refresh store lists to sync attendee count
      const city = event.city
      await Promise.all([fetchUpcomingEvents(city), fetchMyEvents(uid)])
    } catch {
      Alert.alert(t('events.detail.rsvpErrorTitle'), t('events.detail.rsvpErrorMessage'))
    } finally {
      setIsRsvpLoading(false)
    }
  }, [uid, event, isAttending, rsvp, fetchUpcomingEvents, fetchMyEvents, t])

  const handleCancel = useCallback((): void => {
    if (!event) return
    Alert.alert(
      t('events.detail.cancelConfirmTitle'),
      t('events.detail.cancelConfirmMessage'),
      [
        { text: t('common.back'), style: 'cancel' },
        {
          text: t('events.detail.cancelConfirm'),
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true)
            try {
              await updateDoc(doc(db, 'events', event.id), { cancelled: true })
              navigation.goBack()
            } catch {
              Alert.alert(
                t('events.detail.cancelErrorTitle'),
                t('events.detail.cancelErrorMessage'),
              )
            } finally {
              setIsCancelling(false)
            }
          },
        },
      ],
    )
  }, [event, navigation, t])

  const handleShare = useCallback(async (): Promise<void> => {
    if (!event) return
    await Share.share({
      message: t('events.shareMessage', {
        title: event.title,
        link: `fitlink://events/${event.id}`,
      }),
    })
  }, [event, t])

  if (!event) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LoadingOverlay />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {(isRsvpLoading || isCancelling) && <LoadingOverlay />}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Back + Share header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.gray[800]} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Ionicons name="share-outline" size={24} color={colors.gray[800]} />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={styles.title}>{event.title}</Text>

        {/* Activity type */}
        <Text style={styles.activityBadge}>{event.activityType}</Text>

        {/* Event info rows */}
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.infoText}>{formatEventDateFull(event.startAt)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.infoText}>
            {t('events.detail.endsAt', { time: formatEventDateFull(event.endAt) })}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <Text style={styles.infoText}>{event.location.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="people-outline" size={18} color={colors.primary} />
          <Text style={styles.infoText}>
            {event.maxAttendees !== null
              ? t('events.detail.attendeesOf', {
                  count: event.attendees.length,
                  max: event.maxAttendees,
                })
              : t('events.detail.attendeesUnlimited', {
                  count: event.attendees.length,
                })}
          </Text>
        </View>

        {/* Attendee avatar row */}
        {attendeeProfiles.length > 0 && (
          <View style={styles.avatarRow}>
            {attendeeProfiles.map((p) => (
              <Image
                key={p.uid}
                source={{ uri: p.photos[0] ?? '' }}
                style={styles.avatar}
              />
            ))}
            {event.attendees.length > 5 && (
              <View style={styles.avatarMore}>
                <Text style={styles.avatarMoreText}>
                  +{event.attendees.length - 5}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Description */}
        <Text style={styles.sectionLabel}>{t('events.detail.about')}</Text>
        <Text style={styles.description}>{event.description}</Text>

        {/* RSVP button */}
        {!event.cancelled && (
          <Button
            label={
              isAttending
                ? t('events.detail.leave')
                : isFull
                ? t('events.detail.full')
                : t('events.detail.join')
            }
            onPress={handleRsvp}
            variant={isAttending ? 'outline' : 'primary'}
            disabled={!isAttending && isFull}
            loading={isRsvpLoading}
            style={styles.rsvpButton}
          />
        )}

        {/* Creator: Cancel Event */}
        {isCreator && !event.cancelled && (
          <Button
            label={t('events.detail.cancel')}
            onPress={handleCancel}
            variant="outline"
            loading={isCancelling}
            style={styles.cancelButton}
          />
        )}

        {event.cancelled && (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledText}>{t('events.detail.cancelled')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  } as ViewStyle,
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  } as ViewStyle,
  backButton: {
    padding: spacing.xs,
  } as ViewStyle,
  shareButton: {
    padding: spacing.xs,
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: spacing.xs,
  } as TextStyle,
  activityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.primary + '20',
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semiBold,
    marginBottom: spacing.md,
  } as TextStyle,
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  } as ViewStyle,
  infoText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.gray[700],
  } as TextStyle,
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: -8,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  } as ViewStyle,
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.white,
  } as ImageStyle,
  avatarMore: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    marginLeft: -8,
  } as ViewStyle,
  avatarMoreText: {
    fontSize: typography.sizes.xs,
    color: colors.gray[600],
    fontWeight: typography.weights.semiBold,
  } as TextStyle,
  sectionLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semiBold,
    color: colors.gray[800],
    marginBottom: spacing.xs,
  } as TextStyle,
  description: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    lineHeight: 22,
    marginBottom: spacing.lg,
  } as TextStyle,
  rsvpButton: {
    marginBottom: spacing.sm,
  } as ViewStyle,
  cancelButton: {
    borderColor: colors.error,
  } as ViewStyle,
  cancelledBanner: {
    backgroundColor: colors.error + '15',
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  } as ViewStyle,
  cancelledText: {
    fontSize: typography.sizes.md,
    color: colors.error,
    fontWeight: typography.weights.semiBold,
  } as TextStyle,
})
```

---

### `functions/src/index.ts` — Update

Append two new exports. Do not touch any existing export lines.

```typescript
// Add these two lines alongside the existing exports:
export { createEvent } from './createEvent'
export { rsvpEvent } from './rsvpEvent'
```

---

### `app/navigation/MainTabNavigator.tsx` — Update

Add the Events 5th tab and the `EventsStackNavigator`. The existing 4 tabs and
`ProfileStackParamList` (including `GymCheckin` from Task 79) must not be modified.

> Only show the specific additions. Do not rewrite the whole file.

```typescript
// ─── New imports to add at the top ───────────────────────────────────────────

import EventsScreen from '@/app/events/EventsScreen'
import CreateEventScreen from '@/app/events/CreateEventScreen'
import EventDetailScreen from '@/app/events/EventDetailScreen'

// ─── New type to add to the param list exports ───────────────────────────────

export type EventsStackParamList = {
  Events: undefined
  CreateEvent: undefined
  EventDetail: { eventId: string }
}

// ─── Add Events to MainTabParamList ──────────────────────────────────────────
// Existing type already has: Discovery, Matches, Chat, Profile
// Add:
//   Events: NavigatorScreenParams<EventsStackParamList>
//
// (Use the exact field name and import NavigatorScreenParams from
//  @react-navigation/native if not already imported.)

// ─── New stack navigator to add inside the file (before the tab navigator) ───

const EventsStack = createStackNavigator<EventsStackParamList>()

function EventsStackNavigator(): React.JSX.Element {
  return (
    <EventsStack.Navigator screenOptions={{ headerShown: false }}>
      <EventsStack.Screen name="Events" component={EventsScreen} />
      <EventsStack.Screen name="CreateEvent" component={CreateEventScreen} />
      <EventsStack.Screen name="EventDetail" component={EventDetailScreen} />
    </EventsStack.Navigator>
  )
}

// ─── Add Events tab to the bottom Tab.Navigator ───────────────────────────────
// Insert between the Matches tab and the Profile tab:

<Tab.Screen
  name="Events"
  component={EventsStackNavigator}
  options={{
    tabBarLabel: t('navigation.tabs.events'),
    tabBarIcon: ({ focused, color, size }) => (
      <Ionicons
        name={focused ? 'calendar' : 'calendar-outline'}
        size={size}
        color={color}
      />
    ),
  }}
/>
```

> Do not touch the existing `ProfileStack`, `ProfileStackParamList`, `GymCheckin` screen
> registration, `ChatStack`, `MatchesStack`, or any existing `Tab.Screen` declarations.
> Do not modify `authStore`, `checkinStore`, or any store imports already in this file.

---

### `firestore.rules` — Update

Append the `/events/{id}` block. The existing `/gymCheckins/{id}` block from Task 79 must
not be touched or duplicated.

```
// ─── Events ──────────────────────────────────────────────────────────────────
match /events/{eventId} {
  // All authenticated users can read events
  allow read: if request.auth != null;

  // Client creates are denied — createEvent Cloud Function only
  allow create: if false;

  // Creator may update only these four fields
  allow update: if request.auth != null
    && request.auth.uid == resource.data.creatorId
    && request.resource.data.keys().hasOnly(
         ['title', 'description', 'maxAttendees', 'cancelled']
       );

  // Hard deletes are denied — soft-delete only via cancelled: true
  allow delete: if false;
}
```

---

### `firestore.indexes.json` — Update

Append the two new `/events` composite indexes inside the existing `"indexes"` array.
Preserve all existing indexes — do not remove or reorder them.

```json
{
  "collectionGroup": "events",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "city",      "order": "ASCENDING" },
    { "fieldPath": "cancelled", "order": "ASCENDING" },
    { "fieldPath": "startAt",   "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "events",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "attendees", "arrayConfig": "CONTAINS" },
    { "fieldPath": "startAt",   "order": "ASCENDING" }
  ]
}
```

> Validate the file after editing:
> ```bash
> node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"
> ```

---

### i18n files — Update (all four: `en.json`, `my.json`, `zh.json`, `ta.json`)

Add the `events` namespace. Use the English values as placeholders in `my.json`, `zh.json`,
and `ta.json`.

```json
"events": {
  "title": "Events",
  "tabs": {
    "discover": "Discover",
    "myEvents": "My Events"
  },
  "card": {
    "attending": "Attending",
    "join": "Join",
    "full": "Full",
    "attendeesOf": "{{count}}/{{max}} attending",
    "attendeesUnlimited": "{{count}} attending"
  },
  "discover": {
    "empty": "No upcoming events in your city",
    "createCta": "Create an Event"
  },
  "myEvents": {
    "empty": "You haven't joined any events yet"
  },
  "create": {
    "title": "Create Event",
    "titleLabel": "Event title",
    "titlePlaceholder": "e.g. Saturday morning run",
    "descriptionLabel": "Description",
    "descriptionPlaceholder": "Tell people what to expect…",
    "activityLabel": "Activity type",
    "locationLabel": "Location",
    "locationPlaceholder": "e.g. KLCC Park, Kuala Lumpur",
    "startLabel": "Start date & time",
    "endLabel": "End date & time",
    "maxAttendeesLabel": "Max attendees (optional)",
    "maxAttendeesPlaceholder": "Leave blank for unlimited",
    "submit": "Create Event",
    "errorTitle": "Couldn't create event",
    "errorMessage": "Please try again",
    "errors": {
      "titleMin": "Title must be at least 5 characters",
      "descriptionRequired": "Description is required",
      "activityRequired": "Please select an activity",
      "locationRequired": "Location is required",
      "startFuture": "Start time must be in the future",
      "endAfterStart": "End time must be after start time"
    }
  },
  "detail": {
    "about": "About this event",
    "endsAt": "Ends {{time}}",
    "attendeesOf": "{{count}} / {{max}} attending",
    "attendeesUnlimited": "{{count}} attending",
    "join": "Join Event",
    "leave": "Leave Event",
    "full": "Event Full",
    "cancel": "Cancel Event",
    "cancelled": "This event has been cancelled",
    "rsvpErrorTitle": "Couldn't update RSVP",
    "rsvpErrorMessage": "Please try again",
    "cancelConfirmTitle": "Cancel event?",
    "cancelConfirmMessage": "This cannot be undone. All attendees will be affected.",
    "cancelConfirm": "Yes, Cancel",
    "cancelErrorTitle": "Couldn't cancel event",
    "cancelErrorMessage": "Please try again"
  },
  "shareMessage": "Join me at \"{{title}}\" on Fitlink! {{link}}"
},
"navigation": {
  "tabs": {
    "events": "Events"
  }
}
```

> If `navigation.tabs` already exists in the i18n files, merge the `events` key into it —
> do not duplicate the `navigation.tabs` block.

---

## Important Architecture Notes for Codex

1. **Cloud Function–only event creation.** `createEvent` in `eventsStore.ts` calls the
   `createEvent` Cloud Function via `httpsCallable` — it never calls `addDoc` on the
   `/events` collection directly. The Firestore rules deny all client creates. Any `addDoc`
   call targeting `/events` is a security violation and must be removed.

2. **`rsvpEvent` is the only path to mutate `attendees`.** The `EventDetailScreen`'s "Cancel
   Event" button writes `{ cancelled: true }` via `updateDoc` directly (which the rules permit
   for the creator on these four specific fields), but `attendees` mutations must always go
   through `rsvpEvent`. Never use `arrayUnion` / `arrayRemove` from the client.

3. **`FitlinkEvent.id` is the Firestore document ID, not a Firestore field.** It is assigned
   from `doc.id` in `docToEvent()` inside `eventsStore.ts`. Do not add an `id` field to the
   document written by `createEvent`. When reading events in the store, always map `doc.id`
   to `event.id`.

4. **`EventsStackParamList` must be exported** from `MainTabNavigator.tsx` so that
   `EventsScreen`, `CreateEventScreen`, and `EventDetailScreen` can import and use it for
   typed navigation props. This is required for `tsc --noEmit` to pass.

5. **Events tab position.** Events is the 5th tab, inserted between Matches and Profile.
   Tab ordering in `Tab.Navigator` determines the visible order — ensure the Events
   `Tab.Screen` is placed after the Matches screen and before the Profile screen.

6. **Do not duplicate the `/gymCheckins` Firestore rules block.** Task 79 already appended
   `/gymCheckins/{id}` rules. Only the `/events/{id}` block is new. Appending a duplicate
   `/gymCheckins` block will cause the emulator to fail on the rules parse check.

7. **`DateTimePicker` install.** If `@react-native-community/datetimepicker` is not yet in
   `package.json`, install it: `npx expo install @react-native-community/datetimepicker`.
   This package is typically included with Expo SDK 52 — check before installing.

8. **Cloud Function 2nd-gen conventions.** `createEvent.ts` and `rsvpEvent.ts` must use
   `onCall` from `firebase-functions/v2/https`, region `asia-southeast1`, `CallableRequest`
   typed parameter, and `admin.firestore.FieldValue.serverTimestamp()` for `createdAt`.
   Never use `new Date()` for any Firestore timestamp write.

9. **`eventsStore` is not persisted.** Do not add `persist` middleware or `AsyncStorage`
   to `eventsStore.ts`. The store is populated on-demand when `EventsScreen` mounts.

10. **Zero `any` in Cloud Functions.** Both Cloud Function files access Firestore document
    data via bracket notation (e.g. `eventData['cancelled']`) with explicit casts rather
    than `as any`. This is the established pattern in this codebase for Admin SDK documents.

---

## Acceptance Criteria

- [ ] `functions/src/createEvent.ts` created; exports `createEvent` as a named export; uses
      `onCall` from `firebase-functions/v2/https`; region is `asia-southeast1`
- [ ] `functions/src/rsvpEvent.ts` created; exports `rsvpEvent` as a named export; uses
      `FieldValue.arrayUnion` / `arrayRemove` via Admin SDK
- [ ] Both Cloud Functions exported from `functions/src/index.ts`
- [ ] `npm --prefix functions run build` passes with zero errors
- [ ] `store/eventsStore.ts` created; not persisted; `useEventsStore` exported as named export
- [ ] `eventsStore.createEvent()` calls `httpsCallable(functions, 'createEvent')` — no
      direct `addDoc` to `/events`
- [ ] `eventsStore.rsvp()` calls `httpsCallable(functions, 'rsvpEvent')` — no direct
      `arrayUnion` / `arrayRemove` from client
- [ ] `components/events/EventCard.tsx` created; named export `EventCard`; activity icon
      mapping implemented; all styles in `StyleSheet.create`; zero inline styles
- [ ] `app/events/EventsScreen.tsx` created; default export; two tabs (Discover / My Events);
      pull-to-refresh; FAB navigates to `CreateEvent`
- [ ] `app/events/CreateEventScreen.tsx` created; default export; React Hook Form + Zod
      validation; all 16 activity chips rendered; date/time pickers for start and end
- [ ] `app/events/EventDetailScreen.tsx` created; default export; attendee avatar row (first
      5 profiles); RSVP button; creator-only Cancel; Share
- [ ] `app/navigation/MainTabNavigator.tsx` updated: `EventsStackParamList` exported;
      `EventsStackNavigator` defined and registered as the 5th bottom tab between Matches
      and Profile; `Events` icon is `calendar-outline` / `calendar`
- [ ] `MainTabParamList` updated to include `Events: NavigatorScreenParams<EventsStackParamList>`
- [ ] `firestore.rules` updated: `/events/{id}` block appended; `/gymCheckins` block from
      Task 79 is untouched and not duplicated
- [ ] `firestore.indexes.json` updated: two new `/events` indexes appended; all existing
      indexes preserved; JSON validates with `node -e "JSON.parse(...)"`
- [ ] All four i18n files updated with `events.*` keys; `navigation.tabs.events` key added
      (merged into existing `navigation.tabs` block if present)
- [ ] All user-facing strings use `t()` — zero hardcoded English strings in JSX
- [ ] All styles in `StyleSheet.create({})` — zero `style={{ }}` in JSX
- [ ] All imports use `@/` alias — zero relative paths in any new file
- [ ] Zero `any` in all new files (Cloud Functions use bracket notation + explicit casts)
- [ ] Zero `console.*` in all new files
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/checkinStore.ts`, `store/profileStore.ts`,
`store/matchStore.ts`, `store/discoveryStore.ts`, `store/chatStore.ts`,
`services/firebase/config.ts`, `services/firebase/firestore.ts` (read only; `getUserProfile`
is already exported — do not modify the file unless `getUserProfile` does not exist and must
be added), `services/places.ts`, `types/user.ts`, `types/event.ts`, `types/checkin.ts`,
`constants/`, `components/checkin/`, `components/discovery/SwipeCard.tsx`,
`app/checkin/GymCheckinScreen.tsx`, `app/profile/ProfileScreen.tsx`,
`functions/src/createCheckin.ts`, `functions/src/recordSwipe.ts`,
`functions/src/getDiscoveryStack.ts`, `BUILD.md`

---

## Commit

```
git commit -m "task-80: workout events create, discover, rsvp, and events tab"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3C - Task 80] - YYYY-MM-DD

### Completed

- Task 80: Workout Events — Create & Discover
- createEvent: 2nd-gen callable validates input, writes /events/{id} with server-owned
  fields (creatorId, attendees: [uid], cancelled: false, createdAt), returns eventId
- rsvpEvent: 2nd-gen callable mutates attendees array via arrayUnion / arrayRemove with
  capacity enforcement; returns updated attendees array
- eventsStore: non-persisted Zustand store; fetchUpcomingEvents by city with compound
  Firestore query; fetchMyEvents by uid array-contains; createEvent and rsvp via callables
- EventCard: activity icon mapping, date formatting, RSVP status pill, attendee count
- EventsScreen: Discover / My Events tabs; pull-to-refresh; FAB to CreateEvent
- CreateEventScreen: React Hook Form + Zod; 16 activity chips; start/end DateTimePicker;
  optional maxAttendees; submits via eventsStore.createEvent()
- EventDetailScreen: attendee avatar row (first 5 profiles via getUserProfile); RSVP;
  creator Cancel via direct updateDoc; Share
- MainTabNavigator: EventsStackParamList exported; EventsStackNavigator with 3 screens;
  Events added as 5th bottom tab between Matches and Profile
- firestore.rules: /events/{id} block appended; read all-auth, create false, update creator-
  limited 4 fields, delete false
- firestore.indexes.json: (city, cancelled, startAt) and (attendees ARRAY_CONTAINS, startAt)
  indexes added for /events
- events.* and navigation.tabs.events i18n keys added to all 4 language files

### Files Created / Modified

- functions/src/createEvent.ts: created — 2nd-gen callable, input validation, batch write
- functions/src/rsvpEvent.ts: created — 2nd-gen callable, capacity check, arrayUnion/Remove
- functions/src/index.ts: createEvent and rsvpEvent exports appended
- store/eventsStore.ts: created — non-persisted; fetchUpcomingEvents, fetchMyEvents,
  createEvent, rsvp actions
- components/events/EventCard.tsx: created — activity icon map, date format, RSVP pill
- app/events/EventsScreen.tsx: created — two-tab layout, pull-to-refresh, FAB
- app/events/CreateEventScreen.tsx: created — RHF+Zod form, activity chips, date pickers
- app/events/EventDetailScreen.tsx: created — attendee profiles, RSVP, cancel, share
- app/navigation/MainTabNavigator.tsx: EventsStackParamList exported; EventsStackNavigator;
  Events 5th tab added
- firestore.rules: /events/{id} block appended
- firestore.indexes.json: two /events composite indexes appended
- i18n/en.json, my.json, zh.json, ta.json: events.* and navigation.tabs.events keys added

### Architecture Decisions

- [Note any divergence from the scaffold — e.g. if DateTimePicker was already installed,
  or if getUserProfile required a signature change, or if the navigation type merge required
  a different import pattern]

### Known Issues / Deferred

- /gymCheckins compound indexes (userId + expiresAt, city + expiresAt) remain deferred
  to Task 88 per the Task 79 CHANGELOG entry
- Google Places autocomplete UI in CreateEventScreen deferred to Phase 4; location is free-
  text input in this task
- Expired /events documents are not physically cleaned up; a scheduled Cloud Function for
  this is deferred to Phase 4

### Verification

- npm --prefix functions run build passes
- npx tsc --noEmit passes
- firestore.indexes.json JSON.parse validation passes
- i18n JSON parse check passes for en/my/zh/ta
- git diff --check passes
- Scoped scans confirm no any, inline style={{ }}, console.*, or relative imports in
  all new and touched files

### Next Up

- Task 81: SEA Expansion — Singapore & Thailand Regions
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 81 prompt.

---

## Reasoning Level

**Extra High**

This task introduces 7 new files, modifies 5 existing shared files (navigator, rules, indexes,
4 i18n files, functions index), adds a new bottom tab, and coordinates two Cloud Functions
with a Zustand store, three screens, and a shared component — all of which must interlock
correctly with the navigation type system, Firestore rules, and the existing Task 79
check-in infrastructure. A single type mismatch in `EventsStackParamList`, a misplaced tab
in the navigator, or a duplicated Firestore rules block will break the build or the running
app.
