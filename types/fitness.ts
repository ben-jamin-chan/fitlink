import type { Timestamp } from 'firebase/firestore'

export type {
  FitnessTrackingSource,
  WorkoutSession,
  TodayStats,
  FitnessSourceConnection,
  StravaConnection,
  FitnessTracking,
} from '@/types/subscription'

export type { FitnessTrackingSource as FitnessSource } from '@/types/subscription'

/**
 * Per-source connection status held in fitnessStore.connections.
 * lastSync is null before the first successful sync.
 */
export interface FitnessConnectionStatus {
  connected: boolean
  lastSync: Timestamp | null
}

/**
 * Strava API activity object subset returned by the Strava v3 activities API.
 */
export interface StravaActivity {
  id: number
  name: string
  type: string
  start_date: string
  moving_time: number
  distance: number
  total_elevation_gain: number
  calories: number
  average_heartrate?: number
  max_heartrate?: number
}
