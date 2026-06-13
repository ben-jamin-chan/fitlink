import { create } from 'zustand'
import {
  collection,
  doc,
  GeoPoint,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { HttpsCallable } from 'firebase/functions'

import { db } from '@/services/firebase/config'

import type { EventLocation, FitlinkEvent } from '@/types/event'

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
  action: RsvpAction
}

interface RsvpEventResult {
  attendees: string[]
}

interface EventDocument {
  creatorId: string
  title: string
  description: string
  activityType: string
  location: EventLocation
  startAt: Timestamp
  endAt: Timestamp
  maxAttendees: number | null
  attendees: string[]
  city: string
  country: string
  createdAt: Timestamp
  cancelled: boolean
}

interface EventsState {
  upcomingEvents: FitlinkEvent[]
  myEvents: FitlinkEvent[]
  isLoading: boolean
}

interface EventsActions {
  fetchUpcomingEvents: (city: string) => Promise<void>
  fetchMyEvents: (uid: string) => Promise<void>
  fetchEventById: (eventId: string) => Promise<FitlinkEvent | null>
  createEvent: (data: CreateEventData) => Promise<string>
  rsvp: (eventId: string, action: RsvpAction) => Promise<void>
}

type EventsStore = EventsState & EventsActions
type RsvpAction = 'join' | 'leave'

const CALLABLE_REGION = 'asia-southeast1'
const CREATE_EVENT_CALLABLE = 'createEvent'
const RSVP_EVENT_CALLABLE = 'rsvpEvent'
const UPCOMING_EVENTS_LIMIT = 20

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

const isEventLocation = (value: unknown): value is EventLocation => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.name === 'string' &&
    typeof value.address === 'string' &&
    value.coordinates instanceof GeoPoint &&
    typeof value.placeId === 'string'
  )
}

const isNullableNumber = (value: unknown): value is number | null => {
  return value === null || typeof value === 'number'
}

const isEventDocument = (value: unknown): value is EventDocument => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.creatorId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.activityType === 'string' &&
    isEventLocation(value.location) &&
    value.startAt instanceof Timestamp &&
    value.endAt instanceof Timestamp &&
    isNullableNumber(value.maxAttendees) &&
    isStringArray(value.attendees) &&
    typeof value.city === 'string' &&
    typeof value.country === 'string' &&
    value.createdAt instanceof Timestamp &&
    typeof value.cancelled === 'boolean'
  )
}

const getCreateEventFn = (): HttpsCallable<
  CreateEventData,
  CreateEventResult
> =>
  httpsCallable<CreateEventData, CreateEventResult>(
    getFunctions(undefined, CALLABLE_REGION),
    CREATE_EVENT_CALLABLE
  )

const getRsvpEventFn = (): HttpsCallable<RsvpEventData, RsvpEventResult> =>
  httpsCallable<RsvpEventData, RsvpEventResult>(
    getFunctions(undefined, CALLABLE_REGION),
    RSVP_EVENT_CALLABLE
  )

const toFitlinkEvent = (
  id: string,
  data: EventDocument
): FitlinkEvent => ({
  id,
  creatorId: data.creatorId,
  title: data.title,
  description: data.description,
  activityType: data.activityType,
  location: data.location,
  startAt: data.startAt,
  endAt: data.endAt,
  maxAttendees: data.maxAttendees,
  attendees: data.attendees,
  city: data.city,
  country: data.country,
  createdAt: data.createdAt,
  cancelled: data.cancelled,
})

const sortEventsByStart = (
  first: FitlinkEvent,
  second: FitlinkEvent
): number => first.startAt.toMillis() - second.startAt.toMillis()

const getEventsFromSnapshot = (
  docs: Array<{ id: string; data: () => unknown }>
): FitlinkEvent[] => {
  const events: FitlinkEvent[] = []

  docs.forEach((eventDoc) => {
    const data = eventDoc.data()

    if (isEventDocument(data)) {
      events.push(toFitlinkEvent(eventDoc.id, data))
    }
  })

  return events
}

const patchEventAttendees = (
  event: FitlinkEvent,
  eventId: string,
  attendees: string[]
): FitlinkEvent =>
  event.id === eventId
    ? {
        ...event,
        attendees,
      }
    : event

export const useEventsStore = create<EventsStore>()((set) => ({
  upcomingEvents: [],
  myEvents: [],
  isLoading: false,

  fetchUpcomingEvents: async (city: string): Promise<void> => {
    if (city.trim().length === 0) {
      set({ upcomingEvents: [] })
      return
    }

    set({ isLoading: true })

    try {
      const eventsQuery = query(
        collection(db, 'events'),
        where('city', '==', city.trim()),
        where('cancelled', '==', false),
        where('startAt', '>', Timestamp.now()),
        orderBy('startAt', 'asc'),
        limit(UPCOMING_EVENTS_LIMIT)
      )
      const snapshot = await getDocs(eventsQuery)
      set({ upcomingEvents: getEventsFromSnapshot(snapshot.docs) })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchMyEvents: async (uid: string): Promise<void> => {
    if (uid.trim().length === 0) {
      set({ myEvents: [] })
      return
    }

    set({ isLoading: true })

    try {
      const eventsQuery = query(
        collection(db, 'events'),
        where('attendees', 'array-contains', uid),
        orderBy('startAt', 'asc')
      )
      const snapshot = await getDocs(eventsQuery)
      set({ myEvents: getEventsFromSnapshot(snapshot.docs) })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchEventById: async (eventId: string): Promise<FitlinkEvent | null> => {
    if (eventId.trim().length === 0) {
      return null
    }

    const snapshot = await getDoc(doc(db, 'events', eventId.trim()))
    const data = snapshot.data()

    if (!snapshot.exists() || !isEventDocument(data)) {
      return null
    }

    return toFitlinkEvent(snapshot.id, data)
  },

  createEvent: async (data: CreateEventData): Promise<string> => {
    const createEvent = getCreateEventFn()
    const result = await createEvent(data)
    return result.data.eventId
  },

  rsvp: async (eventId: string, action: RsvpAction): Promise<void> => {
    const rsvpEvent = getRsvpEventFn()
    const result = await rsvpEvent({ eventId, action })
    const updatedAttendees = result.data.attendees

    set((state) => {
      const upcomingEvents = state.upcomingEvents.map((event) =>
        patchEventAttendees(event, eventId, updatedAttendees)
      )
      const patchedMyEvents = state.myEvents.map((event) =>
        patchEventAttendees(event, eventId, updatedAttendees)
      )

      if (action === 'leave') {
        return {
          upcomingEvents,
          myEvents: patchedMyEvents.filter((event) => event.id !== eventId),
        }
      }

      const alreadyInMyEvents = patchedMyEvents.some(
        (event) => event.id === eventId
      )
      const joinedEvent = upcomingEvents.find((event) => event.id === eventId)

      if (alreadyInMyEvents || joinedEvent === undefined) {
        return {
          upcomingEvents,
          myEvents: patchedMyEvents,
        }
      }

      return {
        upcomingEvents,
        myEvents: [...patchedMyEvents, joinedEvent].sort(sortEventsByStart),
      }
    })
  },
}))
