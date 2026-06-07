import { GeoPoint, Timestamp } from 'firebase/firestore'

// Mirrors the /gymCheckins/{checkinId} Firestore document schema exactly.
// id is the document ID, populated client-side after fetch - not stored in the document.
export interface GymCheckin {
  id: string
  userId: string
  placeId: string
  gymName: string
  coordinates: GeoPoint
  city: string
  checkedInAt: Timestamp
  expiresAt: Timestamp
}

// Shape returned by services/places.ts from the Google Places API (New).
// Used in GymSearchList, GymCheckinScreen, and the createCheckin Cloud Function call.
export interface GymPlace {
  placeId: string
  name: string
  address: string
  coordinates: GeoPoint
  rating?: number
  photoUrl?: string
}
