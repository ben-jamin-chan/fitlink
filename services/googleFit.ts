import { Platform } from 'react-native'

import { serverTimestamp } from 'firebase/firestore'
import type { FieldValue } from 'firebase/firestore'
import GoogleFit, { Scopes } from 'react-native-google-fit'
import type {
  ActivitySampleResponse,
  CalorieResponse,
  DistanceResponse,
  StepsResponse,
} from 'react-native-google-fit'

import { updateUserProfile } from '@/services/firebase/firestore'

import type { TodayStats, WorkoutSession } from '@/types/fitness'

interface GoogleFitQueryWindow {
  startDate: string
  endDate: string
}

interface GoogleFitTodayStatsWrite extends Omit<TodayStats, 'updatedAt'> {
  updatedAt: FieldValue
  source: 'googleFit'
}

const createEmptyTodayStats = (): TodayStats => ({
  steps: 0,
  distance: 0,
  calories: 0,
  workouts: [],
  updatedAt: null,
  source: 'googleFit',
})

const getTodayQueryWindow = (): GoogleFitQueryWindow => {
  const nowMs = Date.now()
  const startOfToday = new globalThis.Date(nowMs)
  startOfToday.setHours(0, 0, 0, 0)

  return {
    startDate: startOfToday.toISOString(),
    endDate: new globalThis.Date(nowMs).toISOString(),
  }
}

const getTotalSteps = (stepData: StepsResponse[]): number => {
  const estimatedSteps = stepData.find(
    (entry) => entry.source === 'com.google.android.gms:estimated_steps'
  )
  const rawSteps = stepData.find(
    (entry) => entry.source === 'com.google.android.gms'
  )
  const stepSource = estimatedSteps ?? rawSteps

  if (stepSource === undefined || stepSource.steps.length === 0) {
    return 0
  }

  return stepSource.steps.reduce((sum, entry) => sum + entry.value, 0)
}

const getTotalDistanceKm = (distanceData: DistanceResponse[]): number => {
  const totalDistanceMetres = distanceData.reduce(
    (sum, entry) => sum + entry.distance,
    0
  )

  return Math.round((totalDistanceMetres / 1000) * 100) / 100
}

const getTotalCalories = (calorieData: CalorieResponse[]): number => {
  const totalCalories = calorieData.reduce(
    (sum, entry) => sum + entry.calorie,
    0
  )

  return Math.round(totalCalories)
}

const toWorkoutSession = (
  session: ActivitySampleResponse
): WorkoutSession | null => {
  const duration = Math.round((session.end - session.start) / 60000)

  if (duration <= 0) {
    return null
  }

  return {
    type: session.activityName.length > 0 ? session.activityName : 'Workout',
    duration,
    distance:
      session.distance !== undefined ? session.distance / 1000 : undefined,
    calories:
      session.calories !== undefined ? Math.round(session.calories) : undefined,
  }
}

const getWorkoutSessions = (
  activityData: ActivitySampleResponse[]
): WorkoutSession[] => {
  const workouts: WorkoutSession[] = []

  for (const session of activityData) {
    const workout = toWorkoutSession(session)

    if (workout !== null) {
      workouts.push(workout)
    }
  }

  return workouts
}

export const isGoogleFitAvailable = (): boolean => {
  if (Platform.OS !== 'android') {
    return false
  }

  return true
}

export const requestGoogleFitPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false
  }

  try {
    const authorized = await GoogleFit.authorize({
      scopes: [
        Scopes.FITNESS_ACTIVITY_READ,
        Scopes.FITNESS_LOCATION_READ,
        Scopes.FITNESS_BODY_READ,
      ],
    })

    return authorized.success
  } catch {
    return false
  }
}

export const fetchGoogleFitTodayStats = async (): Promise<TodayStats> => {
  if (Platform.OS !== 'android') {
    return createEmptyTodayStats()
  }

  const queryWindow = getTodayQueryWindow()
  let steps = 0
  let distance = 0
  let calories = 0
  let workouts: WorkoutSession[] = []

  try {
    const stepData = await GoogleFit.getDailyStepCountSamples(queryWindow)
    steps = getTotalSteps(stepData)
  } catch {
    steps = 0
  }

  try {
    const distanceData = await GoogleFit.getDailyDistanceSamples(queryWindow)
    distance = getTotalDistanceKm(distanceData)
  } catch {
    distance = 0
  }

  try {
    const calorieData = await GoogleFit.getDailyCalorieSamples({
      ...queryWindow,
      basalCalculation: false,
    })
    calories = getTotalCalories(calorieData)
  } catch {
    calories = 0
  }

  try {
    const activityData = await GoogleFit.getActivitySamples(queryWindow)
    workouts = getWorkoutSessions(activityData)
  } catch {
    workouts = []
  }

  return {
    steps,
    distance,
    calories,
    workouts,
    updatedAt: null,
    source: 'googleFit',
  }
}

export const updateGoogleFitFirestore = async (
  uid: string,
  stats: Omit<TodayStats, 'updatedAt'>
): Promise<void> => {
  if (Platform.OS !== 'android') {
    return
  }

  const todayStats: GoogleFitTodayStatsWrite = {
    ...stats,
    source: 'googleFit',
    updatedAt: serverTimestamp(),
  }

  await updateUserProfile(uid, {
    'fitnessTracking.todayStats': todayStats,
  })
}

export const setGoogleFitConnected = async (
  uid: string,
  connected: boolean
): Promise<void> => {
  if (Platform.OS !== 'android') {
    return
  }

  await updateUserProfile(uid, {
    'fitnessTracking.googleFit.connected': connected,
    'fitnessTracking.googleFit.lastSync': connected ? serverTimestamp() : null,
  })
}
