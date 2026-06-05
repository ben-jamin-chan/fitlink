import { NativeModules, Platform } from 'react-native'

declare const require: (moduleName: string) => unknown

interface CrashlyticsClient {
  log: (message: string) => void
  recordError: (error: Error) => void
  setAttribute: (name: string, value: string) => Promise<null>
  setUserId: (uid: string) => Promise<null>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isCrashlyticsClient = (value: unknown): value is CrashlyticsClient => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.log === 'function' &&
    typeof value.recordError === 'function' &&
    typeof value.setAttribute === 'function' &&
    typeof value.setUserId === 'function'
  )
}

const isCrashlyticsFactory = (value: unknown): value is (() => unknown) =>
  typeof value === 'function'

const hasReactNativeFirebaseAppModule = (): boolean => {
  const nativeModules: unknown = NativeModules

  return isRecord(nativeModules) && isRecord(nativeModules.RNFBAppModule)
}

const getCrashlyticsClient = (): CrashlyticsClient | null => {
  try {
    if (!hasReactNativeFirebaseAppModule()) {
      return null
    }

    const crashlyticsModule = require('@react-native-firebase/crashlytics')
    const crashlyticsFactory = isRecord(crashlyticsModule)
      ? crashlyticsModule.default
      : crashlyticsModule

    if (!isCrashlyticsFactory(crashlyticsFactory)) {
      return null
    }

    const client = crashlyticsFactory()

    if (!isCrashlyticsClient(client)) {
      return null
    }

    return client
  } catch {
    return null
  }
}

const ignorePromise = (promise: Promise<null>): void => {
  void promise.catch(() => {
    return undefined
  })
}

export const logError = (
  error: Error,
  context?: Record<string, string>
): void => {
  try {
    const client = getCrashlyticsClient()

    if (client === null) {
      return
    }

    if (context !== undefined) {
      const entries = Object.entries(context)
      for (const [key, value] of entries) {
        ignorePromise(client.setAttribute(key, value))
      }
    }

    client.recordError(error)
  } catch {
    return undefined
  }
}

export const setUser = (uid: string): void => {
  try {
    const client = getCrashlyticsClient()

    if (client === null) {
      return
    }

    ignorePromise(client.setUserId(uid))
    ignorePromise(client.setAttribute('platform', Platform.OS))
  } catch {
    return undefined
  }
}

export const log = (message: string): void => {
  try {
    const client = getCrashlyticsClient()

    if (client === null) {
      return
    }

    client.log(message)
  } catch {
    return undefined
  }
}
