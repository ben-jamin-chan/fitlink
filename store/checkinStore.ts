import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  GeoPoint,
  limit,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { HttpsCallable } from 'firebase/functions'
import { create } from 'zustand'

import { db } from '@/services/firebase/config'

import type { GymCheckin, GymPlace } from '@/types/checkin'

interface CreateCheckinRequest {
  placeId: string
  gymName: string
  latitude: number
  longitude: number
  city: string
}

interface CreateCheckinResult {
  checkinId: string
  expiresAt: {
    seconds: number
    nanoseconds: number
  }
}

interface GymCheckinDocument {
  userId: string
  placeId: string
  gymName: string
  coordinates: GeoPoint
  city: string
  checkedInAt: Timestamp
  expiresAt: Timestamp
}

interface CheckinState {
  activeCheckin: GymCheckin | null
  isLoading: boolean
  unsubscribe: Unsubscribe | null
}

interface CheckinActions {
  subscribeToActiveCheckin: (uid: string) => void
  unsubscribeFromActiveCheckin: () => void
  checkIn: (gym: GymPlace, city: string) => Promise<void>
  checkOut: (uid: string) => Promise<void>
}

type CheckinStore = CheckinState & CheckinActions

const CALLABLE_REGION = 'asia-southeast1'
const CREATE_CHECKIN_CALLABLE = 'createCheckin'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isGymCheckinDocument = (
  value: unknown
): value is GymCheckinDocument => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.userId === 'string' &&
    typeof value.placeId === 'string' &&
    typeof value.gymName === 'string' &&
    value.coordinates instanceof GeoPoint &&
    typeof value.city === 'string' &&
    value.checkedInAt instanceof Timestamp &&
    value.expiresAt instanceof Timestamp
  )
}

const getCreateCheckinFn = (): HttpsCallable<
  CreateCheckinRequest,
  CreateCheckinResult
> =>
  httpsCallable<CreateCheckinRequest, CreateCheckinResult>(
    getFunctions(undefined, CALLABLE_REGION),
    CREATE_CHECKIN_CALLABLE
  )

const toGymCheckin = (
  id: string,
  data: GymCheckinDocument
): GymCheckin => ({
  id,
  userId: data.userId,
  placeId: data.placeId,
  gymName: data.gymName,
  coordinates: data.coordinates,
  city: data.city,
  checkedInAt: data.checkedInAt,
  expiresAt: data.expiresAt,
})

export const useCheckinStore = create<CheckinStore>()((set, get) => ({
  activeCheckin: null,
  isLoading: false,
  unsubscribe: null,

  subscribeToActiveCheckin: (uid: string): void => {
    get().unsubscribeFromActiveCheckin()

    const activeCheckinsQuery = query(
      collection(db, 'gymCheckins'),
      where('userId', '==', uid),
      where('expiresAt', '>', Timestamp.now()),
      limit(1)
    )

    const unsubscribe = onSnapshot(
      activeCheckinsQuery,
      (snapshot): void => {
        const firstDoc = snapshot.docs[0]

        if (firstDoc === undefined) {
          set({ activeCheckin: null })
          return
        }

        const data: unknown = firstDoc.data()

        if (!isGymCheckinDocument(data)) {
          set({ activeCheckin: null })
          return
        }

        set({ activeCheckin: toGymCheckin(firstDoc.id, data) })
      },
      (): void => {
        set({ activeCheckin: null })
      }
    )

    set({ unsubscribe })
  },

  unsubscribeFromActiveCheckin: (): void => {
    const unsubscribe = get().unsubscribe

    if (unsubscribe !== null) {
      unsubscribe()
    }

    set({ activeCheckin: null, unsubscribe: null })
  },

  checkIn: async (gym: GymPlace, city: string): Promise<void> => {
    set({ isLoading: true })

    try {
      const createCheckin = getCreateCheckinFn()

      await createCheckin({
        placeId: gym.placeId,
        gymName: gym.name,
        latitude: gym.coordinates.latitude,
        longitude: gym.coordinates.longitude,
        city,
      })
    } finally {
      set({ isLoading: false })
    }
  },

  checkOut: async (uid: string): Promise<void> => {
    const activeCheckin = get().activeCheckin

    if (activeCheckin === null) {
      return
    }

    set({ isLoading: true })

    try {
      await deleteDoc(doc(db, 'gymCheckins', activeCheckin.id))
      await updateDoc(doc(db, 'users', uid), {
        gymCheckin: deleteField(),
      })
      set({ activeCheckin: null })
    } finally {
      set({ isLoading: false })
    }
  },
}))
