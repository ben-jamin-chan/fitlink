import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { doc, updateDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { Functions } from 'firebase/functions'

import { db } from '@/services/firebase/config'
import { useFitnessStore } from '@/store/fitnessStore'

import type { TodayStats, WorkoutSession } from '@/types/fitness'

interface ExchangeStravaTokenRequest {
  code: string
}

interface ExchangeStravaTokenResponse {
  success: boolean
}

interface SyncStravaActivityResponse {
  steps: number
  distance: number
  calories: number
  workouts: WorkoutSession[]
}

const CALLABLE_REGION = 'asia-southeast1'
const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? ''
const STRAVA_SCOPE = 'activity:read_all'
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize'

const getStravaRedirectUri = (): string =>
  AuthSession.makeRedirectUri({ scheme: 'fitlink', path: 'strava-auth' })

const getStravaAuthUrl = (redirectUri: string): string => {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPE,
  })

  return `${STRAVA_AUTH_URL}?${params.toString()}`
}

const getCodeFromRedirectUrl = (url: string): string | null => {
  const codeMatch = /[?&]code=([^&]+)/.exec(url)

  if (codeMatch === null || codeMatch[1] === undefined) {
    return null
  }

  try {
    return decodeURIComponent(codeMatch[1])
  } catch {
    return null
  }
}

const getCallableFunctions = (): Functions =>
  getFunctions(undefined, CALLABLE_REGION)

export const connectStrava = async (uid: string): Promise<boolean> => {
  void uid

  if (STRAVA_CLIENT_ID.length === 0) {
    throw new Error(
      'EXPO_PUBLIC_STRAVA_CLIENT_ID is not set. Add it to your .env file and restart the dev server.'
    )
  }

  const redirectUri = getStravaRedirectUri()
  const authUrl = getStravaAuthUrl(redirectUri)
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri)

  if (result.type !== 'success') {
    return false
  }

  const code = getCodeFromRedirectUrl(result.url)
  if (code === null) {
    return false
  }

  const exchange = httpsCallable<
    ExchangeStravaTokenRequest,
    ExchangeStravaTokenResponse
  >(getCallableFunctions(), 'exchangeStravaToken')
  const response = await exchange({ code })

  if (!response.data.success) {
    return false
  }

  useFitnessStore
    .getState()
    .setConnectionStatus('strava', { connected: true, lastSync: null })

  return true
}

export const syncStrava = async (): Promise<TodayStats> => {
  const syncFn = httpsCallable<Record<string, never>, SyncStravaActivityResponse>(
    getCallableFunctions(),
    'syncStravaActivity'
  )
  const response = await syncFn({})
  const data = response.data

  const stats: TodayStats = {
    steps: data.steps,
    distance: data.distance,
    calories: data.calories,
    workouts: data.workouts,
    updatedAt: null,
    source: 'strava',
  }

  return stats
}

export const disconnectStrava = async (uid: string): Promise<void> => {
  const userRef = doc(db, 'users', uid)

  await updateDoc(userRef, {
    'fitnessTracking.strava.connected': false,
    'fitnessTracking.strava.lastSync': null,
  })

  useFitnessStore
    .getState()
    .setConnectionStatus('strava', { connected: false, lastSync: null })
}
