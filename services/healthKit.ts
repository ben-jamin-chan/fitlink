/*
 * INSTALL REQUIRED (development build only — does not work in Expo Go):
 *   npx expo install react-native-health
 *
 * Add to app.json plugins array:
 *   ["react-native-health", {
 *     "NSHealthShareUsageDescription": "fitlink reads your activity to show your fitness stats to matches.",
 *     "NSHealthUpdateUsageDescription": "fitlink does not write to Apple Health."
 *   }]
 *
 * Then rebuild: eas build --profile development --platform ios
 */

import { Platform } from 'react-native'

import AppleHealthKit from 'react-native-health'
import type { HealthKitPermissions, HealthValue } from 'react-native-health'
import { serverTimestamp } from 'firebase/firestore'
import type { FieldValue } from 'firebase/firestore'

import { updateUserProfile } from '@/services/firebase/firestore'

import type { TodayStats, WorkoutSession } from '@/types/fitness'

const HEALTHKIT_PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.Workout,
    ],
    write: [],
  },
}

interface HealthQueryWindow {
  startDate: string
  endDate: string
}

interface AppleHealthTodayStatsWrite
  extends Omit<TodayStats, 'updatedAt'> {
  updatedAt: FieldValue
  source: 'appleHealth'
}

interface AppleHealthConnectionWrite {
  connected: boolean
  lastSync: FieldValue | null
}

interface AppleHealthWorkoutSample extends HealthValue {
  activityName?: string
  duration?: number
  distance?: number
  calories?: number
}

const createEmptyTodayStats = (): TodayStats => ({
  steps: 0,
  distance: 0,
  calories: 0,
  workouts: [],
  updatedAt: null,
  source: 'appleHealth',
})

const getTodayQueryWindow = (): HealthQueryWindow => {
  const nowMs = Date.now()
  const startOfToday = new globalThis.Date(nowMs)
  startOfToday.setHours(0, 0, 0, 0)

  return {
    startDate: startOfToday.toISOString(),
    endDate: new globalThis.Date(nowMs).toISOString(),
  }
}

const toWorkoutSession = (sample: HealthValue): WorkoutSession => {
  // react-native-health types getSamples as HealthValue[] even for workouts;
  // at runtime workout samples include these optional workout-specific fields.
  const workout = sample as AppleHealthWorkoutSample

  return {
    type: workout.activityName ?? 'Workout',
    duration:
      workout.duration !== undefined ? Math.round(workout.duration / 60) : 0,
    distance:
      workout.distance !== undefined ? workout.distance / 1000 : undefined,
    calories:
      workout.calories !== undefined ? Math.round(workout.calories) : undefined,
  }
}

export const isAppleHealthAvailable = (): boolean => {
  if (Platform.OS !== 'ios') {
    return false
  }

  return AppleHealthKit.isAvailable !== undefined
}

export const requestAppleHealthPermissions = (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return Promise.resolve(false)
  }

  return new Promise<boolean>((resolve) => {
    AppleHealthKit.initHealthKit(HEALTHKIT_PERMISSIONS, (error: string) => {
      if (error.length > 0) {
        resolve(false)
        return
      }

      resolve(true)
    })
  })
}

export const fetchAppleHealthTodayStats = (): Promise<TodayStats> => {
  if (Platform.OS !== 'ios') {
    return Promise.resolve(createEmptyTodayStats())
  }

  const queryWindow = getTodayQueryWindow()
  const dailyOptions = {
    date: queryWindow.startDate,
    includeManuallyAdded: true,
  }
  const rangeOptions = {
    ...dailyOptions,
    startDate: queryWindow.startDate,
    endDate: queryWindow.endDate,
  }

  const fetchSteps = (): Promise<number> =>
    new Promise<number>((resolve) => {
      AppleHealthKit.getStepCount(
        dailyOptions,
        (_error: string, result: HealthValue): void => {
          resolve(result.value ?? 0)
        }
      )
    })

  const fetchDistance = (): Promise<number> =>
    new Promise<number>((resolve) => {
      AppleHealthKit.getDistanceWalkingRunning(
        dailyOptions,
        (_error: string, result: HealthValue): void => {
          resolve((result.value ?? 0) / 1000)
        }
      )
    })

  const fetchCalories = (): Promise<number> =>
    new Promise<number>((resolve) => {
      AppleHealthKit.getActiveEnergyBurned(
        rangeOptions,
        (_error: string, results: HealthValue[]): void => {
          const total = Array.isArray(results)
            ? results.reduce((sum, result) => sum + (result.value ?? 0), 0)
            : 0

          resolve(Math.round(total))
        }
      )
    })

  const fetchWorkouts = (): Promise<WorkoutSession[]> =>
    new Promise<WorkoutSession[]>((resolve) => {
      AppleHealthKit.getSamples(
        {
          startDate: queryWindow.startDate,
          endDate: queryWindow.endDate,
          type: AppleHealthKit.Constants.Observers.Workout,
        },
        (_error: string, results: HealthValue[]): void => {
          if (!Array.isArray(results)) {
            resolve([])
            return
          }

          resolve(results.map(toWorkoutSession))
        }
      )
    })

  return Promise.all([
    fetchSteps(),
    fetchDistance(),
    fetchCalories(),
    fetchWorkouts(),
  ]).then(([steps, distance, calories, workouts]): TodayStats => ({
    steps,
    distance,
    calories,
    workouts,
    updatedAt: null,
    source: 'appleHealth',
  }))
}

export const updateAppleHealthFirestore = async (
  uid: string,
  stats: Omit<TodayStats, 'updatedAt'>
): Promise<void> => {
  if (Platform.OS !== 'ios') {
    return
  }

  const todayStats: AppleHealthTodayStatsWrite = {
    ...stats,
    source: 'appleHealth',
    updatedAt: serverTimestamp(),
  }

  await updateUserProfile(uid, {
    'fitnessTracking.todayStats': todayStats,
  })
}

export const setAppleHealthConnected = async (
  uid: string,
  connected: boolean
): Promise<void> => {
  if (Platform.OS !== 'ios') {
    return
  }

  const connectionStatus: AppleHealthConnectionWrite = {
    connected,
    lastSync: connected ? serverTimestamp() : null,
  }

  await updateUserProfile(uid, {
    'fitnessTracking.appleHealth': connectionStatus,
  })
}
